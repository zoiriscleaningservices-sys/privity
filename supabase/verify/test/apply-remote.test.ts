/**
 * Rehearses the REAL staging apply script (scripts/apply-remote.mjs) against fresh,
 * Supabase-shaped databases on the embedded server — the closest thing to staging that can
 * run without credentials. Verifies target guards, dry run, all-or-nothing apply, migration
 * history, environment labelling, post-apply checks, unknown-state refusal and rollback.
 */
import { afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inject } from 'vitest';
import { SHIM_FILE, migrationFiles } from './globalSetup';

const SCRIPT = resolve(__dirname, '../scripts/apply-remote.mjs');
const STAGING_REF = 'stgrefq7k2';
const PROD_REF = 'prdrefz9w4';
const port = inject('pgPort');
const created: string[] = [];

const adminClient = async (database = 'postgres') => {
  const c = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database });
  await c.connect();
  return c;
};

/** A fresh database with only the Supabase platform shim (what a new project looks like). */
async function freshProject(ref: string, extraSql = ''): Promise<string> {
  const name = `${ref}_${randomBytes(4).toString('hex')}`;
  const a = await adminClient();
  await a.query(`create database ${name} encoding 'UTF8' template template0`);
  await a.end();
  created.push(name);
  const c = await adminClient(name);
  await c.query(readFileSync(SHIM_FILE, 'utf8'));
  if (extraSql) await c.query(extraSql);
  await c.end();
  return name;
}

async function q(db: string, sql: string) {
  const c = await adminClient(db);
  try {
    return (await c.query(sql)).rows;
  } finally {
    await c.end();
  }
}

function run(db: string, args: string[], env: Record<string, string | undefined> = {}) {
  return new Promise<{ code: number; out: string }>((done) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      {
        env: {
          ...process.env,
          PGSSLMODE: 'disable',
          SUPABASE_DB_URL: `postgresql://postgres:postgres@localhost:${port}/${db}`,
          SUPABASE_STAGING_PROJECT_REF: STAGING_REF,
          SUPABASE_PRODUCTION_PROJECT_REF: PROD_REF,
          ...env,
        },
        timeout: 120_000,
      },
      (err, stdout, stderr) => done({ code: err ? ((err as any).code ?? 1) : 0, out: `${stdout}\n${stderr}` }),
    );
  });
}

afterAll(async () => {
  const a = await adminClient();
  for (const n of created) await a.query(`drop database if exists ${n} with (force)`);
  await a.end();
});

describe('staging apply script (rehearsal)', () => {
  it('refuses unsafe targets', async () => {
    const stg = await freshProject(STAGING_REF);
    const prd = await freshProject(PROD_REF);
    expect((await run(stg, [])).out).toContain('--target=staging or --target=production');
    const wrong = await run(prd, ['--target=staging'], { SUPABASE_STAGING_PROJECT_REF: PROD_REF });
    expect(wrong.code).not.toBe(0);
    expect(wrong.out).toContain('matches the PRODUCTION project ref');
    expect((await run(stg, ['--target=staging'], { SUPABASE_STAGING_PROJECT_REF: 'otherref' })).out).toContain(
      'does not belong to the staging project ref',
    );
    const noApproval = await run(prd, ['--target=production']);
    expect(noApproval.code).not.toBe(0);
    expect(noApproval.out).toContain('requires --approved');
    expect((await q(prd, `select count(*)::int n from pg_namespace where nspname = 'live'`))[0].n).toBe(0);
  });

  it('dry run changes nothing; apply is complete, recorded, labelled staging and verified; re-run is a no-op', async () => {
    const db = await freshProject(STAGING_REF);
    const dry = await run(db, ['--target=staging', '--dry-run']);
    expect(dry.code).toBe(0);
    expect(dry.out).toContain(`Pending (${migrationFiles().length})`);
    expect((await q(db, `select to_regnamespace('live') is null as none`))[0].none).toBe(true);

    const res = await run(db, ['--target=staging']);
    expect(res.code, res.out).toBe(0);
    expect(res.out).toContain('Applied and verified');
    expect(res.out).toMatch(/tables without RLS\s+0/);
    expect(res.out).toMatch(/anon-executable RPCs\s+0/);
    expect(res.out).toMatch(/realtime policies\s+2\/2/);
    const versions = (await q(db, `select version from supabase_migrations.schema_migrations order by version`)).map((r) => r.version);
    expect(versions).toEqual(migrationFiles().map((f) => f.split('_')[0]));
    expect((await q(db, `select environment from live.deployment`))[0].environment).toBe('staging');
    expect((await q(db, `select bool_or(enabled) as any from live.feature_flags`))[0].any).toBe(false);

    const again = await run(db, ['--target=staging']);
    expect(again.code).toBe(0);
    expect(again.out).toContain('Nothing pending');
  });

  it('refuses an unknown pre-existing LIVE state', async () => {
    const db = await freshProject(STAGING_REF, `create schema live; create function public.live_legacy() returns int language sql as 'select 1';`);
    const res = await run(db, ['--target=staging']);
    expect(res.code).not.toBe(0);
    expect(res.out).toContain('Unknown state');
    expect((await q(db, `select count(*)::int n from pg_proc where proname = 'live_legacy'`))[0].n).toBe(1);
  });

  it('a failing migration rolls back everything (all-or-nothing)', async () => {
    // Fault injection: abort when the 6th file (tick) creates public.live_show_tick, i.e. after
    // files 1–5 already ran inside the transaction.
    const db = await freshProject(STAGING_REF, `
      create function public.inject_fault() returns event_trigger language plpgsql as $$
      declare r record;
      begin
        for r in select * from pg_event_trigger_ddl_commands() loop
          if r.object_identity like 'public.live_show_tick(%' then raise exception 'injected fault'; end if;
        end loop;
      end $$;
      create event trigger inject_fault on ddl_command_end execute function public.inject_fault();`);
    const res = await run(db, ['--target=staging']);
    expect(res.code).not.toBe(0);
    expect(res.out).toContain('fully rolled back');
    expect(res.out).toContain('injected fault');
    expect((await q(db, `select to_regnamespace('live') is null and to_regnamespace('social') is null as none`))[0].none).toBe(true);
    expect((await q(db, `select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'live\\_%'`))[0].n).toBe(0);
    expect((await q(db, `select to_regclass('supabase_migrations.schema_migrations') is null as none`))[0].none).toBe(true);
  });

  it('rollback removes LIVE v2 and its history; profiles and other data are untouched', async () => {
    const db = await freshProject(STAGING_REF);
    expect((await run(db, ['--target=staging'])).code).toBe(0);
    const res = await run(db, ['--target=staging', '--rollback']);
    expect(res.code, res.out).toBe(0);
    expect((await q(db, `select to_regnamespace('live') is null and to_regnamespace('social') is null as gone`))[0].gone).toBe(true);
    expect((await q(db, `select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'live\\_%'`))[0].n).toBe(0);
    expect((await q(db, `select array_agg(version) v from supabase_migrations.schema_migrations`))[0].v).toEqual(['20261004200000']);
    expect((await q(db, `select to_regclass('public.profiles') is not null as kept`))[0].kept).toBe(true);
    // and it re-applies cleanly
    expect((await run(db, ['--target=staging'])).code).toBe(0);
  });

  it('production (with approval) keeps environment=production and every flag off', async () => {
    const db = await freshProject(PROD_REF);
    const res = await run(db, ['--target=production', '--approved']);
    expect(res.code, res.out).toBe(0);
    expect((await q(db, `select environment from live.deployment`))[0].environment).toBe('production');
    expect((await q(db, `select bool_or(enabled) as any from live.feature_flags`))[0].any).toBe(false);
  });
});
