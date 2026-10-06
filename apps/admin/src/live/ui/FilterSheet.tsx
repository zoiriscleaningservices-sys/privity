import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Ellipsis, Pencil, Plus, Trash, Check } from 'lucide-react';
import type { FilterParams, FilterPreset } from '../media/filterTypes';
import { FILTER_PARAM_SPECS, IDENTITY_PARAMS, PRESET_NAME_MAX, CUSTOM_PRESET_LIMIT } from '../media/filterTypes';
import { gradePixel255, RGB } from '../media/colorGrade';
import { NO_FILTER_ID } from '../media/filterPresets';
import type { FilterLibraryApi } from '../media/hooks';
import { ConfirmDialog, Sheet } from './primitives';

/** Reference colours (skin, sky, foliage, neutral) graded with the SAME maths as the shader. */
const SWATCH_REFS: RGB[] = [
  [217, 161, 132],
  [96, 140, 196],
  [92, 150, 96],
  [150, 150, 150],
];

function swatchBackground(params: FilterParams, intensity: number): string {
  const c = SWATCH_REFS.map((rgb) => gradePixel255(rgb, params, intensity));
  const css = c.map(([r, g, b]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`);
  return `linear-gradient(135deg, ${css[0]} 0%, ${css[0]} 38%, ${css[1]} 38%, ${css[1]} 62%, ${css[2]} 62%, ${css[2]} 84%, ${css[3]} 84%)`;
}

const PRESET_ERRORS: Record<string, string> = {
  NAME_REQUIRED: 'Give your look a name.',
  LIMIT_REACHED: `You can keep up to ${CUSTOM_PRESET_LIMIT} custom looks. Delete one to save another.`,
  NOT_FOUND: 'That look no longer exists.',
  NOT_EDITABLE: 'Built-in looks cannot be changed. Duplicate it to make your own version.',
};

export interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  library: FilterLibraryApi;
  /** Hold-to-compare: true while the host is viewing the unprocessed camera. */
  onCompare: (showingOriginal: boolean) => void;
  comparing: boolean;
  /** Draft params pushed to the live pipeline while editing (null = use selection). */
  onDraft: (draft: { params: FilterParams; intensity: number } | null) => void;
  pipelineReady: boolean;
}

/**
 * Filters tray. Short sheet with a light scrim so the host keeps seeing their face while
 * choosing. Every swatch is computed with the shader's own maths (colorGrade.ts).
 */
export const FilterSheet = memo(function FilterSheet({ open, onClose, library, onCompare, comparing, onDraft, pipelineReady }: FilterSheetProps) {
  const [editor, setEditor] = useState<null | { mode: 'create' | 'edit'; preset: FilterPreset | null }>(null);
  const [menuFor, setMenuFor] = useState<FilterPreset | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FilterPreset | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditor(null);
      setMenuFor(null);
      onDraft(null);
      onCompare(false);
    }
  }, [open, onDraft, onCompare]);

  const swatches = useMemo(() => new Map(library.all.map((p) => [p.id, swatchBackground(p.params, 1)])), [library.all]);
  const active = library.active;
  const intensityPct = Math.round(library.selection.intensity * 100);

  if (editor) {
    return (
      <FilterEditor
        open={open}
        initial={editor.preset}
        mode={editor.mode}
        onDraft={onDraft}
        onCancel={() => {
          onDraft(null);
          setEditor(null);
        }}
        onSave={(input) => {
          const res = editor.mode === 'edit' && editor.preset ? library.update(editor.preset.id, input) : library.create(input);
          if (!res.ok) return PRESET_ERRORS[res.error] ?? 'Could not save.';
          onDraft(null);
          setEditor(null);
          return null;
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle={pipelineReady ? 'Applied to your camera before it is sent' : 'Turn your camera on to preview filters'}
      scrim="light"
      size="compact"
      id="plv-filter-sheet"
    >
      <div className="plv-filter-row" role="radiogroup" aria-label="Looks">
        {library.all.map((p) => {
          const on = p.id === active.id;
          return (
            <div key={p.id} className={`plv-look ${on ? 'is-on' : ''}`}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                className="plv-look-btn"
                onClick={() => library.select(p.id)}
                data-preset-id={p.id}
              >
                <span className="plv-look-swatch" style={{ background: p.id === NO_FILTER_ID ? swatchBackground(IDENTITY_PARAMS, 0) : swatches.get(p.id) }}>
                  {on && <Check size={16} aria-hidden="true" />}
                </span>
                <span className="plv-look-name">{p.name}</span>
              </button>
              {p.kind === 'custom' && (
                <button type="button" className="plv-look-more" aria-label={`${p.name} options`} onClick={() => setMenuFor(p)}>
                  <Ellipsis size={14} />
                </button>
              )}
            </div>
          );
        })}
        <div className="plv-look">
          <button type="button" className="plv-look-btn" onClick={() => setEditor({ mode: 'create', preset: null })} id="plv-create-look">
            <span className="plv-look-swatch plv-look-swatch--new">
              <Plus size={20} aria-hidden="true" />
            </span>
            <span className="plv-look-name">Create</span>
          </button>
        </div>
      </div>

      <div className="plv-filter-controls">
        <label className="plv-slider-row" htmlFor="plv-filter-intensity">
          <span>Intensity</span>
          <input
            id="plv-filter-intensity"
            type="range"
            min={0}
            max={100}
            step={1}
            value={intensityPct}
            disabled={active.id === NO_FILTER_ID}
            onChange={(e) => library.setIntensity(Number(e.target.value) / 100)}
            aria-valuetext={`${intensityPct}%`}
          />
          <output className="plv-num">{active.id === NO_FILTER_ID ? '—' : `${intensityPct}%`}</output>
        </label>
        <CompareButton comparing={comparing} onCompare={onCompare} disabled={!pipelineReady || active.id === NO_FILTER_ID} />
      </div>
      {library.saveError && <p className="plv-help plv-help--warn">{library.saveError}</p>}
      {opError && <p className="plv-help plv-help--warn">{opError}</p>}

      {menuFor && (
        <div className="plv-look-menu" role="menu" aria-label={`${menuFor.name} options`}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setEditor({ mode: 'edit', preset: menuFor });
              setMenuFor(null);
            }}
          >
            <Pencil size={16} aria-hidden="true" /> Edit or rename
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const res = library.duplicate(menuFor);
              setOpError(res.ok ? null : PRESET_ERRORS[res.error]);
              setMenuFor(null);
            }}
          >
            <Copy size={16} aria-hidden="true" /> Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={() => {
              setConfirmDelete(menuFor);
              setMenuFor(null);
            }}
          >
            <Trash size={16} aria-hidden="true" /> Delete
          </button>
          <button type="button" role="menuitem" onClick={() => setMenuFor(null)}>
            Cancel
          </button>
        </div>
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        title={`Delete “${confirmDelete?.name ?? ''}”?`}
        body="This look will be removed from this device."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) library.remove(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </Sheet>
  );
});

/** Press-and-hold (pointer, Space or Enter) shows the original camera through the same path. */
function CompareButton({ comparing, onCompare, disabled }: { comparing: boolean; onCompare: (v: boolean) => void; disabled: boolean }) {
  return (
    <button
      type="button"
      id="plv-compare"
      className={`plv-compare ${comparing ? 'is-on' : ''}`}
      disabled={disabled}
      aria-pressed={comparing}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
        onCompare(true);
      }}
      onPointerUp={() => onCompare(false)}
      onPointerCancel={() => onCompare(false)}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          onCompare(true);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') onCompare(false);
      }}
      onBlur={() => onCompare(false)}
    >
      {comparing ? 'Showing original' : 'Hold to compare'}
    </button>
  );
}

function FilterEditor({
  open,
  mode,
  initial,
  onDraft,
  onCancel,
  onSave,
  onClose,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initial: FilterPreset | null;
  onDraft: (d: { params: FilterParams; intensity: number } | null) => void;
  onCancel: () => void;
  onSave: (input: { name: string; params: FilterParams; intensity: number }) => string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [params, setParams] = useState<FilterParams>(initial?.params ?? { ...IDENTITY_PARAMS });
  const [intensity, setIntensity] = useState(initial?.intensity ?? 1);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onDraft({ params, intensity });
  }, [params, intensity, onDraft]);

  const set = (key: keyof FilterParams, v: number) => setParams((p) => ({ ...p, [key]: v }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Create a look' : `Edit “${initial?.name}”`}
      subtitle="Changes preview live on your camera"
      scrim="light"
      size="auto"
      id="plv-filter-editor"
      footer={
        <div className="plv-sheet-actions">
          <button type="button" className="plv-btn plv-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="plv-btn plv-btn--ghost"
            onClick={() => setParams({ ...IDENTITY_PARAMS })}
          >
            Reset
          </button>
          <button
            type="button"
            className="plv-btn plv-btn--iris"
            id="plv-save-look"
            onClick={() => {
              const err = onSave({ name, params, intensity });
              setError(err);
              if (err) nameRef.current?.focus();
            }}
          >
            {mode === 'create' ? 'Save look' : 'Save changes'}
          </button>
        </div>
      }
    >
      <label className="plv-field" htmlFor="plv-look-name">
        <span>Name</span>
        <input
          ref={nameRef}
          id="plv-look-name"
          value={name}
          maxLength={PRESET_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Golden hour"
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={error ? 'plv-look-error' : undefined}
        />
      </label>
      {error && (
        <p id="plv-look-error" className="plv-help plv-help--warn" role="alert">
          {error}
        </p>
      )}
      <div className="plv-editor-sliders">
        {FILTER_PARAM_SPECS.map((s) => {
          const v = params[s.key];
          const pct = Math.round(v * 100);
          return (
            <label key={s.key} className="plv-slider-row" htmlFor={`plv-p-${s.key}`}>
              <span>{s.label}</span>
              <input
                id={`plv-p-${s.key}`}
                type="range"
                min={s.min * 100}
                max={s.max * 100}
                step={1}
                value={pct}
                onChange={(e) => set(s.key, Number(e.target.value) / 100)}
                onDoubleClick={() => set(s.key, 0)}
                aria-valuetext={`${pct > 0 && s.min < 0 ? '+' : ''}${pct}`}
              />
              <output className="plv-num">{`${pct > 0 && s.min < 0 ? '+' : ''}${pct}`}</output>
            </label>
          );
        })}
        <label className="plv-slider-row" htmlFor="plv-p-intensity">
          <span>Intensity</span>
          <input
            id="plv-p-intensity"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(intensity * 100)}
            onChange={(e) => setIntensity(Number(e.target.value) / 100)}
            aria-valuetext={`${Math.round(intensity * 100)}%`}
          />
          <output className="plv-num">{Math.round(intensity * 100)}%</output>
        </label>
      </div>
    </Sheet>
  );
}
