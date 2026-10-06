/**
 * Host-side stage state: the guest request queue (server list + personal notices + stage
 * events) and the host's local presentation (order / featured / layout).
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { LiveGuest } from '../core/events';
import type { LiveCommands } from '../client/LiveCommands';
import type { LiveRoomController, PersonalNotice } from '../client/LiveRoomController';
import { describeLiveError } from '../client/errors';
import { guestRequestsReducer } from '../stage/guestRequests';
import {
  INITIAL_PRESENTATION,
  StagePresentation,
  moveGuest,
  moveGuestTo,
  reconcilePresentation,
  setFeatured,
  setLayoutMode,
} from '../stage/stagePresentation';
import type { StageLayoutMode } from '../stage/stageLayout';
import { usePersonalNotices } from './hooks';

export function useGuestRequests(controller: LiveRoomController, commands: LiveCommands, liveId: string | null, guests: ReadonlyArray<LiveGuest>) {
  const [requests, dispatch] = useReducer(guestRequestsReducer, []);
  const requestUser = useRef(new Map<string, string>());
  const removedByHost = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    if (!liveId) return;
    const res = await commands.listGuestRequests(liveId);
    if (res.ok) {
      for (const r of res.data) requestUser.current.set(r.request_id, r.user.id);
      dispatch({ type: 'synced', rows: res.data, at: Date.now() });
    }
  }, [commands, liveId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onNotice = useCallback((n: PersonalNotice) => {
    if (n.type === 'GUEST_REQUESTED') {
      requestUser.current.set(n.request_id, n.user.id);
      dispatch({ type: 'requested', user: n.user, at: Date.now() });
    } else if (n.type === 'GUEST_REQUEST_CANCELLED') {
      const userId = requestUser.current.get(n.request_id) ?? n.request_id;
      dispatch({ type: 'request_cancelled', userId, at: Date.now() });
    }
  }, []);
  usePersonalNotices(controller, onNotice);

  // Stage membership changes come from server events (room.guests).
  const prevGuests = useRef<ReadonlyArray<LiveGuest>>(guests);
  useEffect(() => {
    const before = new Map(prevGuests.current.map((g) => [g.id, g]));
    const after = new Set(guests.map((g) => g.id));
    for (const g of guests) if (!before.has(g.id)) dispatch({ type: 'guest_joined', user: g, at: Date.now() });
    for (const [id] of before) {
      if (after.has(id)) continue;
      if (removedByHost.current.delete(id)) dispatch({ type: 'guest_removed', userId: id, at: Date.now() });
      else dispatch({ type: 'guest_left', userId: id, at: Date.now() });
    }
    prevGuests.current = guests;
  }, [guests]);

  const respond = useCallback(
    async (userId: string, accept: boolean) => {
      if (!liveId) return;
      dispatch({ type: 'respond_start', userId, accept, at: Date.now() });
      const res = await commands.respondGuest(liveId, userId, accept);
      dispatch({
        type: 'respond_done',
        userId,
        accept,
        ok: res.ok,
        error: res.ok ? undefined : describeLiveError(res.code, res.message).title,
        at: Date.now(),
      });
    },
    [commands, liveId],
  );

  const remove = useCallback(
    async (userId: string): Promise<{ ok: true } | { ok: false; code: string; message: string }> => {
      if (!liveId) return { ok: false, code: 'LIVE_NOT_FOUND', message: '' };
      removedByHost.current.add(userId);
      const res = await commands.removeGuest(liveId, userId);
      if (!res.ok) {
        removedByHost.current.delete(userId);
        return res;
      }
      return { ok: true };
    },
    [commands, liveId],
  );

  const clearHistory = useCallback(() => dispatch({ type: 'clear_history' }), []);

  return { requests, refresh, respond, remove, clearHistory };
}

export function useStagePresentation(guests: ReadonlyArray<LiveGuest>) {
  const [presentation, setPresentation] = useState<StagePresentation>(INITIAL_PRESENTATION);
  const ids = guests.map((g) => g.id).join(',');
  useEffect(() => {
    setPresentation((p) => reconcilePresentation(p, ids ? ids.split(',') : []));
  }, [ids]);
  return {
    presentation,
    move: useCallback((id: string, delta: number) => setPresentation((p) => moveGuest(p, id, delta)), []),
    moveTo: useCallback((id: string, index: number) => setPresentation((p) => moveGuestTo(p, id, index)), []),
    feature: useCallback((id: string) => setPresentation((p) => setFeatured(p, id)), []),
    layout: useCallback((mode: StageLayoutMode) => setPresentation((p) => setLayoutMode(p, mode)), []),
  };
}
