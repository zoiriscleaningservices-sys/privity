import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FilterPipeline, PipelineState } from './FilterPipeline';
import { FilterParams } from './filterTypes';

/** Attaches a MediaStream to an inline <video> with autoplay recovery and diagnostics. */
export const StreamVideo = memo(function StreamVideo({
  stream,
  mirror = false,
  className,
  label,
}: {
  stream: MediaStream | null;
  mirror?: boolean;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [trackCount, setTrackCount] = useState(0);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;

    const updateTracks = () => {
      const vTracks = stream ? stream.getVideoTracks() : [];
      setTrackCount(vTracks.length);
    };

    updateTracks();

    if (v.srcObject !== stream) {
      v.srcObject = stream;
    }

    const tryPlay = () => {
      if (!stream) return;
      v.play()
        .then(() => {
          setIsPlaying(true);
          setIsBlocked(false);
        })
        .catch((err) => {
          if (err?.name === 'NotAllowedError') {
            setIsBlocked(true);
          }
        });
    };

    const handleLoadedMetadata = () => {
      updateTracks();
      tryPlay();
    };

    const handleLoadedData = () => {
      updateTracks();
      tryPlay();
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsBlocked(false);
    };

    const handleTimeUpdate = () => {
      if (v.currentTime > 0 || (v.videoWidth > 0 && !v.paused)) {
        setIsPlaying(true);
        setIsBlocked(false);
      }
    };

    const handlePause = () => {
      if (!v.ended && v.currentTime === 0) {
        setIsPlaying(false);
      }
    };

    v.addEventListener('loadedmetadata', handleLoadedMetadata);
    v.addEventListener('loadeddata', handleLoadedData);
    v.addEventListener('canplay', tryPlay);
    v.addEventListener('playing', handlePlaying);
    v.addEventListener('timeupdate', handleTimeUpdate);
    v.addEventListener('pause', handlePause);

    if (stream) {
      stream.addEventListener('addtrack', updateTracks);
      stream.addEventListener('removetrack', updateTracks);
      tryPlay();
    }

    return () => {
      v.removeEventListener('loadedmetadata', handleLoadedMetadata);
      v.removeEventListener('loadeddata', handleLoadedData);
      v.removeEventListener('canplay', tryPlay);
      v.removeEventListener('playing', handlePlaying);
      v.removeEventListener('timeupdate', handleTimeUpdate);
      v.removeEventListener('pause', handlePause);
      if (stream) {
        stream.removeEventListener('addtrack', updateTracks);
        stream.removeEventListener('removetrack', updateTracks);
      }
    };
  }, [stream]);

  const handleManualPlay = () => {
    const v = ref.current;
    if (v) {
      v.play()
        .then(() => {
          setIsPlaying(true);
          setIsBlocked(false);
        })
        .catch(() => {});
    }
  };

  return (
    <div
      className={`plv-stream-video-wrap ${className ?? ''}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <video
        ref={ref}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          ...(mirror ? { transform: 'scaleX(-1)' } : undefined),
        }}
        autoPlay
        playsInline
        muted
        aria-label={label}
        data-playing={isPlaying}
        data-tracks={trackCount}
      />
      {isBlocked && (
        <button
          type="button"
          onClick={handleManualPlay}
          style={{
            position: 'absolute',
            inset: 0,
            margin: 'auto',
            width: 'max-content',
            height: 'max-content',
            padding: '10px 16px',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(10px)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          ▶ Click to play video
        </button>
      )}
      {!isPlaying && stream && !isBlocked && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            gap: '8px',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '12px',
            pointerEvents: 'none',
          }}
        >
          <span className="plv-joining-ring" style={{ width: '24px', height: '24px' }} aria-hidden="true" />
          <span>Connecting live stream…</span>
        </div>
      )}
    </div>
  );
});

const NOOP_STATE: PipelineState = {
  status: 'idle',
  error: null,
  bypass: false,
  stats: { framesRendered: 0, avgRenderMs: 0, width: 0, height: 0 },
};

interface QAWindow {
  __privityLiveQA?: { pipeline?: FilterPipeline | null };
}

/**
 * The host's processed camera preview. The visible canvas is the WebGL pipeline output — the
 * same frames that are exposed through `captureStream()` for publishing.
 */
export const FilteredPreview = memo(function FilteredPreview({
  stream,
  params,
  intensity,
  bypass,
  mirror,
  className,
  onPipeline,
}: {
  stream: MediaStream | null;
  params: FilterParams;
  intensity: number;
  bypass: boolean;
  mirror: boolean;
  className?: string;
  onPipeline?: (p: FilterPipeline | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pipeline, setPipeline] = useState<FilterPipeline | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const p = new FilterPipeline(canvas);
    setPipeline(p);
    onPipeline?.(p);
    if (import.meta.env.DEV) (window as QAWindow).__privityLiveQA = { pipeline: p };
    return () => {
      onPipeline?.(null);
      if (import.meta.env.DEV) (window as QAWindow).__privityLiveQA = { pipeline: null };
      p.dispose();
      setPipeline(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !pipeline) return;
    v.srcObject = stream;
    if (!stream) {
      pipeline.stop();
      return;
    }
    const begin = () => {
      pipeline.setSource(v);
      pipeline.start();
    };
    void v.play().catch(() => undefined);
    if (v.readyState >= 2) begin();
    else {
      v.addEventListener('loadeddata', begin, { once: true });
      v.addEventListener('canplay', begin, { once: true });
      v.addEventListener('playing', begin, { once: true });
    }
    return () => {
      v.removeEventListener('loadeddata', begin);
      v.removeEventListener('canplay', begin);
      v.removeEventListener('playing', begin);
      pipeline.stop();
    };
  }, [stream, pipeline]);

  useEffect(() => {
    pipeline?.setFilter(params, intensity);
  }, [pipeline, params, intensity]);

  useEffect(() => {
    pipeline?.setBypass(bypass);
  }, [pipeline, bypass]);

  useEffect(() => {
    pipeline?.setMirror(mirror);
  }, [pipeline, mirror]);

  const state = useSyncExternalStore(
    (fn) => (pipeline ? pipeline.subscribe(fn) : () => undefined),
    () => (pipeline ? pipeline.getState() : NOOP_STATE),
  );
  const unsupported = state.status === 'unsupported' || state.status === 'error';
  const isWarmingUp = state.stats.framesRendered === 0 && !unsupported;
  const showFallback = unsupported || isWarmingUp;

  return (
    <div className={`plv-filtered ${className ?? ''}`} data-pipeline={state.status}>
      {/* Source frames for the GPU. Shown directly when WebGL is unavailable or warming up */}
      <video
        ref={videoRef}
        className={showFallback ? 'plv-filtered-fallback' : 'plv-filtered-source'}
        style={showFallback && mirror ? { transform: 'scaleX(-1)' } : undefined}
        playsInline
        muted
        autoPlay
        aria-hidden={!showFallback}
      />
      <canvas
        ref={canvasRef}
        className="plv-filtered-canvas"
        hidden={unsupported || (isWarmingUp && state.stats.framesRendered === 0)}
        aria-label="Your camera preview"
        role="img"
      />
      {unsupported && (
        <p className="plv-filtered-notice" role="status">
          Filters are unavailable on this browser ({state.error ?? 'WebGL missing'}). You are seeing your unfiltered camera.
        </p>
      )}
      {(!stream || stream.getVideoTracks().length === 0) && (
        <div
          className="plv-filtered-empty"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '13px',
          }}
        >
          <span>Waiting for camera…</span>
        </div>
      )}
    </div>
  );
});
