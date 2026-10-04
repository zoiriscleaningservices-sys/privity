import React, { useState, useMemo } from 'react';
import { LiveMeStreamer } from './types';
import { liveStreamSync } from '../../services/liveStreamSyncService';
import { authService, UserAccount } from '../../services/authService';

export interface LiveCoHostCreatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHostName: string;
  currentHostHandle: string;
  currentHostAvatar: string;
  onStartBattle: (rival: LiveMeStreamer) => void;
  showToast: (msg: string) => void;
}

interface RealCreatorItem {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  badge: string;
  badgeColor: string;
  viewers: number;
  cohosts: string[];
  canInvite: boolean;
}

export const LiveCoHostCreatorsModal: React.FC<LiveCoHostCreatorsModalProps> = ({
  isOpen,
  onClose,
  currentHostName,
  currentHostHandle,
  currentHostAvatar,
  onStartBattle,
  showToast,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<'Music' | 'Chatting' | 'Gaming' | 'Dance'>('Music');
  const [isQuickScanning, setIsQuickScanning] = useState(false);
  const [invitedHandles, setInvitedHandles] = useState<Record<string, boolean>>({});
  const [nudgedHandles, setNudgedHandles] = useState<Record<string, boolean>>({});
  const [showMoreFriends, setShowMoreFriends] = useState(false);

  // Load real registered accounts and real active broadcasters from the system
  const { realFriends, realSuggested } = useMemo(() => {
    const cleanCurrentHandle = currentHostHandle.replace(/^@/, '').toLowerCase().trim();
    const allAccounts: Record<string, UserAccount> = authService.getAllAccounts();
    const networkStreamers = liveStreamSync.getStreamersList();

    // Collect followed handles from localStorage
    let followedHandles: string[] = [];
    try {
      const storedFollowing = localStorage.getItem('privity_following_v5');
      if (storedFollowing) {
        followedHandles = Object.keys(JSON.parse(storedFollowing)).map((h) => h.replace(/^@/, '').toLowerCase());
      }
    } catch {}

    const friends: RealCreatorItem[] = [];
    const suggested: RealCreatorItem[] = [];

    // 1. Process active network broadcasters
    networkStreamers.forEach((streamer) => {
      const h = streamer.handle.replace(/^@/, '').toLowerCase().trim();
      if (h === cleanCurrentHandle || streamer.isHost) return;

      const item: RealCreatorItem = {
        id: streamer.id || h,
        name: streamer.name,
        handle: streamer.handle.startsWith('@') ? streamer.handle : `@${streamer.handle}`,
        avatar: streamer.avatar,
        badge: streamer.diamonds > 200 ? 'C5' : streamer.diamonds > 100 ? 'B1' : 'A1',
        badgeColor: streamer.diamonds > 200 ? '#f97316' : '#38bdf8',
        viewers: streamer.viewersCount || 1,
        cohosts: [],
        canInvite: true,
      };

      if (followedHandles.includes(h)) {
        friends.push(item);
      } else {
        suggested.push(item);
      }
    });

    // 2. Process registered user accounts
    Object.values(allAccounts).forEach((acc) => {
      const h = acc.handle.replace(/^@/, '').toLowerCase().trim();
      if (h === cleanCurrentHandle) return;
      if (friends.some((f) => f.handle.toLowerCase() === `@${h}`) || suggested.some((s) => s.handle.toLowerCase() === `@${h}`)) {
        return;
      }

      const item: RealCreatorItem = {
        id: acc.id || h,
        name: acc.name,
        handle: acc.handle.startsWith('@') ? acc.handle : `@${acc.handle}`,
        avatar: acc.avatar,
        badge: acc.level >= 10 ? 'B2' : 'C1',
        badgeColor: acc.level >= 10 ? '#38bdf8' : '#f97316',
        viewers: Math.max(1, acc.followers || 0),
        cohosts: [],
        canInvite: true,
      };

      if (followedHandles.includes(h)) {
        friends.push(item);
      } else {
        suggested.push(item);
      }
    });

    // Fallback real creators if platform is in initial scratch state
    if (friends.length === 0 && suggested.length === 0) {
      suggested.push(
        {
          id: 'nicole',
          name: 'Nicole Miller',
          handle: '@nicole',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
          badge: 'C5',
          badgeColor: '#f97316',
          viewers: 14,
          cohosts: [],
          canInvite: true,
        },
        {
          id: 'alex',
          name: 'Alex Rivera',
          handle: '@alex',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
          badge: 'B1',
          badgeColor: '#38bdf8',
          viewers: 8,
          cohosts: [],
          canInvite: true,
        },
        {
          id: 'carlos',
          name: 'Carlos Perez',
          handle: '@carlos',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
          badge: 'A2',
          badgeColor: '#ec4899',
          viewers: 22,
          cohosts: [],
          canInvite: true,
        }
      );
    }

    return { realFriends: friends, realSuggested: suggested };
  }, [currentHostHandle]);

  if (!isOpen) return null;

  // Broadcast real-time Co-Host invitation over MQTT & Supabase Realtime
  const sendCoHostInvitation = (targetHandle: string, targetName: string, targetAvatar: string) => {
    const cleanTargetHandle = targetHandle.replace(/^@/, '').toLowerCase().trim();
    setInvitedHandles((prev) => ({ ...prev, [cleanTargetHandle]: true }));
    showToast(`💌 Co-host invitation sent to ${targetName}!`);

    // Broadcast across active stream room so recipient sees floating invite
    const roomId = currentHostHandle.replace(/^@/, '').toLowerCase().trim();
    liveStreamSync.sendRoomEvent(roomId, {
      type: 'COHOST_INVITE',
      senderHandle: currentHostHandle,
      senderName: currentHostName,
      senderAvatar: currentHostAvatar,
      targetHandle: cleanTargetHandle,
      targetName,
      timestamp: Date.now(),
    });

    const candidateStreamer: LiveMeStreamer = {
      id: cleanTargetHandle,
      name: targetName,
      handle: targetHandle.startsWith('@') ? targetHandle : `@${targetHandle}`,
      avatar: targetAvatar,
      title: 'Co-Host Live Battle',
      description: 'Live battle duel arena',
      viewersCount: Math.floor(Math.random() * 20) + 5,
      likesCount: 1200,
      category: 'Co-Host',
      videoStreamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      posterUrl: targetAvatar,
      isVerified: true,
      diamonds: 450,
      totalViews: '1.5K',
      popularity: 'Trending',
      tags: ['CoHost', 'Battle'],
      topContributors: [],
    };

    // When connection completes
    setTimeout(() => {
      onStartBattle(candidateStreamer);
      onClose();
      showToast(`⚔️ Connected with ${targetName} for Co-Host Battle!`);
    }, 2000);
  };

  const handleNudge = (targetHandle: string, targetName: string) => {
    const cleanTargetHandle = targetHandle.replace(/^@/, '').toLowerCase().trim();
    setNudgedHandles((prev) => ({ ...prev, [cleanTargetHandle]: true }));
    showToast(`🔔 Nudged ${targetName} to battle!`);
  };

  const handleQuickInvite = () => {
    setIsQuickScanning(true);
    showToast(`🔍 Quick matching active ${selectedTopic} creator...`);

    setTimeout(() => {
      setIsQuickScanning(false);
      const pool = realSuggested.length > 0 ? realSuggested : realFriends;
      const target = pool[Math.floor(Math.random() * pool.length)];
      if (target) {
        sendCoHostInvitation(target.handle, target.name, target.avatar);
      } else {
        showToast('No active creators available for quick battle right now.');
      }
    }, 1200);
  };

  const displayedFriends = showMoreFriends ? realFriends : realFriends.slice(0, 3);

  return (
    <div className="tiktok-sheet-backdrop" onClick={onClose}>
      <div className="tiktok-cohost-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Sheet Grabber */}
        <div className="tiktok-sheet-grabber" />

        {/* Sheet Header */}
        <div className="tiktok-cohost-header">
          <h2 className="tiktok-cohost-title">Co-host with creators</h2>
          <button
            type="button"
            className="tiktok-sheet-dots-btn"
            onClick={() => showToast('⚙️ Co-host privacy & match preferences')}
            aria-label="Co-host options"
          >
            •••
          </button>
        </div>

        {/* Scrollable Sheet Content */}
        <div className="tiktok-cohost-content">
          {/* Card 1: Quick invites */}
          <div className="tiktok-quick-invites-card">
            <div className="tiktok-quick-invites-info">
              <h3 className="tiktok-quick-invites-title">Quick invites</h3>
              <div
                className="tiktok-topic-pill"
                onClick={() => {
                  const topics: ('Music' | 'Chatting' | 'Gaming' | 'Dance')[] = ['Music', 'Chatting', 'Gaming', 'Dance'];
                  const next = topics[(topics.indexOf(selectedTopic) + 1) % topics.length];
                  setSelectedTopic(next);
                  showToast(`Topic set to: ${next}`);
                }}
                title="Tap to change topic"
              >
                <span>🎵</span>
                <span>{selectedTopic}</span>
                <span className="tiktok-topic-pencil">✏️</span>
              </div>
            </div>

            {/* Radar Pulse Rings Graphic */}
            <div className="tiktok-radar-container">
              <div className={`tiktok-radar-ring ring-1 ${isQuickScanning ? 'pulse' : ''}`} />
              <div className={`tiktok-radar-ring ring-2 ${isQuickScanning ? 'pulse' : ''}`} />
              <div className={`tiktok-radar-ring ring-3 ${isQuickScanning ? 'pulse' : ''}`} />
              <div className="tiktok-radar-avatar">
                <span className="tiktok-radar-qmark">?</span>
              </div>
            </div>

            {/* Full Width Pink Invite Button */}
            <button
              type="button"
              className="tiktok-btn-primary-pink"
              disabled={isQuickScanning}
              onClick={handleQuickInvite}
            >
              {isQuickScanning ? 'Matching...' : 'Invite'}
            </button>
          </div>

          {/* Section: Friends */}
          {realFriends.length > 0 && (
            <div className="tiktok-cohost-section">
              <h4 className="tiktok-section-heading">Friends ({realFriends.length})</h4>
              <div className="tiktok-creator-list">
                {displayedFriends.map((friend) => {
                  const cleanH = friend.handle.replace(/^@/, '').toLowerCase().trim();
                  return (
                    <div key={friend.id} className="tiktok-creator-row">
                      <div className="tiktok-creator-avatar-wrap">
                        <img src={friend.avatar} alt={friend.name} className="tiktok-creator-avatar" />
                      </div>

                      <div className="tiktok-creator-details">
                        <div className="tiktok-creator-name-row">
                          <span className="tiktok-creator-name" title={friend.name}>
                            {friend.name}
                          </span>
                        </div>

                        <div className="tiktok-creator-meta-row">
                          <span
                            className="tiktok-diamond-badge"
                            style={{ background: friend.badgeColor }}
                          >
                            💎 {friend.badge}
                          </span>
                          <span className="tiktok-viewers-badge">
                            👤 {friend.viewers}
                          </span>
                        </div>

                        <div className="tiktok-cohost-badge-row">
                          <span className="tiktok-cohost-text">Available to Battle</span>
                        </div>
                      </div>

                      <div className="tiktok-creator-action">
                        {friend.canInvite ? (
                          <button
                            type="button"
                            className={`tiktok-btn-invite ${invitedHandles[cleanH] ? 'invited' : ''}`}
                            onClick={() => sendCoHostInvitation(friend.handle, friend.name, friend.avatar)}
                            disabled={invitedHandles[cleanH]}
                          >
                            {invitedHandles[cleanH] ? 'Invited' : 'Invite'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`tiktok-btn-nudge ${nudgedHandles[cleanH] ? 'nudged' : ''}`}
                            onClick={() => handleNudge(friend.handle, friend.name)}
                            disabled={nudgedHandles[cleanH]}
                          >
                            {nudgedHandles[cleanH] ? 'Nudged' : 'Nudge'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* See more toggle */}
              {!showMoreFriends && realFriends.length > 3 && (
                <button
                  type="button"
                  className="tiktok-see-more-btn"
                  onClick={() => setShowMoreFriends(true)}
                >
                  See more ⌄
                </button>
              )}
            </div>
          )}

          {/* Section: Suggested creators */}
          <div className="tiktok-cohost-section">
            <h4 className="tiktok-section-heading">Suggested creators ({realSuggested.length})</h4>
            <div className="tiktok-creator-list">
              {realSuggested.map((creator) => {
                const cleanH = creator.handle.replace(/^@/, '').toLowerCase().trim();
                return (
                  <div key={creator.id} className="tiktok-creator-row">
                    <div className="tiktok-creator-avatar-wrap">
                      <img src={creator.avatar} alt={creator.name} className="tiktok-creator-avatar" />
                    </div>

                    <div className="tiktok-creator-details">
                      <div className="tiktok-creator-name-row">
                        <span className="tiktok-creator-name" title={creator.name}>
                          {creator.name}
                        </span>
                      </div>

                      <div className="tiktok-creator-meta-row">
                        <span
                          className="tiktok-diamond-badge"
                          style={{ background: creator.badgeColor }}
                        >
                          💎 {creator.badge}
                        </span>
                        <span className="tiktok-viewers-badge">
                          👤 {creator.viewers}
                        </span>
                      </div>

                      <div className="tiktok-cohost-badge-row">
                        <span className="tiktok-cohost-text">{creator.handle}</span>
                      </div>
                    </div>

                    <div className="tiktok-creator-action">
                      <button
                        type="button"
                        className={`tiktok-btn-invite ${invitedHandles[cleanH] ? 'invited' : ''}`}
                        onClick={() => sendCoHostInvitation(creator.handle, creator.name, creator.avatar)}
                        disabled={invitedHandles[cleanH]}
                      >
                        {invitedHandles[cleanH] ? 'Invited' : 'Invite'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
