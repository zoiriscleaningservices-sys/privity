/**
 * TestPatternSource — a synthetic, clearly-labelled video source for QA.
 *
 * Renders an animated pattern (skin-tone oval, neutral greys, saturated swatches, moving
 * marker, clock) into a canvas and exposes it via captureStream(). It goes through exactly
 * the same FilterPipeline path as a real camera, so filters can be verified on machines
 * without a webcam (CI, headless browsers). It is never presented as a camera.
 */

export type PatternVariant = 'front' | 'back' | 'guest';

const SWATCHES = ['#d94a3d', '#e9b949', '#3fa66b', '#2f7fd6', '#8f4fd1', '#ffffff', '#7f7f7f', '#141414'];

/** A silent audio track (labelled "Test tone") so the mic path can be exercised without a microphone. */
export function createSilentAudioTrack(): { track: MediaStreamTrack; close: () => void } | null {
  const AC =
    typeof window !== 'undefined'
      ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!AC) return null;
  const ctx = new AC();
  const dest = ctx.createMediaStreamDestination();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const osc = ctx.createOscillator();
  osc.connect(gain).connect(dest);
  osc.start();
  const track = dest.stream.getAudioTracks()[0];
  if (!track) {
    void ctx.close().catch(() => undefined);
    return null;
  }
  return {
    track,
    close: () => {
      track.stop();
      void ctx.close().catch(() => undefined);
    },
  };
}

export class TestPatternSource {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private raf: number | null = null;
  private stream: MediaStream | null = null;
  private t0 = performance.now();

  constructor(
    private variant: PatternVariant = 'front',
    private readonly label = 'TEST SIGNAL',
    width = 540,
    height = 960,
  ) {
    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : ({} as HTMLCanvasElement);
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = typeof this.canvas.getContext === 'function' ? this.canvas.getContext('2d') : null;
  }

  setVariant(v: PatternVariant): void {
    this.variant = v;
  }

  getVariant(): PatternVariant {
    return this.variant;
  }

  /** Starts drawing and returns a video-only stream. */
  start(): MediaStream {
    if (!this.stream) {
      this.draw();
      const c = this.canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream };
      if (typeof c.captureStream !== 'function') throw new Error('captureStream is not supported in this browser.');
      this.stream = c.captureStream(30);
      const loop = () => {
        this.draw();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    return this.stream;
  }

  stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private draw(): void {
    const g = this.ctx;
    if (!g) return;
    const { width: w, height: h } = this.canvas;
    const t = (performance.now() - this.t0) / 1000;

    const bg = g.createLinearGradient(0, 0, w, h);
    if (this.variant === 'back') {
      bg.addColorStop(0, '#1d3b2f');
      bg.addColorStop(1, '#6b8f5e');
    } else if (this.variant === 'guest') {
      bg.addColorStop(0, '#2b2340');
      bg.addColorStop(1, '#7a5c8f');
    } else {
      bg.addColorStop(0, '#24324a');
      bg.addColorStop(1, '#8a6a58');
    }
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // Neutral grey ramp (left edge) — makes temperature/tint shifts obvious.
    for (let i = 0; i < 8; i += 1) {
      const v = Math.round((i / 7) * 255);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(0, (h * i) / 8, w * 0.08, h / 8);
    }

    // Skin-tone "subject" — what a filter mostly changes on a real stream.
    const cx = w / 2 + Math.sin(t * 0.8) * w * 0.04;
    const cy = h * 0.4;
    g.fillStyle = this.variant === 'back' ? '#c7a27e' : '#d9a184';
    g.beginPath();
    g.ellipse(cx, cy, w * 0.2, h * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2a22';
    g.beginPath();
    g.ellipse(cx, cy - h * 0.1, w * 0.22, h * 0.07, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = '#4a5a7a';
    g.beginPath();
    g.ellipse(cx, h * 0.72, w * 0.34, h * 0.18, 0, Math.PI, Math.PI * 2);
    g.fill();

    // Saturated swatches (bottom).
    const sw = w / SWATCHES.length;
    SWATCHES.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(i * sw, h * 0.86, sw, h * 0.06);
    });

    // Moving marker proves frames are live.
    const mx = ((t * 120) % (w + 40)) - 20;
    g.fillStyle = '#ffffff';
    g.fillRect(mx, h * 0.93, 20, 8);

    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(w * 0.1, h * 0.04, w * 0.8, 44);
    g.fillStyle = '#ffffff';
    g.font = '600 18px system-ui, sans-serif';
    g.textAlign = 'center';
    const label = this.variant === 'back' ? `${this.label} · REAR` : this.label;
    g.fillText(`${label} · ${new Date().toLocaleTimeString()}`, w / 2, h * 0.04 + 28);
  }
}
