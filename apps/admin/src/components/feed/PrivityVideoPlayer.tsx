import React, { useState, useEffect, useRef } from 'react';
import { getFreshMediaUrl } from '../../services/mediaDb';

export interface PrivityVideoPlayerProps {
  post: {
    id: string;
    videoMediaId?: string;
    videoUrl?: string;
    contentUrl?: string;
    thumbnailUrl?: string;
  };
  className?: string;
  style?: React.CSSProperties;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  maxHeight?: string;
}

export const PrivityVideoPlayer: React.FC<PrivityVideoPlayerProps> = ({
  post,
  className = '',
  style,
  controls = true,
  autoPlay = false,
  loop = true,
  muted = false,
  onVideoRef,
  maxHeight = 'min(74vh, 600px)',
}) => {
  const [videoUrl, setVideoUrl] = useState<string>(post.videoUrl || post.contentUrl || '');
  const [isError, setIsError] = useState(false);
  const [hasTriedRecover, setHasTriedRecover] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Always re-hydrate fresh object URL from IndexedDB on mount or if blob expired
  useEffect(() => {
    let isMounted = true;
    const mediaKey = post.videoMediaId || post.id;
    if (mediaKey) {
      getFreshMediaUrl(mediaKey)
        .then((freshUrl) => {
          if (isMounted && freshUrl) {
            setVideoUrl(freshUrl);
            setIsError(false);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [post.id, post.videoMediaId]);

  const handleVideoError = async () => {
    if (hasTriedRecover) {
      setIsError(true);
      return;
    }
    setHasTriedRecover(true);
    const mediaKey = post.videoMediaId || post.id;
    if (mediaKey) {
      try {
        const fresh = await getFreshMediaUrl(mediaKey);
        if (fresh && videoRef.current) {
          setVideoUrl(fresh);
          videoRef.current.src = fresh;
          videoRef.current.load();
          setIsError(false);
          return;
        }
      } catch {}
    }
    setIsError(true);
  };

  const poster = post.thumbnailUrl;

  const handleAttachRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    onVideoRef?.(el);
  };

  const cleanMediaUrl = (url?: string): string => {
    if (!url) return '';
    return url.split('#')[0];
  };

  const [isAudioMuted, setIsAudioMuted] = useState(muted);

  const toggleAudio = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    if (videoRef.current) {
      videoRef.current.muted = next;
      videoRef.current.volume = 1.0;
      if (!next) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-play when scrolled into view and auto-pause when scrolled out of view
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const vid = videoRef.current;
          if (!vid) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
            // Video is prominently in view: start playing seamlessly
            vid.muted = isAudioMuted;
            vid.volume = 1.0;
            const playPromise = vid.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {
                vid.muted = true;
                vid.play().catch(() => {});
              });
            }
          } else if (!entry.isIntersecting || entry.intersectionRatio < 0.2) {
            // Video was scrolled away: pause immediately
            vid.pause();
          }
        });
      },
      {
        threshold: [0, 0.2, 0.45, 0.8],
      }
    );

    observer.observe(el);

    const handleVisibility = () => {
      if (document.hidden && videoRef.current) {
        videoRef.current.pause();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, [videoUrl, isAudioMuted]);

  return (
    <div
      ref={containerRef}
      className={`privity-video-stage-box ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        maxHeight,
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#05070d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {!isError && videoUrl ? (
        <>
          <video
            ref={handleAttachRef}
            src={cleanMediaUrl(videoUrl)}
            controls={controls}
            autoPlay={autoPlay}
            loop={loop}
            muted={isAudioMuted}
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
            preload="metadata"
            poster={poster}
            onError={handleVideoError}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight,
              borderRadius: '16px',
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <button
            type="button"
            className="privity-video-sound-pill"
            onClick={toggleAudio}
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              background: isAudioMuted ? 'rgba(0, 0, 0, 0.72)' : 'rgba(99, 102, 241, 0.92)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              zIndex: 15,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {isAudioMuted ? '🔇 Tap for Sound' : '🔊 Playing Audio'}
          </button>
        </>
      ) : (
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: '260px',
            maxHeight,
            background: '#05070d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={async () => {
            const mediaKey = post.videoMediaId || post.id;
            if (mediaKey) {
              const fresh = await getFreshMediaUrl(mediaKey);
              if (fresh) {
                setVideoUrl(fresh);
                setIsError(false);
                setHasTriedRecover(false);
              }
            }
          }}
        >
          {poster ? (
            <img
              src={poster}
              alt="Video Preview"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '36px' }}>🎬</span>
              <span>Tap to play video dispatch</span>
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.92)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
                color: '#fff',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
