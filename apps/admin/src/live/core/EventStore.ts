/**
 * LiveEventStore — the single entry point for authoritative LIVE events on the client.
 *
 * Guarantees to listeners:
 *  - events are delivered at most once (dedupe by event_id and seq)
 *  - events are delivered in strictly increasing seq order
 *  - a sequence gap is never "guessed": it is filled from the server (range fetch) or the
 *    whole state is replaced from an authoritative snapshot
 *  - after a reconnect, state is always re-based on a fresh snapshot
 */

import {
  AnyLiveEvent,
  LiveSnapshot,
  UnknownLiveEvent,
  isUnknownEvent,
  parseLiveEvent,
  toMs,
} from './events';
import { ServerClock } from './serverClock';

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const defaultTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface EventStoreDeps {
  liveId: string;
  fetchSnapshot(liveId: string): Promise<LiveSnapshot>;
  fetchEventsSince(liveId: string, afterSeq: number, limit: number): Promise<unknown[]>;
  clock: ServerClock;
  timers?: Timers;
  /** How long to wait for missing events to arrive on their own before fetching. */
  gapWaitMs?: number;
  /** Gaps larger than this are recovered with a snapshot instead of a range fetch. */
  maxRangeFetch?: number;
  /** Max remembered event ids for duplicate detection. */
  dedupeWindow?: number;
}

export type EventStoreStatus = 'idle' | 'syncing' | 'live' | 'recovering' | 'error';

export interface DeliveryContext {
  /** True when the event arrived via range fetch (it may be old). */
  replayed: boolean;
}

export interface EventStoreListener {
  onSnapshot?(snapshot: LiveSnapshot): void;
  onEvent?(event: AnyLiveEvent, ctx: DeliveryContext): void;
  onStatus?(status: EventStoreStatus): void;
}

type Buffered = { event: AnyLiveEvent | UnknownLiveEvent; replayed: boolean };

export class LiveEventStore {
  private appliedSeq = 0;
  private status: EventStoreStatus = 'idle';
  private readonly pending = new Map<number, Buffered>();
  private readonly seenIds = new Set<string>();
  private readonly seenOrder: string[] = [];
  private readonly listeners = new Set<EventStoreListener>();
  private gapTimer: unknown = null;
  private snapshotEpoch = 0;
  private snapshotInFlight = false;
  private rangeFetchInFlight = false;
  private disposed = false;

  private readonly timers: Timers;
  private readonly gapWaitMs: number;
  private readonly maxRangeFetch: number;
  private readonly dedupeWindow: number;

  constructor(private readonly deps: EventStoreDeps) {
    this.timers = deps.timers ?? defaultTimers;
    this.gapWaitMs = deps.gapWaitMs ?? 1500;
    this.maxRangeFetch = deps.maxRangeFetch ?? 50;
    this.dedupeWindow = deps.dedupeWindow ?? 2000;
  }

  get lastAppliedSeq(): number {
    return this.appliedSeq;
  }

  get currentStatus(): EventStoreStatus {
    return this.status;
  }

  subscribe(listener: EventStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Initial sync. */
  start(): Promise<void> {
    return this.resync('syncing');
  }

  /** Call after the realtime transport reconnects (or the tab returns to foreground). */
  reconnect(): Promise<void> {
    return this.resync('recovering');
  }

  dispose(): void {
    this.disposed = true;
    this.clearGapTimer();
    this.pending.clear();
    this.listeners.clear();
  }

  /** Feed a raw message from the realtime transport. */
  ingest(raw: unknown): void {
    this.ingestInternal(raw, false);
  }

  // -------------------------------------------------------------------------

  private ingestInternal(raw: unknown, replayed: boolean): void {
    if (this.disposed) return;
    const parsed = parseLiveEvent(raw);
    if (!parsed.ok) return;
    const event = parsed.event;
    if (event.live_id !== this.deps.liveId) return;
    if (this.seenIds.has(event.event_id)) return;
    if (event.seq <= this.appliedSeq) return;

    const serverMs = toMs(event.server_ts);
    if (serverMs !== null) this.deps.clock.observeServerTimestamp(serverMs);

    if (!this.pending.has(event.seq)) this.pending.set(event.seq, { event, replayed });

    // While a snapshot is loading we only buffer; the snapshot decides the base seq.
    if (this.snapshotInFlight) return;
    this.drain();
  }

  private drain(): void {
    let next = this.pending.get(this.appliedSeq + 1);
    while (next) {
      this.pending.delete(this.appliedSeq + 1);
      this.deliver(next);
      next = this.pending.get(this.appliedSeq + 1);
    }
    if (this.pending.size > 0) this.scheduleGapRecovery();
    else this.clearGapTimer();
  }

  private deliver({ event, replayed }: Buffered): void {
    this.appliedSeq = event.seq;
    this.remember(event.event_id);
    if (isUnknownEvent(event)) return; // advances seq, not interpreted
    for (const l of this.listeners) {
      try {
        l.onEvent?.(event, { replayed });
      } catch (err) {
        console.error('[LiveEventStore] listener error', err);
      }
    }
  }

  private remember(id: string): void {
    this.seenIds.add(id);
    this.seenOrder.push(id);
    if (this.seenOrder.length > this.dedupeWindow) {
      const old = this.seenOrder.shift();
      if (old) this.seenIds.delete(old);
    }
  }

  private scheduleGapRecovery(): void {
    if (this.gapTimer !== null || this.rangeFetchInFlight || this.snapshotInFlight) return;
    this.gapTimer = this.timers.setTimeout(() => {
      this.gapTimer = null;
      void this.recoverGap();
    }, this.gapWaitMs);
  }

  private clearGapTimer(): void {
    if (this.gapTimer !== null) {
      this.timers.clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
  }

  private async recoverGap(): Promise<void> {
    if (this.disposed || this.pending.size === 0) return;
    const lowestPending = Math.min(...this.pending.keys());
    const missing = lowestPending - this.appliedSeq - 1;
    if (missing <= 0) {
      this.drain();
      return;
    }
    if (missing > this.maxRangeFetch) {
      await this.resync('recovering');
      return;
    }
    this.rangeFetchInFlight = true;
    try {
      const events = await this.deps.fetchEventsSince(this.deps.liveId, this.appliedSeq, missing);
      this.rangeFetchInFlight = false;
      for (const raw of events) this.ingestInternal(raw, true);
      // If the hole is still there the server could not fill it: re-base on a snapshot.
      if (this.pending.size > 0 && !this.pending.has(this.appliedSeq + 1)) {
        await this.resync('recovering');
      }
    } catch {
      this.rangeFetchInFlight = false;
      await this.resync('recovering');
    }
  }

  private async resync(status: EventStoreStatus): Promise<void> {
    if (this.disposed) return;
    const epoch = ++this.snapshotEpoch;
    this.snapshotInFlight = true;
    this.clearGapTimer();
    this.setStatus(status);
    const t0 = this.deps.clock.localNow();
    try {
      const snapshot = await this.deps.fetchSnapshot(this.deps.liveId);
      if (this.disposed || epoch !== this.snapshotEpoch) return; // superseded
      const t1 = this.deps.clock.localNow();
      const serverMs = toMs(snapshot.server_now);
      if (serverMs !== null) this.deps.clock.syncFromRoundTrip(t0, t1, serverMs);

      this.snapshotInFlight = false;
      this.appliedSeq = snapshot.last_seq;
      for (const seq of Array.from(this.pending.keys())) {
        if (seq <= snapshot.last_seq) this.pending.delete(seq);
      }
      for (const l of this.listeners) {
        try {
          l.onSnapshot?.(snapshot);
        } catch (err) {
          console.error('[LiveEventStore] listener error', err);
        }
      }
      this.setStatus('live');
      this.drain();
    } catch {
      if (epoch !== this.snapshotEpoch) return;
      this.snapshotInFlight = false;
      this.setStatus('error');
    }
  }

  private setStatus(status: EventStoreStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const l of this.listeners) l.onStatus?.(status);
  }
}
