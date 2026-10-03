import React, { useState } from 'react';
import { LiveMeStreamer } from './types';
import { LIVEME_STREAMERS } from './liveMeData';
import { liveStreamSync } from '../../services/liveStreamSyncService';

export interface LiveCoHostCreatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHostName: string;
  currentHostHandle: string;
  currentHostAvatar: string;
  onStartBattle: (rival: LiveMeStreamer) => void;
  showToast: (msg: string) => void;
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

  if (!isOpen) return null;

  // Real or simulated Friends list matching Screenshot 1
  const friendsList = [
    {
      id: 'f-colocha',
      name: '😈la colocha😈👄🔥🥵💋🍑',
      handle: 'la_colocha_vip',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      badge: 'C5',
      badgeColor: '#f97316', // Orange / Bronze C5
      viewers: 14,
      cohosts: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&auto=format&fit=crop&q=80',
      ],
      canInvite: true,
    },
    {
      id: 'f-jennelyn',
      name: 'Jennelyn Marshall',
      handle: 'jennelyn_official',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
      badge: 'B1',
      badgeColor: '#38bdf8', // Blue B1
      viewers: 6,
      cohosts: [
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=80&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=80&auto=format&fit=crop&q=80',
      ],
      canInvite: false, // shows Nudge
    },
    {
      id: 'f-durango',
      name: '🇲🇽🦎Durango Magico🇲🇽🦎',
      handle: 'durango_magico',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      badge: 'C5',
      badgeColor: '#f97316',
      viewers: 15,
      cohosts: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&auto=format&fit=crop&q=80',
      ],
      canInvite: false, // shows Nudge
    },
    {
      id: 'f-alex',
      name: '🔥Alex King VIP👑',
      handle: 'alex_king_official',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      badge: 'A2',
      badgeColor: '#ec4899',
      viewers: 32,
      cohosts: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80',
      ],
      canInvite: true,
    },
    {
      id: 'f-sophia',
      name: '✨Sophia Glow✨',
      handle: 'sophia_glow',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      badge: 'S3',
      badgeColor: '#a855f7',
      viewers: 45,
      cohosts: [
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=80&auto=format&fit=crop&q=80',
      ],
      canInvite: true,
    },
  ];

  // Suggested creators matching Screenshot 1
  const suggestedCreators = [
    {
      id: 's-dulce',
      name: '🍬Dulceෆ🍬',
      handle: 'dulce_sweet',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      badge: 'D2',
      badgeColor: '#ec4899',
      viewers: 2,
      cohosts: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80',
      ],
    },
    {
      id: 's-carlos',
      name: '🎧Carlos Beats 🇨🇺',
      handle: 'carlos_beats_live',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      badge: 'B3',
      badgeColor: '#38bdf8',
      viewers: 19,
      cohosts: [],
    },
    {
      id: 's-valentina',
      name: '💃Valentina Glow',
      handle: 'valentina_danza',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      badge: 'C1',
      badgeColor: '#f97316',
      viewers: 27,
      cohosts: [],
    },
  ];

  // Broadcast real-time Co-Host invitation over MQTT & Supabase Realtime
  const sendCoHostInvitation = (targetHandle: string, targetName: string, targetAvatar: string) => {
    setInvitedHandles((prev) => ({ ...prev, [targetHandle]: true }));
    showToast(`💌 Co-host invitation sent to ${targetName}!`);

    // Broadcast across active stream room so recipient sees floating invite
    const roomId = currentHostHandle.replace('@', '').toLowerCase().trim();
    liveStreamSync.sendRoomEvent(roomId, {
      type: 'COHOST_INVITE',
      senderHandle: currentHostHandle,
      senderName: currentHostName,
      senderAvatar: currentHostAvatar,
      targetHandle,
      targetName,
      timestamp: Date.now(),
    });

    // Also trigger instant match capability
    const candidateStreamer: LiveMeStreamer = {
      id: `cohost-${targetHandle}`,
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

    // If target accepts (simulated or real response after 2.5s)
    setTimeout(() => {
      onStartBattle(candidateStreamer);
      onClose();
      showToast(`⚔️ Connected with ${targetName} for Co-Host Battle!`);
    }, 2500);
  };

  const handleNudge = (targetHandle: string, targetName: string) => {
    setNudgedHandles((prev) => ({ ...prev, [targetHandle]: true }));
    showToast(`🔔 Nudged ${targetName} to battle!`);
  };

  const handleQuickInvite = () => {
    setIsQuickScanning(true);
    showToast(`🔍 Quick matching random ${selectedTopic} creator...`);

    setTimeout(() => {
      setIsQuickScanning(false);
      const networkCreators = liveStreamSync.getStreamersList().filter((s) => !s.isHost);
      const pool = networkCreators.length > 0 ? networkCreators : LIVEME_STREAMERS;
      const randomCandidate = pool[Math.floor(Math.random() * pool.length)] || LIVEME_STREAMERS[1];

      sendCoHostInvitation(randomCandidate.handle, randomCandidate.name, randomCandidate.avatar);
    }, 1500);
  };

  const displayedFriends = showMoreFriends ? friendsList : friendsList.slice(0, 3);

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
          <div className="tiktok-cohost-section">
            <h4 className="tiktok-section-heading">Friends ({friendsList.length})</h4>
            <div className="tiktok-creator-list">
              {displayedFriends.map((friend) => (
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
                      <span className="tiktok-cohost-text">LIVE with guests</span>
                      {friend.cohosts.map((ch, idx) => (
                        <img
                          key={idx}
                          src={ch}
                          alt="co-host"
                          className="tiktok-mini-cohost-avatar"
                          style={{ marginLeft: idx > 0 ? -6 : 4 }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="tiktok-creator-action">
                    {friend.canInvite ? (
                      <button
                        type="button"
                        className={`tiktok-btn-invite ${invitedHandles[friend.handle] ? 'invited' : ''}`}
                        onClick={() => sendCoHostInvitation(friend.handle, friend.name, friend.avatar)}
                        disabled={invitedHandles[friend.handle]}
                      >
                        {invitedHandles[friend.handle] ? 'Invited' : 'Invite'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`tiktok-btn-nudge ${nudgedHandles[friend.handle] ? 'nudged' : ''}`}
                        onClick={() => handleNudge(friend.handle, friend.name)}
                        disabled={nudgedHandles[friend.handle]}
                      >
                        {nudgedHandles[friend.handle] ? 'Nudged' : 'Nudge'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* See more toggle */}
            {!showMoreFriends && friendsList.length > 3 && (
              <button
                type="button"
                className="tiktok-see-more-btn"
                onClick={() => setShowMoreFriends(true)}
              >
                See more ⌄
              </button>
            )}
          </div>

          {/* Section: Suggested creators */}
          <div className="tiktok-cohost-section">
            <h4 className="tiktok-section-heading">Suggested creators</h4>
            <div className="tiktok-creator-list">
              {suggestedCreators.map((creator) => (
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
                      <span className="tiktok-cohost-text">LIVE with guests</span>
                      {creator.cohosts.map((ch, idx) => (
                        <img
                          key={idx}
                          src={ch}
                          alt="co-host"
                          className="tiktok-mini-cohost-avatar"
                          style={{ marginLeft: idx > 0 ? -6 : 4 }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="tiktok-creator-action">
                    <button
                      type="button"
                      className={`tiktok-btn-invite ${invitedHandles[creator.handle] ? 'invited' : ''}`}
                      onClick={() => sendCoHostInvitation(creator.handle, creator.name, creator.avatar)}
                      disabled={invitedHandles[creator.handle]}
                    >
                      {invitedHandles[creator.handle] ? 'Invited' : 'Invite'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
