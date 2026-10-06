/**
 * Built-in Privity looks + pure operations on custom presets.
 * Custom-preset operations never mutate their input and always re-validate.
 */

import {
  CUSTOM_PRESET_LIMIT,
  FILTER_SCHEMA_VERSION,
  FilterParams,
  FilterPreset,
  IDENTITY_PARAMS,
  clampIntensity,
  clampParams,
  sanitizePresetName,
} from './filterTypes';

const builtin = (id: string, name: string, params: Partial<FilterParams>, intensity = 1): FilterPreset => ({
  id,
  name,
  kind: 'builtin',
  params: clampParams({ ...IDENTITY_PARAMS, ...params }),
  intensity,
  version: FILTER_SCHEMA_VERSION,
});

export const NO_FILTER_ID = 'builtin:none';

export const BUILTIN_PRESETS: ReadonlyArray<FilterPreset> = [
  builtin(NO_FILTER_ID, 'Original', {}),
  builtin('builtin:warm', 'Warm', { temperature: 0.55, saturation: 0.1, brightness: 0.04, tint: 0.05 }),
  builtin('builtin:cool', 'Cool', { temperature: -0.5, tint: -0.05, contrast: 0.05, saturation: -0.05 }),
  builtin('builtin:cinematic', 'Cinematic', {
    contrast: 0.22,
    saturation: -0.18,
    temperature: 0.12,
    fade: 0.18,
    vignette: 0.45,
    brightness: -0.03,
  }),
  builtin('builtin:mono', 'Black & White', { saturation: -1, contrast: 0.15 }),
  builtin('builtin:vivid', 'Vivid', { saturation: 0.4, contrast: 0.12 }),
  builtin('builtin:matte', 'Matte', { fade: 0.35, contrast: -0.12, brightness: 0.05, saturation: -0.08 }),
];

export function findPreset(id: string, custom: ReadonlyArray<FilterPreset>): FilterPreset | null {
  return BUILTIN_PRESETS.find((p) => p.id === id) ?? custom.find((p) => p.id === id) ?? null;
}

export type PresetOpResult =
  | { ok: true; presets: FilterPreset[]; preset: FilterPreset }
  | { ok: false; error: 'NAME_REQUIRED' | 'LIMIT_REACHED' | 'NOT_FOUND' | 'NOT_EDITABLE' };

function newId(): string {
  const rnd =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `custom:${rnd}`;
}

export function createCustomPreset(
  presets: ReadonlyArray<FilterPreset>,
  input: { name: string; params: FilterParams; intensity: number },
  now = Date.now(),
): PresetOpResult {
  const name = sanitizePresetName(input.name);
  if (!name) return { ok: false, error: 'NAME_REQUIRED' };
  if (presets.length >= CUSTOM_PRESET_LIMIT) return { ok: false, error: 'LIMIT_REACHED' };
  const preset: FilterPreset = {
    id: newId(),
    name,
    kind: 'custom',
    params: clampParams(input.params),
    intensity: clampIntensity(input.intensity),
    version: FILTER_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, presets: [...presets, preset], preset };
}

export function updateCustomPreset(
  presets: ReadonlyArray<FilterPreset>,
  id: string,
  patch: { name?: string; params?: FilterParams; intensity?: number },
  now = Date.now(),
): PresetOpResult {
  const idx = presets.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: 'NOT_FOUND' };
  const current = presets[idx];
  if (current.kind !== 'custom') return { ok: false, error: 'NOT_EDITABLE' };
  let name = current.name;
  if (patch.name !== undefined) {
    name = sanitizePresetName(patch.name);
    if (!name) return { ok: false, error: 'NAME_REQUIRED' };
  }
  const preset: FilterPreset = {
    ...current,
    name,
    params: patch.params ? clampParams(patch.params) : current.params,
    intensity: patch.intensity !== undefined ? clampIntensity(patch.intensity) : current.intensity,
    updatedAt: now,
  };
  const next = presets.slice();
  next[idx] = preset;
  return { ok: true, presets: next, preset };
}

/** Duplicates a custom OR built-in look into a new editable custom preset. */
export function duplicatePreset(
  presets: ReadonlyArray<FilterPreset>,
  source: FilterPreset,
  now = Date.now(),
): PresetOpResult {
  const base = sanitizePresetName(`${source.name} copy`) || 'Custom look';
  let name = base;
  for (let n = 2; presets.some((p) => p.name === name); n += 1) name = sanitizePresetName(`${source.name} copy ${n}`);
  return createCustomPreset(presets, { name, params: source.params, intensity: source.intensity }, now);
}

export function deleteCustomPreset(presets: ReadonlyArray<FilterPreset>, id: string): FilterPreset[] {
  return presets.filter((p) => !(p.id === id && p.kind === 'custom'));
}
