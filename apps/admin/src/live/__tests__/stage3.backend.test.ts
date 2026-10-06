import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulatedLiveBackend } from '../dev/SimulatedLiveBackend';
import { LiveRoomController } from '../client/LiveRoomController';
import { EffectsController } from '../show/effects';
import { AnyLiveEvent, UserRef } from '../core/events';
import { BUILTIN_FORMATS } from '../battle/timeline';

const ref = (id: string): UserRef => ({ id, handle: id, display_name: id.toUpperCase(), avatar_url: null });
const HOST = ref('host');
const VIEWER = ref('viewer');

let clock = Date.parse('2026-10-05T12:00:00.000Z');
const now = () => clock;

function setup(config: Partial<ConstructorParameters<typeof SimulatedLiveBackend>[0]['config']> = {}) {
  const be = new SimulatedLiveBackend({ host: HOST, now, config: { latencyMs: 0, ...config } });
  be.ensureUser(VIEWER, 20000);
  const events: AnyLiveEvent[] = [];
  const stop = be.feedFor(HOST.id).connect({
    onSnapshot: () => undefined,
    onEvent: (e) => events.push(e),
    onPersonal: () => undefined,
    onConnection: () => undefined,
    onUnavailable: () => undefined,
  });
  return { be, events, stop, viewer: be.commandsFor(VIEWER.id), host: be.commandsFor(HOST.id) };
}

const flush = () => vi.advanceTimersByTimeAsync(1);
const key = (n: number) => `test-key-${n.toString().padStart(4, '0')}`;
const gift = (giftId: string, n: number, extra: Partial<Parameters<ReturnType<SimulatedLiveBackend['commandsFor']>['sendGift']>[0]> = {}) => ({
  liveId: 'live-lab-1',
  giftId,
  quantity: 1,
  idempotencyKey: key(n),
  battleMode: 'auto' as const,
  expectedBattleId: null,
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  clock = Date.parse('2026-10-05T12:00:00.000Z');
});
afterEach(() => vi.useRealTimers());

async function run<T>(p: Promise<T>): Promise<T> {
  await flush();
  return p;
}

describe('simulated backend honours the S2 gift contract', () => {
  it('charges the catalog price, credits the host and emits GIFT_RECEIVED', async () => {
    const { be, viewer, events } = setup();
    const r = await run(viewer.sendGift(gift('tropical-mosquito', 1, { quantity: 2 })));
    expect(r).toMatchObject({ ok: true, data: { coin_value: 500, balance: 19500, battle_outcome: 'no_battle', currency: 'test_coins' } });
    expect(be.getUser(HOST.id)?.earnings).toBe(500);
    const e = events.find((x) => x.event_type === 'GIFT_RECEIVED');
    expect(e?.payload).toMatchObject({ coin_value: 500, quantity: 2, gift: { id: 'tropical-mosquito', coin_cost: 250 } });
    const w = await run(viewer.getWallet());
    expect(w).toMatchObject({ ok: true, data: { spendable: 19500, active_currency: 'test_coins' } });
  });

  it('rejects insufficient funds without charging, and replays idempotent retries', async () => {
    const { be, viewer } = setup();
    const poor = await run(viewer.sendGift(gift('dragon', 1, { quantity: 3 })));
    expect(poor).toMatchObject({ ok: false, code: 'INSUFFICIENT_FUNDS' });
    expect(be.getUser(VIEWER.id)?.testCoins).toBe(20000);

    const a = await run(viewer.sendGift(gift('rose', 2)));
    const b = await run(viewer.sendGift(gift('rose', 2)));
    expect(a.ok && b.ok && b.data.replayed).toBe(true);
    expect(be.getUser(VIEWER.id)?.testCoins).toBe(19990);
    const reused = await run(viewer.sendGift(gift('dragon', 2)));
    expect(reused).toMatchObject({ ok: false, code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('hosts cannot gift themselves; invalid quantity and unknown gifts are refused', async () => {
    const { host, viewer } = setup();
    expect(await run(host.sendGift(gift('rose', 3)))).toMatchObject({ ok: false, code: 'CANNOT_GIFT_SELF' });
    expect(await run(viewer.sendGift(gift('rose', 4, { quantity: 0 })))).toMatchObject({ ok: false, code: 'INVALID_QUANTITY' });
    expect(await run(viewer.sendGift(gift('unicorn', 5)))).toMatchObject({ ok: false, code: 'GIFT_UNAVAILABLE' });
  });
});

describe('simulated backend battle scoring (server-time rules, D6)', () => {
  it('counts normal x1, bonus x2, then locks; post-lock gifts are excluded only on explicit consent', async () => {
    const { be, viewer, events } = setup();
    const def = BUILTIN_FORMATS.classic_double;
    be.dev.startBattle(ref('rival'), 'classic_double', 10_000); // 10 s into the fight
    const battleId = (events.find((e) => e.event_type === 'BATTLE_ACCEPTED')!.payload as { battle: { battle_id: string } }).battle.battle_id;

    const normal = await run(viewer.sendGift(gift('rose', 10, { expectedBattleId: battleId })));
    expect(normal).toMatchObject({ ok: true, data: { battle_outcome: 'counted', battle_points: 10, multiplier: 1 } });

    clock += (def.segments[0].s - 10 + 5) * 1000; // 5 s into the bonus
    const bonus = await run(viewer.sendGift(gift('rose', 11, { expectedBattleId: battleId })));
    expect(bonus).toMatchObject({ ok: true, data: { battle_outcome: 'counted', battle_points: 20, multiplier: 2 } });
    const scores = events.filter((e) => e.event_type === 'BATTLE_SCORE').map((e) => (e.payload as { score_a: number }).score_a);
    expect(scores).toEqual([10, 30]);

    clock += 400_000; // well past ends_at
    await vi.advanceTimersByTimeAsync(400);
    expect(events.some((e) => e.event_type === 'BATTLE_ENDED')).toBe(true);
    const before = be.getUser(VIEWER.id)!.testCoins;
    const locked = await run(viewer.sendGift(gift('rose', 12, { expectedBattleId: battleId })));
    expect(locked).toMatchObject({ ok: false, code: 'BATTLE_LOCKED' });
    expect(be.getUser(VIEWER.id)!.testCoins).toBe(before);

    const outside = await run(viewer.sendGift(gift('rose', 13, { battleMode: 'outside_battle', expectedBattleId: battleId })));
    expect(outside).toMatchObject({ ok: true, data: { battle_outcome: 'excluded', battle_points: 0 } });
    expect(be.getUser(VIEWER.id)!.testCoins).toBe(before - 10);
    const last = events.filter((e) => e.event_type === 'GIFT_RECEIVED').pop()!;
    expect(last.payload).toMatchObject({ battle_outcome: 'excluded', battle_id: null, battle_points: 0 });
    expect(events.filter((e) => e.event_type === 'BATTLE_SCORE')).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(2000);
    clock += 2000;
    await vi.advanceTimersByTimeAsync(400);
    const result = events.find((e) => e.event_type === 'BATTLE_RESULT');
    expect(result?.payload).toMatchObject({ result: { winner_side: 'a', final_a: 30, final_b: 0 } });
  });

  it('opponent-room gifts score side B with the same multiplier rules', async () => {
    const { be, events } = setup();
    be.dev.startBattle(ref('rival'), 'classic_double', 5_000);
    expect(be.dev.opponentGift(ref('fan'), 'tropical-mosquito', 4)).toBeNull();
    const s = events.filter((e) => e.event_type === 'BATTLE_SCORE').pop();
    expect(s?.payload).toMatchObject({ score_a: 0, score_b: 1000, lead_side: 'b' });
    expect(events.some((e) => e.event_type === 'BATTLE_LEAD_CHANGED')).toBe(true);
  });
});

describe('simulated backend comments, moderation and guests', () => {
  it('rate limits viewers, exempts the host, enforces mute and comments-off', async () => {
    const { viewer, host } = setup();
    expect(await run(viewer.comment('live-lab-1', 'hello'))).toMatchObject({ ok: true });
    expect(await run(viewer.comment('live-lab-1', 'again'))).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    expect(await run(host.comment('live-lab-1', 'host 1'))).toMatchObject({ ok: true });
    expect(await run(host.comment('live-lab-1', 'host 2'))).toMatchObject({ ok: true });
    expect(await run(viewer.comment('live-lab-1', ' '.repeat(3)))).toMatchObject({ ok: false, code: 'INVALID_COMMENT' });

    clock += 1500;
    await run(host.setCommentsEnabled('live-lab-1', false));
    expect(await run(viewer.comment('live-lab-1', 'blocked'))).toMatchObject({ ok: false, code: 'COMMENTS_DISABLED' });
    await run(host.setCommentsEnabled('live-lab-1', true));
    await run(host.mute('live-lab-1', VIEWER.id, 5));
    expect(await run(viewer.comment('live-lab-1', 'muted'))).toMatchObject({ ok: false, code: 'MUTED' });
    expect(await run(viewer.mute('live-lab-1', HOST.id, 5))).toMatchObject({ ok: false, code: 'NOT_AUTHORIZED' });
  });

  it('guest flow: request → accept assigns slots up to the cap; decline cooldown; removal is final', async () => {
    const { be, viewer, host, events } = setup({ guestSlots: 1 });
    const other = ref('other');
    be.ensureUser(other, 0);
    const otherCmd = be.commandsFor(other.id);

    expect(await run(viewer.requestGuest('live-lab-1'))).toMatchObject({ ok: true, data: { status: 'requested' } });
    expect(await run(otherCmd.requestGuest('live-lab-1'))).toMatchObject({ ok: true });
    const list = await run(host.listGuestRequests('live-lab-1'));
    expect(list.ok && list.data.map((r) => r.user.id)).toEqual(['viewer', 'other']);

    expect(await run(host.respondGuest('live-lab-1', VIEWER.id, true))).toMatchObject({ ok: true, data: { slot: 1 } });
    expect(events.some((e) => e.event_type === 'GUEST_JOINED')).toBe(true);
    expect(await run(host.respondGuest('live-lab-1', other.id, true))).toMatchObject({ ok: false, code: 'GUEST_SLOTS_FULL' });
    expect(await run(host.respondGuest('live-lab-1', other.id, false))).toMatchObject({ ok: true, data: { status: 'declined' } });
    expect(await run(otherCmd.requestGuest('live-lab-1'))).toMatchObject({ ok: false, code: 'GUEST_REQUEST_COOLDOWN' });

    expect(await run(host.removeGuest('live-lab-1', VIEWER.id))).toMatchObject({ ok: true });
    expect(await run(viewer.requestGuest('live-lab-1'))).toMatchObject({ ok: false, code: 'GUEST_REMOVED_BY_HOST' });
    expect(await run(viewer.respondGuest('live-lab-1', other.id, true))).toMatchObject({ ok: false, code: 'NOT_AUTHORIZED' });
  });

  it('offline link fails commands with NETWORK_ERROR and resyncs from a snapshot on restore', async () => {
    const { be, viewer } = setup();
    let snapshots = 0;
    be.feedFor(VIEWER.id).connect({
      onSnapshot: () => (snapshots += 1),
      onEvent: () => undefined,
      onPersonal: () => undefined,
      onConnection: () => undefined,
      onUnavailable: () => undefined,
    });
    await flush();
    expect(snapshots).toBe(1);
    be.dev.setLink('reconnecting');
    expect(await run(viewer.comment('live-lab-1', 'x'))).toMatchObject({ ok: false, code: 'NETWORK_ERROR' });
    be.dev.setLink('connected');
    await flush();
    expect(snapshots).toBe(2);
  });

  it('injected failures are returned once, then normal behaviour resumes', async () => {
    const { be, viewer } = setup();
    be.dev.failNext('sendGift', 'RATE_LIMITED');
    expect(await run(viewer.sendGift(gift('rose', 20)))).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    expect(await run(viewer.sendGift(gift('rose', 21)))).toMatchObject({ ok: true });
  });
});

describe('LiveRoomController over the simulated feed', () => {
  it('builds room + comments + me from snapshot and events; confirms follow from the server result', async () => {
    const { be, viewer } = setup();
    const effects = new EffectsController({ persist: false, vibrate: null, prefs: { sound: false, haptics: false, reducedMotion: true } });
    const ctl = new LiveRoomController({ feed: be.feedFor(VIEWER.id), effects, now });
    ctl.start();
    await flush();
    expect(ctl.getView()).toMatchObject({ phase: 'ready', me: { user_id: 'viewer', is_host: false, following_host: false } });

    await run(viewer.comment('live-lab-1', 'first!'));
    expect(ctl.comments.get().map((c) => c.text)).toEqual(['first!']);

    const f = await run(viewer.follow(HOST.id));
    if (f.ok) ctl.confirmMe({ following_host: f.data.following });
    expect(ctl.getView().me?.following_host).toBe(true);

    be.dev.setViewers(120);
    expect(ctl.getView().room?.viewerCount).toBe(120);

    await run(viewer.requestGuest('live-lab-1'));
    await run(be.commandsFor(HOST.id).respondGuest('live-lab-1', VIEWER.id, true));
    expect(ctl.getView().me?.guest_status).toBe('accepted');
    expect(ctl.getView().room?.guests.map((g) => g.id)).toEqual(['viewer']);

    be.dev.endLive();
    expect(ctl.getView().room?.status).toBe('ended');
    ctl.dispose();
  });

  it('reports an unavailable LIVE', async () => {
    const { be } = setup();
    const effects = new EffectsController({ persist: false, vibrate: null });
    const ctl = new LiveRoomController({ feed: be.feedFor(VIEWER.id, 'missing'), effects, now });
    ctl.start();
    await flush();
    expect(ctl.getView()).toMatchObject({ phase: 'unavailable', unavailable: { code: 'LIVE_NOT_FOUND' } });
    ctl.dispose();
  });
});
