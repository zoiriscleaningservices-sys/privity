/**
 * Test harness: per-file database cloned from the migrated template, plus helpers that call
 * RPCs exactly like PostgREST does (role switch + request.jwt.claims inside a transaction).
 */
import pg from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { inject } from 'vitest';

pg.types.setTypeParser(20, (v) => Number(v)); // int8 → number (test values are small)
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric → number

const TEMPLATE_DB = 'live_template';

export type Role = 'anon' | 'authenticated' | 'service_role';

export class RpcError extends Error {
  constructor(public code: string, public sqlstate: string, public detail?: string) {
    super(code);
  }
}

export class Db {
  private constructor(public readonly pool: pg.Pool, public readonly name: string, private readonly port: number) {}

  static async create(): Promise<Db> {
    const port = inject('pgPort');
    const name = `t_${randomBytes(6).toString('hex')}`;
    const admin = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'postgres' });
    await admin.connect();
    await admin.query(`create database ${name} template ${TEMPLATE_DB}`);
    await admin.end();
    const pool = new pg.Pool({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: name, max: 40 });
    return new Db(pool, name, port);
  }

  async close() {
    await this.pool.end();
    const admin = new pg.Client({ host: 'localhost', port: this.port, user: 'postgres', password: 'postgres', database: 'postgres' });
    await admin.connect();
    await admin.query(`drop database if exists ${this.name} with (force)`);
    await admin.end();
  }

  /** Superuser SQL (test setup / inspection only). */
  async sql<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
    const r = await this.pool.query(text, params);
    return r.rows as T[];
  }

  async one<T = any>(text: string, params: unknown[] = []): Promise<T> {
    const rows = await this.sql<T>(text, params);
    return rows[0];
  }

  /** Runs SQL as an API role with the given JWT subject — exactly what a client can do. */
  async as<T = any>(role: Role, uid: string | null, text: string, params: unknown[] = [], gucs: Record<string, string> = {}): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const claims = uid ? { sub: uid, role } : { role };
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      for (const [k, v] of Object.entries(gucs)) await client.query(`select set_config($1, $2, true)`, [k, v]);
      await client.query(`set local role ${role}`);
      const r = await client.query(text, params);
      await client.query('commit');
      return r.rows as T[];
    } catch (e: any) {
      await client.query('rollback').catch(() => undefined);
      throw new RpcError(e.message, e.code, e.detail);
    } finally {
      client.release();
    }
  }

  /** Calls public.<fn>(named args) as `authenticated` with auth.uid() = uid. */
  async rpc<T = any>(uid: string | null, fn: string, args: Record<string, unknown> = {}, role: Role = 'authenticated'): Promise<T> {
    const names = Object.keys(args);
    const values = names.map((n) => {
      const v = args[n];
      return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v;
    });
    const call = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
    const rows = await this.as<{ r: T }>(role, uid, call, values);
    return rows[0].r;
  }

  async newUser(handle?: string, name?: string): Promise<string> {
    const id = randomUUID();
    const h = handle ?? `u${randomBytes(5).toString('hex')}`;
    await this.sql(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
      id,
      `${h}@example.test`,
      JSON.stringify({ handle: h, name: name ?? h }),
    ]);
    return id;
  }

  async setEnv(env: 'production' | 'staging' | 'development') {
    await this.sql(`update live.deployment set environment = $1`, [env]);
  }

  async setFlag(key: string, enabled: boolean) {
    await this.sql(
      `insert into live.feature_flags (key, enabled) values ($1, $2) on conflict (key) do update set enabled = excluded.enabled`,
      [key, enabled],
    );
  }

  async makeAdmin(uid: string, role: 'admin' | 'moderator' = 'admin') {
    await this.sql(`insert into live.app_roles (user_id, role) values ($1, $2) on conflict (user_id) do update set role = excluded.role`, [uid, role]);
  }

  /** Superuser-only fixture: test credits for a user (bypasses the admin RPC). */
  async fund(uid: string, amount: number) {
    await this.sql(
      `insert into live.wallets (user_id, test_coins) values ($1, $2)
       on conflict (user_id) do update set test_coins = live.wallets.test_coins + excluded.test_coins`,
      [uid, amount],
    );
  }

  async wallet(uid: string) {
    return this.one(`select * from live.wallets where user_id = $1`, [uid]);
  }

  async events(liveId: string, types?: string[]): Promise<any[]> {
    const rows = await this.sql(`select live.event_json(e) as j from live.events e where e.live_id = $1 order by e.seq`, [liveId]);
    const all = rows.map((r) => r.j);
    return types ? all.filter((e) => types.includes(e.event_type)) : all;
  }

  async realtime(topic: string): Promise<any[]> {
    return this.sql(`select * from realtime.messages where topic = $1 order by id`, [topic]);
  }

  async tick(): Promise<any> {
    return (await this.one(`select live.show_tick() as r`)).r;
  }

  /**
   * Moves a battle's clock: every timestamp is shifted BACK by ms, which is equivalent to
   * `ms` milliseconds of real time passing. Test-only (superuser); production has no such hook.
   */
  async advanceBattle(battleId: string, ms: number) {
    const iv = `${ms} milliseconds`;
    await this.sql(
      `update live.battles set intro_at = intro_at - $2::interval, starts_at = starts_at - $2::interval,
              ends_at = ends_at - $2::interval, invite_expires_at = invite_expires_at - $2::interval,
              lead_event_at = lead_event_at - $2::interval
       where id = $1`,
      [battleId, iv],
    );
    await this.sql(
      `update live.battle_timeline set starts_at = starts_at - $2::interval, ends_at = ends_at - $2::interval where battle_id = $1`,
      [battleId, iv],
    );
  }

  /** Positions "now" at `offsetMs` after the given timeline segment's start. */
  async moveIntoSegment(battleId: string, idx: number, offsetMs = 50) {
    const seg = await this.one(
      `select extract(epoch from (clock_timestamp() - starts_at)) * 1000 as since from live.battle_timeline where battle_id = $1 and idx = $2`,
      [battleId, idx],
    );
    await this.advanceBattle(battleId, Math.round(offsetMs - seg.since));
  }

  /** Positions "now" at `beforeMs` before the battle's ends_at (negative = after the end). */
  async moveToEnd(battleId: string, beforeMs: number) {
    const b = await this.one(
      `select extract(epoch from (ends_at - clock_timestamp())) * 1000 as left_ms from live.battles where id = $1`,
      [battleId],
    );
    await this.advanceBattle(battleId, Math.round(b.left_ms - beforeMs));
  }
}

export async function expectCode(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e: any) {
    if (e instanceof RpcError && e.code === code) return e;
    throw new Error(`expected error ${code}, got ${e?.code ?? e?.message}`);
  }
  throw new Error(`expected error ${code}, but the call succeeded`);
}

let keyCounter = 0;
export const idem = () => `k-${Date.now()}-${++keyCounter}-${randomBytes(4).toString('hex')}`;

/** Standard world: development env, live_v2 + test_credits on, two hosts live, viewers funded. */
export async function world(db: Db, opts: { viewers?: number; fund?: number } = {}) {
  await db.setEnv('development');
  await db.setFlag('live_v2', true);
  await db.setFlag('test_credits', true);
  const hostA = await db.newUser(undefined, 'Host A');
  const hostB = await db.newUser(undefined, 'Host B');
  const viewers: string[] = [];
  for (let i = 0; i < (opts.viewers ?? 3); i++) {
    const v = await db.newUser(undefined, `Viewer ${i}`);
    await db.fund(v, opts.fund ?? 1_000_000);
    viewers.push(v);
  }
  const a = await db.rpc(hostA, 'live_start', { p_title: 'A live', p_visibility: 'public' });
  const b = await db.rpc(hostB, 'live_start', { p_title: 'B live', p_visibility: 'public' });
  return { hostA, hostB, viewers, liveA: a.live_id as string, liveB: b.live_id as string };
}

/** Invites + accepts a battle between A (side a) and B (side b). */
export async function startBattle(db: Db, w: Awaited<ReturnType<typeof world>>, format = 'classic_double') {
  const inv = await db.rpc(w.hostA, 'live_battle_invite', { p_target_live_id: w.liveB, p_format_id: format });
  const acc = await db.rpc(w.hostB, 'live_battle_respond', { p_battle_id: inv.battle_id, p_accept: true });
  return acc.battle as any;
}

export async function gift(db: Db, uid: string, liveId: string, giftId: string, qty = 1, extra: Record<string, unknown> = {}) {
  return db.rpc(uid, 'live_send_gift', {
    p_live_id: liveId,
    p_gift_id: giftId,
    p_quantity: qty,
    p_idempotency_key: idem(),
    ...extra,
  });
}
