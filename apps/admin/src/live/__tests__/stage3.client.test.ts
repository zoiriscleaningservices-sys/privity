import { describe, expect, it } from 'vitest';
import seedSql from '../../../../../supabase/migrations/20261004200600_live_v2_seed.sql?raw';
import { computeStageLayout } from '../stage/stageLayout';
import { INITIAL_PRESENTATION, moveGuest, moveGuestTo, reconcilePresentation, setFeatured, setLayoutMode } from '../stage/stagePresentation';
import { guestRequestsReducer, pendingRequests, requestHistory, GuestEntry } from '../stage/guestRequests';
import { describeLiveError, KNOWN_ERROR_CODES } from '../client/errors';
import { callRpc, createSupabaseLiveCommands, RpcClient } from '../client/supabaseLiveCommands';
import { CommentStore } from '../client/commentStore';
import { qualityFromStats } from '../client/connection';
import { EventFactory, user } from '../dev/fixtures';
import { SIM_GIFTS } from '../dev/simCatalog';

const g = (n: number) => Array.from({ length: n }, (_, i) => `g${i + 1}`);

describe('stage layout', () => {
  it('auto: solo → split → grid → spotlight as guests join', () => {
    expect(computeStageLayout({ hostId: 'h', guestIds: [], mode: 'auto', featuredId: null }).layout).toBe('solo');
    const split = computeStageLayout({ hostId: 'h', guestIds: g(1), mode: 'auto', featuredId: null });
    expect(split.layout).toBe('split');
    expect(split.tiles.map((t) => t.area)).toEqual(['half', 'half']);
    const grid = computeStageLayout({ hostId: 'h', guestIds: g(3), mode: 'auto', featuredId: null });
    expect(grid).toMatchObject({ layout: 'grid', columns: 2 });
    expect(grid.tiles).toHaveLength(4);
    expect(computeStageLayout({ hostId: 'h', guestIds: g(5), mode: 'auto', featuredId: null }).columns).toBe(3);
    const big = computeStageLayout({ hostId: 'h', guestIds: g(12), mode: 'auto', featuredId: null });
    expect(big.layout).toBe('spotlight');
    expect(big.tiles[0]).toMatchObject({ id: 'h', area: 'main' });
    expect(big.tiles.filter((t) => t.area === 'strip')).toHaveLength(4);
    expect(big.overflow).toHaveLength(8);
  });

  it('never renders more tiles than allowed and accounts for every participant', () => {
    for (let n = 0; n <= 12; n += 1) {
      for (const mode of ['auto', 'solo', 'split', 'grid', 'spotlight'] as const) {
        const l = computeStageLayout({ hostId: 'h', guestIds: g(n), mode, featuredId: n > 2 ? 'g3' : null });
        expect(l.tiles.length).toBeLessThanOrEqual(6);
        const ids = new Set([...l.tiles.map((t) => t.id), ...l.overflow]);
        expect(ids.size).toBe(n + 1);
      }
    }
  });

  it('featured guest takes the main area in spotlight and leads the split', () => {
    const s = computeStageLayout({ hostId: 'h', guestIds: g(4), mode: 'auto', featuredId: 'g3' });
    expect(s.layout).toBe('spotlight');
    expect(s.tiles[0]).toMatchObject({ id: 'g3', area: 'main' });
    expect(s.tiles.some((t) => t.id === 'h' && t.area === 'strip')).toBe(true);
    const split = computeStageLayout({ hostId: 'h', guestIds: g(3), mode: 'split', featuredId: 'g2' });
    expect(split.tiles[1]).toMatchObject({ id: 'g2', area: 'half' });
  });

  it('ignores a featured id that is not on stage', () => {
    expect(computeStageLayout({ hostId: 'h', guestIds: g(1), mode: 'auto', featuredId: 'ghost' }).layout).toBe('split');
  });
});

describe('stage presentation (host-local)', () => {
  it('reconciles with the authoritative guest list', () => {
    let p = reconcilePresentation(INITIAL_PRESENTATION, ['a', 'b', 'c']);
    expect(p.order).toEqual(['a', 'b', 'c']);
    p = moveGuest(p, 'c', -2);
    expect(p.order).toEqual(['c', 'a', 'b']);
    p = setFeatured(p, 'a');
    p = reconcilePresentation(p, ['b', 'c', 'd']);
    expect(p.order).toEqual(['c', 'b', 'd']);
    expect(p.featuredId).toBeNull();
    expect(reconcilePresentation(p, ['b', 'c', 'd'])).toBe(p);
  });

  it('moves, toggles featured, clamps and ignores unknown ids', () => {
    let p = reconcilePresentation(INITIAL_PRESENTATION, ['a', 'b', 'c']);
    expect(moveGuestTo(p, 'a', 99).order).toEqual(['b', 'c', 'a']);
    expect(moveGuest(p, 'zzz', 1)).toBe(p);
    p = setFeatured(p, 'b');
    expect(p.featuredId).toBe('b');
    expect(setFeatured(p, 'b').featuredId).toBeNull();
    expect(setFeatured(p, 'nope')).toBe(p);
    expect(setLayoutMode(p, 'grid').mode).toBe('grid');
  });
});

describe('guest request queue', () => {
  const u = (id: string) => user(id);
  it('follows server facts: requested → accepting → joined; declined; cancelled', () => {
    let s: GuestEntry[] = [];
    s = guestRequestsReducer(s, { type: 'requested', user: u('a'), at: 1 });
    s = guestRequestsReducer(s, { type: 'requested', user: u('b'), at: 2 });
    s = guestRequestsReducer(s, { type: 'requested', user: u('c'), at: 3 });
    expect(pendingRequests(s).map((e) => e.userId)).toEqual(['a', 'b', 'c']);

    s = guestRequestsReducer(s, { type: 'respond_start', userId: 'a', accept: true, at: 4 });
    expect(s.find((e) => e.userId === 'a')?.status).toBe('accepting');
    s = guestRequestsReducer(s, { type: 'respond_done', userId: 'a', accept: true, ok: true, at: 5 });
    expect(s.find((e) => e.userId === 'a')?.status).toBe('accepting'); // final only on GUEST_JOINED
    s = guestRequestsReducer(s, { type: 'guest_joined', user: u('a'), at: 6 });
    expect(s.find((e) => e.userId === 'a')?.status).toBe('accepted');

    s = guestRequestsReducer(s, { type: 'respond_start', userId: 'b', accept: false, at: 7 });
    s = guestRequestsReducer(s, { type: 'respond_done', userId: 'b', accept: false, ok: true, at: 8 });
    s = guestRequestsReducer(s, { type: 'request_cancelled', userId: 'c', at: 9 });
    expect(pendingRequests(s)).toHaveLength(0);
    expect(requestHistory(s).map((e) => [e.userId, e.status])).toEqual([
      ['c', 'cancelled'],
      ['b', 'declined'],
    ]);
    s = guestRequestsReducer(s, { type: 'guest_removed', userId: 'a', at: 10 });
    expect(requestHistory(s)[0]).toMatchObject({ userId: 'a', status: 'removed' });
  });

  it('keeps a failed response visible with the reason and lets sync drop stale pending', () => {
    let s = guestRequestsReducer([], { type: 'requested', user: u('a'), at: 1 });
    s = guestRequestsReducer(s, { type: 'respond_done', userId: 'a', accept: true, ok: false, error: 'Stage is full', at: 2 });
    expect(s[0]).toMatchObject({ status: 'failed', error: 'Stage is full' });
    s = guestRequestsReducer([...s, { userId: 'x', user: u('x'), status: 'pending', requestedAt: 0, updatedAt: 0, error: null }], {
      type: 'synced',
      rows: [{ request_id: 'y', user: u('y'), requested_at: new Date(5).toISOString() }],
      at: 6,
    });
    expect(s.map((e) => e.userId).sort()).toEqual(['a', 'y']);
  });
});

describe('error descriptions', () => {
  it('describes every gift/comment/guest code the server can return', () => {
    for (const code of [
      'INSUFFICIENT_FUNDS', 'BATTLE_LOCKED', 'BATTLE_NOT_STARTED', 'BATTLE_BREAK', 'BATTLE_CHANGED', 'INVALID_QUANTITY',
      'GIFT_UNAVAILABLE', 'LIVE_NOT_ACTIVE', 'RATE_LIMITED', 'COMMENTS_DISABLED', 'MUTED', 'GUEST_SLOTS_FULL',
      'GUEST_REQUEST_COOLDOWN', 'NOT_AUTHORIZED', 'NETWORK_ERROR',
    ]) {
      expect(KNOWN_ERROR_CODES).toContain(code);
    }
    expect(describeLiveError('BATTLE_LOCKED').action).toBe('send_outside_battle');
    expect(describeLiveError('INSUFFICIENT_FUNDS').action).toBe('get_coins');
    expect(describeLiveError('SOMETHING_NEW', 'Server says hi').body).toBe('Server says hi');
  });
});

describe('supabase command adapter', () => {
  const fake = (responses: Array<{ data: unknown; error: { message?: string; code?: string } | null } | Error>) => {
    const calls: Array<{ fn: string; args?: Record<string, unknown> }> = [];
    const client: RpcClient = {
      rpc: (fn, args) => {
        calls.push({ fn, args });
        const r = responses.shift();
        if (r instanceof Error) return Promise.reject(r);
        return Promise.resolve(r ?? { data: null, error: null });
      },
    };
    return { client, calls };
  };

  it('maps business results, raised codes and transport failures', async () => {
    const { client } = fake([
      { data: { ok: false, code: 'INSUFFICIENT_FUNDS', message: 'Not enough coins.', balance: 3 }, error: null },
      { data: null, error: { message: 'COMMENTS_DISABLED', code: 'P0001' } },
      new Error('Failed to fetch'),
      { data: null, error: { message: 'syntax error at or near' } },
      { data: { coins: 5 }, error: null },
    ]);
    expect(await callRpc(client, 'a')).toMatchObject({ ok: false, code: 'INSUFFICIENT_FUNDS', details: { balance: 3 } });
    expect(await callRpc(client, 'b')).toMatchObject({ ok: false, code: 'COMMENTS_DISABLED' });
    expect(await callRpc(client, 'c')).toMatchObject({ ok: false, code: 'NETWORK_ERROR' });
    expect(await callRpc(client, 'd')).toMatchObject({ ok: false, code: 'SERVER_ERROR' });
    expect(await callRpc(client, 'e')).toEqual({ ok: true, data: { coins: 5 } });
  });

  it('sends the exact RPC arguments and retries a serialization conflict once with the same key', async () => {
    const { client, calls } = fake([
      { data: null, error: { message: 'RETRY', code: '40001' } },
      { data: { ok: true, tx_id: 't1', balance: 90 }, error: null },
    ]);
    const cmd = createSupabaseLiveCommands(client);
    const r = await cmd.sendGift({ liveId: 'L', giftId: 'rose', quantity: 2, idempotencyKey: 'key-12345', battleMode: 'auto', expectedBattleId: null });
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      fn: 'live_send_gift',
      args: { p_live_id: 'L', p_gift_id: 'rose', p_quantity: 2, p_idempotency_key: 'key-12345', p_battle_mode: 'auto', p_expected_battle_id: null },
    });
    expect(calls[1].args).toEqual(calls[0].args);
  });
});

describe('comment store', () => {
  it('seeds from snapshot, appends server events, dedupes, deletes and stays bounded', () => {
    const f = new EventFactory();
    const store = new CommentStore(3);
    store.reset([
      { comment_id: 'c1', author: user('a'), text: 'hi', created_at: new Date(1).toISOString() },
      { comment_id: 'c1', author: user('a'), text: 'hi', created_at: new Date(1).toISOString() },
    ]);
    expect(store.get()).toHaveLength(1);
    for (let i = 2; i <= 5; i += 1) store.apply(f.make('COMMENT_CREATED', { comment_id: `c${i}`, author: user('b'), text: `m${i}` }));
    store.apply(f.make('COMMENT_CREATED', { comment_id: 'c5', author: user('b'), text: 'dupe' }));
    expect(store.get().map((c) => c.id)).toEqual(['c3', 'c4', 'c5']);
    store.apply(f.make('COMMENT_DELETED', { comment_id: 'c4' }));
    expect(store.get().map((c) => c.id)).toEqual(['c3', 'c5']);
  });
});

describe('connection quality from real stats (Stage 4 input)', () => {
  it('classifies thresholds', () => {
    expect(qualityFromStats({ rttMs: 60, packetLossPct: 0.2 })).toBe('excellent');
    expect(qualityFromStats({ rttMs: 220, packetLossPct: 0.5 })).toBe('good');
    expect(qualityFromStats({ rttMs: 90, packetLossPct: 8 })).toBe('weak');
  });
});

describe('Lab catalog parity with the S2 seed migration', () => {
  it('matches ids, names, costs and rarities in supabase/migrations/*_live_v2_seed.sql', () => {
    const rows = [...seedSql.matchAll(/\('([a-z-]+)', '([^']+)',\s*'[^']*', (\d+), '(common|rare|epic|legendary)'/g)].map((m) => ({
      id: m[1],
      name: m[2],
      coin_cost: Number(m[3]),
      rarity: m[4],
    }));
    expect(rows.length).toBe(4);
    expect(SIM_GIFTS.map((x) => ({ id: x.id, name: x.name, coin_cost: x.coin_cost, rarity: x.rarity }))).toEqual(rows);
  });
});
