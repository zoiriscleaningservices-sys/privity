/**
 * Privity LIVE — Dual camera compositor.
 *
 * Combines the two REAL camera tracks (primary = processed main camera, secondary = the
 * opposite camera opened by LocalMediaController.startDual) into one canvas-backed video
 * track. That single track is swapped into every existing WebRTC sender with
 * `RTCRtpSender.replaceTrack`, so viewers receive both actual camera feeds without
 * renegotiating any peer connection and without restarting the LIVE session.
 *
 * Nothing here fabricates content: if a source has no frames yet, that region stays black
 * and the compositor reports `ready = false` until both cameras deliver real frames.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DualLayout {
  canvas: { w: number; h: number };
  main: Rect;
  pip: Rect;
  radius: number;
}

/** Longest canvas side; keeps encoder load reasonable on phones. */
const MAX_SIDE = 1280;

/**
 * Pure layout maths (unit-tested). The picture-in-picture is kept inside the centre 9:16
 * region of landscape canvases so portrait viewers using `object-fit: cover` still see it.
 */
export function computeDualLayout(mainW: number, mainH: number, pipAspect = 3 / 4): DualLayout {
  const srcW = mainW > 0 ? mainW : 720;
  const srcH = mainH > 0 ? mainH : 1280;
  const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
  const w = Math.max(2, Math.round((srcW * scale) / 2) * 2);
  const h = Math.max(2, Math.round((srcH * scale) / 2) * 2);

  const safeW = w > h ? Math.min(w, Math.round((h * 9) / 16)) : w;
  const safeX = Math.round((w - safeW) / 2);
  const pipW = Math.round(safeW * 0.3);
  const pipH = Math.round(pipW / (pipAspect > 0 ? pipAspect : 3 / 4));
  const margin = Math.round(safeW * 0.04);

  return {
    canvas: { w, h },
    main: { x: 0, y: 0, w, h },
    pip: { x: safeX + margin, y: Math.round(h * 0.14), w: pipW, h: Math.min(pipH, Math.round(h * 0.4)) },
    radius: Math.max(6, Math.round(pipW * 0.09)),
  };
}

/** Cover-fit source rectangle so a frame fills `dst` without distortion. */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return { x: 0, y: 0, w: srcW, h: srcH };
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const w = srcH * dstRatio;
    return { x: (srcW - w) / 2, y: 0, w, h: srcH };
  }
  const h = srcW / dstRatio;
  return { x: 0, y: (srcH - h) / 2, w: srcW, h };
}

export function canComposite(): boolean {
  if (typeof document === 'undefined') return false;
  const c = document.createElement('canvas') as HTMLCanvasElement & { captureStream?: unknown };
  return typeof c.captureStream === 'function' && typeof MediaStream !== 'undefined';
}

function hiddenVideo(track: MediaStreamTrack): HTMLVideoElement {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.autoplay = true;
  v.srcObject = new MediaStream([track]);
  void v.play().catch(() => {});
  return v;
}

export class DualCompositor {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly mainVideo: HTMLVideoElement;
  private readonly pipVideo: HTMLVideoElement;
  private readonly output: MediaStream;
  private timer: ReturnType<typeof setInterval> | null = null;
  private swapped = false;
  private disposed = false;

  /** True once both real cameras have delivered at least one frame. */
  ready = false;

  constructor(primary: MediaStreamTrack, secondary: MediaStreamTrack, fps = 30) {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas is not available on this device.');
    this.ctx = ctx;
    const s = primary.getSettings?.() ?? {};
    const l = computeDualLayout(s.width ?? 0, s.height ?? 0);
    this.canvas.width = l.canvas.w;
    this.canvas.height = l.canvas.h;
    this.mainVideo = hiddenVideo(primary);
    this.pipVideo = hiddenVideo(secondary);
    const c = this.canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream };
    this.output = c.captureStream(fps);
    // setInterval (not rAF) keeps frames flowing while the host's tab is in the background.
    this.timer = setInterval(() => this.draw(), Math.round(1000 / fps));
    this.draw();
  }

  get track(): MediaStreamTrack | null {
    return this.output.getVideoTracks()[0] ?? null;
  }

  /** Swap which real camera fills the frame and which sits in the picture-in-picture. */
  setSwapped(v: boolean): void {
    this.swapped = v;
  }

  private draw(): void {
    if (this.disposed) return;
    const big = this.swapped ? this.pipVideo : this.mainVideo;
    const small = this.swapped ? this.mainVideo : this.pipVideo;
    const bw = big.videoWidth;
    const bh = big.videoHeight;
    const sw = small.videoWidth;
    const sh = small.videoHeight;
    this.ready = bw > 0 && sw > 0;

    const l = computeDualLayout(bw, bh, sw > 0 && sh > 0 ? Math.min(1, sw / sh) : 3 / 4);
    if (this.canvas.width !== l.canvas.w || this.canvas.height !== l.canvas.h) {
      this.canvas.width = l.canvas.w;
      this.canvas.height = l.canvas.h;
    }
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, l.canvas.w, l.canvas.h);
    if (bw > 0 && bh > 0) {
      const crop = coverCrop(bw, bh, l.main.w, l.main.h);
      ctx.drawImage(big, crop.x, crop.y, crop.w, crop.h, l.main.x, l.main.y, l.main.w, l.main.h);
    }
    if (sw > 0 && sh > 0) {
      const { x, y, w, h } = l.pip;
      const r = l.radius;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.round(w * 0.08);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.clip();
      const crop = coverCrop(sw, sh, w, h);
      ctx.drawImage(small, crop.x, crop.y, crop.w, crop.h, x, y, w, h);
      ctx.restore();
      ctx.save();
      ctx.lineWidth = Math.max(2, Math.round(w * 0.012));
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.output.getTracks().forEach((t) => t.stop());
    for (const v of [this.mainVideo, this.pipVideo]) {
      try {
        v.pause();
      } catch {}
      v.srcObject = null;
    }
  }
}
