-- =============================================================================
-- Baseline: public.profiles (pre-existing in production, created via SQL editor
-- from /supabase_schema.sql). Fully idempotent: a NO-OP where it already exists,
-- so fresh staging projects get the same baseline as production.
-- Rollback: none (pre-existing production object; never dropped by LIVE v2).
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  name text not null,
  email text,
  avatar text,
  cover_url text default 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
  bio text default '',
  level integer default 0,
  xp integer default 0,
  followers integer default 0,
  following integer default 0,
  likes integer default 0,
  sparks integer default 0,
  is_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                 and policyname = 'Public profiles are viewable by everyone') then
    create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                 and policyname = 'Users can insert their own profile') then
    create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                 and policyname = 'Users can update their own profile') then
    create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);
  end if;
end $$;

-- Created only if missing: never replaces production's existing function.
do $do$
begin
  if not exists (select 1 from pg_proc where proname = 'handle_new_user' and pronamespace = 'public'::regnamespace) then
    execute $fn$
      create function public.handle_new_user()
      returns trigger as $$
      declare
        clean_handle text;
        display_name text;
        avatar_url text;
      begin
        clean_handle := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
        display_name := coalesce(new.raw_user_meta_data->>'name', clean_handle);
        avatar_url := coalesce(new.raw_user_meta_data->>'avatar', 'https://api.dicebear.com/7.x/identicon/svg?seed=' || clean_handle);
        insert into public.profiles (id, handle, name, email, avatar, level, xp, followers, following, likes, sparks, is_verified, created_at, updated_at)
        values (new.id, clean_handle, display_name, new.email, avatar_url, 0, 0, 0, 0, 0, 0, false, now(), now())
        on conflict (id) do nothing;
        return new;
      end;
      $$ language plpgsql security definer
    $fn$;
  end if;
end $do$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;
