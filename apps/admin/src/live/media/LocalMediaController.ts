/**
 * LocalMediaController — the host's / guest's OWN camera and microphone.
 *
 * Owns getUserMedia, permission states, camera on/off, mic mute, front/back flip and the
 * optional second camera for Dual mode. It only ever controls devices on THIS device.
 * Nothing here can (or pretends to) control another participant's hardware.
 *
 * Camera OFF stops the video track (the hardware is released and the camera light turns off).
 * Mic MUTE disables the audio track (no audio is sent; the permission is kept so unmuting is
 * instant).
 */

import { PatternVariant, TestPatternSource, createSilentAudioTrack } from './TestPatternSource';

export type MediaSourceKind = 'camera' | 'test-pattern';
export type Facing = 'user' | 'environment';
export type DeviceStatus = 'off' | 'requesting' | 'live' | 'denied' | 'unavailable' | 'in-use' | 'insecure' | 'error';

export interface DeviceState {
  status: DeviceStatus;
  /** User intent: wants this device on. */
  enabled: boolean;
  message: string | null;
  label: string | null;
}

export interface CameraState extends DeviceState {
  facing: Facing;
  canFlip: boolean;
  flipping: boolean;
}

export type DualStatus = 'off' | 'starting' | 'on' | 'unsupported' | 'error';

export interface LocalMediaState {
  source: MediaSourceKind;
  camera: CameraState;
  mic: DeviceState;
  /** Video-only stream feeding the preview / FilterPipeline. */
  videoStream: MediaStream | null;
  audioTrack: MediaStreamTrack | null;
  dual: { status: DualStatus; stream: MediaStream | null; message: string | null };
}

export interface ClassifiedMediaError {
  status: Exclude<DeviceStatus, 'off' | 'requesting' | 'live'>;
  message: string;
}

/** Maps getUserMedia failures to an honest, actionable state. */
export function classifyMediaError(err: unknown, kind: 'camera' | 'microphone'): ClassifiedMediaError {
  const name = (err as { name?: string } | null)?.name ?? '';
  const Device = kind === 'camera' ? 'Camera' : 'Microphone';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return {
        status: 'denied',
        message: `${Device} access is blocked. Allow it in your browser's site settings, then try again.`,
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return { status: 'unavailable', message: `No ${kind} was found on this device.` };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return {
        status: 'in-use',
        message: `Your ${kind} is busy in another app or tab. Close it there, then try again.`,
      };
    case 'InsecureContext':
      return { status: 'insecure', message: `${Device} access needs a secure (HTTPS) connection.` };
    default:
      return {
        status: 'error',
        message: `${Device} could not start${err instanceof Error && err.message ? `: ${err.message}` : '.'}`,
      };
  }
}

const insecureError = () => Object.assign(new Error('insecure'), { name: 'InsecureContext' });

function initialState(source: MediaSourceKind): LocalMediaState {
  return {
    source,
    camera: { status: 'off', enabled: false, message: null, label: null, facing: 'user', canFlip: false, flipping: false },
    mic: { status: 'off', enabled: false, message: null, label: null },
    videoStream: null,
    audioTrack: null,
    dual: { status: 'off', stream: null, message: null },
  };
}

export interface LocalMediaDeps {
  mediaDevices?: MediaDevices | null;
  createPattern?: (variant: PatternVariant) => TestPatternSource;
}

export class LocalMediaController {
  private state: LocalMediaState;
  private readonly listeners = new Set<() => void>();
  private readonly media: MediaDevices | null;
  private readonly createPattern: (variant: PatternVariant) => TestPatternSource;
  private pattern: TestPatternSource | null = null;
  private dualPattern: TestPatternSource | null = null;
  private patternAudio: { track: MediaStreamTrack; close: () => void } | null = null;
  private disposed = false;
  private epoch = 0;

  constructor(source: MediaSourceKind = 'camera', deps: LocalMediaDeps = {}) {
    this.state = initialState(source);
    this.media =
      deps.mediaDevices !== undefined
        ? deps.mediaDevices
        : typeof navigator !== 'undefined' && navigator.mediaDevices
          ? navigator.mediaDevices
          : null;
    this.createPattern = deps.createPattern ?? ((v) => new TestPatternSource(v));
  }

  getState(): LocalMediaState {
    return this.state;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Switches between the real camera and the labelled test pattern (LIVE Lab). */
  async setSource(source: MediaSourceKind): Promise<void> {
    if (source === this.state.source) return;
    const wantCam = this.state.camera.enabled;
    const wantMic = this.state.mic.enabled;
    this.releaseAll();
    this.state = initialState(source);
    this.emit();
    await this.start({ video: wantCam, audio: wantMic });
  }

  async start(opts: { video: boolean; audio: boolean }): Promise<void> {
    const jobs: Promise<void>[] = [];
    if (opts.video) jobs.push(this.setCameraEnabled(true));
    if (opts.audio) jobs.push(this.setMicEnabled(true));
    await Promise.all(jobs);
  }

  async setCameraEnabled(on: boolean): Promise<void> {
    if (!on) {
      this.stopVideo();
      this.patchCamera({ enabled: false, status: 'off', message: null });
      void this.stopDual();
      return;
    }
    this.patchCamera({ enabled: true });
    await this.acquireVideo(this.state.camera.facing);
  }

  async setMicEnabled(on: boolean): Promise<void> {
    const track = this.state.audioTrack;
    if (track && track.readyState === 'live') {
      track.enabled = on;
      this.patchMic({ enabled: on, status: 'live', message: null });
      return;
    }
    if (!on) {
      this.patchMic({ enabled: false, status: 'off', message: null });
      return;
    }
    this.patchMic({ enabled: true });
    await this.acquireAudio();
  }

  async flip(): Promise<void> {
    const cam = this.state.camera;
    if (!cam.canFlip || cam.flipping || cam.status !== 'live') return;
    const next: Facing = cam.facing === 'user' ? 'environment' : 'user';
    if (this.state.source === 'test-pattern') {
      this.pattern?.setVariant(next === 'user' ? 'front' : 'back');
      this.patchCamera({ facing: next });
      return;
    }
    this.patchCamera({ flipping: true });
    const prev = cam.facing;
    this.stopVideo();
    const ok = await this.acquireVideo(next, true);
    if (!ok) {
      await this.acquireVideo(prev);
      this.patchCamera({ message: 'Could not switch cameras on this device.' });
    }
    this.patchCamera({ flipping: false });
  }

  /** Dual mode: opens the second (opposite) camera at the same time, where the device allows it. */
  async startDual(): Promise<void> {
    if (this.state.dual.status === 'on' || this.state.dual.status === 'starting') return;
    if (this.state.camera.status !== 'live') {
      this.patchDual({ status: 'error', message: 'Turn your camera on to use Dual.' });
      return;
    }
    this.patchDual({ status: 'starting', message: null });
    if (this.state.source === 'test-pattern') {
      const p = this.createPattern('back');
      this.dualPattern = p;
      const s = new MediaStream(p.start().getVideoTracks());
      this.patchDual({ status: 'on', stream: s, message: null });
      return;
    }
    const media = this.media;
    try {
      if (!media?.enumerateDevices) throw new Error('enumerate');
      const devices = (await media.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      const currentId = this.state.videoStream?.getVideoTracks()[0]?.getSettings().deviceId;
      const other = devices.find((d) => d.deviceId && d.deviceId !== currentId);
      if (!other) {
        this.patchDual({ status: 'unsupported', message: 'Dual needs a second camera. Only one camera was found on this device.' });
        return;
      }
      const s = await media.getUserMedia({ video: { deviceId: { exact: other.deviceId } }, audio: false });
      if (this.disposed) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      this.patchDual({ status: 'on', stream: s, message: null });
    } catch (err) {
      const c = classifyMediaError(err, 'camera');
      const unsupported = c.status === 'in-use' || c.status === 'unavailable';
      this.patchDual({
        status: unsupported ? 'unsupported' : 'error',
        stream: null,
        message: unsupported
          ? 'This device cannot run both cameras at the same time.'
          : c.message,
      });
    }
  }

  async stopDual(): Promise<void> {
    this.state.dual.stream?.getTracks().forEach((t) => t.stop());
    this.dualPattern?.stop();
    this.dualPattern = null;
    if (this.state.dual.status !== 'off') this.patchDual({ status: 'off', stream: null, message: null });
  }

  /** Clears a dual-mode error/unsupported notice. */
  dismissDualNotice(): void {
    if (this.state.dual.status === 'unsupported' || this.state.dual.status === 'error') {
      this.patchDual({ status: 'off', message: null });
    }
  }

  dispose(): void {
    this.disposed = true;
    this.releaseAll();
    this.listeners.clear();
  }

  // ---------------------------------------------------------------------------

  private async acquireVideo(facing: Facing, strictFacing = false): Promise<boolean> {
    const epoch = ++this.epoch;
    this.patchCamera({ status: 'requesting', message: null });
    try {
      let stream: MediaStream;
      let label: string;
      if (this.state.source === 'test-pattern') {
        if (!this.pattern) this.pattern = this.createPattern(facing === 'user' ? 'front' : 'back');
        stream = new MediaStream(this.pattern.start().getVideoTracks());
        label = 'Test pattern';
      } else {
        if (typeof window !== 'undefined' && window.isSecureContext === false) throw insecureError();
        if (!this.media?.getUserMedia) throw Object.assign(new Error('no mediaDevices'), { name: 'NotFoundError' });
        stream = await this.media.getUserMedia({
          video: {
            facingMode: strictFacing ? { exact: facing } : { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        label = stream.getVideoTracks()[0]?.label || 'Camera';
      }
      if (this.disposed || epoch !== this.epoch || !this.state.camera.enabled) {
        if (this.state.source !== 'test-pattern') stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      const track = stream.getVideoTracks()[0];
      track?.addEventListener('ended', () => {
        if (this.state.videoStream === stream) {
          this.state = { ...this.state, videoStream: null };
          this.patchCamera({ status: 'unavailable', message: 'Your camera disconnected. Reconnect it, then turn the camera back on.' });
        }
      });
      this.state = { ...this.state, videoStream: stream };
      const canFlip = await this.detectCanFlip();
      this.patchCamera({ status: 'live', facing, label, canFlip, message: null });
      return true;
    } catch (err) {
      if (epoch !== this.epoch) return false;
      if (strictFacing) return false;
      const c = classifyMediaError(err, 'camera');
      this.state = { ...this.state, videoStream: null };
      this.patchCamera({ status: c.status, message: c.message });
      return false;
    }
  }

  private async acquireAudio(): Promise<void> {
    this.patchMic({ status: 'requesting', message: null });
    try {
      let track: MediaStreamTrack | undefined;
      let label: string;
      if (this.state.source === 'test-pattern') {
        this.patternAudio?.close();
        this.patternAudio = createSilentAudioTrack();
        track = this.patternAudio?.track;
        label = 'Test tone (silent)';
        if (!track) throw Object.assign(new Error('no audio'), { name: 'NotFoundError' });
      } else {
        if (typeof window !== 'undefined' && window.isSecureContext === false) throw insecureError();
        if (!this.media?.getUserMedia) throw Object.assign(new Error('no mediaDevices'), { name: 'NotFoundError' });
        const s = await this.media.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        track = s.getAudioTracks()[0];
        label = track?.label || 'Microphone';
      }
      if (!track) throw Object.assign(new Error('no audio'), { name: 'NotFoundError' });
      if (this.disposed) {
        track.stop();
        return;
      }
      track.enabled = this.state.mic.enabled;
      track.addEventListener('ended', () => {
        if (this.state.audioTrack === track) {
          this.state = { ...this.state, audioTrack: null };
          this.patchMic({ status: 'unavailable', message: 'Your microphone disconnected.' });
        }
      });
      this.state = { ...this.state, audioTrack: track };
      this.patchMic({ status: 'live', label, message: null });
    } catch (err) {
      const c = classifyMediaError(err, 'microphone');
      this.patchMic({ status: c.status, message: c.message });
    }
  }

  private async detectCanFlip(): Promise<boolean> {
    if (this.state.source === 'test-pattern') return true;
    try {
      const devices = await this.media?.enumerateDevices?.();
      return (devices ?? []).filter((d) => d.kind === 'videoinput').length > 1;
    } catch {
      return false;
    }
  }

  private stopVideo(): void {
    this.epoch += 1;
    const s = this.state.videoStream;
    if (this.state.source === 'test-pattern') {
      this.pattern?.stop();
      this.pattern = null;
    } else {
      s?.getTracks().forEach((t) => t.stop());
    }
    this.state = { ...this.state, videoStream: null };
  }

  private releaseAll(): void {
    this.epoch += 1;
    this.state.videoStream?.getTracks().forEach((t) => t.stop());
    this.state.audioTrack?.stop();
    this.state.dual.stream?.getTracks().forEach((t) => t.stop());
    this.patternAudio?.close();
    this.pattern?.stop();
    this.dualPattern?.stop();
    this.pattern = null;
    this.dualPattern = null;
    this.patternAudio = null;
    this.state = { ...this.state, videoStream: null, audioTrack: null, dual: { status: 'off', stream: null, message: null } };
  }

  private patchCamera(p: Partial<CameraState>): void {
    this.state = { ...this.state, camera: { ...this.state.camera, ...p } };
    this.emit();
  }

  private patchMic(p: Partial<DeviceState>): void {
    this.state = { ...this.state, mic: { ...this.state.mic, ...p } };
    this.emit();
  }

  private patchDual(p: Partial<LocalMediaState['dual']>): void {
    this.state = { ...this.state, dual: { ...this.state.dual, ...p } };
    this.emit();
  }

  private emit(): void {
    if (this.disposed) return;
    for (const fn of this.listeners) fn();
  }
}
