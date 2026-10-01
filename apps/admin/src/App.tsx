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
  IconVideo,
  IconFeedStream,
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
import { LiveMeStreamArena } from './components/liveme';


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
  email: 'luciano@privity.app',
  phone: '+1 (415) 890-2100',
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
  twoFactorEnabled: true,
  cryptoKeyFingerprint: 'ed25519:7a9f:88c2:e410:33bc:99d1:a102:fe55',
  hardwareKeyLinked: true,
  sessionDevice: 'Apple Vision Pro · visionOS 2.2 · Active Now',
};

// ==================== REAL DATA MODELS & ASSETS ====================

interface PostComment {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  isVerified: boolean;
  text: string;
  timeAgo: string;
  likesCount: number;
  isLiked?: boolean;
  replies?: {
    id: string;
    authorName: string;
    authorHandle: string;
    authorAvatar: string;
    isVerified: boolean;
    text: string;
    timeAgo: string;
  }[];
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
  soundName?: string;
  voiceMemoDuration?: string;
  caption: string;
  tags: string[];
  privacy: PostPrivacy;
  likesCount: number;
  likersList?: string[];
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  timeAgo: string;
  comments: PostComment[];
}

const SAMPLE_POSTS: PostItem[] = [
  {
    id: 'p-101',
    authorId: 'usr-elena',
    authorName: 'Elena Rodriguez',
    authorHandle: 'elena_rodriguez',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    isVerified: true,
    verifiedCategory: 'Visual Artist & Photographer',
    verifiedSince: 'Verified Nov 2025',
    cryptoProofId: 'priv_ed25519_e891ab73f9',
    type: 'image',
    contentUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1200&auto=format&fit=crop&q=85',
    caption: 'Quiet morning in the northern studio. Painting and shooting without the invisible pressure of an engagement algorithm. Here is a study on natural window diffusion and quiet space.',
    tags: ['photography', 'mindful', 'studio', 'analogue'],
    privacy: 'close_friends',
    likesCount: 5,
    likersList: ['marcus_dev', 'sara_architecture', 'julian_analogue', 'chloe_visuals', 'luciano'],
    commentsCount: 3,
    sharesCount: 1,
    savesCount: 14,
    isLiked: true,
    isSaved: true,
    timeAgo: '14m ago',
    comments: [
      {
        id: 'c-1',
        authorName: 'Marcus Vance',
        authorHandle: 'marcus_dev',
        authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        isVerified: true,
        text: 'The warm tones on that cedar frame are breathtaking. Was this natural light from the skylight?',
        timeAgo: '10m ago',
        likesCount: 3,
        replies: [
          {
            id: 'r-1',
            authorName: 'Elena Rodriguez',
            authorHandle: 'elena_rodriguez',
            authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
            isVerified: true,
            text: 'Yes Marcus! Portra 400 shot at box speed, natural morning exposure.',
            timeAgo: '6m ago',
          },
        ],
      },
      {
        id: 'c-2',
        authorName: 'Sara Lin',
        authorHandle: 'sara_architecture',
        authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
        isVerified: true,
        text: 'So grateful to be in this circle Elena. This feels like what the web was meant to be.',
        timeAgo: '4m ago',
        likesCount: 2,
      },
    ],
  },
  {
    id: 'p-102',
    authorId: 'usr-marcus',
    authorName: 'Marcus Vance',
    authorHandle: 'marcus_dev',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    isVerified: true,
    verifiedCategory: 'Systems Architect & Writer',
    verifiedSince: 'Verified Jan 2026',
    cryptoProofId: 'priv_ed25519_7c41bf920a',
    type: 'text',
    caption: 'The fundamental flaw of 2010s social media was measuring human connection through infinite reach metrics (followers, impressions, virality). When you make distribution algorithmic, creators are forced to perform for the machine.\n\nPrivity restores human agency: explicit audience circles, zero recommendation tampering, and transparent privacy.',
    tags: ['privacy', 'software', 'social', 'manifesto'],
    privacy: 'followers',
    likesCount: 3,
    likersList: ['elena_rodriguez', 'sara_architecture', 'julian_analogue'],
    commentsCount: 1,
    sharesCount: 16,
    savesCount: 42,
    isLiked: false,
    isSaved: false,
    timeAgo: '1h ago',
    comments: [
      {
        id: 'c-3',
        authorName: 'Luciano',
        authorHandle: 'luciano',
        authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        isVerified: true,
        text: 'Spot on Marcus. Privacy by default is how we restore authentic trust.',
        timeAgo: '42m ago',
        likesCount: 9,
      },
    ],
  },
  {
    id: 'p-103',
    authorId: 'usr-julian',
    authorName: 'Julian Thorne',
    authorHandle: 'julian_analogue',
    authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    isVerified: true,
    verifiedCategory: 'Field Audio Recordist',
    verifiedSince: 'Verified Mar 2026',
    cryptoProofId: 'priv_ed25519_88a14b3309',
    type: 'text',
    voiceMemoDuration: '0:38',
    caption: 'Recorded dawn mist reverberations near Big Sur coastal pines. Ambient binaural audio snippet shared with close friends.',
    tags: ['ambient', 'binaural', 'soundscape', 'california'],
    privacy: 'close_friends',
    likesCount: 2,
    likersList: ['elena_rodriguez', 'marcus_dev'],
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 11,
    isLiked: false,
    isSaved: true,
    timeAgo: '2h ago',
    comments: [],
  },
  {
    id: 'p-104',
    authorId: 'usr-chloe',
    authorName: 'Chloe Kim',
    authorHandle: 'chloe_visuals',
    authorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    isVerified: true,
    verifiedCategory: 'Cinematographer & Director',
    verifiedSince: 'Verified Feb 2026',
    cryptoProofId: 'priv_ed25519_119d88bb01',
    type: 'video',
    thumbnailUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=1200&auto=format&fit=crop&q=85',
    caption: 'Tokyo rain at twilight. 4K 60fps color grade inspired by Wong Kar-wai. Neon reflections on puddles around Shinjuku back alleys.',
    tags: ['tokyo', 'cinematography', 'video', 'streetphotography'],
    privacy: 'public',
    likesCount: 4,
    likersList: ['elena_rodriguez', 'marcus_dev', 'sara_architecture', 'oliver_wood'],
    commentsCount: 0,
    sharesCount: 54,
    savesCount: 104,
    isLiked: false,
    isSaved: false,
    timeAgo: '4h ago',
    comments: [],
  },
  {
    id: 'p-105',
    authorId: 'sc-1',
    authorName: 'Sara Lin',
    authorHandle: 'sara_architecture',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    isVerified: true,
    verifiedCategory: 'Spatial & Minimal Architecture',
    verifiedSince: 'Verified Dec 2025',
    cryptoProofId: 'priv_ed25519_sara_lin',
    type: 'image',
    contentUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=85',
    caption: 'Finished the rammed-earth guest sanctuary pavilion in northern Kyoto. Hand-compacted local river clay, charred cypress eaves, and indirect southern light that breathes through the courtyards.',
    tags: ['architecture', 'kyoto', 'minimalism', 'naturalmaterials'],
    privacy: 'public',
    likesCount: 3,
    likersList: ['elena_rodriguez', 'marcus_dev', 'oliver_wood'],
    commentsCount: 1,
    sharesCount: 22,
    savesCount: 51,
    isLiked: false,
    isSaved: true,
    timeAgo: '5h ago',
    comments: [
      {
        id: 'c-501',
        authorName: 'Elena Rodriguez',
        authorHandle: 'elena_rodriguez',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
        isVerified: true,
        text: 'The shadow interplay on the cypress beams is sublime Sara!',
        timeAgo: '3h ago',
        likesCount: 5,
      },
    ],
  },
  {
    id: 'p-106',
    authorId: 'sc-3',
    authorName: 'Oliver Craft',
    authorHandle: 'oliver_wood',
    authorAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400',
    isVerified: false,
    verifiedCategory: 'Traditional Joinery',
    type: 'image',
    contentUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&auto=format&fit=crop&q=85',
    caption: 'Hand-cut through-tenon and wedged mortise joints for a 200-year-old salvaged Oregon white oak dining slab. No fasteners, no metal hardware. Only timber friction and precise hand chiseling.',
    tags: ['woodworking', 'joinery', 'craftsmanship', 'handtools'],
    privacy: 'public',
    likesCount: 2,
    likersList: ['sara_architecture', 'sam_arch'],
    commentsCount: 0,
    sharesCount: 7,
    savesCount: 19,
    isLiked: false,
    isSaved: false,
    timeAgo: '7h ago',
    comments: [],
  },
  {
    id: 'p-107',
    authorId: 'fr-1',
    authorName: 'Sam Archer',
    authorHandle: 'sam_arch',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    isVerified: false,
    verifiedCategory: 'Wilderness Guide',
    type: 'image',
    contentUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&auto=format&fit=crop&q=85',
    caption: 'First light crossing Fisher Chimneys on Mount Shuksan. High alpine ice conditions were crystalline and still. Privileged to share this exclusively with close circle friends.',
    tags: ['alpinism', 'cascades', 'mountaineering', 'sunrise'],
    privacy: 'close_friends',
    likesCount: 2,
    likersList: ['oliver_wood', 'marcus_dev'],
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 14,
    isLiked: false,
    isSaved: false,
    timeAgo: '12h ago',
    comments: [],
  },
  {
    id: 'p-108',
    authorId: 'fr-2',
    authorName: 'Jessica Vance',
    authorHandle: 'jess_film',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    isVerified: true,
    verifiedCategory: 'Documentary Filmmaker',
    verifiedSince: 'Verified Jan 2026',
    cryptoProofId: 'priv_ed25519_jess_film',
    type: 'image',
    contentUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&auto=format&fit=crop&q=85',
    caption: 'Production still from our master textile weaver documentary in Arashiyama. 35mm motion picture film negative scanned at 4K.',
    tags: ['cinema', 'documentary', '35mm', 'japan'],
    privacy: 'public',
    likesCount: 4,
    likersList: ['marcus_dev', 'elena_rodriguez', 'chloe_visuals', 'luciano'],
    commentsCount: 0,
    sharesCount: 38,
    savesCount: 77,
    isLiked: true,
    isSaved: false,
    timeAgo: '1d ago',
    comments: [],
  },
  {
    id: 'p-109',
    authorId: 'usr-luciano',
    authorName: 'Luciano',
    authorHandle: 'luciano',
    authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
    isVerified: true,
    verifiedCategory: 'Platform Founder',
    verifiedSince: 'Verified 2026',
    cryptoProofId: 'priv_ed25519_luciano_founder',
    type: 'text',
    caption: 'Welcome to Privity. We built this network on a non-negotiable premise: your relationships belong to you, not an algorithmic auctioneer. No algorithmic feed sorting, no follower gamification, and absolute privacy sovereignty over who sees what you create.',
    tags: ['privity', 'privacyfirst', 'manifesto', 'futureofsocial'],
    privacy: 'public',
    likesCount: 5,
    likersList: ['elena_rodriguez', 'marcus_dev', 'julian_analogue', 'sara_architecture', 'luciano'],
    commentsCount: 1,
    sharesCount: 65,
    savesCount: 92,
    isLiked: true,
    isSaved: true,
    timeAgo: '2d ago',
    comments: [
      {
        id: 'c-founder-1',
        authorName: 'Marcus Vance',
        authorHandle: 'marcus_dev',
        authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        isVerified: true,
        text: 'This is the exact paradigm shift the internet has needed for 15 years.',
        timeAgo: '1d ago',
        likesCount: 14,
      },
    ],
  },
];

const SUGGESTED_CREATORS = [
  {
    id: 'sara_architecture',
    name: 'Sara Lin',
    handle: 'sara_architecture',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    category: 'Spatial & Minimal Architecture',
    isVerified: true,
  },
  {
    id: 'julian_analogue',
    name: 'Julian Thorne',
    handle: 'julian_analogue',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    category: 'Field Audio & Synthesis',
    isVerified: true,
  },
  {
    id: 'oliver_wood',
    name: 'Oliver Craft',
    handle: 'oliver_wood',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
    category: 'Traditional Joinery',
    isVerified: false,
  },
];

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
  coverUrl: string;
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

const INITIAL_PROFILES_REGISTRY: Record<string, UserProfile> = {
  elena_rodriguez: {
    id: 'usr-elena',
    name: 'Elena Rodriguez',
    handle: 'elena_rodriguez',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600&auto=format&fit=crop&q=85',
    isVerified: true,
    verifiedCategory: 'Visual Artist & Photographer',
    verifiedSince: 'Verified Nov 2025',
    cryptoProofId: 'priv_ed25519_e891ab73f9',
    bio: 'Exploring northern studio light, natural window diffusion, and mindful moments without algorithmic pressure. 120 medium format analogue film & oil painting.',
    category: 'Visual Artist & Photographer',
    location: 'Stockholm, Sweden',
    joinedDate: 'November 2025',
    website: 'elenarodriguez.art',
    circleStatus: 'Close Friend',
    isPrivate: false,
    followersList: ['marcus_dev', 'sara_architecture', 'julian_analogue', 'luciano', 'chloe_visuals', 'jess_film'],
    followingList: ['marcus_dev', 'sara_architecture', 'julian_analogue', 'luciano'],
    trustCirclesList: ['marcus_dev', 'sara_architecture', 'luciano'],
    mediaItems: [
      { id: 'm-elena-1', url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 28, comments: 3 },
      { id: 'm-elena-2', url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 45, comments: 6 },
      { id: 'm-elena-3', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 82, comments: 9 },
      { id: 'm-elena-4', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 67, comments: 4 },
      { id: 'm-elena-5', url: 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 110, comments: 12 },
      { id: 'm-elena-6', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 53, comments: 7 },
    ],
  },
  marcus_dev: {
    id: 'usr-marcus',
    name: 'Marcus Vance',
    handle: 'marcus_dev',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1600&auto=format&fit=crop&q=85',
    isVerified: true,
    verifiedCategory: 'Systems Architect & Writer',
    verifiedSince: 'Verified Jan 2026',
    cryptoProofId: 'priv_ed25519_7c41bf920a',
    bio: 'Designing decentralised trust and local-first cryptographic architectures. Author of "Agency Over Algorithms". Advocate for transparent visibility circles.',
    category: 'Systems Architect & Writer',
    location: 'Seattle, WA',
    joinedDate: 'January 2026',
    website: 'marcusvance.io',
    circleStatus: 'Mutual Follower',
    isPrivate: false,
    followersList: ['elena_rodriguez', 'luciano', 'sara_architecture', 'sam_arch', 'oliver_wood', 'chloe_visuals'],
    followingList: ['elena_rodriguez', 'luciano', 'sara_architecture'],
    trustCirclesList: ['elena_rodriguez', 'luciano'],
    mediaItems: [
      { id: 'm-marcus-1', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 76, comments: 8 },
      { id: 'm-marcus-2', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 124, comments: 15 },
      { id: 'm-marcus-3', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 89, comments: 11 },
    ],
  },
  julian_analogue: {
    id: 'usr-julian',
    name: 'Julian Thorne',
    handle: 'julian_analogue',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&auto=format&fit=crop&q=85',
    isVerified: true,
    verifiedCategory: 'Field Audio Recordist',
    verifiedSince: 'Verified Mar 2026',
    cryptoProofId: 'priv_ed25519_88a14b3309',
    bio: 'Capturing dawn reverberations, coastal mist, and modular synthesis in high fidelity binaural sound. Sharing raw audio snippets with close circle friends.',
    category: 'Field Audio & Synthesis',
    location: 'Big Sur, California',
    joinedDate: 'March 2026',
    website: 'juliansound.com',
    circleStatus: 'Close Friend',
    isPrivate: false,
    followersList: ['elena_rodriguez', 'marcus_dev', 'luciano', 'jess_film'],
    followingList: ['elena_rodriguez', 'marcus_dev', 'luciano'],
    trustCirclesList: ['elena_rodriguez', 'marcus_dev'],
    mediaItems: [
      { id: 'm-julian-1', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 31, comments: 2 },
      { id: 'm-julian-2', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 58, comments: 5 },
      { id: 'm-julian-3', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 92, comments: 14 },
    ],
  },
  chloe_visuals: {
    id: 'usr-chloe',
    name: 'Chloe Kim',
    handle: 'chloe_visuals',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=1600&auto=format&fit=crop&q=85',
    isVerified: true,
    verifiedCategory: 'Cinematographer & Director',
    verifiedSince: 'Verified Feb 2026',
    cryptoProofId: 'priv_ed25519_119d88bb01',
    bio: 'Nocturnal visual narratives, anamorphic glass, and quiet city reflections. Directing short-form cinema across Tokyo and Seoul.',
    category: 'Cinematographer & Director',
    location: 'Tokyo / Seoul',
    joinedDate: 'February 2026',
    website: 'chloekim.film',
    circleStatus: 'Public Connection',
    isPrivate: false,
    followersList: ['elena_rodriguez', 'marcus_dev', 'sara_architecture', 'luciano', 'oliver_wood'],
    followingList: ['elena_rodriguez', 'marcus_dev'],
    trustCirclesList: ['elena_rodriguez', 'luciano'],
    mediaItems: [
      { id: 'm-chloe-1', url: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 312, comments: 19 },
      { id: 'm-chloe-2', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 215, comments: 14 },
      { id: 'm-chloe-3', url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 184, comments: 9 },
      { id: 'm-chloe-4', url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 240, comments: 17 },
    ],
  },
  sara_architecture: {
    id: 'sara_architecture',
    name: 'Sara Lin',
    handle: 'sara_architecture',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&auto=format&fit=crop&q=85',
    isVerified: true,
    verifiedCategory: 'Spatial & Minimal Architecture',
    verifiedSince: 'Verified Dec 2025',
    cryptoProofId: 'priv_ed25519_sara_lin',
    bio: 'Designing spaces that honor natural shadow, timber joints, and breathing room. Sustainable rammed-earth residences between Kyoto and Copenhagen.',
    category: 'Spatial & Minimal Architecture',
    location: 'Kyoto / Copenhagen',
    joinedDate: 'December 2025',
    website: 'saralin.space',
    circleStatus: 'Close Friend',
    isPrivate: false,
    followersList: ['elena_rodriguez', 'marcus_dev', 'oliver_wood', 'luciano'],
    followingList: ['elena_rodriguez', 'oliver_wood', 'luciano'],
    trustCirclesList: ['elena_rodriguez', 'oliver_wood'],
    mediaItems: [
      { id: 'm-sara-1', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 94, comments: 8 },
      { id: 'm-sara-2', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 140, comments: 12 },
      { id: 'm-sara-3', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 78, comments: 6 },
    ],
  },
  oliver_wood: {
    id: 'oliver_wood',
    name: 'Oliver Craft',
    handle: 'oliver_wood',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&auto=format&fit=crop&q=85',
    isVerified: false,
    verifiedCategory: 'Traditional Joinery',
    bio: 'Hand-cut mortise and tenon joinery. Zero screws, zero nails, generational hardwood furniture built to outlive us all.',
    category: 'Traditional Joinery',
    location: 'Portland, OR',
    joinedDate: 'February 2026',
    website: 'olivercraftwood.com',
    circleStatus: 'Public Connection',
    isPrivate: false,
    followersList: ['sara_architecture', 'marcus_dev', 'sam_arch', 'luciano'],
    followingList: ['sara_architecture', 'sam_arch'],
    trustCirclesList: ['sara_architecture'],
    mediaItems: [
      { id: 'm-oliver-1', url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 42, comments: 3 },
      { id: 'm-oliver-2', url: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 65, comments: 7 },
    ],
  },
  sam_arch: {
    id: 'sam_arch',
    name: 'Sam Archer',
    handle: 'sam_arch',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=85',
    coverUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600&auto=format&fit=crop&q=85',
    isVerified: false,
    verifiedCategory: 'Wilderness Guide',
    bio: 'Alpine routes, backcountry skiing, and high altitude photography in the North Cascades. Private circle only.',
    category: 'Wilderness Guide',
    location: 'Cascades, WA',
    joinedDate: 'April 2026',
    website: 'samarcher.guide',
    circleStatus: 'Public Connection',
    isPrivate: true, // DEMONSTRATING REAL PRIVATE ACCOUNT CONTROLS
    followersList: ['oliver_wood', 'marcus_dev', 'luciano'],
    followingList: ['oliver_wood', 'marcus_dev'],
    trustCirclesList: ['oliver_wood'],
    mediaItems: [
      { id: 'm-sam-1', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 38, comments: 2 },
    ],
  },
  jess_film: {
    id: 'jess_film',
    name: 'Jessica Vance',
    handle: 'jess_film',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    coverUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1600&auto=format&fit=crop&q=85',
    isVerified: true,
    verifiedCategory: 'Documentary Filmmaker',
    verifiedSince: 'Verified Jan 2026',
    cryptoProofId: 'priv_ed25519_jess_film',
    bio: 'Independent cinema documenting artisan traditions and human resilience across 18 countries.',
    category: 'Documentary Filmmaker',
    location: 'Brooklyn, NY',
    joinedDate: 'January 2026',
    website: 'jessicavance.com',
    circleStatus: 'Mutual Follower',
    isPrivate: false,
    followersList: ['marcus_dev', 'elena_rodriguez', 'luciano', 'chloe_visuals'],
    followingList: ['marcus_dev', 'elena_rodriguez', 'luciano'],
    trustCirclesList: ['marcus_dev', 'elena_rodriguez'],
    mediaItems: [
      { id: 'm-jess-1', url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 180, comments: 16 },
    ],
  },
  luciano: {
    id: 'usr-luciano',
    name: 'Luciano',
    handle: 'luciano',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
    coverUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
    isVerified: true,
    verifiedCategory: 'Platform Founder',
    verifiedSince: 'Verified 2026',
    cryptoProofId: 'priv_ed25519_luciano_founder',
    bio: 'Architecting Privity: private-first sharing, real circles, no algorithmic games. Building the next generation of authentic human connection.',
    category: 'Platform Founder',
    location: 'San Francisco, CA',
    joinedDate: 'Founder · 2026',
    website: 'privity.app',
    circleStatus: 'You',
    isPrivate: false,
    followersList: ['elena_rodriguez', 'marcus_dev', 'julian_analogue', 'sara_architecture', 'chloe_visuals', 'jess_film', 'sam_arch', 'oliver_wood'],
    followingList: ['elena_rodriguez', 'marcus_dev', 'julian_analogue', 'sara_architecture'],
    trustCirclesList: ['elena_rodriguez', 'marcus_dev', 'sara_architecture'],
    mediaItems: [
      { id: 'm-luciano-1', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 54, comments: 6 },
      { id: 'm-luciano-2', url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 40, comments: 3 },
    ],
  },
};

// ==================== LIVE ENCRYPTED STREAMS MODEL ====================
export type FeedFilterTab = 'live' | 'feed' | 'all' | 'close_friends' | 'followers';
export const FEED_TABS: FeedFilterTab[] = ['live', 'feed', 'all', 'close_friends', 'followers'];

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
  battleInfo: LiveBattleInfo;
  multiGuests: LiveGuestSlot[];
  participants: Array<{ name: string; avatar: string; role: string }>;
  tags: string[];
}

export const INITIAL_LIVE_STREAMS: LiveStreamSession[] = [
  {
    id: 'live-chloe-4',
    creatorHandle: 'chloe_visuals',
    creatorName: 'Chloe Vance',
    creatorAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    isVerified: false,
    category: 'Sound Artist',
    title: 'Modular Synthesizer & Ambient Sound Lab Live',
    description: 'Generative patches on Eurorack, exploring spatial audio fields and analog warmth.',
    viewersCount: 520,
    likesCount: 4891,
    dailyRank: '🎵 Music Spotlight',
    previewUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=900',
    videoStreamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-talking-on-a-video-call-with-her-laptop-42998-large.mp4',
    battleInfo: {
      opponentName: 'Julian Thorne',
      opponentHandle: 'julian_analogue',
      opponentAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
      opponentVideoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=900',
      opponentStreamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-talking-on-a-video-call-42996-large.mp4',
      hostScore: 2150,
      opponentScore: 2407,
      timeLeft: '02:09',
      isMatchActive: true,
      matchTitle: 'Sound vs Light Duel',
    },
    multiGuests: [],
    participants: [],
    tags: ['Ambient', 'Modular', 'SoundDesign'],
  },
  {
    id: 'live-elena-1',
    creatorHandle: 'elena_rodriguez',
    creatorName: 'Elena Rodriguez',
    creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    isVerified: true,
    category: 'System Architect',
    title: 'Live Battle Match · Arena Championship',
    description: 'Real-time interactive live battle! Cheer with gifts and help Elena win the round.',
    viewersCount: 1840,
    likesCount: 14820,
    dailyRank: '🔥 Daily Ranking #2',
    previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900',
    videoStreamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-in-neon-lighting-39878-large.mp4',
    battleInfo: {
      opponentName: 'Marcus Vance',
      opponentHandle: 'marcus_dev',
      opponentAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      opponentVideoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900',
      opponentStreamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-dj-mixing-music-in-a-club-41712-large.mp4',
      coHostName: 'Julian Thorne',
      coHostVideoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=900',
      hostScore: 3840,
      opponentScore: 3260,
      timeLeft: '02:45',
      isMatchActive: true,
      matchTitle: 'LIVE PK Battle · Speed Round',
    },
    multiGuests: [
      { id: 'g1', name: 'Elena R.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', viewers: 'Host', isSpeaking: true, role: 'Host', flag: '👑' },
      { id: 'g2', name: 'Marcus', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', viewers: '2.71K', isSpeaking: false, flag: '💎' },
      { id: 'g3', name: 'Julian', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150', viewers: '840', isSpeaking: false, flag: '⭐' },
      { id: 'g4', name: 'Chloe V.', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', viewers: '445', isSpeaking: true, flag: '✨' },
      { id: 'g5', name: 'Sara Lin', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', viewers: '310', isSpeaking: false, flag: '🔥' },
      { id: 'g6', name: 'Alex M.', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', viewers: '190', isSpeaking: false, flag: '🚀' },
      { id: 'g7', name: 'Linda K.', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', viewers: '95', isSpeaking: false, flag: '🌸' },
      { id: 'g8', name: 'Daniel B.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', viewers: '148', isSpeaking: false, flag: '⚡' },
      { id: 'g9', name: 'Take Seat', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', viewers: 'Open', isMuted: true, role: 'Join' },
    ],
    participants: [
      { name: 'Marcus Vance', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', role: 'Opponent' },
      { name: 'Julian Thorne', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150', role: 'Co-Host' },
      { name: 'Sara Lin', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', role: 'Listener' },
    ],
    tags: ['Battle', 'PKMatch', 'P2P', 'WebRTC'],
  },
  {
    id: 'live-marcus-2',
    creatorHandle: 'marcus_dev',
    creatorName: 'Marcus Vance',
    creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    isVerified: true,
    category: 'Security Lead',
    title: 'Live Ed25519 Cryptographic Proof Auditing & Key Battles',
    description: 'Demonstrating how Privity verifies post identity and prevents sybil spam with zero personal data leakage.',
    viewersCount: 1120,
    likesCount: 9840,
    dailyRank: '🔥 Daily Ranking #4',
    previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900',
    videoStreamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-dj-mixing-music-in-a-club-41712-large.mp4',
    battleInfo: {
      opponentName: 'Elena Rodriguez',
      opponentHandle: 'elena_rodriguez',
      opponentAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      opponentVideoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900',
      opponentStreamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-in-neon-lighting-39878-large.mp4',
      hostScore: 2940,
      opponentScore: 3100,
      timeLeft: '01:50',
      isMatchActive: true,
      matchTitle: 'LIVE PK Battle · Key Challenge',
    },
    multiGuests: [
      { id: 'mg1', name: 'Marcus', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', viewers: 'Host', isSpeaking: true, role: 'Host', flag: '👑' },
      { id: 'mg2', name: 'Elena', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', viewers: '1.8K', isSpeaking: false, flag: '💎' },
      { id: 'mg3', name: 'Sara', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', viewers: '420', isSpeaking: false, flag: '⭐' },
      { id: 'mg4', name: 'Julian', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150', viewers: '380', isSpeaking: false, flag: '✨' },
    ],
    participants: [
      { name: 'Elena Rodriguez', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', role: 'Speaker' },
    ],
    tags: ['Cryptography', 'Ed25519', 'Security'],
  },
  {
    id: 'live-julian-3',
    creatorHandle: 'julian_analogue',
    creatorName: 'Julian Thorne',
    creatorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    isVerified: false,
    category: 'Film Photographer',
    title: 'Tokyo Rain & Neon: 35mm Live Photowalk & Darkroom Notes',
    description: 'Walking through Shinjuku with a Leica M6, sharing live analog grain framing techniques.',
    viewersCount: 632,
    likesCount: 6320,
    dailyRank: '⭐ Spotlight #7',
    previewUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=900',
    videoStreamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-talking-on-a-video-call-42996-large.mp4',
    battleInfo: {
      opponentName: 'Chloe Vance',
      opponentHandle: 'chloe_visuals',
      opponentAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      opponentVideoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900',
      opponentStreamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-talking-on-a-video-call-with-her-laptop-42998-large.mp4',
      hostScore: 1980,
      opponentScore: 1850,
      timeLeft: '03:10',
      isMatchActive: true,
      matchTitle: 'Visuals vs Audio Battle',
    },
    multiGuests: [],
    participants: [
      { name: 'Chloe Vance', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', role: 'Listener' },
    ],
    tags: ['Analog', 'Photography', 'Tokyo'],
  },
];

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

// High-performance image file reader & canvas compressor (fits easily in localStorage)
const compressImageFile = (
  file: File,
  maxDim: number,
  quality: number,
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
}

const INITIAL_DIRECT_MESSAGES: Record<string, DirectChatMessage[]> = {
  elena_rodriguez: [
    {
      id: 'm-elena-1',
      senderHandle: 'elena_rodriguez',
      recipientHandle: 'luciano',
      text: 'Hi Luciano! Loving the new Privity update. The analogue medium format gallery feels so authentic without algorithm clutter.',
      timeAgo: '12m ago',
      timestamp: Date.now() - 720000,
      reactions: { '❤️': 1, '✨': 1 },
      userReactions: { '❤️': ['elena_rodriguez'], '✨': ['elena_rodriguez'] },
    },
    {
      id: 'm-elena-2',
      senderHandle: 'luciano',
      recipientHandle: 'elena_rodriguez',
      text: 'Thanks Elena! We built this network so artists own their audience directly. Thrilled to have you in the close circle.',
      timeAgo: '8m ago',
      timestamp: Date.now() - 480000,
      reactions: { '🔥': 1 },
      userReactions: { '🔥': ['elena_rodriguez'] },
    },
    {
      id: 'm-elena-3',
      senderHandle: 'elena_rodriguez',
      recipientHandle: 'luciano',
      text: 'Here is a preview of the morning light study from my Kyoto studio:',
      mediaUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1000',
      timeAgo: '3m ago',
      timestamp: Date.now() - 180000,
      reactions: { '❤️': 1, '🔒': 1 },
      userReactions: { '❤️': ['elena_rodriguez'], '🔒': ['elena_rodriguez'] },
    },
  ],
  marcus_dev: [
    {
      id: 'm-marcus-1',
      senderHandle: 'marcus_dev',
      recipientHandle: 'luciano',
      text: 'The local-first cryptographic verification proofs are holding strong across all dispatches.',
      timeAgo: '1h ago',
      timestamp: Date.now() - 3600000,
      reactions: { '⚡': 1 },
      userReactions: { '⚡': ['marcus_dev'] },
    },
    {
      id: 'm-marcus-2',
      senderHandle: 'marcus_dev',
      recipientHandle: 'luciano',
      text: 'Quick audio briefing on the zero-knowledge validation benchmark:',
      isVoiceMemo: true,
      voiceDuration: '0:24',
      timeAgo: '42m ago',
      timestamp: Date.now() - 2520000,
      reactions: { '👏': 1 },
      userReactions: { '👏': ['marcus_dev'] },
    },
  ],
  sara_architecture: [
    {
      id: 'm-sara-1',
      senderHandle: 'sara_architecture',
      recipientHandle: 'luciano',
      text: 'The natural daylight study looks fantastic in the new glass lightbox viewer!',
      timeAgo: '2h ago',
      timestamp: Date.now() - 7200000,
      reactions: { '✨': 1 },
      userReactions: { '✨': ['sara_architecture'] },
    },
  ],
  julian_analogue: [
    {
      id: 'm-julian-1',
      senderHandle: 'julian_analogue',
      recipientHandle: 'luciano',
      text: 'Hey Luciano, just uploaded the binaural dawn recording from Big Sur! High dynamic range.',
      timeAgo: '3h ago',
      timestamp: Date.now() - 10800000,
      reactions: { '🔥': 1 },
      userReactions: { '🔥': ['julian_analogue'] },
    },
  ],
};

// Helper to sanitize stored direct messages so legacy glitch counters (e.g. 25, 24) are cleanly normalized
const sanitizeStoredDirectMessages = (raw: Record<string, DirectChatMessage[]>): Record<string, DirectChatMessage[]> => {
  if (!raw || typeof raw !== 'object') return raw;
  const cleanMyHandle = 'luciano';
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
          nextUserReactions[emoji] = [cleanMyHandle];
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
  // Safe localStorage storage helper with quota management
  const safeSaveStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`Storage quota reached for ${key}, trimming payload`, e);
      try {
        if (Array.isArray(data)) {
          localStorage.setItem(key, JSON.stringify(data.slice(0, 15)));
        } else if (typeof data === 'object' && data !== null) {
          const entries = Object.entries(data).filter(([k]) => !k.startsWith('data:'));
          localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries.slice(-25))));
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
  const [activeTab, setActiveTab] = useState<'feed' | 'discover' | 'messages' | 'activity' | 'profile' | 'safety'>(() =>
    readStorage('privity_active_tab_v5', 'feed')
  );
  const [feedFilter, setFeedFilter] = useState<FeedFilterTab>('feed');
  const [liveStreamsList, setLiveStreamsList] = useState<LiveStreamSession[]>(INITIAL_LIVE_STREAMS);
  const [activeLiveIndex, setActiveLiveIndex] = useState(0);
  const [liveLayoutMode, setLiveLayoutMode] = useState<'battle' | '4way'>('battle');
  const [isGiftTrayOpen, setIsGiftTrayOpen] = useState(false);
  const [userSparksBalance, setUserSparksBalance] = useState(2450);
  const [battleScoreHost, setBattleScoreHost] = useState(2150);
  const [battleScoreOpponent, setBattleScoreOpponent] = useState(2407);
  const [battleTimeSeconds, setBattleTimeSeconds] = useState(129);
  const [isBattleMatchActive, setIsBattleMatchActive] = useState(true);
  const [followedCreators, setFollowedCreators] = useState<Record<string, boolean>>({
    chloe_visuals: false,
    julian_analogue: false,
    elena_rodriguez: false,
    marcus_dev: true,
  });
  const [hostLiveLikes, setHostLiveLikes] = useState<Record<string, number>>({
    'live-chloe-4': 4891,
    'live-elena-1': 14820,
    'live-marcus-2': 9840,
    'live-julian-3': 6320,
  });

  // AI Vision & Interactive Video Features
  const [aiLensMode, setAiLensMode] = useState<'cyber' | 'elemental' | 'anime' | 'studio'>('cyber');
  const [isLiveSoundMuted, setIsLiveSoundMuted] = useState(false);
  const [pkComboCount, setPkComboCount] = useState(0);
  const [isGloveClashing, setIsGloveClashing] = useState(false);
  const [screenScoreFloaters, setScreenScoreFloaters] = useState<Array<{ id: number; text: string; x: number; y: number; side: 'host' | 'rival' }>>([]);

  const [activeLiveStream, setActiveLiveStream] = useState<LiveStreamSession | null>(null);
  const [liveChatInput, setLiveChatInput] = useState('');
  const [liveComments, setLiveComments] = useState<Array<{ id: string; user: string; text: string; badge?: string; level?: number; isHost?: boolean; isJoin?: boolean; giftName?: string; giftIcon?: string }>>([
    { id: '1', user: 'Carlos', text: 'became the No. 19 fan in the Fan Club ⭐', isJoin: true },
    { id: '2', user: 'TRIPLE', text: 'pretty clean audio compression 🔥', badge: 'VIP', level: 26 },
    { id: '3', user: 'ELIKS', text: 'Oho where is old Elena?', badge: 'Top', level: 10 },
    { id: '4', user: 'mlChAEL', text: 'joined the live', isJoin: true, level: 4 },
    { id: '5', user: 'marcus_dev', text: 'Keep throwing roses for the speed boost! 🥊', isHost: false, level: 29 },
  ]);
  const [floatingHearts, setFloatingHearts] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; rot: number }>>([]);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  // Top Likers & Contributors Leaderboard Modal State
  const [isLikesLeaderboardOpen, setIsLikesLeaderboardOpen] = useState(false);
  const [likersLeaderboard, setLikersLeaderboard] = useState<Array<{ id: string; name: string; handle: string; avatar: string; likes: number; badge: string; level: number }>>([
    { id: '1', name: 'Luciano', handle: 'luciano', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120', likes: 5840, badge: '🥇 Top Contributor', level: 29 },
    { id: '2', name: 'Carlos', handle: 'carlos_m', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120', likes: 3210, badge: '🥈 Fan Club #19', level: 19 },
    { id: '3', name: 'TRIPLE', handle: 'triple_beat', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120', likes: 2450, badge: '🥉 VIP Supporter', level: 26 },
    { id: '4', name: 'ELIKS', handle: 'eliks_fan', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120', likes: 1980, badge: 'Loyal Fan', level: 10 },
    { id: '5', name: 'mlChAEL', handle: 'michael_wave', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120', likes: 1340, badge: 'Supporter', level: 4 },
  ]);

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
  }>>([
    { id: 'v1', name: 'Carlos Mendez', handle: 'carlos_m', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120', role: 'Fan Club #19 · Top Gifter', level: 19, badge: '⭐ Fan #19' },
    { id: 'v2', name: 'TRIPLE Beat', handle: 'triple_beat', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120', role: 'Sound Producer · Audio Critic', level: 26, badge: '🔥 VIP' },
    { id: 'v3', name: 'Elena Rodriguez', handle: 'elena_rodriguez', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120', isVerified: true, role: 'Verified Creator · Systems Architect', level: 32, badge: '👑 Legend' },
    { id: 'v4', name: 'Marcus Vance', handle: 'marcus_dev', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120', isVerified: true, role: 'Rival Host · Security Lead', level: 29, badge: '🥊 Rival' },
    { id: 'v5', name: 'Julian Thorne', handle: 'julian_analogue', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120', isVerified: false, role: 'Co-Host · Film Photographer', level: 24, badge: '📸 Co-Host' },
    { id: 'v6', name: 'ELIKS', handle: 'eliks_fan', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120', role: 'Loyal Fan · Rose Spammer', level: 10, badge: '🌹 Gifter' },
    { id: 'v7', name: 'Sara Lin', handle: 'sara_lin', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120', isVerified: true, role: 'Visual Designer · Tokyo', level: 18, badge: '✨ Close Friend' },
    { id: 'v8', name: 'mlChAEL', handle: 'michael_wave', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120', role: 'Audiophile · Modular Explorer', level: 4, badge: '👋 Listener' },
    { id: 'v9', name: 'Alex Miller', handle: 'alex_m', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120', role: 'Falcon Rocket Booster', level: 22, badge: '🚀 Booster' },
    { id: 'v10', name: 'Linda Kim', handle: 'linda_k', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120', role: 'Film & Synth Enthusiast', level: 15, badge: '🌸 Supporter' },
    { id: 'v11', name: 'Daniel Brooks', handle: 'daniel_b', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120', role: 'Spatial Audio Researcher', level: 12, badge: '⚡ Regular' },
    { id: 'v12', name: 'Luciano', handle: 'luciano', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120', role: 'Sovereign Pass Genesis · You', level: 30, badge: '🥇 Top #1' },
  ]);

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
    setLiveSlideDirection('down');
    setActiveLiveIndex((prev) => {
      const nextIdx = (prev + 1) % liveStreamsList.length;
      const nextStream = liveStreamsList[nextIdx];
      setBattleScoreHost(nextStream.battleInfo.hostScore);
      setBattleScoreOpponent(nextStream.battleInfo.opponentScore);
      return nextIdx;
    });
    setTimeout(() => setLiveSlideDirection(null), 420);
  }, [liveStreamsList]);

  const handlePrevLiveStream = useCallback(() => {
    setLiveSlideDirection('up');
    setActiveLiveIndex((prev) => {
      const prevIdx = (prev - 1 + liveStreamsList.length) % liveStreamsList.length;
      const prevStream = liveStreamsList[prevIdx];
      setBattleScoreHost(prevStream.battleInfo.hostScore);
      setBattleScoreOpponent(prevStream.battleInfo.opponentScore);
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
      prev.map((item) => (item.handle === 'luciano' ? { ...item, likes: item.likes + 15 } : item))
    );
    handleLiveHeartBurst('#ff4d6d');
    triggerToast('Tapped +15 Likes for Host! ♥');
  };

  // Live Battle Timer Countdown & Dynamic Opponent Simulation
  useEffect(() => {
    if (!isBattleMatchActive) return;
    const interval = setInterval(() => {
      setBattleTimeSeconds((prev) => (prev <= 1 ? 180 : prev - 1));

      // Occasional random opponent battle cheer
      if (Math.random() < 0.28) {
        const delta = Math.floor(Math.random() * 35) + 12;
        setBattleScoreOpponent((prev) => prev + delta);
      }
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
  const [activeChatUser, setActiveChatUser] = useState<UserProfile | null>(null);
  const [chatDraftText, setChatDraftText] = useState('');
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatChannelFilter, setChatChannelFilter] = useState<'all' | 'close_friends' | 'unread'>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [chatMediaAttachment, setChatMediaAttachment] = useState<string | null>(null);
  const [chatMediaType, setChatMediaType] = useState<'photo' | 'video'>('photo');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const recordingTimerRef = React.useRef<any>(null);
  const activeAudioElementRef = React.useRef<HTMLAudioElement | null>(null);

  // Take user all the way to the top of the preserved section upon page refresh / load
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Save active section across refreshes
  useEffect(() => {
    safeSaveStorage('privity_active_tab_v5', activeTab);
  }, [activeTab]);

  // Save photo likes registry
  useEffect(() => {
    safeSaveStorage('privity_photo_likes_v5', photoLikesMap);
  }, [photoLikesMap]);

  // Save direct messages
  useEffect(() => {
    safeSaveStorage('privity_direct_messages_v5', directMessages);
  }, [directMessages]);

  // 1. Persistent Profiles State
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>(() =>
    readStorage('privity_profiles_v5', INITIAL_PROFILES_REGISTRY)
  );

  // 2. Persistent Posts State (sanitizes any auto-synthesized p-media- posts from private clicks)
  const [posts, setPosts] = useState<PostItem[]>(() => {
    const loaded = readStorage<PostItem[]>('privity_posts_v5', SAMPLE_POSTS);
    return Array.isArray(loaded) ? loaded.filter((p) => !p.id.startsWith('p-media-')) : SAMPLE_POSTS;
  });

  // 3. Persistent Following Map
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>(() =>
    readStorage('privity_following_v5', {
      'elena_rodriguez': true,
      'marcus_dev': true,
      'julian_analogue': true,
      'sara_architecture': true,
      'chloe_visuals': false,
      'oliver_wood': false,
      'sam_arch': false,
      'jess_film': false,
    })
  );

  // 4. Persistent Close Friends List
  const [closeFriendsList, setCloseFriendsList] = useState<string[]>(() =>
    readStorage('privity_close_friends_v5', [
      'elena_rodriguez',
      'marcus_dev',
      'sara_architecture',
    ])
  );

  // 5. Persistent Private Account Setting
  const [isPrivateAccount, setIsPrivateAccount] = useState<boolean>(() =>
    readStorage('privity_private_account_v5', false)
  );

  // Auto-sync all changes to localStorage with quota protection
  useEffect(() => {
    safeSaveStorage('privity_profiles_v5', profiles);
  }, [profiles]);

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
    const clean = handle.replace(/^@/, '');
    if (profiles[clean]) {
      return profiles[clean];
    }
    return {
      id: `usr-${clean}`,
      name: defaultName || clean.charAt(0).toUpperCase() + clean.slice(1),
      handle: clean,
      avatar: defaultAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1600',
      isVerified: false,
      bio: 'Privity creator sharing private-first moments and authentic updates.',
      location: 'Global',
      joinedDate: 'Joined 2026',
      circleStatus: 'Public Connection',
      isPrivate: false,
      followersList: ['luciano', 'marcus_dev', 'elena_rodriguez'],
      followingList: ['luciano'],
      trustCirclesList: ['luciano'],
      mediaItems: [],
    };
  };

  const myProfile = getUserProfile('luciano');

  // ========================================================
  // REAL-TIME MULTI-DEVICE SYNCHRONIZATION ENGINE
  // ========================================================
  const SYNC_TOPIC = 'privity_sync_luciano_live';
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

    // 2. Cloud broadcast to all active devices (phones, laptops, tablets)
    try {
      fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((err) => console.warn('Cloud sync push err', err));
    } catch (e) {
      console.warn('Cloud sync err', e);
    }
  };

  // Handler to apply incoming remote sync events
  const applyRemoteSyncEvent = React.useCallback(
    (event: any) => {
      if (!event || event.senderTabId === myTabSessionId) return;

      if (event.eventId) {
        if (processedEventIdsRef.current.has(event.eventId)) return;
        processedEventIdsRef.current.add(event.eventId);
      }

      const cleanMyHandle = (myProfile.handle || 'luciano').replace(/^@/, '');

      switch (event.action) {
        case 'LIVESTREAM_GIFT_EVENT': {
          const { giftEvent, gift } = event;
          if (!giftEvent || !gift) return;

          // Enqueue animation for all watching viewers
          globalGiftQueue.enqueue(giftEvent, gift);

          const pts = (gift.coinCost || 10) * (giftEvent.quantity || 1) * 2;
          setBattleScoreHost((prev) => prev + pts);

          setLiveComments((prev) => [
            ...prev,
            {
              id: giftEvent.id || String(Date.now()),
              user: giftEvent.senderName,
              text: `sent ${gift.name} ${giftEvent.quantity > 1 ? `x${giftEvent.quantity} ` : ''}(+${pts} pts)!`,
              badge: gift.rarity === 'legendary' ? 'Crown VIP' : 'Top Gifter',
              level: 30,
              giftName: gift.name,
              giftIcon: gift.icon,
            },
          ]);
          break;
        }

        case 'LIKE_POST': {
          const { postId, isLiked, likesCount, userHandle } = event;
          setPosts((prev) => {
            const nextPosts = prev.map((p) => {
              if (p.id === postId) {
                const currentLikers = p.likersList || [];
                const updatedLikers = isLiked
                  ? Array.from(new Set([...currentLikers, userHandle || 'luciano']))
                  : currentLikers.filter((h) => h !== (userHandle || 'luciano'));
                return {
                  ...p,
                  isLiked: userHandle === cleanMyHandle ? isLiked : p.isLiked,
                  likesCount:
                    typeof likesCount === 'number'
                      ? likesCount
                      : isLiked
                      ? p.likesCount + 1
                      : Math.max(0, p.likesCount - 1),
                  likersList: updatedLikers,
                };
              }
              return p;
            });
            safeSaveStorage('privity_posts_v5', nextPosts);
            return nextPosts;
          });
          break;
        }

        case 'SAVE_POST': {
          const { postId, isSaved } = event;
          setPosts((prev) => {
            const nextPosts = prev.map((p) => {
              if (p.id === postId) {
                return {
                  ...p,
                  isSaved,
                  savesCount: isSaved ? (p.savesCount || 0) + 1 : Math.max(0, (p.savesCount || 0) - 1),
                };
              }
              return p;
            });
            safeSaveStorage('privity_posts_v5', nextPosts);
            return nextPosts;
          });
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
          if (!post || !post.id) return;
          setPosts((prev) => {
            if (prev.some((p) => p.id === post.id)) return prev;
            const next = [post, ...prev];
            safeSaveStorage('privity_posts_v5', next);
            return next;
          });
          if (post.contentUrl) {
            const author = (post.authorHandle || 'luciano').replace(/^@/, '');
            setProfiles((prev) => {
              const prof = prev[author] || getUserProfile(author);
              const exists = (prof.mediaItems || []).some(
                (m) => m.id === post.id || isSameMedia(m.url, post.contentUrl)
              );
              if (exists) return prev;
              const newMedia: UserMediaItem = {
                id: post.id,
                url: post.contentUrl,
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
          break;
        }

        case 'DELETE_POST': {
          const { postId } = event;
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
          const { postId, comment, parentCommentId } = event;
          if (!postId || !comment || !comment.id) return;
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
                return { ...p, commentsCount: p.commentsCount + 1, comments: updatedComments };
              }
              if (p.comments.some((c) => c.id === comment.id)) return p;
              return {
                ...p,
                commentsCount: p.commentsCount + 1,
                comments: [...p.comments, comment],
              };
            });
            safeSaveStorage('privity_posts_v5', next);
            return next;
          });
          break;
        }

        case 'LIKE_COMMENT': {
          const { postId, commentId, isLiked, likesCount } = event;
          setPosts((prev) => {
            const next = prev.map((p) => {
              if (p.id !== postId) return p;
              return {
                ...p,
                comments: p.comments.map((c) => {
                  if (c.id === commentId) {
                    return {
                      ...c,
                      isLiked,
                      likesCount:
                        typeof likesCount === 'number'
                          ? likesCount
                          : isLiked
                          ? (c.likesCount || 0) + 1
                          : Math.max(0, (c.likesCount || 0) - 1),
                    };
                  }
                  return c;
                }),
              };
            });
            safeSaveStorage('privity_posts_v5', next);
            return next;
          });
          break;
        }

        case 'DELETE_COMMENT': {
          const { postId, commentId, replyId } = event;
          if (!postId || !commentId) return;
          setPosts((prev) => {
            const next = prev.map((p) => {
              if (p.id !== postId) return p;
              if (replyId) {
                return {
                  ...p,
                  commentsCount: Math.max(0, p.commentsCount - 1),
                  comments: p.comments.map((c) =>
                    c.id === commentId
                      ? { ...c, replies: (c.replies || []).filter((r) => r.id !== replyId) }
                      : c
                  ),
                };
              }
              const target = p.comments.find((c) => c.id === commentId);
              const repliesCount = target?.replies?.length || 0;
              return {
                ...p,
                commentsCount: Math.max(0, p.commentsCount - (1 + repliesCount)),
                comments: p.comments.filter((c) => c.id !== commentId),
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
          const targetKey =
            recipientHandle === cleanMyHandle
              ? (senderHandle || message.senderHandle || 'marcus_dev').replace(/^@/, '')
              : recipientHandle.replace(/^@/, '');
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
          const { recipientHandle, messageId } = event;
          const clean = (recipientHandle || '').replace(/^@/, '');
          if (!clean || !messageId) return;
          setDirectMessages((prev) => {
            const thread = prev[clean] || [];
            const updated = {
              ...prev,
              [clean]: thread.filter((m) => m.id !== messageId),
            };
            safeSaveStorage('privity_direct_messages_v5', updated);
            return updated;
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

        case 'TOGGLE_FOLLOW': {
          const { targetHandle, targetId, isFollowing } = event;
          if (!targetHandle) return;
          const clean = targetHandle.replace(/^@/, '');
          setFollowingMap((prev) => {
            const next: Record<string, boolean> = {
              ...prev,
              [clean]: isFollowing,
              [clean.toLowerCase()]: isFollowing,
            };
            if (targetId) next[targetId] = isFollowing;
            safeSaveStorage('privity_following_v5', next);
            return next;
          });
          break;
        }

        case 'TOGGLE_CLOSE_FRIENDS': {
          const { handle, isCloseFriend } = event;
          if (!handle) return;
          const clean = handle.replace(/^@/, '');
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
          const { handle } = event;
          if (!handle) return;
          const clean = handle.replace(/^@/, '');
          setProfiles((prev) => {
            const myProf = prev['luciano'];
            if (!myProf) return prev;
            const nextProfs = {
              ...prev,
              luciano: {
                ...myProf,
                followersList: (myProf.followersList || []).filter(
                  (h) => h.toLowerCase() !== clean.toLowerCase()
                ),
              },
            };
            safeSaveStorage('privity_profiles_v5', nextProfs);
            return nextProfs;
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
          const { profile } = event;
          if (!profile || !profile.handle) return;
          const clean = profile.handle.replace(/^@/, '');
          setProfiles((prev) => {
            const next = {
              ...prev,
              [clean]: { ...prev[clean], ...profile },
            };
            safeSaveStorage('privity_profiles_v5', next);
            return next;
          });
          break;
        }

        default:
          break;
      }
    },
    [myTabSessionId, myProfile.handle]
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
    let reconnectTimeout: any = null;

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
            quickCatchUp();
          }, 2500);
        };
      } catch (e) {
        console.warn('SSE subscription failed', e);
      }
    };

    connectSSE();

    // 4. Same-device multi-tab BroadcastChannel listener
    if (localSyncBus) {
      localSyncBus.onmessage = (e) => {
        if (e.data) {
          applyRemoteSyncEvent(e.data);
        }
      };
    }

    // 5. 3-second heartbeat poll to ensure guaranteed sync even if mobile OS sleeps SSE
    const pollInterval = setInterval(() => {
      quickCatchUp();
      if (!es || es.readyState === EventSource.CLOSED) {
        connectSSE();
      }
    }, 3000);

    // 6. On window visibility / focus (e.g. user unlocks phone or switches back to tab)
    const handleWake = () => {
      if (document.visibilityState === 'visible') {
        quickCatchUp();
        if (!es || es.readyState === EventSource.CLOSED) {
          connectSSE();
        }
      }
    };
    window.addEventListener('visibilitychange', handleWake);
    window.addEventListener('focus', handleWake);
    window.addEventListener('online', fullCatchUp);

    return () => {
      clearInterval(pollInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      es?.close();
      window.removeEventListener('visibilitychange', handleWake);
      window.removeEventListener('focus', handleWake);
      window.removeEventListener('online', fullCatchUp);
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

    const cleanHandle = editForm.handle.trim().replace(/^@/, '') || 'luciano';
    const updated: UserProfile = {
      ...myProfile,
      name: editForm.name.trim(),
      handle: cleanHandle,
      bio: editForm.bio.trim(),
      avatar: editForm.avatar || myProfile.avatar,
      coverUrl: editForm.coverUrl || myProfile.coverUrl,
      location: editForm.location.trim() || 'San Francisco, CA',
      website: editForm.website.trim() || 'privity.app',
      category: editForm.category.trim() || myProfile.category,
      verifiedCategory: editForm.category.trim() || myProfile.verifiedCategory,
    };

    setProfiles((prev) => {
      const next = {
        ...prev,
        luciano: updated,
        ...(cleanHandle !== 'luciano' ? { [cleanHandle]: updated } : {}),
      };
      try {
        localStorage.setItem('privity_profiles_v5', JSON.stringify(next));
      } catch (err) {
        console.warn(err);
      }
      return next;
    });

    // Synchronize posts, comments, and replies authored by user in real time
    setPosts((prev) =>
      prev.map((p) => {
        const isPostAuthor =
          p.authorId === 'usr-luciano' ||
          p.authorHandle === 'luciano' ||
          p.authorHandle === myProfile.handle;

        const updatedComments = p.comments.map((c) => {
          const isCommentAuthor = c.authorHandle === 'luciano' || c.authorHandle === myProfile.handle;
          const updatedReplies = (c.replies || []).map((r) => {
            const isReplyAuthor = r.authorHandle === 'luciano' || r.authorHandle === myProfile.handle;
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

    if (viewedUserHandle === 'luciano' || viewedUserHandle === myProfile.handle) {
      setViewedUserHandle(cleanHandle);
    }

    setIsEditProfileOpen(false);
    triggerToast('Profile updated');
    broadcastSyncEvent({
      action: 'UPDATE_PROFILE',
      profile: updated,
    });
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
          let nextLikers = [...(p.likersList || [])];
          if (nextLiked) {
            if (!nextLikers.includes('luciano')) nextLikers = ['luciano', ...nextLikers];
          } else {
            nextLikers = nextLikers.filter((h) => h !== 'luciano');
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
    const targetPost = posts.find((p) => p.id === postId);
    const targetPhotoUrl = targetPost?.contentUrl || targetPost?.thumbnailUrl;

    // 1. Remove from feed posts
    setPosts((prev) => {
      const nextPosts = prev.filter((p) => p.id !== postId);
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    // 2. Remove corresponding visual from Media & Studio
    if (targetPhotoUrl) {
      setProfiles((prevProfs) => {
        let changed = false;
        const nextProfs = { ...prevProfs };
        for (const [h, prof] of Object.entries(nextProfs)) {
          if (prof.mediaItems?.some((m) => isSameMedia(m.url, targetPhotoUrl))) {
            changed = true;
            nextProfs[h] = {
              ...prof,
              mediaItems: prof.mediaItems.filter((m) => !isSameMedia(m.url, targetPhotoUrl)),
            };
          }
        }
        if (changed) {
          safeSaveStorage('privity_profiles_v5', nextProfs);
        }
        return nextProfs;
      });
    }

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
  const [composerPrivacy, setComposerPrivacy] = useState<PostPrivacy>('followers');
  const [composerPhotoUrl, setComposerPhotoUrl] = useState<string | null>(null);

  // Modal Composer State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hostLiveCameraStream, setHostLiveCameraStream] = useState<MediaStream | null>(null);
  const [isHostBroadcasting, setIsHostBroadcasting] = useState<boolean>(false);
  const [modalCaption, setModalCaption] = useState('');
  const [modalTags, setModalTags] = useState('');
  const [modalPrivacy, setModalPrivacy] = useState<PostPrivacy>('close_friends');
  const [modalPhoto, setModalPhoto] = useState<string | null>(null);

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

      // 4. Construct GiftEvent
      const giftEvent: GiftEvent = {
        id: `evt_gift_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        livestreamId: currentStream.id,
        senderId: (myProfile.handle || 'luciano').replace(/^@/, ''),
        senderName: myProfile.name,
        senderAvatar: myProfile.avatar,
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
          level: 30,
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
      viewersCount: 1,
      likesCount: 1,
      dailyRank: '🔥 Genesis Host',
      previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900',
      battleInfo: {
        opponentName: 'Marcus Vance',
        opponentHandle: 'marcus_dev',
        opponentAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        opponentVideoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900',
        hostScore: 100,
        opponentScore: 50,
        timeLeft: '03:00',
        isMatchActive: true,
        matchTitle: 'Genesis PK Match',
      },
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
  const [viewedUserHandle, setViewedUserHandle] = useState<string>(() =>
    readStorage('privity_viewed_handle_v5', 'luciano')
  );
  const [profileHistory, setProfileHistory] = useState<string[]>([]);
  const [profileSubTab, setProfileSubTab] = useState<'dispatches' | 'media' | 'liked' | 'saved' | 'replies'>('dispatches');

  useEffect(() => {
    safeSaveStorage('privity_viewed_handle_v5', viewedUserHandle);
  }, [viewedUserHandle]);

  // Private Account Shield Modal State
  const [privateLockModal, setPrivateLockModal] = useState<{ handle: string; name: string } | null>(null);

  const navigateToProfile = (handle: string) => {
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
    const clean = handleOrId.replace(/^@/, '').toLowerCase();
    return !!(
      followingMap[clean] ||
      followingMap[`usr-${clean}`] ||
      followingMap[handleOrId] ||
      (myProfile.followingList || []).some((h) => h.toLowerCase() === clean)
    );
  };

  const toggleFollow = (handleOrId: string, name?: string) => {
    const clean = handleOrId.replace(/^@/, '').replace(/^usr-/, '');
    const targetProf = profiles[clean] || Object.values(profiles).find((p) => p.handle.toLowerCase() === clean.toLowerCase() || p.id === handleOrId);
    const resolvedHandle = targetProf ? targetProf.handle.replace(/^@/, '') : clean;
    const resolvedId = targetProf ? targetProf.id : `usr-${clean}`;

    const current = isUserFollowed(resolvedHandle);
    const next = !current;
    const myHandle = myProfile.handle || 'luciano';

    setFollowingMap((prev) => {
      const nextMap = {
        ...prev,
        [clean]: next,
        [clean.toLowerCase()]: next,
        [resolvedHandle]: next,
        [resolvedHandle.toLowerCase()]: next,
        [resolvedId]: next,
      };
      safeSaveStorage('privity_following_v5', nextMap);
      return nextMap;
    });

    setProfiles((prev) => {
      const target = prev[resolvedHandle] || prev[clean] || getUserProfile(resolvedHandle);
      let targetFollowers = [...(target.followersList || [])];
      if (next) {
        if (!targetFollowers.some((h) => h.toLowerCase() === 'luciano')) targetFollowers.push('luciano');
        if (myHandle !== 'luciano' && !targetFollowers.some((h) => h.toLowerCase() === myHandle.toLowerCase())) {
          targetFollowers.push(myHandle);
        }
      } else {
        targetFollowers = targetFollowers.filter(
          (h) => h.toLowerCase() !== 'luciano' && h.toLowerCase() !== myHandle.toLowerCase()
        );
      }
      const nextTarget = { ...target, followersList: targetFollowers };

      const myProf = prev['luciano'] || prev[myHandle] || getUserProfile('luciano');
      let myFollowing = [...(myProf.followingList || [])];
      if (next) {
        if (!myFollowing.some((h) => h.toLowerCase() === resolvedHandle.toLowerCase())) {
          myFollowing.push(resolvedHandle);
        }
      } else {
        myFollowing = myFollowing.filter(
          (h) => h.toLowerCase() !== resolvedHandle.toLowerCase() && h.toLowerCase() !== clean.toLowerCase()
        );
      }
      const nextMyProf = { ...myProf, followingList: myFollowing };

      const nextProfiles = {
        ...prev,
        [resolvedHandle]: nextTarget,
        [clean]: nextTarget,
        luciano: nextMyProf,
        ...(myHandle !== 'luciano' ? { [myHandle]: nextMyProf } : {}),
      };
      safeSaveStorage('privity_profiles_v5', nextProfiles);
      return nextProfiles;
    });

    broadcastSyncEvent({
      action: 'TOGGLE_FOLLOW',
      targetHandle: resolvedHandle,
      targetId: resolvedId,
      isFollowing: next,
    });

    triggerToast(next ? `Now following ${name || '@' + resolvedHandle}` : `Unfollowed ${name || '@' + resolvedHandle}`);
  };

  const handleRemoveFollower = (followerHandle: string) => {
    const clean = followerHandle.replace(/^@/, '');
    const myHandle = myProfile.handle || 'luciano';

    setProfiles((prev) => {
      const myProf = prev['luciano'] || prev[myHandle] || getUserProfile('luciano');
      const updatedFollowers = (myProf.followersList || []).filter((h) => h !== clean);
      const nextMyProf = { ...myProf, followersList: updatedFollowers };

      const targetProf = prev[clean] || getUserProfile(clean);
      const targetFollowing = (targetProf.followingList || []).filter((h) => h !== 'luciano' && h !== myHandle);
      const nextTargetProf = { ...targetProf, followingList: targetFollowing };

      const nextProfiles = {
        ...prev,
        luciano: nextMyProf,
        ...(myHandle !== 'luciano' ? { [myHandle]: nextMyProf } : {}),
        [clean]: nextTargetProf,
      };
      try {
        localStorage.setItem('privity_profiles_v5', JSON.stringify(nextProfiles));
      } catch (err) {
        console.warn(err);
      }
      return nextProfiles;
    });

    broadcastSyncEvent({
      action: 'REMOVE_FOLLOWER',
      handle: clean,
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
      const myProf = prev['luciano'];
      if (!myProf) return prev;
      return {
        ...prev,
        luciano: {
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
    const isOwn = cleanTarget === 'luciano' || cleanTarget === myProfile.handle;
    const effectiveIsPrivate = isOwn ? isPrivateAccount : !!profile.isPrivate;
    const isFollowing = !!followingMap[cleanTarget] || isOwn;

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

  // Notifications & Follow Requests (Real-Time & LocalStorage Persistent)
  const [followRequests, setFollowRequests] = useState<Array<{ id: string; name: string; handle: string; avatar: string }>>(() =>
    readStorage('privity_follow_requests_v5', [
      { id: 'fr-1', name: 'Sam Archer', handle: 'sam_arch', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120' },
      { id: 'fr-2', name: 'Jessica Vance', handle: 'jess_film', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120' },
    ])
  );

  useEffect(() => {
    safeSaveStorage('privity_follow_requests_v5', followRequests);
  }, [followRequests]);

  // Real-Time Request Approval
  const handleApproveRequest = (requestId: string, targetHandle: string, targetName: string) => {
    const cleanHandle = targetHandle.replace(/^@/, '');
    const myHandle = (myProfile.handle || 'luciano').replace(/^@/, '');

    // 1. Remove from pending follow requests immediately
    setFollowRequests((prev) => {
      const next = prev.filter((x) => x.id !== requestId && x.handle !== cleanHandle);
      safeSaveStorage('privity_follow_requests_v5', next);
      return next;
    });

    // 2. Add target to my followers list & add me to target's following list in real time
    setProfiles((prev) => {
      const nextProfs = { ...prev };

      // Update my profile followers
      const myProf = nextProfs[myHandle] || nextProfs['luciano'] || getUserProfile(myHandle);
      const myFollowers = Array.from(new Set([...(myProf.followersList || []), cleanHandle]));
      nextProfs[myHandle] = {
        ...myProf,
        followersList: myFollowers,
      };
      if (myHandle !== 'luciano') {
        nextProfs['luciano'] = {
          ...myProf,
          followersList: myFollowers,
        };
      }

      // Update target profile following
      const targetProf = nextProfs[cleanHandle] || getUserProfile(cleanHandle);
      const targetFollowing = Array.from(new Set([...(targetProf.followingList || []), myHandle, 'luciano']));
      nextProfs[cleanHandle] = {
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
  const [reports, setReports] = useState<any[]>([
    {
      id: 'rep-991',
      targetAuthor: 'crypto_drop_bot',
      targetType: 'post',
      snippet: 'Claim 5000 USDT free airdrop now at t.me/fake_claim',
      reason: 'Spam / Scam',
      status: 'open',
    },
  ]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'aud-401',
      actorId: 'usr-luciano',
      actorUsername: 'admin_luciano',
      action: 'remove_content',
      targetType: 'post',
      targetId: 'rep-980',
      reason: 'Malicious external link confirmed',
      timestamp: '2026-09-28T14:30:00.000Z',
    },
  ]);
  const [reportingPost, setReportingPost] = useState<PostItem | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [actionType, setActionType] = useState<ModerationActionType>('remove_content');
  const [actionReason, setActionReason] = useState('');

  const triggerToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const handleTogglePrivateAccount = (val: boolean) => {
    setIsPrivateAccount(val);
    setUserSettings((prev) => ({ ...prev, isPrivateAccount: val }));
    setProfiles((prev) => {
      const me = prev['luciano'] || getUserProfile('luciano');
      return {
        ...prev,
        luciano: { ...me, isPrivate: val },
        ...(me.handle !== 'luciano' ? { [me.handle]: { ...me, isPrivate: val } } : {}),
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
      following: Object.keys(followingMap).filter((k) => followingMap[k]),
      dispatches: posts.filter((p) => p.authorHandle === myProfile.handle || p.authorId === 'usr-luciano'),
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

  const handleResetData = () => {
    if (window.confirm('Reset all demo data and profile modifications to factory defaults?')) {
      localStorage.removeItem('privity_profiles_v5');
      localStorage.removeItem('privity_posts_v5');
      localStorage.removeItem('privity_following_v5');
      localStorage.removeItem('privity_close_friends_v5');
      localStorage.removeItem('privity_private_account_v5');
      localStorage.removeItem('privity_user_settings_v5');
      localStorage.removeItem('privity_follow_requests_v5');
      localStorage.removeItem('privity_photo_likes_v5');
      localStorage.removeItem('privity_direct_messages_v5');
      localStorage.removeItem('privity_active_tab_v5');
      localStorage.removeItem('privity_viewed_handle_v5');
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

    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const photoUrl = targetPost.contentUrl || targetPost.thumbnailUrl;
    const baseKey = photoUrl ? extractMediaBaseKey(photoUrl) : '';
    const photoRecord = photoUrl ? (photoLikesMap[photoUrl] || (baseKey ? photoLikesMap[baseKey] : undefined)) : undefined;
    const matchingMedia = photoUrl ? Object.values(profiles).flatMap((p) => p.mediaItems || []).find((m) => isSameMedia(m.url, photoUrl)) : undefined;

    const isCurrentlyLiked = photoRecord !== undefined
      ? photoRecord.isLiked
      : (matchingMedia !== undefined ? matchingMedia.isLiked : !!targetPost.isLiked);
    if (fromDoubleTap && isCurrentlyLiked) return;

    const nextLiked = fromDoubleTap ? true : !isCurrentlyLiked;
    let nextLikers = [...(targetPost.likersList || [])];
    if (nextLiked) {
      if (!nextLikers.includes('luciano')) nextLikers = ['luciano', ...nextLikers];
    } else {
      nextLikers = nextLikers.filter((h) => h !== 'luciano');
    }
    const currentCount = photoRecord !== undefined
      ? photoRecord.count
      : (matchingMedia !== undefined ? matchingMedia.likes : targetPost.likesCount);
    const nextCount = nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

    // 1. Update photoLikesMap immediately
    if (photoUrl) {
      setPhotoLikesMap((prev) => {
        const next = {
          ...prev,
          ...(baseKey ? { [baseKey]: { isLiked: nextLiked, count: nextCount } } : {}),
          ...(!photoUrl.startsWith('data:') ? { [photoUrl]: { isLiked: nextLiked, count: nextCount } } : {}),
        };
        safeSaveStorage('privity_photo_likes_v5', next);
        return next;
      });

      // 2. Update profiles immediately
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
                  ? { ...m, isLiked: nextLiked, likes: nextCount }
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

    // 3. Update posts immediately
    setPosts((prevPosts) => {
      const nextPosts = prevPosts.map((p) => {
        if (p.id === postId || (photoUrl && (isSameMedia(p.contentUrl, photoUrl) || isSameMedia(p.thumbnailUrl, photoUrl)))) {
          return {
            ...p,
            isLiked: nextLiked,
            likersList: nextLikers,
            likesCount: nextCount,
          };
        }
        return p;
      });
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    broadcastSyncEvent({
      action: 'LIKE_POST',
      postId,
      isLiked: nextLiked,
      likesCount: nextCount,
      userHandle: 'luciano',
    });

    triggerToast(nextLiked ? 'Liked dispatch' : 'Unliked dispatch');
  };

  // Bookmark / Save
  const handleSave = (postId: string) => {
    let nextSavedState = false;
    setPosts((prev) => {
      const nextPosts = prev.map((p) => {
        if (p.id === postId) {
          const next = !p.isSaved;
          nextSavedState = next;
          triggerToast(next ? 'Saved to private collection' : 'Removed from saved');
          return {
            ...p,
            isSaved: next,
            savesCount: next ? p.savesCount + 1 : Math.max(0, p.savesCount - 1),
          };
        }
        return p;
      });
      safeSaveStorage('privity_posts_v5', nextPosts);
      return nextPosts;
    });

    broadcastSyncEvent({
      action: 'SAVE_POST',
      postId,
      isSaved: nextSavedState,
    });
  };

  // Share
  const handleShare = (postId: string) => {
    const url = `https://privity.app/p/${postId}`;
    navigator.clipboard?.writeText(url);
    triggerToast(`External share link copied: ${url}`);
  };

  // Add Comment with 1-level reply nesting & cross-profile media item synchronization
  const handleAddComment = (postId: string, textOverride?: string) => {
    const text = (textOverride !== undefined ? textOverride : commentInputs[postId])?.trim();
    if (!text) return;

    const targetPost = posts.find((p) => p.id === postId);
    const targetPhotoUrl = targetPost?.contentUrl || targetPost?.thumbnailUrl;

    let createdItem: any = null;
    let parentCommentId: string | undefined = undefined;

    setPosts((prev) => {
      const nextPosts = prev.map((p) => {
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
            return { ...p, commentsCount: p.commentsCount + 1, comments: updated };
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
            return { ...p, commentsCount: p.commentsCount + 1, comments: [...p.comments, comment] };
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
      broadcastSyncEvent({
        action: 'ADD_COMMENT',
        postId,
        comment: createdItem,
        parentCommentId,
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
        if (replyId) {
          const updated = p.comments.map((c) => {
            if (c.id !== commentId) return c;
            return {
              ...c,
              replies: (c.replies || []).filter((r) => r.id !== replyId),
            };
          });
          return {
            ...p,
            commentsCount: Math.max(0, p.commentsCount - 1),
            comments: updated,
          };
        } else {
          const targetComment = p.comments.find((c) => c.id === commentId);
          const repliesTotal = targetComment?.replies?.length || 0;
          const updated = p.comments.filter((c) => c.id !== commentId);
          return {
            ...p,
            commentsCount: Math.max(0, p.commentsCount - (1 + repliesTotal)),
            comments: updated,
          };
        }
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
    setDirectMessages((prev) => {
      const thread = prev[cleanRecipient] || [];
      const updatedThread = thread.filter((m) => m.id !== messageId);
      const updated = {
        ...prev,
        [cleanRecipient]: updatedThread,
      };
      safeSaveStorage('privity_direct_messages_v5', updated);
      return updated;
    });
    broadcastSyncEvent({
      action: 'DELETE_DM',
      recipientHandle: cleanRecipient,
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
      };
      safeSaveStorage('privity_direct_messages_v5', updated);
      return updated;
    });
    broadcastSyncEvent({
      action: 'CLEAR_CHAT',
      recipientHandle: cleanRecipient,
    });
    triggerToast(`Encrypted channel with @${cleanRecipient} cleared`);
  };

  // Organic Conversational Response Generator (Eliminates robotic repetitive replies)
  const getOrganicContactReply = (senderName: string, text: string, isMedia?: boolean, isVoice?: boolean): { text: string; reactionEmoji?: string } => {
    const trimmed = text.trim();

    if (isVoice) {
      const voiceReplies = [
        { text: 'Just listened to your voice memo through my studio monitors — the spatial room tone and acoustic presence are incredible! 🎙️✨', reactionEmoji: '🔥' },
        { text: 'Such a great update! Love hearing your voice in real time without compression loss. Totally agree with you.', reactionEmoji: '❤️' },
        { text: 'Acoustics sound crystal clear on visionOS. I am taking notes on what you mentioned and sketching ideas now!', reactionEmoji: '✨' },
      ];
      return voiceReplies[Math.floor(Math.random() * voiceReplies.length)];
    }

    if (isMedia) {
      if (trimmed) {
        return {
          text: `"${trimmed}" — Absolutely love this visual! The composition, lighting, and textures are stunning. Thank you for sharing! 📸✨`,
          reactionEmoji: '❤️',
        };
      }
      const mediaReplies = [
        { text: 'The tonal range and natural light diffusion here are sublime! Did you capture this with medium format? 📸', reactionEmoji: '❤️' },
        { text: 'Incredible visual composition. The atmosphere feels so serene and authentic without synthetic filters.', reactionEmoji: '✨' },
        { text: 'Love this perspective! Reminds me of our Kyoto light studies. Saving this to my private inspiration board.', reactionEmoji: '🔥' },
      ];
      return mediaReplies[Math.floor(Math.random() * mediaReplies.length)];
    }

    // Pure emoji detection
    const emojiOnlyRegex = /^(\p{Emoji}|\s)+$/u;
    if (emojiOnlyRegex.test(trimmed) && trimmed.length <= 8) {
      if (trimmed.includes('👏')) {
        return { text: `Appreciate the applause and support, ${senderName}! Let's keep building this sacred creative space. 🤝✨`, reactionEmoji: '👏' };
      }
      if (trimmed.includes('❤️')) {
        return { text: 'Much love! Always grateful to have you in this close circle. Hope your day is flowing beautifully. 💫', reactionEmoji: '❤️' };
      }
      if (trimmed.includes('🔥')) {
        return { text: 'Match that energy! We are really pushing boundaries with this direct network architecture. ⚡', reactionEmoji: '🔥' };
      }
      return { text: 'Loving the vibe! Sending good energy back from the northern studio. 🌿✨', reactionEmoji: '✨' };
    }

    // Contextual text-based organic responses
    const lower = trimmed.toLowerCase();
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return { text: `Hey ${senderName}! Great to see you online. I am working on the new analogue light study right now. How is everything flowing on your end?`, reactionEmoji: '✨' };
    }
    if (lower.includes('photo') || lower.includes('gallery') || lower.includes('art') || lower.includes('camera')) {
      return { text: 'Photography without algorithmic interference feels so liberating. You can actually breathe and appreciate the craft again.', reactionEmoji: '❤️' };
    }
    if (lower.includes('privity') || lower.includes('privacy') || lower.includes('encrypt') || lower.includes('security')) {
      return { text: 'The zero-knowledge cryptographic signature gives so much peace of mind. Knowing no surveillance bots are scanning our conversation is priceless. 🔒', reactionEmoji: '🔒' };
    }

    const organicPool = [
      { text: 'Totally agree. When technology stays out of the way and serves real humans, the connection feels completely genuine.', reactionEmoji: '❤️' },
      { text: 'That resonates deeply. I was just discussing this exact thought in the studio earlier. Let us make sure we preserve this vision.', reactionEmoji: '✨' },
      { text: 'Spot on! Privity feels like the early days of authentic creative community, but with next-generation spatial elegance.', reactionEmoji: '🔥' },
      { text: `Thanks for sharing that thought, ${senderName}! Always look forward to your dispatches in this circle.`, reactionEmoji: '👏' },
    ];
    return organicPool[Math.floor(Math.random() * organicPool.length)];
  };

  // Real-Time Emoji Reaction Toggle (1 reaction per emoji per user, clicking again deletes it)
  const handleReactToMessage = (recipientHandle: string, messageId: string, emoji: string) => {
    const cleanRecipient = recipientHandle.replace(/^@/, '');
    const cleanMyHandle = (myProfile.handle || 'luciano').replace(/^@/, '');

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
    const cleanMyHandle = (myProfile.handle || 'luciano').replace(/^@/, '');
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

      setIsRecordingVoice(false);
      setRecordingSeconds(0);
      triggerToast('Binaural voice memo dispatched with zero-knowledge encryption');

      setIsRecipientTyping(true);
      setTimeout(() => {
        const organicReply = getOrganicContactReply('Luciano', '', false, true);
        const replyMsg: DirectChatMessage = {
          id: `msg-reply-${Date.now()}`,
          senderHandle: cleanRecipient,
          recipientHandle: cleanMyHandle,
          text: organicReply.text,
          timeAgo: 'Just now',
          timestamp: Date.now(),
          reactions: organicReply.reactionEmoji ? { [organicReply.reactionEmoji]: 1 } : { '🔥': 1 },
          userReactions: organicReply.reactionEmoji ? { [organicReply.reactionEmoji]: [cleanRecipient] } : { '🔥': [cleanRecipient] },
        };
        setDirectMessages((prev) => {
          const thread = prev[cleanRecipient] || [];
          const updated = {
            ...prev,
            [cleanRecipient]: [...thread, replyMsg],
          };
          safeSaveStorage('privity_direct_messages_v5', updated);
          return updated;
        });
        setIsRecipientTyping(false);
        triggerToast(`New encrypted reply from @${cleanRecipient}`);
      }, 1500);
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

  // Stage visual photo or cinema video into the composer dock
  const handleStagePresetMedia = (mediaUrl: string, type: 'photo' | 'video' = 'photo') => {
    setChatMediaAttachment(mediaUrl);
    setChatMediaType(type);
    triggerToast(`${type === 'video' ? 'Cinema video' : 'Studio visual'} staged · Add text or press Send`);
  };

  // Real-Time Direct Message Dispatcher
  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeChatUser) return;
    if (!chatDraftText.trim() && !chatMediaAttachment) return;

    const recipientHandle = activeChatUser.handle.replace(/^@/, '');
    const cleanMyHandle = (myProfile.handle || 'luciano').replace(/^@/, '');
    const textToSend = chatDraftText.trim();
    const isMedia = !!chatMediaAttachment;
    const mediaTypeToSend = isMedia ? chatMediaType : undefined;
    const attachedMediaUrl = chatMediaAttachment;

    const newMsg: DirectChatMessage = {
      id: `msg-${Date.now()}`,
      senderHandle: cleanMyHandle,
      recipientHandle: recipientHandle,
      text: textToSend,
      mediaUrl: attachedMediaUrl || undefined,
      mediaType: mediaTypeToSend,
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

    // Trigger organic, conversational response from recipient in real time
    setIsRecipientTyping(true);
    setTimeout(() => {
      const organicReply = getOrganicContactReply(activeChatUser.name, textToSend, isMedia, false);
      const replyMsg: DirectChatMessage = {
        id: `msg-reply-${Date.now()}`,
        senderHandle: recipientHandle,
        recipientHandle: cleanMyHandle,
        text: organicReply.text,
        timeAgo: 'Just now',
        timestamp: Date.now(),
        reactions: organicReply.reactionEmoji ? { [organicReply.reactionEmoji]: 1 } : { '❤️': 1 },
        userReactions: organicReply.reactionEmoji ? { [organicReply.reactionEmoji]: [recipientHandle] } : { '❤️': [recipientHandle] },
      };
      setDirectMessages((prev) => {
        const existingThread = prev[recipientHandle] || [];
        const updated = {
          ...prev,
          [recipientHandle]: [...existingThread, replyMsg],
        };
        safeSaveStorage('privity_direct_messages_v5', updated);
        return updated;
      });
      broadcastSyncEvent({
        action: 'SEND_DM',
        recipientHandle: cleanMyHandle,
        senderHandle: recipientHandle,
        message: replyMsg,
      });
      setIsRecipientTyping(false);
      triggerToast(`New encrypted message from @${recipientHandle}`);
    }, 1300);
  };

  // Like or unlike comment
  const handleLikeComment = (postId: string, commentId: string) => {
    let nextLikedState = false;
    let nextLikesTotal = 0;
    setPosts((prev) => {
      const nextPosts = prev.map((p) => {
        if (p.id !== postId) return p;
        const updated = p.comments.map((c) => {
          if (c.id !== commentId) return c;
          const nextLiked = !c.isLiked;
          nextLikedState = nextLiked;
          nextLikesTotal = nextLiked ? (c.likesCount || 0) + 1 : Math.max(0, (c.likesCount || 0) - 1);
          return {
            ...c,
            isLiked: nextLiked,
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
      isLiked: nextLikedState,
      likesCount: nextLikesTotal,
    });
  };

  // Publish instantly from inline composer without requiring refresh
  const handleInlinePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerCaption.trim()) return;

    const extractedTags = (composerCaption.match(/#[\w-]+/g) || []).map((t) => t.slice(1));
    const finalTags = extractedTags.length > 0 ? extractedTags : ['privity', 'authentic'];

    const newPost: PostItem = {
      id: `p-${Date.now()}`,
      authorId: 'usr-luciano',
      authorName: myProfile.name,
      authorHandle: myProfile.handle,
      authorAvatar: myProfile.avatar,
      isVerified: myProfile.isVerified,
      verifiedCategory: myProfile.verifiedCategory,
      verifiedSince: myProfile.verifiedSince,
      cryptoProofId: myProfile.cryptoProofId,
      type: composerPhotoUrl ? 'image' : 'text',
      contentUrl: composerPhotoUrl || undefined,
      thumbnailUrl: composerPhotoUrl || undefined,
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
        const prof = prev['luciano'] || prev[myProfile.handle] || myProfile;
        const newMedia: UserMediaItem = {
          id: `m-luciano-${Date.now()}`,
          url: photoUrl,
          type: 'image',
          likes: 0,
          comments: 0,
          isLiked: false,
        };
        const nextProfiles = {
          ...prev,
          luciano: {
            ...prof,
            mediaItems: [newMedia, ...(prof.mediaItems || [])],
          },
          ...(myProfile.handle !== 'luciano'
            ? {
                [myProfile.handle]: {
                  ...prof,
                  mediaItems: [newMedia, ...(prof.mediaItems || [])],
                },
              }
            : {}),
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

    const tagsArr = modalTags
      .split(' ')
      .map((t) => t.replace('#', '').trim())
      .filter(Boolean);
    const captionTags = (modalCaption.match(/#[\w-]+/g) || []).map((t) => t.slice(1));
    const combinedTags = Array.from(new Set([...tagsArr, ...captionTags]));
    const finalTags = combinedTags.length > 0 ? combinedTags : ['privity'];

    const newPost: PostItem = {
      id: `p-${Date.now()}`,
      authorId: 'usr-luciano',
      authorName: myProfile.name,
      authorHandle: myProfile.handle,
      authorAvatar: myProfile.avatar,
      isVerified: myProfile.isVerified,
      verifiedCategory: myProfile.verifiedCategory,
      verifiedSince: myProfile.verifiedSince,
      cryptoProofId: myProfile.cryptoProofId,
      type: modalPhoto ? 'image' : 'text',
      contentUrl: modalPhoto || undefined,
      thumbnailUrl: modalPhoto || undefined,
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
        const prof = prev['luciano'] || prev[myProfile.handle] || myProfile;
        const newMedia: UserMediaItem = {
          id: `m-luciano-${Date.now()}`,
          url: photoUrl,
          type: 'image',
          likes: 0,
          comments: 0,
          isLiked: false,
        };
        const nextProfiles = {
          ...prev,
          luciano: {
            ...prof,
            mediaItems: [newMedia, ...(prof.mediaItems || [])],
          },
          ...(myProfile.handle !== 'luciano'
            ? {
                [myProfile.handle]: {
                  ...prof,
                  mediaItems: [newMedia, ...(prof.mediaItems || [])],
                },
              }
            : {}),
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
    if (activeTab !== 'profile' || viewedUserHandle !== 'luciano') {
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
    mediaType,
    tags,
    privacy,
    soundName,
  }: {
    caption: string;
    mediaUrl?: string | null;
    mediaType?: 'photo' | 'video';
    tags: string;
    privacy: 'close_friends' | 'followers' | 'public';
    soundName?: string;
  }) => {
    const rawTags = tags
      .split(' ')
      .map((t) => t.replace('#', '').trim())
      .filter(Boolean);
    const captionTags = (caption.match(/#[\w-]+/g) || []).map((t) => t.slice(1));
    const combinedTags = Array.from(new Set([...rawTags, ...captionTags]));
    const finalTags = combinedTags.length > 0 ? combinedTags : ['privity', 'moments'];

    const newPost: PostItem = {
      id: `p-${Date.now()}`,
      authorId: 'usr-luciano',
      authorName: myProfile.name,
      authorHandle: myProfile.handle,
      authorAvatar: myProfile.avatar,
      isVerified: myProfile.isVerified,
      verifiedCategory: myProfile.verifiedCategory,
      verifiedSince: myProfile.verifiedSince,
      cryptoProofId: myProfile.cryptoProofId,
      type: mediaType === 'video' ? 'video' : mediaUrl ? 'image' : 'text',
      contentUrl: mediaUrl || undefined,
      thumbnailUrl: mediaType === 'video' ? undefined : (mediaUrl || undefined),
      videoUrl: mediaType === 'video' ? (mediaUrl || undefined) : undefined,
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
      timeAgo: 'Just now',
      comments: [],
    };

    if (mediaUrl) {
      const newMedia: UserMediaItem = {
        id: `m-luciano-${Date.now()}`,
        url: mediaUrl,
        type: mediaType === 'video' ? 'video' : 'image',
        likes: 0,
        comments: 0,
        isLiked: false,
      };

      setProfiles((prev) => {
        const prof = prev['luciano'] || prev[myProfile.handle] || myProfile;
        const nextProfiles = {
          ...prev,
          luciano: {
            ...prof,
            mediaItems: [newMedia, ...(prof.mediaItems || [])],
          },
          ...(myProfile.handle !== 'luciano'
            ? {
                [myProfile.handle]: {
                  ...prof,
                  mediaItems: [newMedia, ...(prof.mediaItems || [])],
                },
              }
            : {}),
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

    if (activeTab !== 'profile' || viewedUserHandle !== 'luciano') {
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

  const handleCameraGoLive = ({
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
    setHostLiveCameraStream(cameraStream || null);
    setIsHostBroadcasting(true);
    const userStream: LiveStreamSession = {
      id: `live-user-${Date.now()}`,
      creatorHandle: myProfile.handle,
      creatorName: myProfile.name,
      creatorAvatar: myProfile.avatar,
      isVerified: myProfile.isVerified,
      category: category || 'Visionary Host',
      title: title || 'Live Broadcast · Sovereign Node',
      description: `Streaming live directly to authorized circles. ${goal}`,
      viewersCount: 1,
      likesCount: 1,
      dailyRank: '🔥 Genesis Host',
      previewUrl: myProfile.coverUrl || myProfile.avatar,
      battleInfo: {
        opponentName: 'Marcus Vance',
        opponentHandle: 'marcus_dev',
        opponentAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        opponentVideoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900',
        hostScore: 100,
        opponentScore: 50,
        timeLeft: '03:00',
        isMatchActive: true,
        matchTitle: 'Genesis PK Match',
      },
      multiGuests: [],
      participants: [{ name: myProfile.name, avatar: myProfile.avatar, role: 'Host' }],
      tags: ['Live', 'P2P', 'Privity'],
    };

    setLiveStreamsList((prev) => [userStream, ...prev]);
    setActiveLiveIndex(0);
    setActiveLiveStream(userStream);
    setIsCameraOpen(false);
    triggerToast(`Broadcast started: ${userStream.title}`);
  };


  // Dynamic trending topics refreshed based on active reverse-chronological stream
  const dynamicTrendingTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of posts) {
      for (const t of p.tags || []) {
        const clean = t.toLowerCase().replace(/^#/, '');
        counts[clean] = (counts[clean] || 0) + 1;
      }
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({
        tag,
        count: `${count * 120 + 80} dispatches`,
      }));
    return sorted.length > 0
      ? sorted
      : [
          { tag: 'mindful', count: '1.4k dispatches' },
          { tag: 'photography', count: '890 dispatches' },
          { tag: 'privacyfirst', count: '620 dispatches' },
          { tag: 'slowlife', count: '410 dispatches' },
        ];
  }, [posts]);

  return (
    <div className={`app-container ${activeTab === 'feed' && feedFilter === 'live' ? 'live-mode-active' : ''}`}>
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
      {activeTab === 'messages' && activeChatUser ? (
        <header className="mobile-top-header mobile-chat-top-header">
          <div className="mobile-chat-header-left">
            <button
              type="button"
              className="btn-chat-mobile-back"
              onClick={() => setActiveChatUser(null)}
              title="Back to all channels"
            >
              <IconArrowLeft size={18} />
            </button>
            <div
              className="mobile-chat-partner-info"
              onClick={() => navigateToProfile(activeChatUser.handle)}
              title={`View @${activeChatUser.handle}'s profile`}
            >
              <div className="mobile-chat-avatar-wrap">
                <img src={activeChatUser.avatar} alt={activeChatUser.name} className="mobile-chat-avatar" />
                <span className="online-presence-dot" />
              </div>
              <div className="mobile-chat-text-col">
                <div className="mobile-chat-name">
                  <span>{activeChatUser.name}</span>
                  {activeChatUser.isVerified && (
                    <VerifiedBadge authorName={activeChatUser.name} category={activeChatUser.verifiedCategory} />
                  )}
                </div>
                <div className="mobile-chat-status">
                  <span className="status-indicator-dot" />
                  <span>{isRecipientTyping ? 'Typing in real-time...' : 'Active Now · 🔒 Encrypted'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mobile-chat-header-right">
            <button
              type="button"
              className="mobile-header-icon-btn"
              onClick={() => navigateToProfile(activeChatUser.handle)}
              title="View creator profile"
            >
              <IconUser size={18} />
            </button>
            <button
              type="button"
              className="mobile-header-icon-btn"
              style={{ color: '#f87171' }}
              onClick={() => handleClearConversation(activeChatUser.handle.replace(/^@/, ''))}
              title="Clear channel conversation"
            >
              <IconTrash size={16} />
            </button>
          </div>
        </header>
      ) : activeTab === 'feed' && feedFilter === 'live' ? null : (
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
                feedFilter === 'followers' ? 'Followers' : 'All Circles'
              )}
              {activeTab === 'discover' && 'Discover'}
              {activeTab === 'activity' && 'Activity'}
              {activeTab === 'messages' && 'Direct Messages'}
              {activeTab === 'profile' && `@${viewedUserHandle}`}
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
              if (!activeChatUser) {
                setActiveChatUser(getUserProfile('elena_rodriguez'));
              }
            }}
          >
            <span className="nav-icon-wrap"><IconChat size={21} /></span>
            <span>Messages</span>
            <span className="nav-badge-pill" style={{ background: 'var(--brand-primary)' }}>Live</span>
          </button>

          <button
            className={`nav-link-btn ${activeTab === 'profile' && viewedUserHandle === 'luciano' ? 'active' : ''}`}
            onClick={() => navigateToProfile('luciano')}
          >
            <span className="nav-icon-wrap"><IconUser size={21} /></span>
            <span>Profile</span>
          </button>

          <button
            className={`nav-link-btn ${activeTab === 'safety' ? 'active' : ''}`}
            onClick={() => setActiveTab('safety')}
          >
            <span className="nav-icon-wrap"><IconShield size={21} /></span>
            <span>Safety & Reports</span>
          </button>
        </nav>

        <button className="btn-compose-prime" onClick={() => setIsCameraOpen(true)}>
          <IconPlus size={18} />
          <span>New Dispatch</span>
        </button>

        <div
          className="user-identity-card"
          onClick={() => navigateToProfile('luciano')}
          title="Click to view profile"
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={myProfile.avatar}
              alt={myProfile.name}
              className="user-avatar-mini"
            />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {myProfile.name}
                <VerifiedBadge authorName={myProfile.name} category={myProfile.verifiedCategory} since={myProfile.verifiedSince} proofId={myProfile.cryptoProofId} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{myProfile.handle}</div>
            </div>
          </div>
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
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. CENTER FEED COLUMN                                    */}
      {/* ======================================================== */}
      <main className={`feed-column ${activeTab === 'messages' ? 'messages-expanded-view' : ''}`}>
        {/* --- VIEW 1: HOME FEED --- */}
        {activeTab === 'feed' && (
          <div
            className="feed-swipe-container"
            onTouchStart={handleFeedTouchStart}
            onTouchEnd={handleFeedTouchEnd}
            onPointerDown={handleFeedPointerDown}
            onPointerUp={handleFeedPointerUp}
          >
            {feedFilter !== 'live' && (
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
                </div>

                {/* Feed Audience Tabs: 1st Live, 2nd Feed, 3rd All Circles, 4th Close Friends, 5th Followers Only */}
                <div className="audience-tabs-bar" role="tablist" aria-label="Feed channels">
                  <button
                    id="tab-feed-live"
                    type="button"
                    role="tab"
                    aria-selected={false}
                    className="audience-tab-btn live"
                    onClick={() => handleSelectFeedTab('live')}
                  >
                    <span className="live-tab-radar">
                      <span className="live-radar-ping"></span>
                      <span className="live-radar-core"></span>
                    </span>
                    <span>Live</span>
                    <span className="live-badge-count">{liveStreamsList.length}</span>
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

            {/* LIVE BROADCASTS 100% FAITHFUL LIVEME STREAM ARENA & HOT CATALOG */}
            {feedFilter === 'live' ? (
              <LiveMeStreamArena
                onClose={() => setFeedFilter('feed')}
                currentUser={{
                  name: myProfile.name,
                  handle: myProfile.handle,
                  avatar: myProfile.avatar,
                }}
                userCoins={userSparksBalance}
                onCoinsChange={(delta) => setUserSparksBalance((prev) => Math.max(0, prev + delta))}
                showToast={triggerToast}
              />
            ) : (
              <>

            {/* Circles & Stories Rail */}
            <div className="circles-story-rail">
              <div className="circle-unit" onClick={() => navigateToProfile('elena_rodriguez')} title="View Elena's Profile">
                <div className="circle-halo-ring cf">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                    alt="Elena"
                    className="circle-user-img"
                  />
                </div>
                <span className="circle-tag-name">Elena R.</span>
              </div>

              <div className="circle-unit" onClick={() => navigateToProfile('marcus_dev')} title="View Marcus's Profile">
                <div className="circle-halo-ring followers">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
                    alt="Marcus"
                    className="circle-user-img"
                  />
                </div>
                <span className="circle-tag-name">Marcus</span>
              </div>

              <div className="circle-unit" onClick={() => navigateToProfile('julian_analogue')} title="View Julian's Profile">
                <div className="circle-halo-ring cf">
                  <img
                    src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150"
                    alt="Julian"
                    className="circle-user-img"
                  />
                </div>
                <span className="circle-tag-name">Julian</span>
              </div>

              <div className="circle-unit" onClick={() => navigateToProfile('chloe_visuals')} title="View Chloe's Profile">
                <div className="circle-halo-ring public">
                  <img
                    src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150"
                    alt="Chloe"
                    className="circle-user-img"
                  />
                </div>
                <span className="circle-tag-name">Chloe</span>
              </div>

              <div className="circle-unit" onClick={() => setIsCameraOpen(true)}>
                <div className="circle-halo-ring add-circle">
                  <div className="circle-add-icon"><IconPlus size={20} /></div>
                </div>
                <span className="circle-tag-name">New Circle</span>
              </div>
            </div>

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
                    <img src={composerPhotoUrl} alt="Attached Preview" />
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

                    <label className="btn-media-toggle" style={{ cursor: 'pointer' }} title="Attach photo from your device">
                      <IconPhoto size={16} />
                      <span>Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            compressImageFile(file, 960, 0.72, (dataUrl) => {
                              setComposerPhotoUrl(dataUrl);
                              triggerToast('Photo attached to dispatch');
                            });
                          }
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
              {posts
                .filter((p) => feedFilter === 'feed' || feedFilter === 'all' || p.privacy === feedFilter)
                .filter((p) => {
                  if (!activeTagFilter) return true;
                  return p.tags && p.tags.map((t) => t.toLowerCase()).includes(activeTagFilter.toLowerCase());
                })
                .map((post) => (
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
                            @{post.authorHandle}
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
                      {post.type === 'video' && (post.videoUrl || post.contentUrl || post.thumbnailUrl) && (
                        <div className="post-visual-stage">
                          {post.videoUrl || (post.contentUrl && (post.contentUrl.startsWith('data:video') || post.contentUrl.endsWith('.mp4') || post.contentUrl.endsWith('.webm') || post.contentUrl.startsWith('blob:'))) ? (
                            <video
                              src={post.videoUrl || post.contentUrl}
                              controls
                              playsInline
                              preload="metadata"
                              poster={post.thumbnailUrl}
                              style={{ width: '100%', maxHeight: '520px', borderRadius: '16px', background: '#000', objectFit: 'contain' }}
                            />
                          ) : (
                            <div onClick={() => setLightboxUrl(post.thumbnailUrl || post.contentUrl || null)}>
                              <img
                                src={post.thumbnailUrl || post.contentUrl}
                                alt="Video Thumbnail"
                                loading="lazy"
                              />
                              <div className="video-status-pill">4K • 60 FPS • 0:48</div>
                            </div>
                          )}
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
                        const postMediaUrl = post.contentUrl || post.thumbnailUrl;
                        const postBaseKey = postMediaUrl ? extractMediaBaseKey(postMediaUrl) : '';
                        const photoRecord = postMediaUrl ? (photoLikesMap[postMediaUrl] || (postBaseKey ? photoLikesMap[postBaseKey] : undefined)) : undefined;
                        const matchingMedia = postMediaUrl ? Object.values(profiles).flatMap((p) => p.mediaItems || []).find((m) => isSameMedia(m.url, postMediaUrl)) : undefined;

                        const effectiveLiked = photoRecord !== undefined
                          ? photoRecord.isLiked
                          : (matchingMedia !== undefined ? matchingMedia.isLiked : !!post.isLiked);

                        const effectiveLikesCount = photoRecord !== undefined
                          ? photoRecord.count
                          : (matchingMedia !== undefined ? matchingMedia.likes : post.likesCount);

                        const effectiveLikers = effectiveLiked
                          ? ((post.likersList || []).includes('luciano') ? (post.likersList || []) : ['luciano', ...(post.likersList || [])])
                          : (post.likersList || []).filter((h) => h !== 'luciano');

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
                                className={`btn-post-action ${post.isSaved ? 'saved' : ''}`}
                                onClick={() => handleSave(post.id)}
                                title="Save"
                              >
                                <IconBookmark size={18} filled={post.isSaved} color={post.isSaved ? 'var(--cf-emerald)' : 'currentColor'} />
                              </button>

                              {/* Options / Report Menu */}
                              <button
                                className="btn-post-action"
                                onClick={() => {
                                  const isOwn = post.authorHandle === myProfile.handle || post.authorId === 'usr-luciano';
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
                                    comment.authorHandle === 'luciano' ||
                                    post.authorHandle === myProfile.handle ||
                                    post.authorId === 'usr-luciano') && (
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
                                      reply.authorHandle === 'luciano' ||
                                      post.authorHandle === myProfile.handle ||
                                      post.authorId === 'usr-luciano') && (
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
                ))}

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

            {/* Curated Real Hashtag Topics */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Curated Community Hashtags
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { name: 'photography', count: 4 },
                  { name: 'architecture', count: 3 },
                  { name: 'privacy', count: 3 },
                  { name: 'analogue', count: 2 },
                  { name: 'soundscape', count: 1 },
                  { name: 'cinematography', count: 2 },
                  { name: 'kyoto', count: 2 },
                  { name: 'tokyo', count: 1 },
                  { name: 'alpinism', count: 1 },
                ].map((item) => (
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

            <div className="glass-panel-card" style={{ marginBottom: '24px' }}>
              <div className="panel-title-text">
                {discoverSearch ? 'Search Results' : 'Featured Verified Creators'}
              </div>
              {Object.values(profiles)
                .filter((p) => {
                  if (!discoverSearch) return true;
                  const q = discoverSearch.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(q) ||
                    p.handle.toLowerCase().includes(q) ||
                    (p.category && p.category.toLowerCase().includes(q)) ||
                    p.bio.toLowerCase().includes(q)
                  );
                })
                .map((u) => {
                  const isF = !!followingMap[u.handle];
                  const isSelf = u.handle === 'luciano';
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
                })}
            </div>
          </div>
        )}

        {/* --- VIEW 3: SPATIAL DIRECT MESSAGING SUITE (VISIONOS SUITE) --- */}
        {activeTab === 'messages' && (() => {
          // 1. Gather all conversation partner handles
          const allPartnerHandles = Array.from(
            new Set([
              ...Object.keys(directMessages),
              'elena_rodriguez',
              'marcus_dev',
              'sara_architecture',
              'julian_analogue',
            ])
          );

          // 2. Filter channels based on search and active channel filter
          const filteredChannels = allPartnerHandles.filter((handle) => {
            const user = getUserProfile(handle);
            const thread = directMessages[handle] || [];
            const lastMsg = thread[thread.length - 1];

            // Tab filter
            if (chatChannelFilter === 'close_friends' && !closeFriendsList.includes(handle)) {
              return false;
            }
            if (chatChannelFilter === 'unread' && thread.length === 0) {
              return false;
            }

            // Search query
            if (!chatSearchQuery.trim()) return true;
            const q = chatSearchQuery.toLowerCase();
            const matchesName = user.name.toLowerCase().includes(q);
            const matchesHandle = user.handle.toLowerCase().includes(q);
            const matchesLastMsg = lastMsg && lastMsg.text.toLowerCase().includes(q);
            return matchesName || matchesHandle || matchesLastMsg;
          });

          // Active chat partner resolution
          const currentRecipient = activeChatUser || getUserProfile(filteredChannels[0] || 'elena_rodriguez');
          const cleanRecipientHandle = currentRecipient.handle.replace(/^@/, '');
          const currentThread = directMessages[cleanRecipientHandle] || [];
          const cleanMyHandle = (myProfile.handle || 'luciano').replace(/^@/, '');
          const isPartnerInCloseFriends = closeFriendsList.includes(cleanRecipientHandle);

          return (
            <div className={`spatial-messages-container ${activeChatUser ? 'has-active-chat' : 'no-active-chat'}`}>
              {/* LEFT PANE: CONVERSATION CHANNELS ROSTER */}
              <div className="messages-roster-pane">
                <div className="messages-roster-header">
                  <div className="messages-roster-title-row">
                    <div className="messages-roster-title">
                      <IconChat size={20} color="var(--brand-cyan)" />
                      <span>Direct Channels</span>
                    </div>
                    <span className="messages-secure-badge">
                      <span className="live-green-orb" style={{ width: '6px', height: '6px' }} />
                      P2P Synced
                    </span>
                  </div>

                  {/* Search Bar */}
                  <div className="messages-search-bar">
                    <IconSearch size={14} color="var(--text-muted)" />
                    <input
                      type="text"
                      placeholder="Filter conversations..."
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                    />
                    {chatSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setChatSearchQuery('')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                      >
                        <IconX size={13} />
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="messages-filter-pills">
                    <button
                      type="button"
                      className={`messages-filter-pill ${chatChannelFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setChatChannelFilter('all')}
                    >
                      All Channels ({allPartnerHandles.length})
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
                </div>

                {/* Roster Channels List */}
                <div className="messages-roster-list">
                  {filteredChannels.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No conversations found matching "{chatSearchQuery}"
                    </div>
                  ) : (
                    filteredChannels.map((handle) => {
                      const user = getUserProfile(handle);
                      const isSelected = cleanRecipientHandle === handle;
                      const thread = directMessages[handle] || [];
                      const lastMsg = thread[thread.length - 1];
                      const isCF = closeFriendsList.includes(handle);

                      let snippet = 'Encrypted peer channel ready';
                      if (lastMsg) {
                        const isMine = lastMsg.senderHandle === cleanMyHandle || lastMsg.senderHandle === 'luciano';
                        const prefix = isMine ? 'You: ' : '';
                        if (lastMsg.isVoiceMemo) {
                          snippet = `${prefix}🎙️ Voice memo (${lastMsg.voiceDuration || '0:18'})`;
                        } else if (lastMsg.mediaUrl) {
                          snippet = `${prefix}📸 Visual dispatch`;
                        } else {
                          snippet = `${prefix}${lastMsg.text}`;
                        }
                      }

                      return (
                        <div
                          key={handle}
                          className={`channel-card-item ${isSelected ? 'active' : ''}`}
                          onClick={() => {
                            setActiveChatUser(user);
                            setChatMediaAttachment(null);
                          }}
                        >
                          <div className="channel-avatar-wrapper">
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="channel-avatar-img"
                              style={{ borderColor: isCF ? 'var(--cf-emerald)' : undefined }}
                            />
                            <span className="online-presence-dot" />
                          </div>
                          <div className="channel-info-col">
                            <div className="channel-name-row">
                              <span className="channel-creator-name">
                                {user.name}
                                {user.isVerified && <VerifiedBadge authorName={user.name} category={user.verifiedCategory} />}
                              </span>
                              <span className="channel-timestamp">
                                {lastMsg ? lastMsg.timeAgo : 'Active'}
                              </span>
                            </div>
                            <div className="channel-snippet-row">
                              <span className="channel-last-text">{snippet}</span>
                              {isCF && (
                                <span title="Close Friends Circle">
                                  <IconStarCloseFriends size={11} color="var(--cf-emerald)" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT PANE: ACTIVE THREAD WORKSPACE */}
              <div className="messages-active-thread-pane">
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

                    <div
                      className="messages-thread-user-meta"
                      onClick={() => navigateToProfile(currentRecipient.handle)}
                      title={`View @${currentRecipient.handle}'s profile`}
                    >
                      <div className="messages-thread-avatar-wrap">
                        <img
                          src={currentRecipient.avatar}
                          alt={currentRecipient.name}
                          className="messages-thread-avatar"
                          style={{ borderColor: isPartnerInCloseFriends ? 'var(--cf-emerald)' : undefined }}
                        />
                        <span className="online-presence-dot" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="messages-thread-name">
                        <span>{currentRecipient.name}</span>
                        {currentRecipient.isVerified && (
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
                              fontSize: '11px',
                              background: 'var(--cf-glass)',
                              border: '1px solid var(--cf-border)',
                              color: 'var(--cf-emerald)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <IconStarCloseFriends size={11} color="var(--cf-emerald)" />
                            Circle Member
                          </span>
                        )}
                      </div>
                      <div className="messages-thread-status">
                        <span className="status-indicator-dot" />
                        <span>
                          {isRecipientTyping
                            ? `@${cleanRecipientHandle} is typing in real time...`
                            : `End-to-End Encrypted · Ed25519 Verified · Real-Time`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="messages-thread-tools">
                    <button
                      type="button"
                      className="btn-glass-back"
                      style={{ padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => navigateToProfile(currentRecipient.handle)}
                      title="Inspect full creator portfolio"
                    >
                      <IconUser size={13} />
                      <span>Profile</span>
                    </button>
                    <button
                      type="button"
                      className="btn-glass-back"
                      style={{
                        padding: '7px 12px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'rgba(248, 113, 113, 0.9)',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                      }}
                      onClick={() => handleClearConversation(cleanRecipientHandle)}
                      title="Clear messages in this channel"
                    >
                      <IconTrash size={13} />
                      <span>Clear Chat</span>
                    </button>
                  </div>
                </div>

                {/* Messages Stream */}
                <div className="messages-thread-stream">
                  {/* Session banner */}
                  <div className="messages-session-banner">
                    <IconLock size={12} color="var(--cf-emerald)" />
                    <span>Privity Zero-Knowledge Chamber · Sovereign Local Encrypted Channel</span>
                  </div>

                  {currentThread.length === 0 ? (
                    <div className="messages-empty-selection">
                      <div style={{ fontSize: '38px', marginBottom: '14px' }}>🔐</div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                        Start a Private Dispatch with @{cleanRecipientHandle}
                      </div>
                      <p style={{ maxWidth: '380px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                        All messages are signed with your client-side cryptographic keys and delivered directly in real time. Send a thought, photo, or binaural audio note below!
                      </p>
                    </div>
                  ) : (
                    currentThread.map((msg) => {
                      const isSent = msg.senderHandle === cleanMyHandle || msg.senderHandle === 'luciano';

                      return (
                        <div
                          key={msg.id}
                          className={`spatial-bubble-wrapper ${isSent ? 'sent' : 'received'}`}
                        >
                          {/* Floating Hover Action Pill (Delete, React, Copy) */}
                          <div className="message-hover-actions">
                            {/* Quick Emoji Reactions */}
                            {['❤️', '🔥', '👏', '⚡', '🔒'].map((emoji) => {
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
                                    <span>{playingVoiceId === msg.id ? '▶ Playing Audio...' : `Binaural Audio · ${msg.voiceDuration || '0:18'}`}</span>
                                    {msg.audioUrl && (
                                      <span style={{ fontSize: '9px', background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '1px 5px', borderRadius: '4px' }}>
                                        Recorded Mic
                                      </span>
                                    )}
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
                                        title="Click to view in encrypted private lightbox"
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
                            {isSent && <span style={{ color: 'var(--brand-cyan)' }}>✓✓</span>}
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
                      <span>@{cleanRecipientHandle} is typing in real time...</span>
                    </div>
                  )}
                </div>

                {/* Composer Dock */}
                <form className="messages-composer-dock" onSubmit={handleSendMessage}>
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
                            <div className="composer-staged-badge">🎥 Video</div>
                          </>
                        ) : (
                          <>
                            <img
                              src={chatMediaAttachment}
                              alt="Attachment preview"
                              className="composer-staged-thumb"
                            />
                            <div className="composer-staged-badge">📸 Photo</div>
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
                          {chatMediaType === 'video' ? 'Private Video Encrypted & Ready' : 'Private Visual Encrypted & Ready'}
                        </span>
                        <span className="composer-staged-hint">
                          Never published publicly · Visible only to this encrypted thread
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Quick Action Tools Bar */}
                  <div className="composer-quick-bar">
                    <div className="composer-attachments-group">
                      {/* Photo Upload */}
                      <label className="composer-tool-btn" title="Attach photo from device">
                        <IconPhoto size={14} color="var(--brand-cyan)" />
                        <span>Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              compressImageFile(file, 800, 0.70, (dataUrl) => {
                                setChatMediaAttachment(dataUrl);
                                setChatMediaType('photo');
                                triggerToast('Private photo staged · Never published publicly');
                              });
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>

                      {/* Video Upload */}
                      <label className="composer-tool-btn" title="Attach video from device">
                        <IconVideo size={14} color="#f59e0b" />
                        <span>Video</span>
                        <input
                          type="file"
                          accept="video/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const videoUrl = URL.createObjectURL(file);
                              setChatMediaAttachment(videoUrl);
                              setChatMediaType('video');
                              triggerToast('Private video staged · Never published publicly');
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>

                      {/* Voice Memo */}
                      <button
                        type="button"
                        className={`composer-tool-btn ${isRecordingVoice ? 'recording-active' : ''}`}
                        onClick={isRecordingVoice ? handleCancelVoiceRecording : handleStartVoiceRecording}
                        title={isRecordingVoice ? 'Cancel recording' : 'Record spatial voice memo with microphone'}
                      >
                        <IconMic size={14} color={isRecordingVoice ? '#ef4444' : 'var(--cf-emerald)'} />
                        <span>{isRecordingVoice ? 'Cancel Mic' : 'Voice Memo'}</span>
                      </button>

                      {/* Studio Presets (Distinct Private Photos) */}
                      <button
                        type="button"
                        className="composer-tool-btn"
                        onClick={() => {
                          const presets = [
                            'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1000',
                            'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000',
                            'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1000',
                            'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1000',
                          ];
                          const randomPreset = presets[Math.floor(Math.random() * presets.length)];
                          handleStagePresetMedia(randomPreset, 'photo');
                        }}
                        title="Attach studio photo"
                      >
                        <span>📸 Studio Photo</span>
                      </button>

                      <button
                        type="button"
                        className="composer-tool-btn"
                        onClick={() => {
                          const videoPresets = [
                            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
                          ];
                          const randomPreset = videoPresets[Math.floor(Math.random() * videoPresets.length)];
                          handleStagePresetMedia(randomPreset, 'video');
                        }}
                        title="Attach cinema video"
                      >
                        <span>🎥 Cinema Video</span>
                      </button>
                    </div>

                    {/* Quick Emojis */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {['✨', '🔥', '❤️', '👏', '🌿', '🔒'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="composer-tool-btn"
                          style={{ padding: '4px 8px', fontSize: '13px' }}
                          onClick={() => setChatDraftText((prev) => prev + emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

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
                      <input
                        type="text"
                        className="composer-text-input"
                        placeholder={
                          chatMediaAttachment
                            ? `Add encrypted note to this ${chatMediaType}... (Press Enter to Send)`
                            : `Type encrypted dispatch to @${cleanRecipientHandle}... (Press Enter to Send)`
                        }
                        value={chatDraftText}
                        onChange={(e) => setChatDraftText(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="composer-send-btn"
                        disabled={!chatDraftText.trim() && !chatMediaAttachment}
                        style={{ opacity: chatDraftText.trim() || chatMediaAttachment ? 1 : 0.5 }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <IconSend size={15} />
                          <span>Send</span>
                        </span>
                      </button>
                    </div>
                  )}
                </form>
              </div>
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

            <div className="glass-panel-card">
              <div className="panel-title-text">Recent Interactions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '14px' }}>
                  <IconHeart size={20} color="var(--heart-rose)" filled />
                  <div>
                    <strong
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => navigateToProfile('elena_rodriguez')}
                    >
                      Elena Rodriguez
                    </strong>{' '}
                    liked your post in your <strong>Close Friends</strong> circle.
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>24m ago</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '14px' }}>
                  <IconChat size={20} color="var(--brand)" />
                  <div>
                    <strong
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => navigateToProfile('marcus_dev')}
                    >
                      Marcus Vance
                    </strong>{' '}
                    replied to your discussion on privacy architecture.
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1h ago</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 4: DYNAMIC APPLE VISIONOS PROFILE --- */}
        {activeTab === 'profile' && (() => {
          const profile = getUserProfile(viewedUserHandle);
          const isOwnProfile =
            profile.handle === 'luciano' ||
            profile.handle === myProfile.handle ||
            viewedUserHandle === 'luciano' ||
            viewedUserHandle === myProfile.handle;
          const isFollowingThisUser = !!followingMap[profile.handle] || !!followingMap[profile.id];
          const isInCloseFriends = closeFriendsList.includes(profile.handle);
          const userDispatches = posts.filter(
            (p) =>
              p.authorHandle.toLowerCase() === profile.handle.toLowerCase() ||
              (isOwnProfile &&
                (p.authorId === 'usr-luciano' ||
                  p.authorHandle.toLowerCase() === 'luciano' ||
                  p.authorHandle.toLowerCase() === myProfile.handle.toLowerCase()))
          );

          const userLikedPosts = posts.filter((p) => {
            if (isOwnProfile) {
              return (
                p.isLiked ||
                (p.likersList || []).some(
                  (h) =>
                    h.toLowerCase() === 'luciano' ||
                    h.toLowerCase() === myProfile.handle.toLowerCase()
                )
              );
            }
            return (p.likersList || []).some(
              (h) => h.toLowerCase() === profile.handle.toLowerCase()
            );
          });

          const userSavedPosts = posts.filter((p) => p.isSaved);

          const userRepliesPosts = posts.filter((p) => {
            const checkAuthor = (handle: string) => {
              if (isOwnProfile) {
                return (
                  handle.toLowerCase() === 'luciano' ||
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

          return (
            <div className="profile-screen-container">
              {/* Sticky Frosted Header */}
              <div className="profile-top-glass-nav">
                <button className="btn-glass-back" onClick={handleProfileBack}>
                  <IconArrowLeft size={16} />
                  <span>
                    {profileHistory.length > 0
                      ? `Back to @${profileHistory[profileHistory.length - 1]}`
                      : 'Back to Feed'}
                  </span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px' }}>
                    {profile.name}
                  </span>
                  {profile.isVerified && (
                    <VerifiedBadge
                      authorName={profile.name}
                      category={profile.verifiedCategory}
                      since={profile.verifiedSince}
                      proofId={profile.cryptoProofId}
                    />
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn-glass-back"
                    style={{ padding: '6px 12px' }}
                    onClick={() => {
                      navigator.clipboard?.writeText(`https://privity.app/@${profile.handle}`);
                      triggerToast(`Profile link copied: @${profile.handle}`);
                    }}
                    title="Share Profile Link"
                  >
                    <IconShare size={15} />
                  </button>
                </div>
              </div>

              {/* Cover Stage Banner */}
              {/* Cover Stage Banner */}
              <div
                className="profile-cover-stage"
                style={{ backgroundImage: `url(${profile.coverUrl})`, position: 'relative' }}
              />

              {/* Profile Card Info */}
              <div className="profile-header-card">
                <div className="profile-hero-row">
                  <div style={{ position: 'relative' }}>
                    <img
                      src={profile.avatar}
                      alt={profile.name}
                      className="profile-avatar-squircle"
                    />
                    {isOwnProfile && (
                      <button
                        className="btn-glass-avatar-edit"
                        onClick={handleOpenEditProfile}
                        title="Change Profile Photo"
                      >
                        <IconPhoto size={13} />
                      </button>
                    )}
                  </div>
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
                  <div className="profile-handle-sub">@{profile.handle} • {profile.category || 'Creator'}</div>
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

                {/* Apple VisionOS Glassmorphism Profile Action Bar */}
                <div className="apple-profile-actions-bar">
                  {isOwnProfile ? (
                    <>
                      <button
                        type="button"
                        className="apple-glass-action-btn primary"
                        onClick={handleOpenEditProfile}
                        title="Edit Profile Information"
                      >
                        <IconEdit size={14} />
                        <span>Edit Profile</span>
                      </button>
                      <button
                        type="button"
                        className="apple-glass-action-btn"
                        onClick={() => setIsSettingsOpen(true)}
                        title="Account & Privacy Settings"
                      >
                        <IconSettings size={14} />
                        <span>Settings</span>
                      </button>
                      <button
                        type="button"
                        className="apple-glass-action-btn icon-only"
                        onClick={() => {
                          navigator.clipboard?.writeText(`https://privity.app/@${profile.handle}`);
                          triggerToast(`Profile link copied: @${profile.handle}`);
                        }}
                        title="Share Profile Link"
                      >
                        <IconShare size={14} />
                      </button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                {/* Real Numerical Stats Bar - Apple VisionOS Complication Bar with Icons */}
                {(() => {
                  const dynamicFollowersCount = isOwnProfile
                    ? (myProfile.followersList || profile.followersList || []).length
                    : (profile.followersList || []).filter((h) => h !== 'luciano' && h !== myProfile.handle).length + (isFollowingThisUser ? 1 : 0);
                  const dynamicFollowingCount = isOwnProfile
                    ? Object.keys(followingMap).filter((k) => followingMap[k] && !k.startsWith('sc-') && k !== 'luciano' && k !== myProfile.handle).length
                    : (profile.followingList || []).length;
                  const dynamicCirclesCount = isOwnProfile
                    ? closeFriendsList.length
                    : (profile.trustCirclesList || []).length;

                  const totalLikesReceived = userDispatches.reduce(
                    (sum, p) => sum + (p.likesCount || (p.likersList ? p.likersList.length : 0) || 0),
                    0
                  ) + (profile.mediaItems || []).reduce((sum, m) => {
                    const baseKey = extractMediaBaseKey(m.url);
                    const photoRec = photoLikesMap[m.url] || (baseKey ? photoLikesMap[baseKey] : undefined);
                    return sum + (photoRec ? photoRec.count : (m.likes || 0));
                  }, 0);

                  return (
                    <div className="profile-stats-bar">
                      <div
                        className="profile-stat-item stat-clickable"
                        onClick={() => setProfileSubTab('dispatches')}
                        title="Click to view all dispatches"
                      >
                        <div className="profile-stat-icon-wrapper dispatches">
                          <IconList size={13} color="var(--public-cyan)" />
                        </div>
                        <span className="profile-stat-number">{userDispatches.length}</span>
                        <span className="profile-stat-label">Dispatches</span>
                      </div>

                      <div
                        className="profile-stat-item stat-clickable"
                        onClick={() => {
                          setProfileSubTab('liked');
                          triggerToast(`${profile.name} has received ${totalLikesReceived} total likes across dispatches & studio.`);
                        }}
                        title="Total post & media likes received"
                      >
                        <div className="profile-stat-icon-wrapper likes">
                          <IconHeart size={13} filled color="var(--heart-rose)" />
                        </div>
                        <span className="profile-stat-number">{totalLikesReceived.toLocaleString()}</span>
                        <span className="profile-stat-label">Likes</span>
                      </div>

                      <div
                        className="profile-stat-item stat-clickable"
                        onClick={() => openRoster(profile.handle, profile.name, 'followers')}
                        title={
                          !isOwnProfile && profile.isPrivate && !isFollowingThisUser
                            ? 'Private Account: Click to request access'
                            : 'Click to view followers directory'
                        }
                      >
                        <div className="profile-stat-icon-wrapper followers">
                          <IconUsers size={13} color="#818cf8" />
                        </div>
                        <span className="profile-stat-number">
                          {dynamicFollowersCount.toLocaleString()}
                        </span>
                        <span className="profile-stat-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          Followers {!isOwnProfile && profile.isPrivate && !isFollowingThisUser && <IconLock size={10} color="var(--cf-emerald)" />}
                        </span>
                      </div>

                      <div
                        className="profile-stat-item stat-clickable"
                        onClick={() => openRoster(profile.handle, profile.name, 'following')}
                        title={
                          !isOwnProfile && profile.isPrivate && !isFollowingThisUser
                            ? 'Private Account: Click to request access'
                            : 'Click to view following directory'
                        }
                      >
                        <div className="profile-stat-icon-wrapper following">
                          <IconUserCheck size={13} color="#38bdf8" />
                        </div>
                        <span className="profile-stat-number">
                          {dynamicFollowingCount.toLocaleString()}
                        </span>
                        <span className="profile-stat-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          Following {!isOwnProfile && profile.isPrivate && !isFollowingThisUser && <IconLock size={10} color="var(--cf-emerald)" />}
                        </span>
                      </div>

                      <div
                        className="profile-stat-item stat-clickable"
                        onClick={() => openRoster(profile.handle, profile.name, 'circle')}
                        title={
                          !isOwnProfile && profile.isPrivate && !isFollowingThisUser
                            ? 'Private Account: Click to request access'
                            : 'Click to view trust circles network'
                        }
                      >
                        <div className="profile-stat-icon-wrapper circles">
                          <IconStarCloseFriends size={13} color="var(--cf-emerald)" />
                        </div>
                        <span className="profile-stat-number">{dynamicCirclesCount.toLocaleString()}</span>
                        <span className="profile-stat-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          Circles {!isOwnProfile && profile.isPrivate && !isFollowingThisUser && <IconLock size={10} color="var(--cf-emerald)" />}
                        </span>
                      </div>
                    </div>
                  );
                })()}

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
                        setFollowingMap((prev) => ({ ...prev, [profile.handle]: true }));
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
                                <span className="author-handle-text">@{post.authorHandle}</span>
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

                            {post.type === 'video' && (post.videoUrl || post.contentUrl || post.thumbnailUrl) && (
                              <div className="post-visual-stage">
                                {post.videoUrl || (post.contentUrl && (post.contentUrl.startsWith('data:video') || post.contentUrl.endsWith('.mp4') || post.contentUrl.endsWith('.webm') || post.contentUrl.startsWith('blob:'))) ? (
                                  <video
                                    src={post.videoUrl || post.contentUrl}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    poster={post.thumbnailUrl}
                                    style={{ width: '100%', maxHeight: '520px', borderRadius: '16px', background: '#000', objectFit: 'contain' }}
                                  />
                                ) : (
                                  <div onClick={() => setLightboxUrl(post.thumbnailUrl || post.contentUrl || null)}>
                                    <img src={post.thumbnailUrl || post.contentUrl} alt="Video Thumbnail" loading="lazy" />
                                    <div className="video-status-pill">4K • 60 FPS • 0:48</div>
                                  </div>
                                )}
                              </div>
                            )}

                            {(() => {
                              const postMediaUrl = post.contentUrl || post.thumbnailUrl;
                              const postBaseKey = postMediaUrl ? extractMediaBaseKey(postMediaUrl) : '';
                              const photoRecord = postMediaUrl ? (photoLikesMap[postMediaUrl] || (postBaseKey ? photoLikesMap[postBaseKey] : undefined)) : undefined;
                              const matchingMedia = postMediaUrl ? Object.values(profiles).flatMap((p) => p.mediaItems || []).find((m) => isSameMedia(m.url, postMediaUrl)) : undefined;

                              const effectiveLiked = photoRecord !== undefined
                                ? photoRecord.isLiked
                                : (matchingMedia !== undefined ? matchingMedia.isLiked : !!post.isLiked);

                              const effectiveLikesCount = photoRecord !== undefined
                                ? photoRecord.count
                                : (matchingMedia !== undefined ? matchingMedia.likes : post.likesCount);

                              const effectiveLikers = effectiveLiked
                                ? ((post.likersList || []).includes('luciano') ? (post.likersList || []) : ['luciano', ...(post.likersList || [])])
                                : (post.likersList || []).filter((h) => h !== 'luciano');

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
                                      className={`btn-post-action ${post.isSaved ? 'saved' : ''}`}
                                      onClick={() => handleSave(post.id)}
                                      title="Save"
                                    >
                                      <IconBookmark size={18} filled={post.isSaved} color={post.isSaved ? 'var(--cf-emerald)' : 'currentColor'} />
                                    </button>
                                    <button
                                      className="btn-post-action"
                                      onClick={() => {
                                        const isOwn = post.authorHandle === myProfile.handle || post.authorId === 'usr-luciano';
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
                                        {(comment.authorHandle === myProfile.handle || comment.authorHandle === 'luciano') && (
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
                                            {(reply.authorHandle === myProfile.handle || reply.authorHandle === 'luciano') && (
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
                              <img src={item.url} alt="Studio Media" loading="lazy" />
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

                                {profile.handle === (myProfile.handle || 'luciano') && (
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
      {activeTab !== 'messages' && (
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
          {SUGGESTED_CREATORS.map((u) => {
            const isF = !!followingMap[u.id] || !!followingMap[u.handle];
            return (
              <div key={u.id} className="creator-entry-row">
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
          })}
        </div>

        {/* Trending Tags */}
        <div className="glass-panel-card">
          <div className="panel-title-text">Trending in Your Network</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dynamicTrendingTags.map((t) => (
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
            ))}
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

      {/* 100% FAITHFUL LIVEME STREAM ARENA REPLICATION */}
      {activeLiveStream && (
        <LiveMeStreamArena
          initialStreamerId={activeLiveStream.id}
          isHostBroadcast={isHostBroadcasting}
          userMediaStream={hostLiveCameraStream}
          onClose={() => {
            setActiveLiveStream(null);
            setIsHostBroadcasting(false);
            if (hostLiveCameraStream) {
              hostLiveCameraStream.getTracks().forEach((t) => t.stop());
              setHostLiveCameraStream(null);
            }
          }}
          onEndBroadcast={() => {
            setActiveLiveStream(null);
            setIsHostBroadcasting(false);
            if (hostLiveCameraStream) {
              hostLiveCameraStream.getTracks().forEach((t) => t.stop());
              setHostLiveCameraStream(null);
            }
          }}
          currentUser={{
            name: myProfile.name,
            handle: myProfile.handle,
            avatar: myProfile.avatar,
          }}
          userCoins={userSparksBalance}
          onCoinsChange={(delta) => setUserSparksBalance((prev) => Math.max(0, prev + delta))}
          showToast={triggerToast}
        />
      )}

      {/* LIGHTBOX FOR FULLSCREEN MEDIA — APPLE VISIONOS SPECULAR GLASS */}
      {lightboxUrl && (() => {
        const baseKey = extractMediaBaseKey(lightboxUrl);
        const record = photoLikesMap[lightboxUrl] || (baseKey ? photoLikesMap[baseKey] : undefined);
        const matchingMedia = Object.values(profiles).flatMap((p) => p.mediaItems || []).find((m) => isSameMedia(m.url, lightboxUrl));
        const matchingPost = posts.find((p) => isSameMedia(p.contentUrl, lightboxUrl) || isSameMedia(p.thumbnailUrl, lightboxUrl));

        // Real-time reactive like calculation
        const isPhotoLiked = record !== undefined
          ? record.isLiked
          : !!(matchingMedia?.isLiked || matchingPost?.isLiked);

        const photoLikesCount = record !== undefined
          ? record.count
          : (matchingMedia ? matchingMedia.likes : (matchingPost ? matchingPost.likesCount : 0));

        const resolvedComments = matchingPost?.comments || [];
        const resolvedCommentsCount = matchingPost?.commentsCount ?? (matchingMedia?.comments ?? resolvedComments.length);

        const isMyMedia = !lightboxIsPrivateMessage && (
          (matchingPost && (matchingPost.authorHandle === myProfile.handle || matchingPost.authorHandle === 'luciano')) ||
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
                if (nextLiked) {
                  if (!nextLikers.includes('luciano')) nextLikers = ['luciano', ...nextLikers];
                } else {
                  nextLikers = nextLikers.filter((h) => h !== 'luciano');
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
              <img
                src={lightboxUrl}
                alt="Fullscreen View"
                className="lightbox-hero-image"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={handleLightboxLikeToggle}
                title="Double-click to like photo"
              />

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
            <div className="direct-chat-users-bar">
              {['elena_rodriguez', 'marcus_dev', 'sara_architecture', 'julian_analogue'].map((handle) => {
                const user = getUserProfile(handle);
                const isActive = activeChatUser.handle.replace(/^@/, '') === handle;
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

            {/* Messages Body */}
            <div className="direct-chat-body">
              {(() => {
                const recipientClean = activeChatUser.handle.replace(/^@/, '');
                const thread = directMessages[recipientClean] || [];
                const cleanMyHandle = (myProfile.handle || 'luciano').replace(/^@/, '');

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
                      const isSent = msg.senderHandle === cleanMyHandle || msg.senderHandle === 'luciano';
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
        onClose={() => setIsCameraOpen(false)}
        currentUser={cameraCurrentUser}
        onPublishPost={handleCameraPublishPost}
        onGoLive={handleCameraGoLive}
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
                    <span>Upload Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          compressImageFile(file, 960, 0.72, (dataUrl) => {
                            setModalPhoto(dataUrl);
                            triggerToast('Photo attached to dispatch!');
                          });
                        }
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="Or paste photo image URL..."
                    value={modalPhoto || ''}
                    onChange={(e) => setModalPhoto(e.target.value || null)}
                    className="edit-profile-input"
                    style={{ flex: 1, minWidth: '180px' }}
                  />
                </div>

                {modalPhoto && (
                  <div style={{ position: 'relative', marginTop: '10px' }}>
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
                {/* Cover Photo Customization */}
                <div className="edit-profile-section">
                  <label className="edit-profile-label">Cover Banner Photo</label>
                  <div
                    style={{
                      width: '100%',
                      height: '110px',
                      borderRadius: 'var(--radius-md)',
                      backgroundImage: `url(${editForm.coverUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                      border: '1px solid var(--glass-border)',
                      marginBottom: '10px',
                    }}
                  />
                  <div className="photo-upload-dock">
                    <label className="btn-file-upload-label">
                      <IconPhoto size={15} />
                      <span>Upload Banner From Device</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            compressImageFile(file, 960, 0.72, (dataUrl) => {
                              setEditForm((prev) => ({ ...prev, coverUrl: dataUrl }));
                              triggerToast('Cover banner photo updated!');
                            });
                          }
                        }}
                      />
                    </label>
                    <input
                      type="text"
                      className="edit-profile-input"
                      style={{ flex: 1, minWidth: '180px' }}
                      placeholder="Or paste banner image URL..."
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
                  <label className="edit-profile-label">Profile Avatar</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img
                      src={editForm.avatar}
                      alt="Avatar Preview"
                      style={{
                        width: '68px',
                        height: '68px',
                        borderRadius: 'var(--radius-md)',
                        objectFit: 'cover',
                        border: '2px solid var(--glass-border-light)',
                        boxShadow: 'var(--shadow-elevated)',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div className="photo-upload-dock">
                        <label className="btn-file-upload-label">
                          <IconPhoto size={15} />
                          <span>Upload Photo From Device</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                compressImageFile(file, 320, 0.80, (dataUrl) => {
                                  setEditForm((prev) => ({ ...prev, avatar: dataUrl }));
                                  triggerToast('Avatar photo updated!');
                                });
                              }
                            }}
                          />
                        </label>
                        <input
                          type="text"
                          className="edit-profile-input"
                          style={{ flex: 1, minWidth: '160px' }}
                          placeholder="Or paste avatar URL..."
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
                      actorId: 'usr-luciano',
                      actorUsername: 'admin_luciano',
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
              const cleanTarget = rosterModal.targetHandle.replace(/^@/, '');
              const p = getUserProfile(cleanTarget);
              const isTargetOwn = cleanTarget === 'luciano' || cleanTarget === myProfile.handle;
              const isTargetFollowing = !!followingMap[cleanTarget];
              const followersCount = isTargetOwn
                ? (myProfile.followersList || p.followersList || []).length
                : (p.followersList || []).filter((h) => h !== 'luciano' && h !== myProfile.handle).length + (isTargetFollowing ? 1 : 0);
              const followingCount = isTargetOwn
                ? Object.keys(followingMap).filter((k) => followingMap[k] && !k.startsWith('sc-') && k !== 'luciano' && k !== myProfile.handle).length
                : (p.followingList || []).length;
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
              const cleanTarget = rosterModal.targetHandle.replace(/^@/, '');
              const p = getUserProfile(cleanTarget);
              const isTargetOwn = cleanTarget === 'luciano' || cleanTarget === myProfile.handle;
              let currentHandles: string[] = [];

              if (rosterModal.mode === 'likes') {
                currentHandles = rosterModal.handles;
              } else if (rosterModal.mode === 'followers') {
                if (isTargetOwn) {
                  currentHandles = [...(myProfile.followersList || p.followersList || [])];
                } else {
                  const isTargetFollowing = !!followingMap[cleanTarget];
                  const base = (p.followersList || []).filter((h) => h !== 'luciano' && h !== myProfile.handle);
                  currentHandles = isTargetFollowing ? [myProfile.handle, ...base] : base;
                }
              } else if (rosterModal.mode === 'following') {
                if (isTargetOwn) {
                  currentHandles = Object.keys(followingMap).filter(
                    (k) => followingMap[k] && !k.startsWith('sc-') && k !== 'luciano' && k !== myProfile.handle
                  );
                } else {
                  currentHandles = [...(p.followingList || [])];
                }
              } else if (rosterModal.mode === 'circle') {
                if (isTargetOwn) {
                  currentHandles = [...closeFriendsList];
                } else {
                  currentHandles = [...(p.trustCirclesList || [])];
                }
              }

              const filteredHandles = currentHandles.filter((h) => {
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
                      const isF = !!followingMap[user.handle];
                      const isSelf = user.handle === 'luciano' || user.handle === myProfile.handle;

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
                  setFollowingMap((prev) => ({ ...prev, [targetH]: true }));
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
                          <VerifiedBadge
                            authorName={myProfile.name}
                            category={myProfile.verifiedCategory}
                            since={myProfile.verifiedSince}
                            proofId={myProfile.cryptoProofId}
                          />
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>@{myProfile.handle}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--brand-cyan)', marginTop: '2px' }}>
                          {userSettings.membershipTier} · Verified Identity
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
                          openRoster('luciano', myProfile.name, 'circle');
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
                        <div className="settings-item-title" style={{ color: '#f87171' }}>Reset Local Demo Data</div>
                        <div className="settings-item-desc">
                          Erase all local modifications, custom profile edits, uploaded photos, and return the application to pristine factory demo state.
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
                        <span>Reset Data</span>
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
      {!(activeTab === 'messages' && activeChatUser) && !(activeTab === 'feed' && feedFilter === 'live') && (
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
            className={`mobile-nav-item ${activeTab === 'profile' && viewedUserHandle === 'luciano' ? 'active' : ''}`}
            onClick={() => {
              navigateToProfile('luciano');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            title="Your Profile"
          >
            <div className={`mobile-nav-avatar-wrap ${activeTab === 'profile' && viewedUserHandle === 'luciano' ? 'active' : ''}`}>
              <img src={myProfile.avatar} alt="Profile" className="mobile-nav-avatar" />
            </div>
            <span className="mobile-nav-label">Profile</span>
            {activeTab === 'profile' && viewedUserHandle === 'luciano' && <span className="mobile-nav-indicator" />}
          </button>
        </nav>
      )}
    </div>
  );
}

export default App;
