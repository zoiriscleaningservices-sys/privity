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

// Return authentic real-time account level based on actual progression
export function getDeterministicLevel(handle: string): number {
  if (!handle) return 0;
  try {
    const clean = handle.replace(/^@/, '').toLowerCase().trim();
    const stored = localStorage.getItem('privity_accounts_v1');
    if (stored) {
      const accs = JSON.parse(stored);
      if (accs[clean]?.level) return Number(accs[clean].level);
    }
    const session = localStorage.getItem('privity_auth_session_v1');
    if (session) {
      const cur = JSON.parse(session);
      if (cur.handle?.toLowerCase() === clean && cur.level) return Number(cur.level);
    }
    const profs = localStorage.getItem('privity_profiles_v5');
    if (profs) {
      const parsed = JSON.parse(profs);
      if (parsed[clean]?.level) return Number(parsed[clean].level);
    }
  } catch {}
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

  // 1. Resolve current authenticated user handle
  let myCleanHandle = '';
  let authUser: any = null;
  try {
    const rawAuth = localStorage.getItem('privity_auth_session_v1');
    if (rawAuth) {
      authUser = JSON.parse(rawAuth);
      myCleanHandle = (authUser.handle || '').toLowerCase().replace(/^@/, '').trim();
    }
  } catch {}

  const isSelf = myCleanHandle ? cleanHandle === myCleanHandle : false;

  // 2. Comprehensive Profile Resolution across all stores
  let storedProf: any = null;

  // A. Check if target is current auth user
  if (isSelf && authUser) {
    storedProf = authUser;
  }

  // B. Check privity_profiles_v5
  try {
    const rawProfiles = localStorage.getItem('privity_profiles_v5');
    if (rawProfiles) {
      const parsed = JSON.parse(rawProfiles);
      const found =
        parsed[cleanHandle] ||
        Object.values(parsed).find(
          (p: any) => (p.handle || '').toLowerCase().replace(/^@/, '').trim() === cleanHandle
        );
      if (found) {
        storedProf = storedProf ? { ...found, ...storedProf } : found;
      }
    }
  } catch {}

  // C. Check privity_accounts_v1
  try {
    const rawAccounts = localStorage.getItem('privity_accounts_v1');
    if (rawAccounts) {
      const accounts = JSON.parse(rawAccounts);
      const acc = accounts[cleanHandle];
      if (acc) {
        storedProf = storedProf ? { ...acc, ...storedProf } : acc;
      }
    }
  } catch {}

  // D. Check live host registry if this user is / was broadcasting
  try {
    const rawHost = localStorage.getItem('privity_current_live_host');
    if (rawHost) {
      const liveHost = JSON.parse(rawHost);
      const hostHandle = (liveHost.creatorHandle || liveHost.handle || '').toLowerCase().replace(/^@/, '').trim();
      if (hostHandle === cleanHandle) {
        storedProf = storedProf ? { ...liveHost, ...storedProf } : liveHost;
      }
    }
  } catch {}

  const baseProf = BASE_PRIVITY_PROFILES[cleanHandle];
  const prof = storedProf || baseProf;

  // 3. Check real-time following status in localStorage (privity_following_v5)
  let followingMap: Record<string, boolean> = {};
  try {
    const rawFollowing = localStorage.getItem('privity_following_v5');
    if (rawFollowing) {
      const parsed = JSON.parse(rawFollowing);
      if (Array.isArray(parsed)) {
        parsed.forEach((h: string) => {
          followingMap[h.replace(/^@/, '').toLowerCase().trim()] = true;
        });
      } else if (typeof parsed === 'object') {
        Object.keys(parsed).forEach((k) => {
          if (parsed[k]) {
            followingMap[k.replace(/^@/, '').toLowerCase().trim()] = true;
          }
        });
      }
    }
  } catch {}

  // 4. Level calculation
  const level = partial?.level ?? prof?.level ?? getDeterministicLevel(cleanHandle);
  const levelTitle = getLevelTitle(level);

  // 5. Accurate Real Followers Count (Strictly 100% accurate, Agreed Numbers)
  let followers = 0;
  if (partial?.followers !== undefined) {
    followers = partial.followers;
  } else if (isSelf) {
    if (Array.isArray(prof?.followersList)) {
      followers = prof.followersList.length;
    } else if (typeof prof?.followers === 'number') {
      followers = prof.followers;
    } else if (typeof prof?.followersCount === 'number') {
      followers = prof.followersCount;
    } else {
      followers = 0;
    }
  } else {
    const isFollowedByMe = !!(followingMap[cleanHandle] || followingMap[handle]);
    const followersList = Array.isArray(prof?.followersList) ? prof.followersList : [];
    const filteredList = followersList.filter((h: string) => (h || '').toLowerCase().replace(/^@/, '').trim() !== myCleanHandle);
    followers = filteredList.length + (isFollowedByMe ? 1 : 0);

    if (typeof prof?.followersCount === 'number' && prof.followersCount > followers) {
      followers = prof.followersCount;
    } else if (typeof prof?.followers === 'number' && prof.followers > followers) {
      followers = prof.followers;
    }
  }

  // 6. Accurate Real Following Count (Strictly 100% accurate)
  let following = 0;
  if (partial?.following !== undefined) {
    following = partial.following;
  } else if (isSelf) {
    const activeFollowings = Object.keys(followingMap).filter(
      (k) => followingMap[k] && !k.startsWith('sc-') && k.toLowerCase() !== myCleanHandle
    );
    following = activeFollowings.length;
  } else if (Array.isArray(prof?.followingList)) {
    following = prof.followingList.length;
  } else if (typeof prof?.following === 'number') {
    following = prof.following;
  } else if (typeof prof?.followingCount === 'number') {
    following = prof.followingCount;
  } else {
    following = 0;
  }

  // 7. Accurate Real Likes Count (Aggregated from user posts, media items, and live reception)
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
            const author = (p.authorHandle || '').replace(/^@/, '').toLowerCase().trim();
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
    if (typeof prof?.likesCount === 'number' && prof.likesCount > likes) {
      likes = prof.likesCount;
    } else if (typeof prof?.likes === 'number' && prof.likes > likes) {
      likes = prof.likes;
    }
  }

  // 8. Accurate Banner
  const banner =
    partial?.banner ||
    prof?.coverUrl ||
    prof?.cover_url ||
    prof?.previewUrl ||
    prof?.posterUrl ||
    prof?.banner ||
    DEFAULT_BANNERS[hash % DEFAULT_BANNERS.length];

  // 9. Accurate Bio
  const defaultBio =
    prof?.bio ||
    prof?.description ||
    'Privity creator sharing private-first moments and authentic updates.';
  const bio = partial?.bio || defaultBio;

  // 10. Accurate Avatar
  const defaultAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanHandle}`;
  const avatar = partial?.avatar || prof?.avatar || prof?.creatorAvatar || defaultAvatar;

  // 11. Accurate Name
  const name =
    partial?.name ||
    prof?.name ||
    prof?.creatorName ||
    cleanHandle.charAt(0).toUpperCase() + cleanHandle.slice(1);

  return {
    id: partial?.id || prof?.id || `user_${cleanHandle}`,
    name: name.replace(' (LIVE NOW 🔴)', ''),
    handle: cleanHandle,
    avatar,
    banner,
    level,
    levelTitle,
    followers,
    following,
    likes,
    bio,
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
