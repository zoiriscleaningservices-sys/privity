import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Db, expectCode, gift, world } from './harness';

let db: Db;
beforeEach(async () => {
  db = await Db.create();
});
afterEach(async () => {
  await db.close();
});

const types = (evs: any[]) => evs.map((e) => e.event_type);

describe('LIVE lifecycle', () => {
  it('live_v2 is gated: off for everyone except admins and allow-listed testers', async () => {
    const user = await db.newUser();
    const tester = await db.newUser();
    const admin = await db.newUser();
    await db.makeAdmin(admin);
    await expectCode(db.rpc(user, 'live_start', { p_title: 'x' }), 'LIVE_V2_DISABLED');
    await db.sql(`update live.feature_flags set rules = jsonb_build_object('allow_users', jsonb_build_array($1::text)) where key = 'live_v2'`, [tester]);
    expect((await db.rpc(tester, 'live_start', { p_title: 'Tester' })).live_id).toBeTruthy();
    expect((await db.rpc(admin, 'live_start', { p_title: 'Admin' })).live_id).toBeTruthy();
    await expectCode(db.rpc(user, 'live_start', { p_title: 'x' }), 'LIVE_V2_DISABLED');
  });

  it('start validates input, emits LIVE_STARTED as seq 1, creates the host wallet and returns a snapshot', async () => {
    await db.setFlag('live_v2', true);
    const host = await db.newUser(undefined, 'Starry');
    await expectCode(db.rpc(host, 'live_start', { p_title: '   ' }), 'INVALID_TITLE');
    await expectCode(db.rpc(host, 'live_start', { p_title: 'ok', p_visibility: 'secret' }), 'INVALID_VISIBILITY');
    const r = await db.rpc(host, 'live_start', { p_title: '  Late\u0007 night\nset  ' });
    expect(r.snapshot).toMatchObject({ status: 'live', title: 'Late night set', last_seq: 1, viewer_count: 0, battle: null, me: { is_host: true } });
    const [ev] = await db.events(r.live_id);
    expect(ev).toMatchObject({ seq: 1, event_type: 'LIVE_STARTED', payload: { title: 'Late night set', host: { id: host, display_name: 'Starry' } } });
    expect(await db.wallet(host)).toBeTruthy();
    await expectCode(db.rpc(host, 'live_start', { p_title: 'again' }), 'ALREADY_LIVE');
  });

  it('a user without a profile cannot go live', async () => {
    await db.setFlag('live_v2', true);
    const u = await db.newUser();
    await db.sql(`delete from public.profiles where id = $1`, [u]);
    await expectCode(db.rpc(u, 'live_start', { p_title: 'x' }), 'PROFILE_REQUIRED');
  });

  it('stale hosts are ended by the tick; a stale own LIVE is auto-ended on restart', async () => {
    const w = await world(db);
    await db.sql(`update live.sessions set host_heartbeat_at = now() - interval '91 seconds' where id = $1`, [w.liveA]);
    const t = await db.tick();
    expect(t.stale_ended).toBe(1);
    const evs = await db.events(w.liveA);
    expect(evs.at(-1)).toMatchObject({ event_type: 'LIVE_ENDED', payload: { reason: 'stale' } });

    await db.sql(`update live.sessions set host_heartbeat_at = now() - interval '91 seconds' where id = $1`, [w.liveB]);
    const again = await db.rpc(w.hostB, 'live_start', { p_title: 'Back' });
    expect(again.live_id).not.toBe(w.liveB);
    expect((await db.one(`select status, end_reason from live.sessions where id = $1`, [w.liveB]))).toEqual({ status: 'ended', end_reason: 'stale' });
  });

  it('host heartbeat keeps the LIVE alive and only works for the host', async () => {
    const w = await world(db);
    const hb = await db.rpc(w.hostA, 'live_heartbeat_host', { p_live_id: w.liveA });
    expect(hb).toMatchObject({ ok: true, last_seq: 1 });
    await expectCode(db.rpc(w.viewers[0], 'live_heartbeat_host', { p_live_id: w.liveA }), 'LIVE_NOT_ACTIVE');
  });

  it('ending is idempotent and releases guests/viewers', async () => {
    const w = await world(db);
    const [g, v] = w.viewers;
    await db.rpc(v, 'live_join', { p_live_id: w.liveA });
    await db.rpc(g, 'live_request_guest', { p_live_id: w.liveA });
    await db.rpc(w.hostA, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g, p_accept: true });
    expect((await db.rpc(w.hostA, 'live_end', { p_live_id: w.liveA })).ended).toBe(true);
    expect((await db.rpc(w.hostA, 'live_end', { p_live_id: w.liveA })).ended).toBe(false);
    expect((await db.events(w.liveA, ['LIVE_ENDED'])).length).toBe(1);
    expect((await db.one(`select count(*)::int as n from live.guests where status = 'accepted'`)).n).toBe(0);
    expect((await db.one(`select count(*)::int as n from live.viewers where left_at is null`)).n).toBe(0);
    const snap = await db.rpc(v, 'live_join', { p_live_id: w.liveA });
    expect(snap.status).toBe('ended');
  });
});

describe('viewers and presence (batched by the tick)', () => {
  it('joins are batched into VIEWERS_JOINED once; counts and peaks are authoritative', async () => {
    const w = await world(db, { viewers: 3 });
    const [v1, v2, v3] = w.viewers;
    await db.rpc(v3, 'live_follow', { p_user_id: w.hostA });
    for (const v of w.viewers) await db.rpc(v, 'live_join', { p_live_id: w.liveA });
    await db.rpc(w.hostA, 'live_join', { p_live_id: w.liveA }); // the host is not a viewer
    await db.tick();
    await db.tick();
    const joined = await db.events(w.liveA, ['VIEWERS_JOINED']);
    expect(joined.length).toBe(1);
    expect(joined[0].payload.count).toBe(3);
    expect(joined[0].payload.sample[0].id).toBe(v3); // followers first
    expect((await db.events(w.liveA, ['VIEWER_COUNT'])).map((e) => e.payload)).toEqual([{ count: 3, peak: 3 }]);

    // leave + quick rejoin is not a new join
    await db.rpc(v1, 'live_leave', { p_live_id: w.liveA });
    await db.rpc(v1, 'live_join', { p_live_id: w.liveA });
    await db.tick();
    expect((await db.events(w.liveA, ['VIEWERS_JOINED'])).length).toBe(1);

    // stale viewers drop out
    await db.sql(`update live.viewers set last_seen_at = now() - interval '50 seconds' where user_id = any($1)`, [[v1, v2]]);
    await db.tick();
    expect((await db.events(w.liveA, ['VIEWER_COUNT'])).map((e) => e.payload)).toEqual([{ count: 3, peak: 3 }, { count: 1, peak: 3 }]);
    // heartbeat brings a viewer back
    const hb = await db.rpc(v2, 'live_heartbeat', { p_live_id: w.liveA });
    expect(hb).toMatchObject({ ok: true, status: 'live' });
    await db.tick();
    expect((await db.events(w.liveA, ['VIEWER_COUNT'])).at(-1).payload).toEqual({ count: 2, peak: 3 });
  });

  it('viewer milestones come from the published show config and fire once', async () => {
    const w = await world(db, { viewers: 3 });
    const admin = await db.newUser();
    await db.makeAdmin(admin);
    const cfg = (await db.rpc(admin, 'live_get_show_config')).config;
    cfg.detectors.viewers.milestones = [2, 3];
    const pub = await db.rpc(admin, 'live_admin_publish_show_config', { p_config: cfg });
    expect(pub.version).toBe(2);
    for (const live of [w.liveA, w.liveB]) {
      expect((await db.events(live, ['CONFIG_UPDATED'])).map((e) => e.payload)).toEqual([{ version: 2 }]);
    }
    for (const v of w.viewers) await db.rpc(v, 'live_join', { p_live_id: w.liveA });
    await db.tick();
    await db.tick();
    expect((await db.events(w.liveA, ['VIEWER_MILESTONE'])).map((e) => e.payload)).toEqual([{ milestone: 3, count: 3 }]);
    expect((await db.one(`select viewer_milestones_reached from live.sessions where id = $1`, [w.liveA])).viewer_milestones_reached).toEqual([2, 3]);
  });

  it('heartbeat re-checks access every time', async () => {
    const w = await world(db);
    const [v] = w.viewers;
    await db.rpc(v, 'live_join', { p_live_id: w.liveA });
    await db.rpc(w.hostA, 'live_block', { p_user_id: v });
    expect(await db.rpc(v, 'live_heartbeat', { p_live_id: w.liveA })).toMatchObject({ ok: false, code: 'LIVE_ACCESS_DENIED' });
  });
});

describe('event replay and gap recovery', () => {
  it('get_events_since pages a contiguous range; the snapshot last_seq matches the log', async () => {
    const w = await world(db, { viewers: 1 });
    for (let i = 0; i < 12; i++) await gift(db, w.viewers[0], w.liveA, 'rose', 1);
    const snap = await db.rpc(w.viewers[0], 'live_get_snapshot', { p_live_id: w.liveA });
    const all = await db.events(w.liveA);
    expect(snap.last_seq).toBe(all.length);
    expect(all.at(-1).seq).toBe(all.length);

    const page1 = await db.rpc(w.viewers[0], 'live_get_events_since', { p_live_id: w.liveA, p_after_seq: 2, p_limit: 5 });
    expect(page1.events.map((e: any) => e.seq)).toEqual([3, 4, 5, 6, 7]);
    expect(page1).toMatchObject({ has_more: true, reset_required: false, last_seq: snap.last_seq });
    const rest = await db.rpc(w.viewers[0], 'live_get_events_since', { p_live_id: w.liveA, p_after_seq: 7, p_limit: 200 });
    expect(rest.events.at(-1).seq).toBe(snap.last_seq);
    expect(rest.has_more).toBe(false);
    expect(rest.events).toEqual(all.slice(7));
  });

  it('asks for a snapshot when the requested range was pruned', async () => {
    const w = await world(db, { viewers: 1 });
    for (let i = 0; i < 3; i++) await gift(db, w.viewers[0], w.liveA, 'rose', 1);
    await db.sql(`delete from live.events where live_id = $1 and seq <= 2`, [w.liveA]);
    const r = await db.rpc(w.viewers[0], 'live_get_events_since', { p_live_id: w.liveA, p_after_seq: 0 });
    expect(r).toMatchObject({ reset_required: true, events: [] });
  });

  it('the tick prunes the replay log of LIVEs ended more than 24 h ago', async () => {
    const w = await world(db);
    await db.rpc(w.hostA, 'live_end', { p_live_id: w.liveA });
    await db.sql(`update live.sessions set ended_at = now() - interval '25 hours' where id = $1`, [w.liveA]);
    const t = await db.tick();
    expect(t.events_pruned).toBeGreaterThan(0);
    expect(await db.events(w.liveA)).toEqual([]);
    expect((await db.events(w.liveB)).length).toBeGreaterThan(0);
  });
});

describe('comments and moderation', () => {
  it('comments are cleaned, length-checked, rate-limited and emitted', async () => {
    const w = await world(db);
    const [v] = w.viewers;
    const r = await db.rpc(v, 'live_comment', { p_live_id: w.liveA, p_text: '  hello\u202E there\n ' });
    expect(r.ok).toBe(true);
    const [ev] = await db.events(w.liveA, ['COMMENT_CREATED']);
    expect(ev.payload).toMatchObject({ comment_id: r.comment_id, text: 'hello there', author: { id: v } });
    await expectCode(db.rpc(v, 'live_comment', { p_live_id: w.liveA, p_text: 'again' }), 'RATE_LIMITED');
    await expectCode(db.rpc(v, 'live_comment', { p_live_id: w.liveA, p_text: '   ' }), 'INVALID_COMMENT');
    await expectCode(db.rpc(v, 'live_comment', { p_live_id: w.liveA, p_text: 'x'.repeat(301) }), 'INVALID_COMMENT');
    // burst cap: 5 per 10 s even when spaced > 1 s
    await db.sql(`delete from live.comments`);
    for (let i = 0; i < 5; i++) {
      await db.rpc(v, 'live_comment', { p_live_id: w.liveA, p_text: `m${i}` });
      await db.sql(`update live.comments set created_at = created_at - interval '1100 milliseconds'`);
    }
    await expectCode(db.rpc(v, 'live_comment', { p_live_id: w.liveA, p_text: 'm6' }), 'RATE_LIMITED');
    // parallel requests cannot bypass the limiter
    await db.sql(`delete from live.comments`);
    const v2 = w.viewers[1];
    const rs = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => db.rpc(v2, 'live_comment', { p_live_id: w.liveA, p_text: `p${i}` })));
    expect(rs.filter((x) => x.status === 'fulfilled').length).toBe(1);
  });

  it('host/moderators can delete, mute, disable comments and remove users', async () => {
    const w = await world(db);
    const [v, mod] = w.viewers;
    const c = await db.rpc(v, 'live_comment', { p_live_id: w.liveA, p_text: 'spam' });
    await expectCode(db.rpc(w.viewers[2], 'live_delete_comment', { p_comment_id: c.comment_id }), 'NOT_AUTHORIZED');
    await db.rpc(w.hostA, 'live_delete_comment', { p_comment_id: c.comment_id });
    expect((await db.events(w.liveA, ['COMMENT_DELETED']))[0].payload).toEqual({ comment_id: c.comment_id });
    expect((await db.rpc(v, 'live_get_snapshot', { p_live_id: w.liveA })).recent_comments).toEqual([]);

    await db.rpc(w.hostA, 'live_mute', { p_live_id: w.liveA, p_user_id: v, p_minutes: 5 });
    await expectCode(db.rpc(v, 'live_comment', { p_live_id: w.liveA, p_text: 'hi' }), 'MUTED');
    expect((await db.rpc(v, 'live_get_snapshot', { p_live_id: w.liveA })).me.muted_until).toBeTruthy();
    expect((await db.events(w.liveA, ['MODERATION_NOTICE']))[0].payload).toMatchObject({ action: 'muted', target: { id: v } });
    await expectCode(db.rpc(w.viewers[2], 'live_mute', { p_live_id: w.liveA, p_user_id: v }), 'NOT_AUTHORIZED');
    await expectCode(db.rpc(w.hostA, 'live_mute', { p_live_id: w.liveA, p_user_id: w.hostA }), 'INVALID_TARGET');

    await db.makeAdmin(mod, 'moderator');
    await db.rpc(mod, 'live_set_comments_enabled', { p_live_id: w.liveA, p_enabled: false });
    await expectCode(db.rpc(w.viewers[2], 'live_comment', { p_live_id: w.liveA, p_text: 'hey' }), 'COMMENTS_DISABLED');
    expect((await db.rpc(w.hostA, 'live_comment', { p_live_id: w.liveA, p_text: 'host can still talk' })).ok).toBe(true);

    await db.rpc(w.hostA, 'live_kick', { p_live_id: w.liveA, p_user_id: w.viewers[2], p_reason: 'abuse' });
    await expectCode(db.rpc(w.viewers[2], 'live_join', { p_live_id: w.liveA }), 'LIVE_ACCESS_DENIED');
    // the ban is per host: other LIVEs are unaffected; unban restores access
    expect((await db.rpc(w.viewers[2], 'live_join', { p_live_id: w.liveB })).live_id).toBe(w.liveB);
    await db.rpc(w.hostA, 'live_unban', { p_user_id: w.viewers[2] });
    expect((await db.rpc(w.viewers[2], 'live_join', { p_live_id: w.liveA })).live_id).toBe(w.liveA);
  });

  it('admins/moderators can end a LIVE; it is audited', async () => {
    const w = await world(db);
    const mod = await db.newUser();
    await db.makeAdmin(mod, 'moderator');
    await expectCode(db.rpc(w.viewers[0], 'live_admin_end_live', { p_live_id: w.liveA }), 'NOT_AUTHORIZED');
    await db.rpc(mod, 'live_admin_end_live', { p_live_id: w.liveA });
    expect((await db.events(w.liveA)).at(-1).payload).toEqual({ reason: 'moderation' });
    expect((await db.one(`select action, actor_id from live.admin_audit_log`))).toEqual({ action: 'end_live', actor_id: mod });
  });
});

describe('guests', () => {
  it('request → host notified → accept assigns the lowest free slot; slots are capped', async () => {
    const w = await world(db, { viewers: 5 });
    const [g1, g2, g3, g4] = w.viewers;
    for (const g of [g1, g2, g3, g4]) await db.rpc(g, 'live_request_guest', { p_live_id: w.liveA });
    expect((await db.rpc(w.hostA, 'live_list_guest_requests', { p_live_id: w.liveA })).length).toBe(4);
    expect((await db.realtime(`user:${w.hostA}`)).filter((m) => m.event === 'GUEST_REQUESTED').length).toBe(4);
    await expectCode(db.rpc(g1, 'live_list_guest_requests', { p_live_id: w.liveA }), 'NOT_AUTHORIZED');

    const slots = [];
    for (const g of [g1, g2, g3]) slots.push((await db.rpc(w.hostA, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g, p_accept: true })).slot);
    expect(slots).toEqual([1, 2, 3]);
    await expectCode(db.rpc(w.hostA, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g4, p_accept: true }), 'GUEST_SLOTS_FULL');

    await db.rpc(g2, 'live_leave_guest', { p_live_id: w.liveA });
    expect((await db.rpc(w.hostA, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g4, p_accept: true })).slot).toBe(2);
    expect(types(await db.events(w.liveA, ['GUEST_JOINED', 'GUEST_LEFT']))).toEqual(['GUEST_JOINED', 'GUEST_JOINED', 'GUEST_JOINED', 'GUEST_LEFT', 'GUEST_JOINED']);
    const snap = await db.rpc(g1, 'live_get_snapshot', { p_live_id: w.liveA });
    expect(snap.guests.map((g: any) => [g.id, g.slot])).toEqual([[g1, 1], [g4, 2], [g3, 3]]);
    expect(snap.me.guest_status).toBe('accepted');
  });

  it('decline has a cooldown; removed guests cannot re-request in that LIVE', async () => {
    const w = await world(db);
    const [g] = w.viewers;
    await db.rpc(g, 'live_request_guest', { p_live_id: w.liveA });
    await db.rpc(w.hostA, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g, p_accept: false });
    await expectCode(db.rpc(g, 'live_request_guest', { p_live_id: w.liveA }), 'GUEST_REQUEST_COOLDOWN');
    await db.sql(`update live.guests set decided_at = decided_at - interval '61 seconds'`);
    await db.rpc(g, 'live_request_guest', { p_live_id: w.liveA });
    await db.rpc(w.hostA, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: g, p_accept: true });
    await db.rpc(w.hostA, 'live_remove_guest', { p_live_id: w.liveA, p_user_id: g });
    await expectCode(db.rpc(g, 'live_request_guest', { p_live_id: w.liveA }), 'GUEST_REMOVED_BY_HOST');
    // a host who is live elsewhere cannot be a guest
    await expectCode(db.rpc(w.hostB, 'live_request_guest', { p_live_id: w.liveA }), 'GUEST_UNAVAILABLE');
  });
});

describe('follow / block (LIVE-first, app-wide model)', () => {
  it('FOLLOW_RECEIVED once per follower per LIVE; FOLLOW_MILESTONE from config', async () => {
    const w = await world(db, { viewers: 3 });
    const admin = await db.newUser();
    await db.makeAdmin(admin);
    const cfg = (await db.rpc(admin, 'live_get_show_config')).config;
    cfg.detectors.follows.milestones = [2];
    await db.rpc(admin, 'live_admin_publish_show_config', { p_config: cfg });

    const [f1, f2] = w.viewers;
    await db.rpc(f1, 'live_follow', { p_user_id: w.hostA });
    await db.rpc(f1, 'live_unfollow', { p_user_id: w.hostA });
    await db.rpc(f1, 'live_follow', { p_user_id: w.hostA }); // follow/unfollow loop: no spam
    await db.rpc(f2, 'live_follow', { p_user_id: w.hostA });
    expect((await db.events(w.liveA, ['FOLLOW_RECEIVED'])).map((e) => e.payload.follower.id)).toEqual([f1, f2]);
    expect((await db.events(w.liveA, ['FOLLOW_MILESTONE'])).map((e) => e.payload)).toEqual([{ milestone: 2, count: 2 }]);
    await expectCode(db.rpc(f1, 'live_follow', { p_user_id: f1 }), 'INVALID_TARGET');
  });

  it('block removes follows both ways, kicks the user from my LIVE and prevents re-follow/re-join', async () => {
    const w = await world(db);
    const [v] = w.viewers;
    await db.rpc(v, 'live_follow', { p_user_id: w.hostA });
    await db.rpc(v, 'live_request_guest', { p_live_id: w.liveA });
    await db.rpc(w.hostA, 'live_respond_guest', { p_live_id: w.liveA, p_user_id: v, p_accept: true });
    await db.rpc(w.hostA, 'live_block', { p_user_id: v });
    expect((await db.one(`select count(*)::int as n from social.follows`)).n).toBe(0);
    expect((await db.events(w.liveA, ['GUEST_REMOVED']))[0].payload.guest.id).toBe(v);
    await expectCode(db.rpc(v, 'live_follow', { p_user_id: w.hostA }), 'BLOCKED');
    await expectCode(db.rpc(v, 'live_join', { p_live_id: w.liveA }), 'LIVE_ACCESS_DENIED');
    await db.rpc(w.hostA, 'live_unblock', { p_user_id: v });
    expect((await db.rpc(v, 'live_join', { p_live_id: w.liveA })).live_id).toBe(w.liveA);
  });
});
