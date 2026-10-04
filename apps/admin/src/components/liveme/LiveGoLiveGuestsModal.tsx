import React, { useState, useMemo } from 'react';
import { RoomViewer } from './LiveMeViewersModal';
import { liveStreamSync } from '../../services/liveStreamSyncService';
import { authService, UserAccount } from '../../services/authService';

export interface LiveGoLiveGuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHostName: string;
  currentHostHandle: string;
  currentHostAvatar: string;
  activeAudience?: RoomViewer[];
  activeGuests?: RoomViewer[];
  pendingRequests?: RoomViewer[];
  cameraFacing: 'user' | 'environment';
  isVideoOff: boolean;
  onToggleVideo: () => void;
  onFlipCamera: () => void;
  onInviteGuest?: (viewer: RoomViewer) => void;
  onAcceptRequest?: (viewer: RoomViewer) => void;
  onRejectRequest?: (handle: string) => void;
  onRemoveGuest?: (handle: string) => void;
  showToast: (msg: string) => void;
}

export const LiveGoLiveGuestsModal: React.FC<LiveGoLiveGuestsModalProps> = ({
  isOpen,
  onClose,
  currentHostName,
  currentHostHandle,
  currentHostAvatar,
  activeAudience = [],
  activeGuests = [],
  pendingRequests = [],
  cameraFacing,
  isVideoOff,
  onToggleVideo,
  onFlipCamera,
  onInviteGuest,
  onAcceptRequest,
  onRejectRequest,
  onRemoveGuest,
  showToast,
}) => {
  const [autoAcceptAllowed, setAutoAcceptAllowed] = useState(false);
  const [isAutoAcceptDismissed, setIsAutoAcceptDismissed] = useState(false);
  const [invitedMap, setInvitedMap] = useState<Record<string, boolean>>({});

  // Real friends and registered accounts from storage and auth service
  const realFriendsList = useMemo(() => {
    const cleanCurrentHandle = currentHostHandle.replace(/^@/, '').toLowerCase().trim();
    const allAccounts: Record<string, UserAccount> = authService.getAllAccounts();

    // Check followed handles from local storage
    let followedHandles: string[] = [];
    try {
      const stored = localStorage.getItem('privity_following_v5');
      if (stored) {
        followedHandles = Object.keys(JSON.parse(stored)).map((h) => h.replace(/^@/, '').toLowerCase());
      }
    } catch {}

    const friends: Array<{ handle: string; name: string; avatar: string; isOnline: boolean }> = [];

    // Filter out current host
    Object.values(allAccounts).forEach((acc) => {
      const h = acc.handle.replace(/^@/, '').toLowerCase().trim();
      if (h === cleanCurrentHandle) return;
      friends.push({
        handle: h,
        name: acc.name,
        avatar: acc.avatar,
        isOnline: true,
      });
    });

    // Fallback real default users if clean scratch environment
    if (friends.length === 0) {
      friends.push(
        {
          handle: 'nicole',
          name: 'Nicole Miller',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isOnline: true,
        },
        {
          handle: 'alex',
          name: 'Alex Rivera',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          isOnline: true,
        },
        {
          handle: 'carlos',
          name: 'Carlos Perez',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
          isOnline: false,
        }
      );
    }

    // Sort friends so followed ones appear at the top
    friends.sort((a, b) => {
      const aFollow = followedHandles.includes(a.handle) ? 1 : 0;
      const bFollow = followedHandles.includes(b.handle) ? 1 : 0;
      return bFollow - aFollow;
    });

    return friends;
  }, [currentHostHandle]);

  if (!isOpen) return null;

  const handleInvite = (targetHandle: string, targetName: string, targetAvatar: string) => {
    const cleanTargetHandle = targetHandle.replace(/^@/, '').toLowerCase().trim();
    setInvitedMap((prev) => ({ ...prev, [cleanTargetHandle]: true }));
    showToast(`📩 Guest invite sent to ${targetName}!`);

    const viewerObj: RoomViewer = {
      id: cleanTargetHandle,
      handle: cleanTargetHandle,
      name: targetName,
      avatar: targetAvatar,
      level: 20,
      contribution: 1000,
      badge: 'Guest',
    };

    if (onInviteGuest) {
      onInviteGuest(viewerObj);
    }

    // Broadcast over MQTT and Supabase
    const roomId = currentHostHandle.replace(/^@/, '').toLowerCase().trim();
    liveStreamSync.sendRoomEvent(roomId, {
      type: 'GUEST_INVITE',
      senderHandle: currentHostHandle,
      senderName: currentHostName,
      senderAvatar: currentHostAvatar,
      targetHandle: cleanTargetHandle,
      targetName,
      timestamp: Date.now(),
    });
  };

  return (
    <div className="tiktok-sheet-backdrop" onClick={onClose}>
      <div className="tiktok-guests-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Grabber */}
        <div className="tiktok-sheet-grabber" />

        {/* Header */}
        <div className="tiktok-guests-header">
          <h2 className="tiktok-guests-title">Go LIVE with guests</h2>
          <div className="tiktok-guests-top-actions">
            <button
              type="button"
              className="tiktok-top-icon-btn"
              onClick={() => showToast('🧊 3D Avatar & Virtual Stage')}
              title="3D Avatar"
            >
              <span className="icon">🧊</span>
              <span className="dot" />
            </button>
            <button
              type="button"
              className="tiktok-top-icon-btn"
              onClick={() => showToast('🖌️ Guest Layout: Grid, Split or Panel')}
              title="Layout"
            >
              🖌️
            </button>
            <button
              type="button"
              className="tiktok-top-icon-btn"
              onClick={() => showToast('⚙️ Guest Permissions: Audio/Video seats')}
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="tiktok-guests-content">
          {/* Banner: Auto-accept requests */}
          {!isAutoAcceptDismissed && (
            <div className="tiktok-auto-accept-banner">
              <div className="tiktok-auto-accept-text">
                <span className="title">Auto-accept requests</span>
                <span className="sub">This setting applies to all LIVE streams.</span>
              </div>
              <div className="tiktok-auto-accept-actions">
                <button
                  type="button"
                  className={`tiktok-btn-allow ${autoAcceptAllowed ? 'allowed' : ''}`}
                  onClick={() => {
                    const next = !autoAcceptAllowed;
                    setAutoAcceptAllowed(next);
                    showToast(next ? '✅ Auto-accept guest requests enabled' : 'Auto-accept disabled');
                  }}
                >
                  {autoAcceptAllowed ? 'Allowed' : 'Allow'}
                </button>
                <button
                  type="button"
                  className="tiktok-btn-banner-close"
                  onClick={() => setIsAutoAcceptDismissed(true)}
                  aria-label="Dismiss banner"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Section: Stage Requests (Pending Approval) */}
          {pendingRequests.length > 0 && (
            <div className="tiktok-guests-section" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h4 className="tiktok-section-heading" style={{ color: '#06b6d4', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✋</span>
                  <span>Stage Requests ({pendingRequests.length})</span>
                </h4>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Wants to talk</span>
              </div>
              <div className="tiktok-guest-list">
                {pendingRequests.map((req) => (
                  <div key={req.handle} className="tiktok-guest-row" style={{ background: 'rgba(6, 182, 212, 0.08)', borderRadius: '10px', padding: '8px 10px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                    <div className="tiktok-guest-avatar-wrap">
                      <img src={req.avatar} alt={req.name} className="tiktok-guest-avatar" />
                    </div>
                    <div className="tiktok-guest-details">
                      <div className="tiktok-guest-name-row">
                        <span className="tiktok-guest-name">{req.name}</span>
                        <span className="tiktok-friend-tag" style={{ background: '#06b6d4', color: '#000', fontWeight: 700 }}>Requesting</span>
                      </div>
                      <span className="tiktok-guest-sub">@{req.handle.replace(/^@/, '')} · Level {req.level || 1}</span>
                    </div>
                    <div className="tiktok-guest-action" style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="tiktok-btn-invite"
                        style={{ background: '#06b6d4', color: '#000', fontWeight: 700 }}
                        onClick={() => onAcceptRequest && onAcceptRequest(req)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="tiktok-btn-remove-guest"
                        onClick={() => onRejectRequest && onRejectRequest(req.handle)}
                        title="Decline request"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Viewers */}
          <div className="tiktok-guests-section">
            <h4 className="tiktok-section-heading">Viewers in Room ({activeAudience.length})</h4>
            {activeAudience.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                <span>No viewers in this room yet. When people join your live, you can invite them up to talk!</span>
              </div>
            ) : (
              <div className="tiktok-guest-list">
                {activeAudience.map((viewer) => {
                  const cleanH = viewer.handle.replace(/^@/, '').toLowerCase().trim();
                  const isInvited = invitedMap[cleanH];
                  const isAlreadyGuest = activeGuests.some((g) => g.handle.replace(/^@/, '').toLowerCase() === cleanH);

                  return (
                    <div key={viewer.handle} className="tiktok-guest-row">
                      <div className="tiktok-guest-avatar-wrap">
                        <img src={viewer.avatar} alt={viewer.name} className="tiktok-guest-avatar" />
                      </div>

                      <div className="tiktok-guest-details">
                        <div className="tiktok-guest-name-row">
                          <span className="tiktok-guest-name">{viewer.name}</span>
                          {viewer.isVip && <span className="tiktok-friend-tag">VIP</span>}
                        </div>
                        <span className="tiktok-guest-sub">@{cleanH} · Level {viewer.level}</span>
                      </div>

                      <div className="tiktok-guest-action">
                        {isAlreadyGuest ? (
                          <button
                            type="button"
                            className="tiktok-btn-remove-guest"
                            onClick={() => onRemoveGuest && onRemoveGuest(viewer.handle)}
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`tiktok-btn-invite ${isInvited ? 'invited' : ''}`}
                            onClick={() => handleInvite(viewer.handle, viewer.name, viewer.avatar)}
                            disabled={isInvited}
                          >
                            {isInvited ? 'Invited' : 'Invite'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Friends not watching this LIVE */}
          <div className="tiktok-guests-section">
            <h4 className="tiktok-section-heading">Friends not watching this LIVE ({realFriendsList.length})</h4>
            <div className="tiktok-guest-list">
              {realFriendsList.map((friend) => {
                const cleanH = friend.handle.replace(/^@/, '').toLowerCase().trim();
                const isInvited = invitedMap[cleanH];

                return (
                  <div key={friend.handle} className="tiktok-guest-row">
                    <div className="tiktok-guest-avatar-wrap">
                      <img src={friend.avatar} alt={friend.name} className="tiktok-guest-avatar" />
                      {friend.isOnline && <span className="tiktok-online-dot" />}
                    </div>

                    <div className="tiktok-guest-details">
                      <span className="tiktok-guest-name">{friend.name}</span>
                      <span className="tiktok-guest-sub">@{cleanH}</span>
                    </div>

                    <div className="tiktok-guest-action">
                      <button
                        type="button"
                        className={`tiktok-btn-invite ${isInvited ? 'invited' : ''}`}
                        onClick={() => handleInvite(friend.handle, friend.name, friend.avatar)}
                        disabled={isInvited}
                      >
                        {isInvited ? 'Invited' : 'Invite'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pinned Bottom Host Mini-Bar Matching Screenshot 3 */}
        <div className="tiktok-host-minibar">
          <div className="tiktok-host-minibar-profile">
            <div className="tiktok-host-minibar-avatar-wrap">
              <img src={currentHostAvatar} alt={currentHostName} className="tiktok-host-minibar-avatar" />
            </div>
            <div className="tiktok-host-minibar-info">
              <span className="tiktok-host-minibar-name">{currentHostName}</span>
              <span className="tiktok-host-minibar-badge">Host</span>
            </div>
          </div>

          <div className="tiktok-host-minibar-actions">
            {/* Toggle Camera On/Off */}
            <button
              type="button"
              className={`tiktok-minibar-btn ${isVideoOff ? 'off' : ''}`}
              onClick={onToggleVideo}
              title={isVideoOff ? 'Turn Camera ON' : 'Turn Camera OFF'}
            >
              📹
            </button>

            {/* Flip Camera */}
            <button
              type="button"
              className="tiktok-minibar-btn"
              onClick={onFlipCamera}
              title={`Switch camera (Currently ${cameraFacing === 'user' ? 'Front' : 'Back'})`}
            >
              🔄
            </button>

            {/* More Options */}
            <button
              type="button"
              className="tiktok-minibar-btn"
              onClick={() => showToast('🎛️ Guest seat management & permissions')}
              title="More options"
            >
              •••
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
