/**
 * FilterPipeline — real-time GPU colour grading of a camera stream.
 *
 *   MediaStream ─► <video> (hidden) ─► WebGL texture ─► colour-grade shader ─► <canvas>
 *                                                                        └─► canvas.captureStream()
 *
 * The canvas IS the host's preview, so what the host sees is exactly what the pipeline
 * produces. `captureStream()` exposes the processed frames as a MediaStreamTrack — the track
 * Stage 4 publishes to LiveKit instead of the raw camera track.
 *
 * Frames are rendered only when the video has a new frame (requestVideoFrameCallback), with
 * a requestAnimationFrame fallback. When WebGL is unavailable the pipeline reports
 * 'unsupported' and the UI shows the unfiltered camera with an explanation — it never
 * pretends a filter is applied.
 */

import { COLOR_GRADE_FRAGMENT_SHADER, COLOR_GRADE_VERTEX_SHADER } from './colorGrade';
import { FilterParams, IDENTITY_PARAMS, clamp } from './filterTypes';

export type PipelineStatus = 'idle' | 'running' | 'unsupported' | 'context-lost' | 'error';

export interface PipelineStats {
  framesRendered: number;
  /** Rolling average GPU submit time in ms (CPU-side measurement of the draw call). */
  avgRenderMs: number;
  width: number;
  height: number;
}

export interface PipelineState {
  status: PipelineStatus;
  error: string | null;
  bypass: boolean;
  stats: PipelineStats;
}

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const MAX_EDGE = 1280;

export class FilterPipeline {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private loc: {
    a: WebGLUniformLocation | null;
    b: WebGLUniformLocation | null;
    intensity: WebGLUniformLocation | null;
    bypass: WebGLUniformLocation | null;
    mirror: WebGLUniformLocation | null;
  } | null = null;
  private video: VideoWithRvfc | null = null;
  private params: FilterParams = { ...IDENTITY_PARAMS };
  private intensity = 1;
  private mirror = false;
  private frameHandle: number | null = null;
  private frameKind: 'rvfc' | 'raf' | null = null;
  private state: PipelineState = {
    status: 'idle',
    error: null,
    bypass: false,
    stats: { framesRendered: 0, avgRenderMs: 0, width: 0, height: 0 },
  };
  private readonly listeners = new Set<() => void>();
  private lastNotify = 0;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
    this.init();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getState(): PipelineState {
    return this.state;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  get supported(): boolean {
    return this.gl !== null;
  }

  setSource(video: HTMLVideoElement | null): void {
    this.cancelFrame();
    this.video = video as VideoWithRvfc | null;
    if (this.running) this.scheduleFrame();
  }

  setFilter(params: FilterParams, intensity: number): void {
    this.params = params;
    this.intensity = clamp(intensity, 0, 1);
    this.renderIfIdle();
  }

  /** Before/after compare: true shows the untouched camera frame through the same path. */
  setBypass(bypass: boolean): void {
    if (this.state.bypass === bypass) return;
    this.patch({ bypass });
    this.renderIfIdle();
  }

  /** Front cameras are shown mirrored to the host (natural selfie view). */
  setMirror(mirror: boolean): void {
    this.mirror = mirror;
    this.renderIfIdle();
  }

  start(): void {
    if (!this.gl) return;
    this.running = true;
    this.patch({ status: 'running', error: null });
    this.scheduleFrame();
  }

  stop(): void {
    this.running = false;
    this.cancelFrame();
    if (this.state.status === 'running') this.patch({ status: 'idle' });
  }

  /**
   * Processed output as a MediaStream (video only). This is the track to publish when the
   * real media layer is connected. Returns null where captureStream is unavailable.
   */
  captureStream(fps = 30): MediaStream | null {
    const c = this.canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream };
    return typeof c.captureStream === 'function' ? c.captureStream(fps) : null;
  }

  /**
   * Renders the current frame and reads back pixels at normalized positions (0..1, origin
   * top-left of the displayed image). Used by QA to prove the shader changes real pixels.
   */
  samplePixels(points: ReadonlyArray<[number, number]>): Array<[number, number, number, number]> {
    const gl = this.gl;
    if (!gl || !this.renderFrame()) return [];
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const buf = new Uint8Array(4);
    return points.map(([x, y]) => {
      const px = Math.min(w - 1, Math.max(0, Math.floor(x * w)));
      const py = Math.min(h - 1, Math.max(0, Math.floor((1 - y) * h)));
      gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return [buf[0], buf[1], buf[2], buf[3]];
    });
  }

  dispose(): void {
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored, false);
    const gl = this.gl;
    if (gl) {
      if (this.texture) gl.deleteTexture(this.texture);
      if (this.program) gl.deleteProgram(this.program);
    }
    this.gl = null;
    this.listeners.clear();
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private init(): void {
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = this.canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      }) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) {
      this.patch({ status: 'unsupported', error: 'WebGL is not available in this browser.' });
      return;
    }
    try {
      const program = linkProgram(gl, COLOR_GRADE_VERTEX_SHADER, COLOR_GRADE_FRAGMENT_SHADER);
      gl.useProgram(program);
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, 'a_pos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      this.gl = gl;
      this.program = program;
      this.texture = tex;
      this.loc = {
        a: gl.getUniformLocation(program, 'u_a'),
        b: gl.getUniformLocation(program, 'u_b'),
        intensity: gl.getUniformLocation(program, 'u_intensity'),
        bypass: gl.getUniformLocation(program, 'u_bypass'),
        mirror: gl.getUniformLocation(program, 'u_mirror'),
      };
      gl.uniform1i(gl.getUniformLocation(program, 'u_frame'), 0);
      if (this.state.status !== 'running') this.patch({ status: 'idle', error: null });
    } catch (err) {
      this.gl = null;
      this.patch({ status: 'error', error: err instanceof Error ? err.message : 'Shader setup failed.' });
    }
  }

  /** Draws the latest video frame. Returns false when there is nothing to draw. */
  private renderFrame(): boolean {
    const gl = this.gl;
    const v = this.video;
    if (!gl || !this.loc || !v || v.readyState < 2 || v.videoWidth === 0) return false;
    const t0 = performance.now();

    const scale = Math.min(1, MAX_EDGE / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
    } catch (err) {
      this.patch({ status: 'error', error: err instanceof Error ? err.message : 'Frame upload failed.' });
      return false;
    }
    const p = this.params;
    gl.uniform4f(this.loc.a, p.brightness, p.contrast, p.saturation, p.temperature);
    gl.uniform4f(this.loc.b, p.tint, p.fade, p.vignette, 0);
    gl.uniform1f(this.loc.intensity, this.intensity);
    gl.uniform1f(this.loc.bypass, this.state.bypass ? 1 : 0);
    gl.uniform1f(this.loc.mirror, this.mirror ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const dt = performance.now() - t0;
    const s = this.state.stats;
    const frames = s.framesRendered + 1;
    const stats: PipelineStats = {
      framesRendered: frames,
      avgRenderMs: s.avgRenderMs === 0 ? dt : s.avgRenderMs * 0.95 + dt * 0.05,
      width: w,
      height: h,
    };
    this.state = { ...this.state, stats };
    // Stats listeners are throttled; the frame path itself never triggers React renders.
    const now = performance.now();
    if (now - this.lastNotify > 1000 || frames === 1) {
      this.lastNotify = now;
      this.emit();
    }
    return true;
  }

  private renderIfIdle(): void {
    // While running, the next video frame picks up the change; when paused, redraw now so
    // adjustments are visible on a still frame too.
    if (!this.running) this.renderFrame();
  }

  private scheduleFrame(): void {
    const v = this.video;
    if (!this.running || !v || this.frameHandle !== null) return;
    if (typeof v.requestVideoFrameCallback === 'function') {
      this.frameKind = 'rvfc';
      this.frameHandle = v.requestVideoFrameCallback(this.onFrame);
    } else {
      this.frameKind = 'raf';
      this.frameHandle = requestAnimationFrame(this.onFrame);
    }
  }

  private cancelFrame(): void {
    if (this.frameHandle === null) return;
    if (this.frameKind === 'rvfc') this.video?.cancelVideoFrameCallback?.(this.frameHandle);
    else cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
    this.frameKind = null;
  }

  private onFrame = (): void => {
    this.frameHandle = null;
    if (!this.running) return;
    this.renderFrame();
    this.scheduleFrame();
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.cancelFrame();
    this.gl = null;
    this.patch({ status: 'context-lost', error: 'The graphics context was lost. Restoring…' });
  };

  private onContextRestored = (): void => {
    this.init();
    if (this.running) {
      this.patch({ status: 'running', error: null });
      this.scheduleFrame();
    }
  };

  private patch(p: Partial<PipelineState>): void {
    this.state = { ...this.state, ...p };
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('Could not create shader.');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? 'unknown error';
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return sh;
}

function linkProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create program.');
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(program) ?? 'unknown error'}`);
  }
  return program;
}
