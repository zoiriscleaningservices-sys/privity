/**
 * End-to-end contract test: the REAL client core (apps/admin/src/live) consumes the REAL
 * server events. Verifies the envelope contract, that the client reducer reproduces the
 * authoritative snapshot from the event log, and that LiveEventStore recovers from
 * duplicates, reordering and sequence gaps using live_get_events_since / live_get_snapshot.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Db, gift, startBattle, world } from './harness';
import { LIVE_EVENT_TYPES, parseLiveEvent, type AnyLiveEvent, type LiveSnapshot } from '../../../apps/admin/src/live/core/events';
import { applyLiveEvent, roomStateFromSnapshot } from '../../../apps/admin/src/live/core/roomState';
import { LiveEventStore, type Timers } from '../../../apps/admin/src/live/core/EventStore';
import { ServerClock } from '../../../apps/admin/src/live/core/serverClock';

let db: Db;
beforeEach(async () => {
  db = await Db.create();
});
afterEach(async () => {
  await db.close();
});

const CD_NORMAL1 = 2;
const CD_DOUBLE = 3;

async function richSession() {
  const w = await world(db, { viewers: 4 });
  const [v1, v2, v3, g] = w.viewers;
  const initialA = await db.rpc(v1, 'live_get_snapshot', { p_live_id: w.liveA });
  for (const v of w.viewers) await db.rpc(v, 'live_join', { p_live_id: w.liveA });
  await db.tick();
  await db.rpc(v1, 'live_comment', { p_live_id: w.liveA, p_text: 'hi' });
  await db.rpc(v2, 'live_follow', { p_user_id: w.hostA });
  await db.rpc(g, 'live_request_guest', { p_live_id: w.liveA });
  await db.rpc(w.hostA, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g, p_accept: true });
  const b = await startBattle(db, w);
  await db.moveIntoSegment(b.battle_id, CD_NORMAL1);
  await db.tick();
  await gift(db, v1, w.liveA, 'tropical-mosquito', 4);
  await gift(db, v2, w.liveB, 'super-galaxy', 1);
  await db.moveIntoSegment(b.battle_id, CD_DOUBLE, -20_000);
  await db.tick();
  await db.moveIntoSegment(b.battle_id, CD_DOUBLE);
  await db.tick();
  await gift(db, v3, w.liveA, 'dragon', 1);
  await gift(db, v1, w.liveA, 'rose', 5);
  await db.moveToEnd(b.battle_id, -5);
  await db.tick();
  return { w, b, initialA };
}

describe('client ⇔ server contract', () => {
  it('every server event parses as a known schema-v1 event with a valid envelope', async () => {
    const { w } = await richSession();
    for (const live of [w.liveA, w.liveB]) {
      const evs = await db.events(live);
      expect(evs.length).toBeGreaterThan(10);
      for (const raw of evs) {
        const p = parseLiveEvent(raw);
        expect(p.ok, raw.event_type).toBe(true);
        expect((p as any).event.unknown, `${raw.event_type} must be known to the client`).toBeUndefined();
        expect(LIVE_EVENT_TYPES).toContain(raw.event_type);
      }
    }
  });

  it('replaying the event log through the client reducer reproduces the authoritative snapshot', async () => {
    const { w, initialA } = await richSession();
    let state = roomStateFromSnapshot(initialA as LiveSnapshot);
    for (const raw of await db.events(w.liveA)) {
      if (raw.seq <= initialA.last_seq) continue;
      const p = parseLiveEvent(raw);
      if (p.ok && !(p.event as any).unknown) state = applyLiveEvent(state, p.event as AnyLiveEvent);
    }
    const final = roomStateFromSnapshot((await db.rpc(w.viewers[0], 'live_get_snapshot', { p_live_id: w.liveA })) as LiveSnapshot);
    expect(state.viewerCount).toBe(final.viewerCount);
    expect(state.peakViewers).toBe(final.peakViewers);
    expect(state.topSupporters.map((s) => [s.user.id, s.total])).toEqual(final.topSupporters.map((s) => [s.user.id, s.total]));
    expect(state.battle?.status).toBe('finalized');
    expect(state.battle?.result).toEqual(final.battle?.result);
    expect([state.battle?.score_a, state.battle?.score_b]).toEqual([final.battle?.score_a, final.battle?.score_b]);
    expect(state.battle?.timeline.length).toBe(final.battle?.timeline.length);
    expect(state.guests.map((g) => [g.id, g.slot])).toEqual(final.guests.map((g) => [g.id, g.slot]));
    expect(final.guests.length).toBe(1);
    expect(state.commentsEnabled).toBe(final.commentsEnabled);
  });

  it('LiveEventStore dedupes, reorders and fills gaps from the server without replaying old events', async () => {
    const { w } = await richSession();
    const viewer = w.viewers[0];
    const all = await db.events(w.liveA);
    const last = all.at(-1).seq;

    // Start the client from an early snapshot so there is history to recover.
    const pendingTimers: Array<() => void> = [];
    const timers: Timers = { setTimeout: (fn) => (pendingTimers.push(fn), pendingTimers.length), clearTimeout: () => undefined };
    let snapshotCalls = 0;
    const store = new LiveEventStore({
      liveId: w.liveA,
      clock: new ServerClock(),
      timers,
      fetchSnapshot: async (id) => {
        snapshotCalls += 1;
        const s = await db.rpc(viewer, 'live_get_snapshot', { p_live_id: id });
        return snapshotCalls === 1 ? { ...s, last_seq: 3 } : s; // first: pretend we joined at seq 3
      },
      fetchEventsSince: async (id, after, limit) =>
        (await db.rpc(viewer, 'live_get_events_since', { p_live_id: id, p_after_seq: after, p_limit: limit })).events,
    });
    const delivered: number[] = [];
    store.subscribe({ onEvent: (e) => delivered.push(e.seq) });
    await store.start();

    // Realtime delivers the tail out of order with duplicates; seqs 4..last-3 never arrive.
    const tail = all.slice(-3);
    store.ingest(tail[2]);
    store.ingest(tail[0]);
    store.ingest(tail[0]);
    store.ingest(tail[1]);
    expect(delivered).toEqual([]); // gap: nothing delivered out of order
    pendingTimers.shift()!(); // gap timer fires → range fetch
    await new Promise((r) => setTimeout(r, 200));
    expect(delivered).toEqual(Array.from({ length: last - 3 }, (_, i) => i + 4));
    expect(store.lastAppliedSeq).toBe(last);

    // Reconnect re-bases on a fresh snapshot: nothing old is replayed.
    await store.reconnect();
    store.ingest(all[5]);
    expect(delivered.length).toBe(last - 3);
    store.dispose();
  });
});
