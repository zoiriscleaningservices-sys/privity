-- =============================================================================
-- TEST HARNESS ONLY — emulates the parts of the Supabase platform that the
-- LIVE v2 migrations depend on, so the REAL migration files run unmodified on a
-- plain local PostgreSQL. Never apply this file to a Supabase project.
--
--   auth.users / auth.uid() / auth.role()     (GoTrue)
--   roles anon / authenticated / service_role  (PostgREST)
--   realtime.messages / realtime.send() / realtime.topic()   (Realtime broadcast + authorization)
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists realtime;
grant usage on schema auth, extensions, realtime to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Same semantics as Supabase: identity comes from the verified JWT claims of the request.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(current_setting('request.jwt.claim.sub', true),
             (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')),
    '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(current_setting('request.jwt.claim.role', true),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

-- Realtime: broadcast-from-database writes rows here; the Realtime server only
-- streams COMMITTED rows. Private-channel authorization = RLS on this table.
create table if not exists realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null default 'broadcast',
  event text,
  payload jsonb,
  private boolean default true,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;
grant select, insert on realtime.messages to authenticated;
grant usage, select on sequence realtime.messages_id_seq to authenticated;

create or replace function realtime.topic() returns text
language sql stable as $$ select nullif(current_setting('realtime.topic', true), '') $$;
grant execute on function realtime.topic() to anon, authenticated, service_role;

create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into realtime.messages (topic, extension, event, payload, private)
  values (topic, 'broadcast', event, payload, private);
end $$;
revoke all on function realtime.send(jsonb, text, text, boolean) from public;

-- Supabase default privileges: everything created in public is granted to the
-- API roles unless a migration explicitly revokes it. Emulated so the tests
-- prove our migrations revoke what they must.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
