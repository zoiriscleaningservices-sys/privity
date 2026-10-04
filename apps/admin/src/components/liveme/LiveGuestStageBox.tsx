import React, { useEffect, useRef, useState } from 'react';
import { RoomViewer } from './LiveMeViewersModal';

export interface LiveGuestStageBoxProps {
  guest: RoomViewer;
  isHost: boolean;
  isSelf: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  guestLiveFrame?: string | null;
  onRemove?: () => void;
  onLeave?: () => void;
  showToast: (msg: string) => void;
}

export const LiveGuestStageBox: React.FC<LiveGuestStageBoxProps> = ({
  guest,
  isHost,
  isSelf,
  localStream,
  remoteStream,
  guestLiveFrame,
  onRemove,
  onLeave,
  showToast,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const syntheticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Manage media stream attachment with zero-echo prevention
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isMicMuted || isCamOff) {
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
    }

    if (isSelf && localStream) {
      videoEl.srcObject = localStream;
      videoEl.muted = true; // STRICT: self-preview MUST be muted to prevent local audio feedback/echo
      videoEl.play().catch(() => {});
    } else if (remoteStream) {
      videoEl.srcObject = remoteStream;
      videoEl.muted = isMicMuted;
      videoEl.volume = 1.0;
      videoEl.play().catch((err) => {
        console.warn('Guest video play notice:', err);
      });
    } else {
      // High-fidelity dynamic fallback visualizer for simulated guests/testing
      const canvas = syntheticCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animId: number;
      let frame = 0;
      const avatarImg = new Image();
      avatarImg.crossOrigin = 'anonymous';
      avatarImg.src = guest.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';

      const renderLoop = () => {
        frame++;
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Gradient backdrop
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(1, '#090d16');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Speaking ripple
        const pulse = Math.sin(frame * 0.12) * 6;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, 70, 36 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
        ctx.fill();

        // Guest Avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, 70, 32, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        if (avatarImg.complete && avatarImg.naturalWidth > 0) {
          ctx.drawImage(avatarImg, canvas.width / 2 - 32, 38, 64, 64);
        } else {
          ctx.fillStyle = '#ec4899';
          ctx.fillRect(canvas.width / 2 - 32, 38, 64, 64);
        }
        ctx.restore();

        // Audio Equalizer bars inside canvas
        const barWidth = 3;
        const barGap = 3;
        const totalBars = 7;
        const startX = (canvas.width - (totalBars * (barWidth + barGap))) / 2;
        for (let i = 0; i < totalBars; i++) {
          const barH = 6 + Math.abs(Math.sin((frame + i * 3) * 0.15)) * 18;
          ctx.fillStyle = i % 2 === 0 ? '#06b6d4' : '#ec4899';
          ctx.fillRect(startX + i * (barWidth + barGap), 125 - barH / 2, barWidth, barH);
        }

        animId = requestAnimationFrame(renderLoop);
      };
      renderLoop();

      return () => {
        cancelAnimationFrame(animId);
      };
    }
  }, [isSelf, localStream, remoteStream, isMicMuted, guest.avatar]);

  // Audio mute toggle handler
  const handleToggleMic = () => {
    if (isSelf && localStream) {
      const next = !isMicMuted;
      setIsMicMuted(next);
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      showToast(next ? '🔇 Your guest mic is muted' : '🎙️ Your guest mic is live');
    } else {
      const next = !isMicMuted;
      setIsMicMuted(next);
      if (videoRef.current) {
        videoRef.current.muted = next;
      }
      showToast(next ? `🔇 Muted @${guest.name}` : `🔊 Unmuted @${guest.name}`);
    }
  };

  // Video camera toggle handler (for self)
  const handleToggleCam = () => {
    if (isSelf && localStream) {
      const next = !isCamOff;
      setIsCamOff(next);
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !next;
      });
      showToast(next ? '🚫 Guest camera paused' : '📹 Guest camera resumed');
    }
  };

  const cleanHandle = guest.handle.replace(/^@/, '');

  return (
    <div className={`liveme-guest-stage-box ${isSpeaking && !isMicMuted ? 'speaking' : ''}`}>
      {/* 1. Underlying Base Layer: Live Guest Camera Frame or Glowing Avatar Visualizer */}
      {guestLiveFrame ? (
        <img
          src={guestLiveFrame}
          alt={guest.name}
          className="liveme-guest-stage-video"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            zIndex: 1,
          }}
        />
      ) : !localStream && !remoteStream ? (
        <canvas
          ref={syntheticCanvasRef}
          width={180}
          height={240}
          className="liveme-guest-stage-video"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            zIndex: 1,
          }}
        />
      ) : (
        <div
          className="liveme-guest-stage-video"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #090d16 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <img
            src={guest.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
            alt=""
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #06b6d4',
              boxShadow: '0 0 16px rgba(6, 182, 212, 0.4)',
            }}
          />
        </div>
      )}

      {/* 2. Real-time WebRTC / Local Camera Video Layer */}
      {((isSelf && localStream) || (!isSelf && remoteStream)) && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf ? true : isMicMuted}
          onPlaying={() => setIsVideoPlaying(true)}
          onLoadedData={() => setIsVideoPlaying(true)}
          onError={() => setIsVideoPlaying(false)}
          className={`liveme-guest-stage-video ${isCamOff ? 'hidden' : ''}`}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 2,
            opacity: isVideoPlaying ? 1 : (guestLiveFrame ? 0 : 1),
            transition: 'opacity 0.2s ease-in-out',
          }}
        />
      )}

      {/* Cam off placeholder if guest disabled their camera */}
      {isCamOff && (
        <div className="guest-cam-off-overlay">
          <img src={guest.avatar} alt="" className="guest-cam-off-avatar" />
          <span className="guest-cam-off-text">Camera Paused</span>
        </div>
      )}

      {/* 2. Top Controls Header */}
      <div className="liveme-guest-stage-header">
        <div className="guest-stage-badge">
          <span className="dot" />
          <span>{isSelf ? 'YOU (GUEST)' : 'GUEST'}</span>
        </div>

        <div className="guest-stage-actions">
          {/* Mute Mic Button */}
          <button
            type="button"
            className={`guest-stage-btn ${isMicMuted ? 'muted' : ''}`}
            onClick={handleToggleMic}
            title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMicMuted ? '🔇' : '🎙️'}
          </button>

          {/* Self-only: Camera Toggle */}
          {isSelf && (
            <button
              type="button"
              className={`guest-stage-btn ${isCamOff ? 'muted' : ''}`}
              onClick={handleToggleCam}
              title={isCamOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isCamOff ? '🚫' : '📹'}
            </button>
          )}

          {/* Host Kick / Self Leave */}
          {isHost ? (
            <button
              type="button"
              className="guest-stage-btn kick"
              onClick={onRemove}
              title="Remove guest from stage"
            >
              ✕
            </button>
          ) : isSelf ? (
            <button
              type="button"
              className="guest-stage-btn leave"
              onClick={onLeave}
              title="Leave guest stage"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      {/* 3. Bottom User Info & Audio Equalizer Wave */}
      <div className="liveme-guest-stage-footer">
        <div className="guest-stage-user-tag" title={guest.name}>
          <span>@{cleanHandle}</span>
        </div>

        {!isMicMuted && (
          <div className="guest-stage-talking-wave">
            <span className="talking-bar" />
            <span className="talking-bar" />
            <span className="talking-bar" />
          </div>
        )}
      </div>
    </div>
  );
};
