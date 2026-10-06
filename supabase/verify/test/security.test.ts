/**
 * Security regression suite — one test per vulnerability found in the audit, plus the
 * Realtime private-channel model.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Db, expectCode, gift, startBattle, world } from './harness';

let db: Db;
beforeEach(async () => {
  db = await Db.create();
});
afterEach(async () => {
  await db.close();
});

const DENIED = { sqlstate: '42501' };

describe('no client can touch authoritative state directly', () => {
  it('free coin creation / client-controlled balances: no table access, no internal function access', async () => {
    const w = await world(db, { viewers: 1, fund: 0 });
    const [v] = w.viewers;
    await expect(db.as('authenticated', v, `update live.wallets set test_coins = 999999 where user_id = $1`, [v])).rejects.toMatchObject(DENIED);
    await expect(db.as('authenticated', v, `insert into live.coin_ledger (user_id, currency, delta, balance_after, reason) values ($1,'coins',1,1,'purchase')`, [v])).rejects.toMatchObject(DENIED);
    await expect(db.as('authenticated', v, `select * from live.wallets`)).rejects.toMatchObject(DENIED);
    await expect(db.as('anon', null, `select * from live.gifts`)).rejects.toMatchObject(DENIED);
    expect((await db.rpc(v, 'live_get_wallet')).test_coins).toBe(0);
  });

  it('client-controlled battle scores / forged events / forged LIVE status are impossible', async () => {
    const w = await world(db);
    const b = await startBattle(db, w);
    const [v] = w.viewers;
    await expect(db.as('authenticated', v, `update live.battles set score_a = 1000000 where id = $1`, [b.battle_id])).rejects.toMatchObject(DENIED);
    await expect(db.as('authenticated', v, `select live.emit($1, 'BATTLE_RESULT', '{}'::jsonb)`, [w.liveA])).rejects.toMatchObject(DENIED);
    await expect(db.as('authenticated', w.hostA, `select live.finalize_battle($1, 'b')`, [b.battle_id])).rejects.toMatchObject(DENIED);
    await expect(db.as('authenticated', v, `update live.sessions set status = 'ended' where id = $1`, [w.liveA])).rejects.toMatchObject(DENIED);
    await expectCode(db.rpc(v, 'live_end', { p_live_id: w.liveA }), 'NOT_AUTHORIZED');
    await expectCode(db.rpc(w.hostB, 'live_end', { p_live_id: w.liveA }), 'NOT_AUTHORIZED');
    await expect(db.rpc(v, 'live_show_tick')).rejects.toMatchObject(DENIED);
    // the service role (server-side scheduler) may run the tick
    expect(await db.rpc(null, 'live_show_tick', {}, 'service_role')).toHaveProperty('battles');
  });

  it('anon can call nothing', async () => {
    const w = await world(db);
    for (const [fn, args] of [
      ['live_get_wallet', {}],
      ['live_join', { p_live_id: w.liveA }],
      ['live_get_snapshot', { p_live_id: w.liveA }],
      ['live_list_active', {}],
    ] as const) {
      await expect(db.rpc(null, fn, args as any, 'anon')).rejects.toMatchObject(DENIED);
    }
  });

  it('suspended accounts are locked out of every RPC', async () => {
    const w = await world(db);
    const [v] = w.viewers;
    await db.sql(`insert into live.platform_bans (user_id, reason) values ($1, 'test')`, [v]);
    await expectCode(db.rpc(v, 'live_join', { p_live_id: w.liveA }), 'ACCOUNT_SUSPENDED');
    await expectCode(gift(db, v, w.liveA, 'rose'), 'ACCOUNT_SUSPENDED');
  });
});

describe('D4: purchases off, test credits isolated', () => {
  it('test credits require admin + non-production + flag; every grant is ledgered and audited', async () => {
    const admin = await db.newUser();
    const user = await db.newUser();
    await db.makeAdmin(admin);
    const grant = (by: string) => db.rpc(by, 'live_admin_grant_test_credits', { p_user_id: user, p_amount: 500, p_note: 'qa' });

    await expectCode(grant(user), 'NOT_AUTHORIZED');
    await expectCode(grant(admin), 'TEST_CREDITS_FORBIDDEN_IN_PRODUCTION'); // default environment
    await expectCode(db.rpc(admin, 'live_admin_set_flag', { p_key: 'test_credits', p_enabled: true }), 'TEST_CREDITS_FORBIDDEN_IN_PRODUCTION');

    await db.setEnv('staging');
    await expectCode(grant(admin), 'TEST_CREDITS_DISABLED');
    await db.rpc(admin, 'live_admin_set_flag', { p_key: 'test_credits', p_enabled: true });
    expect(await grant(admin)).toEqual({ ok: true, test_coins: 500 });

    const w = await db.wallet(user);
    expect([w.coins, w.test_coins]).toEqual([0, 500]); // real balance untouched
    const led = await db.one(`select currency, delta, reason, actor_id from live.coin_ledger where user_id = $1`, [user]);
    expect(led).toEqual({ currency: 'test_coins', delta: 500, reason: 'test_grant', actor_id: admin });
    const audit = await db.sql(`select action from live.admin_audit_log order by id`);
    expect(audit.map((a) => a.action)).toEqual(['set_flag', 'grant_test_credits']);
  });

  it('purchases cannot be enabled (no payment infrastructure) and no RPC credits real coins', async () => {
    const admin = await db.newUser();
    await db.makeAdmin(admin);
    await db.setEnv('development');
    await expectCode(db.rpc(admin, 'live_admin_set_flag', { p_key: 'purchases', p_enabled: true }), 'PURCHASES_NOT_CONFIGURED');
    const writers = await db.sql(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'live\\_%' and p.prosrc ~* 'set\\s+coins\\s*='`);
    expect(writers.map((w) => w.proname)).toEqual(['live_send_gift']); // only debits via gifts
    expect((await db.rpc(admin, 'live_get_wallet')).purchases_enabled).toBe(false);
  });
});

describe('guest publishing and media access (stream hijacking / forged guest acceptance)', () => {
  it('only the host can accept a guest; only host + accepted guests can publish', async () => {
    const w = await world(db, { viewers: 2 });
    const [g, other] = w.viewers;
    await db.rpc(g, 'live_request_guest', { p_live_id: w.liveA });
    await expectCode(db.rpc(g, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g, p_accept: true }), 'NOT_AUTHORIZED');
    await expectCode(db.rpc(other, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g, p_accept: true }), 'NOT_AUTHORIZED');
    await expectCode(db.rpc(w.hostB, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g, p_accept: true }), 'NOT_AUTHORIZED');

    expect(await db.rpc(g, 'live_media_access', { p_live_id: w.liveA })).toMatchObject({ role: 'viewer', can_publish: false });
    expect(await db.rpc(w.hostB, 'live_media_access', { p_live_id: w.liveA })).toMatchObject({ role: 'viewer', can_publish: false });
    const host = await db.rpc(w.hostA, 'live_media_access', { p_live_id: w.liveA });
    expect(host).toMatchObject({ role: 'host', can_publish: true, identity: w.hostA });

    await db.rpc(w.hostA, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g, p_accept: true });
    expect(await db.rpc(g, 'live_media_access', { p_live_id: w.liveA })).toMatchObject({ role: 'guest', can_publish: true });
    await db.rpc(w.hostA, 'live_remove_guest', { p_live_id: w.liveA, p_user_id: g });
    expect(await db.rpc(g, 'live_media_access', { p_live_id: w.liveA })).toMatchObject({ role: 'viewer', can_publish: false });
  });

  it('media room names are unpredictable and never derived from ids', async () => {
    const w = await world(db);
    const a = await db.rpc(w.hostA, 'live_media_access', { p_live_id: w.liveA });
    const b = await db.rpc(w.hostB, 'live_media_access', { p_live_id: w.liveB });
    for (const m of [a, b]) {
      expect(m.room).toMatch(/^lv_[0-9a-f]{64}$/);
      for (const id of [w.liveA, w.liveB, w.hostA, w.hostB]) expect(m.room).not.toContain(id.replace(/-/g, ''));
    }
    expect(a.room).not.toBe(b.room);
    // the room is not exposed in snapshots or listings
    const snap = await db.rpc(w.viewers[0], 'live_join', { p_live_id: w.liveA });
    expect(JSON.stringify(snap)).not.toContain(a.room);
    expect(JSON.stringify(await db.rpc(w.viewers[0], 'live_list_active'))).not.toContain(a.room);
  });
});

describe('private LIVE access', () => {
  it('private and followers-only LIVEs are invisible to everyone else (snapshot, events, list, media)', async () => {
    await db.setEnv('development');
    await db.setFlag('live_v2', true);
    const host = await db.newUser();
    const friend = await db.newUser();
    const follower = await db.newUser();
    const stranger = await db.newUser();
    const priv = await db.rpc(host, 'live_start', { p_title: 'Private', p_visibility: 'private', p_allowlist: [friend] });
    for (const fn of ['live_join', 'live_get_snapshot', 'live_media_access']) {
      await expectCode(db.rpc(stranger, fn, { p_live_id: priv.live_id }), 'LIVE_ACCESS_DENIED');
    }
    await expectCode(db.rpc(stranger, 'live_get_events_since', { p_live_id: priv.live_id, p_after_seq: 0 }), 'LIVE_ACCESS_DENIED');
    expect(await db.rpc(stranger, 'live_list_active')).toEqual([]);
    expect((await db.rpc(friend, 'live_join', { p_live_id: priv.live_id })).live_id).toBe(priv.live_id);
    await db.rpc(host, 'live_end', { p_live_id: priv.live_id });

    const fo = await db.rpc(host, 'live_start', { p_title: 'Followers', p_visibility: 'followers' });
    await expectCode(db.rpc(follower, 'live_join', { p_live_id: fo.live_id }), 'LIVE_ACCESS_DENIED');
    await db.rpc(follower, 'live_follow', { p_user_id: host });
    expect((await db.rpc(follower, 'live_join', { p_live_id: fo.live_id })).me.following_host).toBe(true);
  });
});

describe('Realtime private channels', () => {
  const readTopic = (uid: string, topic: string) =>
    db.as('authenticated', uid, `select count(*)::int as n from realtime.messages`, [], { 'realtime.topic': topic });

  it('only authorized users can read live:{id}; user:{id} is personal', async () => {
    await db.setEnv('development');
    await db.setFlag('live_v2', true);
    const host = await db.newUser();
    const friend = await db.newUser();
    const stranger = await db.newUser();
    const pub = await db.rpc(host, 'live_start', { p_title: 'Public' });
    expect((await readTopic(stranger, `live:${pub.live_id}`))[0].n).toBeGreaterThan(0);
    await db.rpc(host, 'live_kick', { p_live_id: pub.live_id, p_user_id: stranger });
    expect((await readTopic(stranger, `live:${pub.live_id}`))[0].n).toBe(0); // banned on (re)join
    await db.rpc(host, 'live_end', { p_live_id: pub.live_id });

    const priv = await db.rpc(host, 'live_start', { p_title: 'Private', p_visibility: 'private', p_allowlist: [friend] });
    expect((await readTopic(friend, `live:${priv.live_id}`))[0].n).toBeGreaterThan(0);
    expect((await readTopic(stranger, `live:${priv.live_id}`))[0].n).toBe(0);

    await db.rpc(friend, 'live_request_guest', { p_live_id: priv.live_id }); // notifies the host personally
    expect((await readTopic(host, `user:${host}`))[0].n).toBeGreaterThan(0);
    expect((await readTopic(stranger, `user:${host}`))[0].n).toBe(0);
    expect((await readTopic(stranger, 'live:not-a-uuid'))[0].n).toBe(0);
  });

  it('clients can never broadcast into live:/user: topics, even if another policy allows client broadcasts', async () => {
    const w = await world(db);
    const [v] = w.viewers;
    // Simulate an app-wide permissive policy (e.g. for a chat feature).
    await db.sql(`create policy test_allow_all_insert on realtime.messages for insert to authenticated with check (true)`);
    const insert = (topic: string) =>
      db.as('authenticated', v,
        `insert into realtime.messages (topic, extension, event, payload, private) values ($1, 'broadcast', 'BATTLE_RESULT', '{}'::jsonb, true)`,
        [topic], { 'realtime.topic': topic });
    await expect(insert(`live:${w.liveA}`)).rejects.toMatchObject(DENIED);
    await expect(insert(`user:${w.hostA}`)).rejects.toMatchObject(DENIED);
    await expect(insert('room:somewhere-else')).resolves.toBeDefined(); // unrelated topics unaffected
  });

  it('every LIVE broadcast is private and carries a full envelope', async () => {
    const w = await world(db);
    await gift(db, w.viewers[0], w.liveA, 'rose');
    const msgs = await db.sql(`select * from realtime.messages where topic like 'live:%'`);
    expect(msgs.length).toBeGreaterThan(0);
    for (const m of msgs) {
      expect(m.private).toBe(true);
      expect(Object.keys(m.payload).sort()).toEqual(
        ['actor_id', 'battle_id', 'event_id', 'event_type', 'live_id', 'payload', 'schema_version', 'seq', 'server_ts'].sort(),
      );
    }
  });
});
