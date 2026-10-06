import React, { useState } from 'react';

export interface LiveStudioControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Camera Controls
  isMirrored: boolean;
  onToggleMirror: () => void;
  cameraFacing: 'user' | 'environment';
  onFlipCamera: () => void;
  isVideoOff: boolean;
  onToggleVideo: () => void;
  // Audio Controls
  isMicMuted: boolean;
  onToggleMic: () => void;
  micAudioLevel?: number;
  isAudioMonitoring?: boolean;
  onToggleAudioMonitoring?: () => void;
  // Dual Camera Controls
  isDualCameraActive?: boolean;
  onToggleDualCamera?: () => void;
  dualCameraPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'split';
  onChangeDualPosition?: (pos: 'top-right' | 'top-left' | 'bottom-right' | 'split') => void;
  onSwapDualCameras?: () => void;
  isDualSwapped?: boolean;
  // Moderation Panel Trigger
  restrictedCount?: number;
  moderationCount?: number;
  onOpenModeration?: () => void;
  showToast?: (msg: string) => void;
  // Stage 3 Integration
  onOpenProFilters?: () => void;
  onOpenStageManager?: () => void;
}

export const LiveStudioControlsModal: React.FC<LiveStudioControlsModalProps> = ({
  isOpen,
  onClose,
  isMirrored,
  onToggleMirror,
  cameraFacing,
  onFlipCamera,
  isVideoOff,
  onToggleVideo,
  isMicMuted,
  onToggleMic,
  micAudioLevel = 0,
  isAudioMonitoring = false,
  onToggleAudioMonitoring,
  onOpenModeration,
  showToast = () => {},
  onOpenProFilters,
  onOpenStageManager,
}) => {
  const [isGridCollapsed, setIsGridCollapsed] = useState(false);
  const [activePollActive, setActivePollActive] = useState(false);
  const [treasureBoxActive, setTreasureBoxActive] = useState(false);
  const [fanBoxActive, setFanBoxActive] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="tiktok-sheet-backdrop" onClick={onClose}>
      <div className="tiktok-studio-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Top Sheet Grabber */}
        <div className="tiktok-sheet-grabber" />

        {/* Section 1: Top 4 Hardware Buttons Row Matching Screenshot 2 */}
        <div className="tiktok-studio-hardware-row">
          {/* Button 1: Flip Camera */}
          <button
            type="button"
            className="tiktok-studio-hardware-btn"
            onClick={() => {
              onFlipCamera();
              showToast(`🔄 Camera flipped to ${cameraFacing === 'user' ? 'Back' : 'Front'}`);
            }}
            title="Flip Camera (Front/Back)"
          >
            <span className="icon">🔄</span>
          </button>

          {/* Button 2: Mirror Camera */}
          <button
            type="button"
            className={`tiktok-studio-hardware-btn ${isMirrored ? 'active' : ''}`}
            onClick={() => {
              onToggleMirror();
              showToast(isMirrored ? '🪞 Mirroring Disabled' : '🪞 Mirroring Enabled');
            }}
            title="Mirror Camera Video"
          >
            <span className="icon">🪞</span>
          </button>

          {/* Button 3: Microphone Toggle */}
          <button
            type="button"
            className={`tiktok-studio-hardware-btn ${isMicMuted ? 'muted' : ''}`}
            onClick={() => {
              onToggleMic();
              showToast(isMicMuted ? '🎙️ Microphone Unmuted' : '🔇 Microphone Muted');
            }}
            title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            <span className="icon">{isMicMuted ? '🔇' : '🎙️'}</span>
            {micAudioLevel > 15 && !isMicMuted && <span className="vu-dot" />}
          </button>

          {/* Button 4: Pause LIVE / Video */}
          <button
            type="button"
            className={`tiktok-studio-hardware-btn ${isVideoOff ? 'paused' : ''}`}
            onClick={() => {
              onToggleVideo();
              showToast(isVideoOff ? '▶️ LIVE Video Resumed' : '⏸️ LIVE Video Paused');
            }}
            title={isVideoOff ? 'Resume LIVE Stream' : 'Pause LIVE Stream'}
          >
            <span className="icon">{isVideoOff ? '▶️' : '⏸️'}</span>
          </button>
        </div>

        {/* Section 2: 8-Tool Feature Grid in Rounded Card Matching Screenshot 2 */}
        <div className="tiktok-studio-card-container">
          {!isGridCollapsed && (
            <div className="tiktok-studio-tools-grid">
              {/* Stage 3 Pro Filters & Custom Editor */}
              {onOpenProFilters && (
                <button
                  type="button"
                  className="tiktok-studio-tool-item active"
                  onClick={() => {
                    onOpenProFilters();
                    onClose();
                  }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(236,72,153,0.18), rgba(139,92,246,0.18))',
                    border: '1px solid rgba(236,72,153,0.4)',
                  }}
                  title="Open Stage 3 Pro Filter Studio (Shaders & Custom Presets)"
                >
                  <div className="tool-icon-wrap" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff' }}>
                    <span className="tool-icon">🎨</span>
                  </div>
                  <span className="tool-label" style={{ color: '#ec4899', fontWeight: 700 }}>Pro Filters</span>
                </button>
              )}

              {/* Stage 3 Stage Manager & Layouts */}
              {onOpenStageManager && (
                <button
                  type="button"
                  className="tiktok-studio-tool-item active"
                  onClick={() => {
                    onOpenStageManager();
                    onClose();
                  }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(147,51,234,0.18))',
                    border: '1px solid rgba(59,130,246,0.4)',
                  }}
                  title="Open Stage 3 Stage Manager (Layouts & Guests)"
                >
                  <div className="tool-icon-wrap" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff' }}>
                    <span className="tool-icon">🎛️</span>
                  </div>
                  <span className="tool-label" style={{ color: '#60a5fa', fontWeight: 700 }}>Stage Manager</span>
                </button>
              )}

              {/* 1. Poll & Gift vote */}
              <button
                type="button"
                className={`tiktok-studio-tool-item ${activePollActive ? 'active' : ''}`}
                onClick={() => {
                  setActivePollActive(!activePollActive);
                  showToast('📊 Poll & Gift Vote triggered for audience!');
                }}
              >
                <div className="tool-icon-wrap">
                  <span className="tool-icon">📊</span>
                </div>
                <span className="tool-label">Poll & Gift vote</span>
              </button>

              {/* 2. Draw & Guess */}
              <button
                type="button"
                className="tiktok-studio-tool-item"
                onClick={() => showToast('✏️ Draw & Guess mini-game started!')}
              >
                <div className="tool-icon-wrap">
                  <span className="tool-icon">✏️</span>
                </div>
                <span className="tool-label">Draw & Guess</span>
              </button>

              {/* 3. Playbook */}
              <button
                type="button"
                className="tiktok-studio-tool-item"
                onClick={() => showToast('📖 Creator Playbook & Tips opened')}
              >
                <div className="tool-icon-wrap">
                  <span className="tool-icon">📖</span>
                </div>
                <span className="tool-label">Playbook</span>
              </button>

              {/* 4. Treasure Box */}
              <button
                type="button"
                className={`tiktok-studio-tool-item ${treasureBoxActive ? 'active' : ''}`}
                onClick={() => {
                  setTreasureBoxActive(!treasureBoxActive);
                  showToast('📦 Countdown Treasure Box dropped in stream!');
                }}
              >
                <div className="tool-icon-wrap">
                  <span className="tool-icon">📦</span>
                </div>
                <span className="tool-label">Treasure Box</span>
              </button>

              {/* 5. Super Fan Box */}
              <button
                type="button"
                className={`tiktok-studio-tool-item ${fanBoxActive ? 'active' : ''}`}
                onClick={() => {
                  setFanBoxActive(!fanBoxActive);
                  showToast('💝 Super Fan Box active for top gifters!');
                }}
              >
                <div className="tool-icon-wrap">
                  <span className="tool-icon">💝</span>
                </div>
                <span className="tool-label">Super Fan Box</span>
              </button>

              {/* 6. AI wallpaper */}
              <button
                type="button"
                className="tiktok-studio-tool-item"
                onClick={() => showToast('🖼️ AI Wallpaper Studio: Green screen background generated')}
              >
                <div className="tool-icon-wrap">
                  <span className="tool-icon">🖼️</span>
                  <span className="red-badge-dot" />
                </div>
                <span className="tool-label">AI wallpaper</span>
              </button>

              {/* 7. Viewer Wishes */}
              <button
                type="button"
                className="tiktok-studio-tool-item"
                onClick={() => showToast('✨ Viewer Wishes & Goal Wishlist opened')}
              >
                <div className="tool-icon-wrap">
                  <span className="tool-icon">✨</span>
                </div>
                <span className="tool-label">Viewer Wishes</span>
              </button>

              {/* 8. Songs of LIVE */}
              <button
                type="button"
                className="tiktok-studio-tool-item"
                onClick={() => showToast('💿 Songs of LIVE: Background playlist & karaoke cue')}
              >
                <div className="tool-icon-wrap">
                  <span className="tool-icon">💿</span>
                </div>
                <span className="tool-label">Songs of LIVE</span>
              </button>
            </div>
          )}

          {/* Toggle Less / More link */}
          <button
            type="button"
            className="tiktok-studio-less-btn"
            onClick={() => setIsGridCollapsed(!isGridCollapsed)}
          >
            {isGridCollapsed ? 'More ⌄' : 'Less ⌃'}
          </button>
        </div>

        {/* Section 3: Bottom Menu Settings List Matching Screenshot 2 */}
        <div className="tiktok-studio-menu-list">
          {/* Item 1: LIVE Gifts */}
          <div
            className="tiktok-studio-menu-item"
            onClick={() => showToast('🎁 LIVE Gifts & Gifting Permissions')}
          >
            <div className="menu-left">
              <span className="menu-icon">🎁</span>
              <span className="menu-title">LIVE Gifts</span>
            </div>
            <div className="menu-right">
              <span className="menu-red-dot" />
              <span className="menu-chevron">›</span>
            </div>
          </div>

          {/* Item 2: Comment */}
          <div
            className="tiktok-studio-menu-item"
            onClick={() => {
              if (onOpenModeration) onOpenModeration();
              else showToast('💬 Comment settings & Keyword Filter');
            }}
          >
            <div className="menu-left">
              <span className="menu-icon">💬</span>
              <span className="menu-title">Comment</span>
            </div>
            <div className="menu-right">
              <span className="menu-chevron">›</span>
            </div>
          </div>

          {/* Item 3: About me */}
          <div
            className="tiktok-studio-menu-item"
            onClick={() => showToast('📋 Host Bio & Introduction Card')}
          >
            <div className="menu-left">
              <span className="menu-icon">📋</span>
              <span className="menu-title">About me</span>
            </div>
            <div className="menu-right">
              <span className="menu-sub-text">Shown</span>
              <span className="menu-chevron">›</span>
            </div>
          </div>

          {/* Item 4: LIVE title */}
          <div
            className="tiktok-studio-menu-item"
            onClick={() => showToast('✏️ Edit LIVE Stream Title & Topic')}
          >
            <div className="menu-left">
              <span className="menu-icon">✏️</span>
              <span className="menu-title">LIVE title</span>
            </div>
            <div className="menu-right">
              <span className="menu-chevron">›</span>
            </div>
          </div>

          {/* Item 5: Campaigns */}
          <div
            className="tiktok-studio-menu-item"
            onClick={() => showToast('⭐ Creator Campaigns & Bonus Challenges')}
          >
            <div className="menu-left">
              <span className="menu-icon">⭐</span>
              <span className="menu-title">Campaigns</span>
            </div>
            <div className="menu-right">
              <span className="menu-sub-badge">New</span>
              <span className="menu-chevron">›</span>
            </div>
          </div>

          {/* Voice Monitoring Extra Option */}
          {onToggleAudioMonitoring && (
            <div
              className="tiktok-studio-menu-item"
              onClick={onToggleAudioMonitoring}
            >
              <div className="menu-left">
                <span className="menu-icon">🎧</span>
                <span className="menu-title">Earphone Audio Monitoring</span>
              </div>
              <div className="menu-right">
                <span className="menu-sub-text">{isAudioMonitoring ? 'ON' : 'OFF'}</span>
                <span className="menu-chevron">›</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
