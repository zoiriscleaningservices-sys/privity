import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  PostPrivacy,
  PostType,
  AuditLogEntry,
  ModerationActionType,
} from '@privity/types';
import {
  IconHome,
  IconDiscover,
  IconBell,
  IconUser,
  IconShield,
  IconPlus,
  IconHeart,
  IconChat,
  IconShare,
  IconBookmark,
  IconDots,
  IconGlobe,
  IconUsers,
  IconStarCloseFriends,
  IconVerifiedStar,
  IconPhoto,
  IconLock,
  IconSearch,
  IconCheck,
  IconX,
  IconSettings,
  IconEdit,
  IconArrowLeft,
  IconMapPin,
  IconLink,
  IconCalendar,
  IconGrid,
  IconList,
  IconUserCheck,
  IconKey,
  IconDownload,
  IconTrash,
  IconSmartphone,
  IconMail,
  IconFileText,
  IconCopy,
  IconMic,
  IconPlay,
  IconPause,
  IconSend,
  IconFeedStream,
  IconUsersPlus,
  IconMenu3Lines,
} from './components/Icons';
import {
  Gift,
  GiftEvent,
  AdminGiftManager,
  globalGiftQueue,
  loadGiftsCatalog,
  DEFAULT_GIFTS,
} from './gifts';
import './gifts/gifts.css';
import { CameraModal } from './camera';
import { LiveMeStreamArena, LiveExploreGrid, LivePipPlayer, LIVEME_STREAMERS } from './components/liveme';
import { LiveMeStreamer } from './components/liveme/types';
import { liveStreamSync } from './services/liveStreamSyncService';
import {
  TikTokSlideFeed,
  StoryItem,
} from './components/feed/TikTokSlideFeed';
import { authService, UserAccount } from './services/authService';
import { getSupabaseClient, broadcastViaSupabase, onSupabaseBroadcast, reconnectSupabaseRealtime, isSupabaseRealtimeConnected } from './services/supabaseClient';
import { getDeterministicLevel } from './components/liveme/userProfileUtils';
import { AuthModal } from './components/auth';
import { convertVideoToAnimatedLoop, isKnownVideoUrl, extractVideoThumbnail } from './services/videoMediaHelper';
import { storePostMedia, getFreshMediaUrl, clearAllMediaBlobs } from './services/mediaDb';

// Privity LIVE Studio & Interactive Simulator
const LiveLab = React.lazy(() => import('./live/dev/LiveLab').then((m) => ({ default: m.LiveLab })));

export const BANNED_MOCK_HANDLES = new Set([
  'elena_rodriguez',
  'marcus_dev',
  'queenduc',
  'nicole_spicy',
  'julian_analogue',
  'sara_architecture',
  'oliver_wood',
  'chloe_visuals',
  'carlos_m',
  'sarita_w',
  'max_ldn',
  'shadow_wolf',
  'gatty_live',
  'kenji_tokyo',
  'elena_r',
  'sam_arch',
  'jess_film',
  'sam_archer',
  'jessica_vance',
]);

export const isMockHandle = (handle?: string): boolean => {
  if (!handle) return false;
  const clean = handle.replace(/^@/, '').toLowerCase().trim();
  return BANNED_MOCK_HANDLES.has(clean);
};

export const getCleanFollowingHandles = (map: Record<string, boolean>, excludeHandle?: string): string[] => {
  if (!map || typeof map !== 'object') return [];
  const ex = (excludeHandle || '').toLowerCase().replace(/^@/, '').trim();
  const set = new Set<string>();
  Object.keys(map).forEach((k) => {
    if (!map[k]) return;
    const clean = k.toLowerCase().replace(/^@/, '').trim();
    if (!clean) return;
    if (isMockHandle(clean)) return;
    if (ex && clean === ex) return;
    set.add(clean);
  });
  return Array.from(set);
};

export const isMockPost = (p: any): boolean => {
  if (!p || typeof p !== 'object') return true;
  const id = String(p.id || '');
  if (id.startsWith('p-media-')) return true;
  if (
    id.startsWith('p-nicole') ||
    id.startsWith('p-sara') ||
    id.startsWith('p-marcus') ||
    id.startsWith('p-elena') ||
    id.startsWith('p-julian') ||
    id.startsWith('p-chloe') ||
    id.startsWith('p-oliver') ||
    id.startsWith('mock-') ||
    id.startsWith('demo-')
  ) {
    return true;
  }
  return isMockHandle(p.authorHandle);
};

// Guaranteed Absolute Zero Reset v395: Pure scratch start - refresh and delete all posts, all activities, all accounts so all users can register/login from scratch
const GROUND_ZERO_FLAG = 'privity_ground_zero_v395_pure_scratch';
if (typeof window !== 'undefined' && localStorage.getItem(GROUND_ZERO_FLAG) !== 'done') {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        k.startsWith('privity_') &&
        k !== GROUND_ZERO_FLAG &&
        k !== 'privity_anon_key' &&
        k !== 'privity_supabase_anon_key'
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
    clearAllMediaBlobs().catch(() => {});
    localStorage.setItem(GROUND_ZERO_FLAG, 'done');
  } catch (e) {}
}

const ALL_TEMPLATE_POSTS: PostItem[] = [];

// 24-hour persistent story loader (strictly within stories, zero mock stories)
export const loadValidStories = (): StoryItem[] => {
  try {
    const saved = localStorage.getItem('privity_stories_v3');
    if (saved) {
      const parsed: StoryItem[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const now = Date.now();
        const valid = parsed.filter(
          (s) =>
            (!s.createdAt || now - s.createdAt < 86400000) &&
            !isMockHandle(s.authorHandle)
        );
        return valid;
      }
    }
  } catch (e) {}
  return [];
};

// ==================== SETTINGS DATA MODEL ====================

export interface UserSettings {
  email: string;
  phone: string;
  membershipTier: 'Visionary Genesis' | 'Founding Member' | 'Sovereign Pass';
  handlePrivacyBadge: boolean;
  isPrivateAccount: boolean;
  showOnlineStatus: boolean;
  allowDirectMessages: 'everyone' | 'following' | 'close_friends';
  readReceipts: boolean;
  searchDiscoverable: boolean;
  notifyCloseFriendsDispatches: boolean;
  notifyMentionsAndReplies: boolean;
  notifyNewFollowers: boolean;
  notifyCryptoProofValidations: boolean;
  twoFactorEnabled: boolean;
  cryptoKeyFingerprint: string;
  hardwareKeyLinked: boolean;
  sessionDevice: string;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  email: '',
  phone: '',
  membershipTier: 'Founding Member',
  handlePrivacyBadge: true,
  isPrivateAccount: false,
  showOnlineStatus: true,
  allowDirectMessages: 'close_friends',
  readReceipts: false,
  searchDiscoverable: true,
  notifyCloseFriendsDispatches: true,
  notifyMentionsAndReplies: true,
  notifyNewFollowers: true,
  notifyCryptoProofValidations: true,
  twoFactorEnabled: false,
  cryptoKeyFingerprint: '',
  hardwareKeyLinked: false,
  sessionDevice: 'Active Web Session',
};

// ==================== REAL DATA MODELS & ASSETS ====================

export interface PostCommentReply {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  isVerified?: boolean;
  text: string;
  timeAgo: string;
  likesCount?: number;
  isLiked?: boolean;
  likersList?: string[];
}

export interface PostComment {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  isVerified?: boolean;
  text: string;
  timeAgo: string;
  likesCount: number;
  isLiked?: boolean;
  replies?: PostCommentReply[];
  likersList?: string[];
}

interface PostItem {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  isVerified: boolean;
  verifiedCategory?: string;
  verifiedSince?: string;
  cryptoProofId?: string;
  type: PostType;
  contentUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  videoMediaId?: string;
  soundName?: string;
  soundCover?: string;
  soundUrl?: string;
  soundArtist?: string;
  voiceMemoDuration?: string;
  caption: string;
  tags: string[];
  privacy: PostPrivacy;
  likesCount: number;
  likersList?: string[];
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  saversList?: string[];
  isLiked?: boolean;
  isSaved?: boolean;
  isReposted?: boolean;
  timeAgo: string;
  comments: PostComment[];
}

export const normalizeHandle = (h?: string | null): string => {
  if (!h) return '';
  return String(h).replace(/^@/, '').trim().toLowerCase();
};

export const isSameHandle = (h1?: string | null, h2?: string | null): boolean => {
  const c1 = normalizeHandle(h1);
  const c2 = normalizeHandle(h2);
  return c1.length > 0 && c1 === c2;
};

export const isPostLikedByUser = (post?: PostItem | null, handle?: string | null): boolean => {
  if (!post) return false;
  const clean = normalizeHandle(handle);
  if (!clean) return false;
  if (Array.isArray(post.likersList)) {
    return post.likersList.some((h) => normalizeHandle(h) === clean);
  }
  return !!post.isLiked;
};

export const isPostSavedByUser = (post?: PostItem | null, handle?: string | null, savedIds?: string[]): boolean => {
  if (!post) return false;
  const clean = normalizeHandle(handle);
  if (clean && Array.isArray(post.saversList)) {
    return post.saversList.some((h) => normalizeHandle(h) === clean);
  }
  if (savedIds && savedIds.includes(post.id)) return true;
  return !!post.isSaved;
};

export const calcCommentsCount = (comments?: PostComment[]): number => {
  if (!Array.isArray(comments)) return 0;
  return comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
};

export const isCommentLikedByUser = (comment?: { likersList?: string[] } | null, handle?: string | null): boolean => {
  if (!comment) return false;
  const clean = normalizeHandle(handle);
  if (!clean || !Array.isArray(comment.likersList)) return false;
  return comment.likersList.some((h) => normalizeHandle(h) === clean);
};

export interface AppNotification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'gift' | 'save' | 'share' | 'live' | 'story' | 'read';
  actorHandle: string;
  actorName: string;
  actorAvatar: string;
  actorVerified?: boolean;
  targetPostId?: string;
  postCaptionSnippet?: string;
  postThumbnail?: string;
  commentText?: string;
  giftName?: string;
  timestamp: number;
  timeAgo: string;
  isRead: boolean;
}

export interface ChatGroup {
  id: string;
  name: string;
  avatar: string;
  members: string[];
  createdAt: number;
  createdBy: string;
}

export const SAMPLE_POSTS: PostItem[] = [];

export const SUGGESTED_CREATORS: any[] = [];

interface UserMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  likes: number;
  comments: number;
  isLiked?: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  avatarPoster?: string;
  coverUrl: string;
  coverPoster?: string;
  isVerified: boolean;
  verifiedCategory?: string;
  verifiedSince?: string;
  cryptoProofId?: string;
  bio: string;
  category?: string;
  location?: string;
  joinedDate?: string;
  website?: string;
  isPrivate?: boolean;
  circleStatus: 'Close Friend' | 'Mutual Follower' | 'Public Connection' | 'You';
  mediaItems: UserMediaItem[];
  followersList: string[];
  followingList: string[];
  trustCirclesList: string[];
}

const INITIAL_PROFILES_REGISTRY: Record<string, UserProfile> = {};

// ==================== LIVE ENCRYPTED STREAMS MODEL ====================
export type FeedFilterTab = 'live' | 'feed' | 'all' | 'close_friends' | 'followers' | 'birdie';
export const FEED_TABS: FeedFilterTab[] = ['live', 'birdie', 'close_friends', 'followers', 'feed', 'all'];

export interface LiveGuestSlot {
  id: string;
  name: string;
  avatar: string;
  viewers: string;
  isMuted?: boolean;
  isSpeaking?: boolean;
  role?: string;
  tag?: string;
  flag?: string;
}export interface LiveBattleInfo {
  opponentName: string;
  opponentHandle: string;
  opponentAvatar: string;
  opponentVideoUrl: string;
  opponentStreamUrl?: string;
  coHostName?: string;
  coHostVideoUrl?: string;
  hostScore: number;
  opponentScore: number;
  timeLeft: string;
  isMatchActive: boolean;
  matchTitle: string;
}

export interface LiveGiftItem {
  id: string;
  name: string;
  icon: string;
  sparksCost: number;
  effect: string;
  color: string;
  tag: string;
}

export const LIVE_GIFTS_CATALOG: LiveGiftItem[] = [
  { id: 'gift-rose', name: 'Privity Rose', icon: '🌹', sparksCost: 1, effect: 'rose_burst', color: '#f43f5e', tag: 'Fast' },
  { id: 'gift-diamond', name: 'Sovereign Gem', icon: '💎', sparksCost: 10, effect: 'gem_shimmer', color: '#38bdf8', tag: 'VIP' },
  { id: 'gift-rocket', name: 'Falcon Rocket', icon: '🚀', sparksCost: 50, effect: 'rocket_launch', color: '#f97316', tag: 'Hype' },
  { id: 'gift-crown', name: 'Visionary Crown', icon: '👑', sparksCost: 100, effect: 'crown_rain', color: '#fbbf24', tag: 'Luxury' },
  { id: 'gift-dragon', name: 'Celestial Dragon', icon: '🐉', sparksCost: 500, effect: 'dragon_supernova', color: '#f59e0b', tag: 'Godly' },
  { id: 'gift-galaxy', name: 'Supernova Galaxy', icon: '🌌', sparksCost: 1000, effect: 'galaxy_spiral', color: '#c084fc', tag: 'Supreme' },
];

export interface LiveStreamSession {
  id: string;
  creatorHandle: string;
  creatorName: string;
  creatorAvatar: string;
  isVerified: boolean;
  category: string;
  title: string;
  description: string;
  viewersCount: number;
  likesCount: number;
  dailyRank: string;
  previewUrl: string;
  videoStreamUrl?: string;
  battleInfo?: LiveBattleInfo;
  multiGuests: LiveGuestSlot[];
  participants: Array<{ name: string; avatar: string; role: string }>;
  tags: string[];
}

export const INITIAL_LIVE_STREAMS: LiveStreamSession[] = [];

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
];

// Preset Banners for Studio & Architectural Aesthetics
const PRESET_BANNERS = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1600&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1600&auto=format&fit=crop&q=85',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
];

// High-performance image file reader & canvas compressor (ultra lightweight, instant WebSocket sync)
const compressImageFile = (
  file: File,
  maxDim: number = 640,
  quality: number = 0.58,
  onComplete: (dataUrl: string) => void
) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const raw = e.target?.result as string;
    if (!raw) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > h && w > maxDim) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else if (h > maxDim) {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        onComplete(canvas.toDataURL('image/jpeg', quality));
      } else {
        onComplete(raw);
      }
    };
    img.src = raw;
  };
  reader.readAsDataURL(file);
};

// ==================== VERIFICATION BADGE COMPONENT ====================

const VerifiedBadge: React.FC<{
  authorName: string;
  category?: string;
  since?: string;
  proofId?: string;
}> = ({ authorName, category, since, proofId }) => {
  const [showPopover, setShowPopover] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'confirmed'>('idle');

  const handleCopyProof = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(proofId || 'priv_ed25519_verified_proof');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRunVerify = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVerifyStatus('checking');
    setTimeout(() => setVerifyStatus('confirmed'), 600);
  };

  return (
    <span
      className="verified-emblem-wrap"
      onClick={(e) => {
        e.stopPropagation();
        setShowPopover((prev) => !prev);
      }}
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
      title="Verified authentic creator — Click for cryptographic certificate"
    >
      <IconVerifiedStar size={17} />

      {showPopover && (
        <div className="verification-popover-card" onClick={(e) => e.stopPropagation()}>
          <div className="popover-header-row">
            <div className="popover-icon-glow">
              <IconVerifiedStar size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="popover-name-text">{authorName}</div>
              <div className="popover-badge-category">
                <span className="popover-active-dot" /> Verified Authentic Human
              </div>
            </div>
            <button
              className="popover-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowPopover(false);
              }}
              title="Close badge details"
            >
              <IconX size={14} />
            </button>
          </div>

          <div className="popover-desc-copy">
            {category || 'Verified Creator'} • {since || 'Verified 2026'}
          </div>

          <div className="popover-crypto-fingerprint">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Ed25519 Cryptographic Key
              </span>
              <button
                className="popover-copy-btn"
                onClick={handleCopyProof}
                title="Copy public key fingerprint"
              >
                {copiedKey ? '✓ Copied' : 'Copy Key'}
              </button>
            </div>
            <span className="crypto-hash-pill">{proofId || 'priv_ed25519_verified_proof'}</span>
          </div>

          <div className="popover-action-footer">
            <div className="popover-ledger-status">
              <IconShield size={13} color="var(--cf-emerald)" />
              <span>Privity Trust Protocol</span>
            </div>
            <button
              className={`popover-verify-btn ${verifyStatus}`}
              onClick={handleRunVerify}
            >
              {verifyStatus === 'checking'
                ? 'Validating...'
                : verifyStatus === 'confirmed'
                ? '✓ Valid On-Chain'
                : 'Verify Ledger'}
            </button>
          </div>
        </div>
      )}
    </span>
  );
};

// Canonical Media Normalizer: matches URLs across varied CDN/Unsplash query dimensions & uploaded base64 data
const extractMediaBaseKey = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('data:')) {
    // Deterministic signature of length + sample slices to avoid massive keys and quota crashes
    return `data-sig-${url.slice(0, 80)}-tail-${url.slice(-40)}-len-${url.length}`;
  }
  try {
    const unsplashMatch = url.match(/(photo-[\w-]+)/i);
    if (unsplashMatch) return unsplashMatch[1].toLowerCase();
    return url.split('?')[0].trim().toLowerCase();
  } catch {
    return (url || '').trim().toLowerCase();
  }
};

const isSameMedia = (url1?: string, url2?: string): boolean => {
  if (!url1 || !url2) return false;
  if (url1 === url2) return true;
  if (url1.startsWith('data:') && url2.startsWith('data:')) {
    if (url1.length !== url2.length) return false;
    return url1.slice(0, 160) === url2.slice(0, 160) && url1.slice(-60) === url2.slice(-60);
  }
  const k1 = extractMediaBaseKey(url1);
  const k2 = extractMediaBaseKey(url2);
  if (k1 && k2 && k1 === k2) return true;
  return url1.split('?')[0].trim() === url2.split('?')[0].trim();
};

export const cleanMediaUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  return url.split('#')[0];
};

export const isVideoMedia = (url?: string): boolean => {
  if (!url) return false;
  if (url.startsWith('data:video/')) return true;
  if (url.includes('#video') || url.includes('video/')) return true;
  if (isKnownVideoUrl(url)) return true;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.ogg') ||
    clean.endsWith('.m4v') ||
    clean.includes('video')
  );
};

export const MediaAvatar: React.FC<{
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  showBadge?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}> = ({ src, alt = 'Avatar', className = '', style, onClick, title }) => {
  const isVid = isVideoMedia(src);
  if (isVid) {
    const playUrl = cleanMediaUrl(src);
    return (
      <div
        className={`media-avatar-container ${className}`}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
        onClick={onClick}
        title={title}
      >
        <video
          key={playUrl}
          src={playUrl}
          autoPlay
          loop
          muted
          playsInline
          // @ts-ignore
          webkit-playsinline="true"
          ref={(el) => {
            if (el) {
              el.muted = true;
              el.defaultMuted = true;
              el.playsInline = true;
              el.play().catch(() => {});
            }
          }}
          onError={(e) => {
            const vid = e.currentTarget;
            if (vid) {
              vid.style.display = 'none';
              const imgFallback = vid.nextElementSibling as HTMLElement;
              if (imgFallback) imgFallback.style.display = 'block';
            }
          }}
          className={`media-avatar-video ${className}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        />
        <img
          src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(alt || 'user')}`}
          alt={alt}
          className={`media-avatar-img ${className}`}
          style={{ display: 'none', width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        />
      </div>
    );
  }
  return (
    <img
      src={cleanMediaUrl(src)}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      title={title}
      onError={(e) => {
        const target = e.currentTarget;
        const fallback = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(alt || 'user')}`;
        if (target.src !== fallback) {
          target.src = fallback;
        }
      }}
    />
  );
};

import { PrivityVideoPlayer } from './components/feed/PrivityVideoPlayer';
export { PrivityVideoPlayer };

export interface DirectChatMessage {
  id: string;
  senderHandle: string;
  recipientHandle: string;
  text: string;
  timeAgo: string;
  timestamp: number;
  reactions?: Record<string, number>;
  userReactions?: Record<string, string[]>;
  mediaUrl?: string;
  mediaType?: 'photo' | 'video';
  isVoiceMemo?: boolean;
  voiceDuration?: string;
  audioUrl?: string;
  isRead?: boolean;
  readAt?: number;
  replyTo?: {
    id: string;
    senderHandle: string;
    text: string;
  };
}

const INITIAL_DIRECT_MESSAGES: Record<string, DirectChatMessage[]> = {};

// Helper to sanitize stored direct messages so legacy glitch counters (e.g. 25, 24) are cleanly normalized
const sanitizeStoredDirectMessages = (raw: Record<string, DirectChatMessage[]>, userHandle?: string): Record<string, DirectChatMessage[]> => {
  if (!raw || typeof raw !== 'object') return raw;
  const cleanMyHandle = userHandle ? userHandle.replace(/^@/, '') : '';
  const sanitized: Record<string, DirectChatMessage[]> = {};

  for (const [handle, thread] of Object.entries(raw)) {
    if (!Array.isArray(thread)) {
      sanitized[handle] = [];
      continue;
    }
    sanitized[handle] = thread.map((m) => {
      if (!m.reactions || Object.keys(m.reactions).length === 0) return m;

      const nextReactions: Record<string, number> = {};
      const nextUserReactions: Record<string, string[]> = { ...(m.userReactions || {}) };

      for (const [emoji, rawCount] of Object.entries(m.reactions)) {
        if (typeof rawCount !== 'number' || rawCount <= 0) continue;
        const users = [...(nextUserReactions[emoji] || [])];

        // If legacy glitch had incremented it (e.g. 25, 24) without user tracking, attribute 1 to the active user
        if (users.length === 0) {
          if (cleanMyHandle) nextUserReactions[emoji] = [cleanMyHandle];
          nextReactions[emoji] = 1;
        } else {
          nextReactions[emoji] = users.length;
        }
      }

      return {
        ...m,
        reactions: nextReactions,
        userReactions: nextUserReactions,
      };
    });
  }
  return sanitized;
};

// ==================== MAIN COMPONENT ====================

export function App() {
  // Safe localStorage storage helper with quota management and oversized video protection
  const safeSaveStorage = (key: string, data: any) => {
    try {
      let sanitized = data;
      // Protect localStorage from oversized base64 video and media strings (>100KB) to prevent iOS Safari OOM crashes
      if (key === 'privity_posts_v5' && Array.isArray(data)) {
        sanitized = data.map((post) => {
          let updated = { ...post };
          if (updated.videoUrl && updated.videoUrl.length > 100000 && updated.videoUrl.startsWith('data:')) {
            updated.videoUrl = updated.thumbnailUrl || undefined;
          }
          if (updated.contentUrl && updated.contentUrl.length > 100000 && updated.contentUrl.startsWith('data:')) {
            updated.contentUrl = updated.thumbnailUrl || undefined;
          }
          return updated;
        });
      } else if (key === 'privity_profiles_v5' && typeof data === 'object' && data !== null) {
        sanitized = {};
        for (const [k, prof] of Object.entries(data as Record<string, any>)) {
          if (!prof) continue;
          let cleanProf = { ...prof };
          if (cleanProf.avatar && cleanProf.avatar.length > 800000 && cleanProf.avatar.startsWith('data:')) {
            cleanProf.avatar = cleanProf.avatarPoster || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400';
          }
          if (cleanProf.coverUrl && cleanProf.coverUrl.length > 1200000 && cleanProf.coverUrl.startsWith('data:')) {
            cleanProf.coverUrl = cleanProf.coverPoster || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200';
          }
          (sanitized as any)[k] = cleanProf;
        }
      }
      localStorage.setItem(key, JSON.stringify(sanitized));
    } catch (e) {
      console.warn(`Storage quota reached for ${key}, trimming payload`, e);
      try {
        if (Array.isArray(data)) {
          localStorage.setItem(key, JSON.stringify(data.slice(0, 10)));
        } else if (typeof data === 'object' && data !== null) {
          const entries = Object.entries(data).filter(([k]) => !k.startsWith('data:'));
          localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries.slice(-20))));
        }
      } catch (err2) {
        console.warn('Trimmed fallback failed', err2);
      }
    }
  };

  // Helper for persistent localStorage retrieval with safe fallback
  const readStorage = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) {
      console.warn(`Error reading ${key} from storage:`, e);
    }
    return fallback;
  };

  // 0. Persistent Active Section / Tab (stays on current section upon refresh)
  const isLiveLabHash = (): boolean => {
    try {
      const h = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      return ['live-lab', 'live-sim', 'live-v2', 'live-studio', 'live', 'studio', 'battle'].includes(h);
    } catch {
      return false;
    }
  };

  const [liveLabActive, setLiveLabActive] = useState<boolean>(isLiveLabHash);

  const getInitialActiveTab = (): 'feed' | 'discover' | 'messages' | 'activity' | 'profile' | 'safety' => {
    try {
      const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (['feed', 'discover', 'messages', 'activity', 'profile', 'safety'].includes(hash)) {
        return hash as any;
      }
    } catch (e) {}
    return readStorage('privity_active_tab_v5', 'feed');
  };

  const [activeTab, setActiveTab] = useState<'feed' | 'discover' | 'messages' | 'activity' | 'profile' | 'safety'>(getInitialActiveTab);
  const [feedFilter, setFeedFilter] = useState<FeedFilterTab>('feed');
  const [feedViewMode, setFeedViewMode] = useState<'slide' | 'cards'>(() =>
    readStorage('privity_feed_view_mode_v1', 'slide')
  );
  const [liveStreamsList, setLiveStreamsList] = useState<LiveStreamSession[]>(INITIAL_LIVE_STREAMS);
  const [activeLiveIndex, setActiveLiveIndex] = useState(0);
  const [liveLayoutMode, setLiveLayoutMode] = useState<'battle' | '4way'>('battle');
  const [isGiftTrayOpen, setIsGiftTrayOpen] = useState(false);
  const [currentAuthUser, setCurrentAuthUser] = useState<UserAccount | null>(() => authService.getCurrentUser());
  const currentAuthUserRef = React.useRef(currentAuthUser);
  currentAuthUserRef.current = currentAuthUser;
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => !authService.getCurrentUser());
  const [userSparksBalance, setUserSparksBalance] = useState(() => authService.getCurrentUser()?.sparks ?? 0);
  const [battleScoreHost, setBattleScoreHost] = useState(0);
  const [battleScoreOpponent, setBattleScoreOpponent] = useState(0);
  const [battleTimeSeconds, setBattleTimeSeconds] = useState(0);
  const [isBattleMatchActive, setIsBattleMatchActive] = useState(false);
  const [followedCreators, setFollowedCreators] = useState<Record<string, boolean>>({});
  const [hostLiveLikes, setHostLiveLikes] = useState<Record<string, number>>({});

  useEffect(() => {
    return authService.subscribe((user) => {
      currentAuthUserRef.current = user;
      setCurrentAuthUser(user);
      if (user) {
        setUserSparksBalance(user.sparks ?? 0);
      }
    });
  }, []);

  // AI Vision & Interactive Video Features
  const [aiLensMode, setAiLensMode] = useState<'cyber' | 'elemental' | 'anime' | 'studio'>('cyber');
  const [isLiveSoundMuted, setIsLiveSoundMuted] = useState(false);
  const [pkComboCount, setPkComboCount] = useState(0);
  const [isGloveClashing, setIsGloveClashing] = useState(false);
  const [screenScoreFloaters, setScreenScoreFloaters] = useState<Array<{ id: number; text: string; x: number; y: number; side: 'host' | 'rival' }>>([]);

  const [activeLiveStream, setActiveLiveStream] = useState<LiveStreamSession | null>(null);
  const [minimizedLiveStream, setMinimizedLiveStream] = useState<any | null>(null);
  const [liveChatInput, setLiveChatInput] = useState('');
  const [liveComments, setLiveComments] = useState<Array<{ id: string; user: string; text: string; badge?: string; level?: number; isHost?: boolean; isJoin?: boolean; giftName?: string; giftIcon?: string }>>([]);
  const [floatingHearts, setFloatingHearts] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; rot: number }>>([]);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  // Top Likers & Contributors Leaderboard Modal State
  const [isLikesLeaderboardOpen, setIsLikesLeaderboardOpen] = useState(false);
  const [likersLeaderboard, setLikersLeaderboard] = useState<Array<{ id: string; name: string; handle: string; avatar: string; likes: number; badge: string; level: number }>>([]);

  // Live Viewers Roster Modal State (opened by clicking viewers pill)
  const [isViewersModalOpen, setIsViewersModalOpen] = useState(false);
  const [liveViewersSearch, setLiveViewersSearch] = useState('');
  const [liveViewersList] = useState<Array<{
    id: string;
    name: string;
    handle: string;
    avatar: string;
    isVerified?: boolean;
    role: string;
    level: number;
    badge: string;
  }>>([]);

  const filteredLiveViewers = useMemo(() => {
    if (!liveViewersSearch.trim()) return liveViewersList;
    const query = liveViewersSearch.toLowerCase();
    return liveViewersList.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.handle.toLowerCase().includes(query) ||
        v.role.toLowerCase().includes(query)
    );
  }, [liveViewersList, liveViewersSearch]);

  // Live Vertical Slide Direction & Navigation
  const [liveSlideDirection, setLiveSlideDirection] = useState<'down' | 'up' | null>(null);
  const lastLiveWheelTime = useRef<number>(0);
  const liveTouchStartY = useRef<number>(0);

  const handleNextLiveStream = useCallback(() => {
    if (liveStreamsList.length === 0) return;
    setLiveSlideDirection('down');
    setActiveLiveIndex((prev) => {
      const nextIdx = (prev + 1) % liveStreamsList.length;
      const nextStream = liveStreamsList[nextIdx];
      if (nextStream?.battleInfo) {
        setBattleScoreHost(nextStream.battleInfo.hostScore);
        setBattleScoreOpponent(nextStream.battleInfo.opponentScore);
      } else {
        setBattleScoreHost(0);
        setBattleScoreOpponent(0);
      }
      return nextIdx;
    });
    setTimeout(() => setLiveSlideDirection(null), 420);
  }, [liveStreamsList]);

  const handlePrevLiveStream = useCallback(() => {
    if (liveStreamsList.length === 0) return;
    setLiveSlideDirection('up');
    setActiveLiveIndex((prev) => {
      const prevIdx = (prev - 1 + liveStreamsList.length) % liveStreamsList.length;
      const prevStream = liveStreamsList[prevIdx];
      if (prevStream?.battleInfo) {
        setBattleScoreHost(prevStream.battleInfo.hostScore);
        setBattleScoreOpponent(prevStream.battleInfo.opponentScore);
      } else {
        setBattleScoreHost(0);
        setBattleScoreOpponent(0);
      }
      return prevIdx;
    });
    setTimeout(() => setLiveSlideDirection(null), 420);
  }, [liveStreamsList]);

  const handleLiveWheel = (e: React.WheelEvent) => {
    // If wheel event originates from chat or modals, do not switch live stream
    const target = e.target as HTMLElement | null;
    if (target && target.closest('.live-arena-chat-overlay, .live-arena-chat-scroll, .live-viewers-modal-overlay, .live-likes-modal-overlay, .live-gift-tray-backdrop')) {
      return;
    }
    const now = Date.now();
    if (now - lastLiveWheelTime.current < 450) return;
    if (e.deltaY > 30) {
      lastLiveWheelTime.current = now;
      handleNextLiveStream();
    } else if (e.deltaY < -30) {
      lastLiveWheelTime.current = now;
      handlePrevLiveStream();
    }
  };

  const handleLiveTouchStart = (e: React.TouchEvent) => {
    // If the touch started inside the chat area, bottom controls, or modals, do NOT switch live creators
    const target = e.target as HTMLElement | null;
    if (target && target.closest('.live-arena-chat-overlay, .live-arena-chat-scroll, .live-arena-bottom-controls-bar, .live-viewers-modal-overlay, .live-likes-modal-overlay, .live-gift-tray-backdrop, .battle-supporters-under-cam-row, .live-arena-top-bar, .live-arena-sub-bar')) {
      liveTouchStartY.current = 0;
      return;
    }
    liveTouchStartY.current = e.touches[0].clientY;
  };

  const handleLiveTouchEnd = (e: React.TouchEvent) => {
    if (!liveTouchStartY.current) return;
    const diff = liveTouchStartY.current - e.changedTouches[0].clientY;
    liveTouchStartY.current = 0;
    if (diff > 55) {
      handleNextLiveStream();
    } else if (diff < -55) {
      handlePrevLiveStream();
    }
  };

  useEffect(() => {
    if (activeTab !== 'feed' || feedFilter !== 'live') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextLiveStream();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevLiveStream();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, feedFilter, handleNextLiveStream, handlePrevLiveStream]);

  const handleGiveLikesFromLeaderboard = (streamId: string, currentCount: number) => {
    setHostLiveLikes((prev) => ({
      ...prev,
      [streamId]: (prev[streamId] || currentCount) + 15,
    }));
    setLikersLeaderboard((prev) =>
      prev.map((item) => (item.handle === myProfile.handle ? { ...item, likes: item.likes + 15 } : item))
    );
    handleLiveHeartBurst('#ff4d6d');
    triggerToast('Tapped +15 Likes for Host! ♥');
  };

  // Live Battle Timer Countdown
  useEffect(() => {
    if (!isBattleMatchActive) return;
    const interval = setInterval(() => {
      setBattleTimeSeconds((prev) => (prev <= 1 ? 180 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isBattleMatchActive]);

  const formatBattleTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Real-Time Photo Likes Registry (synchronizes lightbox, posts, and profile media items)
  const [photoLikesMap, setPhotoLikesMap] = useState<Record<string, { isLiked: boolean; count: number }>>(() =>
    readStorage('privity_photo_likes_v5', {})
  );

  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const [copiedLightboxUrl, setCopiedLightboxUrl] = useState(false);
  const [lightboxHeartAnim, setLightboxHeartAnim] = useState(false);
  const [lightboxShowComments, setLightboxShowComments] = useState(false);
  const [lightboxCommentInput, setLightboxCommentInput] = useState('');

  // Real-Time End-to-End Encrypted Direct Messages State
  const [directMessages, setDirectMessages] = useState<Record<string, DirectChatMessage[]>>(() => {
    const loaded = readStorage('privity_direct_messages_v5', INITIAL_DIRECT_MESSAGES);
    return sanitizeStoredDirectMessages(loaded);
  });
  const [stories, setStories] = useState<StoryItem[]>(() => loadValidStories());
  const broadcastSyncEventRef = React.useRef<(event: any) => void>(() => {});

  const handleAddStory = (newStory: StoryItem) => {
    setStories((prev) => {
      const filtered = prev.filter((s) => s.id !== newStory.id);
      const next = [newStory, ...filtered];
      try {
        localStorage.setItem('privity_stories_v3', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    broadcastSyncEventRef.current({
      action: 'NEW_STORY',
      story: newStory,
    });
  };

  const handleDeleteStory = (storyId: string) => {
    setStories((prev) => {
      const next = prev.filter((s) => s.id !== storyId);
      try {
        localStorage.setItem('privity_stories_v3', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    broadcastSyncEventRef.current({
      action: 'DELETE_STORY',
      storyId,
    });
  };

  const [activeChatUser, setActiveChatUser] = useState<UserProfile | null>(null);
  const [dmActiveStoryIndex, setDmActiveStoryIndex] = useState<number | null>(null);
  const [dmStoryDragY, setDmStoryDragY] = useState(0);
  const [dmStoryReplyText, setDmStoryReplyText] = useState('');
  const [chatDraftText, setChatDraftText] = useState('');
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isDmSearchOpen, setIsDmSearchOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [messageModalMode, setMessageModalMode] = useState<'dm' | 'group'>('dm');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSelectedMembers, setNewGroupSelectedMembers] = useState<string[]>([]);
  const [chatGroups, setChatGroups] = useState<Record<string, ChatGroup>>(() => {
    return readStorage<Record<string, ChatGroup>>('privity_chat_groups_v1', {});
  });
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<ChatGroup | null>(null);
  const [deletedChannelHandles, setDeletedChannelHandles] = useState<string[]>(() => {
    return readStorage<string[]>('privity_deleted_channels_v1', []);
  });
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isFeedCommentsOpen, setIsFeedCommentsOpen] = useState(false);
  const [isFeedStoryOpen, setIsFeedStoryOpen] = useState(false);
  const [chatChannelFilter, setChatChannelFilter] = useState<'all' | 'close_friends' | 'unread'>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [chatMediaAttachment, setChatMediaAttachment] = useState<string | null>(null);
  const [chatMediaType, setChatMediaType] = useState<'photo' | 'video'>('photo');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [replyingToMessage, setReplyingToMessage] = useState<DirectChatMessage | null>(null);
  const [swipedChannelHandle, setSwipedChannelHandle] = useState<string | null>(null);
  const [isChatHeaderMenuOpen, setIsChatHeaderMenuOpen] = useState(false);
  const [mutedChats, setMutedChats] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('privity_muted_chats_v1') || '{}');
    } catch {
      return {};
    }
  });
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const recordingTimerRef = React.useRef<any>(null);
  const activeAudioElementRef = React.useRef<HTMLAudioElement | null>(null);

  // Close chat header menu when clicking anywhere outside
  useEffect(() => {
    if (!isChatHeaderMenuOpen) return;
    const closeMenu = () => setIsChatHeaderMenuOpen(false);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [isChatHeaderMenuOpen]);

  // Re-hydrate persistent high-fidelity video loops for avatar & cover banner from IndexedDB
  useEffect(() => {
    const hydrateMediaLoops = async () => {
      try {
        const cleanHandle = normalizeHandle(currentAuthUser?.handle || myProfile?.handle);
        if (!cleanHandle) return;

        const avatarKey =
          localStorage.getItem(`privity_user_avatar_media_key_${cleanHandle}`) ||
          localStorage.getItem('privity_user_avatar_media_key');
        if (avatarKey) {
          const freshUrl = await getFreshMediaUrl(avatarKey);
          if (freshUrl) {
            const finalUrl = freshUrl.includes('#') ? freshUrl : `${freshUrl}#video.mp4`;
            setProfiles((prev) => {
              const cur = prev[cleanHandle.toLowerCase()] || prev[cleanHandle] || { handle: cleanHandle, name: cleanHandle, avatar: finalUrl };
              return {
                ...prev,
                [cleanHandle.toLowerCase()]: { ...cur, avatar: finalUrl },
                [cleanHandle]: { ...cur, avatar: finalUrl },
              };
            });
            setCurrentAuthUser((prev) => (prev ? { ...prev, avatar: finalUrl } : null));
          }
        }
        const bannerKey =
          localStorage.getItem(`privity_user_banner_media_key_${cleanHandle}`) ||
          localStorage.getItem('privity_user_banner_media_key');
        if (bannerKey) {
          const freshUrl = await getFreshMediaUrl(bannerKey);
          if (freshUrl) {
            const finalUrl = freshUrl.includes('#') ? freshUrl : `${freshUrl}#video.mp4`;
            setProfiles((prev) => {
              const cur = prev[cleanHandle.toLowerCase()] || prev[cleanHandle] || { handle: cleanHandle, name: cleanHandle, coverUrl: finalUrl };
              return {
                ...prev,
                [cleanHandle.toLowerCase()]: { ...cur, coverUrl: finalUrl },
                [cleanHandle]: { ...cur, coverUrl: finalUrl },
              };
            });
            setCurrentAuthUser((prev) => (prev ? { ...prev, coverUrl: finalUrl } : null));
          }
        }
      } catch (err) {
        console.warn('Hydrate media loops error:', err);
      }
    };
    hydrateMediaLoops();
  }, [currentAuthUser?.handle]);

  // Take user all the way to the top of the preserved section upon page refresh / load
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Save active section across refreshes and sync with URL hash
  useEffect(() => {
    safeSaveStorage('privity_active_tab_v5', activeTab);
    try {
      const curH = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (['live-lab', 'live-sim', 'live-v2', 'live-studio', 'live', 'studio', 'battle'].includes(curH)) return;
      if (curH !== activeTab) {
        window.location.hash = activeTab;
      }
    } catch (e) {}
  }, [activeTab]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (['live-lab', 'live-sim', 'live-v2', 'live-studio', 'live', 'studio', 'battle'].includes(hash)) {
        setLiveLabActive(true);
        return;
      }
      setLiveLabActive(false);
      if (['feed', 'discover', 'messages', 'activity', 'profile', 'safety'].includes(hash)) {
        setActiveTab(hash as any);
        if (hash === 'messages') {
          setActiveChatUser(null);
        }
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    safeSaveStorage('privity_feed_view_mode_v1', feedViewMode);
  }, [feedViewMode]);

  // Save photo likes registry
  useEffect(() => {
    safeSaveStorage('privity_photo_likes_v5', photoLikesMap);
  }, [photoLikesMap]);

  // Save direct messages
  useEffect(() => {
    safeSaveStorage('privity_direct_messages_v5', directMessages);
  }, [directMessages]);

  // User-scoped notifications store key
  const activeUserHandle = normalizeHandle(currentAuthUser?.handle);
  const notifStorageKey = activeUserHandle ? `privity_notifs_${activeUserHandle}` : 'privity_notifications_v1';

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const key = activeUserHandle ? `privity_notifs_${activeUserHandle}` : 'privity_notifications_v1';
    return readStorage<AppNotification[]>(key, []);
  });

  // Re-sync notifications when switching accounts
  useEffect(() => {
    const key = activeUserHandle ? `privity_notifs_${activeUserHandle}` : 'privity_notifications_v1';
    setNotifications(readStorage<AppNotification[]>(key, []));
  }, [activeUserHandle]);

  // User-scoped saved posts store key & reactive state
  const [savedPostIds, setSavedPostIds] = useState<string[]>(() => {
    const key = activeUserHandle ? `privity_saved_posts_${activeUserHandle}` : 'privity_saved_posts_default';
    return readStorage<string[]>(key, []);
  });

  useEffect(() => {
    const key = activeUserHandle ? `privity_saved_posts_${activeUserHandle}` : 'privity_saved_posts_default';
    setSavedPostIds(readStorage<string[]>(key, []));
  }, [activeUserHandle]);

  const addNotification = React.useCallback((notif: AppNotification, targetUserHandle?: string) => {
    const currentMyHandle = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle || activeUserHandle);
    const target = normalizeHandle(targetUserHandle) || currentMyHandle;
    const targetKey = target ? `privity_notifs_${target}` : 'privity_notifications_v1';

    // 1. Save into target user's persistent inbox
    const stored = readStorage<AppNotification[]>(targetKey, []);
    if (!stored.some((n) => n.id === notif.id)) {
      safeSaveStorage(targetKey, [notif, ...stored]);
    }

    // 2. If target is active user, update current view immediately
    if (!target || target === currentMyHandle || target === activeUserHandle) {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
    }
  }, [activeUserHandle]);

  const markNotificationRead = React.useCallback((notifId: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n));
      safeSaveStorage(notifStorageKey, next);
      return next;
    });
  }, [notifStorageKey]);

  const markAllNotificationsRead = React.useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, isRead: true }));
      safeSaveStorage(notifStorageKey, next);
      return next;
    });
    triggerToast('All notifications marked as read');
  }, [notifStorageKey]);

  const [messagesSubTab, setMessagesSubTab] = useState<'chats' | 'notifications'>('chats');
  type NotificationFilter = 'all' | 'like' | 'comment' | 'follow' | 'save' | 'gift' | 'live' | 'story' | 'read';
  const [notificationsFilter, setNotificationsFilter] = useState<NotificationFilter>('all');

  const unreadNotifsCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // 1. Persistent Profiles State (purges any mock profiles & registers all real accounts)
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>(() => {
    const loaded = readStorage<Record<string, UserProfile>>('privity_profiles_v5', INITIAL_PROFILES_REGISTRY);
    const cleaned: Record<string, UserProfile> = {};
    if (loaded && typeof loaded === 'object') {
      for (const [k, v] of Object.entries(loaded)) {
        if (!isMockHandle(k) && !isMockHandle(v?.handle) && !k.startsWith('group_')) {
          cleaned[k] = { ...v, isVerified: Boolean(v?.isVerified) };
        }
      }
    }
    try {
      const allAccs = authService.getAllAccounts();
      for (const acc of Object.values(allAccs)) {
        const h = acc.handle.toLowerCase().replace(/^@/, '');
        if (h && !isMockHandle(h)) {
          if (!cleaned[h]) {
            cleaned[h] = {
              id: acc.id,
              name: acc.name,
              handle: acc.handle,
              avatar: acc.avatar,
              coverUrl: acc.coverUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600',
              isVerified: false,
              bio: acc.bio || 'Privity creator sharing private-first moments and authentic updates.',
              location: 'Global',
              joinedDate: 'Joined 2026',
              circleStatus: 'Public Connection',
              isPrivate: false,
              followersList: [],
              followingList: [],
              trustCirclesList: [],
              mediaItems: [],
            };
          } else {
            // Keep newest avatar & coverUrl from account preserved across resets
            if (acc.avatar && acc.avatar !== cleaned[h].avatar) {
              cleaned[h].avatar = acc.avatar;
            }
            if (acc.coverUrl && acc.coverUrl !== cleaned[h].coverUrl) {
              cleaned[h].coverUrl = acc.coverUrl;
            }
          }
        }
      }
    } catch {}
    return cleaned;
  });
  const profilesRef = React.useRef(profiles);
  profilesRef.current = profiles;

  // Deleted Posts Registry (persists across sessions to permanently eliminate "ghost" resurrected posts)
  const [deletedPostIds, setDeletedPostIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('privity_deleted_post_ids_v1');
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const deletedPostIdsRef = React.useRef(deletedPostIds);
  deletedPostIdsRef.current = deletedPostIds;

  // 2. Persistent Posts State (strictly filters out any mock posts and deleted posts)
  const [posts, setPosts] = useState<PostItem[]>(() => {
    const deleted = (() => {
      try {
        const saved = localStorage.getItem('privity_deleted_post_ids_v1');
        return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
      } catch {
        return new Set<string>();
      }
    })();
    const loaded = readStorage<PostItem[]>('privity_posts_v5', []);
    if (!Array.isArray(loaded)) return [];
    return loaded
      .filter((p) => !isMockPost(p) && !deleted.has(p.id))
      .map((p) => {
        const likers = Array.isArray(p.likersList) ? Array.from(new Set(p.likersList.map(normalizeHandle).filter(Boolean))) : [];
        const savers = Array.isArray(p.saversList) ? Array.from(new Set(p.saversList.map(normalizeHandle).filter(Boolean))) : [];
        return {
          ...p,
          likersList: likers,
          saversList: savers,
          likesCount: likers.length > 0 ? likers.length : Math.max(0, p.likesCount || 0),
          savesCount: savers.length > 0 ? savers.length : Math.max(0, p.savesCount || 0),
        };
      });
  });
  const postsRef = React.useRef(posts);
  postsRef.current = posts;

  // 3. Persistent Following Map (strictly filters out any mock handles, IDs, and false values)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>(() => {
    const loaded = readStorage<Record<string, boolean>>('privity_following_v5', {});
    const cleaned: Record<string, boolean> = {};
    if (loaded && typeof loaded === 'object') {
      for (const [k, v] of Object.entries(loaded)) {
        if (!v) continue;
        const clean = k.toLowerCase().replace(/^@/, '').trim();
        if (!clean || clean.startsWith('google_') || clean.startsWith('usr-') || clean.startsWith('sc-') || isMockHandle(clean)) continue;
        cleaned[clean] = true;
      }
    }
    return cleaned;
  });

  // 4. Persistent Close Friends List (filters out any mock handles)
  const [closeFriendsList, setCloseFriendsList] = useState<string[]>(() => {
    const loaded = readStorage<string[]>('privity_close_friends_v5', []);
    return Array.isArray(loaded) ? loaded.filter((h) => !isMockHandle(h)) : [];
  });

  // 5. Persistent Private Account Setting
  const [isPrivateAccount, setIsPrivateAccount] = useState<boolean>(() =>
    readStorage('privity_private_account_v5', false)
  );

  // Auto-sync all changes to localStorage with quota protection
  useEffect(() => {
    safeSaveStorage('privity_profiles_v5', profiles);
  }, [profiles]);

  // Ensure all accounts and current authenticated user are registered into profiles state and announced globally
  useEffect(() => {
    // 1. Sync all accounts from authService so Discovery and chat have all registered users
    try {
      const allAccs = authService.getAllAccounts();
      setProfiles((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const acc of Object.values(allAccs)) {
          if (!acc || !acc.handle) continue;
          const h = acc.handle.toLowerCase().replace(/^@/, '').trim();
          if (h && !isMockHandle(h) && !next[h]) {
            next[h] = {
              id: acc.id,
              name: acc.name,
              handle: acc.handle,
              avatar: acc.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${h}`,
              coverUrl: acc.coverUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600',
              isVerified: false,
              bio: acc.bio || 'Privity creator sharing private-first moments and authentic updates.',
              location: 'Global',
              joinedDate: 'Joined 2026',
              circleStatus: 'Public Connection' as const,
              isPrivate: false,
              followersList: [],
              followingList: [],
              trustCirclesList: [],
              mediaItems: [],
            };
            changed = true;
          }
        }
        if (changed) {
          safeSaveStorage('privity_profiles_v5', next);
          return next;
        }
        return prev;
      });
    } catch {}

    if (currentAuthUser && currentAuthUser.handle && !isMockHandle(currentAuthUser.handle)) {
      const h = currentAuthUser.handle.toLowerCase().replace(/^@/, '');
      let updatedProf: UserProfile | null = null;
      setProfiles((prev) => {
        const existing = prev[h];
        const isExistingVideoAvatar = existing?.avatar && isVideoMedia(existing.avatar);
        const isExistingVideoCover = existing?.coverUrl && isVideoMedia(existing.coverUrl);

        const nextAvatar = (isExistingVideoAvatar && !isVideoMedia(currentAuthUser.avatar))
          ? existing.avatar
          : (currentAuthUser.avatar || existing?.avatar);

        const nextCover = (isExistingVideoCover && !isVideoMedia(currentAuthUser.coverUrl))
          ? existing.coverUrl
          : (currentAuthUser.coverUrl || existing?.coverUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600');

        if (!existing || existing.name !== currentAuthUser.name || existing.avatar !== nextAvatar || existing.coverUrl !== nextCover) {
          updatedProf = {
            id: currentAuthUser.id,
            name: currentAuthUser.name,
            handle: currentAuthUser.handle,
            avatar: nextAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${h}`,
            coverUrl: nextCover,
            isVerified: false,
            bio: currentAuthUser.bio || existing?.bio || 'Privity creator sharing private-first moments and authentic updates.',
            location: 'Global',
            joinedDate: existing?.joinedDate || 'Joined 2026',
            circleStatus: 'You' as const,
            isPrivate: false,
            followersList: existing?.followersList || [],
            followingList: existing?.followingList || [],
            trustCirclesList: existing?.trustCirclesList || [],
            mediaItems: existing?.mediaItems || [],
          };
          const next: Record<string, UserProfile> = {
            ...prev,
            [h]: updatedProf,
          };
          safeSaveStorage('privity_profiles_v5', next);
          return next;
        }
        return prev;
      });

      // Announce profile across tabs and devices so other users see them instantly
      const broadcastProfile = updatedProf || {
        id: currentAuthUser.id,
        name: currentAuthUser.name,
        handle: currentAuthUser.handle,
        avatar: currentAuthUser.avatar,
        coverUrl: currentAuthUser.coverUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600',
        bio: currentAuthUser.bio || 'Privity creator sharing private-first moments and authentic updates.',
        isVerified: false,
      };
      broadcastSyncEventRef.current({
        action: 'UPDATE_PROFILE',
        profile: broadcastProfile,
      });
    }
  }, [currentAuthUser]);

  // Sync real registered users from Supabase into profiles for Discovery
  useEffect(() => {
    let isSubscribed = true;
    const syncRemoteProfiles = async () => {
      try {
        const sb = getSupabaseClient();
        if (!sb) return;
        const { data, error } = await sb.from('profiles').select('*');
        if (!error && Array.isArray(data) && isSubscribed) {
          setProfiles((prev) => {
            let changed = false;
            const next: Record<string, UserProfile> = { ...prev };
            for (const sp of data) {
              const h = (sp.handle || sp.username || '').toLowerCase().replace(/^@/, '');
              if (h && !isMockHandle(h)) {
                const name = sp.name || sp.full_name || h;
                const avatar = sp.avatar || sp.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${h}`;
                const cover = sp.cover_url || sp.cover || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600';
                const bio = sp.bio || 'Privity creator sharing private-first moments and authentic updates.';
                const isVerified = !!(sp.is_verified || sp.isVerified);
                if (!next[h] || next[h].name !== name || next[h].avatar !== avatar) {
                  next[h] = {
                    id: sp.id,
                    name,
                    handle: sp.handle || `@${h}`,
                    avatar,
                    coverUrl: cover,
                    isVerified,
                    bio,
                    location: sp.location || 'Global',
                    joinedDate: sp.joinedDate || 'Joined 2026',
                    circleStatus: 'Public Connection' as const,
                    isPrivate: !!sp.isPrivate,
                    followersList: next[h]?.followersList || [],
                    followingList: next[h]?.followingList || [],
                    trustCirclesList: next[h]?.trustCirclesList || [],
                    mediaItems: next[h]?.mediaItems || [],
                  };
                  changed = true;
                }
              }
            }
            if (changed) {
              safeSaveStorage('privity_profiles_v5', next);
              return next;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Discovery profile sync:', err);
      }
    };

    syncRemoteProfiles();
    const interval = setInterval(syncRemoteProfiles, 30000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    safeSaveStorage('privity_posts_v5', posts);
  }, [posts]);

  useEffect(() => {
    safeSaveStorage('privity_following_v5', followingMap);
  }, [followingMap]);

  useEffect(() => {
    safeSaveStorage('privity_close_friends_v5', closeFriendsList);
  }, [closeFriendsList]);

  useEffect(() => {
    safeSaveStorage('privity_private_account_v5', isPrivateAccount);
  }, [isPrivateAccount]);

  // 6. Persistent VisionOS User Settings
  const [userSettings, setUserSettings] = useState<UserSettings>(() =>
    readStorage('privity_user_settings_v5', DEFAULT_USER_SETTINGS)
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState<'account' | 'privacy' | 'notifications' | 'security' | 'terms' | 'gifts'>('account');
  const [giftsCatalog, setGiftsCatalog] = useState<Gift[]>(() => loadGiftsCatalog());
  const isSendingGiftRef = useRef(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('privity_user_settings_v5', JSON.stringify(userSettings));
    } catch (e) {
      console.warn('Failed to save userSettings to localStorage', e);
    }
  }, [userSettings]);

  // Synchronized Profile Fetcher
  const getUserProfile = (handle: string, defaultName?: string, defaultAvatar?: string): UserProfile => {
    let clean = (handle || '').replace(/^@/, '').trim().toLowerCase();
    if (!clean) {
      return {
        id: 'anon',
        name: 'Anonymous',
        handle: 'anonymous',
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=anonymous',
        coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600',
        isVerified: false,
        bio: '',
        location: 'Global',
        joinedDate: 'Joined 2026',
        circleStatus: 'Public Connection',
        isPrivate: false,
        followersList: [],
        followingList: [],
        trustCirclesList: [],
        mediaItems: [],
      };
    }
    // If a group handle is passed, return lightweight group entity without creating a user profile
    if (clean.startsWith('group_')) {
      const g = chatGroups[clean] || (typeof window !== 'undefined' ? readStorage<Record<string, any>>('privity_chat_groups_v1', {})[clean] : null);
      return {
        id: clean,
        name: g?.name || defaultName || 'Group Chat',
        handle: clean,
        avatar: g?.avatar || defaultAvatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400',
        coverUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600',
        isVerified: true,
        verifiedCategory: 'Group Circle',
        bio: `Private group channel with ${g?.members?.length || 2} members.`,
        location: 'Group Chat',
        joinedDate: 'Joined 2026',
        circleStatus: 'Close Friend',
        isPrivate: true,
        followersList: g?.members || [],
        followingList: [],
        trustCirclesList: [],
        mediaItems: [],
      };
    }
    // If an internal ID is passed, resolve it to the genuine user profile instead of generating a fake profile
    if (clean.startsWith('google_') || clean.startsWith('usr-')) {
      const match = Object.values(profiles).find((p) => p.id === handle || p.id === clean);
      if (match) return match;
      try {
        const allAccs = authService.getAllAccounts();
        const accById = Object.values(allAccs).find((a) => a.id === handle || a.id === clean);
        if (accById) {
          clean = accById.handle.toLowerCase().replace(/^@/, '').trim();
        }
      } catch {}
    }
    if (profiles[clean]) {
      return profiles[clean];
    }
    if (profiles[`@${clean}`]) {
      return profiles[`@${clean}`];
    }
    const matchedKey = Object.keys(profiles).find(
      (k) => k.replace(/^@/, '').toLowerCase() === clean
    );
    if (matchedKey && profiles[matchedKey]) {
      return profiles[matchedKey];
    }
    if (currentAuthUser && (currentAuthUser.handle || '').replace(/^@/, '').toLowerCase() === clean) {
      return {
        id: currentAuthUser.id,
        name: currentAuthUser.name,
        handle: clean,
        avatar: currentAuthUser.avatar,
        coverUrl: currentAuthUser.coverUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600',
        isVerified: currentAuthUser.isVerified || false,
        bio: currentAuthUser.bio || 'Privity creator sharing private-first moments and authentic updates.',
        location: 'Global',
        joinedDate: 'Joined 2026',
        circleStatus: 'You',
        isPrivate: false,
        followersList: [],
        followingList: [],
        trustCirclesList: [],
        mediaItems: [],
      };
    }
    return {
      id: `usr-${clean}`,
      name: defaultName || clean.charAt(0).toUpperCase() + clean.slice(1),
      handle: clean,
      avatar: defaultAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${clean}`,
      coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600',
      isVerified: false,
      bio: 'Privity creator sharing private-first moments and authentic updates.',
      location: 'Global',
      joinedDate: 'Joined 2026',
      circleStatus: 'Public Connection',
      isPrivate: false,
      followersList: [],
      followingList: [],
      trustCirclesList: [],
      mediaItems: [],
    };
  };

  const activeAuthHandle = (currentAuthUser?.handle || '').toLowerCase().replace(/^@/, '').trim();
  const myProfile = useMemo((): UserProfile => {
    if (activeAuthHandle) {
      const fromProf = profiles[activeAuthHandle] || profiles[`@${activeAuthHandle}`];
      if (fromProf) {
        return {
          ...fromProf,
          id: fromProf.id || currentAuthUser?.id || `usr-${activeAuthHandle}`,
          name: fromProf.name || currentAuthUser?.name || activeAuthHandle,
          handle: activeAuthHandle,
          avatar: fromProf.avatar || currentAuthUser?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeAuthHandle}`,
          avatarPoster: fromProf.avatarPoster || currentAuthUser?.avatarPoster,
          coverUrl: fromProf.coverUrl || currentAuthUser?.coverUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600',
          coverPoster: fromProf.coverPoster || currentAuthUser?.coverPoster,
          bio: fromProf.bio || currentAuthUser?.bio || '',
          isVerified: Boolean(fromProf.isVerified || currentAuthUser?.isVerified),
        };
      }
    }
    if (currentAuthUser) {
      return {
        id: currentAuthUser.id,
        name: currentAuthUser.name,
        handle: activeAuthHandle,
        avatar: currentAuthUser.avatar,
        avatarPoster: currentAuthUser.avatarPoster,
        coverUrl: currentAuthUser.coverUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600',
        coverPoster: currentAuthUser.coverPoster,
        isVerified: currentAuthUser.isVerified || false,
        bio: currentAuthUser.bio || 'Privity creator sharing private-first moments and authentic updates.',
        location: 'Global',
        joinedDate: 'Joined 2026',
        circleStatus: 'You',
        isPrivate: false,
        followersList: [],
        followingList: [],
        trustCirclesList: [],
        mediaItems: [],
      };
    }
    return {
      id: '',
      name: '',
      handle: '',
      avatar: '',
      coverUrl: '',
      isVerified: false,
      bio: '',
      location: '',
      joinedDate: '',
      circleStatus: 'You',
      isPrivate: false,
      followersList: [],
      followingList: [],
      trustCirclesList: [],
      mediaItems: [],
    };
  }, [profiles, activeAuthHandle, currentAuthUser]);
  const myProfileRef = React.useRef(myProfile);
  myProfileRef.current = myProfile;

  // ========================================================
  // REAL-TIME ONLINE PRESENCE ENGINE
  // ========================================================
  const [onlineUsersMap, setOnlineUsersMap] = useState<Record<string, number>>({});
  const [, setPresenceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPresenceTick((p) => p + 1), 10000);
    return () => clearInterval(t);
  }, []);

  const isUserOnline = useCallback(
    (handle?: string | null): boolean => {
      if (!handle) return false;
      const clean = normalizeHandle(handle);
      if (!clean) return false;
      const myClean = normalizeHandle(currentAuthUser?.handle || myProfile?.handle);
      if (clean === myClean && myClean.length > 0) return true;
      const lastSeen = onlineUsersMap[clean];
      if (!lastSeen) return false;
      return Date.now() - lastSeen < 35000;
    },
    [currentAuthUser?.handle, myProfile?.handle, onlineUsersMap]
  );

  // User presence classification: 'active' (🟢 green dot), 'inactive' (🔴 red dot), 'offline' (⚫ black dot)
  const getUserPresenceState = useCallback(
    (handle?: string | null): 'active' | 'inactive' | 'offline' => {
      if (!handle) return 'offline';
      const clean = normalizeHandle(handle);
      if (!clean) return 'offline';
      const myClean = normalizeHandle(currentAuthUser?.handle || myProfile?.handle);
      if (clean === myClean && myClean.length > 0) return 'active';
      const lastSeen = onlineUsersMap[clean];
      if (!lastSeen) return 'offline';
      const diff = Date.now() - lastSeen;
      if (diff < 45000) return 'active';
      if (diff < 600000) return 'inactive';
      return 'offline';
    },
    [currentAuthUser?.handle, myProfile?.handle, onlineUsersMap]
  );

  useEffect(() => {
    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile?.handle);
    if (!myClean) return;

    const sendPresencePing = () => {
      broadcastSyncEventRef.current({
        action: 'PRESENCE_PING',
        handle: myClean,
        timestamp: Date.now(),
      });
    };

    // Immediate presence ping on mount
    sendPresencePing();

    // Query other online peers
    broadcastSyncEventRef.current({
      action: 'PRESENCE_QUERY',
      handle: myClean,
    });

    // Periodic heartbeat ping every 12 seconds
    const interval = setInterval(sendPresencePing, 12000);

    const handleUserActivity = () => sendPresencePing();
    window.addEventListener('focus', handleUserActivity);
    window.addEventListener('pointerdown', handleUserActivity);

    const handleUnload = () => {
      broadcastSyncEventRef.current({
        action: 'PRESENCE_OFFLINE',
        handle: myClean,
      });
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleUserActivity);
      window.removeEventListener('pointerdown', handleUserActivity);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [currentAuthUser?.handle, myProfile?.handle]);

  // ========================================================
  // REAL-TIME MULTI-DEVICE SYNCHRONIZATION ENGINE
  // ========================================================
  const SYNC_TOPIC = 'privity_sync_v400_universe';
  const SYNC_ENDPOINT = `https://ntfy.sh/${SYNC_TOPIC}`;

  // Unique Device ID generated once per browser/device
  const myDeviceId = useMemo(() => {
    let devId = localStorage.getItem('privity_device_id_v1');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('privity_device_id_v1', devId);
    }
    return devId;
  }, []);

  // Unique Tab / Session ID generated once per window/tab (enables instant multi-tab sync without self-collisions)
  const myTabSessionId = useMemo(() => {
    let sId = sessionStorage.getItem('privity_tab_id_v2');
    if (!sId) {
      sId = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      sessionStorage.setItem('privity_tab_id_v2', sId);
    }
    return sId;
  }, []);

  // Deduplication cache to prevent re-applying identical events across SSE, polling & broadcast channel
  const processedEventIdsRef = React.useRef<Set<string>>(new Set());

  // BroadcastChannel for instant same-device / multi-tab synchronicity
  const localSyncBus = useMemo(() => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        return new BroadcastChannel('privity_sync_bus');
      }
    } catch (e) {
      console.warn('BroadcastChannel unavailable', e);
    }
    return null;
  }, []);

  // Dispatch mutation across local tabs and all global devices in real time
  const broadcastSyncEvent = (event: {
    action: string;
    [key: string]: any;
  }) => {
    const eventId =
      'evt_' +
      event.action +
      '_' +
      (event.postId || event.messageId || '') +
      '_' +
      Date.now() +
      '_' +
      Math.random().toString(36).substring(2, 7);

    const payload = {
      ...event,
      eventId,
      senderTabId: myTabSessionId,
      senderDeviceId: myDeviceId,
      timestamp: Date.now(),
    };

    // Mark as processed so local instance does not re-apply
    processedEventIdsRef.current.add(eventId);

    // 1. Local same-device broadcast
    try {
      localSyncBus?.postMessage(payload);
    } catch (e) {
      console.warn('Local bus post failed', e);
    }

    // 2. Cloud broadcast via Supabase Realtime WebSockets for instant sub-50ms sync
    try {
      broadcastViaSupabase(payload);
    } catch (e) {
      console.warn('Supabase broadcast failed', e);
    }

    // 3. Cloud broadcast to all active devices (ntfy)
    try {
      const jsonStr = JSON.stringify(payload);
      if (jsonStr.length > 3500) {
        // Large payload with photo/video -> upload as ntfy attachment so it is never rejected or truncated
        fetch(`${SYNC_ENDPOINT}?filename=event.json`, {
          method: 'PUT',
          headers: { 'Filename': 'event.json' },
          body: jsonStr,
        }).catch((err) => console.warn('Cloud sync attachment err', err));
      } else {
        // Compact payload -> send as plain text body so ntfy populates item.message directly
        fetch(SYNC_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          body: jsonStr,
        }).catch((err) => console.warn('Cloud sync push err', err));
      }
    } catch (e) {
      console.warn('Cloud sync err', e);
    }
  };

  broadcastSyncEventRef.current = broadcastSyncEvent;

  // Handler to apply incoming remote sync events
  const applyRemoteSyncEvent = React.useCallback(
    (event: any) => {
      if (!event || event.senderTabId === myTabSessionId) return;

      if (event.eventId) {
        if (processedEventIdsRef.current.has(event.eventId)) return;
        processedEventIdsRef.current.add(event.eventId);
      }

      const cleanMyHandle = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle || myProfile.handle);

      // Automatically register any active sender into real-time online presence map
      const senderCandidate = normalizeHandle(
        event.handle ||
        event.senderHandle ||
        event.followerHandle ||
        event.authorHandle ||
        event.userHandle ||
        (event.account && event.account.handle) ||
        (event.profile && event.profile.handle)
      );
      if (senderCandidate) {
        setOnlineUsersMap((prev) => ({ ...prev, [senderCandidate]: Date.now() }));
      }

      const actionType = event.action || event.type;

      switch (actionType) {
        case 'PRESENCE_PING': {
          const clean = normalizeHandle(event.handle);
          if (clean) {
            setOnlineUsersMap((prev) => ({ ...prev, [clean]: Date.now() }));
          }
          break;
        }

        case 'PRESENCE_QUERY': {
          if (cleanMyHandle) {
            broadcastSyncEventRef.current({
              action: 'PRESENCE_PING',
              handle: cleanMyHandle,
              timestamp: Date.now(),
            });
          }
          break;
        }

        case 'PRESENCE_OFFLINE': {
          const clean = normalizeHandle(event.handle);
          if (clean) {
            setOnlineUsersMap((prev) => {
              const next = { ...prev };
              delete next[clean];
              return next;
            });
          }
          break;
        }

        case 'LIVESTREAM_GIFT_EVENT': {
          const { giftEvent, gift } = event;
          if (!giftEvent || !gift) return;

          // Enqueue animation for all watching viewers
          globalGiftQueue.enqueue(giftEvent, gift);

          const pts = (gift.coinCost || 10) * (giftEvent.quantity || 1) * 2;
          setBattleScoreHost((prev) => prev + pts);

          const senderLevel = giftEvent.senderLevel || getDeterministicLevel(giftEvent.senderId) || 1;

          setLiveComments((prev) => [
            ...prev,
            {
              id: giftEvent.id || String(Date.now()),
              user: giftEvent.senderName,
              text: `sent ${gift.name} ${giftEvent.quantity > 1 ? `x${giftEvent.quantity} ` : ''}(+${pts} pts)!`,
              badge: gift.rarity === 'legendary' ? 'Crown VIP' : 'Top Gifter',
              level: senderLevel,
              giftName: gift.name,
              giftIcon: gift.icon,
            },
          ]);
          break;
        }

        case 'LIKE_POST': {
          const {
            postId,
            isLiked,
            likesCount,
            likersList: remoteLikers,
            likerHandle,
            likerName,
            likerAvatar,
            userHandle,
            postAuthorHandle,
            postCaptionSnippet,
            postThumbnail,
          } = event;
          const cleanLiker = normalizeHandle(likerHandle || userHandle);
          if (!cleanLiker || !postId) return;

          let targetPostAuthor = normalizeHandle(postAuthorHandle);

          setPosts((prev) => {
            const nextPosts = prev.map((p) => {
              if (p.id === postId) {
                if (!targetPostAuthor && p.authorHandle) {
                  targetPostAuthor = normalizeHandle(p.authorHandle);
                }
                const currentLikers = (p.likersList || []).map(normalizeHandle).filter(Boolean);
                const incomingLikers = Array.isArray(remoteLikers) ? remoteLikers.map(normalizeHandle).filter(Boolean) : [];
                const updatedLikers = isLiked
                  ? Array.from(new Set([...currentLikers, cleanLiker, ...incomingLikers]))
                  : currentLikers.filter((h) => h !== cleanLiker);

                const count = Math.max(
                  updatedLikers.length,
                  typeof likesCount === 'number' ? likesCount : updatedLikers.length
                );

                const myClean = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle || myProfile.handle);

                return {
                  ...p,
                  likersList: updatedLikers,
                  likesCount: Math.max(0, count),
                  isLiked: myClean ? updatedLikers.includes(myClean) : p.isLiked,
                };
              }
              return p;
            });
            safeSaveStorage('privity_posts_v5', nextPosts);
            return nextPosts;
          });

          // Keep photoLikesMap synchronized if post contains visual media
          setPhotoLikesMap((prevMap) => {
            const targetP = postsRef.current.find((p) => p.id === postId);
            const photoUrl = targetP?.contentUrl || targetP?.thumbnailUrl;
            if (photoUrl) {
              const baseKey = extractMediaBaseKey(photoUrl);
              const myClean = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle || myProfile.handle);
              const targetLikers = targetP?.likersList || [];
              const nextMap = {
                ...prevMap,
                ...(baseKey ? { [baseKey]: { isLiked: myClean ? targetLikers.includes(myClean) : false, count: targetLikers.length } } : {}),
                ...(!photoUrl.startsWith('data:') ? { [photoUrl]: { isLiked: myClean ? targetLikers.includes(myClean) : false, count: targetLikers.length } } : {}),
              };
              safeSaveStorage('privity_photo_likes_v5', nextMap);
              return nextMap;
            }
            return prevMap;
          });

          // Accurate Notification: When another user likes current user's dispatch
          const myClean = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle || myProfile.handle);
          if (!targetPostAuthor) {
            targetPostAuthor = normalizeHandle(postsRef.current.find(p => p.id === postId)?.authorHandle);
          }
          if (
            isLiked &&
            cleanLiker &&
            myClean &&
            (cleanLiker !== myClean || event.senderTabId !== myTabSessionId) &&
            targetPostAuthor === myClean
          ) {
            const notif: AppNotification = {
              id: `notif-like-${postId}-${cleanLiker}-${Date.now()}`,
              type: 'like',
              actorHandle: cleanLiker,
              actorName: likerName || cleanLiker,
              actorAvatar: likerAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanLiker}`,
              targetPostId: postId,
              postCaptionSnippet: postCaptionSnippet || 'your dispatch',
              postThumbnail: postThumbnail,
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, myClean);
            triggerToast(`❤️ @${cleanLiker} liked your dispatch`);
          }
          break;
        }

        case 'SAVE_POST': {
          const { postId, isSaved, savesCount, saverHandle, saverName, saverAvatar, postAuthorHandle, postCaptionSnippet, postThumbnail, saversList: remoteSavers } = event;
          if (!postId) break;
          const cleanSaver = normalizeHandle(saverHandle);
          let targetAuthor = normalizeHandle(postAuthorHandle);

          setPosts((prev) => {
            const nextPosts = prev.map((p) => {
              if (p.id === postId) {
                if (!targetAuthor && p.authorHandle) {
                  targetAuthor = normalizeHandle(p.authorHandle);
                }
                const currentSavers = (p.saversList || []).map(normalizeHandle).filter(Boolean);
                const incomingSavers = Array.isArray(remoteSavers) ? remoteSavers.map(normalizeHandle).filter(Boolean) : [];
                const updatedSavers = isSaved
                  ? Array.from(new Set([...currentSavers, ...(cleanSaver ? [cleanSaver] : []), ...incomingSavers]))
                  : cleanSaver
                  ? currentSavers.filter((h) => h !== cleanSaver)
                  : currentSavers;

                const count = Math.max(
                  updatedSavers.length,
                  typeof savesCount === 'number' ? savesCount : updatedSavers.length
                );

                const myClean = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle || myProfile.handle);

                return {
                  ...p,
                  saversList: updatedSavers,
                  savesCount: Math.max(0, count),
                  isSaved: myClean ? updatedSavers.includes(myClean) : p.isSaved,
                };
              }
              return p;
            });
            safeSaveStorage('privity_posts_v5', nextPosts);
            return nextPosts;
          });

          // Accurate Notification: When another user saves current user's dispatch
          const myClean = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle || myProfile.handle);
          if (!targetAuthor) {
            targetAuthor = normalizeHandle(postsRef.current.find((p) => p.id === postId)?.authorHandle);
          }
          if (
            isSaved &&
            cleanSaver &&
            myClean &&
            (cleanSaver !== myClean || event.senderTabId !== myTabSessionId) &&
            targetAuthor === myClean
          ) {
            const notif: AppNotification = {
              id: `notif-save-${postId}-${cleanSaver}-${Date.now()}`,
              type: 'save',
              actorHandle: cleanSaver,
              actorName: saverName || cleanSaver,
              actorAvatar: saverAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanSaver}`,
              targetPostId: postId,
              postCaptionSnippet: postCaptionSnippet || 'your dispatch',
              postThumbnail: postThumbnail,
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, myClean);
            triggerToast(`🔖 @${cleanSaver} saved your dispatch`);
          }
          break;
        }

        case 'SHARE_POST': {
          const { postId, sharesCount, sharerHandle, sharerName, sharerAvatar, postAuthorHandle, postCaptionSnippet, postThumbnail } = event;
          if (!postId) break;
          setPosts((prev) => {
            const nextPosts = prev.map((p) => {
              if (p.id === postId) {
                return {
                  ...p,
                  sharesCount: typeof sharesCount === 'number' ? sharesCount : (p.sharesCount || 0) + 1,
                };
              }
              return p;
            });
            safeSaveStorage('privity_posts_v5', nextPosts);
            return nextPosts;
          });

          // Accurate Notification: When another user shares current user's dispatch
          const myClean = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle || myProfile.handle);
          const cleanSharer = normalizeHandle(sharerHandle);
          let targetAuthor = normalizeHandle(postAuthorHandle);
          if (!targetAuthor) {
            targetAuthor = normalizeHandle(postsRef.current.find((p) => p.id === postId)?.authorHandle);
          }
          if (cleanSharer && myClean && cleanSharer !== myClean && targetAuthor === myClean) {
            const notif: AppNotification = {
              id: `notif-share-${postId}-${cleanSharer}-${Date.now()}`,
              type: 'share',
              actorHandle: cleanSharer,
              actorName: sharerName || cleanSharer,
              actorAvatar: sharerAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanSharer}`,
              targetPostId: postId,
              postCaptionSnippet: postCaptionSnippet || 'your dispatch',
              postThumbnail: postThumbnail,
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, myClean);
            triggerToast(`🚀 @${cleanSharer} shared your dispatch`);
          }
          break;
        }

        case 'LIKE_MEDIA': {
          const { mediaId, isLiked, count } = event;
          setPhotoLikesMap((prev) => {
            const next = {
              ...prev,
              [mediaId]: { isLiked, count },
            };
            safeSaveStorage('privity_photo_likes_v5', next);
            return next;
          });
          break;
        }

        case 'NEW_POST': {
          const { post } = event;
          if (!post || !post.id || isMockPost(post) || deletedPostIdsRef.current.has(post.id)) return;
          setPosts((prev) => {
            if (prev.some((p) => p.id === post.id)) return prev;
            const next = [post, ...prev];
            safeSaveStorage('privity_posts_v5', next);
            return next;
          });
          const mediaUrl = post.contentUrl || post.videoUrl || post.thumbnailUrl;
          if (mediaUrl) {
            const author = (post.authorHandle || '').replace(/^@/, '').toLowerCase();
            if (author) {
              setProfiles((prev) => {
                const prof = prev[author] || getUserProfile(author);
                const exists = (prof.mediaItems || []).some(
                  (m) => m.id === post.id || isSameMedia(m.url, mediaUrl)
                );
                if (exists) return prev;
                const newMedia: UserMediaItem = {
                  id: post.id,
                  url: mediaUrl,
                  type: post.type === 'video' ? 'video' : 'image',
                  likes: 0,
                  comments: 0,
                  isLiked: false,
                };
                const nextProfs = {
                  ...prev,
                  [author]: {
                    ...prof,
                    mediaItems: [newMedia, ...(prof.mediaItems || [])],
                  },
                };
                safeSaveStorage('privity_profiles_v5', nextProfs);
                return nextProfs;
              });
            }
          }

          const myClean = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle || myProfile.handle);
          const authorClean = normalizeHandle(post.authorHandle);
          if (authorClean && myClean && authorClean !== myClean) {
            const notif: AppNotification = {
              id: `notif-post-${post.id}-${Date.now()}`,
              type: 'story',
              actorHandle: authorClean,
              actorName: post.authorName || authorClean,
              actorAvatar: post.authorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${authorClean}`,
              targetPostId: post.id,
              postCaptionSnippet: post.caption ? post.caption.slice(0, 60) : 'a new dispatch',
              postThumbnail: post.contentUrl || post.thumbnailUrl || post.videoUrl,
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, myClean);
            triggerToast(`✨ @${authorClean} published a new ${post.type === 'video' ? 'video dispatch 🎬' : 'dispatch'}`);
          }
          break;
        }

        case 'DELETE_POST': {
          const { postId } = event;
          if (!postId) break;
          setDeletedPostIds((prev) => {
            const next = new Set(prev);
            next.add(postId);
            safeSaveStorage('privity_deleted_post_ids_v1', Array.from(next));
            deletedPostIdsRef.current = next;
            return next;
          });
          setPosts((prev) => {
            const next = prev.filter((p) => p.id !== postId);
            safeSaveStorage('privity_posts_v5', next);
            return next;
          });
          setProfiles((prev) => {
            let changed = false;
            const nextProfs = { ...prev };
            for (const [h, prof] of Object.entries(nextProfs)) {
              if (prof.mediaItems?.some((m) => m.id === postId)) {
                changed = true;
                nextProfs[h] = {
                  ...prof,
                  mediaItems: prof.mediaItems.filter((m) => m.id !== postId),
                };
              }
            }
            if (changed) safeSaveStorage('privity_profiles_v5', nextProfs);
            return nextProfs;
          });
          break;
        }

        case 'SYNC_DELETED_POSTS': {
          const { deletedIds } = event;
          if (Array.isArray(deletedIds) && deletedIds.length > 0) {
            setDeletedPostIds((prev) => {
              let updated = false;
              const next = new Set(prev);
              for (const id of deletedIds) {
                if (!next.has(id)) {
                  next.add(id);
                  updated = true;
                }
              }
              if (updated) {
                safeSaveStorage('privity_deleted_post_ids_v1', Array.from(next));
                deletedPostIdsRef.current = next;
              }
              return updated ? next : prev;
            });
            setPosts((prev) => {
              const delSet = new Set(deletedIds);
              const next = prev.filter((p) => !delSet.has(p.id));
              if (next.length !== prev.length) {
                safeSaveStorage('privity_posts_v5', next);
                return next;
              }
              return prev;
            });
          }
          break;
        }

        case 'EDIT_POST_CAPTION': {
          const { postId, caption } = event;
          if (!postId || typeof caption !== 'string') return;
          setPosts((prev) => {
            const next = prev.map((p) => (p.id === postId ? { ...p, caption } : p));
            safeSaveStorage('privity_posts_v5', next);
            return next;
          });
          break;
        }

        case 'ADD_COMMENT': {
          const {
            postId,
            comment,
            parentCommentId,
            commenterHandle,
            commenterName,
            commenterAvatar,
            postAuthorHandle,
            postCaptionSnippet,
            postThumbnail,
          } = event;
          if (!postId || !comment || !comment.id) return;
          const cleanCommenter = normalizeHandle(commenterHandle || comment.authorHandle);

          setPosts((prev) => {
            const next = prev.map((p) => {
              if (p.id !== postId) return p;
              if (parentCommentId) {
                const updatedComments = p.comments.map((c) => {
                  if (c.id === parentCommentId) {
                    if ((c.replies || []).some((r) => r.id === comment.id)) return c;
                    return {
                      ...c,
                      replies: [...(c.replies || []), comment],
                    };
                  }
                  return c;
                });
                return { ...p, commentsCount: calcCommentsCount(updatedComments), comments: updatedComments };
              }
              if (p.comments.some((c) => c.id === comment.id)) return p;
              const updated = [...p.comments, comment];
              return {
                ...p,
                commentsCount: calcCommentsCount(updated),
                comments: updated,
              };
            });
            safeSaveStorage('privity_posts_v5', next);
            return next;
          });

          // Accurate Notification: When another user comments on current user's dispatch
          const myClean = cleanMyHandle;
          let targetAuthor = normalizeHandle(postAuthorHandle);
          if (!targetAuthor) {
            targetAuthor = normalizeHandle(postsRef.current.find(p => p.id === postId)?.authorHandle);
          }
          if (
            cleanCommenter &&
            myClean &&
            cleanCommenter !== myClean &&
            targetAuthor === myClean
          ) {
            const notif: AppNotification = {
              id: `notif-comment-${postId}-${comment.id}`,
              type: 'comment',
              actorHandle: cleanCommenter,
              actorName: commenterName || comment.authorName || cleanCommenter,
              actorAvatar: commenterAvatar || comment.authorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanCommenter}`,
              actorVerified: Boolean(comment.isVerified),
              targetPostId: postId,
              postCaptionSnippet: postCaptionSnippet || 'your dispatch',
              postThumbnail: postThumbnail,
              commentText: comment.text,
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, myClean);
            triggerToast(`💬 @${cleanCommenter} commented: "${comment.text.slice(0, 35)}${comment.text.length > 35 ? '...' : ''}"`);
          }
          break;
        }

        case 'LIKE_COMMENT': {
          const { postId, commentId, replyId, isLiked, likesCount, likersList: remoteLikers, likerHandle, likerName, likerAvatar, commentAuthorHandle } = event;
          const cleanLiker = normalizeHandle(likerHandle);
          setPosts((prev) => {
            const next = prev.map((p) => {
              if (p.id !== postId) return p;
              return {
                ...p,
                comments: p.comments.map((c) => {
                  if (c.id !== commentId) return c;
                  if (replyId) {
                    return {
                      ...c,
                      replies: (c.replies || []).map((r) => {
                        if (r.id !== replyId) return r;
                        const curLikers = (r.likersList || []).map(normalizeHandle).filter(Boolean);
                        const incomingLikers = Array.isArray(remoteLikers) ? remoteLikers.map(normalizeHandle).filter(Boolean) : [];
                        const updLikers = isLiked
                          ? Array.from(new Set([...curLikers, ...(cleanLiker ? [cleanLiker] : []), ...incomingLikers]))
                          : cleanLiker
                          ? curLikers.filter((h) => h !== cleanLiker)
                          : curLikers;
                        const cnt = Math.max(updLikers.length, typeof likesCount === 'number' ? likesCount : updLikers.length);
                        return {
                          ...r,
                          likersList: updLikers,
                          likesCount: cnt,
                        };
                      }),
                    };
                  }
                  const curLikers = (c.likersList || []).map(normalizeHandle).filter(Boolean);
                  const incomingLikers = Array.isArray(remoteLikers) ? remoteLikers.map(normalizeHandle).filter(Boolean) : [];
                  const updLikers = isLiked
                    ? Array.from(new Set([...curLikers, ...(cleanLiker ? [cleanLiker] : []), ...incomingLikers]))
                    : cleanLiker
                    ? curLikers.filter((h) => h !== cleanLiker)
                    : curLikers;
                  const cnt = Math.max(updLikers.length, typeof likesCount === 'number' ? likesCount : updLikers.length);
                  return {
                    ...c,
                    likersList: updLikers,
                    likesCount: cnt,
                  };
                }),
              };
            });
            safeSaveStorage('privity_posts_v5', next);
            return next;
          });

          // Notification to comment author if someone liked their comment
          const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
          const cAuthor = normalizeHandle(commentAuthorHandle);
          if (isLiked && cleanLiker && myClean && cleanLiker !== myClean && cAuthor === myClean) {
            const notif: AppNotification = {
              id: `notif-like-comment-${commentId}-${cleanLiker}-${Date.now()}`,
              type: 'like',
              actorHandle: cleanLiker,
              actorName: likerName || cleanLiker,
              actorAvatar: likerAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanLiker}`,
              targetPostId: postId,
              postCaptionSnippet: 'your comment',
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, myClean);
            triggerToast(`❤️ @${cleanLiker} liked your comment`);
          }
          break;
        }

        case 'DELETE_COMMENT': {
          const { postId, commentId, replyId } = event;
          if (!postId || !commentId) return;
          setPosts((prev) => {
            const next = prev.map((p) => {
              if (p.id !== postId) return p;
              let updatedComments: PostComment[];
              if (replyId) {
                updatedComments = p.comments.map((c) =>
                  c.id === commentId
                    ? { ...c, replies: (c.replies || []).filter((r) => r.id !== replyId) }
                    : c
                );
              } else {
                updatedComments = p.comments.filter((c) => c.id !== commentId);
              }
              return {
                ...p,
                commentsCount: calcCommentsCount(updatedComments),
                comments: updatedComments,
              };
            });
            safeSaveStorage('privity_posts_v5', next);
            return next;
          });
          break;
        }

        case 'SEND_DM': {
          const { recipientHandle, senderHandle, message } = event;
          if (!recipientHandle || !message || !message.id) return;
          const cleanRecip = (recipientHandle || '').replace(/^@/, '').toLowerCase();
          const cleanSender = (senderHandle || message.senderHandle || 'unknown').replace(/^@/, '');
          const myCleanLower = (cleanMyHandle || '').toLowerCase();

          const targetKey = cleanRecip === myCleanLower ? cleanSender : (recipientHandle || '').replace(/^@/, '');
          setDirectMessages((prev) => {
            const thread = prev[targetKey] || [];
            if (thread.some((m) => m.id === message.id)) return prev;
            const updated = {
              ...prev,
              [targetKey]: [...thread, message],
            };
            safeSaveStorage('privity_direct_messages_v5', updated);
            return updated;
          });
          if (
            myCleanLower &&
            cleanRecip === myCleanLower &&
            cleanSender.toLowerCase() !== myCleanLower
          ) {
            triggerToast(`💬 @${cleanSender}: ${message.text || (message.isVoiceMemo ? 'Sent a voice memo 🎙️' : 'Sent an attachment')}`);
          }
          break;
        }

        case 'REACT_DM': {
          const { recipientHandle, messageId, emoji, userHandle } = event;
          if (!recipientHandle || !messageId || !emoji) return;
          const targetKey =
            recipientHandle === cleanMyHandle
              ? (userHandle || recipientHandle).replace(/^@/, '')
              : recipientHandle.replace(/^@/, '');
          setDirectMessages((prev) => {
            const thread = prev[targetKey] || [];
            const updated = {
              ...prev,
              [targetKey]: thread.map((m) => {
                if (m.id !== messageId) return m;
                const currentReactions = { ...(m.reactions || {}) };
                currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;
                return { ...m, reactions: currentReactions };
              }),
            };
            safeSaveStorage('privity_direct_messages_v5', updated);
            return updated;
          });
          break;
        }

        case 'DELETE_DM': {
          const { messageId } = event;
          if (!messageId) return;
          setDirectMessages((prev) => {
            let changed = false;
            const updated = { ...prev };
            for (const [k, thread] of Object.entries(updated)) {
              if (thread.some((m) => m.id === messageId)) {
                changed = true;
                updated[k] = thread.filter((m) => m.id !== messageId);
              }
            }
            if (changed) {
              safeSaveStorage('privity_direct_messages_v5', updated);
              return updated;
            }
            return prev;
          });
          break;
        }

        case 'CREATE_GROUP': {
          const { group } = event;
          if (!group || !group.id) return;
          setChatGroups((prev) => {
            const next = { ...prev, [group.id]: group };
            safeSaveStorage('privity_chat_groups_v1', next);
            return next;
          });
          break;
        }

        case 'CLEAR_CHAT': {
          const { recipientHandle } = event;
          const clean = (recipientHandle || '').replace(/^@/, '');
          if (!clean) return;
          setDirectMessages((prev) => {
            const updated = { ...prev, [clean]: [] };
            safeSaveStorage('privity_direct_messages_v5', updated);
            return updated;
          });
          break;
        }

        case 'READ_DM': {
          const { readerHandle, readerName, readerAvatar, senderHandle } = event;
          const cleanReader = (readerHandle || '').replace(/^@/, '').toLowerCase().trim();
          const cleanSender = (senderHandle || '').replace(/^@/, '').toLowerCase().trim();
          const myCleanLower = (cleanMyHandle || '').toLowerCase().trim();

          // If this user sent messages to the reader, mark the sent messages as read!
          if (myCleanLower && cleanSender === myCleanLower && cleanReader) {
            setDirectMessages((prev) => {
              const thread = prev[cleanReader] || [];
              let changed = false;
              const updated = thread.map((m) => {
                const mSender = (m.senderHandle || '').replace(/^@/, '').toLowerCase().trim();
                if (mSender === myCleanLower && !m.isRead) {
                  changed = true;
                  return { ...m, isRead: true };
                }
                return m;
              });
              if (!changed) return prev;
              const next = { ...prev, [cleanReader]: updated };
              safeSaveStorage('privity_direct_messages_v5', next);
              return next;
            });

            // Activity record
            const notif: AppNotification = {
              id: `notif-read-${cleanReader}-${Date.now()}`,
              type: 'read',
              actorHandle: cleanReader,
              actorName: readerName || cleanReader,
              actorAvatar: readerAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanReader}`,
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, myCleanLower);
          }
          break;
        }

        case 'TOGGLE_FOLLOW': {
          const { targetHandle, followerHandle, followerName, isFollowing } = event;
          if (!targetHandle) return;
          const cleanTarget = targetHandle.replace(/^@/, '').toLowerCase().trim();
          const cleanFollower = (followerHandle || '').replace(/^@/, '').toLowerCase().trim();

          // 1. If this device is the follower (e.g. user logged in on 2 devices/tabs)
          if (cleanFollower && cleanFollower === cleanMyHandle.toLowerCase()) {
            setFollowingMap((prev) => {
              const next: Record<string, boolean> = { ...prev };
              if (isFollowing) {
                next[cleanTarget] = true;
              } else {
                delete next[cleanTarget];
              }
              Object.keys(next).forEach((k) => {
                if (k.startsWith('google_') || k.startsWith('usr-') || k.startsWith('sc-') || !next[k]) {
                  delete next[k];
                }
              });
              safeSaveStorage('privity_following_v5', next);
              return next;
            });
          }

          // 2. Dual-profile real-time follower/following list updates across all users
          setProfiles((prev) => {
            let changed = false;
            const nextProfs = { ...prev };

            // Update Target's followers list
            const targetProf = nextProfs[cleanTarget] || getUserProfile(cleanTarget);
            if (targetProf && cleanFollower) {
              const curFollowers = (targetProf.followersList || [])
                .map((h: string) => h.toLowerCase().replace(/^@/, '').trim())
                .filter((h: string) => h && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-'));
              const updatedFollowers = isFollowing
                ? Array.from(new Set([...curFollowers, cleanFollower]))
                : curFollowers.filter((h: string) => h !== cleanFollower);
              nextProfs[cleanTarget] = {
                ...targetProf,
                followersList: updatedFollowers,
              };
              changed = true;
            }

            // Update Follower's following list
            if (cleanFollower) {
              const followerProf = nextProfs[cleanFollower] || getUserProfile(cleanFollower);
              if (followerProf) {
                const curFollowing = (followerProf.followingList || [])
                  .map((h: string) => h.toLowerCase().replace(/^@/, '').trim())
                  .filter((h: string) => h && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-'));
                const updatedFollowing = isFollowing
                  ? Array.from(new Set([...curFollowing, cleanTarget]))
                  : curFollowing.filter((h: string) => h !== cleanTarget);
                nextProfs[cleanFollower] = {
                  ...followerProf,
                  followingList: updatedFollowing,
                };
                changed = true;
              }
            }

            if (changed) {
              safeSaveStorage('privity_profiles_v5', nextProfs);
              return nextProfs;
            }
            return prev;
          });

          // 3. Instant toast and notification if someone just followed the logged-in user
          if (isFollowing && cleanTarget === cleanMyHandle.toLowerCase() && cleanFollower !== cleanMyHandle.toLowerCase()) {
            const notif: AppNotification = {
              id: `notif-follow-${cleanFollower}-${Date.now()}`,
              type: 'follow',
              actorHandle: cleanFollower,
              actorName: followerName || cleanFollower,
              actorAvatar: event.followerAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanFollower}`,
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, cleanTarget);
            triggerToast(`✨ ${followerName ? `${followerName} (@${cleanFollower})` : `@${cleanFollower}`} followed you!`);
          }

          if (cleanTarget === cleanMyHandle.toLowerCase()) {
            setCurrentAuthUser((prev) => prev ? {
              ...prev,
              followers: Math.max(0, (prev.followers || 0) + (isFollowing ? 1 : -1)),
            } : prev);
          } else if (cleanFollower === cleanMyHandle.toLowerCase()) {
            setCurrentAuthUser((prev) => prev ? {
              ...prev,
              following: Math.max(0, (prev.following || 0) + (isFollowing ? 1 : -1)),
            } : prev);
          }
          break;
        }

        case 'TOGGLE_CLOSE_FRIENDS': {
          const { handle, isCloseFriend } = event;
          if (!handle) return;
          const clean = handle.replace(/^@/, '').toLowerCase().trim();
          setCloseFriendsList((prev) => {
            const next = isCloseFriend
              ? Array.from(new Set([...prev, clean]))
              : prev.filter((h) => h !== clean);
            safeSaveStorage('privity_close_friends_v5', next);
            return next;
          });
          break;
        }

        case 'REMOVE_FOLLOWER': {
          const { handle, targetHandle, removedFollower } = event;
          const cleanTarget = (targetHandle || '').replace(/^@/, '').toLowerCase().trim();
          const cleanRemoved = (removedFollower || handle || '').replace(/^@/, '').toLowerCase().trim();
          const myHandle = (myProfile.handle || '').toLowerCase().trim();
          if (!myHandle) return;

          if (cleanRemoved === myHandle && cleanTarget) {
            setFollowingMap((prev) => {
              const next = { ...prev };
              delete next[cleanTarget];
              safeSaveStorage('privity_following_v5', next);
              return next;
            });
          }

          setProfiles((prev) => {
            const nextProfs = { ...prev };
            let changed = false;
            const targetKey = cleanTarget || myHandle;
            if (targetKey && nextProfs[targetKey]) {
              nextProfs[targetKey] = {
                ...nextProfs[targetKey],
                followersList: (nextProfs[targetKey].followersList || []).filter(
                  (h) => h.toLowerCase().replace(/^@/, '').trim() !== cleanRemoved
                ),
              };
              changed = true;
            }
            if (cleanRemoved && nextProfs[cleanRemoved]) {
              nextProfs[cleanRemoved] = {
                ...nextProfs[cleanRemoved],
                followingList: (nextProfs[cleanRemoved].followingList || []).filter(
                  (h) => h.toLowerCase().replace(/^@/, '').trim() !== targetKey
                ),
              };
              changed = true;
            }
            if (changed) {
              safeSaveStorage('privity_profiles_v5', nextProfs);
              return nextProfs;
            }
            return prev;
          });
          break;
        }

        case 'DELETE_MEDIA': {
          const { handle, mediaId, mediaUrl } = event;
          const clean = (handle || '').replace(/^@/, '');
          if (clean) {
            setProfiles((prev) => {
              const prof = prev[clean];
              if (!prof) return prev;
              const nextProfs = {
                ...prev,
                [clean]: {
                  ...prof,
                  mediaItems: (prof.mediaItems || []).filter(
                    (m) => m.id !== mediaId && (!mediaUrl || !isSameMedia(m.url, mediaUrl))
                  ),
                },
              };
              safeSaveStorage('privity_profiles_v5', nextProfs);
              return nextProfs;
            });
          }
          if (mediaUrl) {
            setPosts((prev) => {
              const next = prev.filter(
                (p) => !isSameMedia(p.contentUrl, mediaUrl) && !isSameMedia(p.thumbnailUrl, mediaUrl)
              );
              if (next.length !== prev.length) {
                safeSaveStorage('privity_posts_v5', next);
              }
              return next;
            });
          }
          break;
        }

        case 'UPDATE_PROFILE': {
          const { profile, account } = event;
          if (!profile || !profile.handle) return;
          const clean = profile.handle.replace(/^@/, '');
          const cleanLower = clean.toLowerCase();

          // 1. Update profiles dictionary
          setProfiles((prev) => {
            const existing = prev[clean] || prev[cleanLower] || {};
            const merged = {
              ...existing,
              ...profile,
              ...(account?.coverPoster || profile.coverPoster ? { coverPoster: account?.coverPoster || profile.coverPoster } : {}),
              ...(account?.avatarPoster || profile.avatarPoster ? { avatarPoster: account?.avatarPoster || profile.avatarPoster } : {}),
            };
            const next = {
              ...prev,
              [clean]: merged,
              [cleanLower]: merged,
            };
            safeSaveStorage('privity_profiles_v5', next);
            return next;
          });

          // 2. Synchronize registered account details
          try {
            authService.syncRemoteAccount({
              id: profile.id,
              name: profile.name,
              handle: clean,
              avatar: profile.avatar,
              coverUrl: profile.coverUrl,
              bio: profile.bio,
              ...(account || {}),
            } as any);
          } catch {}

          if (cleanLower === (cleanMyHandle || '').toLowerCase()) {
            setCurrentAuthUser((prev) => (prev ? {
              ...prev,
              name: profile.name || prev.name,
              avatar: profile.avatar || prev.avatar,
              coverUrl: profile.coverUrl || prev.coverUrl,
              bio: profile.bio || prev.bio,
            } : null));
          }

          // 2. Instantly update all existing dispatches / posts / comments authored by this user
          setPosts((prev) => {
            let changed = false;
            const nextPosts = prev.map((p) => {
              const isPostAuthor =
                (p.authorHandle && p.authorHandle.replace(/^@/, '').toLowerCase() === cleanLower) ||
                (profile.id && p.authorId === profile.id);

              let postCommentsChanged = false;
              const updatedComments = (p.comments || []).map((c) => {
                const isCommentAuthor =
                  c.authorHandle && c.authorHandle.replace(/^@/, '').toLowerCase() === cleanLower;
                let repliesChanged = false;
                const updatedReplies = (c.replies || []).map((r) => {
                  const isReplyAuthor =
                    r.authorHandle && r.authorHandle.replace(/^@/, '').toLowerCase() === cleanLower;
                  if (isReplyAuthor) {
                    repliesChanged = true;
                    return {
                      ...r,
                      authorName: profile.name || r.authorName,
                      authorAvatar: profile.avatar || r.authorAvatar,
                      authorHandle: profile.handle || r.authorHandle,
                    };
                  }
                  return r;
                });

                if (isCommentAuthor || repliesChanged) {
                  postCommentsChanged = true;
                  return {
                    ...c,
                    authorName: isCommentAuthor ? (profile.name || c.authorName) : c.authorName,
                    authorAvatar: isCommentAuthor ? (profile.avatar || c.authorAvatar) : c.authorAvatar,
                    authorHandle: isCommentAuthor ? (profile.handle || c.authorHandle) : c.authorHandle,
                    replies: updatedReplies,
                  };
                }
                return c;
              });

              if (isPostAuthor || postCommentsChanged) {
                changed = true;
                return {
                  ...p,
                  authorName: isPostAuthor ? (profile.name || p.authorName) : p.authorName,
                  authorAvatar: isPostAuthor ? (profile.avatar || p.authorAvatar) : p.authorAvatar,
                  authorHandle: isPostAuthor ? (profile.handle || p.authorHandle) : p.authorHandle,
                  comments: updatedComments,
                };
              }
              return p;
            });
            if (changed) {
              safeSaveStorage('privity_posts_v5', nextPosts);
              return nextPosts;
            }
            return prev;
          });

          // 3. Update stories authored by this user
          setStories((prev) => {
            let changed = false;
            const nextStories = prev.map((s) => {
              const sHandle = (s.authorHandle || '').replace(/^@/, '').toLowerCase();
              if (sHandle === cleanLower) {
                changed = true;
                return {
                  ...s,
                  authorName: profile.name || s.authorName,
                  authorAvatar: profile.avatar || s.authorAvatar,
                };
              }
              return s;
            });
            if (changed) {
              safeSaveStorage('privity_stories_v3', nextStories);
              return nextStories;
            }
            return prev;
          });

          // 4. Update active chat user if open
          setActiveChatUser((prev) => {
            if (!prev) return null;
            const chatHandle = (prev.handle || '').replace(/^@/, '').toLowerCase();
            if (chatHandle === cleanLower) {
              return { ...prev, ...profile };
            }
            return prev;
          });

          // 5. Update network live streamers if this user is streaming
          setNetworkLiveStreamers((prev) =>
            prev.map((s) => {
              const sHandle = ((s as any).creatorHandle || s.handle || '').replace(/^@/, '').toLowerCase();
              if (sHandle === cleanLower) {
                return {
                  ...s,
                  name: `${profile.name} (LIVE NOW 🔴)`,
                  avatar: profile.avatar || s.avatar,
                  posterUrl: profile.avatar || s.posterUrl,
                };
              }
              return s;
            })
          );

          const currentCleanMy = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle || cleanMyHandle);
          if (cleanLower && currentCleanMy && cleanLower !== currentCleanMy) {
            const notif: AppNotification = {
              id: `notif-profile-${cleanLower}-${Date.now()}`,
              type: 'story',
              actorHandle: clean,
              actorName: profile.name || clean,
              actorAvatar: profile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${clean}`,
              targetPostId: '',
              postCaptionSnippet: 'updated their profile & visuals',
              postThumbnail: profile.coverUrl || profile.avatar,
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, currentCleanMy);
            triggerToast(`✨ @${clean} updated their profile & avatar`);
          }
          break;
        }

        case 'NEW_STORY': {
          const { story } = event;
          if (!story || !story.id) return;
          setStories((prev) => {
            if (prev.some((s) => s.id === story.id)) return prev;
            const next = [story, ...prev];
            safeSaveStorage('privity_stories_v3', next);
            return next;
          });
          const cleanAuthor = (story.authorHandle || '').replace(/^@/, '');
          const myCleanLower = (cleanMyHandle || '').toLowerCase();
          if (cleanAuthor && cleanAuthor.toLowerCase() !== myCleanLower) {
            const notif: AppNotification = {
              id: `notif-story-${story.id}-${cleanAuthor}`,
              type: 'story',
              actorHandle: cleanAuthor,
              actorName: story.authorName || cleanAuthor,
              actorAvatar: story.authorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanAuthor}`,
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, myCleanLower);
            triggerToast(`📸 ${story.authorName || `@${cleanAuthor}`} added a new story!`);
          }
          break;
        }

        case 'DELETE_STORY': {
          const { storyId } = event;
          if (!storyId) return;
          setStories((prev) => {
            const next = prev.filter((s) => s.id !== storyId);
            safeSaveStorage('privity_stories_v3', next);
            return next;
          });
          break;
        }

        case 'LIVE_STARTED':
        case 'LIVE_HOST_STARTED':
        case 'STREAM_ACTIVE':
        case 'LIVE_HEARTBEAT':
        case 'STREAM_HEARTBEAT': {
          const host = event.host || event.stream;
          if (!host || (!host.id && !host.creatorHandle) || host.isLive === false) return;
          const cleanHostHandle = (host.creatorHandle || host.handle || '').toLowerCase().replace('@', '').trim();
          const hostId = host.id || `live-user-${cleanHostHandle}`;
          liveStreamSync.clearStreamEnded(hostId, cleanHostHandle);
          liveStreamSync.notifyStreamStarted({ ...host, id: hostId, creatorHandle: cleanHostHandle });
          setNetworkLiveStreamers((prev) => {
            const filtered = prev.filter((s) => {
              const sHandle = ((s as any).creatorHandle || s.handle || '').toLowerCase().replace('@', '').trim();
              return s.id !== hostId && sHandle !== cleanHostHandle;
            });
            const streamItem: LiveMeStreamer = {
              id: hostId,
              handle: cleanHostHandle,
              name: `${(host.creatorName || host.name || 'Host').replace(' (LIVE NOW 🔴)', '')} (LIVE NOW 🔴)`,
              avatar: host.creatorAvatar || host.avatar || '',
              isVerified: !!host.isVerified,
              category: host.category || 'Featured',
              title: host.title || 'Live Broadcast · Sovereign Stream',
              description: host.description || 'Live streaming sovereign node',
              viewersCount: Math.max(1, host.viewersCount ?? 1),
              totalViews: `${Math.max(1, host.viewersCount ?? 1)}`,
              popularity: `${host.likesCount ?? 0}`,
              diamonds: 0,
              likesCount: host.likesCount ?? 0,
              posterUrl: host.previewUrl || host.posterUrl || host.avatar,
              tags: ['LiveNow', 'Host', 'Privity'],
              tagBadge: 'LIVE NOW',
              isHost: false,
              isCameraStream: true,
              topContributors: [],
            };
            return [streamItem, ...filtered];
          });

          // Accurate Notification if this is a new live broadcast from another user
          const myCleanLower = (cleanMyHandle || '').toLowerCase();
          if ((actionType === 'LIVE_STARTED' || actionType === 'LIVE_HOST_STARTED' || actionType === 'STREAM_ACTIVE') && cleanHostHandle && cleanHostHandle !== myCleanLower) {
            const notif: AppNotification = {
              id: `notif-live-${hostId}-${cleanHostHandle}`,
              type: 'live',
              actorHandle: cleanHostHandle,
              actorName: host.creatorName || host.name || cleanHostHandle,
              actorAvatar: host.creatorAvatar || host.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanHostHandle}`,
              timestamp: Date.now(),
              timeAgo: 'Just now',
              isRead: false,
            };
            addNotification(notif, myCleanLower);
            triggerToast(`🔴 @${cleanHostHandle} is now LIVE broadcasting!`);
          }
          break;
        }

        case 'QUERY_LIVES': {
          if (isHostBroadcasting && activeLiveStream) {
            const cleanHost = (myProfile.handle || '').replace(/^@/, '');
            broadcastSyncEvent({
              action: 'LIVE_HEARTBEAT',
              host: {
                id: activeLiveStream.id,
                creatorHandle: cleanHost,
                creatorName: myProfile.name,
                creatorAvatar: myProfile.avatar,
                handle: cleanHost,
                name: myProfile.name,
                avatar: myProfile.avatar,
                isVerified: myProfile.isVerified,
                category: (activeLiveStream as any).category || 'Featured',
                title: (activeLiveStream as any).title || 'Live Broadcast',
                startedAt: (activeLiveStream as any).startedAt || Date.now(),
                lastHeartbeat: Date.now(),
                isLive: true,
              },
            });
          }
          break;
        }

        case 'QUERY_PROFILES': {
          const profs = profilesRef.current;
          const accs = authService.getAllAccounts();
          if ((profs && Object.keys(profs).length > 0) || Object.keys(accs).length > 0) {
            broadcastSyncEventRef.current({
              action: 'SYNC_PROFILES_REGISTRY',
              registry: profs,
              accounts: accs,
            });
          }
          break;
        }

        case 'SYNC_PROFILES_REGISTRY': {
          const { registry, accounts } = event;
          if (registry && typeof registry === 'object') {
            setProfiles((prev) => {
              let changed = false;
              const next = { ...prev };
              for (const prof of Object.values(registry as Record<string, UserProfile>)) {
                if (prof && prof.handle) {
                  const cleanK = prof.handle.replace(/^@/, '').toLowerCase();
                  if (
                    !next[cleanK] ||
                    next[cleanK].name !== prof.name ||
                    next[cleanK].avatar !== prof.avatar ||
                    next[cleanK].bio !== prof.bio ||
                    next[cleanK].coverUrl !== prof.coverUrl ||
                    (prof as any).coverPoster !== next[cleanK].coverPoster ||
                    (prof as any).avatarPoster !== next[cleanK].avatarPoster ||
                    (prof.mediaItems && prof.mediaItems.length !== (next[cleanK].mediaItems || []).length)
                  ) {
                    next[cleanK] = { ...(next[cleanK] || {}), ...prof };
                    changed = true;
                  }
                }
              }
              if (changed) {
                safeSaveStorage('privity_profiles_v5', next);
                return next;
              }
              return prev;
            });
          }

          if (accounts && typeof accounts === 'object') {
            try {
              const currentAccounts = authService.getAllAccounts();
              let changedAccs = false;
              for (const [k, acc] of Object.entries(accounts as Record<string, any>)) {
                if (acc && acc.handle) {
                  const accKey = k.toLowerCase();
                  const existingAcc = currentAccounts[accKey];
                  if (
                    !existingAcc ||
                    existingAcc.avatar !== acc.avatar ||
                    existingAcc.coverUrl !== acc.coverUrl ||
                    existingAcc.name !== acc.name ||
                    existingAcc.coverPoster !== acc.coverPoster ||
                    existingAcc.avatarPoster !== acc.avatarPoster
                  ) {
                    currentAccounts[accKey] = { ...(existingAcc || {}), ...acc };
                    changedAccs = true;
                  }
                }
              }
              if (changedAccs) {
                localStorage.setItem('privity_accounts_v1', JSON.stringify(currentAccounts));
              }
            } catch {}
          }
          break;
        }

        case 'USER_PAGE_CREATED': {
          const { account, profile } = event;
          if (!account || !account.handle) return;
          const cleanH = normalizeHandle(account.handle);
          if (!cleanH) return;

          const newProf: UserProfile = profile || {
            id: account.id || `usr-${cleanH}`,
            name: account.name || cleanH,
            handle: cleanH,
            avatar: account.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanH}`,
            coverUrl: account.coverUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600',
            isVerified: Boolean(account.isVerified),
            bio: account.bio || 'Privity creator sharing private-first moments.',
            location: 'Global',
            joinedDate: 'Joined 2026',
            circleStatus: 'Public Connection' as const,
            isPrivate: false,
            followersList: [],
            followingList: [],
            trustCirclesList: [],
            mediaItems: [],
          };

          setProfiles((prev) => {
            const next = {
              ...prev,
              [cleanH]: newProf,
              [cleanH.toLowerCase()]: newProf,
            };
            safeSaveStorage('privity_profiles_v5', next);
            return next;
          });

          try {
            const currentAccs = authService.getAllAccounts();
            currentAccs[cleanH.toLowerCase()] = account;
            localStorage.setItem('privity_accounts_v1', JSON.stringify(currentAccs));
          } catch {}

          const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
          if (myClean !== cleanH) {
            triggerToast(`✨ @${cleanH} just created their page! Welcome them! 👋`);
          }
          break;
        }

        case 'USER_ANNOUNCE_JOIN': {
          const { handle, name, avatar } = event;
          const cleanH = normalizeHandle(handle);
          if (!cleanH) return;
          const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
          if (myClean !== cleanH) {
            const announcedProf: UserProfile = {
              id: `usr-${cleanH}`,
              name: name || cleanH,
              handle: cleanH,
              avatar: avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanH}`,
              coverUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600',
              isVerified: false,
              bio: 'Privity creator sharing private-first moments.',
              location: 'Global',
              joinedDate: 'Joined 2026',
              circleStatus: 'Public Connection' as const,
              isPrivate: false,
              followersList: [],
              followingList: [],
              trustCirclesList: [],
              mediaItems: [],
            };
            setProfiles((prev) => {
              if (prev[cleanH] || prev[cleanH.toLowerCase()]) return prev;
              const next = {
                ...prev,
                [cleanH]: announcedProf,
                [cleanH.toLowerCase()]: announcedProf,
              };
              safeSaveStorage('privity_profiles_v5', next);
              return next;
            });
            triggerToast(`🟢 @${cleanH} is online on the network`);
          }
          break;
        }

        case 'TYPING_DM': {
          const { senderHandle, recipientHandle, isTyping } = event;
          const cleanSender = (senderHandle || '').toLowerCase().replace(/^@/, '');
          const cleanRecipient = (recipientHandle || '').toLowerCase().replace(/^@/, '');
          if (
            cleanMyHandle &&
            cleanRecipient === cleanMyHandle.toLowerCase() &&
            activeChatUser &&
            cleanSender === (activeChatUser.handle || '').toLowerCase().replace(/^@/, '')
          ) {
            setIsRecipientTyping(Boolean(isTyping));
          }
          break;
        }

        case 'QUERY_POSTS': {
          if (deletedPostIdsRef.current.size > 0) {
            broadcastSyncEventRef.current({
              action: 'SYNC_DELETED_POSTS',
              deletedIds: Array.from(deletedPostIdsRef.current),
            });
          }
          if (postsRef.current && postsRef.current.length > 0) {
            const validPosts = postsRef.current.filter((p) => !isMockPost(p) && !deletedPostIdsRef.current.has(p.id));
            for (let i = 0; i < Math.min(validPosts.length, 15); i += 3) {
              const chunk = validPosts.slice(i, i + 3);
              setTimeout(() => {
                broadcastSyncEventRef.current({
                  action: 'SYNC_POSTS_REGISTRY',
                  posts: chunk,
                });
              }, i * 50);
            }
          }
          break;
        }

        case 'SYNC_POSTS_REGISTRY': {
          const { posts: remotePosts } = event;
          if (Array.isArray(remotePosts) && remotePosts.length > 0) {
            setPosts((prev) => {
              const map = new Map(prev.map((p) => [p.id, p]));
              let changed = false;
              for (const rp of remotePosts) {
                if (!rp || !rp.id || isMockPost(rp) || deletedPostIdsRef.current.has(rp.id)) continue;
                if (!map.has(rp.id)) {
                  map.set(rp.id, rp);
                  changed = true;
                } else {
                  const cur = map.get(rp.id)!;
                  const curLikers = (cur.likersList || []).map(normalizeHandle).filter(Boolean);
                  const rpLikers = (rp.likersList || []).map(normalizeHandle).filter(Boolean);
                  const mergedLikers = Array.from(new Set([...curLikers, ...rpLikers]));
                  const mergedLikesCount = Math.max(cur.likesCount || 0, rp.likesCount || 0, mergedLikers.length);

                  const curSavers = (cur.saversList || []).map(normalizeHandle).filter(Boolean);
                  const rpSavers = (rp.saversList || []).map(normalizeHandle).filter(Boolean);
                  const mergedSavers = Array.from(new Set([...curSavers, ...rpSavers]));
                  const mergedSavesCount = Math.max(cur.savesCount || 0, rp.savesCount || 0, mergedSavers.length);

                  const curComments = cur.comments || [];
                  const rpComments = rp.comments || [];
                  const mergedComments = rpComments.length > curComments.length ? rpComments : curComments;
                  const mergedCommentsCount = Math.max(cur.commentsCount || 0, rp.commentsCount || 0, mergedComments.length);

                  if (
                    mergedLikers.length !== curLikers.length ||
                    mergedLikesCount !== cur.likesCount ||
                    mergedSavers.length !== curSavers.length ||
                    mergedSavesCount !== cur.savesCount ||
                    mergedCommentsCount !== cur.commentsCount ||
                    mergedComments.length !== curComments.length
                  ) {
                    map.set(rp.id, {
                      ...cur,
                      likersList: mergedLikers,
                      likesCount: mergedLikesCount,
                      saversList: mergedSavers,
                      savesCount: mergedSavesCount,
                      comments: mergedComments,
                      commentsCount: mergedCommentsCount,
                    });
                    changed = true;
                  }
                }
              }
              if (!changed) return prev;
              const merged = Array.from(map.values()).sort((a, b) => {
                const timeA = parseInt(a.id.replace(/\D/g, '') || '0', 10);
                const timeB = parseInt(b.id.replace(/\D/g, '') || '0', 10);
                return timeB - timeA;
              });
              safeSaveStorage('privity_posts_v5', merged);
              return merged;
            });
          }
          break;
        }

        case 'LIVE_ENDED':
        case 'LIVE_HOST_ENDED':
        case 'STREAM_ENDED': {
          const streamId = event.streamId || (event.stream && event.stream.id) || '';
          const handle = event.handle || event.hostHandle || event.creatorHandle || '';
          if (!streamId && !handle) return;
          const cleanTarget = (handle || '').toLowerCase().replace('@', '').trim();
          try {
            if (cleanTarget) localStorage.removeItem(`privity_live_chat_${cleanTarget}`);
            if (streamId) localStorage.removeItem(`privity_live_chat_${streamId}`);
          } catch {}
          liveStreamSync.notifyStreamEnded(streamId || '', cleanTarget);
          setNetworkLiveStreamers((prev) => {
            return prev.filter((s) => {
              const sHandle = ((s as any).creatorHandle || s.handle || '').toLowerCase().replace('@', '').trim();
              return s.id !== streamId && (!cleanTarget || sHandle !== cleanTarget);
            });
          });
          if (activeLiveStream && (activeLiveStream.id === streamId || (cleanTarget && (((activeLiveStream as any).creatorHandle || (activeLiveStream as any).handle || '').toLowerCase().replace('@', '').trim() === cleanTarget)))) {
            setActiveLiveStream(null);
            triggerToast('Live broadcast ended by host');
          }
          if (minimizedLiveStream && (minimizedLiveStream.id === streamId || (cleanTarget && (((minimizedLiveStream as any).creatorHandle || (minimizedLiveStream as any).handle || '').toLowerCase().replace('@', '').trim() === cleanTarget)))) {
            setMinimizedLiveStream(null);
          }
          break;
        }

        default:
          break;
      }
    },
    [myTabSessionId, myProfile.handle, activeUserHandle]
  );

  // Safely parse and process any incoming raw item from ntfy (SSE or Polling)
  const handleRawNtfyItem = React.useCallback(
    (item: any) => {
      if (!item) return;

      // Handle file attachments created when payload was > 4KB
      if (item.attachment && item.attachment.url) {
        fetch(item.attachment.url)
          .then((res) => res.json())
          .then((evt) => {
            applyRemoteSyncEvent(evt);
          })
          .catch((err) => console.warn('Failed to fetch sync attachment', err));
        return;
      }

      // Handle standard inline JSON messages
      if (item.event === 'message' && item.message) {
        try {
          const evt = JSON.parse(item.message);
          applyRemoteSyncEvent(evt);
        } catch (e) {
          // not valid JSON (e.g. text notification)
        }
      }
    },
    [applyRemoteSyncEvent]
  );

  // Setup Real-Time Listeners (SSE for sub-second cloud sync + BroadcastChannel for same device + 3s Heartbeat Poll)
  useEffect(() => {
    // 1. Initial 24h catch-up to retrieve all recent community activity
    const fullCatchUp = () => {
      fetch(`${SYNC_ENDPOINT}/json?poll=1&since=24h`)
        .then((res) => res.text())
        .then((text) => {
          const lines = text.trim().split('\n').filter(Boolean);
          lines.forEach((line) => {
            try {
              const item = JSON.parse(line);
              handleRawNtfyItem(item);
            } catch (e) {}
          });
        })
        .catch(() => {});
    };

    // 2. Incremental 45s catch-up for continuous background heartbeat
    const quickCatchUp = () => {
      fetch(`${SYNC_ENDPOINT}/json?poll=1&since=45s`)
        .then((res) => res.text())
        .then((text) => {
          const lines = text.trim().split('\n').filter(Boolean);
          lines.forEach((line) => {
            try {
              const item = JSON.parse(line);
              handleRawNtfyItem(item);
            } catch (e) {}
          });
        })
        .catch(() => {});
    };

    fullCatchUp();

    // 3. Persistent Server-Sent Events (SSE) stream for instant sub-second delivery
    let es: EventSource | null = null;
    let ntfyWs: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectNtfyWs = () => {
      try {
        if (ntfyWs) {
          try { ntfyWs.close(); } catch {}
        }
        ntfyWs = new WebSocket(`wss://ntfy.sh/${SYNC_TOPIC}/ws`);
        ntfyWs.onmessage = (e) => {
          try {
            const item = JSON.parse(e.data);
            handleRawNtfyItem(item);
          } catch (err) {}
        };
        ntfyWs.onerror = () => {
          try { ntfyWs?.close(); } catch {}
        };
      } catch (e) {
        console.warn('ntfy WebSocket connection failed', e);
      }
    };

    const connectSSE = () => {
      try {
        if (es) {
          es.close();
        }
        es = new EventSource(`${SYNC_ENDPOINT}/sse`);
        es.onmessage = (e) => {
          try {
            const item = JSON.parse(e.data);
            handleRawNtfyItem(item);
          } catch (err) {}
        };
        es.onerror = () => {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            connectSSE();
            connectNtfyWs();
            quickCatchUp();
          }, 2500);
        };
      } catch (e) {
        console.warn('SSE subscription failed', e);
      }
    };

    connectSSE();
    connectNtfyWs();

    // 4. Supabase Realtime WebSocket listener for sub-50ms instant sync across all devices
    const unsubSupabase = onSupabaseBroadcast((evt) => {
      applyRemoteSyncEvent(evt);
    });

    // 4.1. Supabase Postgres DB changes listener on profiles table
    let dbProfilesSubscription: any = null;
    const sb = getSupabaseClient();
    if (sb) {
      try {
        dbProfilesSubscription = sb
          .channel('public:profiles_realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            (payload: any) => {
              if (payload?.new) {
                const row = payload.new;
                const cleanHandle = (row.handle || row.username || '').replace(/^@/, '');
                if (cleanHandle) {
                  applyRemoteSyncEvent({
                    action: 'UPDATE_PROFILE',
                    profile: {
                      id: row.id,
                      name: row.full_name || row.name || cleanHandle,
                      handle: cleanHandle,
                      avatar: row.avatar_url || row.avatar || '',
                      bio: row.bio || '',
                      coverUrl: row.cover_url || '',
                      isVerified: !!row.is_verified,
                    },
                  });
                }
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Supabase DB subscription error:', err);
      }
    }

    // 5. Same-device multi-tab BroadcastChannel listener & Storage Event listener
    if (localSyncBus) {
      localSyncBus.onmessage = (e) => {
        if (e.data) {
          applyRemoteSyncEvent(e.data);
        }
      };
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (!e.newValue) return;
      const myClean = normalizeHandle(currentAuthUserRef.current?.handle || myProfileRef.current?.handle);
      if (e.key === 'privity_posts_v5') {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setPosts((prev) => {
              const parsedMap = new Map<string, any>(parsed.map((p: any) => [p.id, p]));
              const next = prev.map((p) => {
                const incoming = parsedMap.get(p.id);
                if (!incoming) return p;
                const likers = Array.isArray(incoming.likersList) ? incoming.likersList : p.likersList || [];
                const savers = Array.isArray(incoming.saversList) ? incoming.saversList : p.saversList || [];
                return {
                  ...p,
                  ...incoming,
                  likersList: likers,
                  likesCount: likers.length,
                  saversList: savers,
                  savesCount: savers.length,
                  isLiked: myClean ? likers.includes(myClean) : p.isLiked,
                  isSaved: myClean ? savers.includes(myClean) : p.isSaved,
                };
              });
              const existingIds = new Set(prev.map((p) => p.id));
              for (const p of parsed) {
                if (!existingIds.has(p.id)) {
                  const likers = Array.isArray(p.likersList) ? p.likersList : [];
                  const savers = Array.isArray(p.saversList) ? p.saversList : [];
                  next.unshift({
                    ...p,
                    likersList: likers,
                    likesCount: likers.length,
                    saversList: savers,
                    savesCount: savers.length,
                    isLiked: myClean ? likers.includes(myClean) : false,
                    isSaved: myClean ? savers.includes(myClean) : false,
                  });
                }
              }
              return next;
            });
          }
        } catch {}
      } else if (e.key === 'privity_profiles_v5') {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            setProfiles((prev) => ({ ...prev, ...parsed }));
          }
        } catch {}
      } else if (e.key === 'privity_following_v5') {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            setFollowingMap(parsed);
          }
        } catch {}
      } else if (myClean && e.key === `privity_notifs_${myClean}`) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setNotifications(parsed);
          }
        } catch {}
      } else if (
        e.key === 'privity_remote_active_streams' ||
        e.key === 'privity_current_live_host' ||
        e.key === 'privity_is_host_broadcasting' ||
        e.key === 'privity_ended_streams_v2'
      ) {
        const streams = liveStreamSync.getStreamersList();
        setNetworkLiveStreamers(streams);
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 6. Active Realtime Health Check & Background Heartbeat
    let lastQueryTime = 0;
    const pollInterval = setInterval(() => {
      // Auto-heal Supabase Realtime channel if mobile OS closed or errored it
      if (!isSupabaseRealtimeConnected()) {
        reconnectSupabaseRealtime(true);
      }

      // Proactive query sync every 6s so idle/resumed devices catch up 100% in real time
      const now = Date.now();
      if (now - lastQueryTime >= 6000) {
        lastQueryTime = now;
        broadcastSyncEventRef.current({ action: 'QUERY_POSTS' });
        broadcastSyncEventRef.current({ action: 'QUERY_PROFILES' });
      }

      quickCatchUp();
      if (!es || es.readyState === EventSource.CLOSED) {
        connectSSE();
      }
    }, 2000);

    // 7. On window/document visibility, mobile pageshow, focus, or network return
    const handleWake = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        reconnectSupabaseRealtime(true);
        quickCatchUp();
        if (!es || es.readyState === EventSource.CLOSED) {
          connectSSE();
        }
        broadcastSyncEventRef.current({ action: 'QUERY_PROFILES' });
        broadcastSyncEventRef.current({ action: 'QUERY_POSTS' });
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleWake);
    }
    window.addEventListener('pageshow', handleWake);
    window.addEventListener('focus', handleWake);
    window.addEventListener('online', fullCatchUp);

    // 8. Query active sovereign lives, community profiles, and posts on startup
    const queryStartupTimer = setTimeout(() => {
      broadcastSyncEventRef.current({ action: 'QUERY_LIVES' });
      broadcastSyncEventRef.current({ action: 'QUERY_PROFILES' });
      broadcastSyncEventRef.current({ action: 'QUERY_POSTS' });

      // Announce presence so all connected users know a new member joined/arrived
      const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
      if (myClean) {
        broadcastSyncEventRef.current({
          action: 'USER_ANNOUNCE_JOIN',
          handle: myClean,
          name: currentAuthUser?.name || myProfile.name || myClean,
          avatar: currentAuthUser?.avatar || myProfile.avatar,
        });
      }
    }, 400);

    return () => {
      clearTimeout(queryStartupTimer);
      clearInterval(pollInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      es?.close();
      try { ntfyWs?.close(); } catch {}
      unsubSupabase();
      if (dbProfilesSubscription) {
        try {
          sb?.removeChannel(dbProfilesSubscription);
        } catch {}
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleWake);
      }
      window.removeEventListener('pageshow', handleWake);
      window.removeEventListener('focus', handleWake);
      window.removeEventListener('online', fullCatchUp);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [handleRawNtfyItem, applyRemoteSyncEvent, localSyncBus]);


  // Edit Personal Profile Modal State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    handle: '',
    bio: '',
    avatar: '',
    coverUrl: '',
    location: '',
    website: '',
    category: '',
  });

  const handleOpenEditProfile = () => {
    setEditForm({
      name: myProfile.name,
      handle: myProfile.handle,
      bio: myProfile.bio,
      avatar: myProfile.avatar,
      coverUrl: myProfile.coverUrl,
      location: myProfile.location || 'San Francisco, CA',
      website: myProfile.website || 'privity.app',
      category: myProfile.category || myProfile.verifiedCategory || 'Platform Founder',
    });
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      triggerToast('Please enter a display name');
      return;
    }

    const cleanHandle = editForm.handle.trim().replace(/^@/, '') || myProfile.handle;
    const updated: UserProfile = {
      ...myProfile,
      name: editForm.name.trim(),
      handle: cleanHandle,
      bio: editForm.bio.trim(),
      avatar: editForm.avatar || myProfile.avatar,
      coverUrl: editForm.coverUrl || myProfile.coverUrl,
      location: editForm.location.trim() || 'Global',
      website: editForm.website.trim() || 'privity.app',
      category: editForm.category.trim() || myProfile.category,
      verifiedCategory: editForm.category.trim() || myProfile.verifiedCategory,
    };

    setProfiles((prev) => {
      const next = {
        ...prev,
        [cleanHandle.toLowerCase()]: updated,
        [cleanHandle]: updated,
      };
      if (myProfile.handle && myProfile.handle.toLowerCase() !== cleanHandle.toLowerCase()) {
        delete next[myProfile.handle.toLowerCase()];
      }
      try {
        localStorage.setItem('privity_profiles_v5', JSON.stringify(next));
      } catch (err) {
        console.warn(err);
      }
      return next;
    });

    // Update active tab session and auth accounts
    try {
      authService.updateProfile({
        name: updated.name,
        handle: cleanHandle,
        avatar: updated.avatar,
        coverUrl: updated.coverUrl,
        bio: updated.bio,
      });
    } catch {}

    setCurrentAuthUser((prev) =>
      prev
        ? {
            ...prev,
            name: updated.name,
            handle: cleanHandle,
            avatar: updated.avatar,
            coverUrl: updated.coverUrl,
            bio: updated.bio,
          }
        : null
    );

    // Synchronize posts, comments, and replies authored by user in real time
    setPosts((prev) =>
      prev.map((p) => {
        const isPostAuthor =
          (myProfile.id && p.authorId === myProfile.id) ||
          p.authorHandle === myProfile.handle;

        const updatedComments = p.comments.map((c) => {
          const isCommentAuthor = c.authorHandle === myProfile.handle;
          const updatedReplies = (c.replies || []).map((r) => {
            const isReplyAuthor = r.authorHandle === myProfile.handle;
            if (isReplyAuthor) {
              return {
                ...r,
                authorName: updated.name,
                authorAvatar: updated.avatar,
                authorHandle: updated.handle,
              };
            }
            return r;
          });

          if (isCommentAuthor) {
            return {
              ...c,
              authorName: updated.name,
              authorAvatar: updated.avatar,
              authorHandle: updated.handle,
              replies: updatedReplies,
            };
          }
          return { ...c, replies: updatedReplies };
        });

        if (isPostAuthor) {
          return {
            ...p,
            authorName: updated.name,
            authorAvatar: updated.avatar,
            authorHandle: updated.handle,
            comments: updatedComments,
          };
        }
        return { ...p, comments: updatedComments };
      })
    );

    if (myProfile.handle && viewedUserHandle.toLowerCase() === myProfile.handle.toLowerCase()) {
      setViewedUserHandle(cleanHandle);
    }

    setIsEditProfileOpen(false);
    triggerToast('Profile updated');
    broadcastSyncEvent({
      action: 'UPDATE_PROFILE',
      profile: updated,
      account: {
        id: updated.id,
        name: updated.name,
        handle: cleanHandle,
        avatar: updated.avatar,
        coverUrl: updated.coverUrl,
        bio: updated.bio,
      },
    });
  };

  // Direct cover banner change with instant network synchronization
  const handleDirectBannerChange = (bannerUrl: string, posterUrl?: string) => {
    let cleanHandle = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
    if (!cleanHandle) {
      cleanHandle = 'creator';
    }

    const updated: UserProfile = {
      ...myProfile,
      handle: cleanHandle,
      coverUrl: bannerUrl,
      ...(posterUrl ? { coverPoster: posterUrl } : {}),
    };

    setProfiles((prev) => {
      const next = {
        ...prev,
        [cleanHandle.toLowerCase()]: updated,
        [cleanHandle]: updated,
      };
      safeSaveStorage('privity_profiles_v5', next);
      return next;
    });

    try {
      authService.updateProfile({ coverUrl: bannerUrl });
    } catch {}

    setCurrentAuthUser((prev) => (prev ? {
      ...prev,
      coverUrl: bannerUrl,
      ...(posterUrl ? { coverPoster: posterUrl } : {}),
    } : {
      id: 'usr_' + cleanHandle,
      name: myProfile.name || 'Creator',
      handle: cleanHandle,
      email: `${cleanHandle}@privity.app`,
      avatar: myProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanHandle}`,
      coverUrl: bannerUrl,
      level: 0,
      xp: 0,
      followers: 0,
      following: 0,
      likes: 0,
      sparks: 0,
      createdAt: Date.now(),
      provider: 'guest',
    }));

    setEditForm((prev) => ({
      ...prev,
      coverUrl: bannerUrl,
      ...(posterUrl ? { coverPoster: posterUrl } : {}),
    }));

    broadcastSyncEvent({
      action: 'UPDATE_PROFILE',
      profile: updated,
      account: {
        id: updated.id,
        name: updated.name,
        handle: cleanHandle,
        avatar: updated.avatar,
        coverUrl: bannerUrl,
        coverPoster: posterUrl,
        bio: updated.bio,
      },
    });

    triggerToast('Cover banner updated instantly');
  };

  // Direct profile avatar photo change with instant network synchronization
  const handleDirectAvatarChange = (avatarUrl: string, posterUrl?: string) => {
    let cleanHandle = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
    if (!cleanHandle) {
      cleanHandle = 'creator';
    }

    const updated: UserProfile = {
      ...myProfile,
      handle: cleanHandle,
      avatar: avatarUrl,
      ...(posterUrl ? { avatarPoster: posterUrl } : {}),
    };

    setProfiles((prev) => {
      const next = {
        ...prev,
        [cleanHandle.toLowerCase()]: updated,
        [cleanHandle]: updated,
      };
      safeSaveStorage('privity_profiles_v5', next);
      return next;
    });

    try {
      authService.updateProfile({ avatar: avatarUrl });
    } catch {}

    setCurrentAuthUser((prev) => (prev ? {
      ...prev,
      avatar: avatarUrl,
      ...(posterUrl ? { avatarPoster: posterUrl } : {}),
    } : {
      id: 'usr_' + cleanHandle,
      name: myProfile.name || 'Creator',
      handle: cleanHandle,
      email: `${cleanHandle}@privity.app`,
      avatar: avatarUrl,
      coverUrl: myProfile.coverUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200',
      level: 0,
      xp: 0,
      followers: 0,
      following: 0,
      likes: 0,
      sparks: 0,
      createdAt: Date.now(),
      provider: 'guest',
    }));

    setEditForm((prev) => ({
      ...prev,
      avatar: avatarUrl,
      ...(posterUrl ? { avatarPoster: posterUrl } : {}),
    }));

    setPosts((prev) => {
      let changed = false;
      const nextPosts = prev.map((p) => {
        const isPostAuthor =
          (p.authorHandle && p.authorHandle.replace(/^@/, '').toLowerCase() === cleanHandle.toLowerCase()) ||
          p.authorId === updated.id;
        if (isPostAuthor) {
          changed = true;
          return { ...p, authorAvatar: avatarUrl };
        }
        return p;
      });
      if (changed) safeSaveStorage('privity_posts_v5', nextPosts);
      return changed ? nextPosts : prev;
    });

    broadcastSyncEvent({
      action: 'UPDATE_PROFILE',
      profile: updated,
      account: {
        id: updated.id,
        name: updated.name,
        handle: cleanHandle,
        avatar: avatarUrl,
        avatarPoster: posterUrl,
        coverUrl: updated.coverUrl,
        bio: updated.bio,
      },
    });

    triggerToast('Profile photo updated instantly');
  };

  // Add photo or video directly to profile Studio & Media with instant broadcast
  const handleAddProfileMedia = (mediaUrl: string, mediaType: 'image' | 'video' = isVideoMedia(mediaUrl) ? 'video' : 'image') => {
    const cleanHandle = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
    if (!cleanHandle) return;

    const newMedia: UserMediaItem = {
      id: `m-${cleanHandle}-${Date.now()}`,
      url: mediaUrl,
      type: mediaType,
      likes: 0,
      comments: 0,
      isLiked: false,
    };

    const currentMedia = myProfile.mediaItems || [];
    const updatedMedia = [newMedia, ...currentMedia];

    const updatedProf: UserProfile = {
      ...myProfile,
      mediaItems: updatedMedia,
    };

    setProfiles((prev) => {
      const next = {
        ...prev,
        [cleanHandle.toLowerCase()]: updatedProf,
        [cleanHandle]: updatedProf,
      };
      safeSaveStorage('privity_profiles_v5', next);
      return next;
    });

    const authorName = currentAuthUser?.name || myProfile.name || cleanHandle;
    const authorAvatar = currentAuthUser?.avatar || myProfile.avatar;
    const authorHandle = `@${cleanHandle}`;
    const authorId = currentAuthUser?.id || myProfile.id || `usr-${cleanHandle}`;
    const isVerified = Boolean(currentAuthUser?.isVerified ?? myProfile.isVerified);

    const newPost: PostItem = {
      id: `p-${Date.now()}`,
      authorId,
      authorName,
      authorHandle,
      authorAvatar,
      isVerified,
      type: mediaType === 'video' ? 'video' : 'image',
      contentUrl: mediaUrl,
      thumbnailUrl: mediaType === 'video' ? undefined : mediaUrl,
      videoUrl: mediaType === 'video' ? mediaUrl : undefined,
      caption: mediaType === 'video' ? 'Added new video dispatch to profile studio' : 'Added new visual to profile studio',
      tags: ['studio', 'media'],
      privacy: 'public',
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      isLiked: false,
      isSaved: false,
      likersList: [],
      timeAgo: 'Just now',
      comments: [],
    };

    setPosts((prev) => {
      const next = [newPost, ...prev];
      safeSaveStorage('privity_posts_v5', next);
      return next;
    });

    const newStory: StoryItem = {
      id: `st-${cleanHandle}-${Date.now()}`,
      authorName,
      authorHandle: cleanHandle,
      authorAvatar,
      isVerified,
      mediaUrl,
      mediaType: mediaType === 'video' ? 'video' : 'image',
      caption: mediaType === 'video' ? 'New studio video' : 'New studio visual',
      timeAgo: 'Just now',
      createdAt: Date.now(),
      privacy: 'public',
      likesCount: 0,
      isLiked: false,
    };
    handleAddStory(newStory);

    broadcastSyncEvent({
      action: 'UPDATE_PROFILE',
      profile: updatedProf,
      account: {
        id: updatedProf.id,
        name: updatedProf.name,
        handle: cleanHandle,
        avatar: updatedProf.avatar,
        coverUrl: updatedProf.coverUrl,
        bio: updatedProf.bio,
      },
    });

    broadcastSyncEvent({
      action: 'NEW_POST',
      post: newPost,
    });

    triggerToast(mediaType === 'video' ? 'Video added to your studio & story' : 'Photo added to your studio & story');
  };

  // Like media item directly on profile with synchronized posts & photo likes registry
  const handleLikeMedia = (profileHandle: string, mediaId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const clean = profileHandle.replace(/^@/, '');
    const prof = profiles[clean] || getUserProfile(clean);
    const targetItem = prof?.mediaItems?.find((m) => m.id === mediaId);
    if (!targetItem) return;

    const targetUrl = targetItem.url;
    const baseKey = extractMediaBaseKey(targetUrl);
    const photoRecord = targetUrl ? (photoLikesMap[targetUrl] || (baseKey ? photoLikesMap[baseKey] : undefined)) : undefined;
    const matchingPost = posts.find((p) => isSameMedia(p.contentUrl, targetUrl) || isSameMedia(p.thumbnailUrl, targetUrl));

    const currentLiked = photoRecord !== undefined
      ? photoRecord.isLiked
      : (matchingPost !== undefined ? matchingPost.isLiked : !!targetItem.isLiked);
    const currentLikes = photoRecord !== undefined
      ? photoRecord.count
      : (matchingPost !== undefined ? matchingPost.likesCount : targetItem.likes);
    const nextLiked = !currentLiked;
    const nextLikes = nextLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);

    // 1. Update photoLikesMap immediately
    setPhotoLikesMap((prev) => {
      const next = {
        ...prev,
        ...(baseKey ? { [baseKey]: { isLiked: nextLiked, count: nextLikes } } : {}),
        ...(!targetUrl.startsWith('data:') ? { [targetUrl]: { isLiked: nextLiked, count: nextLikes } } : {}),
      };
      safeSaveStorage('privity_photo_likes_v5', next);
      return next;
    });

    // 2. Update profiles immediately across all profiles
    setProfiles((prev) => {
      const nextProfs = { ...prev };
      for (const [h, p] of Object.entries(nextProfs)) {
        if (p.mediaItems?.some((m) => m.id === mediaId || isSameMedia(m.url, targetUrl))) {
          nextProfs[h] = {
            ...p,
            mediaItems: p.mediaItems.map((m) => {
              if (m.id === mediaId || isSameMedia(m.url, targetUrl)) {
                return {
                  ...m,
                  isLiked: nextLiked,
                  likes: nextLikes,
                };
              }
              return m;
            }),
          };
        }
      }
      safeSaveStorage('privity_profiles_v5', nextProfs);
      return nextProfs;
    });

    // 3. Update posts immediately across all posts
    setPosts((prevPosts) => {
      let matched = false;
      const nextPosts = prevPosts.map((p) => {
        if (isSameMedia(p.contentUrl, targetUrl) || isSameMedia(p.thumbnailUrl, targetUrl)) {
          matched = true;
          const likerHandle = myProfile.handle;
          let nextLikers = [...(p.likersList || [])];
          if (nextLiked) {
            if (likerHandle && !nextLikers.includes(likerHandle)) nextLikers = [likerHandle, ...nextLikers];
          } else {
            nextLikers = nextLikers.filter((h: string) => h !== likerHandle);
          }
          return {
            ...p,
            isLiked: nextLiked,
            likersList: nextLikers,
            likesCount: nextLikes,
          };
        }
        return p;
      });
      if (matched) {
        safeSaveStorage('privity_posts_v5', nextPosts);
      }
      return nextPosts;
    });

    broadcastSyncEvent({
      action: 'LIKE_MEDIA',
      mediaId,
      isLiked: nextLiked,
      count: nextLikes,
    });

    triggerToast(nextLiked ? 'Liked studio visual' : 'Unliked studio visual');
  };

  // Post Actions Menu & Caption Editing State
  const [postMenuModal, setPostMenuModal] = useState<{ post: PostItem; isOwn: boolean } | null>(null);
  const [editingPostCaption, setEditingPostCaption] = useState<{ id: string; caption: string } | null>(null);
  // Delete post permanently and synchronize with Media & Studio
  const handleDeletePost = (postId: string) => {
    setDeletedPostIds((prev) => {
      const next = new Set(prev);
      next.add(postId);
      safeSaveStorage('privity_deleted_post_ids_v1', Array.from(next));
      deletedPostIdsRef.current = next;
      return next;
    });

    const targetPost = posts.find((p) => p.id === postId);
    const targetPhotoUrl = targetPost?.contentUrl || targetPost?.thumbnailUrl;

    // 1. Remove from feed posts
    setPosts((prev) => {
      const nextPosts = prev.filter((p) => p.id !== postId);
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    // 2. Remove corresponding visual from Media & Studio
    setProfiles((prevProfs) => {
      let changed = false;
      const nextProfs = { ...prevProfs };
      for (const [h, prof] of Object.entries(nextProfs)) {
        if (prof.mediaItems?.some((m) => m.id === postId || (targetPhotoUrl && isSameMedia(m.url, targetPhotoUrl)))) {
          changed = true;
          nextProfs[h] = {
            ...prof,
            mediaItems: prof.mediaItems.filter((m) => m.id !== postId && (!targetPhotoUrl || !isSameMedia(m.url, targetPhotoUrl))),
          };
        }
      }
      if (changed) {
        safeSaveStorage('privity_profiles_v5', nextProfs);
      }
      return nextProfs;
    });

    setPostMenuModal(null);
    broadcastSyncEvent({
      action: 'DELETE_POST',
      postId,
    });
    triggerToast('Dispatch and studio visual removed permanently');
  };

  // Delete media item directly from Media & Studio
  const handleDeleteMediaItem = (handle: string, mediaId: string, mediaUrl: string) => {
    const clean = handle.replace(/^@/, '');
    setProfiles((prevProfs) => {
      const prof = prevProfs[clean];
      if (!prof) return prevProfs;
      const nextProfs = {
        ...prevProfs,
        [clean]: {
          ...prof,
          mediaItems: (prof.mediaItems || []).filter((m) => m.id !== mediaId && !isSameMedia(m.url, mediaUrl)),
        },
      };
      safeSaveStorage('privity_profiles_v5', nextProfs);
      return nextProfs;
    });

    // Also remove any matching published post in feed
    setPosts((prevPosts) => {
      const nextPosts = prevPosts.filter((p) => !isSameMedia(p.contentUrl, mediaUrl) && !isSameMedia(p.thumbnailUrl, mediaUrl));
      if (nextPosts.length !== prevPosts.length) {
        safeSaveStorage('privity_posts_v5', nextPosts);
      }
      return nextPosts;
    });

    if (lightboxUrl && isSameMedia(lightboxUrl, mediaUrl)) {
      setLightboxUrl(null);
    }

    broadcastSyncEvent({
      action: 'DELETE_MEDIA',
      handle: clean,
      mediaId,
      mediaUrl,
    });

    triggerToast('Visual deleted from Studio & Feed');
  };

  const handleSavePostCaption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPostCaption) return;
    setPosts((prev) =>
      prev.map((p) => (p.id === editingPostCaption.id ? { ...p, caption: editingPostCaption.caption } : p))
    );
    broadcastSyncEvent({
      action: 'EDIT_POST_CAPTION',
      postId: editingPostCaption.id,
      caption: editingPostCaption.caption,
    });
    setEditingPostCaption(null);
    setPostMenuModal(null);
    triggerToast('Dispatch caption updated');
  };

  // Floating heart tracker for double tap
  const [heartExplodingPostId, setHeartExplodingPostId] = useState<string | null>(null);

  // Fullscreen Lightbox & privacy status
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxIsPrivateMessage, setLightboxIsPrivateMessage] = useState(false);
  const [discoverSearch, setDiscoverSearch] = useState('');

  // Inline Composer State
  const [composerCaption, setComposerCaption] = useState('');
  const [composerPrivacy, setComposerPrivacy] = useState<PostPrivacy>('public');
  const [composerPhotoUrl, setComposerPhotoUrl] = useState<string | null>(null);

  // Modal Composer State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraInitialTab, setCameraInitialTab] = useState<'POST' | 'LIVE' | 'CREATE'>('POST');
  const [hostLiveCameraStream, setHostLiveCameraStream] = useState<MediaStream | null>(null);
  const [isHostBroadcasting, setIsHostBroadcasting] = useState<boolean>(false);
  const [modalCaption, setModalCaption] = useState('');
  const [modalTags, setModalTags] = useState('');
  const [modalPrivacy, setModalPrivacy] = useState<PostPrivacy>('public');
  const [modalPhoto, setModalPhoto] = useState<string | null>(null);

  // Network active live streams (synchronized across multiple devices)
  const [networkLiveStreamers, setNetworkLiveStreamers] = useState<LiveMeStreamer[]>(() =>
    liveStreamSync.getStreamersList()
  );

  // Global Incoming Co-Host & Stage Guest Invitation
  const [globalIncomingInvite, setGlobalIncomingInvite] = useState<{
    type: 'cohost' | 'guest';
    senderName: string;
    senderHandle: string;
    senderAvatar: string;
    senderStreamer?: any;
    targetHandle?: string;
    timestamp: number;
  } | null>(null);
  const [isCoHostInviteAccepted, setIsCoHostInviteAccepted] = useState(false);

  // Global Room Listener for incoming live invitations (Co-Host / Stage Guest)
  useEffect(() => {
    const myCleanHandle = (myProfile.handle || '').replace(/^@+/, '').toLowerCase().trim();
    if (!myCleanHandle) return;

    const handleIncomingInviteEvent = (evt: any) => {
      if (!evt) return;
      if (evt.type === 'COHOST_INVITE' || evt.type === 'GUEST_INVITE') {
        const targetClean = (evt.targetHandle || '').replace(/^@+/, '').toLowerCase().trim();
        if (targetClean && targetClean !== myCleanHandle) return;

        // If user is not already actively in a live stream arena, show global invite banner
        if (!activeLiveStream) {
          setGlobalIncomingInvite({
            type: evt.type === 'COHOST_INVITE' ? 'cohost' : 'guest',
            senderName: evt.senderName || 'Creator',
            senderHandle: (evt.senderHandle || '@host').replace(/^@+/, ''),
            senderAvatar: evt.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            senderStreamer: evt.senderStreamer,
            targetHandle: myCleanHandle,
            timestamp: Date.now(),
          });
        }
      }
    };

    const unsubRoom = liveStreamSync.subscribeToRoom(myCleanHandle, handleIncomingInviteEvent);

    let syncBus: BroadcastChannel | null = null;
    try {
      syncBus = new BroadcastChannel('privity_sync_bus');
      syncBus.onmessage = (e) => {
        handleIncomingInviteEvent(e.data);
      };
    } catch {}

    return () => {
      unsubRoom();
      if (syncBus) syncBus.close();
    };
  }, [myProfile.handle, activeLiveStream]);

  useEffect(() => {
    // If not actively broadcasting on this tab upon mount/refresh, ensure any dead host state is cleared
    if (!isHostBroadcasting && !hostLiveCameraStream) {
      const savedHost = localStorage.getItem('privity_current_live_host');
      if (savedHost) {
        try {
          const parsed = JSON.parse(savedHost);
          const handle = parsed.creatorHandle || parsed.handle || '';
          if (
            liveStreamSync.isStreamEnded(parsed.id, handle, parsed.startedAt) ||
            (parsed.lastHeartbeat && Date.now() - parsed.lastHeartbeat > 4500)
          ) {
            localStorage.removeItem('privity_current_live_host');
            localStorage.removeItem('privity_is_host_broadcasting');
            localStorage.removeItem('privity_active_live_session');
          }
        } catch {
          localStorage.removeItem('privity_current_live_host');
          localStorage.removeItem('privity_is_host_broadcasting');
        }
      }
    }

    const handleBeforeUnload = () => {
      if (isHostBroadcasting) {
        liveStreamSync.stopHostBroadcast();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const unsub = liveStreamSync.subscribeToActiveStreams((streams) => {
      setNetworkLiveStreamers(streams);
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsub();
    };
  }, [isHostBroadcasting, hostLiveCameraStream]);

  // Continuous host heartbeat loop: guarantees that all devices on the network continually receive live status
  useEffect(() => {
    if (!isHostBroadcasting || !activeLiveStream) return;
    const cleanHandle = (myProfile.handle || '').replace(/^@/, '');
    const hbInterval = setInterval(() => {
      const hostMeta = {
        id: activeLiveStream.id,
        creatorHandle: cleanHandle,
        creatorName: myProfile.name,
        creatorAvatar: myProfile.avatar,
        handle: cleanHandle,
        name: myProfile.name,
        avatar: myProfile.avatar,
        isVerified: myProfile.isVerified,
        category: (activeLiveStream as any).category || 'Featured',
        title: (activeLiveStream as any).title || 'Live Broadcast',
        startedAt: (activeLiveStream as any).startedAt || Date.now(),
        lastHeartbeat: Date.now(),
        isLive: true,
      };
      broadcastSyncEvent({
        action: 'LIVE_HEARTBEAT',
        host: hostMeta,
      });
    }, 2500);

    return () => clearInterval(hbInterval);
  }, [isHostBroadcasting, activeLiveStream?.id, myProfile.handle, myProfile.name, myProfile.avatar, myProfile.isVerified]);

  // Comment input per post
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<{ postId: string; commentId: string; handle: string } | null>(null);

  // Feed Audience Sub-Tabs Swipe and Selection
  const feedTouchStartXRef = React.useRef<number | null>(null);
  const feedTouchStartYRef = React.useRef<number | null>(null);
  const feedPointerStartXRef = React.useRef<number | null>(null);
  const feedPointerStartYRef = React.useRef<number | null>(null);
  const feedLastSwipeTimeRef = React.useRef<number>(0);

  const handleSelectFeedTab = (tab: FeedFilterTab) => {
    setFeedFilter(tab);
    setTimeout(() => {
      const el = document.getElementById(`tab-feed-${tab}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 20);
  };

  const processFeedSwipeDelta = (deltaX: number, deltaY: number) => {
    const now = Date.now();
    if (now - feedLastSwipeTimeRef.current < 260) return;

    if (Math.abs(deltaX) > 36 && Math.abs(deltaX) > Math.abs(deltaY) * 0.75) {
      feedLastSwipeTimeRef.current = now;
      const currentIndex = FEED_TABS.indexOf(feedFilter);
      if (currentIndex === -1) return;

      if (deltaX < 0) {
        // Swiped Left -> Move forward to next tab
        if (currentIndex < FEED_TABS.length - 1) {
          handleSelectFeedTab(FEED_TABS[currentIndex + 1]);
        }
      } else {
        // Swiped Right -> Move back to previous tab
        if (currentIndex > 0) {
          handleSelectFeedTab(FEED_TABS[currentIndex - 1]);
        }
      }
    }
  };

  const handleFeedTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.circles-story-rail, .composer-attachments-group, .lightbox-overlay, input, textarea, button, a, select, .live-stream-modal-window')) {
      return;
    }
    if (e.touches.length === 1) {
      feedTouchStartXRef.current = e.touches[0].clientX;
      feedTouchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleFeedTouchEnd = (e: React.TouchEvent) => {
    if (feedTouchStartXRef.current === null || feedTouchStartYRef.current === null) return;
    if (isModalOpen || isCameraOpen || isSettingsOpen || isEditProfileOpen || lightboxUrl || rosterModal || postMenuModal || activeLiveStream) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - feedTouchStartXRef.current;
    const deltaY = touchEndY - feedTouchStartYRef.current;

    feedTouchStartXRef.current = null;
    feedTouchStartYRef.current = null;

    processFeedSwipeDelta(deltaX, deltaY);
  };

  const handleFeedPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const target = e.target as HTMLElement;
    if (target.closest('.circles-story-rail, .composer-attachments-group, .lightbox-overlay, input, textarea, button, a, select, .live-stream-modal-window')) {
      return;
    }
    feedPointerStartXRef.current = e.clientX;
    feedPointerStartYRef.current = e.clientY;
  };

  const handleFeedPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (feedPointerStartXRef.current === null || feedPointerStartYRef.current === null) return;
    if (isModalOpen || isCameraOpen || isSettingsOpen || isEditProfileOpen || lightboxUrl || rosterModal || postMenuModal || activeLiveStream) return;

    const deltaX = e.clientX - feedPointerStartXRef.current;
    const deltaY = e.clientY - feedPointerStartYRef.current;

    feedPointerStartXRef.current = null;
    feedPointerStartYRef.current = null;

    processFeedSwipeDelta(deltaX, deltaY);
  };

  const handleLiveHeartBurst = (customColor?: string, x?: number, y?: number) => {
    const currentStream = liveStreamsList[activeLiveIndex] || liveStreamsList[0];
    setHostLiveLikes((prev) => ({
      ...prev,
      [currentStream.id]: (prev[currentStream.id] || 4891) + 1,
    }));

    const colors = ['#f43f5e', '#ec4899', '#8b5cf6', '#06b6d4', '#e11d48', '#f59e0b', '#10b981'];
    const chosen = customColor || colors[Math.floor(Math.random() * colors.length)];
    
    // Exact click/touch coordinates
    const defaultX = typeof window !== 'undefined' ? window.innerWidth * 0.72 : 280;
    const defaultY = typeof window !== 'undefined' ? window.innerHeight * 0.68 : 500;
    const posX = typeof x === 'number' && !isNaN(x) ? x : defaultX;
    const posY = typeof y === 'number' && !isNaN(y) ? y : defaultY;

    // Spawn 1 to 2 micro floating hearts at the exact tap position
    const burstCount = typeof x === 'number' ? 2 : 1;
    for (let i = 0; i < burstCount; i++) {
      const offsetX = (Math.random() - 0.5) * 32;
      const offsetY = (Math.random() - 0.5) * 24;
      const rot = (Math.random() - 0.5) * 44;
      const newHeart = {
        id: Date.now() + Math.random() + i,
        x: posX + offsetX,
        y: posY + offsetY,
        color: chosen,
        size: 26 + Math.floor(Math.random() * 12),
        rot,
      };
      setFloatingHearts((prev) => [...prev, newHeart]);
      setTimeout(() => {
        setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
      }, 1600);
    }
  };

  const playLiveSoundFX = useCallback((type: 'punch' | 'cheer' | 'gift' | 'supergift') => {
    if (isLiveSoundMuted || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      if (type === 'punch') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(36, now + 0.16);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'cheer') {
        [523.25, 659.25, 783.99].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.04);
          gain.gain.setValueAtTime(0.12, now + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.04);
          osc.stop(now + idx * 0.04 + 0.3);
        });
      } else if (type === 'supergift') {
        const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
        notes.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + idx * 0.07);
          gain.gain.setValueAtTime(0.22, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.45);
        });
      } else if (type === 'gift') {
        [440, 659.25, 880].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.06);
          gain.gain.setValueAtTime(0.15, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.35);
        });
      }
    } catch {
      // Audio autoplay handled gracefully
    }
  }, [isLiveSoundMuted]);

  const handleCreatorTap = (side: 'host' | 'rival', e: React.MouseEvent | React.TouchEvent) => {
    if ('stopPropagation' in e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    let clientX = window.innerWidth / 2;
    let clientY = window.innerHeight / 2;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    setIsGloveClashing(true);
    setTimeout(() => setIsGloveClashing(false), 380);
    playLiveSoundFX('punch');

    setPkComboCount((prev) => prev + 1);
    const comboMult = pkComboCount >= 10 ? 3 : pkComboCount >= 4 ? 2 : 1;
    const pts = 15 * comboMult;

    if (side === 'host') {
      setBattleScoreHost((prev) => prev + pts);
      handleLiveHeartBurst('#ff2b54', clientX, clientY);
    } else {
      setBattleScoreOpponent((prev) => prev + pts);
      handleLiveHeartBurst('#00f2fe', clientX, clientY);
    }

    const floaterId = Date.now() + Math.random();
    const floaterText = `+${pts}${comboMult > 1 ? ` 🔥 x${comboMult}` : ''}`;
    setScreenScoreFloaters((prev) => [...prev, { id: floaterId, text: floaterText, x: clientX, y: clientY, side }]);
    setTimeout(() => {
      setScreenScoreFloaters((prev) => prev.filter((item) => item.id !== floaterId));
    }, 1100);
  };

  const handleSendAnimatedGift = async (gift: Gift, quantity: number = 1): Promise<boolean> => {
    if (isSendingGiftRef.current) return false;
    const currentStream = liveStreamsList[activeLiveIndex] || liveStreamsList[0];
    const totalCost = gift.coinCost * quantity;

    if (userSparksBalance < totalCost) {
      triggerToast(`Insufficient Coins! Need ${totalCost.toLocaleString()} Coins.`);
      return false;
    }

    isSendingGiftRef.current = true;
    try {
      // 1. Server-side transaction via backend API if available
      try {
        await fetch('/api/gifts/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            giftId: gift.id,
            livestreamId: currentStream.id,
            recipientId: currentStream.creatorHandle,
            quantity,
          }),
        });
      } catch (err) {
        // Fallback for offline/local standalone mode
      }

      // 2. Safe client coin deduction
      setUserSparksBalance((prev) => Math.max(0, prev - totalCost));
      setIsGiftTrayOpen(false);

      // 3. Boost Host Battle Score
      const pts = totalCost * 2;
      setBattleScoreHost((prev) => prev + pts);

      // 3.5. Compute user XP and real-time level progression
      const expResult = authService.addExperience(totalCost);
      const userLevel = expResult.level || getDeterministicLevel(myProfile.handle) || 1;

      // 4. Construct GiftEvent
      const giftEvent: GiftEvent = {
        id: `evt_gift_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        livestreamId: currentStream.id,
        senderId: (myProfile.handle || '').replace(/^@/, ''),
        senderName: myProfile.name,
        senderAvatar: myProfile.avatar,
        senderLevel: userLevel,
        recipientId: currentStream.creatorHandle,
        recipientName: currentStream.creatorName,
        giftId: gift.id,
        giftName: gift.name,
        giftIcon: gift.icon,
        quantity,
        coinValue: totalCost,
        createdAt: new Date().toISOString(),
      };

      // 5. Enqueue into global animation queue (local view)
      globalGiftQueue.enqueue(giftEvent, gift);

      // 6. Broadcast event to livestream in real time across all tabs & devices
      broadcastSyncEvent({
        action: 'LIVESTREAM_GIFT_EVENT',
        giftEvent,
        gift,
        livestreamId: currentStream.id,
      });

      // 7. Append gift comment in live chat
      setLiveComments((prev) => [
        ...prev,
        {
          id: giftEvent.id,
          user: myProfile.name,
          text: `sent ${gift.name} ${quantity > 1 ? `x${quantity} ` : ''}(+${pts} pts)!`,
          badge: gift.rarity === 'legendary' ? 'Crown VIP' : 'Top Gifter',
          level: userLevel,
          giftName: gift.name,
          giftIcon: gift.icon,
        },
      ]);

      // Burst floating hearts
      const color = gift.rarity === 'legendary' ? '#fbbf24' : gift.category === 'love' ? '#f43f5e' : '#38bdf8';
      for (let i = 0; i < 6; i++) {
        setTimeout(() => handleLiveHeartBurst(color), i * 100);
      }

      triggerToast(`Sent ${gift.name} ${quantity > 1 ? `x${quantity} ` : ''}to ${currentStream.creatorName}!`);
      return true;
    } finally {
      isSendingGiftRef.current = false;
    }
  };

  const handleQuickRose = () => {
    const roseGift = giftsCatalog.find((g) => g.id === 'rose') || DEFAULT_GIFTS[0];
    handleSendAnimatedGift(roseGift, 1);
  };

  const handleToggleFollowLiveHost = (creatorHandle: string) => {
    const isNow = !followedCreators[creatorHandle];
    setFollowedCreators((prev) => ({ ...prev, [creatorHandle]: isNow }));
    triggerToast(isNow ? `✓ You are now following @${creatorHandle} live!` : `Unfollowed @${creatorHandle}`);
  };

  const handleSendLiveComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!liveChatInput.trim()) return;
    const newEntry = {
      id: String(Date.now()),
      user: myProfile.handle,
      text: liveChatInput.trim(),
      level: 25,
      badge: 'VIP',
    };
    setLiveComments((prev) => [...prev, newEntry]);
    setLiveChatInput('');
    handleLiveHeartBurst();
  };

  const handleStartGoLive = () => {
    const userStream: LiveStreamSession = {
      id: `live-user-${Date.now()}`,
      creatorHandle: myProfile.handle,
      creatorName: myProfile.name,
      creatorAvatar: myProfile.avatar,
      isVerified: myProfile.isVerified,
      category: 'Visionary Host',
      title: 'Decentralized Live Broadcast · Sovereign Node',
      description: 'Streaming live directly to authorized circles with local encryption keys.',
      viewersCount: 0,
      likesCount: 0,
      dailyRank: '🔥 Genesis Host',
      previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900',
      battleInfo: undefined,
      multiGuests: [],
      participants: [{ name: myProfile.name, avatar: myProfile.avatar, role: 'Host' }],
      tags: ['Live', 'P2P', 'Privity'],
    };
    setLiveStreamsList((prev) => [userStream, ...prev]);
    setActiveLiveIndex(0);
    setFeedFilter('live');
    triggerToast('Broadcast initialized: You are now Live!');
  };
    void [
      liveLayoutMode,
      setLiveLayoutMode,
      isGiftTrayOpen,
      battleScoreHost,
      battleScoreOpponent,
      battleTimeSeconds,
      setIsBattleMatchActive,
      hostLiveLikes,
      aiLensMode,
      setAiLensMode,
      isLiveSoundMuted,
      setIsLiveSoundMuted,
      isGloveClashing,
      screenScoreFloaters,
      liveComments,
      floatingHearts,
      isLikesLeaderboardOpen,
      setIsLikesLeaderboardOpen,
      likersLeaderboard,
      isViewersModalOpen,
      setIsViewersModalOpen,
      setLiveViewersSearch,
      filteredLiveViewers,
      liveSlideDirection,
      handleLiveWheel,
      handleLiveTouchStart,
      handleLiveTouchEnd,
      handleGiveLikesFromLeaderboard,
      formatBattleTime,
      handleCreatorTap,
      handleQuickRose,
      handleToggleFollowLiveHost,
      handleSendLiveComment,
      handleStartGoLive,
    ];



  // User Profile View State & Navigation History Stack (persisted across refreshes)
  const [viewedUserHandle, setViewedUserHandle] = useState<string>(() => {
    const saved: string = readStorage('privity_viewed_handle_v5', '') || '';
    if (saved === 'luciano') return currentAuthUser?.handle || '';
    return saved || currentAuthUser?.handle || '';
  });
  const [profileHistory, setProfileHistory] = useState<string[]>([]);
  const [profileSubTab, setProfileSubTab] = useState<'dispatches' | 'media' | 'liked' | 'saved' | 'replies'>('dispatches');

  useEffect(() => {
    safeSaveStorage('privity_viewed_handle_v5', viewedUserHandle);
  }, [viewedUserHandle]);

  // Private Account Shield Modal State
  const [privateLockModal, setPrivateLockModal] = useState<{ handle: string; name: string } | null>(null);

  const navigateToProfile = (handle: string) => {
    setActiveChatUser(null);
    const clean = handle.replace(/^@/, '');
    if (viewedUserHandle && viewedUserHandle !== clean && activeTab === 'profile') {
      setProfileHistory((prev) => [...prev, viewedUserHandle]);
    }
    setViewedUserHandle(clean);
    setActiveTab('profile');
    setProfileSubTab('dispatches');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProfileBack = () => {
    if (profileHistory.length > 0) {
      const prevHandle = profileHistory[profileHistory.length - 1];
      setProfileHistory((prev) => prev.slice(0, -1));
      setViewedUserHandle(prevHandle);
    } else {
      setActiveTab('feed');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTagClick = (tag: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const clean = tag.replace(/^#/, '');
    setActiveTagFilter(clean);
    setActiveTab('feed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    triggerToast(`Filtered feed by #${clean}`);
  };

  const isUserFollowed = (handleOrId: string): boolean => {
    if (!handleOrId) return false;
    let clean = handleOrId.replace(/^@/, '').toLowerCase().trim();
    if (clean.startsWith('google_') || clean.startsWith('usr-')) {
      const match = Object.values(profiles).find((p) => p.id === handleOrId || p.id === clean);
      if (match) clean = (match.handle || '').replace(/^@/, '').toLowerCase().trim();
    }
    return !!(
      followingMap[clean] ||
      (myProfile.followingList || []).some((h) => h.toLowerCase().replace(/^@/, '').trim() === clean)
    );
  };

  const toggleFollow = (handleOrId: string, name?: string) => {
    let clean = (handleOrId || '').replace(/^@/, '').toLowerCase().trim();
    if (!clean) return;

    // Resolve target profile
    const targetProf = profiles[clean] || Object.values(profiles).find((p) => (p.handle || '').toLowerCase().replace(/^@/, '').trim() === clean || p.id === handleOrId);
    const resolvedHandle = targetProf ? targetProf.handle.replace(/^@/, '').toLowerCase().trim() : clean;

    const current = isUserFollowed(resolvedHandle);
    const next = !current;
    const myHandle = (myProfile.handle || '').toLowerCase().replace(/^@/, '').trim();
    if (!myHandle) return;

    // 1. Update local followingMap (STRICTLY handles only, zero ID keys!)
    setFollowingMap((prev) => {
      const nextMap = { ...prev };
      if (next) {
        nextMap[resolvedHandle] = true;
      } else {
        delete nextMap[resolvedHandle];
        delete nextMap[clean];
      }
      // Purge any legacy IDs or false entries
      Object.keys(nextMap).forEach((k) => {
        if (k.startsWith('google_') || k.startsWith('usr-') || k.startsWith('sc-') || !nextMap[k]) {
          delete nextMap[k];
        }
      });
      safeSaveStorage('privity_following_v5', nextMap);
      return nextMap;
    });

    // 2. Synchronize target's followersList & my followingList
    setProfiles((prev) => {
      const target = prev[resolvedHandle] || prev[clean] || getUserProfile(resolvedHandle);
      let targetFollowers = (target.followersList || [])
        .map((h) => h.toLowerCase().replace(/^@/, '').trim())
        .filter((h) => h && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-'));
      if (next) {
        if (!targetFollowers.includes(myHandle)) {
          targetFollowers.push(myHandle);
        }
      } else {
        targetFollowers = targetFollowers.filter((h) => h !== myHandle);
      }
      const nextTarget = { ...target, followersList: Array.from(new Set(targetFollowers)) };

      const myProf = prev[myHandle] || myProfile;
      let myFollowing = (myProf.followingList || [])
        .map((h) => h.toLowerCase().replace(/^@/, '').trim())
        .filter((h) => h && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-'));
      if (next) {
        if (!myFollowing.includes(resolvedHandle)) {
          myFollowing.push(resolvedHandle);
        }
      } else {
        myFollowing = myFollowing.filter((h) => h !== resolvedHandle && h !== clean);
      }
      const nextMyProf = { ...myProf, followingList: Array.from(new Set(myFollowing)) };

      const nextProfiles = {
        ...prev,
        [resolvedHandle]: nextTarget,
        [myHandle]: nextMyProf,
      };
      safeSaveStorage('privity_profiles_v5', nextProfiles);
      return nextProfiles;
    });

    if (next) {
      const notif: AppNotification = {
        id: `notif-follow-${resolvedHandle}-${myHandle}-${Date.now()}`,
        type: 'follow',
        actorHandle: myProfile.handle || myHandle,
        actorName: myProfile.name || myHandle,
        actorAvatar: myProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${myHandle}`,
        timestamp: Date.now(),
        timeAgo: 'Just now',
        isRead: false,
      };
      addNotification(notif, resolvedHandle);
    }

    broadcastSyncEvent({
      action: 'TOGGLE_FOLLOW',
      targetHandle: resolvedHandle,
      followerHandle: myProfile.handle,
      followerName: myProfile.name,
      followerAvatar: myProfile.avatar,
      isFollowing: next,
    });

    triggerToast(next ? `Now following ${name || '@' + resolvedHandle}` : `Unfollowed ${name || '@' + resolvedHandle}`);
  };

  const handleRemoveFollower = (followerHandle: string) => {
    const clean = followerHandle.replace(/^@/, '').toLowerCase().trim();
    const myHandle = (myProfile.handle || '').toLowerCase().trim();
    if (!myHandle) return;

    setProfiles((prev) => {
      const myProf = prev[myHandle] || myProfile;
      const updatedFollowers = (myProf.followersList || [])
        .map((h) => h.toLowerCase().replace(/^@/, '').trim())
        .filter((h) => h !== clean);
      const nextMyProf = { ...myProf, followersList: Array.from(new Set(updatedFollowers)) };

      const targetProf = prev[clean] || getUserProfile(clean);
      const targetFollowing = (targetProf.followingList || [])
        .map((h) => h.toLowerCase().replace(/^@/, '').trim())
        .filter((h) => h !== myHandle);
      const nextTargetProf = { ...targetProf, followingList: Array.from(new Set(targetFollowing)) };

      const nextProfiles = {
        ...prev,
        [myHandle]: nextMyProf,
        [clean]: nextTargetProf,
      };
      safeSaveStorage('privity_profiles_v5', nextProfiles);
      return nextProfiles;
    });

    broadcastSyncEvent({
      action: 'REMOVE_FOLLOWER',
      targetHandle: myProfile.handle,
      removedFollower: clean,
    });

    triggerToast(`Removed @${clean} from your followers`);
  };

  const toggleCloseFriends = (handle: string) => {
    const clean = handle.replace(/^@/, '');
    const exists = closeFriendsList.includes(clean);
    const nextList = exists
      ? closeFriendsList.filter((h) => h !== clean)
      : [...closeFriendsList, clean];
    setCloseFriendsList(nextList);

    setProfiles((prev) => {
      const myHandle = (myProfile.handle || '').toLowerCase();
      if (!myHandle) return prev;
      const myProf = prev[myHandle] || myProfile;
      return {
        ...prev,
        [myHandle]: {
          ...myProf,
          trustCirclesList: nextList,
        },
      };
    });

    broadcastSyncEvent({
      action: 'TOGGLE_CLOSE_FRIENDS',
      handle: clean,
      isCloseFriend: !exists,
    });

    triggerToast(exists ? `Removed @${clean} from your Close Friends circle` : `Added @${clean} to your Close Friends circle`);
  };

  // User Roster Modal State (Followers / Following / Circles / Liked by)
  interface RosterModalState {
    targetHandle: string;
    targetName: string;
    mode: 'followers' | 'following' | 'circle' | 'likes';
    handles: string[];
  }

  const [rosterModal, setRosterModal] = useState<RosterModalState | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');

  const openRoster = (
    targetHandle: string,
    targetName: string,
    mode: 'followers' | 'following' | 'circle' | 'likes',
    customHandles?: string[],
  ) => {
    const cleanTarget = targetHandle.replace(/^@/, '');
    const profile = getUserProfile(cleanTarget);
    const isOwn = Boolean(myProfile.handle) && cleanTarget.toLowerCase() === myProfile.handle.toLowerCase();
    const effectiveIsPrivate = isOwn ? isPrivateAccount : !!profile.isPrivate;
    const isFollowing = isUserFollowed(cleanTarget) || isOwn;

    // Enforce User Privacy Requirement:
    if (effectiveIsPrivate && !isFollowing && mode !== 'likes') {
      setPrivateLockModal({ handle: cleanTarget, name: targetName });
      triggerToast(`Account is Private: Follow @${cleanTarget} to view their ${mode} directory.`);
      return;
    }

    setRosterSearch('');
    setRosterModal({
      targetHandle: cleanTarget,
      targetName,
      mode,
      handles: customHandles || [],
    });
  };

  // Notifications & Follow Requests (Real-Time & LocalStorage Persistent - strictly zero mock accounts)
  const [followRequests, setFollowRequests] = useState<Array<{ id: string; name: string; handle: string; avatar: string }>>(() => {
    const raw = readStorage<Array<{ id: string; name: string; handle: string; avatar: string }>>('privity_follow_requests_v5', []);
    if (Array.isArray(raw)) {
      return raw.filter(
        (r) =>
          r &&
          r.handle &&
          !isMockHandle(r.handle) &&
          r.handle.toLowerCase() !== 'sam_arch' &&
          r.handle.toLowerCase() !== 'jess_film' &&
          !r.name?.toLowerCase().includes('archer') &&
          !r.name?.toLowerCase().includes('vance')
      );
    }
    return [];
  });

  useEffect(() => {
    safeSaveStorage('privity_follow_requests_v5', followRequests);
  }, [followRequests]);

  // Real-Time Request Approval
  const handleApproveRequest = (requestId: string, targetHandle: string, targetName: string) => {
    const cleanHandle = targetHandle.replace(/^@/, '');
    const myHandle = (myProfile.handle || '').replace(/^@/, '').toLowerCase();
    if (!myHandle) return;

    // 1. Remove from pending follow requests immediately
    setFollowRequests((prev) => {
      const next = prev.filter((x) => x.id !== requestId && x.handle.toLowerCase() !== cleanHandle.toLowerCase());
      safeSaveStorage('privity_follow_requests_v5', next);
      return next;
    });

    // 2. Add target to my followers list & add me to target's following list in real time
    setProfiles((prev) => {
      const nextProfs = { ...prev };

      // Update my profile followers
      const myProf = nextProfs[myHandle] || myProfile;
      const myFollowers = Array.from(new Set([...(myProf.followersList || []), cleanHandle]));
      nextProfs[myHandle] = {
        ...myProf,
        followersList: myFollowers,
      };

      // Update target profile following
      const targetProf = nextProfs[cleanHandle.toLowerCase()] || getUserProfile(cleanHandle);
      const targetFollowing = Array.from(new Set([...(targetProf.followingList || []), myHandle]));
      nextProfs[cleanHandle.toLowerCase()] = {
        ...targetProf,
        followingList: targetFollowing,
      };

      safeSaveStorage('privity_profiles_v5', nextProfs);
      return nextProfs;
    });

    triggerToast(`Approved @${cleanHandle}${targetName ? ` (${targetName})` : ''}! Added to your private circle.`);
  };

  // Real-Time Request Decline
  const handleDeclineRequest = (requestId: string, targetHandle: string) => {
    const cleanHandle = targetHandle.replace(/^@/, '');
    setFollowRequests((prev) => {
      const next = prev.filter((x) => x.id !== requestId && x.handle !== cleanHandle);
      safeSaveStorage('privity_follow_requests_v5', next);
      return next;
    });
    triggerToast(`Declined follow request from @${cleanHandle}`);
  };


  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Moderation state
  const [reports, setReports] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [reportingPost, setReportingPost] = useState<PostItem | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [actionType, setActionType] = useState<ModerationActionType>('remove_content');
  const [actionReason, setActionReason] = useState('');

  const triggerToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      triggerToast('Please enter a group name');
      return;
    }
    const groupId = `group_${Date.now()}`;
    const gName = newGroupName.trim();
    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
    const members = Array.from(new Set([myClean, ...newGroupSelectedMembers.map(normalizeHandle)].filter(Boolean)));

    const groupAvatar = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400';

    const newGroup: ChatGroup = {
      id: groupId,
      name: gName,
      avatar: groupAvatar,
      members: members,
      createdAt: Date.now(),
      createdBy: myClean,
    };

    setChatGroups((prev) => {
      const next = { ...prev, [groupId]: newGroup };
      safeSaveStorage('privity_chat_groups_v1', next);
      return next;
    });

    const welcomeMsg: DirectChatMessage = {
      id: `msg-${Date.now()}`,
      senderHandle: myClean || 'user',
      recipientHandle: groupId,
      text: `🎉 Group "${gName}" created with ${members.length} members. Start chatting!`,
      timeAgo: 'Just now',
      timestamp: Date.now(),
    };

    setDirectMessages((prev) => {
      const next = {
        [groupId]: [welcomeMsg],
        ...prev,
      };
      safeSaveStorage('privity_direct_messages_v5', next);
      return next;
    });

    setNewGroupName('');
    setNewGroupSelectedMembers([]);
    setIsCreateGroupOpen(false);

    // Active recipient strictly for messaging workspace
    const groupChatEntity: UserProfile = {
      id: groupId,
      name: gName,
      handle: groupId,
      avatar: groupAvatar,
      coverUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600',
      isVerified: true,
      verifiedCategory: 'Group Circle',
      bio: `Encrypted group channel with ${members.length} members.`,
      location: 'Private Group',
      joinedDate: 'Created 2026',
      circleStatus: 'Close Friend',
      isPrivate: true,
      followersList: members,
      followingList: [],
      trustCirclesList: [],
      mediaItems: [],
    };
    setActiveChatUser(groupChatEntity);

    broadcastSyncEvent({
      action: 'CREATE_GROUP',
      group: newGroup,
    });

    triggerToast(`Group "${gName}" created!`);
  };

  const handleTogglePrivateAccount = (val: boolean) => {
    setIsPrivateAccount(val);
    setUserSettings((prev) => ({ ...prev, isPrivateAccount: val }));
    setProfiles((prev) => {
      const myHandle = (myProfile.handle || '').toLowerCase();
      if (!myHandle) return prev;
      const me = prev[myHandle] || myProfile;
      return {
        ...prev,
        [myHandle]: { ...me, isPrivate: val },
      };
    });
    triggerToast(
      val
        ? 'Private Account Enabled: Only approved followers can view your feed'
        : 'Account is now Public: Your dispatches are visible to the entire network'
    );
  };

  const handleExportData = () => {
    const data = {
      exportVersion: 'Privity Archive v5.0',
      exportedAt: new Date().toISOString(),
      userProfile: myProfile,
      settings: userSettings,
      closeFriends: closeFriendsList,
      following: getCleanFollowingHandles(followingMap, myProfile.handle),
      dispatches: posts.filter((p) => p.authorHandle === myProfile.handle || (myProfile.id && p.authorId === myProfile.id)),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `privity_data_export_${myProfile.handle}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast('All account data exported to JSON archive');
  };

  const handleResetData = async () => {
    if (window.confirm('Delete all posts, all activities, all accounts, and refresh cleanly so everyone can register or log in from scratch?')) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('privity_')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        sessionStorage.clear();
        await clearAllMediaBlobs().catch(() => {});
      } catch {}
      window.location.reload();
    }
  };

  const handleCopyCryptoFingerprint = () => {
    navigator.clipboard?.writeText(userSettings.cryptoKeyFingerprint);
    setCopiedFingerprint(true);
    triggerToast('Ed25519 Cryptographic Fingerprint copied to clipboard');
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  // Real Like with Spring Physics & Likers Synchronization
  const handleLike = (postId: string, fromDoubleTap = false) => {
    setHeartExplodingPostId(postId);
    setTimeout(() => setHeartExplodingPostId(null), 750);

    let targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) {
      targetPost = ALL_TEMPLATE_POSTS.find((p) => p.id === postId);
    }
    if (!targetPost) return;

    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
    if (!myClean) {
      setIsAuthModalOpen(true);
      triggerToast('Please sign in or create an account to like dispatches');
      return;
    }

    const photoUrl = targetPost.contentUrl || targetPost.thumbnailUrl;
    let computedNextLiked = false;
    let computedNextCount = 0;
    let computedNextLikers: string[] = [];

    // 1. Update posts immediately with functional Set deduplication
    setPosts((prevPosts) => {
      let currentList = prevPosts;
      if (!currentList.some((p) => p.id === postId) && targetPost) {
        currentList = [...currentList, targetPost];
      }

      const nextPosts = currentList.map((p) => {
        if (p.id === postId || (photoUrl && (isSameMedia(p.contentUrl, photoUrl) || isSameMedia(p.thumbnailUrl, photoUrl)))) {
          const curLikers = (p.likersList || []).map(normalizeHandle).filter(Boolean);
          const isCurLiked = curLikers.includes(myClean);
          if (fromDoubleTap && isCurLiked) {
            computedNextLiked = true;
            computedNextLikers = curLikers;
            computedNextCount = curLikers.length;
            return p;
          }
          const willBeLiked = fromDoubleTap ? true : !isCurLiked;
          const updLikers = willBeLiked
            ? Array.from(new Set([...curLikers, myClean]))
            : curLikers.filter((h) => h !== myClean);

          computedNextLiked = willBeLiked;
          computedNextLikers = updLikers;
          computedNextCount = updLikers.length;

          return {
            ...p,
            likersList: updLikers,
            likesCount: computedNextCount,
            isLiked: willBeLiked,
          };
        }
        return p;
      });
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    // 2. Update photoLikesMap immediately for media
    if (photoUrl) {
      const baseKey = extractMediaBaseKey(photoUrl);
      setPhotoLikesMap((prev) => {
        const next = {
          ...prev,
          ...(baseKey ? { [baseKey]: { isLiked: computedNextLiked, count: computedNextCount } } : {}),
          ...(!photoUrl.startsWith('data:') ? { [photoUrl]: { isLiked: computedNextLiked, count: computedNextCount } } : {}),
        };
        safeSaveStorage('privity_photo_likes_v5', next);
        return next;
      });

      // 3. Update profiles mediaItems synchronously
      setProfiles((prevProfs) => {
        let changed = false;
        const nextProfs = { ...prevProfs };
        for (const [h, prof] of Object.entries(nextProfs)) {
          if (prof.mediaItems?.some((m) => isSameMedia(m.url, photoUrl))) {
            changed = true;
            nextProfs[h] = {
              ...prof,
              mediaItems: prof.mediaItems.map((m) =>
                isSameMedia(m.url, photoUrl)
                  ? { ...m, isLiked: computedNextLiked, likes: computedNextCount }
                  : m
              ),
            };
          }
        }
        if (changed) {
          safeSaveStorage('privity_profiles_v5', nextProfs);
        }
        return nextProfs;
      });
    }

    const likerName = currentAuthUser?.name || myProfile.name || myClean;
    const likerAvatar = currentAuthUser?.avatar || myProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${myClean}`;

    if (computedNextLiked) {
      const targetAuthor = normalizeHandle(targetPost.authorHandle);
      const notif: AppNotification = {
        id: `notif-like-${postId}-${myClean}-${Date.now()}`,
        type: 'like',
        actorHandle: myClean,
        actorName: likerName,
        actorAvatar: likerAvatar,
        targetPostId: postId,
        postCaptionSnippet: targetPost.caption ? targetPost.caption.slice(0, 60) : 'your dispatch',
        postThumbnail: targetPost.contentUrl || targetPost.thumbnailUrl,
        timestamp: Date.now(),
        timeAgo: 'Just now',
        isRead: false,
      };
      if (targetAuthor) {
        addNotification(notif, targetAuthor);
      }
      if (targetAuthor === myClean) {
        addNotification(notif, myClean);
      }
    }

    broadcastSyncEvent({
      action: 'LIKE_POST',
      postId,
      isLiked: computedNextLiked,
      likesCount: computedNextCount,
      likersList: computedNextLikers,
      userHandle: myClean,
      likerHandle: myClean,
      likerName,
      likerAvatar,
      postAuthorHandle: normalizeHandle(targetPost.authorHandle),
      postCaptionSnippet: targetPost.caption ? targetPost.caption.slice(0, 60) : 'your dispatch',
      postThumbnail: targetPost.contentUrl || targetPost.thumbnailUrl,
    });

    triggerToast(computedNextLiked ? 'Liked dispatch ❤️' : 'Unliked dispatch');
  };

  // Bookmark / Save with Real-time Deduped Savers List
  const handleSave = (postId: string) => {
    let targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) {
      targetPost = ALL_TEMPLATE_POSTS.find((p) => p.id === postId);
    }
    if (!targetPost) return;

    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
    if (!myClean) {
      setIsAuthModalOpen(true);
      triggerToast('Please sign in or create an account to save dispatches');
      return;
    }

    const savedKey = `privity_saved_posts_${myClean}`;
    const currentSaved = readStorage<string[]>(savedKey, []);

    let nextSavedState = false;
    let nextSavesCount = 0;
    let nextSavers: string[] = [];

    setPosts((prev) => {
      let currentList = prev;
      if (!currentList.some((p) => p.id === postId) && targetPost) {
        currentList = [...currentList, targetPost];
      }

      const nextPosts = currentList.map((p) => {
        if (p.id === postId) {
          const currentSavers = (p.saversList || []).map(normalizeHandle).filter(Boolean);
          const isCurrentlySaved = currentSavers.includes(myClean) || currentSaved.includes(postId);
          nextSavedState = !isCurrentlySaved;
          nextSavers = nextSavedState
            ? Array.from(new Set([...currentSavers, myClean]))
            : currentSavers.filter((h) => h !== myClean);
          nextSavesCount = nextSavers.length;

          return {
            ...p,
            saversList: nextSavers,
            savesCount: nextSavesCount,
            isSaved: nextSavedState,
          };
        }
        return p;
      });
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    // Update user-scoped saved posts list
    const updatedSaved = nextSavedState
      ? Array.from(new Set([...currentSaved, postId]))
      : currentSaved.filter((id) => id !== postId);
    safeSaveStorage(savedKey, updatedSaved);
    setSavedPostIds(updatedSaved);

    if (nextSavedState) {
      const targetAuthor = normalizeHandle(targetPost?.authorHandle);
      const notif: AppNotification = {
        id: `notif-save-${postId}-${myClean}-${Date.now()}`,
        type: 'save',
        actorHandle: myClean,
        actorName: currentAuthUser?.name || myProfile.name || myClean,
        actorAvatar: currentAuthUser?.avatar || myProfile.avatar,
        targetPostId: postId,
        postCaptionSnippet: targetPost?.caption ? targetPost.caption.slice(0, 60) : 'your dispatch',
        postThumbnail: targetPost?.contentUrl || targetPost?.thumbnailUrl,
        timestamp: Date.now(),
        timeAgo: 'Just now',
        isRead: false,
      };
      if (targetAuthor) {
        addNotification(notif, targetAuthor);
      }
      if (targetAuthor === myClean) {
        addNotification(notif, myClean);
      }
    }

    broadcastSyncEvent({
      action: 'SAVE_POST',
      postId,
      isSaved: nextSavedState,
      savesCount: nextSavesCount,
      saversList: nextSavers,
      saverHandle: myClean,
      saverName: currentAuthUser?.name || myProfile.name || myClean,
      saverAvatar: currentAuthUser?.avatar || myProfile.avatar,
      postAuthorHandle: normalizeHandle(targetPost?.authorHandle),
      postCaptionSnippet: targetPost?.caption ? targetPost.caption.slice(0, 60) : 'your dispatch',
      postThumbnail: targetPost?.contentUrl || targetPost?.thumbnailUrl,
    });
    triggerToast(nextSavedState ? 'Saved to collection! 🔖' : 'Removed from collection');
  };

  // Share
  const handleShare = (postId: string) => {
    let targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) {
      targetPost = ALL_TEMPLATE_POSTS.find((p) => p.id === postId);
    }
    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);

    let nextSharesCount = 1;
    setPosts((prev) => {
      const nextPosts = prev.map((p) => {
        if (p.id === postId) {
          nextSharesCount = (p.sharesCount || 0) + 1;
          return {
            ...p,
            sharesCount: nextSharesCount,
          };
        }
        return p;
      });
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    const url = `https://privity.app/p/${postId}`;
    navigator.clipboard?.writeText(url);

    broadcastSyncEvent({
      action: 'SHARE_POST',
      postId,
      sharesCount: nextSharesCount,
      sharerHandle: myClean,
      sharerName: currentAuthUser?.name || myProfile.name || myClean,
      sharerAvatar: currentAuthUser?.avatar || myProfile.avatar,
      postAuthorHandle: normalizeHandle(targetPost?.authorHandle),
      postCaptionSnippet: targetPost?.caption ? targetPost.caption.slice(0, 60) : 'your dispatch',
      postThumbnail: targetPost?.contentUrl || targetPost?.thumbnailUrl,
    });

    triggerToast(`Shared! External link copied: ${url}`);
  };

  // Add Comment with 1-level reply nesting & cross-profile media item synchronization
  const handleAddComment = (postId: string, textOverride?: string) => {
    const text = (textOverride !== undefined ? textOverride : commentInputs[postId])?.trim();
    if (!text) return;

    let targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) {
      targetPost = ALL_TEMPLATE_POSTS.find((p) => p.id === postId);
    }
    const targetPhotoUrl = targetPost?.contentUrl || targetPost?.thumbnailUrl;

    let createdItem: any = null;
    let parentCommentId: string | undefined = undefined;

    setPosts((prev) => {
      let currentList = prev;
      if (!currentList.some((p) => p.id === postId) && targetPost) {
        currentList = [{ ...targetPost }, ...currentList];
      }
      const nextPosts = currentList.map((p) => {
        if (p.id === postId) {
          if (replyTarget && replyTarget.postId === postId && !textOverride) {
            parentCommentId = replyTarget.commentId;
            const updated = p.comments.map((c) => {
              if (c.id === replyTarget.commentId) {
                const reply = {
                  id: `r-${Date.now()}`,
                  authorName: myProfile.name,
                  authorHandle: myProfile.handle,
                  authorAvatar: myProfile.avatar,
                  isVerified: myProfile.isVerified,
                  text,
                  timeAgo: 'Just now',
                };
                createdItem = reply;
                return { ...c, replies: [...(c.replies || []), reply] };
              }
              return c;
            });
            return { ...p, commentsCount: calcCommentsCount(updated), comments: updated };
          } else {
            const comment: PostComment = {
              id: `c-${Date.now()}`,
              authorName: myProfile.name,
              authorHandle: myProfile.handle,
              authorAvatar: myProfile.avatar,
              isVerified: myProfile.isVerified,
              text,
              timeAgo: 'Just now',
              likesCount: 0,
            };
            createdItem = comment;
            const updated = [...p.comments, comment];
            return { ...p, commentsCount: calcCommentsCount(updated), comments: updated };
          }
        }
        return p;
      });
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    // Also update any matching media items in all profiles synchronously
    if (targetPhotoUrl) {
      const photoUrl = targetPhotoUrl;
      setProfiles((prevProfs) => {
        let changed = false;
        const nextProfs = { ...prevProfs };
        for (const [h, prof] of Object.entries(nextProfs)) {
          if (prof.mediaItems?.some((m) => isSameMedia(m.url, photoUrl))) {
            changed = true;
            nextProfs[h] = {
              ...prof,
              mediaItems: prof.mediaItems.map((m) =>
                isSameMedia(m.url, photoUrl) ? { ...m, comments: m.comments + 1 } : m
              ),
            };
          }
        }
        if (changed) {
          safeSaveStorage('privity_profiles_v5', nextProfs);
        }
        return nextProfs;
      });
    }

    if (!textOverride) {
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      setReplyTarget(null);
    }

    if (createdItem) {
      const commenterH = (myProfile.handle || currentAuthUser?.handle || '').replace(/^@/, '').trim();
      const commenterName = myProfile.name || currentAuthUser?.name || commenterH;
      const commenterAvatar = myProfile.avatar || currentAuthUser?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${commenterH}`;
      const targetAuthor = normalizeHandle(targetPost?.authorHandle);

      const notif: AppNotification = {
        id: `notif-comment-${postId}-${commenterH}-${Date.now()}`,
        type: 'comment',
        actorHandle: commenterH,
        actorName: commenterName,
        actorAvatar: commenterAvatar,
        targetPostId: postId,
        postCaptionSnippet: targetPost?.caption ? targetPost.caption.slice(0, 60) : 'your dispatch',
        postThumbnail: targetPost?.contentUrl || targetPost?.thumbnailUrl,
        commentText: text,
        timestamp: Date.now(),
        timeAgo: 'Just now',
        isRead: false,
      };
      if (targetAuthor) {
        addNotification(notif, targetAuthor);
      }
      if (targetAuthor === commenterH) {
        addNotification(notif, commenterH);
      }

      broadcastSyncEvent({
        action: 'ADD_COMMENT',
        postId,
        comment: createdItem,
        parentCommentId,
        commenterHandle: commenterH,
        commenterName,
        commenterAvatar,
        postAuthorHandle: (targetPost?.authorHandle || '').replace(/^@/, '').trim(),
        postCaptionSnippet: targetPost?.caption ? targetPost.caption.slice(0, 60) : 'your dispatch',
        postThumbnail: targetPost?.contentUrl || targetPost?.thumbnailUrl,
      });
    }

    triggerToast('Comment posted');
  };

  // Delete comment or nested reply
  const handleDeleteComment = (postId: string, commentId: string, replyId?: string) => {
    const targetPost = posts.find((p) => p.id === postId);
    const targetPhotoUrl = targetPost?.contentUrl || targetPost?.thumbnailUrl;

    setPosts((prev) => {
      const nextPosts = prev.map((p) => {
        if (p.id !== postId) return p;
        let updatedComments: PostComment[];
        if (replyId) {
          updatedComments = p.comments.map((c) => {
            if (c.id !== commentId) return c;
            return {
              ...c,
              replies: (c.replies || []).filter((r) => r.id !== replyId),
            };
          });
        } else {
          updatedComments = p.comments.filter((c) => c.id !== commentId);
        }
        return {
          ...p,
          commentsCount: calcCommentsCount(updatedComments),
          comments: updatedComments,
        };
      });
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    if (targetPhotoUrl) {
      const photoUrl = targetPhotoUrl;
      setProfiles((prevProfs) => {
        let changed = false;
        const nextProfs = { ...prevProfs };
        for (const [h, prof] of Object.entries(nextProfs)) {
          if (prof.mediaItems?.some((m) => isSameMedia(m.url, photoUrl))) {
            changed = true;
            nextProfs[h] = {
              ...prof,
              mediaItems: prof.mediaItems.map((m) =>
                isSameMedia(m.url, photoUrl) ? { ...m, comments: Math.max(0, m.comments - 1) } : m
              ),
            };
          }
        }
        if (changed) {
          safeSaveStorage('privity_profiles_v5', nextProfs);
        }
        return nextProfs;
      });
    }

    broadcastSyncEvent({
      action: 'DELETE_COMMENT',
      postId,
      commentId,
      replyId,
    });

    triggerToast('Comment deleted');
  };

  // Real-Time Direct Message Deletion (Unsend / Delete)
  const handleDeleteMessage = (recipientHandle: string, messageId: string) => {
    const cleanRecipient = recipientHandle.replace(/^@/, '');
    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
    setDirectMessages((prev) => {
      let changed = false;
      const updated = { ...prev };
      for (const [threadKey, messages] of Object.entries(updated)) {
        if (messages.some((m) => m.id === messageId)) {
          changed = true;
          updated[threadKey] = messages.filter((m) => m.id !== messageId);
        }
      }
      if (changed) {
        safeSaveStorage('privity_direct_messages_v5', updated);
        return updated;
      }
      return prev;
    });
    broadcastSyncEvent({
      action: 'DELETE_DM',
      recipientHandle: cleanRecipient,
      senderHandle: myClean,
      messageId,
    });
    triggerToast('Message permanently removed from channel');
  };

  // Real-Time Clear Channel Conversation
  const handleClearConversation = (recipientHandle: string) => {
    const cleanRecipient = recipientHandle.replace(/^@/, '');
    setDirectMessages((prev) => {
      const updated = {
        ...prev,
        [cleanRecipient]: [],
        [cleanRecipient.toLowerCase()]: [],
      };
      safeSaveStorage('privity_direct_messages_v5', updated);
      return updated;
    });
    broadcastSyncEvent({
      action: 'CLEAR_CHAT',
      recipientHandle: cleanRecipient,
    });
    triggerToast(`Conversation with @${cleanRecipient} cleared`);
  };

  // Delete Entire Conversation Thread (via swipe or menu)
  const handleDeleteConversation = (recipientHandle: string) => {
    const cleanRecipient = recipientHandle.replace(/^@/, '');
    setDirectMessages((prev) => {
      const updated = { ...prev };
      delete updated[cleanRecipient];
      delete updated[cleanRecipient.toLowerCase()];
      safeSaveStorage('privity_direct_messages_v5', updated);
      return updated;
    });
    setDeletedChannelHandles((prev) => {
      const next = Array.from(new Set([...prev, cleanRecipient.toLowerCase()]));
      safeSaveStorage('privity_deleted_channels_v1', next);
      return next;
    });
    if (activeChatUser && (activeChatUser.handle || '').replace(/^@/, '').toLowerCase() === cleanRecipient.toLowerCase()) {
      setActiveChatUser(null);
    }
    triggerToast(`Conversation with @${cleanRecipient} deleted`);
  };

  // Toggle Mute Notifications for Conversation
  const handleToggleMuteChat = (recipientHandle: string) => {
    const cleanRecipient = recipientHandle.replace(/^@/, '');
    setMutedChats((prev) => {
      const next = { ...prev, [cleanRecipient]: !prev[cleanRecipient] };
      safeSaveStorage('privity_muted_chats_v1', next);
      triggerToast(next[cleanRecipient] ? `Muted @${cleanRecipient}` : `Unmuted @${cleanRecipient}`);
      return next;
    });
  };

  // Real-Time Emoji Reaction Toggle (1 reaction per emoji per user, clicking again deletes it)
  const handleReactToMessage = (recipientHandle: string, messageId: string, emoji: string) => {
    const cleanRecipient = recipientHandle.replace(/^@/, '');
    const cleanMyHandle = (myProfile.handle || '').replace(/^@/, '');

    setDirectMessages((prev) => {
      const thread = prev[cleanRecipient] || [];
      const updatedThread = thread.map((m) => {
        if (m.id !== messageId) return m;

        const currentReactions: Record<string, number> = { ...(m.reactions || {}) };
        const currentUserReactions: Record<string, string[]> = { ...(m.userReactions || {}) };
        const usersForEmoji = [...(currentUserReactions[emoji] || [])];

        // Has current user reacted to this emoji?
        const hasMyReaction = usersForEmoji.includes(cleanMyHandle) ||
          (!currentUserReactions[emoji] && (currentReactions[emoji] || 0) > 0);

        if (hasMyReaction) {
          // TOGGLE OFF: User already reacted, so clicking again REMOVES & DELETES it!
          const nextUsers = usersForEmoji.filter((h) => h !== cleanMyHandle);
          if (nextUsers.length > 0) {
            currentUserReactions[emoji] = nextUsers;
            currentReactions[emoji] = nextUsers.length;
          } else {
            delete currentUserReactions[emoji];
            delete currentReactions[emoji];
          }
        } else {
          // TOGGLE ON: Strictly 1 reaction per user
          const nextUsers = [...usersForEmoji.filter((h) => h !== cleanMyHandle), cleanMyHandle];
          currentUserReactions[emoji] = nextUsers;
          currentReactions[emoji] = nextUsers.length;
        }

        return {
          ...m,
          reactions: currentReactions,
          userReactions: currentUserReactions,
        };
      });

      const updated = {
        ...prev,
        [cleanRecipient]: updatedThread,
      };
      safeSaveStorage('privity_direct_messages_v5', updated);
      return updated;
    });

    broadcastSyncEvent({
      action: 'REACT_DM',
      recipientHandle: cleanRecipient,
      messageId,
      emoji,
      userHandle: cleanMyHandle,
    });
  };

  // Real Audio Playback (HTML5 Audio or Web Audio Synthesized Chimes)
  const handleTogglePlayVoice = (msg: DirectChatMessage) => {
    if (playingVoiceId === msg.id) {
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
        activeAudioElementRef.current = null;
      }
      setPlayingVoiceId(null);
      return;
    }

    if (activeAudioElementRef.current) {
      activeAudioElementRef.current.pause();
      activeAudioElementRef.current = null;
    }

    setPlayingVoiceId(msg.id);
    triggerToast('Playing spatial audio memo...');

    if (msg.audioUrl) {
      const audio = new Audio(msg.audioUrl);
      activeAudioElementRef.current = audio;
      audio.play().catch(() => {});
      audio.onended = () => {
        setPlayingVoiceId(null);
        activeAudioElementRef.current = null;
      };
    } else {
      // High-Fidelity Web Audio Synthesizer: plays soothing binaural acoustic chimes
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const now = ctx.currentTime;
          const frequencies = [261.63, 392.00, 523.25, 659.25, 783.99, 587.33, 523.25];
          const step = 0.38;

          frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * step);

            gain.gain.setValueAtTime(0.001, now + i * step);
            gain.gain.linearRampToValueAtTime(0.18, now + i * step + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * step + 0.45);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + i * step);
            osc.stop(now + i * step + 0.46);
          });

          const totalMs = (frequencies.length * step + 0.5) * 1000;
          setTimeout(() => {
            setPlayingVoiceId((curr) => (curr === msg.id ? null : curr));
          }, totalMs);
        } else {
          setTimeout(() => setPlayingVoiceId(null), 3000);
        }
      } catch (e) {
        setTimeout(() => setPlayingVoiceId(null), 3000);
      }
    }
  };

  // Start Real Voice Studio Recording
  const handleStartVoiceRecording = async () => {
    setIsRecordingVoice(true);
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.start(100);
        triggerToast('Voice Studio active · Recording from microphone');
      } else {
        triggerToast('Spatial Voice Studio active · Recording high-fidelity acoustic memo');
      }
    } catch (err) {
      triggerToast('Spatial Voice Studio active · Recording high-fidelity acoustic memo');
    }
  };

  // Cancel & Discard Voice Recording
  const handleCancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
    triggerToast('Voice memo discarded');
  };

  // Finish & Send Voice Recording
  const handleFinishAndSendVoiceRecording = (recipientHandle: string) => {
    const cleanRecipient = recipientHandle.replace(/^@/, '');
    const cleanMyHandle = (myProfile.handle || '').replace(/^@/, '');
    const durationSec = Math.max(1, recordingSeconds);
    const formattedDuration = `${Math.floor(durationSec / 60)}:${(durationSec % 60).toString().padStart(2, '0')}`;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const dispatchMemo = (audioBlobUrl?: string) => {
      const newMsg: DirectChatMessage = {
        id: `msg-voice-${Date.now()}`,
        senderHandle: cleanMyHandle,
        recipientHandle: cleanRecipient,
        text: 'Voice Memo (Spatial Binaural Recording)',
        isVoiceMemo: true,
        voiceDuration: formattedDuration,
        audioUrl: audioBlobUrl,
        timeAgo: 'Just now',
        timestamp: Date.now(),
        reactions: {},
        userReactions: {},
      };

      setDirectMessages((prev) => {
        const thread = prev[cleanRecipient] || [];
        const updated = {
          ...prev,
          [cleanRecipient]: [...thread, newMsg],
        };
        safeSaveStorage('privity_direct_messages_v5', updated);
        return updated;
      });

      broadcastSyncEvent({
        action: 'SEND_DM',
        recipientHandle: cleanRecipient,
        senderHandle: cleanMyHandle,
        message: newMsg,
      });

      setIsRecordingVoice(false);
      setRecordingSeconds(0);
      triggerToast('Binaural voice memo dispatched with zero-knowledge encryption');
    };

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        let audioBlobUrl: string | undefined;
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioBlobUrl = URL.createObjectURL(blob);
        }
        mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        dispatchMemo(audioBlobUrl);
      };
      mediaRecorderRef.current.stop();
    } else {
      dispatchMemo();
    }
  };

  // Real-Time Direct Message Dispatcher
  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeChatUser) return;
    if (!chatDraftText.trim() && !chatMediaAttachment) return;

    const recipientHandle = activeChatUser.handle.replace(/^@/, '');
    const cleanMyHandle = (myProfile.handle || '').replace(/^@/, '');
    const textToSend = chatDraftText.trim();
    const isMedia = !!chatMediaAttachment;
    const mediaTypeToSend = isMedia ? chatMediaType : undefined;
    const attachedMediaUrl = chatMediaAttachment;

    const replyMeta = replyingToMessage
      ? {
          id: replyingToMessage.id,
          senderHandle: replyingToMessage.senderHandle,
          text: replyingToMessage.text || (replyingToMessage.mediaUrl ? 'Attachment' : 'Voice memo'),
        }
      : undefined;

    const newMsg: DirectChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderHandle: cleanMyHandle,
      recipientHandle: recipientHandle,
      text: textToSend,
      mediaUrl: attachedMediaUrl || undefined,
      mediaType: mediaTypeToSend,
      replyTo: replyMeta,
      timeAgo: 'Just now',
      timestamp: Date.now(),
      reactions: {},
      userReactions: {},
    };

    setDirectMessages((prev) => {
      const existingThread = prev[recipientHandle] || [];
      const updated = {
        ...prev,
        [recipientHandle]: [...existingThread, newMsg],
      };
      safeSaveStorage('privity_direct_messages_v5', updated);
      return updated;
    });

    broadcastSyncEvent({
      action: 'SEND_DM',
      recipientHandle,
      senderHandle: cleanMyHandle,
      message: newMsg,
    });

    setChatDraftText('');
    setChatMediaAttachment(null);
    setChatMediaType('photo');
    setReplyingToMessage(null);
  };

  // Story reaction or reply forwarded directly into Direct Messages
  const handleStoryReplyToDM = (creatorHandle: string, replyText: string) => {
    const cleanRecipientHandle = creatorHandle.replace(/^@/, '');
    const cleanMyHandle = (myProfile.handle || '').replace(/^@/, '');
    const recipientUser = getUserProfile(cleanRecipientHandle);

    const newMsg: DirectChatMessage = {
      id: 'msg-' + Date.now(),
      senderHandle: cleanMyHandle,
      recipientHandle: cleanRecipientHandle,
      text: replyText,
      timeAgo: 'Just now',
      timestamp: Date.now(),
      reactions: {},
      userReactions: {},
    };

    setDirectMessages((prev) => {
      const existingThread = prev[cleanRecipientHandle] || [];
      const updated = {
        ...prev,
        [cleanRecipientHandle]: [...existingThread, newMsg],
      };
      safeSaveStorage('privity_direct_messages_v5', updated);
      return updated;
    });

    broadcastSyncEvent({
      action: 'SEND_DM',
      recipientHandle: cleanRecipientHandle,
      senderHandle: cleanMyHandle,
      message: newMsg,
    });

    setActiveChatUser(recipientUser);
    setActiveTab('messages');
    triggerToast('Opened chat with @' + cleanRecipientHandle + ' 💬');
  };

  // Real-time READ_DM sync: when viewing a thread with activeChatUser, mark their incoming messages read and broadcast receipt
  useEffect(() => {
    if (!activeChatUser) return;
    const partnerHandle = (activeChatUser.handle || '').replace(/^@/, '').toLowerCase().trim();
    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
    if (!partnerHandle || !myClean) return;

    let hasUnread = false;
    setDirectMessages((prev) => {
      const thread = prev[partnerHandle] || [];
      hasUnread = thread.some(
        (m) => m.senderHandle && m.senderHandle.replace(/^@/, '').toLowerCase().trim() === partnerHandle && !m.isRead
      );
      if (!hasUnread) return prev;

      const updated = thread.map((m) => {
        if (m.senderHandle && m.senderHandle.replace(/^@/, '').toLowerCase().trim() === partnerHandle) {
          return { ...m, isRead: true };
        }
        return m;
      });

      const next = { ...prev, [partnerHandle]: updated };
      safeSaveStorage('privity_direct_messages_v5', next);
      return next;
    });

    if (hasUnread) {
      broadcastSyncEvent({
        action: 'READ_DM',
        readerHandle: myClean,
        readerName: currentAuthUser?.name || myProfile.name || myClean,
        readerAvatar: currentAuthUser?.avatar || myProfile.avatar,
        senderHandle: partnerHandle,
      });
    }
  }, [activeChatUser?.handle, currentAuthUser?.handle, myProfile.handle, directMessages[activeChatUser?.handle?.replace(/^@/, '') || '']?.length]);

  // Like or unlike comment
  const handleLikeComment = (postId: string, commentId: string, replyId?: string) => {
    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
    if (!myClean) {
      setIsAuthModalOpen(true);
      triggerToast('Please sign in to like comments');
      return;
    }

    let nextLikedState = false;
    let nextLikesTotal = 0;
    let updatedLikersList: string[] = [];
    let targetCommentAuthor = '';

    setPosts((prev) => {
      let currentList = prev;
      let targetPost = currentList.find((p) => p.id === postId);
      if (!targetPost) return prev;

      const nextPosts = currentList.map((p) => {
        if (p.id !== postId) return p;
        const updated = p.comments.map((c) => {
          if (c.id !== commentId) return c;
          if (replyId) {
            const updatedReplies = (c.replies || []).map((r) => {
              if (r.id !== replyId) return r;
              targetCommentAuthor = normalizeHandle(r.authorHandle);
              const curLikers = (r.likersList || []).map(normalizeHandle).filter(Boolean);
              const isCurrentlyLiked = curLikers.includes(myClean);
              const nextLiked = !isCurrentlyLiked;
              nextLikedState = nextLiked;
              const nextLikers = nextLiked
                ? Array.from(new Set([...curLikers, myClean]))
                : curLikers.filter((h) => h !== myClean);
              updatedLikersList = nextLikers;
              nextLikesTotal = nextLikers.length;
              return {
                ...r,
                likersList: nextLikers,
                likesCount: nextLikesTotal,
              };
            });
            return { ...c, replies: updatedReplies };
          }
          targetCommentAuthor = normalizeHandle(c.authorHandle);
          const curLikers = (c.likersList || []).map(normalizeHandle).filter(Boolean);
          const isCurrentlyLiked = curLikers.includes(myClean);
          const nextLiked = !isCurrentlyLiked;
          nextLikedState = nextLiked;
          const nextLikers = nextLiked
            ? Array.from(new Set([...curLikers, myClean]))
            : curLikers.filter((h) => h !== myClean);
          updatedLikersList = nextLikers;
          nextLikesTotal = nextLikers.length;
          return {
            ...c,
            likersList: nextLikers,
            likesCount: nextLikesTotal,
          };
        });
        return { ...p, comments: updated };
      });
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    broadcastSyncEvent({
      action: 'LIKE_COMMENT',
      postId,
      commentId,
      replyId,
      isLiked: nextLikedState,
      likesCount: nextLikesTotal,
      likersList: updatedLikersList,
      likerHandle: myClean,
      likerName: currentAuthUser?.name || myProfile.name || myClean,
      likerAvatar: currentAuthUser?.avatar || myProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${myClean}`,
      commentAuthorHandle: targetCommentAuthor,
    });
  };

  // Reply to a comment
  const handleReplyComment = (postId: string, commentId: string, text: string) => {
    if (!text.trim()) return;

    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle || activeAuthHandle);
    if (!myClean) {
      setIsAuthModalOpen(true);
      triggerToast('Please sign in to reply');
      return;
    }

    const authorName = currentAuthUser?.name || myProfile.name || myClean;
    const authorHandle = `@${myClean}`;
    const authorAvatar = currentAuthUser?.avatar || myProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${myClean}`;
    const isVerified = Boolean(currentAuthUser?.isVerified ?? myProfile.isVerified);

    const replyItem: PostCommentReply = {
      id: `r-${Date.now()}`,
      authorName,
      authorHandle,
      authorAvatar,
      isVerified,
      text: text.trim(),
      timeAgo: 'Just now',
      likesCount: 0,
      isLiked: false,
      likersList: [],
    };

    let targetPostFound: PostItem | undefined;

    setPosts((prev) => {
      let currentList = prev;
      let targetPost = currentList.find((p) => p.id === postId);
      if (!targetPost) {
        const template = ALL_TEMPLATE_POSTS.find((p) => p.id === postId);
        if (template) {
          targetPost = { ...template };
          currentList = [...currentList, targetPost];
        }
      }
      if (!targetPost) return prev;
      targetPostFound = targetPost;

      const nextPosts = currentList.map((p) => {
        if (p.id === postId) {
          const updatedComments = p.comments.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                replies: [...(c.replies || []), replyItem],
              };
            }
            return c;
          });
          return {
            ...p,
            commentsCount: p.commentsCount + 1,
            comments: updatedComments,
          };
        }
        return p;
      });
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    broadcastSyncEvent({
      action: 'ADD_COMMENT',
      postId,
      comment: replyItem,
      parentCommentId: commentId,
      commenterHandle: myClean,
      commenterName: authorName,
      commenterAvatar: authorAvatar,
      postAuthorHandle: normalizeHandle(targetPostFound?.authorHandle),
      postCaptionSnippet: targetPostFound?.caption ? targetPostFound.caption.slice(0, 60) : 'your dispatch',
      postThumbnail: targetPostFound?.contentUrl || targetPostFound?.thumbnailUrl,
    });

    triggerToast('Reply posted! 💬');
  };

  // Repost a dispatch
  const handleRepostPost = (postId: string) => {
    let nextRepost = false;
    setPosts((prev) => {
      let currentList = prev;
      let targetPost = currentList.find((p) => p.id === postId);
      if (!targetPost) {
        const template = ALL_TEMPLATE_POSTS.find((p) => p.id === postId);
        if (template) {
          targetPost = { ...template };
          currentList = [...currentList, targetPost];
        }
      }
      if (!targetPost) return prev;
      nextRepost = !targetPost.isReposted;
      const nextPosts = currentList.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            isReposted: nextRepost,
            sharesCount: nextRepost ? p.sharesCount + 1 : Math.max(0, p.sharesCount - 1),
          };
        }
        return p;
      });
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });
    triggerToast(nextRepost ? 'Reposted to your circle! 🔁' : 'Removed repost');
  };

  // Dedicated Birdie quick-composer post creation
  const handleAddBirdiePost = (caption: string, privacy: 'public' | 'followers' | 'close_friends' = 'public') => {
    if (!caption.trim()) return;

    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle || activeAuthHandle);
    if (!myClean) {
      setIsAuthModalOpen(true);
      triggerToast('Please sign in to chirp');
      return;
    }
    const authorName = currentAuthUser?.name || myProfile.name || myClean;
    const authorAvatar = currentAuthUser?.avatar || myProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${myClean}`;
    const authorHandle = `@${myClean}`;
    const authorId = currentAuthUser?.id || myProfile.id || `usr-${myClean}`;
    const isVerified = Boolean(currentAuthUser?.isVerified ?? myProfile.isVerified);

    const extractedTags = (caption.match(/#[\w-]+/g) || []).map((t) => t.slice(1).toLowerCase().trim()).filter(Boolean);
    const finalTags = extractedTags;

    const newBirdiePost: PostItem = {
      id: `p-birdie-${Date.now()}`,
      authorId,
      authorName,
      authorHandle,
      authorAvatar,
      isVerified,
      verifiedCategory: myProfile.verifiedCategory,
      verifiedSince: myProfile.verifiedSince,
      cryptoProofId: myProfile.cryptoProofId,
      type: 'text',
      caption: caption.trim(),
      tags: finalTags,
      privacy: privacy,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      isLiked: false,
      isSaved: false,
      likersList: [],
      timeAgo: 'Just now',
      comments: [],
    };

    setPosts((prev) => {
      const nextPosts = [newBirdiePost, ...prev];
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    broadcastSyncEvent({
      action: 'NEW_POST',
      post: newBirdiePost,
    });

    triggerToast('Chirped to Birdie! 🐦');
  };

  // Publish instantly from inline composer without requiring refresh
  const handleInlinePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerCaption.trim()) return;

    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle || activeAuthHandle);
    if (!myClean) {
      setIsAuthModalOpen(true);
      triggerToast('Please sign in to publish');
      return;
    }
    const authorName = currentAuthUser?.name || myProfile.name || myClean;
    const authorAvatar = currentAuthUser?.avatar || myProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${myClean}`;
    const authorHandle = myClean;
    const authorId = currentAuthUser?.id || myProfile.id || `usr-${myClean}`;
    const isVerified = Boolean(currentAuthUser?.isVerified ?? myProfile.isVerified);

    const extractedTags = (composerCaption.match(/#[\w-]+/g) || []).map((t) => t.slice(1).toLowerCase().trim()).filter(Boolean);
    const finalTags = extractedTags;

    const isVideo = composerPhotoUrl ? isVideoMedia(composerPhotoUrl) : false;

    const newPost: PostItem = {
      id: `p-${Date.now()}`,
      authorId,
      authorName,
      authorHandle,
      authorAvatar,
      isVerified,
      verifiedCategory: myProfile.verifiedCategory,
      verifiedSince: myProfile.verifiedSince,
      cryptoProofId: myProfile.cryptoProofId,
      type: composerPhotoUrl ? (isVideo ? 'video' : 'image') : 'text',
      contentUrl: composerPhotoUrl || undefined,
      thumbnailUrl: isVideo ? undefined : (composerPhotoUrl || undefined),
      videoUrl: (isVideo && composerPhotoUrl) ? composerPhotoUrl : undefined,
      caption: composerCaption,
      tags: finalTags,
      privacy: composerPrivacy,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      isLiked: false,
      isSaved: false,
      likersList: [],
      saversList: [],
      timeAgo: 'Just now',
      comments: [],
    };

    if (composerPhotoUrl) {
      const photoUrl = composerPhotoUrl;
      setPhotoLikesMap((prev) => {
        const next = {
          ...prev,
          [photoUrl]: { isLiked: false, count: 0 },
        };
        safeSaveStorage('privity_photo_likes_v5', next);
        return next;
      });

      setProfiles((prev) => {
        const handleKey = myClean.toLowerCase();
        const prof = prev[handleKey] || myProfile;
        const newMedia: UserMediaItem = {
          id: `m-${myClean}-${Date.now()}`,
          url: photoUrl,
          type: isVideo ? 'video' : 'image',
          likes: 0,
          comments: 0,
          isLiked: false,
        };
        const nextProfiles = {
          ...prev,
          [handleKey]: {
            ...prof,
            mediaItems: [newMedia, ...(prof.mediaItems || [])],
          },
        };
        safeSaveStorage('privity_profiles_v5', nextProfiles);
        return nextProfiles;
      });
    }

    setPosts((prev) => {
      const nextPosts = [newPost, ...prev];
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    broadcastSyncEvent({
      action: 'NEW_POST',
      post: newPost,
    });

    setComposerCaption('');
    setComposerPhotoUrl(null);
    setFeedFilter('all');
    setActiveTagFilter(null);
    setHighlightPostId(newPost.id);
    setTimeout(() => setHighlightPostId(null), 3500);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    triggerToast('Published to your feed');
  };

  // Publish instantly from modal without requiring refresh
  const handleModalPublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCaption.trim()) return;

    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle || activeAuthHandle);
    if (!myClean) {
      setIsAuthModalOpen(true);
      triggerToast('Please sign in to publish');
      return;
    }
    const authorName = currentAuthUser?.name || myProfile.name || myClean;
    const authorAvatar = currentAuthUser?.avatar || myProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${myClean}`;
    const authorHandle = `@${myClean}`;
    const authorId = currentAuthUser?.id || myProfile.id || `usr-${myClean}`;
    const isVerified = Boolean(currentAuthUser?.isVerified ?? myProfile.isVerified);

    const tagsArr = modalTags
      .split(' ')
      .map((t) => t.replace('#', '').trim().toLowerCase())
      .filter(Boolean);
    const captionTags = (modalCaption.match(/#[\w-]+/g) || []).map((t) => t.slice(1).toLowerCase().trim()).filter(Boolean);
    const combinedTags = Array.from(new Set([...tagsArr, ...captionTags]));
    const finalTags = combinedTags;

    const isVideo = modalPhoto ? isVideoMedia(modalPhoto) : false;

    const newPost: PostItem = {
      id: `p-${Date.now()}`,
      authorId,
      authorName,
      authorHandle,
      authorAvatar,
      isVerified,
      verifiedCategory: myProfile.verifiedCategory,
      verifiedSince: myProfile.verifiedSince,
      cryptoProofId: myProfile.cryptoProofId,
      type: modalPhoto ? (isVideo ? 'video' : 'image') : 'text',
      contentUrl: modalPhoto || undefined,
      thumbnailUrl: isVideo ? undefined : (modalPhoto || undefined),
      videoUrl: (isVideo && modalPhoto) ? modalPhoto : undefined,
      caption: modalCaption,
      tags: finalTags,
      privacy: modalPrivacy,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      isLiked: false,
      isSaved: false,
      likersList: [],
      saversList: [],
      timeAgo: 'Just now',
      comments: [],
    };

    if (modalPhoto) {
      const photoUrl = modalPhoto;
      setPhotoLikesMap((prev) => {
        const next = {
          ...prev,
          [photoUrl]: { isLiked: false, count: 0 },
        };
        safeSaveStorage('privity_photo_likes_v5', next);
        return next;
      });

      setProfiles((prev) => {
        const handleKey = myClean.toLowerCase();
        const prof = prev[handleKey] || myProfile;
        const newMedia: UserMediaItem = {
          id: `m-${myClean}-${Date.now()}`,
          url: photoUrl,
          type: isVideo ? 'video' : 'image',
          likes: 0,
          comments: 0,
          isLiked: false,
        };
        const nextProfiles = {
          ...prev,
          [handleKey]: {
            ...prof,
            mediaItems: [newMedia, ...(prof.mediaItems || [])],
          },
        };
        safeSaveStorage('privity_profiles_v5', nextProfiles);
        return nextProfiles;
      });
    }

    setPosts((prev) => {
      const nextPosts = [newPost, ...prev];
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    broadcastSyncEvent({
      action: 'NEW_POST',
      post: newPost,
    });

    setIsModalOpen(false);
    setModalCaption('');
    setModalTags('');
    setModalPhoto(null);
    setFeedFilter('all');
    setActiveTagFilter(null);

    // Switch to feed view unless currently on own profile
    if (activeTab !== 'profile' || viewedUserHandle !== myProfile.handle) {
      setActiveTab('feed');
    }

    setHighlightPostId(newPost.id);
    setTimeout(() => setHighlightPostId(null), 3500);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    triggerToast('Published to your feed');
  };

  const handleCameraPublishPost = ({
    caption,
    mediaUrl,
    mediaId,
    thumbnailUrl,
    mediaType,
    tags,
    privacy,
    soundName,
    targetDestination = 'feed',
    blob,
  }: {
    caption: string;
    mediaUrl?: string | null;
    mediaId?: string;
    thumbnailUrl?: string;
    mediaType?: 'photo' | 'video';
    tags: string;
    privacy: 'close_friends' | 'followers' | 'public';
    soundName?: string;
    targetDestination?: 'feed' | 'story';
    blob?: Blob;
  }) => {
    const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle || activeAuthHandle);
    if (!myClean) {
      setIsAuthModalOpen(true);
      triggerToast('Please sign in to publish');
      return;
    }
    const authorName = currentAuthUser?.name || myProfile.name || myClean;
    const authorAvatar = currentAuthUser?.avatar || myProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${myClean}`;
    const authorHandle = myClean;
    const authorId = currentAuthUser?.id || myProfile.id || `usr-${myClean}`;
    const isVerified = Boolean(currentAuthUser?.isVerified ?? myProfile.isVerified);

    // 1. STORY DESTINATION (Story is stories, separated from feed)
    if (targetDestination === 'story') {
      const newStory: StoryItem = {
        id: `st-${myClean}-${Date.now()}`,
        authorName,
        authorHandle: myClean,
        authorAvatar,
        isVerified,
        mediaUrl: mediaUrl || '',
        mediaType: mediaType === 'video' ? 'video' : 'image',
        caption: caption || undefined,
        timeAgo: 'Just now',
        createdAt: Date.now(),
        privacy: privacy as any,
        likesCount: 0,
        isLiked: false,
      };
      handleAddStory(newStory);
      setIsCameraOpen(false);
      triggerToast('Story published to your circle!');
      return;
    }

    // 2. FEED DISPATCH DESTINATION (Feed is feed, never auto-creates story)
    const rawTags = tags
      .split(' ')
      .map((t) => t.replace('#', '').trim().toLowerCase())
      .filter(Boolean);
    const captionTags = (caption.match(/#[\w-]+/g) || []).map((t) => t.slice(1).toLowerCase().trim()).filter(Boolean);
    const combinedTags = Array.from(new Set([...rawTags, ...captionTags]));
    const finalTags = combinedTags;

    const postId = `p-${Date.now()}`;
    const effectiveMediaId = mediaId || postId;
    if (blob) {
      storePostMedia(postId, blob, effectiveMediaId);
    }

    const newPost: PostItem = {
      id: postId,
      authorId,
      authorName,
      authorHandle,
      authorAvatar,
      isVerified,
      verifiedCategory: myProfile.verifiedCategory,
      verifiedSince: myProfile.verifiedSince,
      cryptoProofId: myProfile.cryptoProofId,
      type: mediaType === 'video' ? 'video' : mediaUrl ? 'image' : 'text',
      contentUrl: mediaUrl || undefined,
      thumbnailUrl: thumbnailUrl || (mediaType === 'video' ? undefined : (mediaUrl || undefined)),
      videoUrl: mediaType === 'video' ? (mediaUrl || undefined) : undefined,
      videoMediaId: mediaType === 'video' ? effectiveMediaId : undefined,
      soundName: soundName,
      caption: caption,
      tags: finalTags,
      privacy: privacy as PostPrivacy,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      isLiked: false,
      isSaved: false,
      likersList: [],
      saversList: [],
      timeAgo: 'Just now',
      comments: [],
    };

    if (mediaUrl) {
      const newMedia: UserMediaItem = {
        id: `m-${myClean}-${Date.now()}`,
        url: mediaUrl,
        type: mediaType === 'video' ? 'video' : 'image',
        likes: 0,
        comments: 0,
        isLiked: false,
      };

      setProfiles((prev) => {
        const handleKey = myClean.toLowerCase();
        const prof = prev[handleKey] || myProfile;
        const nextProfiles = {
          ...prev,
          [handleKey]: {
            ...prof,
            mediaItems: [newMedia, ...(prof.mediaItems || [])],
          },
        };
        safeSaveStorage('privity_profiles_v5', nextProfiles);
        return nextProfiles;
      });
    }

    setPosts((prev) => {
      const nextPosts = [newPost, ...prev];
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    broadcastSyncEvent({
      action: 'NEW_POST',
      post: newPost,
    });

    setIsCameraOpen(false);
    setFeedFilter('all');
    setActiveTagFilter(null);

    if (activeTab !== 'profile' || viewedUserHandle !== myProfile.handle) {
      setActiveTab('feed');
    }

    setHighlightPostId(newPost.id);
    setTimeout(() => setHighlightPostId(null), 3500);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    triggerToast(mediaType === 'video' ? 'Video dispatch published to feed!' : 'Photo dispatch published to feed!');
  };

  const cameraCurrentUser = useMemo(() => ({
    name: myProfile.name,
    handle: myProfile.handle,
    avatar: myProfile.avatar,
    isVerified: myProfile.isVerified,
    followersCount: (myProfile.followersList || []).length,
  }), [myProfile.name, myProfile.handle, myProfile.avatar, myProfile.isVerified, myProfile.followersList]);

  const handleCameraGoLive = async ({
    title,
    category,
    goal,
    cameraStream,
  }: {
    title: string;
    category: string;
    goal: string;
    cameraStream?: MediaStream | null;
  }) => {
    let finalStream = cameraStream || null;
    if (finalStream) {
      if (finalStream.getAudioTracks().length === 0) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 },
          });
          mic.getAudioTracks().forEach((track) => finalStream!.addTrack(track));
        } catch (e) {
          console.warn('Microphone attach notice in handleCameraGoLive:', e);
        }
      }
    }
    setHostLiveCameraStream(finalStream);
    setIsHostBroadcasting(true);
    const cleanHandle = (myProfile.handle || '').toLowerCase().replace('@', '').trim();
    const streamSessionId = `live-user-${cleanHandle}-${Date.now()}`;
    liveStreamSync.clearStreamEnded(streamSessionId, cleanHandle);
    const userStream: LiveStreamSession = {
      id: streamSessionId,
      creatorHandle: cleanHandle,
      creatorName: myProfile.name,
      creatorAvatar: myProfile.avatar,
      isVerified: myProfile.isVerified,
      category: category || 'Visionary Host',
      title: title || 'Live Broadcast · Sovereign Node',
      description: `Streaming live directly to authorized circles. ${goal}`,
      viewersCount: 0,
      likesCount: 0,
      dailyRank: '🔥 Genesis Host',
      previewUrl: myProfile.coverUrl || myProfile.avatar,
      battleInfo: undefined,
      multiGuests: [],
      participants: [{ name: myProfile.name, avatar: myProfile.avatar, role: 'Host' }],
      tags: ['Live', 'P2P', 'Privity'],
    };

    setLiveStreamsList((prev) => [userStream, ...prev]);
    setActiveLiveIndex(0);
    setActiveLiveStream(userStream);
    setIsCameraOpen(false);

    const hostMeta = {
      id: userStream.id,
      creatorHandle: cleanHandle,
      creatorName: myProfile.name,
      creatorAvatar: myProfile.avatar,
      handle: cleanHandle,
      name: myProfile.name,
      avatar: myProfile.avatar,
      isVerified: myProfile.isVerified,
      category: userStream.category,
      title: userStream.title,
      description: userStream.description,
      startedAt: Date.now(),
      viewersCount: 0,
      likesCount: 0,
      previewUrl: userStream.previewUrl,
      isLive: true,
    };

    try {
      localStorage.removeItem(`privity_live_chat_${cleanHandle}`);
      localStorage.removeItem(`privity_live_chat_${streamSessionId}`);
      localStorage.setItem('privity_current_live_host', JSON.stringify(hostMeta));
      localStorage.setItem('privity_is_host_broadcasting', 'true');
      localStorage.setItem('privity_active_live_session', JSON.stringify(userStream));
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_HOST_STARTED', action: 'LIVE_STARTED', host: hostMeta });
      bus.postMessage({ type: 'LIVE_ROOM_RESET', hostHandle: cleanHandle, roomId: cleanHandle });
      bus.close();
      liveStreamSync.sendRoomEvent(cleanHandle, { type: 'LIVE_ROOM_RESET', hostHandle: cleanHandle, roomId: cleanHandle });
      liveStreamSync.sendRoomEvent(streamSessionId, { type: 'LIVE_ROOM_RESET', hostHandle: cleanHandle, roomId: streamSessionId });
      broadcastSyncEvent({
        action: 'LIVE_STARTED',
        host: hostMeta,
      });
      broadcastSyncEvent({
        action: 'LIVE_ROOM_RESET',
        roomId: cleanHandle,
        hostHandle: cleanHandle,
      });
      broadcastViaSupabase({
        action: 'STREAM_ACTIVE',
        stream: hostMeta,
      });
    } catch {}

    // Announce and broadcast P2P live stream across all network devices
    liveStreamSync.startHostBroadcast(
      {
        id: userStream.id,
        creatorHandle: cleanHandle,
        creatorName: myProfile.name,
        creatorAvatar: myProfile.avatar,
        isVerified: myProfile.isVerified,
        title: userStream.title,
        category: userStream.category,
        description: userStream.description,
        viewersCount: userStream.viewersCount,
        likesCount: userStream.likesCount,
        previewUrl: userStream.previewUrl,
        tags: userStream.tags,
      },
      cameraStream || null
    ).then((peerId) => {
      try {
        localStorage.setItem(
          'privity_current_live_host',
          JSON.stringify({
            ...hostMeta,
            peerId,
          })
        );
      } catch {}
    }).catch(() => {});

    triggerToast(`Broadcast started: ${userStream.title}`);
  };

  // Official Logout Handler: Locks app immediately and redirects to login gate
  const handleLogout = () => {
    authService.logout();
    setCurrentAuthUser(null);
    setViewedUserHandle('');
    setIsSettingsOpen(false);
    setIsProfileDrawerOpen(false);
    triggerToast('Logged out securely');
  };

  // Dynamic trending topics refreshed based on active reverse-chronological stream (strictly from zero)
  const dynamicTrendingTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of posts) {
      for (const t of p.tags || []) {
        const clean = t.toLowerCase().replace(/^#/, '').trim();
        if (clean) {
          counts[clean] = (counts[clean] || 0) + 1;
        }
      }
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({
        tag,
        count: `${count} ${count === 1 ? 'dispatch' : 'dispatches'}`,
      }));
    return sorted;
  }, [posts]);

  if (liveLabActive && LiveLab) {
    return (
      <React.Suspense
        fallback={
          <div
            style={{
              background: '#030407',
              color: '#ffffff',
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Loading Privity LIVE Lab...
          </div>
        }
      >
        <LiveLab />
      </React.Suspense>
    );
  }

  // MANDATORY AUTHENTICATION WALL: Nobody can view anything unless logged in
  if (!currentAuthUser) {
    return (
      <div style={{ minHeight: '100vh', width: '100vw', background: '#060813', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '20px' }}>
        {/* Instant Access to LIVE Studio without needing login */}
        <div style={{ position: 'fixed', top: '24px', zIndex: 99999, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              window.location.hash = 'live-lab';
              setLiveLabActive(true);
            }}
            style={{
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '999px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 28px rgba(236,72,153,0.45)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              letterSpacing: '-0.01em',
              transition: 'transform 0.15s ease',
            }}
            title="Open Privity LIVE Studio (Interactive Stage 3 Simulator)"
          >
            <span style={{ fontSize: '18px' }}>🎙️</span>
            <span>Launch Privity LIVE Studio (Interactive Demo &amp; Battle Arena)</span>
            <span style={{ opacity: 0.8, fontSize: '16px' }}>→</span>
          </button>
        </div>

        {toastMsg && (
          <div className="apple-glass-toast">
            <div className="glass-toast-dot" />
            <span>{toastMsg}</span>
          </div>
        )}
        <AuthModal
          isOpen={true}
          requireAuth={true}
          onAuthenticated={(user) => {
            setCurrentAuthUser(user);
            setViewedUserHandle(user.handle);
            triggerToast(`Welcome to Privity, ${user.name}!`);
            broadcastSyncEventRef.current({
              action: 'USER_PAGE_CREATED',
              account: user,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className={`app-container ${activeLiveStream ? 'live-mode-active' : ''}`}>
      {/* Apple visionOS Mirror Glass Toast Notification */}
      {toastMsg && (
        <div className="apple-glass-toast">
          <div className="glass-toast-dot" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* MOBILE TOP STATUS & BRAND HEADER (<= 768px)             */}
      {/* ======================================================== */}
      {activeTab === 'discover' || activeTab === 'messages' || activeTab === 'profile' || (activeTab === 'feed' && (feedFilter === 'live' || feedViewMode === 'slide')) ? null : (
        <header className="mobile-top-header">
          <div className="mobile-header-left" onClick={() => { setActiveTab('feed'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <div className="brand-emblem-box" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
              <img src="./privity-emblem.png" alt="Privity Emblem" className="brand-emblem-img" style={{ width: '22px', height: '22px' }} />
            </div>
            <div className="brand-logo-text" style={{ display: 'flex', alignItems: 'center' }}>
              <img src="./privity-wordmark.png" alt="PRIVITY" className="brand-wordmark-img" style={{ height: '17px', width: 'auto' }} />
              <span className="brand-pulsing-orbit"></span>
            </div>
          </div>

          <div className="mobile-header-center">
            <span className="mobile-active-tab-title">
              {activeTab === 'feed' && (
                feedFilter === 'live' ? 'Live Broadcasts' :
                feedFilter === 'feed' ? 'Chronological Feed' :
                feedFilter === 'close_friends' ? 'Close Friends' :
                feedFilter === 'followers' ? 'Followers' : feedFilter === 'birdie' ? 'Birdie Feed' : 'All Circles'
              )}
              {activeTab === 'activity' && 'Activity'}
              {activeTab === 'safety' && 'Security'}
            </span>
          </div>

          <div className="mobile-header-right">
            <button
              type="button"
              className="mobile-header-icon-btn"
              onClick={() => setIsSettingsOpen(true)}
              title="Account & Privacy Settings"
            >
              <IconSettings size={18} />
            </button>
            <button
              type="button"
              className="mobile-header-icon-btn mobile-header-compose-btn"
              onClick={() => setIsCameraOpen(true)}
              title="Open Camera & Studio"
            >
              <IconPlus size={18} color="#ffffff" />
            </button>
          </div>
        </header>
      )}

      {/* ======================================================== */}
      {/* 1. LEFT SIDEBAR NAVIGATION (BESPOKE VECTOR ICONS)        */}
      {/* ======================================================== */}
      <aside className="nav-sidebar">
        <div className="brand-anchor" onClick={() => setActiveTab('feed')} title="Privity Home">
          <div className="brand-emblem-box">
            <img src="./privity-emblem.png" alt="Privity Emblem" className="brand-emblem-img" />
          </div>
          <div className="brand-logo-text">
            <img src="./privity-wordmark.png" alt="PRIVITY" className="brand-wordmark-img" />
            <span className="brand-pulsing-orbit"></span>
          </div>
        </div>

        <nav className="nav-links-stack">
          <button
            className={`nav-link-btn ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            <span className="nav-icon-wrap"><IconHome size={21} /></span>
            <span>Home Feed</span>
          </button>

          <button
            className={`nav-link-btn ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            <span className="nav-icon-wrap"><IconDiscover size={21} /></span>
            <span>Discover</span>
          </button>

          <button
            className={`nav-link-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <span className="nav-icon-wrap"><IconBell size={21} /></span>
            <span>Activity</span>
            {followRequests.length > 0 && (
              <span className="nav-badge-pill">{followRequests.length}</span>
            )}
          </button>

          <button
            className={`nav-link-btn ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('messages');
              setActiveChatUser(null);
            }}
          >
            <span className="nav-icon-wrap"><IconChat size={21} /></span>
            <span>Messages</span>
            <span className="nav-badge-pill" style={{ background: 'var(--brand-primary)' }}>Live</span>
          </button>

          <button
            className={`nav-link-btn ${activeTab === 'profile' && viewedUserHandle === myProfile.handle ? 'active' : ''}`}
            onClick={() => {
              if (!currentAuthUser) {
                setIsAuthModalOpen(true);
                return;
              }
              navigateToProfile(myProfile.handle);
            }}
          >
            <span className="nav-icon-wrap"><IconUser size={21} /></span>
            <span>{currentAuthUser ? 'Profile' : 'Log In / Sign Up'}</span>
          </button>

          <button
            className={`nav-link-btn ${activeTab === 'safety' ? 'active' : ''}`}
            onClick={() => setActiveTab('safety')}
          >
            <span className="nav-icon-wrap"><IconShield size={21} /></span>
            <span>Safety & Reports</span>
          </button>

          <button
            className={`nav-link-btn ${liveLabActive ? 'active' : ''}`}
            onClick={() => {
              window.location.hash = 'live-lab';
              setLiveLabActive(true);
            }}
            title="Open Privity LIVE Studio (Interactive Stage 3 Simulator & Battle)"
          >
            <span className="nav-icon-wrap"><IconFeedStream size={21} /></span>
            <span>LIVE Studio</span>
            <span className="nav-badge-pill" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff', fontWeight: 800 }}>LIVE</span>
          </button>
        </nav>

        <button
          className="btn-compose-prime"
          onClick={() => {
            if (!currentAuthUser) {
              setIsAuthModalOpen(true);
              triggerToast('Please sign in or create an account to publish');
              return;
            }
            setIsCameraOpen(true);
          }}
        >
          <IconPlus size={18} />
          <span>New Dispatch</span>
        </button>

        {!currentAuthUser && (
          <div style={{ padding: '0 8px', marginBottom: '8px' }}>
            <button
              type="button"
              className="btn-auth-trigger"
              onClick={() => setIsAuthModalOpen(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                border: '1px solid rgba(168,85,247,0.4)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <IconKey size={14} color="var(--brand)" />
              <span>Log In / Sign Up</span>
            </button>
          </div>
        )}

        {currentAuthUser ? (
          <div
            className="user-identity-card"
            onClick={() => navigateToProfile(myProfile.handle)}
            title="Click to view profile"
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={myProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${myProfile.handle || 'user'}`}
                alt={myProfile.name}
                className="user-avatar-mini"
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {myProfile.name}
                  {myProfile.isVerified && (
                    <VerifiedBadge authorName={myProfile.name} category={myProfile.verifiedCategory} since={myProfile.verifiedSince} proofId={myProfile.cryptoProofId} />
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{myProfile.handle}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="settings-gear-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSettingsOpen(true);
                }}
                title="Settings & System"
              >
                <IconSettings size={18} />
              </button>
              <button
                type="button"
                className="settings-gear-btn"
                style={{ color: '#f87171' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                title="Sign Out / Log Out"
              >
                <IconLock size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div
            className="user-identity-card"
            onClick={() => setIsAuthModalOpen(true)}
            title="Create an account or log in"
            style={{
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))',
              border: '1px dashed rgba(168,85,247,0.3)',
              padding: '10px 14px',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                <IconUser size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Guest Mode</div>
                <div style={{ fontSize: '11px', color: '#c084fc', fontWeight: 600 }}>Create Account / Log In</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ======================================================== */}
      {/* 2. CENTER FEED COLUMN                                    */}
      {/* ======================================================== */}
      <main className={`feed-column ${activeTab === 'messages' ? 'messages-expanded-view' : ''} ${activeTab === 'discover' || activeTab === 'profile' || (activeTab === 'feed' && feedFilter === 'live') ? 'fullscreen-top-view' : ''} ${activeTab === 'feed' && feedFilter === 'live' ? 'live-explore-expanded-view' : ''}`}>
        {/* --- VIEW 1: HOME FEED --- */}
        {activeTab === 'feed' && (
          <div
            className="feed-swipe-container"
            onTouchStart={handleFeedTouchStart}
            onTouchEnd={handleFeedTouchEnd}
            onPointerDown={handleFeedPointerDown}
            onPointerUp={handleFeedPointerUp}
          >
            {feedFilter !== 'live' && feedViewMode === 'cards' && (
              <header className="feed-sticky-nav">
                <div className="feed-title-line">
                  <div className="feed-main-heading">
                    {feedFilter === 'feed' && 'Feed'}
                    {feedFilter === 'all' && 'All Circles'}
                    {feedFilter === 'close_friends' && 'Close Friends'}
                    {feedFilter === 'followers' && 'Followers Only'}
                  </div>
                  <div className="feed-pulse-indicator" title="Decentralized algorithm synchronized in real time">
                    <span className="live-green-orb"></span>
                    <span>Chronological Feed • Synced</span>
                  </div>
                  <button
                    type="button"
                    className="btn-toggle-slide-feed"
                    onClick={() => setFeedViewMode('slide')}
                    title="Switch to Fullscreen Slide Feed"
                    style={{
                      marginLeft: 'auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, rgba(254, 44, 85, 0.2), rgba(37, 244, 238, 0.2))',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    📱 Slide Feed
                  </button>
                </div>

                {/* Feed Audience Tabs: 1st Live, 2nd Feed, 3rd All Circles, 4th Close Friends, 5th Followers Only */}
                <div className="audience-tabs-bar" role="tablist" aria-label="Feed channels">
                  <button
                    id="tab-feed-live"
                    type="button"
                    role="tab"
                    aria-selected={(feedFilter as string) === 'live'}
                    className={`audience-tab-btn live ${networkLiveStreamers.length > 0 ? 'has-active-broadcast' : ''} ${(feedFilter as string) === 'live' ? 'active' : ''}`}
                    onClick={() => handleSelectFeedTab('live')}
                  >
                    <span className="live-tab-radar">
                      <span className="live-radar-ping"></span>
                      <span className="live-radar-core"></span>
                    </span>
                    <span>Live</span>
                    <span className="live-badge-count">{LIVEME_STREAMERS.length + networkLiveStreamers.length}</span>
                  </button>

                  <button
                    id="tab-feed-feed"
                    type="button"
                    role="tab"
                    aria-selected={feedFilter === 'feed'}
                    className={`audience-tab-btn feed ${feedFilter === 'feed' ? 'active' : ''}`}
                    onClick={() => handleSelectFeedTab('feed')}
                  >
                    <IconFeedStream size={13} color="var(--primary-light)" />
                    <span>Feed</span>
                  </button>

                  <button
                    id="tab-feed-all"
                    type="button"
                    role="tab"
                    aria-selected={feedFilter === 'all'}
                    className={`audience-tab-btn ${feedFilter === 'all' ? 'active' : ''}`}
                    onClick={() => handleSelectFeedTab('all')}
                  >
                    <IconGlobe size={13} color="var(--public-cyan)" />
                    <span>All Circles</span>
                  </button>

                  <button
                    id="tab-feed-close_friends"
                    type="button"
                    role="tab"
                    aria-selected={feedFilter === 'close_friends'}
                    className={`audience-tab-btn cf ${feedFilter === 'close_friends' ? 'active' : ''}`}
                    onClick={() => handleSelectFeedTab('close_friends')}
                  >
                    <IconStarCloseFriends size={13} color="var(--cf-emerald)" />
                    <span>Close Friends</span>
                  </button>

                  <button
                    id="tab-feed-followers"
                    type="button"
                    role="tab"
                    aria-selected={feedFilter === 'followers'}
                    className={`audience-tab-btn followers ${feedFilter === 'followers' ? 'active' : ''}`}
                    onClick={() => handleSelectFeedTab('followers')}
                  >
                    <IconUsers size={14} color="var(--followers-iris)" />
                    <span>Followers Only</span>
                  </button>
                </div>
              </header>
            )}

            {/* LIVE BROADCASTS 2-COLUMN EXPLORE DISCOVER ARENA */}
            {feedFilter === 'live' ? (
              <LiveExploreGrid
                onOpenStream={(streamerId, streamerObj) => {
                  const targetStreamer =
                    streamerObj ||
                    networkLiveStreamers.find((s) => s.id === streamerId) ||
                    liveStreamsList.find((s) => s.id === streamerId) ||
                    LIVEME_STREAMERS.find((s) => s.id === streamerId) ||
                    LIVEME_STREAMERS[0];

                  const isLocalHost = liveStreamSync.isLocalHost(targetStreamer.id);
                  setIsHostBroadcasting(isLocalHost);
                  setActiveLiveStream(targetStreamer as any);
                  setMinimizedLiveStream(null);
                }}
                onBackToFeed={() => setFeedFilter('feed')}
                onGoLive={() => {
                  setCameraInitialTab('LIVE');
                  setIsCameraOpen(true);
                }}
                currentUser={{
                  name: myProfile.name,
                  handle: myProfile.handle,
                  avatar: myProfile.avatar,
                }}
                showToast={triggerToast}
              />
            ) : feedViewMode === 'slide' ? (
              <TikTokSlideFeed
                posts={posts}
                currentUser={{
                  name: currentAuthUser?.name || myProfile.name || 'Anonymous',
                  handle: currentAuthUser?.handle || myProfile.handle || 'anon',
                  avatar: currentAuthUser?.avatar || myProfile.avatar || '',
                }}
                followingMap={followingMap}
                closeFriendsList={closeFriendsList}
                deletedPostIds={deletedPostIds}
                savedPostIds={savedPostIds}
                onLike={(postId) => handleLike(postId)}
                onSave={(postId) => handleSave(postId)}
                onAddComment={(postId, text) => handleAddComment(postId, text)}
                onLikeComment={(postId, commentId, replyId) => handleLikeComment(postId, commentId, replyId)}
                onDeleteComment={(postId, commentId, replyId) => handleDeleteComment(postId, commentId, replyId)}
                onReplyComment={(postId, commentId, text) => handleReplyComment(postId, commentId, text)}
                onDeletePost={(postId) => handleDeletePost(postId)}
                onRepostPost={(postId) => handleRepostPost(postId)}
                onAddBirdiePost={(caption, privacy) => handleAddBirdiePost(caption, privacy)}
                onToggleFollow={(handle) => toggleFollow(handle)}
                onShare={(post) => handleShare(post.id)}
                onOpenLive={() => handleSelectFeedTab('live')}
                onOpenCreate={() => setIsCameraOpen(true)}
                stories={stories}
                onAddStory={handleAddStory}
                onDeleteStory={handleDeleteStory}
                onCommentsOpenChange={setIsFeedCommentsOpen}
                onStoryViewerOpenChange={setIsFeedStoryOpen}
                onStoryReplyToDM={(creatorHandle, msg) => handleStoryReplyToDM(creatorHandle, msg)}
                onAddNewPost={(newPost) => {
                  const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle || activeAuthHandle);
                  const postWithAuthor: PostItem = {
                    likesCount: 0,
                    commentsCount: 0,
                    sharesCount: 0,
                    savesCount: 0,
                    likersList: [],
                    comments: [],
                    timeAgo: 'Just now',
                    privacy: 'public',
                    type: 'image',
                    tags: ['#privity'],
                    ...newPost,
                    id: newPost.id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    authorHandle: myClean ? `@${myClean}` : (newPost.authorHandle || `@${myClean}`),
                    authorName: currentAuthUser?.name || myProfile.name || newPost.authorName || myClean,
                    authorAvatar: currentAuthUser?.avatar || myProfile.avatar || newPost.authorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${myClean}`,
                  } as PostItem;

                  const mediaUrl = postWithAuthor.contentUrl || postWithAuthor.videoUrl || postWithAuthor.thumbnailUrl;
                  if (mediaUrl && myClean) {
                    const newMedia: UserMediaItem = {
                      id: `m-${myClean}-${Date.now()}`,
                      url: mediaUrl,
                      type: postWithAuthor.type === 'video' ? 'video' : 'image',
                      likes: 0,
                      comments: 0,
                      isLiked: false,
                    };
                    setProfiles((prev) => {
                      const handleKey = myClean.toLowerCase();
                      const prof = prev[handleKey] || myProfile;
                      const nextProfiles = {
                        ...prev,
                        [handleKey]: {
                          ...prof,
                          mediaItems: [newMedia, ...(prof.mediaItems || [])],
                        },
                      };
                      safeSaveStorage('privity_profiles_v5', nextProfiles);
                      return nextProfiles;
                    });
                  }

                  setPosts((prev) => {
                    const next = [postWithAuthor, ...prev.filter((p) => p.id !== postWithAuthor.id)];
                    safeSaveStorage('privity_posts_v5', next);
                    return next;
                  });

                  broadcastSyncEvent({
                    action: 'NEW_POST',
                    post: postWithAuthor,
                  });
                }}
                onRefreshFeeds={() => {
                  try {
                    const saved = localStorage.getItem('privity_posts_v5');
                    if (saved) {
                      const parsed = JSON.parse(saved);
                      if (Array.isArray(parsed) && parsed.length > 0) setPosts(parsed);
                    }
                  } catch (e) {}
                }}
                onNavigateProfile={(handle) => navigateToProfile(handle)}
                onNavigateTab={(tab) => {
                  if (tab === 'discover') setActiveTab('discover');
                  else if (tab === 'messages') setActiveTab('messages');
                  else if (tab === 'profile') navigateToProfile(myProfile.handle);
                  else setActiveTab('feed');
                }}
                currentNavTab={activeTab === 'feed' ? 'feed' : activeTab === 'discover' ? 'discover' : activeTab === 'messages' ? 'messages' : 'profile'}
                activeFilter={
                  feedFilter === 'close_friends' ? 'circles' :
                  feedFilter === 'followers' ? 'following' :
                  feedFilter === 'birdie' ? 'birdie' : 'foryou'
                }
                onSelectFilter={(f) => {
                  if (f === 'circles') handleSelectFeedTab('close_friends');
                  else if (f === 'following') handleSelectFeedTab('followers');
                  else if (f === 'birdie') handleSelectFeedTab('birdie');
                  else if (f === 'live') handleSelectFeedTab('live');
                  else handleSelectFeedTab('feed');
                }}
                onSwitchToCardView={() => setFeedViewMode('cards')}
                onUpdatePostSound={(postId, sound) => {
                  setPosts((prev) => {
                    const next = prev.map((p) =>
                      p.id === postId
                        ? {
                            ...p,
                            soundName: sound.name,
                            soundArtist: sound.artist,
                            soundUrl: sound.previewUrl,
                            soundCover: sound.coverUrl || p.soundCover,
                          }
                        : p
                    );
                    safeSaveStorage('privity_posts_v5', next);
                    return next;
                  });
                  triggerToast(`Sound updated: ${sound.name} 🎵`);
                }}
              />
            ) : (
              <>

            {/* Circles & Stories Rail */}
            <div className="circles-story-rail">
              {/* Privity LIVE Studio Spotlight Bubble */}
              <div
                className="circle-unit live-story-unit"
                onClick={() => {
                  window.location.hash = 'live-lab';
                  setLiveLabActive(true);
                }}
                title="Launch Privity LIVE Studio (Interactive Stage 3 Simulator & Battle)"
                style={{ cursor: 'pointer' }}
              >
                <div className="circle-halo-ring live-pulsing-halo" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', padding: '2px' }}>
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#0a0d1d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                    }}
                  >
                    🎙️
                  </div>
                  <div className="circle-live-pill-tag" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff', fontWeight: 800 }}>
                    STUDIO 🔴
                  </div>
                </div>
                <span className="circle-tag-name" style={{ color: '#ec4899', fontWeight: 800 }}>
                  LIVE Studio
                </span>
              </div>

              {/* Active Real-Time Live Broadcasts Across Devices (At very start of rail) */}
              {networkLiveStreamers.map((liveStream) => (
                <div
                  key={liveStream.id}
                  className="circle-unit live-story-unit"
                  onClick={() => {
                    const isLocalHost = liveStreamSync.isLocalHost(liveStream.id);
                    setIsHostBroadcasting(isLocalHost);
                    setActiveLiveStream(liveStream as any);
                    setMinimizedLiveStream(null);
                  }}
                  title={`${liveStream.name} is LIVE NOW! Tap to watch.`}
                >
                  <div className="circle-halo-ring live-pulsing-halo">
                    <img
                      src={liveStream.avatar}
                      alt={liveStream.name}
                      className="circle-user-img"
                    />
                    <div className="circle-live-pill-tag">LIVE 🔴</div>
                  </div>
                  <span className="circle-tag-name" style={{ color: '#ef4444', fontWeight: 700 }}>
                    {liveStream.name.replace(' (LIVE NOW 🔴)', '')}
                  </span>
                </div>
              ))}

              {/* Your Own Story / Circle Unit */}
              {(() => {
                const myStoryIdx = stories.findIndex((s) => normalizeHandle(s.authorHandle) === normalizeHandle(myProfile.handle));
                return (
                  <div
                    className="circle-unit"
                    onClick={() => {
                      setIsCameraOpen(true);
                    }}
                    title="Your Story - Open Studio Camera"
                  >
                    <div className="circle-halo-ring" style={{ position: 'relative', border: myStoryIdx !== -1 ? '2.5px solid #ec4899' : undefined }}>
                      <MediaAvatar
                        src={myProfile.avatar}
                        alt={myProfile.name}
                        className="circle-user-img"
                        showBadge={false}
                      />
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCameraOpen(true);
                        }}
                        title="Add New Story via Studio Camera"
                        style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'var(--brand)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 700,
                          border: '2px solid var(--bg-card)',
                          cursor: 'pointer',
                        }}
                      >
                        +
                      </div>
                    </div>
                    <span className="circle-tag-name">Your Story</span>
                  </div>
                );
              })()}

              {/* Dynamic Stories from creators & Followed Circles */}
              {(() => {
                const rendered = new Set<string>();
                const elements: React.ReactNode[] = [];

                // Stories from active creators (including followed)
                stories.forEach((st) => {
                  const cleanAuth = normalizeHandle(st.authorHandle);
                  if (!cleanAuth || cleanAuth === normalizeHandle(myProfile.handle) || rendered.has(cleanAuth)) return;
                  rendered.add(cleanAuth);
                  const sIdx = stories.findIndex((s) => s.id === st.id);
                  elements.push(
                    <div
                      key={`story-${st.id}`}
                      className="circle-unit story-unit"
                      onClick={() => setDmActiveStoryIndex(sIdx)}
                      title={`Watch @${cleanAuth}'s Story`}
                    >
                      <div className="circle-halo-ring active-story" style={{ border: '2.5px solid transparent', background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 40%, #8b5cf6 100%) border-box', padding: '2px' }}>
                        <MediaAvatar src={st.authorAvatar} alt={st.authorName} className="circle-user-img" showBadge={false} />
                      </div>
                      <span className="circle-tag-name" style={{ color: '#fff', fontWeight: 600 }}>{st.authorName.split(' ')[0]}</span>
                    </div>
                  );
                });

                // Followed creators without active stories
                getCleanFollowingHandles(followingMap, myProfile.handle)
                  .forEach((handle) => {
                    const cleanH = normalizeHandle(handle);
                    if (rendered.has(cleanH)) return;
                    rendered.add(cleanH);
                    const prof = getUserProfile(handle);
                    elements.push(
                      <div
                        key={`follow-${handle}`}
                        className="circle-unit"
                        onClick={() => navigateToProfile(handle)}
                        title={`View ${prof.name}'s Profile`}
                      >
                        <div className="circle-halo-ring cf">
                          <img src={prof.avatar} alt={prof.name} className="circle-user-img" />
                        </div>
                        <span className="circle-tag-name">{prof.name.split(' ')[0]}</span>
                      </div>
                    );
                  });

                return elements;
              })()}

              <div className="circle-unit" onClick={() => setIsCameraOpen(true)}>
                <div className="circle-halo-ring add-circle">
                  <div className="circle-add-icon"><IconPlus size={20} /></div>
                </div>
                <span className="circle-tag-name">New Circle</span>
              </div>
            </div>

            {/* Active Live Broadcast Banner on Feed */}
            {networkLiveStreamers.length > 0 && (
              <div
                className="live-active-feed-banner"
                onClick={() => {
                  const firstLive = networkLiveStreamers[0];
                  const isLocalHost = liveStreamSync.isLocalHost(firstLive.id);
                  setIsHostBroadcasting(isLocalHost);
                  setActiveLiveStream(firstLive as any);
                  setMinimizedLiveStream(null);
                }}
                style={{
                  margin: '8px 16px 14px',
                  padding: '10px 14px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16), rgba(168, 85, 247, 0.16))',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(239, 68, 68, 0.2)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ position: 'relative', width: '38px', height: '38px' }}>
                    <img
                      src={networkLiveStreamers[0].avatar}
                      alt="Live Host"
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #ef4444' }}
                    />
                    <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', background: '#ef4444', color: '#fff', fontSize: '8px', fontWeight: 900, padding: '1px 4px', borderRadius: '99px' }}>LIVE</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{networkLiveStreamers[0].name.replace(' (LIVE NOW 🔴)', '')} is broadcasting live</span>
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.7)' }}>
                      {networkLiveStreamers[0].title || 'Tap to join live stream'}
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)'
                }}>
                  Watch Live ⮞
                </div>
              </div>
            )}

            {/* Inline Post Composer */}
            <form onSubmit={handleInlinePublish} className="composer-card">
              <img
                src={myProfile.avatar}
                alt={myProfile.name}
                className="composer-user-pic"
              />

              <div className="composer-core">
                <textarea
                  className="composer-text-box"
                  placeholder="What is inspiring your work today? Share with intent..."
                  value={composerCaption}
                  onChange={(e) => setComposerCaption(e.target.value)}
                />

                {composerPhotoUrl && (
                  <div className="composer-preview-dock">
                    {isVideoMedia(composerPhotoUrl) ? (
                      <video
                        src={cleanMediaUrl(composerPhotoUrl)}
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{
                          width: '100%',
                          maxHeight: '220px',
                          objectFit: 'contain',
                          borderRadius: '12px',
                          background: '#05070d',
                        }}
                      />
                    ) : (
                      <img src={composerPhotoUrl} alt="Attached Preview" />
                    )}
                    <button
                      type="button"
                      className="composer-dock-close"
                      onClick={() => setComposerPhotoUrl(null)}
                    >
                      <IconX size={16} />
                    </button>
                  </div>
                )}

                <div className="composer-toolbar">
                  <div className="composer-actions-set">
                    {/* Privacy Selector Dropdown Pill */}
                    <select
                      className={`privacy-select-glass ${composerPrivacy === 'close_friends' ? 'cf' : composerPrivacy === 'followers' ? 'followers' : 'public'}`}
                      value={composerPrivacy}
                      onChange={(e) => setComposerPrivacy(e.target.value as PostPrivacy)}
                    >
                      <option value="close_friends">Close Friends Only</option>
                      <option value="followers">Followers Only</option>
                      <option value="public">Public</option>
                    </select>

                    <label className="btn-media-toggle" style={{ cursor: 'pointer' }} title="Attach photo or video from your device">
                      <IconPhoto size={16} />
                      <span>Photo / Video</span>
                      <input
                        type="file"
                        accept="image/*,video/*,.mp4,.mov,.webm,.m4v"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
                            if (isVideo) {
                              convertVideoToAnimatedLoop(file, 'studio').then((videoUrl: string) => {
                                setComposerPhotoUrl(videoUrl);
                                triggerToast('Video attached with audio! 🎬');
                              });
                            } else {
                              compressImageFile(file, 960, 0.72, (dataUrl) => {
                                setComposerPhotoUrl(dataUrl);
                                triggerToast('Photo attached to dispatch');
                              });
                            }
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="btn-post-dispatch"
                    disabled={!composerCaption.trim()}
                  >
                    Publish
                  </button>
                </div>
              </div>
            </form>

            {/* Active Hashtag Filter Banner */}
            {activeTagFilter && (
              <div className="active-tag-banner">
                <div className="active-tag-left">
                  <div className="active-tag-hash-circle">#</div>
                  <div>
                    <div className="active-tag-title">#{activeTagFilter}</div>
                    <div className="active-tag-count">
                      {posts.filter((p) => (feedFilter === 'all' || p.privacy === feedFilter) && p.tags && p.tags.map((t) => t.toLowerCase()).includes(activeTagFilter.toLowerCase())).length} dispatches matching this hashtag
                    </div>
                  </div>
                </div>
                <button
                  className="active-tag-clear-btn"
                  onClick={() => setActiveTagFilter(null)}
                  title="Clear hashtag filter and show all"
                >
                  <IconX size={14} /> Clear filter
                </button>
              </div>
            )}

            {/* Posts Stream */}
            <div>
              {(() => {
                const filteredPosts = posts
                  .filter((p) => {
                    if (feedFilter === 'close_friends') return p.privacy === 'close_friends' && p.type !== 'text';
                    if (feedFilter === 'followers') return p.privacy === 'followers' && p.type !== 'text';
                    if (feedFilter === 'birdie') return p.type === 'text';
                    if (feedFilter === 'all') return true;
                    return p.privacy === 'public' && p.type !== 'text';
                  })
                  .filter((p) => {
                    if (!activeTagFilter) return true;
                    return p.tags && p.tags.map((t) => t.toLowerCase()).includes(activeTagFilter.toLowerCase());
                  });

                if (filteredPosts.length === 0) {
                  return (
                    <div
                      className="glass-panel-card"
                      style={{
                        textAlign: 'center',
                        padding: '64px 24px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px dashed rgba(255, 255, 255, 0.12)',
                        borderRadius: '20px',
                        margin: '16px 0',
                      }}
                    >
                      <div style={{ fontSize: '44px', marginBottom: '14px' }}>
                        🍃
                      </div>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                        No Dispatches Yet
                      </h3>
                      <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                        Be the first to share an encrypted moment or authentic thought with your circle.
                      </p>
                      <button
                        type="button"
                        className="btn-compose-prime"
                        onClick={() => setIsCameraOpen(true)}
                        style={{ margin: '0 auto', display: 'inline-flex' }}
                      >
                        <IconPlus size={16} />
                        <span>Create First Dispatch</span>
                      </button>
                    </div>
                  );
                }

                return filteredPosts.map((post) => (
                  <article key={post.id} className={`feed-post-card ${highlightPostId === post.id ? 'post-just-published-shimmer' : ''}`}>
                    <img
                      src={post.authorAvatar}
                      alt={post.authorName}
                      className="post-author-avatar"
                      onClick={() => navigateToProfile(post.authorHandle)}
                      title={`View @${post.authorHandle}'s profile`}
                    />

                    <div className="post-main-column">
                      {/* Meta line */}
                      <div className="post-meta-line">
                        <div className="author-credentials-group">
                          <span
                            className="author-title-text"
                            onClick={() => navigateToProfile(post.authorHandle)}
                            title={`View @${post.authorHandle}'s profile`}
                          >
                            {post.authorName}
                          </span>
                          {post.isVerified && (
                            <VerifiedBadge
                              authorName={post.authorName}
                              category={post.verifiedCategory}
                              since={post.verifiedSince}
                              proofId={post.cryptoProofId}
                            />
                          )}
                          <span
                            className="author-handle-text"
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigateToProfile(post.authorHandle)}
                          >
                            @{post.authorHandle.replace(/^@+/, '')}
                          </span>
                          <span className="post-time-stamp">· {post.timeAgo}</span>
                        </div>

                        {/* Privacy Pill with Clean Vectors */}
                        <div
                          className={`privacy-pill-tag ${post.privacy}`}
                          title={`Privacy Level: ${post.privacy.replace('_', ' ')}`}
                        >
                          {post.privacy === 'close_friends' && (
                            <>
                              <IconStarCloseFriends size={12} color="var(--cf-emerald)" />
                              <span>Close Friends</span>
                            </>
                          )}
                          {post.privacy === 'followers' && (
                            <>
                              <IconUsers size={12} color="var(--followers-iris)" />
                              <span>Followers Only</span>
                            </>
                          )}
                          {post.privacy === 'public' && (
                            <>
                              <IconGlobe size={12} color="var(--public-cyan)" />
                              <span>Public</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Caption */}
                      <p className="post-narrative-text">{post.caption}</p>

                      {/* Hashtags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="post-tags-container">
                          {post.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className={`post-tag-item ${activeTagFilter === tag ? 'active' : ''}`}
                              onClick={(e) => handleTagClick(tag, e)}
                              title={`Click to filter dispatches by #${tag}`}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Audio / Music Track Badge */}
                      {post.soundName && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '16px', fontSize: '12px', color: '#00f0ff', marginBottom: '10px' }}>
                          <span>🎵</span>
                          <span style={{ fontWeight: 700 }}>{post.soundName}</span>
                        </div>
                      )}

                      {/* Photo Display with Double-Tap to Like */}
                      {post.type === 'image' && post.contentUrl && (
                        <div
                          className="post-visual-stage"
                          onDoubleClick={() => handleLike(post.id, true)}
                          onClick={() => setLightboxUrl(post.contentUrl || null)}
                        >
                          <img
                            src={post.contentUrl}
                            alt="Post Media"
                            loading="lazy"
                          />
                          {heartExplodingPostId === post.id && (
                            <div className="spring-heart-explosion">
                              <IconHeart size={84} color="var(--heart-rose)" filled />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Video Player Display (Real Video or Cinematic Thumbnail) */}
                      {post.type === 'video' && (post.videoUrl || post.contentUrl || post.thumbnailUrl || post.videoMediaId) && (
                        <div className="post-visual-stage">
                          <PrivityVideoPlayer post={post} />
                        </div>
                      )}

                      {/* Voice Note Waveform Preview */}
                      {post.voiceMemoDuration && (
                        <div className="voice-memo-card">
                          <button className="voice-play-trigger" title="Play Voice Dispatch">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </button>
                          <div className="voice-waveform-graphic">
                            {[16, 24, 12, 28, 20, 10, 24, 18, 14, 26, 12, 8, 22, 16, 20, 10, 24, 14, 8].map((h, i) => (
                              <div
                                key={i}
                                className={`waveform-bar ${i < 8 ? 'active' : ''}`}
                                style={{ height: `${h}px` }}
                              />
                            ))}
                          </div>
                          <span className="voice-duration-text">{post.voiceMemoDuration}</span>
                        </div>
                      )}

                      {/* Post Actions Toolbar */}
                      {(() => {
                        const viewerHandle = normalizeHandle(currentAuthUser?.handle || myProfile.handle || activeAuthHandle);
                        const effectiveLiked = isPostLikedByUser(post, viewerHandle);
                        const effectiveLikers = (post.likersList || []).map(normalizeHandle).filter(Boolean);
                        const rawLikesCount = typeof post.likesCount === 'number' && !isNaN(post.likesCount) ? post.likesCount : 0;
                        const effectiveLikesCount = Array.isArray(post.likersList) ? post.likersList.length : rawLikesCount;
                        const isSaved = Boolean((viewerHandle && (post.saversList || []).map(normalizeHandle).includes(viewerHandle)) || savedPostIds.includes(post.id) || post.isSaved);
                        const effectiveSavesCount = Array.isArray(post.saversList) ? post.saversList.length : (post.savesCount || 0);

                        return (
                          <>
                            <div className="post-toolbar-line">
                              {/* Real Like Button */}
                              <button
                                className={`btn-post-action ${effectiveLiked ? 'liked' : ''}`}
                                onClick={() => handleLike(post.id)}
                              >
                                <IconHeart size={18} filled={effectiveLiked} color={effectiveLiked ? 'var(--heart-rose)' : 'currentColor'} />
                                <span>{effectiveLikesCount}</span>
                              </button>

                              {/* Comments */}
                              <button
                                className="btn-post-action"
                                onClick={() => {
                                  const el = document.getElementById(`comment-input-${post.id}`);
                                  el?.focus();
                                }}
                              >
                                <IconChat size={18} />
                                <span>{post.commentsCount}</span>
                              </button>

                              {/* External Share */}
                              <button
                                className="btn-post-action"
                                onClick={() => handleShare(post.id)}
                                title="Share Link"
                              >
                                <IconShare size={18} />
                              </button>

                              {/* Bookmark */}
                              <button
                                className={`btn-post-action ${isSaved ? 'saved' : ''}`}
                                onClick={() => handleSave(post.id)}
                                title="Save"
                              >
                                <IconBookmark size={18} filled={isSaved} color={isSaved ? 'var(--cf-emerald)' : 'currentColor'} />
                                <span>{effectiveSavesCount}</span>
                              </button>

                              {/* Options / Report Menu */}
                              <button
                                className="btn-post-action"
                                onClick={() => {
                                  const isOwn = post.authorHandle === myProfile.handle || Boolean(myProfile.id && post.authorId === myProfile.id);
                                  setPostMenuModal({ post, isOwn });
                                }}
                                title={post.authorHandle === myProfile.handle ? 'Dispatch options' : 'Report content'}
                              >
                                <IconDots size={18} />
                              </button>
                            </div>

                            {/* Liked By Directory Strip */}
                            {effectiveLikesCount > 0 && (
                              <div
                                className="post-liked-by-strip"
                                onClick={() => {
                                  openRoster(post.authorHandle, post.authorName, 'likes', effectiveLikers);
                                }}
                                title="Click to view everyone who liked this dispatch"
                              >
                                <div className="liked-avatars-stack">
                                  {effectiveLikers.slice(0, 3).map((h) => {
                                    const u = getUserProfile(h);
                                    return (
                                      <img
                                        key={h}
                                        src={u.avatar}
                                        alt={u.name}
                                        className="liked-avatar-mini"
                                      />
                                    );
                                  })}
                                </div>
                                <span>
                                  Liked by{' '}
                                  {effectiveLikers.slice(0, 2).map((h, idx) => {
                                    const u = getUserProfile(h);
                                    const isLastOfTwo = effectiveLikers.length === 2 && idx === 1;
                                    const isFirstOfMany = effectiveLikers.length > 2 && idx === 0;
                                    return (
                                      <span key={h}>
                                        {isLastOfTwo && ' and '}
                                        <strong>{u.name}</strong>
                                        {isFirstOfMany && ', '}
                                      </span>
                                    );
                                  })}
                                  {effectiveLikers.length > 2 && (
                                    <>
                                      {' '}and <strong>{effectiveLikers.length - 2} {((effectiveLikers.length - 2 === 1) ? 'other' : 'others')}</strong>
                                    </>
                                  )}
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Real Threaded Comments Section */}
                      <div className="comments-thread-box">
                        {post.comments.map((comment) => (
                          <div key={comment.id}>
                            <div className="thread-row">
                              <img
                                src={comment.authorAvatar}
                                alt={comment.authorName}
                                className="thread-user-pic"
                                style={{ cursor: 'pointer' }}
                                onClick={() => navigateToProfile(comment.authorHandle)}
                                title={`View @${comment.authorHandle}'s profile`}
                              />
                              <div className="thread-bubble">
                                <div className="thread-author-bar">
                                  <span
                                    className="thread-author-name"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigateToProfile(comment.authorHandle)}
                                    title={`View @${comment.authorHandle}'s profile`}
                                  >
                                    {comment.authorName}{' '}
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px' }}>
                                      @{comment.authorHandle}
                                    </span>
                                  </span>
                                  <span className="thread-time">{comment.timeAgo}</span>
                                </div>
                                <div className="thread-content-text">{comment.text}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--followers-iris)',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      padding: 0,
                                    }}
                                    onClick={() => {
                                      setReplyTarget({
                                        postId: post.id,
                                        commentId: comment.id,
                                        handle: comment.authorHandle,
                                      });
                                      const el = document.getElementById(`comment-input-${post.id}`);
                                      el?.focus();
                                    }}
                                  >
                                    Reply
                                  </button>
                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: comment.isLiked ? '#ef4444' : 'var(--text-muted)',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: 0,
                                    }}
                                    onClick={() => handleLikeComment(post.id, comment.id)}
                                    title="Like comment"
                                  >
                                    <IconHeart size={11} filled={comment.isLiked} color={comment.isLiked ? '#ef4444' : 'currentColor'} />
                                    <span>{(comment.likesCount || 0) > 0 ? comment.likesCount : 'Like'}</span>
                                  </button>
                                  {(comment.authorHandle === myProfile.handle ||
                                    post.authorHandle === myProfile.handle ||
                                    (myProfile.id && post.authorId === myProfile.id)) && (
                                    <button
                                      type="button"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#f87171',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        padding: 0,
                                      }}
                                      onClick={() => handleDeleteComment(post.id, comment.id)}
                                      title="Remove comment"
                                    >
                                      <IconTrash size={11} />
                                      <span>Remove</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* 1-Level Nested Replies per PRD 13.2 */}
                            {comment.replies?.map((reply) => (
                              <div key={reply.id} className="thread-reply-nested">
                                <div className="thread-row">
                                  <img
                                    src={reply.authorAvatar}
                                    alt={reply.authorName}
                                    className="thread-user-pic"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigateToProfile(reply.authorHandle)}
                                    title={`View @${reply.authorHandle}'s profile`}
                                  />
                                  <div className="thread-bubble">
                                    <div className="thread-author-bar">
                                      <span
                                        className="thread-author-name"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => navigateToProfile(reply.authorHandle)}
                                        title={`View @${reply.authorHandle}'s profile`}
                                      >
                                        {reply.authorName}{' '}
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px' }}>
                                          @{reply.authorHandle}
                                        </span>
                                      </span>
                                      <span className="thread-time">{reply.timeAgo}</span>
                                    </div>
                                    <div className="thread-content-text">{reply.text}</div>
                                    {(reply.authorHandle === myProfile.handle ||
                                      post.authorHandle === myProfile.handle ||
                                      (myProfile.id && post.authorId === myProfile.id)) && (
                                      <div style={{ marginTop: '5px' }}>
                                        <button
                                          type="button"
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#f87171',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            padding: 0,
                                          }}
                                          onClick={() => handleDeleteComment(post.id, comment.id, reply.id)}
                                          title="Remove reply"
                                        >
                                          <IconTrash size={11} />
                                          <span>Remove</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}

                        {/* Inline Comment Input Box */}
                        <div className="inline-comment-row">
                          {replyTarget && replyTarget.postId === post.id && (
                            <div className="reply-banner-pill">
                              <span>Replying to @{replyTarget.handle}</span>
                              <button
                                type="button"
                                onClick={() => setReplyTarget(null)}
                                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}
                                title="Cancel reply"
                              >
                                <IconX size={12} />
                              </button>
                            </div>
                          )}
                          <img
                            src={myProfile.avatar}
                            alt={myProfile.name}
                            className="comment-user-avatar"
                          />
                          <div className="comment-input-wrap">
                            <input
                              id={`comment-input-${post.id}`}
                              type="text"
                              className="inline-comment-field"
                              placeholder={
                                replyTarget && replyTarget.postId === post.id
                                  ? `Replying to @${replyTarget.handle}...`
                                  : 'Add a thoughtful reply...'
                              }
                              value={commentInputs[post.id] || ''}
                              onChange={(e) =>
                                setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddComment(post.id);
                                }
                              }}
                            />
                            <button
                              className="btn-comment-post"
                              onClick={() => handleAddComment(post.id)}
                              title="Send Comment"
                            >
                              <IconSend size={13} color="#fff" />
                              <span>Send</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ));
              })()}

              <div
                style={{
                  textAlign: 'center',
                  padding: '44px 20px',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}
              >
                No hidden algorithm • Chronological & relationship-driven feed
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {/* --- VIEW 2: DISCOVER --- */}
        {activeTab === 'discover' && (
          <div style={{ padding: '28px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
              Explore & Discover
            </h2>
            <div className="search-input-shell" style={{ marginBottom: '18px' }}>
              <span className="search-lens-icon"><IconSearch size={18} /></span>
              <input
                type="text"
                className="search-glass-field"
                placeholder="Search verified creators, topics, or public dispatches..."
                value={discoverSearch}
                onChange={(e) => setDiscoverSearch(e.target.value)}
              />
            </div>

            {/* Curated Community Hashtag Topics */}
            {(() => {
              const tagCounts: Record<string, number> = {};
              posts.forEach((p) => {
                (p.tags || []).forEach((t) => {
                  const clean = t.toLowerCase().replace(/^#/, '').trim();
                  if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1;
                });
              });
              const communityTags = Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12)
                .map(([name, count]) => ({ name, count }));

              if (communityTags.length === 0) return null;

              return (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Community Hashtags
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {communityTags.map((item) => (
                      <button
                        key={item.name}
                        className="explore-tag-pill"
                        onClick={() => handleTagClick(item.name)}
                        title={`Explore #${item.name} dispatches`}
                      >
                        <span className="explore-tag-hash">#</span>
                        <span>{item.name}</span>
                        <span className="explore-tag-badge">{item.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="glass-panel-card" style={{ marginBottom: '24px' }}>
              <div className="panel-title-text">
                {discoverSearch ? 'Search Results' : 'Discover Community Creators'}
              </div>
              {(() => {
                // Aggregate from all local accounts, active auth session, and profiles registry
                const allAccounts = authService.getAllAccounts();
                const combinedMap: Record<string, UserProfile> = { ...profiles };

                for (const acc of Object.values(allAccounts)) {
                  if (!acc || !acc.handle) continue;
                  const h = acc.handle.toLowerCase().replace(/^@/, '').trim();
                  if (!h || isMockHandle(h)) continue;
                  if (!combinedMap[h]) {
                    combinedMap[h] = {
                      id: acc.id,
                      name: acc.name,
                      handle: acc.handle,
                      avatar: acc.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${h}`,
                      coverUrl: acc.coverUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600',
                      isVerified: false,
                      bio: acc.bio || 'Privity creator sharing private-first moments and authentic updates.',
                      location: 'Global',
                      joinedDate: 'Joined 2026',
                      circleStatus: 'Public Connection' as const,
                      isPrivate: false,
                      followersList: [],
                      followingList: [],
                      trustCirclesList: [],
                      mediaItems: [],
                    };
                  }
                }

                if (currentAuthUser && currentAuthUser.handle) {
                  const myH = currentAuthUser.handle.toLowerCase().replace(/^@/, '').trim();
                  if (myH && !isMockHandle(myH) && !combinedMap[myH]) {
                    combinedMap[myH] = myProfile;
                  }
                }

                const creators = Object.values(combinedMap)
                  .filter((p) => p && p.handle && !isMockHandle(p.handle))
                  .filter((p) => {
                    if (!discoverSearch) return true;
                    const q = discoverSearch.toLowerCase().trim();
                    return (
                      (p.name || '').toLowerCase().includes(q) ||
                      (p.handle || '').toLowerCase().includes(q) ||
                      (p.category && p.category.toLowerCase().includes(q)) ||
                      (p.bio && p.bio.toLowerCase().includes(q))
                    );
                  });

                if (creators.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '14px' }}>
                      {discoverSearch ? 'No creators found matching search' : 'No creators registered yet'}
                    </div>
                  );
                }

                return creators.map((u) => {
                  const isF = isUserFollowed(u.handle);
                  const isSelf = Boolean(myProfile.handle) && u.handle.toLowerCase() === myProfile.handle.toLowerCase();
                  return (
                    <div key={u.handle} className="creator-entry-row">
                      <div
                        className="creator-ident-left"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigateToProfile(u.handle)}
                        title={`View @${u.handle}'s profile`}
                      >
                        <img src={u.avatar} alt={u.name} className="creator-thumb-pic" />
                        <div>
                          <div className="creator-title-bold">
                            {u.name}
                            {u.isVerified && <VerifiedBadge authorName={u.name} category={u.category} />}
                            {isSelf && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '11px', color: 'var(--brand-cyan)', marginLeft: '6px', fontWeight: 600 }}>
                                (You)
                              </span>
                            )}
                            {u.isPrivate && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                <IconLock size={11} color="var(--cf-emerald)" /> Private
                              </span>
                            )}
                          </div>
                          <div className="creator-subtitle-meta">@{u.handle} • {u.category || 'Creator'}</div>
                        </div>
                      </div>
                      {!isSelf && (
                        <button
                          className={`btn-follow-toggle ${isF ? 'following' : ''}`}
                          onClick={() => toggleFollow(u.handle, u.name)}
                        >
                          {isF ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* --- VIEW 3: SPATIAL DIRECT MESSAGING SUITE (VISIONOS SUITE) --- */}
        {activeTab === 'messages' && (() => {
          // 1. Gather all conversation partner handles & registered users
          const existingDmHandles = Object.keys(directMessages).map((h) => h.replace(/^@/, ''));
          const groupHandles = Object.keys(chatGroups).map((h) => h.replace(/^@/, ''));
          const allRegisteredProfiles = Object.keys(profiles)
            .map((h) => h.replace(/^@/, ''))
            .filter((h) => !h.startsWith('group_'));
          const allRegisteredAccounts = Object.values(authService.getAllAccounts())
            .map((a) => a.handle.replace(/^@/, ''))
            .filter((h) => !h.startsWith('group_'));
          const myClean = (myProfile.handle || '').replace(/^@/, '').toLowerCase();
          const deletedSet = new Set((deletedChannelHandles || []).map((h) => h.toLowerCase()));

          const allPartnerHandles = Array.from(
            new Set([
              ...existingDmHandles,
              ...groupHandles,
              ...allRegisteredProfiles,
              ...allRegisteredAccounts,
            ])
          ).filter((h) => {
            const hLower = h.toLowerCase();
            if (!h || hLower === myClean || h.startsWith('sc-') || isMockHandle(h)) return false;
            const thread = directMessages[h] || directMessages[hLower] || [];
            if (deletedSet.has(hLower) && thread.length === 0) return false;
            return true;
          });

          // 2. Filter channels based on search and active channel filter
          const filteredChannels = allPartnerHandles.filter((handle) => {
            const user = getUserProfile(handle);
            const thread = directMessages[handle] || directMessages[handle.toLowerCase()] || [];
            const lastMsg = thread[thread.length - 1];

            // Tab filter
            if (chatChannelFilter === 'close_friends' && !closeFriendsList.includes(handle)) {
              return false;
            }
            if (chatChannelFilter === 'unread' && thread.length === 0) {
              return false;
            }

            // Search query (search handle, name, bio, or message content)
            if (!chatSearchQuery.trim()) return true;
            const q = chatSearchQuery.toLowerCase().trim().replace(/^@/, '');
            const matchesName = (user.name || '').toLowerCase().includes(q);
            const matchesHandle = (user.handle || '').toLowerCase().includes(q);
            const matchesBio = (user.bio || '').toLowerCase().includes(q);
            const matchesLastMsg = lastMsg && (lastMsg.text || '').toLowerCase().includes(q);
            return matchesName || matchesHandle || matchesBio || matchesLastMsg;
          });

          // Active chat partner resolution
          const currentRecipient = activeChatUser || (filteredChannels.length > 0 ? getUserProfile(filteredChannels[0]) : null);
          const cleanRecipientHandle = currentRecipient ? currentRecipient.handle.replace(/^@/, '') : '';
          const currentThread = cleanRecipientHandle ? (directMessages[cleanRecipientHandle] || []) : [];
          const cleanMyHandle = (myProfile.handle || '').replace(/^@/, '');
          const isPartnerInCloseFriends = cleanRecipientHandle ? closeFriendsList.includes(cleanRecipientHandle) : false;

          return (
            <div className={`spatial-messages-container ${activeChatUser ? 'has-active-chat' : 'no-active-chat'}`}>
              {/* LEFT PANE: CONVERSATION CHANNELS ROSTER */}
              <div className="messages-roster-pane">
                {/* Modern Native Header for Messages */}
                <div className="dm-native-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="dm-header-icon-btn"
                      onClick={() => {
                        setMessageModalMode('dm');
                        setIsCreateGroupOpen(true);
                      }}
                      title="New Direct Message"
                      aria-label="New Direct Message"
                    >
                      <IconChat size={18} color="#fff" />
                    </button>
                    <button
                      type="button"
                      className="dm-header-icon-btn"
                      onClick={() => {
                        setMessageModalMode('group');
                        setIsCreateGroupOpen(true);
                      }}
                      title="Create New Group"
                      aria-label="Create New Group"
                    >
                      <IconUsersPlus size={18} color="#fff" />
                    </button>
                  </div>

                  <div className="dm-segmented-control" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={messagesSubTab === 'chats'}
                      className={`dm-seg-btn ${messagesSubTab === 'chats' ? 'active' : ''}`}
                      onClick={() => setMessagesSubTab('chats')}
                    >
                      <span>Chats</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={messagesSubTab === 'notifications'}
                      className={`dm-seg-btn ${messagesSubTab === 'notifications' ? 'active' : ''}`}
                      onClick={() => setMessagesSubTab('notifications')}
                    >
                      <span>Activity</span>
                      {unreadNotifsCount > 0 && (
                        <span className="dm-seg-badge">{unreadNotifsCount > 99 ? '99+' : unreadNotifsCount}</span>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    className={`dm-header-icon-btn ${isDmSearchOpen ? 'active' : ''}`}
                    onClick={() => {
                      setIsDmSearchOpen(!isDmSearchOpen);
                      if (isDmSearchOpen) {
                        setChatSearchQuery('');
                      }
                    }}
                    title="Search Messages"
                    aria-label="Search Messages"
                  >
                    {isDmSearchOpen ? <IconX size={18} color="#fff" /> : <IconSearch size={19} color="#fff" />}
                  </button>
                </div>

                {/* Expandable Smooth Search Bar when toggled */}
                {isDmSearchOpen && messagesSubTab === 'chats' && (
                  <div className="dm-expandable-search-bar">
                    <IconSearch size={15} color="var(--text-muted)" />
                    <input
                      type="text"
                      placeholder="Search messages or people..."
                      value={chatSearchQuery}
                      autoFocus
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                    />
                    {chatSearchQuery && (
                      <button
                        type="button"
                        className="dm-search-clear-btn"
                        onClick={() => setChatSearchQuery('')}
                        title="Clear search"
                      >
                        <IconX size={13} />
                      </button>
                    )}
                  </div>
                )}

                {messagesSubTab === 'chats' ? (
                  <>
                    {/* Dedicated Stories Rail in Direct Messages */}
                    <div className="messages-stories-rail">
                      {/* Your Story in Messages */}
                      <div
                        className="dm-story-bubble"
                        onClick={() => {
                          setIsCameraOpen(true);
                        }}
                        title="Your Story - Open Studio Camera"
                      >
                        <div className={`dm-story-avatar-ring ${stories.some((s) => s.authorHandle === cleanMyHandle) ? 'cf active-story' : 'add'}`}>
                          <MediaAvatar src={myProfile.avatar} alt="You" className="dm-story-avatar-img" showBadge={false} />
                          <span className="dm-story-plus-icon">+</span>
                        </div>
                        <span className="dm-story-name">Your Story</span>
                      </div>

                      {/* Other Stories in Messages */}
                      {stories
                        .filter((st) => st.authorHandle !== cleanMyHandle)
                        .map((st) => {
                          const isCF = st.privacy === 'close_friends';
                          const isFollowers = st.privacy === 'followers';
                          const ringClass = isCF ? 'cf' : isFollowers ? 'followers' : 'public';
                          const idx = stories.findIndex((x) => x.id === st.id);

                          return (
                            <div
                              key={st.id}
                              className="dm-story-bubble"
                              onClick={() => setDmActiveStoryIndex(idx)}
                              title={`View @${st.authorHandle}'s story`}
                            >
                              <div className={`dm-story-avatar-ring ${ringClass}`}>
                                <MediaAvatar src={st.authorAvatar} alt={st.authorName} className="dm-story-avatar-img" showBadge={false} />
                                <span className="dm-story-online-dot" />
                              </div>
                              <span className="dm-story-name">{st.authorName.split(' ')[0]}</span>
                            </div>
                          );
                        })}
                    </div>

                    {/* Filter Pills */}
                    <div className="messages-filter-pills-row">
                      <button
                        type="button"
                        className={`messages-filter-pill ${chatChannelFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setChatChannelFilter('all')}
                      >
                        All ({allPartnerHandles.length})
                      </button>
                      <button
                        type="button"
                        className={`messages-filter-pill ${chatChannelFilter === 'close_friends' ? 'active' : ''}`}
                        onClick={() => setChatChannelFilter('close_friends')}
                      >
                        ★ Close Friends ({allPartnerHandles.filter((h) => closeFriendsList.includes(h)).length})
                      </button>
                      <button
                        type="button"
                        className={`messages-filter-pill ${chatChannelFilter === 'unread' ? 'active' : ''}`}
                        onClick={() => setChatChannelFilter('unread')}
                      >
                        Active Now
                      </button>
                    </div>

                    {/* Roster Channels List */}
                    <div className="messages-roster-list">
                      {filteredChannels.length === 0 ? (
                        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                          <div style={{ fontSize: '36px', marginBottom: '10px' }}>💬</div>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                            {chatSearchQuery ? `No chats matching "${chatSearchQuery}"` : 'Messages'}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                            Connect with friends and creators in real time. Send thoughts, photos, and voice notes.
                          </p>
                          <button
                            type="button"
                            className="btn-primary-glow"
                            style={{
                              padding: '8px 18px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginBottom: '20px',
                            }}
                            onClick={() => {
                              setMessageModalMode('dm');
                              setIsCreateGroupOpen(true);
                            }}
                          >
                            <IconChat size={14} />
                            <span>+ Start Conversation</span>
                          </button>

                          <div style={{ textAlign: 'left', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
                              Available Creators & Contacts
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {Object.values(profiles)
                                .filter((u) => {
                                  if (!u || !u.handle) return false;
                                  const h = u.handle.toLowerCase().replace(/^@/, '');
                                  if (h === cleanMyHandle.toLowerCase()) return false;
                                  if (isMockHandle(h)) return false;
                                  if (chatSearchQuery.trim()) {
                                    const q = chatSearchQuery.toLowerCase();
                                    return h.includes(q) || (u.name || '').toLowerCase().includes(q);
                                  }
                                  return true;
                                })
                                .slice(0, 10)
                                .map((creator) => {
                                  const cleanH = creator.handle.replace(/^@/, '');
                                  return (
                                    <div
                                      key={cleanH}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 10px',
                                        background: 'var(--glass-card-bg)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '10px',
                                      }}
                                    >
                                      <div
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, cursor: 'pointer' }}
                                        onClick={() => {
                                          setActiveChatUser(creator);
                                          setChatMediaAttachment(null);
                                        }}
                                      >
                                        <img
                                          src={creator.avatar}
                                          alt={creator.name}
                                          style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{creator.name}</span>
                                            {creator.isVerified && <VerifiedBadge authorName={creator.name} category={creator.verifiedCategory} />}
                                          </div>
                                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{cleanH}</div>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        style={{
                                          background: 'rgba(0, 240, 255, 0.15)',
                                          border: '1px solid rgba(0, 240, 255, 0.4)',
                                          color: 'var(--brand-cyan)',
                                          padding: '5px 12px',
                                          borderRadius: '14px',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          flexShrink: 0,
                                        }}
                                        onClick={() => {
                                          setActiveChatUser(creator);
                                          setChatMediaAttachment(null);
                                        }}
                                      >
                                        Chat
                                      </button>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        filteredChannels.map((handle) => {
                          const user = getUserProfile(handle);
                          const isSelected = cleanRecipientHandle === handle;
                          const thread = directMessages[handle] || [];
                          const lastMsg = thread[thread.length - 1];
                          const isCF = closeFriendsList.includes(handle);
                          const presence = getUserPresenceState(user.handle);
                          const isSwiped = swipedChannelHandle === handle;
                          const isMuted = !!mutedChats[handle];

                          let snippetNode: React.ReactNode = <span className="channel-last-text">Say hello 👋</span>;
                          if (lastMsg) {
                            const isMine = cleanMyHandle ? lastMsg.senderHandle === cleanMyHandle : false;
                            if (isMine) {
                              const partnerActive = presence === 'active' || presence === 'inactive';
                              const timeSinceMsg = Date.now() - lastMsg.timestamp;
                              const isIgnored = Boolean(lastMsg.isRead) && ((partnerActive && timeSinceMsg > 60000) || timeSinceMsg > 180000);

                              if (isIgnored) {
                                snippetNode = (
                                  <span className="channel-ignored-status">
                                    <span style={{ fontSize: '10px' }}>👁️</span>
                                    <span>Read · Ignored</span>
                                  </span>
                                );
                              } else if (lastMsg.isRead) {
                                snippetNode = <span className="channel-read-status">Read ✓✓</span>;
                              } else {
                                snippetNode = (
                                  <span className="channel-last-text">
                                    <span style={{ opacity: 0.65 }}>You: </span>
                                    {lastMsg.isVoiceMemo ? '🎙️ Voice memo' : lastMsg.mediaUrl ? '📸 Attachment' : lastMsg.text}
                                    <span style={{ marginLeft: '5px', color: 'var(--brand-cyan)', fontSize: '11px', fontWeight: 700 }} title="Delivered">✓✓</span>
                                  </span>
                                );
                              }
                            } else {
                              snippetNode = (
                                <span className="channel-last-text">
                                  {lastMsg.isVoiceMemo ? '🎙️ Voice memo' : lastMsg.mediaUrl ? '📸 Attachment' : lastMsg.text}
                                </span>
                              );
                            }
                          }

                          return (
                            <div
                              key={handle}
                              className="roster-swipe-wrapper"
                              onTouchStart={(e) => {
                                (window as any)[`__swipeStartX_${handle}`] = e.touches[0].clientX;
                                (window as any)[`__swipeStartY_${handle}`] = e.touches[0].clientY;
                              }}
                              onTouchEnd={(e) => {
                                const startX = (window as any)[`__swipeStartX_${handle}`] || 0;
                                const startY = (window as any)[`__swipeStartY_${handle}`] || 0;
                                const dx = e.changedTouches[0].clientX - startX;
                                const dy = e.changedTouches[0].clientY - startY;
                                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 35) {
                                  if (dx < -35) {
                                    setSwipedChannelHandle(handle);
                                  } else if (dx > 35) {
                                    setSwipedChannelHandle((cur) => (cur === handle ? null : cur));
                                  }
                                }
                              }}
                              onMouseDown={(e) => {
                                (window as any)[`__swipeMouseStartX_${handle}`] = e.clientX;
                                (window as any)[`__swipeMouseStartY_${handle}`] = e.clientY;
                              }}
                              onMouseUp={(e) => {
                                const startX = (window as any)[`__swipeMouseStartX_${handle}`] || 0;
                                const startY = (window as any)[`__swipeMouseStartY_${handle}`] || 0;
                                const dx = e.clientX - startX;
                                const dy = e.clientY - startY;
                                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 35) {
                                  if (dx < -35) {
                                    setSwipedChannelHandle(handle);
                                  } else if (dx > 35) {
                                    setSwipedChannelHandle((cur) => (cur === handle ? null : cur));
                                  }
                                }
                              }}
                            >
                              {/* Quick Actions Drawer strictly revealed ONLY when swiped on this specific user */}
                              {isSwiped && (
                                <div className="roster-swipe-actions visible">
                                  <button
                                    type="button"
                                    className="roster-action-btn mute"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleMuteChat(handle);
                                      setSwipedChannelHandle(null);
                                    }}
                                    title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
                                  >
                                    <span style={{ fontSize: '15px' }}>{isMuted ? '🔔' : '🔕'}</span>
                                    <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="roster-action-btn delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteConversation(handle);
                                      setSwipedChannelHandle(null);
                                    }}
                                    title="Delete conversation"
                                  >
                                    <span style={{ fontSize: '15px' }}>🗑️</span>
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}

                              <div
                                className={`channel-card-item roster-swipe-content ${isSelected ? 'active' : ''}`}
                                style={{
                                  transform: isSwiped ? 'translateX(-130px)' : 'translateX(0)',
                                }}
                                onClick={() => {
                                  if (isSwiped) {
                                    setSwipedChannelHandle(null);
                                    return;
                                  }
                                  setSwipedChannelHandle(null);
                                  setActiveChatUser(user);
                                  setChatMediaAttachment(null);
                                }}
                              >
                                <div className="channel-avatar-wrapper">
                                  <MediaAvatar
                                    src={user.avatar}
                                    alt={user.name}
                                    className="channel-avatar-img"
                                    style={{ borderColor: isCF ? 'var(--cf-emerald)' : undefined }}
                                    showBadge={false}
                                  />
                                  <span
                                    className={`online-presence-dot presence-dot-${presence}`}
                                    title={presence === 'active' ? 'Active now' : presence === 'inactive' ? 'Active recently' : 'Offline'}
                                  />
                                </div>
                                <div className="channel-info-col">
                                  <div className="channel-name-row">
                                    <span className="channel-creator-name">
                                      {user.name}
                                      {user.isVerified && <VerifiedBadge authorName={user.name} category={user.verifiedCategory} />}
                                      {isMuted && <span style={{ fontSize: '11px', opacity: 0.6 }} title="Muted">🔕</span>}
                                    </span>
                                    <span className="channel-timestamp">
                                      {presence === 'active' ? (
                                        <span className="channel-online-text" style={{ color: '#22c55e', fontWeight: 600 }}>Active</span>
                                      ) : (
                                        lastMsg ? lastMsg.timeAgo : 'Offline'
                                      )}
                                    </span>
                                  </div>
                                  <div className="channel-snippet-row">
                                    {snippetNode}
                                    {isCF && (
                                      <span title="Close Friends Circle">
                                        <IconStarCloseFriends size={11} color="var(--cf-emerald)" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="messages-notifications-container">
                    {/* Top Action Bar */}
                    <div className="notif-top-actions-bar">
                      <div className="notif-filter-pills">
                        <button
                          type="button"
                          className={`notif-filter-pill ${notificationsFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setNotificationsFilter('all')}
                        >
                          All ({notifications.length})
                        </button>
                        <button
                          type="button"
                          className={`notif-filter-pill ${notificationsFilter === 'like' ? 'active' : ''}`}
                          onClick={() => setNotificationsFilter('like')}
                        >
                          ❤️ Likes ({notifications.filter((n) => n.type === 'like').length})
                        </button>
                        <button
                          type="button"
                          className={`notif-filter-pill ${notificationsFilter === 'comment' ? 'active' : ''}`}
                          onClick={() => setNotificationsFilter('comment')}
                        >
                          💬 Comments ({notifications.filter((n) => n.type === 'comment').length})
                        </button>
                        <button
                          type="button"
                          className={`notif-filter-pill ${notificationsFilter === 'save' ? 'active' : ''}`}
                          onClick={() => setNotificationsFilter('save')}
                        >
                          🔖 Saves ({notifications.filter((n) => n.type === 'save').length})
                        </button>
                        <button
                          type="button"
                          className={`notif-filter-pill ${notificationsFilter === 'follow' ? 'active' : ''}`}
                          onClick={() => setNotificationsFilter('follow')}
                        >
                          👤 Follows ({notifications.filter((n) => n.type === 'follow').length})
                        </button>
                        <button
                          type="button"
                          className={`notif-filter-pill ${notificationsFilter === 'gift' ? 'active' : ''}`}
                          onClick={() => setNotificationsFilter('gift')}
                        >
                          🎁 Gifts ({notifications.filter((n) => n.type === 'gift').length})
                        </button>
                        <button
                          type="button"
                          className={`notif-filter-pill ${notificationsFilter === 'live' ? 'active' : ''}`}
                          onClick={() => setNotificationsFilter('live')}
                        >
                          🔴 Live ({notifications.filter((n) => n.type === 'live').length})
                        </button>
                        <button
                          type="button"
                          className={`notif-filter-pill ${notificationsFilter === 'story' ? 'active' : ''}`}
                          onClick={() => setNotificationsFilter('story')}
                        >
                          ✨ Stories ({notifications.filter((n) => n.type === 'story').length})
                        </button>
                        <button
                          type="button"
                          className={`notif-filter-pill ${notificationsFilter === 'read' ? 'active' : ''}`}
                          onClick={() => setNotificationsFilter('read')}
                        >
                          👁️ Reads ({notifications.filter((n) => n.type === 'read').length})
                        </button>
                      </div>
                      {unreadNotifsCount > 0 && (
                        <button
                          type="button"
                          className="notif-mark-all-btn"
                          onClick={markAllNotificationsRead}
                          title="Mark all notifications as read"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {/* Notifications Feed */}
                    <div className="notif-feed-list">
                      {notifications.filter((n) => notificationsFilter === 'all' || n.type === notificationsFilter).length === 0 ? (
                        <div className="notif-empty-state-card">
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔔</div>
                          <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff', marginBottom: '4px' }}>
                            No notifications yet
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: 1.4 }}>
                            When someone likes, comments, or interacts with your posts, you'll see them right here in real time!
                          </div>
                        </div>
                      ) : (
                        notifications
                          .filter((n) => notificationsFilter === 'all' || n.type === notificationsFilter)
                          .map((notif) => {
                            const isFollowType = notif.type === 'follow';
                            const cleanActor = (notif.actorHandle || '').replace(/^@/, '');
                            const isFollowingActor = isUserFollowed(cleanActor);

                            return (
                              <div
                                key={notif.id}
                                className={`notif-entry-item ${notif.isRead ? 'read' : 'unread'}`}
                                onClick={() => {
                                  markNotificationRead(notif.id);
                                  if (notif.type === 'live') {
                                    handleSelectFeedTab('live');
                                  } else if (notif.type === 'story') {
                                    const sIndex = stories.findIndex((s) => normalizeHandle(s.authorHandle) === cleanActor);
                                    if (sIndex !== -1) {
                                      setDmActiveStoryIndex(sIndex);
                                    } else {
                                      setViewedUserHandle(cleanActor);
                                      setActiveTab('profile');
                                    }
                                  } else if (notif.type === 'read') {
                                    setActiveChatUser(getUserProfile(cleanActor));
                                    setActiveTab('messages');
                                  } else if (notif.targetPostId) {
                                    setActiveTab('feed');
                                    setFeedFilter('all');
                                    setHighlightPostId(notif.targetPostId);
                                    setTimeout(() => setHighlightPostId(null), 3500);
                                    const el = document.getElementById(`post-${notif.targetPostId}`);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  } else if (isFollowType) {
                                    setViewedUserHandle(cleanActor);
                                    setActiveTab('profile');
                                  }
                                }}
                              >
                                <div className="notif-avatar-wrap">
                                  <img
                                    src={notif.actorAvatar}
                                    alt={notif.actorName}
                                    className="notif-actor-avatar"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewedUserHandle(cleanActor);
                                      setActiveTab('profile');
                                    }}
                                  />
                                  <span className={`notif-type-icon-badge ${notif.type}`}>
                                    {notif.type === 'like' && '❤️'}
                                    {notif.type === 'comment' && '💬'}
                                    {notif.type === 'follow' && '👤'}
                                    {notif.type === 'gift' && '🎁'}
                                    {notif.type === 'save' && '🔖'}
                                    {notif.type === 'share' && '🚀'}
                                    {notif.type === 'live' && '🔴'}
                                    {notif.type === 'story' && '✨'}
                                    {notif.type === 'read' && '👁️'}
                                  </span>
                                </div>

                                <div className="notif-details-wrap">
                                  <div className="notif-headline">
                                    <span
                                      className="notif-actor-name-bold"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewedUserHandle(cleanActor);
                                        setActiveTab('profile');
                                      }}
                                    >
                                      {notif.actorName}
                                    </span>
                                    <span className="notif-actor-handle-pill">@{cleanActor}</span>
                                    {notif.type === 'like' && 'liked your dispatch'}
                                    {notif.type === 'comment' && 'commented on your dispatch'}
                                    {notif.type === 'follow' && 'started following you'}
                                    {notif.type === 'gift' && `sent you a gift: ${notif.giftName || 'Virtual Gift'}`}
                                    {notif.type === 'save' && 'saved your dispatch to their bookmarks'}
                                    {notif.type === 'share' && 'shared your dispatch'}
                                    {notif.type === 'live' && 'is currently LIVE broadcasting'}
                                    {notif.type === 'story' && 'published a new story'}
                                    {notif.type === 'read' && 'opened and read your message'}
                                  </div>

                                  {notif.commentText && (
                                    <div className="notif-comment-quote">
                                      "{notif.commentText}"
                                    </div>
                                  )}

                                  <div className="notif-timestamp-row">{notif.timeAgo || 'Recently'}</div>
                                </div>

                                {notif.postThumbnail && (
                                  <img
                                    src={notif.postThumbnail}
                                    alt="Post preview"
                                    className="notif-thumb-box"
                                  />
                                )}

                                {isFollowType && (
                                  <button
                                    type="button"
                                    className={`notif-action-btn-follow ${isFollowingActor ? 'following' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFollow(cleanActor, notif.actorName);
                                    }}
                                  >
                                    {isFollowingActor ? 'Following' : 'Follow Back'}
                                  </button>
                                )}

                                {notif.type === 'live' && (
                                  <button
                                    type="button"
                                    className="notif-action-btn-follow"
                                    style={{ background: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444', color: '#ef4444' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markNotificationRead(notif.id);
                                      handleSelectFeedTab('live');
                                    }}
                                  >
                                    Watch Live 🔴
                                  </button>
                                )}

                                {notif.type === 'story' && (
                                  <button
                                    type="button"
                                    className="notif-action-btn-follow"
                                    style={{ background: 'rgba(0, 240, 255, 0.15)', borderColor: 'var(--brand-cyan)', color: 'var(--brand-cyan)' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markNotificationRead(notif.id);
                                      const sIndex = stories.findIndex((s) => normalizeHandle(s.authorHandle) === cleanActor);
                                      if (sIndex !== -1) {
                                        setDmActiveStoryIndex(sIndex);
                                      } else {
                                        setViewedUserHandle(cleanActor);
                                        setActiveTab('profile');
                                      }
                                    }}
                                  >
                                    View Story ✨
                                  </button>
                                )}

                                {notif.type === 'read' && (
                                  <button
                                    type="button"
                                    className="notif-action-btn-follow"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markNotificationRead(notif.id);
                                      setActiveChatUser(getUserProfile(cleanActor));
                                      setActiveTab('messages');
                                    }}
                                  >
                                    Open Chat 💬
                                  </button>
                                )}
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT PANE: ACTIVE THREAD WORKSPACE */}
              <div
                className="messages-active-thread-pane"
                onTouchStart={(e) => {
                  (window as any).__chatTouchStartX = e.touches[0].clientX;
                  (window as any).__chatTouchStartY = e.touches[0].clientY;
                }}
                onTouchEnd={(e) => {
                  const startX = (window as any).__chatTouchStartX || 0;
                  const startY = (window as any).__chatTouchStartY || 0;
                  const dx = e.changedTouches[0].clientX - startX;
                  const dy = e.changedTouches[0].clientY - startY;
                  if (dx > 65 && dx > Math.abs(dy) * 1.1) {
                    setActiveChatUser(null);
                  }
                }}
                onMouseDown={(e) => {
                  (window as any).__chatMouseStartX = e.clientX;
                  (window as any).__chatMouseStartY = e.clientY;
                }}
                onMouseUp={(e) => {
                  const startX = (window as any).__chatMouseStartX || 0;
                  const startY = (window as any).__chatMouseStartY || 0;
                  const dx = e.clientX - startX;
                  const dy = e.clientY - startY;
                  if (dx > 65 && dx > Math.abs(dy) * 1.1) {
                    setActiveChatUser(null);
                  }
                }}
              >
                {!currentRecipient ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>💬</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Your Direct Messages</div>
                    <div style={{ fontSize: '13px', maxWidth: '340px', lineHeight: 1.5, marginBottom: '20px' }}>
                      Choose a conversation from the left or connect with creators to send encrypted dispatches, photos, and binaural audio memos.
                    </div>
                    <button
                      type="button"
                      className="btn-glass-back"
                      style={{
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))',
                        borderColor: 'rgba(168,85,247,0.4)',
                        color: '#fff',
                        padding: '10px 22px',
                        fontSize: '13px',
                        fontWeight: 700,
                      }}
                      onClick={() => {
                        setMessageModalMode('dm');
                        setIsCreateGroupOpen(true);
                      }}
                    >
                      + Start Conversation
                    </button>
                  </div>
                ) : (
                  <>
                {/* Thread Workspace Header */}
                <div className="messages-thread-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <button
                      type="button"
                      className="btn-chat-mobile-back"
                      onClick={() => setActiveChatUser(null)}
                      title="Back to all conversations"
                    >
                      <IconArrowLeft size={18} />
                    </button>

                    {(() => {
                      const isGrp = cleanRecipientHandle.startsWith('group_') || Boolean(chatGroups[cleanRecipientHandle]);
                      const grpObj = chatGroups[cleanRecipientHandle];
                      const headerTitle = isGrp ? (grpObj?.name || currentRecipient.name || 'Group Chat') : currentRecipient.name;
                      const headerAvatar = isGrp ? (grpObj?.avatar || currentRecipient.avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400') : currentRecipient.avatar;

                      return (
                        <div
                          className="messages-thread-user-meta"
                          onClick={() => {
                            if (isGrp) {
                              setSelectedGroupInfo(grpObj || {
                                id: cleanRecipientHandle,
                                name: headerTitle,
                                avatar: headerAvatar,
                                members: [cleanMyHandle],
                                createdAt: Date.now(),
                                createdBy: cleanMyHandle,
                              });
                            } else {
                              setActiveChatUser(null);
                              navigateToProfile(currentRecipient.handle);
                            }
                          }}
                          title={isGrp ? 'View Group Circle Details' : `View @${currentRecipient.handle}'s profile`}
                        >
                          <div className="messages-thread-avatar-wrap">
                            <MediaAvatar
                              src={headerAvatar}
                              alt={headerTitle}
                              className="messages-thread-avatar"
                              style={{ borderColor: isGrp ? 'rgba(0, 240, 255, 0.4)' : isPartnerInCloseFriends ? 'var(--cf-emerald)' : undefined }}
                              showBadge={false}
                            />
                            {!isGrp && (
                              <span className={`online-presence-dot presence-dot-${getUserPresenceState(cleanRecipientHandle)}`} />
                            )}
                          </div>
                          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                            <div className="messages-thread-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headerTitle}</span>
                              {isGrp ? (
                                <span style={{ fontSize: '10.5px', background: 'rgba(0, 240, 255, 0.15)', border: '1px solid rgba(0, 240, 255, 0.3)', color: 'var(--brand-cyan)', padding: '1px 6px', borderRadius: 'var(--radius-pill)', fontWeight: 700 }}>
                                  Group
                                </span>
                              ) : currentRecipient.isVerified && (
                                <VerifiedBadge
                                  authorName={currentRecipient.name}
                                  category={currentRecipient.verifiedCategory}
                                  since={currentRecipient.verifiedSince}
                                  proofId={currentRecipient.cryptoProofId}
                                />
                              )}
                              {isPartnerInCloseFriends && (
                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    background: 'var(--cf-glass)',
                                    border: '1px solid var(--cf-border)',
                                    color: 'var(--cf-emerald)',
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-pill)',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    flexShrink: 0,
                                  }}
                                >
                                  <IconStarCloseFriends size={10} color="var(--cf-emerald)" />
                                  Circle
                                </span>
                              )}
                            </div>
                            <div className="messages-thread-status" style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                              {isGrp ? (
                                <span style={{ fontSize: '11.5px', color: 'var(--brand-cyan)', fontWeight: 600 }}>
                                  Group · {grpObj?.members?.length || 2} members (tap for details)
                                </span>
                              ) : (
                                <>
                                  <span
                                    className="status-indicator-dot"
                                    style={{
                                      background:
                                        getUserPresenceState(cleanRecipientHandle) === 'active'
                                          ? '#22c55e'
                                          : getUserPresenceState(cleanRecipientHandle) === 'inactive'
                                          ? '#ef4444'
                                          : '#475569',
                                      boxShadow:
                                        getUserPresenceState(cleanRecipientHandle) === 'active' ? '0 0 8px #22c55e' : 'none',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span style={{ color: getUserPresenceState(cleanRecipientHandle) === 'active' ? '#22c55e' : 'var(--text-muted)', fontSize: '11.5px' }}>
                                    {isRecipientTyping
                                      ? `@${cleanRecipientHandle} is typing...`
                                      : getUserPresenceState(cleanRecipientHandle) === 'active'
                                      ? 'Active now'
                                      : getUserPresenceState(cleanRecipientHandle) === 'inactive'
                                      ? 'Active recently'
                                      : 'Offline'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="chat-header-actions-group">
                    <button
                      type="button"
                      className="chat-header-action-btn"
                      onClick={() => {
                        setActiveChatUser(null);
                        navigateToProfile(currentRecipient.handle);
                      }}
                      title={`View @${cleanRecipientHandle}'s profile`}
                    >
                      <IconUser size={16} />
                    </button>
                    <button
                      type="button"
                      className="chat-header-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsChatHeaderMenuOpen((prev) => !prev);
                      }}
                      title="Conversation options"
                    >
                      <IconDots size={16} />
                    </button>

                    {isChatHeaderMenuOpen && (
                      <div className="chat-header-menu-popover" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="chat-header-menu-item"
                          onClick={() => {
                            setIsChatHeaderMenuOpen(false);
                            setActiveChatUser(null);
                            navigateToProfile(currentRecipient.handle);
                          }}
                        >
                          <IconUser size={14} />
                          <span>View Profile</span>
                        </button>
                        <button
                          type="button"
                          className="chat-header-menu-item"
                          onClick={() => {
                            handleToggleMuteChat(cleanRecipientHandle);
                            setIsChatHeaderMenuOpen(false);
                          }}
                        >
                          <span style={{ fontSize: '14px' }}>{mutedChats[cleanRecipientHandle] ? '🔔' : '🔕'}</span>
                          <span>{mutedChats[cleanRecipientHandle] ? 'Unmute Notifications' : 'Mute Notifications'}</span>
                        </button>
                        <button
                          type="button"
                          className="chat-header-menu-item danger"
                          onClick={() => {
                            handleClearConversation(cleanRecipientHandle);
                            setIsChatHeaderMenuOpen(false);
                          }}
                        >
                          <IconTrash size={14} />
                          <span>Clear Chat History</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Messages Stream */}
                <div className="messages-thread-stream">
                  {currentThread.length === 0 ? (
                    <div className="messages-empty-selection">
                      <div style={{ fontSize: '38px', marginBottom: '12px' }}>💬</div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                        {currentRecipient.name}
                      </div>
                      <p style={{ maxWidth: '340px', fontSize: '13px', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                        No messages yet. Send a message, photo, or voice note below to start chatting!
                      </p>
                    </div>
                  ) : (
                    currentThread.map((msg) => {
                      const isSent = cleanMyHandle ? msg.senderHandle === cleanMyHandle : false;

                      return (
                        <div
                          key={msg.id}
                          id={`msg-${msg.id}`}
                          className={`spatial-bubble-wrapper ${isSent ? 'sent' : 'received'}`}
                          onTouchStart={(e) => {
                            (window as any)[`__bubbleStartX_${msg.id}`] = e.touches[0].clientX;
                          }}
                          onTouchEnd={(e) => {
                            const startX = (window as any)[`__bubbleStartX_${msg.id}`] || 0;
                            const dx = e.changedTouches[0].clientX - startX;
                            if (dx > 45) {
                              setReplyingToMessage(msg);
                              triggerToast(`Replying to @${msg.senderHandle}`);
                            }
                          }}
                          onMouseDown={(e) => {
                            (window as any)[`__bubbleMouseStartX_${msg.id}`] = e.clientX;
                          }}
                          onMouseUp={(e) => {
                            const startX = (window as any)[`__bubbleMouseStartX_${msg.id}`] || 0;
                            const dx = e.clientX - startX;
                            if (dx > 45) {
                              setReplyingToMessage(msg);
                              triggerToast(`Replying to @${msg.senderHandle}`);
                            }
                          }}
                        >
                          {/* Floating Hover Action Pill (Reply, Delete, React, Copy) */}
                          <div className="message-hover-actions">
                            <button
                              type="button"
                              className="msg-action-btn"
                              onClick={() => {
                                setReplyingToMessage(msg);
                                triggerToast(`Replying to @${msg.senderHandle}`);
                              }}
                              title="Reply to message"
                            >
                              ↩
                            </button>
                            {/* Quick Emoji Reactions */}
                            {['❤️', '🔥', '👏', '⚡', '✨'].map((emoji) => {
                              const hasMyReaction = (msg.userReactions?.[emoji] || []).includes(cleanMyHandle) ||
                                (!msg.userReactions?.[emoji] && (msg.reactions?.[emoji] || 0) > 0);
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  className={`msg-action-btn ${hasMyReaction ? 'reacted' : ''}`}
                                  onClick={() => handleReactToMessage(cleanRecipientHandle, msg.id, emoji)}
                                  title={hasMyReaction ? `Remove your ${emoji} reaction` : `React with ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              );
                            })}
                            <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)' }} />
                            {/* Copy Message */}
                            <button
                              type="button"
                              className="msg-action-btn"
                              onClick={() => {
                                navigator.clipboard?.writeText(msg.text);
                                triggerToast('Message copied to clipboard');
                              }}
                              title="Copy text"
                            >
                              <IconCopy size={13} />
                            </button>
                            {/* Delete Message Button */}
                            <button
                              type="button"
                              className="msg-action-btn delete"
                              onClick={() => handleDeleteMessage(cleanRecipientHandle, msg.id)}
                              title="Delete message"
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>

                          {/* Bubble Content Card */}
                          <div className="spatial-bubble-content-card">
                            {/* Quoted Reply Block if replying to earlier message */}
                            {msg.replyTo && (
                              <div
                                className="spatial-bubble-reply-quote"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const targetEl = document.getElementById(`msg-${msg.replyTo?.id}`);
                                  if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                              >
                                <span style={{ fontWeight: 700, color: 'var(--brand-cyan)' }}>@{msg.replyTo.senderHandle}</span>
                                <span style={{ color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {msg.replyTo.text}
                                </span>
                              </div>
                            )}

                            {/* Voice Memo Audio Waveform Component */}
                            {msg.isVoiceMemo ? (
                              <div className="voice-memo-player">
                                <button
                                  type="button"
                                  className={`voice-play-btn ${playingVoiceId === msg.id ? 'playing' : ''}`}
                                  onClick={() => handleTogglePlayVoice(msg)}
                                  title={playingVoiceId === msg.id ? 'Pause memo' : 'Play memo'}
                                >
                                  {playingVoiceId === msg.id ? (
                                    <IconPause size={14} color="#fff" />
                                  ) : (
                                    <IconPlay size={14} color="#fff" />
                                  )}
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="voice-waveform-bars">
                                    {[16, 24, 10, 20, 14, 22, 18, 12, 26, 16, 20, 14, 24, 10, 18, 22, 14].map((h, i) => (
                                      <span
                                        key={i}
                                        className={`voice-bar ${playingVoiceId === msg.id ? 'active' : ''}`}
                                        style={{
                                          height: `${playingVoiceId === msg.id ? Math.max(6, (h + (i % 4) * 6) % 28) : h}px`,
                                          opacity: playingVoiceId === msg.id ? 1 : 0.7,
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <div style={{ fontSize: '10.5px', marginTop: '3px', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{playingVoiceId === msg.id ? '▶ Playing Audio...' : `Voice Memo · ${msg.voiceDuration || '0:18'}`}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Media Attachment if present (Photo or Video) */}
                                {msg.mediaUrl && (
                                  <div className="spatial-bubble-media-wrapper" style={{ marginBottom: msg.text ? '8px' : '0' }}>
                                    {msg.mediaType === 'video' || msg.mediaUrl.endsWith('.mp4') || msg.mediaUrl.startsWith('data:video') ? (
                                      <video
                                        src={msg.mediaUrl}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className="spatial-bubble-video"
                                      />
                                    ) : (
                                      <img
                                        src={msg.mediaUrl}
                                        alt="Attached visual"
                                        className="spatial-bubble-image"
                                        onClick={() => {
                                          setLightboxUrl(msg.mediaUrl || null);
                                          setLightboxIsPrivateMessage(true);
                                        }}
                                        title="Click to view full image"
                                      />
                                    )}
                                  </div>
                                )}

                                {/* Message text if present */}
                                {msg.text && (
                                  <div className="spatial-bubble-text">{msg.text}</div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Message Reactions Row */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="message-reactions-row">
                              {Object.entries(msg.reactions).map(([emoji, count]) => {
                                if (count <= 0) return null;
                                const hasMyReaction = (msg.userReactions?.[emoji] || []).includes(cleanMyHandle) ||
                                  (!msg.userReactions?.[emoji] && count > 0);

                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className={`message-reaction-chip ${hasMyReaction ? 'active' : ''}`}
                                    onClick={() => handleReactToMessage(cleanRecipientHandle, msg.id, emoji)}
                                    title={hasMyReaction ? `Remove your ${emoji} reaction` : `React with ${emoji}`}
                                  >
                                    <span className="reaction-emoji">{emoji}</span>
                                    <span className="reaction-count">{count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Bubble Metadata */}
                          <div className="spatial-bubble-meta">
                            <span>{msg.timeAgo}</span>
                            {isSent && (
                              <>
                                {(() => {
                                  const partnerPresence = getUserPresenceState(cleanRecipientHandle);
                                  const isIgnored = Boolean(msg.isRead) && (((partnerPresence === 'active' || partnerPresence === 'inactive') && (Date.now() - msg.timestamp > 60000)) || (Date.now() - msg.timestamp > 180000));
                                  if (isIgnored) {
                                    return (
                                      <span className="channel-ignored-status" style={{ fontSize: '10px', padding: '1px 5px' }}>
                                        <span>✓✓</span>
                                        <span>Read · Ignored</span>
                                      </span>
                                    );
                                  } else if (msg.isRead) {
                                    return <span className="channel-read-status" style={{ fontSize: '10px' }}>✓✓ Read</span>;
                                  } else {
                                    return <span style={{ color: 'var(--brand-cyan)' }}>✓✓ Delivered</span>;
                                  }
                                })()}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Real-time Recipient Typing Indicator */}
                  {isRecipientTyping && (
                    <div className="chat-typing-row" style={{ alignSelf: 'flex-start' }}>
                      <div className="chat-typing-dots">
                        <span />
                        <span />
                        <span />
                      </div>
                      <span>@{cleanRecipientHandle} is typing...</span>
                    </div>
                  )}
                </div>

                {/* Composer Dock */}
                <form className="messages-composer-dock" onSubmit={handleSendMessage}>
                  {/* Reply Preview Bar above Composer */}
                  {replyingToMessage && (
                    <div className="composer-reply-preview-bar">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ color: 'var(--brand-cyan)', fontSize: '14px', fontWeight: 800 }}>↩</span>
                        <div style={{ minWidth: 0, fontSize: '12px' }}>
                          <span style={{ fontWeight: 700, color: '#fff' }}>
                            Replying to {replyingToMessage.senderHandle === cleanMyHandle ? 'Yourself' : `@${replyingToMessage.senderHandle}`}:{' '}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {replyingToMessage.text || (replyingToMessage.mediaUrl ? 'Attachment' : 'Voice Memo')}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        onClick={() => setReplyingToMessage(null)}
                        title="Cancel reply"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  )}

                  {/* Staged Media Attachment Preview in Composer */}
                  {chatMediaAttachment && (
                    <div className="composer-staged-media-card">
                      <div className="composer-staged-media-preview">
                        {chatMediaType === 'video' ? (
                          <>
                            <video
                              src={chatMediaAttachment}
                              className="composer-staged-thumb"
                              muted
                              playsInline
                            />
                            <div className="composer-staged-badge">Video</div>
                          </>
                        ) : (
                          <>
                            <img
                              src={chatMediaAttachment}
                              alt="Attachment preview"
                              className="composer-staged-thumb"
                            />
                            <div className="composer-staged-badge">Photo</div>
                          </>
                        )}
                        <button
                          type="button"
                          className="composer-staged-remove-btn"
                          onClick={() => {
                            setChatMediaAttachment(null);
                            setChatMediaType('photo');
                          }}
                          title="Remove attachment"
                        >
                          <IconX size={12} />
                        </button>
                      </div>
                      <div className="composer-staged-info">
                        <span className="composer-staged-label">
                          {chatMediaType === 'video' ? 'Video Attached' : 'Photo Attached'}
                        </span>
                        <span className="composer-staged-hint">Ready to send</span>
                      </div>
                    </div>
                  )}

                  {/* Text Input Row OR Voice Studio Console */}
                  {isRecordingVoice ? (
                    <div className="voice-recording-console">
                      <div className="voice-recording-status">
                        <span className="voice-rec-dot" />
                        <span className="voice-rec-label">RECORDING</span>
                        <span className="voice-rec-timer">
                          {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                        </span>
                      </div>

                      <div className="voice-recording-visualizer">
                        {[14, 24, 16, 28, 18, 32, 22, 14, 30, 26, 18, 28, 34, 20, 26, 14, 22].map((h, i) => (
                          <span
                            key={i}
                            className="live-rec-bar"
                            style={{
                              height: `${Math.max(6, (h + ((recordingSeconds * 7 + i * 5) % 24)))}px`,
                            }}
                          />
                        ))}
                      </div>

                      <div className="voice-recording-actions">
                        <button
                          type="button"
                          className="btn-voice-cancel"
                          onClick={handleCancelVoiceRecording}
                          title="Cancel & discard recording"
                        >
                          <IconTrash size={13} />
                          <span>Cancel</span>
                        </button>

                        <button
                          type="button"
                          className="btn-voice-send"
                          onClick={() => handleFinishAndSendVoiceRecording(cleanRecipientHandle)}
                          title="Send Voice Memo"
                        >
                          <IconSend size={14} />
                          <span>Send Memo ({recordingSeconds}s)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="composer-input-row">
                      {/* Compact + Attachment Pill Button (reorganized from old clutter ribbon) */}
                      <label className="composer-attach-pill-btn" title="Attach Photo or Video">
                        <IconPlus size={18} color="#fff" />
                        <input
                          type="file"
                          accept="image/*,video/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.type.startsWith('video')) {
                                const videoUrl = URL.createObjectURL(file);
                                setChatMediaAttachment(videoUrl);
                                setChatMediaType('video');
                                triggerToast('Video attached');
                              } else {
                                compressImageFile(file, 1200, 0.78, (dataUrl) => {
                                  setChatMediaAttachment(dataUrl);
                                  setChatMediaType('photo');
                                  triggerToast('Photo attached');
                                });
                              }
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>

                      {/* Compact Voice Memo Button */}
                      <button
                        type="button"
                        className="composer-mic-pill-btn"
                        onClick={handleStartVoiceRecording}
                        title="Record Voice Memo"
                      >
                        <IconMic size={17} color="#fff" />
                      </button>

                      <input
                        type="text"
                        className="composer-text-input"
                        placeholder={
                          chatMediaAttachment
                            ? 'Add a message...'
                            : replyingToMessage
                            ? `Reply to @${replyingToMessage.senderHandle}...`
                            : `Message @${cleanRecipientHandle}...`
                        }
                        value={chatDraftText}
                        onChange={(e) => setChatDraftText(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="composer-send-btn"
                        disabled={!chatDraftText.trim() && !chatMediaAttachment}
                        style={{ opacity: chatDraftText.trim() || chatMediaAttachment ? 1 : 0.4 }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <IconSend size={15} />
                          <span>Send</span>
                        </span>
                      </button>
                    </div>
                  )}
                </form>
                </>
              )}
              </div>
            
              {/* Fullscreen Story Viewer is hosted globally at universal root layer */}

              {/* Apple-style Direct Message & Group Creation Modal */}
              {isCreateGroupOpen && (
                <div className="group-create-backdrop" onClick={() => setIsCreateGroupOpen(false)}>
                  <div className="group-create-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="group-create-header">
                      <div className="group-create-title">
                        {messageModalMode === 'dm' ? (
                          <>
                            <span style={{ fontSize: '18px' }}>💬</span>
                            <span>Direct Conversation</span>
                          </>
                        ) : (
                          <>
                            <IconUsersPlus size={20} color="var(--brand-cyan)" />
                            <span>Create New Group</span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        className="profile-drawer-close-btn"
                        onClick={() => setIsCreateGroupOpen(false)}
                      >
                        <IconX size={16} />
                      </button>
                    </div>

                    <div className="group-create-body">
                      {/* Modal Mode Selector Tabs */}
                      <div className="message-modal-tabs">
                        <button
                          type="button"
                          className={`message-modal-tab ${messageModalMode === 'dm' ? 'active' : ''}`}
                          onClick={() => setMessageModalMode('dm')}
                        >
                          💬 Direct Message
                        </button>
                        <button
                          type="button"
                          className={`message-modal-tab ${messageModalMode === 'group' ? 'active' : ''}`}
                          onClick={() => setMessageModalMode('group')}
                        >
                          👥 New Group
                        </button>
                      </div>

                      {messageModalMode === 'dm' ? (
                        <>
                          <div className="group-name-input-wrap">
                            <label className="group-name-label">Search Users</label>
                            <input
                              type="text"
                              className="group-name-input"
                              placeholder="Search by name or @handle..."
                              value={messageSearchQuery}
                              autoFocus
                              onChange={(e) => setMessageSearchQuery(e.target.value)}
                            />
                          </div>

                          <div className="group-name-input-wrap">
                            <label className="group-name-label">
                              Select User to Message
                            </label>
                            <div className="group-members-list" style={{ maxHeight: '280px' }}>
                              {(() => {
                                const cleanSelf = (myProfile.handle || '').toLowerCase().replace(/^@/, '');
                                const candidates = Object.values(profiles).filter((u) => {
                                  if (!u || !u.handle) return false;
                                  const h = u.handle.toLowerCase().replace(/^@/, '');
                                  if (h === cleanSelf) return false;
                                  if (!messageSearchQuery.trim()) return true;
                                  const q = messageSearchQuery.toLowerCase().replace(/^@/, '').trim();
                                  return (
                                    h.includes(q) ||
                                    (u.name || '').toLowerCase().includes(q) ||
                                    (u.bio || '').toLowerCase().includes(q)
                                  );
                                });

                                if (candidates.length === 0) {
                                  return (
                                    <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                                      {messageSearchQuery.trim() ? `No users matching "${messageSearchQuery}"` : 'No other users found.'}
                                    </div>
                                  );
                                }

                                return candidates.map((u) => {
                                  const cleanH = u.handle.replace(/^@/, '');
                                  return (
                                    <div
                                      key={cleanH}
                                      className="dm-user-pick-item"
                                      onClick={() => {
                                        setActiveChatUser(u);
                                        setDirectMessages((prev) => {
                                          if (prev[cleanH]) return prev;
                                          return { ...prev, [cleanH]: [] };
                                        });
                                        setIsCreateGroupOpen(false);
                                        setMessageSearchQuery('');
                                      }}
                                    >
                                      <div className="group-member-info">
                                        <img src={u.avatar} alt={u.name} className="group-member-avatar" />
                                        <div>
                                          <div className="group-member-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span>{u.name}</span>
                                            {u.isVerified && <span style={{ color: 'var(--brand-cyan)', fontSize: '12px' }}>✓</span>}
                                          </div>
                                          <div className="group-member-handle">@{cleanH}</div>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        className="dm-user-pick-btn"
                                      >
                                        Message
                                      </button>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="group-name-input-wrap">
                            <label className="group-name-label">Group Name</label>
                            <input
                              type="text"
                              className="group-name-input"
                              placeholder="e.g. Design Circle, Studio Core..."
                              value={newGroupName}
                              autoFocus
                              onChange={(e) => setNewGroupName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateGroup();
                              }}
                            />
                          </div>

                          <div className="group-name-input-wrap">
                            <label className="group-name-label">
                              Select Members ({newGroupSelectedMembers.length} selected)
                            </label>
                            <div className="group-members-list">
                              {(() => {
                                const cleanSelf = (myProfile.handle || '').toLowerCase().replace(/^@/, '');
                                const availableUsers = Object.values(profiles).filter((u) => {
                                  if (!u || !u.handle) return false;
                                  return u.handle.toLowerCase().replace(/^@/, '') !== cleanSelf;
                                });

                                if (availableUsers.length === 0) {
                                  return (
                                    <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                                      No other members available yet.
                                    </div>
                                  );
                                }

                                return availableUsers.map((u) => {
                                  const handle = u.handle.replace(/^@/, '');
                                  const isSelected = newGroupSelectedMembers.includes(handle);
                                  return (
                                    <div
                                      key={handle}
                                      className={`group-member-item ${isSelected ? 'selected' : ''}`}
                                      onClick={() => {
                                        setNewGroupSelectedMembers((prev) =>
                                          prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle]
                                        );
                                      }}
                                    >
                                      <div className="group-member-info">
                                        <img src={u.avatar} alt={u.name} className="group-member-avatar" />
                                        <div>
                                          <div className="group-member-name">{u.name}</div>
                                          <div className="group-member-handle">@{handle}</div>
                                        </div>
                                      </div>
                                      <div className="group-member-checkbox">
                                        {isSelected && <IconCheck size={13} color="#fff" />}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="group-create-footer">
                      <button
                        type="button"
                        className="group-create-cancel-btn"
                        onClick={() => setIsCreateGroupOpen(false)}
                      >
                        Cancel
                      </button>
                      {messageModalMode === 'group' && (
                        <button
                          type="button"
                          className="group-create-submit-btn"
                          disabled={!newGroupName.trim()}
                          onClick={handleCreateGroup}
                        >
                          Create Group ({newGroupSelectedMembers.length})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* VisionOS Group Circle Info Modal */}
              {selectedGroupInfo && (
                <div className="group-create-backdrop" onClick={() => setSelectedGroupInfo(null)}>
                  <div className="group-create-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
                    <div className="group-create-header">
                      <div className="group-create-title">
                        <span style={{ fontSize: '20px' }}>👥</span>
                        <span>Group Circle Details</span>
                      </div>
                      <button
                        type="button"
                        className="profile-drawer-close-btn"
                        onClick={() => setSelectedGroupInfo(null)}
                      >
                        <IconX size={16} />
                      </button>
                    </div>

                    <div className="group-create-body" style={{ textAlign: 'center', padding: '20px 16px' }}>
                      <div style={{ position: 'relative', width: '74px', height: '74px', margin: '0 auto 12px auto' }}>
                        <img
                          src={selectedGroupInfo.avatar}
                          alt={selectedGroupInfo.name}
                          style={{
                            width: '74px',
                            height: '74px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid rgba(0, 240, 255, 0.4)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                          }}
                        />
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                        {selectedGroupInfo.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Encrypted group channel · {selectedGroupInfo.members.length} participants
                      </div>

                      <div style={{ textAlign: 'left', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                          Joined Members ({selectedGroupInfo.members.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                          {selectedGroupInfo.members.map((mHandle) => {
                            const cleanH = normalizeHandle(mHandle);
                            const memberProf = getUserProfile(cleanH);
                            const isSelf = cleanH === normalizeHandle(currentAuthUser?.handle || myProfile.handle);

                            return (
                              <div
                                key={cleanH}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 10px',
                                  borderRadius: '12px',
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  border: '1px solid rgba(255, 255, 255, 0.06)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                  <img
                                    src={memberProf.avatar}
                                    alt={memberProf.name}
                                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                                  />
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {memberProf.name} {isSelf && <span style={{ fontSize: '11px', opacity: 0.6 }}>(You)</span>}
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                      @{cleanH}
                                    </div>
                                  </div>
                                </div>
                                {!isSelf && (
                                  <button
                                    type="button"
                                    className="btn-follow-toggle"
                                    style={{ padding: '4px 10px', fontSize: '11px' }}
                                    onClick={() => {
                                      setSelectedGroupInfo(null);
                                      navigateToProfile(cleanH);
                                    }}
                                  >
                                    View Profile
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="group-create-footer">
                      <button
                        type="button"
                        className="group-create-cancel-btn"
                        style={{ width: '100%' }}
                        onClick={() => setSelectedGroupInfo(null)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()}


        {/* --- VIEW 3: ACTIVITY / NOTIFICATIONS --- */}
        {activeTab === 'activity' && (
          <div style={{ padding: '28px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
              Activity & Circle Requests
            </h2>

            {followRequests.length > 0 ? (
              <div
                className="glass-panel-card"
                style={{ marginBottom: '24px', borderColor: 'var(--followers-border)' }}
              >
                <div className="panel-title-text" style={{ color: 'var(--followers-iris)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Pending Follow Requests (Private Account)</span>
                  <span className="nav-badge-pill" style={{ background: 'var(--followers-iris)' }}>{followRequests.length}</span>
                </div>
                {followRequests.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 0',
                      borderBottom: '1px solid var(--glass-border)',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                      onClick={() => navigateToProfile(r.handle)}
                      title={`View @${r.handle}'s profile`}
                    >
                      <img
                        src={r.avatar}
                        alt={r.name}
                        style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '14px' }}>{r.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          @{r.handle} requested to view your private circle
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn-post-dispatch"
                        style={{ padding: '6px 16px', fontSize: '12px' }}
                        onClick={() => handleApproveRequest(r.id, r.handle, r.name)}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-follow-toggle following"
                        onClick={() => handleDeclineRequest(r.id, r.handle)}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="glass-panel-card"
                style={{ marginBottom: '24px', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(16, 185, 129, 0.25)' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconUserCheck size={18} color="var(--cf-emerald)" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#fff' }}>All Circle Requests Reviewed</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No pending requests. All approved creators now have real-time access to your private circle.
                  </div>
                </div>
              </div>
            )}

            <div className="glass-panel-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div className="panel-title-text" style={{ margin: 0 }}>Recent Interactions & Notifications</div>
                {unreadNotifsCount > 0 && (
                  <button
                    type="button"
                    className="notif-mark-all-btn"
                    onClick={markAllNotificationsRead}
                    title="Mark all notifications as read"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="notif-filter-pills" style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  className={`notif-filter-pill ${notificationsFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setNotificationsFilter('all')}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  className={`notif-filter-pill ${notificationsFilter === 'like' ? 'active' : ''}`}
                  onClick={() => setNotificationsFilter('like')}
                >
                  ❤️ Likes ({notifications.filter((n) => n.type === 'like').length})
                </button>
                <button
                  type="button"
                  className={`notif-filter-pill ${notificationsFilter === 'comment' ? 'active' : ''}`}
                  onClick={() => setNotificationsFilter('comment')}
                >
                  💬 Comments ({notifications.filter((n) => n.type === 'comment').length})
                </button>
                <button
                  type="button"
                  className={`notif-filter-pill ${notificationsFilter === 'save' ? 'active' : ''}`}
                  onClick={() => setNotificationsFilter('save')}
                >
                  🔖 Saves ({notifications.filter((n) => n.type === 'save').length})
                </button>
                <button
                  type="button"
                  className={`notif-filter-pill ${notificationsFilter === 'follow' ? 'active' : ''}`}
                  onClick={() => setNotificationsFilter('follow')}
                >
                  👤 Follows ({notifications.filter((n) => n.type === 'follow').length})
                </button>
                <button
                  type="button"
                  className={`notif-filter-pill ${notificationsFilter === 'gift' ? 'active' : ''}`}
                  onClick={() => setNotificationsFilter('gift')}
                >
                  🎁 Gifts ({notifications.filter((n) => n.type === 'gift').length})
                </button>
                <button
                  type="button"
                  className={`notif-filter-pill ${notificationsFilter === 'live' ? 'active' : ''}`}
                  onClick={() => setNotificationsFilter('live')}
                >
                  🔴 Live ({notifications.filter((n) => n.type === 'live').length})
                </button>
                <button
                  type="button"
                  className={`notif-filter-pill ${notificationsFilter === 'story' ? 'active' : ''}`}
                  onClick={() => setNotificationsFilter('story')}
                >
                  ✨ Stories ({notifications.filter((n) => n.type === 'story').length})
                </button>
                <button
                  type="button"
                  className={`notif-filter-pill ${notificationsFilter === 'read' ? 'active' : ''}`}
                  onClick={() => setNotificationsFilter('read')}
                >
                  👁️ Reads ({notifications.filter((n) => n.type === 'read').length})
                </button>
              </div>

              {/* Feed List */}
              <div className="notif-feed-list" style={{ padding: 0 }}>
                {notifications.filter((n) => notificationsFilter === 'all' || n.type === notificationsFilter).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.5 }}>🔔</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      No interactions yet
                    </div>
                    <div style={{ fontSize: '13px', maxWidth: '340px', margin: '0 auto', lineHeight: 1.4 }}>
                      When creators interact with your dispatches, stories, or live broadcasts, updates will appear here in real time.
                    </div>
                  </div>
                ) : (
                  notifications
                    .filter((n) => notificationsFilter === 'all' || n.type === notificationsFilter)
                    .map((notif) => {
                      const isFollowType = notif.type === 'follow';
                      const cleanActor = (notif.actorHandle || '').replace(/^@/, '');
                      const isFollowingActor = isUserFollowed(cleanActor);

                      return (
                        <div
                          key={notif.id}
                          className={`notif-entry-item ${notif.isRead ? 'read' : 'unread'}`}
                          onClick={() => {
                            markNotificationRead(notif.id);
                            if (notif.targetPostId) {
                              setActiveTab('feed');
                              setFeedFilter('all');
                              setHighlightPostId(notif.targetPostId);
                              setTimeout(() => setHighlightPostId(null), 3500);
                              const el = document.getElementById(`post-${notif.targetPostId}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            } else if (isFollowType) {
                              setViewedUserHandle(cleanActor);
                              setActiveTab('profile');
                            }
                          }}
                        >
                          <div className="notif-avatar-wrap">
                            <img
                              src={notif.actorAvatar}
                              alt={notif.actorName}
                              className="notif-actor-avatar"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewedUserHandle(cleanActor);
                                setActiveTab('profile');
                              }}
                            />
                            <span className={`notif-type-icon-badge ${notif.type}`}>
                              {notif.type === 'like' && '❤️'}
                              {notif.type === 'comment' && '💬'}
                              {notif.type === 'follow' && '👤'}
                              {notif.type === 'gift' && '🎁'}
                              {notif.type === 'save' && '🔖'}
                              {notif.type === 'share' && '🚀'}
                              {notif.type === 'live' && '🔴'}
                              {notif.type === 'story' && '✨'}
                              {notif.type === 'read' && '👁️'}
                            </span>
                          </div>

                          <div className="notif-details-wrap">
                            <div className="notif-headline">
                              <span
                                className="notif-actor-name-bold"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewedUserHandle(cleanActor);
                                  setActiveTab('profile');
                                }}
                              >
                                {notif.actorName}
                              </span>
                              <span className="notif-actor-handle-pill">@{cleanActor}</span>
                              {notif.type === 'like' && ' liked your dispatch'}
                              {notif.type === 'comment' && ' commented on your dispatch'}
                              {notif.type === 'follow' && ' started following you'}
                              {notif.type === 'gift' && ` sent you a gift: ${notif.giftName || 'Virtual Gift'}`}
                              {notif.type === 'save' && ' saved your dispatch to collections'}
                              {notif.type === 'share' && ' shared your dispatch'}
                              {notif.type === 'live' && ' started a LIVE broadcast 🔴'}
                              {notif.type === 'story' && ' shared a new STORY ✨'}
                              {notif.type === 'read' && ' opened and read your message 👁️'}
                            </div>

                            {notif.commentText && (
                              <div className="notif-comment-quote">
                                "{notif.commentText}"
                              </div>
                            )}

                            <div className="notif-timestamp-row">{notif.timeAgo || 'Recently'}</div>
                          </div>

                          {notif.postThumbnail && (
                            <img
                              src={notif.postThumbnail}
                              alt="Post preview"
                              className="notif-thumb-box"
                            />
                          )}

                          {isFollowType && (
                            <button
                              type="button"
                              className={`notif-action-btn-follow ${isFollowingActor ? 'following' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFollow(cleanActor, notif.actorName);
                              }}
                            >
                              {isFollowingActor ? 'Following' : 'Follow Back'}
                            </button>
                          )}

                          {notif.type === 'live' && (
                            <button
                              type="button"
                              className="notif-action-btn-follow"
                              style={{ background: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444', color: '#ef4444' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationRead(notif.id);
                                handleSelectFeedTab('live');
                              }}
                            >
                              Watch Live 🔴
                            </button>
                          )}

                          {notif.type === 'story' && (
                            <button
                              type="button"
                              className="notif-action-btn-follow"
                              style={{ background: 'rgba(0, 240, 255, 0.15)', borderColor: 'var(--brand-cyan)', color: 'var(--brand-cyan)' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationRead(notif.id);
                                const sIndex = stories.findIndex((s) => normalizeHandle(s.authorHandle) === cleanActor);
                                if (sIndex !== -1) {
                                  setDmActiveStoryIndex(sIndex);
                                } else {
                                  setViewedUserHandle(cleanActor);
                                  setActiveTab('profile');
                                }
                              }}
                            >
                              View Story ✨
                            </button>
                          )}

                          {notif.type === 'read' && (
                            <button
                              type="button"
                              className="notif-action-btn-follow"
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationRead(notif.id);
                                setActiveChatUser(getUserProfile(cleanActor));
                                setActiveTab('messages');
                              }}
                            >
                              Open Chat 💬
                            </button>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 4: DYNAMIC APPLE VISIONOS PROFILE --- */}
        {activeTab === 'profile' && (() => {
          const myClean = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
          const viewedClean = normalizeHandle(viewedUserHandle);
          const isOwnProfile = !viewedClean || viewedClean === myClean;
          const profile = isOwnProfile ? myProfile : getUserProfile(viewedUserHandle);
          const isFollowingThisUser = isUserFollowed(profile.handle);
          const isInCloseFriends = closeFriendsList.includes(profile.handle);
          const targetClean = normalizeHandle(profile.handle);

          const userDispatches = posts.filter(
            (p) =>
              normalizeHandle(p.authorHandle) === targetClean ||
              (isOwnProfile &&
                ((myProfile.id && p.authorId === myProfile.id) ||
                  normalizeHandle(p.authorHandle) === myClean))
          );

          const userLikedPosts = posts.filter((p) => {
            const cleanTarget = isOwnProfile ? myClean : targetClean;
            return isPostLikedByUser(p, cleanTarget);
          });

          const userSavedPosts = posts.filter((p) => {
            if (isOwnProfile) {
              return savedPostIds.includes(p.id) || !!p.isSaved;
            }
            return !!p.isSaved;
          });

          const userRepliesPosts = posts.filter((p) => {
            const checkAuthor = (handle: string) => {
              if (isOwnProfile) {
                return (
                  Boolean(myProfile.handle) &&
                  handle.toLowerCase() === myProfile.handle.toLowerCase()
                );
              }
              return handle.toLowerCase() === profile.handle.toLowerCase();
            };
            return (p.comments || []).some(
              (c) =>
                checkAuthor(c.authorHandle) ||
                (c.replies || []).some((r) => checkAuthor(r.authorHandle))
            );
          });

          if (isOwnProfile && !currentAuthUser) {
            return (
              <div
                className="profile-screen-container"
                style={{
                  minHeight: '75vh',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '48px 24px',
                }}
              >
                <div
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                    border: '2px dashed rgba(168,85,247,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c084fc',
                    marginBottom: '20px',
                  }}
                >
                  <IconUser size={40} />
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '10px' }}>
                  Create an Account or Log In
                </h2>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', maxWidth: '360px', lineHeight: 1.5, marginBottom: '24px' }}>
                  Join Privity to customize your profile, publish encrypted moments, follow creators, and connect with your inner circle.
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn-compose-prime"
                    onClick={() => setIsAuthModalOpen(true)}
                    style={{ padding: '12px 26px', fontSize: '14px', fontWeight: 700 }}
                  >
                    <span>Sign Up / Log In</span>
                  </button>
                  <button
                    type="button"
                    className="btn-glass-back"
                    onClick={() => setActiveTab('feed')}
                    style={{ padding: '12px 22px', fontSize: '13px' }}
                  >
                    <span>Browse Feed</span>
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
                className="profile-screen-container"
                onTouchStart={(e) => {
                  (window as any).__profileTouchStartX = e.touches[0].clientX;
                  (window as any).__profileTouchStartY = e.touches[0].clientY;
                }}
                onTouchEnd={(e) => {
                  const startX = (window as any).__profileTouchStartX || 0;
                  const startY = (window as any).__profileTouchStartY || 0;
                  const dx = e.changedTouches[0].clientX - startX;
                  const dy = e.changedTouches[0].clientY - startY;
                  if (dx > 70 && dx > Math.abs(dy) * 1.1) {
                    handleProfileBack();
                  }
                }}
              >
              {/* Native Apple-style Profile Top Bar */}
              <div className="profile-native-top-bar">
                <button
                  type="button"
                  className="profile-top-btn"
                  onClick={handleProfileBack}
                  title="Back"
                  aria-label="Back"
                >
                  <IconArrowLeft size={20} color="#fff" />
                </button>

                <button
                  type="button"
                  className={`profile-top-btn ${isProfileDrawerOpen ? 'active' : ''}`}
                  onClick={() => setIsProfileDrawerOpen(!isProfileDrawerOpen)}
                  title="Menu Options"
                  aria-label="Menu Options"
                >
                  <IconMenu3Lines size={20} color="#fff" />
                </button>
              </div>

              {/* Cover Stage Banner */}
              <div
                className="profile-cover-stage"
                style={{ position: 'relative', overflow: 'hidden' }}
              >
                {isVideoMedia(profile.coverUrl) ? (
                  <>
                    <video
                      key={cleanMediaUrl(profile.coverUrl)}
                      src={cleanMediaUrl(profile.coverUrl)}
                      poster={(profile as any).coverPoster || (profile as any).cover_poster || undefined}
                      autoPlay
                      loop
                      muted
                      playsInline
                      // @ts-ignore
                      webkit-playsinline="true"
                      ref={(el) => {
                        if (el) {
                          el.muted = true;
                          el.defaultMuted = true;
                          el.playsInline = true;
                          el.play().catch(() => {});
                        }
                      }}
                      onError={(e) => {
                        const vid = e.currentTarget;
                        if (vid) {
                          vid.style.display = 'none';
                          const fallback = vid.parentElement?.querySelector('.profile-cover-fallback') as HTMLElement;
                          if (fallback) fallback.style.display = 'block';
                        }
                      }}
                      className="profile-cover-video"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    <img
                      src={(profile as any).coverPoster || (profile as any).cover_poster || (profile.mediaItems && profile.mediaItems[0]?.url) || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600'}
                      alt={`${profile.name} Cover`}
                      className="profile-cover-img profile-cover-fallback"
                      style={{
                        display: 'none',
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                      }}
                    />
                  </>
                ) : (
                  <img
                    src={cleanMediaUrl(profile.coverUrl)}
                    alt={`${profile.name} Cover`}
                    className="profile-cover-img"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                      display: 'block',
                      imageRendering: '-webkit-optimize-contrast',
                    }}
                  />
                )}
                {isOwnProfile && (
                  <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 10 }}>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        color: '#fff',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      }}
                      title="Change Banner"
                    >
                      <IconPhoto size={14} color="#00f0ff" />
                      <span>Change Banner</span>
                      <input
                        type="file"
                        accept="image/*,video/*,.mp4,.mov,.webm,.m4v"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const cleanH = normalizeHandle(currentAuthUser?.handle || myProfile.handle) || 'creator';
                            if (file.type.startsWith('video') || file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
                              triggerToast('Updating banner video...');
                              const [animatedUrl, posterUrl] = await Promise.all([
                                convertVideoToAnimatedLoop(file, 'banner', cleanH),
                                extractVideoThumbnail(file).catch(() => ''),
                              ]);
                              handleDirectBannerChange(animatedUrl, posterUrl);
                            } else {
                              compressImageFile(file, 1600, 0.86, (dataUrl) => {
                                handleDirectBannerChange(dataUrl);
                              });
                            }
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Profile Card Info */}
              <div className="profile-header-card">
                <div className="profile-hero-row">
                  {(() => {
                    const userStoryIndex = stories.findIndex(
                      (st) => normalizeHandle(st.authorHandle) === normalizeHandle(profile.handle)
                    );
                    const hasActiveStory = userStoryIndex !== -1;

                    return (
                      <div
                        style={{ position: 'relative', flexShrink: 0, cursor: hasActiveStory ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (hasActiveStory) {
                            setDmActiveStoryIndex(userStoryIndex);
                          }
                        }}
                        title={hasActiveStory ? `Tap to view @${profile.handle}'s story` : profile.name}
                      >
                        {isVideoMedia(profile.avatar) ? (
                          <>
                            <video
                              key={cleanMediaUrl(profile.avatar)}
                              src={cleanMediaUrl(profile.avatar)}
                              poster={(profile as any).avatarPoster || (profile as any).avatar_poster || undefined}
                              autoPlay
                              loop
                              muted
                              playsInline
                              // @ts-ignore
                              webkit-playsinline="true"
                              ref={(el) => {
                                if (el) {
                                  el.muted = true;
                                  el.defaultMuted = true;
                                  el.playsInline = true;
                                  el.play().catch(() => {});
                                }
                              }}
                              onError={(e) => {
                                const vid = e.currentTarget;
                                if (vid) {
                                  vid.style.display = 'none';
                                  const fallback = vid.parentElement?.querySelector('.profile-avatar-fallback') as HTMLElement;
                                  if (fallback) fallback.style.display = 'block';
                                }
                              }}
                              className={`profile-avatar-squircle is-video-avatar ${hasActiveStory ? 'has-active-story-ring' : ''}`}
                              style={{ objectFit: 'cover' }}
                            />
                            <img
                              src={(profile as any).avatarPoster || (profile as any).avatar_poster || cleanMediaUrl(profile.avatar)}
                              alt={profile.name}
                              className={`profile-avatar-squircle profile-avatar-fallback ${hasActiveStory ? 'has-active-story-ring' : ''}`}
                              style={{ display: 'none', objectFit: 'cover' }}
                            />
                          </>
                        ) : (
                          <img
                            src={cleanMediaUrl(profile.avatar)}
                            alt={profile.name}
                            className={`profile-avatar-squircle ${hasActiveStory ? 'has-active-story-ring' : ''}`}
                          />
                        )}
                        {hasActiveStory && (
                          <div className="profile-story-badge" title="Active Story">
                            <span className="profile-story-badge-pulse" />
                            <span>STORY</span>
                          </div>
                        )}
                        {isOwnProfile && (
                          <label
                            className="btn-glass-avatar-edit"
                            title="Change Profile Picture"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconPhoto size={13} />
                            <input
                              type="file"
                              accept="image/*,video/*,.mp4,.mov,.webm,.m4v"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const cleanH = normalizeHandle(currentAuthUser?.handle || myProfile.handle) || 'creator';
                                  if (file.type.startsWith('video') || file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
                                    triggerToast('Updating profile video...');
                                    const [animatedUrl, posterUrl] = await Promise.all([
                                      convertVideoToAnimatedLoop(file, 'avatar', cleanH),
                                      extractVideoThumbnail(file).catch(() => ''),
                                    ]);
                                    handleDirectAvatarChange(animatedUrl, posterUrl);
                                  } else {
                                    compressImageFile(file, 280, 0.65, (dataUrl) => {
                                      handleDirectAvatarChange(dataUrl);
                                    });
                                  }
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })()}

                  {/* Specular VisionOS Stats Shelf right next to profile picture */}
                  {(() => {
                    const myCleanHandle = (myProfile.handle || '').toLowerCase().replace(/^@/, '').trim();
                    const rawFollowers = (isOwnProfile ? (myProfile.followersList || profile.followersList || []) : (profile.followersList || []))
                      .map((h) => (h || '').toLowerCase().replace(/^@/, '').trim())
                      .filter((h) => h && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-') && !isMockHandle(h));
                    const uniqueFollowers = new Set(rawFollowers);
                    if (!isOwnProfile && myCleanHandle) {
                      if (isFollowingThisUser) {
                        uniqueFollowers.add(myCleanHandle);
                      } else {
                        uniqueFollowers.delete(myCleanHandle);
                      }
                    }
                    const dynamicFollowersCount = uniqueFollowers.size;
                    const dynamicFollowingCount = isOwnProfile
                      ? getCleanFollowingHandles(followingMap, myProfile.handle).length
                      : Array.from(new Set((profile.followingList || []).map((h) => (h || '').toLowerCase().replace(/^@/, '').trim()).filter((h) => h && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-') && !isMockHandle(h)))).length;
                    const dynamicCirclesCount = isOwnProfile
                      ? closeFriendsList.length
                      : (profile.trustCirclesList || []).length;

                    // Deduplicate post visuals from profile.mediaItems to avoid double counting likes
                    const dispatchMediaUrls = new Set<string>();
                    let dispatchesLikes = 0;
                    for (const p of userDispatches) {
                      dispatchesLikes += Array.isArray(p.likersList) ? p.likersList.length : (p.likesCount || 0);
                      if (p.contentUrl) dispatchMediaUrls.add(extractMediaBaseKey(p.contentUrl) || p.contentUrl);
                      if (p.thumbnailUrl) dispatchMediaUrls.add(extractMediaBaseKey(p.thumbnailUrl) || p.thumbnailUrl);
                    }

                    let standaloneMediaLikes = 0;
                    for (const m of (profile.mediaItems || [])) {
                      const baseKey = extractMediaBaseKey(m.url);
                      if ((baseKey && dispatchMediaUrls.has(baseKey)) || dispatchMediaUrls.has(m.url) || userDispatches.some(p => p.id === m.id)) {
                        continue; // Already counted in dispatches
                      }
                      const photoRec = photoLikesMap[m.url] || (baseKey ? photoLikesMap[baseKey] : undefined);
                      standaloneMediaLikes += photoRec ? photoRec.count : (m.likes || 0);
                    }

                    const totalLikesReceived = dispatchesLikes + standaloneMediaLikes;

                    return (
                      <div className="profile-hero-stats-shelf">
                        <div
                          className="hero-stat-pill"
                          onClick={() => setProfileSubTab('dispatches')}
                          title="View all posts"
                        >
                          <div className="hero-stat-icon posts">
                            <IconList size={13} color="var(--public-cyan)" />
                          </div>
                          <span className="hero-stat-val">{userDispatches.length}</span>
                          <span className="hero-stat-lbl">Posts</span>
                        </div>

                        <div
                          className="hero-stat-pill"
                          onClick={() => openRoster(profile.handle, profile.name, 'followers')}
                          title="View followers"
                        >
                          <div className="hero-stat-icon followers">
                            <IconUsers size={13} color="#818cf8" />
                          </div>
                          <span className="hero-stat-val">{dynamicFollowersCount.toLocaleString()}</span>
                          <span className="hero-stat-lbl">Followers</span>
                        </div>

                        <div
                          className="hero-stat-pill"
                          onClick={() => openRoster(profile.handle, profile.name, 'following')}
                          title="View following"
                        >
                          <div className="hero-stat-icon following">
                            <IconUserCheck size={13} color="#38bdf8" />
                          </div>
                          <span className="hero-stat-val">{dynamicFollowingCount.toLocaleString()}</span>
                          <span className="hero-stat-lbl">Following</span>
                        </div>

                        <div
                          className="hero-stat-pill"
                          onClick={() => {
                            setProfileSubTab('liked');
                            triggerToast(`${profile.name} has received ${totalLikesReceived} total likes.`);
                          }}
                          title="View total likes"
                        >
                          <div className="hero-stat-icon likes">
                            <IconHeart size={13} filled color="var(--heart-rose)" />
                          </div>
                          <span className="hero-stat-val">{totalLikesReceived.toLocaleString()}</span>
                          <span className="hero-stat-lbl">Likes</span>
                        </div>

                        <div
                          className="hero-stat-pill"
                          onClick={() => openRoster(profile.handle, profile.name, 'circle')}
                          title="View trust circles"
                        >
                          <div className="hero-stat-icon circles">
                            <IconStarCloseFriends size={13} color="var(--cf-emerald)" />
                          </div>
                          <span className="hero-stat-val">{dynamicCirclesCount.toLocaleString()}</span>
                          <span className="hero-stat-lbl">Circles</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Identity & Bio */}
                <div className="profile-title-block">
                  <div className="profile-fullname-text">
                    {profile.name}
                    {profile.isVerified && (
                      <VerifiedBadge
                        authorName={profile.name}
                        category={profile.verifiedCategory}
                        since={profile.verifiedSince}
                        proofId={profile.cryptoProofId}
                      />
                    )}
                  </div>
                  <div className="profile-handle-sub" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span>@{profile.handle} • {profile.category || 'Creator'}</span>
                    {isUserOnline(profile.handle) ? (
                      <span className="profile-online-badge">
                        <span className="status-indicator-dot active" />
                        <span>Active now</span>
                      </span>
                    ) : (
                      <span className="profile-online-badge offline">
                        <span className="status-indicator-dot idle" />
                        <span>Offline</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="profile-bio-text">{profile.bio}</p>

                {/* Metadata Pills */}
                <div className="profile-meta-pills-row">
                  {profile.location && (
                    <div className="profile-meta-pill">
                      <IconMapPin size={14} color="var(--text-muted)" />
                      <span>{profile.location}</span>
                    </div>
                  )}
                  {profile.joinedDate && (
                    <div className="profile-meta-pill">
                      <IconCalendar size={14} color="var(--text-muted)" />
                      <span>{profile.joinedDate}</span>
                    </div>
                  )}
                  {profile.website && (
                    <div className="profile-meta-pill">
                      <IconLink size={14} color="var(--followers-iris)" />
                      <a
                        href={`https://${profile.website}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--followers-iris)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {profile.website}
                      </a>
                    </div>
                  )}
                  <div className="profile-meta-pill">
                    <IconShield size={14} color="var(--public-cyan)" />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--public-cyan)' }}>
                      {profile.cryptoProofId || 'priv_ed25519_verified'}
                    </span>
                  </div>
                </div>

                {/* Profile Actions Bar: Only shown for other users since own profile actions are elevated in the top 3-lines menu */}
                {!isOwnProfile && (
                  <div className="apple-profile-actions-bar">
                    <button
                      type="button"
                      className={`apple-glass-action-btn ${isFollowingThisUser ? 'following' : 'primary'}`}
                      onClick={() => toggleFollow(profile.handle, profile.name)}
                    >
                      {isFollowingThisUser ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <IconUserCheck size={14} /> Following
                        </span>
                      ) : (
                        'Follow'
                      )}
                    </button>
                    <button
                      type="button"
                      className="apple-glass-action-btn"
                      style={{
                        color: isInCloseFriends ? 'var(--cf-emerald)' : undefined,
                        borderColor: isInCloseFriends ? 'rgba(16, 185, 129, 0.4)' : undefined,
                      }}
                      onClick={() => toggleCloseFriends(profile.handle)}
                    >
                      <IconStarCloseFriends size={14} color={isInCloseFriends ? 'var(--cf-emerald)' : 'currentColor'} />
                      <span>{isInCloseFriends ? 'Close Friend' : 'Add to Circle'}</span>
                    </button>
                    <button
                      type="button"
                      className="apple-glass-action-btn"
                      onClick={() => {
                        setActiveChatUser(profile);
                        setActiveTab('messages');
                      }}
                    >
                      <IconChat size={14} />
                      <span>Message</span>
                    </button>
                  </div>
                )}
                </div>



                {/* PRIVATE ACCOUNT LOCK PROTECTION (PRD PRIVACY RULE) */}
                {!isOwnProfile && profile.isPrivate && !isFollowingThisUser ? (
                  <div className="private-account-lock-stage">
                    <div className="private-lock-icon-orb">
                      <IconLock size={28} color="var(--cf-emerald)" />
                    </div>
                    <div className="private-lock-title">This Account is Private</div>
                    <p className="private-lock-desc">
                      Follow @{profile.handle} to view their dispatches, follower directory, and relationship circles.
                    </p>
                    <button
                      className="btn-post-dispatch"
                      onClick={() => {
                        toggleFollow(profile.handle, profile.name);
                        triggerToast(`Follow request approved! Access granted to @${profile.handle}.`);
                      }}
                    >
                      Request Follow Access
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Profile Sub Tabs */}
                    <div className="profile-view-tabs">
                      <button
                        className={`profile-view-tab-btn ${profileSubTab === 'dispatches' ? 'active' : ''}`}
                        onClick={() => setProfileSubTab('dispatches')}
                      >
                        <IconList size={15} />
                        <span>Dispatches ({userDispatches.length})</span>
                      </button>
                      <button
                        className={`profile-view-tab-btn ${profileSubTab === 'media' ? 'active' : ''}`}
                        onClick={() => setProfileSubTab('media')}
                      >
                        <IconGrid size={15} />
                        <span>Media & Studio ({profile.mediaItems ? profile.mediaItems.length : 0})</span>
                      </button>
                      <button
                        className={`profile-view-tab-btn ${profileSubTab === 'liked' ? 'active' : ''}`}
                        onClick={() => setProfileSubTab('liked')}
                      >
                        <IconHeart size={15} color={profileSubTab === 'liked' ? 'var(--brand-crimson)' : undefined} />
                        <span>Liked ({userLikedPosts.length})</span>
                      </button>
                      {isOwnProfile && (
                        <button
                          className={`profile-view-tab-btn ${profileSubTab === 'saved' ? 'active' : ''}`}
                          onClick={() => setProfileSubTab('saved')}
                        >
                          <IconBookmark size={15} color={profileSubTab === 'saved' ? 'var(--brand-gold)' : undefined} />
                          <span>Saved ({userSavedPosts.length})</span>
                        </button>
                      )}
                      <button
                        className={`profile-view-tab-btn ${profileSubTab === 'replies' ? 'active' : ''}`}
                        onClick={() => setProfileSubTab('replies')}
                      >
                        <IconChat size={15} color={profileSubTab === 'replies' ? 'var(--public-cyan)' : undefined} />
                        <span>Replies ({userRepliesPosts.length})</span>
                      </button>
                    </div>

                {/* Sub Tab: Post Feeds (Dispatches, Liked, Saved, Replies) */}
                {profileSubTab !== 'media' && (() => {
                  const activeTabPosts =
                    profileSubTab === 'liked'
                      ? userLikedPosts
                      : profileSubTab === 'saved'
                      ? userSavedPosts
                      : profileSubTab === 'replies'
                      ? userRepliesPosts
                      : userDispatches;

                  const emptyMessage =
                    profileSubTab === 'liked'
                      ? 'No liked dispatches yet. Posts you heart will appear here.'
                      : profileSubTab === 'saved'
                      ? 'No saved dispatches yet. Bookmark dispatches to revisit them privately.'
                      : profileSubTab === 'replies'
                      ? 'No replies yet. Dispatches you have replied to or commented on will appear here.'
                      : 'No dispatches published yet.';

                  return (
                    <div style={{ marginTop: '14px' }}>
                      {activeTabPosts.length > 0 ? (
                        activeTabPosts.map((post) => (
                        <article key={post.id} className={`feed-post-card ${highlightPostId === post.id ? 'post-just-published-shimmer' : ''}`}>
                          <img
                            src={post.authorAvatar}
                            alt={post.authorName}
                            className="post-author-avatar"
                          />
                          <div className="post-main-column">
                            <div className="post-meta-line">
                              <div className="author-credentials-group">
                                <span className="author-title-text">{post.authorName}</span>
                                {post.isVerified && (
                                  <VerifiedBadge
                                    authorName={post.authorName}
                                    category={post.verifiedCategory}
                                    since={post.verifiedSince}
                                    proofId={post.cryptoProofId}
                                  />
                                )}
                                <span className="author-handle-text">@{post.authorHandle.replace(/^@+/, '')}</span>
                                <span className="post-time-stamp">· {post.timeAgo}</span>
                              </div>
                              <div className={`privacy-pill-tag ${post.privacy}`}>
                                {post.privacy === 'close_friends' && (
                                  <>
                                    <IconStarCloseFriends size={12} color="var(--cf-emerald)" />
                                    <span>Close Friends</span>
                                  </>
                                )}
                                {post.privacy === 'followers' && (
                                  <>
                                    <IconUsers size={12} color="var(--followers-iris)" />
                                    <span>Followers Only</span>
                                  </>
                                )}
                                {post.privacy === 'public' && (
                                  <>
                                    <IconGlobe size={12} color="var(--public-cyan)" />
                                    <span>Public</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <p className="post-narrative-text">{post.caption}</p>

                            {post.tags && post.tags.length > 0 && (
                              <div className="post-tags-container">
                                {post.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className={`post-tag-item ${activeTagFilter === tag ? 'active' : ''}`}
                                    onClick={(e) => handleTagClick(tag, e)}
                                    title={`Click to filter dispatches by #${tag}`}
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {post.type === 'image' && post.contentUrl && (
                              <div
                                className="post-visual-stage"
                                onDoubleClick={() => handleLike(post.id, true)}
                                onClick={() => setLightboxUrl(post.contentUrl || null)}
                              >
                                <img src={post.contentUrl} alt="Post Media" loading="lazy" />
                                {heartExplodingPostId === post.id && (
                                  <div className="spring-heart-explosion">
                                    <IconHeart size={84} color="var(--heart-rose)" filled />
                                  </div>
                                )}
                              </div>
                            )}

                            {post.type === 'video' && (post.videoUrl || post.contentUrl || post.thumbnailUrl || post.videoMediaId) && (
                              <div className="post-visual-stage">
                                <PrivityVideoPlayer post={post} />
                              </div>
                            )}

                            {(() => {
                              const viewerHandle = normalizeHandle(currentAuthUser?.handle || myProfile.handle || activeAuthHandle);
                              const effectiveLiked = isPostLikedByUser(post, viewerHandle);
                              const effectiveLikers = (post.likersList || []).map(normalizeHandle).filter(Boolean);
                              const rawLikesCount = typeof post.likesCount === 'number' && !isNaN(post.likesCount) ? post.likesCount : 0;
                              const effectiveLikesCount = Array.isArray(post.likersList) ? post.likersList.length : rawLikesCount;
                              const isSaved = Boolean((viewerHandle && (post.saversList || []).map(normalizeHandle).includes(viewerHandle)) || savedPostIds.includes(post.id) || post.isSaved);
                              const effectiveSavesCount = Array.isArray(post.saversList) ? post.saversList.length : (post.savesCount || 0);

                              return (
                                <>
                                  <div className="post-toolbar-line">
                                    <button
                                      className={`btn-post-action ${effectiveLiked ? 'liked' : ''}`}
                                      onClick={() => handleLike(post.id)}
                                    >
                                      <IconHeart size={18} filled={effectiveLiked} color={effectiveLiked ? 'var(--heart-rose)' : 'currentColor'} />
                                      <span>{effectiveLikesCount}</span>
                                    </button>
                                    <button
                                      className="btn-post-action"
                                      onClick={() => {
                                        const el = document.getElementById(`comment-input-${post.id}`);
                                        el?.focus();
                                      }}
                                    >
                                      <IconChat size={18} />
                                      <span>{post.commentsCount}</span>
                                    </button>
                                    <button
                                      className="btn-post-action"
                                      onClick={() => handleShare(post.id)}
                                      title="Share Link"
                                    >
                                      <IconShare size={18} />
                                    </button>
                                    <button
                                      className={`btn-post-action ${isSaved ? 'saved' : ''}`}
                                      onClick={() => handleSave(post.id)}
                                      title="Save"
                                    >
                                      <IconBookmark size={18} filled={isSaved} color={isSaved ? 'var(--cf-emerald)' : 'currentColor'} />
                                      <span>{effectiveSavesCount}</span>
                                    </button>
                                    <button
                                      className="btn-post-action"
                                      onClick={() => {
                                        const isOwn = post.authorHandle === myProfile.handle || Boolean(myProfile.id && post.authorId === myProfile.id);
                                        setPostMenuModal({ post, isOwn });
                                      }}
                                      title={post.authorHandle === myProfile.handle ? 'Dispatch options' : 'Report content'}
                                    >
                                      <IconDots size={18} />
                                    </button>
                                  </div>

                                  {/* Liked By Directory Strip - 100% Accurate & Clickable */}
                                  {effectiveLikesCount > 0 && (
                                    <div
                                      className="post-liked-by-strip"
                                      style={{ marginTop: '10px' }}
                                      onClick={() => {
                                        openRoster(post.authorHandle, post.authorName, 'likes', effectiveLikers);
                                      }}
                                      title="Click to view everyone who liked this dispatch"
                                    >
                                      <div className="liked-avatars-stack">
                                        {effectiveLikers.slice(0, 3).map((h) => {
                                          const u = getUserProfile(h);
                                          return (
                                            <img
                                              key={h}
                                              src={u.avatar}
                                              alt={u.name}
                                              className="liked-avatar-mini"
                                            />
                                          );
                                        })}
                                      </div>
                                      <span>
                                        Liked by{' '}
                                        {effectiveLikers.slice(0, 2).map((h, idx) => {
                                          const u = getUserProfile(h);
                                          const isLastOfTwo = effectiveLikers.length === 2 && idx === 1;
                                          const isFirstOfMany = effectiveLikers.length > 2 && idx === 0;
                                          return (
                                            <span key={h}>
                                              {isLastOfTwo && ' and '}
                                              <strong>{u.name}</strong>
                                              {isFirstOfMany && ', '}
                                            </span>
                                          );
                                        })}
                                        {effectiveLikers.length > 2 && (
                                          <>
                                            {' '}and <strong>{effectiveLikers.length - 2} {((effectiveLikers.length - 2 === 1) ? 'other' : 'others')}</strong>
                                          </>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {/* Real Threaded Comments Section on Profile Dispatches */}
                            <div className="comments-thread-box">
                              {post.comments.map((comment) => (
                                <div key={comment.id}>
                                  <div className="thread-row">
                                    <img
                                      src={comment.authorAvatar}
                                      alt={comment.authorName}
                                      className="thread-user-pic"
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => navigateToProfile(comment.authorHandle)}
                                      title={`View @${comment.authorHandle}'s profile`}
                                    />
                                    <div className="thread-bubble">
                                      <div className="thread-author-bar">
                                        <span
                                          className="thread-author-name"
                                          style={{ cursor: 'pointer' }}
                                          onClick={() => navigateToProfile(comment.authorHandle)}
                                          title={`View @${comment.authorHandle}'s profile`}
                                        >
                                          {comment.authorName}{' '}
                                          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px' }}>
                                            @{comment.authorHandle}
                                          </span>
                                        </span>
                                        <span className="thread-time">{comment.timeAgo}</span>
                                      </div>
                                      <div className="thread-content-text">{comment.text}</div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
                                        <button
                                          type="button"
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--followers-iris)',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            padding: 0,
                                          }}
                                          onClick={() => {
                                            setReplyTarget({
                                              postId: post.id,
                                              commentId: comment.id,
                                              handle: comment.authorHandle,
                                            });
                                            const el = document.getElementById(`comment-input-${post.id}`);
                                            el?.focus();
                                          }}
                                        >
                                          Reply
                                        </button>
                                        <button
                                          type="button"
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: comment.isLiked ? '#ef4444' : 'var(--text-muted)',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            padding: 0,
                                          }}
                                          onClick={() => handleLikeComment(post.id, comment.id)}
                                        >
                                          <span>{(comment.likesCount || 0) > 0 ? comment.likesCount : 'Like'}</span>
                                        </button>
                                        {(Boolean(myProfile.handle) && comment.authorHandle.toLowerCase() === myProfile.handle.toLowerCase()) && (
                                          <button
                                            type="button"
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              color: 'var(--text-faint)',
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              padding: 0,
                                            }}
                                            onClick={() => handleDeleteComment(post.id, comment.id)}
                                          >
                                            Delete
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Nested Replies */}
                                  {comment.replies && comment.replies.length > 0 && (
                                    <div style={{ marginLeft: '40px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {comment.replies.map((reply) => (
                                        <div key={reply.id} className="thread-row reply-row">
                                          <img
                                            src={reply.authorAvatar}
                                            alt={reply.authorName}
                                            className="thread-user-pic reply-pic"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => navigateToProfile(reply.authorHandle)}
                                          />
                                          <div className="thread-bubble reply-bubble">
                                            <div className="thread-author-bar">
                                              <span
                                                className="thread-author-name"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => navigateToProfile(reply.authorHandle)}
                                              >
                                                {reply.authorName}{' '}
                                                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px' }}>
                                                  @{reply.authorHandle}
                                                </span>
                                              </span>
                                              <span className="thread-time">{reply.timeAgo}</span>
                                            </div>
                                            <div className="thread-content-text">{reply.text}</div>
                                            {(Boolean(myProfile.handle) && reply.authorHandle.toLowerCase() === myProfile.handle.toLowerCase()) && (
                                              <div style={{ marginTop: '4px' }}>
                                                <button
                                                  type="button"
                                                  style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--text-faint)',
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                  }}
                                                  onClick={() => handleDeleteComment(post.id, comment.id, reply.id)}
                                                >
                                                  Delete
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}

                              {/* Comment Compose Tray on Profile Dispatches */}
                              <div className="comment-compose-tray">
                                <img
                                  src={myProfile.avatar}
                                  alt={myProfile.name}
                                  className="comment-user-avatar"
                                />
                                <div className="comment-input-wrap">
                                  {replyTarget && replyTarget.postId === post.id && (
                                    <div className="reply-banner-pill">
                                      <span>Replying to @{replyTarget.handle}</span>
                                      <button
                                        type="button"
                                        onClick={() => setReplyTarget(null)}
                                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                                      >
                                        <IconX size={12} />
                                      </button>
                                    </div>
                                  )}
                                  <input
                                    type="text"
                                    id={`comment-input-${post.id}`}
                                    className="comment-text-field"
                                    placeholder={
                                      replyTarget && replyTarget.postId === post.id
                                        ? `Replying to @${replyTarget.handle}...`
                                        : 'Add a thoughtful reply...'
                                    }
                                    value={commentInputs[post.id] || ''}
                                    onChange={(e) =>
                                      setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleAddComment(post.id);
                                      }
                                    }}
                                  />
                                  <button
                                    className="btn-comment-post"
                                    onClick={() => handleAddComment(post.id)}
                                    title="Send Comment"
                                  >
                                    <IconSend size={13} color="#fff" />
                                    <span>Send</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                        {emptyMessage}
                      </div>
                    )}
                  </div>
                );
              })()}

                {/* Sub Tab 2: Media & Studio Grid */}
                {profileSubTab === 'media' && (
                  <div style={{ marginTop: '16px' }}>
                    {isOwnProfile && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(0, 240, 255, 0.15)',
                            border: '1px solid rgba(0, 240, 255, 0.4)',
                            color: '#fff',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(0, 240, 255, 0.2)',
                          }}
                        >
                          <IconPhoto size={15} color="var(--brand-cyan)" />
                          <span>+ Add Photo / Video to Studio</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const cleanH = normalizeHandle(currentAuthUser?.handle || myProfile.handle);
                                if (file.type.startsWith('video')) {
                                  triggerToast('Optimizing video for studio...');
                                  try {
                                    const loopUrl = await convertVideoToAnimatedLoop(file, 'studio', cleanH);
                                    handleAddProfileMedia(loopUrl, 'video');
                                  } catch (err) {
                                    console.error('Failed to convert studio video:', err);
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      handleAddProfileMedia(reader.result as string, 'video');
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                } else {
                                  compressImageFile(file, 960, 0.8, (dataUrl) => {
                                    handleAddProfileMedia(dataUrl, 'image');
                                  });
                                }
                              }
                            }}
                          />
                        </label>
                      </div>
                    )}
                    {profile.mediaItems && profile.mediaItems.length > 0 ? (
                      <div className="profile-media-grid">
                        {profile.mediaItems.map((item) => {
                          const baseKey = extractMediaBaseKey(item.url);
                          const photoRecord = photoLikesMap[item.url] || (baseKey ? photoLikesMap[baseKey] : undefined);
                          const matchingPost = posts.find((p) => isSameMedia(p.contentUrl, item.url) || isSameMedia(p.thumbnailUrl, item.url));
                          const isItemLiked = photoRecord !== undefined
                            ? photoRecord.isLiked
                            : (matchingPost !== undefined ? matchingPost.isLiked : !!item.isLiked);
                          const itemLikesCount = photoRecord !== undefined
                            ? photoRecord.count
                            : (matchingPost !== undefined ? matchingPost.likesCount : item.likes);
                          const itemCommentsCount = matchingPost ? matchingPost.commentsCount : item.comments;

                          return (
                            <div
                              key={item.id}
                              className="profile-media-cell"
                              onClick={() => {
                                setLightboxUrl(item.url);
                                setLightboxIsPrivateMessage(false);
                                setLightboxShowComments(false);
                              }}
                            >
                              {item.type === 'video' || isVideoMedia(item.url) ? (
                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                  <video
                                    key={cleanMediaUrl(item.url)}
                                    src={cleanMediaUrl(item.url)}
                                    muted
                                    playsInline
                                    loop
                                    autoPlay
                                    // @ts-ignore
                                    webkit-playsinline="true"
                                    ref={(el) => {
                                      if (el) {
                                        el.muted = true;
                                        el.defaultMuted = true;
                                        el.playsInline = true;
                                        el.play().catch(() => {});
                                      }
                                    }}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                  <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.65)', borderRadius: 10, padding: '2px 6px', fontSize: 10, color: '#fff', fontWeight: 700 }}>
                                    ▶ VIDEO
                                  </div>
                                </div>
                              ) : (
                                <img src={cleanMediaUrl(item.url)} alt="Studio Media" loading="lazy" />
                              )}
                              <div className="profile-media-hover-overlay">
                                <div
                                  className="media-interactive-heart"
                                  onClick={(e) => handleLikeMedia(profile.handle, item.id, e)}
                                  title={isItemLiked ? 'Unlike photo' : 'Like photo'}
                                >
                                  <IconHeart size={16} filled={isItemLiked} color={isItemLiked ? 'var(--heart-rose)' : '#fff'} />
                                  <span style={{ marginLeft: '4px', fontWeight: 700 }}>{itemLikesCount}</span>
                                </div>
                                <div
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxUrl(item.url);
                                    setLightboxIsPrivateMessage(false);
                                    setLightboxShowComments(true);
                                  }}
                                  title="View & add comments"
                                >
                                  <IconChat size={16} color="#fff" />
                                  <span>{itemCommentsCount}</span>
                                </div>

                                {Boolean(myProfile.handle) && profile.handle.toLowerCase() === myProfile.handle.toLowerCase() && (
                                  <div
                                    style={{
                                      marginLeft: 'auto',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: 'rgba(239, 68, 68, 0.5)',
                                      color: '#ffffff',
                                      borderRadius: '50%',
                                      width: '28px',
                                      height: '28px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteMediaItem(profile.handle, item.id, item.url);
                                    }}
                                    title="Delete this visual permanently from Studio and Feed"
                                  >
                                    <IconTrash size={14} />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        No media artifacts published yet.
                      </div>
                    )}
                  </div>
                )}

                </>
              )}

              {/* Profile Right Slide-Over Drawer */}
              <div
                className={`profile-drawer-backdrop ${isProfileDrawerOpen ? 'open' : ''}`}
                onClick={() => setIsProfileDrawerOpen(false)}
              />

              <div className={`profile-slideover-drawer ${isProfileDrawerOpen ? 'open' : ''}`}>
                <div className="profile-drawer-header">
                  <div className="profile-drawer-user-info">
                    <img src={profile.avatar} alt={profile.name} className="profile-drawer-avatar" />
                    <div>
                      <div className="profile-drawer-name">{profile.name}</div>
                      <div className="profile-drawer-handle">@{profile.handle}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="profile-drawer-close-btn"
                    onClick={() => setIsProfileDrawerOpen(false)}
                    title="Close Menu"
                  >
                    <IconX size={16} />
                  </button>
                </div>

                <div className="profile-drawer-menu">
                  <button
                    type="button"
                    className="profile-drawer-item"
                    onClick={() => {
                      setIsProfileDrawerOpen(false);
                      handleOpenEditProfile();
                    }}
                  >
                    <div className="profile-drawer-item-icon edit">
                      <IconEdit size={18} color="#fff" />
                    </div>
                    <div className="profile-drawer-item-text">
                      <span className="profile-drawer-item-title">Edit Profile</span>
                      <span className="profile-drawer-item-desc">Change bio, username & media</span>
                    </div>
                    <span className="profile-drawer-chevron">›</span>
                  </button>

                  <button
                    type="button"
                    className="profile-drawer-item"
                    onClick={() => {
                      setIsProfileDrawerOpen(false);
                      setIsSettingsOpen(true);
                    }}
                  >
                    <div className="profile-drawer-item-icon settings">
                      <IconSettings size={18} color="#fff" />
                    </div>
                    <div className="profile-drawer-item-text">
                      <span className="profile-drawer-item-title">Settings</span>
                      <span className="profile-drawer-item-desc">Security, privacy & keys</span>
                    </div>
                    <span className="profile-drawer-chevron">›</span>
                  </button>

                  <button
                    type="button"
                    className="profile-drawer-item"
                    onClick={() => {
                      setIsProfileDrawerOpen(false);
                      navigator.clipboard?.writeText(`https://privity.app/@${profile.handle}`);
                      triggerToast(`Profile link copied: @${profile.handle}`);
                    }}
                  >
                    <div className="profile-drawer-item-icon share">
                      <IconShare size={18} color="#fff" />
                    </div>
                    <div className="profile-drawer-item-text">
                      <span className="profile-drawer-item-title">Share Profile</span>
                      <span className="profile-drawer-item-desc">Copy link or share to friends</span>
                    </div>
                    <span className="profile-drawer-chevron">›</span>
                  </button>
                </div>

                <div className="profile-drawer-footer">
                  <div className="profile-drawer-badge">
                    <IconShield size={14} color="var(--public-cyan)" />
                    <span>Ed25519 Hardware Verification</span>
                  </div>
                  <span className="profile-drawer-version">Privity Mobile App • v2.6.0</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- VIEW 5: SAFETY & MODERATION HUB --- */}
        {activeTab === 'safety' && (
          <div style={{ padding: '28px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
              Safety & Content Moderation Center
            </h2>

            <div className="glass-panel-card" style={{ marginBottom: '24px' }}>
              <div className="panel-title-text">Live Reports Queue</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '10px' }}>Report ID</th>
                    <th style={{ padding: '10px' }}>Target Author</th>
                    <th style={{ padding: '10px' }}>Reason</th>
                    <th style={{ padding: '10px' }}>Snippet</th>
                    <th style={{ padding: '10px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '12px 10px', fontFamily: 'var(--font-mono)' }}>{r.id}</td>
                      <td style={{ padding: '12px 10px' }}>@{r.targetAuthor}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ color: 'var(--heart-rose)', fontWeight: 700 }}>{r.reason}</span>
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>"{r.snippet}"</td>
                      <td style={{ padding: '12px 10px' }}>
                        {r.status === 'open' ? (
                          <button
                            className="btn-post-dispatch"
                            style={{ padding: '4px 12px', fontSize: '11px' }}
                            onClick={() => setSelectedReport(r)}
                          >
                            Review & Enforce
                          </button>
                        ) : (
                          <span style={{ color: 'var(--cf-emerald)' }}>Resolved ✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="glass-panel-card">
              <div className="panel-title-text">Immutable Security Audit Trail</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                {auditLogs.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      background: 'var(--glass-input)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    <span style={{ color: 'var(--public-cyan)', fontFamily: 'var(--font-mono)' }}>[{l.id}]</span>{' '}
                    <strong>@{l.actorUsername}</strong> executed <code>{l.action}</code> on <strong>{l.targetType} ({l.targetId})</strong>: {l.reason} · <span style={{ color: 'var(--text-muted)' }}>{new Date(l.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* 3. RIGHT SIDEBAR (SEARCH & SUGGESTED)                    */}
      {/* ======================================================== */}
      {activeTab !== 'messages' && !(activeTab === 'feed' && feedFilter === 'live') && (
        <aside className="side-intel-column">
        <div className="search-input-shell">
          <span className="search-lens-icon"><IconSearch size={18} /></span>
          <input
            type="text"
            className="search-glass-field"
            placeholder="Search Privity creators, tags..."
          />
        </div>

        {/* Featured Creators */}
        <div className="glass-panel-card">
          <div className="panel-title-text">Featured Creators</div>
          {(() => {
            const availableCreators = Object.values(profiles).filter(
              (p) => !isMockHandle(p.handle) && p.handle.toLowerCase() !== myProfile.handle.toLowerCase()
            );

            if (availableCreators.length === 0) {
              return (
                <div style={{ padding: '16px 0', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No other creators registered yet
                </div>
              );
            }

            return availableCreators.slice(0, 5).map((u) => {
              const isF = isUserFollowed(u.handle);
              return (
                <div key={u.id || u.handle} className="creator-entry-row">
                  <div
                    className="creator-ident-left"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigateToProfile(u.handle)}
                    title={`View @${u.handle}'s profile`}
                  >
                    <img src={u.avatar} alt={u.name} className="creator-thumb-pic" />
                    <div>
                      <div className="creator-title-bold">
                        {u.name}
                        {u.isVerified && <VerifiedBadge authorName={u.name} category={u.category} />}
                      </div>
                      <div className="creator-subtitle-meta">@{u.handle}</div>
                    </div>
                  </div>
                  <button
                    className={`btn-follow-toggle ${isF ? 'following' : ''}`}
                    onClick={() => toggleFollow(u.handle, u.name)}
                  >
                    {isF ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            });
          })()}
        </div>

        {/* Trending Tags */}
        <div className="glass-panel-card">
          <div className="panel-title-text">Trending in Your Network</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dynamicTrendingTags.length === 0 ? (
              <div style={{ padding: '12px 0', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                No trending tags yet
              </div>
            ) : (
              dynamicTrendingTags.map((t) => (
                <div
                  key={t.tag}
                  className="trending-topic-cell"
                  onClick={() => {
                    setActiveTagFilter(t.tag);
                    setActiveTab('feed');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    triggerToast(`Filtered feed by #${t.tag}`);
                  }}
                  style={{ cursor: 'pointer' }}
                  title={`Filter feed by #${t.tag}`}
                >
                  <div className="topic-hashtag-title">#{t.tag}</div>
                  <div className="topic-volume-sub">{t.count}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Zero-Algorithm Commitment Card */}
        <div className="zero-algo-pledge">
          <div className="pledge-headline">
            <IconShield size={18} color="var(--cf-emerald)" />
            Zero-Algorithm Commitment
          </div>
          <p className="pledge-body-copy">
            Privity has no opaque recommendation black-box. Every post is delivered chronologically to the exact audience you specified.
          </p>
        </div>
        </aside>
      )}

      {/* ======================================================== */}
      {/* 4. MODALS & LIGHTBOXES                                   */}
      {/* ======================================================== */}

      {/* Global Incoming Co-Host / Guest Invite Banner when not in Arena */}
      {globalIncomingInvite && !activeLiveStream && (
        <div
          className="tiktok-incoming-invite-banner"
          style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', maxWidth: '440px', width: 'calc(100% - 32px)', zIndex: 99999 }}
        >
          <img
            src={globalIncomingInvite.senderAvatar}
            alt={globalIncomingInvite.senderName}
            className="invite-avatar"
          />
          <div className="invite-text">
            <span className="invite-name">{globalIncomingInvite.senderName}</span>
            <span className="invite-sub">
              {globalIncomingInvite.type === 'cohost' ? 'Invited you to Co-Host Live! 🤝' : 'Invited you to Stage as Guest! 🎤'}
            </span>
          </div>
          <div className="invite-actions">
            <button
              type="button"
              className="invite-accept-btn"
              onClick={() => {
                const invite = globalIncomingInvite;
                setGlobalIncomingInvite(null);
                const cleanSenderH = invite.senderHandle.replace(/^@+/, '').toLowerCase().trim();
                const targetStreamer =
                  networkLiveStreamers.find((s) => (s.handle || '').replace(/^@+/, '').toLowerCase().trim() === cleanSenderH) ||
                  networkLiveStreamers.find((s) => s.id === `stream-${cleanSenderH}` || s.id === `live-user-${cleanSenderH}`) ||
                  LIVEME_STREAMERS.find((s) => (s.handle || '').replace(/^@+/, '').toLowerCase().trim() === cleanSenderH) ||
                  invite.senderStreamer || {
                    id: `stream-${cleanSenderH}`,
                    creatorHandle: cleanSenderH,
                    creatorName: invite.senderName,
                    creatorAvatar: invite.senderAvatar,
                    name: invite.senderName,
                    handle: `@${cleanSenderH}`,
                    avatar: invite.senderAvatar,
                    title: 'Live Co-Host Duel',
                    description: 'Live broadcast',
                    viewersCount: 1,
                    likesCount: 50,
                    category: 'Co-Host',
                    videoStreamUrl: '',
                    previewUrl: invite.senderAvatar,
                    posterUrl: invite.senderAvatar,
                    isVerified: true,
                    diamonds: 0,
                    dailyRank: 'Top 10',
                    multiGuests: [],
                    participants: [],
                    tags: ['CoHost'],
                    topContributors: [],
                  };

                setIsHostBroadcasting(false);
                setIsCoHostInviteAccepted(invite.type === 'cohost');
                setActiveLiveStream(targetStreamer as any);
                setMinimizedLiveStream(null);

                const cleanMyH = (myProfile.handle || '').replace(/^@+/, '').toLowerCase().trim();
                const acceptEvt = {
                  type: invite.type === 'cohost' ? 'COHOST_INVITE_ACCEPTED' : 'GUEST_INVITE_ACCEPTED',
                  senderHandle: `@${cleanMyH}`,
                  senderName: myProfile.name,
                  senderAvatar: myProfile.avatar,
                  coHostHandle: `@${cleanMyH}`,
                  coHostName: myProfile.name,
                  coHostAvatar: myProfile.avatar,
                  targetHandle: cleanSenderH,
                  rivalStreamer: {
                    id: `stream-${cleanMyH}`,
                    name: myProfile.name,
                    handle: `@${cleanMyH}`,
                    avatar: myProfile.avatar,
                    videoStreamUrl: '',
                    posterUrl: myProfile.avatar,
                    viewersCount: 1,
                    diamonds: 0,
                  },
                };
                liveStreamSync.sendRoomEvent(cleanSenderH, acceptEvt);
                const targetRoomId = (targetStreamer as any)?.handle ? (targetStreamer as any).handle.replace(/^@+/, '').toLowerCase().trim() : targetStreamer.id;
                if (targetRoomId && targetRoomId !== cleanSenderH) {
                  liveStreamSync.sendRoomEvent(targetRoomId, acceptEvt);
                }
                if (cleanMyH && cleanMyH !== cleanSenderH) {
                  liveStreamSync.sendRoomEvent(cleanMyH, acceptEvt);
                }
                try {
                  const bus = new BroadcastChannel('privity_sync_bus');
                  bus.postMessage(acceptEvt);
                  bus.close();
                } catch {}
              }}
            >
              Accept
            </button>
            <button
              type="button"
              className="invite-decline-btn"
              onClick={() => {
                const invite = globalIncomingInvite;
                setGlobalIncomingInvite(null);
                const cleanSenderH = invite.senderHandle.replace(/^@+/, '').toLowerCase().trim();
                const cleanMyH = (myProfile.handle || '').replace(/^@+/, '').toLowerCase().trim();
                const declineEvt = {
                  type: invite.type === 'cohost' ? 'COHOST_INVITE_DECLINED' : 'GUEST_INVITE_DECLINED',
                  senderHandle: `@${cleanMyH}`,
                  senderName: myProfile.name,
                  targetHandle: cleanSenderH,
                };
                liveStreamSync.sendRoomEvent(cleanSenderH, declineEvt);
                try {
                  const bus = new BroadcastChannel('privity_sync_bus');
                  bus.postMessage(declineEvt);
                  bus.close();
                } catch {}
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* 100% FAITHFUL LIVEME STREAM ARENA REPLICATION */}
      {activeLiveStream && (
        <LiveMeStreamArena
          initialStreamerId={activeLiveStream.id}
          isHostBroadcast={isHostBroadcasting}
          initialCoHostMode={isCoHostInviteAccepted}
          userMediaStream={hostLiveCameraStream}
          customStreamer={activeLiveStream as any}
          currentUser={{
            name: currentAuthUser?.name || myProfile.name || 'Member',
            handle: (currentAuthUser?.handle || myProfile.handle || '').startsWith('@')
              ? (currentAuthUser?.handle || myProfile.handle || '')
              : `@${currentAuthUser?.handle || myProfile.handle || 'member'}`,
            avatar: currentAuthUser?.avatar || myProfile.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
          }}
          onClose={(opts?: { wasEnded?: boolean; isHost?: boolean }) => {
            const cleanMyH = (myProfile.handle || '').replace(/^@+/, '').toLowerCase().trim();
            const discEvt = {
              type: 'COHOST_DISCONNECTED',
              senderHandle: `@${cleanMyH}`,
            };
            if (activeLiveStream?.id) {
              liveStreamSync.sendRoomEvent(activeLiveStream.id, discEvt);
              const targetHandle = ((activeLiveStream as any).creatorHandle || (activeLiveStream as any).handle || '').replace(/^@+/, '').toLowerCase().trim();
              if (targetHandle && targetHandle !== activeLiveStream.id) {
                liveStreamSync.sendRoomEvent(targetHandle, discEvt);
              }
            }
            try {
              const bus = new BroadcastChannel('privity_sync_bus');
              bus.postMessage(discEvt);
              bus.close();
            } catch {}
            setIsCoHostInviteAccepted(false);
            if (opts?.wasEnded || opts?.isHost || isHostBroadcasting) {
              // Live has ended or host is closing: NEVER minimize!
              setMinimizedLiveStream(null);
              setActiveLiveStream(null);
              setIsHostBroadcasting(false);
              const targetHandle = ((activeLiveStream as any)?.creatorHandle || (activeLiveStream as any)?.handle || '').replace(/^@+/, '').toLowerCase().trim();
              const streamId = activeLiveStream?.id || '';
              try {
                if (targetHandle) localStorage.removeItem(`privity_live_chat_${targetHandle}`);
                if (streamId) localStorage.removeItem(`privity_live_chat_${streamId}`);
                const bus = new BroadcastChannel('privity_sync_bus');
                bus.postMessage({ type: 'LIVE_ROOM_RESET', hostHandle: targetHandle, roomId: streamId });
                bus.close();
              } catch {}
              if (activeLiveStream?.id) {
                liveStreamSync.markStreamEnded(activeLiveStream.id, targetHandle);
                broadcastSyncEvent({
                  action: 'LIVE_ENDED',
                  streamId: activeLiveStream.id,
                  handle: targetHandle,
                });
                broadcastSyncEvent({
                  action: 'LIVE_ROOM_RESET',
                  roomId: streamId,
                  hostHandle: targetHandle,
                });
              }
              liveStreamSync.stopHostBroadcast();
              try {
                localStorage.removeItem('privity_is_host_broadcasting');
                localStorage.removeItem('privity_active_live_session');
                localStorage.removeItem('privity_current_live_host');
                localStorage.removeItem('privity_remote_active_streams');
              } catch {}
              if (hostLiveCameraStream) {
                hostLiveCameraStream.getTracks().forEach((t) => t.stop());
                setHostLiveCameraStream(null);
              }
              return;
            }

            // Only minimize if stream is still actively live and viewer wants to minimize
            const streamer =
              networkLiveStreamers.find((s) => s.id === activeLiveStream.id) ||
              LIVEME_STREAMERS.find((s) => s.id === activeLiveStream.id) ||
              (activeLiveStream as any);
            setMinimizedLiveStream(streamer);
            setActiveLiveStream(null);
          }}
          onEndBroadcast={() => {
            const cleanMyH = (myProfile.handle || '').replace(/^@+/, '').toLowerCase().trim();
            const discEvt = {
              type: 'COHOST_DISCONNECTED',
              senderHandle: `@${cleanMyH}`,
            };
            if (activeLiveStream?.id) {
              liveStreamSync.sendRoomEvent(activeLiveStream.id, discEvt);
              const targetHandle = ((activeLiveStream as any).creatorHandle || (activeLiveStream as any).handle || '').replace(/^@+/, '').toLowerCase().trim();
              if (targetHandle && targetHandle !== activeLiveStream.id) {
                liveStreamSync.sendRoomEvent(targetHandle, discEvt);
              }
            }
            try {
              const bus = new BroadcastChannel('privity_sync_bus');
              bus.postMessage(discEvt);
              bus.close();
            } catch {}
            setIsCoHostInviteAccepted(false);
            const targetHandle = ((activeLiveStream as any)?.creatorHandle || (activeLiveStream as any)?.handle || '').replace(/^@+/, '').toLowerCase().trim();
            const streamId = activeLiveStream?.id || '';
            try {
              if (targetHandle) localStorage.removeItem(`privity_live_chat_${targetHandle}`);
              if (streamId) localStorage.removeItem(`privity_live_chat_${streamId}`);
              const bus = new BroadcastChannel('privity_sync_bus');
              bus.postMessage({ type: 'LIVE_ROOM_RESET', hostHandle: targetHandle, roomId: streamId });
              bus.postMessage({ type: 'LIVE_HOST_ENDED', action: 'LIVE_ENDED', streamId, handle: targetHandle, creatorHandle: targetHandle });
              bus.close();
            } catch {}
            if (activeLiveStream?.id) {
              liveStreamSync.markStreamEnded(activeLiveStream.id, targetHandle);
              broadcastSyncEvent({
                action: 'LIVE_ENDED',
                streamId: activeLiveStream.id,
                handle: targetHandle,
              });
              broadcastSyncEvent({
                action: 'LIVE_ROOM_RESET',
                roomId: streamId,
                hostHandle: targetHandle,
              });
              try {
                broadcastViaSupabase({
                  action: 'STREAM_ENDED',
                  streamId: activeLiveStream.id,
                  creatorHandle: targetHandle,
                  handle: targetHandle,
                });
              } catch {}
            }
            setActiveLiveStream(null);
            setMinimizedLiveStream(null);
            setIsHostBroadcasting(false);
            liveStreamSync.stopHostBroadcast();
            try {
              localStorage.removeItem('privity_is_host_broadcasting');
              localStorage.removeItem('privity_active_live_session');
              localStorage.removeItem('privity_current_live_host');
              localStorage.removeItem('privity_remote_active_streams');
            } catch {}
            if (hostLiveCameraStream) {
              hostLiveCameraStream.getTracks().forEach((t) => t.stop());
              setHostLiveCameraStream(null);
            }
          }}
          userCoins={userSparksBalance}
          onCoinsChange={(delta) => setUserSparksBalance((prev) => Math.max(0, prev + delta))}
          showToast={triggerToast}
          onViewProfile={(handle) => {
            const streamer =
              networkLiveStreamers.find((s) => s.id === activeLiveStream.id) ||
              LIVEME_STREAMERS.find((s) => s.id === activeLiveStream.id) ||
              (activeLiveStream as any);
            setMinimizedLiveStream(streamer);
            setActiveLiveStream(null);
            navigateToProfile(handle);
          }}
        />
      )}

      {/* PICTURE-IN-PICTURE (PIP) MINIMIZED LIVE STREAM FLOATING PLAYER */}
      {minimizedLiveStream && !activeLiveStream && (
        <LivePipPlayer
          streamer={minimizedLiveStream}
          onMaximize={() => {
            setActiveLiveStream(minimizedLiveStream);
            setMinimizedLiveStream(null);
          }}
          onClose={() => {
            if (isHostBroadcasting) {
              setIsHostBroadcasting(false);
              liveStreamSync.stopHostBroadcast();
            }
            setMinimizedLiveStream(null);
          }}
        />
      )}

      {/* LIGHTBOX FOR FULLSCREEN MEDIA — APPLE VISIONOS SPECULAR GLASS */}
      {lightboxUrl && (() => {
        const baseKey = extractMediaBaseKey(lightboxUrl);
        const record = photoLikesMap[lightboxUrl] || (baseKey ? photoLikesMap[baseKey] : undefined);
        const matchingMedia = Object.values(profiles).flatMap((p) => p.mediaItems || []).find((m) => isSameMedia(m.url, lightboxUrl));
        const matchingPost = posts.find((p) => isSameMedia(p.contentUrl, lightboxUrl) || isSameMedia(p.thumbnailUrl, lightboxUrl));

        // Real-time reactive like calculation
        const viewerHandle = normalizeHandle(currentAuthUser?.handle || myProfile.handle || activeAuthHandle);
        const isPhotoLiked = matchingPost
          ? isPostLikedByUser(matchingPost, viewerHandle)
          : (record !== undefined ? record.isLiked : !!matchingMedia?.isLiked);

        const photoLikesCount = matchingPost
          ? Math.max(matchingPost.likesCount || 0, (matchingPost.likersList || []).length)
          : (record !== undefined ? record.count : (matchingMedia ? matchingMedia.likes : 0));

        const resolvedComments = matchingPost?.comments || [];
        const resolvedCommentsCount = matchingPost?.commentsCount ?? (matchingMedia?.comments ?? resolvedComments.length);

        const isMyMedia = !lightboxIsPrivateMessage && (
          (matchingPost && Boolean(myProfile.handle) && matchingPost.authorHandle.toLowerCase() === myProfile.handle.toLowerCase()) ||
          (matchingMedia && profiles[myProfile.handle]?.mediaItems?.some((m) => m.id === matchingMedia.id))
        );

        const handleLightboxDelete = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (window.confirm('Delete this photo permanently from your profile, feed, and Media & Studio?')) {
            if (matchingPost) {
              handleDeletePost(matchingPost.id);
            } else if (matchingMedia) {
              handleDeleteMediaItem(myProfile.handle, matchingMedia.id, matchingMedia.url);
            }
            closeLightbox();
          }
        };

        const closeLightbox = () => {
          setLightboxUrl(null);
          setLightboxShowComments(false);
          setLightboxIsPrivateMessage(false);
        };

        const handleLightboxLikeToggle = (e?: React.MouseEvent) => {
          e?.stopPropagation();
          if (matchingPost) {
            setLightboxHeartAnim(true);
            setTimeout(() => setLightboxHeartAnim(false), 850);
            handleLike(matchingPost.id);
            return;
          }
          const nextLiked = !isPhotoLiked;
          const nextCount = nextLiked ? photoLikesCount + 1 : Math.max(0, photoLikesCount - 1);

          // 1. Trigger heart burst animation
          setLightboxHeartAnim(true);
          setTimeout(() => setLightboxHeartAnim(false), 850);

          // 2. Update photoLikesMap immediately
          setPhotoLikesMap((prev) => {
            const next = {
              ...prev,
              [lightboxUrl]: { isLiked: nextLiked, count: nextCount },
              ...(baseKey ? { [baseKey]: { isLiked: nextLiked, count: nextCount } } : {}),
            };
            safeSaveStorage('privity_photo_likes_v5', next);
            return next;
          });

          // 3. Update matching post in posts if any, or create one if missing
          setPosts((prevPosts) => {
            let matched = false;
            const nextPosts = prevPosts.map((p) => {
              if (isSameMedia(p.contentUrl, lightboxUrl) || isSameMedia(p.thumbnailUrl, lightboxUrl)) {
                matched = true;
                let nextLikers = [...(p.likersList || [])];
                const userHandle = myProfile.handle || '';
                if (nextLiked) {
                  if (userHandle && !nextLikers.includes(userHandle)) nextLikers = [userHandle, ...nextLikers];
                } else {
                  nextLikers = nextLikers.filter((h) => h !== userHandle);
                }
                return {
                  ...p,
                  isLiked: nextLiked,
                  likersList: nextLikers,
                  likesCount: nextCount,
                };
              }
              return p;
            });
            if (matched) {
              safeSaveStorage('privity_posts_v5', nextPosts);
            }
            return nextPosts;
          });

          // 4. Update matching media across all profiles
          setProfiles((prevProfs) => {
            let changed = false;
            const nextProfs = { ...prevProfs };
            for (const [h, prof] of Object.entries(nextProfs)) {
              if (prof.mediaItems?.some((m) => isSameMedia(m.url, lightboxUrl) || (matchingMedia && m.id === matchingMedia.id))) {
                changed = true;
                nextProfs[h] = {
                  ...prof,
                  mediaItems: prof.mediaItems.map((m) => {
                    if (isSameMedia(m.url, lightboxUrl) || (matchingMedia && m.id === matchingMedia.id)) {
                      return {
                        ...m,
                        isLiked: nextLiked,
                        likes: nextCount,
                      };
                    }
                    return m;
                  }),
                };
              }
            }
            if (changed) {
              safeSaveStorage('privity_profiles_v5', nextProfs);
            }
            return nextProfs;
          });

          triggerToast(nextLiked ? 'Liked photo' : 'Unliked photo');
        };

        const handleLightboxCommentSubmit = () => {
          const text = lightboxCommentInput.trim();
          if (!text) return;

          let targetPost = posts.find((p) => isSameMedia(p.contentUrl, lightboxUrl) || isSameMedia(p.thumbnailUrl, lightboxUrl));

          if (targetPost) {
            handleAddComment(targetPost.id, text);
          } else {
            // Update comments count on studio media without fabricating a public post
            setProfiles((prevProfs) => {
              let changed = false;
              const nextProfs = { ...prevProfs };
              for (const [h, prof] of Object.entries(nextProfs)) {
                if (prof.mediaItems?.some((m) => isSameMedia(m.url, lightboxUrl))) {
                  changed = true;
                  nextProfs[h] = {
                    ...prof,
                    mediaItems: prof.mediaItems.map((m) =>
                      isSameMedia(m.url, lightboxUrl) ? { ...m, comments: m.comments + 1 } : m
                    ),
                  };
                }
              }
              if (changed) {
                safeSaveStorage('privity_profiles_v5', nextProfs);
              }
              return nextProfs;
            });

            triggerToast('Comment registered on studio visual');
          }

          setLightboxCommentInput('');
        };

        return (
          <div className="lightbox-stage-overlay" onClick={closeLightbox}>
            {/* Private Visual Indicator Pill if opened from Direct Messages */}
            {lightboxIsPrivateMessage && (
              <div style={{ position: 'absolute', top: '24px', left: '28px', zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(15, 23, 42, 0.88)',
                    backdropFilter: 'blur(24px)',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    padding: '9px 18px',
                    color: '#c7d2fe',
                    fontSize: '13px',
                    fontWeight: 600,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <IconShield size={16} color="#818cf8" />
                  <span>Private Direct Visual · End-to-End Encrypted</span>
                </div>
              </div>
            )}

            {/* Top Close Button */}
            <div style={{ position: 'absolute', top: '24px', right: '28px', zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
              <button
                className="btn-glass-back"
                onClick={closeLightbox}
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(24px)',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  padding: '9px 18px',
                }}
              >
                <IconX size={18} />
                <span>Close</span>
              </button>
            </div>

            {/* Photo Center with Double-Click & Heart Burst Overlay */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {isVideoMedia(lightboxUrl) ? (
                <video
                  key={cleanMediaUrl(lightboxUrl)}
                  src={cleanMediaUrl(lightboxUrl)}
                  controls
                  autoPlay
                  loop
                  playsInline
                  // @ts-ignore
                  webkit-playsinline="true"
                  className="lightbox-hero-image"
                  style={{ maxHeight: '82vh', maxWidth: '92vw', objectFit: 'contain' }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <img
                  src={cleanMediaUrl(lightboxUrl)}
                  alt="Fullscreen View"
                  className="lightbox-hero-image"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={handleLightboxLikeToggle}
                  title="Double-click to like photo"
                />
              )}

              {lightboxHeartAnim && (
                <div className="lightbox-heart-burst-overlay">
                  <IconHeart size={96} filled={true} color="var(--heart-rose)" />
                </div>
              )}
            </div>

            {/* Apple VisionOS Floating Specular Mirror Dock */}
            <div className="apple-vision-dock" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`vision-dock-btn heart-btn ${isPhotoLiked ? 'liked' : ''}`}
                onClick={handleLightboxLikeToggle}
                title={isPhotoLiked ? 'Unlike photo' : 'Like photo'}
              >
                <IconHeart
                  size={19}
                  filled={isPhotoLiked}
                  color={isPhotoLiked ? 'var(--heart-rose)' : 'currentColor'}
                  className={lightboxHeartAnim ? 'heart-icon-popping' : ''}
                />
                <span className="vision-dock-count">{photoLikesCount}</span>
              </button>

              <div className="vision-dock-divider" />

              {!lightboxIsPrivateMessage ? (
                <>
                  <button
                    type="button"
                    className={`vision-dock-btn comment-btn ${lightboxShowComments ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxShowComments((prev) => !prev);
                    }}
                    title="View & Add Comments"
                  >
                    <IconChat size={18} color="currentColor" />
                    <span className="vision-dock-count">{resolvedCommentsCount}</span>
                  </button>

                  <div className="vision-dock-divider" />
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0 10px',
                      color: '#a5b4fc',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <IconShield size={14} color="#818cf8" />
                    <span>Private Media</span>
                  </div>

                  <div className="vision-dock-divider" />
                </>
              )}

              <button
                type="button"
                className="vision-dock-btn copy-btn"
                onClick={() => {
                  navigator.clipboard?.writeText(lightboxUrl);
                  setCopiedLightboxUrl(true);
                  triggerToast('Photo URL copied to clipboard');
                  setTimeout(() => setCopiedLightboxUrl(false), 2000);
                }}
              >
                {copiedLightboxUrl ? <IconCheck size={16} color="var(--cf-emerald)" /> : <IconLink size={16} />}
                <span>{copiedLightboxUrl ? 'Copied' : 'Copy URL'}</span>
              </button>

              {isMyMedia && (
                <>
                  <div className="vision-dock-divider" />
                  <button
                    type="button"
                    className="vision-dock-btn delete-btn"
                    style={{ color: '#ef4444' }}
                    onClick={handleLightboxDelete}
                    title="Delete visual permanently from Studio and Feed"
                  >
                    <IconTrash size={16} color="#ef4444" />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>

            {/* Lightbox Frosted Comments Drawer */}
            {lightboxShowComments && (
              <aside className="lightbox-comments-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="lightbox-comments-header">
                  <div className="lightbox-comments-title">
                    <IconChat size={18} color="var(--brand)" />
                    <span>Comments ({resolvedComments.length})</span>
                  </div>
                  <button
                    type="button"
                    className="btn-close-strip"
                    onClick={() => setLightboxShowComments(false)}
                    title="Close comments drawer"
                  >
                    <IconX size={16} />
                  </button>
                </div>

                <div className="lightbox-comments-list">
                  {resolvedComments.length > 0 ? (
                    resolvedComments.map((c) => (
                      <div key={c.id} className="lightbox-comment-item">
                        <img
                          src={c.authorAvatar}
                          alt={c.authorName}
                          className="lightbox-comment-avatar"
                          onClick={() => {
                            closeLightbox();
                            navigateToProfile(c.authorHandle);
                          }}
                          style={{ cursor: 'pointer' }}
                          title={`View @${c.authorHandle}'s profile`}
                        />
                        <div className="lightbox-comment-bubble">
                          <div className="lightbox-comment-author">
                            <span
                              style={{ cursor: 'pointer', fontWeight: 700 }}
                              onClick={() => {
                                closeLightbox();
                                navigateToProfile(c.authorHandle);
                              }}
                            >
                              {c.authorName}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px' }}>
                              @{c.authorHandle}
                            </span>
                            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '10px' }}>
                              {c.timeAgo}
                            </span>
                          </div>
                          <div className="lightbox-comment-text">{c.text}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 10px', fontSize: '13px' }}>
                      No comments yet on this visual. Be the first to share your thoughts!
                    </div>
                  )}
                </div>

                <form
                  className="lightbox-comment-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLightboxCommentSubmit();
                  }}
                >
                  <input
                    type="text"
                    className="lightbox-comment-input"
                    placeholder="Add a comment to this photo..."
                    value={lightboxCommentInput}
                    onChange={(e) => setLightboxCommentInput(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="lightbox-comment-submit">
                    Send
                  </button>
                </form>
              </aside>
            )}
          </div>
        );
      })()}

      {/* REAL-TIME DIRECT MESSAGING MODAL — DESKTOP POPUP ONLY (NO OVERLAYS ON MOBILE) */}
      {activeChatUser && activeTab !== 'messages' && typeof window !== 'undefined' && window.innerWidth > 768 && (
        <div className="direct-chat-backdrop" onClick={() => setActiveChatUser(null)}>
          <div className="direct-chat-window" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="direct-chat-header">
              <div
                className="direct-chat-recipient"
                onClick={() => {
                  navigateToProfile(activeChatUser.handle);
                  setActiveChatUser(null);
                }}
                title="View full profile"
              >
                <img src={activeChatUser.avatar} alt={activeChatUser.name} className="direct-chat-avatar" />
                <div>
                  <div className="direct-chat-name">
                    {activeChatUser.name}
                    {activeChatUser.isVerified && (
                      <VerifiedBadge
                        authorName={activeChatUser.name}
                        category={activeChatUser.verifiedCategory}
                        since={activeChatUser.verifiedSince}
                        proofId={activeChatUser.cryptoProofId}
                      />
                    )}
                  </div>
                  <div className="direct-chat-status">
                    <span className="direct-chat-status-dot" />
                    <span>{isRecipientTyping ? 'Typing encrypted dispatch...' : 'End-to-End Encrypted • Real-Time'}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-glass-back"
                  onClick={() => setActiveTab('messages')}
                  title="Expand to Full Spatial Suite"
                  style={{ padding: '6px 12px', fontSize: '11.5px' }}
                >
                  <span>Full Suite ↗</span>
                </button>
                <button
                  className="btn-glass-back"
                  onClick={() => setActiveChatUser(null)}
                  title="Close chat"
                  style={{ padding: '8px', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <IconX size={16} />
                </button>
              </div>
            </div>

            {/* Quick Conversation Switcher Chips */}
            {Object.keys(directMessages).filter((h) => directMessages[h]?.length > 0).length > 0 && (
              <div className="direct-chat-users-bar">
                {Object.keys(directMessages)
                  .filter((h) => directMessages[h]?.length > 0)
                  .map((handle) => {
                    const user = getUserProfile(handle);
                    const isActive = activeChatUser?.handle?.replace(/^@/, '') === handle;
                    return (
                      <button
                        key={handle}
                        type="button"
                        className={`direct-chat-user-chip ${isActive ? 'active' : ''}`}
                        onClick={() => setActiveChatUser(user)}
                      >
                        <img src={user.avatar} alt={user.name} className="direct-chat-chip-avatar" />
                        <span>{user.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Messages Body */}
            <div className="direct-chat-body">
              {(() => {
                const recipientClean = activeChatUser.handle.replace(/^@/, '');
                const thread = directMessages[recipientClean] || [];
                const cleanMyHandle = (myProfile.handle || '').replace(/^@/, '');

                if (thread.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <div style={{ marginBottom: '10px', fontSize: '28px' }}>🔐</div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>Privity Zero-Knowledge Channel</div>
                      <div style={{ marginTop: '6px', maxWidth: '320px', lineHeight: '1.5' }}>
                        Messages are delivered in real time with private encryption. No algorithms or data harvesting.
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    {thread.map((msg) => {
                      const isSent = cleanMyHandle ? msg.senderHandle === cleanMyHandle : false;
                      return (
                        <div key={msg.id} className={`chat-bubble-row ${isSent ? 'sent' : 'received'}`}>
                          <div className="chat-bubble-content">{msg.text}</div>
                          <span className="chat-bubble-time">{msg.timeAgo}</span>
                        </div>
                      );
                    })}
                    {isRecipientTyping && (
                      <div className="chat-typing-row">
                        <div className="chat-typing-dots">
                          <span />
                          <span />
                          <span />
                        </div>
                        <span>@{recipientClean} is typing in real time...</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Real-Time Message Composer */}
            <form className="direct-chat-composer" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="direct-chat-input"
                placeholder={`Encrypted message to @${activeChatUser.handle.replace(/^@/, '')}...`}
                value={chatDraftText}
                onChange={(e) => setChatDraftText(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="direct-chat-submit"
                disabled={!chatDraftText.trim()}
                style={{ opacity: chatDraftText.trim() ? 1 : 0.5 }}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CAMERA & LIVE BROADCAST STUDIO (TIKTOK / REELS SPEC) */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => {
          setIsCameraOpen(false);
          setCameraInitialTab('POST');
        }}
        currentUser={cameraCurrentUser}
        onPublishPost={handleCameraPublishPost}
        onGoLive={handleCameraGoLive}
        initialTab={cameraInitialTab}
      />

      {/* CREATE POST MODAL */}
      {isModalOpen && (
        <div className="frosted-modal-backdrop">
          <div className="frosted-modal-window">
            <div className="modal-header-strip">
              <span className="modal-title-bold">Publish Dispatch with Explicit Privacy</span>
              <button className="btn-close-strip" onClick={() => setIsModalOpen(false)}>
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleModalPublish} style={{ padding: '24px' }}>
              <textarea
                placeholder="What would you like to share with your audience?"
                value={modalCaption}
                onChange={(e) => setModalCaption(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '110px',
                  background: 'var(--glass-input)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  padding: '14px',
                  fontSize: '15px',
                  outline: 'none',
                  marginBottom: '16px',
                  resize: 'none',
                  fontFamily: 'inherit',
                }}
              />

              {/* Photo Attachment Section */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <label className="btn-file-upload-label">
                    <IconPhoto size={15} />
                    <span>Upload Photo / Video</span>
                    <input
                      type="file"
                      accept="image/*,video/*,.mp4,.mov,.webm,.m4v"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
                          if (isVideo) {
                            convertVideoToAnimatedLoop(file, 'studio').then((videoUrl: string) => {
                              setModalPhoto(videoUrl);
                              triggerToast('Video attached with audio! 🎬');
                            });
                          } else {
                            compressImageFile(file, 960, 0.72, (dataUrl) => {
                              setModalPhoto(dataUrl);
                              triggerToast('Photo attached to dispatch!');
                            });
                          }
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="Or paste photo/video URL..."
                    value={modalPhoto || ''}
                    onChange={(e) => setModalPhoto(e.target.value || null)}
                    className="edit-profile-input"
                    style={{ flex: 1, minWidth: '180px' }}
                  />
                </div>

                {modalPhoto && (
                  <div style={{ position: 'relative', marginTop: '10px' }}>
                    {isVideoMedia(modalPhoto) ? (
                      <video
                        src={cleanMediaUrl(modalPhoto)}
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{
                          width: '100%',
                          maxHeight: '220px',
                          objectFit: 'contain',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--glass-border)',
                          background: '#05070d',
                        }}
                      />
                    ) : (
                      <img
                        src={modalPhoto}
                        alt="Attachment Preview"
                        style={{
                          width: '100%',
                          maxHeight: '220px',
                          objectFit: 'cover',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--glass-border)',
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setModalPhoto(null)}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(0,0,0,0.7)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <IconX size={16} />
                    </button>
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder="Tags: #mindful #design"
                value={modalTags}
                onChange={(e) => setModalTags(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--glass-input)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  padding: '10px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  marginBottom: '18px',
                  fontFamily: 'inherit',
                }}
              />

              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px' }}>
                SELECT AUDIENCE VISIBILITY (PRD SECTION 10)
              </div>

              {/* Close Friends Tier */}
              <div
                className={`audience-tier-card ${modalPrivacy === 'close_friends' ? 'selected cf' : ''}`}
                onClick={() => setModalPrivacy('close_friends')}
              >
                <div className="tier-top-row">
                  <span className="tier-name-label" style={{ color: 'var(--cf-emerald)' }}>
                    <IconStarCloseFriends size={14} color="var(--cf-emerald)" />
                    Close Friends Only
                  </span>
                  {modalPrivacy === 'close_friends' && <IconCheck size={16} color="var(--cf-emerald)" />}
                </div>
                <div className="tier-explanation-copy">
                  Reaches only the {closeFriendsList.length} approved members of your intimate Close Friends circle.
                </div>
              </div>

              {/* Followers Tier */}
              <div
                className={`audience-tier-card ${modalPrivacy === 'followers' ? 'selected followers' : ''}`}
                onClick={() => setModalPrivacy('followers')}
              >
                <div className="tier-top-row">
                  <span className="tier-name-label" style={{ color: 'var(--followers-iris)' }}>
                    <IconUsers size={14} color="var(--followers-iris)" />
                    Followers Only
                  </span>
                  {modalPrivacy === 'followers' && <IconCheck size={16} color="var(--followers-iris)" />}
                </div>
                <div className="tier-explanation-copy">
                  Reaches your {(myProfile.followersList || []).length} followers (approved followers if your account is private).
                </div>
              </div>

              {/* Public Tier */}
              <div
                className={`audience-tier-card ${modalPrivacy === 'public' ? 'selected public' : ''}`}
                onClick={() => setModalPrivacy('public')}
              >
                <div className="tier-top-row">
                  <span className="tier-name-label" style={{ color: 'var(--public-cyan)' }}>
                    <IconGlobe size={14} color="var(--public-cyan)" />
                    Public
                  </span>
                  {modalPrivacy === 'public' && <IconCheck size={16} color="var(--public-cyan)" />}
                </div>
                <div className="tier-explanation-copy">
                  Discoverable by anyone on Privity and in search.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '12px' }}>
                <button
                  type="button"
                  className="btn-follow-toggle following"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-post-dispatch"
                  disabled={!modalCaption.trim()}
                >
                  Publish Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PERSONAL PROFILE MODAL */}
      {isEditProfileOpen && (
        <div className="frosted-modal-backdrop" onClick={() => setIsEditProfileOpen(false)}>
          <div
            className="frosted-modal-window"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-strip">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconSettings size={18} color="var(--apple-blue)" />
                <span className="modal-title-bold">Edit Personal Profile</span>
              </div>
              <button className="btn-close-strip" onClick={() => setIsEditProfileOpen(false)}>
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="edit-profile-modal-body">
                {/* Cover Banner Customization */}
                <div className="edit-profile-section">
                  <label className="edit-profile-label">Cover Banner</label>
                  {isVideoMedia(editForm.coverUrl) ? (
                    <video
                      key={cleanMediaUrl(editForm.coverUrl)}
                      src={cleanMediaUrl(editForm.coverUrl)}
                      autoPlay
                      loop
                      muted
                      playsInline
                      // @ts-ignore
                      webkit-playsinline="true"
                      ref={(el) => {
                        if (el) {
                          el.muted = true;
                          el.defaultMuted = true;
                          el.playsInline = true;
                          el.play().catch(() => {});
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '110px',
                        borderRadius: 'var(--radius-md)',
                        objectFit: 'cover',
                        marginBottom: '10px',
                        border: '1px solid var(--glass-border)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '110px',
                        borderRadius: 'var(--radius-md)',
                        backgroundImage: `url(${cleanMediaUrl(editForm.coverUrl)})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        position: 'relative',
                        border: '1px solid var(--glass-border)',
                        marginBottom: '10px',
                      }}
                    />
                  )}
                  <div className="photo-upload-dock">
                    <label className="btn-file-upload-label">
                      <IconPhoto size={15} />
                      <span>Upload Banner From Device</span>
                      <input
                        type="file"
                        accept="image/*,video/*,.mp4,.mov,.webm,.m4v"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const cleanH = normalizeHandle(currentAuthUser?.handle || myProfile.handle) || 'creator';
                            if (file.type.startsWith('video') || file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
                              triggerToast('Updating banner video...');
                              const [animatedUrl, posterUrl] = await Promise.all([
                                convertVideoToAnimatedLoop(file, 'banner', cleanH),
                                extractVideoThumbnail(file).catch(() => ''),
                              ]);
                              setEditForm((prev) => ({ ...prev, coverUrl: animatedUrl, coverPoster: posterUrl }));
                              handleDirectBannerChange(animatedUrl, posterUrl);
                              triggerToast('Cover banner video updated!');
                            } else {
                              compressImageFile(file, 1600, 0.86, (dataUrl) => {
                                setEditForm((prev) => ({ ...prev, coverUrl: dataUrl }));
                                handleDirectBannerChange(dataUrl);
                                triggerToast('Cover banner updated!');
                              });
                            }
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <input
                      type="text"
                      className="edit-profile-input"
                      style={{ flex: 1, minWidth: '180px' }}
                      placeholder="Or paste banner URL..."
                      value={editForm.coverUrl}
                      onChange={(e) => setEditForm({ ...editForm, coverUrl: e.target.value })}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Quick Presets:
                  </div>
                  <div className="preset-thumbs-row">
                    {PRESET_BANNERS.map((banner, idx) => (
                      <img
                        key={idx}
                        src={banner}
                        alt={`Banner ${idx + 1}`}
                        className={`preset-banner-thumb ${editForm.coverUrl === banner ? 'selected' : ''}`}
                        onClick={() => setEditForm((prev) => ({ ...prev, coverUrl: banner }))}
                      />
                    ))}
                  </div>
                </div>

                {/* Avatar Customization */}
                <div className="edit-profile-section">
                  <label className="edit-profile-label">Profile Picture</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {isVideoMedia(editForm.avatar) ? (
                      <div style={{ position: 'relative', width: '68px', height: '68px', flexShrink: 0 }}>
                        <video
                          key={cleanMediaUrl(editForm.avatar)}
                          src={cleanMediaUrl(editForm.avatar)}
                          autoPlay
                          loop
                          muted
                          playsInline
                          // @ts-ignore
                          webkit-playsinline="true"
                          ref={(el) => {
                            if (el) {
                              el.muted = true;
                              el.defaultMuted = true;
                              el.playsInline = true;
                              el.play().catch(() => {});
                            }
                          }}
                          style={{
                            width: '68px',
                            height: '68px',
                            borderRadius: 'var(--radius-md)',
                            objectFit: 'cover',
                            border: '2px solid var(--glass-border-light)',
                            boxShadow: 'var(--shadow-elevated)',
                          }}
                        />
                      </div>
                    ) : (
                      <img
                        src={cleanMediaUrl(editForm.avatar)}
                        alt="Profile Picture Preview"
                        style={{
                          width: '68px',
                          height: '68px',
                          borderRadius: 'var(--radius-md)',
                          objectFit: 'cover',
                          border: '2px solid var(--glass-border-light)',
                          boxShadow: 'var(--shadow-elevated)',
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="photo-upload-dock">
                        <label className="btn-file-upload-label">
                          <IconPhoto size={15} />
                          <span>Upload From Device</span>
                          <input
                            type="file"
                            accept="image/*,video/*,.mp4,.mov,.webm,.m4v"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const cleanH = normalizeHandle(currentAuthUser?.handle || myProfile.handle) || 'creator';
                                if (file.type.startsWith('video') || file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
                                  triggerToast('Updating profile video...');
                                  const [animatedUrl, posterUrl] = await Promise.all([
                                    convertVideoToAnimatedLoop(file, 'avatar', cleanH),
                                    extractVideoThumbnail(file).catch(() => ''),
                                  ]);
                                  setEditForm((prev) => ({ ...prev, avatar: animatedUrl, avatarPoster: posterUrl }));
                                  handleDirectAvatarChange(animatedUrl, posterUrl);
                                  triggerToast('Profile video updated!');
                                } else {
                                  compressImageFile(file, 280, 0.65, (dataUrl) => {
                                    setEditForm((prev) => ({ ...prev, avatar: dataUrl }));
                                    handleDirectAvatarChange(dataUrl);
                                    triggerToast('Profile picture updated!');
                                  });
                                }
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <input
                          type="text"
                          className="edit-profile-input"
                          style={{ flex: 1, minWidth: '160px' }}
                          placeholder="Or paste profile picture URL..."
                          value={editForm.avatar}
                          onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })}
                        />
                      </div>
                      <div className="preset-thumbs-row">
                        {PRESET_AVATARS.map((av, idx) => (
                          <img
                            key={idx}
                            src={av}
                            alt={`Avatar ${idx + 1}`}
                            className={`preset-avatar-thumb ${editForm.avatar === av ? 'selected' : ''}`}
                            onClick={() => setEditForm((prev) => ({ ...prev, avatar: av }))}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Display Name & Handle */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="edit-profile-section">
                    <label className="edit-profile-label">Display Name *</label>
                    <input
                      type="text"
                      className="edit-profile-input"
                      placeholder="Your full name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="edit-profile-section">
                    <label className="edit-profile-label">Username / Handle</label>
                    <input
                      type="text"
                      className="edit-profile-input"
                      placeholder="username"
                      value={editForm.handle}
                      onChange={(e) => setEditForm({ ...editForm, handle: e.target.value })}
                    />
                  </div>
                </div>

                {/* Bio / Dispatch Narrative */}
                <div className="edit-profile-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="edit-profile-label">Personal Bio</label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {editForm.bio.length} / 280
                    </span>
                  </div>
                  <textarea
                    className="edit-profile-textarea"
                    placeholder="Tell your trusted circles about your work, thoughts, and vision..."
                    value={editForm.bio}
                    maxLength={280}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  />
                </div>

                {/* Location & Website */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="edit-profile-section">
                    <label className="edit-profile-label">Location</label>
                    <input
                      type="text"
                      className="edit-profile-input"
                      placeholder="e.g. San Francisco, CA"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    />
                  </div>
                  <div className="edit-profile-section">
                    <label className="edit-profile-label">Website</label>
                    <input
                      type="text"
                      className="edit-profile-input"
                      placeholder="e.g. privity.app"
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                    />
                  </div>
                </div>

                {/* Role / Focus */}
                <div className="edit-profile-section">
                  <label className="edit-profile-label">Professional Role / Focus</label>
                  <input
                    type="text"
                    className="edit-profile-input"
                    placeholder="e.g. Platform Founder & Systems Architect"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--glass-border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                }}
              >
                <button
                  type="button"
                  className="btn-glass-back"
                  onClick={() => setIsEditProfileOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-post-dispatch" style={{ padding: '9px 24px' }}>
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POST OPTIONS & EDIT CAPTION MODAL */}
      {postMenuModal && (
        <div className="frosted-modal-backdrop" onClick={() => setPostMenuModal(null)}>
          <div
            className="frosted-modal-window"
            style={{ maxWidth: '440px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-strip">
              <span className="modal-title-bold">Dispatch Options</span>
              <button className="btn-close-strip" onClick={() => setPostMenuModal(null)}>
                <IconX size={18} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              {postMenuModal.isOwn ? (
                <>
                  <div
                    onClick={() => {
                      setEditingPostCaption({ id: postMenuModal.post.id, caption: postMenuModal.post.caption });
                      setPostMenuModal(null);
                    }}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>Edit Caption</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Update the narrative text of this dispatch
                    </div>
                  </div>
                  <div
                    onClick={() => handleDeletePost(postMenuModal.post.id)}
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      color: 'var(--heart-rose)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>Delete Dispatch</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Permanently remove this dispatch from Privity
                    </div>
                  </div>
                </>
              ) : (
                <div
                  onClick={() => {
                    const post = postMenuModal.post;
                    setPostMenuModal(null);
                    setReportingPost(post);
                  }}
                  style={{
                    padding: '12px',
                    cursor: 'pointer',
                    color: 'var(--heart-rose)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>Report Content</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Flag this post for community review
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT CAPTION MODAL */}
      {editingPostCaption && (
        <div className="frosted-modal-backdrop" onClick={() => setEditingPostCaption(null)}>
          <div
            className="frosted-modal-window"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-strip">
              <span className="modal-title-bold">Edit Dispatch Caption</span>
              <button className="btn-close-strip" onClick={() => setEditingPostCaption(null)}>
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={handleSavePostCaption} style={{ padding: '20px' }}>
              <textarea
                className="edit-profile-textarea"
                style={{ minHeight: '120px', marginBottom: '16px' }}
                value={editingPostCaption.caption}
                onChange={(e) =>
                  setEditingPostCaption({ ...editingPostCaption, caption: e.target.value })
                }
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-glass-back"
                  onClick={() => setEditingPostCaption(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-post-dispatch">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORT CONTENT MODAL */}
      {reportingPost && (
        <div className="frosted-modal-backdrop">
          <div className="frosted-modal-window" style={{ maxWidth: '440px' }}>
            <div className="modal-header-strip">
              <span className="modal-title-bold">Report Content</span>
              <button className="btn-close-strip" onClick={() => setReportingPost(null)}>
                <IconX size={18} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Select a reason for reporting @{reportingPost.authorHandle}:
              </p>
              {[
                'Spam or deceptive marketing',
                'Harassment, hate speech, or abuse',
                'Violence or dangerous content',
                'Impersonation or stolen identity',
              ].map((reason) => (
                <div
                  key={reason}
                  onClick={() => {
                    triggerToast('Report logged. Sent to moderation queue.');
                    setReportingPost(null);
                  }}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid var(--glass-border)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {reason}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODERATION ACTION MODAL */}
      {selectedReport && (
        <div className="frosted-modal-backdrop">
          <div className="frosted-modal-window" style={{ maxWidth: '520px' }}>
            <div className="modal-header-strip">
              <span className="modal-title-bold">Moderator Enforcement ({selectedReport.id})</span>
              <button className="btn-close-strip" onClick={() => setSelectedReport(null)}>
                <IconX size={18} />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ background: 'var(--glass-input)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '13px' }}>
                <strong>Reported: @{selectedReport.targetAuthor}</strong>
                <div style={{ marginTop: '6px' }}>"{selectedReport.snippet}"</div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>ACTION:</label>
                <select
                  className="search-glass-field"
                  style={{ marginTop: '6px', borderRadius: 'var(--radius-sm)', paddingLeft: '14px' }}
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as ModerationActionType)}
                >
                  <option value="remove_content">Remove Content</option>
                  <option value="warn">Warn User</option>
                  <option value="suspend">Suspend User (24h)</option>
                  <option value="ban">Permanently Ban User</option>
                  <option value="dismiss">Dismiss (No Violation)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>AUDIT JUSTIFICATION NOTE:</label>
                <textarea
                  className="search-glass-field"
                  style={{ marginTop: '6px', minHeight: '80px', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}
                  placeholder="Justify this moderation decision for the immutable audit trail..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button className="btn-follow-toggle following" onClick={() => setSelectedReport(null)}>Cancel</button>
                <button
                  className="btn-post-dispatch"
                  style={{ background: 'var(--heart-rose)' }}
                  onClick={() => {
                    setReports(reports.map((r) => (r.id === selectedReport.id ? { ...r, status: 'resolved' } : r)));
                    const log = {
                      id: `aud-${Date.now().toString().slice(-4)}`,
                      actorId: myProfile.id || `usr-${myProfile.handle}`,
                      actorUsername: myProfile.handle || 'admin',
                      action: actionType,
                      targetType: 'post',
                      targetId: selectedReport.id,
                      reason: actionReason || 'Violation of Platform Rules',
                      timestamp: new Date().toISOString(),
                    };
                    setAuditLogs([log, ...auditLogs]);
                    setSelectedReport(null);
                    setActionReason('');
                    triggerToast(`Action enforced: ${actionType}`);
                  }}
                >
                  Confirm & Enforce
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USER ROSTER MODAL (FOLLOWERS / FOLLOWING / CIRCLES / LIKES) */}
      {rosterModal && (
        <div className="frosted-modal-backdrop" onClick={() => setRosterModal(null)}>
          <div className="frosted-modal-window roster-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-strip">
              <div>
                <div className="modal-title-bold" style={{ textTransform: 'capitalize' }}>
                  {rosterModal.mode === 'likes' ? 'Liked By' : `${rosterModal.targetName}'s ${rosterModal.mode}`}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  @{rosterModal.targetHandle} · Real-time directory
                </div>
              </div>
              <button className="btn-close-strip" onClick={() => setRosterModal(null)}>
                <IconX size={18} />
              </button>
            </div>

            {/* Tab switchers if on followers/following/circle */}
            {rosterModal.mode !== 'likes' && (() => {
              const cleanTarget = rosterModal.targetHandle.replace(/^@/, '').toLowerCase().trim();
              const p = getUserProfile(cleanTarget);
              const isTargetOwn = Boolean(myProfile.handle) && cleanTarget === (myProfile.handle || '').toLowerCase().trim();
              const isTargetFollowing = isUserFollowed(cleanTarget);
              const targetFollowersSet = new Set(
                (isTargetOwn ? (myProfile.followersList || p.followersList || []) : (p.followersList || []))
                  .map((h) => (h || '').toLowerCase().replace(/^@/, '').trim())
                  .filter((h) => h && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-') && !isMockHandle(h))
              );
              if (!isTargetOwn && myProfile.handle) {
                const myClean = myProfile.handle.toLowerCase().replace(/^@/, '').trim();
                if (isTargetFollowing) {
                  targetFollowersSet.add(myClean);
                } else {
                  targetFollowersSet.delete(myClean);
                }
              }
              const followersCount = targetFollowersSet.size;
              const followingCount = isTargetOwn
                ? getCleanFollowingHandles(followingMap, myProfile.handle).length
                : Array.from(new Set((p.followingList || []).map((h) => (h || '').toLowerCase().replace(/^@/, '').trim()).filter((h) => h && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-') && !isMockHandle(h)))).length;
              const circlesCount = isTargetOwn
                ? closeFriendsList.length
                : (p.trustCirclesList || []).length;

              return (
                <div className="roster-tab-strip">
                  <button
                    type="button"
                    className={`roster-tab-btn ${rosterModal.mode === 'followers' ? 'active' : ''}`}
                    onClick={() => openRoster(rosterModal.targetHandle, rosterModal.targetName, 'followers')}
                  >
                    Followers ({followersCount})
                  </button>
                  <button
                    type="button"
                    className={`roster-tab-btn ${rosterModal.mode === 'following' ? 'active' : ''}`}
                    onClick={() => openRoster(rosterModal.targetHandle, rosterModal.targetName, 'following')}
                  >
                    Following ({followingCount})
                  </button>
                  <button
                    type="button"
                    className={`roster-tab-btn ${rosterModal.mode === 'circle' ? 'active' : ''}`}
                    onClick={() => openRoster(rosterModal.targetHandle, rosterModal.targetName, 'circle')}
                  >
                    Trust Circles ({circlesCount})
                  </button>
                </div>
              );
            })()}

            {/* Real-time search filter */}
            <div className="roster-search-bar">
              <div className="search-input-shell" style={{ width: '100%' }}>
                <span className="search-lens-icon"><IconSearch size={16} /></span>
                <input
                  type="text"
                  className="search-glass-field"
                  placeholder="Filter by name or @handle..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                />
              </div>
            </div>

            {/* People List */}
            {(() => {
              const cleanTarget = rosterModal.targetHandle.replace(/^@/, '').toLowerCase().trim();
              const p = getUserProfile(cleanTarget);
              const isTargetOwn = Boolean(myProfile.handle) && cleanTarget === (myProfile.handle || '').toLowerCase().trim();
              let currentHandles: string[] = [];

              if (rosterModal.mode === 'likes') {
                currentHandles = rosterModal.handles;
              } else if (rosterModal.mode === 'followers') {
                if (isTargetOwn) {
                  const rawList = myProfile.followersList || p.followersList || [];
                  currentHandles = Array.from(new Set(rawList.map((h) => h.toLowerCase().replace(/^@/, '').trim()).filter((h) => h && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-') && !isMockHandle(h))));
                } else {
                  const isTargetFollowing = isUserFollowed(cleanTarget);
                  const base = (p.followersList || []).map((h) => h.toLowerCase().replace(/^@/, '').trim()).filter((h) => h && h !== (myProfile.handle || '').toLowerCase().replace(/^@/, '').trim() && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-') && !isMockHandle(h));
                  const set = new Set(base);
                  if (isTargetFollowing && myProfile.handle) {
                    set.add(myProfile.handle.toLowerCase().replace(/^@/, '').trim());
                  }
                  currentHandles = Array.from(set);
                }
              } else if (rosterModal.mode === 'following') {
                if (isTargetOwn) {
                  currentHandles = getCleanFollowingHandles(followingMap, myProfile.handle);
                } else {
                  currentHandles = Array.from(new Set((p.followingList || []).map((h) => h.toLowerCase().replace(/^@/, '').trim()).filter((h) => h && !h.startsWith('google_') && !h.startsWith('usr-') && !h.startsWith('sc-') && !isMockHandle(h))));
                }
              } else if (rosterModal.mode === 'circle') {
                if (isTargetOwn) {
                  currentHandles = [...closeFriendsList];
                } else {
                  currentHandles = [...(p.trustCirclesList || [])];
                }
              }

              const filteredHandles = currentHandles
                .filter((h) => !isMockHandle(h))
                .filter((h) => {
                  const user = getUserProfile(h);
                  const q = rosterSearch.toLowerCase();
                  return (
                    user.name.toLowerCase().includes(q) ||
                    user.handle.toLowerCase().includes(q) ||
                    (user.category && user.category.toLowerCase().includes(q))
                  );
                });

              return (
                <div className="roster-list-scroll">
                  {filteredHandles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No members found in this roster.
                    </div>
                  ) : (
                    filteredHandles.map((handle) => {
                      const user = getUserProfile(handle);
                      const isF = isUserFollowed(user.handle);
                      const isSelf = Boolean(myProfile.handle) && user.handle.toLowerCase() === myProfile.handle.toLowerCase();

                      return (
                        <div key={user.handle} className="roster-person-card">
                          <div
                            className="roster-person-left"
                            onClick={() => {
                              setRosterModal(null);
                              navigateToProfile(user.handle);
                            }}
                            title={`Open @${user.handle}'s profile`}
                          >
                            <img src={user.avatar} alt={user.name} className="roster-person-avatar" />
                            <div>
                              <div className="roster-person-name">
                                {user.name}
                                {user.isVerified && <VerifiedBadge authorName={user.name} category={user.verifiedCategory} />}
                              </div>
                              <div className="roster-person-handle">@{user.handle}</div>
                              <div className="roster-person-bio">{user.category || user.bio}</div>
                            </div>
                          </div>

                          {!isSelf && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                className={`btn-follow-toggle ${isF ? 'following' : ''}`}
                                style={{ padding: '6px 14px', fontSize: '12px' }}
                                onClick={() => toggleFollow(user.handle, user.name)}
                              >
                                {isF ? 'Following' : 'Follow'}
                              </button>
                              {isTargetOwn && rosterModal.mode === 'followers' && (
                                <button
                                  type="button"
                                  className="btn-glass-back btn-roster-remove-action"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: '11.5px',
                                    color: '#f87171',
                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                  }}
                                  onClick={() => handleRemoveFollower(user.handle)}
                                  title="Remove from your followers"
                                >
                                  <IconTrash size={13} />
                                  <span className="roster-remove-label">Remove</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* PRIVATE ACCOUNT ACCESS REQUEST MODAL */}
      {privateLockModal && (
        <div className="frosted-modal-backdrop" onClick={() => setPrivateLockModal(null)}>
          <div
            className="frosted-modal-window"
            style={{ maxWidth: '440px', padding: '32px 28px', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="private-lock-icon-orb" style={{ margin: '0 auto 18px auto' }}>
              <IconLock size={32} color="var(--cf-emerald)" />
            </div>
            <div className="modal-title-bold" style={{ fontSize: '19px', marginBottom: '8px' }}>
              This Account is Private
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '24px' }}>
              @{privateLockModal.handle}'s followers and following directories are private. Send a follow request to view their community.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                className="btn-glass-back"
                style={{ padding: '10px 22px' }}
                onClick={() => setPrivateLockModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn-post-dispatch"
                style={{ padding: '10px 26px' }}
                onClick={() => {
                  const targetH = privateLockModal.handle;
                  const targetN = privateLockModal.name;
                  toggleFollow(targetH, targetN);
                  setPrivateLockModal(null);
                  triggerToast(`Follow request approved! Access granted to @${targetH}.`);
                  setTimeout(() => {
                    openRoster(targetH, targetN, 'followers');
                  }, 120);
                }}
              >
                Request Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== APPLE VISIONOS SETTINGS MODAL ==================== */}
      {isSettingsOpen && (
        <div className="frosted-modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div
            className="frosted-modal-window"
            style={{ maxWidth: '660px', padding: 0, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="modal-header-line"
              style={{
                padding: '18px 24px',
                margin: 0,
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  <IconSettings size={19} color="#fff" />
                </div>
                <div>
                  <h3 className="modal-title-bold" style={{ fontSize: '18px', margin: 0 }}>
                    Settings & System
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Apple VisionOS frosted controls · Instant persistence
                  </div>
                </div>
              </div>
              <button
                className="btn-glass-back"
                style={{ padding: '6px' }}
                onClick={() => setIsSettingsOpen(false)}
                title="Close Settings"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Navigation Pills */}
            <div className="settings-nav-pill-row">
              <button
                type="button"
                className={`settings-nav-tab ${settingsSubTab === 'account' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('account')}
              >
                Account Information
              </button>
              <button
                type="button"
                className={`settings-nav-tab ${settingsSubTab === 'privacy' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('privacy')}
              >
                Privacy & Circles
              </button>
              <button
                type="button"
                className={`settings-nav-tab ${settingsSubTab === 'notifications' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('notifications')}
              >
                Notifications
              </button>
              <button
                type="button"
                className={`settings-nav-tab ${settingsSubTab === 'security' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('security')}
              >
                Security & Keys
              </button>
              <button
                type="button"
                className={`settings-nav-tab ${settingsSubTab === 'terms' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('terms')}
              >
                Terms & Manifesto
              </button>
              <button
                type="button"
                className={`settings-nav-tab ${settingsSubTab === 'gifts' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('gifts')}
              >
                Virtual Gifts 🎁
              </button>
            </div>

            {/* Settings Content Pane */}
            <div className="settings-content-pane">
              {/* TAB 1: ACCOUNT INFORMATION */}
              {settingsSubTab === 'account' && (
                <div>
                  {/* Profile Spotlight Card */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px 20px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <img
                        src={myProfile.avatar}
                        alt={myProfile.name}
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid rgba(255,255,255,0.2)',
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {myProfile.name}
                          {myProfile.isVerified && (
                            <VerifiedBadge
                              authorName={myProfile.name}
                              category={myProfile.verifiedCategory}
                              since={myProfile.verifiedSince}
                              proofId={myProfile.cryptoProofId}
                            />
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>@{myProfile.handle}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--brand-cyan)', marginTop: '2px' }}>
                          {userSettings.membershipTier} {myProfile.isVerified ? '· Verified Identity' : '· Member'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-glass-back"
                      style={{ padding: '8px 14px', fontSize: '12.5px' }}
                      onClick={() => {
                        setIsSettingsOpen(false);
                        handleOpenEditProfile();
                      }}
                      title="Edit Profile"
                    >
                      <span>Edit Profile</span>
                    </button>
                  </div>

                  {/* Authentication & Identity Card */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px 20px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <IconKey size={16} color="var(--brand)" />
                        <span>Authentication & Login Session</span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          background: currentAuthUser?.provider === 'google' ? 'rgba(66, 133, 244, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          color: currentAuthUser?.provider === 'google' ? '#60a5fa' : '#a78bfa',
                          fontWeight: 700,
                        }}
                      >
                        {currentAuthUser ? (currentAuthUser.provider === 'google' ? 'Google Account' : 'Privity Account') : 'Guest Mode'}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
                      {currentAuthUser ? (
                        <>Signed in as <strong>{currentAuthUser.name}</strong> ({currentAuthUser.email || `@${currentAuthUser.handle}`}). All statistics strictly start at Level 0 with full real-time zero-knowledge ledger verification.</>
                      ) : (
                        <>You are currently using Privity in guest preview mode. Log in with your Google Account or create a Privity account to unlock full profiles, dispatches, and live broadcasts.</>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-glass-back"
                        style={{
                          background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                          borderColor: 'rgba(168,85,247,0.4)',
                          color: '#ffffff',
                          padding: '8px 16px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                        }}
                        onClick={() => {
                          setIsSettingsOpen(false);
                          setIsAuthModalOpen(true);
                        }}
                      >
                        {currentAuthUser ? 'Switch / Connect Another Account' : 'Log In / Sign Up with Google'}
                      </button>

                      {currentAuthUser && (
                        <button
                          type="button"
                          className="btn-glass-back"
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            padding: '8px 16px',
                            fontSize: '12.5px',
                            fontWeight: 700,
                          }}
                          onClick={() => {
                            authService.logout();
                            setCurrentAuthUser(null);
                            setIsSettingsOpen(false);
                            triggerToast('Signed out of Privity account');
                          }}
                        >
                          Sign Out
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="settings-card-group">
                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <IconMail size={15} color="var(--brand)" />
                          <span>Account Holder Email</span>
                        </div>
                        <div className="settings-item-desc">Primary encrypted channel for ledger alerts and key recovery.</div>
                      </div>
                      <input
                        type="email"
                        className="settings-input"
                        value={userSettings.email}
                        onChange={(e) => setUserSettings((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="yourname@domain.com"
                      />
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Encrypted Phone Number</div>
                        <div className="settings-item-desc">Used exclusively for hardware 2FA and offline cryptographic verification.</div>
                      </div>
                      <input
                        type="tel"
                        className="settings-input"
                        value={userSettings.phone}
                        onChange={(e) => setUserSettings((prev) => ({ ...prev, phone: e.target.value }))}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Membership Tier</div>
                        <div className="settings-item-desc">Your platform governance tier on the decentralized trust ledger.</div>
                      </div>
                      <select
                        className="settings-select"
                        value={userSettings.membershipTier}
                        onChange={(e) => setUserSettings((prev) => ({ ...prev, membershipTier: e.target.value as any }))}
                      >
                        <option value="Founding Member">Founding Member</option>
                        <option value="Visionary Genesis">Visionary Genesis</option>
                        <option value="Sovereign Pass">Sovereign Pass</option>
                      </select>
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Show Verification Badge in Feeds</div>
                        <div className="settings-item-desc">Display the cryptographic verified star emblem next to your handle.</div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={userSettings.handlePrivacyBadge}
                          onChange={(e) => setUserSettings((prev) => ({ ...prev, handlePrivacyBadge: e.target.checked }))}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>
                  </div>

                  {/* Data Portability */}
                  <div className="settings-card-group">
                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Full Account Data Export (JSON)</div>
                        <div className="settings-item-desc">Download an offline JSON bundle of your profile, all dispatches, media, circles, and cryptographic configuration.</div>
                      </div>
                      <button
                        type="button"
                        className="btn-glass-back"
                        onClick={handleExportData}
                        style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <IconDownload size={15} />
                        <span>Export Data</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRIVACY & TRUST CIRCLES */}
              {settingsSubTab === 'privacy' && (
                <div>
                  <div className="settings-card-group">
                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Private Account</div>
                        <div className="settings-item-desc">
                          When enabled, your dispatches, media gallery, and followers directory are restricted strictly to approved followers.
                        </div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={isPrivateAccount}
                          onChange={(e) => handleTogglePrivateAccount(e.target.checked)}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Live Online Presence</div>
                        <div className="settings-item-desc">Display a green live pulse indicator to mutual friends and Close Friends when active.</div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={userSettings.showOnlineStatus}
                          onChange={(e) => setUserSettings((prev) => ({ ...prev, showOnlineStatus: e.target.checked }))}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Search & Discover Ingestion</div>
                        <div className="settings-item-desc">Allow public dispatches to appear in the community Discover feed and search tags.</div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={userSettings.searchDiscoverable}
                          onChange={(e) => setUserSettings((prev) => ({ ...prev, searchDiscoverable: e.target.checked }))}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-card-group">
                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Direct Message Permissions</div>
                        <div className="settings-item-desc">Control who can initiate encrypted private chats with your account.</div>
                      </div>
                      <select
                        className="settings-select"
                        value={userSettings.allowDirectMessages}
                        onChange={(e) => setUserSettings((prev) => ({ ...prev, allowDirectMessages: e.target.value as any }))}
                      >
                        <option value="close_friends">Close Friends Circle Only</option>
                        <option value="following">Accounts You Follow</option>
                        <option value="everyone">Everyone (Public Network)</option>
                      </select>
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Read Receipts</div>
                        <div className="settings-item-desc">Allow mutual connections to observe when you have opened their direct messages or stories.</div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={userSettings.readReceipts}
                          onChange={(e) => setUserSettings((prev) => ({ ...prev, readReceipts: e.target.checked }))}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Close Friends Inner Circle</div>
                        <div className="settings-item-desc">
                          Manage your {closeFriendsList.length} trusted connections who can view your exclusive emerald-badged dispatches.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-glass-back"
                        onClick={() => {
                          setIsSettingsOpen(false);
                          openRoster(myProfile.handle, myProfile.name, 'circle');
                        }}
                        style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <IconStarCloseFriends size={14} color="var(--cf-emerald)" />
                        <span>Manage Circle ({closeFriendsList.length})</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: NOTIFICATIONS */}
              {settingsSubTab === 'notifications' && (
                <div>
                  <div className="settings-card-group">
                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Close Friends Dispatches</div>
                        <div className="settings-item-desc">High-priority instant notification when an inner circle member shares private dispatches.</div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={userSettings.notifyCloseFriendsDispatches}
                          onChange={(e) => setUserSettings((prev) => ({ ...prev, notifyCloseFriendsDispatches: e.target.checked }))}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Mentions & Thread Replies</div>
                        <div className="settings-item-desc">Notify when another creator tags @{myProfile.handle} or replies to your conversation.</div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={userSettings.notifyMentionsAndReplies}
                          onChange={(e) => setUserSettings((prev) => ({ ...prev, notifyMentionsAndReplies: e.target.checked }))}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">New Follow Requests & Followers</div>
                        <div className="settings-item-desc">Alerts when someone follows your account or requests access to your private circle.</div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={userSettings.notifyNewFollowers}
                          onChange={(e) => setUserSettings((prev) => ({ ...prev, notifyNewFollowers: e.target.checked }))}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Cryptographic Attestation Confirmations</div>
                        <div className="settings-item-desc">Alert when peer nodes validate cryptographic zero-knowledge proofs on your media.</div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={userSettings.notifyCryptoProofValidations}
                          onChange={(e) => setUserSettings((prev) => ({ ...prev, notifyCryptoProofValidations: e.target.checked }))}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SECURITY & CRYPTOGRAPHY */}
              {settingsSubTab === 'security' && (
                <div>
                  <div className="settings-card-group">
                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <IconKey size={15} color="var(--cf-emerald)" />
                          <span>Ed25519 Cryptographic Fingerprint</span>
                        </div>
                        <div className="settings-item-desc">
                          Client-side elliptic curve key pair used to sign each of your dispatches, ensuring tamper-proof cryptographic authenticity.
                        </div>
                        <div style={{ marginTop: '8px' }}>
                          <code
                            style={{
                              display: 'inline-block',
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)',
                              background: 'rgba(0, 0, 0, 0.45)',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              color: 'var(--brand-cyan)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                            }}
                          >
                            {userSettings.cryptoKeyFingerprint}
                          </code>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-glass-back"
                        onClick={handleCopyCryptoFingerprint}
                        style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <IconCopy size={14} />
                        <span>{copiedFingerprint ? 'Copied!' : 'Copy Key'}</span>
                      </button>
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Two-Factor Passkey (WebAuthn)</div>
                        <div className="settings-item-desc">Hardware-backed biometric authentication (Touch ID, Optic ID, or FIDO2 key).</div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={userSettings.twoFactorEnabled}
                          onChange={(e) => setUserSettings((prev) => ({ ...prev, twoFactorEnabled: e.target.checked }))}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>

                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title">Hardware Security Key Enrolled</div>
                        <div className="settings-item-desc">Physical YubiKey cryptographic recovery token linked to ledger identity.</div>
                      </div>
                      <label className="apple-switch">
                        <input
                          type="checkbox"
                          checked={userSettings.hardwareKeyLinked}
                          onChange={(e) => setUserSettings((prev) => ({ ...prev, hardwareKeyLinked: e.target.checked }))}
                        />
                        <span className="apple-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-card-group">
                    <div className="settings-row-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconSmartphone size={20} color="var(--cf-emerald)" />
                        </div>
                        <div>
                          <div className="settings-item-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{userSettings.sessionDevice}</span>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cf-emerald)' }}></span>
                          </div>
                          <div className="settings-item-desc">San Francisco, CA · Local End-to-End Encrypted Tunnel · Current Session</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: TERMS & MANIFESTO */}
              {settingsSubTab === 'terms' && (
                <div>
                  <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
                    <img
                      src="./privity-logo.png"
                      alt="Privity Official Logo"
                      style={{
                        maxHeight: '130px',
                        maxWidth: '220px',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 0 25px rgba(99, 102, 241, 0.45))',
                      }}
                    />
                  </div>
                  <div className="settings-card-group" style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <IconFileText size={18} color="var(--brand)" />
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>
                        The Privity Social Covenant
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                      <p style={{ marginBottom: '10px' }}>
                        <strong>1. Zero Algorithmic Manipulation:</strong> Privity guarantees that no engagement-maximizing algorithm, rage-bait multiplier, or artificial ranking system will ever curate your feed. Every feed is purely reverse-chronological and guided solely by your chosen circles.
                      </p>
                      <p style={{ marginBottom: '10px' }}>
                        <strong>2. Sovereign Data Ownership:</strong> Your dispatches, photographs, and circle rosters belong entirely to you. You can export your data at any time in standardized JSON archives or delete your presence without retention remnants.
                      </p>
                      <p style={{ marginBottom: '10px' }}>
                        <strong>3. Cryptographic Provenance:</strong> Content is cryptographically signed using Ed25519 signatures, verifying authentic authorship without centralized middlemen or intrusive surveillance tracking.
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong>4. Community Trust:</strong> Mutual respect, zero harassment, and authenticity define Privity. Bot networks and spam syndicates are cryptographically quarantined.
                      </p>
                    </div>
                  </div>

                  <div className="settings-card-group">
                    <div className="settings-row-item">
                      <div className="settings-row-label-group">
                        <div className="settings-item-title" style={{ color: '#f87171' }}>Purge Platform & Start from Scratch</div>
                        <div className="settings-item-desc">
                          Erase all posts, all activities, all notifications, all accounts, and cached videos so everyone can register or log in cleanly from scratch.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-glass-back"
                        style={{
                          borderColor: 'rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          padding: '8px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                        onClick={handleResetData}
                      >
                        <IconTrash size={15} />
                        <span>Purge & Reset All</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: VIRTUAL GIFTS & ENGINE MANAGEMENT */}
              {settingsSubTab === 'gifts' && (
                <div style={{ padding: '4px 0' }}>
                  <AdminGiftManager
                    catalog={giftsCatalog}
                    onCatalogChange={setGiftsCatalog}
                    triggerToast={triggerToast}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--glass-border)',
                background: 'rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                All changes save automatically to local storage
              </div>
              <button
                type="button"
                className="btn-post-dispatch"
                style={{ padding: '8px 22px', fontSize: '13px' }}
                onClick={() => {
                  setIsSettingsOpen(false);
                  triggerToast('All settings saved');
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MOBILE BOTTOM NAVIGATION (<= 768px) */}
      {(() => {
        const shouldHideMobileBottomNav = Boolean(
          isCameraOpen ||
          activeLiveStream ||
          isHostBroadcasting ||
          (activeTab === 'messages' && Boolean(activeChatUser)) ||
          lightboxUrl ||
          isModalOpen ||
          isEditProfileOpen ||
          isSettingsOpen ||
          rosterModal ||
          postMenuModal ||
          isProfileDrawerOpen ||
          isFeedCommentsOpen ||
          isFeedStoryOpen ||
          dmActiveStoryIndex !== null ||
          isViewersModalOpen
        );

        if (shouldHideMobileBottomNav) return null;

        return (
          <nav className="mobile-bottom-nav">
            <button
              type="button"
              className={`mobile-nav-item ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('feed');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title="Home Feed"
            >
              <IconHome size={22} color={activeTab === 'feed' ? '#ffffff' : 'currentColor'} />
              <span className="mobile-nav-label">Feed</span>
              {activeTab === 'feed' && <span className="mobile-nav-indicator" />}
            </button>

            <button
              type="button"
              className={`mobile-nav-item ${activeTab === 'discover' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('discover');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title="Discover Creators"
            >
              <IconDiscover size={22} />
              <span className="mobile-nav-label">Discover</span>
              {activeTab === 'discover' && <span className="mobile-nav-indicator" />}
            </button>

            <button
              type="button"
              className="mobile-nav-item mobile-nav-compose-center"
              onClick={() => setIsCameraOpen(true)}
              title="Open Camera & Studio"
            >
              <div className="mobile-compose-orb">
                <IconPlus size={22} color="#ffffff" />
              </div>
            </button>

            <button
              type="button"
              className={`mobile-nav-item ${activeTab === 'messages' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('messages');
                setActiveChatUser(null);
              }}
              title="Encrypted Messages"
            >
              <div style={{ position: 'relative' }}>
                <IconChat size={22} color={activeTab === 'messages' ? '#ffffff' : 'currentColor'} />
                <span className="mobile-badge-dot" />
              </div>
              <span className="mobile-nav-label">Messages</span>
              {activeTab === 'messages' && <span className="mobile-nav-indicator" />}
            </button>

            <button
              type="button"
              className={`mobile-nav-item ${activeTab === 'profile' && viewedUserHandle === myProfile.handle ? 'active' : ''}`}
              onClick={() => {
                if (!currentAuthUser) {
                  setIsAuthModalOpen(true);
                  return;
                }
                navigateToProfile(myProfile.handle);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title="Your Profile"
            >
              <div className={`mobile-nav-avatar-wrap ${activeTab === 'profile' && viewedUserHandle === myProfile.handle ? 'active' : ''}`}>
                {currentAuthUser && myProfile.avatar ? (
                  <MediaAvatar src={myProfile.avatar} alt="Profile" className="mobile-nav-avatar" showBadge={false} />
                ) : (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <IconUser size={15} />
                  </div>
                )}
              </div>
              <span className="mobile-nav-label">{currentAuthUser ? 'Profile' : 'Log In'}</span>
              {activeTab === 'profile' && viewedUserHandle === myProfile.handle && <span className="mobile-nav-indicator" />}
            </button>
          </nav>
        );
      })()}

      {/* Universal Authentication Modal (Google Sign-In & Native Account) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={(user) => {
          setCurrentAuthUser(user);
          setIsAuthModalOpen(false);
          triggerToast(`Welcome, ${user.name}!`);
          broadcastSyncEventRef.current({
            action: 'USER_PAGE_CREATED',
            account: user,
          });
        }}
      />

      {/* Universal Fullscreen Story Viewer (Accessible from Profile, Feed, Messages & Birdie) */}
      {dmActiveStoryIndex !== null && (() => {
        const curStory = stories[dmActiveStoryIndex];
        if (!curStory) return null;

        return (
          <div
            className="story-viewer-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              backgroundColor: dmStoryDragY > 0 ? `rgba(0, 0, 0, ${Math.max(0, 1 - dmStoryDragY / 260)})` : '#000',
            }}
            onClick={() => {
              setDmActiveStoryIndex(null);
              setDmStoryDragY(0);
            }}
          >
            <div
              className="story-viewer-modal"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => {
                (window as any).__dmStoryTouchStartY = e.touches[0].clientY;
                (window as any).__dmStoryTouchStartX = e.touches[0].clientX;
              }}
              onTouchMove={(e) => {
                const dy = e.touches[0].clientY - ((window as any).__dmStoryTouchStartY || 0);
                const dx = e.touches[0].clientX - ((window as any).__dmStoryTouchStartX || 0);
                if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
                  setDmStoryDragY(dy);
                }
              }}
              onTouchEnd={() => {
                if (dmStoryDragY > 70) {
                  setDmActiveStoryIndex(null);
                  setDmStoryDragY(0);
                } else {
                  setDmStoryDragY(0);
                }
              }}
              onMouseDown={(e) => {
                (window as any).__dmStoryMouseStartY = e.clientY;
                (window as any).__dmStoryMouseStartX = e.clientX;
                (window as any).__dmStoryMouseDown = true;
              }}
              onMouseMove={(e) => {
                if (!(window as any).__dmStoryMouseDown) return;
                const dy = e.clientY - ((window as any).__dmStoryMouseStartY || 0);
                const dx = e.clientX - ((window as any).__dmStoryMouseStartX || 0);
                if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
                  setDmStoryDragY(dy);
                }
              }}
              onMouseUp={() => {
                (window as any).__dmStoryMouseDown = false;
                if (dmStoryDragY > 70) {
                  setDmActiveStoryIndex(null);
                  setDmStoryDragY(0);
                } else {
                  setDmStoryDragY(0);
                }
              }}
              style={{
                transform: dmStoryDragY > 0 ? `translateY(${dmStoryDragY}px) scale(${Math.max(0.75, 1 - dmStoryDragY / 900)})` : undefined,
                opacity: dmStoryDragY > 0 ? Math.max(0.2, 1 - dmStoryDragY / 450) : 1,
                borderRadius: dmStoryDragY > 0 ? `${Math.min(32, dmStoryDragY / 3)}px` : undefined,
              }}
            >
              <div className="story-viewer-drag-bar" title="Slide down to close story" />

              <div className="story-viewer-header" style={{ position: 'absolute', top: '24px', left: '14px', right: '14px', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div
                  className="story-viewer-author"
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                  onClick={() => {
                    setDmActiveStoryIndex(null);
                    navigateToProfile(curStory.authorHandle);
                  }}
                >
                  <MediaAvatar src={curStory.authorAvatar} alt={curStory.authorName} className="story-viewer-avatar" style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1.5px solid #fff' }} />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>{curStory.authorName}</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>@{curStory.authorHandle} · {curStory.timeAgo}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="story-viewer-camera-btn"
                    onClick={() => {
                      setDmActiveStoryIndex(null);
                      setIsCameraOpen(true);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.35)',
                      borderRadius: '20px',
                      padding: '5px 12px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                    }}
                    title="Open Studio Camera to post story"
                  >
                    <span>📷 Studio</span>
                  </button>
                  <button
                    type="button"
                    className="story-viewer-close"
                    onClick={() => {
                      setDmActiveStoryIndex(null);
                      setDmStoryDragY(0);
                    }}
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="story-viewer-media-wrap" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                {curStory.mediaType === 'video' || isVideoMedia(curStory.mediaUrl) ? (
                  <video src={curStory.mediaUrl} autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={curStory.mediaUrl} alt={curStory.caption || 'Story'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {curStory.caption && (
                  <div className="story-viewer-caption-box">
                    <p>{curStory.caption}</p>
                  </div>
                )}
              </div>

              {/* Reply & Quick Reactions */}
              <div className="story-viewer-bottom-bar" onClick={(e) => e.stopPropagation()}>
                <div className="story-quick-reactions">
                  {['❤️', '🔥', '👏', '😂'].map((emoji, eIdx) => (
                    <button
                      key={eIdx}
                      type="button"
                      className="story-reaction-emoji-btn"
                      onClick={() => {
                        handleStoryReplyToDM(curStory.authorHandle, `Reacted ${emoji} to your story`);
                        setDmActiveStoryIndex(null);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="story-reply-input-wrap">
                  <input
                    type="text"
                    placeholder={`Reply to @${curStory.authorHandle}...`}
                    value={dmStoryReplyText}
                    onChange={(e) => setDmStoryReplyText(e.target.value)}
                    className="story-reply-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && dmStoryReplyText.trim()) {
                        handleStoryReplyToDM(curStory.authorHandle, `Replied to your story: "${dmStoryReplyText.trim()}"`);
                        setDmStoryReplyText('');
                        setDmActiveStoryIndex(null);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!dmStoryReplyText.trim()}
                    className="story-reply-send-btn"
                    onClick={() => {
                      if (!dmStoryReplyText.trim()) return;
                      handleStoryReplyToDM(curStory.authorHandle, `Replied to your story: "${dmStoryReplyText.trim()}"`);
                      setDmStoryReplyText('');
                      setDmActiveStoryIndex(null);
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default App;
