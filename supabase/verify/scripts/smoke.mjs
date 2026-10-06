import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'privity-pg-smoke-'));
const server = new EmbeddedPostgres({ databaseDir: dir, port: 55439, user: 'postgres', password: 'postgres', persistent: false });
await server.initialise();
await server.start();
const c = new pg.Client({ host: 'localhost', port: 55439, user: 'postgres', password: 'postgres', database: 'postgres' });
await c.connect();
const r = await c.query("select version(), (select count(*) from pg_available_extensions where name in ('pgcrypto','pg_cron','pgtap')) as ext");
console.log(r.rows[0]);
await c.end();
await server.stop();
