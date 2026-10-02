import React, { useState } from 'react';
import './liveModerationModal.css';
import { IconX } from '../Icons';
import { UserLiveProfile } from './userProfileUtils';

export interface ModeratedUserRecord {
  user: UserLiveProfile;
  type: 'muted' | 'kicked' | 'blocked';
  timestamp: number;
}

export interface LiveModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  mutedUsers: UserLiveProfile[];
  kickedUsers: UserLiveProfile[];
  blockedUsers: UserLiveProfile[];
  onUnmuteUser: (handle: string) => void;
  onUnkickUser: (handle: string) => void;
  onUnblockUser: (handle: string) => void;
  showToast: (msg: string) => void;
}

export const LiveModerationModal: React.FC<LiveModerationModalProps> = ({
  isOpen,
  onClose,
  mutedUsers,
  kickedUsers,
  blockedUsers,
  onUnmuteUser,
  onUnkickUser,
  onUnblockUser,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'muted' | 'kicked' | 'blocked'>('muted');

  if (!isOpen) return null;

  const currentList =
    activeTab === 'muted'
      ? mutedUsers
      : activeTab === 'kicked'
      ? kickedUsers
      : blockedUsers;

  return (
    <div className="live-mod-modal-backdrop" onClick={onClose}>
      <div
        className="live-mod-modal-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Moderation Management"
      >
        <div className="live-mod-drag-handle" />

        {/* Header */}
        <div className="live-mod-header">
          <div className="live-mod-title-group">
            <span className="live-mod-icon">🛡️</span>
            <div>
              <h3 className="live-mod-title">Live Moderation Management</h3>
              <p className="live-mod-subtitle">
                Manage muted, kicked, and blocked viewers for this broadcast
              </p>
            </div>
          </div>
          <button
            type="button"
            className="live-mod-close-btn"
            onClick={onClose}
            aria-label="Close Moderation Modal"
          >
            <IconX size={16} color="#ffffff" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="live-mod-tabs-bar">
          <button
            type="button"
            className={`live-mod-tab-btn ${activeTab === 'muted' ? 'active' : ''}`}
            onClick={() => setActiveTab('muted')}
          >
            🔇 Muted ({mutedUsers.length})
          </button>
          <button
            type="button"
            className={`live-mod-tab-btn ${activeTab === 'kicked' ? 'active' : ''}`}
            onClick={() => setActiveTab('kicked')}
          >
            👢 Kicked ({kickedUsers.length})
          </button>
          <button
            type="button"
            className={`live-mod-tab-btn ${activeTab === 'blocked' ? 'active' : ''}`}
            onClick={() => setActiveTab('blocked')}
          >
            🚫 Blocked ({blockedUsers.length})
          </button>
        </div>

        {/* User List */}
        <div className="live-mod-list">
          {currentList.length === 0 ? (
            <div className="live-mod-empty">
              <span className="live-mod-empty-icon">
                {activeTab === 'muted' ? '🎙️' : activeTab === 'kicked' ? '🚪' : '✨'}
              </span>
              <p className="live-mod-empty-text">
                No users are currently {activeTab} in this live stream.
              </p>
            </div>
          ) : (
            currentList.map((user) => (
              <div key={user.handle} className="live-mod-row">
                <div className="live-mod-avatar-wrap">
                  <img src={user.avatar} alt={user.name} className="live-mod-avatar-img" />
                  <span className="live-mod-level-chip">Lv.{user.level}</span>
                </div>

                <div className="live-mod-info-col">
                  <div className="live-mod-name-row">
                    <span className="live-mod-name">{user.name}</span>
                    <span className="live-mod-status-tag">
                      {activeTab === 'muted' ? 'Chat Silenced' : activeTab === 'kicked' ? 'Removed' : 'Blacklisted'}
                    </span>
                  </div>
                  <span className="live-mod-handle">@{user.handle}</span>
                </div>

                <div className="live-mod-action-col">
                  {activeTab === 'muted' && (
                    <button
                      type="button"
                      className="live-mod-restore-btn unmute"
                      onClick={() => {
                        onUnmuteUser(user.handle);
                        showToast(`🔊 Unmuted @${user.handle}. They can now chat.`);
                      }}
                    >
                      🔊 Unmute
                    </button>
                  )}

                  {activeTab === 'kicked' && (
                    <button
                      type="button"
                      className="live-mod-restore-btn unkick"
                      onClick={() => {
                        onUnkickUser(user.handle);
                        showToast(`↩️ Re-admitted @${user.handle}. They can rejoin.`);
                      }}
                    >
                      ↩️ Allow Re-entry
                    </button>
                  )}

                  {activeTab === 'blocked' && (
                    <button
                      type="button"
                      className="live-mod-restore-btn unblock"
                      onClick={() => {
                        onUnblockUser(user.handle);
                        showToast(`🔓 Unblocked @${user.handle}.`);
                      }}
                    >
                      🔓 Unblock
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
