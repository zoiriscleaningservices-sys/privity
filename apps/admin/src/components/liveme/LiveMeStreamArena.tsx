import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveMeStreamer,
  LiveMeChatMessage,
} from './types';
import {
  LIVEME_STREAMERS,
  LIVEME_GIFTS,
} from './liveMeData';
import { LiveMeRechargeModal } from './LiveMeRechargeModal';
import { LiveMeCoinGamesModal } from './LiveMeCoinGamesModal';
import { LiveMeHotCatalog } from './LiveMeHotCatalog';
import { GiftAnimationPlayer, globalGiftQueue, DEFAULT_GIFTS, GiftEvent } from '../../gifts';
import './liveme.css';

interface LiveMeStreamArenaProps {
  onClose: () => void;
  initialStreamerId?: string;
  currentUser?: {
    name: string;
    handle: string;
    avatar: string;
  };
  userCoins: number;
  onCoinsChange: (delta: number) => void;
  showToast: (msg: string) => void;
}

export const LiveMeStreamArena: React.FC<LiveMeStreamArenaProps> = ({
  onClose,
  initialStreamerId,
  currentUser = {
    name: 'LUCIANO 4E 🥷',
    handle: 'luciano',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  userCoins,
  onCoinsChange,
  showToast,
}) => {
  // Catalog view toggle
  const [showCatalog, setShowCatalog] = useState(false);

  // Streamers list and active index
  const [streamers, setStreamers] = useState<LiveMeStreamer[]>(LIVEME_STREAMERS);
  const [activeIndex, setActiveIndex] = useState(() => {
    if (initialStreamerId) {
      const idx = LIVEME_STREAMERS.findIndex((s) => s.id === initialStreamerId);
      return idx !== -1 ? idx : 0;
    }
    return 0;
  });

  const currentStreamer = streamers[activeIndex] || streamers[0];

  // Followed creators map
  const [followedMap, setFollowedMap] = useState<Record<string, boolean>>({});
  const isFollowing = !!followedMap[currentStreamer.handle];

  // Media & sound
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // Floating hearts
  const [floatingHearts, setFloatingHearts] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);

  // Modals & Drawers
  const [isGiftTrayOpen, setIsGiftTrayOpen] = useState(true);
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [isCoinGamesOpen, setIsCoinGamesOpen] = useState(false);

  // Gift tray state
  const [activeGiftCategory, setActiveGiftCategory] = useState<'popular' | 'special' | 'pranks' | 'nvip' | 'celebrity'>('popular');
  const [selectedGiftId, setSelectedGiftId] = useState<string>('rose');
  const [selectedCombo, setSelectedCombo] = useState<number>(1);

  // Chat state
  const [chatMessages, setChatMessages] = useState<LiveMeChatMessage[]>([
    {
      id: 'm1',
      user: 'Carlos_M',
      handle: 'carlos_m',
      level: 49,
      text: 'welcome back Jasmine! Looking amazing today 🔥',
      timestamp: Date.now() - 40000,
    },
    {
      id: 'm2',
      user: 'Sarita 🪽',
      handle: 'sarita_w',
      level: 40,
      text: 'FOLLOW FOLLOW FOLLOW everyone! Keep tapping the screen ♥',
      timestamp: Date.now() - 25000,
    },
    {
      id: 'm3',
      user: 'MrMaxLondon',
      handle: 'max_ldn',
      level: 23,
      text: 'joined the room',
      isJoin: true,
      timestamp: Date.now() - 10000,
    },
    {
      id: 'm4',
      user: 'ShadowWolf',
      handle: 'shadow_wolf',
      level: 55,
      text: 'sent Jasmine Rose x10! 🌹',
      isSystem: true,
      giftInfo: { name: 'Rose', icon: '🌹', count: 10, coins: 10 },
      timestamp: Date.now() - 4000,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Navigate between streamers
  const handleNextStream = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % streamers.length);
    showToast('Switched to next Live room ⮛');
  }, [streamers.length, showToast]);

  const handlePrevStream = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + streamers.length) % streamers.length);
    showToast('Switched to previous Live room ⮙');
  }, [streamers.length, showToast]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextStream();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevStream();
      } else if (e.key === 'Escape') {
        if (isRechargeOpen) setIsRechargeOpen(false);
        else if (isCoinGamesOpen) setIsCoinGamesOpen(false);
        else if (isGiftTrayOpen) setIsGiftTrayOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStream, handlePrevStream, isRechargeOpen, isCoinGamesOpen, isGiftTrayOpen, onClose]);

  // Tap / Double-tap heart reaction
  const spawnHeartReaction = (x?: number, y?: number) => {
    const stageWidth = stageRef.current ? stageRef.current.clientWidth : 440;
    const stageHeight = stageRef.current ? stageRef.current.clientHeight : 700;
    const posX = x !== undefined ? x : stageWidth / 2 + (Math.random() * 80 - 40);
    const posY = y !== undefined ? y : stageHeight - 160;

    const colors = ['#f43f5e', '#ec4899', '#a855f7', '#3b82f6', '#fbbf24'];
    const heart = {
      id: Date.now() + Math.random(),
      x: posX,
      y: posY,
      color: colors[Math.floor(Math.random() * colors.length)],
    };

    setFloatingHearts((prev) => [...prev.slice(-15), heart]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== heart.id));
    }, 2200);

    // Increment streamer likes count
    setStreamers((prev) =>
      prev.map((s, idx) =>
        idx === activeIndex ? { ...s, likesCount: s.likesCount + 1 } : s
      )
    );
  };

  // Follow / Unfollow streamer
  const handleToggleFollow = () => {
    const nextState = !isFollowing;
    setFollowedMap((prev) => ({
      ...prev,
      [currentStreamer.handle]: nextState,
    }));
    showToast(nextState ? `Followed ${currentStreamer.name}! ✨` : `Unfollowed ${currentStreamer.name}`);
  };

  // Send Chat Message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: LiveMeChatMessage = {
      id: `msg-${Date.now()}`,
      user: currentUser.name,
      handle: currentUser.handle,
      avatar: currentUser.avatar,
      level: 30,
      badge: 'VIP',
      text: chatInput.trim(),
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput('');
    spawnHeartReaction();
  };

  // Send Gift Handler
  const handleSendGift = () => {
    const gift = LIVEME_GIFTS.find((g) => g.id === selectedGiftId) || LIVEME_GIFTS[0];
    const totalCost = gift.coins * selectedCombo;

    if (userCoins < totalCost) {
      showToast(`⚠️ Insufficient coins! Need ${totalCost} 🪙, you have ${userCoins} 🪙.`);
      setIsRechargeOpen(true);
      return;
    }

    // Deduct coins from user
    onCoinsChange(-totalCost);

    // Increase streamer diamonds
    setStreamers((prev) =>
      prev.map((s, idx) =>
        idx === activeIndex ? { ...s, diamonds: s.diamonds + totalCost } : s
      )
    );

    // Add chat gift announcement
    const giftMsg: LiveMeChatMessage = {
      id: `gift-${Date.now()}`,
      user: currentUser.name,
      handle: currentUser.handle,
      level: 30,
      text: `sent ${currentStreamer.name} ${gift.name} x${selectedCombo}! ${gift.icon}`,
      isSystem: true,
      giftInfo: {
        name: gift.name,
        icon: gift.icon,
        count: selectedCombo,
        coins: totalCost,
      },
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, giftMsg]);

    // Dispatch global virtual gift animation player
    const animationKey = gift.animationKey || 'rose';
    const animGift = DEFAULT_GIFTS.find((g) => g.id === animationKey) || DEFAULT_GIFTS[0];

    const giftEvent: GiftEvent = {
      id: `evt_liveme_${Date.now()}`,
      livestreamId: currentStreamer.id,
      senderId: currentUser.handle,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      recipientId: currentStreamer.handle,
      recipientName: currentStreamer.name,
      giftId: animGift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      quantity: selectedCombo,
      coinValue: totalCost,
      createdAt: new Date().toISOString(),
    };

    globalGiftQueue.enqueue(giftEvent, animGift);

    showToast(`🎁 Sent ${gift.name} x${selectedCombo}! (-${totalCost} 🪙)`);
    spawnHeartReaction();
  };

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Copy share stream link
  const handleShareStream = () => {
    const url = `https://liveme.com/livehot/streaming/${currentStreamer.id.replace('liveme-', '')}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    showToast(`Link copied: ${url} ↗️`);
  };

  // Filtered gifts for current category
  const filteredGifts = LIVEME_GIFTS.filter((g) => g.category === activeGiftCategory);

  if (showCatalog) {
    return (
      <LiveMeHotCatalog
        onOpenStream={(id) => {
          const idx = streamers.findIndex((s) => s.id === id);
          if (idx !== -1) setActiveIndex(idx);
          setShowCatalog(false);
        }}
        onClose={() => setShowCatalog(false)}
        userCoins={userCoins}
        onCoinsChange={onCoinsChange}
        showToast={showToast}
        currentUser={currentUser}
      />
    );
  }

  return (
    <div className="liveme-room-root">
      {/* 1. AMBIENT BLURRED VIDEO WINGS (LEFT & RIGHT) */}
      <div className="liveme-ambient-wings">
        <video
          src={currentStreamer.videoStreamUrl}
          poster={currentStreamer.posterUrl}
          autoPlay
          loop
          muted
          playsInline
          className="liveme-ambient-wings-media"
        />
      </div>

      {/* 2. UP/DOWN STREAM SWITCHER PILL (RIGHT OF 9:16 VIDEO CANVAS) */}
      <div className="liveme-switcher-pill">
        <button
          type="button"
          className="liveme-switcher-btn"
          onClick={handlePrevStream}
          title="Previous Streamer (Arrow Up)"
        >
          ▲
        </button>
        <button
          type="button"
          className="liveme-switcher-btn"
          onClick={handleNextStream}
          title="Next Streamer (Arrow Down)"
        >
          ▼
        </button>
      </div>

      {/* 3. CENTRAL 9:16 LIVE STREAM STAGE */}
      <div
        className="liveme-center-stage"
        ref={stageRef}
        onClick={(e) => {
          const target = e.target as HTMLElement | null;
          if (
            target &&
            !target.closest('button, input, textarea, .liveme-gift-tray-panel, .liveme-top-bar, .liveme-bottom-bar, .liveme-chat-stream-layer')
          ) {
            const rect = stageRef.current?.getBoundingClientRect();
            if (rect) {
              spawnHeartReaction(e.clientX - rect.left, e.clientY - rect.top);
            } else {
              spawnHeartReaction();
            }
          }
        }}
      >
        {/* Stream Video Feed */}
        <video
          src={currentStreamer.videoStreamUrl}
          poster={currentStreamer.posterUrl}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          className="liveme-video-canvas"
        />

        {/* Video Lighting Overlay Tint */}
        <div className="liveme-video-overlay-tint" />

        {/* PRIVITY TRANSPARENT VIRTUAL GIFT ENGINE OVERLAY */}
        <GiftAnimationPlayer isMuted={isMuted} />

        {/* Floating Heart Reactions Layer */}
        <div className="liveme-floating-hearts-wrap">
          {floatingHearts.map((heart) => (
            <div
              key={heart.id}
              className="liveme-heart-particle"
              style={{
                left: `${heart.x}px`,
                top: `${heart.y}px`,
                color: heart.color,
              }}
            >
              ♥
            </div>
          ))}
        </div>

        {/* ================================================================ */}
        {/* 4. TOP BAR: STREAMER INFO (LEFT) & CONTRIBUTORS/CONTROLS (RIGHT) */}
        {/* ================================================================ */}
        <div className="liveme-top-bar">
          {/* Top-Left Streamer Capsule */}
          <div className="liveme-streamer-capsule">
            <div className="liveme-capsule-main">
              <div className="liveme-streamer-avatar-wrap">
                <img
                  src={currentStreamer.avatar}
                  alt={currentStreamer.name}
                  className="liveme-streamer-avatar"
                />
              </div>

              <div className="liveme-streamer-meta">
                <div className="liveme-streamer-name">{currentStreamer.name}</div>
                <div className="liveme-diamond-score">
                  <span>💎</span>
                  <span>{currentStreamer.diamonds.toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                className={`liveme-follow-btn ${isFollowing ? 'following' : ''}`}
                onClick={handleToggleFollow}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>

            {/* Sub-stats Row below capsule */}
            <div className="liveme-sub-stats-row">
              <div className="liveme-stat-item">
                <span>👁️ Total Views:</span>
                <span>{currentStreamer.totalViews}</span>
              </div>
              <span className="liveme-stat-divider">|</span>
              <div className="liveme-stat-item">
                <span>🔥 Popularity:</span>
                <span>{currentStreamer.popularity}</span>
              </div>
            </div>
          </div>

          {/* Top-Right Contributors & Controls */}
          <div className="liveme-top-right-group">
            {/* Top 3 Gifters Facepile */}
            <div className="liveme-top-gifters-pile">
              {currentStreamer.topContributors.map((c) => (
                <div
                  key={c.id}
                  className="liveme-gifter-avatar-slot"
                  title={`#${c.rank} Gifter: ${c.name} (${c.contribution.toLocaleString()} 🪙)`}
                >
                  <img src={c.avatar} alt={c.name} className="liveme-gifter-img" />
                  <span className="liveme-gifter-rank-crown">
                    {c.rank === 1 ? '👑' : c.rank === 2 ? '🥈' : '🥉'}
                  </span>
                </div>
              ))}
            </div>

            {/* Audience Count Pill */}
            <div
              className="liveme-audience-pill"
              title="Current Live Audience"
              onClick={() => showToast(`Room Audience: ${currentStreamer.viewersCount} active viewers`)}
            >
              <span>👥</span>
              <span>{currentStreamer.viewersCount}</span>
            </div>

            {/* LiveHot Catalog Link */}
            <button
              type="button"
              className="liveme-audience-pill"
              onClick={() => setShowCatalog(true)}
              title="Explore LiveHot Catalog"
              style={{ background: 'rgba(124, 58, 237, 0.55)', border: '1px solid rgba(168, 85, 247, 0.45)' }}
            >
              <span>★</span>
              <span>LiveHot</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              className="liveme-close-btn"
              onClick={onClose}
              title="Close Stream"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 5. FLOATING LIVE CHAT STREAM                                     */}
        {/* ================================================================ */}
        <div className="liveme-chat-stream-layer">
          <div className="liveme-chat-scroll-box" ref={chatScrollRef}>
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`liveme-chat-row ${msg.isSystem ? 'gift-notice' : ''} ${msg.isJoin ? 'join-notice' : ''}`}
              >
                {msg.level && (
                  <span
                    className={`liveme-level-badge ${
                      msg.level > 40 ? 'cyan' : msg.level > 25 ? 'blue' : 'green'
                    }`}
                  >
                    ⭐ {msg.level}
                  </span>
                )}
                <span className="liveme-chat-user">@{msg.user}:</span>
                <span className="liveme-chat-text">{msg.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ================================================================ */}
        {/* 6. BOTTOM CONTROLS BAR: CHAT INPUT & RIGHT TOOLBAR               */}
        {/* ================================================================ */}
        <div className="liveme-bottom-bar">
          {/* Chat Input Form */}
          <form onSubmit={handleSendChat} className="liveme-input-form">
            <input
              type="text"
              className="liveme-chat-input"
              placeholder="Say hi..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button
              type="submit"
              className="liveme-chat-send-btn"
              disabled={!chatInput.trim()}
              title="Send Message"
            >
              ➤
            </button>
          </form>

          {/* Right Toolbar Controls */}
          <div className="liveme-right-toolbar">
            {/* Coin Games Button */}
            <button
              type="button"
              className="liveme-coin-games-btn"
              onClick={() => setIsCoinGamesOpen(true)}
              title="Open Coin Games"
            >
              <span>🎮</span>
              <span>Coin Games</span>
            </button>

            {/* Volume Mute Toggle */}
            <button
              type="button"
              className="liveme-icon-btn"
              onClick={() => {
                setIsMuted(!isMuted);
                showToast(isMuted ? 'Sound unmuted 🔊' : 'Sound muted 🔇');
              }}
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {/* Share Stream Button */}
            <button
              type="button"
              className="liveme-icon-btn"
              onClick={handleShareStream}
              title="Share Stream Link"
            >
              ↗️
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              className="liveme-icon-btn"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen'}
            >
              {isFullscreen ? '⤦' : '⛶'}
            </button>

            {/* 3D Glowing Pink Gift Box Button (Toggles Gift Tray) */}
            <button
              type="button"
              className="liveme-gift-box-trigger"
              onClick={() => setIsGiftTrayOpen(!isGiftTrayOpen)}
              title="Open Gift Tray"
            >
              🎁
            </button>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 7. FLOATING INTERACTIVE GIFT TRAY (BOTTOM-RIGHT)                 */}
        {/* ================================================================ */}
        {isGiftTrayOpen && (
          <div className="liveme-gift-tray-panel" onClick={(e) => e.stopPropagation()}>
            {/* Header: User Coins Balance + Recharge Link */}
            <div className="liveme-tray-header">
              <div className="liveme-tray-coins-balance">
                <span>🪙</span>
                <span>{userCoins.toLocaleString()}</span>
              </div>
              <button
                type="button"
                className="liveme-tray-recharge-btn"
                onClick={() => setIsRechargeOpen(true)}
              >
                Recharge &gt;
              </button>
            </div>

            {/* Active Category Title */}
            <div className="liveme-tray-category-title">
              {activeGiftCategory.toUpperCase()}
            </div>

            {/* 4x4 Gifts Grid */}
            <div className="liveme-gifts-grid">
              {filteredGifts.map((gift) => (
                <div
                  key={gift.id}
                  className={`liveme-gift-card ${selectedGiftId === gift.id ? 'selected' : ''}`}
                  onClick={() => setSelectedGiftId(gift.id)}
                  title={`${gift.name} · ${gift.coins} Coins`}
                >
                  <div className="liveme-gift-icon-preview">
                    {gift.icon}
                  </div>
                  <div className="liveme-gift-price">
                    <span>🪙</span>
                    <span>{gift.coins}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Category Carousel Footer */}
            <div className="liveme-tray-category-carousel">
              <button
                type="button"
                className="liveme-carousel-arrow"
                onClick={() => {
                  const cats: Array<'popular' | 'special' | 'pranks' | 'nvip' | 'celebrity'> = [
                    'popular',
                    'special',
                    'pranks',
                    'nvip',
                    'celebrity',
                  ];
                  const idx = cats.indexOf(activeGiftCategory);
                  const next = cats[(idx - 1 + cats.length) % cats.length];
                  setActiveGiftCategory(next);
                }}
              >
                &lt;
              </button>

              <div className="liveme-carousel-tabs">
                <button
                  type="button"
                  className={`liveme-carousel-tab-btn ${activeGiftCategory === 'popular' ? 'active' : ''}`}
                  onClick={() => setActiveGiftCategory('popular')}
                >
                  Popular
                </button>
                <button
                  type="button"
                  className={`liveme-carousel-tab-btn ${activeGiftCategory === 'special' ? 'active' : ''}`}
                  onClick={() => setActiveGiftCategory('special')}
                >
                  Special
                </button>
                <button
                  type="button"
                  className={`liveme-carousel-tab-btn ${activeGiftCategory === 'pranks' ? 'active' : ''}`}
                  onClick={() => setActiveGiftCategory('pranks')}
                >
                  🍅 Pranks
                </button>
                <button
                  type="button"
                  className={`liveme-carousel-tab-btn ${activeGiftCategory === 'nvip' ? 'active' : ''}`}
                  onClick={() => setActiveGiftCategory('nvip')}
                >
                  NVIP ✨
                </button>
                <button
                  type="button"
                  className={`liveme-carousel-tab-btn ${activeGiftCategory === 'celebrity' ? 'active' : ''}`}
                  onClick={() => setActiveGiftCategory('celebrity')}
                >
                  Celebrity
                </button>
              </div>

              <button
                type="button"
                className="liveme-carousel-arrow"
                onClick={() => {
                  const cats: Array<'popular' | 'special' | 'pranks' | 'nvip' | 'celebrity'> = [
                    'popular',
                    'special',
                    'pranks',
                    'nvip',
                    'celebrity',
                  ];
                  const idx = cats.indexOf(activeGiftCategory);
                  const next = cats[(idx + 1) % cats.length];
                  setActiveGiftCategory(next);
                }}
              >
                &gt;
              </button>
            </div>

            {/* Bottom Action Bar: Combo Multiplier Pills & Send Button */}
            <div className="liveme-tray-action-bar">
              <div className="liveme-combo-pills-row">
                {[1, 10, 66, 99, 520, 1314].map((combo) => (
                  <button
                    key={combo}
                    type="button"
                    className={`liveme-combo-pill ${selectedCombo === combo ? 'active' : ''}`}
                    onClick={() => setSelectedCombo(combo)}
                  >
                    x{combo}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="liveme-send-gift-btn"
                onClick={handleSendGift}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* 8. AUTHENTIC LIVEME RECHARGE MODAL                               */}
      {/* ================================================================ */}
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

      {/* ================================================================ */}
      {/* 9. COIN GAMES MINI-GAME MODAL                                    */}
      {/* ================================================================ */}
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
