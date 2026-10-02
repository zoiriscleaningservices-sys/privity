import React, { useState } from 'react';
import './liveUserProfileModal.css';
import { UserLiveProfile, formatCompactNumber } from './userProfileUtils';
import { IconX } from '../Icons';

export interface LiveUserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserLiveProfile | null;
  roomContribution?: number;
  isHost?: boolean;
  isMuted?: boolean;
  isBlocked?: boolean;
  onToggleFollow?: (handle: string) => void;
  isFollowing?: boolean;
  onMuteUser?: (user: UserLiveProfile) => void;
  onKickUser?: (user: UserLiveProfile) => void;
  onBlockUser?: (user: UserLiveProfile) => void;
  onOpenModerationManagement?: () => void;
  onSendChatMessage?: (text: string) => void;
  showToast: (msg: string) => void;
  currentUserHandle?: string;
  onNavigateToProfile?: (handle: string) => void;
}

export const LiveUserProfileModal: React.FC<LiveUserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  roomContribution = 0,
  isHost = false,
  isMuted = false,
  isBlocked = false,
  onToggleFollow,
  isFollowing = false,
  onMuteUser,
  onKickUser,
  onBlockUser,
  onOpenModerationManagement,
  onSendChatMessage,
  showToast,
  currentUserHandle,
  onNavigateToProfile,
}) => {
  const [followingState, setFollowingState] = useState(isFollowing);

  React.useEffect(() => {
    setFollowingState(isFollowing);
  }, [isFollowing]);

  if (!isOpen || !user) return null;

  const myHandle = (currentUserHandle || '').toLowerCase().replace(/^@/, '');
  const targetHandle = user.handle.toLowerCase().replace(/^@/, '');
  const isSelf = myHandle ? targetHandle === myHandle : false;

  const handleFollowClick = () => {
    const next = !followingState;
    setFollowingState(next);
    if (onToggleFollow) onToggleFollow(user.handle);
    showToast(next ? `Followed @${user.handle}! ✨` : `Unfollowed @${user.handle}`);
  };

  const handleSayHi = () => {
    if (onSendChatMessage) {
      onSendChatMessage(`Hi @${user.handle}! Welcome to the LIVE stream 👋`);
      showToast(`Greeted @${user.handle} in chat!`);
    }
    onClose();
  };

  return (
    <div className="live-profile-modal-backdrop" onClick={onClose}>
      <div
        className="live-profile-modal-card animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Profile of ${user.name}`}
      >
        {/* Banner Area */}
        <div className="live-profile-banner">
          <img
            src={user.banner}
            alt="Profile Banner"
            className="live-profile-banner-img"
          />
          <div className="live-profile-banner-gradient" />
          <button
            type="button"
            className="live-profile-close-btn"
            onClick={onClose}
            aria-label="Close Profile"
          >
            <IconX size={16} color="#ffffff" />
          </button>
        </div>

        {/* Overlapping Avatar Row with Level Badge and Action Buttons (Directly on top of banner) */}
        <div className="live-profile-avatar-row">
          <div className="live-profile-avatar-wrap">
            <img
              src={user.avatar}
              alt={user.name}
              className="live-profile-avatar-img square"
            />
            <span className="live-profile-level-badge">
              Lv.{user.level}
            </span>
          </div>

          <div className="live-profile-head-actions">
            {!isSelf ? (
              <>
                <button
                  type="button"
                  className={`live-profile-follow-btn ${followingState ? 'is-following' : ''}`}
                  onClick={handleFollowClick}
                >
                  {followingState ? '✓ Following' : '+ Follow'}
                </button>
                <button
                  type="button"
                  className="live-profile-greet-btn"
                  onClick={handleSayHi}
                  title="Say Hi in Chat"
                >
                  👋 Say Hi
                </button>
              </>
            ) : (
              <span className="live-profile-self-tag">
                👑 Your Profile
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content Details Sheet */}
        <div className="live-profile-body">
          {/* User Name & Handle */}
          <div className="live-profile-meta">
            <div className="live-profile-title-line">
              <h3 className="live-profile-display-name">{user.name}</h3>
              {user.isVerified && (
                <span className="live-profile-verified-badge" title="Verified Creator">✓</span>
              )}
              <span className="live-profile-rank-chip">{user.levelTitle}</span>
            </div>
            <p className="live-profile-handle">@{user.handle}</p>
          </div>

          {/* Bio */}
          {user.bio && (
            <p className="live-profile-bio">{user.bio}</p>
          )}

          {/* Accurate Real Numbers Counter Grid */}
          <div className="live-profile-stats-grid">
            <div className="live-profile-stat-box">
              <span className="live-profile-stat-val">
                {formatCompactNumber(user.following)}
              </span>
              <span className="live-profile-stat-lbl">Following</span>
            </div>
            <div className="live-profile-stat-box">
              <span className="live-profile-stat-val">
                {formatCompactNumber(user.followers)}
              </span>
              <span className="live-profile-stat-lbl">Followers</span>
            </div>
            <div className="live-profile-stat-box">
              <span className="live-profile-stat-val">
                {formatCompactNumber(user.likes)}
              </span>
              <span className="live-profile-stat-lbl">Likes</span>
            </div>
          </div>

          {/* View Full Profile Action Button */}
          <div className="live-profile-navigation-row">
            <button
              type="button"
              className="live-profile-full-profile-btn"
              onClick={() => {
                if (onNavigateToProfile) {
                  onNavigateToProfile(user.handle);
                } else {
                  onClose();
                }
              }}
              title={`View @${user.handle}'s full profile`}
            >
              <span>View Full Profile</span>
              <span className="live-profile-external-arrow">↗</span>
            </button>
          </div>

          {/* Live Stream Contribution Badge */}
          {roomContribution > 0 && (
            <div className="live-profile-contribution-banner">
              <span className="live-profile-contrib-icon">💎</span>
              <div className="live-profile-contrib-text">
                <strong>{roomContribution.toLocaleString()} Diamonds</strong> gifted in this live broadcast
              </div>
            </div>
          )}

          {/* Host Moderation Controls (Only shown for Host viewing another user) */}
          {isHost && (
            <div className="live-profile-host-mod-section">
              <div className="live-profile-mod-header">
                <span className="live-profile-mod-title">🛡️ Host Moderation Controls</span>
                {onOpenModerationManagement && (
                  <button
                    type="button"
                    className="live-profile-manage-link"
                    onClick={() => {
                      onClose();
                      onOpenModerationManagement();
                    }}
                  >
                    View Management List ›
                  </button>
                )}
              </div>

              <div className="live-profile-mod-buttons-grid">
                <button
                  type="button"
                  className={`live-profile-mod-btn ${isMuted ? 'active-muted' : ''}`}
                  onClick={() => {
                    if (onMuteUser) onMuteUser(user);
                  }}
                >
                  <span className="mod-btn-icon">{isMuted ? '🔊' : '🔇'}</span>
                  <span>{isMuted ? 'Unmute User' : 'Mute / Silence'}</span>
                </button>

                <button
                  type="button"
                  className="live-profile-mod-btn kick"
                  onClick={() => {
                    if (onKickUser) onKickUser(user);
                  }}
                >
                  <span className="mod-btn-icon">👢</span>
                  <span>Kick from LIVE</span>
                </button>

                <button
                  type="button"
                  className={`live-profile-mod-btn block ${isBlocked ? 'active-blocked' : ''}`}
                  onClick={() => {
                    if (onBlockUser) onBlockUser(user);
                  }}
                >
                  <span className="mod-btn-icon">🚫</span>
                  <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
