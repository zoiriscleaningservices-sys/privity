import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

export interface LiveBroadcastSummaryData {
  durationSeconds: number;
  viewersPeak: number;
  diamondsEarned: number;
  likesCount: number;
  followersGained: number;
}

export interface LiveMeStreamArenaProps {
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
  isHostBroadcast?: boolean;
  userMediaStream?: MediaStream | null;
  onEndBroadcast?: (summary?: LiveBroadcastSummaryData) => void;
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
  isHostBroadcast = false,
  userMediaStream = null,
  onEndBroadcast,
}) => {
  // Catalog view toggle
  const [showCatalog, setShowCatalog] = useState(false);

  // Host Streamer Profile Definition
  const hostStreamer = useMemo<LiveMeStreamer>(() => ({
    id: `live-user-${currentUser.handle}`,
    handle: currentUser.handle,
    name: `${currentUser.name} 🔴`,
    avatar: currentUser.avatar,
    isVerified: true,
    category: 'Visionary Host',
    title: 'Live Broadcast · Privity Sovereign Stream & PK Battle 🔥',
    description: 'Streaming live directly to authorized circles! Tap screen for hearts ♥',
    viewersCount: 185,
    totalViews: '2.4K',
    popularity: '3.2K',
    diamonds: 24500,
    likesCount: 1420,
    videoStreamUrl: '',
    posterUrl: currentUser.avatar,
    isHost: true,
    isCameraStream: true,
    tags: ['Host', 'Live', 'PKBattle'],
    topContributors: [
      { id: 'c1', name: 'ShadowWolf', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120', rank: 1, contribution: 85400 },
      { id: 'c2', name: 'AngelEyes', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120', rank: 2, contribution: 42300 },
      { id: 'c3', name: 'Sarita', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120', rank: 3, contribution: 29100 },
    ],
  }), [currentUser]);

  // Streamers list and active index
  const [streamers, setStreamers] = useState<LiveMeStreamer[]>(() => {
    if (isHostBroadcast) {
      return [hostStreamer, ...LIVEME_STREAMERS];
    }
    return LIVEME_STREAMERS;
  });

  const [activeIndex, setActiveIndex] = useState(() => {
    if (isHostBroadcast) return 0;
    if (initialStreamerId) {
      const idx = LIVEME_STREAMERS.findIndex((s) => s.id === initialStreamerId);
      return idx !== -1 ? idx : 0;
    }
    return 0;
  });

  const currentStreamer = streamers[activeIndex] || streamers[0];
  const isHost = isHostBroadcast || !!currentStreamer.isHost;

  // Real Hardware Camera Video Elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ambientVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(userMediaStream || null);

  // Host Camera Hardware Controls
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [streamDurationSec, setStreamDurationSec] = useState(0);
  const [liveViewersCount, setLiveViewersCount] = useState(185);
  const [diamondsEarned, setDiamondsEarned] = useState(0);
  const [likesReceived, setLikesReceived] = useState(1420);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // PK Battle Duel State (100% Match to Real LiveMe Room)
  const [isPkBattleActive, setIsPkBattleActive] = useState(true);
  const [hostPkScore, setHostPkScore] = useState(1850);
  const [rivalPkScore, setRivalPkScore] = useState(1420);
  const [battleRoundTimer, setBattleRoundTimer] = useState(60);
  const [battleWinner, setBattleWinner] = useState<'host' | 'rival' | 'draw' | null>(null);
  const [pkDamageFloating, setPkDamageFloating] = useState<Array<{ id: number; text: string; color: string }>>([]);

  // Rival Streamer in PK Battle
  const pkRival = useMemo(() => ({
    name: 'Elena Rodriguez ⚡',
    handle: 'elena_rodriguez',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-dj-mixing-music-in-a-club-41712-large.mp4',
    chairs: [
      { id: 'op1', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120', rank: 1 },
      { id: 'op2', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120', rank: 2 },
      { id: 'op3', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120', rank: 3 },
    ],
  }), []);

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
  const [isGiftTrayOpen, setIsGiftTrayOpen] = useState(false);
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
      text: 'welcome back! Looking amazing today in the stream 🔥',
      timestamp: Date.now() - 40000,
    },
    {
      id: 'm2',
      user: 'Sarita 🪽',
      handle: 'sarita_w',
      level: 40,
      text: 'FOLLOW FOLLOW FOLLOW everyone! Keep tapping the screen ♥ for the PK battle!',
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
      text: 'sent Rose x10! 🌹',
      isSystem: true,
      giftInfo: { name: 'Rose', icon: '🌹', count: 10, coins: 10 },
      timestamp: Date.now() - 4000,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 1. HARDWARE WEBCAM & MEDIA STREAM CONNECTION ENGINE
  useEffect(() => {
    if (!isHost) return;

    let activeStream: MediaStream | null = userMediaStream || null;
    let didRequestCamera = false;

    const bindStreamToVideos = (stream: MediaStream) => {
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      if (ambientVideoRef.current) {
        ambientVideoRef.current.srcObject = stream;
        ambientVideoRef.current.play().catch(() => {});
      }
    };

    if (activeStream && activeStream.active && activeStream.getVideoTracks().length > 0) {
      bindStreamToVideos(activeStream);
    } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      didRequestCamera = true;
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        })
        .then((stream) => {
          bindStreamToVideos(stream);
          showToast('🔴 Live Camera & Mic Connected!');
        })
        .catch((err) => {
          console.warn('Camera stream error:', err);
          showToast('Broadcasting in live simulation mode (Camera unavailable)');
        });
    }

    return () => {
      if (didRequestCamera && localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isHost, userMediaStream, cameraFacing, showToast]);

  // 2. CROSS-TAB & CROSS-VIEWER BROADCAST CHANNEL SYNC
  useEffect(() => {
    if (!isHost) return;

    // Register active broadcast session in localStorage & sync bus
    const hostMeta = {
      id: `live-user-${currentUser.handle}`,
      handle: currentUser.handle,
      name: currentUser.name,
      avatar: currentUser.avatar,
      title: '🔴 LIVE: High-Energy Room & PK Battle',
      startedAt: Date.now(),
      viewersCount: liveViewersCount,
    };

    try {
      localStorage.setItem('privity_current_live_host', JSON.stringify(hostMeta));
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_HOST_STARTED', host: hostMeta });
    } catch {}

    // Offscreen Canvas to emit live video frames across tabs
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 360;
    offscreenCanvas.height = 640;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    let frameChannel: BroadcastChannel | null = null;
    try {
      frameChannel = new BroadcastChannel('privity_live_frames');
    } catch {}

    const frameSyncInterval = setInterval(() => {
      if (videoRef.current && offscreenCtx && frameChannel && !isVideoOff) {
        try {
          offscreenCtx.drawImage(videoRef.current, 0, 0, 360, 640);
          const frameJpeg = offscreenCanvas.toDataURL('image/jpeg', 0.55);
          frameChannel.postMessage({
            type: 'FRAME',
            handle: currentUser.handle,
            frame: frameJpeg,
          });
        } catch {}
      }
    }, 120);

    return () => {
      clearInterval(frameSyncInterval);
      if (frameChannel) frameChannel.close();
    };
  }, [isHost, currentUser, liveViewersCount, isVideoOff]);

  // 3. BROADCAST DURATION CLOCK & AUDIENCE SIMULATOR
  useEffect(() => {
    if (!isHost) return;

    const timer = setInterval(() => {
      setStreamDurationSec((prev) => prev + 1);
    }, 1000);

    // Occasional simulated audience updates
    const audienceTimer = setInterval(() => {
      setLiveViewersCount((prev) => Math.max(12, prev + Math.floor(Math.random() * 7 - 2)));
    }, 4500);

    return () => {
      clearInterval(timer);
      clearInterval(audienceTimer);
    };
  }, [isHost]);

  // 4. PK BATTLE ROUND COUNTDOWN & SCORE DYNAMICS
  useEffect(() => {
    if (!isPkBattleActive) return;

    const timer = setInterval(() => {
      setBattleRoundTimer((prev) => {
        if (prev <= 1) {
          // Battle finished: determine winner
          setHostPkScore((hostScore) => {
            setRivalPkScore((rivalScore) => {
              if (hostScore > rivalScore) {
                setBattleWinner('host');
                showToast('🏆 PK VICTORY! Host won the battle!');
              } else if (rivalScore > hostScore) {
                setBattleWinner('rival');
              } else {
                setBattleWinner('draw');
              }
              return rivalScore;
            });
            return hostScore;
          });

          // Reset for next round after 7 seconds
          setTimeout(() => {
            setBattleWinner(null);
            setBattleRoundTimer(60);
          }, 7000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Opponent score dynamic cheering
    const rivalCheerTimer = setInterval(() => {
      if (battleRoundTimer > 0) {
        setRivalPkScore((prev) => prev + Math.floor(Math.random() * 20));
      }
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(rivalCheerTimer);
    };
  }, [isPkBattleActive, battleRoundTimer, showToast]);

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
        if (isSummaryOpen) setIsSummaryOpen(false);
        else if (isRechargeOpen) setIsRechargeOpen(false);
        else if (isCoinGamesOpen) setIsCoinGamesOpen(false);
        else if (isGiftTrayOpen) setIsGiftTrayOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStream, handlePrevStream, isSummaryOpen, isRechargeOpen, isCoinGamesOpen, isGiftTrayOpen, onClose]);

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
    setLikesReceived((prev) => prev + 1);
    setStreamers((prev) =>
      prev.map((s, idx) =>
        idx === activeIndex ? { ...s, likesCount: s.likesCount + 1 } : s
      )
    );
  };

  // Trigger floating PK Hit Damage text
  const triggerPkHit = (text: string, color = '#fbbf24') => {
    const item = { id: Date.now() + Math.random(), text, color };
    setPkDamageFloating((prev) => [...prev.slice(-6), item]);
    setTimeout(() => {
      setPkDamageFloating((prev) => prev.filter((p) => p.id !== item.id));
    }, 1300);
  };

  // Cheer host in PK Battle (Tap Left Box)
  const handleCheerHost = (e?: React.MouseEvent) => {
    if (e) {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect) spawnHeartReaction(e.clientX - rect.left, e.clientY - rect.top);
    } else {
      spawnHeartReaction();
    }
    setHostPkScore((prev) => prev + 5);
    triggerPkHit('+5 CHEER! ♥', '#f43f5e');
  };

  // Host Controls: Flip Camera
  const handleFlipCamera = async () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    showToast('Switching camera angle...');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        localStreamRef.current = newStream;
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.play().catch(() => {});
        }
        if (ambientVideoRef.current) {
          ambientVideoRef.current.srcObject = newStream;
          ambientVideoRef.current.play().catch(() => {});
        }
        showToast('Camera flipped');
      }
    } catch {
      showToast('Could not access alternative camera');
    }
  };

  // Host Controls: Toggle Mic
  const handleToggleMic = () => {
    const nextState = !isMicMuted;
    setIsMicMuted(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextState;
      });
    }
    showToast(nextState ? '🎙️ Mic Muted' : '🎙️ Mic Live');
  };

  // Host Controls: Toggle Video
  const handleToggleVideo = () => {
    const nextState = !isVideoOff;
    setIsVideoOff(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !nextState;
      });
    }
    showToast(nextState ? '📹 Camera Off' : '📹 Camera Resumed');
  };

  // Host Controls: End Broadcast cleanly
  const handleEndBroadcastClick = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    try {
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_HOST_ENDED', handle: currentUser.handle });
      localStorage.removeItem('privity_current_live_host');
    } catch {}

    setIsSummaryOpen(true);
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

  // Send Real Project Gift Handler
  const handleSendGift = () => {
    const gift = LIVEME_GIFTS.find((g) => g.id === selectedGiftId) || LIVEME_GIFTS[0];
    const totalCost = gift.coins * selectedCombo;

    if (userCoins < totalCost) {
      showToast(`🪙 Insufficient Coins! Required: ${totalCost}, You have: ${userCoins}`);
      setIsRechargeOpen(true);
      return;
    }

    // Deduct coins
    onCoinsChange(-totalCost);

    // Play authentic audio sound effect
    if (gift.soundUrl) {
      try {
        const audio = new Audio(gift.soundUrl);
        audio.volume = isMuted ? 0 : 0.85;
        audio.play().catch(() => {});
      } catch {}
    }

    // Post to chat stream with special gift notice
    const giftMsg: LiveMeChatMessage = {
      id: `gift-${Date.now()}`,
      user: currentUser.name,
      handle: currentUser.handle,
      level: 45,
      text: `sent ${gift.name} x${selectedCombo}! ${gift.icon}`,
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

    // In PK battle, add huge points and trigger damage burst
    if (isPkBattleActive) {
      const dmg = totalCost * 2;
      setHostPkScore((prev) => prev + dmg);
      triggerPkHit(`+${dmg.toLocaleString()} GIFT CRIT! 🔥`, '#ec4899');
    }

    // Add diamonds to host
    setDiamondsEarned((prev) => prev + totalCost);
    setStreamers((prev) =>
      prev.map((s, idx) =>
        idx === activeIndex ? { ...s, diamonds: s.diamonds + totalCost } : s
      )
    );

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

  // Format Elapsed Time (e.g. 02:45)
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate PK Tug-of-War percentage widths
  const hostPkPercentage = useMemo(() => {
    const total = hostPkScore + rivalPkScore;
    if (total <= 0) return 50;
    return Math.max(12, Math.min(88, Math.round((hostPkScore / total) * 100)));
  }, [hostPkScore, rivalPkScore]);

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
        {isHost ? (
          <video
            ref={ambientVideoRef}
            autoPlay
            playsInline
            muted
            className="liveme-ambient-wings-media"
          />
        ) : (
          <video
            src={currentStreamer.videoStreamUrl}
            poster={currentStreamer.posterUrl}
            autoPlay
            loop
            muted
            playsInline
            className="liveme-ambient-wings-media"
          />
        )}
      </div>

      {/* 2. UP/DOWN STREAM SWITCHER PILL (RIGHT OF 9:16 VIDEO CANVAS) */}
      {!isHost && (
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
      )}

      {/* 3. CENTRAL 9:16 LIVE STREAM STAGE */}
      <div
        className="liveme-center-stage"
        ref={stageRef}
        onClick={(e) => {
          const target = e.target as HTMLElement | null;
          if (
            target &&
            !target.closest('button, input, textarea, .liveme-gift-tray-panel, .liveme-top-bar, .liveme-bottom-bar, .liveme-host-dock, .liveme-chat-stream-layer')
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
        {/* Solo Video Feed (Active when PK Battle is toggled off) */}
        {!isPkBattleActive && (
          isHost ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMicMuted}
              className="liveme-video-canvas"
            />
          ) : (
            <video
              src={currentStreamer.videoStreamUrl}
              poster={currentStreamer.posterUrl}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              className="liveme-video-canvas"
            />
          )
        )}

        {/* ================================================================ */}
        {/* PK BATTLE DUAL SPLIT-SCREEN (100% MATCH TO REAL LIVEME ROOM)     */}
        {/* ================================================================ */}
        {isPkBattleActive && (
          <div className="liveme-pk-stage-wrap">
            {/* Split Tug-of-War Progress Bar */}
            <div className="liveme-pk-tug-bar-dock">
              <div className="liveme-pk-bar-track">
                <div className="liveme-pk-bar-host" style={{ width: `${hostPkPercentage}%` }}>
                  <span>{hostPkScore.toLocaleString()}</span>
                </div>

                <div className="liveme-pk-center-badge">
                  <span>🥊</span>
                  <span>{battleRoundTimer > 0 ? `Battle round: ${battleRoundTimer}s` : 'ROUND END'}</span>
                </div>

                <div className="liveme-pk-bar-rival" style={{ width: `${100 - hostPkPercentage}%` }}>
                  <span>{rivalPkScore.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Split Video Stage: Left Host (50%) & Right Rival (50%) */}
            <div className="liveme-pk-split-grid">
              {/* Left Half Box: Host */}
              <div
                className="liveme-pk-half-box host"
                onClick={handleCheerHost}
                title="Tap to Cheer Host! +5 Points"
              >
                {/* Header */}
                <div className="liveme-pk-half-header">
                  <span className="liveme-pk-badge-pill host">Host: {currentUser.name.split(' ')[0]}</span>
                  <span className="liveme-pk-score-num">🪙 {hostPkScore.toLocaleString()}</span>
                </div>

                {/* Host Video Stream (Webcam or Video) */}
                {isHost ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isMicMuted}
                    className="liveme-pk-video-layer"
                  />
                ) : (
                  <video
                    src={currentStreamer.videoStreamUrl}
                    poster={currentStreamer.posterUrl}
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    className="liveme-pk-video-layer"
                  />
                )}

                {/* Contributor Chairs under Host */}
                <div className="liveme-pk-chairs-row">
                  {currentStreamer.topContributors.slice(0, 3).map((c, i) => (
                    <div key={c.id || i} className="liveme-pk-chair-circle" title={`#${i + 1} Contributor: ${c.name}`}>
                      <img src={c.avatar} alt={c.name} />
                      <span className="liveme-pk-chair-rank">{i === 0 ? '👑' : i + 1}</span>
                    </div>
                  ))}
                </div>

                {/* Floating Damage Cheer Numbers */}
                {pkDamageFloating.map((dmg) => (
                  <div key={dmg.id} className="liveme-pk-cheer-burst" style={{ color: dmg.color }}>
                    {dmg.text}
                  </div>
                ))}
              </div>

              {/* Right Half Box: Rival Streamer */}
              <div className="liveme-pk-half-box rival">
                {/* Header */}
                <div className="liveme-pk-half-header">
                  <span className="liveme-pk-badge-pill rival">Rival: {pkRival.name.split(' ')[0]}</span>
                  <span className="liveme-pk-score-num">🪙 {rivalPkScore.toLocaleString()}</span>
                </div>

                {/* Rival Video Stream */}
                <video
                  src={pkRival.videoUrl}
                  poster={pkRival.avatar}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="liveme-pk-video-layer"
                />

                {/* Contributor Chairs under Rival */}
                <div className="liveme-pk-chairs-row">
                  {pkRival.chairs.map((chair, i) => (
                    <div key={chair.id} className="liveme-pk-chair-circle" title={`#${i + 1} Rival Gifter`}>
                      <img src={chair.avatar} alt="Rival Gifter" />
                      <span className="liveme-pk-chair-rank">{i === 0 ? '👑' : i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Victory Celebration Banner */}
            {battleWinner === 'host' && (
              <div className="liveme-pk-victory-banner">
                🏆 VICTORY! 🏆
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, opacity: 0.9 }}>
                  Host Won the PK Duel! +2,500 Bonus Diamonds
                </div>
              </div>
            )}
          </div>
        )}

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
                <div className="liveme-streamer-name">
                  {currentStreamer.name}
                </div>
                <div className="liveme-diamond-score">
                  <span>💎</span>
                  <span>{(currentStreamer.diamonds + diamondsEarned).toLocaleString()}</span>
                </div>
              </div>

              {!isHost && (
                <button
                  type="button"
                  className={`liveme-follow-btn ${isFollowing ? 'following' : ''}`}
                  onClick={handleToggleFollow}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Host LIVE Status Beacon or Sub-stats */}
            {isHost ? (
              <div className="liveme-host-status-badge">
                <span className="liveme-pulse-dot" />
                <span>LIVE</span>
                <span className="liveme-host-timer-text">{formatTimer(streamDurationSec)}</span>
              </div>
            ) : (
              <div className="liveme-sub-stats-row">
                <div className="liveme-stat-item">
                  <span>👁️ Views:</span>
                  <span>{currentStreamer.totalViews}</span>
                </div>
                <span className="liveme-stat-divider">|</span>
                <div className="liveme-stat-item">
                  <span>🔥 Pop:</span>
                  <span>{currentStreamer.popularity}</span>
                </div>
              </div>
            )}
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
              onClick={() => showToast(`Room Audience: ${isHost ? liveViewersCount : currentStreamer.viewersCount} active viewers`)}
            >
              <span>👥</span>
              <span>{isHost ? liveViewersCount : currentStreamer.viewersCount}</span>
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
              onClick={isHost ? handleEndBroadcastClick : onClose}
              title={isHost ? 'End Broadcast' : 'Close Stream'}
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
        {/* 6. HOST BROADCASTER FLOATING CONTROLS DOCK                        */}
        {/* ================================================================ */}
        {isHost && (
          <div className="liveme-host-dock">
            <button
              type="button"
              className="liveme-host-btn"
              onClick={handleFlipCamera}
              title="Flip Webcam"
            >
              🔄 Flip
            </button>

            <button
              type="button"
              className={`liveme-host-btn ${isMicMuted ? 'danger' : ''}`}
              onClick={handleToggleMic}
              title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMicMuted ? '🔇 Muted' : '🎙️ Mic'}
            </button>

            <button
              type="button"
              className={`liveme-host-btn ${isVideoOff ? 'danger' : ''}`}
              onClick={handleToggleVideo}
              title={isVideoOff ? 'Enable Video' : 'Pause Video'}
            >
              {isVideoOff ? '🚫 Cam Off' : '📹 Cam'}
            </button>

            <button
              type="button"
              className={`liveme-host-btn ${isPkBattleActive ? 'active' : ''}`}
              onClick={() => setIsPkBattleActive(!isPkBattleActive)}
              title="Toggle PK Battle Duel Mode"
            >
              ⚔️ PK {isPkBattleActive ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              className="liveme-host-btn danger"
              onClick={handleEndBroadcastClick}
              title="End Broadcast Session"
            >
              ⏹️ End
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* 7. BOTTOM CONTROLS BAR: CHAT INPUT & RIGHT TOOLBAR               */}
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
            >
              ➤
            </button>
          </form>

          {/* Right Toolbar Action Icons */}
          <div className="liveme-toolbar-actions">
            {/* Share Button */}
            <button
              type="button"
              className="liveme-tool-btn"
              onClick={handleShareStream}
              title="Share Stream"
            >
              ↗️
            </button>

            {/* Mute Button */}
            <button
              type="button"
              className="liveme-tool-btn"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              className="liveme-tool-btn"
              onClick={handleToggleFullscreen}
              title="Toggle Fullscreen"
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
        {/* 8. FLOATING INTERACTIVE GIFT TRAY (FEATURING REAL PROJECT GIFTS) */}
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

            {/* 4x4 Gifts Grid with Real .webp Icon Images */}
            <div className="liveme-gifts-grid">
              {filteredGifts.map((gift) => (
                <div
                  key={gift.id}
                  className={`liveme-gift-card ${selectedGiftId === gift.id ? 'selected' : ''}`}
                  onClick={() => setSelectedGiftId(gift.id)}
                  title={`${gift.name} · ${gift.coins} Coins`}
                >
                  <div className="liveme-gift-icon-preview">
                    {gift.imageIcon ? (
                      <img src={gift.imageIcon} className="liveme-gift-img-icon" alt={gift.name} />
                    ) : (
                      <span className="liveme-gift-emoji-icon">{gift.icon}</span>
                    )}
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
      {/* 9. AUTHENTIC LIVEME RECHARGE MODAL                               */}
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
      {/* 10. COIN GAMES MINI-GAME MODAL                                   */}
      {/* ================================================================ */}
      <LiveMeCoinGamesModal
        isOpen={isCoinGamesOpen}
        onClose={() => setIsCoinGamesOpen(false)}
        userCoins={userCoins}
        onCoinsChange={onCoinsChange}
        showToast={showToast}
      />

      {/* ================================================================ */}
      {/* 11. LIVE BROADCAST SUMMARY REPORT MODAL                          */}
      {/* ================================================================ */}
      {isSummaryOpen && (
        <div className="liveme-summary-modal-backdrop">
          <div className="liveme-summary-card">
            <img src={currentUser.avatar} alt={currentUser.name} className="liveme-summary-avatar" />
            <div className="liveme-summary-title">Broadcast Ended</div>
            <div className="liveme-summary-subtitle">Here is your live broadcast performance report</div>

            <div className="liveme-summary-stats-grid">
              <div className="liveme-summary-stat-cell">
                <span className="liveme-summary-stat-val">{formatTimer(streamDurationSec)}</span>
                <span className="liveme-summary-stat-lbl">Live Duration</span>
              </div>
              <div className="liveme-summary-stat-cell">
                <span className="liveme-summary-stat-val">💎 {diamondsEarned.toLocaleString()}</span>
                <span className="liveme-summary-stat-lbl">Diamonds Earned</span>
              </div>
              <div className="liveme-summary-stat-cell">
                <span className="liveme-summary-stat-val">👥 {liveViewersCount.toLocaleString()}</span>
                <span className="liveme-summary-stat-lbl">Total Viewers</span>
              </div>
              <div className="liveme-summary-stat-cell">
                <span className="liveme-summary-stat-val">❤️ {likesReceived.toLocaleString()}</span>
                <span className="liveme-summary-stat-lbl">Likes Received</span>
              </div>
            </div>

            <button
              type="button"
              className="liveme-summary-done-btn"
              onClick={() => {
                setIsSummaryOpen(false);
                if (onEndBroadcast) {
                  onEndBroadcast({
                    durationSeconds: streamDurationSec,
                    viewersPeak: liveViewersCount,
                    diamondsEarned,
                    likesCount: likesReceived,
                    followersGained: Math.floor(liveViewersCount * 0.12),
                  });
                }
                onClose();
              }}
            >
              Done & Return to Feed
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
