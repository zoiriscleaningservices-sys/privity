import React, { useState } from 'react';
import './liveMeViewersModal.css';
import { IconSearch, IconX } from '../Icons';

export interface RoomViewer {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  level: number;
  badge?: string;
  isVip?: boolean;
  contribution?: number;
  isFollowing?: boolean;
}

export interface LiveMeViewersModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamerName: string;
  viewersCount: number;
  viewers: RoomViewer[];
  isHost?: boolean;
  onViewProfile?: (handle: string) => void;
  onFollowToggle?: (handle: string) => void;
  showToast: (msg: string) => void;
}

export const LiveMeViewersModal: React.FC<LiveMeViewersModalProps> = ({
  isOpen,
  onClose,
  streamerName,
  viewersCount,
  viewers,
  isHost = false,
  onViewProfile,
  onFollowToggle,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'vip'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const filteredViewers = viewers.filter((v) => {
    if (activeTab === 'vip' && !v.isVip && (!v.contribution || v.contribution <= 0)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return v.name.toLowerCase().includes(q) || v.handle.toLowerCase().includes(q);
    }
    return true;
  });

  const handleToggle = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowingMap((prev) => ({ ...prev, [handle]: !prev[handle] }));
    if (onFollowToggle) onFollowToggle(handle);
    showToast(`Updated follow status for @${handle}`);
  };

  return (
    <div className="liveme-viewers-backdrop" onClick={onClose}>
      <div
        className="liveme-viewers-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Room Audience & Viewers"
      >
        {/* Drag Handle Bar */}
        <div className="liveme-viewers-drag-bar" />

        {/* Header */}
        <div className="liveme-viewers-header">
          <div className="liveme-viewers-title-group">
            <h3 className="liveme-viewers-heading">
              Room Viewers
              <span className="liveme-viewers-counter-badge">
                {viewersCount.toLocaleString()} online
              </span>
            </h3>
            <p className="liveme-viewers-sub">
              Watching <strong>{streamerName}</strong> live in real time
            </p>
          </div>
          <button
            type="button"
            className="liveme-viewers-close-btn"
            onClick={onClose}
            aria-label="Close viewers modal"
          >
            <IconX size={18} color="#ffffff" />
          </button>
        </div>

        {/* Tab Filters */}
        <div className="liveme-viewers-tabs">
          <button
            type="button"
            className={`liveme-viewers-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Viewers ({viewers.length})
          </button>
          <button
            type="button"
            className={`liveme-viewers-tab-btn ${activeTab === 'vip' ? 'active' : ''}`}
            onClick={() => setActiveTab('vip')}
          >
            ⭐ VIP & Top Gifters
          </button>
        </div>

        {/* Search Field */}
        <div className="liveme-viewers-search-box">
          <IconSearch size={15} color="rgba(255, 255, 255, 0.45)" />
          <input
            type="text"
            className="liveme-viewers-search-input"
            placeholder="Search viewers in this room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="liveme-viewers-clear-search"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        {/* Viewers List */}
        <div className="liveme-viewers-list">
          {filteredViewers.length === 0 ? (
            <div className="liveme-viewers-empty">
              <span>👥</span>
              <p>No viewers found matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredViewers.map((viewer, idx) => {
              const isFollowing = followingMap[viewer.handle] ?? viewer.isFollowing ?? false;
              return (
                <div
                  key={viewer.id}
                  className="liveme-viewer-row"
                  onClick={() => {
                    if (onViewProfile) onViewProfile(viewer.handle);
                    else showToast(`Selected @${viewer.handle}`);
                  }}
                >
                  {/* Rank Index for VIPs */}
                  {activeTab === 'vip' && (
                    <div className="liveme-viewer-rank">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </div>
                  )}

                  {/* Avatar with Level Ring */}
                  <div className="liveme-viewer-avatar-wrap">
                    <img
                      src={viewer.avatar}
                      alt={viewer.name}
                      className="liveme-viewer-avatar-img"
                    />
                    <span className="liveme-viewer-level-chip">
                      Lv.{viewer.level}
                    </span>
                  </div>

                  {/* Viewer Metadata */}
                  <div className="liveme-viewer-info">
                    <div className="liveme-viewer-name-row">
                      <span className="liveme-viewer-name">{viewer.name}</span>
                      {viewer.badge && (
                        <span className="liveme-viewer-badge-tag">{viewer.badge}</span>
                      )}
                      {viewer.isVip && (
                        <span className="liveme-viewer-vip-tag">VIP</span>
                      )}
                    </div>
                    <div className="liveme-viewer-handle-row">
                      <span className="liveme-viewer-handle">@{viewer.handle}</span>
                      {viewer.contribution ? (
                        <span className="liveme-viewer-contribution">
                          🪙 {viewer.contribution.toLocaleString()} sparks
                        </span>
                      ) : (
                        <span className="liveme-viewer-status-text">Active in chat</span>
                      )}
                    </div>
                  </div>

                  {/* Follow / Host Controls */}
                  <div className="liveme-viewer-actions">
                    <button
                      type="button"
                      className={`liveme-viewer-follow-btn ${isFollowing ? 'following' : ''}`}
                      onClick={(e) => handleToggle(viewer.handle, e)}
                    >
                      {isFollowing ? 'Following' : '+ Follow'}
                    </button>
                    {isHost && (
                      <button
                        type="button"
                        className="liveme-viewer-mod-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast(`Moderator controls opened for @${viewer.handle}`);
                        }}
                        title="Manage Viewer"
                      >
                        ⚙️
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="liveme-viewers-footer">
          <span>🟢 Real-time audience synchronized across decentralized nodes</span>
        </div>
      </div>
    </div>
  );
};
