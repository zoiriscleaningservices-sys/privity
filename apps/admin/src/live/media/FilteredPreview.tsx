import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FilterPipeline, PipelineState } from './FilterPipeline';
import { FilterParams } from './filterTypes';

/** Attaches a MediaStream to a muted inline <video>. */
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
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    if (stream) void v.play().catch(() => undefined);
  }, [stream]);
  return (
    <video
      ref={ref}
      className={className}
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
      autoPlay
      playsInline
      muted
      aria-label={label}
    />
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
    else v.addEventListener('loadeddata', begin, { once: true });
    return () => {
      v.removeEventListener('loadeddata', begin);
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

  return (
    <div className={`plv-filtered ${className ?? ''}`} data-pipeline={state.status}>
      {/* Source frames for the GPU. Shown directly only when WebGL is unavailable. */}
      <video
        ref={videoRef}
        className={unsupported ? 'plv-filtered-fallback' : 'plv-filtered-source'}
        style={unsupported && mirror ? { transform: 'scaleX(-1)' } : undefined}
        playsInline
        muted
        autoPlay
        aria-hidden={!unsupported}
      />
      <canvas
        ref={canvasRef}
        className="plv-filtered-canvas"
        hidden={unsupported}
        aria-label="Your camera preview"
        role="img"
      />
      {unsupported && (
        <p className="plv-filtered-notice" role="status">
          Filters are unavailable on this browser ({state.error ?? 'WebGL missing'}). You are seeing your unfiltered camera.
        </p>
      )}
    </div>
  );
});
