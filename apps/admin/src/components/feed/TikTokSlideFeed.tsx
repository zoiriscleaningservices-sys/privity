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

export interface TikTokSlideFeedProps {
  posts: PostItem[];
  currentUser: {
    name: string;
    handle: string;
    avatar: string;
  };
  onLike: (postId: string, photoUrl?: string) => void;
  onSave: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onShare: (post: PostItem) => void;
  onOpenLive: () => void;
  onOpenCreate: () => void;
  onNavigateProfile: (handle: string) => void;
  onNavigateTab: (tab: 'feed' | 'discover' | 'messages' | 'profile') => void;
  currentNavTab?: 'feed' | 'discover' | 'messages' | 'profile';
  activeFilter?: 'foryou' | 'following' | 'circles';
  onSelectFilter?: (filter: 'foryou' | 'following' | 'circles') => void;
  onSwitchToCardView?: () => void;
}

export const TikTokSlideFeed: React.FC<TikTokSlideFeedProps> = ({
  posts,
  currentUser,
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
  onSwitchToCardView,
}) => {
  // Active slide index tracked via IntersectionObserver / scroll position
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Play / Pause per post video
  const [pausedMap, setPausedMap] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Floating heart burst particles on double-tap
  const [burstHearts, setBurstHearts] = useState<Array<{ id: number; x: number; y: number; rot: number }>>([]);

  // Followed creators map (clicking the red '+' button)
  const [followedMap, setFollowedMap] = useState<Record<string, boolean>>({});

  // Slide-up comments drawer
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Search overlay state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active post for comments drawer
  const activeCommentPost = posts.find((p) => p.id === activeCommentsPostId);

  // Video autoplay/pause intersection observer
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
            const index = posts.findIndex((p) => p.id === postId);
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
  }, [posts, pausedMap]);

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
      } else if (e.key === 'Escape') {
        if (activeCommentsPostId) setActiveCommentsPostId(null);
        if (isSearchOpen) setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [posts, activeSlideIndex, activeCommentsPostId, isSearchOpen]);

  // Toggle Video Play / Pause on Single Tap
  const handleTogglePlay = (postId: string) => {
    const video = videoRefs.current[postId];
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setPausedMap((prev) => ({ ...prev, [postId]: false }));
    } else {
      video.pause();
      setPausedMap((prev) => ({ ...prev, [postId]: true }));
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
      // Optional toggle play on single tap after small debounce
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

  return (
    <div className="tiktok-feed-wrapper">
      {/* ======================================================== */}
      {/* 1. TOP FLOATING NAVIGATION BAR (EXACT TIKTOK SPEC)      */}
      {/* ======================================================== */}
      <header className="tiktok-top-header">
        {/* Left: TV LIVE Button */}
        <button
          type="button"
          className="tiktok-top-live-btn"
          onClick={onOpenLive}
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

        {/* Center Tabs: Community / Following / For You */}
        <div className="tiktok-top-tabs">
          <button
            type="button"
            className={`tiktok-top-tab ${activeFilter === 'circles' ? 'active' : ''}`}
            onClick={() => onSelectFilter?.('circles')}
          >
            Circles
            {activeFilter === 'circles' && <span className="tiktok-tab-indicator" />}
          </button>

          <button
            type="button"
            className={`tiktok-top-tab ${activeFilter === 'following' ? 'active' : ''}`}
            onClick={() => onSelectFilter?.('following')}
          >
            Following
            {activeFilter === 'following' && <span className="tiktok-tab-indicator" />}
          </button>

          <button
            type="button"
            className={`tiktok-top-tab ${activeFilter === 'foryou' ? 'active' : ''}`}
            onClick={() => onSelectFilter?.('foryou')}
          >
            For You
            {activeFilter === 'foryou' && <span className="tiktok-tab-indicator" />}
          </button>
        </div>

        {/* Right: Search 🔍 and optional Card view switcher */}
        <div className="tiktok-top-right-actions">
          {onSwitchToCardView && (
            <button
              type="button"
              className="tiktok-view-toggle-btn"
              onClick={onSwitchToCardView}
              title="Switch to Card Grid View"
            >
              ☷
            </button>
          )}

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
      {/* 2. FULLSCREEN VERTICAL SNAP-SCROLL SLIDE CONTAINER       */}
      {/* ======================================================== */}
      <div className="tiktok-slides-container" ref={containerRef}>
        {posts.map((post) => {
          const isVideo = post.type === 'video' || !!post.videoUrl;
          const mediaUrl = post.videoUrl || post.contentUrl || post.thumbnailUrl || 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-talking-on-video-call-42998-large.mp4';
          const isPaused = !!pausedMap[post.id];
          const isFollowed = !!followedMap[post.authorHandle];

          return (
            <div
              key={post.id}
              className="tiktok-slide-item"
              data-post-id={post.id}
              ref={(el) => { slideRefs.current[post.id] = el; }}
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
                {isVideo && isPaused && (
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
              {/* 3. RIGHT ACTION RAIL (100% FAITHFUL TO TIKTOK SPEC) */}
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

                {/* 6. Rotating Vinyl Sound Record with Grooves and Center Album Art */}
                <div
                  className={`tiktok-rail-sound-disc ${isPaused ? 'paused' : 'spinning'}`}
                  title={post.soundName || 'Original Sound'}
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
              {/* 4. BOTTOM LEFT CREATOR & CAPTION OVERLAY             */}
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

                {/* Interactive Search / Sound Marquee Pill */}
                <div
                  className="tiktok-sound-pill"
                  onClick={() => setIsSearchOpen(true)}
                  title="Search audio and related dispatches"
                >
                  <span className="tiktok-sound-icon">🔍</span>
                  <div className="tiktok-sound-ticker-wrap">
                    <span className="tiktok-sound-ticker-text">
                      {post.soundName ? `Search · ${post.soundName}` : 'Search · miami svj roadster'}
                    </span>
                  </div>
                  <span className="tiktok-sound-chevron">&gt;</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 5. BOTTOM NAVIGATION BAR (100% FAITHFUL TO TIKTOK SPEC) */}
      {/* ======================================================== */}
      <nav className="tiktok-bottom-nav">
        {/* 1. Home */}
        <button
          type="button"
          className={`tiktok-nav-item ${currentNavTab === 'feed' ? 'active' : ''}`}
          onClick={() => onNavigateTab('feed')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={currentNavTab === 'feed' ? '#ffffff' : 'none'} stroke={currentNavTab === 'feed' ? '#ffffff' : 'rgba(255,255,255,0.7)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="tiktok-nav-label">Home</span>
        </button>

        {/* 2. Friends (Circles / Discover) with red count badge */}
        <button
          type="button"
          className={`tiktok-nav-item ${currentNavTab === 'discover' ? 'active' : ''}`}
          onClick={() => onNavigateTab('discover')}
        >
          <div className="tiktok-nav-icon-badge-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="tiktok-nav-badge">83</span>
          </div>
          <span className="tiktok-nav-label">Friends</span>
        </button>

        {/* 3. Center Create (+) Button (Signature 3-Layer Design) */}
        <button
          type="button"
          className="tiktok-nav-create-btn"
          onClick={onOpenCreate}
          title="Create post or Go Live"
          aria-label="Create Post"
        >
          <div className="tiktok-create-btn-base">
            <div className="tiktok-create-cyan-bg" />
            <div className="tiktok-create-pink-bg" />
            <div className="tiktok-create-center-pill">
              <span className="tiktok-create-plus">+</span>
            </div>
          </div>
        </button>

        {/* 4. Inbox (Messages) with red count badge */}
        <button
          type="button"
          className={`tiktok-nav-item ${currentNavTab === 'messages' ? 'active' : ''}`}
          onClick={() => onNavigateTab('messages')}
        >
          <div className="tiktok-nav-icon-badge-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span className="tiktok-nav-badge">74</span>
          </div>
          <span className="tiktok-nav-label">Inbox</span>
        </button>

        {/* 5. Profile */}
        <button
          type="button"
          className={`tiktok-nav-item ${currentNavTab === 'profile' ? 'active' : ''}`}
          onClick={() => onNavigateTab('profile')}
        >
          <div className="tiktok-nav-avatar-wrap">
            <img src={currentUser.avatar} alt={currentUser.name} className="tiktok-nav-avatar-img" />
          </div>
          <span className="tiktok-nav-label">Profile</span>
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
                        {comment.isVerified && <span className="verified-dot">✓</span>}
                      </div>
                      <p className="tiktok-comment-text">{comment.text}</p>
                      <div className="tiktok-comment-sub">
                        <span>{comment.timeAgo}</span>
                        <button type="button" className="tiktok-reply-btn">Reply</button>
                      </div>

                      {/* Nested Replies */}
                      {comment.replies && comment.replies.map((reply) => (
                        <div key={reply.id} className="tiktok-reply-row">
                          <img src={reply.authorAvatar} alt={reply.authorName} className="tiktok-reply-avatar" />
                          <div className="tiktok-reply-content">
                            <span className="tiktok-reply-author">{reply.authorName}</span>
                            <p className="tiktok-reply-text">{reply.text}</p>
                            <span className="tiktok-comment-sub">{reply.timeAgo}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="tiktok-comment-like-btn">
                      ♥ <span>{comment.likesCount || 1}</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Add Comment Bar */}
            <form className="tiktok-comments-input-bar" onSubmit={handleCommentSubmit}>
              <img src={currentUser.avatar} alt="You" className="tiktok-input-avatar" />
              <input
                type="text"
                placeholder="Add comment..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="tiktok-comment-input-field"
              />
              <button
                type="submit"
                className="tiktok-comment-send-btn"
                disabled={!newCommentText.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. SEARCH MODAL OVERLAY                                  */}
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
