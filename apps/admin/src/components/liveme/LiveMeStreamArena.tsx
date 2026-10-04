import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LiveMeStreamer,
  LiveMeChatMessage,
  LiveMeContributor,
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
import { LiveUserProfileModal } from './LiveUserProfileModal';
import { LiveModerationModal } from './LiveModerationModal';
import { getUserLiveProfile, UserLiveProfile, getDeterministicLevel } from './userProfileUtils';
import { GiftAnimationPlayer, globalGiftQueue, DEFAULT_GIFTS, GiftEvent } from '../../gifts';
import { liveStreamSync, getRoomIdFromHandle } from '../../services/liveStreamSyncService';
import { authService } from '../../services/authService';
import { LiveBeautyEnhancementsModal, BEAUTY_FILTERS } from './LiveBeautyEnhancementsModal';
import { LiveStudioControlsModal } from './LiveStudioControlsModal';
import { LiveCoHostCreatorsModal } from './LiveCoHostCreatorsModal';
import { LiveGoLiveGuestsModal } from './LiveGoLiveGuestsModal';
import { LiveFilterCarouselTray, LIVE_FILTERS, FilterPreset } from './LiveFilterCarouselTray';
import { LiveGiftGoalModal, StreamGiftGoal } from './LiveGiftGoalModal';
import { LiveDailyLeaderboardModal } from './LiveDailyLeaderboardModal';
import { LiveGuestStageBox } from './LiveGuestStageBox';
import { broadcastViaSupabase, onSupabaseBroadcast } from '../../services/supabaseClient';
import './liveme.css';

export interface LiveBroadcastSummaryData {
  durationSeconds: number;
  viewersPeak: number;
  diamondsEarned: number;
  likesCount: number;
  followersGained: number;
}

export interface LiveMeStreamArenaProps {
  onClose: (opts?: { wasEnded?: boolean; isHost?: boolean }) => void;
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
    name: 'Member',
    handle: '',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
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

  // Host Streamer Profile Definition (Pure Real Data: starts with 0 viewers, 0 likes, 0 diamonds)
  const hostStreamer = useMemo<LiveMeStreamer>(() => ({
    id: `live-user-${getRoomIdFromHandle(currentUser.handle)}`,
    handle: currentUser.handle,
    name: currentUser.name,
    avatar: currentUser.avatar,
    isVerified: true,
    category: 'Visionary Host',
    title: 'Live Broadcast · Privity Sovereign Stream & PK Battle 🔥',
    description: 'Streaming live directly to authorized circles! Tap screen for hearts ♥',
    viewersCount: 0,
    totalViews: '0',
    popularity: '0',
    diamonds: 0,
    likesCount: 0,
    videoStreamUrl: '',
    posterUrl: currentUser.avatar,
    isHost: true,
    isCameraStream: true,
    tags: ['Host', 'Live', 'PKBattle'],
    topContributors: [],
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
  const isRealStream = isHost || !!currentStreamer.isHost || currentStreamer.id?.startsWith('live-user-') || !!currentStreamer.isCameraStream;

  // Remote P2P Live Camera Video Stream & Real-time Live Frame Stream
  const [remoteP2PStream, setRemoteP2PStream] = useState<MediaStream | null>(null);
  const [remoteLiveFrame, setRemoteLiveFrame] = useState<string | null>(null);
  const [p2pConnectionStatus, setP2pConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [roomContributors, setRoomContributors] = useState<LiveMeContributor[]>([]);
  const roomContributorsRef = useRef(roomContributors);
  roomContributorsRef.current = roomContributors;

  // Viewer join and leave room presence announcement
  useEffect(() => {
    if (!isHost) {
      const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'LIVE_JOIN',
        streamerId: currentStreamer.id,
        user: {
          name: currentUser.name,
          handle: currentUser.handle,
          avatar: currentUser.avatar,
        },
      });

      return () => {
        liveStreamSync.sendRoomEvent(roomId, {
          type: 'LIVE_LEAVE',
          streamerId: currentStreamer.id,
          user: {
            handle: currentUser.handle,
          },
        });
      };
    }
  }, [isHost, currentStreamer.id, currentStreamer.handle, currentUser.name, currentUser.handle, currentUser.avatar]);

  // Cross-tab live frame sync fallback
  useEffect(() => {
    if (isHost) return;
    let frameChannel: BroadcastChannel | null = null;
    try {
      frameChannel = new BroadcastChannel('privity_live_frames');
      frameChannel.onmessage = (e) => {
        if (e.data?.type === 'FRAME' && e.data.frame) {
          setRemoteLiveFrame(e.data.frame);
        }
      };
    } catch {}
    return () => {
      if (frameChannel) frameChannel.close();
    };
  }, [isHost]);

  useEffect(() => {
    if (isHost) {
      setRemoteP2PStream(null);
      setP2pConnectionStatus('idle');
      return;
    }

    const isRealCamera = currentStreamer.isCameraStream || currentStreamer.id?.startsWith('live-user-') || currentStreamer.peerId;
    if (!isRealCamera) {
      setRemoteP2PStream(null);
      setP2pConnectionStatus('idle');
      return;
    }

    const canonicalId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);

    const cleanup = liveStreamSync.connectToRemoteStream(
      canonicalId,
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
  const [liveViewersCount, setLiveViewersCount] = useState<number>(() => isRealStream ? (currentStreamer.viewersCount ?? 0) : (currentStreamer.viewersCount || 0));
  const [diamondsEarned, setDiamondsEarned] = useState<number>(() => isRealStream ? (currentStreamer.diamonds ?? 0) : 0);
  const [likesReceived, setLikesReceived] = useState<number>(() => isRealStream ? (currentStreamer.likesCount ?? 0) : (currentStreamer.likesCount || 0));
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isConfirmEndOpen, setIsConfirmEndOpen] = useState(false);
  const broadcastStartTimestampRef = useRef<number>(Date.now());

  // Live Arena Experience Modes:
  // - 'normal': Standard live broadcast overlay
  // - 'chat_reader': Large readable comments mode (triggered by swiping left)
  // - 'stream_hud': Time, duration, clocks & telemetry stats HUD (triggered by swiping right)
  const [arenaMode, setArenaMode] = useState<'normal' | 'chat_reader' | 'stream_hud'>('normal');
  const [readerFontSize, setReaderFontSize] = useState<number>(22);
  const [currentClockTime, setCurrentClockTime] = useState<Date>(() => new Date());
  const [modeFeedbackToast, setModeFeedbackToast] = useState<string | null>(null);
  const modeToastTimeoutRef = useRef<any>(null);

  const triggerModeChange = useCallback((newMode: 'normal' | 'chat_reader' | 'stream_hud') => {
    setArenaMode(newMode);
    if (modeToastTimeoutRef.current) clearTimeout(modeToastTimeoutRef.current);
    const label =
      newMode === 'chat_reader'
        ? '💬 Big Chat Mode • Large Messages'
        : newMode === 'stream_hud'
        ? '⏱️ Stream HUD • Time & Telemetry'
        : '🔴 Live Broadcast View';
    setModeFeedbackToast(label);
    modeToastTimeoutRef.current = setTimeout(() => {
      setModeFeedbackToast(null);
    }, 1800);
  }, []);

  // Real-world clock updates every second
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentClockTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Stable references for room subscription handlers to avoid tearing down
  const liveViewersCountRef = useRef(liveViewersCount);
  liveViewersCountRef.current = liveViewersCount;
  const likesReceivedRef = useRef(likesReceived);
  likesReceivedRef.current = likesReceived;
  const diamondsEarnedRef = useRef(diamondsEarned);
  diamondsEarnedRef.current = diamondsEarned;
  const immediateFrameCaptureRef = useRef<(() => void) | null>(null);

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
  const [isCoHostModalOpen, setIsCoHostModalOpen] = useState(false);
  const [isGuestsModalOpen, setIsGuestsModalOpen] = useState(false);
  const [isFilterTrayOpen, setIsFilterTrayOpen] = useState(false);
  const [activeLiveFilter, setActiveLiveFilter] = useState<FilterPreset>(LIVE_FILTERS[0]);
  const [showTapToUnmute, setShowTapToUnmute] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<{
    type: 'cohost' | 'guest';
    senderName: string;
    senderHandle: string;
    senderAvatar: string;
    timestamp: number;
  } | null>(null);
  const [floatingGuestPrompt, setFloatingGuestPrompt] = useState<{
    name: string;
    handle: string;
    avatar: string;
  } | null>({
    name: 'lbma99',
    handle: 'lbma99',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  });
  const [hostPkScore, setHostPkScore] = useState(3);
  const [rivalPkScore, setRivalPkScore] = useState(4);
  const [battleRoundTimer, setBattleRoundTimer] = useState(121);
  const [battleWinner, setBattleWinner] = useState<'host' | 'rival' | 'draw' | null>(null);
  const [pkDamageFloating, setPkDamageFloating] = useState<Array<{ id: number; text: string; color: string }>>([]);

  const isPkBattleActiveRef = useRef(isPkBattleActive);
  isPkBattleActiveRef.current = isPkBattleActive;
  const hostPkScoreRef = useRef(hostPkScore);
  hostPkScoreRef.current = hostPkScore;
  const rivalPkScoreRef = useRef(rivalPkScore);
  rivalPkScoreRef.current = rivalPkScore;
  const battleRoundTimerRef = useRef(battleRoundTimer);
  battleRoundTimerRef.current = battleRoundTimer;

  const formatBattleTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Dynamic Rival Streamer in PK Battle (defaults to mel<3... from TikTok reference)
  const [pkRival, setPkRival] = useState<LiveMeStreamer>(() => {
    return LIVEME_STREAMERS.find((s) => s.handle.includes('mel')) || LIVEME_STREAMERS[0];
  });
  const pkRivalRef = useRef(pkRival);
  pkRivalRef.current = pkRival;

  // Followed creators map (Synchronized with global privity_following_v5)
  const [followedMap, setFollowedMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('privity_following_v5');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const map: Record<string, boolean> = {};
          parsed.forEach((h: string) => { map[h.replace(/^@/, '').toLowerCase()] = true; });
          return map;
        } else if (typeof parsed === 'object') {
          const map: Record<string, boolean> = {};
          Object.keys(parsed).forEach((k) => {
            if (parsed[k]) map[k.replace(/^@/, '').toLowerCase()] = true;
          });
          return map;
        }
      }
    } catch {}
    return {};
  });
  const streamerHandleKey = (currentStreamer.handle || '').replace(/^@/, '').toLowerCase();
  const isFollowing = !!followedMap[streamerHandleKey];

  // Expanded chat input dock state
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const expandedInputRef = useRef<HTMLInputElement>(null);

  // Media & sound
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const [_isFullscreen, setIsFullscreen] = useState(false);
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

  // User Profile Mini-Card ("Little Tab") State
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserLiveProfile | null>(null);
  const [selectedProfileContribution, setSelectedProfileContribution] = useState<number>(0);
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);

  // Live Stream Moderation Management State
  const [mutedUsers, setMutedUsers] = useState<UserLiveProfile[]>([]);
  const [kickedUsers, setKickedUsers] = useState<UserLiveProfile[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<UserLiveProfile[]>([]);
  const [isModerationModalOpen, setIsModerationModalOpen] = useState(false);
  const [isUserMuted, setIsUserMuted] = useState(false);

  // Graceful "LIVE Ended" Overlay State (3-second countdown kicking viewers out)
  const [isLiveEndedOverlayOpen, setIsLiveEndedOverlayOpen] = useState(false);
  const [liveEndedData, setLiveEndedData] = useState<{
    hostName: string;
    hostAvatar: string;
    totalLikes: number;
    totalDiamonds: number;
    peakViewers: number;
    duration: number;
  } | null>(null);
  const [endedCountdown, setEndedCountdown] = useState(3);

  // Microphone Audio VU Meter & Voice Monitoring ("Hear Myself")
  const [isAudioMonitoring, setIsAudioMonitoring] = useState(false);
  const [micAudioLevel, setMicAudioLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const vuAnimRef = useRef<number | null>(null);

  // Real-time room audience roster (Accurate, dynamic tracking of viewers)
  const [activeAudience, setActiveAudience] = useState<RoomViewer[]>([]);

  // Fly-in Viewer Join Animation State (Banner flies in from left, stops, holds for 3.5s, then flies out)
  const [activeJoinBanner, setActiveJoinBanner] = useState<{
    id: string;
    name: string;
    handle: string;
    avatar: string;
    level: number;
    badge?: string;
    isExiting?: boolean;
  } | null>(null);
  const joinBannerQueueRef = useRef<Array<{
    id: string;
    name: string;
    handle: string;
    avatar: string;
    level: number;
    badge?: string;
  }>>([]);
  const joinBannerTimeoutRef = useRef<any>(null);

  const triggerJoinFlyIn = useCallback((user: { name: string; handle: string; avatar?: string; level?: number; badge?: string }) => {
    const entry = {
      id: `join-${Date.now()}-${Math.random()}`,
      name: user.name,
      handle: user.handle,
      avatar: user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
      level: user.level || getDeterministicLevel(user.handle),
      badge: user.badge || 'Fan ⭐',
    };
    joinBannerQueueRef.current.push(entry);
  }, []);

  // Process join banner queue
  useEffect(() => {
    const processQueue = () => {
      if (activeJoinBanner || joinBannerQueueRef.current.length === 0) return;
      const next = joinBannerQueueRef.current.shift();
      if (!next) return;
      setActiveJoinBanner(next);

      if (joinBannerTimeoutRef.current) clearTimeout(joinBannerTimeoutRef.current);
      joinBannerTimeoutRef.current = setTimeout(() => {
        setActiveJoinBanner((prev) => (prev ? { ...prev, isExiting: true } : null));
        setTimeout(() => {
          setActiveJoinBanner(null);
        }, 400);
      }, 3400);
    };

    const interval = setInterval(processQueue, 350);
    return () => clearInterval(interval);
  }, [activeJoinBanner]);

  // Beauty & Skin Enhancements State (Controlled via Bubble 2)
  const [isBeautyModalOpen, setIsBeautyModalOpen] = useState(false);
  const [skinSmoothing, setSkinSmoothing] = useState(30);
  const [skinLightening, setSkinLightening] = useState(20);
  const [skinTone, setSkinTone] = useState<'natural' | 'porcelain' | 'rosy' | 'golden'>('natural');
  const [activeBeautyFilter, setActiveBeautyFilter] = useState('normal');
  const [activeLighting, setActiveLighting] = useState('none');

  const computedVideoFilter = useMemo(() => {
    const b = 1 + (skinLightening / 100) * 0.35;
    const c = 1 - (skinSmoothing / 100) * 0.08;
    const s = 1 + (skinSmoothing / 100) * 0.15;

    let toneFilter = '';
    if (skinTone === 'porcelain') toneFilter = 'brightness(1.06) saturate(0.96)';
    else if (skinTone === 'rosy') toneFilter = 'hue-rotate(-5deg) saturate(1.1)';
    else if (skinTone === 'golden') toneFilter = 'sepia(0.12) saturate(1.18) hue-rotate(-6deg)';

    const filterObj = BEAUTY_FILTERS.find((f) => f.id === activeBeautyFilter);
    const presetFilter = filterObj && filterObj.cssFilter !== 'none' ? filterObj.cssFilter : '';
    const liveFilterCss = activeLiveFilter && activeLiveFilter.cssFilter !== 'none' ? activeLiveFilter.cssFilter : '';

    return `brightness(${b.toFixed(2)}) contrast(${c.toFixed(2)}) saturate(${s.toFixed(2)}) ${toneFilter} ${presetFilter} ${liveFilterCss}`.trim();
  }, [skinLightening, skinSmoothing, skinTone, activeBeautyFilter, activeLiveFilter]);

  const handleResetBeauty = useCallback(() => {
    setSkinSmoothing(0);
    setSkinLightening(0);
    setSkinTone('natural');
    setActiveBeautyFilter('normal');
    setActiveLighting('none');
  }, []);

  // Host Studio & Dual Camera State (Controlled via Bubble 3)
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isDualCameraActive, setIsDualCameraActive] = useState(false);
  const [dualCameraPosition, setDualCameraPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'split'>('top-right');
  const [secondaryMediaStream, setSecondaryMediaStream] = useState<MediaStream | null>(null);
  const [isDualSwapped, setIsDualSwapped] = useState(false);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  // Toggle Dual Camera Hardware Activation
  const handleToggleDualCamera = useCallback(async () => {
    if (isDualCameraActive) {
      if (secondaryMediaStream) {
        secondaryMediaStream.getTracks().forEach((t) => t.stop());
        setSecondaryMediaStream(null);
      }
      setIsDualCameraActive(false);
    } else {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const secondFacing = cameraFacing === 'user' ? 'environment' : 'user';
          const secondStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: secondFacing } },
            audio: false,
          });
          setSecondaryMediaStream(secondStream);
          setIsDualCameraActive(true);
        } catch {
          // Fallback: If hardware can only run 1 camera at once, create virtual PIP canvas stream
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 360;
            canvas.height = 640;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(0, 0, 360, 640);
              ctx.font = 'bold 22px sans-serif';
              ctx.fillStyle = '#38bdf8';
              ctx.fillText('📷 Dual Camera', 40, 280);
              ctx.font = '14px sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.fillText('Secondary Stream Active', 40, 320);
            }
            const virtStream = canvas.captureStream(15);
            setSecondaryMediaStream(virtStream);
            setIsDualCameraActive(true);
          } catch {}
        }
      }
    }
  }, [isDualCameraActive, cameraFacing, secondaryMediaStream]);

  // Bind secondary video
  useEffect(() => {
    if (isDualCameraActive && secondaryMediaStream && secondaryVideoRef.current) {
      secondaryVideoRef.current.srcObject = secondaryMediaStream;
      secondaryVideoRef.current.play().catch(() => {});
    }
  }, [isDualCameraActive, secondaryMediaStream]);

  // Host Target Stream Gift Goal State (Row 2 Goal Sub-Pill)
  const [isGiftGoalModalOpen, setIsGiftGoalModalOpen] = useState(false);
  const [streamGoal, setStreamGoal] = useState<StreamGiftGoal>({
    giftId: 'rose',
    giftName: 'Rose',
    giftIcon: '🌹',
    targetCount: 10,
    currentCount: 0,
  });

  // Daily Creator Leaderboard Modal State
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  // Active Co-Host Guests & 2-Way Stage State
  const [activeGuests, setActiveGuests] = useState<RoomViewer[]>([]);
  const [pendingGuestRequests, setPendingGuestRequests] = useState<RoomViewer[]>([]);
  const [isOnStageAsGuest, setIsOnStageAsGuest] = useState(false);
  const [isGuestRequestPending, setIsGuestRequestPending] = useState(false);
  const [guestLocalMediaStream, setGuestLocalMediaStream] = useState<MediaStream | null>(null);
  const guestLocalStreamRef = useRef<MediaStream | null>(null);
  const [guestMediaStreams, setGuestMediaStreams] = useState<Record<string, MediaStream>>({});

  // Allow setting remote guest media streams dynamically
  const registerGuestMediaStream = useCallback((handle: string, stream: MediaStream) => {
    const clean = handle.replace(/^@/, '').toLowerCase().trim();
    setGuestMediaStreams((prev) => ({ ...prev, [clean]: stream }));
  }, []);

  const handleInviteGuest = useCallback((viewer: RoomViewer) => {
    setActiveGuests((prev) => {
      if (prev.some((g) => g.handle === viewer.handle)) return prev;
      return [...prev, viewer];
    });
    const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
    liveStreamSync.sendRoomEvent(roomId, {
      type: 'GUEST_INVITED',
      targetHandle: viewer.handle,
      guest: viewer,
    });
    broadcastViaSupabase({
      action: 'LIVE_GUEST_INVITED',
      roomId,
      targetHandle: viewer.handle,
      guest: viewer,
    });
    showToast(`📩 Invited ${viewer.name} to join the stage as guest!`);
  }, [currentStreamer.handle, currentStreamer.id, showToast]);

  const handleRemoveGuest = useCallback((handle: string) => {
    setActiveGuests((prev) => prev.filter((g) => g.handle !== handle));
    const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
    liveStreamSync.sendRoomEvent(roomId, {
      type: 'GUEST_DISCONNECTED',
      handle,
    });
    broadcastViaSupabase({
      action: 'LIVE_GUEST_DISCONNECTED',
      roomId,
      handle,
    });
    showToast(`👋 Removed @${handle.replace(/^@/, '')} from stage`);
  }, [currentStreamer.handle, currentStreamer.id, showToast]);

  const handleStartGuestStage = useCallback(async () => {
    try {
      showToast('🎤 Accessing camera & microphone with zero-echo audio...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 },
      });
      guestLocalStreamRef.current = stream;
      setGuestLocalMediaStream(stream);
      setIsOnStageAsGuest(true);
      setIsGuestRequestPending(false);

      const myViewerObj: RoomViewer = {
        id: currentUser.handle,
        handle: currentUser.handle,
        name: currentUser.name,
        avatar: currentUser.avatar,
        level: 25,
        contribution: 1500,
        badge: 'Guest',
      };

      setActiveGuests((prev) => {
        if (prev.some((g) => g.handle === myViewerObj.handle)) return prev;
        return [...prev, myViewerObj];
      });

      const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'GUEST_JOINED_STAGE',
        guest: myViewerObj,
      });
      broadcastViaSupabase({
        action: 'LIVE_GUEST_JOINED_STAGE',
        roomId,
        guest: myViewerObj,
      });

      showToast('🎉 You are now LIVE on stage with the host! Talk away!');
    } catch (err) {
      console.warn('Microphone/camera access notice:', err);
      setIsOnStageAsGuest(true);
      setIsGuestRequestPending(false);
      const myViewerObj: RoomViewer = {
        id: currentUser.handle,
        handle: currentUser.handle,
        name: currentUser.name,
        avatar: currentUser.avatar,
        level: 25,
        contribution: 1500,
        badge: 'Guest',
      };
      setActiveGuests((prev) => {
        if (prev.some((g) => g.handle === myViewerObj.handle)) return prev;
        return [...prev, myViewerObj];
      });
      showToast('🎤 Joined guest stage! Ready to talk.');
    }
  }, [currentUser, currentStreamer.handle, currentStreamer.id, showToast]);

  const handleLeaveGuestStage = useCallback(() => {
    if (guestLocalStreamRef.current) {
      guestLocalStreamRef.current.getTracks().forEach((t) => t.stop());
      guestLocalStreamRef.current = null;
    }
    setGuestLocalMediaStream(null);
    setIsOnStageAsGuest(false);
    setIsGuestRequestPending(false);
    setActiveGuests((prev) => prev.filter((g) => g.handle !== currentUser.handle));
    const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
    liveStreamSync.sendRoomEvent(roomId, {
      type: 'GUEST_DISCONNECTED',
      handle: currentUser.handle,
    });
    broadcastViaSupabase({
      action: 'LIVE_GUEST_DISCONNECTED',
      roomId,
      handle: currentUser.handle,
    });
    showToast('👋 You left the stage');
  }, [currentUser.handle, currentStreamer.handle, currentStreamer.id, showToast]);

  const handleRequestJoinStage = useCallback(() => {
    if (isOnStageAsGuest) {
      handleLeaveGuestStage();
      return;
    }
    if (isGuestRequestPending) {
      showToast('⏳ Your request to join the stage is already pending host approval');
      return;
    }
    setIsGuestRequestPending(true);
    const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
    const viewerObj: RoomViewer = {
      id: currentUser.handle,
      handle: currentUser.handle,
      name: currentUser.name,
      avatar: currentUser.avatar,
      level: 15,
      contribution: 500,
      badge: 'Viewer',
    };
    liveStreamSync.sendRoomEvent(roomId, {
      type: 'GUEST_REQUEST',
      viewer: viewerObj,
      timestamp: Date.now(),
    });
    broadcastViaSupabase({
      action: 'LIVE_GUEST_REQUEST',
      roomId,
      viewer: viewerObj,
    });
    showToast('✋ Stage request sent to host! Waiting for approval...');
  }, [isOnStageAsGuest, isGuestRequestPending, currentStreamer.handle, currentStreamer.id, currentUser, handleLeaveGuestStage, showToast]);

  const handleAcceptGuestRequest = useCallback((viewer: RoomViewer) => {
    setPendingGuestRequests((prev) => prev.filter((r) => r.handle !== viewer.handle));
    handleInviteGuest(viewer);
    const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
    liveStreamSync.sendRoomEvent(roomId, {
      type: 'GUEST_ACCEPTED',
      targetHandle: viewer.handle,
      guest: viewer,
    });
    broadcastViaSupabase({
      action: 'LIVE_GUEST_ACCEPTED',
      roomId,
      targetHandle: viewer.handle,
      guest: viewer,
    });
    showToast(`✅ Accepted @${viewer.name} to join the stage!`);
  }, [currentStreamer.handle, currentStreamer.id, handleInviteGuest, showToast]);

  const handleRejectGuestRequest = useCallback((handle: string) => {
    setPendingGuestRequests((prev) => prev.filter((r) => r.handle !== handle));
    showToast(`Declined stage request`);
  }, [showToast]);

  // Open User Profile Mini-Card ("Little Tab" that does not disrupt the live stream)
  const handleOpenUserProfile = (
    handle: string,
    fallback?: {
      name?: string;
      avatar?: string;
      level?: number;
      contribution?: number;
      followers?: number;
      likes?: number;
      bio?: string;
      banner?: string;
      isVerified?: boolean;
    }
  ) => {
    // 1. Instantly close Room Viewers modal so the profile opens cleanly
    setIsViewersModalOpen(false);

    // 2. Identify if target is the current viewer/user or host
    const clean = handle.replace(/^@/, '').toLowerCase().trim();
    const myClean = (currentUser.handle || '').replace(/^@/, '').toLowerCase().trim();
    const isSelf = myClean ? clean === myClean : false;
    const streamerClean = (currentStreamer.handle || '').replace(/^@/, '').toLowerCase().trim();
    const isStreamer = streamerClean ? clean === streamerClean : false;

    // 3. Look up audience member or contributor to get exact stats
    const audienceMember = activeAudience.find((v) => v.handle.replace(/^@/, '').toLowerCase().trim() === clean);
    const contributor = roomContributors.find((c) => c.name.replace(/^@/, '').toLowerCase().trim() === clean);

    const profile = getUserLiveProfile(handle, {
      name: isSelf
        ? currentUser.name
        : isStreamer
        ? currentStreamer.name
        : (fallback?.name || audienceMember?.name || contributor?.name),
      avatar: isSelf
        ? currentUser.avatar
        : isStreamer
        ? currentStreamer.avatar
        : (fallback?.avatar || audienceMember?.avatar || contributor?.avatar),
      level: isSelf
        ? getDeterministicLevel(currentUser.handle)
        : (fallback?.level || audienceMember?.level || getDeterministicLevel(clean)),
      followers: isStreamer
        ? ((currentStreamer as any).followersCount || currentStreamer.viewersCount)
        : fallback?.followers,
      likes: isStreamer
        ? ((currentStreamer.likesCount || 0) + likesReceived)
        : fallback?.likes,
      bio: isStreamer
        ? (currentStreamer.description || currentStreamer.title)
        : fallback?.bio,
      banner: isStreamer
        ? (currentStreamer.posterUrl || currentStreamer.avatar)
        : fallback?.banner,
      isVerified: isStreamer
        ? currentStreamer.isVerified
        : fallback?.isVerified,
    });

    setSelectedProfileUser(profile);
    setSelectedProfileContribution(
      fallback?.contribution ?? audienceMember?.contribution ?? contributor?.contribution ?? 0
    );
    setIsUserProfileModalOpen(true);
    // Keep user in live stream with bottom sheet open; full navigation happens via View Full Profile button
  };

  // Host Moderation Action Handlers
  const handleMuteUser = (targetUser: UserLiveProfile) => {
    const handle = targetUser.handle;
    const isCurrentlyMuted = mutedUsers.some((u) => u.handle.toLowerCase() === handle.toLowerCase());
    const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
    if (isCurrentlyMuted) {
      setMutedUsers((prev) => prev.filter((u) => u.handle.toLowerCase() !== handle.toLowerCase()));
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'LIVE_USER_UNMUTED',
        handle,
      });
      showToast(`🔊 Unmuted @${handle}. They can now chat.`);
    } else {
      setMutedUsers((prev) => [...prev, targetUser]);
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'LIVE_USER_MUTED',
        handle,
      });
      showToast(`🔇 Muted @${handle} in this live broadcast.`);
    }
  };

  const handleKickUser = (targetUser: UserLiveProfile) => {
    const handle = targetUser.handle;
    const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
    setKickedUsers((prev) => [...prev, targetUser]);
    setActiveAudience((prev) => prev.filter((v) => v.handle.toLowerCase() !== handle.toLowerCase()));
    setLiveViewersCount((prev) => Math.max(0, prev - 1));
    liveStreamSync.sendRoomEvent(roomId, {
      type: 'LIVE_USER_KICKED',
      handle,
    });
    setIsUserProfileModalOpen(false);
    showToast(`👢 Kicked @${handle} from this live broadcast.`);
  };

  const handleBlockUser = (targetUser: UserLiveProfile) => {
    const handle = targetUser.handle;
    const isCurrentlyBlocked = blockedUsers.some((u) => u.handle.toLowerCase() === handle.toLowerCase());
    const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
    if (isCurrentlyBlocked) {
      setBlockedUsers((prev) => prev.filter((u) => u.handle.toLowerCase() !== handle.toLowerCase()));
      showToast(`🔓 Unblocked @${handle}.`);
    } else {
      setBlockedUsers((prev) => [...prev, targetUser]);
      setActiveAudience((prev) => prev.filter((v) => v.handle.toLowerCase() !== handle.toLowerCase()));
      setLiveViewersCount((prev) => Math.max(0, prev - 1));
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'LIVE_USER_BLOCKED',
        handle,
      });
      setIsUserProfileModalOpen(false);
      showToast(`🚫 Blocked @${handle} from live broadcast.`);
    }
  };

  // Microphone Audio Setup & Analyser for VU Meter
  useEffect(() => {
    if (!isHost) return;
    const stream = localStreamRef.current;
    if (!stream || stream.getAudioTracks().length === 0) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      micSourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      source.connect(analyser);

      const gain = ctx.createGain();
      gain.gain.value = 0.8;
      monitorGainRef.current = gain;

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const updateVu = () => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        setMicAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        vuAnimRef.current = requestAnimationFrame(updateVu);
      };
      vuAnimRef.current = requestAnimationFrame(updateVu);

      return () => {
        if (vuAnimRef.current) cancelAnimationFrame(vuAnimRef.current);
        try {
          ctx.close();
        } catch {}
      };
    } catch (e) {
      console.warn('Audio monitor init error:', e);
    }
  }, [isHost]);

  // Voice Monitoring toggle ("Hear Myself" in headphones)
  useEffect(() => {
    if (!audioCtxRef.current || !micSourceRef.current || !monitorGainRef.current) return;
    try {
      if (isAudioMonitoring) {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        micSourceRef.current.connect(monitorGainRef.current);
        monitorGainRef.current.connect(audioCtxRef.current.destination);
      } else {
        try {
          monitorGainRef.current.disconnect();
        } catch {}
      }
    } catch (e) {
      console.warn('Voice monitor toggle error:', e);
    }
  }, [isAudioMonitoring]);

  // Gift tray state
  const [activeGiftCategory, setActiveGiftCategory] = useState<'popular' | 'special' | 'pranks' | 'nvip' | 'celebrity'>('popular');
  const [selectedGiftId, setSelectedGiftId] = useState<string>('rose');
  const [selectedCombo, setSelectedCombo] = useState<number>(1);

  // Chat state (starts clean with system welcome, no fake audience or simulated comments)
  const [chatMessages, setChatMessages] = useState<LiveMeChatMessage[]>([
    {
      id: 'welcome-sys',
      user: 'Privity Live',
      handle: 'privity',
      level: 0,
      text: '🔴 Live broadcast started. Tap the screen for hearts ♥ or say hello!',
      isSystem: true,
      timestamp: Date.now(),
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
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
              channelCount: 2,
            },
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

          // Guarantee microphone audio track is attached for high-quality audio
          if (stream.getAudioTracks().length === 0) {
            try {
              const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                  sampleRate: 48000,
                  channelCount: 2,
                },
              });
              audioStream.getAudioTracks().forEach((at) => stream!.addTrack(at));
            } catch (aErr) {
              console.warn('Microphone fallback acquisition error:', aErr);
            }
          }

          // Ensure audio tracks are correctly toggled according to isMicMuted
          stream.getAudioTracks().forEach((at) => {
            at.enabled = !isMicMuted;
          });

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

  // 2. BROADCAST SESSION REGISTRATION (STABLE LIFECYCLE - NEVER RESTARTED BY LIKES/JOINS)
  useEffect(() => {
    if (!isHost) return;

    const roomId = getRoomIdFromHandle(currentUser.handle);
    const hostMeta = {
      id: `live-user-${roomId}`,
      creatorHandle: currentUser.handle,
      creatorName: currentUser.name,
      creatorAvatar: currentUser.avatar,
      handle: currentUser.handle,
      name: currentUser.name,
      avatar: currentUser.avatar,
      isVerified: true,
      category: currentStreamer?.category || 'Featured',
      title: currentStreamer?.title || '🔴 LIVE: High-Energy Room & PK Battle',
      startedAt: Date.now(),
      viewersCount: 0,
      likesCount: 0,
      diamonds: 0,
      isLive: true,
    };

    try {
      localStorage.setItem('privity_current_live_host', JSON.stringify(hostMeta));
      localStorage.setItem('privity_is_host_broadcasting', 'true');
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_HOST_STARTED', host: hostMeta });
    } catch {}

    // Start network host broadcast across ALL devices worldwide via MQTT & WebRTC
    liveStreamSync.startHostBroadcast(
      {
        id: `live-user-${roomId}`,
        creatorHandle: currentUser.handle,
        creatorName: currentUser.name,
        creatorAvatar: currentUser.avatar,
        isVerified: true,
        title: currentStreamer?.title || '🔴 LIVE: High-Energy Room & PK Battle',
        category: currentStreamer?.category || 'Featured',
        description: currentStreamer?.description || 'Live streaming sovereign node',
        viewersCount: 0,
        likesCount: 0,
        previewUrl: currentUser.avatar,
        tags: ['LiveNow', 'Host', 'Privity'],
      },
      localStreamRef.current || userMediaStream || null
    ).catch(() => {});
  }, [isHost, currentUser.handle, currentStreamer?.title, currentStreamer?.category, currentStreamer?.description]);

  // 2B. REAL-TIME VIDEO FRAME STREAMER (ULTRA-LOW LATENCY CANVAS RELAY)
  useEffect(() => {
    if (!isHost) return;
    const roomId = getRoomIdFromHandle(currentUser.handle);

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 240;
    offscreenCanvas.height = 360;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    let frameChannel: BroadcastChannel | null = null;
    try {
      frameChannel = new BroadcastChannel('privity_live_frames');
    } catch {}

    const captureAndEmitFrame = () => {
      if (videoRef.current && offscreenCtx && !isVideoOff) {
        try {
          if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            offscreenCtx.drawImage(videoRef.current, 0, 0, 240, 360);
            const frameJpeg = offscreenCanvas.toDataURL('image/jpeg', 0.32);
            liveStreamSync.sendVideoFrame(roomId, frameJpeg);
            if (frameChannel) {
              frameChannel.postMessage({
                type: 'FRAME',
                handle: currentUser.handle,
                frame: frameJpeg,
              });
            }
          }
        } catch {}
      }
    };

    immediateFrameCaptureRef.current = captureAndEmitFrame;
    const frameSyncInterval = setInterval(captureAndEmitFrame, 350);

    return () => {
      clearInterval(frameSyncInterval);
      immediateFrameCaptureRef.current = null;
      if (frameChannel) frameChannel.close();
    };
  }, [isHost, currentUser.handle, isVideoOff]);

  // 3. BROADCAST DURATION CLOCK (100% PURE REAL TIME - ZERO FAKE AUDIENCE)
  useEffect(() => {
    const updateTimer = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - broadcastStartTimestampRef.current) / 1000));
      setStreamDurationSec(elapsed);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

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

    return () => {
      clearInterval(timer);
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
      const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'LIVE_LIKE',
        streamerId: currentStreamer.id,
        x: posX,
        y: posY,
        color: heart.color,
      });
      broadcastViaSupabase({
        action: 'LIVE_LIKE',
        roomId,
        streamerId: currentStreamer.id,
        x: posX,
        y: posY,
        color: heart.color,
      });
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_LIKE', streamerId: currentStreamer.id, x: posX, y: posY, color: heart.color });
      bus.close();
    } catch {}
  };

  // Cross-device room events subscription (real-time live frames, gifts, joins, likes, stats & chat)
  useEffect(() => {
    const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);

    return liveStreamSync.subscribeToRoomEvents(roomId, (evt) => {
      if (!evt) return;

      if (evt.type === 'LIVE_FRAME' && evt.frame) {
        setRemoteLiveFrame(evt.frame);
      } else if (evt.type === 'LIVE_LIKE') {
        const sid = currentStreamer.id;
        setStreamerLikesMap((prev) => {
          const current = prev[sid] ?? 0;
          return { ...prev, [sid]: current + 1 };
        });
        setLikesReceived((prev) => prev + 1);

        // Spawn visual floating heart on recipient screen!
        const stageWidth = stageRef.current ? stageRef.current.clientWidth : 440;
        const stageHeight = stageRef.current ? stageRef.current.clientHeight : 700;
        const posX = evt.x !== undefined ? evt.x : stageWidth / 2 + (Math.random() * 80 - 40);
        const posY = evt.y !== undefined ? evt.y : stageHeight - 160;
        const colors = ['#f43f5e', '#ec4899', '#a855f7', '#3b82f6', '#fbbf24'];
        const heart = {
          id: Date.now() + Math.random(),
          x: posX,
          y: posY,
          color: evt.color || colors[Math.floor(Math.random() * colors.length)],
        };
        setFloatingHearts((prev) => [...prev.slice(-15), heart]);
        setTimeout(() => {
          setFloatingHearts((prev) => prev.filter((h) => h.id !== heart.id));
        }, 2200);
      } else if (evt.type === 'LIVE_CHAT' && evt.message) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === evt.message.id)) return prev;
          return [...prev.slice(-35), evt.message];
        });
      } else if (evt.type === 'LIVE_JOIN' && evt.user) {
        const userHandle = evt.user.handle || evt.user.name;
        const userLevel = evt.user.level || getDeterministicLevel(userHandle);

        // Trigger specular fly-in banner from left
        triggerJoinFlyIn({
          name: evt.user.name,
          handle: userHandle,
          avatar: evt.user.avatar,
          level: userLevel,
          badge: userLevel >= 40 ? 'VIP Fan 🏆' : 'Fan ⭐',
        });

        const joinMsg: LiveMeChatMessage = {
          id: `join-${Date.now()}-${Math.random()}`,
          user: evt.user.name,
          handle: userHandle,
          avatar: evt.user.avatar,
          level: userLevel,
          badge: userLevel >= 40 ? 'VIP Fan 🏆' : 'Fan ⭐',
          text: 'joined the live room 👋',
          isSystem: true,
          isJoin: true,
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev.slice(-35), joinMsg]);

        // Add to active audience list
        setActiveAudience((prev) => {
          if (prev.some((v) => v.handle === userHandle)) return prev;
          const newViewer: RoomViewer = {
            id: evt.user.id || `v_${Date.now()}`,
            name: evt.user.name,
            handle: userHandle,
            avatar: evt.user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
            level: userLevel,
            badge: userLevel >= 40 ? 'VIP Fan 🏆' : 'Fan ⭐',
            isVip: userLevel >= 40,
            contribution: 0,
            isFollowing: false,
          };
          return [newViewer, ...prev];
        });

        setLiveViewersCount((prev) => {
          const nextCount = prev + 1;
          if (isHost) {
            showToastRef.current(`👋 ${evt.user.name} joined your live stream!`);
            immediateFrameCaptureRef.current?.();
            liveStreamSync.sendRoomEvent(roomId, {
              type: 'LIVE_STATS',
              count: nextCount,
              likes: likesReceivedRef.current,
              diamonds: diamondsEarnedRef.current,
              isPkBattleActive: isPkBattleActiveRef.current,
              pkRival: pkRivalRef.current,
              hostPkScore: hostPkScoreRef.current,
              rivalPkScore: rivalPkScoreRef.current,
              battleRoundTimer: battleRoundTimerRef.current,
              topContributors: roomContributorsRef.current,
            });
          }
          return nextCount;
        });
      } else if (evt.type === 'LIVE_LEAVE') {
        if (evt.user?.handle) {
          setActiveAudience((prev) => prev.filter((v) => v.handle !== evt.user.handle));
        }
        setLiveViewersCount((prev) => Math.max(0, prev - 1));
      } else if (evt.type === 'LIVE_VIEWER_COUNT' && typeof evt.count === 'number') {
        setLiveViewersCount(evt.count);
      } else if (evt.type === 'LIVE_STATS') {
        if (typeof evt.count === 'number') {
          setLiveViewersCount(evt.count);
        }
        if (typeof evt.likes === 'number') {
          setLikesReceived(evt.likes);
          setStreamerLikesMap((prev) => ({ ...prev, [currentStreamer.id]: evt.likes }));
        }
        if (typeof evt.diamonds === 'number') {
          setDiamondsEarned(evt.diamonds);
        }
        if (evt.isPkBattleActive) {
          setIsPkBattleActive(true);
          isPkBattleActiveRef.current = true;
          if (evt.pkRival) {
            setPkRival(evt.pkRival);
            pkRivalRef.current = evt.pkRival;
          }
          if (typeof evt.hostPkScore === 'number') setHostPkScore(evt.hostPkScore);
          if (typeof evt.rivalPkScore === 'number') setRivalPkScore(evt.rivalPkScore);
          if (typeof evt.battleRoundTimer === 'number') setBattleRoundTimer(evt.battleRoundTimer);
        }
        if (evt.topContributors && Array.isArray(evt.topContributors)) {
          setRoomContributors(evt.topContributors);
        }
      } else if (evt.type === 'PK_BATTLE_START') {
        setIsPkBattleActive(true);
        isPkBattleActiveRef.current = true;
        if (evt.rival) {
          setPkRival(evt.rival);
          pkRivalRef.current = evt.rival;
        }
        if (typeof evt.hostScore === 'number') setHostPkScore(evt.hostScore);
        if (typeof evt.rivalScore === 'number') setRivalPkScore(evt.rivalScore);
        if (typeof evt.roundTimer === 'number') setBattleRoundTimer(evt.roundTimer);
        setBattleWinner(null);
        showToastRef.current(`⚔️ LIVE Battle Started! Battling @${evt.rival?.handle || 'Rival'}!`);
      } else if (evt.type === 'PK_BATTLE_UPDATE') {
        if (typeof evt.hostScore === 'number') setHostPkScore(evt.hostScore);
        if (typeof evt.rivalScore === 'number') setRivalPkScore(evt.rivalScore);
        if (typeof evt.roundTimer === 'number') setBattleRoundTimer(evt.roundTimer);
        if (evt.hit) triggerPkHit(evt.hit.text, evt.hit.color);
      } else if (evt.type === 'PK_BATTLE_END') {
        setBattleWinner(evt.winner || null);
        setTimeout(() => {
          setIsPkBattleActive(false);
          isPkBattleActiveRef.current = false;
        }, 3500);
      } else if (evt.type === 'LIVE_ENDED') {
        if (!isHost) {
          setLiveEndedData({
            hostName: evt.hostName || currentStreamer.name,
            hostAvatar: evt.hostAvatar || currentStreamer.avatar,
            totalLikes: evt.totalLikes ?? likesReceivedRef.current,
            totalDiamonds: evt.totalDiamonds ?? diamondsEarnedRef.current,
            peakViewers: evt.peakViewers ?? Math.max(liveViewersCountRef.current, 1),
            duration: evt.duration ?? 60,
          });
          setIsLiveEndedOverlayOpen(true);
          setEndedCountdown(3);
          let remaining = 3;
          const interval = setInterval(() => {
            remaining -= 1;
            setEndedCountdown(remaining);
            if (remaining <= 0) {
              clearInterval(interval);
              setIsLiveEndedOverlayOpen(false);
              onClose({ wasEnded: true, isHost: false });
            }
          }, 1000);
        }
      } else if (evt.type === 'LIVE_USER_MUTED' && evt.handle) {
        if (currentUser.handle.toLowerCase() === evt.handle.toLowerCase()) {
          setIsUserMuted(true);
          showToastRef.current('🔇 You have been muted by the host.');
        }
        setChatMessages((prev) => [
          ...prev.slice(-35),
          {
            id: `mod-mute-${Date.now()}`,
            user: 'Privity System',
            handle: 'system',
            text: `🔇 @${evt.handle} was silenced by the host.`,
            isSystem: true,
            timestamp: Date.now(),
          },
        ]);
      } else if (evt.type === 'LIVE_USER_UNMUTED' && evt.handle) {
        if (currentUser.handle.toLowerCase() === evt.handle.toLowerCase()) {
          setIsUserMuted(false);
          showToastRef.current('🔊 You have been unmuted by the host.');
        }
      } else if (evt.type === 'LIVE_USER_KICKED' && evt.handle) {
        if (currentUser.handle.toLowerCase() === evt.handle.toLowerCase()) {
          showToastRef.current('👢 You were removed from this live broadcast by the host.');
          setTimeout(() => {
            onClose({ wasEnded: true, isHost: false });
          }, 1500);
        }
        setLiveViewersCount((prev) => Math.max(0, prev - 1));
      } else if (evt.type === 'LIVE_USER_BLOCKED' && evt.handle) {
        if (currentUser.handle.toLowerCase() === evt.handle.toLowerCase()) {
          showToastRef.current('🚫 You have been blocked from this live broadcast.');
          setTimeout(() => {
            onClose({ wasEnded: true, isHost: false });
          }, 1200);
        }
        setLiveViewersCount((prev) => Math.max(0, prev - 1));
      } else if (evt.type === 'LIVE_GIFT') {
        // Enqueue animation for host & all viewers (strict deduplication in GiftQueueManager)
        if (evt.giftEvent && evt.animGift) {
          globalGiftQueue.enqueue(evt.giftEvent, evt.animGift);
        }

        // Add gift message to chat
        if (evt.giftMessage) {
          setChatMessages((prev) => [...prev.slice(-35), evt.giftMessage]);
        }

        // Play sound effect
        const matchedGift = LIVEME_GIFTS.find(
          (g) => g.id === evt.giftEvent?.giftId || g.name === evt.giftEvent?.giftName
        );
        if (matchedGift?.soundUrl) {
          try {
            const audio = new Audio(matchedGift.soundUrl);
            audio.volume = isMutedRef.current ? 0 : 0.85;
            audio.play().catch(() => {});
          } catch {}
        }

        // Increment diamonds on host
        const diamonds = evt.diamonds || evt.giftEvent?.coinValue || 10;
        setDiamondsEarned((prev) => prev + diamonds);

        // Update target stream goal if sent gift matches
        const gName = (evt.giftEvent?.giftName || '').toLowerCase();
        const gId = (evt.giftEvent?.giftId || '').toLowerCase();
        setStreamGoal((prev) => {
          if (gName.includes(prev.giftName.toLowerCase()) || gId === prev.giftId.toLowerCase()) {
            return {
              ...prev,
              currentCount: prev.currentCount + (evt.giftEvent?.quantity || 1),
            };
          }
          return prev;
        });

        // If in PK battle, add score
        if (isPkBattleActiveRef.current) {
          const dmg = diamonds * 2;
          setHostPkScore((prev) => {
            const next = prev + dmg;
            hostPkScoreRef.current = next;
            return next;
          });
          triggerPkHit(`+${dmg.toLocaleString()} GIFT CRIT! 🔥`, '#ec4899');
          if (isHost) {
            liveStreamSync.sendRoomEvent(roomId, {
              type: 'PK_BATTLE_UPDATE',
              hostScore: hostPkScoreRef.current + dmg,
              rivalScore: rivalPkScoreRef.current,
              roundTimer: battleRoundTimerRef.current,
              hit: { text: `+${dmg.toLocaleString()} GIFT CRIT! 🔥`, color: '#ec4899' },
            });
          }
        }

        // Update top contributors facepile and dynamic chairs ranking
        if (evt.sender) {
          const sHandle = evt.sender.handle || evt.sender.name;
          const sLevel = evt.sender.level || getDeterministicLevel(sHandle);

          // Update active audience contribution
          setActiveAudience((prev) => {
            const exists = prev.find((v) => v.handle === sHandle);
            if (exists) {
              return prev.map((v) =>
                v.handle === sHandle ? { ...v, contribution: (v.contribution || 0) + diamonds } : v
              );
            }
            return [
              {
                id: evt.sender.id || `v_${Date.now()}`,
                name: evt.sender.name,
                handle: sHandle,
                avatar: evt.sender.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
                level: sLevel,
                badge: 'Top Gifter 💎',
                isVip: true,
                contribution: diamonds,
              },
              ...prev,
            ];
          });

          setRoomContributors((prev) => {
            const senderId = sHandle;
            const existing = prev.find((c) => c.id === senderId || c.name === evt.sender.name);
            const updated = existing
              ? prev.map((c) => (c.id === existing.id ? { ...c, contribution: c.contribution + diamonds } : c))
              : [
                  ...prev,
                  {
                    id: senderId,
                    name: evt.sender.name,
                    avatar: evt.sender.avatar,
                    rank: 1 as 1 | 2 | 3,
                    contribution: diamonds,
                  },
                ];

            const sorted = updated
              .sort((a, b) => b.contribution - a.contribution)
              .map((c, i) => ({
                ...c,
                rank: ((i === 0 ? 1 : i === 1 ? 2 : 3) as 1 | 2 | 3),
              }));
            roomContributorsRef.current = sorted;
            return sorted;
          });
        }

        showToastRef.current(`🎁 ${evt.sender?.name || 'Viewer'} sent ${evt.giftEvent?.giftName || 'Gift'}! (+${diamonds} 💎)`);
      } else if (evt.type === 'STREAM_GOAL_UPDATE' && evt.goal) {
        setStreamGoal(evt.goal);
      } else if (evt.type === 'GUEST_INVITED' && evt.guest) {
        setActiveGuests((prev) => {
          if (prev.some((g) => g.handle === evt.guest.handle)) return prev;
          return [...prev, evt.guest];
        });
        showToastRef.current(`🎤 @${evt.guest.name} joined as Co-Host Guest!`);
      } else if (evt.type === 'GUEST_REQUEST' && evt.viewer) {
        if (isHost) {
          setPendingGuestRequests((prev) => {
            if (prev.some((r) => r.handle === evt.viewer.handle)) return prev;
            return [...prev, evt.viewer];
          });
          showToastRef.current(`✋ @${evt.viewer.name} requested to join the stage as a guest!`);
        }
      } else if (evt.type === 'GUEST_ACCEPTED') {
        const myCleanHandle = (currentUser?.handle || '').toLowerCase().replace('@', '').trim();
        const targetCleanHandle = (evt.targetHandle || '').toLowerCase().replace('@', '').trim();
        if (targetCleanHandle === myCleanHandle) {
          showToastRef.current(`🎉 Host accepted your stage request! Connecting camera & mic...`);
          handleStartGuestStage();
        }
      } else if (evt.type === 'GUEST_JOINED_STAGE' && evt.guest) {
        setActiveGuests((prev) => {
          if (prev.some((g) => g.handle === evt.guest.handle)) return prev;
          return [...prev, evt.guest];
        });
        if (evt.mediaStream) {
          registerGuestMediaStream(evt.guest.handle, evt.mediaStream);
        }
        showToastRef.current(`🎤 @${evt.guest.name} is now LIVE on stage with the host!`);
      } else if (evt.type === 'COHOST_INVITE') {
        const myCleanHandle = (currentUser?.handle || '').toLowerCase().replace('@', '').trim();
        const targetCleanHandle = (evt.targetHandle || '').toLowerCase().replace('@', '').trim();
        if (targetCleanHandle === myCleanHandle || (!isHost && !evt.targetHandle)) {
          setIncomingInvite({
            type: 'cohost',
            senderName: evt.senderName || 'Host',
            senderHandle: evt.senderHandle || '@host',
            senderAvatar: evt.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            timestamp: Date.now(),
          });
          showToastRef.current(`⚡ ${evt.senderName || 'Host'} invited you to Co-Host Battle!`);
        }
      } else if (evt.type === 'GUEST_INVITE') {
        const myCleanHandle = (currentUser?.handle || '').toLowerCase().replace('@', '').trim();
        const targetCleanHandle = (evt.targetHandle || '').toLowerCase().replace('@', '').trim();
        if (targetCleanHandle === myCleanHandle || (!isHost && !evt.targetHandle)) {
          setIncomingInvite({
            type: 'guest',
            senderName: evt.senderName || 'Host',
            senderHandle: evt.senderHandle || '@host',
            senderAvatar: evt.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            timestamp: Date.now(),
          });
          showToastRef.current(`🎤 ${evt.senderName || 'Host'} invited you to join the stage as a Guest!`);
        }
      } else if (evt.type === 'STREAM_FILTER_CHANGE' && evt.cssFilter) {
        const matched = LIVE_FILTERS.find((f) => f.id === evt.filterId) || {
          id: evt.filterId || 'custom',
          name: 'Host Filter',
          cssFilter: evt.cssFilter,
          previewColor: '#ec4899',
          icon: '✨',
          emoji: '🌸',
        };
        setActiveLiveFilter(matched);
      } else if (evt.type === 'GUEST_DISCONNECTED' && evt.handle) {
        const cleanHandle = evt.handle.replace(/^@/, '').toLowerCase().trim();
        setActiveGuests((prev) => prev.filter((g) => g.handle.replace(/^@/, '').toLowerCase().trim() !== cleanHandle));
        const myClean = (currentUser?.handle || '').replace(/^@/, '').toLowerCase().trim();
        if (cleanHandle === myClean && isOnStageAsGuest) {
          handleLeaveGuestStage();
          showToastRef.current('You stepped down from the guest stage');
        }
      }
    });
  }, [currentStreamer.id, currentStreamer.handle, isHost, currentUser, handleStartGuestStage, handleLeaveGuestStage, isOnStageAsGuest, registerGuestMediaStream]);

  // Redundant Sub-100ms Cross-Device Realtime via Supabase Broadcast
  useEffect(() => {
    const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
    const unsub = onSupabaseBroadcast((payload) => {
      if (!payload || payload.roomId !== roomId) return;
      if (payload.action === 'LIVE_LIKE') {
        const sid = currentStreamer.id;
        setStreamerLikesMap((prev) => {
          const current = prev[sid] ?? 0;
          return { ...prev, [sid]: current + 1 };
        });
        setLikesReceived((prev) => prev + 1);

        const stageWidth = stageRef.current ? stageRef.current.clientWidth : 440;
        const stageHeight = stageRef.current ? stageRef.current.clientHeight : 700;
        const posX = payload.x !== undefined ? payload.x : stageWidth / 2 + (Math.random() * 80 - 40);
        const posY = payload.y !== undefined ? payload.y : stageHeight - 160;
        const heart = {
          id: Date.now() + Math.random(),
          x: posX,
          y: posY,
          color: payload.color || '#f43f5e',
        };
        setFloatingHearts((prev) => [...prev.slice(-15), heart]);
        setTimeout(() => {
          setFloatingHearts((prev) => prev.filter((h) => h.id !== heart.id));
        }, 2200);
      } else if (payload.action === 'LIVE_JOIN' && payload.user) {
        triggerJoinFlyIn({
          name: payload.user.name,
          handle: payload.user.handle,
          avatar: payload.user.avatar,
          level: payload.user.level,
        });
      } else if (payload.action === 'LIVE_GIFT' && payload.giftEvent) {
        if (payload.giftEvent && payload.animGift) {
          globalGiftQueue.enqueue(payload.giftEvent, payload.animGift);
        }
        if (payload.diamonds) {
          setDiamondsEarned((prev) => prev + payload.diamonds);
        }
      }
    });
    return unsub;
  }, [currentStreamer.handle, currentStreamer.id, triggerJoinFlyIn]);

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
    const nextScore = hostPkScore + 5;
    setHostPkScore(nextScore);
    hostPkScoreRef.current = nextScore;
    triggerPkHit('+5 CHEER! ♥', '#f43f5e');

    const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
    try {
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'PK_BATTLE_UPDATE',
        hostScore: nextScore,
        rivalScore: rivalPkScoreRef.current,
        roundTimer: battleRoundTimerRef.current,
        hit: { text: '+5 CHEER! ♥', color: '#f43f5e' },
      });
    } catch {}
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

  // Host Controls: End Broadcast cleanly (Broadcasts LIVE_ENDED so viewers see graceful 3s countdown)
  const handleEndBroadcastClick = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
    try {
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'LIVE_ENDED',
        hostName: currentUser.name,
        hostAvatar: currentUser.avatar,
        hostHandle: currentUser.handle,
        title: currentStreamer.title,
        totalLikes: likesReceived,
        totalDiamonds: diamondsEarned,
        peakViewers: Math.max(liveViewersCount, 1),
        duration: Math.floor((Date.now() - broadcastStartTimestampRef.current) / 1000),
      });
    } catch {}

    if (currentStreamer?.id) {
      liveStreamSync.markStreamEnded(currentStreamer.id, currentUser.handle);
    }
    liveStreamSync.stopHostBroadcast();
    try {
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_HOST_ENDED', streamId: currentStreamer.id, handle: currentUser.handle });
      localStorage.removeItem('privity_current_live_host');
      localStorage.removeItem('privity_is_host_broadcasting');
      localStorage.removeItem('privity_active_live_session');
      localStorage.removeItem('privity_remote_active_streams');
    } catch {}

    setIsSummaryOpen(true);
  };

  // Follow / Unfollow streamer
  const handleToggleFollow = (targetHandle?: string) => {
    const handleToToggle = (targetHandle || currentStreamer.handle || '').replace(/^@/, '').toLowerCase();
    const nextState = !followedMap[handleToToggle];
    setFollowedMap((prev) => {
      const updated = { ...prev };
      if (nextState) {
        updated[handleToToggle] = true;
      } else {
        delete updated[handleToToggle];
      }
      Object.keys(updated).forEach((k) => {
        if (k.startsWith('google_') || k.startsWith('usr-') || k.startsWith('sc-') || !updated[k]) {
          delete updated[k];
        }
      });
      try {
        localStorage.setItem('privity_following_v5', JSON.stringify(updated));

        // Update target user's followersList in privity_profiles_v5 in real instant time!
        const rawProfs = localStorage.getItem('privity_profiles_v5');
        if (rawProfs) {
          const profs = JSON.parse(rawProfs);
          if (profs[handleToToggle]) {
            const curUserHandle = (currentUser?.handle || '').replace(/^@/, '').toLowerCase();
            const curFollowers: string[] = profs[handleToToggle].followersList || [];
            const nextFollowers = nextState
              ? (curUserHandle ? Array.from(new Set([...curFollowers, curUserHandle])) : curFollowers)
              : (curUserHandle ? curFollowers.filter((h: string) => h.toLowerCase() !== curUserHandle) : curFollowers);
            profs[handleToToggle] = { ...profs[handleToToggle], followersList: nextFollowers };
            localStorage.setItem('privity_profiles_v5', JSON.stringify(profs));
          }
        }

        // Broadcast to whole app across tabs and components in real instant time!
        const bus = new BroadcastChannel('privity_sync_bus');
        bus.postMessage({
          action: 'TOGGLE_FOLLOW',
          targetHandle: handleToToggle,
          followerHandle: currentUser.handle,
          followerName: currentUser.name,
          followerAvatar: currentUser.avatar,
          isFollowing: nextState,
        });
        bus.close();
      } catch {}
      return updated;
    });

    // Also update selectedProfileUser in real instant time if currently open in the mini-card!
    setSelectedProfileUser((prev) => {
      if (!prev || prev.handle.toLowerCase() !== handleToToggle) return prev;
      return {
        ...prev,
        followers: Math.max(0, prev.followers + (nextState ? 1 : -1)),
      };
    });

    const streamerObj = streamers.find((s) => s.handle.replace(/^@/, '').toLowerCase() === handleToToggle) || currentStreamer;
    showToast(nextState ? `Followed @${streamerObj.name || handleToToggle}! ✨` : `Unfollowed @${streamerObj.name || handleToToggle}`);
  };

  // Send Direct Message from Mini-Profile or Chat
  const handleSendChatMessage = (text: string) => {
    if (isUserMuted) {
      showToast('🔇 You are currently muted by the host in this live.');
      return;
    }
    const myLevel = getDeterministicLevel(currentUser.handle);
    const newMsg: LiveMeChatMessage = {
      id: `msg-${Date.now()}`,
      user: currentUser.name,
      handle: currentUser.handle,
      avatar: currentUser.avatar,
      level: myLevel,
      badge: myLevel >= 40 ? 'VIP' : 'FAN',
      text,
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    spawnHeartReaction();

    try {
      const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'LIVE_CHAT',
        message: newMsg,
      });
    } catch {}
  };

  // Send Chat Message Form Submit
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (isUserMuted) {
      showToast('🔇 You are currently muted by the host.');
      return;
    }
    handleSendChatMessage(chatInput.trim());
    setChatInput('');
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

    // Award real-time XP and compute level
    authService.addExperience(totalCost);
    const userLevel = getDeterministicLevel(currentUser.handle);

    // Post to chat stream with special gift notice
    const giftMsg: LiveMeChatMessage = {
      id: `gift-${Date.now()}`,
      user: currentUser.name,
      handle: currentUser.handle,
      level: userLevel,
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

    // Network & Cross-tab broadcast gift
    try {
      const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
      liveStreamSync.sendRoomEvent(currentStreamer.id, {
        type: 'LIVE_GIFT',
        streamerId: currentStreamer.id,
        giftEvent,
        animGift,
        giftMessage: giftMsg,
        diamonds: totalCost,
        sender: {
          name: currentUser.name,
          handle: currentUser.handle,
          avatar: currentUser.avatar,
          level: userLevel,
        },
      });
      broadcastViaSupabase({
        action: 'LIVE_GIFT',
        roomId,
        giftEvent,
        animGift,
        diamonds: totalCost,
        sender: {
          name: currentUser.name,
          handle: currentUser.handle,
          avatar: currentUser.avatar,
          level: userLevel,
        },
      });
      const bus = new BroadcastChannel('privity_sync_bus');
      bus.postMessage({ type: 'LIVE_GIFT', event: giftEvent, animGift, senderLevel: userLevel });
      bus.close();
    } catch {}

    // Update local stream goal if matched
    const sentGiftName = gift.name.toLowerCase();
    const sentGiftId = gift.id.toLowerCase();
    setStreamGoal((prev) => {
      if (sentGiftName.includes(prev.giftName.toLowerCase()) || sentGiftId === prev.giftId.toLowerCase()) {
        return {
          ...prev,
          currentCount: prev.currentCount + selectedCombo,
        };
      }
      return prev;
    });

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

  // Format Extended Live Elapsed Duration (e.g. 00:24:15 or 01:12:45)
  const formatDurationExtended = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate PK Tug-of-War percentage widths
  const hostPkPercentage = useMemo(() => {
    const total = hostPkScore + rivalPkScore;
    if (total <= 0) return 50;
    return Math.max(12, Math.min(88, Math.round((hostPkScore / total) * 100)));
  }, [hostPkScore, rivalPkScore]);

  // Organic Gestures Handling (Mobile Touch Swipes + Desktop Pointer Drag):
  // - Swipe Left (deltaX < 0): Enters Large Messages Chat Reader (or returns from HUD to Live)
  // - Swipe Right (deltaX > 0): Enters Stream HUD, Clock & Telemetry (or returns from Reader to Live)
  // - Swipe Up/Down: Next/Prev room (for viewers only)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleSwipeLeft = useCallback(() => {
    if (arenaMode === 'stream_hud') {
      triggerModeChange('normal');
    } else if (arenaMode === 'normal') {
      triggerModeChange('chat_reader');
    }
  }, [arenaMode, triggerModeChange]);

  const handleSwipeRight = useCallback(() => {
    if (arenaMode === 'chat_reader') {
      triggerModeChange('normal');
    } else if (arenaMode === 'normal') {
      triggerModeChange('stream_hud');
    }
  }, [arenaMode, triggerModeChange]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'input, textarea, button, select, a, .liveme-gift-tray-panel, .liveme-viewers-sheet, .liveme-recharge-modal, .liveme-coin-games-modal, .liveme-pk-modal, .liveme-reader-font-controls'
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

    if (duration > 850) return;

    // Vertical Swipes: Up = Next Live, Down = Previous Live (Viewers only)
    if (absY > 48 && absY > absX * 1.3) {
      if (!isHost) {
        if (deltaY < 0) {
          handleNextStream();
        } else {
          handlePrevStream();
        }
      }
      return;
    }

    // Horizontal Swipes (Real-deal organic live experience):
    // Swipe Left: Enter Chat Reader (or return from HUD)
    // Swipe Right: Enter Stream HUD & Clocks (or return from Reader)
    if (absX > 42 && absX > absY * 1.15) {
      if (deltaX < 0) {
        handleSwipeLeft();
      } else {
        handleSwipeRight();
      }
      return;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'input, textarea, button, select, a, .liveme-gift-tray-panel, .liveme-viewers-sheet, .liveme-recharge-modal, .liveme-coin-games-modal, .liveme-pk-modal, .liveme-reader-font-controls, .liveme-chat-scroll-box'
      )
    ) {
      return;
    }
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const deltaX = e.clientX - pointerStartRef.current.x;
    const deltaY = e.clientY - pointerStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const duration = Date.now() - pointerStartRef.current.time;
    pointerStartRef.current = null;

    if (duration > 850) return;

    if (absX > 42 && absX > absY * 1.15) {
      if (deltaX < 0) {
        handleSwipeLeft();
      } else {
        handleSwipeRight();
      }
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
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
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
            <>
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
                style={{ filter: computedVideoFilter }}
                className={`liveme-video-canvas ${isMirrored ? 'mirrored' : ''}`}
              />

              {/* Dual Camera Mode PIP Overlay */}
              {isDualCameraActive && (
                <div className={`liveme-dual-pip-box ${dualCameraPosition} ${isDualSwapped ? 'swapped' : ''}`}>
                  <video
                    ref={secondaryVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="liveme-dual-pip-video"
                  />
                  <div className="liveme-dual-pip-badge">
                    <span>CAM 2</span>
                  </div>
                </div>
              )}
            </>
          ) : remoteP2PStream ? (
            <video
              ref={(node) => {
                if (node && node.srcObject !== remoteP2PStream) {
                  node.srcObject = remoteP2PStream;
                  node.setAttribute('playsinline', 'true');
                  node.setAttribute('webkit-playsinline', 'true');
                  node.muted = isMuted;
                  const p = node.play();
                  if (p !== undefined) {
                    p.catch((err) => {
                      console.warn('Autoplay unmuted blocked by browser policy:', err);
                      node.muted = true;
                      node.play().catch(() => {});
                      setShowTapToUnmute(true);
                    });
                  }
                }
              }}
              autoPlay
              playsInline
              muted={isMuted}
              style={{ filter: activeLiveFilter.cssFilter !== 'none' ? activeLiveFilter.cssFilter : undefined }}
              className="liveme-video-canvas"
            />
          ) : remoteLiveFrame ? (
            <div className="liveme-live-frame-viewport" style={{ width: '100%', height: '100%', position: 'relative' }}>
              <img
                src={remoteLiveFrame}
                alt="Live Broadcast Camera"
                className="liveme-video-canvas"
                style={{ objectFit: 'cover', width: '100%', height: '100%', display: 'block' }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '72px',
                  left: '14px',
                  background: 'rgba(239, 68, 68, 0.9)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 900,
                  padding: '3px 9px',
                  borderRadius: '99px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  zIndex: 10,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
                  backdropFilter: 'blur(8px)',
                  letterSpacing: '0.04em',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
                <span>LIVE FEED</span>
              </div>
            </div>
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
                  {p2pConnectionStatus === 'connected' ? 'Streaming Live' : 'Connecting Real-Time Broadcast...'}
                </div>
                <div className="liveme-connecting-subtitle">
                  Direct sovereign live feed from @{currentStreamer.handle}
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
                    style={{ filter: computedVideoFilter }}
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
                ) : remoteLiveFrame ? (
                  <img
                    src={remoteLiveFrame}
                    alt="Live Host Camera"
                    className="liveme-pk-video-layer"
                    style={{ objectFit: 'cover', width: '100%', height: '100%' }}
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
                <div
                  className="liveme-pk-streamer-tag left"
                  onClick={() => handleOpenUserProfile(currentUser.handle, { name: currentUser.name, avatar: currentUser.avatar })}
                  style={{ cursor: 'pointer' }}
                >
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
                <div
                  className="liveme-pk-streamer-tag right"
                  onClick={() => handleOpenUserProfile(pkRival.handle, { name: pkRival.name, avatar: pkRival.avatar })}
                  style={{ cursor: 'pointer' }}
                >
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

            {/* Contributor Chairs Row directly under the two boxes (Accurate #1, #2, #3 Chairs) */}
            <div className="liveme-pk-dual-chairs-bar">
              {/* Host Chairs (Left 50%): Rank 3, Rank 2, Rank 1 leading into center clash */}
              <div className="liveme-pk-chairs-half left">
                {[2, 1, 0].map((chairIndex) => {
                  const contrib = roomContributors[chairIndex];
                  const rank = (chairIndex === 0 ? 1 : chairIndex === 1 ? 2 : 3) as 1 | 2 | 3;
                  const rankLabel = rank === 1 ? '👑1' : rank === 2 ? '🥈2' : '🥉3';
                  const title = rank === 1 ? 'Top Gifter (#1)' : `#${rank} Gifter`;

                  if (contrib) {
                    return (
                      <div
                        key={contrib.id || chairIndex}
                        className={`liveme-pk-chair-slot rank-${rank}`}
                        title={`${title}: ${contrib.name} (${contrib.contribution.toLocaleString()} 💎)`}
                        onClick={() =>
                          handleOpenUserProfile(contrib.name, {
                            name: contrib.name,
                            avatar: contrib.avatar,
                            contribution: contrib.contribution,
                          })
                        }
                      >
                        <img src={contrib.avatar} alt={contrib.name} />
                        <span className="liveme-chair-crown">{rankLabel}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`empty-host-${rank}`}
                      className="liveme-pk-chair-slot empty"
                      title={`No.${rank} Chair (Empty - Send gifts to claim this chair!)`}
                    >
                      <span className="chair-icon">🪑</span>
                      <span className="chair-empty-number">No.{rank}</span>
                    </div>
                  );
                })}
              </div>

              {/* Rival Chairs (Right 50%): Rank 1, Rank 2, Rank 3 */}
              <div className="liveme-pk-chairs-half right">
                {[0, 1, 2].map((chairIndex) => {
                  const rivalContribs = pkRival.topContributors || [];
                  const contrib = rivalContribs[chairIndex];
                  const rank = (chairIndex === 0 ? 1 : chairIndex === 1 ? 2 : 3) as 1 | 2 | 3;
                  const rankLabel = rank === 1 ? '👑1' : rank === 2 ? '🥈2' : '🥉3';
                  const title = rank === 1 ? 'Rival Top Gifter (#1)' : `Rival #${rank} Gifter`;

                  if (contrib) {
                    return (
                      <div
                        key={contrib.id || chairIndex}
                        className={`liveme-pk-chair-slot rank-${rank}`}
                        title={`${title}: ${contrib.name}`}
                        onClick={() =>
                          handleOpenUserProfile(contrib.name, {
                            name: contrib.name,
                            avatar: contrib.avatar,
                          })
                        }
                      >
                        <img src={contrib.avatar} alt={contrib.name} />
                        <span className="liveme-chair-crown">{rankLabel}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`empty-rival-${rank}`}
                      className="liveme-pk-chair-slot empty"
                      title={`No.${rank} Rival Chair (Empty)`}
                    >
                      <span className="chair-icon">🪑</span>
                      <span className="chair-empty-number">No.{rank}</span>
                    </div>
                  );
                })}
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

        {/* ================================================================ */}
        {/* INTERACTIVE 2-WAY LIVE GUEST STAGE BOX (TALK 2-WAY, ZERO ECHO)   */}
        {/* ================================================================ */}
        {activeGuests.length > 0 && (
          <div className="liveme-guest-stage-container">
            {activeGuests.map((guest) => {
              const cleanGuestH = guest.handle.replace(/^@/, '').toLowerCase().trim();
              const cleanMyH = (currentUser.handle || '').replace(/^@/, '').toLowerCase().trim();
              const isSelfGuest = cleanGuestH === cleanMyH;

              return (
                <LiveGuestStageBox
                  key={guest.handle}
                  guest={guest}
                  isHost={isHost}
                  isSelf={isSelfGuest}
                  localStream={isSelfGuest ? guestLocalMediaStream : undefined}
                  remoteStream={guestMediaStreams[cleanGuestH]}
                  onRemove={() => handleRemoveGuest(guest.handle)}
                  onLeave={handleLeaveGuestStage}
                  showToast={showToast}
                />
              );
            })}
          </div>
        )}

        {/* Host Incoming Guest Stage Request Notification Banner */}
        {isHost && pendingGuestRequests.length > 0 && (
          <div className="tiktok-incoming-invite-banner" style={{ top: '80px', bottom: 'auto', zIndex: 45 }}>
            <img src={pendingGuestRequests[0].avatar} alt="" className="invite-avatar" />
            <div className="invite-text">
              <span className="invite-name">{pendingGuestRequests[0].name}</span>
              <span className="invite-sub">requested to join stage as a Guest!</span>
            </div>
            <div className="invite-actions">
              <button
                type="button"
                className="invite-accept-btn"
                onClick={() => handleAcceptGuestRequest(pendingGuestRequests[0])}
              >
                Accept
              </button>
              <button
                type="button"
                className="invite-decline-btn"
                onClick={() => handleRejectGuestRequest(pendingGuestRequests[0].handle)}
                aria-label="Decline request"
              >
                ✕
              </button>
            </div>
          </div>
        )}

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
          {/* Top-Left Streamer Capsule (Avatar + Full Name + Likes + Small Plus Button) */}
          <div className="liveme-capsule-main">
            <div
              className="liveme-streamer-avatar-wrap"
              onClick={() => handleOpenUserProfile(currentStreamer.handle, {
                name: currentStreamer.name,
                avatar: currentStreamer.avatar,
              })}
              title={`View ${currentStreamer.name}'s profile`}
            >
              <img
                src={currentStreamer.avatar}
                alt={currentStreamer.name}
                className="liveme-streamer-avatar"
              />
            </div>

            <div
              className="liveme-streamer-meta"
              onClick={() => handleOpenUserProfile(currentStreamer.handle, {
                name: currentStreamer.name,
                avatar: currentStreamer.avatar,
              })}
              style={{ cursor: 'pointer' }}
              title={`View ${currentStreamer.name}'s profile`}
            >
              <div className="liveme-streamer-name">
                {currentStreamer.name}
              </div>
              <div
                className="liveme-diamond-score"
                onClick={(e) => {
                  e.stopPropagation();
                  spawnHeartReaction();
                  const likesNow = streamerLikesMap[currentStreamer.id] ?? (isRealStream ? likesReceived : (currentStreamer.likesCount || 0));
                  showToast(`❤️ Exact Real-Time Likes: ${likesNow.toLocaleString()}`);
                }}
                title="Tap to like & view exact real-time hearts count"
              >
                <span style={{ color: '#f43f5e' }}>♥</span>
                <span>
                  {(() => {
                    const count = streamerLikesMap[currentStreamer.id] ?? (isRealStream ? likesReceived : (currentStreamer.likesCount || 0));
                    return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count;
                  })()}
                </span>
              </div>
            </div>

            {!isHost && !isFollowing && (
              <button
                type="button"
                className="liveme-pill-follow-plus-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFollow();
                }}
                title={`Follow ${currentStreamer.name}`}
                aria-label={`Follow ${currentStreamer.name}`}
              >
                +
              </button>
            )}
          </div>

          {/* Top-Right Contributors & Controls */}
          <div className="liveme-top-right-group">
            {/* Top Gifters Facepile (compact 2 slots) */}
            <div className="liveme-top-gifters-pile">
              {roomContributors.slice(0, 2).map((c) => (
                <div
                  key={c.id}
                  className="liveme-gifter-avatar-slot"
                  title={`#${c.rank} Gifter: ${c.name} (${c.contribution.toLocaleString()} 🪙)`}
                  onClick={() =>
                    handleOpenUserProfile(c.name, {
                      name: c.name,
                      avatar: c.avatar,
                      contribution: c.contribution,
                    })
                  }
                  style={{ cursor: 'pointer' }}
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
              <span>{liveViewersCount.toLocaleString()}</span>
            </div>

            {/* Optional Minimize to PiP Button for Viewers */}
            {!isHost && (
              <button
                type="button"
                className="liveme-close-btn liveme-min-pip-btn"
                onClick={() => onClose({ wasEnded: false, isHost: false })}
                title="Minimize to Picture-in-Picture"
                aria-label="Minimize to Picture-in-Picture"
                style={{ marginRight: '6px', fontSize: '15px' }}
              >
                ⤓
              </button>
            )}

            {/* Close / End Live Button: Host gets Power Button ⏻, Viewer gets simple ✕ */}
            {isHost ? (
              <button
                type="button"
                id="liveme-end-broadcast-btn"
                className="liveme-power-btn"
                onClick={() => setIsConfirmEndOpen(true)}
                title="End Broadcast"
                aria-label="End Broadcast"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="#ffffff" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                  <line x1="12" y1="2" x2="12" y2="12" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="liveme-close-btn"
                onClick={() => onClose({ wasEnded: false, isHost: false })}
                title="Close Stream"
                aria-label="Close Stream"
                style={{ fontSize: '18px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {/* Organic Gesture Mode Feedback Toast (Active only when sliding left/right) */}

        {/* Organic Gesture Mode Feedback Toast */}
        {modeFeedbackToast && (
          <div className="liveme-mode-feedback-toast" role="status" aria-live="polite">
            <span>{modeFeedbackToast}</span>
          </div>
        )}

        {/* Row 2: Sub-pills row (Exact TikTok LIVE Spec: Daily Ranking, Goal, Gallery) */}
        {arenaMode !== 'stream_hud' && (
          <div className="liveme-sub-pills-row">
            <div
              className="liveme-sub-pill ranking"
              onClick={() => setIsLeaderboardOpen(true)}
              style={{ cursor: 'pointer' }}
              title="Click to view Daily Leaderboard"
            >
              <span>🔥</span>
              <span>Daily Ranking #{diamondsEarned > 1000 ? '1' : diamondsEarned > 500 ? '2' : diamondsEarned > 100 ? '3' : '1'}</span>
            </div>
            <div
              className={`liveme-sub-pill goal ${streamGoal.currentCount >= streamGoal.targetCount ? 'completed' : ''}`}
              onClick={() => {
                if (isHost) {
                  setIsGiftGoalModalOpen(true);
                } else {
                  showToast(`🎯 Host Goal: ${streamGoal.currentCount}/${streamGoal.targetCount} ${streamGoal.giftName}s! Send ${streamGoal.giftIcon} to support!`);
                }
              }}
              style={{ cursor: 'pointer' }}
              title={isHost ? "Host: Click to customize Goal" : "Live Gift Goal Progress"}
            >
              <span>{streamGoal.currentCount >= streamGoal.targetCount ? '🏆' : streamGoal.giftIcon}</span>
              <span>{streamGoal.giftName} {Math.min(streamGoal.targetCount, streamGoal.currentCount)}/{streamGoal.targetCount}</span>
            </div>
            <div
              className="liveme-sub-pill gallery"
              onClick={() => setIsGiftTrayOpen(true)}
              style={{ cursor: 'pointer' }}
              title="Open Gift Gallery"
            >
              <span>Gift Gallery</span>
              <span>🎁</span>
            </div>
          </div>
        )}

        {/* Fly-In Viewer Join Animated Specular Banner */}
        {activeJoinBanner && (
          <div className="liveme-join-flyin-container" key={activeJoinBanner.id}>
            <div
              className={`liveme-join-flyin-card ${activeJoinBanner.isExiting ? 'exiting' : ''}`}
              onClick={() =>
                handleOpenUserProfile(activeJoinBanner.handle, {
                  name: activeJoinBanner.name,
                  avatar: activeJoinBanner.avatar,
                  level: activeJoinBanner.level,
                })
              }
            >
              <div className="liveme-join-flyin-avatar-box">
                <img
                  src={activeJoinBanner.avatar}
                  alt={activeJoinBanner.name}
                  className="liveme-join-flyin-avatar"
                />
                <span className="liveme-join-flyin-badge">{activeJoinBanner.badge || 'VIP'}</span>
              </div>
              <div className="liveme-join-flyin-meta">
                <div className="liveme-join-flyin-name-row">
                  <span className="liveme-join-flyin-name">{activeJoinBanner.name}</span>
                  <span className="liveme-join-flyin-star">★{activeJoinBanner.level}</span>
                </div>
                <span className="liveme-join-flyin-action">joined the LIVE</span>
              </div>
              <span className="liveme-join-flyin-wave">👋</span>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* 5. FLOATING LIVE CHAT STREAM (NORMAL & LARGE READER MODES)        */}
        {/* ================================================================ */}
        {arenaMode !== 'stream_hud' && (
          <div
            className={`liveme-chat-stream-layer ${arenaMode === 'chat_reader' ? 'is-large-reader' : ''}`}
            style={
              arenaMode === 'chat_reader'
                ? ({ '--chat-reader-font-size': `${readerFontSize}px` } as React.CSSProperties)
                : undefined
            }
          >
            {/* Large Chat Reader Mode Control Header */}
            {arenaMode === 'chat_reader' && (
              <div className="liveme-reader-header-bar">
                <div className="liveme-reader-header-left">
                  <span className="liveme-reader-badge">💬 BIG MESSAGES</span>
                  <span className="liveme-reader-hint">Swipe ➔ to Live</span>
                </div>

                {/* Font Size Adjusters: A- (18px), A (22px), A+ (26px), A++ (30px) */}
                <div className="liveme-reader-font-controls" onClick={(e) => e.stopPropagation()}>
                  <span className="font-control-label">Size:</span>
                  {[18, 22, 26, 30].map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`liveme-font-size-btn ${readerFontSize === size ? 'active' : ''}`}
                      onClick={() => setReaderFontSize(size)}
                      title={`Set message font size to ${size}px`}
                    >
                      {size === 18 ? 'A-' : size === 22 ? 'A' : size === 26 ? 'A+' : 'A++'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="liveme-chat-scroll-box" ref={chatScrollRef}>
              {/* Privity LIVE Official Welcome & Match Banners */}
              <div className="liveme-chat-system-banner">
                <span className="liveme-tiktok-icon">🔴</span>
                <p>Welcome to Privity LIVE! Have fun interacting with others in real time. Creators must be 18 or older to go LIVE. Viewers must be 18 or older to recharge and send Gifts. Remember to follow our Community Guidelines.</p>
              </div>

              {isPkBattleActive && (
                <div className="liveme-chat-system-banner match-start">
                  <span className="liveme-tiktok-icon">🎵</span>
                  <p>LIVE Match has started! Cheer on your creator, like the match, and send Gifts.</p>
                </div>
              )}

              <div
                className={`liveme-chat-join-row ${arenaMode === 'chat_reader' ? 'is-reader-row' : ''}`}
                onClick={() =>
                  handleOpenUserProfile(currentUser.handle, {
                    name: currentUser.name,
                    avatar: currentUser.avatar,
                  })
                }
                style={{ cursor: 'pointer' }}
                title="Click to view profile"
              >
                {arenaMode === 'chat_reader' && (
                  <img src={currentUser.avatar} alt={currentUser.name} className="liveme-reader-avatar" />
                )}
                <span className="liveme-join-hand">👋</span>
                <span className="liveme-join-gem">💎{getDeterministicLevel(currentUser.handle)}</span>
                <span className="liveme-join-name">{currentUser.name} 🇨🇺</span>
                <span className="liveme-join-text">joined</span>
              </div>

              {chatMessages.map((msg) => {
                if (msg.isJoin) {
                  return (
                    <div
                      key={msg.id}
                      className={`liveme-chat-join-row ${arenaMode === 'chat_reader' ? 'is-reader-row' : ''}`}
                      onClick={() => {
                        if (msg.handle || msg.user) {
                          handleOpenUserProfile(msg.handle || msg.user, {
                            name: msg.user,
                            avatar: msg.avatar,
                            level: msg.level,
                          });
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                      title="Click to view profile"
                    >
                      {arenaMode === 'chat_reader' && (
                        <img
                          src={msg.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'}
                          alt={msg.user || 'Viewer'}
                          className="liveme-reader-avatar"
                        />
                      )}
                      <span className="liveme-join-hand">👋</span>
                      <span className="liveme-join-gem">⭐{msg.level || getDeterministicLevel(msg.handle || msg.user)}</span>
                      <span className="liveme-join-name">{msg.user}</span>
                      <span className="liveme-join-text">joined the LIVE</span>
                    </div>
                  );
                }

                if (msg.isSystem && msg.giftInfo) {
                  return (
                    <div
                      key={msg.id}
                      className={`liveme-chat-row gift-notice ${arenaMode === 'chat_reader' ? 'is-reader-row' : ''}`}
                      onClick={() => {
                        if (msg.handle || msg.user) {
                          handleOpenUserProfile(msg.handle || msg.user, {
                            name: msg.user,
                            avatar: msg.avatar,
                            level: msg.level,
                          });
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {arenaMode === 'chat_reader' && (
                        <img
                          src={msg.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                          alt={msg.user || 'Viewer'}
                          className="liveme-reader-avatar"
                        />
                      )}
                      <span className="liveme-gift-tag">🎁 GIFT</span>
                      <span className="liveme-chat-user">@{msg.user}:</span>
                      <span className="liveme-chat-text" style={{ color: '#ec4899', fontWeight: 800 }}>
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`liveme-chat-row ${arenaMode === 'chat_reader' ? 'is-reader-row' : ''} ${msg.isSystem ? 'gift-notice' : ''}`}
                    onClick={() => {
                      if (msg.user) {
                        handleOpenUserProfile(msg.handle || msg.user, {
                          name: msg.user,
                          avatar: msg.avatar,
                          level: msg.level,
                        });
                      }
                    }}
                    style={{ cursor: msg.user ? 'pointer' : 'default' }}
                    title={msg.user ? `Click @${msg.user}'s profile` : undefined}
                  >
                    {arenaMode === 'chat_reader' && (
                      <img
                        src={msg.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                        alt={msg.user || 'User'}
                        className="liveme-reader-avatar"
                      />
                    )}
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
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* 5B. STREAM HUD / TIME & TELEMETRY OVERLAY (SWIPE RIGHT)           */}
        {/* ================================================================ */}
        {arenaMode === 'stream_hud' && (
          <div className="liveme-stream-hud-overlay">
            {/* Top HUD Hint Bar */}
            <div className="liveme-hud-top-hint">
              <div className="liveme-hud-pill-tag">
                <span className="pulse-dot green" />
                <span>BROADCAST TELEMETRY & TIME</span>
              </div>
              <button
                type="button"
                className="liveme-hud-return-btn"
                onClick={() => triggerModeChange('normal')}
                title="Return to normal live feed"
              >
                ⬅️ Swipe Left / Tap for Live
              </button>
            </div>

            {/* Hero Clocks Section */}
            <div className="liveme-hud-clocks-hero">
              {/* 1. Live Elapsed Broadcast Timer */}
              <div className="liveme-hud-clock-card live-duration">
                <div className="liveme-hud-card-label">
                  <span className="live-pulsing-badge">● LIVE</span>
                  <span>BROADCAST DURATION</span>
                </div>
                <div className="liveme-hud-clock-digits neon-green">
                  {formatDurationExtended(streamDurationSec)}
                </div>
                <div className="liveme-hud-clock-sub">
                  Continuous broadcast uptime
                </div>
              </div>

              {/* 2. Real-World Local Clock */}
              <div className="liveme-hud-clock-card local-time">
                <div className="liveme-hud-card-label">
                  <span>🕒</span>
                  <span>REAL-WORLD LOCAL TIME</span>
                </div>
                <div className="liveme-hud-clock-digits neon-blue">
                  {currentClockTime.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
                <div className="liveme-hud-clock-sub">
                  {currentClockTime.toLocaleDateString([], {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
            </div>

            {/* Stream Metrics Grid (All that other stuff) */}
            <div className="liveme-hud-metrics-grid">
              {/* Card 1: Diamonds Earned */}
              <div className="liveme-hud-metric-card">
                <div className="hud-metric-header">
                  <span className="hud-metric-icon">💎</span>
                  <span className="hud-metric-title">Diamonds Earned</span>
                </div>
                <div className="hud-metric-value">{diamondsEarned.toLocaleString()}</div>
                <div className="hud-metric-footer">
                  ≈ ${(diamondsEarned * 0.005).toFixed(2)} USD creator balance
                </div>
              </div>

              {/* Card 2: Viewers & Likes */}
              <div className="liveme-hud-metric-card">
                <div className="hud-metric-header">
                  <span className="hud-metric-icon">👥</span>
                  <span className="hud-metric-title">Live Audience</span>
                </div>
                <div className="hud-metric-value">{liveViewersCount.toLocaleString()}</div>
                <div className="hud-metric-footer">
                  ❤️ {likesReceived.toLocaleString()} total likes
                </div>
              </div>

              {/* Card 3: Virtual Gifts Received */}
              <div className="liveme-hud-metric-card">
                <div className="hud-metric-header">
                  <span className="hud-metric-icon">🎁</span>
                  <span className="hud-metric-title">Gifts Received</span>
                </div>
                <div className="hud-metric-value">
                  {chatMessages.filter((m) => m.isSystem && m.giftInfo).reduce((acc, m) => acc + (m.giftInfo?.count || 1), 0)}
                </div>
                <div className="hud-metric-footer">
                  {roomContributors[0] ? `Top: @${roomContributors[0].name}` : 'No gifts yet this session'}
                </div>
              </div>

              {/* Card 4: Network & Hardware Health */}
              <div className="liveme-hud-metric-card">
                <div className="hud-metric-header">
                  <span className="hud-metric-icon">📶</span>
                  <span className="hud-metric-title">Stream Health</span>
                </div>
                <div className="hud-metric-value neon-quality">1080p 60fps</div>
                <div className="hud-metric-footer">
                  🟢 Direct Sovereign P2P WebRTC
                </div>
              </div>
            </div>

            {/* Quick Broadcast Controls (for Host) */}
            {isHost && (
              <div className="liveme-hud-quick-tools">
                <button
                  type="button"
                  className="liveme-hud-tool-btn"
                  onClick={handleFlipCamera}
                  title="Switch between front and back cameras"
                >
                  <span>🔄</span>
                  <span>{cameraFacing === 'user' ? 'Front Cam' : 'Back Cam'}</span>
                </button>

                <button
                  type="button"
                  className={`liveme-hud-tool-btn ${isMirrored ? 'active' : ''}`}
                  onClick={handleToggleMirror}
                  title="Toggle camera mirror view"
                >
                  <span>🪞</span>
                  <span>{isMirrored ? 'Mirrored: ON' : 'Mirrored: OFF'}</span>
                </button>

                <button
                  type="button"
                  className={`liveme-hud-tool-btn ${isMicMuted ? 'muted' : ''}`}
                  onClick={handleToggleMic}
                  title="Mute / unmute microphone"
                >
                  <span>{isMicMuted ? '🔇' : '🎙️'}</span>
                  <span>{isMicMuted ? 'Mic Muted' : 'Mic Live'}</span>
                </button>

                <button
                  type="button"
                  className={`liveme-hud-tool-btn ${isVideoOff ? 'off' : ''}`}
                  onClick={handleToggleVideo}
                  title="Toggle camera video stream"
                >
                  <span>{isVideoOff ? '🚫' : '📹'}</span>
                  <span>{isVideoOff ? 'Cam Paused' : 'Cam Active'}</span>
                </button>
              </div>
            )}

            {/* Bottom swipe guide */}
            <div className="liveme-hud-bottom-guide">
              <span>⬅️ Swipe Left to return to Live Chat</span>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* 6. UNIFIED MODERN BOTTOM CONTROLS BAR                             */}
        {/* ================================================================ */}
        {/* Floating In-Stream Guest Prompt Matching Screenshot 4 */}
        {floatingGuestPrompt && isHost && !isFilterTrayOpen && (
          <div className="tiktok-floating-guest-pill">
            <img src={floatingGuestPrompt.avatar} alt="" className="pill-avatar" />
            <span className="pill-text">Invite {floatingGuestPrompt.name} to join as a guest</span>
            <button
              type="button"
              className="pill-invite-btn"
              onClick={() => {
                showToast(`📩 Invited ${floatingGuestPrompt.name} to join as guest!`);
                setFloatingGuestPrompt(null);
              }}
            >
              Invite
            </button>
            <button
              type="button"
              className="pill-dismiss-btn"
              onClick={() => setFloatingGuestPrompt(null)}
              aria-label="Dismiss guest prompt"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tap to Unmute Overlay for Viewers */}
        {showTapToUnmute && !isHost && (
          <div
            className="tiktok-tap-to-unmute-badge"
            onClick={() => {
              setShowTapToUnmute(false);
              setIsMuted(false);
              if (videoRef.current) {
                videoRef.current.muted = false;
                videoRef.current.volume = 1.0;
                videoRef.current.play().catch(() => {});
              }
              showToast('🔊 Live Sound Unmuted');
            }}
          >
            <span>🔇</span>
            <span>Tap to unmute live audio</span>
          </div>
        )}

        {/* ================================================================ */}
        {/* 6. UNIFIED MODERN BOTTOM CONTROLS BAR (MATCHING SCREENSHOT 4)    */}
        {/* ================================================================ */}
        {arenaMode !== 'stream_hud' && (
          <div className="liveme-bottom-bar">
            {/* Left Tools: Strictly Host vs Viewer Separation */}
            {isHost ? (
              <>
                {/* Host Left 1: Battle / Co-Host Matchmaker (Dual Infinity Gradient Rings) */}
                <button
                  type="button"
                  className={`tiktok-tool-btn battle ${isPkBattleActive ? 'active' : ''}`}
                  onClick={() => setIsCoHostModalOpen(true)}
                  title="Co-host with creators & Battles"
                >
                  <svg viewBox="0 0 28 28" width="22" height="22" fill="none">
                    <defs>
                      <linearGradient id="tkBattleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M8.5 9C6.01472 9 4 11.0147 4 13.5C4 15.9853 6.01472 18 8.5 18C10.7423 18 12.336 16.3813 14 14C15.664 11.6187 17.2577 10 19.5 10C21.9853 10 24 12.0147 24 14.5C24 16.9853 21.9853 19 19.5 19C17.2577 19 15.664 17.3813 14 15C12.336 12.6187 10.7423 11 8.5 11"
                      stroke="url(#tkBattleGrad)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  {isPkBattleActive && <span className="badge-pill">PK</span>}
                </button>

                {/* Host Left 2: Guests / Multi-Guest Icon */}
                <button
                  type="button"
                  className="tiktok-tool-btn guests"
                  onClick={() => setIsGuestsModalOpen(true)}
                  title="Go LIVE with guests"
                >
                  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {activeGuests.length > 0 && <span className="badge-pill">{activeGuests.length}</span>}
                  {pendingGuestRequests.length > 0 && (
                    <span className="badge-pill" style={{ background: '#06b6d4', color: '#000', fontWeight: 800 }}>
                      {pendingGuestRequests.length}
                    </span>
                  )}
                </button>
              </>
            ) : (
              /* Viewer Left: Request to Join Stage as Guest */
              <button
                type="button"
                className={`tiktok-tool-btn join-stage ${isOnStageAsGuest ? 'on-stage' : isGuestRequestPending ? 'pending' : ''}`}
                onClick={handleRequestJoinStage}
                title={
                  isOnStageAsGuest
                    ? 'You are on stage as guest! Click to leave stage'
                    : isGuestRequestPending
                    ? 'Stage request pending host approval...'
                    : 'Request to join stage and talk with host'
                }
              >
                {isOnStageAsGuest ? '🎙️' : isGuestRequestPending ? '⏳' : '🎤'}
              </button>
            )}

            {/* Center: Chat Input Form (Type... with Smiley) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (chatInput.trim()) {
                  handleSendChat(e);
                } else {
                  setIsChatExpanded(true);
                  setTimeout(() => expandedInputRef.current?.focus(), 80);
                }
              }}
              className="liveme-input-form"
            >
              <div
                className={`liveme-chat-input-wrap ${isUserMuted ? 'muted' : ''}`}
                onClick={() => {
                  if (!isUserMuted) {
                    setIsChatExpanded(true);
                    setTimeout(() => expandedInputRef.current?.focus(), 80);
                  }
                }}
              >
                <input
                  type="text"
                  className="liveme-chat-input"
                  placeholder={isUserMuted ? "🔇 You are muted by the host" : "Add a comment..."}
                  value={chatInput}
                  disabled={isUserMuted}
                  onFocus={() => {
                    if (!isUserMuted) {
                      setIsChatExpanded(true);
                      setTimeout(() => expandedInputRef.current?.focus(), 80);
                    }
                  }}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button
                  type="button"
                  className="liveme-chat-smiley-btn"
                  disabled={isUserMuted}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isUserMuted) {
                      setIsChatExpanded(true);
                      setChatInput((prev) => prev + ' 😊');
                      setTimeout(() => expandedInputRef.current?.focus(), 80);
                    }
                  }}
                >
                  😊
                </button>
              </div>
            </form>

            {/* Right Toolbar Action Icons Matching Screenshot 4 */}
            <div className="liveme-toolbar-actions">
              {isHost ? (
                <>
                  {/* Share Button */}
                  <button
                    type="button"
                    className="tiktok-tool-btn share"
                    onClick={handleShareStream}
                    title="Share Stream"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </button>

                  {/* Magic Pen / Filters Carousel Button */}
                  <button
                    type="button"
                    className={`tiktok-tool-btn magic-pen ${isFilterTrayOpen ? 'active' : ''}`}
                    onClick={() => setIsFilterTrayOpen(!isFilterTrayOpen)}
                    title="Open AR & Beauty Filters"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>

                  {/* Host Studio Tools (Three Dots •••) */}
                  <button
                    type="button"
                    className="tiktok-tool-btn more-tools"
                    onClick={() => setIsStudioModalOpen(true)}
                    title="Host Studio Settings & Tools"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  {/* Share Button */}
                  <button
                    type="button"
                    className="tiktok-tool-btn share"
                    onClick={handleShareStream}
                    title="Share Stream"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </button>

                  {/* Mute / Unmute Button */}
                  <button
                    type="button"
                    className="tiktok-tool-btn mute"
                    onClick={() => {
                      const next = !isMuted;
                      setIsMuted(next);
                      showToast(next ? '🔇 Stream Muted' : '🔊 Stream Audio Unmuted');
                    }}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>

                  {/* 3D Glowing Pink Gift Box Button */}
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
        )}

        {/* 7. TIKTOK AR & BEAUTY FILTER CAROUSEL TRAY (Toggled by the Magic Pen ✏️) */}
        <LiveFilterCarouselTray
          isOpen={isFilterTrayOpen}
          onClose={() => setIsFilterTrayOpen(false)}
          activeFilterId={activeLiveFilter.id}
          onSelectFilter={(filter) => {
            setActiveLiveFilter(filter);
            if (isHost) {
              const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
              liveStreamSync.sendRoomEvent(roomId, {
                type: 'STREAM_FILTER_CHANGE',
                filterId: filter.id,
                cssFilter: filter.cssFilter,
              });
            }
          }}
          onToggleFullscreen={handleToggleFullscreen}
          showToast={showToast}
        />

        {/* 6b. EXPANDED REAL-APP TYPING DOCK (Opens when clicking to type for full message visibility) */}
        {isChatExpanded && (
          <div
            className="liveme-expanded-typing-backdrop"
            onClick={() => setIsChatExpanded(false)}
          >
            <div
              className="liveme-expanded-typing-dock"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Quick Reactions Bar */}
              <div className="liveme-quick-emojis-bar">
                {['😊', '🔥', '❤️', '👑', '👏', '🌹', '✨', '💯', '🚀', '😍', '🎉', '💪'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="liveme-quick-emoji-btn"
                    onClick={() => {
                      setChatInput((prev) => prev + emoji);
                      expandedInputRef.current?.focus();
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Expanded Full-Width Typing Form */}
              <form
                onSubmit={(e) => {
                  handleSendChat(e);
                  expandedInputRef.current?.focus();
                }}
                className="liveme-expanded-input-row"
              >
                <input
                  ref={expandedInputRef}
                  type="text"
                  className="liveme-expanded-chat-input"
                  placeholder={isUserMuted ? "🔇 You are muted by the host" : "Send a message in LIVE chat..."}
                  value={chatInput}
                  disabled={isUserMuted}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="liveme-expanded-send-btn"
                  disabled={isUserMuted || !chatInput.trim()}
                >
                  Send ➤
                </button>
                <button
                  type="button"
                  className="liveme-expanded-close-btn"
                  onClick={() => setIsChatExpanded(false)}
                  title="Collapse Typing Bar"
                >
                  ✕
                </button>
              </form>
            </div>
          </div>
        )}

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
          isPkBattleActiveRef.current = true;
          setHostPkScore(3);
          setRivalPkScore(4);
          setBattleRoundTimer(121);
          setBattleWinner(null);
          const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
          liveStreamSync.sendRoomEvent(roomId, {
            type: 'PK_BATTLE_START',
            rival,
            hostScore: 3,
            rivalScore: 4,
            roundTimer: 121,
          });
        }}
        onEndPkBattle={() => {
          setIsPkBattleActive(false);
          isPkBattleActiveRef.current = false;
          const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
          liveStreamSync.sendRoomEvent(roomId, {
            type: 'PK_BATTLE_END',
          });
        }}
        onRematch={() => {
          setHostPkScore(3);
          setRivalPkScore(4);
          setBattleRoundTimer(121);
          setBattleWinner(null);
          const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
          liveStreamSync.sendRoomEvent(roomId, {
            type: 'PK_BATTLE_START',
            rival: pkRival,
            hostScore: 3,
            rivalScore: 4,
            roundTimer: 121,
          });
        }}
        showToast={showToast}
        activeAudience={activeAudience}
        activeGuests={activeGuests}
        onInviteGuest={handleInviteGuest}
        onRemoveGuest={handleRemoveGuest}
      />

      {/* ================================================================ */}
      {/* 9A. TIKTOK CO-HOST WITH CREATORS & BATTLES MODAL (SCREENSHOT 1) */}
      {/* ================================================================ */}
      <LiveCoHostCreatorsModal
        isOpen={isCoHostModalOpen}
        onClose={() => setIsCoHostModalOpen(false)}
        currentHostName={currentUser.name}
        currentHostHandle={currentUser.handle}
        currentHostAvatar={currentUser.avatar}
        onStartBattle={(rival) => {
          setPkRival(rival);
          setIsPkBattleActive(true);
          isPkBattleActiveRef.current = true;
          setHostPkScore(3);
          setRivalPkScore(4);
          setBattleRoundTimer(121);
          setBattleWinner(null);
          const roomId = currentStreamer.id || getRoomIdFromHandle(currentUser.handle);
          liveStreamSync.sendRoomEvent(roomId, {
            type: 'PK_BATTLE_START',
            rival,
            hostScore: 3,
            rivalScore: 4,
            roundTimer: 121,
          });
        }}
        showToast={showToast}
      />

      {/* ================================================================ */}
      {/* 9B. TIKTOK GO LIVE WITH GUESTS BOTTOM SHEET (SCREENSHOT 3)      */}
      {/* ================================================================ */}
      <LiveGoLiveGuestsModal
        isOpen={isGuestsModalOpen}
        onClose={() => setIsGuestsModalOpen(false)}
        currentHostName={currentUser.name}
        currentHostHandle={currentUser.handle}
        currentHostAvatar={currentUser.avatar}
        activeAudience={activeAudience}
        activeGuests={activeGuests}
        pendingRequests={pendingGuestRequests}
        cameraFacing={cameraFacing}
        isVideoOff={isVideoOff}
        onToggleVideo={handleToggleVideo}
        onFlipCamera={handleFlipCamera}
        onInviteGuest={handleInviteGuest}
        onAcceptRequest={handleAcceptGuestRequest}
        onRejectRequest={handleRejectGuestRequest}
        onRemoveGuest={handleRemoveGuest}
        showToast={showToast}
      />

      {/* ================================================================ */}
      {/* 9C. INCOMING INVITATION PROMPT BANNER FOR RECIPIENTS             */}
      {/* ================================================================ */}
      {incomingInvite && (
        <div className="tiktok-incoming-invite-banner">
          <img src={incomingInvite.senderAvatar} alt="" className="invite-avatar" />
          <div className="invite-text">
            <span className="invite-name">{incomingInvite.senderName}</span>
            <span className="invite-sub">
              {incomingInvite.type === 'cohost'
                ? 'invited you to Co-Host & Battle!'
                : 'invited you to join as a Guest!'}
            </span>
          </div>
          <div className="invite-actions">
            <button
              type="button"
              className="invite-accept-btn"
              onClick={() => {
                const invite = incomingInvite;
                setIncomingInvite(null);
                if (invite.type === 'cohost') {
                  const rivalStreamer: LiveMeStreamer = {
                    id: `rival-${invite.senderHandle}`,
                    name: invite.senderName,
                    handle: invite.senderHandle.startsWith('@') ? invite.senderHandle : `@${invite.senderHandle}`,
                    avatar: invite.senderAvatar,
                    title: 'Live PK Battle',
                    description: 'PK battle stream duel',
                    viewersCount: 24,
                    likesCount: 5000,
                    category: 'Battle',
                    videoStreamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                    posterUrl: invite.senderAvatar,
                    isVerified: true,
                    diamonds: 500,
                    totalViews: '2.5K',
                    popularity: 'Hot',
                    tags: ['Battle', 'CoHost'],
                    topContributors: [],
                  };
                  setPkRival(rivalStreamer);
                  setIsPkBattleActive(true);
                  isPkBattleActiveRef.current = true;
                  setHostPkScore(3);
                  setRivalPkScore(4);
                  setBattleRoundTimer(121);
                  showToast(`⚔️ Connected with ${invite.senderName} for Live Battle!`);
                } else {
                  handleStartGuestStage();
                }
              }}
            >
              Accept
            </button>
            <button
              type="button"
              className="invite-decline-btn"
              onClick={() => setIncomingInvite(null)}
              aria-label="Decline invitation"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
        currentUserHandle={currentUser?.handle}
        streamerName={currentStreamer.name}
        viewersCount={isHost ? liveViewersCount : currentStreamer.viewersCount}
        viewers={activeAudience}
        isHost={isHost}
        followedMap={followedMap}
        onFollowToggle={handleToggleFollow}
        onViewProfile={(handle, viewerObj) => {
          handleOpenUserProfile(handle, viewerObj ? {
            name: viewerObj.name,
            avatar: viewerObj.avatar,
            level: viewerObj.level,
            contribution: viewerObj.contribution,
          } : undefined);
        }}
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
                onClose({ wasEnded: true, isHost: true });
              }}
            >
              Done & Return to Feed
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 13. IN-STREAM USER PROFILE MINI-CARD ("LITTLE TAB")             */}
      {/* ================================================================ */}
      <LiveUserProfileModal
        isOpen={isUserProfileModalOpen}
        onClose={() => setIsUserProfileModalOpen(false)}
        currentUserHandle={currentUser?.handle}
        user={selectedProfileUser}
        isHost={isHost}
        isFollowing={!!followedMap[(selectedProfileUser?.handle || '').replace(/^@/, '').toLowerCase()]}
        onToggleFollow={handleToggleFollow}
        isMuted={mutedUsers.some((u) => u.handle.toLowerCase() === selectedProfileUser?.handle.toLowerCase())}
        isBlocked={blockedUsers.some((u) => u.handle.toLowerCase() === selectedProfileUser?.handle.toLowerCase())}
        onMuteUser={handleMuteUser}
        onKickUser={handleKickUser}
        onBlockUser={handleBlockUser}
        onSendChatMessage={(text: string) => handleSendChatMessage(text)}
        onOpenModerationManagement={() => setIsModerationModalOpen(true)}
        showToast={showToast}
        roomContribution={selectedProfileContribution}
        onNavigateToProfile={(targetHandle) => {
          setIsUserProfileModalOpen(false);
          if (onViewProfile) onViewProfile(targetHandle);
        }}
      />

      {/* ================================================================ */}
      {/* 14. HOST MODERATION MANAGEMENT MODAL                            */}
      {/* ================================================================ */}
      <LiveModerationModal
        isOpen={isModerationModalOpen}
        onClose={() => setIsModerationModalOpen(false)}
        mutedUsers={mutedUsers}
        kickedUsers={kickedUsers}
        blockedUsers={blockedUsers}
        onUnmuteUser={(handle: string) => {
          const u = mutedUsers.find((user) => user.handle.toLowerCase() === handle.toLowerCase());
          if (u) handleMuteUser(u);
        }}
        onUnkickUser={(handle: string) => {
          setKickedUsers((prev) => prev.filter((k) => k.handle.toLowerCase() !== handle.toLowerCase()));
          showToast(`✅ Re-admitted @${handle} to broadcast.`);
        }}
        onUnblockUser={(handle: string) => {
          const u = blockedUsers.find((user) => user.handle.toLowerCase() === handle.toLowerCase());
          if (u) handleBlockUser(u);
        }}
        showToast={showToast}
      />

      {/* ================================================================ */}
      {/* 14B. BEAUTY & ENHANCEMENTS MODAL (BUBBLE 2)                     */}
      {/* ================================================================ */}
      <LiveBeautyEnhancementsModal
        isOpen={isBeautyModalOpen}
        onClose={() => setIsBeautyModalOpen(false)}
        skinSmoothing={skinSmoothing}
        setSkinSmoothing={setSkinSmoothing}
        skinLightening={skinLightening}
        setSkinLightening={setSkinLightening}
        skinTone={skinTone}
        setSkinTone={setSkinTone}
        activeBeautyFilter={activeBeautyFilter}
        setActiveBeautyFilter={setActiveBeautyFilter}
        activeLighting={activeLighting}
        setActiveLighting={setActiveLighting}
        onResetAll={handleResetBeauty}
      />

      {/* ================================================================ */}
      {/* 14C. HOST STUDIO & DUAL CAMERA CONTROLS MODAL (BUBBLE 3)         */}
      {/* ================================================================ */}
      <LiveStudioControlsModal
        isOpen={isStudioModalOpen}
        onClose={() => setIsStudioModalOpen(false)}
        cameraFacing={cameraFacing}
        isMirrored={isMirrored}
        isMicMuted={isMicMuted}
        isVideoOff={isVideoOff}
        isAudioMonitoring={isAudioMonitoring}
        micAudioLevel={micAudioLevel}
        isDualCameraActive={isDualCameraActive}
        dualCameraPosition={dualCameraPosition}
        isDualSwapped={isDualSwapped}
        onFlipCamera={handleFlipCamera}
        onToggleMirror={handleToggleMirror}
        onToggleMic={handleToggleMic}
        onToggleVideo={handleToggleVideo}
        onToggleAudioMonitoring={() => {
          setIsAudioMonitoring((prev) => {
            const next = !prev;
            showToast(next ? '🎧 Voice Monitoring ON: You can now hear yourself in headphones.' : '🎧 Voice Monitoring OFF.');
            return next;
          });
        }}
        onToggleDualCamera={handleToggleDualCamera}
        onChangeDualPosition={setDualCameraPosition}
        onSwapDualCameras={() => setIsDualSwapped((prev) => !prev)}
        onOpenModeration={() => setIsModerationModalOpen(true)}
        moderationCount={mutedUsers.length + kickedUsers.length + blockedUsers.length}
      />

      {/* ================================================================ */}
      {/* 14D. HOST STREAM TARGET GIFT GOAL MODAL                          */}
      {/* ================================================================ */}
      <LiveGiftGoalModal
        isOpen={isGiftGoalModalOpen}
        onClose={() => setIsGiftGoalModalOpen(false)}
        goal={streamGoal}
        onSaveGoal={(newGoal) => {
          setStreamGoal(newGoal);
          showToast(`🎯 Stream Goal set to ${newGoal.targetCount}x ${newGoal.giftName}!`);
          const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
          liveStreamSync.sendRoomEvent(roomId, {
            type: 'STREAM_GOAL_UPDATE',
            goal: newGoal,
          });
        }}
        isHost={isHost}
      />

      {/* ================================================================ */}
      {/* 14E. DAILY CREATOR LEADERBOARD MODAL                             */}
      {/* ================================================================ */}
      <LiveDailyLeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        hostDiamonds={diamondsEarned}
        hostName={currentUser.name}
        hostAvatar={currentUser.avatar}
      />

      {/* ================================================================ */}
      {/* 15. GRACEFUL "LIVE ENDED" OVERLAY FOR VIEWERS (3s COUNTDOWN)     */}
      {/* ================================================================ */}
      {isLiveEndedOverlayOpen && (
        <div className="liveme-ended-graceful-overlay">
          <div className="liveme-ended-graceful-content">
            <div className="liveme-ended-badge">🔴 LIVE ENDED</div>
            <img
              src={liveEndedData?.hostAvatar || currentStreamer.avatar}
              alt={liveEndedData?.hostName || currentStreamer.name}
              className="liveme-ended-host-avatar"
            />
            <h3 className="liveme-ended-host-name">
              {liveEndedData?.hostName || currentStreamer.name}
            </h3>
            <p className="liveme-ended-subtitle">This live broadcast has concluded.</p>

            <div className="liveme-ended-stats-row">
              <div className="liveme-ended-stat-box">
                <span className="ended-stat-val">👥 {(liveEndedData?.peakViewers || liveViewersCount).toLocaleString()}</span>
                <span className="ended-stat-label">Viewers</span>
              </div>
              <div className="liveme-ended-stat-box">
                <span className="ended-stat-val">❤️ {(liveEndedData?.totalLikes || likesReceived).toLocaleString()}</span>
                <span className="ended-stat-label">Likes</span>
              </div>
              <div className="liveme-ended-stat-box">
                <span className="ended-stat-val">💎 {(liveEndedData?.totalDiamonds || diamondsEarned).toLocaleString()}</span>
                <span className="ended-stat-label">Diamonds</span>
              </div>
            </div>

            <div className="liveme-ended-countdown-box">
              <span>Closing in </span>
              <span className="countdown-number">{endedCountdown}</span>
              <span> seconds...</span>
            </div>

            <button
              type="button"
              className="liveme-ended-close-now-btn"
              onClick={() => onClose({ wasEnded: true, isHost: false })}
            >
              Exit Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
