import React, { useState } from 'react';
import { RoomViewer } from './LiveMeViewersModal';
import { liveStreamSync } from '../../services/liveStreamSyncService';

export interface LiveGoLiveGuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHostName: string;
  currentHostHandle: string;
  currentHostAvatar: string;
  activeAudience?: RoomViewer[];
  activeGuests?: RoomViewer[];
  cameraFacing: 'user' | 'environment';
  isVideoOff: boolean;
  onToggleVideo: () => void;
  onFlipCamera: () => void;
  onInviteGuest?: (viewer: RoomViewer) => void;
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
  cameraFacing,
  isVideoOff,
  onToggleVideo,
  onFlipCamera,
  onInviteGuest,
  onRemoveGuest,
  showToast,
}) => {
  const [autoAcceptAllowed, setAutoAcceptAllowed] = useState(false);
  const [isAutoAcceptDismissed, setIsAutoAcceptDismissed] = useState(false);
  const [invitedMap, setInvitedMap] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  // Real or mock viewers currently in room matching Screenshot 3
  const inRoomViewers: RoomViewer[] = activeAudience.length > 0 ? activeAudience : [
    {
      id: 'v-friend-vip',
      handle: 'friend_vip',
      name: '👄🔯 Friend',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      level: 31,
      contribution: 12500,
      isVip: true,
      badge: 'Friend',
    },
    {
      id: 'v-lbma99',
      handle: 'lbma99',
      name: 'lbma99 ✨',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      level: 18,
      contribution: 4200,
    },
  ];

  // Friends not watching matching Screenshot 3
  const offlineFriends = [
    {
      handle: 'wendy_vasquez',
      name: 'Wendy Vasquez Rodrig',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
      isOnline: true,
    },
    {
      handle: 'salazar_vip',
      name: '♌️🦐🦎salazar💋🎰...',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      isOnline: true,
    },
    {
      handle: 'david_vargas',
      name: 'David Vargas',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      isOnline: false,
    },
    {
      handle: 'elena_rostova',
      name: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      isOnline: true,
    },
  ];

  const handleInvite = (targetHandle: string, targetName: string, targetAvatar: string) => {
    setInvitedMap((prev) => ({ ...prev, [targetHandle]: true }));
    showToast(`📩 Guest invite sent to ${targetName}!`);

    const viewerObj: RoomViewer = {
      id: `guest-${targetHandle}-${Date.now()}`,
      handle: targetHandle,
      name: targetName,
      avatar: targetAvatar,
      level: 20,
      contribution: 1000,
      badge: 'Guest',
    };

    if (onInviteGuest) {
      onInviteGuest(viewerObj);
    }

    // Broadcast over MQTT
    const roomId = currentHostHandle.replace('@', '').toLowerCase().trim();
    liveStreamSync.sendRoomEvent(roomId, {
      type: 'GUEST_INVITE',
      senderHandle: currentHostHandle,
      senderName: currentHostName,
      senderAvatar: currentHostAvatar,
      targetHandle,
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

          {/* Section: Viewers */}
          <div className="tiktok-guests-section">
            <h4 className="tiktok-section-heading">Viewers</h4>
            <div className="tiktok-guest-list">
              {inRoomViewers.map((viewer) => {
                const isInvited = invitedMap[viewer.handle];
                const isAlreadyGuest = activeGuests.some((g) => g.handle === viewer.handle);

                return (
                  <div key={viewer.handle} className="tiktok-guest-row">
                    <div className="tiktok-guest-avatar-wrap">
                      <img src={viewer.avatar} alt={viewer.name} className="tiktok-guest-avatar" />
                    </div>

                    <div className="tiktok-guest-details">
                      <div className="tiktok-guest-name-row">
                        <span className="tiktok-guest-name">{viewer.name}</span>
                        {viewer.badge === 'Friend' || viewer.isVip ? (
                          <span className="tiktok-friend-tag">Friend</span>
                        ) : null}
                      </div>
                      <span className="tiktok-guest-sub">Top 5 viewer</span>
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
          </div>

          {/* Section: Friends not watching this LIVE */}
          <div className="tiktok-guests-section">
            <h4 className="tiktok-section-heading">Friends not watching this LIVE</h4>
            <div className="tiktok-guest-list">
              {offlineFriends.map((friend) => {
                const isInvited = invitedMap[friend.handle];

                return (
                  <div key={friend.handle} className="tiktok-guest-row">
                    <div className="tiktok-guest-avatar-wrap">
                      <img src={friend.avatar} alt={friend.name} className="tiktok-guest-avatar" />
                      {friend.isOnline && <span className="tiktok-online-dot" />}
                    </div>

                    <div className="tiktok-guest-details">
                      <span className="tiktok-guest-name">{friend.name}</span>
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
              {isVideoOff && <span className="slash" />}
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
