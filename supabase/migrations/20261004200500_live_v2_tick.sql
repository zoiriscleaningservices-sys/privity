-- =============================================================================
-- Privity LIVE v2 — show tick (server-time facts)
--
-- Runs every second (pg_cron, scheduled in the security migration). It turns the
-- frozen battle timeline into authoritative events, finalizes battles at ends_at,
-- expires invites, batches viewer joins/counts/milestones and ends stale LIVEs.
-- Scoring NEVER depends on the tick: a gift's multiplier is decided from the
-- timeline at the instant the gift transaction holds the battle lock.
-- Rollback: supabase/rollback/20261004200100_live_v2_down.sql
-- =============================================================================

create function live.tick_battle(p_battle_id uuid) returns void
language plpgsql set search_path = '' as $$
declare
  b live.battles;
  v_now timestamptz;
  v_cur live.battle_timeline;
  v_prev live.battle_timeline;
  v_max_idx integer;
  w record;
begin
  select * into b from live.battles where id = p_battle_id;
  if not found then return; end if;
  perform live.lock_sessions(array[b.live_a, b.live_b]);
  select * into b from live.battles where id = p_battle_id for update;
  if b.status not in ('accepted', 'live', 'locked') then return; end if;
  v_now := clock_timestamp();
  select max(t.idx) into v_max_idx from live.battle_timeline t where t.battle_id = b.id;

  -- DOUBLE_WARNING: only while the warning is still ahead of the multiplied segment.
  for w in select t.* from live.battle_timeline t
           where t.battle_id = b.id and t.multiplier > 1 and t.warning_ms > 0
             and not (t.idx = any(b.warned_idx))
             and v_now >= t.starts_at - make_interval(secs => t.warning_ms / 1000.0)
           order by t.idx loop
    if v_now < w.starts_at then
      perform live.emit_battle(b, 'DOUBLE_WARNING', jsonb_build_object(
        'battle_id', b.id, 'segment_idx', w.idx, 'starts_at', live.iso(w.starts_at), 'multiplier', w.multiplier));
    end if;
    b.warned_idx := b.warned_idx || w.idx;
  end loop;

  -- Phase transitions. Segments that elapsed entirely between ticks are skipped silently
  -- (no stale celebrations); the current one is announced.
  v_cur := live.segment_at(b.id, v_now);
  if (v_cur.idx is not null and v_cur.idx > b.last_announced_idx)
     or (v_now >= b.ends_at and b.last_announced_idx <= v_max_idx) then
    if b.last_announced_idx >= 0 then
      select * into v_prev from live.battle_timeline t where t.battle_id = b.id and t.idx = b.last_announced_idx;
      if v_prev.multiplier > 1 then
        perform live.emit_battle(b, 'DOUBLE_ENDED', jsonb_build_object('battle_id', b.id, 'segment_idx', v_prev.idx));
      end if;
    end if;
    if v_cur.idx is not null then
      perform live.emit_battle(b, 'BATTLE_PHASE_CHANGED', jsonb_build_object(
        'battle_id', b.id, 'segment_idx', v_cur.idx, 'kind', v_cur.kind, 'multiplier', v_cur.multiplier,
        'pull_no', v_cur.pull_no));
      if v_cur.multiplier > 1 then
        perform live.emit_battle(b, 'DOUBLE_STARTED', jsonb_build_object(
          'battle_id', b.id, 'segment_idx', v_cur.idx, 'ends_at', live.iso(v_cur.ends_at), 'multiplier', v_cur.multiplier));
      end if;
      b.last_announced_idx := v_cur.idx;
    else
      b.last_announced_idx := v_max_idx + 1;   -- timeline complete
    end if;
  end if;

  if b.status = 'accepted' and v_now >= b.starts_at then b.status := 'live'; end if;

  if not b.final_announced and b.final_countdown_ms > 0
     and v_now >= b.ends_at - make_interval(secs => b.final_countdown_ms / 1000.0) then
    if v_now < b.ends_at then
      perform live.emit_battle(b, 'FINAL_COUNTDOWN_STARTED', jsonb_build_object('battle_id', b.id, 'ends_at', live.iso(b.ends_at)));
    end if;
    b.final_announced := true;
  end if;

  update live.battles set warned_idx = b.warned_idx, last_announced_idx = b.last_announced_idx,
                          status = b.status, final_announced = b.final_announced
  where id = b.id;

  if v_now >= b.ends_at then
    perform live.finalize_battle(b.id, null);
  end if;
end $$;

create function live.tick_viewers(p_live_id uuid) returns void
language plpgsql set search_path = '' as $$
declare
  s live.sessions;
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_joins integer;
  v_sample jsonb;
  v_crossed integer[];
  c_stale numeric := live.cfg_num('{limits,viewer_stale_s}', 45, 10, 600);
  c_sample integer := live.cfg_num('{detectors,viewers,join_sample}', 3, 0, 10)::integer;
  c_ms integer[] := live.cfg_ints('{detectors,viewers,milestones}', '{100,500,1000,5000,10000}');
begin
  select * into s from live.sessions where id = p_live_id;
  if not found or s.status <> 'live' then return; end if;

  update live.viewers set left_at = last_seen_at
  where live_id = p_live_id and left_at is null and last_seen_at < v_now - make_interval(secs => c_stale);
  select count(*) into v_count from live.viewers v where v.live_id = p_live_id and v.left_at is null;

  -- Each join is announced exactly once, batched. Sample prefers followers, then supporters.
  with j as (
    update live.viewers v set join_announced = true
    where v.live_id = p_live_id and not v.join_announced and v.left_at is null
    returning v.user_id, v.joined_at
  ), ranked as (
    select j.user_id,
           row_number() over (order by live.is_following(j.user_id, s.host_id) desc,
                                       coalesce(sp.total_coins, 0) desc, j.joined_at desc) as rn
    from j left join live.supporters sp on sp.live_id = p_live_id and sp.user_id = j.user_id
  )
  select count(*), coalesce(jsonb_agg(live.user_ref(r.user_id) order by r.rn) filter (where r.rn <= c_sample), '[]'::jsonb)
    into v_joins, v_sample
  from ranked r;

  select coalesce(array_agg(m order by m), '{}') into v_crossed from unnest(c_ms) m
  where m <= v_count and not (m = any(s.viewer_milestones_reached));

  if v_count = s.viewer_count and v_joins = 0 and coalesce(array_length(v_crossed, 1), 0) = 0 then return; end if;

  perform live.lock_sessions(array[p_live_id]);
  select * into s from live.sessions where id = p_live_id;
  if s.status <> 'live' then return; end if;

  if v_joins > 0 then
    perform live.emit(p_live_id, 'VIEWERS_JOINED', jsonb_build_object('count', v_joins, 'sample', v_sample));
  end if;
  if v_count <> s.viewer_count then
    update live.sessions set viewer_count = v_count, peak_viewers = greatest(peak_viewers, v_count),
                             joins_flushed_at = v_now
    where id = p_live_id returning * into s;
    perform live.emit(p_live_id, 'VIEWER_COUNT', jsonb_build_object('count', s.viewer_count, 'peak', s.peak_viewers));
  end if;
  if coalesce(array_length(v_crossed, 1), 0) > 0 then
    update live.sessions set viewer_milestones_reached =
      (select array_agg(distinct x order by x) from unnest(viewer_milestones_reached || v_crossed) x)
    where id = p_live_id;
    perform live.emit(p_live_id, 'VIEWER_MILESTONE',
      jsonb_build_object('milestone', v_crossed[array_length(v_crossed, 1)], 'count', v_count));
  end if;
end $$;

-- Single entry point. Non-overlapping (advisory lock). Each item runs in its own
-- subtransaction so one failure (e.g. a deadlock victim) never blocks the rest.
create function live.show_tick() returns jsonb
language plpgsql set search_path = '' as $$
declare
  r record;
  n_battles integer := 0;
  n_viewers integer := 0;
  n_stale integer := 0;
  n_expired integer := 0;
  n_pruned integer := 0;
  n_errors integer := 0;
  c_host_stale numeric := live.cfg_num('{limits,host_stale_s}', 90, 20, 600);
begin
  if not pg_try_advisory_xact_lock(hashtextextended('live.show_tick', 0)) then
    return jsonb_build_object('skipped', true);
  end if;

  for r in select b.id from live.battles b where b.status in ('accepted', 'live', 'locked') order by b.id loop
    begin
      perform live.tick_battle(r.id);
      n_battles := n_battles + 1;
    exception when others then
      n_errors := n_errors + 1;
      raise warning 'live.tick_battle(%) failed: % (%)', r.id, sqlerrm, sqlstate;
    end;
  end loop;

  begin
    n_expired := live.expire_invites(null);
  exception when others then
    n_errors := n_errors + 1;
    raise warning 'live.expire_invites failed: % (%)', sqlerrm, sqlstate;
  end;

  for r in select s.id from live.sessions s
           where s.status = 'live' and s.host_heartbeat_at < clock_timestamp() - make_interval(secs => c_host_stale)
           order by s.id loop
    begin
      perform live.end_session(r.id, 'stale');
      n_stale := n_stale + 1;
    exception when others then
      n_errors := n_errors + 1;
      raise warning 'live.end_session(%) failed: % (%)', r.id, sqlerrm, sqlstate;
    end;
  end loop;

  for r in select s.id from live.sessions s where s.status = 'live' order by s.id loop
    begin
      perform live.tick_viewers(r.id);
      n_viewers := n_viewers + 1;
    exception when others then
      n_errors := n_errors + 1;
      raise warning 'live.tick_viewers(%) failed: % (%)', r.id, sqlerrm, sqlstate;
    end;
  end loop;

  -- Retention: the replay log of ended LIVEs is kept 24 h.
  delete from live.events e using live.sessions s
  where e.live_id = s.id and s.status = 'ended' and s.ended_at < now() - interval '24 hours';
  get diagnostics n_pruned = row_count;

  return jsonb_build_object('battles', n_battles, 'viewers', n_viewers, 'stale_ended', n_stale,
                            'invites_expired', n_expired, 'events_pruned', n_pruned, 'errors', n_errors);
end $$;

-- For an external scheduler (edge function with the service role) when pg_cron is unavailable.
create function public.live_show_tick()
returns jsonb
language sql security definer set search_path = '' as $$
  select live.show_tick()
$$;
