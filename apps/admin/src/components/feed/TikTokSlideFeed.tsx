import React, { useState, useEffect, useRef } from 'react';
import './tiktokFeed.css';

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
  likesCount?: number;
  isLiked?: boolean;
  likersList?: string[];
  replies?: PostCommentReply[];
}

export const isUserLiked = (targetLikers?: string[], userHandle?: string | null): boolean => {
  if (!userHandle) return false;
  const clean = userHandle.replace(/^@/, '').toLowerCase().trim();
  if (!clean || !Array.isArray(targetLikers)) return false;
  return targetLikers.some((h) => (h || '').replace(/^@/, '').toLowerCase().trim() === clean);
};

export interface PostItem {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  isVerified: boolean;
  verifiedCategory?: string;
  verifiedSince?: string;
  cryptoProofId?: string;
  type: 'text' | 'image' | 'video';
  contentUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  soundName?: string;
  soundCover?: string;
  soundUrl?: string;
  soundArtist?: string;
  caption: string;
  tags: string[];
  privacy: 'close_friends' | 'followers' | 'public';
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isReposted?: boolean;
  likersList?: string[];
  timeAgo: string;
  comments: PostComment[];
}

export interface StoryItem {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  isVerified?: boolean;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  timeAgo: string;
  createdAt: number;
  privacy: 'close_friends' | 'followers' | 'public';
  likesCount?: number;
  isLiked?: boolean;
}

export const INITIAL_STORIES_V3: StoryItem[] = [];

export const isVideoMedia = (url?: string): boolean => {
  if (!url) return false;
  if (url.startsWith('data:video/')) return true;
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.mov') || clean.endsWith('.ogg');
};

export const MediaAvatar: React.FC<{
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  showBadge?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}> = ({ src, alt = 'Avatar', className = '', style, showBadge = true, onClick, title }) => {
  const isVid = isVideoMedia(src);
  if (isVid) {
    return (
      <div
        className={`media-avatar-container ${className}`}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
        onClick={onClick}
        title={title}
      >
        <video
          src={src}
          autoPlay
          loop
          muted
          playsInline
          className={`media-avatar-video ${className}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        />
        {showBadge && (
          <span className="media-avatar-gif-tag" title="Animated GIF Sticker">
            GIF
          </span>
        )}
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} style={style} onClick={onClick} title={title} />;
};

export interface ItunesTrack {
  id: number | string;
  trackName: string;
  artistName: string;
  artworkUrl: string;
  previewUrl: string;
  collectionName?: string;
  genre?: string;
}

export const DEFAULT_ITUNES_TRACKS: ItunesTrack[] = [
  {
    id: 'itunes-phonk-1',
    trackName: 'Brazilian Phonk Night Racing Pulse',
    artistName: 'PHONK, OCD F42',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b4/28/dc/b428dc15-dfc4-bb25-c525-1c314d4ff493/cover.jpg/100x100bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a2/9d/6e/a29d6ee7-34dc-a5d5-aab6-e2eb426dcf4e/mzaf_11998626548754457567.plus.aac.p.m4a',
    collectionName: 'Night Racing Pulse',
    genre: '🏎️ Phonk Drift',
  },
  {
    id: 'itunes-miami-1',
    trackName: 'Miami',
    artistName: 'Will Smith',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/83/86/2b/83862bab-beb9-5736-509e-74eb6f261e83/dj.qtjkodwa.jpg/100x100bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/91/32/83/913283b0-4e0d-ef0a-68c8-770b16d635be/mzaf_13116975505489704547.plus.aac.p.m4a',
    collectionName: 'Greatest Hits',
    genre: '🌴 Miami Vibes',
  },
  {
    id: 'itunes-trap-1',
    trackName: 'Starboy',
    artistName: 'The Weeknd ft. Daft Punk',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/0c/eb/54/0ceb545d-75e1-8848-8df0-e64e525a7a70/16UMGIM56422.rgb.jpg/100x100bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/b8/b5/e0/b8b5e0ee-5878-5a63-7186-b4bc48f3fb8f/mzaf_1170799797003463870.plus.aac.p.m4a',
    collectionName: 'Starboy',
    genre: '🔥 Top Hits',
  },
  {
    id: 'itunes-lofi-1',
    trackName: 'Aesthetic Lofi Study Chill',
    artistName: 'Lofi Fruits Music',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ef/a0/0b/efa00b65-ea9a-0e9e-56aa-a3ce25ee7a89/194491795057.jpg/100x100bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/71/61/8b/71618b76-47eb-fa2e-cb42-2b635677dca7/mzaf_15783307567888741369.plus.aac.p.m4a',
    collectionName: 'Lofi Chill Study',
    genre: '🎧 Lo-Fi Beats',
  },
  {
    id: 'itunes-latin-1',
    trackName: 'Tití Me Preguntó',
    artistName: 'Bad Bunny',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/3e/26/5a/3e265a6b-c743-34e8-4fd6-0814bbcefa69/196626945068.jpg/100x100bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/eb/fa/d7/ebfad7ea-31fa-e91b-689e-2708b50e5ee2/mzaf_6135688560064560183.plus.aac.p.m4a',
    collectionName: 'Un Verano Sin Ti',
    genre: '🌴 Latin Hits',
  },
];

export type SlideFeedChannel = 'live' | 'birdie' | 'circles' | 'following' | 'foryou';

export interface TikTokSlideFeedProps {
  posts: PostItem[];
  currentUser: {
    id?: string;
    name: string;
    handle: string;
    avatar: string;
  };
  followingMap?: Record<string, boolean>;
  closeFriendsList?: string[];
  deletedPostIds?: Set<string>;
  onLike: (postId: string, photoUrl?: string) => void;
  onSave: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onLikeComment?: (postId: string, commentId: string, replyId?: string) => void;
  onReplyComment?: (postId: string, commentId: string, text: string) => void;
  onDeleteComment?: (postId: string, commentId: string, replyId?: string) => void;
  onDeletePost?: (postId: string) => void;
  onRepostPost?: (postId: string) => void;
  onAddBirdiePost?: (caption: string, privacy: 'public' | 'followers' | 'close_friends') => void;
  onToggleFollow?: (handle: string) => void;
  onShare: (post: PostItem) => void;
  onOpenLive: () => void;
  onOpenCreate: () => void;
  onNavigateProfile: (handle: string) => void;
  onNavigateTab: (tab: 'feed' | 'discover' | 'messages' | 'profile') => void;
  currentNavTab?: 'feed' | 'discover' | 'messages' | 'profile';
  activeFilter?: 'foryou' | 'following' | 'circles' | 'birdie' | 'live';
  onSelectFilter?: (filter: 'foryou' | 'following' | 'circles' | 'birdie' | 'live') => void;
  onSwitchToCardView?: () => void;
  onUpdatePostSound?: (postId: string, sound: { name: string; artist: string; previewUrl: string; coverUrl?: string }) => void;
  onStoryReplyToDM?: (creatorHandle: string, messageText: string) => void;
  onAddNewPost?: (newPost: Partial<PostItem>) => void;
  onRefreshFeeds?: () => void;
  stories?: StoryItem[];
  onAddStory?: (story: StoryItem) => void;
  onDeleteStory?: (storyId: string) => void;
  onCommentsOpenChange?: (isOpen: boolean) => void;
  onStoryViewerOpenChange?: (isOpen: boolean) => void;
}

export interface StoryRailItem {
  id: string;
  handle: string;
  name: string;
  avatar: string;
  isAdd?: boolean;
  ringType: 'cf' | 'followers' | 'public' | 'add';
}

export const STORIES_DATA: StoryRailItem[] = [];

// 1. FOR YOU FEED: Real published dispatches only
export const EXCLUSIVE_FORYOU_POSTS: PostItem[] = [];

// 2. FOLLOWING FEED: Real published dispatches only
export const EXCLUSIVE_FOLLOWING_POSTS: PostItem[] = [];

// 3. CIRCLES FEED: Real published dispatches only
export const EXCLUSIVE_CIRCLES_POSTS: PostItem[] = [];

// 4. BIRDIE FEED: Real published dispatches only
export const EXCLUSIVE_BIRDIE_POSTS: PostItem[] = [];

export const TikTokSlideFeed: React.FC<TikTokSlideFeedProps> = ({
  posts,
  currentUser,
  followingMap = {},
  closeFriendsList: _closeFriendsList = [],
  deletedPostIds,
  onLike,
  onSave,
  onAddComment,
  onLikeComment,
  onReplyComment,
  onDeleteComment,
  onDeletePost,
  onRepostPost,
  onAddBirdiePost,
  onToggleFollow,
  onShare,
  onOpenLive,
  onOpenCreate: _onOpenCreate,
  onNavigateProfile,
  onNavigateTab: _onNavigateTab,
  currentNavTab: _currentNavTab = 'feed',
  activeFilter = 'foryou',
  onSelectFilter,
  onSwitchToCardView: _onSwitchToCardView,
  onUpdatePostSound,
  onStoryReplyToDM,
  onAddNewPost,
  onRefreshFeeds,
  stories: propStories,
  onAddStory,
  onDeleteStory,
  onCommentsOpenChange,
  onStoryViewerOpenChange,
}) => {
  // Channel Navigation: ['live', 'birdie', 'circles', 'following', 'foryou']
  const CHANNELS: SlideFeedChannel[] = ['live', 'birdie', 'circles', 'following', 'foryou'];

  const [activeChannel, setActiveChannel] = useState<SlideFeedChannel>(() => {
    if (activeFilter === 'circles') return 'circles';
    if (activeFilter === 'following') return 'following';
    if (activeFilter === 'birdie') return 'birdie';
    if (activeFilter === 'live') return 'live';
    return 'foryou';
  });

  // Real Audio Playback Engine
  const [isMuted, setIsMuted] = useState(false);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Helper to completely stop and reset all media audio immediately
  const stopAllAudio = () => {
    if (bgAudioRef.current) {
      bgAudioRef.current.pause();
      bgAudioRef.current.currentTime = 0;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setPreviewingTrackId(null);
    }
    Object.values(videoRefs.current).forEach((vid) => {
      if (vid) {
        vid.pause();
      }
    });
  };

  const resetFeedScroll = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    const birdieContainer = document.querySelector('.birdie-feed-scroll-container');
    if (birdieContainer) {
      birdieContainer.scrollTop = 0;
    }
  };

  const handleSelectChannel = (channel: SlideFeedChannel) => {
    stopAllAudio();
    setActiveChannel(channel);
    setActiveSlideIndex(0);
    resetFeedScroll();
    if (channel === 'live') {
      onOpenLive();
      return;
    }
    onSelectFilter?.(channel);
  };

  useEffect(() => {
    if (activeFilter) {
      const channel =
        activeFilter === 'circles' ? 'circles' :
        activeFilter === 'following' ? 'following' :
        activeFilter === 'birdie' ? 'birdie' :
        activeFilter === 'live' ? 'live' : 'foryou';
      if (channel !== activeChannel) {
        stopAllAudio();
        setActiveChannel(channel);
        setActiveSlideIndex(0);
        resetFeedScroll();
      }
    }
  }, [activeFilter]);

  // Followed creators map (clicking '+' button)
  const [followedMap, setFollowedMap] = useState<Record<string, boolean>>({});

  const isFollowed = (handle: string) => {
    const clean = handle.replace(/^@/, '').toLowerCase();
    return !!followedMap[handle] || !!followedMap[clean] || !!followingMap?.[handle] || !!followingMap?.[clean];
  };

  // Dedicated Stories System (Strictly separate from posts feeds)
  const birdieScrollRef = useRef<HTMLDivElement>(null);

  // Dedicated Story & Post Creator State
  const [creatorMode, setCreatorMode] = useState<'story' | 'post'>('post');
  const [postDraftCaption, setPostDraftCaption] = useState('');
  const [postDraftPrivacy, setPostDraftPrivacy] = useState<'public' | 'followers' | 'close_friends'>('public');

  // Pull-to-Refresh State
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isPullingRef = useRef(false);

  // Story Viewer Slide-Down Gesture State
  const [storyDragY, setStoryDragY] = useState(0);
  const [isDraggingStory, setIsDraggingStory] = useState(false);
  const storyTouchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [localStories, setLocalStories] = useState<StoryItem[]>(() => {
    const saved = localStorage.getItem('privity_stories_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_STORIES_V3;
  });

  const stories = propStories || localStories;
  const setStories = setLocalStories;
  const [isAddStoryModalOpen, setIsAddStoryModalOpen] = useState(false);
  const [storyDraftMediaUrl, setStoryDraftMediaUrl] = useState<string>('https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200');
  const [storyDraftMediaType, setStoryDraftMediaType] = useState<'image' | 'video'>('image');
  const [storyDraftCaption, setStoryDraftCaption] = useState<string>('');
  const [storyDraftPrivacy, setStoryDraftPrivacy] = useState<'close_friends' | 'followers' | 'public'>('close_friends');

  const [activeStoryViewerIndex, setActiveStoryViewerIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const [storyReplyText, setStoryReplyText] = useState('');

  // Dedicated Birdie Quick Composer State
  const [birdieDraftText, setBirdieDraftText] = useState('');
  const [birdieDraftPrivacy, setBirdieDraftPrivacy] = useState<'public' | 'followers' | 'close_friends'>('public');

  // Post Options Action Sheet (...) State
  const [activePostMenu, setActivePostMenu] = useState<PostItem | null>(null);

  // Replying target in slide-up comments drawer
  const [replyingToComment, setReplyingToComment] = useState<{ id: string; authorHandle: string; authorName: string } | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // VisionOS Glass Toast
  const [slideToastMsg, setSlideToastMsg] = useState<string | null>(null);
  const triggerSlideToast = (msg: string) => {
    setSlideToastMsg(msg);
    setTimeout(() => setSlideToastMsg(null), 2500);
  };

  // Filtered posts strictly according to user distribution intent:
  // - Birdie text posts stay STRICTLY within Birdie
  // - User-published photo/video dispatches appear in For You, Following, and Circles
  // - Stories NEVER enter post feeds (strictly Stories rail/viewer)
  // - Deleted posts never appear in any feed
  const displayPosts = React.useMemo(() => {
    const nonDeletedPosts = posts.filter((p) => !deletedPostIds?.has(p.id));

    const mergeOverrides = (baseList: PostItem[]) => {
      return baseList
        .filter((base) => !deletedPostIds?.has(base.id))
        .map((base) => {
          const live = nonDeletedPosts.find((p) => p.id === base.id);
          if (!live) return base;
          return {
            ...base,
            likesCount: live.likesCount ?? base.likesCount,
            isLiked: live.isLiked ?? base.isLiked,
            commentsCount: live.commentsCount ?? base.commentsCount,
            comments: live.comments ?? base.comments,
            savesCount: live.savesCount ?? base.savesCount,
            isSaved: live.isSaved ?? base.isSaved,
            sharesCount: live.sharesCount ?? base.sharesCount,
            isReposted: live.isReposted ?? (base as any).isReposted,
            soundName: live.soundName ?? base.soundName,
            soundArtist: live.soundArtist ?? base.soundArtist,
            soundUrl: live.soundUrl ?? base.soundUrl,
            soundCover: live.soundCover ?? base.soundCover,
          };
        });
    };

    const allExclusiveIds = new Set([
      ...EXCLUSIVE_FORYOU_POSTS.map((x) => x.id),
      ...EXCLUSIVE_FOLLOWING_POSTS.map((x) => x.id),
      ...EXCLUSIVE_CIRCLES_POSTS.map((x) => x.id),
      ...EXCLUSIVE_BIRDIE_POSTS.map((x) => x.id),
    ]);
    const customUserPosts = nonDeletedPosts.filter((p) => !allExclusiveIds.has(p.id));

    if (activeChannel === 'circles') {
      // Circles: User's visual posts + 100% exclusive circles creators
      const userMedia = customUserPosts.filter((p) => p.type !== 'text');
      return [...userMedia, ...mergeOverrides(EXCLUSIVE_CIRCLES_POSTS)];
    }

    if (activeChannel === 'following') {
      // Following: Posts from users the current user follows + own posts
      const myClean = (currentUser.handle || '').toLowerCase().replace(/^@/, '');
      const followingPosts = customUserPosts.filter((p) => {
        const authorClean = (p.authorHandle || '').toLowerCase().replace(/^@/, '');
        return authorClean === myClean || !!followingMap[authorClean] || !!followingMap[p.authorHandle];
      });
      return [...followingPosts, ...mergeOverrides(EXCLUSIVE_FOLLOWING_POSTS)];
    }

    if (activeChannel === 'birdie') {
      // Birdie: Text dispatches ONLY + exclusive birdie dispatches
      const userText = customUserPosts.filter((p) => p.type === 'text');
      return [...userText, ...mergeOverrides(EXCLUSIVE_BIRDIE_POSTS)];
    }

    // For You: Universal Community Feed - everybody on the platform sees what everyone posted!
    return [...customUserPosts, ...mergeOverrides(EXCLUSIVE_FORYOU_POSTS)];
  }, [posts, activeChannel, deletedPostIds]);

  // Active slide index tracked via IntersectionObserver / scroll position
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Play / Pause per post media
  const [pausedMap, setPausedMap] = useState<Record<string, boolean>>({});

  // Floating heart burst particles on double-tap
  const [burstHearts, setBurstHearts] = useState<Array<{ id: number; x: number; y: number; rot: number }>>([]);

  // Slide-up comments drawer
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Inline quick-replies for Birdie cards
  const [inlineReplyTexts, setInlineReplyTexts] = useState<Record<string, string>>({});

  const handleInlineReplySubmit = (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const text = (inlineReplyTexts[postId] || '').trim();
    if (!text) return;
    onAddComment(postId, text);
    setInlineReplyTexts((prev) => ({ ...prev, [postId]: '' }));
  };

  // Search overlay state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sound Hub Drawer State (free iTunes 30s previews)
  const [isSoundHubOpen, setIsSoundHubOpen] = useState(false);
  const [soundSearchTerm, setSoundSearchTerm] = useState('');
  const [soundTracks, setSoundTracks] = useState<ItunesTrack[]>(DEFAULT_ITUNES_TRACKS);
  const [isLoadingSounds, setIsLoadingSounds] = useState(false);
  const [previewingTrackId, setPreviewingTrackId] = useState<string | number | null>(null);

  // Broadcast overlay state to hide bottom navigation dock
  useEffect(() => {
    onCommentsOpenChange?.(Boolean(activeCommentsPostId) || isSoundHubOpen);
  }, [activeCommentsPostId, isSoundHubOpen, onCommentsOpenChange]);

  useEffect(() => {
    onStoryViewerOpenChange?.(activeStoryViewerIndex !== null || isAddStoryModalOpen);
  }, [activeStoryViewerIndex, isAddStoryModalOpen, onStoryViewerOpenChange]);

  // Active post for comments drawer & active slide
  const activeCommentPost = displayPosts.find((p) => p.id === activeCommentsPostId) || posts.find((p) => p.id === activeCommentsPostId);
  const activeCurrentPost = displayPosts[activeSlideIndex] || displayPosts[0] || posts[0];

  // ========================================================
  // SWIPE GESTURE CONTROLLER (TOUCH & MOUSE DRAG)
  // Swiping Right (→): Step backwards through tabs (For You -> Following -> Circles -> Birdie -> Live)
  // Swiping Left (←): Advance forwards (Live -> Birdie -> Circles -> Following -> For You)
  // CRITICAL SPEC: Swiping left ONLY goes to Creator Profile when at the end at 'foryou'!
  // ========================================================
  const touchStartPos = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const mouseStartPos = useRef<{ x: number; y: number; time: number; isDown: boolean }>({ x: 0, y: 0, time: 0, isDown: false });

  const onTouchStartHandler = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    handlePullStart(t.clientY, t.clientX);
  };

  const onTouchMoveHandler = (e: React.TouchEvent) => {
    const t = e.touches[0];
    handlePullMove(t.clientY, t.clientX);
  };

  const onTouchEndHandler = (e: React.TouchEvent, authorHandle?: string) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartPos.current.x;
    const dy = t.clientY - touchStartPos.current.y;

    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.08) {
      if (dx < -50) {
        // SWIPE LEFT (←)
        if (activeChannel === 'foryou') {
          // ONLY at the very end on 'foryou' does swiping left open the creator's profile!
          const handle = authorHandle || displayPosts[activeSlideIndex]?.authorHandle || activeCurrentPost?.authorHandle;
          if (handle) {
            stopAllAudio();
            onNavigateProfile(handle);
          }
        } else {
          // Advance rightwards in CHANNELS towards 'foryou'
          const currentIdx = CHANNELS.indexOf(activeChannel);
          if (currentIdx < CHANNELS.length - 1) {
            handleSelectChannel(CHANNELS[currentIdx + 1]);
          }
        }
      } else if (dx > 50) {
        // SWIPE RIGHT (→): Slide backwards towards 'live'
        const currentIdx = CHANNELS.indexOf(activeChannel);
        if (currentIdx > 0) {
          handleSelectChannel(CHANNELS[currentIdx - 1]);
        }
      }
    }
  };

  const onMouseDownHandler = (e: React.MouseEvent) => {
    mouseStartPos.current = { x: e.clientX, y: e.clientY, time: Date.now(), isDown: true };
  };

  const onMouseUpHandler = (e: React.MouseEvent, authorHandle?: string) => {
    if (!mouseStartPos.current.isDown) return;
    mouseStartPos.current.isDown = false;
    const dx = e.clientX - mouseStartPos.current.x;
    const dy = e.clientY - mouseStartPos.current.y;

    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.08) {
      if (dx < -52) {
        // SWIPE LEFT (←)
        if (activeChannel === 'foryou') {
          // ONLY at the very end on 'foryou' does swiping left open the creator's profile!
          const handle = authorHandle || displayPosts[activeSlideIndex]?.authorHandle || activeCurrentPost?.authorHandle;
          if (handle) {
            stopAllAudio();
            onNavigateProfile(handle);
          }
        } else {
          // Advance rightwards in CHANNELS towards 'foryou'
          const currentIdx = CHANNELS.indexOf(activeChannel);
          if (currentIdx < CHANNELS.length - 1) {
            handleSelectChannel(CHANNELS[currentIdx + 1]);
          }
        }
      } else if (dx > 52) {
        // SWIPE RIGHT (→): Slide backwards towards 'live'
        const currentIdx = CHANNELS.indexOf(activeChannel);
        if (currentIdx > 0) {
          handleSelectChannel(CHANNELS[currentIdx - 1]);
        }
      }
    }
  };

  // Video and audio sync intersection observer
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const options = {
      root: containerRef.current,
      threshold: 0.65,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = entry.target.getAttribute('data-post-id');
        const videoEl = postId ? videoRefs.current[postId] : null;

        if (entry.isIntersecting) {
          if (postId) {
            const index = displayPosts.findIndex((p) => p.id === postId);
            if (index !== -1) setActiveSlideIndex(index);
          }
          if (videoEl && !pausedMap[postId || '']) {
            videoEl.play().catch(() => {});
          }
        } else {
          if (videoEl) {
            videoEl.pause();
          }
        }
      });
    }, options);

    Object.values(slideRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [displayPosts, pausedMap]);

  // Synchronize Background Music with Active Slide & Mute state
  useEffect(() => {
    const bgAudio = bgAudioRef.current;
    if (!bgAudio) return;

    // In Birdie or Live, NEVER play background feed audio
    if (activeChannel === 'birdie' || activeChannel === 'live') {
      bgAudio.pause();
      bgAudio.currentTime = 0;
      return;
    }

    const post = displayPosts[activeSlideIndex];
    if (post?.soundUrl) {
      if (bgAudio.src !== post.soundUrl) {
        bgAudio.src = post.soundUrl;
      }
      bgAudio.loop = true;
      const isPaused = !!pausedMap[post.id];

      if (!isMuted && !isPaused) {
        bgAudio.play().catch(() => {});
      } else {
        bgAudio.pause();
      }
    } else {
      bgAudio.pause();
      bgAudio.currentTime = 0;
    }

    return () => {
      bgAudio.pause();
    };
  }, [activeSlideIndex, displayPosts, isMuted, pausedMap, activeChannel]);

  // Component unmount audio cleanup
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  // Story viewer slide-down to dismiss gesture
  const handleStoryTouchStart = (e: React.TouchEvent) => {
    setIsStoryPaused(true);
    const t = e.touches[0];
    storyTouchStartPos.current = { x: t.clientX, y: t.clientY };
    setIsDraggingStory(true);
  };

  const handleStoryTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingStory) return;
    const t = e.touches[0];
    const dy = t.clientY - storyTouchStartPos.current.y;
    const dx = t.clientX - storyTouchStartPos.current.x;
    if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      setStoryDragY(dy);
    }
  };

  const handleStoryTouchEnd = () => {
    setIsStoryPaused(false);
    setIsDraggingStory(false);
    if (storyDragY > 70) {
      setActiveStoryViewerIndex(null);
      setStoryDragY(0);
    } else {
      setStoryDragY(0);
    }
  };

  const handleStoryMouseDown = (e: React.MouseEvent) => {
    setIsStoryPaused(true);
    storyTouchStartPos.current = { x: e.clientX, y: e.clientY };
    setIsDraggingStory(true);
  };

  const handleStoryMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingStory) return;
    const dy = e.clientY - storyTouchStartPos.current.y;
    const dx = e.clientX - storyTouchStartPos.current.x;
    if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      setStoryDragY(dy);
    }
  };

  const handleStoryMouseUp = () => {
    setIsStoryPaused(false);
    setIsDraggingStory(false);
    if (storyDragY > 70) {
      setActiveStoryViewerIndex(null);
      setStoryDragY(0);
    } else {
      setStoryDragY(0);
    }
  };

  // Pull to refresh handlers
  const handlePullStart = (clientY: number, clientX: number) => {
    if (activeSlideIndex === 0 || (activeChannel === 'birdie' && (!birdieScrollRef.current || birdieScrollRef.current.scrollTop <= 0))) {
      touchStartPos.current = { x: clientX, y: clientY, time: Date.now() };
      isPullingRef.current = true;
    }
  };

  const handlePullMove = (clientY: number, clientX: number) => {
    if (!isPullingRef.current || isRefreshing) return;
    const dy = clientY - touchStartPos.current.y;
    const dx = clientX - touchStartPos.current.x;
    if (dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.15) {
      setPullDistance(Math.min(90, dy * 0.45));
    }
  };

  const handlePullEnd = () => {
    isPullingRef.current = false;
    if (pullDistance > 55 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(50);

      try {
        // Calling onRefreshFeeds notifies parent App to reload sovereign posts
        const savedStories = localStorage.getItem('privity_stories_v3');
        if (savedStories) {
          const parsed = JSON.parse(savedStories);
          if (Array.isArray(parsed) && parsed.length > 0) setStories(parsed);
        }
      } catch (e) {}

      if (onRefreshFeeds) onRefreshFeeds();
      triggerSlideToast('Feed refreshed with latest sovereign updates 🔄');

      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 650);
    } else {
      setPullDistance(0);
    }
  };

  // Keyboard Up / Down arrows for desktop snap navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIdx = Math.min(posts.length - 1, activeSlideIndex + 1);
        const targetEl = slideRefs.current[posts[nextIdx]?.id];
        targetEl?.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIdx = Math.max(0, activeSlideIndex - 1);
        const targetEl = slideRefs.current[posts[prevIdx]?.id];
        targetEl?.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleSound();
      } else if (e.key === 'Escape') {
        if (activeCommentsPostId) setActiveCommentsPostId(null);
        if (isSearchOpen) setIsSearchOpen(false);
        if (isSoundHubOpen) {
          setIsSoundHubOpen(false);
          stopPreview();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [posts, activeSlideIndex, activeCommentsPostId, isSearchOpen, isSoundHubOpen, isMuted]);

  // Toggle Sound ON / OFF
  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    const post = posts[activeSlideIndex];
    const bgAudio = bgAudioRef.current;
    if (!bgAudio) return;

    if (!nextMuted) {
      if (post?.soundUrl) {
        if (bgAudio.src !== post.soundUrl) {
          bgAudio.src = post.soundUrl;
        }
        bgAudio.play().catch(() => {});
      }
    } else {
      bgAudio.pause();
    }
  };

  // Toggle Video / Photo Play & Pause on Single Tap
  const handleTogglePlay = (postId: string) => {
    const video = videoRefs.current[postId];
    const bgAudio = bgAudioRef.current;
    const isThisActive = posts[activeSlideIndex]?.id === postId;

    if (video) {
      if (video.paused) {
        video.play().catch(() => {});
        setPausedMap((prev) => ({ ...prev, [postId]: false }));
        if (isThisActive && !isMuted && bgAudio) {
          bgAudio.play().catch(() => {});
        }
      } else {
        video.pause();
        setPausedMap((prev) => ({ ...prev, [postId]: true }));
        if (isThisActive && bgAudio) {
          bgAudio.pause();
        }
      }
    } else {
      const isCurrentlyPaused = !!pausedMap[postId];
      setPausedMap((prev) => ({ ...prev, [postId]: !isCurrentlyPaused }));
      if (isThisActive && bgAudio) {
        if (!isCurrentlyPaused) {
          bgAudio.pause();
        } else if (!isMuted) {
          bgAudio.play().catch(() => {});
        }
      }
    }
  };

  // Double-tap to Like with authentic TikTok bursting heart animation
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  const handleMediaTap = (e: React.MouseEvent, post: PostItem) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (now - lastTapRef.current.time < 320) {
      // Double Tap detected!
      if (!isUserLiked(post.likersList, currentUser?.handle)) {
        onLike(post.id, post.contentUrl || post.videoUrl);
      }
      // Trigger burst heart particle
      const newHeart = {
        id: Date.now() + Math.random(),
        x,
        y,
        rot: Math.random() * 40 - 20,
      };
      setBurstHearts((prev) => [...prev.slice(-6), newHeart]);
      setTimeout(() => {
        setBurstHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
      }, 950);
      lastTapRef.current = { time: 0, x: 0, y: 0 };
    } else {
      lastTapRef.current = { time: now, x, y };
      // Toggle play/pause on single tap
      setTimeout(() => {
        if (lastTapRef.current.time === now) {
          handleTogglePlay(post.id);
        }
      }, 330);
    }
  };

  // Follow creator action via the red '+' button
  const handleFollowClick = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    const clean = handle.replace(/^@/, '');
    const current = isFollowed(clean);
    const next = !current;
    setFollowedMap((prev) => ({
      ...prev,
      [handle]: next,
      [clean]: next,
      [clean.toLowerCase()]: next,
    }));
    onToggleFollow?.(clean);
  };

  // Add Comment or Reply submit
  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommentsPostId || !newCommentText.trim()) return;

    if (replyingToComment) {
      onReplyComment?.(activeCommentsPostId, replyingToComment.id, newCommentText.trim());
      setReplyingToComment(null);
    } else {
      onAddComment(activeCommentsPostId, newCommentText.trim());
    }
    setNewCommentText('');
  };

  // Publish Post submit
  const handlePublishPostSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!postDraftCaption.trim() && !storyDraftMediaUrl) return;

    const newPostItem: PostItem = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      authorId: 'usr-' + currentUser.handle.replace(/^@/, ''),
      authorName: currentUser.name,
      authorHandle: currentUser.handle,
      authorAvatar: currentUser.avatar,
      isVerified: true,
      type: storyDraftMediaType === 'video' ? 'video' : 'image',
      contentUrl: storyDraftMediaUrl || undefined,
      videoUrl: storyDraftMediaType === 'video' ? storyDraftMediaUrl : undefined,
      thumbnailUrl: storyDraftMediaUrl || undefined,
      caption: postDraftCaption.trim() || 'Visual sovereign dispatch 🌟',
      tags: ['#privity', '#creator'],
      privacy: postDraftPrivacy,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      timeAgo: 'Just now',
      comments: [],
    };

    if (onAddNewPost) {
      onAddNewPost(newPostItem);
    }

    setIsAddStoryModalOpen(false);
    setPostDraftCaption('');
    triggerSlideToast('Post published live across your feed! 🌟');
    setActiveSlideIndex(0);
  };

  // Add Story submit
  const handleAddStorySubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!storyDraftMediaUrl) return;

    const newStory: StoryItem = {
      id: `story-${Date.now()}`,
      authorName: currentUser.name,
      authorHandle: currentUser.handle,
      authorAvatar: currentUser.avatar,
      isVerified: true,
      mediaUrl: storyDraftMediaUrl,
      mediaType: storyDraftMediaType,
      caption: storyDraftCaption,
      timeAgo: 'Just now',
      createdAt: Date.now(),
      privacy: storyDraftPrivacy,
      likesCount: 0,
      isLiked: false,
    };

    if (onAddStory) {
      onAddStory(newStory);
    } else {
      const nextStories = [newStory, ...stories];
      setStories(nextStories);
      try {
        localStorage.setItem('privity_stories_v3', JSON.stringify(nextStories));
      } catch (e) {}
    }
    setIsAddStoryModalOpen(false);
    setStoryDraftCaption('');
    triggerSlideToast('Story shared to your circle! ⭕');
  };

  // Delete Story
  const handleDeleteStory = (storyId: string) => {
    const updatedStories = stories.filter((s) => s.id !== storyId);
    if (onDeleteStory) {
      onDeleteStory(storyId);
    } else {
      setStories(updatedStories);
      try {
        localStorage.setItem('privity_stories_v3', JSON.stringify(updatedStories));
      } catch (e) {}
    }
    triggerSlideToast('Story removed');
    if (activeStoryViewerIndex !== null) {
      if (updatedStories.length === 0) {
        setActiveStoryViewerIndex(null);
      } else if (activeStoryViewerIndex >= updatedStories.length) {
        setActiveStoryViewerIndex(updatedStories.length - 1);
      }
    }
  };

  // Story Viewer Timer Effect (6s auto-advancing, pause on hold)
  useEffect(() => {
    if (activeStoryViewerIndex === null) {
      setStoryProgress(0);
      return;
    }
    if (isStoryPaused) return;

    const stepMs = 50;
    const totalDurationMs = 6000;
    const increment = (stepMs / totalDurationMs) * 100;

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev >= 100) {
          if (activeStoryViewerIndex < stories.length - 1) {
            setActiveStoryViewerIndex((curr) => (curr !== null ? curr + 1 : null));
            return 0;
          } else {
            setActiveStoryViewerIndex(null);
            return 0;
          }
        }
        return prev + increment;
      });
    }, stepMs);

    return () => clearInterval(timer);
  }, [activeStoryViewerIndex, isStoryPaused, stories.length]);

  // iTunes Free 30-Second Music Preview Search
  const searchItunes = async (query: string) => {
    setSoundSearchTerm(query);
    if (!query.trim()) {
      setSoundTracks(DEFAULT_ITUNES_TRACKS);
      return;
    }
    setIsLoadingSounds(true);
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`
      );
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        const mapped: ItunesTrack[] = data.results.map((r: any) => ({
          id: r.trackId,
          trackName: r.trackName,
          artistName: r.artistName,
          artworkUrl: r.artworkUrl100 || r.artworkUrl60,
          previewUrl: r.previewUrl,
          collectionName: r.collectionName,
          genre: r.primaryGenreName,
        }));
        setSoundTracks(mapped);
      }
    } catch (err) {
      console.warn('iTunes free search error:', err);
    } finally {
      setIsLoadingSounds(false);
    }
  };

  // Toggle preview of an iTunes sample in the Sound Hub
  const togglePreviewTrack = (track: ItunesTrack) => {
    const prevAudio = previewAudioRef.current;
    if (!prevAudio) return;

    if (previewingTrackId === track.id) {
      prevAudio.pause();
      setPreviewingTrackId(null);
    } else {
      prevAudio.src = track.previewUrl;
      prevAudio.play().catch(() => {});
      setPreviewingTrackId(track.id);
    }
  };

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPreviewingTrackId(null);
    }
  };

  // Apply chosen real sound to the active post
  const handleApplySound = (track: ItunesTrack) => {
    stopPreview();
    const currentPost = posts[activeSlideIndex];
    if (!currentPost) return;

    if (bgAudioRef.current) {
      bgAudioRef.current.src = track.previewUrl;
      bgAudioRef.current.loop = true;
      setIsMuted(false);
      bgAudioRef.current.play().catch(() => {});
    }

    onUpdatePostSound?.(currentPost.id, {
      name: track.trackName,
      artist: track.artistName,
      previewUrl: track.previewUrl,
      coverUrl: track.artworkUrl,
    });

    setIsSoundHubOpen(false);
  };

  return (
    <div className="tiktok-feed-wrapper">
      {/* Background loop audio element */}
      <audio ref={bgAudioRef} loop preload="auto" />
      {/* Sound Hub preview audio element */}
      <audio ref={previewAudioRef} preload="auto" onEnded={() => setPreviewingTrackId(null)} />

      {/* ======================================================== */}
      {/* 1. TOP FLOATING NAVIGATION BAR (CLEAN, ICON-FIRST TABS) */}
      {/* ======================================================== */}
      <header className={`tiktok-top-header ${activeChannel === 'birdie' ? 'solid-header' : ''}`}>
        {/* Left: TV LIVE Button */}
        <button
          type="button"
          className={`tiktok-top-live-btn ${activeChannel === 'live' ? 'active' : ''}`}
          onClick={() => handleSelectChannel('live')}
          title="Open LIVE Rooms & Arena"
          aria-label="LIVE Stream"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="tiktok-live-tv-icon">
            <rect x="2" y="5" width="20" height="15" rx="4" stroke="#ffffff" strokeWidth="2" />
            <path d="M7 2L10 5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <path d="M17 2L14 5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <text
              x="12"
              y="15.5"
              fill="#ffffff"
              fontSize="6.8"
              fontWeight="900"
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
              textAnchor="middle"
              letterSpacing="0.4"
            >
              LIVE
            </text>
          </svg>
        </button>

        {/* Center Tabs: Birdie (🐦) | Circles | Following | For You */}
        <div className="tiktok-top-tabs">
          {/* 1. Birdie with sleek bird icon */}
          <button
            type="button"
            className={`tiktok-top-tab birdie-tab ${activeChannel === 'birdie' ? 'active' : ''}`}
            onClick={() => handleSelectChannel('birdie')}
            title="Birdie · Thought & Text Feed"
            aria-label="Birdie"
          >
            <span className="birdie-tab-inner">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="birdie-nav-svg">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
              </svg>
              <span className="birdie-text-label">Birdie</span>
            </span>
            {activeChannel === 'birdie' && <span className="tiktok-tab-indicator birdie-indicator" />}
          </button>

          {/* 2. Circles */}
          <button
            type="button"
            className={`tiktok-top-tab ${activeChannel === 'circles' ? 'active' : ''}`}
            onClick={() => handleSelectChannel('circles')}
            title="Close Friends Circle"
          >
            <span>Circles</span>
            {activeChannel === 'circles' && <span className="tiktok-tab-indicator" />}
          </button>

          {/* 3. Following */}
          <button
            type="button"
            className={`tiktok-top-tab ${activeChannel === 'following' ? 'active' : ''}`}
            onClick={() => handleSelectChannel('following')}
            title="Creators You Follow"
          >
            <span>Following</span>
            {activeChannel === 'following' && <span className="tiktok-tab-indicator" />}
          </button>

          {/* 4. For You (Strict single-line nowrap guarantee) */}
          <button
            type="button"
            className={`tiktok-top-tab ${activeChannel === 'foryou' ? 'active' : ''}`}
            onClick={() => handleSelectChannel('foryou')}
            title="For You Feed"
          >
            <span style={{ whiteSpace: 'nowrap' }}>For You</span>
            {activeChannel === 'foryou' && <span className="tiktok-tab-indicator" />}
          </button>
        </div>

        {/* Right: Search 🔍 Button ONLY (volume button & grid box completely removed) */}
        <div className="tiktok-top-right-actions">
          <button
            type="button"
            className="tiktok-top-search-btn"
            onClick={() => setIsSearchOpen(true)}
            title="Search creators, sounds, hashtags"
            aria-label="Search"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. CHANNEL VIEWS: BIRDIE (TEXT-FIRST) vs SLIDE FEED     */}
      {/* ======================================================== */}
      {activeChannel === 'birdie' ? (
        /* BIRDIE MICROBLOGGING FEED (MATCHING SCREENSHOT 2) */
        <div
          className="birdie-feed-scroll-container"
          ref={birdieScrollRef}
          onTouchStart={onTouchStartHandler}
          onTouchMove={onTouchMoveHandler}
          onTouchEnd={(e) => {
            handlePullEnd();
            onTouchEndHandler(e);
          }}
          onMouseDown={onMouseDownHandler}
          onMouseUp={(e) => onMouseUpHandler(e)}
        >
          {/* Integrated Dedicated Stories & Circles Rail at top of Birdie */}
          <div className="birdie-story-rail">
            {/* 1. User Story Unit */}
            <div
              className="birdie-story-unit user-story-unit"
              onClick={() => {
                if (_onOpenCreate) {
                  _onOpenCreate();
                } else {
                  setIsAddStoryModalOpen(true);
                }
              }}
              title="Your Story - Open Studio Camera"
            >
              <div className={`birdie-story-halo ${stories.some((s) => s.authorHandle === currentUser.handle) ? 'cf active-story' : 'add'}`}>
                <MediaAvatar src={currentUser.avatar} alt={currentUser.name} className="birdie-story-avatar" showBadge={false} />
                <button
                  type="button"
                  className="birdie-story-plus-badge"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (_onOpenCreate) {
                      _onOpenCreate();
                    } else {
                      setIsAddStoryModalOpen(true);
                    }
                  }}
                  title="Add Story via Studio Camera"
                >
                  <span>+</span>
                </button>
              </div>
              <span className="birdie-story-name">Your Story</span>
            </div>

            {/* Other Creator Stories */}
            {stories
              .filter((s) => s.authorHandle !== currentUser.handle)
              .map((story) => (
                <div
                  key={story.id}
                  className="birdie-story-unit"
                  onClick={() => {
                    const idx = stories.findIndex((s) => s.id === story.id);
                    stopAllAudio();
                    setActiveStoryViewerIndex(idx);
                  }}
                  title={`View @${story.authorHandle}'s Story`}
                >
                  <div className={`birdie-story-halo ${story.privacy === 'close_friends' ? 'cf' : story.privacy === 'followers' ? 'followers' : 'public'}`}>
                    <MediaAvatar src={story.authorAvatar} alt={story.authorName} className="birdie-story-avatar" showBadge={false} />
                  </div>
                  <span className="birdie-story-name">{story.authorName.split(' ')[0]}</span>
                </div>
              ))}
          </div>

          {/* Dedicated Birdie Quick-Composer Bar */}
          <div className="birdie-quick-composer-card">
            <div className="birdie-quick-composer-top">
              <MediaAvatar
                src={currentUser.avatar}
                alt={currentUser.name}
                className="birdie-quick-composer-avatar"
              />
              <textarea
                className="birdie-quick-composer-textarea"
                placeholder={`What's on your sovereign mind, ${currentUser.name.split(' ')[0]}? Chirp a thought to Birdie...`}
                value={birdieDraftText}
                onChange={(e) => setBirdieDraftText(e.target.value)}
                rows={2}
                maxLength={280}
              />
            </div>
            <div className="birdie-quick-composer-bottom">
              <div className="birdie-quick-composer-left">
                <button
                  type="button"
                  className={`birdie-privacy-select-btn ${birdieDraftPrivacy}`}
                  onClick={() => {
                    setBirdieDraftPrivacy((prev) =>
                      prev === 'public' ? 'followers' : prev === 'followers' ? 'close_friends' : 'public'
                    );
                  }}
                  title="Audience Selector"
                >
                  {birdieDraftPrivacy === 'close_friends' ? (
                    <>⭐ Close Friends</>
                  ) : birdieDraftPrivacy === 'followers' ? (
                    <>🔒 Followers</>
                  ) : (
                    <>🌐 Public</>
                  )}
                </button>
                <span className="birdie-char-counter">{280 - birdieDraftText.length}</span>
              </div>
              <button
                type="button"
                className="birdie-quick-publish-btn"
                disabled={!birdieDraftText.trim()}
                onClick={() => {
                  if (!birdieDraftText.trim()) return;
                  onAddBirdiePost?.(birdieDraftText.trim(), birdieDraftPrivacy);
                  setBirdieDraftText('');
                  triggerSlideToast('Chirped to Birdie! 🐦');
                }}
              >
                <span>Chirp 🐦</span>
              </button>
            </div>
          </div>

          {displayPosts.length === 0 ? (
            <div className="feed-empty-state-box" style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.7)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🐦</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>No thoughts chirped yet</h3>
              <p style={{ fontSize: '14px', maxWidth: '340px', margin: '0 auto 20px', color: 'rgba(255,255,255,0.6)' }}>
                Your private Birdie feed is pristine. Type your first thought in the box above to chirp to your trusted circle!
              </p>
            </div>
          ) : (
            displayPosts.map((post) => {
            const isLiked = isUserLiked(post.likersList, currentUser?.handle);
            const isSaved = !!post.isSaved;
            const replyText = inlineReplyTexts[post.id] || '';

            return (
              <article
                key={post.id}
                className="birdie-post-card"
                onTouchStart={onTouchStartHandler}
                onTouchEnd={(e) => onTouchEndHandler(e, post.authorHandle)}
                onMouseDown={onMouseDownHandler}
                onMouseUp={(e) => onMouseUpHandler(e, post.authorHandle)}
              >
                {/* Author Header Row */}
                <div className="birdie-card-header">
                  <MediaAvatar
                    src={post.authorAvatar}
                    alt={post.authorName}
                    className="birdie-author-avatar"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateProfile(post.authorHandle);
                    }}
                    title={`View @${post.authorHandle}`}
                  />
                  <div className="birdie-author-meta">
                    <div className="birdie-meta-top-row">
                      <div
                        className="birdie-author-name-group"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateProfile(post.authorHandle);
                        }}
                      >
                        <span className="birdie-author-display-name">{post.authorName}</span>
                        {post.isVerified && (
                          <span className="birdie-blue-badge" title="Verified Creator">
                            ✓
                          </span>
                        )}
                      </div>

                      {/* Audience Badge */}
                      <span
                        className={`birdie-privacy-badge ${
                          post.privacy === 'close_friends' ? 'close_friends' : post.privacy === 'followers' ? 'followers' : 'public'
                        }`}
                      >
                        {post.privacy === 'close_friends' ? (
                          <>★ Close Friends</>
                        ) : post.privacy === 'followers' ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            Followers Only
                          </>
                        ) : (
                          <>🌐 Public</>
                        )}
                      </span>
                    </div>

                    <div className="birdie-handle-timestamp">
                      @{post.authorHandle} · {post.timeAgo}
                    </div>
                  </div>
                </div>

                {/* Post Body Narrative with Hashtags */}
                <div className="birdie-post-body">
                  {post.caption.split(/(\s+)/).map((segment, sIdx) => {
                    if (segment.startsWith('#')) {
                      return (
                        <span key={sIdx} className="birdie-hashtag-link" onClick={(e) => e.stopPropagation()}>
                          {segment}
                        </span>
                      );
                    }
                    return segment;
                  })}
                </div>

                {/* Birdie Post Media Attachment (Photo or Video) */}
                {(post.videoUrl || (post.type === 'video' && post.contentUrl) || isVideoMedia(post.contentUrl)) ? (
                  <div className="birdie-post-media-container" style={{ marginTop: '10px', borderRadius: '12px', overflow: 'hidden', background: '#000', maxHeight: '420px' }}>
                    <video
                      src={post.videoUrl || post.contentUrl}
                      controls
                      playsInline
                      loop
                      style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                ) : (post.contentUrl || post.thumbnailUrl) ? (
                  <div
                    className="birdie-post-media-container"
                    style={{ marginTop: '10px', borderRadius: '12px', overflow: 'hidden', maxHeight: '420px', cursor: 'pointer' }}
                    onClick={() => onLike(post.id, post.contentUrl || post.thumbnailUrl)}
                  >
                    <img
                      src={post.contentUrl || post.thumbnailUrl}
                      alt={post.caption || 'Dispatch photo'}
                      style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                ) : null}

                {/* Action Buttons Row */}
                <div className="birdie-actions-bar" onClick={(e) => e.stopPropagation()}>
                  {/* Like Button */}
                  <button
                    type="button"
                    className={`birdie-action-btn ${isLiked ? 'liked' : ''}`}
                    onClick={() => onLike(post.id, post.contentUrl || post.videoUrl)}
                    title={isLiked ? 'Unlike' : 'Like'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={isLiked ? '#fe2c55' : 'none'} stroke={isLiked ? '#fe2c55' : 'currentColor'} strokeWidth="2">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span>{post.likesCount}</span>
                  </button>

                  {/* Comment Button */}
                  <button
                    type="button"
                    className="birdie-action-btn"
                    onClick={() => setActiveCommentsPostId(post.id)}
                    title="View Comments"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>{post.commentsCount}</span>
                  </button>

                  {/* Repost Button */}
                  <button
                    type="button"
                    className={`birdie-action-btn ${post.isReposted ? 'reposted' : ''}`}
                    onClick={() => onRepostPost?.(post.id)}
                    title={post.isReposted ? 'Undo Repost' : 'Repost to your circle'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={post.isReposted ? '#10b981' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <polyline points="7 23 3 19 7 15" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    <span>{post.sharesCount || 0}</span>
                  </button>

                  {/* Bookmark Button */}
                  <button
                    type="button"
                    className={`birdie-action-btn ${isSaved ? 'saved' : ''}`}
                    onClick={() => onSave(post.id)}
                    title={isSaved ? 'Remove Bookmark' : 'Bookmark'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={isSaved ? '#face15' : 'none'} stroke={isSaved ? '#face15' : 'currentColor'} strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                  </button>

                  {/* More Options Button (Three Dots) */}
                  <button
                    type="button"
                    className="birdie-action-btn"
                    onClick={() => setActivePostMenu(post)}
                    title="Dispatch options"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="1.5"/>
                      <circle cx="19" cy="12" r="1.5"/>
                      <circle cx="5" cy="12" r="1.5"/>
                    </svg>
                  </button>
                </div>

                {/* Real Social Proof Bar (shown only when post has real likes) */}
                {post.likesCount > 0 && (
                  <div className="birdie-social-proof-bar" onClick={(e) => e.stopPropagation()}>
                    <div className="birdie-proof-text">
                      ❤️ Liked by <strong>{post.likesCount}</strong> {post.likesCount === 1 ? 'supporter' : 'supporters'}
                    </div>
                  </div>
                )}

                {/* Inline Thoughtful Reply Form (Signature Privity Spec) */}
                <div className="birdie-reply-section" onClick={(e) => e.stopPropagation()}>
                  <MediaAvatar src={currentUser.avatar} alt={currentUser.name} className="birdie-reply-user-avatar" />
                  <form className="birdie-reply-form" onSubmit={(e) => handleInlineReplySubmit(e, post.id)}>
                    <input
                      type="text"
                      className="birdie-reply-input"
                      placeholder="Add a thoughtful reply..."
                      value={replyText}
                      onChange={(e) => setInlineReplyTexts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                    />
                    <button type="submit" className="birdie-send-btn" disabled={!replyText.trim()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Send
                    </button>
                  </form>
                </div>
              </article>
            );
          }))}
        </div>
      ) : (
        /* FULLSCREEN VERTICAL SNAP-SCROLL SLIDES CONTAINER (FOR YOU / FOLLOWING / CIRCLES) */
        <div
          className="tiktok-slides-container"
          ref={containerRef}
          onTouchStart={onTouchStartHandler}
          onTouchEnd={(e) => onTouchEndHandler(e)}
          onMouseDown={onMouseDownHandler}
          onMouseUp={(e) => onMouseUpHandler(e)}
        >
          {displayPosts.length === 0 ? (
            <div className="tiktok-slide-empty-state" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 24px', boxSizing: 'border-box' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', marginBottom: '20px' }}>
                📸
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', marginBottom: '10px' }}>
                {activeChannel === 'circles' ? 'No Circles Dispatches Yet' : activeChannel === 'following' ? 'No Following Dispatches Yet' : 'No Dispatches Yet'}
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', maxWidth: '320px', lineHeight: 1.5, marginBottom: '28px' }}>
                {activeChannel === 'circles'
                  ? 'Your close friends circle is peaceful and clean. Share a private dispatch with your inner circle!'
                  : activeChannel === 'following'
                  ? 'Creators you follow will appear here. Start sharing your own dispatches!'
                  : 'Be the first to publish a private photo, video, or dispatch to the Privity network!'}
              </p>
              <button
                type="button"
                onClick={_onOpenCreate}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 28px',
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                }}
              >
                <span>+ Create First Dispatch</span>
              </button>
            </div>
          ) : (
            displayPosts.map((post) => {
            const isVideo = post.type === 'video' || !!post.videoUrl;
            const mediaUrl = post.videoUrl || post.contentUrl || post.thumbnailUrl || '';
            const isPaused = !!pausedMap[post.id];
            const isFollowed = !!followedMap[post.authorHandle];

            return (
              <div
                key={post.id}
                className="tiktok-slide-item"
                data-post-id={post.id}
                ref={(el) => { slideRefs.current[post.id] = el; }}
                onTouchStart={onTouchStartHandler}
                onTouchEnd={(e) => onTouchEndHandler(e, post.authorHandle)}
                onMouseDown={onMouseDownHandler}
                onMouseUp={(e) => onMouseUpHandler(e, post.authorHandle)}
              >
                {/* Media Container (Video or Photo) with Double-Tap to Like */}
                <div
                  className="tiktok-media-viewport"
                  onClick={(e) => handleMediaTap(e, post)}
                >
                  {isVideo ? (
                    <video
                      ref={(el) => { videoRefs.current[post.id] = el; }}
                      src={mediaUrl}
                      poster={post.thumbnailUrl || post.contentUrl}
                      className="tiktok-video-player"
                      loop
                      playsInline
                      webkit-playsinline="true"
                      muted={false}
                    />
                  ) : mediaUrl ? (
                    <img
                      src={mediaUrl}
                      alt={post.caption}
                      className="tiktok-photo-player"
                    />
                  ) : (
                    <div className="tiktok-text-dispatch-viewport">
                      <div className="tiktok-text-dispatch-card">
                        <span className="tiktok-text-quote-mark">“</span>
                        <p className="tiktok-text-content">{post.caption || 'Authentic dispatch'}</p>
                        <div className="tiktok-text-author-badge">
                          <span>@{post.authorHandle.replace(/^@/, '')}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cinematic Top & Bottom Vignette Tint Scrim */}
                  <div className="tiktok-scrim-overlay" />

                  {/* Pause Indicator overlay (when video is paused by single tap) */}
                  {isPaused && (
                    <div className="tiktok-pause-indicator">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  )}

                  {/* Floating Double-Tap Hearts */}
                  {burstHearts.map((heart) => (
                    <div
                      key={heart.id}
                      className="tiktok-burst-heart"
                      style={{
                        left: `${heart.x}px`,
                        top: `${heart.y}px`,
                        transform: `translate(-50%, -50%) rotate(${heart.rot}deg)`,
                      }}
                    >
                      <svg width="76" height="76" viewBox="0 0 24 24" fill="#fe2c55">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                    </div>
                  ))}
                </div>

                {/* ==================================================== */}
                {/* RIGHT ACTION RAIL                                    */}
                {/* ==================================================== */}
                <div className="tiktok-right-rail" onClick={(e) => e.stopPropagation()}>
                  {/* 1. Creator Avatar with Centered Red Plus (+) Button */}
                  <div
                    className="tiktok-rail-avatar-container"
                    onClick={() => onNavigateProfile(post.authorHandle)}
                    title={`View @${post.authorHandle}`}
                  >
                    <MediaAvatar
                      src={post.authorAvatar}
                      alt={post.authorName}
                      className="tiktok-rail-avatar-img"
                    />
                    {!isFollowed && (
                      <button
                        type="button"
                        className="tiktok-rail-plus-btn"
                        onClick={(e) => handleFollowClick(e, post.authorHandle)}
                        title={`Follow ${post.authorName}`}
                        aria-label="Follow"
                      >
                        <span className="tiktok-plus-sign">+</span>
                      </button>
                    )}
                    {isFollowed && (
                      <span className="tiktok-rail-followed-badge">✓</span>
                    )}
                  </div>

                  {/* 2. Heart / Like Button */}
                  {(() => {
                    const isPostLiked = isUserLiked(post.likersList, currentUser?.handle);
                    const likesDisplay = (post.likesCount || 0) >= 1000 ? `${((post.likesCount || 0) / 1000).toFixed(1)}k` : (post.likesCount || 0);
                    return (
                      <button
                        type="button"
                        className={`tiktok-rail-btn like ${isPostLiked ? 'liked' : ''}`}
                        onClick={() => onLike(post.id, post.contentUrl || post.videoUrl)}
                        title={isPostLiked ? 'Unlike' : 'Like'}
                        aria-label="Like"
                      >
                        <div className="tiktok-icon-wrap">
                          <svg width="34" height="34" viewBox="0 0 24 24" fill={isPostLiked ? "#fe2c55" : "#ffffff"} className="tiktok-rail-icon">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                          </svg>
                        </div>
                        <span className="tiktok-rail-count">
                          {likesDisplay}
                        </span>
                      </button>
                    );
                  })()}

                  {/* 3. Comment Speech Bubble Button */}
                  <button
                    type="button"
                    className="tiktok-rail-btn comment"
                    onClick={() => setActiveCommentsPostId(post.id)}
                    title="View comments"
                    aria-label="Comments"
                  >
                    <div className="tiktok-icon-wrap">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="#ffffff" className="tiktok-rail-icon">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                        <circle cx="8" cy="10" r="1.5" fill="#12131e" />
                        <circle cx="12" cy="10" r="1.5" fill="#12131e" />
                        <circle cx="16" cy="10" r="1.5" fill="#12131e" />
                      </svg>
                    </div>
                    <span className="tiktok-rail-count">
                      {post.commentsCount >= 1000 ? `${(post.commentsCount / 1000).toFixed(1)}k` : post.commentsCount}
                    </span>
                  </button>

                  {/* 4. Bookmark / Favorite Button */}
                  <button
                    type="button"
                    className={`tiktok-rail-btn bookmark ${post.isSaved ? 'saved' : ''}`}
                    onClick={() => onSave(post.id)}
                    title={post.isSaved ? 'Remove from favorites' : 'Add to favorites'}
                    aria-label="Bookmark"
                  >
                    <div className="tiktok-icon-wrap">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill={post.isSaved ? "#face15" : "#ffffff"} className="tiktok-rail-icon">
                        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                      </svg>
                    </div>
                    <span className="tiktok-rail-count">
                      {post.savesCount >= 1000 ? `${(post.savesCount / 1000).toFixed(1)}k` : post.savesCount}
                    </span>
                  </button>

                  {/* 5. Curved Share Arrow Button */}
                  <button
                    type="button"
                    className="tiktok-rail-btn share"
                    onClick={() => onShare(post)}
                    title="Share post"
                    aria-label="Share"
                  >
                    <div className="tiktok-icon-wrap">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="#ffffff" className="tiktok-rail-icon">
                        <path d="M14 5v4C7 10 4 15 3 20c2.5-3.5 6-5.1 11-5.1V19l8-7-8-7z"/>
                      </svg>
                    </div>
                    <span className="tiktok-rail-count">
                      {post.sharesCount >= 1000 ? `${(post.sharesCount / 1000).toFixed(1)}k` : post.sharesCount}
                    </span>
                  </button>

                  {/* 5b. Three-dots More Options Button */}
                  <button
                    type="button"
                    className="tiktok-rail-btn more"
                    onClick={() => setActivePostMenu(post)}
                    title="Dispatch options"
                    aria-label="Options"
                  >
                    <div className="tiktok-icon-wrap">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff" className="tiktok-rail-icon">
                        <circle cx="12" cy="12" r="2"/>
                        <circle cx="12" cy="5" r="2"/>
                        <circle cx="12" cy="19" r="2"/>
                      </svg>
                    </div>
                  </button>

                  {/* 6. Rotating Vinyl Sound Record */}
                  <div
                    className={`tiktok-rail-sound-disc ${isPaused ? 'paused' : 'spinning'}`}
                    title={`Sound: ${post.soundName || 'Original Sound'} · Click for Sound Hub`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSoundHubOpen(true);
                    }}
                  >
                    <div className="tiktok-vinyl-ring-outer">
                      <img
                        src={post.soundCover || post.authorAvatar}
                        alt="Sound Cover"
                        className="tiktok-vinyl-album-cover"
                      />
                    </div>
                    {/* Floating music note particles */}
                    <span className="tiktok-floating-music-note note-1">♪</span>
                    <span className="tiktok-floating-music-note note-2">♫</span>
                  </div>
                </div>

                {/* ==================================================== */}
                {/* BOTTOM LEFT CREATOR & CAPTION OVERLAY                */}
                {/* ==================================================== */}
                <div className="tiktok-bottom-left-info" onClick={(e) => e.stopPropagation()}>
                  {/* Author Handle & Name */}
                  <div
                    className="tiktok-author-heading"
                    onClick={() => onNavigateProfile(post.authorHandle)}
                  >
                    <span className="tiktok-author-name">{post.authorName}</span>
                    {post.isVerified && (
                      <span className="tiktok-verified-badge" title="Verified Creator">
                        ✓
                      </span>
                    )}
                    {post.privacy !== 'public' && (
                      <span className="tiktok-privacy-tag">
                        {post.privacy === 'close_friends' ? '⭐ Close Friends' : '🔒 Followers'}
                      </span>
                    )}
                  </div>

                  {/* Post Narrative / Caption with Inline Hashtags */}
                  <p className="tiktok-caption-paragraph">
                    {post.caption.split(/(\s+)/).map((segment, sIdx) => {
                      if (segment.startsWith('#')) {
                        return (
                          <span key={sIdx} className="tiktok-inline-hashtag">
                            {segment}
                          </span>
                        );
                      }
                      return segment;
                    })}
                  </p>

                  {/* Interactive Sound Marquee Pill */}
                  <div
                    className="tiktok-sound-pill"
                    onClick={() => setIsSoundHubOpen(true)}
                    title="Search audio on Apple Music / iTunes and change sound"
                  >
                    <span className="tiktok-sound-icon">🎵</span>
                    <div className="tiktok-sound-ticker-wrap">
                      <span className="tiktok-sound-ticker-text">
                        {post.soundName ? `${post.soundName} ${post.soundArtist ? `· ${post.soundArtist}` : ''}` : 'Brazilian Phonk · Miami Night Pulse'}
                      </span>
                    </div>
                    <span className="tiktok-sound-chevron">&gt;</span>
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      )}

      
      {/* ======================================================== */}
      {/* 6. SLIDE-UP COMMENTS DRAWER (TIKTOK STYLE)               */}
      {/* ======================================================== */}
      {activeCommentsPostId && activeCommentPost && (
        <div className="tiktok-comments-drawer-backdrop" onClick={() => { setActiveCommentsPostId(null); setReplyingToComment(null); }}>
          <div className="tiktok-comments-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="tiktok-comments-drawer-header">
              <div className="tiktok-comments-drawer-count">
                {activeCommentPost.commentsCount || activeCommentPost.comments.length} comments
              </div>
              <button
                type="button"
                className="tiktok-comments-close-btn"
                onClick={() => { setActiveCommentsPostId(null); setReplyingToComment(null); }}
              >
                ✕
              </button>
            </div>

            {/* Comments List */}
            <div className="tiktok-comments-list">
              {activeCommentPost.comments.length === 0 ? (
                <div className="tiktok-comments-empty">
                  Be the first to comment on this dispatch! ✨
                </div>
              ) : (
                activeCommentPost.comments.map((comment) => {
                  const isCommentLiked = isUserLiked(comment.likersList, currentUser?.handle);
                  const isMyComment = comment.authorHandle === currentUser.handle || activeCommentPost.authorHandle === currentUser.handle;

                  return (
                    <div key={comment.id} className="tiktok-comment-thread">
                      <div className="tiktok-comment-row">
                        <MediaAvatar
                          src={comment.authorAvatar}
                          alt={comment.authorName}
                          className="tiktok-comment-avatar"
                          onClick={() => onNavigateProfile(comment.authorHandle)}
                        />
                        <div className="tiktok-comment-content">
                          <div className="tiktok-comment-author">
                            <span>{comment.authorName}</span>
                            {comment.isVerified && <span style={{ color: '#38bdf8' }}>✓</span>}
                          </div>
                          <p className="tiktok-comment-text">{comment.text}</p>
                          <div className="tiktok-comment-sub">
                            <span>{comment.timeAgo}</span>
                            <button
                              type="button"
                              className="tiktok-reply-btn"
                              onClick={() => {
                                setReplyingToComment({
                                  id: comment.id,
                                  authorHandle: comment.authorHandle,
                                  authorName: comment.authorName,
                                });
                                commentInputRef.current?.focus();
                              }}
                            >
                              Reply
                            </button>
                            {isMyComment && (
                              <button
                                type="button"
                                className="tiktok-delete-comment-btn"
                                onClick={() => onDeleteComment?.(activeCommentPost.id, comment.id)}
                                title="Delete comment"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`tiktok-comment-like-btn ${isCommentLiked ? 'liked' : ''}`}
                          onClick={() => onLikeComment?.(activeCommentPost.id, comment.id)}
                          title={isCommentLiked ? 'Unlike comment' : 'Like comment'}
                        >
                          <span style={{ color: isCommentLiked ? '#fe2c55' : 'inherit' }}>
                            {isCommentLiked ? '♥' : '♡'}
                          </span>
                          <span>{comment.likesCount || 0}</span>
                        </button>
                      </div>

                      {/* Nested Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="tiktok-comment-replies-list">
                          {comment.replies.map((reply) => {
                            const isReplyLiked = isUserLiked(reply.likersList, currentUser?.handle);
                            const isMyReply = reply.authorHandle === currentUser.handle || activeCommentPost.authorHandle === currentUser.handle;

                            return (
                              <div key={reply.id} className="tiktok-comment-row reply-row">
                                <MediaAvatar
                                  src={reply.authorAvatar}
                                  alt={reply.authorName}
                                  className="tiktok-comment-avatar reply-avatar"
                                  onClick={() => onNavigateProfile(reply.authorHandle)}
                                />
                                <div className="tiktok-comment-content">
                                  <div className="tiktok-comment-author">
                                    <span>{reply.authorName}</span>
                                    {reply.isVerified && <span style={{ color: '#38bdf8' }}>✓</span>}
                                  </div>
                                  <p className="tiktok-comment-text">{reply.text}</p>
                                  <div className="tiktok-comment-sub">
                                    <span>{reply.timeAgo}</span>
                                    {isMyReply && (
                                      <button
                                        type="button"
                                        className="tiktok-delete-comment-btn"
                                        onClick={() => onDeleteComment?.(activeCommentPost.id, comment.id, reply.id)}
                                        title="Delete reply"
                                      >
                                        🗑️
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={`tiktok-comment-like-btn ${isReplyLiked ? 'liked' : ''}`}
                                  onClick={() => onLikeComment?.(activeCommentPost.id, comment.id, reply.id)}
                                  title={isReplyLiked ? 'Unlike reply' : 'Like reply'}
                                >
                                  <span style={{ color: isReplyLiked ? '#fe2c55' : 'inherit' }}>
                                    {isReplyLiked ? '♥' : '♡'}
                                  </span>
                                  <span>{reply.likesCount || 0}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Replying Banner */}
            {replyingToComment && (
              <div className="tiktok-replying-banner">
                <span>Replying to <strong>@{replyingToComment.authorHandle}</strong></span>
                <button
                  type="button"
                  className="tiktok-cancel-reply-btn"
                  onClick={() => setReplyingToComment(null)}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Bottom Add Comment Bar */}
            <form onSubmit={handleCommentSubmit} className="tiktok-comments-input-bar">
              <MediaAvatar src={currentUser.avatar} alt="You" className="tiktok-input-avatar" />
              <input
                ref={commentInputRef}
                type="text"
                placeholder={replyingToComment ? `Reply to @${replyingToComment.authorHandle}...` : "Add a comment..."}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="tiktok-comment-input-field"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="tiktok-comment-send-btn"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      

      {/* ======================================================== */}
      {/* 7. SOUND HUB & APPLE MUSIC FREE PREVIEW DRAWER           */}
      {/* ======================================================== */}
      {isSoundHubOpen && (
        <div
          className="tiktok-soundhub-backdrop"
          onClick={() => {
            setIsSoundHubOpen(false);
            stopPreview();
          }}
        >
          <div className="tiktok-soundhub-sheet" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="tiktok-soundhub-header">
              <div className="tiktok-soundhub-title-wrap">
                <span className="soundhub-badge">Free Preview API</span>
                <h3 className="tiktok-soundhub-title">🎵 Sound Hub & Free Music</h3>
              </div>
              <button
                type="button"
                className="tiktok-soundhub-close-btn"
                onClick={() => {
                  setIsSoundHubOpen(false);
                  stopPreview();
                }}
              >
                ✕
              </button>
            </div>

            {/* Currently Playing Sound Banner */}
            <div className="tiktok-soundhub-now-playing">
              <div className="now-playing-disc-wrap">
                <div className={`now-playing-disc ${!isMuted ? 'spinning' : 'paused'}`}>
                  <img
                    src={activeCurrentPost.soundCover || activeCurrentPost.authorAvatar}
                    alt="Cover"
                    className="now-playing-cover-img"
                  />
                </div>
              </div>
              <div className="now-playing-info">
                <div className="now-playing-label">Currently Playing On This Post</div>
                <div className="now-playing-name">
                  {activeCurrentPost.soundName || 'Brazilian Phonk - Miami Night Racing Pulse'}
                </div>
                <div className="now-playing-artist">
                  {activeCurrentPost.soundArtist || 'Original Free Sound · 0:30'}
                </div>
              </div>
              <button
                type="button"
                className={`now-playing-volume-btn ${!isMuted ? 'active' : ''}`}
                onClick={toggleSound}
              >
                {isMuted ? 'Unmute 🔊' : 'Playing 🎶'}
              </button>
            </div>

            {/* iTunes Real Music Search Bar */}
            <div className="tiktok-soundhub-search-box">
              <span className="soundhub-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search real songs on iTunes (e.g. Drake, Miami, Phonk)..."
                value={soundSearchTerm}
                onChange={(e) => searchItunes(e.target.value)}
                className="tiktok-soundhub-input"
              />
              {soundSearchTerm && (
                <button
                  type="button"
                  className="soundhub-search-clear"
                  onClick={() => searchItunes('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Genre Filter Chips */}
            <div className="tiktok-soundhub-chips-row">
              {['🔥 Trending', '🌴 Miami Vibes', '🏎️ Phonk Drift', '🎧 Lo-Fi Chill', '⭐ Viral Hits', '⚡ House / EDM'].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="tiktok-soundhub-chip"
                  onClick={() => searchItunes(chip.replace(/^[^\s]+\s+/, ''))}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Tracks List */}
            <div className="tiktok-soundhub-tracks-list">
              {isLoadingSounds && (
                <div className="soundhub-loading-state">
                  <div className="soundhub-spinner" />
                  <span>Searching free official audio previews...</span>
                </div>
              )}

              {!isLoadingSounds && soundTracks.length === 0 && (
                <div className="soundhub-empty-state">
                  No preview tracks found. Try searching for another artist or song!
                </div>
              )}

              {!isLoadingSounds &&
                soundTracks.map((track) => {
                  const isPlaying = previewingTrackId === track.id;
                  const isSelected = activeCurrentPost.soundUrl === track.previewUrl;

                  return (
                    <div key={track.id} className={`soundhub-track-card ${isSelected ? 'active-track' : ''}`}>
                      <div className="soundhub-track-artwork-wrap" onClick={() => togglePreviewTrack(track)}>
                        <img src={track.artworkUrl} alt={track.trackName} className="soundhub-artwork-img" />
                        <div className="soundhub-play-overlay">
                          {isPlaying ? '⏸' : '▶'}
                        </div>
                      </div>

                      <div className="soundhub-track-details" onClick={() => togglePreviewTrack(track)}>
                        <div className="soundhub-track-title">{track.trackName}</div>
                        <div className="soundhub-track-artist">{track.artistName}</div>
                        <div className="soundhub-track-meta">
                          <span className="soundhub-duration-badge">0:30 Free Preview</span>
                          {track.genre && <span className="soundhub-genre-pill">{track.genre}</span>}
                        </div>
                      </div>

                      <div className="soundhub-track-actions">
                        <button
                          type="button"
                          className={`soundhub-use-sound-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleApplySound(track)}
                        >
                          {isSelected ? '✓ In Use' : 'Use Sound'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. SEARCH MODAL OVERLAY                                  */}
      {/* ======================================================== */}
      {isSearchOpen && (
        <div className="tiktok-search-backdrop" onClick={() => setIsSearchOpen(false)}>
          <div className="tiktok-search-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="tiktok-search-input-wrap">
              <span className="tiktok-search-lens-icon">🔍</span>
              <input
                type="text"
                autoFocus
                placeholder="Search creators, sounds, hashtags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="tiktok-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="tiktok-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {(() => {
              const counts: Record<string, number> = {};
              for (const p of posts) {
                for (const t of p.tags || []) {
                  const clean = t.toLowerCase().replace(/^#/, '').trim();
                  if (clean) counts[clean] = (counts[clean] || 0) + 1;
                }
              }
              const trendingList = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([tag]) => `#${tag}`);

              if (trendingList.length === 0) return null;

              return (
                <div className="tiktok-search-trending-tags">
                  <div className="tiktok-trending-title">Trending on Privity</div>
                  <div className="tiktok-trending-pills">
                    {trendingList.map((t, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="tiktok-trending-pill"
                        onClick={() => {
                          setSearchQuery(t.replace('#', ''));
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <button
              type="button"
              className="tiktok-search-close-btn"
              onClick={() => setIsSearchOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. THREE-DOTS POST OPTIONS ACTION SHEET MODAL            */}
      {/* ======================================================== */}
      {activePostMenu && (
        <div className="privity-action-sheet-backdrop" onClick={() => setActivePostMenu(null)}>
          <div className="privity-action-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="privity-action-sheet-handle" />
            <div className="privity-action-sheet-header">
              <span className="privity-sheet-title">Dispatch Options</span>
              <span className="privity-sheet-subtitle">@{activePostMenu.authorHandle}</span>
            </div>
            <div className="privity-action-sheet-options">
              {/* If user's own post, show Delete Dispatch */}
              {(activePostMenu.authorHandle === currentUser.handle || (currentUser.id && activePostMenu.authorId === currentUser.id)) && (
                <button
                  type="button"
                  className="privity-sheet-btn danger"
                  onClick={() => {
                    const id = activePostMenu.id;
                    setActivePostMenu(null);
                    onDeletePost?.(id);
                    triggerSlideToast('Dispatch deleted permanently');
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  <span>Delete Dispatch Permanently</span>
                </button>
              )}

              {/* Repost Dispatch */}
              <button
                type="button"
                className="privity-sheet-btn"
                onClick={() => {
                  const id = activePostMenu.id;
                  setActivePostMenu(null);
                  onRepostPost?.(id);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                <span>{activePostMenu.isReposted ? 'Undo Repost' : 'Repost to Circle'}</span>
              </button>

              {/* Copy Dispatch Link */}
              <button
                type="button"
                className="privity-sheet-btn"
                onClick={() => {
                  const url = `https://privity.app/p/${activePostMenu.id}`;
                  navigator.clipboard?.writeText(url);
                  setActivePostMenu(null);
                  triggerSlideToast('Dispatch link copied to clipboard! 📋');
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span>Copy Dispatch Link</span>
              </button>

              {/* Save / Bookmark Dispatch */}
              <button
                type="button"
                className="privity-sheet-btn"
                onClick={() => {
                  const id = activePostMenu.id;
                  setActivePostMenu(null);
                  onSave(id);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                <span>{activePostMenu.isSaved ? 'Remove Bookmark' : 'Bookmark Dispatch'}</span>
              </button>

              {/* Mute Creator */}
              <button
                type="button"
                className="privity-sheet-btn"
                onClick={() => {
                  const handle = activePostMenu.authorHandle;
                  setActivePostMenu(null);
                  triggerSlideToast(`Muted dispatches from @${handle} 🔕`);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                  <line x1="23" y1="9" x2="17" y2="15"/>
                  <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
                <span>Mute @{activePostMenu.authorHandle}</span>
              </button>

              {/* Report Dispatch */}
              <button
                type="button"
                className="privity-sheet-btn"
                onClick={() => {
                  setActivePostMenu(null);
                  triggerSlideToast('Report submitted for cryptographic review 🛡️');
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span>Report Dispatch</span>
              </button>

              <button
                type="button"
                className="privity-sheet-btn cancel"
                onClick={() => setActivePostMenu(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. FULLSCREEN CREATOR STUDIO (STORIES & POSTS)          */}
      {/* ======================================================== */}
      {isAddStoryModalOpen && (
        <div className="fullscreen-creator-modal" onClick={(e) => e.stopPropagation()}>
          {/* Top Bar with Mode Segment Switcher */}
          <div className="creator-top-bar">
            <button
              type="button"
              className="creator-close-circle"
              onClick={() => setIsAddStoryModalOpen(false)}
              title="Close Studio"
            >
              ✕
            </button>

            <div className="creator-mode-segmented">
              <button
                type="button"
                className={`creator-mode-tab ${creatorMode === 'story' ? 'active' : ''}`}
                onClick={() => setCreatorMode('story')}
              >
                <span>⭕ Story</span>
              </button>
              <button
                type="button"
                className={`creator-mode-tab ${creatorMode === 'post' ? 'active' : ''}`}
                onClick={() => setCreatorMode('post')}
              >
                <span>📱 Feed Post</span>
              </button>
            </div>

            <div style={{ width: '38px' }} />
          </div>

          {/* Main Stage Preview */}
          <div className="creator-main-canvas-area">
            <div className="creator-canvas-card">
              {storyDraftMediaType === 'video' ? (
                <video src={storyDraftMediaUrl} autoPlay loop muted playsInline className="creator-canvas-media" />
              ) : (
                <img src={storyDraftMediaUrl} alt="Draft Preview" className="creator-canvas-media" />
              )}

              {/* Thought / Text Overlay */}
              {(creatorMode === 'story' ? storyDraftCaption : postDraftCaption) && (
                <div className="creator-thought-overlay">
                  <span>{creatorMode === 'story' ? storyDraftCaption : postDraftCaption}</span>
                </div>
              )}
            </div>
          </div>

          {/* Controls Bottom Drawer */}
          <div className="creator-controls-drawer">
            {/* Presets Horizontal Row */}
            <div className="creator-atmosphere-row">
              {[
                { name: '🌅 Golden Hour', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200', type: 'image' },
                { name: '🏙️ Tokyo Neon', url: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=1200', type: 'image' },
                { name: '📐 Studio Blueprint', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200', type: 'image' },
                { name: '🎞️ 35mm Silver', url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200', type: 'image' },
                { name: '🏎️ Night Racing', url: 'https://assets.mixkit.co/videos/preview/mixkit-car-driving-through-a-city-at-night-42861-large.mp4', type: 'video' },
                { name: '🌴 Sunset Horizon', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', type: 'image' },
              ].map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  className={`creator-preset-pill ${storyDraftMediaUrl === preset.url ? 'active' : ''}`}
                  onClick={() => {
                    setStoryDraftMediaUrl(preset.url);
                    setStoryDraftMediaType(preset.type as any);
                  }}
                >
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>

            {/* Custom File Upload & Caption Input */}
            <div className="creator-input-bar">
              <label className="creator-upload-btn" title="Upload from Device">
                <span>📁 Upload</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const isVid = file.type.startsWith('video');
                    if (isVid) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (reader.result) {
                          setStoryDraftMediaUrl(reader.result as string);
                          setStoryDraftMediaType('video');
                        }
                      };
                      reader.readAsDataURL(file);
                    } else {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const raw = reader.result as string;
                        if (!raw) return;
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          let w = img.width;
                          let h = img.height;
                          const maxDim = 960;
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
                            setStoryDraftMediaUrl(canvas.toDataURL('image/jpeg', 0.72));
                            setStoryDraftMediaType('image');
                          } else {
                            setStoryDraftMediaUrl(raw);
                            setStoryDraftMediaType('image');
                          }
                        };
                        img.src = raw;
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>

              <input
                type="text"
                placeholder={creatorMode === 'story' ? 'Add overlay text to story...' : 'Write post caption / description...'}
                value={creatorMode === 'story' ? storyDraftCaption : postDraftCaption}
                onChange={(e) => {
                  if (creatorMode === 'story') setStoryDraftCaption(e.target.value);
                  else setPostDraftCaption(e.target.value);
                }}
              />
            </div>

            {/* Audience Ring Selector */}
            <div className="creator-privacy-strip">
              <button
                type="button"
                className={`creator-privacy-btn ${(creatorMode === 'story' ? storyDraftPrivacy : postDraftPrivacy) === 'close_friends' ? 'active cf' : ''}`}
                onClick={() => {
                  if (creatorMode === 'story') setStoryDraftPrivacy('close_friends');
                  else setPostDraftPrivacy('close_friends');
                }}
              >
                ⭐ Close Friends
              </button>
              <button
                type="button"
                className={`creator-privacy-btn ${(creatorMode === 'story' ? storyDraftPrivacy : postDraftPrivacy) === 'followers' ? 'active followers' : ''}`}
                onClick={() => {
                  if (creatorMode === 'story') setStoryDraftPrivacy('followers');
                  else setPostDraftPrivacy('followers');
                }}
              >
                🔒 Followers
              </button>
              <button
                type="button"
                className={`creator-privacy-btn ${(creatorMode === 'story' ? storyDraftPrivacy : postDraftPrivacy) === 'public' ? 'active public' : ''}`}
                onClick={() => {
                  if (creatorMode === 'story') setStoryDraftPrivacy('public');
                  else setPostDraftPrivacy('public');
                }}
              >
                🌐 Everyone
              </button>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              className="creator-primary-publish-btn"
              onClick={creatorMode === 'story' ? handleAddStorySubmit : handlePublishPostSubmit}
            >
              {creatorMode === 'story' ? 'Share to Story 🚀' : 'Publish to Feed 🌟'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 11. FULLSCREEN STORY VIEWER (SLIDE DOWN TO DISMISS)      */}
      {/* ======================================================== */}
      {activeStoryViewerIndex !== null && stories[activeStoryViewerIndex] && (
        <div
          className="story-viewer-backdrop"
          style={{
            backgroundColor: storyDragY > 0 ? `rgba(0, 0, 0, ${Math.max(0, 1 - storyDragY / 260)})` : '#000',
            transition: isDraggingStory ? 'none' : 'background-color 0.28s ease',
          }}
          onMouseDown={() => setIsStoryPaused(true)}
          onMouseUp={() => setIsStoryPaused(false)}
          onTouchStart={() => setIsStoryPaused(true)}
          onTouchEnd={() => setIsStoryPaused(false)}
        >
          {(() => {
            const curStory = stories[activeStoryViewerIndex];
            const isMyStory = curStory.authorHandle === currentUser.handle;

            return (
              <div
                className="story-viewer-modal"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={handleStoryTouchStart}
                onTouchMove={handleStoryTouchMove}
                onTouchEnd={handleStoryTouchEnd}
                onMouseDown={handleStoryMouseDown}
                onMouseMove={handleStoryMouseMove}
                onMouseUp={handleStoryMouseUp}
                style={{
                  transform: storyDragY > 0 ? `translateY(${storyDragY}px) scale(${Math.max(0.75, 1 - storyDragY / 900)})` : undefined,
                  opacity: storyDragY > 0 ? Math.max(0.2, 1 - storyDragY / 450) : 1,
                  borderRadius: storyDragY > 0 ? `${Math.min(32, storyDragY / 3)}px` : undefined,
                  transition: isDraggingStory ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease',
                }}
              >
                {/* Visual Tactile Drag Handle */}
                <div className="story-viewer-drag-bar" title="Slide down to close story" />

                {/* Segmented Progress Bars */}
                <div className="story-viewer-progress-row">
                  {stories.map((st, sIdx) => {
                    const pct = sIdx < activeStoryViewerIndex ? 100 : sIdx === activeStoryViewerIndex ? storyProgress : 0;
                    return (
                      <div key={st.id} className="story-progress-track">
                        <div className="story-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    );
                  })}
                </div>

                {/* Top Header */}
                <div className="story-viewer-header">
                  <div
                    className="story-viewer-author"
                    onClick={() => {
                      setActiveStoryViewerIndex(null);
                      onNavigateProfile(curStory.authorHandle);
                    }}
                  >
                    <img src={curStory.authorAvatar} alt={curStory.authorName} className="story-viewer-avatar" />
                    <div className="story-viewer-meta">
                      <span className="story-viewer-name">{curStory.authorName}</span>
                      <span className="story-viewer-sub">@{curStory.authorHandle} · {curStory.timeAgo}</span>
                    </div>
                  </div>

                  <div className="story-viewer-right-actions">
                    <span className={`story-viewer-badge ${curStory.privacy}`}>
                      {curStory.privacy === 'close_friends' ? '⭐ Close Friends' : curStory.privacy === 'followers' ? '🔒 Followers' : '🌐 Public'}
                    </span>
                    {isMyStory && (
                      <button
                        type="button"
                        className="story-delete-btn"
                        onClick={() => handleDeleteStory(curStory.id)}
                        title="Delete Story"
                      >
                        🗑️
                      </button>
                    )}
                    <button
                      type="button"
                      className="story-viewer-close"
                      onClick={() => setActiveStoryViewerIndex(null)}
                      title="Close (or slide down)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Media Container */}
                <div className="story-viewer-media-wrap">
                  {curStory.mediaType === 'video' ? (
                    <video src={curStory.mediaUrl} autoPlay loop playsInline className="story-viewer-media" />
                  ) : (
                    <img src={curStory.mediaUrl} alt={curStory.caption || 'Story'} className="story-viewer-media" />
                  )}

                  {/* Tap navigation zones */}
                  <div
                    className="story-nav-zone left"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeStoryViewerIndex > 0) {
                        setActiveStoryViewerIndex(activeStoryViewerIndex - 1);
                        setStoryProgress(0);
                      }
                    }}
                  />
                  <div
                    className="story-nav-zone right"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeStoryViewerIndex < stories.length - 1) {
                        setActiveStoryViewerIndex(activeStoryViewerIndex + 1);
                        setStoryProgress(0);
                      } else {
                        setActiveStoryViewerIndex(null);
                      }
                    }}
                  />

                  {/* Caption Overlay */}
                  {curStory.caption && (
                    <div className="story-viewer-caption-box">
                      <p>{curStory.caption}</p>
                    </div>
                  )}
                </div>

                {/* Bottom Reply & Quick Reaction Bar */}
                <div className="story-viewer-bottom-bar" onClick={(e) => e.stopPropagation()}>
                  <div className="story-quick-reactions">
                    {['❤️', '🔥', '👏', '😂'].map((emoji, eIdx) => (
                      <button
                        key={eIdx}
                        type="button"
                        className="story-reaction-emoji-btn"
                        onClick={() => {
                          stopAllAudio();
                          const msg = `Reacted ${emoji} to your story`;
                          if (onStoryReplyToDM) {
                            onStoryReplyToDM(curStory.authorHandle, msg);
                          } else {
                            triggerSlideToast(`Sent ${emoji} to @${curStory.authorHandle} 📬`);
                          }
                          setActiveStoryViewerIndex(null);
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
                      value={storyReplyText}
                      onChange={(e) => setStoryReplyText(e.target.value)}
                      className="story-reply-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && storyReplyText.trim()) {
                          stopAllAudio();
                          const msg = `Replied to your story: "${storyReplyText.trim()}"`;
                          if (onStoryReplyToDM) {
                            onStoryReplyToDM(curStory.authorHandle, msg);
                          } else {
                            triggerSlideToast(`Reply sent to @${curStory.authorHandle} 💬`);
                          }
                          setStoryReplyText('');
                          setActiveStoryViewerIndex(null);
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={!storyReplyText.trim()}
                      className="story-reply-send-btn"
                      onClick={() => {
                        if (!storyReplyText.trim()) return;
                        stopAllAudio();
                        const msg = `Replied to your story: "${storyReplyText.trim()}"`;
                        if (onStoryReplyToDM) {
                          onStoryReplyToDM(curStory.authorHandle, msg);
                        } else {
                          triggerSlideToast(`Reply sent to @${curStory.authorHandle} 💬`);
                        }
                        setStoryReplyText('');
                        setActiveStoryViewerIndex(null);
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 12. VISIONOS GLASS TOAST NOTIFICATION                    */}
      {/* ======================================================== */}
      {slideToastMsg && (
        <div className="slide-vision-toast">
          <span className="toast-dot" />
          <span>{slideToastMsg}</span>
        </div>
      )}

    </div>
  );
};
