import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Db } from './harness';
import { MIGRATIONS_DIR, ROLLBACK_FILE, migrationFiles } from './globalSetup';

let db: Db;
beforeEach(async () => {
  db = await Db.create();
});
afterEach(async () => {
  await db.close();
});

describe('migrations', () => {
  it('apply cleanly and create the private schemas, seed data and contract objects', async () => {
    const schemas = await db.sql(`select nspname from pg_namespace where nspname in ('live', 'social') order by 1`);
    expect(schemas.map((s) => s.nspname)).toEqual(['live', 'social']);

    const gifts = await db.sql(`select id, coin_cost, rarity_tier from live.gifts order by coin_cost`);
    expect(gifts).toEqual([
      { id: 'rose', coin_cost: 10, rarity_tier: 'common' },
      { id: 'tropical-mosquito', coin_cost: 250, rarity_tier: 'rare' },
      { id: 'super-galaxy', coin_cost: 5000, rarity_tier: 'legendary' },
      { id: 'dragon', coin_cost: 10000, rarity_tier: 'legendary' },
    ]);
    const flags = await db.sql(`select key, enabled from live.feature_flags order by key`);
    expect(flags).toEqual([
      { key: 'live_v2', enabled: false },
      { key: 'purchases', enabled: false },
      { key: 'test_credits', enabled: false },
    ]);
    expect((await db.one(`select environment from live.deployment`)).environment).toBe('production');
    expect((await db.one(`select live.cfg_version() as v`)).v).toBe(1);
  });

  it('every table in live/social has RLS enabled and no client privileges', async () => {
    const tables = await db.sql(`
      select n.nspname, c.relname, c.relrowsecurity,
             has_table_privilege('authenticated', c.oid, 'select') as auth_sel,
             has_table_privilege('anon', c.oid, 'select') as anon_sel,
             has_table_privilege('authenticated', c.oid, 'insert,update,delete') as auth_write
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('live', 'social') and c.relkind = 'r'`);
    expect(tables.length).toBeGreaterThan(25);
    for (const t of tables) {
      expect(t.relrowsecurity, `${t.nspname}.${t.relname} RLS`).toBe(true);
      expect(t.auth_sel, `${t.relname} authenticated select`).toBe(false);
      expect(t.anon_sel, `${t.relname} anon select`).toBe(false);
      expect(t.auth_write, `${t.relname} authenticated write`).toBe(false);
    }
  });

  it('client roles cannot execute internal functions; anon cannot execute any live_* RPC', async () => {
    const fns = await db.sql(`
      select n.nspname, p.proname,
             has_function_privilege('anon', p.oid, 'execute') as anon_x,
             has_function_privilege('authenticated', p.oid, 'execute') as auth_x,
             has_function_privilege('service_role', p.oid, 'execute') as svc_x,
             p.prosecdef, p.proconfig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('live', 'social') or (n.nspname = 'public' and p.proname like 'live\\_%')`);
    expect(fns.length).toBeGreaterThan(60);
    for (const f of fns) {
      expect(f.anon_x, `${f.nspname}.${f.proname} anon`).toBe(false);
      if (f.nspname !== 'public') expect(f.auth_x, `${f.nspname}.${f.proname} authenticated`).toBe(false);
      if (f.nspname === 'public') {
        expect(f.prosecdef, `${f.proname} security definer`).toBe(true);
        expect(f.svc_x, `${f.proname} service_role`).toBe(true);
        expect(f.auth_x, `${f.proname} authenticated`).toBe(f.proname !== 'live_show_tick');
      }
      expect(String(f.proconfig ?? ''), `${f.nspname}.${f.proname} search_path`).toContain('search_path=""');
    }
  });

  it('rollback removes every LIVE v2 object and the migrations re-apply (reversible)', async () => {
    await db.sql(readFileSync(ROLLBACK_FILE, 'utf8'));
    const left = await db.sql(`
      select (select count(*) from pg_namespace where nspname in ('live', 'social')) as schemas,
             (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname like 'live\\_%') as fns,
             (select count(*) from pg_policies where policyname like 'live_v2_%') as policies,
             (select count(*) from public.profiles) >= 0 as profiles_intact`);
    expect(left[0]).toEqual({ schemas: 0, fns: 0, policies: 0, profiles_intact: true });

    for (const f of migrationFiles()) {
      await db.sql(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    }
    expect((await db.one(`select count(*)::int as n from live.gifts`)).n).toBe(4);
  });

  it('the baseline profiles migration is idempotent (no-op when re-applied)', async () => {
    const before = await db.one(`select md5(prosrc) as h from pg_proc where proname = 'handle_new_user'`);
    await db.sql(readFileSync(join(MIGRATIONS_DIR, migrationFiles()[0]), 'utf8'));
    const after = await db.one(`select md5(prosrc) as h from pg_proc where proname = 'handle_new_user'`);
    expect(after.h).toBe(before.h);
  });
});

void pg;
