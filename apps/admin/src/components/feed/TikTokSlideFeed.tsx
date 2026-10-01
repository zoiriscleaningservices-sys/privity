import React, { useState, useEffect, useRef } from 'react';
import './tiktokFeed.css';

export interface PostComment {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  isVerified?: boolean;
  text: string;
  timeAgo: string;
  likesCount?: number;
  replies?: Array<{
    id: string;
    authorName: string;
    authorHandle: string;
    authorAvatar: string;
    isVerified?: boolean;
    text: string;
    timeAgo: string;
  }>;
}

export interface PostItem {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  isVerified: boolean;
  verifiedCategory?: string;
  type: 'text' | 'image' | 'video' | 'audio';
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
  timeAgo: string;
  comments: PostComment[];
}

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
    name: string;
    handle: string;
    avatar: string;
  };
  followingMap?: Record<string, boolean>;
  closeFriendsList?: string[];
  onLike: (postId: string, photoUrl?: string) => void;
  onSave: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
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
}

export const TikTokSlideFeed: React.FC<TikTokSlideFeedProps> = ({
  posts,
  currentUser,
  followingMap,
  closeFriendsList,
  onLike,
  onSave,
  onAddComment,
  onShare,
  onOpenLive,
  onOpenCreate,
  onNavigateProfile,
  onNavigateTab,
  currentNavTab = 'feed',
  activeFilter = 'foryou',
  onSelectFilter,
  onSwitchToCardView: _onSwitchToCardView,
  onUpdatePostSound,
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

  useEffect(() => {
    if (activeFilter) {
      if (activeFilter === 'circles') setActiveChannel('circles');
      else if (activeFilter === 'following') setActiveChannel('following');
      else if (activeFilter === 'birdie') setActiveChannel('birdie');
      else if (activeFilter === 'live') setActiveChannel('live');
      else setActiveChannel('foryou');
    }
  }, [activeFilter]);

  const handleSelectChannel = (channel: SlideFeedChannel) => {
    setActiveChannel(channel);
    setActiveSlideIndex(0);
    if (channel === 'live') {
      onOpenLive();
      return;
    }
    onSelectFilter?.(channel);
  };

  // Followed creators map (clicking '+' button)
  const [followedMap, setFollowedMap] = useState<Record<string, boolean>>({});

  // Filtered posts strictly according to user circles & following rules
  const displayPosts = React.useMemo(() => {
    if (activeChannel === 'circles') {
      const list = posts.filter(
        (p) =>
          p.privacy === 'close_friends' ||
          (closeFriendsList && closeFriendsList.includes(p.authorHandle.replace(/^@/, '')))
      );
      return list.length > 0 ? list : posts.filter((p) => p.privacy === 'close_friends');
    }

    if (activeChannel === 'following') {
      const list = posts.filter(
        (p) =>
          (followingMap && followingMap[p.authorHandle.replace(/^@/, '')]) ||
          followedMap[p.authorHandle] ||
          p.authorHandle === 'nicole_spicy'
      );
      return list.length > 0 ? list : posts;
    }

    if (activeChannel === 'birdie') {
      const textPosts = posts.filter(
        (p) =>
          p.type === 'text' ||
          p.caption.length > 50 ||
          p.authorHandle === 'marcus_dev' ||
          p.authorHandle === 'julian_analogue'
      );
      return textPosts.length > 0 ? textPosts : posts;
    }

    // Default: 'foryou' (all posts)
    return posts;
  }, [posts, activeChannel, followingMap, followedMap, closeFriendsList]);

  // Active slide index tracked via IntersectionObserver / scroll position
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Play / Pause per post media
  const [pausedMap, setPausedMap] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Real Audio Playback Engine
  const [isMuted, setIsMuted] = useState(false);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

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

  // Active post for comments drawer & active slide
  const activeCommentPost = displayPosts.find((p) => p.id === activeCommentsPostId) || posts.find((p) => p.id === activeCommentsPostId);
  const activeCurrentPost = displayPosts[activeSlideIndex] || displayPosts[0] || posts[0];

  // ========================================================
  // SWIPE GESTURE CONTROLLER (TOUCH & MOUSE DRAG)
  // Left: Go to author's profile
  // Right: Step backwards through channels (For You -> Following -> Circles -> Birdie -> Live)
  // ========================================================
  const touchStartPos = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const mouseStartPos = useRef<{ x: number; y: number; time: number; isDown: boolean }>({ x: 0, y: 0, time: 0, isDown: false });

  const onTouchStartHandler = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };

  const onTouchEndHandler = (e: React.TouchEvent, authorHandle?: string) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartPos.current.x;
    const dy = t.clientY - touchStartPos.current.y;

    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.08) {
      if (dx < -50) {
        // SWIPE LEFT (←): Open Creator Profile
        const handle = authorHandle || displayPosts[activeSlideIndex]?.authorHandle || activeCurrentPost?.authorHandle;
        if (handle) {
          onNavigateProfile(handle);
        }
      } else if (dx > 50) {
        // SWIPE RIGHT (→): Slide right to Following, Circles, Birdie, Live
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
        // SWIPE LEFT (←): Open Creator Profile
        const handle = authorHandle || displayPosts[activeSlideIndex]?.authorHandle || activeCurrentPost?.authorHandle;
        if (handle) {
          onNavigateProfile(handle);
        }
      } else if (dx > 52) {
        // SWIPE RIGHT (→): Slide right to Following, Circles, Birdie, Live
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
    const post = displayPosts[activeSlideIndex];
    const bgAudio = bgAudioRef.current;
    if (!bgAudio) return;

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
    }
  }, [activeSlideIndex, displayPosts, isMuted, pausedMap]);

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
      if (!post.isLiked) {
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
    setFollowedMap((prev) => ({
      ...prev,
      [handle]: true,
    }));
  };

  // Add Comment submit
  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommentsPostId || !newCommentText.trim()) return;

    onAddComment(activeCommentsPostId, newCommentText.trim());
    setNewCommentText('');
  };

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
      <header className="tiktok-top-header">
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
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" className="birdie-nav-svg">
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
            Circles
            {activeChannel === 'circles' && <span className="tiktok-tab-indicator" />}
          </button>

          {/* 3. Following */}
          <button
            type="button"
            className={`tiktok-top-tab ${activeChannel === 'following' ? 'active' : ''}`}
            onClick={() => handleSelectChannel('following')}
            title="Creators You Follow"
          >
            Following
            {activeChannel === 'following' && <span className="tiktok-tab-indicator" />}
          </button>

          {/* 4. For You */}
          <button
            type="button"
            className={`tiktok-top-tab ${activeChannel === 'foryou' ? 'active' : ''}`}
            onClick={() => handleSelectChannel('foryou')}
            title="For You Feed"
          >
            For You
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
          onTouchStart={onTouchStartHandler}
          onTouchEnd={(e) => onTouchEndHandler(e)}
          onMouseDown={onMouseDownHandler}
          onMouseUp={(e) => onMouseUpHandler(e)}
        >
          {displayPosts.map((post) => {
            const isLiked = !!post.isLiked;
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
                  <img
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
                    className="birdie-action-btn"
                    onClick={() => onShare(post)}
                    title="Share Dispatch"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <polyline points="7 23 3 19 7 15" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
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

                  {/* More Options Button */}
                  <button
                    type="button"
                    className="birdie-action-btn"
                    onClick={() => {}}
                    title="More Options"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="1.5"/>
                      <circle cx="19" cy="12" r="1.5"/>
                      <circle cx="5" cy="12" r="1.5"/>
                    </svg>
                  </button>
                </div>

                {/* Social Proof Bar */}
                <div className="birdie-social-proof-bar" onClick={(e) => e.stopPropagation()}>
                  <div className="birdie-overlapping-avatars">
                    <img src={currentUser.avatar} alt="Luciano" className="birdie-proof-avatar" />
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" alt="Elena" className="birdie-proof-avatar" />
                  </div>
                  <div className="birdie-proof-text">
                    Liked by <strong>{currentUser.name}</strong>, <strong>Elena Rodriguez</strong> and <strong>2 others</strong>
                  </div>
                </div>

                {/* Inline Thoughtful Reply Form (Signature Privity Spec) */}
                <div className="birdie-reply-section" onClick={(e) => e.stopPropagation()}>
                  <img src={currentUser.avatar} alt={currentUser.name} className="birdie-reply-user-avatar" />
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
          })}
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
          {displayPosts.map((post) => {
            const isVideo = post.type === 'video' || !!post.videoUrl;
            const mediaUrl = post.videoUrl || post.contentUrl || post.thumbnailUrl || './nicole-spicy.jpg';
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
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={post.caption}
                      className="tiktok-photo-player"
                    />
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
                    <img
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
                  <button
                    type="button"
                    className={`tiktok-rail-btn like ${post.isLiked ? 'liked' : ''}`}
                    onClick={() => onLike(post.id, post.contentUrl || post.videoUrl)}
                    title={post.isLiked ? 'Unlike' : 'Like'}
                    aria-label="Like"
                  >
                    <div className="tiktok-icon-wrap">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill={post.isLiked ? "#fe2c55" : "#ffffff"} className="tiktok-rail-icon">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                    </div>
                    <span className="tiktok-rail-count">
                      {post.likesCount >= 1000 ? `${(post.likesCount / 1000).toFixed(1)}k` : post.likesCount}
                    </span>
                  </button>

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
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. PRIVITY NATIVE BOTTOM NAVIGATION DOCK                 */}
      {/* ======================================================== */}
      <nav className="privity-slide-bottom-nav">
        {/* 1. Feed */}
        <button
          type="button"
          className={`privity-nav-tab-item ${currentNavTab === 'feed' ? 'active' : ''}`}
          onClick={() => onNavigateTab('feed')}
          title="Home Feed"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={currentNavTab === 'feed' ? '#ffffff' : 'none'} stroke={currentNavTab === 'feed' ? '#ffffff' : 'rgba(255,255,255,0.65)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="privity-nav-tab-label">Feed</span>
          {currentNavTab === 'feed' && <span className="privity-nav-active-dot" />}
        </button>

        {/* 2. Discover */}
        <button
          type="button"
          className={`privity-nav-tab-item ${currentNavTab === 'discover' ? 'active' : ''}`}
          onClick={() => onNavigateTab('discover')}
          title="Discover Creators"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={currentNavTab === 'discover' ? '#ffffff' : 'rgba(255,255,255,0.65)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={currentNavTab === 'discover' ? '#ffffff' : 'none'} />
          </svg>
          <span className="privity-nav-tab-label">Discover</span>
          {currentNavTab === 'discover' && <span className="privity-nav-active-dot" />}
        </button>

        {/* 3. Center Create (+) Orb */}
        <button
          type="button"
          className="privity-nav-tab-create-btn"
          onClick={onOpenCreate}
          title="Open Camera & Studio"
          aria-label="Create Dispatch"
        >
          <div className="privity-nav-create-orb">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </button>

        {/* 4. Messages */}
        <button
          type="button"
          className={`privity-nav-tab-item ${currentNavTab === 'messages' ? 'active' : ''}`}
          onClick={() => onNavigateTab('messages')}
          title="Encrypted Messages"
        >
          <div style={{ position: 'relative' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={currentNavTab === 'messages' ? '#ffffff' : 'rgba(255,255,255,0.65)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span className="privity-nav-presence-dot" />
          </div>
          <span className="privity-nav-tab-label">Messages</span>
          {currentNavTab === 'messages' && <span className="privity-nav-active-dot" />}
        </button>

        {/* 5. Profile */}
        <button
          type="button"
          className={`privity-nav-tab-item ${currentNavTab === 'profile' ? 'active' : ''}`}
          onClick={() => onNavigateTab('profile')}
          title="Your Profile"
        >
          <div className={`privity-nav-avatar-circle ${currentNavTab === 'profile' ? 'active' : ''}`}>
            <img src={currentUser.avatar} alt={currentUser.name} className="privity-nav-avatar-img" />
          </div>
          <span className="privity-nav-tab-label">Profile</span>
          {currentNavTab === 'profile' && <span className="privity-nav-active-dot" />}
        </button>
      </nav>

      {/* ======================================================== */}
      {/* 6. SLIDE-UP COMMENTS DRAWER (TIKTOK STYLE)               */}
      {/* ======================================================== */}
      {activeCommentsPostId && activeCommentPost && (
        <div className="tiktok-comments-drawer-backdrop" onClick={() => setActiveCommentsPostId(null)}>
          <div className="tiktok-comments-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="tiktok-comments-drawer-header">
              <div className="tiktok-comments-drawer-count">
                {activeCommentPost.comments.length} comments
              </div>
              <button
                type="button"
                className="tiktok-comments-close-btn"
                onClick={() => setActiveCommentsPostId(null)}
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
                activeCommentPost.comments.map((comment) => (
                  <div key={comment.id} className="tiktok-comment-row">
                    <img
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
                        <button type="button" className="tiktok-reply-btn">Reply</button>
                      </div>
                    </div>
                    <button type="button" className="tiktok-comment-like-btn">
                      <span>♥</span>
                      <span>{comment.likesCount || 0}</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Add Comment Bar */}
            <form onSubmit={handleCommentSubmit} className="tiktok-comments-input-bar">
              <img src={currentUser.avatar} alt="You" className="tiktok-input-avatar" />
              <input
                type="text"
                placeholder="Add a comment..."
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

            <div className="tiktok-search-trending-tags">
              <div className="tiktok-trending-title">Trending on Privity</div>
              <div className="tiktok-trending-pills">
                {['#viral', '#fyp', '#miami', '#video', '#sovereign', '#web3', '#photography', '#mindful'].map((t, idx) => (
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
    </div>
  );
};
