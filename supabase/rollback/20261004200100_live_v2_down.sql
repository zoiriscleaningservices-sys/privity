-- =============================================================================
-- ROLLBACK for Privity LIVE v2 (migrations 20261004200100 … 20261004200700)
--
-- Removes ONLY LIVE v2 objects. Legacy LIVE, public.profiles (baseline 20261004200000
-- is a no-op on existing projects) and all non-LIVE functionality are untouched.
--
-- WARNING: drops LIVE v2 data (wallets, ledger, gifts sent, battles, events). On staging
-- this is the reset path. On production it must only be run with explicit approval and
-- after exporting live.coin_ledger / live.gift_transactions if any real value exists.
-- After running it, delete the matching rows from supabase_migrations.schema_migrations
-- (the apply script does this for staging resets).
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'privity-live-show-tick') then
      perform cron.unschedule('privity-live-show-tick');
    end if;
  end if;
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists live_v2_topic_read on realtime.messages';
    execute 'drop policy if exists live_v2_no_client_broadcast on realtime.messages';
  end if;
end $$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'live\_%'
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

drop schema if exists live cascade;
drop schema if exists social cascade;
