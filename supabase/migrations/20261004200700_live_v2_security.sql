-- =============================================================================
-- Privity LIVE v2 — security finalization (MUST be the last LIVE v2 migration;
-- any later migration that adds public.live_* functions must repeat the grant block)
--
--  * Supabase grants EXECUTE on new public functions to anon by default → revoke.
--  * Client RPCs: authenticated (+ service_role). live_show_tick: service_role only.
--  * Internal schemas: no access for client roles at all.
--  * Realtime: private topics live:{uuid} / user:{uuid} readable only when authorized;
--    clients can never broadcast into them (only the database does, after commit).
--  * pg_cron schedules the 1 s show tick when available.
-- Rollback: supabase/rollback/20261004200100_live_v2_down.sql
-- =============================================================================

do $$
declare r record;
  has_anon boolean := exists (select 1 from pg_roles where rolname = 'anon');
  has_auth boolean := exists (select 1 from pg_roles where rolname = 'authenticated');
  has_service boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'live\_%'
  loop
    execute format('revoke all on function %s from public', r.sig);
    if has_anon then execute format('revoke all on function %s from anon', r.sig); end if;
    if has_auth then
      if r.proname = 'live_show_tick' then
        execute format('revoke all on function %s from authenticated', r.sig);
      else
        execute format('grant execute on function %s to authenticated', r.sig);
      end if;
    end if;
    if has_service then execute format('grant execute on function %s to service_role', r.sig); end if;
  end loop;

  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('live', 'social')
  loop
    execute format('revoke all on function %s from public', r.sig);
    if has_anon then execute format('revoke all on function %s from anon', r.sig); end if;
    if has_auth then execute format('revoke all on function %s from authenticated', r.sig); end if;
  end loop;

  if has_anon then execute 'revoke all on schema live, social from anon'; end if;
  if has_auth then execute 'revoke all on schema live, social from authenticated'; end if;
end $$;

-- -----------------------------------------------------------------------------
-- Realtime authorization (private channels)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages not found: skipping LIVE v2 realtime policies';
    return;
  end if;

  execute 'drop policy if exists live_v2_topic_read on realtime.messages';
  execute 'drop policy if exists live_v2_no_client_broadcast on realtime.messages';

  -- Read: only for LIVE v2 topics the user is authorized for (returns false for any other topic,
  -- so this policy grants nothing outside live:/user:).
  execute $p$
    create policy live_v2_topic_read on realtime.messages
      for select to authenticated
      using (public.live_topic_authorized((select realtime.topic())))
  $p$;

  -- Write: RESTRICTIVE — no client may broadcast or send presence into LIVE v2 topics,
  -- whatever other permissive policies exist. Facts come only from the database.
  execute $p$
    create policy live_v2_no_client_broadcast on realtime.messages
      as restrictive
      for insert to anon, authenticated
      with check (
        coalesce((select realtime.topic()), '') !~ '^(live|user):'
        and coalesce(topic, '') !~ '^(live|user):'
      )
  $p$;
end $$;

-- -----------------------------------------------------------------------------
-- Scheduler
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'privity-live-show-tick') then
      perform cron.unschedule('privity-live-show-tick');
    end if;
    perform cron.schedule('privity-live-show-tick', '1 seconds', 'select live.show_tick()');
  else
    raise notice 'pg_cron is not available: run public.live_show_tick() every second from a service-role scheduler.';
  end if;
end $$;
