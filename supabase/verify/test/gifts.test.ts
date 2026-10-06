import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Db, RpcError, expectCode, gift, idem, world } from './harness';

let db: Db;
beforeEach(async () => {
  db = await Db.create();
});
afterEach(async () => {
  await db.close();
});

async function counts(liveId: string) {
  return db.one(`
    select (select count(*)::int from live.gift_transactions) as tx,
           (select count(*)::int from live.coin_ledger) as ledger,
           (select count(*)::int from live.events where live_id = $1 and event_type like 'GIFT%') as gift_events,
           (select count(*)::int from realtime.messages where event like 'GIFT%') as broadcasts`, [liveId]);
}

describe('gift transaction', () => {
  it('debits the sender, credits the host, writes ledger + tx and emits GIFT_RECEIVED in one commit', async () => {
    const w = await world(db, { viewers: 1, fund: 1000 });
    const [v] = w.viewers;
    const r = await gift(db, v, w.liveA, 'tropical-mosquito', 2);
    expect(r).toMatchObject({ ok: true, replayed: false, coin_value: 500, currency: 'test_coins', balance: 500, battle_outcome: 'no_battle', battle_points: 0 });

    expect((await db.wallet(v)).test_coins).toBe(500);
    expect((await db.wallet(w.hostA)).test_earnings).toBe(500);
    expect((await db.wallet(w.hostA)).earnings).toBe(0);

    const ledger = await db.sql(`select user_id, currency, delta, balance_after, reason from live.coin_ledger where ref_id = $1 order by delta`, [r.tx_id]);
    expect(ledger).toEqual([
      { user_id: v, currency: 'test_coins', delta: -500, balance_after: 500, reason: 'gift_sent' },
      { user_id: w.hostA, currency: 'test_earnings', delta: 500, balance_after: 500, reason: 'gift_received' },
    ]);

    const [ev] = await db.events(w.liveA, ['GIFT_RECEIVED']);
    expect(ev).toMatchObject({
      live_id: w.liveA,
      event_type: 'GIFT_RECEIVED',
      actor_id: v,
      schema_version: 1,
      battle_id: null,
      payload: {
        tx_id: r.tx_id,
        recipient_id: w.hostA,
        quantity: 2,
        coin_value: 500,
        battle_points: 0,
        multiplier: 0,
        sender_live_total: 500,
        battle_outcome: 'no_battle',
        gift: { id: 'tropical-mosquito', rarity: 'rare', coin_cost: 250, icon_url: './gifts/tropical-mosquito/icon.webp' },
        sender: { id: v, display_name: 'Viewer 0' },
      },
    });
    expect(ev.server_ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const msgs = await db.realtime(`live:${w.liveA}`);
    const gm = msgs.find((m) => m.event === 'GIFT_RECEIVED');
    expect(gm.private).toBe(true);
    expect(gm.payload.event_id).toBe(ev.event_id);
  });

  it('INSUFFICIENT_FUNDS writes nothing and emits nothing', async () => {
    const w = await world(db, { viewers: 1, fund: 5 });
    const before = await counts(w.liveA);
    const r = await gift(db, w.viewers[0], w.liveA, 'rose', 1);
    expect(r).toMatchObject({ ok: false, code: 'INSUFFICIENT_FUNDS', balance: 5, required: 10 });
    expect(await counts(w.liveA)).toEqual(before);
    expect((await db.wallet(w.viewers[0])).test_coins).toBe(5);
  });

  it('a user without any wallet cannot gift and no wallet is created', async () => {
    const w = await world(db, { viewers: 0 });
    const u = await db.newUser();
    const r = await gift(db, u, w.liveA, 'rose', 1);
    expect(r).toMatchObject({ ok: false, code: 'INSUFFICIENT_FUNDS', balance: 0 });
    expect(await db.wallet(u)).toBeUndefined();
  });

  it('test credits and real coins never mix', async () => {
    const w = await world(db, { viewers: 1, fund: 1000 });
    await db.setFlag('test_credits', false);
    const r = await gift(db, w.viewers[0], w.liveA, 'rose', 1);
    expect(r).toMatchObject({ ok: false, code: 'INSUFFICIENT_FUNDS', currency: 'coins', balance: 0 });
  });

  it('is idempotent: a retry with the same key returns the original result without a second debit', async () => {
    const w = await world(db, { viewers: 1, fund: 1000 });
    const key = idem();
    const args = { p_live_id: w.liveA, p_gift_id: 'rose', p_quantity: 3, p_idempotency_key: key };
    const first = await db.rpc(w.viewers[0], 'live_send_gift', args);
    const again = await db.rpc(w.viewers[0], 'live_send_gift', args);
    expect(again).toMatchObject({ ok: true, replayed: true, tx_id: first.tx_id, balance: 970 });
    expect((await db.wallet(w.viewers[0])).test_coins).toBe(970);
    expect((await db.events(w.liveA, ['GIFT_RECEIVED'])).length).toBe(1);
    await expectCode(db.rpc(w.viewers[0], 'live_send_gift', { ...args, p_quantity: 4 }), 'IDEMPOTENCY_KEY_REUSED');
  });

  it('eliminates the check-then-decrement race: parallel gifts can never overspend', async () => {
    const w = await world(db, { viewers: 1, fund: 100 });
    const [v] = w.viewers;
    const results = await Promise.all(Array.from({ length: 25 }, () => gift(db, v, w.liveA, 'rose', 1)));
    const ok = results.filter((r) => r.ok);
    const rejected = results.filter((r) => !r.ok);
    expect(ok.length).toBe(10);
    expect(rejected.every((r) => r.code === 'INSUFFICIENT_FUNDS')).toBe(true);
    expect((await db.wallet(v)).test_coins).toBe(0);
    expect((await db.wallet(w.hostA)).test_earnings).toBe(100);
    const sums = await db.one(`select sum(delta)::int as s, count(*)::int as n from live.coin_ledger where user_id = $1`, [v]);
    expect(sums).toEqual({ s: -100, n: 10 });
    // seq is gap-free and strictly increasing
    const seqs = (await db.events(w.liveA)).map((e) => e.seq);
    expect(seqs).toEqual(Array.from({ length: seqs.length }, (_, i) => i + 1));
  });

  it('parallel retries of the SAME key produce exactly one transaction', async () => {
    const w = await world(db, { viewers: 1, fund: 1000 });
    const args = { p_live_id: w.liveA, p_gift_id: 'rose', p_quantity: 1, p_idempotency_key: idem() };
    const rs = await Promise.all(Array.from({ length: 10 }, () => db.rpc(w.viewers[0], 'live_send_gift', args)));
    expect(new Set(rs.map((r) => r.tx_id)).size).toBe(1);
    expect(rs.filter((r) => !r.replayed).length).toBe(1);
    expect((await db.wallet(w.viewers[0])).test_coins).toBe(990);
  });

  it('a failure anywhere rolls back money, ledger, tx AND the broadcast', async () => {
    const w = await world(db, { viewers: 1, fund: 1000 });
    // Inject a failure at the very end of the transaction (while emitting a later event).
    await db.sql(`
      create function live.test_boom() returns trigger language plpgsql as $$
      begin
        if new.event_type = 'GIFT_STREAK' then raise exception 'BOOM'; end if;
        return new;
      end $$;
      create trigger test_boom before insert on live.events for each row execute function live.test_boom();`);
    const before = await counts(w.liveA);
    await expectCode(gift(db, w.viewers[0], w.liveA, 'rose', 5), 'BOOM'); // qty 5 → GIFT_STREAK
    expect(await counts(w.liveA)).toEqual(before);
    expect((await db.wallet(w.viewers[0])).test_coins).toBe(1000);
    expect((await db.wallet(w.hostA)).test_earnings).toBe(0);
    expect((await db.realtime(`live:${w.liveA}`)).filter((m) => m.event === 'GIFT_RECEIVED')).toEqual([]);
  });

  it('validates the request server-side', async () => {
    const w = await world(db, { viewers: 2, fund: 1000 });
    const [v, v2] = w.viewers;
    await expectCode(gift(db, w.hostA, w.liveA, 'rose', 1), 'CANNOT_GIFT_SELF');
    await expectCode(gift(db, v, w.liveA, 'rose', 0), 'INVALID_QUANTITY');
    await expectCode(gift(db, v, w.liveA, 'rose', 100), 'INVALID_QUANTITY');
    await expectCode(gift(db, v, w.liveA, 'no-such-gift', 1), 'GIFT_UNAVAILABLE');
    await db.sql(`update live.gifts set enabled = false where id = 'dragon'`);
    await expectCode(gift(db, v, w.liveA, 'dragon', 1), 'GIFT_UNAVAILABLE');
    await expectCode(
      db.rpc(v, 'live_send_gift', { p_live_id: w.liveA, p_gift_id: 'rose', p_quantity: 1, p_idempotency_key: 'short' }),
      'INVALID_IDEMPOTENCY_KEY',
    );
    await expectCode(gift(db, null as any, w.liveA, 'rose', 1), 'NOT_AUTHENTICATED');

    // blocked by the host → no access
    await db.rpc(w.hostA, 'live_block', { p_user_id: v2 });
    await expectCode(gift(db, v2, w.liveA, 'rose', 1), 'LIVE_ACCESS_DENIED');

    // ended LIVE
    await db.rpc(w.hostB, 'live_end', { p_live_id: w.liveB });
    await expectCode(gift(db, v, w.liveB, 'rose', 1), 'LIVE_NOT_ACTIVE');
  });

  it('private LIVE: only allow-listed users can gift', async () => {
    await db.setEnv('development');
    await db.setFlag('live_v2', true);
    await db.setFlag('test_credits', true);
    const host = await db.newUser();
    const invited = await db.newUser();
    const outsider = await db.newUser();
    await db.fund(invited, 100);
    await db.fund(outsider, 100);
    const s = await db.rpc(host, 'live_start', { p_title: 'Private', p_visibility: 'private', p_allowlist: [invited] });
    expect((await gift(db, invited, s.live_id, 'rose', 1)).ok).toBe(true);
    await expectCode(gift(db, outsider, s.live_id, 'rose', 1), 'LIVE_ACCESS_DENIED');
  });

  it('prices come only from the catalog (the client never sends a price)', async () => {
    const w = await world(db, { viewers: 1, fund: 100_000 });
    // There is no parameter through which a price could be supplied.
    await expect(
      db.rpc(w.viewers[0], 'live_send_gift', {
        p_live_id: w.liveA, p_gift_id: 'dragon', p_quantity: 1, p_idempotency_key: idem(), p_coin_cost: 1,
      }),
    ).rejects.toMatchObject({ sqlstate: '42883' });
    const r = await gift(db, w.viewers[0], w.liveA, 'dragon', 1);
    expect(r.coin_value).toBe(10_000);
  });

  it('ledger, transactions and contributions are append-only even for the owner', async () => {
    const w = await world(db, { viewers: 1, fund: 1000 });
    const r = await gift(db, w.viewers[0], w.liveA, 'rose', 1);
    await expect(db.sql(`update live.coin_ledger set delta = 1 where ref_id = $1`, [r.tx_id])).rejects.toThrow(/APPEND_ONLY/);
    await expect(db.sql(`delete from live.gift_transactions where id = $1`, [r.tx_id])).rejects.toThrow(/APPEND_ONLY/);
    await expect(db.sql(`update live.events set payload = '{}' where live_id = $1`, [w.liveA])).rejects.toThrow(/APPEND_ONLY/);
  });
});

describe('supporters, streaks and milestones (server-detected)', () => {
  it('top supporter: A → B → A with cooldown; state is the last announced #1', async () => {
    const w = await world(db, { viewers: 2, fund: 1_000_000 });
    const [a, b] = w.viewers;
    await gift(db, a, w.liveA, 'tropical-mosquito', 1); // 250 ≥ 100 → announced
    let tops = await db.events(w.liveA, ['TOP_SUPPORTER_CHANGED']);
    expect(tops.length).toBe(1);
    expect(tops[0].payload).toMatchObject({ supporter: { id: a }, total: 250, previous: null, previous_total: null });

    await gift(db, b, w.liveA, 'tropical-mosquito', 2); // b overtakes but within 20 s cooldown → suppressed
    tops = await db.events(w.liveA, ['TOP_SUPPORTER_CHANGED']);
    expect(tops.length).toBe(1);

    await db.sql(`update live.sessions set top_supporter_event_at = top_supporter_event_at - interval '21 seconds' where id = $1`, [w.liveA]);
    await gift(db, b, w.liveA, 'rose', 1); // next gift after cooldown announces b
    tops = await db.events(w.liveA, ['TOP_SUPPORTER_CHANGED']);
    expect(tops.length).toBe(2);
    expect(tops[1].payload).toMatchObject({ supporter: { id: b }, total: 510, previous: { id: a }, previous_total: 250 });

    await db.sql(`update live.sessions set top_supporter_event_at = top_supporter_event_at - interval '21 seconds' where id = $1`, [w.liveA]);
    await gift(db, a, w.liveA, 'tropical-mosquito', 2); // a: 750 > 510
    tops = await db.events(w.liveA, ['TOP_SUPPORTER_CHANGED']);
    expect(tops.length).toBe(3);
    expect(tops[2].payload).toMatchObject({ supporter: { id: a }, total: 750, previous: { id: b }, previous_total: 510 });

    const snap = await db.rpc(w.hostA, 'live_get_snapshot', { p_live_id: w.liveA });
    expect(snap.top_supporters.map((s: any) => [s.user.id, s.total])).toEqual([[a, 750], [b, 510]]);
  });

  it('supporter milestones fire once per threshold (highest crossed is announced)', async () => {
    const w = await world(db, { viewers: 1 });
    const [v] = w.viewers;
    await gift(db, v, w.liveA, 'tropical-mosquito', 5); // 1250 → crosses 500 and 1000
    let ms = await db.events(w.liveA, ['SUPPORTER_MILESTONE']);
    expect(ms.map((e) => e.payload.threshold)).toEqual([1000]);
    await gift(db, v, w.liveA, 'rose', 1);
    ms = await db.events(w.liveA, ['SUPPORTER_MILESTONE']);
    expect(ms.length).toBe(1);
    const row = await db.one(`select thresholds_reached from live.supporters where user_id = $1`, [v]);
    expect(row.thresholds_reached).toEqual([500, 1000]);
  });

  it('gift streaks count by quantity within the window and emit at configured counts', async () => {
    const w = await world(db, { viewers: 1 });
    const [v] = w.viewers;
    for (let i = 0; i < 4; i++) await gift(db, v, w.liveA, 'rose', 1);
    expect((await db.events(w.liveA, ['GIFT_STREAK'])).length).toBe(0);
    await gift(db, v, w.liveA, 'rose', 1); // 5
    await gift(db, v, w.liveA, 'rose', 6); // 11 → crosses 10
    const st = await db.events(w.liveA, ['GIFT_STREAK']);
    expect(st.map((e) => e.payload.streak)).toEqual([5, 10]);
    // window expiry resets the streak
    await db.sql(`update live.supporters set streak_last_at = streak_last_at - interval '5 seconds' where user_id = $1`, [v]);
    await gift(db, v, w.liveA, 'rose', 4);
    expect((await db.one(`select streak_count from live.supporters where user_id = $1`, [v])).streak_count).toBe(4);
    // a different gift resets too
    await gift(db, v, w.liveA, 'tropical-mosquito', 1);
    expect((await db.one(`select streak_count, streak_gift_id from live.supporters where user_id = $1`, [v]))).toEqual({
      streak_count: 1, streak_gift_id: 'tropical-mosquito',
    });
  });
});

void RpcError;
