import React, { useState, useEffect } from 'react';
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
  IconUnlock,
  IconSearch,
  IconCheck,
  IconX,
  IconSettings,
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
} from './components/Icons';

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
    coverUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1600&auto=format&fit=crop&q=85',
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
      { id: 'm-luciano-1', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 54, comments: 6 },
      { id: 'm-luciano-2', url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&auto=format&fit=crop&q=85', type: 'image', likes: 40, comments: 3 },
    ],
  },
};



// Preset Avatars for 1-Click Profile Personalization
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
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1600&auto=format&fit=crop&q=85',
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

// ==================== MAIN COMPONENT ====================

export function App() {
  const [activeTab, setActiveTab] = useState<'feed' | 'discover' | 'activity' | 'profile' | 'safety'>('feed');
  const [feedFilter, setFeedFilter] = useState<'all' | PostPrivacy>('all');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

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

  // 1. Persistent Profiles State
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>(() =>
    readStorage('privity_profiles_v5', INITIAL_PROFILES_REGISTRY)
  );

  // 2. Persistent Posts State
  const [posts, setPosts] = useState<PostItem[]>(() =>
    readStorage('privity_posts_v5', SAMPLE_POSTS)
  );

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

  // Auto-sync all changes to localStorage so they persist across page refreshes
  useEffect(() => {
    try {
      localStorage.setItem('privity_profiles_v5', JSON.stringify(profiles));
    } catch (e) {
      console.warn('Failed to save profiles to localStorage', e);
    }
  }, [profiles]);

  useEffect(() => {
    try {
      localStorage.setItem('privity_posts_v5', JSON.stringify(posts));
    } catch (e) {
      console.warn('Failed to save posts to localStorage', e);
    }
  }, [posts]);

  useEffect(() => {
    try {
      localStorage.setItem('privity_following_v5', JSON.stringify(followingMap));
    } catch (e) {
      console.warn('Failed to save followingMap to localStorage', e);
    }
  }, [followingMap]);

  useEffect(() => {
    try {
      localStorage.setItem('privity_close_friends_v5', JSON.stringify(closeFriendsList));
    } catch (e) {
      console.warn('Failed to save closeFriendsList to localStorage', e);
    }
  }, [closeFriendsList]);

  useEffect(() => {
    try {
      localStorage.setItem('privity_private_account_v5', JSON.stringify(isPrivateAccount));
    } catch (e) {
      console.warn('Failed to save isPrivateAccount to localStorage', e);
    }
  }, [isPrivateAccount]);

  // 6. Persistent VisionOS User Settings
  const [userSettings, setUserSettings] = useState<UserSettings>(() =>
    readStorage('privity_user_settings_v5', DEFAULT_USER_SETTINGS)
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState<'account' | 'privacy' | 'notifications' | 'security' | 'terms'>('account');
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
    triggerToast('Profile updated & saved in real time!');
  };

  // Like media item directly on profile
  const handleLikeMedia = (profileHandle: string, mediaId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const clean = profileHandle.replace(/^@/, '');
    setProfiles((prev) => {
      const prof = prev[clean] || getUserProfile(clean);
      if (!prof || !prof.mediaItems) return prev;
      const nextMedia = prof.mediaItems.map((m) => {
        if (m.id === mediaId) {
          const nextLiked = !m.isLiked;
          return {
            ...m,
            isLiked: nextLiked,
            likes: nextLiked ? m.likes + 1 : Math.max(0, m.likes - 1),
          };
        }
        return m;
      });
      return {
        ...prev,
        [clean]: {
          ...prof,
          mediaItems: nextMedia,
        },
      };
    });
    triggerToast('Photo reaction updated and saved in real time');
  };

  // Post Actions Menu & Caption Editing State
  const [postMenuModal, setPostMenuModal] = useState<{ post: PostItem; isOwn: boolean } | null>(null);
  const [editingPostCaption, setEditingPostCaption] = useState<{ id: string; caption: string } | null>(null);

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setPostMenuModal(null);
    triggerToast('Dispatch deleted permanently');
  };

  const handleSavePostCaption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPostCaption) return;
    setPosts((prev) =>
      prev.map((p) => (p.id === editingPostCaption.id ? { ...p, caption: editingPostCaption.caption } : p))
    );
    setEditingPostCaption(null);
    setPostMenuModal(null);
    triggerToast('Dispatch caption updated');
  };

  // Floating heart tracker for double tap
  const [heartExplodingPostId, setHeartExplodingPostId] = useState<string | null>(null);

  // Fullscreen Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [discoverSearch, setDiscoverSearch] = useState('');

  // Inline Composer State
  const [composerCaption, setComposerCaption] = useState('');
  const [composerPrivacy, setComposerPrivacy] = useState<PostPrivacy>('followers');
  const [composerPhotoUrl, setComposerPhotoUrl] = useState<string | null>(null);

  // Modal Composer State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCaption, setModalCaption] = useState('');
  const [modalTags, setModalTags] = useState('');
  const [modalPrivacy, setModalPrivacy] = useState<PostPrivacy>('close_friends');
  const [modalPhoto, setModalPhoto] = useState<string | null>(null);

  // Comment input per post
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<{ postId: string; commentId: string; handle: string } | null>(null);

  // User Profile View State & Navigation History Stack
  const [viewedUserHandle, setViewedUserHandle] = useState<string>('luciano');
  const [profileHistory, setProfileHistory] = useState<string[]>([]);
  const [profileSubTab, setProfileSubTab] = useState<'dispatches' | 'media' | 'circles'>('dispatches');

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

  const toggleFollow = (handleOrId: string, name?: string) => {
    const clean = handleOrId.replace(/^@/, '');
    const current = !!followingMap[clean];
    const next = !current;
    const myHandle = myProfile.handle || 'luciano';

    setFollowingMap((prev) => {
      const nextMap = { ...prev, [clean]: next };
      try {
        localStorage.setItem('privity_following_v5', JSON.stringify(nextMap));
      } catch (err) {
        console.warn(err);
      }
      return nextMap;
    });

    setProfiles((prev) => {
      const target = prev[clean] || getUserProfile(clean);
      let targetFollowers = [...(target.followersList || [])];
      if (next) {
        if (!targetFollowers.includes('luciano')) targetFollowers.push('luciano');
        if (myHandle !== 'luciano' && !targetFollowers.includes(myHandle)) targetFollowers.push(myHandle);
      } else {
        targetFollowers = targetFollowers.filter((h) => h !== 'luciano' && h !== myHandle);
      }
      const nextTarget = { ...target, followersList: targetFollowers };

      const myProf = prev['luciano'] || prev[myHandle] || getUserProfile('luciano');
      let myFollowing = [...(myProf.followingList || [])];
      if (next) {
        if (!myFollowing.includes(clean)) myFollowing.push(clean);
      } else {
        myFollowing = myFollowing.filter((h) => h !== clean);
      }
      const nextMyProf = { ...myProf, followingList: myFollowing };

      const nextProfiles = {
        ...prev,
        [clean]: nextTarget,
        luciano: nextMyProf,
        ...(myHandle !== 'luciano' ? { [myHandle]: nextMyProf } : {}),
      };
      try {
        localStorage.setItem('privity_profiles_v5', JSON.stringify(nextProfiles));
      } catch (err) {
        console.warn(err);
      }
      return nextProfiles;
    });

    triggerToast(next ? `Now following ${name || '@' + clean}` : `Unfollowed ${name || '@' + clean}`);
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

    triggerToast(`Removed @${clean} from your followers in real time`);
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

  // Notifications
  const [followRequests, setFollowRequests] = useState([
    { id: 'fr-1', name: 'Sam Archer', handle: 'sam_arch', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120' },
    { id: 'fr-2', name: 'Jessica Vance', handle: 'jess_film', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120' },
  ]);


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

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

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

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isCurrentlyLiked = !!p.isLiked;
          const nextLiked = fromDoubleTap ? true : !isCurrentlyLiked;
          if (fromDoubleTap && isCurrentlyLiked) {
            return p;
          }
          let nextLikers = [...(p.likersList || [])];
          if (nextLiked) {
            if (!nextLikers.includes('luciano')) {
              nextLikers = ['luciano', ...nextLikers];
            }
          } else {
            nextLikers = nextLikers.filter((h) => h !== 'luciano');
          }
          return {
            ...p,
            isLiked: nextLiked,
            likersList: nextLikers,
            likesCount: nextLikers.length,
          };
        }
        return p;
      }),
    );
  };

  // Bookmark / Save
  const handleSave = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const next = !p.isSaved;
          triggerToast(next ? 'Saved to private collection' : 'Removed from saved');
          return {
            ...p,
            isSaved: next,
            savesCount: next ? p.savesCount + 1 : Math.max(0, p.savesCount - 1),
          };
        }
        return p;
      }),
    );
  };

  // Share
  const handleShare = (postId: string) => {
    const url = `https://privity.app/p/${postId}`;
    navigator.clipboard?.writeText(url);
    triggerToast(`External share link copied: ${url}`);
  };

  // Add Comment with 1-level reply nesting per PRD 13.2
  const handleAddComment = (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    setPosts((prev) => {
      const nextPosts = prev.map((p) => {
        if (p.id === postId) {
          if (replyTarget && replyTarget.postId === postId) {
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
            return { ...p, commentsCount: p.commentsCount + 1, comments: [...p.comments, comment] };
          }
        }
        return p;
      });
      try {
        localStorage.setItem('privity_posts_v5', JSON.stringify(nextPosts));
      } catch (err) {
        console.warn(err);
      }
      return nextPosts;
    });

    setCommentInputs({ ...commentInputs, [postId]: '' });
    setReplyTarget(null);
    triggerToast('Comment posted and saved in real time');
  };

  // Delete comment or nested reply in real time
  const handleDeleteComment = (postId: string, commentId: string, replyId?: string) => {
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
      try {
        localStorage.setItem('privity_posts_v5', JSON.stringify(nextPosts));
      } catch (err) {
        console.warn(err);
      }
      return nextPosts;
    });
    triggerToast('Comment removed in real time');
  };

  // Like or unlike comment in real time
  const handleLikeComment = (postId: string, commentId: string) => {
    setPosts((prev) => {
      const nextPosts = prev.map((p) => {
        if (p.id !== postId) return p;
        const updated = p.comments.map((c) => {
          if (c.id !== commentId) return c;
          const nextLiked = !c.isLiked;
          return {
            ...c,
            isLiked: nextLiked,
            likesCount: nextLiked ? (c.likesCount || 0) + 1 : Math.max(0, (c.likesCount || 0) - 1),
          };
        });
        return { ...p, comments: updated };
      });
      try {
        localStorage.setItem('privity_posts_v5', JSON.stringify(nextPosts));
      } catch (err) {
        console.warn(err);
      }
      return nextPosts;
    });
  };

  // Publish from inline composer
  const handleInlinePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerCaption.trim()) return;

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
      caption: composerCaption,
      tags: ['privity', 'authentic'],
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
      setProfiles((prev) => {
        const prof = prev['luciano'] || prev[myProfile.handle] || myProfile;
        const newMedia: UserMediaItem = {
          id: `m-luciano-${Date.now()}`,
          url: composerPhotoUrl,
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
        try {
          localStorage.setItem('privity_profiles_v5', JSON.stringify(nextProfiles));
        } catch (err) {
          console.warn(err);
        }
        return nextProfiles;
      });
    }

    setPosts((prev) => {
      const nextPosts = [newPost, ...prev];
      try {
        localStorage.setItem('privity_posts_v5', JSON.stringify(nextPosts));
      } catch (err) {
        console.warn(err);
      }
      return nextPosts;
    });
    setComposerCaption('');
    setComposerPhotoUrl(null);
    triggerToast(`Shared with ${composerPrivacy.replace('_', ' ')} audience in real time!`);
  };

  // Publish from modal
  const handleModalPublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCaption.trim()) return;

    const tagsArr = modalTags
      .split(' ')
      .map((t) => t.replace('#', '').trim())
      .filter(Boolean);

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
      caption: modalCaption,
      tags: tagsArr.length > 0 ? tagsArr : ['privity'],
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
      setProfiles((prev) => {
        const prof = prev['luciano'] || prev[myProfile.handle] || myProfile;
        const newMedia: UserMediaItem = {
          id: `m-luciano-${Date.now()}`,
          url: modalPhoto,
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
        try {
          localStorage.setItem('privity_profiles_v5', JSON.stringify(nextProfiles));
        } catch (err) {
          console.warn(err);
        }
        return nextProfiles;
      });
    }

    setPosts((prev) => {
      const nextPosts = [newPost, ...prev];
      try {
        localStorage.setItem('privity_posts_v5', JSON.stringify(nextPosts));
      } catch (err) {
        console.warn(err);
      }
      return nextPosts;
    });
    setIsModalOpen(false);
    setModalCaption('');
    setModalTags('');
    setModalPhoto(null);
    triggerToast(`Published to ${modalPrivacy.replace('_', ' ')} circle in real time!`);
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--brand-gradient)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-float)',
            zIndex: 9999,
            fontWeight: 800,
            fontSize: '13px',
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. LEFT SIDEBAR NAVIGATION (BESPOKE VECTOR ICONS)        */}
      {/* ======================================================== */}
      <aside className="nav-sidebar">
        <div className="brand-anchor" onClick={() => setActiveTab('feed')}>
          <div className="brand-emblem-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <div className="brand-logo-text">
            privity<span className="brand-pulsing-orbit"></span>
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

        <button className="btn-compose-prime" onClick={() => setIsModalOpen(true)}>
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
      <main className="feed-column">
        {/* --- VIEW 1: HOME FEED --- */}
        {activeTab === 'feed' && (
          <div>
            <header className="feed-sticky-nav">
              <div className="feed-title-line">
                <div className="feed-main-heading">Home</div>
                <div className="feed-pulse-indicator">
                  <span className="live-green-orb"></span>
                  Relationship Feed Active
                </div>
              </div>

              {/* Feed Audience Tabs */}
              <div className="audience-tabs-bar">
                <button
                  className={`audience-tab-btn ${feedFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setFeedFilter('all')}
                >
                  All Circles
                </button>
                <button
                  className={`audience-tab-btn cf ${feedFilter === 'close_friends' ? 'active' : ''}`}
                  onClick={() => setFeedFilter('close_friends')}
                >
                  <IconStarCloseFriends size={13} color="var(--cf-emerald)" />
                  Close Friends
                </button>
                <button
                  className={`audience-tab-btn followers ${feedFilter === 'followers' ? 'active' : ''}`}
                  onClick={() => setFeedFilter('followers')}
                >
                  <IconUsers size={14} color="var(--followers-iris)" />
                  Followers Only
                </button>
              </div>
            </header>

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

              <div className="circle-unit" onClick={() => setIsModalOpen(true)}>
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
                            compressImageFile(file, 1400, 0.85, (dataUrl) => {
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
                .filter((p) => feedFilter === 'all' || p.privacy === feedFilter)
                .filter((p) => {
                  if (!activeTagFilter) return true;
                  return p.tags && p.tags.map((t) => t.toLowerCase()).includes(activeTagFilter.toLowerCase());
                })
                .map((post) => (
                  <article key={post.id} className="feed-post-card">
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

                      {/* Video Player Display */}
                      {post.type === 'video' && post.thumbnailUrl && (
                        <div
                          className="post-visual-stage"
                          onClick={() => setLightboxUrl(post.thumbnailUrl || null)}
                        >
                          <img
                            src={post.thumbnailUrl}
                            alt="Video Thumbnail"
                            loading="lazy"
                          />
                          <div className="video-status-pill">4K • 60 FPS • 0:48</div>
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
                      <div className="post-toolbar-line">
                        {/* Real Like Button */}
                        <button
                          className={`btn-post-action ${post.isLiked ? 'liked' : ''}`}
                          onClick={() => handleLike(post.id)}
                        >
                          <IconHeart size={18} filled={post.isLiked} color={post.isLiked ? 'var(--heart-rose)' : 'currentColor'} />
                          <span>{post.likesCount}</span>
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
                      {post.likesCount > 0 && (
                        <div
                          className="post-liked-by-strip"
                          onClick={() => {
                            openRoster(post.authorHandle, post.authorName, 'likes', post.likersList || []);
                          }}
                          title="Click to view everyone who liked this dispatch"
                        >
                          <div className="liked-avatars-stack">
                            {(post.likersList || []).slice(0, 3).map((h) => {
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
                            {(post.likersList || []).slice(0, 2).map((h, idx) => {
                              const u = getUserProfile(h);
                              const isLastOfTwo = (post.likersList || []).length === 2 && idx === 1;
                              const isFirstOfMany = (post.likersList || []).length > 2 && idx === 0;
                              return (
                                <span key={h}>
                                  {isLastOfTwo && ' and '}
                                  <strong>{u.name}</strong>
                                  {isFirstOfMany && ', '}
                                </span>
                              );
                            })}
                            {(post.likersList || []).length > 2 && (
                              <>
                                {' '}and <strong>{(post.likersList || []).length - 2} {((post.likersList || []).length - 2 === 1) ? 'other' : 'others'}</strong>
                              </>
                            )}
                          </span>
                        </div>
                      )}

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
                          >
                            Send
                          </button>
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

        {/* --- VIEW 3: ACTIVITY / NOTIFICATIONS --- */}
        {activeTab === 'activity' && (
          <div style={{ padding: '28px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
              Activity & Circle Requests
            </h2>

            {followRequests.length > 0 && (
              <div
                className="glass-panel-card"
                style={{ marginBottom: '24px', borderColor: 'var(--followers-border)' }}
              >
                <div className="panel-title-text" style={{ color: 'var(--followers-iris)' }}>
                  Pending Follow Requests (Private Account)
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
                        onClick={() => {
                          setFollowRequests(followRequests.filter((x) => x.id !== r.id));
                          triggerToast(`Follow request from @${r.handle} approved!`);
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-follow-toggle following"
                        onClick={() => setFollowRequests(followRequests.filter((x) => x.id !== r.id))}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
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
              <div
                className="profile-cover-stage"
                style={{ backgroundImage: `url(${profile.coverUrl})`, position: 'relative' }}
              >
                {isOwnProfile && (
                  <button
                    className="btn-glass-banner-edit"
                    onClick={handleOpenEditProfile}
                    title="Change Cover Banner"
                  >
                    <IconPhoto size={14} />
                    <span>Edit Cover</span>
                  </button>
                )}
              </div>

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

                  <div className="profile-action-dock">
                    {isOwnProfile ? (
                      <>
                        <button
                          className="btn-glass-back"
                          onClick={handleOpenEditProfile}
                        >
                          <IconPhoto size={14} />
                          <span>Edit Profile</span>
                        </button>
                        <button
                          className="btn-glass-back"
                          onClick={() => setIsSettingsOpen(true)}
                          title="Account & Privacy Settings"
                        >
                          <IconSettings size={15} />
                          <span>Settings</span>
                        </button>
                        <button
                          className="btn-post-dispatch"
                          style={{ padding: '8px 18px', fontSize: '13px' }}
                          onClick={() => setIsModalOpen(true)}
                        >
                          <IconPlus size={16} />
                          <span>Dispatch</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className={`btn-follow-toggle ${isFollowingThisUser ? 'following' : ''}`}
                          onClick={() => toggleFollow(profile.handle, profile.name)}
                        >
                          {isFollowingThisUser ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <IconUserCheck size={14} /> Following
                            </span>
                          ) : (
                            'Follow'
                          )}
                        </button>

                        <button
                          className="btn-glass-back"
                          style={{
                            color: isInCloseFriends ? 'var(--cf-emerald)' : 'var(--text-secondary)',
                            borderColor: isInCloseFriends ? 'var(--cf-border)' : 'var(--glass-border)',
                            background: isInCloseFriends ? 'var(--cf-glass)' : 'var(--glass-input)',
                          }}
                          onClick={() => toggleCloseFriends(profile.handle)}
                        >
                          <IconStarCloseFriends size={14} color={isInCloseFriends ? 'var(--cf-emerald)' : 'currentColor'} />
                          <span>{isInCloseFriends ? 'Close Friend' : 'Add to Circle'}</span>
                        </button>

                        <button
                          className="btn-glass-back"
                          onClick={() => triggerToast(`Direct encrypted dispatch channel opened with @${profile.handle}`)}
                        >
                          <IconChat size={14} />
                          <span>Message</span>
                        </button>
                      </>
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

                {/* Real Numerical Stats Bar - Fully Clickable Directories */}
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

                  return (
                    <div className="profile-stats-bar">
                      <div
                        className="profile-stat-item stat-clickable"
                        onClick={() => setProfileSubTab('dispatches')}
                        title="Click to view all dispatches"
                      >
                        <span className="profile-stat-number">{userDispatches.length}</span>
                        <span className="profile-stat-label">Dispatches</span>
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
                        <span className="profile-stat-number">
                          {dynamicFollowersCount.toLocaleString()}
                        </span>
                        <span className="profile-stat-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Followers {!isOwnProfile && profile.isPrivate && !isFollowingThisUser && <IconLock size={11} color="var(--cf-emerald)" />}
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
                        <span className="profile-stat-number">
                          {dynamicFollowingCount.toLocaleString()}
                        </span>
                        <span className="profile-stat-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Following {!isOwnProfile && profile.isPrivate && !isFollowingThisUser && <IconLock size={11} color="var(--cf-emerald)" />}
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
                        <span className="profile-stat-number">{dynamicCirclesCount.toLocaleString()}</span>
                        <span className="profile-stat-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Trust Circles {!isOwnProfile && profile.isPrivate && !isFollowingThisUser && <IconLock size={11} color="var(--cf-emerald)" />}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* If Viewing Own Profile: Privacy Controls & Close Friends Manager */}
                {isOwnProfile && (
                  <>
                    {/* Account Privacy Control Switch */}
                    <div className="glass-panel-card" style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isPrivateAccount ? <IconLock size={17} color="var(--cf-emerald)" /> : <IconUnlock size={17} color="var(--public-cyan)" />}
                            {isPrivateAccount ? 'Private Account Active' : 'Public Account Active'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {isPrivateAccount
                              ? 'Only approved followers can view your updates and follower directories. New follows require your approval.'
                              : 'Anyone can follow you and view your public posts.'}
                          </div>
                        </div>
                        <button
                          className="btn-follow-toggle"
                          onClick={() => {
                            const next = !isPrivateAccount;
                            setIsPrivateAccount(next);
                            triggerToast(next ? 'Account privacy set to Private' : 'Account privacy set to Public');
                          }}
                        >
                          {isPrivateAccount ? 'Switch to Public' : 'Switch to Private'}
                        </button>
                      </div>
                    </div>

                    {/* Close Friends Roster */}
                    <div className="glass-panel-card" style={{ borderColor: 'var(--cf-border)', marginBottom: '20px' }}>
                      <div className="panel-title-text" style={{ color: 'var(--cf-emerald)' }}>
                        Close Friends Circle ({closeFriendsList.length} Active Members)
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                        Members in this circle receive your intimate dispatches. Click any member to view their profile.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {closeFriendsList.map((handle) => (
                          <span
                            key={handle}
                            onClick={() => navigateToProfile(handle)}
                            style={{
                              background: 'var(--cf-glass)',
                              border: '1px solid var(--cf-border)',
                              color: 'var(--cf-emerald)',
                              padding: '5px 14px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '12px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            <IconStarCloseFriends size={12} color="var(--cf-emerald)" />
                            @{handle}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}

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
                        <IconList size={16} />
                        <span>Dispatches ({userDispatches.length})</span>
                      </button>
                      <button
                        className={`profile-view-tab-btn ${profileSubTab === 'media' ? 'active' : ''}`}
                        onClick={() => setProfileSubTab('media')}
                      >
                        <IconGrid size={16} />
                        <span>Media & Studio ({profile.mediaItems.length})</span>
                      </button>
                      <button
                        className={`profile-view-tab-btn ${profileSubTab === 'circles' ? 'active' : ''}`}
                        onClick={() => setProfileSubTab('circles')}
                      >
                        <IconShield size={16} />
                        <span>Trust Architecture</span>
                      </button>
                    </div>

                {/* Sub Tab 1: Dispatches */}
                {profileSubTab === 'dispatches' && (
                  <div style={{ marginTop: '14px' }}>
                    {userDispatches.length > 0 ? (
                      userDispatches.map((post) => (
                        <article key={post.id} className="feed-post-card" style={{ paddingLeft: '8px', paddingRight: '8px' }}>
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

                            {post.type === 'video' && post.thumbnailUrl && (
                              <div
                                className="post-visual-stage"
                                onClick={() => setLightboxUrl(post.thumbnailUrl || null)}
                              >
                                <img src={post.thumbnailUrl} alt="Video Thumbnail" loading="lazy" />
                                <div className="video-status-pill">4K • 60 FPS • 0:48</div>
                              </div>
                            )}

                            <div className="post-toolbar-line">
                              <button
                                className={`btn-post-action ${post.isLiked ? 'liked' : ''}`}
                                onClick={() => handleLike(post.id)}
                              >
                                <IconHeart size={18} filled={post.isLiked} color={post.isLiked ? 'var(--heart-rose)' : 'currentColor'} />
                                <span>{post.likesCount}</span>
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
                            {post.likesCount > 0 && (
                              <div
                                className="post-liked-by-strip"
                                style={{ marginTop: '10px' }}
                                onClick={() => {
                                  openRoster(post.authorHandle, post.authorName, 'likes', post.likersList || []);
                                }}
                                title="Click to view everyone who liked this dispatch"
                              >
                                <div className="liked-avatars-stack">
                                  {(post.likersList || []).slice(0, 3).map((h) => {
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
                                  {(post.likersList || []).slice(0, 2).map((h, idx) => {
                                    const u = getUserProfile(h);
                                    const isLastOfTwo = (post.likersList || []).length === 2 && idx === 1;
                                    const isFirstOfMany = (post.likersList || []).length > 2 && idx === 0;
                                    return (
                                      <span key={h}>
                                        {isLastOfTwo && ' and '}
                                        <strong>{u.name}</strong>
                                        {isFirstOfMany && ', '}
                                      </span>
                                    );
                                  })}
                                  {(post.likersList || []).length > 2 && (
                                    <>
                                      {' '}and <strong>{(post.likersList || []).length - 2} {((post.likersList || []).length - 2 === 1) ? 'other' : 'others'}</strong>
                                    </>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        No dispatches visible in this audience circle yet.
                      </div>
                    )}
                  </div>
                )}

                {/* Sub Tab 2: Media & Studio Grid */}
                {profileSubTab === 'media' && (
                  <div style={{ marginTop: '16px' }}>
                    {profile.mediaItems && profile.mediaItems.length > 0 ? (
                      <div className="profile-media-grid">
                        {profile.mediaItems.map((item) => (
                          <div
                            key={item.id}
                            className="profile-media-cell"
                            onClick={() => setLightboxUrl(item.url)}
                          >
                            <img src={item.url} alt="Studio Media" loading="lazy" />
                            <div className="profile-media-hover-overlay">
                              <div
                                className="media-interactive-heart"
                                onClick={(e) => handleLikeMedia(profile.handle, item.id, e)}
                                title={item.isLiked ? 'Unlike photo' : 'Like photo'}
                              >
                                <IconHeart size={16} filled={item.isLiked} color={item.isLiked ? 'var(--heart-rose)' : '#fff'} />
                                <span style={{ marginLeft: '4px', fontWeight: 700 }}>{item.likes}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <IconChat size={16} color="#fff" />
                                <span>{item.comments}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        No media artifacts published yet.
                      </div>
                    )}
                  </div>
                )}

                {/* Sub Tab 3: Trust & Circles */}
                {profileSubTab === 'circles' && (
                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass-panel-card">
                      <div className="panel-title-text" style={{ color: 'var(--public-cyan)' }}>
                        Cryptographic Verification Proof
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '20px' }}>
                        This identity is authenticated with an Ed25519 cryptographic key pair registered to Privity's decentralized ledger.
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                          Public Key Fingerprint:
                        </span>
                        <code style={{ background: 'var(--glass-input)', padding: '6px 12px', borderRadius: 'var(--radius-xs)', color: 'var(--public-cyan)', fontSize: '12px' }}>
                          {profile.cryptoProofId || 'priv_ed25519_verified_proof'}
                        </code>
                      </div>
                    </div>

                    <div className="glass-panel-card">
                      <div className="panel-title-text" style={{ color: 'var(--cf-emerald)' }}>
                        Relationship Trust Level
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {isOwnProfile
                          ? 'This is your root identity. You have total autonomy over all audience circles.'
                          : isInCloseFriends
                          ? '★ Mutual Close Friends: You have granted this creator access to your intimate circle.'
                          : isFollowingThisUser
                          ? 'Follower: You receive standard updates delivered chronologically.'
                          : 'Public Connection: You can view public dispatches and request circle access.'}
                      </p>
                    </div>
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
            {[
              { tag: 'mindful', count: '1.4k dispatches' },
              { tag: 'photography', count: '890 dispatches' },
              { tag: 'privacyfirst', count: '620 dispatches' },
              { tag: 'slowlife', count: '410 dispatches' },
            ].map((t) => (
              <div key={t.tag} className="trending-topic-cell">
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

      {/* ======================================================== */}
      {/* 4. MODALS & LIGHTBOXES                                   */}
      {/* ======================================================== */}

      {/* LIGHTBOX FOR FULLSCREEN MEDIA */}
      {lightboxUrl && (() => {
        const matchingMedia = Object.values(profiles).flatMap((p) => p.mediaItems || []).find((m) => m.url === lightboxUrl);
        const matchingPost = posts.find((p) => p.contentUrl === lightboxUrl || p.thumbnailUrl === lightboxUrl);
        const isPhotoLiked = !!(matchingMedia?.isLiked || matchingPost?.isLiked);
        const photoLikesCount = matchingMedia?.likes ?? (matchingPost?.likesCount ?? 0);

        const handleLightboxLikeToggle = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (matchingPost) {
            handleLike(matchingPost.id);
          } else if (matchingMedia) {
            for (const p of Object.values(profiles)) {
              if (p.mediaItems?.some((m) => m.id === matchingMedia.id)) {
                handleLikeMedia(p.handle, matchingMedia.id);
                break;
              }
            }
          }
        };

        return (
          <div className="lightbox-stage-overlay" onClick={() => setLightboxUrl(null)}>
            <div style={{ position: 'absolute', top: '24px', right: '28px', zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
              <button className="btn-glass-back" onClick={() => setLightboxUrl(null)}>
                <IconX size={18} />
                <span>Close</span>
              </button>
            </div>

            <img
              src={lightboxUrl}
              alt="Fullscreen View"
              className="lightbox-hero-image"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={handleLightboxLikeToggle}
            />

            <div
              style={{
                position: 'absolute',
                bottom: '28px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                zIndex: 10,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className={`btn-post-action ${isPhotoLiked ? 'liked' : ''}`}
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(20px)',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--glass-border-light)',
                  color: isPhotoLiked ? 'var(--heart-rose)' : '#fff',
                }}
                onClick={handleLightboxLikeToggle}
              >
                <IconHeart size={18} filled={isPhotoLiked} color={isPhotoLiked ? 'var(--heart-rose)' : 'currentColor'} />
                <span>{photoLikesCount}</span>
              </button>

              <button
                className="btn-glass-back"
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(20px)',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--glass-border-light)',
                }}
                onClick={() => {
                  navigator.clipboard?.writeText(lightboxUrl);
                  triggerToast('Photo URL copied to clipboard');
                }}
              >
                <IconLink size={16} />
                <span>Copy URL</span>
              </button>
            </div>
          </div>
        );
      })()}

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
                          compressImageFile(file, 1400, 0.85, (dataUrl) => {
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
                            compressImageFile(file, 1400, 0.82, (dataUrl) => {
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
                                compressImageFile(file, 400, 0.88, (dataUrl) => {
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
                                  className="btn-glass-back"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: '11.5px',
                                    color: '#f87171',
                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                  }}
                                  onClick={() => handleRemoveFollower(user.handle)}
                                  title="Remove from your followers"
                                >
                                  <IconTrash size={12} />
                                  <span>Remove</span>
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
                  triggerToast('All settings saved instantly!');
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
