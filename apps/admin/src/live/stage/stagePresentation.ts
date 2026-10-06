/**
 * Host-local stage presentation: guest order, featured guest, layout choice.
 *
 * WHO is on stage is authoritative server state (LiveRoomState.guests, slots assigned by
 * `live_respond_guest`). HOW they are arranged is presentation the host controls locally.
 * The LIVE contract has no "stage layout" RPC/event yet, so viewers render the default
 * slot-ordered auto layout; `StageLayoutSync` is the seam where Stage 4 can publish the
 * host's arrangement (e.g. LiveKit room metadata or a new server event).
 */

import { StageLayoutMode } from './stageLayout';

export interface StagePresentation {
  order: string[];
  featuredId: string | null;
  mode: StageLayoutMode;
}

export interface StageLayoutSync {
  publish(p: StagePresentation): Promise<void>;
}

export const INITIAL_PRESENTATION: StagePresentation = { order: [], featuredId: null, mode: 'auto' };

/** Keeps the host's order for guests still on stage, appends new guests (slot order), drops departed ones. */
export function reconcilePresentation(p: StagePresentation, guestIdsBySlot: ReadonlyArray<string>): StagePresentation {
  const present = new Set(guestIdsBySlot);
  const kept = p.order.filter((id) => present.has(id));
  const added = guestIdsBySlot.filter((id) => !kept.includes(id));
  const order = [...kept, ...added];
  const featuredId = p.featuredId && present.has(p.featuredId) ? p.featuredId : null;
  if (order.length === p.order.length && order.every((id, i) => id === p.order[i]) && featuredId === p.featuredId) return p;
  return { ...p, order, featuredId };
}

export function moveGuest(p: StagePresentation, id: string, delta: number): StagePresentation {
  const i = p.order.indexOf(id);
  if (i < 0) return p;
  return moveGuestTo(p, id, i + delta);
}

export function moveGuestTo(p: StagePresentation, id: string, index: number): StagePresentation {
  const i = p.order.indexOf(id);
  if (i < 0) return p;
  const target = Math.max(0, Math.min(p.order.length - 1, index));
  if (target === i) return p;
  const order = p.order.slice();
  order.splice(i, 1);
  order.splice(target, 0, id);
  return { ...p, order };
}

export function setFeatured(p: StagePresentation, id: string | null): StagePresentation {
  if (id !== null && !p.order.includes(id)) return p;
  return { ...p, featuredId: p.featuredId === id ? null : id };
}

export function setLayoutMode(p: StagePresentation, mode: StageLayoutMode): StagePresentation {
  return p.mode === mode ? p : { ...p, mode };
}
