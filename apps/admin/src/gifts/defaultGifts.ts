import { Gift } from './types';

export const DEFAULT_GIFTS: Gift[] = [
  {
    id: 'rose',
    name: 'Rose',
    description: 'Realistic blooming red rose with petals and golden sparkles',
    icon: './gifts/rose/icon.webp',
    animationUrl: './gifts/rose/animation.apng',
    webmUrl: './gifts/rose/animation.webm',
    previewUrl: './gifts/rose/icon.webp',
    coinCost: 10,
    category: 'love',
    rarity: 'common',
    animationDuration: 3000,
    enabled: true,
    soundUrl: './gifts/rose/sound.mp3',
    maxConcurrent: 5,
    priority: 1,
  },
  {
    id: 'tropical-mosquito',
    name: 'Tropical Mosquito',
    description: 'Crazy tropical cyber-mosquito with neon wings, water droplets and colorful particles',
    icon: './gifts/tropical-mosquito/icon.webp',
    animationUrl: './gifts/tropical-mosquito/animation.apng',
    webmUrl: './gifts/tropical-mosquito/animation.webm',
    previewUrl: './gifts/tropical-mosquito/icon.webp',
    coinCost: 250,
    category: 'fun',
    rarity: 'special',
    animationDuration: 8000,
    enabled: true,
    soundUrl: './gifts/tropical-mosquito/sound.mp3',
    maxConcurrent: 2,
    priority: 4,
  },
  {
    id: 'super-galaxy',
    name: 'Super Galaxy',
    description: 'Cosmic galaxy gift box opening into miniature universe with orbiting planets and Privity crown',
    icon: './gifts/super-galaxy/icon.webp',
    animationUrl: './gifts/super-galaxy/animation.apng',
    webmUrl: './gifts/super-galaxy/animation.webm',
    previewUrl: './gifts/super-galaxy/icon.webp',
    coinCost: 5000,
    category: 'premium',
    rarity: 'legendary',
    animationDuration: 10000,
    enabled: true,
    soundUrl: './gifts/super-galaxy/sound.mp3',
    maxConcurrent: 1,
    priority: 5,
  },
  {
    id: 'dragon',
    name: 'Dragon',
    description: 'Massive blue-energy dragon rising, flying, roaring, with blue energy eruption and Privity crown',
    icon: './gifts/dragon/icon.webp',
    animationUrl: './gifts/dragon/animation.apng',
    webmUrl: './gifts/dragon/animation.webm',
    previewUrl: './gifts/dragon/icon.webp',
    coinCost: 10000,
    category: 'fantasy',
    rarity: 'legendary',
    animationDuration: 8000,
    enabled: true,
    soundUrl: './gifts/dragon/sound.mp3',
    maxConcurrent: 1,
    priority: 5,
  },
];

const STORAGE_KEY = 'privity_gifts_catalog_v2';

export function loadGiftsCatalog(): Gift[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: Gift[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with defaults so newly added defaults always exist
        const map = new Map<string, Gift>();
        DEFAULT_GIFTS.forEach((g) => map.set(g.id, g));
        parsed.forEach((g) => map.set(g.id, { ...map.get(g.id), ...g }));
        return Array.from(map.values());
      }
    }
  } catch (e) {
    console.warn('Failed to load gifts catalog from localStorage:', e);
  }
  return [...DEFAULT_GIFTS];
}

export function saveGiftsCatalog(catalog: Gift[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch (e) {
    console.warn('Failed to save gifts catalog to localStorage:', e);
  }
}
