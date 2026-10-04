import React, { useState, useMemo, useEffect } from 'react';
import { LiveMeStreamer } from './types';
import { liveStreamSync } from '../../services/liveStreamSyncService';

export interface LiveCoHostCreatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHostName: string;
  currentHostHandle: string;
  currentHostAvatar: string;
  onStartBattle?: (rival: LiveMeStreamer) => void;
  onInviteSent?: (targetHandle: string) => void;
  showToast: (msg: string) => void;
}

interface RealLiveCreatorItem {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  badge: string;
  badgeColor: string;
  viewers: number;
  streamer: LiveMeStreamer;
}

export const LiveCoHostCreatorsModal: React.FC<LiveCoHostCreatorsModalProps> = ({
  isOpen,
  onClose,
  currentHostName,
  currentHostHandle,
  currentHostAvatar,
  onInviteSent,
  showToast,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<'Music' | 'Chatting' | 'Gaming' | 'Dance'>('Music');
  const [isQuickScanning, setIsQuickScanning] = useState(false);
  const [invitedHandles, setInvitedHandles] = useState<Record<string, boolean>>({});
  const [activeNetworkStreams, setActiveNetworkStreams] = useState<LiveMeStreamer[]>(() =>
    liveStreamSync.getStreamersList()
  );

  // Subscribe to real-time live network broadcasters when modal is open
  useEffect(() => {
    if (!isOpen) return;
    setActiveNetworkStreams(liveStreamSync.getStreamersList());
    liveStreamSync.queryNetworkStreams();

    const unsub = liveStreamSync.subscribeToActiveStreams((streams) => {
      setActiveNetworkStreams(streams);
    });

    return unsub;
  }, [isOpen]);

  // STRICTLY filter to ACTUAL people who are live right now.
  // ZERO preset people. ZERO offline accounts.
  const cleanCurrentHandle = (currentHostHandle || '').replace(/^@+/, '').toLowerCase().trim();

  const realLiveCreators: RealLiveCreatorItem[] = useMemo(() => {
    return activeNetworkStreams
      .filter((s) => {
        const h = (s.handle || s.id || '').replace(/^@+/, '').toLowerCase().trim();
        // Exclude self and host session
        if (!h || h === cleanCurrentHandle || s.isHost) {
          return false;
        }
        return true;
      })
      .map((streamer) => {
        const cleanH = streamer.handle.replace(/^@+/, '').toLowerCase().trim();
        const cleanName = streamer.name.replace(' (LIVE NOW 🔴)', '').trim();
        return {
          id: streamer.id || cleanH,
          name: cleanName,
          handle: `@${cleanH}`,
          avatar: streamer.avatar || streamer.posterUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
          badge: streamer.diamonds > 200 ? 'C5' : streamer.diamonds > 100 ? 'B1' : 'A1',
          badgeColor: streamer.diamonds > 200 ? '#f97316' : '#38bdf8',
          viewers: Math.max(1, streamer.viewersCount || 1),
          streamer,
        };
      });
  }, [activeNetworkStreams, cleanCurrentHandle]);

  if (!isOpen) return null;

  // Broadcast real-time Co-Host invitation over MQTT & Supabase Realtime
  // Does NOT auto-connect or auto-start: recipient must Accept or Decline!
  const sendCoHostInvitation = (creator: RealLiveCreatorItem) => {
    const cleanTarget = creator.handle.replace(/^@+/, '').toLowerCase().trim();
    const cleanMyHandle = currentHostHandle.replace(/^@+/, '').toLowerCase().trim();

    setInvitedHandles((prev) => ({ ...prev, [cleanTarget]: true }));
    showToast(`💌 Co-host invitation sent to ${creator.name}! Waiting for them to accept...`);

    const inviteEvent = {
      type: 'COHOST_INVITE',
      senderHandle: `@${cleanMyHandle}`,
      senderName: currentHostName,
      senderAvatar: currentHostAvatar,
      targetHandle: cleanTarget,
      targetName: creator.name,
      timestamp: Date.now(),
      senderStreamer: {
        id: `stream-${cleanMyHandle}`,
        name: currentHostName,
        handle: `@${cleanMyHandle}`,
        avatar: currentHostAvatar,
        videoStreamUrl: '',
        posterUrl: currentHostAvatar,
        isVerified: true,
        category: 'Co-Host',
        viewersCount: 1,
        likesCount: 0,
      },
    };

    // Broadcast across target room and current room
    liveStreamSync.sendRoomEvent(cleanTarget, inviteEvent);
    liveStreamSync.sendRoomEvent(cleanMyHandle, inviteEvent);

    onInviteSent?.(cleanTarget);
  };

  const handleQuickInvite = () => {
    if (realLiveCreators.length === 0) {
      showToast('📡 No other creators are currently live right now.');
      return;
    }

    setIsQuickScanning(true);
    showToast(`🔍 Quick matching active live creators in ${selectedTopic}...`);

    setTimeout(() => {
      setIsQuickScanning(false);
      const target = realLiveCreators[Math.floor(Math.random() * realLiveCreators.length)];
      if (target) {
        sendCoHostInvitation(target);
      }
    }, 900);
  };

  return (
    <div className="tiktok-sheet-backdrop" onClick={onClose}>
      <div className="tiktok-cohost-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Sheet Grabber */}
        <div className="tiktok-sheet-grabber" />

        {/* Sheet Header */}
        <div className="tiktok-cohost-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="tiktok-cohost-title">Co-host with LIVE creators</h2>
            <span
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
              REAL-TIME ({realLiveCreators.length})
            </span>
          </div>
          <button
            type="button"
            className="tiktok-sheet-dots-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
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
                <span className="tiktok-radar-qmark">📡</span>
              </div>
            </div>

            {/* Full Width Pink Invite Button */}
            <button
              type="button"
              className="tiktok-btn-primary-pink"
              disabled={isQuickScanning || realLiveCreators.length === 0}
              onClick={handleQuickInvite}
            >
              {isQuickScanning
                ? 'Matching...'
                : realLiveCreators.length === 0
                ? 'No other creators live'
                : 'Quick Match & Invite'}
            </button>
          </div>

          {/* Section: Real Live Creators */}
          <div className="tiktok-cohost-section">
            <h4 className="tiktok-section-heading">
              Active Live Broadcasters ({realLiveCreators.length})
            </h4>

            {realLiveCreators.length === 0 ? (
              <div
                style={{
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 16,
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  margin: '10px 0',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
                <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  No other creators are live right now
                </div>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12, lineHeight: 1.5, maxWidth: 300, margin: '0 auto' }}>
                  Only actual people broadcasting live appear here in real time. When another host goes LIVE on Privity, you can invite them directly to co-host!
                </div>
              </div>
            ) : (
              <div className="tiktok-creator-list">
                {realLiveCreators.map((creator) => {
                  const cleanH = creator.handle.replace(/^@+/, '').toLowerCase().trim();
                  const isInvited = invitedHandles[cleanH];

                  return (
                    <div key={creator.id} className="tiktok-creator-row">
                      <div className="tiktok-creator-avatar-wrap">
                        <img src={creator.avatar} alt={creator.name} className="tiktok-creator-avatar" />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: '#22c55e',
                            border: '2px solid #000',
                          }}
                        />
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
                            👤 {creator.viewers} live
                          </span>
                        </div>

                        <div className="tiktok-cohost-badge-row">
                          <span className="tiktok-cohost-text">@{cleanH} · Ready to Connect</span>
                        </div>
                      </div>

                      <div className="tiktok-creator-action">
                        <button
                          type="button"
                          className={`tiktok-btn-invite ${isInvited ? 'invited' : ''}`}
                          onClick={() => sendCoHostInvitation(creator)}
                          disabled={isInvited}
                        >
                          {isInvited ? 'Invited ⏳' : 'Invite'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
