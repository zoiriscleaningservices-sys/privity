/**
 * React bindings for local media and the personal filter library.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FilterParams, FilterPreset, FilterSelection, clampIntensity } from './filterTypes';
import {
  BUILTIN_PRESETS,
  NO_FILTER_ID,
  PresetOpResult,
  createCustomPreset,
  deleteCustomPreset,
  duplicatePreset,
  findPreset,
  updateCustomPreset,
} from './filterPresets';
import { FilterPresetStore } from './presetStore';
import { LocalMediaController, LocalMediaState } from './LocalMediaController';

export function useLocalMedia(controller: LocalMediaController): LocalMediaState {
  return useSyncExternalStore(
    (fn) => controller.subscribe(fn),
    () => controller.getState(),
  );
}

export interface FilterLibraryApi {
  ready: boolean;
  custom: FilterPreset[];
  all: FilterPreset[];
  selection: FilterSelection;
  active: FilterPreset;
  saveError: string | null;
  select(id: string): void;
  setIntensity(v: number): void;
  create(input: { name: string; params: FilterParams; intensity: number }): PresetOpResult;
  update(id: string, patch: { name?: string; params?: FilterParams; intensity?: number }): PresetOpResult;
  duplicate(preset: FilterPreset): PresetOpResult;
  remove(id: string): void;
}

const DEFAULT_SELECTION: FilterSelection = { presetId: NO_FILTER_ID, intensity: 1 };

export function useFilterLibrary(store: FilterPresetStore): FilterLibraryApi {
  const [ready, setReady] = useState(false);
  const [custom, setCustom] = useState<FilterPreset[]>([]);
  const [selection, setSelection] = useState<FilterSelection>(DEFAULT_SELECTION);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ custom, selection });
  latest.current = { custom, selection };

  useEffect(() => {
    let alive = true;
    setReady(false);
    void store.load().then((lib) => {
      if (!alive) return;
      setCustom(lib.presets);
      const sel = lib.selection && findPreset(lib.selection.presetId, lib.presets) ? lib.selection : DEFAULT_SELECTION;
      setSelection(sel);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  const persist = useCallback(
    (nextCustom: FilterPreset[], nextSel: FilterSelection, debounceMs = 0) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const run = () => {
        store
          .save({ presets: nextCustom, selection: nextSel })
          .then(() => setSaveError(null))
          .catch(() => setSaveError('Your looks could not be saved on this device (storage is full or blocked).'));
      };
      if (debounceMs > 0) saveTimer.current = setTimeout(run, debounceMs);
      else run();
    },
    [store],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const select = useCallback(
    (id: string) => {
      const p = findPreset(id, latest.current.custom);
      if (!p) return;
      const next = { presetId: id, intensity: p.intensity };
      setSelection(next);
      persist(latest.current.custom, next);
    },
    [persist],
  );

  const setIntensity = useCallback(
    (v: number) => {
      const next = { ...latest.current.selection, intensity: clampIntensity(v) };
      setSelection(next);
      persist(latest.current.custom, next, 400);
    },
    [persist],
  );

  const apply = useCallback(
    (res: PresetOpResult, selectIt: boolean): PresetOpResult => {
      if (!res.ok) return res;
      setCustom(res.presets);
      const sel = selectIt ? { presetId: res.preset.id, intensity: res.preset.intensity } : latest.current.selection;
      setSelection(sel);
      persist(res.presets, sel);
      return res;
    },
    [persist],
  );

  const create = useCallback(
    (input: { name: string; params: FilterParams; intensity: number }) =>
      apply(createCustomPreset(latest.current.custom, input), true),
    [apply],
  );

  const update = useCallback(
    (id: string, patch: { name?: string; params?: FilterParams; intensity?: number }) => {
      const res = updateCustomPreset(latest.current.custom, id, patch);
      return apply(res, latest.current.selection.presetId === id);
    },
    [apply],
  );

  const duplicate = useCallback(
    (preset: FilterPreset) => apply(duplicatePreset(latest.current.custom, preset), true),
    [apply],
  );

  const remove = useCallback(
    (id: string) => {
      const next = deleteCustomPreset(latest.current.custom, id);
      const sel = latest.current.selection.presetId === id ? DEFAULT_SELECTION : latest.current.selection;
      setCustom(next);
      setSelection(sel);
      persist(next, sel);
    },
    [persist],
  );

  const all = [...BUILTIN_PRESETS, ...custom];
  const active = findPreset(selection.presetId, custom) ?? BUILTIN_PRESETS[0];

  return { ready, custom, all, selection, active, saveError, select, setIntensity, create, update, duplicate, remove };
}
