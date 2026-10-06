import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerClock } from '../core/serverClock';
import { EventStoreListener, LiveEventStore } from '../core/EventStore';
import { AnyLiveEvent, LiveSnapshot, parseLiveEvent } from '../core/events';
import { EventFactory, LIVE_ID, makeSnapshot, user } from '../dev/fixtures';

describe('ServerClock', () => {
  it('estimates the offset with the round-trip midpoint', () => {
    let t = 1000;
    const clock = new ServerClock(() => t);
    t = 1100;
    clock.syncFromRoundTrip(1000, 1100, 50_000);
    expect(clock.isSynced).toBe(true);
    expect(clock.now()).toBe(50_050);
  });

  it('never moves backwards, even when the offset is corrected downwards', () => {
    let t = 0;
    const clock = new ServerClock(() => t);
    clock.syncFromRoundTrip(0, 0, 10_000);
    const a = clock.now();
    clock.syncFromRoundTrip(0, 0, 5_000); // pulls offset down
    expect(clock.now()).toBeGreaterThanOrEqual(a);
    t = 10;
    expect(clock.now()).toBeGreaterThanOrEqual(a);
  });

  it('treats event timestamps as a lower bound on server time', () => {
    const t = 500;
    const clock = new ServerClock(() => t);
    clock.syncFromRoundTrip(500, 500, 20_000);
    clock.observeServerTimestamp(25_000);
    expect(clock.now()).toBeGreaterThanOrEqual(25_000);
  });
});

describe('parseLiveEvent', () => {
  it('rejects malformed envelopes and keeps unknown types sequenced', () => {
    expect(parseLiveEvent(null).ok).toBe(false);
    expect(parseLiveEvent({ event_id: 'x', live_id: 'l', event_type: 'GIFT_RECEIVED', server_ts: 'nope', seq: 1 }).ok).toBe(false);
    const unknown = parseLiveEvent({
      event_id: 'x',
      live_id: 'l',
      event_type: 'FROM_THE_FUTURE',
      server_ts: new Date().toISOString(),
      seq: 3,
      schema_version: 1,
      payload: {},
    });
    expect(unknown.ok && 'unknown' in unknown.event).toBe(true);
  });
});

// ---------------------------------------------------------------------------

interface Deferred<T> {
  promise: Promise<T>;
  resolve(v: T): void;
  reject(e: unknown): void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(opts: { snapshots?: Array<LiveSnapshot | Deferred<LiveSnapshot>>; range?: (after: number, limit: number) => Promise<unknown[]> } = {}) {
  const queue = opts.snapshots ?? [];
  const fetchSnapshot = vi.fn(async () => {
    const next = queue.length > 1 ? queue.shift()! : queue[0] ?? makeSnapshot();
    return 'promise' in next ? next.promise : next;
  });
  const fetchEventsSince = vi.fn(async (_live: string, after: number, limit: number) =>
    opts.range ? opts.range(after, limit) : [],
  );
  const clock = new ServerClock(() => Date.now());
  const store = new LiveEventStore({ liveId: LIVE_ID, fetchSnapshot, fetchEventsSince, clock });
  const delivered: Array<{ e: AnyLiveEvent; replayed: boolean }> = [];
  const snapshots: LiveSnapshot[] = [];
  const statuses: string[] = [];
  const listener: EventStoreListener = {
    onEvent: (e, ctx) => delivered.push({ e, replayed: ctx.replayed }),
    onSnapshot: (s) => snapshots.push(s),
    onStatus: (s) => statuses.push(s),
  };
  store.subscribe(listener);
  const seqs = () => delivered.map((d) => d.e.seq);
  return { store, fetchSnapshot, fetchEventsSince, delivered, snapshots, statuses, seqs };
}

const viewerCount = (f: EventFactory, seq?: number) =>
  f.make('VIEWER_COUNT', { count: 1, peak: 1 }, Date.now(), seq !== undefined ? { seq } : {});

describe('LiveEventStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-10-04T20:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('delivers in order and buffers out-of-order events', async () => {
    const s = setup();
    await s.store.start();
    const f = new EventFactory();
    const e1 = viewerCount(f);
    const e2 = viewerCount(f);
    const e3 = viewerCount(f);
    s.store.ingest(e3);
    s.store.ingest(e2);
    expect(s.seqs()).toEqual([]);
    s.store.ingest(e1);
    expect(s.seqs()).toEqual([1, 2, 3]);
    expect(s.statuses).toEqual(['syncing', 'live']);
  });

  it('drops duplicates by event_id and by already-applied seq', async () => {
    const s = setup();
    await s.store.start();
    const f = new EventFactory();
    const e1 = viewerCount(f);
    s.store.ingest(e1);
    s.store.ingest(e1);
    s.store.ingest({ ...e1, event_id: 'other-id' });
    expect(s.seqs()).toEqual([1]);
  });

  it('ignores events for another LIVE', async () => {
    const s = setup();
    await s.store.start();
    s.store.ingest(new EventFactory('someone-else').make('VIEWER_COUNT', { count: 1, peak: 1 }));
    expect(s.delivered).toHaveLength(0);
  });

  it('fills a small gap with a range fetch after the gap wait', async () => {
    const f = new EventFactory();
    const e1 = viewerCount(f);
    const e2 = viewerCount(f);
    const e3 = viewerCount(f);
    const s = setup({ range: async () => [e2] });
    await s.store.start();
    s.store.ingest(e1);
    s.store.ingest(e3);
    expect(s.seqs()).toEqual([1]);
    await vi.advanceTimersByTimeAsync(1499);
    expect(s.fetchEventsSince).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(s.fetchEventsSince).toHaveBeenCalledWith(LIVE_ID, 1, 1);
    expect(s.seqs()).toEqual([1, 2, 3]);
    expect(s.delivered[1].replayed).toBe(true);
    expect(s.delivered[2].replayed).toBe(false);
  });

  it('does not fetch when the missing event arrives on its own', async () => {
    const s = setup();
    await s.store.start();
    const f = new EventFactory();
    const e1 = viewerCount(f);
    const e2 = viewerCount(f);
    s.store.ingest(e2);
    await vi.advanceTimersByTimeAsync(500);
    s.store.ingest(e1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.fetchEventsSince).not.toHaveBeenCalled();
    expect(s.seqs()).toEqual([1, 2]);
  });

  it('re-bases on a snapshot when the gap is too large', async () => {
    const s = setup({ snapshots: [makeSnapshot({ last_seq: 0 }), makeSnapshot({ last_seq: 59 })] });
    await s.store.start();
    const f = new EventFactory();
    s.store.ingest(viewerCount(f, 60));
    await vi.advanceTimersByTimeAsync(1500);
    expect(s.fetchEventsSince).not.toHaveBeenCalled();
    expect(s.fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(s.snapshots.map((x) => x.last_seq)).toEqual([0, 59]);
    expect(s.seqs()).toEqual([60]);
  });

  it('re-bases on a snapshot when the server cannot fill the gap', async () => {
    const s = setup({ snapshots: [makeSnapshot({ last_seq: 0 }), makeSnapshot({ last_seq: 2 })], range: async () => [] });
    await s.store.start();
    const f = new EventFactory();
    s.store.ingest(viewerCount(f, 3));
    await vi.advanceTimersByTimeAsync(1500);
    expect(s.fetchEventsSince).toHaveBeenCalledTimes(1);
    expect(s.fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(s.seqs()).toEqual([3]);
  });

  it('buffers during snapshot load and discards events the snapshot already contains', async () => {
    const d = deferred<LiveSnapshot>();
    const s = setup({ snapshots: [d] });
    const started = s.store.start();
    const f = new EventFactory();
    s.store.ingest(viewerCount(f, 4));
    s.store.ingest(viewerCount(f, 5));
    s.store.ingest(viewerCount(f, 6));
    expect(s.delivered).toHaveLength(0);
    d.resolve(makeSnapshot({ last_seq: 5 }));
    await started;
    expect(s.seqs()).toEqual([6]);
  });

  it('reconnect always takes a fresh snapshot', async () => {
    const s = setup({ snapshots: [makeSnapshot({ last_seq: 0 }), makeSnapshot({ last_seq: 10 })] });
    await s.store.start();
    await s.store.reconnect();
    expect(s.fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(s.store.lastAppliedSeq).toBe(10);
    expect(s.statuses).toEqual(['syncing', 'live', 'recovering', 'live']);
  });

  it('ignores a superseded snapshot response (epoch guard)', async () => {
    const first = deferred<LiveSnapshot>();
    const second = deferred<LiveSnapshot>();
    const s = setup({ snapshots: [first, second] });
    const a = s.store.start();
    const b = s.store.reconnect();
    second.resolve(makeSnapshot({ last_seq: 20 }));
    await b;
    first.resolve(makeSnapshot({ last_seq: 3 }));
    await a;
    expect(s.snapshots.map((x) => x.last_seq)).toEqual([20]);
    expect(s.store.lastAppliedSeq).toBe(20);
  });

  it('unknown event types advance the sequence without being delivered', async () => {
    const s = setup();
    await s.store.start();
    const f = new EventFactory();
    s.store.ingest({
      event_id: 'future-1',
      live_id: LIVE_ID,
      event_type: 'FROM_THE_FUTURE',
      server_ts: new Date().toISOString(),
      seq: 1,
      schema_version: 1,
      payload: {},
    });
    s.store.ingest(f.make('FOLLOW_RECEIVED', { follower: user('u1') }, Date.now(), { seq: 2 }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.seqs()).toEqual([2]);
    expect(s.store.lastAppliedSeq).toBe(2);
    expect(s.fetchEventsSince).not.toHaveBeenCalled();
  });

  it('reports error status when the snapshot cannot be loaded', async () => {
    const d = deferred<LiveSnapshot>();
    const s = setup({ snapshots: [d] });
    const p = s.store.start();
    d.reject(new Error('offline'));
    await p;
    expect(s.store.currentStatus).toBe('error');
  });
});
