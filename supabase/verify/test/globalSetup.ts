/**
 * Boots a real PostgreSQL 17 (embedded-postgres), applies the Supabase platform shim and
 * then the REAL migration files in order into a template database. Each test file clones
 * the template (fast, isolated). Nothing here ever touches a remote project.
 */
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GlobalSetupContext } from 'vitest/node';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = resolve(here, '../../migrations');
export const ROLLBACK_FILE = resolve(here, '../../rollback/20261004200100_live_v2_down.sql');
export const SHIM_FILE = resolve(here, '../supabase-shim.sql');
export const TEMPLATE_DB = 'live_template';

declare module 'vitest' {
  export interface ProvidedContext {
    pgPort: number;
  }
}

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

async function run(client: pg.Client, label: string, sql: string) {
  try {
    await client.query(sql);
  } catch (e: any) {
    const pos = e.position ? Number(e.position) : null;
    const ctx = pos ? sql.slice(Math.max(0, pos - 200), pos + 100) : '';
    throw new Error(`[${label}] ${e.message}\n${e.where ?? ''}\n--- near ---\n${ctx}`);
  }
}

export default async function setup({ provide }: GlobalSetupContext) {
  const dir = mkdtempSync(join(tmpdir(), 'privity-live-verify-'));
  const port = 56000 + Math.floor(Math.random() * 2000);
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    // NOTE: do not raise log_min_messages above LOG — embedded-postgres detects readiness from
    // the "ready to accept connections" LOG line, and start() would hang forever.
    postgresFlags: ['-c', 'max_connections=200', '-c', 'fsync=off', '-c', 'synchronous_commit=off',
      '-c', 'log_min_error_statement=panic', '-c', 'log_checkpoints=off'],
    onLog: () => undefined,
    onError: () => undefined,
  });
  await server.initialise();
  await server.start();

  try {
    const admin = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'postgres' });
    await admin.connect();
    await admin.query(`create database ${TEMPLATE_DB} encoding 'UTF8' template template0`);
    await admin.end();

    const t = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: TEMPLATE_DB });
    await t.connect();
    await run(t, 'supabase-shim.sql', readFileSync(SHIM_FILE, 'utf8'));
    for (const f of migrationFiles()) {
      await run(t, f, readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    }
    await t.end();
  } catch (e) {
    await server.stop();
    throw e;
  }

  provide('pgPort', port);

  return async () => {
    await server.stop();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  };
}
