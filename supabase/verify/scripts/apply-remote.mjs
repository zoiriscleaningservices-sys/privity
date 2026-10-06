#!/usr/bin/env node
/**
 * Applies (or rolls back) the Privity LIVE v2 migrations on a REMOTE Supabase Postgres.
 *
 * Safe-by-default rules (D3):
 *   - A target is mandatory:  --target=staging | --target=production
 *   - The DB URL must belong to the expected project ref (SUPABASE_STAGING_PROJECT_REF /
 *     SUPABASE_PRODUCTION_PROJECT_REF). Staging refuses to run against the production ref.
 *   - Production additionally requires --approved and never enables any flag or test credits.
 *   - Refuses to run on an unknown state (a `live`/`social` schema or public.live_* functions
 *     that were not created by these recorded migrations).
 *   - All pending migrations are applied in ONE transaction: all or nothing.
 *   - Every applied file is recorded in supabase_migrations.schema_migrations (the table the
 *     Supabase CLI uses), so `supabase db push` / `migration list` stay consistent later.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_DB_URL = "postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres"
 *   $env:SUPABASE_STAGING_PROJECT_REF = "<staging-ref>"
 *   $env:SUPABASE_PRODUCTION_PROJECT_REF = "<production-ref>"   # strongly recommended
 *   npm run apply:staging -- --target=staging --dry-run
 *   npm run apply:staging -- --target=staging
 *   npm run apply:staging -- --target=staging --rollback
 *   npm run apply:staging -- --target=production --approved      # only after sign-off
 */
import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(here, '../../migrations');
const ROLLBACK_FILE = resolve(here, '../../rollback/20261004200100_live_v2_down.sql');
// Files owned by LIVE v2. The baseline (200000) is an idempotent no-op on existing projects
// and is never rolled back.
const LIVE_V2_PREFIX = '20261004200';
const BASELINE = '20261004200000';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const target = args.get('target');
const dryRun = args.has('dry-run');
const rollback = args.has('rollback');
const approved = args.has('approved');

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}
const log = (msg) => console.log(msg);

// ---------------------------------------------------------------------------
// Target validation
// ---------------------------------------------------------------------------
const url = process.env.SUPABASE_DB_URL;
if (!url) die('SUPABASE_DB_URL is not set.');
if (target !== 'staging' && target !== 'production') die('Pass --target=staging or --target=production.');

const stagingRef = process.env.SUPABASE_STAGING_PROJECT_REF;
const productionRef = process.env.SUPABASE_PRODUCTION_PROJECT_REF;
const urlHas = (ref) => !!ref && url.includes(ref);

if (target === 'staging') {
  if (!stagingRef) die('SUPABASE_STAGING_PROJECT_REF is not set.');
  if (!urlHas(stagingRef)) die('SUPABASE_DB_URL does not belong to the staging project ref.');
  if (urlHas(productionRef)) die('SUPABASE_DB_URL matches the PRODUCTION project ref. Refusing.');
  if (!productionRef) log('! SUPABASE_PRODUCTION_PROJECT_REF is not set — cannot double-check the target is not production.');
} else {
  if (!approved) die('Production requires --approved (explicit sign-off after staging verification).');
  if (!productionRef) die('SUPABASE_PRODUCTION_PROJECT_REF is not set.');
  if (!urlHas(productionRef)) die('SUPABASE_DB_URL does not belong to the production project ref.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const migrationFiles = () =>
  readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ file: f, version: f.split('_')[0], name: f.replace(/^\d+_/, '').replace(/\.sql$/, '') }));

async function one(c, sql, params = []) {
  const r = await c.query(sql, params);
  return r.rows[0];
}

async function ensureHistoryTable(c) {
  await c.query(`create schema if not exists supabase_migrations`);
  await c.query(`create table if not exists supabase_migrations.schema_migrations (
    version text primary key, statements text[], name text)`);
}

async function appliedVersions(c) {
  const exists = await one(c, `select to_regclass('supabase_migrations.schema_migrations') is not null as ok`);
  if (!exists.ok) return new Set();
  const r = await c.query(`select version from supabase_migrations.schema_migrations`);
  return new Set(r.rows.map((x) => x.version));
}

async function liveState(c) {
  return one(
    c,
    `select
       exists (select 1 from pg_namespace where nspname = 'live')   as has_live,
       exists (select 1 from pg_namespace where nspname = 'social') as has_social,
       (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname like 'live\\_%') as public_live_fns,
       exists (select 1 from pg_extension where extname = 'pg_cron') as has_cron,
       to_regclass('realtime.messages') is not null as has_realtime,
       current_setting('server_version') as pg_version`,
  );
}

async function postChecks(c) {
  const checks = await one(
    c,
    `select
       (select environment from live.deployment where id) as environment,
       (select count(*)::int from pg_class t join pg_namespace n on n.oid = t.relnamespace
          where n.nspname in ('live','social') and t.relkind = 'r' and not t.relrowsecurity) as tables_without_rls,
       (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname like 'live\\_%'
            and has_function_privilege('anon', p.oid, 'execute')) as anon_executable,
       (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname in ('live','social') and has_function_privilege('authenticated', p.oid, 'execute')) as internal_exposed,
       (select count(*)::int from pg_policies where schemaname = 'realtime' and tablename = 'messages'
          and policyname in ('live_v2_topic_read','live_v2_no_client_broadcast')) as realtime_policies,
       (select coalesce(bool_or(enabled), false) from live.feature_flags) as any_flag_enabled`,
  );
  let cron = 'pg_cron not installed';
  const hasCron = await one(c, `select exists (select 1 from pg_extension where extname = 'pg_cron') as ok`);
  if (hasCron.ok) {
    const j = await one(c, `select count(*)::int as n from cron.job where jobname = 'privity-live-show-tick'`);
    cron = j.n === 1 ? 'scheduled' : 'NOT scheduled';
  }
  return { ...checks, cron };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function sslOptions() {
  if (process.env.PGSSLMODE === 'disable') return false; // local rehearsal only
  if (process.env.SUPABASE_DB_CA) return { ca: readFileSync(process.env.SUPABASE_DB_CA, 'utf8'), rejectUnauthorized: true };
  log('! SUPABASE_DB_CA not set — TLS is encrypted but the server certificate is not verified.');
  return { rejectUnauthorized: false };
}

const client = new pg.Client({ connectionString: url, ssl: sslOptions(), application_name: 'privity-live-apply' });
await client.connect();
try {
  const state = await liveState(client);
  const applied = await appliedVersions(client);
  const files = migrationFiles();
  const liveFiles = files.filter((f) => f.version.startsWith(LIVE_V2_PREFIX) && f.version !== BASELINE);
  const recordedLive = liveFiles.filter((f) => applied.has(f.version));

  log(`Target:        ${target}${dryRun ? ' (dry run)' : ''}${rollback ? ' — ROLLBACK' : ''}`);
  log(`Postgres:      ${state.pg_version}`);
  log(`pg_cron:       ${state.has_cron ? 'installed' : 'NOT installed (enable it in Database → Extensions; the tick will not run)'}`);
  log(`Realtime:      ${state.has_realtime ? 'realtime.messages present' : 'realtime.messages MISSING'}`);
  log(`LIVE v2:       schema live=${state.has_live} social=${state.has_social}, public.live_* functions=${state.public_live_fns}, recorded migrations=${recordedLive.length}/${liveFiles.length}`);

  if (!state.has_realtime) die('realtime.messages is missing — this does not look like a Supabase project.');

  // ---- rollback -----------------------------------------------------------
  if (rollback) {
    if (target === 'production' && !approved) die('Production rollback requires --approved.');
    if (recordedLive.length === 0 && !state.has_live) die('Nothing to roll back.');
    if (state.has_live) {
      const value = await one(client, `select
          (select count(*)::int from live.coin_ledger where currency = 'coins') as real_coin_rows,
          (select count(*)::int from live.gift_transactions) as gift_rows`);
      log(`Data at risk:  real-coin ledger rows=${value.real_coin_rows}, gift transactions=${value.gift_rows}`);
      if (value.real_coin_rows > 0 && !args.has('i-exported-the-ledger')) {
        die('Real-coin ledger rows exist. Export live.coin_ledger and live.gift_transactions, then re-run with --i-exported-the-ledger.');
      }
    }
    if (dryRun) {
      log('\nDry run: would execute rollback/20261004200100_live_v2_down.sql and delete the LIVE v2 history rows.');
      process.exit(0);
    }
    await client.query('begin');
    try {
      await client.query(readFileSync(ROLLBACK_FILE, 'utf8'));
      if (applied.size) {
        await client.query(`delete from supabase_migrations.schema_migrations where version = any($1)`, [liveFiles.map((f) => f.version)]);
      }
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    }
    log('\n✔ LIVE v2 removed. Legacy LIVE and public.profiles were not touched.');
    process.exit(0);
  }

  // ---- apply --------------------------------------------------------------
  if ((state.has_live || state.has_social || state.public_live_fns > 0) && recordedLive.length === 0) {
    die('A live/social schema or public.live_* functions already exist but no LIVE v2 migration is recorded. Unknown state — refusing.');
  }
  const pending = files.filter((f) => !applied.has(f.version));
  if (pending.length === 0) {
    log('\n✔ Nothing pending.');
  } else {
    log(`\nPending (${pending.length}):`);
    for (const f of pending) log(`  • ${f.file}`);
  }
  if (dryRun) {
    log('\nDry run: no changes made.');
    process.exit(0);
  }

  if (pending.length > 0) {
    await client.query('begin');
    try {
      await ensureHistoryTable(client);
      for (const f of pending) {
        const sql = readFileSync(join(MIGRATIONS_DIR, f.file), 'utf8');
        log(`  applying ${f.file} …`);
        await client.query(sql);
        await client.query(
          `insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)`,
          [f.version, [sql], f.name],
        );
      }
      // Default environment is 'production' (fail-safe). Only an explicit staging target
      // relabels it — which is what allows test credits there and nowhere else.
      if (target === 'staging') await client.query(`update live.deployment set environment = 'staging' where id`);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      die(`Migration failed and was fully rolled back: ${e.message}`);
    }
  }

  const checks = await postChecks(client);
  log('\nPost-apply verification:');
  log(`  environment            ${checks.environment}`);
  log(`  tables without RLS     ${checks.tables_without_rls}`);
  log(`  anon-executable RPCs   ${checks.anon_executable}`);
  log(`  exposed internal fns   ${checks.internal_exposed}`);
  log(`  realtime policies      ${checks.realtime_policies}/2`);
  log(`  any flag enabled       ${checks.any_flag_enabled}`);
  log(`  show tick (pg_cron)    ${checks.cron}`);
  const bad =
    checks.tables_without_rls > 0 ||
    checks.anon_executable > 0 ||
    checks.internal_exposed > 0 ||
    checks.realtime_policies !== 2 ||
    (target === 'production' && (checks.environment !== 'production' || checks.any_flag_enabled));
  if (bad) die('Post-apply verification FAILED — investigate before using this environment.');
  log('\n✔ Applied and verified.');
  log('Next: set Realtime → "Allow public access" OFF (private channels only), and bootstrap the first admin (see supabase/README.md).');
} finally {
  await client.end();
}
