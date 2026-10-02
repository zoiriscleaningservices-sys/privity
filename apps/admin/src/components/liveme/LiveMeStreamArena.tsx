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
import { LiveMePkMatchModal } from './LiveMePkMatchModal';
import { LiveMeViewersModal, RoomViewer } from './LiveMeViewersModal';
import { GiftAnimationPlayer, globalGiftQueue, DEFAULT_GIFTS, GiftEvent } from '../../gifts';
import { liveStreamSync } from '../../services/liveStreamSyncService';
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
  onViewProfile?: (handle: string) => void;
  customStreamer?: LiveMeStreamer;
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
  onViewProfile,
  customStreamer,
}) => {
  // Catalog view toggle
  const [showCatalog, setShowCatalog] = useState(false);

  // Host Streamer Profile Definition
  const hostStreamer = useMemo<LiveMeStreamer>(() => ({
    id: `live-user-${currentUser.handle}`,
    handle: currentUser.handle,
    name: currentUser.name,
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
    const networkStreams = liveStreamSync.getStreamersList();
    const combined: LiveMeStreamer[] = [];
    if (isHostBroadcast) {
      combined.push(hostStreamer);
    }
    if (customStreamer && !combined.some((s) => s.id === customStreamer.id)) {
      combined.push(customStreamer);
    }
    for (const ns of networkStreams) {
      if (!combined.some((s) => s.id === ns.id)) {
        combined.push(ns);
      }
    }
    for (const ms of LIVEME_STREAMERS) {
      if (!combined.some((s) => s.id === ms.id)) {
        combined.push(ms);
      }
    }
    return combined;
  });

  const [activeIndex, setActiveIndex] = useState(() => {
    if (isHostBroadcast) return 0;
    if (initialStreamerId) {
      const idx = streamers.findIndex((s) => s.id === initialStreamerId);
      return idx !== -1 ? idx : 0;
    }
    return 0;
  });

  const currentStreamer = streamers[activeIndex] || streamers[0];
  const isHost = isHostBroadcast || !!currentStreamer.isHost;

  // Remote P2P Live Camera Video Stream
  const [remoteP2PStream, setRemoteP2PStream] = useState<MediaStream | null>(null);
  const [p2pConnectionStatus, setP2pConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');

  useEffect(() => {
    if (isHost) {
      setRemoteP2PStream(null);
      setP2pConnectionStatus('idle');
      return;
    }

    const targetPeerId =
      currentStreamer.peerId ||
      (currentStreamer.isCameraStream
        ? `privity-live-${currentStreamer.handle.toLowerCase().replace(/[^a-z0-9]/g, '')}`
        : null);

    if (!targetPeerId) {
      setRemoteP2PStream(null);
      setP2pConnectionStatus('idle');
      return;
    }

    const cleanup = liveStreamSync.connectToRemoteStream(
      targetPeerId,
      (incomingStream) => {
        setRemoteP2PStream(incomingStream);
        setP2pConnectionStatus('connected');
      },
      (status) => {
        setP2pConnectionStatus(status);
      }
    );

    return () => {
      cleanup();
      setRemoteP2PStream(null);
    };
  }, [isHost, currentStreamer.id, currentStreamer.peerId, currentStreamer.handle, currentStreamer.isCameraStream]);

  // Real Hardware Camera Video Elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ambientVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(userMediaStream || null);

  const bindHostVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && localStreamRef.current) {
      if (node.srcObject !== localStreamRef.current) {
        node.srcObject = localStreamRef.current;
      }
      node.setAttribute('playsinline', 'true');
      node.setAttribute('webkit-playsinline', 'true');
      node.muted = true;
      node.play().catch(() => {});
    }
  }, []);

  // Host Camera Hardware Controls
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState(true);
  const isAcquiringLiveCameraRef = useRef(false);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [streamDurationSec, setStreamDurationSec] = useState(0);
  const [liveViewersCount, setLiveViewersCount] = useState(185);
  const [diamondsEarned, setDiamondsEarned] = useState(0);
  const [likesReceived, setLikesReceived] = useState(1420);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isConfirmEndOpen, setIsConfirmEndOpen] = useState(false);
  const broadcastStartTimestampRef = useRef<number>(Date.now());

  // Initialize start timestamp from stored session if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem('privity_current_live_host');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.startedAt && typeof p.startedAt === 'number') {
          broadcastStartTimestampRef.current = p.startedAt;
        }
      }
    } catch {}
  }, []);

  // 1A. Mobile Scroll Lock & Interaction Isolation (Only comments scroll)
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyWidth = document.body.style.width;
    const prevBodyHeight = document.body.style.height;
    const prevBodyTouchAction = document.body.style.touchAction;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      // Allow scrolling strictly inside comments scroll container or interactive modals
      const isScrollable = target && target.closest(
        '.liveme-chat-scroll-box, .liveme-gift-tray-scroll, .liveme-pk-radar-scroll, .liveme-sub-pills-row, .liveme-games-modal-body, .liveme-recharge-modal-body, .liveme-summary-card'
      );
      if (!isScrollable && e.cancelable) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.width = prevBodyWidth;
      document.body.style.height = prevBodyHeight;
      document.body.style.touchAction = prevBodyTouchAction;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // 1B. Camera & Stream Reconnection on App Wake / Multitasking Return
  useEffect(() => {
    if (!isHost) return;

    const handleAppWake = async () => {
      if (document.visibilityState === 'visible') {
        // Resume paused video elements if paused by mobile OS
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
        if (ambientVideoRef.current && ambientVideoRef.current.paused) {
          ambientVideoRef.current.play().catch(() => {});
        }

        // Check if camera tracks died in background
        const tracks = localStreamRef.current?.getVideoTracks() || [];
        const isAlive = tracks.length > 0 && tracks[0].readyState === 'live';
        if (!isAlive && !isVideoOff && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: cameraFacing } },
              audio: !isMicMuted,
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
            showToastRef.current('🔴 Live Stream Restored · You are Live');
          } catch (err) {
            console.warn('Live camera wake recovery error:', err);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleAppWake);
    window.addEventListener('pageshow', handleAppWake);
    window.addEventListener('focus', handleAppWake);

    return () => {
      document.removeEventListener('visibilitychange', handleAppWake);
      window.removeEventListener('pageshow', handleAppWake);
      window.removeEventListener('focus', handleAppWake);
    };
  }, [isHost, cameraFacing, isMicMuted, isVideoOff]);

  // PK Battle Duel State (Default false: Stream starts in full-screen solo mode!)
  const [isPkBattleActive, setIsPkBattleActive] = useState(false);
  const [isPkMatchModalOpen, setIsPkMatchModalOpen] = useState(false);
  const [hostPkScore, setHostPkScore] = useState(3);
  const [rivalPkScore, setRivalPkScore] = useState(4);
  const [battleRoundTimer, setBattleRoundTimer] = useState(121);
  const [battleWinner, setBattleWinner] = useState<'host' | 'rival' | 'draw' | null>(null);
  const [pkDamageFloating, setPkDamageFloating] = useState<Array<{ id: number; text: string; color: string }>>([]);

  const formatBattleTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Dynamic Rival Streamer in PK Battle (defaults to mel<3... from TikTok reference)
  const [pkRival, setPkRival] = useState<LiveMeStreamer>(() => {
    return LIVEME_STREAMERS.find((s) => s.handle.includes('mel')) || LIVEME_STREAMERS[0];
  });

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
  const [isViewersModalOpen, setIsViewersModalOpen] = useState(false);

  // Dynamic real-time likes map
  const [streamerLikesMap, setStreamerLikesMap] = useState<Record<string, number>>({});

  // Real-time room audience roster
  const roomViewers = useMemo<RoomViewer[]>(() => {
    return [
      {
        id: 'v1',
        name: 'Carlos Mendez',
        handle: 'carlos_m',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
        level: 49,
        badge: 'Top Fan 🏆',
        isVip: true,
        contribution: 15400,
        isFollowing: true,
      },
      {
        id: 'v2',
        name: 'Sarah Williams 🪽',
        handle: 'sarita_w',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
        level: 40,
        badge: 'Fan Club ⭐',
        isVip: true,
        contribution: 8200,
        isFollowing: false,
      },
      {
        id: 'v3',
        name: 'Max London',
        handle: 'max_ldn',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120',
        level: 28,
        badge: 'Knight ⚔️',
        isVip: true,
        contribution: 4500,
        isFollowing: true,
      },
      {
        id: 'v4',
        name: 'Elena Rostova',
        handle: 'elena_r',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120',
        level: 33,
        isVip: false,
        contribution: 1200,
      },
      {
        id: 'v5',
        name: 'Kenji Sato',
        handle: 'kenji_tokyo',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120',
        level: 21,
        isVip: false,
        contribution: 650,
      },
      {
        id: 'v6',
        name: 'Chloe Monet',
        handle: 'chloe_m',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120',
        level: 19,
        isVip: false,
        contribution: 200,
      },
      {
        id: 'v7',
        name: 'David Kim',
        handle: 'david_k',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120',
        level: 15,
        isVip: false,
      },
      {
        id: 'v8',
        name: 'Amina Al-Mansoor',
        handle: 'amina_dxb',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120',
        level: 25,
        badge: 'Supporter 💫',
        isVip: false,
        contribution: 800,
      },
    ];
  }, []);

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

  // 1. HARDWARE WEBCAM & MEDIA STREAM CONNECTION ENGINE (MOBILE COMPATIBLE - NO FLICKER)
  useEffect(() => {
    if (!isHost) return;

    let activeStream: MediaStream | null = userMediaStream || null;
    let didRequestCamera = false;

    const bindStreamToVideos = (stream: MediaStream) => {
      localStreamRef.current = stream;
      if (videoRef.current) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
      if (ambientVideoRef.current) {
        if (ambientVideoRef.current.srcObject !== stream) {
          ambientVideoRef.current.srcObject = stream;
        }
        ambientVideoRef.current.setAttribute('playsinline', 'true');
        ambientVideoRef.current.setAttribute('webkit-playsinline', 'true');
        ambientVideoRef.current.muted = true;
        ambientVideoRef.current.play().catch(() => {});
      }
    };

    if (activeStream && activeStream.active && activeStream.getVideoTracks().length > 0) {
      bindStreamToVideos(activeStream);
    } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      if (isAcquiringLiveCameraRef.current) return;
      isAcquiringLiveCameraRef.current = true;
      didRequestCamera = true;
      const acquireStream = async () => {
        let stream: MediaStream | null = null;
        try {
          // Tier 1: Soft facingMode constraint (front selfie or back)
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: cameraFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: true,
          });
        } catch (tier1Err) {
          console.warn('LiveMe Tier 1 failed, trying video only:', tier1Err);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: cameraFacing },
              },
              audio: false,
            });
          } catch (tier2Err) {
            console.warn('LiveMe Tier 2 failed, enumerating devices for front camera:', tier2Err);
            try {
              const devices = await navigator.mediaDevices.enumerateDevices();
              const videoInputs = devices.filter((d) => d.kind === 'videoinput');
              const isTargetUser = cameraFacing === 'user';
              const matchedDevice = videoInputs.find((d) => {
                const label = (d.label || '').toLowerCase();
                return isTargetUser
                  ? label.includes('front') || label.includes('user') || label.includes('facetime') || label.includes('truedepth')
                  : label.includes('back') || label.includes('rear') || label.includes('environment');
              }) || videoInputs[0];

              if (matchedDevice) {
                stream = await navigator.mediaDevices.getUserMedia({
                  video: { deviceId: { exact: matchedDevice.deviceId } },
                  audio: false,
                });
              }
            } catch (tier3Err) {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
              });
            }
          }
        }

        if (stream) {
          // Detect actual camera facing mode from the acquired stream
          const track = stream.getVideoTracks()[0];
          if (track) {
            const settings = track.getSettings?.();
            if (settings?.facingMode) {
              const actual = settings.facingMode as 'user' | 'environment';
              setCameraFacing(actual);
              setIsMirrored(actual === 'user');
            }
          }
          bindStreamToVideos(stream);
          liveStreamSync.updateHostMediaStream(stream);
          showToastRef.current('🔴 Live Camera & Mic Connected!');
        }
      };

      acquireStream().catch((err) => {
        console.warn('Camera stream error:', err);
        showToastRef.current('Broadcasting in live simulation mode');
      }).finally(() => {
        isAcquiringLiveCameraRef.current = false;
      });
    }

    return () => {
      if (didRequestCamera && localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isHost, userMediaStream, cameraFacing]);

  // 2. CROSS-TAB & CROSS-VIEWER BROADCAST CHANNEL SYNC
  useEffect(() => {
    if (!isHost) return;

    // Register active broadcast session in localStorage & sync bus
    const hostMeta = {
      id: `live-user-${currentUser.handle}`,
      handle: currentUser.handle,
      name: currentUser.name,
      avatar: currentUser.avatar,
      title: currentStreamer?.title || '🔴 LIVE: High-Energy Room & PK Battle',
      startedAt: Date.now(),
      viewersCount: liveViewersCount,
    };

    try {
      localStorage.setItem('privity_current_live_host', JSON.stringify(hostMeta));
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_HOST_STARTED', host: hostMeta });
    } catch {}

    // Start network host broadcast across ALL devices worldwide via MQTT & PeerJS
    liveStreamSync.startHostBroadcast(
      {
        id: `live-user-${currentUser.handle}`,
        creatorHandle: currentUser.handle,
        creatorName: currentUser.name,
        creatorAvatar: currentUser.avatar,
        isVerified: true,
        title: currentStreamer?.title || '🔴 LIVE: High-Energy Room & PK Battle',
        category: currentStreamer?.category || 'Featured',
        description: currentStreamer?.description || 'Live streaming sovereign node',
        viewersCount: liveViewersCount,
        likesCount: likesReceived,
        previewUrl: currentUser.avatar,
        tags: ['LiveNow', 'Host', 'Privity'],
      },
      localStreamRef.current || userMediaStream || null
    ).catch(() => {});

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
  }, [isHost, currentUser, liveViewersCount, isVideoOff, currentStreamer?.title, currentStreamer?.category, currentStreamer?.description, userMediaStream, likesReceived]);

  // 3. BROADCAST DURATION CLOCK & AUDIENCE SIMULATOR
  useEffect(() => {
    if (!isHost) return;

    const updateTimer = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - broadcastStartTimestampRef.current) / 1000));
      setStreamDurationSec(elapsed);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

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
        if (isConfirmEndOpen) setIsConfirmEndOpen(false);
        else if (isSummaryOpen) setIsSummaryOpen(false);
        else if (isRechargeOpen) setIsRechargeOpen(false);
        else if (isCoinGamesOpen) setIsCoinGamesOpen(false);
        else if (isGiftTrayOpen) setIsGiftTrayOpen(false);
        else if (isHost) setIsConfirmEndOpen(true);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStream, handlePrevStream, isSummaryOpen, isConfirmEndOpen, isRechargeOpen, isCoinGamesOpen, isGiftTrayOpen, isHost, onClose]);

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

    // Increment streamer likes count in real-time
    const streamerId = currentStreamer.id;
    setStreamerLikesMap((prev) => {
      const current = prev[streamerId] ?? currentStreamer.likesCount;
      return { ...prev, [streamerId]: current + 1 };
    });
    setLikesReceived((prev) => prev + 1);
    setStreamers((prev) =>
      prev.map((s, idx) =>
        idx === activeIndex ? { ...s, likesCount: s.likesCount + 1 } : s
      )
    );

    // Cross-device and cross-tab broadcast like
    try {
      liveStreamSync.sendRoomEvent(currentStreamer.id, {
        type: 'LIVE_LIKE',
        streamerId: currentStreamer.id,
      });
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_LIKE', streamerId: currentStreamer.id });
      bus.close();
    } catch {}
  };

  // Cross-device room events subscription (real-time likes & chat)
  useEffect(() => {
    return liveStreamSync.subscribeToRoomEvents(currentStreamer.id, (evt) => {
      if (evt.type === 'LIVE_LIKE') {
        const sid = evt.streamerId || currentStreamer.id;
        setStreamerLikesMap((prev) => {
          const current = prev[sid] ?? currentStreamer.likesCount;
          return { ...prev, [sid]: current + 1 };
        });
        setLikesReceived((prev) => prev + 1);
      } else if (evt.type === 'LIVE_CHAT' && evt.message) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === evt.message.id)) return prev;
          return [...prev.slice(-35), evt.message];
        });
      }
    });
  }, [currentStreamer.id, currentStreamer.likesCount]);

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
    setIsMirrored(nextFacing === 'user');
    showToast(nextFacing === 'user' ? 'Front camera 🤳' : 'Back camera 📷');
  };

  // Host Controls: Toggle Mirror Angle Reflection
  const handleToggleMirror = () => {
    setIsMirrored((prev) => {
      const next = !prev;
      showToast(next ? 'Mirror angle ON 🪞 (Selfie reflection)' : 'True view ON (Standard angle)');
      return next;
    });
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
    liveStreamSync.stopHostBroadcast();
    try {
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_HOST_ENDED', handle: currentUser.handle });
      localStorage.removeItem('privity_current_live_host');
      localStorage.removeItem('privity_is_host_broadcasting');
      localStorage.removeItem('privity_active_live_session');
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

    try {
      liveStreamSync.sendRoomEvent(currentStreamer.id, {
        type: 'LIVE_CHAT',
        message: newMsg,
      });
    } catch {}
  };

  // Send Real Project Gift Handler
  const handleSendGift = () => {
    const gift = LIVEME_GIFTS.find((g) => g.id === selectedGiftId) || LIVEME_GIFTS[0];
    handleSelectAndSendGift(gift);
  };

  // Select and immediately dispatch gift, then close gift tray as requested
  const handleSelectAndSendGift = (gift: (typeof LIVEME_GIFTS)[0]) => {
    setSelectedGiftId(gift.id);
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

    try {
      liveStreamSync.sendRoomEvent(currentStreamer.id, {
        type: 'LIVE_CHAT',
        message: giftMsg,
      });
    } catch {}

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

    // Cross-tab broadcast gift
    try {
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_GIFT', event: giftEvent, animGift });
      bus.close();
    } catch {}

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

    // Immediately close the gift tray as requested so the animation is clearly visible!
    setIsGiftTrayOpen(false);
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

  // Mobile Gestures:
  // - Swipe Up: Next live room
  // - Swipe Down: Previous live room
  // - Swipe Right: Minimize live stream to PiP
  // - Swipe Left: Open creator's profile page
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'input, textarea, button, .liveme-gift-tray-panel, .liveme-viewers-sheet, .liveme-recharge-modal, .liveme-coin-games-modal, .liveme-pk-modal, .liveme-chat-scroll-box'
      )
    ) {
      return;
    }
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const duration = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    if (duration > 750) return;

    // Vertical Swipes: Up = Next Live, Down = Previous Live
    if (absY > 45 && absY > absX * 1.2) {
      if (deltaY < 0) {
        handleNextStream();
      } else {
        handlePrevStream();
      }
      return;
    }

    // Horizontal Swipes:
    // Right swipe: Minimize stream to PiP (or back out)
    if (deltaX > 55 && absX > absY * 1.2) {
      onClose();
      return;
    }

    // Left swipe: Open creator profile
    if (deltaX < -55 && absX > absY * 1.2) {
      if (onViewProfile) {
        onViewProfile(currentStreamer.handle);
      } else {
        showToast(`Viewing @${currentStreamer.handle}'s profile`);
      }
      return;
    }
  };

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
    <div
      className="liveme-room-root"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
        ) : remoteP2PStream ? (
          <video
            ref={(node) => {
              if (node && node.srcObject !== remoteP2PStream) {
                node.srcObject = remoteP2PStream;
                node.play().catch(() => {});
              }
            }}
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
        className={`liveme-center-stage ${isPkBattleActive ? 'is-pk-active' : ''}`}
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
              ref={bindHostVideoRef}
              autoPlay
              playsInline
              muted={true}
              poster={currentUser.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900'}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  videoRef.current.play().catch(() => {});
                }
              }}
              className={`liveme-video-canvas ${isMirrored ? 'mirrored' : ''}`}
            />
          ) : remoteP2PStream ? (
            <video
              ref={(node) => {
                if (node && node.srcObject !== remoteP2PStream) {
                  node.srcObject = remoteP2PStream;
                  node.setAttribute('playsinline', 'true');
                  node.setAttribute('webkit-playsinline', 'true');
                  node.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              muted={isMuted}
              className="liveme-video-canvas"
            />
          ) : (currentStreamer.peerId || currentStreamer.isCameraStream) ? (
            <div className="liveme-connecting-camera-backdrop">
              <img
                src={currentStreamer.posterUrl || currentStreamer.avatar}
                alt={currentStreamer.name}
                className="liveme-connecting-bg-blur"
              />
              <div className="liveme-connecting-overlay-content">
                <div className="liveme-connecting-avatar-ring">
                  <img
                    src={currentStreamer.avatar}
                    alt={currentStreamer.name}
                    className="liveme-connecting-avatar"
                  />
                  <div className="liveme-connecting-pulse-ring" />
                </div>
                <div className="liveme-connecting-title">
                  {p2pConnectionStatus === 'connected' ? 'Streaming Live' : 'Connecting Real-Time P2P Broadcast...'}
                </div>
                <div className="liveme-connecting-subtitle">
                  Direct peer-to-peer live feed from @{currentStreamer.handle}
                </div>
              </div>
            </div>
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
        {/* PK BATTLE DUAL SPLIT-SCREEN (100% EXACT TIKTOK LIVE SPEC)        */}
        {/* ================================================================ */}
        {isPkBattleActive && (
          <div className="liveme-pk-stage-wrap">
            {/* Split Tug-of-War Score Bar (Edge-to-Edge) */}
            <div className="liveme-pk-tug-bar-dock">
              <div className="liveme-pk-bar-track">
                {/* Host Pink Half */}
                <div className="liveme-pk-bar-host" style={{ width: `${hostPkPercentage}%` }}>
                  <span className="liveme-pk-score-large">{hostPkScore}</span>
                </div>

                {/* Center Collision & Timer Badge */}
                <div className="liveme-pk-center-badge">
                  <span className="liveme-pk-clash-icon">🥊</span>
                  <span className="liveme-pk-timer-digits">
                    {formatBattleTimer(battleRoundTimer)}
                  </span>
                </div>

                {/* Rival Cyan Half */}
                <div className="liveme-pk-bar-rival" style={{ width: `${100 - hostPkPercentage}%` }}>
                  <span className="liveme-pk-score-large">{rivalPkScore}</span>
                </div>
              </div>
            </div>

            {/* Split Video Stage: Edge-to-Edge (Left 50% & Right 50%) */}
            <div className="liveme-pk-split-grid">
              {/* Left Half Box: Host */}
              <div
                className="liveme-pk-half-box host"
                onClick={handleCheerHost}
                title="Tap to Cheer Host! +5 Points"
              >
                {/* Top Corner Win Streak Badge */}
                <div className="liveme-pk-win-badge left">
                  <span>WIN x 0</span>
                </div>

                {/* Host Video Stream (Webcam or Video) */}
                {isHost ? (
                  <video
                    ref={bindHostVideoRef}
                    autoPlay
                    playsInline
                    muted={true}
                    poster={currentUser.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900'}
                    src={!localStreamRef.current ? 'https://assets.mixkit.co/videos/preview/mixkit-young-man-talking-on-a-video-call-42996-large.mp4' : undefined}
                    loop={!localStreamRef.current}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                    className={`liveme-pk-video-layer ${isMirrored ? 'mirrored' : ''}`}
                  />
                ) : remoteP2PStream ? (
                  <video
                    ref={(node) => {
                      if (node && node.srcObject !== remoteP2PStream) {
                        node.srcObject = remoteP2PStream;
                        node.setAttribute('playsinline', 'true');
                        node.setAttribute('webkit-playsinline', 'true');
                        node.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted={isMuted}
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

                {/* Bottom Left Streamer Tag */}
                <div className="liveme-pk-streamer-tag left">
                  <span>@{currentUser.handle}</span>
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
                {/* Top Corner Win Streak Badge */}
                <div className="liveme-pk-win-badge right">
                  <span>WIN x 4</span>
                </div>

                {/* Rival Video Stream */}
                <video
                  src={pkRival.videoStreamUrl}
                  poster={pkRival.posterUrl || pkRival.avatar}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="liveme-pk-video-layer"
                />

                {/* Bottom Right Streamer Tag with Follow Pill */}
                <div className="liveme-pk-streamer-tag right">
                  <span>@{pkRival.handle}</span>
                  <button
                    type="button"
                    className="liveme-pk-follow-plus"
                    onClick={(e) => {
                      e.stopPropagation();
                      showToast(`Followed @${pkRival.handle}!`);
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Contributor Chairs Row directly under the two boxes (Exact TikTok LIVE Spec) */}
            <div className="liveme-pk-dual-chairs-bar">
              {/* Host Chairs (Left 50%) */}
              <div className="liveme-pk-chairs-half left">
                <div className="liveme-pk-chair-slot empty" title="Empty chair">🪑</div>
                <div className="liveme-pk-chair-slot empty" title="Empty chair">🪑</div>
                <div className="liveme-pk-chair-slot rank-1" title="Top Gifter">
                  <img src={currentUser.avatar} alt="Top Gifter" />
                  <span className="liveme-chair-crown">👑1</span>
                </div>
              </div>

              {/* Rival Chairs (Right 50%) */}
              <div className="liveme-pk-chairs-half right">
                {(pkRival.topContributors || []).slice(0, 2).map((c, i) => (
                  <div key={c.id || i} className={`liveme-pk-chair-slot rank-${i + 1}`} title={`#${i + 1} Gifter`}>
                    <img src={c.avatar} alt={c.name} />
                    <span className="liveme-chair-crown">{i === 0 ? '👑1' : '👑2'}</span>
                  </div>
                ))}
                <div className="liveme-pk-chair-slot empty" title="Empty chair">🪑</div>
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
        {/* 4. TOP BAR: STREAMER INFO (LEFT) & CLOSE / AUDIENCE (RIGHT)      */}
        {/* ================================================================ */}
        <div className="liveme-top-bar">
          {/* Top-Left Streamer Capsule (Only Avatar + Name + Likes) */}
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
              <div
                className="liveme-diamond-score"
                onClick={() => {
                  spawnHeartReaction();
                  const likesNow = streamerLikesMap[currentStreamer.id] ?? (isHost ? likesReceived : currentStreamer.likesCount);
                  showToast(`❤️ Exact Real-Time Likes: ${likesNow.toLocaleString()}`);
                }}
                style={{ cursor: 'pointer' }}
                title="Tap to like & view exact real-time hearts count"
              >
                <span style={{ color: '#f43f5e' }}>♥</span>
                <span>
                  {(() => {
                    const count = streamerLikesMap[currentStreamer.id] ?? (isHost ? likesReceived : currentStreamer.likesCount);
                    return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count;
                  })()}
                </span>
              </div>
            </div>

            {!isHost && (
              <button
                type="button"
                className={`liveme-follow-btn ${isFollowing ? 'following' : ''}`}
                onClick={handleToggleFollow}
              >
                {isFollowing ? 'Following' : '+ Join'}
              </button>
            )}
          </div>

          {/* Top-Right Contributors & Controls */}
          <div className="liveme-top-right-group">
            {/* Top Gifters Facepile (compact 2 slots) */}
            <div className="liveme-top-gifters-pile">
              {currentStreamer.topContributors.slice(0, 2).map((c) => (
                <div
                  key={c.id}
                  className="liveme-gifter-avatar-slot"
                  title={`#${c.rank} Gifter: ${c.name} (${c.contribution.toLocaleString()} 🪙)`}
                >
                  <img src={c.avatar} alt={c.name} className="liveme-gifter-img" />
                  <span className="liveme-gifter-rank-crown">
                    {c.rank === 1 ? '👑' : '🥈'}
                  </span>
                </div>
              ))}
            </div>

            {/* Audience Count Pill */}
            <div
              className="liveme-audience-pill"
              title="Click to view all live people in this room"
              onClick={() => setIsViewersModalOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <span>👥</span>
              <span>{(isHost ? liveViewersCount : currentStreamer.viewersCount).toLocaleString()}</span>
            </div>

            {/* Close / End Live Button (Prominent X button at very top right) */}
            <button
              type="button"
              id="liveme-end-broadcast-btn"
              className="liveme-close-btn"
              onClick={isHost ? () => setIsConfirmEndOpen(true) : onClose}
              title={isHost ? 'End Broadcast' : 'Close Stream'}
              aria-label={isHost ? 'End Broadcast' : 'Close Stream'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Row 2: Sub-pills row (Exact TikTok LIVE Spec: Daily Ranking, Goal, Gallery) */}
        <div className="liveme-sub-pills-row">
          <div className="liveme-sub-pill ranking">
            <span>🔥</span>
            <span>Daily Ranking</span>
          </div>
          <div className="liveme-sub-pill goal">
            <span>🎆</span>
            <span>0/1</span>
          </div>
          <div className="liveme-sub-pill gallery">
            <span>Gift Gallery...</span>
            <span>🏎️</span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 5. FLOATING LIVE CHAT STREAM (EXACT TIKTOK LIVE SPEC)            */}
        {/* ================================================================ */}
        <div className="liveme-chat-stream-layer">
          <div className="liveme-chat-scroll-box" ref={chatScrollRef}>
            {/* TikTok LIVE Official Welcome & Match Banners */}
            <div className="liveme-chat-system-banner">
              <span className="liveme-tiktok-icon">🎵</span>
              <p>Welcome to TikTok LIVE! Have fun interacting with others in real time. Creators must be 18 or older to go LIVE. Viewers must be 18 or older to recharge and send Gifts. Remember to follow our Community Guidelines.</p>
            </div>

            {isPkBattleActive && (
              <div className="liveme-chat-system-banner match-start">
                <span className="liveme-tiktok-icon">🎵</span>
                <p>LIVE Match has started! Cheer on your creator, like the match, and send Gifts.</p>
              </div>
            )}

            <div className="liveme-chat-join-row">
              <span className="liveme-join-hand">👋</span>
              <span className="liveme-join-gem">💎29</span>
              <span className="liveme-join-name">{currentUser.name} 🇨🇺</span>
              <span className="liveme-join-text">joined</span>
            </div>

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
        {/* 6. UNIFIED MODERN BOTTOM CONTROLS BAR                             */}
        {/* ================================================================ */}
        <div className="liveme-bottom-bar">
          {/* Chat Input Form (Type... with Smiley) */}
          <form onSubmit={handleSendChat} className="liveme-input-form">
            <div className="liveme-chat-input-wrap">
              <input
                type="text"
                className="liveme-chat-input"
                placeholder="Type..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button
                type="button"
                className="liveme-chat-smiley-btn"
                onClick={() => setChatInput((prev) => prev + ' 😊')}
              >
                😊
              </button>
            </div>
          </form>

          {/* Right Toolbar Action Icons */}
          <div className="liveme-toolbar-actions">
            {isHost ? (
              <>
                {/* 1. PK Battle Matchmaker Trigger (Clean, modern icon button) */}
                <button
                  type="button"
                  className={`liveme-tool-btn liveme-match-trigger ${isPkBattleActive ? 'active' : ''}`}
                  onClick={() => setIsPkMatchModalOpen(true)}
                  title={isPkBattleActive ? "Manage PK Battle" : "Find PK Battle Match"}
                >
                  ⚔️
                </button>

                {/* 2. Flip Camera Front/Back */}
                <button
                  type="button"
                  className="liveme-tool-btn"
                  onClick={handleFlipCamera}
                  title="Flip Camera (Front/Back)"
                >
                  🔄
                </button>

                {/* 3. Mirror Angle Reflection */}
                <button
                  type="button"
                  className={`liveme-tool-btn ${isMirrored ? 'active' : ''}`}
                  onClick={handleToggleMirror}
                  title="Toggle Mirror Reflection for Best Angle"
                >
                  🪞
                </button>

                {/* 4. Mute Microphone */}
                <button
                  type="button"
                  className={`liveme-tool-btn ${isMicMuted ? 'danger' : ''}`}
                  onClick={handleToggleMic}
                  title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMicMuted ? '🔇' : '🎙️'}
                </button>

                {/* 5. Toggle Video Camera */}
                <button
                  type="button"
                  className={`liveme-tool-btn ${isVideoOff ? 'danger' : ''}`}
                  onClick={handleToggleVideo}
                  title={isVideoOff ? "Enable Video" : "Pause Video"}
                >
                  {isVideoOff ? '🚫' : '📹'}
                </button>
              </>
            ) : (
              <>
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

                {/* 3D Glowing Pink Gift Box Button (Viewers only, NOT host) */}
                <button
                  type="button"
                  className="liveme-gift-box-trigger"
                  onClick={() => setIsGiftTrayOpen(!isGiftTrayOpen)}
                  title="Open Gift Tray"
                >
                  🎁
                </button>
              </>
            )}
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
                  onClick={() => handleSelectAndSendGift(gift)}
                  title={`Tap to send ${gift.name} · ${gift.coins} Coins`}
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
      {/* 9. PK BATTLE CREATOR MATCHMAKER MODAL                            */}
      {/* ================================================================ */}
      <LiveMePkMatchModal
        isOpen={isPkMatchModalOpen}
        onClose={() => setIsPkMatchModalOpen(false)}
        isPkBattleActive={isPkBattleActive}
        currentRival={pkRival}
        hostScore={hostPkScore}
        rivalScore={rivalPkScore}
        roundTimer={battleRoundTimer}
        onStartPkBattle={(rival) => {
          setPkRival(rival);
          setIsPkBattleActive(true);
          setHostPkScore(3);
          setRivalPkScore(4);
          setBattleRoundTimer(121);
          setBattleWinner(null);
        }}
        onEndPkBattle={() => {
          setIsPkBattleActive(false);
        }}
        onRematch={() => {
          setHostPkScore(3);
          setRivalPkScore(4);
          setBattleRoundTimer(121);
          setBattleWinner(null);
        }}
        showToast={showToast}
      />

      {/* ================================================================ */}
      {/* 10. AUTHENTIC LIVEME RECHARGE MODAL                              */}
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
      {/* 11. ROOM VIEWERS & REAL-TIME AUDIENCE MODAL                      */}
      {/* ================================================================ */}
      <LiveMeViewersModal
        isOpen={isViewersModalOpen}
        onClose={() => setIsViewersModalOpen(false)}
        streamerName={currentStreamer.name}
        viewersCount={isHost ? liveViewersCount : currentStreamer.viewersCount}
        viewers={roomViewers}
        isHost={isHost}
        onViewProfile={onViewProfile}
        showToast={showToast}
      />

      {/* ================================================================ */}
      {/* 12. HOST END LIVE CONFIRMATION MODAL                             */}
      {/* ================================================================ */}
      {isConfirmEndOpen && (
        <div className="liveme-confirm-end-backdrop" onClick={() => setIsConfirmEndOpen(false)}>
          <div className="liveme-confirm-end-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="liveme-confirm-end-icon">⚠️</div>
            <div className="liveme-confirm-end-title">End LIVE Broadcast?</div>
            <div className="liveme-confirm-end-desc">
              Your viewers are currently watching. Are you sure you want to end your live stream?
            </div>
            <div className="liveme-confirm-end-actions">
              <button
                type="button"
                className="liveme-confirm-resume-btn"
                onClick={() => setIsConfirmEndOpen(false)}
              >
                Resume LIVE
              </button>
              <button
                type="button"
                className="liveme-confirm-terminate-btn"
                onClick={() => {
                  setIsConfirmEndOpen(false);
                  handleEndBroadcastClick();
                }}
              >
                End Now
              </button>
            </div>
          </div>
        </div>
      )}

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
