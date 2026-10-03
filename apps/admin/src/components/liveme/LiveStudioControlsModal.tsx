import React from 'react';

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
  micAudioLevel: number;
  isAudioMonitoring: boolean;
  onToggleAudioMonitoring: () => void;
  // Dual Camera Controls
  isDualCameraActive: boolean;
  onToggleDualCamera: () => void;
  dualCameraPosition: 'top-right' | 'top-left' | 'bottom-right' | 'split';
  onChangeDualCameraPosition?: (pos: 'top-right' | 'top-left' | 'bottom-right' | 'split') => void;
  onChangeDualPosition?: (pos: 'top-right' | 'top-left' | 'bottom-right' | 'split') => void;
  onSwapDualCameras: () => void;
  isDualSwapped?: boolean;
  // Moderation Panel Trigger
  restrictedCount?: number;
  moderationCount?: number;
  onOpenModeration: () => void;
  showToast?: (msg: string) => void;
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
  micAudioLevel,
  isAudioMonitoring,
  onToggleAudioMonitoring,
  isDualCameraActive,
  onToggleDualCamera,
  dualCameraPosition,
  onChangeDualCameraPosition,
  onChangeDualPosition,
  onSwapDualCameras,
  isDualSwapped: _isDualSwapped,
  restrictedCount = 0,
  moderationCount,
  onOpenModeration,
  showToast,
}) => {
  const handleChangeDualPos = onChangeDualPosition || onChangeDualCameraPosition || (() => {});
  const activeRestrictedCount = moderationCount ?? restrictedCount;

  if (!isOpen) return null;

  return (
    <div className="liveme-studio-modal-backdrop" onClick={onClose}>
      <div className="liveme-studio-modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="liveme-studio-modal-header">
          <div className="liveme-studio-header-title">
            <span className="liveme-studio-header-icon">🎛️</span>
            <div>
              <h3>Host Studio Controls</h3>
              <p>Hardware camera, microphone, dual camera & stream settings</p>
            </div>
          </div>
          <button type="button" className="liveme-studio-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Section 1: Quick Camera & Mic Hardware Grid */}
        <div className="liveme-studio-grid">
          {/* Flip Camera */}
          <button
            type="button"
            className="liveme-studio-card-btn"
            onClick={() => {
              onFlipCamera();
              if (showToast) showToast(`🔄 Camera switched to ${cameraFacing === 'user' ? 'Back (Environment)' : 'Front (Selfie)'}`);
            }}
          >
            <span className="liveme-studio-card-icon">🔄</span>
            <div className="liveme-studio-card-text">
              <span className="title">Flip Camera</span>
              <span className="sub">{cameraFacing === 'user' ? 'Front (Selfie)' : 'Back Camera'}</span>
            </div>
            <span className="liveme-studio-card-pill">Switch</span>
          </button>

          {/* Mirror Camera */}
          <button
            type="button"
            className={`liveme-studio-card-btn ${isMirrored ? 'active' : ''}`}
            onClick={() => {
              onToggleMirror();
              if (showToast) showToast(isMirrored ? '🪞 Mirroring turned OFF' : '🪞 Mirroring turned ON');
            }}
          >
            <span className="liveme-studio-card-icon">🪞</span>
            <div className="liveme-studio-card-text">
              <span className="title">Mirror Camera</span>
              <span className="sub">{isMirrored ? 'Reflection ON' : 'Standard View'}</span>
            </div>
            <span className={`liveme-studio-card-pill ${isMirrored ? 'on' : ''}`}>
              {isMirrored ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Mute Microphone */}
          <button
            type="button"
            className={`liveme-studio-card-btn ${isMicMuted ? 'danger' : ''}`}
            onClick={() => {
              onToggleMic();
              if (showToast) showToast(isMicMuted ? '🎙️ Microphone Unmuted' : '🔇 Microphone Muted');
            }}
          >
            <span className="liveme-studio-card-icon">{isMicMuted ? '🔇' : '🎙️'}</span>
            <div className="liveme-studio-card-text">
              <span className="title">Microphone</span>
              <span className="sub">{isMicMuted ? 'Muted' : `Active · Level: ${micAudioLevel}%`}</span>
            </div>
            <span className={`liveme-studio-card-pill ${isMicMuted ? 'off' : 'on'}`}>
              {isMicMuted ? 'MUTED' : 'LIVE'}
            </span>
          </button>

          {/* Turn Camera Off / On */}
          <button
            type="button"
            className={`liveme-studio-card-btn ${isVideoOff ? 'danger' : ''}`}
            onClick={() => {
              onToggleVideo();
              if (showToast) showToast(isVideoOff ? '📹 Video Stream Resumed' : '🚫 Video Stream Paused');
            }}
          >
            <span className="liveme-studio-card-icon">{isVideoOff ? '🚫' : '📹'}</span>
            <div className="liveme-studio-card-text">
              <span className="title">Camera Video</span>
              <span className="sub">{isVideoOff ? 'Camera Paused' : 'Broadcasting Live'}</span>
            </div>
            <span className={`liveme-studio-card-pill ${isVideoOff ? 'off' : 'on'}`}>
              {isVideoOff ? 'OFF' : 'ON'}
            </span>
          </button>
        </div>

        {/* Audio VU Monitor Gauge */}
        <div className="liveme-studio-vu-container">
          <div className="liveme-studio-vu-header">
            <span>🎙️ Microphone Input Volume</span>
            <span className="liveme-studio-vu-db">{isMicMuted ? 'MUTED' : `${micAudioLevel}%`}</span>
          </div>
          <div className="liveme-studio-vu-bar-track">
            <div
              className={`liveme-studio-vu-bar-fill ${isMicMuted ? 'muted' : ''}`}
              style={{ width: `${isMicMuted ? 0 : micAudioLevel}%` }}
            />
          </div>
        </div>

        {/* Section 2: DUAL CAMERA EXPERIENCE */}
        <div className="liveme-studio-section">
          <div className="liveme-studio-section-title">
            <div className="left">
              <span className="icon">📷</span>
              <div>
                <h4>Dual Camera Mode</h4>
                <p>Simultaneous front & back camera PIP or screen share</p>
              </div>
            </div>
            <button
              type="button"
              className={`liveme-studio-toggle-switch ${isDualCameraActive ? 'active' : ''}`}
              onClick={() => {
                onToggleDualCamera();
                if (showToast) showToast(isDualCameraActive ? 'Dual Camera Turned OFF' : 'Dual Camera Activated! Both views are active.');
              }}
            >
              <span className="thumb" />
            </button>
          </div>

          {isDualCameraActive && (
            <div className="liveme-dual-camera-options">
              <div className="liveme-dual-layout-picker">
                <span className="label">PIP Position:</span>
                {(['top-right', 'top-left', 'bottom-right', 'split'] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    className={`liveme-dual-pos-btn ${dualCameraPosition === pos ? 'active' : ''}`}
                    onClick={() => {
                      handleChangeDualPos(pos);
                      if (showToast) showToast(`Dual view position set to ${pos.replace('-', ' ').toUpperCase()}`);
                    }}
                  >
                    {pos === 'top-right' ? '↗️ Top-Right' : pos === 'top-left' ? '↖️ Top-Left' : pos === 'bottom-right' ? '↘️ Bottom-Right' : '🔲 50/50 Split'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="liveme-dual-swap-btn"
                onClick={() => {
                  onSwapDualCameras();
                  if (showToast) showToast('🔄 Main and PIP cameras swapped!');
                }}
              >
                🔄 Swap Main & Secondary Cameras
              </button>
            </div>
          )}
        </div>

        {/* Section 3: In-Ear Voice Monitoring & Moderation Panel */}
        <div className="liveme-studio-row-extras">
          {/* Voice Monitoring */}
          <button
            type="button"
            className={`liveme-studio-pill-action ${isAudioMonitoring ? 'active' : ''}`}
            onClick={() => {
              onToggleAudioMonitoring();
              if (showToast) showToast(isAudioMonitoring ? '🎧 Voice Monitoring OFF' : '🎧 Voice Monitoring ON (Listen in headphones)');
            }}
          >
            <span>🎧</span>
            <span>Hear Myself (Monitoring)</span>
            <span className="indicator">{isAudioMonitoring ? 'ON' : 'OFF'}</span>
          </button>

          {/* Moderation Panel */}
          <button
            type="button"
            className="liveme-studio-pill-action"
            onClick={() => {
              onClose();
              onOpenModeration();
            }}
          >
            <span>🛡️</span>
            <span>Room Moderation</span>
            {activeRestrictedCount > 0 && <span className="mod-count">{activeRestrictedCount}</span>}
          </button>
        </div>

        {/* Footer Done */}
        <div className="liveme-studio-footer">
          <button type="button" className="liveme-studio-done-btn" onClick={onClose}>
            ✓ Done
          </button>
        </div>
      </div>
    </div>
  );
};
