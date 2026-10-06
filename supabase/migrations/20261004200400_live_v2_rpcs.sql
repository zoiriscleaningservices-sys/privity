-- =============================================================================
-- Privity LIVE v2 — lifecycle, viewing, comments, moderation, guests, social,
-- reads and admin RPCs. All client entry points are SECURITY DEFINER functions
-- in `public` named live_*; identity always comes from auth.uid().
-- Rollback: supabase/rollback/20261004200100_live_v2_down.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internal helpers
-- -----------------------------------------------------------------------------
create function live.can_moderate(p_live_id uuid, p_uid uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from live.sessions s where s.id = p_live_id and s.host_id = p_uid) or live.is_moderator(p_uid)
$$;

create function live.clean_text(p text) returns text
language sql immutable set search_path = '' as $$
  -- newlines/tabs → space; other control chars and bidi overrides removed; trimmed
  select btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[\r\n\t]+', ' ', 'g'),
                              '[[:cntrl:]\u202A-\u202E\u2066-\u2069]', '', 'g'))
$$;

-- Marks the user present. A re-join counts as a new join (for VIEWERS_JOINED) only
-- after being away for 30 s, so leave/join loops cannot spam the audience.
create function live.touch_viewer(p_live_id uuid, p_uid uuid) returns void
language sql set search_path = '' as $$
  insert into live.viewers as v (live_id, user_id) values (p_live_id, p_uid)
  on conflict (live_id, user_id) do update set
    joined_at = case when v.left_at is not null and v.left_at < clock_timestamp() - interval '30 seconds'
                     then clock_timestamp() else v.joined_at end,
    join_announced = case when v.left_at is not null and v.left_at < clock_timestamp() - interval '30 seconds'
                          then false else v.join_announced end,
    last_seen_at = clock_timestamp(),
    left_at = null
$$;

-- Ends a LIVE: resolves its battle (cancel before start / forfeit while running /
-- normal finalize after the end), cancels invites, releases guests and viewers,
-- then emits LIVE_ENDED. Idempotent.
create function live.end_session(p_live_id uuid, p_reason text) returns boolean
language plpgsql set search_path = '' as $$
declare
  s live.sessions;
  b live.battles;
  i live.battles;
  v_bid uuid;
  v_now timestamptz;
  v_side text;
begin
  select * into s from live.sessions where id = p_live_id;
  if not found then perform live.fail('LIVE_NOT_FOUND'); end if;
  v_bid := s.battle_id;
  if v_bid is not null then
    select * into b from live.battles where id = v_bid;
    perform live.lock_sessions(array[b.live_a, b.live_b]);
  else
    perform live.lock_sessions(array[p_live_id]);
  end if;
  select * into s from live.sessions where id = p_live_id;
  if s.status = 'ended' then return false; end if;
  if s.battle_id is distinct from v_bid then
    raise exception using errcode = '40001', message = 'RETRY', detail = 'battle changed while acquiring locks';
  end if;

  if v_bid is not null then
    select * into b from live.battles where id = v_bid for update;
    if b.status in ('accepted', 'live', 'locked') then
      v_now := clock_timestamp();
      v_side := case when b.live_a = p_live_id then 'a' else 'b' end;
      if v_now < b.starts_at then
        perform live.cancel_battle(b.id, 'host_left');
      elsif v_now < b.ends_at then
        perform live.finalize_battle(b.id, v_side);
      else
        perform live.finalize_battle(b.id, null);
      end if;
    end if;
  end if;

  for i in select * from live.battles x where x.status = 'invited' and (x.live_a = p_live_id or x.live_b = p_live_id)
           order by x.id for update loop
    perform live.cancel_battle(i.id, 'host_left');
  end loop;

  update live.guests set status = 'left', ended_at = clock_timestamp() where live_id = p_live_id and status = 'accepted';
  update live.guests set status = 'cancelled', decided_at = clock_timestamp() where live_id = p_live_id and status = 'requested';
  update live.viewers set left_at = clock_timestamp() where live_id = p_live_id and left_at is null;
  update live.sessions set status = 'ended', ended_at = clock_timestamp(), end_reason = p_reason, viewer_count = 0
  where id = p_live_id;
  perform live.emit(p_live_id, 'LIVE_ENDED', jsonb_build_object('reason', p_reason));
  return true;
end $$;

-- =============================================================================
-- LIFECYCLE
-- =============================================================================
create function public.live_start(p_title text, p_visibility text default 'public', p_allowlist uuid[] default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := live.require_uid();
  v_title text := live.clean_text(p_title);
  v_old live.sessions;
  v_id uuid;
  c_stale numeric := live.cfg_num('{limits,host_stale_s}', 90, 20, 600);
begin
  if not live.flag_for('live_v2', v_uid) and not live.is_admin(v_uid) then perform live.fail('LIVE_V2_DISABLED'); end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid) then perform live.fail('PROFILE_REQUIRED'); end if;
  if char_length(v_title) not between 1 and 120 then perform live.fail('INVALID_TITLE'); end if;
  if p_visibility is null or p_visibility not in ('public', 'followers', 'private') then perform live.fail('INVALID_VISIBILITY'); end if;
  if coalesce(array_length(p_allowlist, 1), 0) > 500 then perform live.fail('ALLOWLIST_TOO_LARGE'); end if;

  -- The host wallet must exist before any gift can lock it (lock order: wallets first).
  insert into live.wallets (user_id) values (v_uid) on conflict (user_id) do nothing;

  select * into v_old from live.sessions s where s.host_id = v_uid and s.status = 'live';
  if found then
    if v_old.host_heartbeat_at < clock_timestamp() - make_interval(secs => c_stale) then
      perform live.end_session(v_old.id, 'stale');
    else
      perform live.fail('ALREADY_LIVE');
    end if;
  end if;

  begin
    insert into live.sessions (host_id, title, visibility) values (v_uid, v_title, p_visibility) returning id into v_id;
  exception when unique_violation then
    perform live.fail('ALREADY_LIVE');
  end;

  if p_visibility = 'private' and p_allowlist is not null then
    insert into live.session_allowlist (live_id, user_id)
    select v_id, u.id from auth.users u where u.id = any(p_allowlist) and u.id <> v_uid
    on conflict do nothing;
  end if;

  perform live.emit(v_id, 'LIVE_STARTED', jsonb_build_object('title', v_title, 'host', live.user_ref(v_uid)), null, v_uid);
  return jsonb_build_object('live_id', v_id, 'snapshot', live.snapshot_json(v_id, v_uid));
end $$;

create function public.live_end(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); v_host uuid;
begin
  select s.host_id into v_host from live.sessions s where s.id = p_live_id;
  if v_host is null or v_host <> v_uid then perform live.fail('NOT_AUTHORIZED'); end if;
  return jsonb_build_object('ok', true, 'ended', live.end_session(p_live_id, 'host_ended'));
end $$;

create function public.live_heartbeat_host(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); v_seq bigint;
begin
  update live.sessions s set host_heartbeat_at = clock_timestamp()
  where s.id = p_live_id and s.host_id = v_uid and s.status = 'live'
  returning s.last_seq into v_seq;
  if v_seq is null then perform live.fail('LIVE_NOT_ACTIVE'); end if;
  return jsonb_build_object('ok', true, 'server_now', live.iso(clock_timestamp()), 'last_seq', v_seq);
end $$;

-- =============================================================================
-- VIEWING
-- =============================================================================
create function public.live_join(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); s live.sessions;
begin
  select * into s from live.sessions where id = p_live_id;
  if not found then perform live.fail('LIVE_NOT_FOUND'); end if;
  if not live.can_view(p_live_id, v_uid, false) then perform live.fail('LIVE_ACCESS_DENIED'); end if;
  if s.status = 'live' and s.host_id <> v_uid then
    perform live.touch_viewer(p_live_id, v_uid);
  end if;
  perform 1 from live.sessions where id = p_live_id for share;
  return live.snapshot_json(p_live_id, v_uid);
end $$;

create function public.live_heartbeat(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); s live.sessions;
begin
  select * into s from live.sessions where id = p_live_id;
  if not found then perform live.fail('LIVE_NOT_FOUND'); end if;
  if s.status <> 'live' or not live.can_view(p_live_id, v_uid) then
    update live.viewers set left_at = clock_timestamp() where live_id = p_live_id and user_id = v_uid and left_at is null;
    return jsonb_build_object('ok', false, 'code', case when s.status <> 'live' then 'LIVE_ENDED' else 'LIVE_ACCESS_DENIED' end,
                              'server_now', live.iso(clock_timestamp()), 'last_seq', s.last_seq, 'status', s.status);
  end if;
  if s.host_id <> v_uid then perform live.touch_viewer(p_live_id, v_uid); end if;
  return jsonb_build_object('ok', true, 'server_now', live.iso(clock_timestamp()), 'last_seq', s.last_seq, 'status', s.status);
end $$;

create function public.live_leave(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  update live.viewers set left_at = clock_timestamp() where live_id = p_live_id and user_id = v_uid and left_at is null;
  return jsonb_build_object('ok', true);
end $$;

create function public.live_get_snapshot(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  if not live.can_view(p_live_id, v_uid, false) then perform live.fail('LIVE_ACCESS_DENIED'); end if;
  perform 1 from live.sessions where id = p_live_id for share;
  return live.snapshot_json(p_live_id, v_uid);
end $$;

-- Gap fill. If the requested range was pruned, reset_required=true → client loads a snapshot.
create function public.live_get_events_since(p_live_id uuid, p_after_seq bigint, p_limit integer default 100)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := live.require_uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_last bigint;
  v_min bigint;
  v_events jsonb;
  v_max_returned bigint;
begin
  if p_after_seq is null or p_after_seq < 0 then perform live.fail('INVALID_SEQ'); end if;
  if not live.can_view(p_live_id, v_uid, false) then perform live.fail('LIVE_ACCESS_DENIED'); end if;
  select s.last_seq into v_last from live.sessions s where s.id = p_live_id;
  select min(e.seq) into v_min from live.events e where e.live_id = p_live_id;
  if p_after_seq < v_last and (v_min is null or v_min > p_after_seq + 1) then
    return jsonb_build_object('events', '[]'::jsonb, 'last_seq', v_last, 'has_more', false, 'reset_required', true);
  end if;
  -- seq is contiguous per LIVE (assigned in the same transaction as the row), so a page is a seq range.
  select coalesce(jsonb_agg(live.event_json(e) order by e.seq), '[]'::jsonb), max(e.seq) into v_events, v_max_returned
  from live.events e
  where e.live_id = p_live_id and e.seq > p_after_seq and e.seq <= least(v_last, p_after_seq + v_limit);
  return jsonb_build_object('events', v_events, 'last_seq', v_last,
                            'has_more', coalesce(v_max_returned, p_after_seq) < v_last, 'reset_required', false);
end $$;

create function public.live_list_active(p_limit integer default 50)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'live_id', x.id, 'title', x.title, 'visibility', x.visibility, 'host', live.user_ref(x.host_id),
            'viewer_count', x.viewer_count, 'started_at', live.iso(x.started_at),
            'in_battle', live.active_battle_id(x.id) is not null,
            'following_host', live.is_following(v_uid, x.host_id))
          order by x.viewer_count desc, x.started_at desc), '[]'::jsonb)
          from (select s.* from live.sessions s
                where s.status = 'live' and live.can_view(s.id, v_uid)
                order by s.viewer_count desc, s.started_at desc
                limit least(greatest(coalesce(p_limit, 50), 1), 100)) x);
end $$;

-- =============================================================================
-- COMMENTS
-- =============================================================================
create function public.live_comment(p_live_id uuid, p_text text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := live.require_uid();
  s live.sessions;
  v_text text := live.clean_text(p_text);
  v_priv boolean;
  v_id uuid;
  v_at timestamptz;
  c_min_ms numeric := live.cfg_num('{limits,comment_min_interval_ms}', 1000, 0, 60000);
  c_max10 numeric := live.cfg_num('{limits,comment_max_per_10s}', 5, 1, 100);
begin
  select * into s from live.sessions where id = p_live_id;
  if not found or s.status <> 'live' then perform live.fail('LIVE_NOT_ACTIVE'); end if;
  if not live.can_view(p_live_id, v_uid) then perform live.fail('LIVE_ACCESS_DENIED'); end if;
  v_priv := s.host_id = v_uid or live.is_moderator(v_uid);
  if not s.comments_enabled and not v_priv then perform live.fail('COMMENTS_DISABLED'); end if;
  if exists (select 1 from live.session_mutes m where m.live_id = p_live_id and m.user_id = v_uid and m.muted_until > now()) then
    perform live.fail('MUTED');
  end if;
  if char_length(v_text) not between 1 and 300 then perform live.fail('INVALID_COMMENT'); end if;

  -- Per-user rate limit, serialized per user so parallel requests cannot bypass it.
  perform pg_advisory_xact_lock(hashtextextended('live.comment:' || v_uid::text, 0));
  if not v_priv then
    if exists (select 1 from live.comments c where c.author_id = v_uid
               and c.created_at > clock_timestamp() - make_interval(secs => c_min_ms / 1000.0)) then
      perform live.fail('RATE_LIMITED');
    end if;
    if (select count(*) from live.comments c where c.author_id = v_uid
        and c.created_at > clock_timestamp() - interval '10 seconds') >= c_max10 then
      perform live.fail('RATE_LIMITED');
    end if;
  end if;

  insert into live.comments (live_id, author_id, body) values (p_live_id, v_uid, v_text) returning id, created_at into v_id, v_at;
  perform live.emit(p_live_id, 'COMMENT_CREATED',
    jsonb_build_object('comment_id', v_id, 'author', live.user_ref(v_uid), 'text', v_text), null, v_uid);
  return jsonb_build_object('ok', true, 'comment_id', v_id, 'created_at', live.iso(v_at));
end $$;

create function public.live_delete_comment(p_comment_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); c live.comments;
begin
  select * into c from live.comments where id = p_comment_id;
  if not found or c.deleted_at is not null then perform live.fail('COMMENT_NOT_FOUND'); end if;
  if c.author_id <> v_uid and not live.can_moderate(c.live_id, v_uid) then perform live.fail('NOT_AUTHORIZED'); end if;
  update live.comments set deleted_at = clock_timestamp(), deleted_by = v_uid where id = p_comment_id;
  perform live.emit(c.live_id, 'COMMENT_DELETED', jsonb_build_object('comment_id', p_comment_id), null, v_uid);
  return jsonb_build_object('ok', true);
end $$;

create function public.live_set_comments_enabled(p_live_id uuid, p_enabled boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); v_prev boolean;
begin
  if not live.can_moderate(p_live_id, v_uid) then perform live.fail('NOT_AUTHORIZED'); end if;
  select s.comments_enabled into v_prev from live.sessions s where s.id = p_live_id and s.status = 'live' for no key update;
  if v_prev is null then perform live.fail('LIVE_NOT_ACTIVE'); end if;
  if v_prev = p_enabled then return jsonb_build_object('ok', true, 'comments_enabled', p_enabled); end if;
  update live.sessions set comments_enabled = p_enabled where id = p_live_id;
  if p_enabled then
    perform live.emit(p_live_id, 'SYSTEM_NOTICE',
      jsonb_build_object('code', 'comments_enabled', 'message', 'Comments are on.', 'severity', 'info'), null, v_uid);
  else
    perform live.emit(p_live_id, 'MODERATION_NOTICE',
      jsonb_build_object('action', 'room_muted', 'target', null, 'message', 'Comments are turned off.'), null, v_uid);
  end if;
  return jsonb_build_object('ok', true, 'comments_enabled', p_enabled);
end $$;

-- =============================================================================
-- MODERATION
-- =============================================================================
create function public.live_mute(p_live_id uuid, p_user_id uuid, p_minutes integer default 10)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); v_host uuid; v_until timestamptz;
begin
  select s.host_id into v_host from live.sessions s where s.id = p_live_id and s.status = 'live';
  if v_host is null then perform live.fail('LIVE_NOT_ACTIVE'); end if;
  if not live.can_moderate(p_live_id, v_uid) then perform live.fail('NOT_AUTHORIZED'); end if;
  if p_user_id is null or p_user_id in (v_host, v_uid) then perform live.fail('INVALID_TARGET'); end if;
  if p_minutes is null or p_minutes not between 1 and 1440 then perform live.fail('INVALID_DURATION'); end if;
  v_until := now() + make_interval(mins => p_minutes);
  insert into live.session_mutes (live_id, user_id, muted_until, created_by) values (p_live_id, p_user_id, v_until, v_uid)
  on conflict (live_id, user_id) do update set muted_until = excluded.muted_until, created_by = excluded.created_by;
  perform live.emit(p_live_id, 'MODERATION_NOTICE',
    jsonb_build_object('action', 'muted', 'target', live.user_ref(p_user_id), 'message', 'Muted in this LIVE.'), null, v_uid);
  perform live.notify_user(p_user_id, 'MUTED', jsonb_build_object('live_id', p_live_id, 'muted_until', live.iso(v_until)));
  return jsonb_build_object('ok', true, 'muted_until', live.iso(v_until));
end $$;

create function public.live_unmute(p_live_id uuid, p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  if not live.can_moderate(p_live_id, v_uid) then perform live.fail('NOT_AUTHORIZED'); end if;
  delete from live.session_mutes where live_id = p_live_id and user_id = p_user_id;
  perform live.notify_user(p_user_id, 'UNMUTED', jsonb_build_object('live_id', p_live_id));
  return jsonb_build_object('ok', true);
end $$;

-- Removes a user from the LIVE and bans them from this host's LIVEs.
create function public.live_kick(p_live_id uuid, p_user_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); v_host uuid; v_was_guest boolean;
begin
  select s.host_id into v_host from live.sessions s where s.id = p_live_id;
  if v_host is null then perform live.fail('LIVE_NOT_FOUND'); end if;
  if not live.can_moderate(p_live_id, v_uid) then perform live.fail('NOT_AUTHORIZED'); end if;
  if p_user_id is null or p_user_id in (v_host, v_uid) then perform live.fail('INVALID_TARGET'); end if;

  insert into live.host_bans (host_id, user_id, reason) values (v_host, p_user_id, left(live.clean_text(p_reason), 200))
  on conflict (host_id, user_id) do update set reason = excluded.reason;
  update live.viewers set left_at = clock_timestamp() where live_id = p_live_id and user_id = p_user_id and left_at is null;
  update live.guests set status = 'removed', ended_at = clock_timestamp()
  where live_id = p_live_id and user_id = p_user_id and status = 'accepted'
  returning true into v_was_guest;
  update live.guests set status = 'cancelled', decided_at = clock_timestamp()
  where live_id = p_live_id and user_id = p_user_id and status = 'requested';

  if coalesce(v_was_guest, false) then
    perform live.emit(p_live_id, 'GUEST_REMOVED', jsonb_build_object('guest', live.user_ref(p_user_id)), null, v_uid);
  end if;
  perform live.emit(p_live_id, 'MODERATION_NOTICE',
    jsonb_build_object('action', 'removed', 'target', live.user_ref(p_user_id), 'message', 'Removed from this LIVE.'), null, v_uid);
  perform live.notify_user(p_user_id, 'REMOVED_FROM_LIVE', jsonb_build_object('live_id', p_live_id));
  return jsonb_build_object('ok', true);
end $$;

create function public.live_unban(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  delete from live.host_bans where host_id = v_uid and user_id = p_user_id;
  return jsonb_build_object('ok', true);
end $$;

-- =============================================================================
-- GUESTS (co-host). Only the host can accept; media publish rights are derived
-- from live.guests.status = 'accepted' (see live_media_access).
-- =============================================================================
create function public.live_request_guest(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); s live.sessions; g live.guests;
begin
  select * into s from live.sessions where id = p_live_id;
  if not found or s.status <> 'live' then perform live.fail('LIVE_NOT_ACTIVE'); end if;
  if s.host_id = v_uid then perform live.fail('INVALID_TARGET'); end if;
  if not live.can_view(p_live_id, v_uid) then perform live.fail('LIVE_ACCESS_DENIED'); end if;
  if exists (select 1 from live.sessions x where x.host_id = v_uid and x.status = 'live') then perform live.fail('GUEST_UNAVAILABLE'); end if;

  select * into g from live.guests where live_id = p_live_id and user_id = v_uid for update;
  if found then
    if g.status = 'requested' then return jsonb_build_object('ok', true, 'status', 'requested'); end if;
    if g.status = 'accepted' then perform live.fail('ALREADY_GUEST'); end if;
    if g.status = 'removed' then perform live.fail('GUEST_REMOVED_BY_HOST'); end if;
    if g.status = 'declined' and g.decided_at > clock_timestamp() - interval '60 seconds' then
      perform live.fail('GUEST_REQUEST_COOLDOWN');
    end if;
  end if;
  if (select count(*) from live.guests x where x.live_id = p_live_id and x.status = 'requested') >= 50 then
    perform live.fail('GUEST_QUEUE_FULL');
  end if;

  insert into live.guests (live_id, user_id, status, requested_at) values (p_live_id, v_uid, 'requested', clock_timestamp())
  on conflict (live_id, user_id) do update set status = 'requested', slot = null, requested_at = clock_timestamp(),
                                              decided_at = null, ended_at = null;
  perform live.notify_user(s.host_id, 'GUEST_REQUESTED',
    jsonb_build_object('live_id', p_live_id, 'request_id', v_uid, 'user', live.user_ref(v_uid)));
  return jsonb_build_object('ok', true, 'status', 'requested');
end $$;

create function public.live_cancel_guest_request(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); v_host uuid;
begin
  update live.guests set status = 'cancelled', decided_at = clock_timestamp()
  where live_id = p_live_id and user_id = v_uid and status = 'requested';
  if found then
    select s.host_id into v_host from live.sessions s where s.id = p_live_id;
    perform live.notify_user(v_host, 'GUEST_REQUEST_CANCELLED', jsonb_build_object('live_id', p_live_id, 'request_id', v_uid));
  end if;
  return jsonb_build_object('ok', true);
end $$;

create function public.live_respond_guest(p_live_id uuid, p_user_id uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := live.require_uid();
  s live.sessions;
  g live.guests;
  v_slot integer;
  c_slots integer := live.cfg_num('{limits,guest_slots}', 3, 1, 8)::integer;
begin
  select * into s from live.sessions where id = p_live_id;
  if not found or s.host_id <> v_uid then perform live.fail('NOT_AUTHORIZED'); end if;
  perform live.lock_sessions(array[p_live_id]);
  select * into s from live.sessions where id = p_live_id;
  if s.status <> 'live' then perform live.fail('LIVE_NOT_ACTIVE'); end if;

  select * into g from live.guests where live_id = p_live_id and user_id = p_user_id for update;
  if not found or g.status <> 'requested' then perform live.fail('GUEST_REQUEST_NOT_FOUND'); end if;

  if not coalesce(p_accept, false) then
    update live.guests set status = 'declined', decided_at = clock_timestamp() where live_id = p_live_id and user_id = p_user_id;
    perform live.notify_user(p_user_id, 'GUEST_DECLINED', jsonb_build_object('live_id', p_live_id));
    return jsonb_build_object('ok', true, 'status', 'declined');
  end if;

  if not live.can_view(p_live_id, p_user_id)
     or exists (select 1 from live.sessions x where x.host_id = p_user_id and x.status = 'live') then
    update live.guests set status = 'cancelled', decided_at = clock_timestamp() where live_id = p_live_id and user_id = p_user_id;
    perform live.fail('GUEST_UNAVAILABLE');
  end if;

  select min(n) into v_slot from generate_series(1, c_slots) n
  where not exists (select 1 from live.guests x where x.live_id = p_live_id and x.status = 'accepted' and x.slot = n);
  if v_slot is null then perform live.fail('GUEST_SLOTS_FULL'); end if;

  update live.guests set status = 'accepted', slot = v_slot, decided_at = clock_timestamp()
  where live_id = p_live_id and user_id = p_user_id;
  perform live.emit(p_live_id, 'GUEST_JOINED', jsonb_build_object('guest', live.user_ref(p_user_id), 'slot', v_slot), null, v_uid);
  perform live.notify_user(p_user_id, 'GUEST_ACCEPTED', jsonb_build_object('live_id', p_live_id, 'slot', v_slot));
  return jsonb_build_object('ok', true, 'status', 'accepted', 'slot', v_slot);
end $$;

create function public.live_leave_guest(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  update live.guests set status = 'left', ended_at = clock_timestamp()
  where live_id = p_live_id and user_id = v_uid and status = 'accepted';
  if found then
    perform live.emit(p_live_id, 'GUEST_LEFT', jsonb_build_object('guest', live.user_ref(v_uid), 'reason', 'left'), null, v_uid);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create function public.live_remove_guest(p_live_id uuid, p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  if not live.can_moderate(p_live_id, v_uid) then perform live.fail('NOT_AUTHORIZED'); end if;
  update live.guests set status = 'removed', ended_at = clock_timestamp()
  where live_id = p_live_id and user_id = p_user_id and status = 'accepted';
  if not found then perform live.fail('GUEST_NOT_FOUND'); end if;
  perform live.emit(p_live_id, 'GUEST_REMOVED', jsonb_build_object('guest', live.user_ref(p_user_id)), null, v_uid);
  perform live.notify_user(p_user_id, 'GUEST_REMOVED', jsonb_build_object('live_id', p_live_id));
  return jsonb_build_object('ok', true);
end $$;

create function public.live_list_guest_requests(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  if not exists (select 1 from live.sessions s where s.id = p_live_id and s.host_id = v_uid) then
    perform live.fail('NOT_AUTHORIZED');
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('request_id', g.user_id, 'user', live.user_ref(g.user_id),
                                                       'requested_at', live.iso(g.requested_at)) order by g.requested_at), '[]'::jsonb)
          from live.guests g where g.live_id = p_live_id and g.status = 'requested');
end $$;

-- =============================================================================
-- SOCIAL (D5: generic relationships; LIVE effects applied here)
-- =============================================================================
create function public.live_follow(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := live.require_uid();
  v_new integer;
  v_live uuid;
  v_count integer;
  v_reached integer[];
  v_crossed integer[];
  c_ms integer[] := live.cfg_ints('{detectors,follows,milestones}', '{10,50,100,500,1000}');
begin
  if p_user_id is null or p_user_id = v_uid then perform live.fail('INVALID_TARGET'); end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then perform live.fail('USER_NOT_FOUND'); end if;
  if live.is_blocked_between(v_uid, p_user_id) then perform live.fail('BLOCKED'); end if;

  insert into social.follows (follower_id, followee_id) values (v_uid, p_user_id) on conflict do nothing;
  get diagnostics v_new = row_count;

  if v_new > 0 then
    select s.id into v_live from live.sessions s where s.host_id = p_user_id and s.status = 'live';
    if v_live is not null and live.can_view(v_live, v_uid) then
      insert into live.session_follows (live_id, user_id) values (v_live, v_uid) on conflict do nothing;
      get diagnostics v_new = row_count;
      if v_new > 0 then
        perform live.lock_sessions(array[v_live]);
        update live.sessions set new_followers = new_followers + 1 where id = v_live
        returning new_followers, follow_milestones_reached into v_count, v_reached;
        perform live.emit(v_live, 'FOLLOW_RECEIVED', jsonb_build_object('follower', live.user_ref(v_uid)), null, v_uid);
        select coalesce(array_agg(m order by m), '{}') into v_crossed from unnest(c_ms) m
        where m <= v_count and not (m = any(v_reached));
        if array_length(v_crossed, 1) > 0 then
          update live.sessions set follow_milestones_reached = (select array_agg(distinct x order by x) from unnest(v_reached || v_crossed) x)
          where id = v_live;
          perform live.emit(v_live, 'FOLLOW_MILESTONE',
            jsonb_build_object('milestone', v_crossed[array_length(v_crossed, 1)], 'count', v_count));
        end if;
      end if;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'following', true);
end $$;

create function public.live_unfollow(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  delete from social.follows where follower_id = v_uid and followee_id = p_user_id;
  return jsonb_build_object('ok', true, 'following', false);
end $$;

create function public.live_block(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); v_my uuid; v_their uuid; i live.battles; v_hit boolean;
begin
  if p_user_id is null or p_user_id = v_uid then perform live.fail('INVALID_TARGET'); end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then perform live.fail('USER_NOT_FOUND'); end if;
  insert into social.blocks (blocker_id, blocked_id) values (v_uid, p_user_id) on conflict do nothing;
  delete from social.follows where (follower_id = v_uid and followee_id = p_user_id) or (follower_id = p_user_id and followee_id = v_uid);

  -- My LIVE: the blocked user leaves (viewer/guest/request).
  select s.id into v_my from live.sessions s where s.host_id = v_uid and s.status = 'live';
  if v_my is not null then
    update live.viewers set left_at = clock_timestamp() where live_id = v_my and user_id = p_user_id and left_at is null;
    v_hit := null;
    update live.guests set status = 'removed', ended_at = clock_timestamp()
    where live_id = v_my and user_id = p_user_id and status = 'accepted' returning true into v_hit;
    update live.guests set status = 'cancelled', decided_at = clock_timestamp()
    where live_id = v_my and user_id = p_user_id and status = 'requested';
    if coalesce(v_hit, false) then
      perform live.emit(v_my, 'GUEST_REMOVED', jsonb_build_object('guest', live.user_ref(p_user_id)), null, v_uid);
    end if;
  end if;

  -- Their LIVE: I leave.
  select s.id into v_their from live.sessions s where s.host_id = p_user_id and s.status = 'live';
  if v_their is not null then
    update live.viewers set left_at = clock_timestamp() where live_id = v_their and user_id = v_uid and left_at is null;
    v_hit := null;
    update live.guests set status = 'left', ended_at = clock_timestamp()
    where live_id = v_their and user_id = v_uid and status = 'accepted' returning true into v_hit;
    update live.guests set status = 'cancelled', decided_at = clock_timestamp()
    where live_id = v_their and user_id = v_uid and status = 'requested';
    if coalesce(v_hit, false) then
      perform live.emit(v_their, 'GUEST_LEFT', jsonb_build_object('guest', live.user_ref(v_uid), 'reason', 'left'), null, v_uid);
    end if;
  end if;

  -- Pending battle invites between the two are withdrawn.
  for i in select * from live.battles x where x.status = 'invited'
             and ((x.host_a = v_uid and x.host_b = p_user_id) or (x.host_a = p_user_id and x.host_b = v_uid))
           order by x.id for update loop
    perform live.cancel_battle(i.id, 'cancelled');
  end loop;
  return jsonb_build_object('ok', true, 'blocked', true);
end $$;

create function public.live_unblock(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  delete from social.blocks where blocker_id = v_uid and blocked_id = p_user_id;
  return jsonb_build_object('ok', true, 'blocked', false);
end $$;

-- =============================================================================
-- READS
-- =============================================================================
create function public.live_get_wallet()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); w live.wallets; v_test boolean := live.flag('test_credits');
begin
  select * into w from live.wallets where user_id = v_uid;
  return jsonb_build_object(
    'coins', coalesce(w.coins, 0),
    'test_coins', coalesce(w.test_coins, 0),
    'earnings', coalesce(w.earnings, 0),
    'test_earnings', coalesce(w.test_earnings, 0),
    -- The currency gifts are paid with right now. Test credits never mix with real balances.
    'active_currency', case when v_test then 'test_coins' else 'coins' end,
    'spendable', case when v_test then coalesce(w.test_coins, 0) else coalesce(w.coins, 0) end,
    'test_credits', v_test,
    'purchases_enabled', live.flag('purchases'),
    'environment', live.environment());
end $$;

create function public.live_get_catalog()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  return jsonb_build_object(
    'gifts', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', g.id, 'name', g.name, 'description', g.description, 'coin_cost', g.coin_cost,
                'rarity', g.rarity_tier, 'presentation', r.presentation, 'icon_url', g.icon_url,
                'animation_url', g.animation_url, 'animation_fallback_url', g.animation_fallback_url,
                'sound_url', g.sound_url, 'animation_duration_ms', g.animation_duration_ms)
              order by g.sort, g.coin_cost), '[]'::jsonb)
              from live.gifts g join live.gift_rarities r on r.tier = g.rarity_tier where g.enabled),
    'battle_formats', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'version', f.version,
                                                                     'definition', f.definition) order by f.id), '[]'::jsonb)
                       from live.battle_formats f where f.enabled),
    'max_quantity', live.cfg_num('{limits,gift_max_quantity}', 99, 1, 999));
end $$;

create function public.live_get_show_config()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  return jsonb_build_object('version', live.cfg_version(), 'config', live.cfg());
end $$;

create function public.live_list_battle_invites()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('battle', live.battle_json(b.id), 'from', live.user_ref(b.invited_by),
                                                       'incoming', b.host_b = v_uid) order by b.created_at), '[]'::jsonb)
          from live.battles b
          where b.status = 'invited' and b.invite_expires_at > clock_timestamp() and v_uid in (b.host_a, b.host_b));
end $$;

-- Used by the LiveKit token function (S4), called WITH THE USER'S JWT. Returns what the
-- user may do in the media room; the room name is never derived from user ids.
create function public.live_media_access(p_live_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); s live.sessions; v_role text;
begin
  select * into s from live.sessions where id = p_live_id;
  if not found or s.status <> 'live' then perform live.fail('LIVE_NOT_ACTIVE'); end if;
  if not live.can_view(p_live_id, v_uid) then perform live.fail('LIVE_ACCESS_DENIED'); end if;
  v_role := case
    when s.host_id = v_uid then 'host'
    when exists (select 1 from live.guests g where g.live_id = p_live_id and g.user_id = v_uid and g.status = 'accepted') then 'guest'
    else 'viewer' end;
  return jsonb_build_object('room', s.media_room, 'identity', v_uid, 'role', v_role,
                            'can_publish', v_role in ('host', 'guest'), 'can_subscribe', true,
                            'display', live.user_ref(v_uid));
end $$;

-- Realtime private-channel authorization (used by the RLS policy on realtime.messages).
create function public.live_topic_authorized(p_topic text)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or p_topic is null then return false; end if;
  if p_topic ~ '^live:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return live.can_view(substr(p_topic, 6)::uuid, v_uid, false);
  end if;
  if p_topic ~ '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return substr(p_topic, 6)::uuid = v_uid and not live.is_platform_banned(v_uid);
  end if;
  return false;
end $$;

-- =============================================================================
-- ADMIN (role-checked, every change audited)
-- =============================================================================

-- D4: development/staging only, separate currency, double-guarded.
create function public.live_admin_grant_test_credits(p_user_id uuid, p_amount bigint, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := live.require_admin(); v_bal bigint;
begin
  if live.environment() = 'production' then perform live.fail('TEST_CREDITS_FORBIDDEN_IN_PRODUCTION'); end if;
  if not live.flag('test_credits') then perform live.fail('TEST_CREDITS_DISABLED'); end if;
  if p_amount is null or p_amount not between 1 and 1000000 then perform live.fail('INVALID_AMOUNT'); end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then perform live.fail('USER_NOT_FOUND'); end if;
  insert into live.wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  update live.wallets w set test_coins = w.test_coins + p_amount, updated_at = now()
  where w.user_id = p_user_id returning w.test_coins into v_bal;
  insert into live.coin_ledger (user_id, currency, delta, balance_after, reason, actor_id)
  values (p_user_id, 'test_coins', p_amount, v_bal, 'test_grant', v_admin);
  perform live.audit(v_admin, 'grant_test_credits', p_user_id::text, null,
                     jsonb_build_object('amount', p_amount, 'balance', v_bal, 'note', left(p_note, 200)));
  return jsonb_build_object('ok', true, 'test_coins', v_bal);
end $$;

create function public.live_admin_set_flag(p_key text, p_enabled boolean, p_rules jsonb default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := live.require_admin(); v_before jsonb; v_after jsonb;
begin
  if p_key = 'test_credits' and p_enabled and live.environment() = 'production' then
    perform live.fail('TEST_CREDITS_FORBIDDEN_IN_PRODUCTION');
  end if;
  -- D4: no payment infrastructure exists yet; purchases cannot be switched on.
  if p_key = 'purchases' and p_enabled then perform live.fail('PURCHASES_NOT_CONFIGURED'); end if;
  if p_rules is not null and jsonb_typeof(p_rules) <> 'object' then perform live.fail('INVALID_RULES'); end if;
  select to_jsonb(f) into v_before from live.feature_flags f where f.key = p_key;
  insert into live.feature_flags (key, enabled, rules, updated_at, updated_by)
  values (p_key, coalesce(p_enabled, false), coalesce(p_rules, '{}'::jsonb), now(), v_admin)
  on conflict (key) do update set enabled = excluded.enabled,
    rules = coalesce(p_rules, live.feature_flags.rules), updated_at = now(), updated_by = v_admin;
  select to_jsonb(f) into v_after from live.feature_flags f where f.key = p_key;
  perform live.audit(v_admin, 'set_flag', p_key, v_before, v_after);
  return v_after;
end $$;

create function public.live_admin_set_gift(p_gift jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := live.require_admin(); v_id text := p_gift ->> 'id'; v_before jsonb; v_after jsonb;
begin
  if jsonb_typeof(p_gift) is distinct from 'object' or v_id is null then perform live.fail('INVALID_GIFT'); end if;
  select to_jsonb(g) into v_before from live.gifts g where g.id = v_id;
  insert into live.gifts as g (id, name, description, coin_cost, rarity_tier, icon_url, animation_url, animation_fallback_url,
                               sound_url, animation_duration_ms, enabled, sort)
  values (v_id, p_gift ->> 'name', p_gift ->> 'description', (p_gift ->> 'coin_cost')::integer, p_gift ->> 'rarity_tier',
          p_gift ->> 'icon_url', p_gift ->> 'animation_url', p_gift ->> 'animation_fallback_url', p_gift ->> 'sound_url',
          (p_gift ->> 'animation_duration_ms')::integer, coalesce((p_gift ->> 'enabled')::boolean, true),
          coalesce((p_gift ->> 'sort')::integer, 0))
  on conflict (id) do update set name = excluded.name, description = excluded.description, coin_cost = excluded.coin_cost,
    rarity_tier = excluded.rarity_tier, icon_url = excluded.icon_url, animation_url = excluded.animation_url,
    animation_fallback_url = excluded.animation_fallback_url, sound_url = excluded.sound_url,
    animation_duration_ms = excluded.animation_duration_ms, enabled = excluded.enabled, sort = excluded.sort,
    updated_at = now();
  select to_jsonb(g) into v_after from live.gifts g where g.id = v_id;
  perform live.audit(v_admin, 'set_gift', v_id, v_before, v_after);
  return v_after;
end $$;

create function public.live_admin_set_battle_format(p_id text, p_name text, p_definition jsonb, p_enabled boolean default true)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := live.require_admin(); v_errs text[] := live.validate_format(p_definition); v_before jsonb; v_after jsonb;
begin
  if coalesce(array_length(v_errs, 1), 0) > 0 then perform live.fail('INVALID_BATTLE_FORMAT', array_to_string(v_errs, ' ')); end if;
  select to_jsonb(f) into v_before from live.battle_formats f where f.id = p_id;
  insert into live.battle_formats as f (id, name, enabled, definition, version, updated_at, updated_by)
  values (p_id, coalesce(nullif(btrim(p_name), ''), p_id), coalesce(p_enabled, true), p_definition, 1, now(), v_admin)
  on conflict (id) do update set name = excluded.name, enabled = excluded.enabled, definition = excluded.definition,
    version = f.version + 1, updated_at = now(), updated_by = v_admin;
  select to_jsonb(f) into v_after from live.battle_formats f where f.id = p_id;
  perform live.audit(v_admin, 'set_battle_format', p_id, v_before, v_after);
  return v_after;
end $$;

create function public.live_admin_publish_show_config(p_config jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := live.require_admin(); v_ver integer; v_prev jsonb; r record;
begin
  if jsonb_typeof(p_config) is distinct from 'object' or octet_length(p_config::text) > 65536 then
    perform live.fail('INVALID_CONFIG');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('live.show_config', 0));
  select coalesce(max(c.version), 0) + 1 into v_ver from live.show_config c;
  select c.config into v_prev from live.show_config c where c.is_active;
  update live.show_config set is_active = false where is_active;
  insert into live.show_config (version, config, is_active, published_by)
  values (v_ver, p_config || jsonb_build_object('version', v_ver), true, v_admin);
  perform live.audit(v_admin, 'publish_show_config', v_ver::text, v_prev, p_config);
  for r in select s.id from live.sessions s where s.status = 'live' order by s.id loop
    perform live.emit(r.id, 'CONFIG_UPDATED', jsonb_build_object('version', v_ver));
  end loop;
  return jsonb_build_object('ok', true, 'version', v_ver);
end $$;

create function public.live_admin_end_live(p_live_id uuid, p_reason text default 'moderation')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); v_ended boolean;
begin
  if not live.is_moderator(v_uid) then perform live.fail('NOT_AUTHORIZED'); end if;
  if p_reason not in ('moderation', 'admin') then perform live.fail('INVALID_REASON'); end if;
  v_ended := live.end_session(p_live_id, p_reason);
  perform live.audit(v_uid, 'end_live', p_live_id::text, null, jsonb_build_object('reason', p_reason, 'ended', v_ended));
  return jsonb_build_object('ok', true, 'ended', v_ended);
end $$;

create function public.live_admin_set_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := live.require_admin(); v_before text;
begin
  if p_role is not null and p_role not in ('admin', 'moderator') then perform live.fail('INVALID_ROLE'); end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then perform live.fail('USER_NOT_FOUND'); end if;
  perform pg_advisory_xact_lock(hashtextextended('live.app_roles', 0));
  select r.role into v_before from live.app_roles r where r.user_id = p_user_id;
  if v_before = 'admin' and p_role is distinct from 'admin'
     and (select count(*) from live.app_roles r where r.role = 'admin') <= 1 then
    perform live.fail('LAST_ADMIN');
  end if;
  if p_role is null then
    delete from live.app_roles where user_id = p_user_id;
  else
    insert into live.app_roles (user_id, role, granted_by) values (p_user_id, p_role, v_admin)
    on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now();
  end if;
  perform live.audit(v_admin, 'set_role', p_user_id::text, to_jsonb(v_before), to_jsonb(p_role));
  return jsonb_build_object('ok', true, 'role', p_role);
end $$;

create function public.live_admin_ban_user(p_user_id uuid, p_reason text, p_until timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := live.require_admin(); v_live uuid;
begin
  if p_user_id = v_admin then perform live.fail('INVALID_TARGET'); end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then perform live.fail('USER_NOT_FOUND'); end if;
  insert into live.platform_bans (user_id, reason, banned_until, created_by)
  values (p_user_id, coalesce(nullif(live.clean_text(p_reason), ''), 'policy'), p_until, v_admin)
  on conflict (user_id) do update set reason = excluded.reason, banned_until = excluded.banned_until,
    created_by = excluded.created_by, created_at = now();
  select s.id into v_live from live.sessions s where s.host_id = p_user_id and s.status = 'live';
  if v_live is not null then perform live.end_session(v_live, 'moderation'); end if;
  perform live.audit(v_admin, 'ban_user', p_user_id::text, null,
                     jsonb_build_object('reason', p_reason, 'until', p_until, 'ended_live', v_live));
  return jsonb_build_object('ok', true);
end $$;

create function public.live_admin_unban_user(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := live.require_admin();
begin
  delete from live.platform_bans where user_id = p_user_id;
  perform live.audit(v_admin, 'unban_user', p_user_id::text, null, null);
  return jsonb_build_object('ok', true);
end $$;
