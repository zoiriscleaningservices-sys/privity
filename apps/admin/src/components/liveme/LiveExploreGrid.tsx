import React, { useState, useEffect, useRef, useCallback } from 'react';
import './liveExploreGrid.css';
import { LIVEME_STREAMERS } from './liveMeData';
import { LiveMeStreamer } from './types';
import { IconArrowLeft, IconSearch, IconX } from '../Icons';
import { liveStreamSync } from '../../services/liveStreamSyncService';

const IconFlame: React.FC<{ size?: number; color?: string }> = ({ size = 12, color = '#f97316' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 23c-4.97 0-9-4.03-9-9 0-4.66 3.44-8.86 7.64-12.82.37-.35.95-.35 1.32 0C16.16 5.14 19.6 9.34 19.6 14c0 4.97-4.03 9-9 9zm0-15.5c-2.3 2.5-4 5.3-4 7.5 0 2.21 1.79 4 4 4s4-1.79 4-4c0-2.2-1.7-5-4-7.5z" />
  </svg>
);

export interface LiveExploreGridProps {
  onOpenStream: (streamerId: string, streamerObj?: LiveMeStreamer) => void;
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

  // Network Active Streamers (synchronized across all physical devices)
  const [networkStreamers, setNetworkStreamers] = useState<LiveMeStreamer[]>(() =>
    liveStreamSync.getStreamersList()
  );

  useEffect(() => {
    return liveStreamSync.subscribeToActiveStreams((streams) => {
      setNetworkStreamers(streams);
    });
  }, []);

  // Cross-tab active live host detection fallback - only active if actually broadcasting
  const [activeHost, setActiveHost] = useState<any>(() => {
    const syncHost = liveStreamSync.getHostSession();
    if (syncHost && syncHost.isLive !== false) return syncHost;
    try {
      const isBroadcasting = localStorage.getItem('privity_is_host_broadcasting') === 'true';
      const saved = localStorage.getItem('privity_current_live_host');
      if (isBroadcasting && saved) {
        return JSON.parse(saved);
      }
      return null;
    } catch {
      return null;
    }
  });

  // Real-time live video frames map (view live feeds right from explore grid)
  const [liveFramesMap, setLiveFramesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let frameBus: BroadcastChannel | null = null;
    let syncBus: BroadcastChannel | null = null;

    try {
      frameBus = new BroadcastChannel('privity_live_frames');
      frameBus.onmessage = (e) => {
        if (e.data?.type === 'FRAME' && e.data.handle && e.data.frame) {
          const normHandle = e.data.handle.toLowerCase().replace('@', '').trim();
          setLiveFramesMap((prev) => ({
            ...prev,
            [normHandle]: e.data.frame,
          }));
        }
      };
    } catch {}

    try {
      syncBus = new BroadcastChannel('privity_sync_bus');
      syncBus.onmessage = (e) => {
        if (e.data?.type === 'LIVE_HOST_STARTED') {
          setActiveHost(e.data.host);
        } else if (e.data?.type === 'LIVE_HOST_ENDED') {
          setActiveHost(null);
          const handle = (e.data.handle || '').toLowerCase().replace('@', '').trim();
          if (handle) {
            setLiveFramesMap((prev) => {
              const next = { ...prev };
              delete next[handle];
              return next;
            });
          }
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'privity_is_host_broadcasting' || e.key === 'privity_current_live_host') {
        const isB = localStorage.getItem('privity_is_host_broadcasting') === 'true';
        const saved = localStorage.getItem('privity_current_live_host');
        if (isB && saved) {
          try { setActiveHost(JSON.parse(saved)); } catch { setActiveHost(null); }
        } else {
          setActiveHost(null);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (frameBus) frameBus.close();
      if (syncBus) syncBus.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Filter streamers - STRICT HANDLE DEDUPLICATION (zero repeating cards)
  const userHandle = (currentUser?.handle || 'luciano').toLowerCase().replace('@', '').trim();
  const isUserBroadcasting =
    liveStreamSync.isLocalHost() ||
    !!liveStreamSync.getHostSession() ||
    localStorage.getItem('privity_is_host_broadcasting') === 'true' ||
    (activeHost && activeHost.isLive !== false);

  const currentHost =
    liveStreamSync.getHostSession() ||
    activeHost ||
    (isUserBroadcasting
      ? (() => {
          try {
            const s = localStorage.getItem('privity_current_live_host');
            return s ? JSON.parse(s) : null;
          } catch {
            return null;
          }
        })()
      : null);

  const streamersByHandle = new Map<string, LiveMeStreamer>();

  // 1. Host card: ALWAYS show if host is ACTUALLY broadcasting right now!
  if (isUserBroadcasting && currentHost) {
    const rawHandle = currentHost.creatorHandle || currentHost.handle || userHandle;
    const hostHandle = rawHandle.toLowerCase().replace('@', '').trim();
    const rawName = currentHost.creatorName || currentHost.name || currentUser?.name || 'Luciano';
    const cleanName = rawName.replace(' (LIVE NOW 🔴)', '');
    const avatar =
      currentHost.creatorAvatar ||
      currentHost.avatar ||
      currentUser?.avatar ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500';

    streamersByHandle.set(hostHandle, {
      id: currentHost.id || `live-user-${hostHandle}`,
      handle: rawHandle,
      name: `${cleanName} (LIVE NOW 🔴)`,
      avatar,
      isVerified: true,
      category: currentHost.category || 'Featured',
      title: currentHost.title || 'My Live Broadcast · Privity Exclusive',
      description: currentHost.description || 'Live host studio broadcast',
      viewersCount: Math.max(1, currentHost.viewersCount || 1),
      totalViews: `${Math.max(1, currentHost.viewersCount || 1)}`,
      popularity: '999+',
      diamonds: 50000,
      likesCount: currentHost.likesCount || 1200,
      videoStreamUrl: currentHost.videoStreamUrl,
      posterUrl: currentHost.posterUrl || currentHost.previewUrl || avatar,
      tags: ['Host', 'LiveNow', 'Privity'],
      tagBadge: 'LIVE NOW',
      isHost: true,
      isCameraStream: true,
      topContributors: [],
    });
  }

  // 2. Active network streamers (include all active network broadcasts, never drop host!)
  for (const s of networkStreamers) {
    const normHandle = (s.handle || '').toLowerCase().replace('@', '').trim();
    if (!normHandle) continue;
    if (!streamersByHandle.has(normHandle)) {
      streamersByHandle.set(normHandle, s);
    }
  }

  // 3. Fallback catalog streamers: add only if creator not already active
  for (const s of LIVEME_STREAMERS) {
    const normHandle = (s.handle || '').toLowerCase().replace('@', '').trim();
    if (!streamersByHandle.has(normHandle)) {
      streamersByHandle.set(normHandle, s);
    }
  }

  const allStreamers: LiveMeStreamer[] = Array.from(streamersByHandle.values());

  const filteredStreamers = allStreamers
    .filter((s) => {
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

      // ANY real active live broadcast must ALWAYS be shown across all categories & chips!
      const isRealActiveStream =
        s.tagBadge === 'LIVE NOW' ||
        s.isCameraStream ||
        s.isHost ||
        s.id.startsWith('live-user-') ||
        s.id === 'liveme-host-myself' ||
        networkStreamers.some((ns) => ns.id === s.id);

      if (isRealActiveStream) {
        return true;
      }

      // Top Category tab filter
      if (activeTab === 'video_chat') {
        return (
          s.category === 'Video Chat' ||
          s.category === 'Voice Chat' ||
          (s.tags || []).some((t) => ['voicechat', 'voice', 'audio', 'talk', 'videochat'].includes(t.toLowerCase())) ||
          s.tagBadge === 'Multi-beam'
        );
      }
      if (activeTab === 'party') {
        return (
          s.category === 'Party' ||
          s.tagBadge === 'Multi-beam' ||
          (s.tags || []).some((t) => ['party', 'group', 'multi-beam', 'multiguest'].includes(t.toLowerCase()))
        );
      }
      if (activeTab === 'global') {
        return s.category === 'Global' || (s.tags || []).includes('Global');
      }
      if (activeTab === 'rankings') {
        return true;
      }

      // Chip filter when on 'featured'
      if (activeChip === 'h2h') {
        return (
          s.tagBadge === 'H2H' ||
          (s.tags || []).some((t) => ['h2h', 'battle', 'pkbattle', 'pkmatch'].includes(t.toLowerCase())) ||
          s.category.toLowerCase().includes('pk') ||
          s.category.toLowerCase().includes('battle')
        );
      }
      if (activeChip === 'battle') {
        return (
          (s.tags || []).some((t) => ['battle', 'pkbattle', 'pkmatch'].includes(t.toLowerCase())) ||
          s.category.toLowerCase().includes('pk') ||
          s.category.toLowerCase().includes('battle')
        );
      }
      if (activeChip === 'music') {
        return (s.tags || []).includes('Music') || (s.tags || []).includes('DJ') || s.category.includes('Synth');
      }

      return true; // 'recommend' or default
    })
    .sort((a, b) => {
      // 1. Current user host broadcast ALWAYS #1
      const aIsMyHost = a.isHost || (isUserBroadcasting && (a.handle || '').toLowerCase().replace('@', '').trim() === userHandle);
      const bIsMyHost = b.isHost || (isUserBroadcasting && (b.handle || '').toLowerCase().replace('@', '').trim() === userHandle);
      if (aIsMyHost && !bIsMyHost) return -1;
      if (!aIsMyHost && bIsMyHost) return 1;

      // 2. Real live broadcasts ALWAYS rank before any mock/offline streamers!
      const aLive =
        a.tagBadge === 'LIVE NOW' ||
        a.isCameraStream ||
        a.isHost ||
        a.id.startsWith('live-user-') ||
        a.id === 'liveme-host-myself' ||
        networkStreamers.some((ns) => ns.id === a.id);

      const bLive =
        b.tagBadge === 'LIVE NOW' ||
        b.isCameraStream ||
        b.isHost ||
        b.id.startsWith('live-user-') ||
        b.id === 'liveme-host-myself' ||
        networkStreamers.some((ns) => ns.id === b.id);

      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;

      if (activeTab === 'rankings') {
        const scoreA = (a.diamonds || 0) * 2 + (a.viewersCount || 0) * 100 + (a.likesCount || 0);
        const scoreB = (b.diamonds || 0) * 2 + (b.viewersCount || 0) * 100 + (b.likesCount || 0);
        return scoreB - scoreA;
      }

      // Standard sort: views count
      return (b.viewersCount || 0) - (a.viewersCount || 0);
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
              onClick={() => {
                setActiveTab('rankings');
                setSearchQuery('');
                showToast('🏆 Top Live Rank sorted by Views & Points');
              }}
              title="Daily Live Leaderboard (Ranked by views & points)"
            >
              <span className="trophy-emoji">🏆</span>
              {activeTab === 'rankings' && <span className="live-cat-nav-indicator" />}
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
          {filteredStreamers.map((streamer, idx) => {
            const isPreviewActive = activePreviewId === streamer.id;
            const isLiveNow = streamer.tagBadge === 'LIVE NOW' || streamer.isCameraStream || streamer.isHost;

            return (
              <article
                key={streamer.id}
                ref={(el) => {
                  if (el) cardElementsRef.current.set(streamer.id, el);
                  else cardElementsRef.current.delete(streamer.id);
                }}
                className={`live-stream-card ${isPreviewActive ? 'preview-active' : ''} ${isLiveNow ? 'is-live-broadcasting' : ''}`}
                onClick={() => onOpenStream(streamer.id, streamer)}
                    onMouseEnter={() => handleCardMouseEnter(streamer.id)}
                    onMouseLeave={handleCardMouseLeave}
                  >
                    {/* Visual Canvas: Real-Time Live Feed or Cover Image */}
                    <div className="live-card-media-viewport">
                      {liveFramesMap[(streamer.handle || '').toLowerCase().replace('@', '').trim()] ? (
                        <img
                          src={liveFramesMap[(streamer.handle || '').toLowerCase().replace('@', '').trim()]}
                          alt={streamer.name}
                          className="live-card-active-video live-camera-stream-preview"
                          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                        />
                      ) : (isPreviewActive || isLiveNow) && streamer.videoStreamUrl ? (
                        <video
                          src={streamer.videoStreamUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="live-card-active-video"
                        />
                      ) : (
                        <img
                          src={streamer.posterUrl || streamer.avatar}
                          alt={streamer.name}
                          className="live-card-poster-image"
                          loading="lazy"
                        />
                      )}

                      {/* Gradient Scrims for maximum readability */}
                      <div className="live-card-top-scrim" />
                      <div className="live-card-bottom-scrim" />

                      {/* Top Badge: LIVE NOW / Battle H2H / Multi-beam Group / Voice Chat / LIVE */}
                      <div className="live-card-top-badges">
                        {isLiveNow ? (
                          <div className="live-badge-pill live-now-highlight">
                            <span className="live-pulse-dot" />
                            <span>LIVE NOW 🔴</span>
                          </div>
                        ) : streamer.tagBadge === 'H2H' ||
                        (streamer.tags || []).some((t) => ['h2h', 'battle', 'pkbattle', 'pkmatch'].includes(t.toLowerCase())) ||
                        streamer.category.toLowerCase().includes('pk') ||
                        streamer.category.toLowerCase().includes('battle') ? (
                          <div className="live-badge-pill h2h">
                            <span style={{ fontSize: '11px', lineHeight: 1 }}>⚔️</span>
                            <span>H2H</span>
                          </div>
                        ) : streamer.tagBadge === 'Multi-beam' ||
                          streamer.category === 'Party' ||
                          (streamer.tags || []).some((t) => ['party', 'group', 'multi-beam', 'multiguest'].includes(t.toLowerCase())) ? (
                          <div className="live-badge-pill multi-beam">
                            <span style={{ fontSize: '11px', lineHeight: 1 }}>👥</span>
                            <span>Group</span>
                          </div>
                        ) : streamer.category === 'Voice Chat' ||
                          (streamer.tags || []).some((t) => ['voicechat', 'voice', 'audio'].includes(t.toLowerCase())) ? (
                          <div className="live-badge-pill voice-chat">
                            <span style={{ fontSize: '11px', lineHeight: 1 }}>🎙️</span>
                            <span>Voice Chat</span>
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

                  {/* Podium Rank Badge when on Rankings tab */}
                  {activeTab === 'rankings' && (
                    <div className={`live-card-rank-podium rank-${idx + 1 <= 3 ? idx + 1 : 'other'}`}>
                      {idx === 0 ? '👑 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                    </div>
                  )}

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
    </div>
  );
};
