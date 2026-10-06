/**
 * Privity LIVE — camera filter data model.
 *
 * A filter is a set of colour-grade parameters applied per pixel on the GPU (see
 * FilterPipeline.ts). `intensity` blends original → graded output: 0 = untouched camera,
 * 1 = full effect. The same maths is mirrored in colorMath.ts so it can be unit-tested.
 *
 * Versioned so new parameters (or new effect kinds) can be added without breaking saved presets.
 */

export const FILTER_SCHEMA_VERSION = 1 as const;

export interface FilterParams {
  /** -1..1 additive exposure shift. */
  brightness: number;
  /** -1..1 contrast around mid-grey (0 = unchanged). */
  contrast: number;
  /** -1..1 (-1 = black & white, 0 = unchanged, 1 = double saturation). */
  saturation: number;
  /** -1..1 cool (blue) ↔ warm (amber). */
  temperature: number;
  /** -1..1 green ↔ magenta. */
  tint: number;
  /** 0..1 lifted blacks / matte look. */
  fade: number;
  /** 0..1 edge darkening. */
  vignette: number;
}

export type FilterParamKey = keyof FilterParams;

export interface FilterParamSpec {
  key: FilterParamKey;
  label: string;
  min: number;
  max: number;
}

/** UI + validation ranges. Order is the order sliders are shown in the editor. */
export const FILTER_PARAM_SPECS: ReadonlyArray<FilterParamSpec> = [
  { key: 'brightness', label: 'Brightness', min: -1, max: 1 },
  { key: 'contrast', label: 'Contrast', min: -1, max: 1 },
  { key: 'saturation', label: 'Saturation', min: -1, max: 1 },
  { key: 'temperature', label: 'Temperature', min: -1, max: 1 },
  { key: 'tint', label: 'Tint', min: -1, max: 1 },
  { key: 'fade', label: 'Fade', min: 0, max: 1 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 1 },
];

export const IDENTITY_PARAMS: Readonly<FilterParams> = Object.freeze({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  fade: 0,
  vignette: 0,
});

export type FilterPresetKind = 'builtin' | 'custom';

export interface FilterPreset {
  id: string;
  name: string;
  kind: FilterPresetKind;
  params: FilterParams;
  /** Default blend strength 0..1. */
  intensity: number;
  version: typeof FILTER_SCHEMA_VERSION;
  createdAt?: number;
  updatedAt?: number;
}

/** What is currently applied to the camera. */
export interface FilterSelection {
  presetId: string;
  intensity: number;
}

export const PRESET_NAME_MAX = 32;
export const CUSTOM_PRESET_LIMIT = 24;

export function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return 0 >= min && 0 <= max ? 0 : min;
  return Math.min(max, Math.max(min, v));
}

export function clampParams(p: Partial<Record<FilterParamKey, unknown>> | null | undefined): FilterParams {
  const out = { ...IDENTITY_PARAMS } as FilterParams;
  for (const spec of FILTER_PARAM_SPECS) {
    const raw = p?.[spec.key];
    out[spec.key] = typeof raw === 'number' ? clamp(raw, spec.min, spec.max) : 0;
  }
  return out;
}

export function clampIntensity(v: unknown): number {
  return typeof v === 'number' ? clamp(v, 0, 1) : 1;
}

export function isIdentity(p: FilterParams): boolean {
  return FILTER_PARAM_SPECS.every((s) => Math.abs(p[s.key]) < 1e-6);
}

/** Trims, collapses whitespace and strips control characters. Returns '' when unusable. */
export function sanitizePresetName(name: unknown): string {
  if (typeof name !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, PRESET_NAME_MAX);
}
