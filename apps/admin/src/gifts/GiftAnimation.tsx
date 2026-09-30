import React, { useState, useEffect, useRef } from 'react';
import { Gift } from './types';
import { playGiftSound } from './soundEffects';

export interface GiftAnimationProps {
  gift: Gift;
  onEnded?: () => void;
  onError?: (error: any) => void;
  className?: string;
  style?: React.CSSProperties;
  isMuted?: boolean;
}

type RenderMode = 'webm' | 'apng' | 'icon_fallback';

export const GiftAnimation: React.FC<GiftAnimationProps> = ({
  gift,
  onEnded,
  onError,
  className = '',
  style = {},
  isMuted = false,
}) => {
  const [renderMode, setRenderMode] = useState<RenderMode>(() => {
    // Preferred format as specified in requirements: APNG (guaranteed RGBA alpha transparency across all browsers)
    if (gift.animationUrl) {
      return 'apng';
    }
    if (typeof window !== 'undefined' && gift.webmUrl) {
      return 'webm';
    }
    return 'icon_fallback';
  });

  const endedCalledRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleComplete = () => {
    if (!endedCalledRef.current) {
      endedCalledRef.current = true;
      onEnded?.();
    }
  };

  // Sound playback on mount
  useEffect(() => {
    playGiftSound(gift.soundUrl, gift.id, isMuted);
  }, [gift.id, gift.soundUrl, isMuted]);

  // Fallback safety timeout based on animationDuration
  useEffect(() => {
    const duration = gift.animationDuration || 4000;
    const timer = setTimeout(() => {
      handleComplete();
    }, duration + 300);

    return () => clearTimeout(timer);
  }, [gift.animationDuration]);

  // Video playback handler (when in webm mode)
  useEffect(() => {
    if (renderMode === 'webm' && videoRef.current) {
      const v = videoRef.current;
      v.muted = true;
      v.playsInline = true;
      v.play().catch((err) => {
        console.warn(`[GiftAnimation] WebM playback issue for '${gift.name}', falling back to icon:`, err);
        setRenderMode('icon_fallback');
      });
    }
  }, [renderMode, gift.name]);

  const handleApngError = (e: any) => {
    console.warn(`[GiftAnimation] APNG load failed for '${gift.name}', trying WebM fallback`);
    if (gift.webmUrl) {
      setRenderMode('webm');
    } else {
      setRenderMode('icon_fallback');
      onError?.(e);
    }
  };

  const handleWebmError = () => {
    console.warn(`[GiftAnimation] WebM load failed for '${gift.name}', using transparent icon fallback`);
    setRenderMode('icon_fallback');
  };

  return (
    <div
      className={`gift-animation-container gift-rarity-${gift.rarity} ${className}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {renderMode === 'webm' && gift.webmUrl && (
        <video
          ref={videoRef}
          src={gift.webmUrl}
          className="gift-animation-media gift-webm-video"
          playsInline
          autoPlay
          muted
          onError={handleWebmError}
          onEnded={handleComplete}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            backgroundColor: 'transparent',
            display: 'block',
          }}
        />
      )}

      {renderMode === 'apng' && (
        <img
          src={gift.animationUrl}
          alt={gift.name}
          className="gift-animation-media gift-apng-image"
          onError={handleApngError}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            backgroundColor: 'transparent',
            display: 'block',
            imageRendering: 'auto',
          }}
        />
      )}

      {renderMode === 'icon_fallback' && (
        <div className="gift-fallback-card animate-pulse-glow">
          <div className="gift-fallback-icon-halo">
            <img
              src={gift.icon}
              alt={gift.name}
              className="gift-fallback-icon-img"
              onError={(e) => {
                // Last ditch: if image file doesn't exist, show emoji/styled container without broken icon
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="gift-fallback-aura" />
        </div>
      )}
    </div>
  );
};
