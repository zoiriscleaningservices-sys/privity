import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnyLiveEvent, BattleSnapshot } from '../core/events';
import { LiveRoomState, applyLiveEvent, roomStateFromSnapshot } from '../core/roomState';
import { LiveShowEngine } from '../show/LiveShowEngine';
import { DropReason } from '../show/scheduler';
import { ActiveMoment, AnyMoment, GiftMomentPayload, MomentPayloads } from '../show/types';
import { EventFactory, giftPayload, introAtFor, makeBattle, makeResult, makeSnapshot, user } from '../dev/fixtures';

const T0 = Date.parse('2026-10-04T20:00:00.000Z');

function harness(battle: BattleSnapshot | null = null) {
  const f = new EventFactory();
  let room: LiveRoomState = roomStateFromSnapshot(makeSnapshot({ battle }));
  const shown: ActiveMoment[] = [];
  const dropped: Array<[AnyMoment, DropReason]> = [];
  const onFinalizeOverdue = vi.fn();
  const onResultsComplete = vi.fn();
  const engine = new LiveShowEngine({
    now: () => Date.now(),
    effects: null,
    onMomentShown: (a) => shown.push(a),
    onMomentDropped: (m, r) => dropped.push([m, r]),
    onFinalizeOverdue,
    onResultsComplete,
  });
  engine.applySnapshot(room);
  const send = (e: AnyLiveEvent, replayed = false) => {
    room = applyLiveEvent(room, e);
    engine.handleEvent(e, { replayed }, room);
  };
  const keys = () => shown.map((a) => a.moment.key);
  const droppedAs = (reason: DropReason) => dropped.filter(([, r]) => r === reason).map(([m]) => m.key);
  const reconnect = (b: BattleSnapshot | null) => {
    room = roomStateFromSnapshot(makeSnapshot({ battle: b }));
    engine.applySnapshot(room);
  };
  return {
    f,
    engine,
    send,
    shown,
    dropped,
    keys,
    droppedAs,
    reconnect,
    onFinalizeOverdue,
    onResultsComplete,
    room: () => room,
  };
}

const ms = (iso: string | null) => Date.parse(iso as string);

describe('LiveShowEngine scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  it('10 simultaneous gifts: first shown, burst aggregated, legendary keeps its own moment', () => {
    const h = harness();
    for (let i = 1; i <= 9; i++) h.send(h.f.make('GIFT_RECEIVED', giftPayload(user(`s${i}`), 'common')));
    h.send(h.f.make('GIFT_RECEIVED', giftPayload(user('whale'), 'legendary')));

    expect(h.keys()).toEqual(['gift_common', 'gift_legendary']);
    vi.advanceTimersByTime(2000);
    const agg = h.shown.find((a) => a.moment.key === 'gift_aggregate');
    expect(agg).toBeDefined();
    const p = agg!.moment.payload as MomentPayloads['gift_aggregate'];
    expect([p.count, p.unique_senders, p.total_coins]).toEqual([8, 8, 8]);
    expect(h.engine.getChat()).toHaveLength(10); // every fact is in chat, never throttled
    expect(h.engine.getLane('corner').length).toBeLessThanOrEqual(2);
  });

  it('100 rapid joins collapse into a couple of calm moments with the exact total', () => {
    const h = harness();
    for (let i = 0; i < 100; i++) {
      h.send(h.f.make('VIEWERS_JOINED', { count: 1, sample: [user(`v${i}`)] }));
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(5000);
    const joins = h.shown.filter((a) => a.moment.key === 'viewers_joined');
    expect(joins.length).toBeLessThanOrEqual(2);
    const total = joins.reduce((s, a) => s + (a.moment.payload as MomentPayloads['viewers_joined']).count, 0);
    expect(total).toBe(100);
  });

  it('supporter overtakes A→B→A: one popup within the cooldown, every change in chat and state', () => {
    const h = harness();
    const A = user('alice');
    const B = user('bob');
    h.send(h.f.make('TOP_SUPPORTER_CHANGED', { supporter: A, total: 100, previous: null, previous_total: null }));
    vi.advanceTimersByTime(3000);
    h.send(h.f.make('TOP_SUPPORTER_CHANGED', { supporter: B, total: 150, previous: A, previous_total: 100 }));
    vi.advanceTimersByTime(3000);
    h.send(h.f.make('TOP_SUPPORTER_CHANGED', { supporter: A, total: 200, previous: B, previous_total: 150 }));

    expect(h.keys().filter((k) => k === 'supporter_top')).toHaveLength(1);
    expect(h.droppedAs('cooldown')).toEqual(['supporter_top', 'supporter_top']);
    expect(h.engine.getChat().map((l) => l.actor?.id)).toEqual(['alice', 'bob', 'alice']);
    expect(h.room().topSupporters[0]).toMatchObject({ user: { id: 'alice' }, total: 200 });
  });

  it('major gift at T−8s shows; low corner noise is suppressed in the final countdown', () => {
    const b = makeBattle('classic_double', introAtFor('classic_double', T0, 300_000 - 8_000));
    const h = harness(b);
    expect(h.engine.getView()).toMatchObject({ stage: 'FINAL_COUNTDOWN', intensity: 3 });
    const battle = { id: b.battle_id, side: 'a' as const, points: 999, multiplier: 1 };
    h.send(h.f.make('GIFT_RECEIVED', giftPayload(user('fan'), 'common', { battle: { ...battle, points: 1 } })));
    h.send(h.f.make('GIFT_RECEIVED', giftPayload(user('big'), 'epic', { battle })));

    expect(h.keys()).toContain('gift_epic');
    expect(h.keys()).toContain('bar_surge');
    expect(h.keys()).not.toContain('gift_common');
    expect(h.droppedAs('suppressed')).toContain('gift_common');
    expect(h.keys()).not.toContain('final_countdown'); // baseline: joined inside the final countdown
  });

  it('DOUBLE starting mid-gift: multiplier comes from the server, timeline and server event dedupe', () => {
    const b = makeBattle('classic_double', introAtFor('classic_double', T0, 119_900));
    const h = harness(b);
    expect(h.engine.getView().bonus).toBe('warning');
    const bonusSeg = b.timeline.find((s) => s.kind === 'bonus')!;

    h.send(h.f.make('GIFT_RECEIVED', giftPayload(user('g1'), 'rare', { battle: { id: b.battle_id, side: 'b', points: 99, multiplier: 1 } })));
    vi.advanceTimersByTime(300); // crosses the bonus boundary on a tick
    const started = h.shown.filter((a) => a.moment.key === 'double_started');
    expect(started).toHaveLength(1);
    expect(started[0].moment.source).toBe('timeline');
    expect((started[0].moment.payload as MomentPayloads['double_started']).multiplier).toBe(2);

    h.send(
      h.f.make('DOUBLE_STARTED', {
        battle_id: b.battle_id,
        segment_idx: bonusSeg.idx,
        ends_at: bonusSeg.ends_at,
        multiplier: 2,
      }, ms(bonusSeg.starts_at)),
    );
    expect(h.shown.filter((a) => a.moment.key === 'double_started')).toHaveLength(1);
    expect(h.droppedAs('duplicate')).toContain('double_started');

    // Contribution scored by the server under ×2 — the client displays what it was told.
    h.send(h.f.make('GIFT_RECEIVED', giftPayload(user('g2'), 'rare', { battle: { id: b.battle_id, side: 'b', points: 198, multiplier: 2 } })));
    const rare = h.shown.filter((a) => a.moment.key === 'gift_rare').map((a) => a.moment.payload as GiftMomentPayload);
    expect(rare.map((p) => [p.multiplier, p.battle_points])).toEqual([
      [1, 99],
      [2, 198],
    ]);
  });

  it('reconnect during the final countdown replays nothing', () => {
    const b = makeBattle('classic_double', introAtFor('classic_double', T0, 300_000 - 31_000));
    const h = harness(b);
    vi.advanceTimersByTime(1500);
    expect(h.keys().filter((k) => k === 'final_countdown')).toHaveLength(1);

    vi.advanceTimersByTime(10_000);
    const before = h.shown.length;
    h.reconnect({ ...b, score_a: 500, score_b: 700, lead_side: 'b', score_version: 9 });
    vi.advanceTimersByTime(2000);
    expect(h.shown.length).toBe(before);
    expect(h.engine.getView()).toMatchObject({ stage: 'FINAL_COUNTDOWN', leadSide: 'b', scores: { a: 500, b: 700 } });
    for (const lane of ['stage', 'banner', 'corner', 'bar_fx'] as const) expect(h.engine.getLane(lane)).toHaveLength(0);
  });

  it('battle ends while events are still arriving: result wins, late facts are ignored', () => {
    const b = makeBattle('classic_double', introAtFor('classic_double', T0, 300_000 - 2_000));
    const h = harness(b);
    h.send(h.f.make('BATTLE_LEAD_CHANGED', { battle_id: b.battle_id, lead_side: 'a', score_a: 1000, score_b: 900, is_final_moment: false }));
    expect(h.engine.getLane('banner').map((a) => a.moment.key)).toEqual(['lead_change']);

    vi.advanceTimersByTime(2000);
    expect(h.engine.getView().stage).toBe('LOCKED');
    h.send(h.f.make('BATTLE_ENDED', { battle_id: b.battle_id, score_a: 1000, score_b: 900 }));
    h.send(h.f.make('BATTLE_RESULT', { battle_id: b.battle_id, result: makeResult(1000, 900) }));

    expect(h.engine.getLane('stage').map((a) => a.moment.key)).toEqual(['battle_result']);
    expect(h.engine.getLane('banner')).toHaveLength(0); // purged
    expect(h.engine.getView().stage).toBe('RESULTS');

    const shownBefore = h.shown.length;
    h.send(h.f.make('BATTLE_SCORE', { battle_id: b.battle_id, score_a: 5000, score_b: 900, pull_scores: [], lead_side: 'a', score_version: 99, last_contribution: null }));
    h.send(h.f.make('BATTLE_LEAD_CHANGED', { battle_id: b.battle_id, lead_side: 'b', score_a: 1000, score_b: 9000, is_final_moment: true }));
    expect(h.shown.length).toBe(shownBefore);
    expect(h.room().battle).toMatchObject({ score_a: 1000, score_b: 900, status: 'finalized' });

    vi.advanceTimersByTime(11_400);
    expect(h.onResultsComplete).toHaveBeenCalledWith(b.battle_id);
  });

  it('LOCKED without a result asks the server to finalize, with retry, and never declares a winner', () => {
    const b = makeBattle('classic_double', introAtFor('classic_double', T0, 300_000 - 100), { score_a: 10, score_b: 5 });
    const h = harness(b);
    vi.advanceTimersByTime(3_300); // overdue at ends_at + 3 s, observed on the next 250 ms tick
    expect(h.onFinalizeOverdue).toHaveBeenCalledTimes(1);
    expect(h.engine.getView().stage).toBe('LOCKED');
    expect(h.keys()).not.toContain('battle_result');
    vi.advanceTimersByTime(5_000);
    expect(h.onFinalizeOverdue).toHaveBeenCalledTimes(2);
  });

  it('a whole battle produces a coherent sequence of moments', () => {
    const h = harness();
    const b = makeBattle('classic_double', T0 + 50, { status: 'accepted' });
    h.send(h.f.make('BATTLE_ACCEPTED', { battle: b }));
    vi.advanceTimersByTime(ms(b.ends_at) - T0 + 500);
    const battleKeys = h.keys().filter((k) =>
      ['battle_intro', 'battle_countdown', 'double_warning', 'double_started', 'double_ended', 'final_countdown'].includes(k),
    );
    expect(battleKeys).toEqual([
      'battle_intro',
      'battle_countdown',
      'double_warning',
      'double_started',
      'double_ended',
      'final_countdown',
    ]);
    const countdown = h.shown.find((a) => a.moment.key === 'battle_countdown')!;
    // The 3-2-1 ends exactly on the fight time, plus the short FIGHT beat.
    expect(countdown.ends_at).toBeGreaterThanOrEqual(ms(b.starts_at) + 700 - 250);
    expect(countdown.ends_at).toBeLessThanOrEqual(ms(b.starts_at) + 700);
    expect(h.engine.getView().stage).toBe('LOCKED');
  });

  it('stale events update chat but are not animated', () => {
    const h = harness();
    h.send(h.f.make('GIFT_RECEIVED', giftPayload(user('late'), 'epic'), T0 - 10_000));
    expect(h.engine.getChat()).toHaveLength(1);
    expect(h.shown).toHaveLength(0);
  });

  it('battle events for a battle that is not on screen are not animated', () => {
    const b = makeBattle('classic_double', introAtFor('classic_double', T0, 10_000));
    const h = harness(b);
    h.send(h.f.make('BATTLE_LEAD_CHANGED', { battle_id: 'other-battle', lead_side: 'a', score_a: 1, score_b: 0, is_final_moment: false }));
    expect(h.shown).toHaveLength(0);
  });

  it('dismissing a moment frees its lane', () => {
    const h = harness();
    h.send(h.f.make('SYSTEM_NOTICE', { code: 'net', message: 'Connection restored', severity: 'info' }));
    const [active] = h.engine.getLane('corner');
    h.engine.dismiss(active.moment.id);
    expect(h.engine.getLane('corner')).toHaveLength(0);
  });
});
