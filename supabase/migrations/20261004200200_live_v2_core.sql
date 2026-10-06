-- =============================================================================
-- Privity LIVE v2 — core helpers (all internal; not callable by client roles)
-- Every function pins search_path = '' and fully qualifies objects.
-- Rollback: supabase/rollback/20261004200100_live_v2_down.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Errors, time, identity
-- -----------------------------------------------------------------------------
create function live.fail(p_code text, p_detail text default null) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, p_code);
end $$;

-- ISO-8601 UTC with millisecond precision: identical to JS Date#toISOString().
create function live.iso(p_ts timestamptz) returns text
language sql stable set search_path = '' as $$
  select case when p_ts is null then null
              else to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
$$;

create function live.jnum(p jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'number' then (p #>> '{}')::numeric else null end
$$;

create function live.is_platform_banned(p_uid uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from live.platform_bans b
                 where b.user_id = p_uid and (b.banned_until is null or b.banned_until > now()))
$$;

create function live.require_uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception using errcode = '28000', message = 'NOT_AUTHENTICATED';
  end if;
  if live.is_platform_banned(v) then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_SUSPENDED';
  end if;
  return v;
end $$;

create function live.is_admin(p_uid uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from live.app_roles r where r.user_id = p_uid and r.role = 'admin')
$$;

create function live.is_moderator(p_uid uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from live.app_roles r where r.user_id = p_uid and r.role in ('admin', 'moderator'))
$$;

create function live.require_admin() returns uuid
language plpgsql stable set search_path = '' as $$
declare v uuid := live.require_uid();
begin
  if not live.is_admin(v) then perform live.fail('NOT_AUTHORIZED'); end if;
  return v;
end $$;

create function live.user_ref(p_uid uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p_uid,
    'handle', coalesce(p.handle, ''),
    'display_name', coalesce(nullif(p.name, ''), nullif(p.handle, ''), 'Privity member'),
    'avatar_url', p.avatar)
  from (select 1) one
  left join public.profiles p on p.id = p_uid
$$;

create function live.flag(p_key text) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select f.enabled from live.feature_flags f where f.key = p_key), false)
$$;

create function live.environment() returns text
language sql stable set search_path = '' as $$
  select coalesce((select d.environment from live.deployment d where d.id), 'production')
$$;

create function live.audit(p_actor uuid, p_action text, p_target text, p_before jsonb, p_after jsonb) returns void
language sql set search_path = '' as $$
  insert into live.admin_audit_log (actor_id, action, target, before, after)
  values (p_actor, p_action, p_target, p_before, p_after)
$$;

-- -----------------------------------------------------------------------------
-- Show configuration (server reads detector thresholds/limits; always clamped)
-- -----------------------------------------------------------------------------
create function live.cfg() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce((select c.config from live.show_config c where c.is_active), '{}'::jsonb)
$$;

create function live.cfg_version() returns integer
language sql stable set search_path = '' as $$
  select coalesce((select c.version from live.show_config c where c.is_active), 0)
$$;

create function live.cfg_num(p_path text[], p_default numeric, p_min numeric, p_max numeric) returns numeric
language sql stable set search_path = '' as $$
  select least(p_max, greatest(p_min, coalesce(live.jnum(live.cfg() #> p_path), p_default)))
$$;

create function live.cfg_ints(p_path text[], p_default integer[]) returns integer[]
language plpgsql stable set search_path = '' as $$
declare v jsonb := live.cfg() #> p_path; out integer[];
begin
  if jsonb_typeof(v) <> 'array' then return p_default; end if;
  select array_agg(x order by x) into out
  from (select distinct round((e #>> '{}')::numeric)::integer as x from jsonb_array_elements(v) e
        where case when jsonb_typeof(e) = 'number' then (e #>> '{}')::numeric between 1 and 100000000 else false end) t;
  return coalesce(out, p_default);
end $$;

-- -----------------------------------------------------------------------------
-- Relationships & access
-- -----------------------------------------------------------------------------
create function live.is_blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from social.blocks b
                 where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a))
$$;

create function live.is_following(p_follower uuid, p_followee uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from social.follows f where f.follower_id = p_follower and f.followee_id = p_followee)
$$;

-- Single source of truth for "may this user see this LIVE" (snapshot, events,
-- realtime topic, media token, gifts, comments).
create function live.can_view(p_live_id uuid, p_uid uuid, p_require_live boolean default true) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((
    select case
      when p_uid is null then false
      when p_require_live and s.status <> 'live' then false
      when s.host_id = p_uid then true
      when live.is_platform_banned(p_uid) then false
      when live.is_blocked_between(s.host_id, p_uid) then false
      when exists (select 1 from live.host_bans hb where hb.host_id = s.host_id and hb.user_id = p_uid) then false
      when live.is_moderator(p_uid) then true
      when s.visibility = 'public' then true
      when exists (select 1 from live.session_allowlist a where a.live_id = s.id and a.user_id = p_uid) then true
      when exists (select 1 from live.guests g where g.live_id = s.id and g.user_id = p_uid and g.status = 'accepted') then true
      when s.visibility = 'followers' and live.is_following(p_uid, s.host_id) then true
      else false
    end
    from live.sessions s where s.id = p_live_id), false)
$$;

-- -----------------------------------------------------------------------------
-- Authoritative events
-- -----------------------------------------------------------------------------
create function live.event_json(e live.events) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'event_id', e.event_id,
    'live_id', e.live_id,
    'battle_id', e.battle_id,
    'event_type', e.event_type,
    'actor_id', e.actor_id,
    'server_ts', live.iso(e.server_ts),
    'seq', e.seq,
    'schema_version', e.schema_version,
    'payload', e.payload)
$$;

-- Appends one event to the LIVE's ordered stream and broadcasts it on the PRIVATE
-- channel `live:{id}`. Runs inside the caller's transaction: the seq increment,
-- the outbox row and the broadcast row (realtime.messages) all commit together or
-- not at all. Realtime only streams committed rows → no event without a fact.
-- The session row lock taken here is held until commit, so seq order == commit order.
create function live.emit(p_live_id uuid, p_type text, p_payload jsonb, p_battle_id uuid default null, p_actor uuid default null)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_seq bigint;
  v_event live.events;
  v_env jsonb;
begin
  update live.sessions set last_seq = last_seq + 1 where id = p_live_id returning last_seq into v_seq;
  if v_seq is null then perform live.fail('LIVE_NOT_FOUND'); end if;
  insert into live.events (live_id, seq, battle_id, event_type, actor_id, server_ts, schema_version, payload)
  values (p_live_id, v_seq, p_battle_id, p_type, p_actor, clock_timestamp(), 1, coalesce(p_payload, '{}'::jsonb))
  returning * into v_event;
  v_env := live.event_json(v_event);
  perform realtime.send(v_env, p_type, 'live:' || p_live_id::text, true);
  return v_env;
end $$;

-- Personal, non-sequenced notices (guest requests, battle invites, decisions).
-- Clients treat them as "something changed, refetch"; they carry no authority.
create function live.notify_user(p_uid uuid, p_type text, p_payload jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('kind', 'notice', 'type', p_type, 'payload', coalesce(p_payload, '{}'::jsonb),
                       'server_ts', live.iso(clock_timestamp())),
    p_type, 'user:' || p_uid::text, true);
end $$;

-- -----------------------------------------------------------------------------
-- Battle formats (SQL mirror of apps/admin/src/live/battle/timeline.ts;
-- parity is verified by supabase/verify tests)
-- -----------------------------------------------------------------------------
create function live.segment_multiplier(p_seg jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case p_seg->>'kind'
    when 'break' then 0
    when 'normal' then 1
    else coalesce(live.jnum(p_seg->'multiplier'), case when p_seg->>'kind' = 'bonus' then 2 else 1 end)
  end
$$;

create function live.validate_format(p jsonb) returns text[]
language plpgsql immutable set search_path = '' as $$
declare
  errs text[] := '{}';
  segs jsonb;
  n integer;
  seg jsonb;
  i integer := 0;
  k text;
  s numeric;
  m numeric;
  w numeric;
  total numeric := 0;
  elapsed numeric := 0;
  expected_pull integer := 1;
  has_pulls boolean := false;
  has_mixed boolean := false;
  intro_ms numeric;
  countdown_s numeric;
  final_s numeric;
begin
  if jsonb_typeof(p) is distinct from 'object' then return array['Format must be an object.']; end if;
  segs := p->'segments';
  if jsonb_typeof(segs) is distinct from 'array' or jsonb_array_length(segs) = 0 then
    return array['Format must contain at least one segment.'];
  end if;
  n := jsonb_array_length(segs);
  intro_ms := live.jnum(p->'intro_ms');
  countdown_s := live.jnum(p->'countdown_s');
  final_s := live.jnum(p->'final_countdown_s');

  if intro_ms is null or intro_ms < 0 or intro_ms > 10000 then errs := errs || 'intro_ms out of range.'::text; end if;
  if countdown_s is null or countdown_s < 0 or countdown_s > 10 then errs := errs || 'countdown_s out of range.'::text; end if;
  if coalesce(p->>'scoring', '') not in ('total', 'pulls') then errs := errs || 'scoring must be total or pulls.'::text; end if;
  if p ? 'tiebreak' and coalesce(p->>'tiebreak', '') not in ('total', 'draw') then
    errs := errs || 'tiebreak must be total or draw.'::text;
  end if;

  for seg in select value from jsonb_array_elements(segs) loop
    total := total + coalesce(live.jnum(seg->'s'), 0);
  end loop;
  if total < 30 or total > 1800 then
    errs := errs || format('Active duration %ss must be between 30s and 1800s.', total);
  end if;
  if final_s is null or final_s < 0 or final_s > total then
    errs := errs || 'final_countdown_s must be within the active duration.'::text;
  end if;
  if segs->0->>'kind' = 'break' or segs->(n - 1)->>'kind' = 'break' then
    errs := errs || 'A format cannot start or end with a break.'::text;
  end if;

  for seg in select value from jsonb_array_elements(segs) loop
    k := seg->>'kind';
    s := live.jnum(seg->'s');
    if k is null or k not in ('normal', 'bonus', 'pull', 'break') then
      errs := errs || format('Segment %s: unknown kind.', i);
    end if;
    if s is null or s <= 0 then errs := errs || format('Segment %s: duration must be > 0.', i); end if;
    m := live.segment_multiplier(seg);
    if m < 0 or m > 5 then errs := errs || format('Segment %s: multiplier out of range.', i); end if;
    if k = 'bonus' and m <= 1 then errs := errs || format('Segment %s: bonus multiplier must be > 1.', i); end if;
    if seg ? 'warning_s' then
      w := live.jnum(seg->'warning_s');
      if w is null or w < 0 then errs := errs || format('Segment %s: warning_s must be >= 0.', i); end if;
      if w > elapsed then errs := errs || format('Segment %s: warning_s exceeds the time before the segment.', i); end if;
    end if;
    if k = 'pull' then
      has_pulls := true;
      if live.jnum(seg->'pull') is distinct from expected_pull then
        errs := errs || format('Segment %s: pulls must be numbered sequentially from 1.', i);
      end if;
      expected_pull := expected_pull + 1;
    end if;
    if k in ('normal', 'bonus') then has_mixed := true; end if;
    elapsed := elapsed + coalesce(s, 0);
    i := i + 1;
  end loop;

  if p->>'scoring' = 'pulls' and not has_pulls then errs := errs || 'Pull scoring requires pull segments.'::text; end if;
  if has_pulls and has_mixed then errs := errs || 'Pull formats cannot mix normal/bonus segments.'::text; end if;
  return errs;
end $$;

-- Pure compiler: absolute, contiguous, non-overlapping segments (ms-aligned).
create function live.compile_timeline_json(p_def jsonb, p_intro_at timestamptz) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  errs text[] := live.validate_format(p_def);
  cur timestamptz := date_trunc('milliseconds', p_intro_at);
  starts timestamptz;
  arr jsonb := '[]'::jsonb;
  idx integer := 0;
  seg jsonb;
  dur bigint;
  k text;
begin
  if coalesce(array_length(errs, 1), 0) > 0 then
    perform live.fail('INVALID_BATTLE_FORMAT', array_to_string(errs, ' '));
  end if;

  dur := round(live.jnum(p_def->'intro_ms'));
  if dur > 0 then
    arr := arr || jsonb_build_array(jsonb_build_object('idx', idx, 'kind', 'intro', 'starts_at', live.iso(cur),
      'ends_at', live.iso(cur + make_interval(secs => dur / 1000.0)), 'multiplier', 0, 'pull_no', null,
      'warning_ms', 0, 'label_key', null));
    idx := idx + 1;
    cur := cur + make_interval(secs => dur / 1000.0);
  end if;
  dur := round(live.jnum(p_def->'countdown_s') * 1000);
  if dur > 0 then
    arr := arr || jsonb_build_array(jsonb_build_object('idx', idx, 'kind', 'countdown', 'starts_at', live.iso(cur),
      'ends_at', live.iso(cur + make_interval(secs => dur / 1000.0)), 'multiplier', 0, 'pull_no', null,
      'warning_ms', 0, 'label_key', null));
    idx := idx + 1;
    cur := cur + make_interval(secs => dur / 1000.0);
  end if;
  starts := cur;

  for seg in select value from jsonb_array_elements(p_def->'segments') loop
    k := seg->>'kind';
    dur := round(live.jnum(seg->'s') * 1000);
    if dur > 0 then
      arr := arr || jsonb_build_array(jsonb_build_object(
        'idx', idx,
        'kind', k,
        'starts_at', live.iso(cur),
        'ends_at', live.iso(cur + make_interval(secs => dur / 1000.0)),
        'multiplier', live.segment_multiplier(seg),
        'pull_no', case when k = 'pull' then live.jnum(seg->'pull') else null end,
        'warning_ms', round(coalesce(live.jnum(seg->'warning_s'), 0) * 1000),
        'label_key', seg->>'label'));
      idx := idx + 1;
      cur := cur + make_interval(secs => dur / 1000.0);
    end if;
  end loop;

  return jsonb_build_object(
    'intro_at', live.iso(date_trunc('milliseconds', p_intro_at)),
    'starts_at', live.iso(starts),
    'ends_at', live.iso(cur),
    'final_countdown_ms', round(live.jnum(p_def->'final_countdown_s') * 1000),
    'timeline', arr);
end $$;

-- -----------------------------------------------------------------------------
-- JSON projections (shapes match apps/admin/src/live/core/events.ts)
-- -----------------------------------------------------------------------------
create function live.timeline_json(p_battle_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'idx', t.idx, 'kind', t.kind, 'starts_at', live.iso(t.starts_at), 'ends_at', live.iso(t.ends_at),
      'multiplier', t.multiplier, 'pull_no', t.pull_no, 'warning_ms', t.warning_ms, 'label_key', t.label_key)
    order by t.idx), '[]'::jsonb)
  from live.battle_timeline t where t.battle_id = p_battle_id
$$;

create function live.pull_scores_json(p_battle_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('pull_no', p.pull_no, 'a', p.a, 'b', p.b) order by p.pull_no), '[]'::jsonb)
  from live.battle_pull_scores p where p.battle_id = p_battle_id
$$;

create function live.battle_json(p_battle_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'battle_id', b.id,
    'format_id', b.format_id,
    'status', b.status,
    'side_a', jsonb_build_object('live_id', b.live_a, 'host', live.user_ref(b.host_a)),
    'side_b', jsonb_build_object('live_id', b.live_b, 'host', live.user_ref(b.host_b)),
    'scoring', b.scoring,
    'invite_expires_at', live.iso(b.invite_expires_at),
    'intro_at', live.iso(b.intro_at),
    'starts_at', live.iso(b.starts_at),
    'ends_at', live.iso(b.ends_at),
    'final_countdown_ms', b.final_countdown_ms,
    'timeline', live.timeline_json(b.id),
    'score_a', b.score_a,
    'score_b', b.score_b,
    'pull_scores', live.pull_scores_json(b.id),
    'lead_side', b.lead_side,
    'score_version', b.score_version,
    'result', b.result)
  from live.battles b where b.id = p_battle_id
$$;

create function live.top_supporters_json(p_live_id uuid, p_limit integer default 3) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('user', live.user_ref(x.user_id), 'total', x.total_coins)
                            order by x.total_coins desc, x.first_gift_at), '[]'::jsonb)
  from (select s.user_id, s.total_coins, s.first_gift_at from live.supporters s
        where s.live_id = p_live_id and s.total_coins > 0
        order by s.total_coins desc, s.first_gift_at limit p_limit) x
$$;

-- Must be called while holding at least FOR SHARE on the session row so that
-- last_seq and every value in the snapshot describe the same committed state.
create function live.snapshot_json(p_live_id uuid, p_uid uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'live_id', s.id,
    'last_seq', s.last_seq,
    'server_now', live.iso(clock_timestamp()),
    'status', s.status,
    'title', s.title,
    'visibility', s.visibility,
    'started_at', live.iso(s.started_at),
    'host', live.user_ref(s.host_id),
    'viewer_count', s.viewer_count,
    'peak_viewers', s.peak_viewers,
    'top_supporters', live.top_supporters_json(s.id, 3),
    'battle', (select live.battle_json(b.id) from live.battles b
               where b.id = s.battle_id
                 and b.status in ('accepted', 'live', 'locked', 'finalized')
                 and (b.status <> 'finalized' or b.finalized_at > clock_timestamp() - interval '60 seconds')),
    'config_version', live.cfg_version(),
    'comments_enabled', s.comments_enabled,
    'guests', (select coalesce(jsonb_agg(live.user_ref(g.user_id) || jsonb_build_object('slot', g.slot) order by g.slot), '[]'::jsonb)
               from live.guests g where g.live_id = s.id and g.status = 'accepted'),
    'recent_comments', (select coalesce(jsonb_agg(jsonb_build_object(
                          'comment_id', c.id, 'author', live.user_ref(c.author_id), 'text', c.body,
                          'created_at', live.iso(c.created_at)) order by c.created_at), '[]'::jsonb)
                        from (select * from live.comments c0
                              where c0.live_id = s.id and c0.deleted_at is null
                              order by c0.created_at desc limit 50) c),
    'me', jsonb_build_object(
      'user_id', p_uid,
      'is_host', s.host_id = p_uid,
      'guest_status', (select g.status from live.guests g where g.live_id = s.id and g.user_id = p_uid),
      'muted_until', (select live.iso(m.muted_until) from live.session_mutes m
                      where m.live_id = s.id and m.user_id = p_uid and m.muted_until > now()),
      'following_host', live.is_following(p_uid, s.host_id)))
  from live.sessions s where s.id = p_live_id
$$;
