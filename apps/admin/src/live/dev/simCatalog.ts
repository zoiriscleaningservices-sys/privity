/**
 * LIVE Lab catalog — an exact mirror of the S2 seed (supabase/migrations/*_live_v2_seed.sql).
 * Used ONLY by the simulated backend, which plays the server's role in the Lab. Production UI
 * reads the catalog from `live_get_catalog`. Parity with the SQL seed is enforced by tests.
 */

import { BUILTIN_FORMATS } from '../battle/timeline';
import { CatalogGift, GiftCatalog } from '../client/LiveCommands';

const asset = (id: string, file: string) => `./gifts/${id}/${file}`;

const gift = (
  id: string,
  name: string,
  description: string,
  coin_cost: number,
  rarity: CatalogGift['rarity'],
  animation_duration_ms: number,
): CatalogGift => ({
  id,
  name,
  description,
  coin_cost,
  rarity,
  presentation: rarity === 'legendary' ? 'stage' : rarity === 'epic' ? 'banner' : 'corner',
  icon_url: asset(id, 'icon.webp'),
  animation_url: asset(id, 'animation.webm'),
  animation_fallback_url: asset(id, 'animation.apng'),
  sound_url: asset(id, 'sound.mp3'),
  animation_duration_ms,
});

export const SIM_GIFTS: ReadonlyArray<CatalogGift> = [
  gift('rose', 'Rose', 'Realistic blooming red rose with petals and golden sparkles', 10, 'common', 3000),
  gift('tropical-mosquito', 'Tropical Mosquito', 'Crazy tropical cyber-mosquito with neon wings, water droplets and colorful particles', 250, 'rare', 8000),
  gift('super-galaxy', 'Super Galaxy', 'Cosmic galaxy gift box opening into miniature universe with orbiting planets and Privity crown', 5000, 'legendary', 10000),
  gift('dragon', 'Dragon', 'Massive blue-energy dragon rising, flying, roaring, with blue energy eruption and Privity crown', 10000, 'legendary', 8000),
];

export const SIM_MAX_QUANTITY = 99;

export function simCatalog(): GiftCatalog {
  return {
    gifts: SIM_GIFTS.map((g) => ({ ...g })),
    battle_formats: [
      { id: 'classic_double', name: 'Classic with Double', definition: BUILTIN_FORMATS.classic_double },
      { id: 'three_pulls', name: 'Three Rounds', definition: BUILTIN_FORMATS.three_pulls },
    ],
    max_quantity: SIM_MAX_QUANTITY,
  };
}
