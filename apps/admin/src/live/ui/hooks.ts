/**
 * React bindings for a LIVE screen. One LiveRoomController per mounted screen; everything is
 * read through useSyncExternalStore so the video subtree never re-renders because of chat,
 * gifts or battle ticks.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { EffectsController } from '../show/effects';
import { LiveFeed, LiveRoomController, MediaPresenceSource, PersonalNotice, RoomView } from '../client/LiveRoomController';
import { LiveComment } from '../client/commentStore';
import { ParticipantMedia } from '../client/connection';

export function useLiveRoom(feed: LiveFeed, effects: EffectsController): LiveRoomController | null {
  const [controller, setController] = useState<LiveRoomController | null>(null);
  useEffect(() => {
    const c = new LiveRoomController({ feed, effects });
    setController(c);
    c.start();
    return () => {
      c.dispose();
      setController(null);
    };
  }, [feed, effects]);
  return controller;
}

export function useRoomView(controller: LiveRoomController): RoomView {
  return useSyncExternalStore(
    (fn) => controller.subscribe(fn),
    () => controller.getView(),
  );
}

export function useComments(controller: LiveRoomController): ReadonlyArray<LiveComment> {
  return useSyncExternalStore(
    (fn) => controller.comments.subscribe(fn),
    () => controller.comments.get(),
  );
}

export function usePersonalNotices(controller: LiveRoomController, fn: (n: PersonalNotice) => void): void {
  useEffect(() => controller.onPersonalNotice(fn), [controller, fn]);
}

const EMPTY_PRESENCE: ReadonlyMap<string, ParticipantMedia> = new Map();

export function useMediaPresence(source: MediaPresenceSource | null): ReadonlyMap<string, ParticipantMedia> {
  return useSyncExternalStore(
    (fn) => (source ? source.subscribe(fn) : () => undefined),
    () => (source ? source.get() : EMPTY_PRESENCE),
  );
}

/** A ticking clock for durations. One interval per consumer, cleared on unmount. */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, active]);
  return now;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? m.toString().padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${sec.toString().padStart(2, '0')}`;
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
