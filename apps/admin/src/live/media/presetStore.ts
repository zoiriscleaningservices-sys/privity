/**
 * Persistence for personal filter presets.
 *
 * The interface is async so a server-backed implementation can replace the device store
 * without touching UI code. Today there is no `filter_presets` table in the LIVE schema, so
 * presets live on the device, namespaced per signed-in user. Only look parameters are
 * stored — never images, frames or device identifiers.
 */

import {
  CUSTOM_PRESET_LIMIT,
  FILTER_SCHEMA_VERSION,
  FilterPreset,
  FilterSelection,
  clampIntensity,
  clampParams,
  sanitizePresetName,
} from './filterTypes';

export interface FilterLibrary {
  presets: FilterPreset[];
  /** The look that was active the last time this user streamed. */
  selection: FilterSelection | null;
}

export interface FilterPresetStore {
  load(): Promise<FilterLibrary>;
  save(library: FilterLibrary): Promise<void>;
}

interface StoredBlob {
  version: number;
  presets: unknown[];
  selection?: unknown;
}

export function storageKeyFor(userId: string): string {
  return `privity.live.filters.v1:${userId}`;
}

function parsePreset(raw: unknown): FilterPreset | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id.startsWith('custom:') || r.id.length > 80) return null;
  const name = sanitizePresetName(r.name);
  if (!name) return null;
  return {
    id: r.id,
    name,
    kind: 'custom',
    params: clampParams((r.params as Record<string, unknown>) ?? null),
    intensity: clampIntensity(r.intensity),
    version: FILTER_SCHEMA_VERSION,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : undefined,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : undefined,
  };
}

function parseSelection(raw: unknown): FilterSelection | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.presetId !== 'string' || r.presetId.length > 80) return null;
  return { presetId: r.presetId, intensity: clampIntensity(r.intensity) };
}

/** Validates untrusted stored JSON. Corrupt entries are dropped, never thrown. */
export function parseLibrary(json: string | null): FilterLibrary {
  if (!json) return { presets: [], selection: null };
  try {
    const blob = JSON.parse(json) as StoredBlob;
    if (!blob || blob.version !== 1 || !Array.isArray(blob.presets)) return { presets: [], selection: null };
    const seen = new Set<string>();
    const presets: FilterPreset[] = [];
    for (const raw of blob.presets) {
      const p = parsePreset(raw);
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        presets.push(p);
      }
      if (presets.length >= CUSTOM_PRESET_LIMIT) break;
    }
    return { presets, selection: parseSelection(blob.selection) };
  } catch {
    return { presets: [], selection: null };
  }
}

export function serializeLibrary(lib: FilterLibrary): string {
  const blob: StoredBlob = {
    version: 1,
    presets: lib.presets
      .filter((p) => p.kind === 'custom')
      .slice(0, CUSTOM_PRESET_LIMIT)
      .map((p) => ({
        id: p.id,
        name: p.name,
        params: p.params,
        intensity: p.intensity,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    selection: lib.selection,
  };
  return JSON.stringify(blob);
}

type KV = Pick<Storage, 'getItem' | 'setItem'>;

export class DeviceFilterPresetStore implements FilterPresetStore {
  private readonly key: string;

  constructor(
    userId: string,
    private readonly storage: KV | null = typeof localStorage !== 'undefined' ? localStorage : null,
  ) {
    this.key = storageKeyFor(userId);
  }

  async load(): Promise<FilterLibrary> {
    try {
      return parseLibrary(this.storage?.getItem(this.key) ?? null);
    } catch {
      return { presets: [], selection: null };
    }
  }

  async save(library: FilterLibrary): Promise<void> {
    if (!this.storage) throw new Error('STORAGE_UNAVAILABLE');
    this.storage.setItem(this.key, serializeLibrary(library));
  }
}
