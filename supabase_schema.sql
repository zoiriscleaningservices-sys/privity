-- ==============================================================================
-- PRIVITY SUPABASE DATABASE SCHEMA
-- Project ID: rnpjtailldnkwaglvdiu
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rnpjtailldnkwaglvdiu/sql/new
-- ==============================================================================

-- 1. Create Public Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  avatar TEXT,
  cover_url TEXT DEFAULT 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
  bio TEXT DEFAULT '',
  level INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  sparks INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row-Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Public Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- 4. Automatic Profile Trigger on Signup
-- Guarantees all new users begin strictly at Level 0 with 0 followers, 0 following, 0 sparks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  clean_handle TEXT;
  display_name TEXT;
  avatar_url TEXT;
BEGIN
  clean_handle := LOWER(REGEXP_REPLACE(COALESCE(new.raw_user_meta_data->>'handle', SPLIT_PART(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  display_name := COALESCE(new.raw_user_meta_data->>'name', clean_handle);
  avatar_url := COALESCE(new.raw_user_meta_data->>'avatar', 'https://api.dicebear.com/7.x/identicon/svg?seed=' || clean_handle);

  INSERT INTO public.profiles (
    id,
    handle,
    name,
    email,
    avatar,
    level,
    xp,
    followers,
    following,
    likes,
    sparks,
    is_verified,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    clean_handle,
    display_name,
    new.email,
    avatar_url,
    0,
    0,
    0,
    0,
    0,
    0,
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if already exists and re-create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
