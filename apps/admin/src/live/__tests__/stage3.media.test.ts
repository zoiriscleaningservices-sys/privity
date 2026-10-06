import { describe, expect, it } from 'vitest';
import { gradePixel, gradePixel255, RGB } from '../media/colorGrade';
import { IDENTITY_PARAMS, clampParams, sanitizePresetName, CUSTOM_PRESET_LIMIT, FilterParams } from '../media/filterTypes';
import {
  BUILTIN_PRESETS,
  NO_FILTER_ID,
  createCustomPreset,
  deleteCustomPreset,
  duplicatePreset,
  findPreset,
  updateCustomPreset,
} from '../media/filterPresets';
import { DeviceFilterPresetStore, parseLibrary, serializeLibrary, storageKeyFor } from '../media/presetStore';
import { classifyMediaError } from '../media/LocalMediaController';
import { availableEffects, EFFECT_REGISTRY } from '../media/effectRegistry';

const SKIN: RGB = [217 / 255, 161 / 255, 132 / 255];
const GREY: RGB = [0.5, 0.5, 0.5];
const preset = (id: string) => BUILTIN_PRESETS.find((p) => p.id === id)!;

describe('colour grade maths (mirror of the GPU shader)', () => {
  it('identity params and zero intensity leave pixels untouched', () => {
    expect(gradePixel(SKIN, IDENTITY_PARAMS, 1)).toEqual(SKIN);
    expect(gradePixel(SKIN, preset('builtin:cinematic').params, 0)).toEqual(SKIN);
  });

  it('warm raises red and lowers blue on neutral grey; cool does the opposite', () => {
    const warm = gradePixel(GREY, preset('builtin:warm').params, 1);
    const cool = gradePixel(GREY, preset('builtin:cool').params, 1);
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(cool[2]).toBeGreaterThan(cool[0]);
  });

  it('black & white produces equal channels', () => {
    const [r, g, b] = gradePixel(SKIN, preset('builtin:mono').params, 1);
    expect(Math.abs(r - g)).toBeLessThan(1e-9);
    expect(Math.abs(g - b)).toBeLessThan(1e-9);
  });

  it('intensity scales the effect linearly between original and graded', () => {
    const p = preset('builtin:mono').params;
    const full = gradePixel(SKIN, p, 1);
    const half = gradePixel(SKIN, p, 0.5);
    for (let i = 0; i < 3; i += 1) expect(half[i]).toBeCloseTo((SKIN[i] + full[i]) / 2, 9);
  });

  it('vignette darkens corners but not the centre', () => {
    const p: FilterParams = { ...IDENTITY_PARAMS, vignette: 1 };
    expect(gradePixel(GREY, p, 1, [0.5, 0.5])).toEqual(GREY);
    expect(gradePixel(GREY, p, 1, [0, 0])[0]).toBeLessThan(0.2);
  });

  it('brightness/contrast/saturation move values in the expected direction and clamp to range', () => {
    const bright = gradePixel(GREY, { ...IDENTITY_PARAMS, brightness: 1 }, 1);
    expect(bright[0]).toBeCloseTo(0.75, 6);
    const contrast = gradePixel([0.7, 0.7, 0.7], { ...IDENTITY_PARAMS, contrast: 1 }, 1);
    expect(contrast[0]).toBeCloseTo(0.9, 6);
    const extreme = gradePixel([1, 1, 1], { ...IDENTITY_PARAMS, brightness: 1, contrast: 1 }, 1);
    expect(extreme.every((v) => v <= 1 && v >= 0)).toBe(true);
    const sat = gradePixel(SKIN, { ...IDENTITY_PARAMS, saturation: 1 }, 1);
    expect(sat[0] - sat[2]).toBeGreaterThan(SKIN[0] - SKIN[2]);
  });

  it('255 helper rounds to integer channels', () => {
    expect(gradePixel255([128, 128, 128], IDENTITY_PARAMS, 1)).toEqual([128, 128, 128]);
  });

  it('every built-in except Original visibly changes a skin-tone pixel', () => {
    for (const p of BUILTIN_PRESETS) {
      const out = gradePixel255([217, 161, 132], p.params, p.intensity);
      const delta = Math.abs(out[0] - 217) + Math.abs(out[1] - 161) + Math.abs(out[2] - 132);
      if (p.id === NO_FILTER_ID) expect(delta).toBe(0);
      else expect(delta).toBeGreaterThan(6);
    }
  });
});

describe('filter params + presets', () => {
  it('clamps out-of-range and non-numeric params', () => {
    const p = clampParams({ brightness: 5, contrast: -9, saturation: 'x', fade: -1, vignette: 2 } as never);
    expect(p).toMatchObject({ brightness: 1, contrast: -1, saturation: 0, fade: 0, vignette: 1 });
  });

  it('sanitizes names', () => {
    expect(sanitizePresetName('  My\u0000  look\n ')).toBe('My look');
    expect(sanitizePresetName('x'.repeat(80)).length).toBe(32);
    expect(sanitizePresetName('   ')).toBe('');
  });

  it('create → rename/edit → duplicate → delete', () => {
    const c = createCustomPreset([], { name: 'Golden hour', params: { ...IDENTITY_PARAMS, temperature: 0.4 }, intensity: 0.8 }, 1);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.preset.kind).toBe('custom');
    expect(c.preset.params.temperature).toBe(0.4);

    const u = updateCustomPreset(c.presets, c.preset.id, { name: 'Sunset', params: { ...c.preset.params, contrast: 0.2 } }, 2);
    expect(u.ok && u.preset.name).toBe('Sunset');
    if (!u.ok) return;
    expect(u.preset.params.contrast).toBe(0.2);
    expect(u.preset.updatedAt).toBe(2);

    const d = duplicatePreset(u.presets, u.preset, 3);
    expect(d.ok && d.preset.name).toBe('Sunset copy');
    if (!d.ok) return;
    expect(d.preset.id).not.toBe(u.preset.id);
    expect(d.preset.params).toEqual(u.preset.params);
    const d2 = duplicatePreset(d.presets, u.preset, 4);
    expect(d2.ok && d2.preset.name).toBe('Sunset copy 2');

    const left = deleteCustomPreset(d.presets, u.preset.id);
    expect(left.map((p) => p.id)).toEqual([d.preset.id]);
  });

  it('rejects empty names, built-in edits and over-limit creation', () => {
    expect(createCustomPreset([], { name: ' ', params: IDENTITY_PARAMS, intensity: 1 })).toEqual({ ok: false, error: 'NAME_REQUIRED' });
    expect(updateCustomPreset([...BUILTIN_PRESETS], NO_FILTER_ID, { name: 'x' })).toEqual({ ok: false, error: 'NOT_EDITABLE' });
    let list = [] as ReturnType<typeof deleteCustomPreset>;
    for (let i = 0; i < CUSTOM_PRESET_LIMIT; i += 1) {
      const r = createCustomPreset(list, { name: `L${i}`, params: IDENTITY_PARAMS, intensity: 1 });
      if (r.ok) list = r.presets;
    }
    expect(createCustomPreset(list, { name: 'one more', params: IDENTITY_PARAMS, intensity: 1 })).toEqual({ ok: false, error: 'LIMIT_REACHED' });
  });

  it('built-ins can be duplicated into an editable custom look', () => {
    const d = duplicatePreset([], preset('builtin:cinematic'));
    expect(d.ok && d.preset.kind).toBe('custom');
    expect(findPreset(NO_FILTER_ID, [])?.name).toBe('Original');
  });
});

describe('preset persistence', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };

  it('round-trips presets and the last selection per user', async () => {
    const kv = memory();
    const c = createCustomPreset([], { name: 'Mine', params: { ...IDENTITY_PARAMS, tint: -0.3 }, intensity: 0.6 });
    if (!c.ok) throw new Error('create failed');
    const store = new DeviceFilterPresetStore('user-1', kv);
    await store.save({ presets: c.presets, selection: { presetId: c.preset.id, intensity: 0.6 } });

    const reopened = await new DeviceFilterPresetStore('user-1', kv).load();
    expect(reopened.presets).toHaveLength(1);
    expect(reopened.presets[0]).toMatchObject({ name: 'Mine', intensity: 0.6, params: { tint: -0.3 } });
    expect(reopened.selection).toEqual({ presetId: c.preset.id, intensity: 0.6 });

    expect((await new DeviceFilterPresetStore('user-2', kv).load()).presets).toHaveLength(0);
    expect([...kv.m.keys()]).toEqual([storageKeyFor('user-1')]);
  });

  it('drops corrupt or hostile entries instead of throwing', () => {
    expect(parseLibrary('not json').presets).toEqual([]);
    expect(parseLibrary(JSON.stringify({ version: 2, presets: [] })).presets).toEqual([]);
    const lib = parseLibrary(
      JSON.stringify({
        version: 1,
        presets: [
          { id: 'builtin:warm', name: 'spoof', params: {} },
          { id: 'custom:a', name: '', params: {} },
          { id: 'custom:b', name: 'ok', params: { brightness: 99 }, intensity: 7 },
          { id: 'custom:b', name: 'dupe', params: {} },
        ],
      }),
    );
    expect(lib.presets).toHaveLength(1);
    expect(lib.presets[0]).toMatchObject({ id: 'custom:b', intensity: 1, params: { brightness: 1 } });
  });

  it('serializes only custom look data', () => {
    const json = serializeLibrary({ presets: [...BUILTIN_PRESETS], selection: null });
    expect(JSON.parse(json).presets).toEqual([]);
  });
});

describe('media permission classification', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'unavailable'],
    ['OverconstrainedError', 'unavailable'],
    ['NotReadableError', 'in-use'],
    ['InsecureContext', 'insecure'],
    ['WeirdError', 'error'],
  ])('%s → %s', (name, status) => {
    const c = classifyMediaError({ name }, 'camera');
    expect(c.status).toBe(status);
    expect(c.message.length).toBeGreaterThan(10);
  });
});

describe('effect registry', () => {
  it('only the colour grade is marked available; advanced effects are extension points', () => {
    expect(availableEffects().map((e) => e.kind)).toEqual(['color-grade']);
    expect(EFFECT_REGISTRY.filter((e) => e.status === 'planned').length).toBeGreaterThan(3);
  });
});
