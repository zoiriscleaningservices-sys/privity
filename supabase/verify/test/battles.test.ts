import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Db, expectCode, gift, startBattle, world } from './harness';
import { BUILTIN_FORMATS, compileTimeline, validateFormat } from '../../../apps/admin/src/live/battle/timeline';

let db: Db;
beforeEach(async () => {
  db = await Db.create();
});
afterEach(async () => {
  await db.close();
});

// classic_double timeline indices
const CD = { intro: 0, countdown: 1, normal1: 2, double: 3, normal2: 4 };
// three_pulls timeline indices
const TP = { intro: 0, countdown: 1, pull1: 2, break1: 3, pull2: 4, break2: 5, pull3: 6 };

const types = (evs: any[]) => evs.map((e) => e.event_type);

describe('battle formats: SQL ⇔ TypeScript parity', () => {
  it.each(Object.keys(BUILTIN_FORMATS))('compile_timeline_json(%s) equals compileTimeline()', async (id) => {
    const introAt = '2026-10-04T12:00:00.123Z';
    const sqlDef = (await db.one(`select definition from live.battle_formats where id = $1`, [id])).definition;
    expect(sqlDef).toEqual(BUILTIN_FORMATS[id]);
    const sql = (await db.one(`select live.compile_timeline_json($1::jsonb, $2::timestamptz) as t`, [JSON.stringify(sqlDef), introAt])).t;
    expect(sql).toEqual(compileTimeline(BUILTIN_FORMATS[id], Date.parse(introAt)));
  });

  it('validate_format reports the same errors as validateFormat()', async () => {
    const bad: any[] = [
      { intro_ms: 3500, countdown_s: 3, scoring: 'total', final_countdown_s: 30, segments: [{ kind: 'normal', s: 10 }] },
      { intro_ms: 3500, countdown_s: 3, scoring: 'pulls', final_countdown_s: 5, segments: [{ kind: 'normal', s: 60 }] },
      { intro_ms: 3500, countdown_s: 3, scoring: 'total', final_countdown_s: 5,
        segments: [{ kind: 'break', s: 10 }, { kind: 'bonus', s: 30, multiplier: 1, warning_s: 20 }, { kind: 'normal', s: 30 }] },
      { intro_ms: 3500, countdown_s: 3, scoring: 'pulls', final_countdown_s: 5,
        segments: [{ kind: 'pull', s: 30, pull: 2 }, { kind: 'normal', s: 30 }] },
      { intro_ms: 20000, countdown_s: 30, scoring: 'total', final_countdown_s: 500, segments: [{ kind: 'bonus', s: 60, multiplier: 9 }] },
    ];
    for (const def of bad) {
      const sql = (await db.one(`select live.validate_format($1::jsonb) as e`, [JSON.stringify(def)])).e;
      expect(sql).toEqual(validateFormat(def));
      expect(sql.length).toBeGreaterThan(0);
    }
    for (const def of Object.values(BUILTIN_FORMATS)) {
      expect((await db.one(`select live.validate_format($1::jsonb) as e`, [JSON.stringify(def)])).e).toEqual([]);
    }
  });

  it('segment lookup uses [starts_at, ends_at) at millisecond precision', async () => {
    const w = await world(db);
    const b = await startBattle(db, w);
    const seg = b.timeline[CD.double];
    const at = async (iso: string, deltaMs: number) =>
      (await db.one(`select (live.segment_at($1, $2::timestamptz + make_interval(secs => $3 / 1000.0))).idx as idx`, [b.battle_id, iso, deltaMs])).idx;
    expect(await at(seg.starts_at, -1)).toBe(CD.normal1);
    expect(await at(seg.starts_at, 0)).toBe(CD.double);
    expect(await at(seg.ends_at, -1)).toBe(CD.double);
    expect(await at(seg.ends_at, 0)).toBe(CD.normal2);
    expect(await at(b.ends_at, -1)).toBe(CD.normal2);
    expect(await at(b.ends_at, 0)).toBeNull();
  });
});

describe('battle lifecycle', () => {
  it('invite is private to the hosts; accept compiles + freezes the timeline and streams BATTLE_ACCEPTED to both LIVEs', async () => {
    const w = await world(db);
    const inv = await db.rpc(w.hostA, 'live_battle_invite', { p_target_live_id: w.liveB, p_format_id: 'classic_double' });
    expect(inv.status).toBe('invited');
    expect((await db.events(w.liveA, ['BATTLE_INVITED'])).length).toBe(0);
    expect((await db.realtime(`user:${w.hostB}`)).map((m) => m.event)).toContain('BATTLE_INVITED');
    const listed = await db.rpc(w.hostB, 'live_list_battle_invites');
    expect(listed[0]).toMatchObject({ incoming: true, battle: { battle_id: inv.battle_id } });

    await expectCode(db.rpc(w.hostA, 'live_battle_respond', { p_battle_id: inv.battle_id, p_accept: true }), 'NOT_AUTHORIZED');
    await expectCode(db.rpc(w.viewers[0], 'live_battle_respond', { p_battle_id: inv.battle_id, p_accept: true }), 'NOT_AUTHORIZED');

    const acc = await db.rpc(w.hostB, 'live_battle_respond', { p_battle_id: inv.battle_id, p_accept: true });
    const b = acc.battle;
    expect(b).toMatchObject({ status: 'accepted', scoring: 'total', score_a: 0, score_b: 0, score_version: 0 });
    expect(b.timeline.map((s: any) => s.kind)).toEqual(['intro', 'countdown', 'normal', 'bonus', 'normal']);
    expect(Date.parse(b.ends_at) - Date.parse(b.starts_at)).toBe(300_000);
    expect(Date.parse(b.starts_at) - Date.parse(b.intro_at)).toBe(6_500);

    for (const live of [w.liveA, w.liveB]) {
      const [ev] = await db.events(live, ['BATTLE_ACCEPTED']);
      expect(ev.battle_id).toBe(b.battle_id);
      expect(ev.payload.battle).toEqual(b);
      const snap = await db.rpc(w.viewers[0], 'live_join', { p_live_id: live });
      expect(snap.battle.battle_id).toBe(b.battle_id);
    }
  });

  it('enforces battle eligibility on the server', async () => {
    const w = await world(db);
    await expectCode(db.rpc(w.viewers[0], 'live_battle_invite', { p_target_live_id: w.liveB }), 'NOT_LIVE');
    await expectCode(db.rpc(w.hostA, 'live_battle_invite', { p_target_live_id: w.liveA }), 'INVALID_TARGET');
    await expectCode(db.rpc(w.hostA, 'live_battle_invite', { p_target_live_id: w.liveB, p_format_id: 'nope' }), 'FORMAT_UNAVAILABLE');
    await db.rpc(w.hostA, 'live_battle_invite', { p_target_live_id: w.liveB });
    await expectCode(db.rpc(w.hostB, 'live_battle_invite', { p_target_live_id: w.liveA }), 'INVITE_PENDING');

    const db2 = db;
    const hostC = await db2.newUser();
    const c = await db2.rpc(hostC, 'live_start', { p_title: 'C', p_visibility: 'followers' });
    const hostD = await db2.newUser();
    const d = await db2.rpc(hostD, 'live_start', { p_title: 'D' });
    await expectCode(db2.rpc(hostD, 'live_battle_invite', { p_target_live_id: c.live_id }), 'BATTLE_REQUIRES_PUBLIC');
    await db2.rpc(hostD, 'live_block', { p_user_id: w.hostB });
    await expectCode(db2.rpc(hostD, 'live_battle_invite', { p_target_live_id: w.liveB }), 'TARGET_UNAVAILABLE');
    void d;
  });

  it('decline → cancelled with cooldown; invites expire via the tick', async () => {
    const w = await world(db);
    const inv = await db.rpc(w.hostA, 'live_battle_invite', { p_target_live_id: w.liveB });
    expect(await db.rpc(w.hostB, 'live_battle_respond', { p_battle_id: inv.battle_id, p_accept: false })).toMatchObject({ status: 'cancelled' });
    await expectCode(db.rpc(w.hostA, 'live_battle_invite', { p_target_live_id: w.liveB }), 'INVITE_COOLDOWN');

    await db.sql(`update live.battles set created_at = created_at - interval '31 seconds' where id = $1`, [inv.battle_id]);
    const inv2 = await db.rpc(w.hostA, 'live_battle_invite', { p_target_live_id: w.liveB });
    await db.advanceBattle(inv2.battle_id, 31_000);
    const t = await db.tick();
    expect(t.invites_expired).toBe(1);
    await expectCode(db.rpc(w.hostB, 'live_battle_respond', { p_battle_id: inv2.battle_id, p_accept: true }), 'BATTLE_INVITE_NOT_PENDING');
  });

  it('respond after expiry returns BATTLE_INVITE_EXPIRED', async () => {
    const w = await world(db);
    const inv = await db.rpc(w.hostA, 'live_battle_invite', { p_target_live_id: w.liveB });
    await db.advanceBattle(inv.battle_id, 31_000);
    expect(await db.rpc(w.hostB, 'live_battle_respond', { p_battle_id: inv.battle_id, p_accept: true })).toMatchObject({
      ok: false, code: 'BATTLE_INVITE_EXPIRED',
    });
    expect((await db.one(`select status from live.battles where id = $1`, [inv.battle_id])).status).toBe('expired');
  });

  it('cancel is allowed only before scoring starts', async () => {
    const w = await world(db);
    const b = await startBattle(db, w);
    await db.rpc(w.hostA, 'live_battle_cancel', { p_battle_id: b.battle_id });
    for (const live of [w.liveA, w.liveB]) {
      const [ev] = await db.events(live, ['BATTLE_CANCELLED']);
      expect(ev.payload).toEqual({ battle_id: b.battle_id, reason: 'cancelled' });
    }
    const b2 = await startBattle(db, w);
    await db.moveIntoSegment(b2.battle_id, CD.normal1);
    await expectCode(db.rpc(w.hostB, 'live_battle_cancel', { p_battle_id: b2.battle_id }), 'BATTLE_ALREADY_STARTED');
  });
});

describe('battle scoring is decided by the server clock (D6: never a silent zero)', () => {
  it('rejects auto-mode gifts outside scoring with an explicit code and writes nothing', async () => {
    const w = await world(db);
    const [v] = w.viewers;
    const b = await startBattle(db, w);

    // intro / countdown
    let r = await gift(db, v, w.liveA, 'rose', 1);
    expect(r).toMatchObject({ ok: false, code: 'BATTLE_NOT_STARTED', battle_id: b.battle_id });
    expect((await db.wallet(v)).test_coins).toBe(1_000_000);

    // explicit LIVE gift outside the battle is allowed and clearly marked
    r = await gift(db, v, w.liveA, 'rose', 1, { p_battle_mode: 'outside_battle' });
    expect(r).toMatchObject({ ok: true, battle_outcome: 'excluded', battle_points: 0, battle_id: b.battle_id });
    expect(r.message).toMatch(/did not affect the battle score/);

    // scoring: outside_battle is refused (gifts count while scoring)
    await db.moveIntoSegment(b.battle_id, CD.normal1);
    r = await gift(db, v, w.liveA, 'rose', 1, { p_battle_mode: 'outside_battle' });
    expect(r).toMatchObject({ ok: false, code: 'BATTLE_SCORING_ACTIVE' });

    // stale client battle id
    r = await gift(db, v, w.liveA, 'rose', 1, { p_expected_battle_id: '00000000-0000-0000-0000-000000000000' });
    expect(r).toMatchObject({ ok: false, code: 'BATTLE_CHANGED' });

    // after ends_at but before the tick finalized: BATTLE_LOCKED, nothing written
    await db.moveToEnd(b.battle_id, -10);
    const before = await db.one(`select score_a, score_b, score_version from live.battles where id = $1`, [b.battle_id]);
    const bal = (await db.wallet(v)).test_coins;
    r = await gift(db, v, w.liveA, 'super-galaxy', 1);
    expect(r).toMatchObject({ ok: false, code: 'BATTLE_LOCKED', battle_id: b.battle_id });
    expect(r.message).toBe('Battle ended — this gift will not affect the battle score.');
    expect((await db.wallet(v)).test_coins).toBe(bal);
    expect(await db.one(`select score_a, score_b, score_version from live.battles where id = $1`, [b.battle_id])).toEqual(before);

    // the user may then explicitly send it as a LIVE gift; it is recorded as excluded
    r = await gift(db, v, w.liveA, 'super-galaxy', 1, { p_battle_mode: 'outside_battle' });
    expect(r).toMatchObject({ ok: true, battle_outcome: 'excluded', battle_points: 0 });
    const [ev] = (await db.events(w.liveA, ['GIFT_RECEIVED'])).slice(-1);
    expect(ev.payload).toMatchObject({ battle_outcome: 'excluded', battle_points: 0, battle_id: null, multiplier: 0 });
    expect(await db.one(`select score_a, score_b, score_version from live.battles where id = $1`, [b.battle_id])).toEqual(before);

    // finalized (results on screen for 60 s) → still BATTLE_LOCKED in auto mode
    await db.tick();
    expect((await db.one(`select status from live.battles where id = $1`, [b.battle_id])).status).toBe('finalized');
    r = await gift(db, v, w.liveA, 'rose', 1);
    expect(r).toMatchObject({ ok: false, code: 'BATTLE_LOCKED' });
    // after the result window, gifts are ordinary LIVE gifts again (no battle attached)
    await db.sql(`update live.battles set finalized_at = finalized_at - interval '61 seconds' where id = $1`, [b.battle_id]);
    r = await gift(db, v, w.liveA, 'rose', 1);
    expect(r).toMatchObject({ ok: true, battle_outcome: 'no_battle' });
    // …unless the client still believes the battle is on screen
    r = await gift(db, v, w.liveA, 'rose', 1, { p_expected_battle_id: b.battle_id });
    expect(r).toMatchObject({ ok: false, code: 'BATTLE_LOCKED' });
  });

  it('scores normal ×1 and Double ×2; both streams get absolute BATTLE_SCORE with increasing score_version', async () => {
    const w = await world(db);
    const [v1, v2] = w.viewers;
    const b = await startBattle(db, w);
    await db.moveIntoSegment(b.battle_id, CD.normal1);
    let r = await gift(db, v1, w.liveA, 'tropical-mosquito', 1);
    expect(r).toMatchObject({ ok: true, battle_outcome: 'counted', battle_points: 250, multiplier: 1, battle_side: 'a' });

    await db.moveIntoSegment(b.battle_id, CD.double);
    r = await gift(db, v2, w.liveB, 'tropical-mosquito', 1);
    expect(r).toMatchObject({ ok: true, battle_points: 500, multiplier: 2, battle_side: 'b' });

    for (const live of [w.liveA, w.liveB]) {
      const scores = await db.events(live, ['BATTLE_SCORE']);
      expect(scores.map((e) => [e.payload.score_a, e.payload.score_b, e.payload.score_version])).toEqual([
        [250, 0, 1],
        [250, 500, 2],
      ]);
      expect(scores[1].payload.last_contribution).toMatchObject({ side: 'b', points: 500, sender: { id: v2 } });
    }
    const contributions = await db.sql(`select side, base_points, multiplier, points, timeline_idx from live.battle_contributions order by id`);
    expect(contributions).toEqual([
      { side: 'a', base_points: 250, multiplier: 1, points: 250, timeline_idx: CD.normal1 },
      { side: 'b', base_points: 250, multiplier: 2, points: 500, timeline_idx: CD.double },
    ]);
  });
});

describe('show tick: phases, Double, final countdown, finalization', () => {
  it('emits the complete classic_double sequence exactly once, on both streams', async () => {
    const w = await world(db);
    const b = await startBattle(db, w);
    const id = b.battle_id;
    const step = async (fn: () => Promise<void>) => {
      await fn();
      await db.tick();
    };
    await step(() => db.moveIntoSegment(id, CD.intro));
    await step(() => db.moveIntoSegment(id, CD.countdown));
    await step(() => db.moveIntoSegment(id, CD.normal1));
    expect((await db.one(`select status from live.battles where id = $1`, [id])).status).toBe('live');
    await step(() => db.moveIntoSegment(id, CD.double, -29_000)); // inside the 30 s warning window
    await db.tick(); // idempotent: no duplicate warning
    await step(() => db.moveIntoSegment(id, CD.double));
    await step(() => db.moveIntoSegment(id, CD.normal2));
    await step(() => db.moveToEnd(id, 29_000)); // final 30 s
    await db.tick();
    await step(() => db.moveToEnd(id, -5));
    await db.tick();

    for (const live of [w.liveA, w.liveB]) {
      const evs = (await db.events(live)).filter((e) => e.battle_id === id && e.event_type !== 'BATTLE_ACCEPTED');
      expect(types(evs)).toEqual([
        'BATTLE_PHASE_CHANGED', // intro
        'BATTLE_PHASE_CHANGED', // countdown
        'BATTLE_PHASE_CHANGED', // normal
        'DOUBLE_WARNING',
        'BATTLE_PHASE_CHANGED', // bonus
        'DOUBLE_STARTED',
        'DOUBLE_ENDED',
        'BATTLE_PHASE_CHANGED', // normal
        'FINAL_COUNTDOWN_STARTED',
        'BATTLE_ENDED',
        'BATTLE_RESULT',
      ]);
      expect(evs.filter((e) => e.event_type === 'BATTLE_PHASE_CHANGED').map((e) => e.payload.kind)).toEqual([
        'intro', 'countdown', 'normal', 'bonus', 'normal',
      ]);
      const warn = evs.find((e) => e.event_type === 'DOUBLE_WARNING');
      expect(warn.payload).toEqual({ battle_id: id, segment_idx: CD.double, starts_at: expect.any(String), multiplier: 2 });
      const result = evs.find((e) => e.event_type === 'BATTLE_RESULT');
      expect(result.payload.result).toMatchObject({ winner_side: null, final_a: 0, final_b: 0, pull_wins: null, forfeit_side: null });
    }
  });

  it('never announces a stale Double warning or skipped phases after a scheduler gap', async () => {
    const w = await world(db);
    const b = await startBattle(db, w);
    await db.moveIntoSegment(b.battle_id, CD.double, 1000); // jump straight into the Double
    await db.tick();
    const evs = (await db.events(w.liveA)).filter((e) => e.battle_id === b.battle_id && e.event_type !== 'BATTLE_ACCEPTED');
    expect(types(evs)).toEqual(['BATTLE_PHASE_CHANGED', 'DOUBLE_STARTED']);
  });

  it('finalization is idempotent under concurrency: exactly one result per stream', async () => {
    const w = await world(db);
    const b = await startBattle(db, w);
    await db.moveIntoSegment(b.battle_id, CD.normal1);
    await gift(db, w.viewers[0], w.liveB, 'super-galaxy', 1);
    await db.moveToEnd(b.battle_id, -10);
    const rs = await Promise.all(Array.from({ length: 8 }, () => db.one(`select live.finalize_battle($1) as ok`, [b.battle_id])));
    expect(rs.filter((r) => r.ok).length).toBe(1);
    await db.tick();
    for (const live of [w.liveA, w.liveB]) {
      const res = await db.events(live, ['BATTLE_RESULT']);
      expect(res.length).toBe(1);
      expect(res[0].payload.result).toMatchObject({ winner_side: 'b', final_a: 0, final_b: 5000 });
      expect(res[0].payload.result.stats).toMatchObject({
        total_gifts: 1,
        biggest_gift: { coin_value: 5000, side: 'b', gift: { id: 'super-galaxy' } },
        top_supporters: [{ side: 'b', points: 5000 }],
        peak_viewers: null,
      });
    }
    // finalize before ends_at is a no-op
    const b2 = await startBattle(db, w);
    expect((await db.one(`select live.finalize_battle($1) as ok`, [b2.battle_id])).ok).toBe(false);
  });

  it('a host ending their LIVE mid-battle forfeits; before the start it cancels', async () => {
    const w = await world(db);
    const b = await startBattle(db, w);
    await db.moveIntoSegment(b.battle_id, CD.normal1);
    await gift(db, w.viewers[0], w.liveA, 'dragon', 1); // A leads…
    await db.rpc(w.hostA, 'live_end', { p_live_id: w.liveA }); // …but A leaves
    const [res] = await db.events(w.liveB, ['BATTLE_RESULT']);
    expect(res.payload.result).toMatchObject({ winner_side: 'b', forfeit_side: 'a', final_a: 10000 });
    const endA = await db.events(w.liveA);
    expect(types(endA).slice(-3)).toEqual(['BATTLE_ENDED', 'BATTLE_RESULT', 'LIVE_ENDED']);

    const hostC = await db.newUser();
    const c = await db.rpc(hostC, 'live_start', { p_title: 'C' });
    const inv = await db.rpc(hostC, 'live_battle_invite', { p_target_live_id: w.liveB });
    await db.rpc(w.hostB, 'live_battle_respond', { p_battle_id: inv.battle_id, p_accept: true });
    await db.rpc(hostC, 'live_end', { p_live_id: c.live_id });
    const [cancel] = await db.events(w.liveB, ['BATTLE_CANCELLED']);
    expect(cancel.payload).toEqual({ battle_id: inv.battle_id, reason: 'host_left' });
    expect((await db.one(`select battle_id from live.sessions where id = $1`, [w.liveB])).battle_id).toBeNull();
  });
});

describe('three pulls (rounds)', () => {
  it('scores per pull, blocks breaks, applies the ×2 final pull and decides by pull wins', async () => {
    const w = await world(db);
    const [v1, v2] = w.viewers;
    const b = await startBattle(db, w, 'three_pulls');
    expect(b.scoring).toBe('pulls');
    expect(b.pull_scores).toEqual([{ pull_no: 1, a: 0, b: 0 }, { pull_no: 2, a: 0, b: 0 }, { pull_no: 3, a: 0, b: 0 }]);

    await db.moveIntoSegment(b.battle_id, TP.pull1);
    await gift(db, v1, w.liveA, 'rose', 10); // a 100
    await gift(db, v2, w.liveB, 'rose', 5); // b 50
    await db.moveIntoSegment(b.battle_id, TP.break1);
    expect(await gift(db, v1, w.liveA, 'rose', 1)).toMatchObject({ ok: false, code: 'BATTLE_BREAK' });
    await db.moveIntoSegment(b.battle_id, TP.pull2);
    await gift(db, v2, w.liveB, 'rose', 30); // b 300
    await db.moveIntoSegment(b.battle_id, TP.pull3);
    const r = await gift(db, v1, w.liveA, 'rose', 1); // ×2 → 20
    expect(r).toMatchObject({ battle_points: 20, multiplier: 2 });

    const pulls = (await db.events(w.liveB, ['BATTLE_SCORE'])).slice(-1)[0].payload.pull_scores;
    expect(pulls).toEqual([{ pull_no: 1, a: 100, b: 50 }, { pull_no: 2, a: 0, b: 300 }, { pull_no: 3, a: 20, b: 0 }]);

    await db.moveToEnd(b.battle_id, -5);
    await db.tick();
    const [res] = await db.events(w.liveA, ['BATTLE_RESULT']);
    // B has more total points (350 vs 120) but A won 2 of 3 pulls.
    expect(res.payload.result).toMatchObject({ winner_side: 'a', final_a: 120, final_b: 350, pull_wins: { a: 2, b: 1 } });
  });

  it('pull-wins tie is broken by total points (format tiebreak)', async () => {
    const w = await world(db);
    const b = await startBattle(db, w, 'three_pulls');
    await db.moveIntoSegment(b.battle_id, TP.pull1);
    await gift(db, w.viewers[0], w.liveA, 'rose', 1); // a wins pull 1 (10)
    await db.moveIntoSegment(b.battle_id, TP.pull2);
    await gift(db, w.viewers[1], w.liveB, 'rose', 3); // b wins pull 2 (30)
    await db.moveToEnd(b.battle_id, -5); // pull 3 tied 0-0
    await db.tick();
    const [res] = await db.events(w.liveA, ['BATTLE_RESULT']);
    expect(res.payload.result).toMatchObject({ winner_side: 'b', pull_wins: { a: 1, b: 1 } });
  });
});

describe('battle moment detectors', () => {
  it('lead change uses hysteresis and cooldown; the final moment always announces', async () => {
    const w = await world(db);
    const [v1, v2] = w.viewers;
    const b = await startBattle(db, w);
    await db.moveIntoSegment(b.battle_id, CD.normal1);
    const leads = async () => (await db.events(w.liveA, ['BATTLE_LEAD_CHANGED'])).map((e) => [e.payload.lead_side, e.payload.is_final_moment]);

    await gift(db, v1, w.liveA, 'rose', 10); // a 100 — first lead: state only
    expect(await leads()).toEqual([]);
    await gift(db, v2, w.liveB, 'rose', 13); // b 130 vs 100 — below hysteresis (50)
    expect(await leads()).toEqual([]);
    expect((await db.one(`select lead_side from live.battles where id = $1`, [b.battle_id])).lead_side).toBe('a');
    await gift(db, v2, w.liveB, 'rose', 3); // b 160 vs 100 → lead change
    expect(await leads()).toEqual([['b', false]]);
    await gift(db, v1, w.liveA, 'rose', 20); // a 300 vs 160 → change, but in cooldown → suppressed (state updates)
    expect(await leads()).toEqual([['b', false]]);
    expect((await db.one(`select lead_side, lead_changes from live.battles where id = $1`, [b.battle_id]))).toEqual({ lead_side: 'a', lead_changes: 2 });

    await db.moveToEnd(b.battle_id, 5_000); // final moment (≤ 10 s) — announces despite cooldown
    await gift(db, v2, w.liveB, 'tropical-mosquito', 1); // b 410 vs 300
    expect(await leads()).toEqual([['b', false], ['b', true]]);
  });

  it('comeback fires once per deficit episode; big contributions are swings', async () => {
    const w = await world(db);
    const [v1, v2] = w.viewers;
    const b = await startBattle(db, w);
    await db.moveIntoSegment(b.battle_id, CD.normal1);
    await gift(db, v1, w.liveA, 'super-galaxy', 1); // a 5000 → swing; b deficit 5000 qualifies
    await gift(db, v2, w.liveB, 'tropical-mosquito', 2); // b 500 (deficit 4500 > 2000)
    expect((await db.events(w.liveA, ['BATTLE_COMEBACK'])).length).toBe(0);
    await gift(db, v2, w.liveB, 'super-galaxy', 1); // b 5500 vs 5000 → comeback
    await gift(db, v2, w.liveB, 'rose', 1);
    const cbs = await db.events(w.liveA, ['BATTLE_COMEBACK']);
    expect(cbs.map((e) => e.payload)).toEqual([{ battle_id: b.battle_id, side: 'b', deficit_before: 5000, deficit_after: 0 }]);
    const swings = await db.events(w.liveB, ['BATTLE_SWING']);
    expect(swings.map((e) => [e.payload.side, e.payload.points])).toEqual([['a', 5000], ['b', 5000]]);
  });
});
