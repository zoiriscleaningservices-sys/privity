import React, { useState, useEffect } from 'react';
import { LIVEME_STREAMERS } from './liveMeData';
import { LiveMeRechargeModal } from './LiveMeRechargeModal';
import { LiveMeCoinGamesModal } from './LiveMeCoinGamesModal';
import { liveStreamSync } from '../../services/liveStreamSyncService';
import { LiveMeStreamer } from './types';

interface LiveMeHotCatalogProps {
  onOpenStream: (streamerId: string) => void;
  onClose?: () => void;
  userCoins: number;
  onCoinsChange: (delta: number) => void;
  showToast: (msg: string) => void;
  onGoLive?: () => void;
  currentUser?: {
    name: string;
    handle: string;
    avatar: string;
  };
}

export const LiveMeHotCatalog: React.FC<LiveMeHotCatalogProps> = ({
  onOpenStream,
  onClose,
  userCoins,
  onCoinsChange,
  showToast,
  onGoLive,
  currentUser = {
    name: 'Creator',
    handle: '',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
}) => {
  const [activeSideNav, setActiveSideNav] = useState<'hot' | 'trending' | 'new' | 'worldwide' | 'games'>('hot');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [isCoinGamesOpen, setIsCoinGamesOpen] = useState(false);

  // Cross-tab active live host detection - only if broadcasting and alive
  const [activeHost, setActiveHost] = useState<any>(() => {
    const syncHost = liveStreamSync.getHostSession();
    if (syncHost && syncHost.isLive !== false) return syncHost;
    try {
      const isBroadcasting = localStorage.getItem('privity_is_host_broadcasting') === 'true';
      const saved = localStorage.getItem('privity_current_live_host');
      if (isBroadcasting && saved) {
        const parsed = JSON.parse(saved);
        const normHandle = (parsed.creatorHandle || parsed.handle || '').toLowerCase().replace('@', '').trim();
        if (liveStreamSync.isStreamEnded(parsed.id, normHandle, parsed.startedAt)) return null;
        if (parsed.lastHeartbeat && Date.now() - parsed.lastHeartbeat > 4500) return null;
        return parsed;
      }
      return null;
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

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'privity_is_host_broadcasting' ||
        e.key === 'privity_current_live_host' ||
        e.key === 'privity_ended_streams_v2'
      ) {
        const isB = localStorage.getItem('privity_is_host_broadcasting') === 'true';
        const saved = localStorage.getItem('privity_current_live_host');
        if (isB && saved) {
          try {
            const parsed = JSON.parse(saved);
            const normHandle = (parsed.creatorHandle || parsed.handle || '').toLowerCase().replace('@', '').trim();
            if (
              liveStreamSync.isStreamEnded(parsed.id, normHandle, parsed.startedAt) ||
              (parsed.lastHeartbeat && Date.now() - parsed.lastHeartbeat > 4500)
            ) {
              setActiveHost(null);
            } else {
              setActiveHost(parsed);
            }
          } catch {
            setActiveHost(null);
          }
        } else {
          setActiveHost(null);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (bus) bus.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const [networkStreamers, setNetworkStreamers] = useState<LiveMeStreamer[]>(() =>
    liveStreamSync.getStreamersList()
  );

  useEffect(() => {
    return liveStreamSync.subscribeToActiveStreams((streams) => {
      setNetworkStreamers(streams);
    });
  }, []);

  // Strict handle deduplication
  const userHandle = (currentUser?.handle || '').toLowerCase().replace('@', '').trim();
  const isUserBroadcasting =
    (liveStreamSync.isLocalHost() && !!liveStreamSync.getHostSession()) ||
    (activeHost &&
      activeHost.isLive !== false &&
      !liveStreamSync.isStreamEnded(activeHost.id, activeHost.creatorHandle || activeHost.handle, activeHost.startedAt) &&
      (!activeHost.lastHeartbeat || Date.now() - activeHost.lastHeartbeat <= 4500));

  const currentHost = liveStreamSync.getHostSession() || (isUserBroadcasting ? activeHost : null);

  const streamersByHandle = new Map<string, LiveMeStreamer>();

  if (isUserBroadcasting && currentHost && !liveStreamSync.isStreamEnded(currentHost.id, currentHost.creatorHandle || currentHost.handle, currentHost.startedAt)) {
    const rawHandle = currentHost.creatorHandle || currentHost.handle || userHandle;
    const hostHandle = rawHandle.toLowerCase().replace('@', '').trim();
    const rawName = currentHost.creatorName || currentHost.name || currentUser?.name || 'Creator';
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

  for (const s of networkStreamers) {
    const normHandle = (s.handle || '').toLowerCase().replace('@', '').trim();
    if (!normHandle) continue;
    if (liveStreamSync.isStreamEnded(s.id, normHandle)) continue;
    if (!streamersByHandle.has(normHandle)) {
      streamersByHandle.set(normHandle, s);
    }
  }

  for (const s of LIVEME_STREAMERS) {
    const normHandle = (s.handle || '').toLowerCase().replace('@', '').trim();
    if (liveStreamSync.isStreamEnded(s.id, normHandle)) continue;
    if (!streamersByHandle.has(normHandle)) {
      streamersByHandle.set(normHandle, s);
    }
  }

  const allStreamers = Array.from(streamersByHandle.values())
    .filter((s) => !liveStreamSync.isStreamEnded(s.id, s.handle))
    .sort((a, b) => {
      const aIsMyHost = a.isHost || (isUserBroadcasting && (a.handle || '').toLowerCase().replace('@', '').trim() === userHandle);
      const bIsMyHost = b.isHost || (isUserBroadcasting && (b.handle || '').toLowerCase().replace('@', '').trim() === userHandle);
      if (aIsMyHost && !bIsMyHost) return -1;
      if (!aIsMyHost && bIsMyHost) return 1;

      const aLive = (a.tagBadge === 'LIVE NOW' || a.isCameraStream || a.isHost || networkStreamers.some((ns) => ns.id === a.id)) && !liveStreamSync.isStreamEnded(a.id, a.handle);
      const bLive = (b.tagBadge === 'LIVE NOW' || b.isCameraStream || b.isHost || networkStreamers.some((ns) => ns.id === b.id)) && !liveStreamSync.isStreamEnded(b.id, b.handle);
      if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;

    return (b.viewersCount || 0) - (a.viewersCount || 0);
  });

  const heroStreamer = allStreamers[0] || LIVEME_STREAMERS[0];

  const filteredStreamers = allStreamers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="liveme-catalog-root">
      {/* Top Navbar matching Screenshot media_1790808512597.png */}
      <header className="liveme-cat-navbar">
        <div className="liveme-cat-brand" onClick={onClose} title="Privity LiveMe Arena">
          <div className="liveme-cat-star-icon">★</div>
          <span>liveMe</span>
        </div>

        <div className="liveme-cat-search-box">
          <input
            type="text"
            className="liveme-cat-search-input"
            placeholder="Search for name or ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="liveme-cat-nav-actions">
          <div className="liveme-cat-action-link" onClick={() => showToast('Direct Chats 💬')}>
            <span>💬</span>
            <span>Chats</span>
          </div>

          <div className="liveme-cat-action-link" onClick={() => setIsCoinGamesOpen(true)}>
            <span>🎮</span>
            <span>Game</span>
          </div>

          <div className="liveme-cat-action-link" onClick={() => showToast('Diamond Earnings Portal 💎')}>
            <span>💎</span>
            <span>Diamonds</span>
          </div>

          <div className="liveme-cat-action-link" onClick={() => setIsRechargeOpen(true)}>
            <span>🪙</span>
            <span>Coins ({userCoins.toLocaleString()})</span>
          </div>

          <div
            className="liveme-cat-action-link"
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontWeight: 800,
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 0 14px rgba(239, 68, 68, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={onGoLive || (() => onOpenStream(`live-user-${currentUser.handle}`))}
            title="Start Live Broadcast"
          >
            <span style={{ fontSize: 10 }}>🔴</span>
            <span>Go LIVE</span>
          </div>

          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '1.5px solid #a855f7' }}
            title={currentUser.name}
          />
        </div>
      </header>

      {/* Main Body: Sidebar + Main Content */}
      <div className="liveme-cat-body">
        {/* Left Sidebar */}
        <aside className="liveme-cat-sidebar">
          <div className="liveme-cat-nav-group">
            <div
              className={`liveme-cat-nav-item ${activeSideNav === 'hot' ? 'active' : ''}`}
              onClick={() => setActiveSideNav('hot')}
            >
              <span>📹</span>
              <span>Hot Live</span>
            </div>
            <div
              className={`liveme-cat-nav-item ${activeSideNav === 'trending' ? 'active' : ''}`}
              onClick={() => setActiveSideNav('trending')}
            >
              <span>🔥</span>
              <span>Trending</span>
            </div>
            <div
              className={`liveme-cat-nav-item ${activeSideNav === 'new' ? 'active' : ''}`}
              onClick={() => setActiveSideNav('new')}
            >
              <span>✨</span>
              <span>New Shows</span>
            </div>
            <div
              className={`liveme-cat-nav-item ${activeSideNav === 'worldwide' ? 'active' : ''}`}
              onClick={() => setActiveSideNav('worldwide')}
            >
              <span>🌐</span>
              <span>Worldwide</span>
            </div>
            <div
              className={`liveme-cat-nav-item ${activeSideNav === 'games' ? 'active' : ''}`}
              onClick={() => setActiveSideNav('games')}
            >
              <span>🎮</span>
              <span>Video Games Live</span>
            </div>
          </div>

          <div className="liveme-cat-nav-group" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
            <div className="liveme-cat-nav-item" onClick={() => setIsRechargeOpen(true)}>
              <span>🪙</span>
              <span>Recharge</span>
            </div>
            <div className="liveme-cat-nav-item" onClick={() => setIsCoinGamesOpen(true)}>
              <span>🎮</span>
              <span>Coin Games <small style={{ color: '#fbbf24', marginLeft: 4 }}>Win gold</small></span>
            </div>
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>Download App</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>▶</div>
              <div style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}></div>
              <div style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>🤖</div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="liveme-cat-main">
          {/* Hero Live Card matching Screenshot media_1790808512597.png */}
          <div className="liveme-cat-hero-card">
            <div
              className="liveme-cat-hero-video-box"
              onClick={() => onOpenStream(heroStreamer.id)}
            >
              <video
                src={heroStreamer.videoStreamUrl}
                poster={heroStreamer.posterUrl}
                autoPlay
                loop
                muted
                playsInline
                className="liveme-cat-hero-media"
              />
              <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 8 }}>
                <span style={{ background: '#7c3aed', padding: '4px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>
                  LIVE
                </span>
                <span style={{ background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 9999, fontSize: 12 }}>
                  👁️ {heroStreamer.viewersCount} 🔥 {heroStreamer.popularity}
                </span>
              </div>
            </div>

            <div className="liveme-cat-hero-profile-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src={heroStreamer.avatar}
                  alt={heroStreamer.name}
                  style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{heroStreamer.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>2,068 Fans · 46 Following</div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: '10px 0' }}>
                {heroStreamer.title}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
                  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                ].map((thumbUrl, i) => (
                  <div
                    key={i}
                    style={{
                      aspectRatio: '1',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={thumbUrl}
                      alt={`Gallery item ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="liveme-follow-btn"
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => onOpenStream(heroStreamer.id)}
              >
                Enter Live Room
              </button>
            </div>
          </div>

          {/* "For You" Section / Grid of Live Broadcasters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 800 }}>
            <span>💖</span>
            <span>For you</span>
          </div>

          <div className="liveme-cards-grid">
            {filteredStreamers.map((streamer) => {
              const isLive = streamer.isHost || streamer.tagBadge === 'LIVE NOW';

              return (
                <div
                  key={streamer.id}
                  className="liveme-stream-grid-card"
                  onClick={() => onOpenStream(streamer.id)}
                  style={
                    isLive
                      ? {
                          border: '2px solid #ef4444',
                          boxShadow: '0 0 24px rgba(239, 68, 68, 0.6)',
                        }
                      : undefined
                  }
                >
                  <img
                    src={streamer.posterUrl || streamer.avatar}
                    alt={streamer.name}
                    className="liveme-card-cover-media"
                    style={isLive ? { filter: 'brightness(0.9)' } : undefined}
                  />

                  {isLive && (
                    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 900, padding: '3px 8px', borderRadius: 9999, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="liveme-pulse-dot" style={{ width: 6, height: 6 }} />
                        LIVE NOW
                      </span>
                    </div>
                  )}

                  <div className="liveme-card-overlay-gradient" />
                  <div className="liveme-card-bottom-info">
                    <img
                      src={streamer.avatar}
                      alt={streamer.name}
                      className="liveme-card-avatar"
                      style={isLive ? { border: '2px solid #ef4444' } : undefined}
                    />
                    <div className="liveme-card-text-block">
                      <span className="liveme-card-streamer-name">
                        {isLive && !streamer.name.includes('🔴') ? `${streamer.name} 🔴` : streamer.name}
                      </span>
                      <div className="liveme-card-stats">
                        <span>👁️ {streamer.viewersCount}</span>
                        <span>🔥 {streamer.popularity}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Recharge Modal */}
      <LiveMeRechargeModal
        isOpen={isRechargeOpen}
        onClose={() => setIsRechargeOpen(false)}
        userCoins={userCoins}
        userName={currentUser.name}
        userAvatar={currentUser.avatar}
        onRechargeSuccess={(added) => {
          onCoinsChange(added);
          showToast(`🎉 Recharge Successful! +${added} Coins credited! 🪙`);
          setIsRechargeOpen(false);
        }}
      />

      {/* Coin Games Modal */}
      <LiveMeCoinGamesModal
        isOpen={isCoinGamesOpen}
        onClose={() => setIsCoinGamesOpen(false)}
        userCoins={userCoins}
        onCoinsChange={onCoinsChange}
        showToast={showToast}
      />
    </div>
  );
};
