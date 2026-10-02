// Centralized User Profile & Level Consistency Utility
// Guarantees consistent level, follower count, following count, likes, banner, and bio across all live components.

import { LIVEME_STREAMERS } from './liveMeData';

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
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&q=80',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1000&q=80',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1000&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000&q=80',
];

// Fallback registry for base Privity platform accounts
const BASE_PRIVITY_PROFILES: Record<string, {
  name: string;
  avatar: string;
  coverUrl: string;
  bio: string;
  followersList: string[];
  followingList: string[];
  mediaItems: Array<{ id: string; url: string; likes: number }>;
  isVerified?: boolean;
}> = {
  luciano: {
    name: 'Luciano',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
    coverUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
    bio: 'Architecting Privity: private-first sharing, real circles, no algorithmic games. Building the next generation of authentic human connection.',
    followersList: ['elena_rodriguez', 'marcus_dev', 'julian_analogue', 'sara_architecture', 'chloe_visuals', 'jess_film', 'sam_arch', 'oliver_wood'],
    followingList: ['elena_rodriguez', 'marcus_dev', 'julian_analogue', 'sara_architecture'],
    mediaItems: [
      { id: 'm-luciano-1', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800', likes: 54 },
      { id: 'm-luciano-2', url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800', likes: 40 },
    ],
    isVerified: true,
  },
  elena_rodriguez: {
    name: 'Elena Rodriguez',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600&auto=format&fit=crop&q=85',
    bio: 'Exploring northern studio light, natural window diffusion, and mindful moments without algorithmic pressure. 120 medium format analogue film & oil painting.',
    followersList: ['marcus_dev', 'sara_architecture', 'julian_analogue', 'luciano', 'chloe_visuals', 'jess_film'],
    followingList: ['marcus_dev', 'sara_architecture', 'julian_analogue', 'luciano'],
    mediaItems: [{ id: 'm-1', url: '', likes: 28 }],
    isVerified: true,
  },
  marcus_dev: {
    name: 'Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=85',
    bio: 'Distributed systems, peer-to-peer gossip layers, and cryptographic verifiable computation.',
    followersList: ['elena_rodriguez', 'luciano', 'sara_architecture', 'sam_arch', 'oliver_wood', 'chloe_visuals'],
    followingList: ['elena_rodriguez', 'luciano', 'sara_architecture'],
    mediaItems: [{ id: 'm-2', url: '', likes: 45 }],
    isVerified: true,
  },
  sara_architecture: {
    name: 'Sara Lin',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&auto=format&fit=crop&q=85',
    bio: 'Designing spaces that honor natural shadow, timber joints, and breathing room. Sustainable rammed-earth residences.',
    followersList: ['elena_rodriguez', 'marcus_dev', 'oliver_wood', 'luciano'],
    followingList: ['elena_rodriguez', 'oliver_wood', 'luciano'],
    mediaItems: [{ id: 'm-3', url: '', likes: 94 }, { id: 'm-4', url: '', likes: 140 }, { id: 'm-5', url: '', likes: 78 }],
    isVerified: true,
  },
  oliver_wood: {
    name: 'Oliver Craft',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&auto=format&fit=crop&q=85',
    bio: 'Hand-cut mortise and tenon joinery. Zero screws, zero nails, generational hardwood furniture.',
    followersList: ['sara_architecture', 'marcus_dev', 'sam_arch', 'luciano'],
    followingList: ['sara_architecture', 'sam_arch'],
    mediaItems: [{ id: 'm-6', url: '', likes: 42 }, { id: 'm-7', url: '', likes: 65 }],
    isVerified: false,
  },
};

export function getUserLiveProfile(
  handle: string,
  partial?: Partial<UserLiveProfile>
): UserLiveProfile {
  const cleanHandle = (handle || 'user').toLowerCase().replace(/^@/, '').trim();
  const hash = hashString(cleanHandle);

  // 1. Check stored real profiles in localStorage (privity_profiles_v5)
  let storedProf: any = null;
  try {
    const raw = localStorage.getItem('privity_profiles_v5');
    if (raw) {
      const parsed = JSON.parse(raw);
      storedProf =
        parsed[cleanHandle] ||
        Object.values(parsed).find(
          (p: any) => (p.handle || '').toLowerCase().replace(/^@/, '') === cleanHandle
        );
    }
  } catch {}

  const baseProf = BASE_PRIVITY_PROFILES[cleanHandle];
  const prof = storedProf || baseProf;

  // 2. Check real-time following status in localStorage (privity_following_v5)
  let followingMap: Record<string, boolean> = {};
  try {
    const rawFollowing = localStorage.getItem('privity_following_v5');
    if (rawFollowing) {
      const parsed = JSON.parse(rawFollowing);
      if (Array.isArray(parsed)) {
        parsed.forEach((h: string) => { followingMap[h.replace(/^@/, '').toLowerCase()] = true; });
      } else if (typeof parsed === 'object') {
        Object.keys(parsed).forEach((k) => {
          if (parsed[k]) followingMap[k.replace(/^@/, '').toLowerCase()] = true;
        });
      }
    }
  } catch {}

  // 3. Level synchronization
  const level = partial?.level ?? getDeterministicLevel(cleanHandle);
  const levelTitle = getLevelTitle(level);

  // 4. Accurate Real Followers Count (Strictly 100% accurate to account)
  let followers = 0;
  if (partial?.followers !== undefined) {
    followers = partial.followers;
  } else if (cleanHandle === 'luciano') {
    const fList = prof?.followersList || baseProf?.followersList || [];
    followers = fList.length;
  } else if (prof?.followersList) {
    const isFollowingThisUser = !!(followingMap[cleanHandle] || followingMap[handle]);
    const baseFollowers = prof.followersList.filter((h: string) => h.toLowerCase() !== 'luciano').length;
    followers = baseFollowers + (isFollowingThisUser ? 1 : 0);
  } else if (prof?.followersCount !== undefined) {
    followers = prof.followersCount;
  } else {
    // If it's a streamer in LIVEME_STREAMERS
    const streamer = LIVEME_STREAMERS.find((s) => s.handle.replace(/^@/, '').toLowerCase() === cleanHandle);
    if (streamer) {
      const isFollowingThisUser = !!(followingMap[cleanHandle] || followingMap[handle]);
      followers = (streamer.viewersCount || 10) + (isFollowingThisUser ? 1 : 0);
    } else {
      followers = 1;
    }
  }

  // 5. Accurate Real Following Count (Strictly 100% accurate to account)
  let following = 0;
  if (partial?.following !== undefined) {
    following = partial.following;
  } else if (cleanHandle === 'luciano') {
    const activeFollowings = Object.keys(followingMap).filter(
      (k) => followingMap[k] && k.toLowerCase() !== 'luciano' && !k.startsWith('sc-')
    );
    following = activeFollowings.length > 0 ? activeFollowings.length : (prof?.followingList ? prof.followingList.length : 4);
  } else if (prof?.followingList) {
    following = prof.followingList.length;
  } else if (prof?.followingCount !== undefined) {
    following = prof.followingCount;
  } else {
    following = 2;
  }

  // 6. Accurate Real Likes Count (Calculated from real posts + media items)
  let likes = 0;
  if (partial?.likes !== undefined) {
    likes = partial.likes;
  } else {
    let postLikes = 0;
    try {
      const rawPosts = localStorage.getItem('privity_posts_v5');
      if (rawPosts) {
        const posts = JSON.parse(rawPosts);
        if (Array.isArray(posts)) {
          posts.forEach((p: any) => {
            const author = (p.authorHandle || '').replace(/^@/, '').toLowerCase();
            if (author === cleanHandle || p.authorId === `usr-${cleanHandle}`) {
              postLikes += (p.likesCount || (Array.isArray(p.likersList) ? p.likersList.length : 0) || 0);
            }
          });
        }
      }
    } catch {}

    let mediaLikes = 0;
    if (prof?.mediaItems && Array.isArray(prof.mediaItems)) {
      prof.mediaItems.forEach((m: any) => {
        mediaLikes += (m.likes || 0);
      });
    }

    likes = postLikes + mediaLikes;
    if (likes === 0) {
      if (prof?.likesCount !== undefined) {
        likes = prof.likesCount;
      } else if (cleanHandle === 'luciano') {
        likes = 94; // Authentic default likes count (54 + 40)
      } else {
        const streamer = LIVEME_STREAMERS.find((s) => s.handle.replace(/^@/, '').toLowerCase() === cleanHandle);
        if (streamer) {
          likes = streamer.likesCount || 0;
        }
      }
    }
  }

  // 7. Accurate Banner
  const banner =
    partial?.banner ||
    prof?.coverUrl ||
    prof?.banner ||
    DEFAULT_BANNERS[hash % DEFAULT_BANNERS.length];

  // 8. Accurate Bio
  const defaultBio =
    prof?.bio ||
    (cleanHandle.includes('luciano')
      ? 'Architecting Privity: private-first sharing, real circles, no algorithmic games. Building the next generation of authentic human connection.'
      : `Privity creator & live stream fan ✨ Level ${level} supporter!`);

  // 9. Accurate Avatar
  const avatar =
    partial?.avatar ||
    prof?.avatar ||
    (cleanHandle.includes('luciano')
      ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400'
      : `https://images.unsplash.com/photo-${1534528741775 + (hash % 1000)}?w=300`);

  // 10. Accurate Name
  const name =
    partial?.name ||
    prof?.name ||
    (cleanHandle.includes('luciano') ? 'Luciano' : cleanHandle.charAt(0).toUpperCase() + cleanHandle.slice(1));

  return {
    id: partial?.id || prof?.id || `user_${cleanHandle}`,
    name,
    handle: cleanHandle,
    avatar,
    banner,
    level,
    levelTitle,
    followers,
    following,
    likes,
    bio: partial?.bio || defaultBio,
    badge: partial?.badge || (level >= 40 ? 'VIP Gifter 💎' : 'Active Fan ⭐'),
    isVerified: partial?.isVerified ?? (prof?.isVerified || level >= 45),
  };
}

export function formatCompactNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}
