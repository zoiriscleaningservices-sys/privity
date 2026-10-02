import React, { useState, useEffect, useRef, useCallback } from 'react';
import './liveExploreGrid.css';
import { LIVEME_STREAMERS } from './liveMeData';
import { LiveMeStreamer } from './types';
import { IconArrowLeft, IconSearch, IconX } from '../Icons';

const IconFlame: React.FC<{ size?: number; color?: string }> = ({ size = 12, color = '#f97316' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 23c-4.97 0-9-4.03-9-9 0-4.66 3.44-8.86 7.64-12.82.37-.35.95-.35 1.32 0C16.16 5.14 19.6 9.34 19.6 14c0 4.97-4.03 9-9 9zm0-15.5c-2.3 2.5-4 5.3-4 7.5 0 2.21 1.79 4 4 4s4-1.79 4-4c0-2.2-1.7-5-4-7.5z" />
  </svg>
);

export interface LiveExploreGridProps {
  onOpenStream: (streamerId: string) => void;
  onBackToFeed: () => void;
  onGoLive?: () => void;
  currentUser?: {
    name: string;
    handle: string;
    avatar: string;
  };
  showToast: (msg: string) => void;
}

type MainCategoryTab = 'video_chat' | 'featured' | 'party' | 'global' | 'rankings';
type SubFilterChip = 'recommend' | 'h2h' | 'battle' | 'music';

export const LiveExploreGrid: React.FC<LiveExploreGridProps> = ({
  onOpenStream,
  onBackToFeed,
  onGoLive,
  currentUser,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<MainCategoryTab>('featured');
  const [activeChip, setActiveChip] = useState<SubFilterChip>('recommend');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  // Cross-tab active live host detection
  const [activeHost, setActiveHost] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('privity_current_live_host');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let bus: BroadcastChannel | null = null;
    try {
      bus = new BroadcastChannel('privity_sync_bus');
      bus.onmessage = (e) => {
        if (e.data?.type === 'LIVE_HOST_STARTED') {
          setActiveHost(e.data.host);
        } else if (e.data?.type === 'LIVE_HOST_ENDED') {
          setActiveHost(null);
        }
      };
    } catch {}
    return () => {
      if (bus) bus.close();
    };
  }, []);

  // Filter streamers
  const allStreamers: LiveMeStreamer[] = [
    ...(activeHost ? [{
      id: 'liveme-host-myself',
      handle: activeHost.handle || currentUser?.handle || 'luciano',
      name: `${activeHost.name || currentUser?.name || 'Luciano'} (LIVE NOW 🔴)`,
      avatar: activeHost.avatar || currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500',
      isVerified: true,
      category: 'Featured',
      title: activeHost.title || 'My Live Broadcast · Privity Exclusive',
      description: 'Live host studio broadcast',
      viewersCount: 120,
      totalViews: '120',
      popularity: '999+',
      diamonds: 50000,
      likesCount: 1200,
      videoStreamUrl: activeHost.videoStreamUrl || 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-talking-to-the-camera-42866-large.mp4',
      posterUrl: activeHost.posterUrl || activeHost.avatar || currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=900',
      tags: ['Host', 'LiveNow', 'Privity'],
      tagBadge: 'HOST',
      topContributors: [],
    }] : []),
    ...LIVEME_STREAMERS,
  ];

  const filteredStreamers = allStreamers.filter((s) => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.handle.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    // Top Category tab filter
    if (activeTab === 'video_chat') {
      return s.category === 'Video Chat' || (s.tags || []).includes('VideoChat') || s.tagBadge === 'Multi-beam';
    }
    if (activeTab === 'party') {
      return s.category === 'Party' || (s.tags || []).includes('Party');
    }
    if (activeTab === 'global') {
      return s.category === 'Global' || (s.tags || []).includes('Global');
    }

    // Chip filter when on 'featured'
    if (activeChip === 'h2h') {
      return s.tagBadge === 'H2H' || (s.tags || []).includes('H2H') || (s.tags || []).includes('Battle') || (s.tags || []).includes('PKMatch');
    }
    if (activeChip === 'battle') {
      return (s.tags || []).includes('Battle') || (s.tags || []).includes('PKBattle') || s.category.includes('PK');
    }
    if (activeChip === 'music') {
      return (s.tags || []).includes('Music') || (s.tags || []).includes('DJ') || s.category.includes('Synth');
    }

    return true; // 'recommend' or default
  });

  // Scroll & Intersection Observation for Auto-Preview Outside
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const cardElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const hoverTimerRef = useRef<any>(null);
  const scrollSettleTimerRef = useRef<any>(null);

  const updateCentermostCard = useCallback(() => {
    if (!gridContainerRef.current) return;
    const containerRect = gridContainerRef.current.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;

    let closestId: string | null = null;
    let minDistance = Infinity;

    cardElementsRef.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      const cardCenterY = rect.top + rect.height / 2;
      const dist = Math.abs(cardCenterY - centerY);
      if (dist < minDistance && rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
        minDistance = dist;
        closestId = id;
      }
    });

    if (closestId && closestId !== activePreviewId) {
      setActivePreviewId(closestId);
    }
  }, [activePreviewId]);

  const handleScroll = () => {
    if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
    // Settle timer: once scrolling pauses for 280ms, activate the centered live stream
    scrollSettleTimerRef.current = setTimeout(() => {
      updateCentermostCard();
    }, 280);
  };

  useEffect(() => {
    // Initial auto-preview on the first card
    if (!activePreviewId && filteredStreamers.length > 0) {
      setActivePreviewId(filteredStreamers[0].id);
    }
  }, [filteredStreamers, activePreviewId]);

  const handleCardMouseEnter = (id: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setActivePreviewId(id);
    }, 180);
  };

  const handleCardMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  };

  return (
    <div className="live-explore-root">
      {/* 1. TOP HEADER & CATEGORY BAR */}
      <header className="live-explore-top-bar">
        <div className="live-explore-header-row">
          {/* Back Button */}
          <button
            type="button"
            className="live-explore-icon-btn back-btn"
            onClick={onBackToFeed}
            title="Back to Feed"
            aria-label="Back to Feed"
          >
            <IconArrowLeft size={20} color="#ffffff" />
          </button>

          {/* Search Trigger */}
          <button
            type="button"
            className={`live-explore-icon-btn ${isSearchOpen ? 'active' : ''}`}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            title="Search Live Creators"
            aria-label="Search"
          >
            <IconSearch size={18} color="#ffffff" />
          </button>

          {/* Go Live Button */}
          {onGoLive && (
            <button
              type="button"
              className="live-explore-icon-btn live-go-broadcast-btn"
              onClick={onGoLive}
              title="Go Live Broadcast"
              style={{ background: 'linear-gradient(135deg, #ef4444, #f43f5e)', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}
            >
              + LIVE
            </button>
          )}

          {/* Horizontal Category Nav */}
          <nav className="live-explore-category-nav">
            <button
              type="button"
              className={`live-cat-nav-item ${activeTab === 'video_chat' ? 'active' : ''}`}
              onClick={() => { setActiveTab('video_chat'); setSearchQuery(''); }}
            >
              Video Chat
            </button>

            <button
              type="button"
              className={`live-cat-nav-item ${activeTab === 'featured' ? 'active' : ''}`}
              onClick={() => { setActiveTab('featured'); setSearchQuery(''); }}
            >
              Featured
              {activeTab === 'featured' && <span className="live-cat-nav-indicator" />}
            </button>

            <button
              type="button"
              className={`live-cat-nav-item ${activeTab === 'party' ? 'active' : ''}`}
              onClick={() => { setActiveTab('party'); setSearchQuery(''); }}
            >
              Party
              {activeTab === 'party' && <span className="live-cat-nav-indicator" />}
            </button>

            <button
              type="button"
              className={`live-cat-nav-item ${activeTab === 'global' ? 'active' : ''}`}
              onClick={() => { setActiveTab('global'); setSearchQuery(''); }}
            >
              Global
              {activeTab === 'global' && <span className="live-cat-nav-indicator" />}
            </button>

            <button
              type="button"
              className={`live-cat-nav-item rankings-icon-item ${activeTab === 'rankings' ? 'active' : ''}`}
              onClick={() => showToast('🏆 Top Live Rank: 1. QueenDuc (790K) · 2. Kashout (626K)')}
              title="Daily Live Leaderboard"
            >
              <span className="trophy-emoji">🏆</span>
            </button>
          </nav>
        </div>

        {/* Expandable Search Input Strip */}
        {isSearchOpen && (
          <div className="live-explore-search-tray">
            <input
              type="text"
              autoFocus
              className="live-explore-search-field"
              placeholder="Search live streamers, tags, battles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="live-explore-search-clear"
                onClick={() => setSearchQuery('')}
              >
                <IconX size={15} />
              </button>
            )}
          </div>
        )}

        {/* 2. CHIP FILTER CAROUSEL (Recommend | Head2Head | Battle | Music) */}
        <div className="live-explore-chips-row">
          <div className="live-explore-chips-scroll">
            <button
              type="button"
              className={`live-filter-chip chip-recommend ${activeChip === 'recommend' ? 'active' : ''}`}
              onClick={() => setActiveChip('recommend')}
            >
              <span className="chip-avatar-icon">😲</span>
              <span>Recommend</span>
            </button>

            <button
              type="button"
              className={`live-filter-chip chip-h2h ${activeChip === 'h2h' ? 'active' : ''}`}
              onClick={() => setActiveChip('h2h')}
            >
              <span className="chip-badge-tag h2h">H2H</span>
              <span>Head2Head</span>
            </button>

            <button
              type="button"
              className={`live-filter-chip chip-battle ${activeChip === 'battle' ? 'active' : ''}`}
              onClick={() => setActiveChip('battle')}
            >
              <span className="chip-avatar-icon">😎</span>
              <span>Battle</span>
            </button>

            <button
              type="button"
              className={`live-filter-chip chip-music ${activeChip === 'music' ? 'active' : ''}`}
              onClick={() => setActiveChip('music')}
            >
              <span className="chip-avatar-icon">🎧</span>
              <span>Music</span>
            </button>
          </div>

          <button
            type="button"
            className="live-chips-menu-btn"
            onClick={() => showToast('Displaying real-time peer broadcasts')}
            title="Filter options"
          >
            <div className="filter-bars-icon">
              <span />
              <span />
              <span />
            </div>
          </button>
        </div>
      </header>

      {/* 3. 2-COLUMN LIVE STREAM VIDEO GRID */}
      <main
        className="live-explore-grid-container"
        ref={gridContainerRef}
        onScroll={handleScroll}
      >
        <div className="live-explore-stream-grid">
          {filteredStreamers.map((streamer) => {
            const isPreviewActive = activePreviewId === streamer.id;

            return (
              <article
                key={streamer.id}
                ref={(el) => {
                  if (el) cardElementsRef.current.set(streamer.id, el);
                  else cardElementsRef.current.delete(streamer.id);
                }}
                className={`live-stream-card ${isPreviewActive ? 'preview-active' : ''}`}
                onClick={() => onOpenStream(streamer.id)}
                onMouseEnter={() => handleCardMouseEnter(streamer.id)}
                onMouseLeave={handleCardMouseLeave}
              >
                {/* Visual Canvas: Cover Image (Chosen Pre-Live) OR Active Video Stream */}
                <div className="live-card-media-viewport">
                  {/* Photo selected by the streamer before starting broadcast */}
                  <img
                    src={streamer.posterUrl || streamer.avatar}
                    alt={streamer.name}
                    className="live-card-poster-image"
                    loading="lazy"
                  />

                  {/* Active playing video stream when hovered or scrolled to */}
                  {isPreviewActive && streamer.videoStreamUrl && (
                    <video
                      src={streamer.videoStreamUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="live-card-active-video"
                    />
                  )}

                  {/* Gradient Scrims for maximum readability */}
                  <div className="live-card-top-scrim" />
                  <div className="live-card-bottom-scrim" />

                  {/* Top Badge: Multi-beam / H2H / LIVE */}
                  <div className="live-card-top-badges">
                    {streamer.tagBadge === 'Multi-beam' || (streamer.tags || []).includes('Multi-beam') ? (
                      <div className="live-badge-pill multi-beam">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </svg>
                        <span>Multi-beam</span>
                      </div>
                    ) : streamer.tagBadge === 'H2H' || (streamer.tags || []).includes('H2H') ? (
                      <div className="live-badge-pill h2h">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                        </svg>
                        <span>H2H</span>
                      </div>
                    ) : (
                      <div className="live-badge-pill live-dot">
                        <span className="live-pulse-dot" />
                        <span>LIVE</span>
                      </div>
                    )}

                    {/* Active Equalizer soundwave when preview is running */}
                    {isPreviewActive && (
                      <div className="live-soundwave-indicator">
                        <span className="wave-bar b1" />
                        <span className="wave-bar b2" />
                        <span className="wave-bar b3" />
                      </div>
                    )}
                  </div>

                  {/* Bottom Overlaid Streamer Info */}
                  <div className="live-card-info-box">
                    {/* Status Title */}
                    <div className="live-card-status-title">
                      <span className="audio-bars-prefix">ılı</span>
                      <span className="status-text">{streamer.title || 'Click for fun!'}</span>
                    </div>

                    {/* Streamer Name + Heat Score */}
                    <div className="live-card-name-row">
                      <div className="live-card-streamer-meta">
                        <span className="live-streamer-name">{streamer.name}</span>
                        {streamer.isVerified && <span className="live-verified-sparkle">✓</span>}
                      </div>

                      <div className="live-card-flame-heat">
                        <IconFlame size={12} color="#f97316" />
                        <span className="heat-number">{streamer.popularity || streamer.viewersCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Empty state if search returns nothing */}
        {filteredStreamers.length === 0 && (
          <div className="live-explore-empty-state">
            <div className="empty-icon">📡</div>
            <div className="empty-title">No broadcasts found</div>
            <div className="empty-sub">Try searching for another creator or switch categories.</div>
            <button
              type="button"
              className="btn-reset-filter"
              onClick={() => { setSearchQuery(''); setActiveTab('featured'); setActiveChip('recommend'); }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>

      {/* 4. FLOATING 3D GIFT BOX (MATCHING SCREENSHOT) */}
      <button
        type="button"
        className="live-floating-gift-orb"
        onClick={() => showToast('🎁 Daily Bonus & Live Spark Gifts!')}
        title="Live Rewards"
      >
        <span className="gift-emoji-sparkle">🎁</span>
        <span className="gift-pulse-halo" />
      </button>
    </div>
  );
};
