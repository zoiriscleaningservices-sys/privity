-- =============================================================================
-- Privity LIVE v2 — seed data (catalog, formats, show config v1, flags)
-- Idempotent: safe to re-run; never overwrites admin edits.
-- =============================================================================

insert into live.gift_rarities (tier, presentation, min_coin_value, sort) values
  ('common', 'corner', 0, 1),
  ('rare', 'corner', 100, 2),
  ('epic', 'banner', 1000, 3),
  ('legendary', 'stage', 5000, 4)
on conflict (tier) do nothing;

-- The real Privity catalog (apps/admin/src/gifts/defaultGifts.ts). Animations use the
-- WebM renditions (the APNG masters are 7–45 MB and are not suitable for streaming UI).
-- Legacy rarity 'special' maps to 'rare'.
insert into live.gifts (id, name, description, coin_cost, rarity_tier, icon_url, animation_url, animation_fallback_url,
                        sound_url, animation_duration_ms, enabled, sort) values
  ('rose', 'Rose', 'Realistic blooming red rose with petals and golden sparkles', 10, 'common',
   './gifts/rose/icon.webp', './gifts/rose/animation.webm', './gifts/rose/animation.apng',
   './gifts/rose/sound.mp3', 3000, true, 10),
  ('tropical-mosquito', 'Tropical Mosquito',
   'Crazy tropical cyber-mosquito with neon wings, water droplets and colorful particles', 250, 'rare',
   './gifts/tropical-mosquito/icon.webp', './gifts/tropical-mosquito/animation.webm', './gifts/tropical-mosquito/animation.apng',
   './gifts/tropical-mosquito/sound.mp3', 8000, true, 20),
  ('super-galaxy', 'Super Galaxy',
   'Cosmic galaxy gift box opening into miniature universe with orbiting planets and Privity crown', 5000, 'legendary',
   './gifts/super-galaxy/icon.webp', './gifts/super-galaxy/animation.webm', './gifts/super-galaxy/animation.apng',
   './gifts/super-galaxy/sound.mp3', 10000, true, 30),
  ('dragon', 'Dragon',
   'Massive blue-energy dragon rising, flying, roaring, with blue energy eruption and Privity crown', 10000, 'legendary',
   './gifts/dragon/icon.webp', './gifts/dragon/animation.webm', './gifts/dragon/animation.apng',
   './gifts/dragon/sound.mp3', 8000, true, 40)
on conflict (id) do nothing;

-- Identical to BUILTIN_FORMATS in apps/admin/src/live/battle/timeline.ts (parity is tested).
insert into live.battle_formats (id, name, enabled, definition) values
  ('classic_double', 'Classic with Double', true, '{
     "intro_ms": 3500, "countdown_s": 3, "scoring": "total", "final_countdown_s": 30,
     "segments": [
       {"kind": "normal", "s": 120},
       {"kind": "bonus", "s": 60, "multiplier": 2, "warning_s": 30, "label": "double"},
       {"kind": "normal", "s": 120}
     ]}'::jsonb),
  ('three_pulls', 'Three Rounds', true, '{
     "intro_ms": 3500, "countdown_s": 3, "scoring": "pulls", "tiebreak": "total", "final_countdown_s": 15,
     "segments": [
       {"kind": "pull", "s": 60, "pull": 1},
       {"kind": "break", "s": 5},
       {"kind": "pull", "s": 60, "pull": 2},
       {"kind": "break", "s": 5},
       {"kind": "pull", "s": 60, "pull": 3, "multiplier": 2, "warning_s": 5, "label": "double"}
     ]}'::jsonb)
on conflict (id) do nothing;

-- Show config v1: server detector thresholds + operational limits. Presentation
-- ("moments", "rhythm", ...) falls back to the client defaults until ops publish overrides.
insert into live.show_config (version, config, is_active)
select 1, '{
  "version": 1,
  "detectors": {
    "lead": {"hysteresis_points": 50, "hysteresis_pct": 0.02, "cooldown_s": 6, "final_moment_s": 10},
    "comeback": {"min_deficit_pct": 0.3, "min_deficit_points": 500, "close_pct": 0.6},
    "swing": {"pct_of_total": 0.15, "min_points": 2000},
    "supporter": {"top_min_coins": 100, "top_cooldown_s": 20, "thresholds": [500, 1000, 5000, 10000]},
    "streak": {"window_ms": 4000, "emit_at": [5, 10, 25, 50]},
    "viewers": {"milestones": [100, 500, 1000, 5000, 10000], "join_sample": 3},
    "follows": {"milestones": [10, 50, 100, 500, 1000]}
  },
  "limits": {
    "gift_max_quantity": 99,
    "comment_min_interval_ms": 1000,
    "comment_max_per_10s": 5,
    "guest_slots": 3,
    "invite_ttl_s": 30,
    "accept_lead_ms": 1500,
    "viewer_stale_s": 45,
    "host_stale_s": 90
  }
}'::jsonb, true
where not exists (select 1 from live.show_config);

-- Everything starts OFF. live_v2 gates the new LIVE (old LIVE stays authoritative until cutover).
insert into live.feature_flags (key, enabled) values
  ('live_v2', false),
  ('test_credits', false),
  ('purchases', false)
on conflict (key) do nothing;
