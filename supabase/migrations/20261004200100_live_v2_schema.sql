-- =============================================================================
-- Privity LIVE v2 — schema (additive; legacy LIVE untouched)
--
-- Security model
--   * All LIVE state lives in PRIVATE schemas `live` and `social`. Client roles
--     (anon, authenticated) get NO usage on them → no direct table access at all,
--     even if the schema is ever exposed through the API by mistake.
--   * RLS is enabled on every table with NO policies (deny-by-default) as a
--     second layer.
--   * Clients interact only through SECURITY DEFINER RPCs in `public` that take
--     identity from auth.uid() (see later migrations).
--   * Money/score/event tables are append-only (mutation trigger).
-- Rollback: supabase/rollback/20261004200100_live_v2_down.sql
-- =============================================================================

create schema if not exists live;
create schema if not exists social;
revoke all on schema live from public;
revoke all on schema social from public;
-- Functions created in these schemas are NOT executable by PUBLIC by default.
alter default privileges in schema live revoke execute on functions from public;
alter default privileges in schema social revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Generic relationships (D5: LIVE first, designed for app-wide reuse)
-- -----------------------------------------------------------------------------
create table social.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on social.follows (followee_id);

create table social.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on social.blocks (blocked_id);

-- -----------------------------------------------------------------------------
-- Platform / operations
-- -----------------------------------------------------------------------------
create table live.deployment (
  id boolean primary key default true check (id),
  -- Safe default. Staging/dev projects set this explicitly after migrating.
  environment text not null default 'production' check (environment in ('production', 'staging', 'development'))
);
insert into live.deployment (id) values (true) on conflict do nothing;

create table live.app_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  granted_by uuid,
  granted_at timestamptz not null default now()
);

create table live.platform_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null,
  banned_until timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table live.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  enabled boolean not null default false,
  rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table live.show_config (
  version integer primary key check (version > 0),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  is_active boolean not null default false,
  published_at timestamptz not null default now(),
  published_by uuid
);
create unique index show_config_one_active on live.show_config (is_active) where is_active;

create table live.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Gift catalog — the ONLY source of prices
-- -----------------------------------------------------------------------------
create table live.gift_rarities (
  tier text primary key check (tier in ('common', 'rare', 'epic', 'legendary')),
  presentation text not null check (presentation in ('corner', 'banner', 'stage', 'fullscreen')),
  min_coin_value integer not null default 0 check (min_coin_value >= 0),
  sort integer not null default 0
);

create table live.gifts (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  name text not null check (char_length(name) between 1 and 60),
  description text,
  coin_cost integer not null check (coin_cost between 1 and 1000000),
  rarity_tier text not null references live.gift_rarities(tier),
  icon_url text not null,
  animation_url text,
  animation_fallback_url text,
  sound_url text,
  animation_duration_ms integer check (animation_duration_ms between 0 and 20000),
  enabled boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Wallets + append-only ledger (D4: test credits are a separate currency)
-- -----------------------------------------------------------------------------
create table live.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins bigint not null default 0 check (coins >= 0),
  test_coins bigint not null default 0 check (test_coins >= 0),
  earnings bigint not null default 0 check (earnings >= 0),
  test_earnings bigint not null default 0 check (test_earnings >= 0),
  updated_at timestamptz not null default now()
);

-- Append-only tables store plain ids (no FKs): financial history must never block
-- account/session deletion, and deletions must never cascade into the ledger.
create table live.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  currency text not null check (currency in ('coins', 'test_coins', 'earnings', 'test_earnings')),
  delta bigint not null check (delta <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reason text not null check (reason in ('gift_sent', 'gift_received', 'test_grant', 'purchase', 'refund', 'adjustment')),
  ref_id uuid,
  actor_id uuid,
  created_at timestamptz not null default clock_timestamp()
);
create index coin_ledger_user_idx on live.coin_ledger (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- LIVE sessions and participation
-- -----------------------------------------------------------------------------
create table live.sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  status text not null default 'live' check (status in ('live', 'ended')),
  -- Unpredictable media room name (256 bits); never derived from user ids.
  media_room text not null unique
    default ('lv_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  started_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  end_reason text check (end_reason in ('host_ended', 'moderation', 'stale', 'admin')),
  last_seq bigint not null default 0,
  host_heartbeat_at timestamptz not null default clock_timestamp(),
  viewer_count integer not null default 0 check (viewer_count >= 0),
  peak_viewers integer not null default 0 check (peak_viewers >= 0),
  viewer_milestones_reached integer[] not null default '{}',
  -- Joins are batched by the 1 s tick from live.viewers (joined_at > joins_flushed_at),
  -- so a join never writes this hot row.
  joins_flushed_at timestamptz not null default clock_timestamp(),
  new_followers integer not null default 0,
  follow_milestones_reached integer[] not null default '{}',
  top_supporter_id uuid,
  top_supporter_total bigint not null default 0,
  top_supporter_event_at timestamptz,
  battle_id uuid,
  comments_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index sessions_one_live_per_host on live.sessions (host_id) where status = 'live';
create index sessions_status_idx on live.sessions (status, started_at desc);

create table live.session_allowlist (
  live_id uuid not null references live.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (live_id, user_id)
);

create table live.host_bans (
  host_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (host_id, user_id)
);

create table live.session_mutes (
  live_id uuid not null references live.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  muted_until timestamptz not null,
  created_by uuid not null,
  primary key (live_id, user_id)
);

create table live.viewers (
  live_id uuid not null references live.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  left_at timestamptz,
  -- Set by the tick when this join was included in a VIEWERS_JOINED batch.
  join_announced boolean not null default false,
  primary key (live_id, user_id)
);
create index viewers_active_idx on live.viewers (live_id) where left_at is null;
create index viewers_unannounced_idx on live.viewers (live_id) where not join_announced;

-- First follow of a host during a given LIVE (FOLLOW_RECEIVED is emitted once per follower per LIVE).
create table live.session_follows (
  live_id uuid not null references live.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key (live_id, user_id)
);

create table live.guests (
  live_id uuid not null references live.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('requested', 'accepted', 'left', 'removed', 'declined', 'cancelled')),
  slot smallint check (slot between 1 and 8),
  requested_at timestamptz not null default clock_timestamp(),
  decided_at timestamptz,
  ended_at timestamptz,
  primary key (live_id, user_id)
);
create unique index guests_one_per_slot on live.guests (live_id, slot) where status = 'accepted';

create table live.comments (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references live.sessions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  deleted_by uuid
);
create index comments_live_idx on live.comments (live_id, created_at desc);
create index comments_author_idx on live.comments (author_id, live_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Battles
-- -----------------------------------------------------------------------------
create table live.battle_formats (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_]{1,47}$'),
  name text not null,
  enabled boolean not null default true,
  definition jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table live.battles (
  id uuid primary key default gen_random_uuid(),
  format_id text not null references live.battle_formats(id),
  -- Frozen at invite/accept so later config edits never change a running battle.
  format_snapshot jsonb not null,
  live_a uuid not null references live.sessions(id) on delete cascade,
  live_b uuid not null references live.sessions(id) on delete cascade,
  host_a uuid not null references auth.users(id) on delete cascade,
  host_b uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('invited', 'accepted', 'live', 'locked', 'finalized', 'cancelled', 'expired')),
  invited_by uuid not null,
  invite_expires_at timestamptz,
  scoring text not null check (scoring in ('total', 'pulls')),
  tiebreak text not null default 'draw' check (tiebreak in ('total', 'draw')),
  intro_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  final_countdown_ms integer not null default 0 check (final_countdown_ms >= 0),
  score_a bigint not null default 0 check (score_a >= 0),
  score_b bigint not null default 0 check (score_b >= 0),
  score_version bigint not null default 0,
  lead_side text check (lead_side in ('a', 'b')),
  lead_changes integer not null default 0,
  lead_event_at timestamptz,
  max_deficit_a bigint not null default 0,
  max_deficit_b bigint not null default 0,
  comebacks integer not null default 0,
  last_announced_idx integer not null default -1,
  warned_idx integer[] not null default '{}',
  final_announced boolean not null default false,
  winner_side text check (winner_side in ('a', 'b')),
  result jsonb,
  cancel_reason text,
  locked_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check (live_a <> live_b),
  check (host_a <> host_b)
);
create index battles_active_idx on live.battles (status, ends_at) where status in ('accepted', 'live', 'locked');
create index battles_invites_idx on live.battles (status, invite_expires_at) where status = 'invited';
create index battles_live_a_idx on live.battles (live_a);
create index battles_live_b_idx on live.battles (live_b);

alter table live.sessions
  add constraint sessions_battle_fk foreign key (battle_id) references live.battles(id) on delete set null;

create table live.battle_timeline (
  battle_id uuid not null references live.battles(id) on delete cascade,
  idx integer not null,
  kind text not null check (kind in ('intro', 'countdown', 'normal', 'bonus', 'pull', 'break')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  multiplier numeric(4, 2) not null check (multiplier between 0 and 5),
  pull_no integer,
  warning_ms integer not null default 0 check (warning_ms >= 0),
  label_key text,
  primary key (battle_id, idx),
  check (ends_at > starts_at)
);

create table live.battle_pull_scores (
  battle_id uuid not null references live.battles(id) on delete cascade,
  pull_no integer not null,
  a bigint not null default 0,
  b bigint not null default 0,
  primary key (battle_id, pull_no)
);

-- -----------------------------------------------------------------------------
-- Gifts, contributions, supporters
-- -----------------------------------------------------------------------------
create table live.gift_transactions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  recipient_id uuid not null,
  live_id uuid not null,
  gift_id text not null references live.gifts(id),
  quantity integer not null check (quantity between 1 and 999),
  unit_cost integer not null check (unit_cost > 0),
  coin_value bigint not null check (coin_value > 0),
  currency text not null check (currency in ('coins', 'test_coins')),
  battle_id uuid,
  battle_side text check (battle_side in ('a', 'b')),
  battle_points bigint not null default 0 check (battle_points >= 0),
  multiplier numeric(4, 2) not null default 0,
  battle_mode text not null check (battle_mode in ('auto', 'outside_battle')),
  battle_outcome text not null check (battle_outcome in ('no_battle', 'counted', 'excluded')),
  idempotency_key text not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (sender_id, idempotency_key),
  check ((battle_outcome = 'counted') = (battle_points > 0))
);
create index gift_tx_live_idx on live.gift_transactions (live_id, created_at desc);
create index gift_tx_battle_idx on live.gift_transactions (battle_id) where battle_id is not null;

create table live.battle_contributions (
  id bigint generated always as identity primary key,
  battle_id uuid not null,
  side text not null check (side in ('a', 'b')),
  sender_id uuid not null,
  gift_tx_id uuid not null unique,
  base_points bigint not null check (base_points > 0),
  multiplier numeric(4, 2) not null check (multiplier > 0),
  points bigint not null check (points > 0),
  timeline_idx integer not null,
  pull_no integer,
  created_at timestamptz not null default clock_timestamp()
);
create index contributions_battle_side_idx on live.battle_contributions (battle_id, side);
create index contributions_battle_sender_idx on live.battle_contributions (battle_id, sender_id);

create table live.supporters (
  live_id uuid not null references live.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_coins bigint not null default 0,
  gift_count integer not null default 0,
  streak_gift_id text,
  streak_count integer not null default 0,
  streak_last_at timestamptz,
  thresholds_reached integer[] not null default '{}',
  first_gift_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (live_id, user_id)
);
create index supporters_rank_idx on live.supporters (live_id, total_coins desc, first_gift_at);

-- -----------------------------------------------------------------------------
-- Authoritative event outbox / replay log (seq strictly increasing per LIVE)
-- -----------------------------------------------------------------------------
create table live.events (
  event_id uuid primary key default gen_random_uuid(),
  live_id uuid not null references live.sessions(id) on delete cascade,
  seq bigint not null check (seq > 0),
  battle_id uuid,
  event_type text not null,
  actor_id uuid,
  server_ts timestamptz not null default clock_timestamp(),
  schema_version smallint not null default 1,
  payload jsonb not null,
  unique (live_id, seq)
);
create index events_ts_idx on live.events (server_ts);

-- -----------------------------------------------------------------------------
-- Append-only protection
-- -----------------------------------------------------------------------------
create function live.forbid_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'APPEND_ONLY: % is append-only', tg_table_name using errcode = '42501';
end $$;

create trigger coin_ledger_append_only before update or delete on live.coin_ledger
  for each row execute function live.forbid_mutation();
create trigger admin_audit_append_only before update or delete on live.admin_audit_log
  for each row execute function live.forbid_mutation();
create trigger gift_tx_append_only before update or delete on live.gift_transactions
  for each row execute function live.forbid_mutation();
create trigger contributions_append_only before update or delete on live.battle_contributions
  for each row execute function live.forbid_mutation();
-- live.events: UPDATE forbidden; DELETE allowed only for retention pruning (by the owner role).
create trigger events_no_update before update on live.events
  for each row execute function live.forbid_mutation();

-- -----------------------------------------------------------------------------
-- RLS: enabled everywhere, no policies → deny-by-default for client roles.
-- (Not FORCE: the definer RPCs run as the owner and must see the rows.)
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname in ('live', 'social') loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
    execute format('revoke all on %I.%I from public', r.schemaname, r.tablename);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %I.%I from anon', r.schemaname, r.tablename);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on %I.%I from authenticated', r.schemaname, r.tablename);
    end if;
  end loop;
end $$;
