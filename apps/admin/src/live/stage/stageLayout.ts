/**
 * Stage layout — pure function from (participants, layout choice) to tile placement.
 *
 * Prioritises what matters on a phone: the host and the featured guest stay large; extra
 * guests move to a filmstrip; beyond that a "+N" overflow chip — never 12 unreadable boxes.
 *
 * How many tiles render real video simultaneously is a Stage 4 decision (device/bandwidth
 * testing); `maxGrid` / `maxStrip` are the knobs for that.
 */

export type StageLayoutMode = 'auto' | 'solo' | 'split' | 'grid' | 'spotlight';
export type ResolvedLayout = 'solo' | 'split' | 'grid' | 'spotlight';
export type TileArea = 'main' | 'half' | 'grid' | 'strip';

export interface StageTile {
  id: string;
  role: 'host' | 'guest';
  area: TileArea;
}

export interface StageLayout {
  layout: ResolvedLayout;
  /** Grid columns (grid layout only). */
  columns: number;
  tiles: StageTile[];
  /** Participants on stage but not rendered (shown as "+N"). */
  overflow: string[];
}

export interface StageLayoutInput {
  hostId: string;
  /** Guest ids in presentation order. */
  guestIds: ReadonlyArray<string>;
  mode: StageLayoutMode;
  featuredId: string | null;
  maxGrid?: number;
  maxStrip?: number;
}

export const LAYOUT_LABELS: Record<StageLayoutMode, string> = {
  auto: 'Auto',
  solo: 'Host focus',
  split: 'Split',
  grid: 'Grid',
  spotlight: 'Spotlight',
};

export function computeStageLayout(input: StageLayoutInput): StageLayout {
  const maxGrid = Math.max(2, input.maxGrid ?? 6);
  const maxStrip = Math.max(0, input.maxStrip ?? 4);
  const featured = input.featuredId && input.guestIds.includes(input.featuredId) ? input.featuredId : null;
  // Featured guest is always first among guests.
  const guests = featured ? [featured, ...input.guestIds.filter((g) => g !== featured)] : [...input.guestIds];
  const host: StageTile = { id: input.hostId, role: 'host', area: 'main' };
  const n = guests.length;

  let mode: ResolvedLayout;
  if (n === 0) mode = 'solo';
  else if (input.mode !== 'auto') mode = input.mode;
  else if (featured && n >= 2) mode = 'spotlight';
  else if (n === 1) mode = 'split';
  else if (n + 1 <= maxGrid) mode = 'grid';
  else mode = 'spotlight';

  const guestTile = (id: string, area: TileArea): StageTile => ({ id, role: 'guest', area });
  const strip = (ids: string[]) => {
    const shown = ids.slice(0, maxStrip);
    return { tiles: shown.map((id) => guestTile(id, 'strip')), overflow: ids.slice(shown.length) };
  };

  switch (mode) {
    case 'solo': {
      const s = strip(guests);
      return { layout: 'solo', columns: 1, tiles: [host, ...s.tiles], overflow: s.overflow };
    }
    case 'split': {
      const [first, ...rest] = guests;
      const s = strip(rest);
      return {
        layout: 'split',
        columns: 2,
        tiles: [{ ...host, area: 'half' }, guestTile(first, 'half'), ...s.tiles],
        overflow: s.overflow,
      };
    }
    case 'grid': {
      const shown = guests.slice(0, maxGrid - 1);
      const count = shown.length + 1;
      const columns = count <= 4 ? 2 : 3;
      return {
        layout: 'grid',
        columns,
        tiles: [{ ...host, area: 'grid' }, ...shown.map((id) => guestTile(id, 'grid'))],
        overflow: guests.slice(shown.length),
      };
    }
    case 'spotlight': {
      // Featured guest takes the main area; otherwise the host does.
      if (featured) {
        const rest = [input.hostId, ...guests.slice(1)];
        const shown = rest.slice(0, maxStrip);
        return {
          layout: 'spotlight',
          columns: 1,
          tiles: [
            guestTile(featured, 'main'),
            ...shown.map((id) => (id === input.hostId ? { ...host, area: 'strip' as const } : guestTile(id, 'strip'))),
          ],
          overflow: rest.slice(shown.length),
        };
      }
      const s = strip(guests);
      return { layout: 'spotlight', columns: 1, tiles: [host, ...s.tiles], overflow: s.overflow };
    }
  }
}
