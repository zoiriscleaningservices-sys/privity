# Privity LIVE v2 — Supabase backend

Server-authoritative LIVE: wallets, coin ledger, gifts, battles, supporters, comments,
guests, moderation, follow/block and the realtime event log. The browser is never a
source of truth. Legacy LIVE is untouched; LIVE v2 is gated by the `live_v2` flag (off).

```
supabase/
  migrations/            ordered, CLI-compatible migrations (20261004200000 … 200700)
  rollback/              reversal script for LIVE v2 (staging reset / emergency only)
  verify/                isolated test package: real Postgres 17 + Supabase shim
    scripts/apply-remote.mjs   staging/production apply + rollback tool
```

## 1. Local verification (no credentials needed)

```powershell
cd supabase/verify
npm install
npm test            # boots embedded Postgres, applies the REAL migrations, runs every suite
```

Suites: migrations (incl. rollback + re-apply), gifts, battles, LIVE lifecycle/presence/
moderation/guests/social, security regressions, client⇔server contract (runs the real
`apps/admin/src/live` core against server events), and a rehearsal of the apply script.
The embedded server has no `pg_cron`; tests drive the tick directly.

## 2. Staging (required before production — D3)

**One-time project setup (Dashboard):**

1. Database → Extensions → enable **pg_cron** (the 1 s show tick: battle phases, Double,
   final countdown, finalization, viewer batching, stale-host cleanup). Without it,
   battles never finalize.
2. Realtime → Settings → turn **off** "Allow public access" (private channels only). LIVE
   topics are already protected by RLS on `realtime.messages`; this closes the public path.
3. Keep the CA certificate (Database → Settings → SSL) for `SUPABASE_DB_CA`.

**Apply:**

```powershell
cd supabase/verify
$env:SUPABASE_DB_URL = "postgresql://postgres:<password>@db.<staging-ref>.supabase.co:5432/postgres"
$env:SUPABASE_STAGING_PROJECT_REF = "<staging-ref>"
$env:SUPABASE_PRODUCTION_PROJECT_REF = "<production-ref>"   # lets the tool refuse production
$env:SUPABASE_DB_CA = "C:\path\to\prod-ca-2021.crt"           # verifies the server certificate
npm run apply:staging -- --target=staging --dry-run
npm run apply:staging -- --target=staging
```

The tool refuses on a wrong/production ref, on an unknown pre-existing `live`/`social` state,
applies all pending files in **one transaction**, records them in
`supabase_migrations.schema_migrations` (same table as the Supabase CLI), labels the project
`staging`, and verifies RLS, grants, Realtime policies and the cron job afterwards.
With the Supabase CLI available, `supabase db push` is equivalent (then set the environment
label with the SQL below).

**Bootstrap (SQL editor, once):**

```sql
-- First admin (only the SQL editor/service role can do this; later admins via live_admin_set_role)
insert into live.app_roles (user_id, role) values ('<your-auth-user-uuid>', 'admin');
-- Only needed if you used `supabase db push` instead of the apply tool:
update live.deployment set environment = 'staging' where id;
```

Then call the admin RPCs as that admin (from the admin app, or in the SQL editor by
impersonating the admin for one transaction — every call is audited under that user):

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"<your-auth-user-uuid>","role":"authenticated"}', true);
-- open LIVE v2 to specific testers only (flag stays off for everyone else)
select public.live_admin_set_flag('live_v2', false, '{"allow_users": ["<tester-uuid>", "<tester-uuid>"]}');
-- staging-only test credits (rejected on production)
select public.live_admin_set_flag('test_credits', true);
select public.live_admin_grant_test_credits('<tester-uuid>', 5000, 'QA');
commit;
```

`test_coins` are a separate balance from real `coins`. Purchases cannot be enabled until a
payment provider is integrated (`PURCHASES_NOT_CONFIGURED`).

**Rollback (staging reset):** `npm run apply:staging -- --target=staging --rollback`
(refuses if real-coin ledger rows exist unless `--i-exported-the-ledger`).

## 3. Production (only after staging sign-off)

```powershell
npm run apply:staging -- --target=production --approved --dry-run
npm run apply:staging -- --target=production --approved
```

Production stays labelled `production` (test credits impossible) and every flag stays off.
Cut-over is a flag change, not a deploy: old LIVE → new LIVE → verified parity → `live_v2`
on → legacy LIVE removed. Never run both as authoritative.

## 4. Operational notes / known limitations

- Any future migration that adds `public.live_*` functions must repeat the grant block from
  `20261004200700_live_v2_security.sql` (Supabase grants new public functions to `anon`).
- Realtime authorization is evaluated when a client joins a channel: a kicked/blocked user
  keeps receiving broadcasts until reconnect (RPCs and media tokens are denied immediately).
- The tick and `live_admin_publish_show_config` may rarely deadlock; Postgres resolves it
  and the affected tick item retries one second later.
- Earnings are credited 1:1 in coin value; payout conversion is a business decision for later.
- Legacy `profiles.sparks` remains client-writable until legacy LIVE is removed.
