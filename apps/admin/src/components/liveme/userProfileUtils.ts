// Centralized User Profile & Level Consistency Utility
// Guarantees consistent level, follower count, following count, likes, banner, and bio across all live components.

export interface UserLiveProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  banner: string;
  level: number;
  levelTitle: string;
  followers: number;
  following: number;
  likes: number;
  bio: string;
  badge?: string;
  isVerified?: boolean;
}

// Deterministic hash to generate realistic and consistent stats based on user handle
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDeterministicLevel(handle: string): number {
  const clean = (handle || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.includes('luciano') || clean.includes('host')) return 52;
  if (clean.includes('queenduc')) return 48;
  if (clean.includes('carlos')) return 49;
  if (clean.includes('sarah') || clean.includes('sarita')) return 40;
  if (clean.includes('max')) return 28;
  if (clean.includes('vip') || clean.includes('top')) return 45;

  const hash = hashString(clean);
  // Level between 12 and 55
  return 12 + (hash % 44);
}

export function getLevelTitle(level: number): string {
  if (level >= 50) return 'Royal Sovereign 👑';
  if (level >= 40) return 'Diamond Legend 💎';
  if (level >= 30) return 'Gold Master 🏆';
  if (level >= 20) return 'Silver Elite ⭐';
  return 'Rising Spark ⚡';
}

const DEFAULT_BANNERS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&q=80',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1000&q=80',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1000&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000&q=80',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1000&q=80',
];

export function getUserLiveProfile(
  handle: string,
  partial?: Partial<UserLiveProfile>
): UserLiveProfile {
  const cleanHandle = (handle || 'user').toLowerCase().replace(/^@/, '').trim();
  const hash = hashString(cleanHandle);

  const level = partial?.level ?? getDeterministicLevel(cleanHandle);
  const levelTitle = getLevelTitle(level);

  const followers =
    partial?.followers ??
    (cleanHandle.includes('luciano')
      ? 18400
      : 800 + (hash % 45000));

  const following =
    partial?.following ??
    (cleanHandle.includes('luciano')
      ? 342
      : 85 + (hash % 600));

  const likes =
    partial?.likes ??
    (cleanHandle.includes('luciano')
      ? 142500
      : 5000 + (hash % 120000));

  const banner =
    partial?.banner ||
    DEFAULT_BANNERS[hash % DEFAULT_BANNERS.length];

  const defaultBio = cleanHandle.includes('luciano')
    ? 'Official Privity Live Host & Creator 🎙️ | High-energy battles & daily streams!'
    : `Privity creator & live stream fan ✨ Level ${level} supporter!`;

  return {
    id: partial?.id || `user_${cleanHandle}`,
    name: partial?.name || cleanHandle.charAt(0).toUpperCase() + cleanHandle.slice(1),
    handle: cleanHandle,
    avatar:
      partial?.avatar ||
      `https://images.unsplash.com/photo-${1534528741775 + (hash % 1000)}?w=300`,
    banner,
    level,
    levelTitle,
    followers,
    following,
    likes,
    bio: partial?.bio || defaultBio,
    badge: partial?.badge || (level >= 40 ? 'VIP Gifter 💎' : 'Active Fan ⭐'),
    isVerified: partial?.isVerified ?? (level >= 45),
  };
}

export function formatCompactNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}
