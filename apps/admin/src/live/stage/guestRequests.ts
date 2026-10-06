/**
 * Host guest-request queue.
 *
 * Pending requests come from the server (`live_list_guest_requests` + GUEST_REQUESTED /
 * GUEST_REQUEST_CANCELLED personal notices). 'accepting' / 'declining' only mean "the host's
 * request is in flight"; the final state is always the server's answer or a server event.
 */

import { UserRef } from '../core/events';
import { GuestRequestRow } from '../client/LiveCommands';

export type GuestEntryStatus =
  | 'pending'
  | 'accepting'
  | 'declining'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'removed'
  | 'left'
  | 'failed';

export interface GuestEntry {
  userId: string;
  user: UserRef;
  status: GuestEntryStatus;
  requestedAt: number;
  updatedAt: number;
  error: string | null;
}

export type GuestRequestsAction =
  | { type: 'synced'; rows: ReadonlyArray<GuestRequestRow>; at: number }
  | { type: 'requested'; user: UserRef; at: number }
  | { type: 'request_cancelled'; userId: string; at: number }
  | { type: 'respond_start'; userId: string; accept: boolean; at: number }
  | { type: 'respond_done'; userId: string; accept: boolean; ok: boolean; error?: string; at: number }
  | { type: 'guest_joined'; user: UserRef; at: number }
  | { type: 'guest_left'; userId: string; at: number }
  | { type: 'guest_removed'; userId: string; at: number }
  | { type: 'clear_history' };

const HISTORY_LIMIT = 30;
const OPEN: ReadonlySet<GuestEntryStatus> = new Set(['pending', 'accepting', 'declining', 'failed']);

export function isOpenRequest(e: GuestEntry): boolean {
  return OPEN.has(e.status);
}

function upsert(list: GuestEntry[], entry: GuestEntry): GuestEntry[] {
  const without = list.filter((e) => e.userId !== entry.userId);
  return trim([...without, entry]);
}

function patch(list: GuestEntry[], userId: string, p: Partial<GuestEntry>): GuestEntry[] {
  let hit = false;
  const next = list.map((e) => {
    if (e.userId !== userId) return e;
    hit = true;
    return { ...e, ...p };
  });
  return hit ? next : list;
}

function trim(list: GuestEntry[]): GuestEntry[] {
  const open = list.filter(isOpenRequest);
  const closed = list.filter((e) => !isOpenRequest(e)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, HISTORY_LIMIT);
  return [...open, ...closed];
}

export function guestRequestsReducer(state: GuestEntry[], a: GuestRequestsAction): GuestEntry[] {
  switch (a.type) {
    case 'synced': {
      const pendingIds = new Set(a.rows.map((r) => r.user.id));
      // Server list is authoritative for who is waiting.
      let next = state.filter((e) => !(e.status === 'pending' && !pendingIds.has(e.userId)));
      for (const r of a.rows) {
        const existing = next.find((e) => e.userId === r.user.id);
        if (existing && isOpenRequest(existing)) continue;
        next = upsert(next, {
          userId: r.user.id,
          user: r.user,
          status: 'pending',
          requestedAt: Date.parse(r.requested_at) || a.at,
          updatedAt: a.at,
          error: null,
        });
      }
      return trim(next);
    }
    case 'requested':
      return upsert(state, { userId: a.user.id, user: a.user, status: 'pending', requestedAt: a.at, updatedAt: a.at, error: null });
    case 'request_cancelled':
      return trim(patch(state, a.userId, { status: 'cancelled', updatedAt: a.at, error: null }));
    case 'respond_start':
      return patch(state, a.userId, { status: a.accept ? 'accepting' : 'declining', updatedAt: a.at, error: null });
    case 'respond_done': {
      if (!a.ok) return patch(state, a.userId, { status: 'failed', updatedAt: a.at, error: a.error ?? 'Could not complete.' });
      // An accept is final only when GUEST_JOINED arrives; a decline is final on the server's OK.
      return trim(patch(state, a.userId, a.accept ? { updatedAt: a.at } : { status: 'declined', updatedAt: a.at }));
    }
    case 'guest_joined': {
      const existing = state.find((e) => e.userId === a.user.id);
      return upsert(state, {
        userId: a.user.id,
        user: a.user,
        status: 'accepted',
        requestedAt: existing?.requestedAt ?? a.at,
        updatedAt: a.at,
        error: null,
      });
    }
    case 'guest_left':
      return trim(patch(state, a.userId, { status: 'left', updatedAt: a.at }));
    case 'guest_removed':
      return trim(patch(state, a.userId, { status: 'removed', updatedAt: a.at }));
    case 'clear_history':
      return state.filter(isOpenRequest);
  }
}

export function pendingRequests(state: ReadonlyArray<GuestEntry>): GuestEntry[] {
  return state.filter(isOpenRequest).sort((a, b) => a.requestedAt - b.requestedAt);
}

export function requestHistory(state: ReadonlyArray<GuestEntry>): GuestEntry[] {
  return state.filter((e) => !isOpenRequest(e) && e.status !== 'accepted').sort((a, b) => b.updatedAt - a.updatedAt);
}
