/**
 * Video effect extension points.
 *
 * Today the only shipped effect kind is `color-grade` (FilterPipeline + colorGrade.ts).
 * Advanced effects need capabilities this build does not have yet (face landmarks,
 * person segmentation models, possibly WebGPU). They are declared here so future work plugs
 * into one place — they are NOT exposed in the UI until they genuinely work.
 *
 * To add a multi-pass effect: implement `VideoEffectStage`, then have FilterPipeline render
 * camera → stage FBOs → colour grade → canvas. The publishing contract (canvas.captureStream)
 * does not change, so Stage 4 publishing code is unaffected.
 */

export type EffectKind = 'color-grade' | 'background-blur' | 'background-replace' | 'face-effect' | 'beauty' | 'ar' | 'animated';

export type EffectCapability = 'webgl' | 'face-landmarks' | 'person-segmentation' | 'webgpu';

export interface VideoEffectDescriptor {
  kind: EffectKind;
  requires: EffectCapability[];
  /** 'available' = implemented and shippable; 'planned' = extension point only. */
  status: 'available' | 'planned';
  notes: string;
}

export const EFFECT_REGISTRY: ReadonlyArray<VideoEffectDescriptor> = [
  { kind: 'color-grade', requires: ['webgl'], status: 'available', notes: 'Per-pixel colour grade shader.' },
  { kind: 'background-blur', requires: ['webgl', 'person-segmentation'], status: 'planned', notes: 'Needs a segmentation model (e.g. MediaPipe Selfie Segmentation).' },
  { kind: 'background-replace', requires: ['webgl', 'person-segmentation'], status: 'planned', notes: 'Same mask as blur + image texture.' },
  { kind: 'face-effect', requires: ['webgl', 'face-landmarks'], status: 'planned', notes: 'Needs a face landmark model running per frame.' },
  { kind: 'beauty', requires: ['webgl', 'face-landmarks'], status: 'planned', notes: 'Skin smoothing restricted to face mask.' },
  { kind: 'ar', requires: ['webgl', 'face-landmarks'], status: 'planned', notes: 'Anchored 2D/3D assets.' },
  { kind: 'animated', requires: ['webgl'], status: 'planned', notes: 'Time-based overlays composited in-pipeline.' },
];

/** A GPU pass inserted between camera upload and the colour grade. */
export interface VideoEffectStage {
  readonly kind: EffectKind;
  init(gl: WebGLRenderingContext): void;
  /** Reads `input` texture and renders into the currently bound framebuffer. */
  render(gl: WebGLRenderingContext, input: WebGLTexture, frame: { width: number; height: number; timeMs: number }): void;
  dispose(gl: WebGLRenderingContext): void;
}

export function availableEffects(): VideoEffectDescriptor[] {
  return EFFECT_REGISTRY.filter((e) => e.status === 'available');
}
