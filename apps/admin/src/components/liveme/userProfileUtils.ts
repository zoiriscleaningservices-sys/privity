// Centralized User Profile & Level Consistency Utility
// Strictly real-time stats with zero fake pre-seeded users. All new users start at Level 0, 0 followers, 0 following, 0 likes.


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

// Deterministic hash helper for colors or default avatars
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// All users start from Level 0 with 0 XP unless earned or stored
export function getDeterministicLevel(_handle: string): number {
  return 0;
}

export function getLevelTitle(level: number): string {
  if (level >= 50) return 'Royal Sovereign 👑';
  if (level >= 40) return 'Diamond Legend 💎';
  if (level >= 30) return 'Gold Master 🏆';
  if (level >= 20) return 'Silver Elite ⭐';
  if (level >= 10) return 'Rising Spark ⚡';
  return 'Newcomer 🌱';
}

const DEFAULT_BANNERS = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&q=80',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1000&q=80',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1000&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000&q=80',
];

// Zero pre-seeded fake users: only real signed-up and authentic accounts exist
const BASE_PRIVITY_PROFILES: Record<string, {
  name: string;
  avatar: string;
  coverUrl: string;
  bio: string;
  followersList: string[];
  followingList: string[];
  mediaItems: Array<{ id: string; url: string; likes: number }>;
  isVerified?: boolean;
}> = {};

export function getUserLiveProfile(
  handle: string,
  partial?: Partial<UserLiveProfile>
): UserLiveProfile {
  const cleanHandle = (handle || 'user').toLowerCase().replace(/^@/, '').trim();
  const hash = hashString(cleanHandle);

  // 1. Check active auth session or stored real profiles in localStorage
  let storedProf: any = null;
  try {
    const rawAuth = localStorage.getItem('privity_auth_session_v1');
    if (rawAuth) {
      const parsedAuth = JSON.parse(rawAuth);
      const authHandle = (parsedAuth.handle || '').toLowerCase().replace(/^@/, '').trim();
      if (authHandle === cleanHandle) {
        storedProf = parsedAuth;
      }
    }
    if (!storedProf) {
      const raw = localStorage.getItem('privity_profiles_v5');
      if (raw) {
        const parsed = JSON.parse(raw);
        storedProf =
          parsed[cleanHandle] ||
          Object.values(parsed).find(
            (p: any) => (p.handle || '').toLowerCase().replace(/^@/, '') === cleanHandle
          );
      }
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

  // 3. Level synchronization (default 0)
  const level = partial?.level ?? prof?.level ?? 0;
  const levelTitle = getLevelTitle(level);

  // 4. Accurate Real Followers Count (Strictly 100% accurate, defaults to 0)
  let followers = 0;
  if (partial?.followers !== undefined) {
    followers = partial.followers;
  } else if (prof?.followersList && Array.isArray(prof.followersList)) {
    const isFollowingThisUser = !!(followingMap[cleanHandle] || followingMap[handle]);
    const baseFollowers = prof.followersList.length;
    followers = baseFollowers + (isFollowingThisUser && !prof.followersList.includes(cleanHandle) ? 1 : 0);
  } else if (prof?.followers !== undefined && typeof prof.followers === 'number') {
    followers = prof.followers;
  } else if (prof?.followersCount !== undefined && typeof prof.followersCount === 'number') {
    followers = prof.followersCount;
  } else {
    followers = 0;
  }

  // 5. Accurate Real Following Count (Strictly 100% accurate, defaults to 0)
  let following = 0;
  if (partial?.following !== undefined) {
    following = partial.following;
  } else if (prof?.followingList && Array.isArray(prof.followingList)) {
    following = prof.followingList.length;
  } else if (prof?.following !== undefined && typeof prof.following === 'number') {
    following = prof.following;
  } else if (prof?.followingCount !== undefined && typeof prof.followingCount === 'number') {
    following = prof.followingCount;
  } else {
    const activeFollowings = Object.keys(followingMap).filter((k) => followingMap[k] && !k.startsWith('sc-'));
    following = activeFollowings.length;
  }

  // 6. Accurate Real Likes Count (Calculated only from real user posts & media, defaults to 0)
  let likes = 0;
  if (partial?.likes !== undefined) {
    likes = partial.likes;
  } else if (prof?.likes !== undefined && typeof prof.likes === 'number') {
    likes = prof.likes;
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
    if (likes === 0 && prof?.likesCount !== undefined) {
      likes = prof.likesCount;
    }
  }

  // 7. Accurate Banner
  const banner =
    partial?.banner ||
    prof?.coverUrl ||
    prof?.banner ||
    DEFAULT_BANNERS[hash % DEFAULT_BANNERS.length];

  // 8. Accurate Bio
  const defaultBio = prof?.bio || '';

  // 9. Accurate Avatar (uses user profile avatar or generated avatar with user initials)
  const defaultAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanHandle}`;
  const avatar = partial?.avatar || prof?.avatar || defaultAvatar;

  // 10. Accurate Name
  const name =
    partial?.name ||
    prof?.name ||
    cleanHandle.charAt(0).toUpperCase() + cleanHandle.slice(1);

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
    badge: partial?.badge || (level >= 40 ? 'VIP Gifter 💎' : level >= 20 ? 'Active Fan ⭐' : ''),
    isVerified: partial?.isVerified ?? (prof?.isVerified || false),
  };
}

export function formatCompactNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}
