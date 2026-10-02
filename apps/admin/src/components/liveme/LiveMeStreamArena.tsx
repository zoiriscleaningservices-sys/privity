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
    name: 'Luciano',
    handle: 'luciano',
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
  const [roomContributors, setRoomContributors] = useState<LiveMeContributor[]>(() => isRealStream ? [] : (currentStreamer.topContributors || []));
  const roomContributorsRef = useRef(roomContributors);
  roomContributorsRef.current = roomContributors;

  useEffect(() => {
    if (!isRealStream && currentStreamer.topContributors && currentStreamer.topContributors.length > 0) {
      setRoomContributors(currentStreamer.topContributors);
    }
  }, [isRealStream, currentStreamer.topContributors]);

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
  const [activeAudience, setActiveAudience] = useState<RoomViewer[]>(() => {
    if (isRealStream) return [];
    return [
      {
        id: 'v1',
        name: 'Carlos Mendez',
        handle: 'carlos_m',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
        level: getDeterministicLevel('carlos_m'),
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
        level: getDeterministicLevel('sarita_w'),
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
        level: getDeterministicLevel('max_ldn'),
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
        level: getDeterministicLevel('elena_r'),
        isVip: false,
        contribution: 1200,
      },
      {
        id: 'v5',
        name: 'Kenji Sato',
        handle: 'kenji_tokyo',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120',
        level: getDeterministicLevel('kenji_tokyo'),
        isVip: false,
        contribution: 650,
      },
    ];
  });

  // Open User Profile Mini-Card ("Little Tab" that does not disrupt the live stream)
  const handleOpenUserProfile = (
    handle: string,
    fallback?: { name?: string; avatar?: string; level?: number; contribution?: number }
  ) => {
    // 1. Instantly close Room Viewers modal so the profile opens cleanly
    setIsViewersModalOpen(false);

    // 2. Identify if target is the current viewer/user
    const clean = handle.replace(/^@/, '').toLowerCase();
    const isSelf = clean === (currentUser.handle || '').replace(/^@/, '').toLowerCase();

    // 3. Look up audience member or contributor to get exact stats
    const audienceMember = activeAudience.find((v) => v.handle.replace(/^@/, '').toLowerCase() === clean);
    const contributor = roomContributors.find((c) => c.name.replace(/^@/, '').toLowerCase() === clean);

    const profile = getUserLiveProfile(handle, {
      name: isSelf ? currentUser.name : (fallback?.name || audienceMember?.name || contributor?.name),
      avatar: isSelf ? currentUser.avatar : (fallback?.avatar || audienceMember?.avatar || contributor?.avatar),
      level: isSelf ? getDeterministicLevel(currentUser.handle) : (fallback?.level || audienceMember?.level),
    });
    setSelectedProfileUser(profile);
    setSelectedProfileContribution(
      fallback?.contribution ?? audienceMember?.contribution ?? contributor?.contribution ?? 0
    );
    setIsUserProfileModalOpen(true);
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

  // Chat state (starts clean for real streams, no fake audience or simulated comments)
  const [chatMessages, setChatMessages] = useState<LiveMeChatMessage[]>(() => {
    if (isRealStream) {
      return [
        {
          id: 'welcome-sys',
          user: 'Privity Live',
          handle: 'privity',
          level: 1,
          text: '🔴 Live broadcast started. Tap the screen for hearts ♥ or say hello!',
          isSystem: true,
          timestamp: Date.now(),
        },
      ];
    }
    return [
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
    ];
  });
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

          // Guarantee microphone audio track is attached for high-quality audio
          if (stream.getAudioTracks().length === 0) {
            try {
              const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
              });
              audioStream.getAudioTracks().forEach((at) => stream!.addTrack(at));
            } catch (aErr) {
              console.warn('Microphone fallback acquisition error:', aErr);
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
    if (!isHost) return;

    const updateTimer = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - broadcastStartTimestampRef.current) / 1000));
      setStreamDurationSec(elapsed);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(timer);
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
      const roomId = getRoomIdFromHandle(currentStreamer.handle || currentStreamer.id);
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'LIVE_LIKE',
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
      }
    });
  }, [currentStreamer.id, currentStreamer.handle, isHost]);

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
      const updated = {
        ...prev,
        [handleToToggle]: nextState,
      };
      try {
        localStorage.setItem('privity_following_v5', JSON.stringify(updated));

        // Update target user's followersList in privity_profiles_v5 in real instant time!
        const rawProfs = localStorage.getItem('privity_profiles_v5');
        if (rawProfs) {
          const profs = JSON.parse(rawProfs);
          if (profs[handleToToggle]) {
            const curFollowers: string[] = profs[handleToToggle].followersList || [];
            const nextFollowers = nextState
              ? Array.from(new Set([...curFollowers, 'luciano']))
              : curFollowers.filter((h: string) => h.toLowerCase() !== 'luciano');
            profs[handleToToggle] = { ...profs[handleToToggle], followersList: nextFollowers };
            localStorage.setItem('privity_profiles_v5', JSON.stringify(profs));
          }
        }

        // Broadcast to whole app across tabs and components in real instant time!
        const bus = new BroadcastChannel('privity_sync_bus');
        bus.postMessage({
          action: 'TOGGLE_FOLLOW',
          targetHandle: handleToToggle,
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

    // Post to chat stream with special gift notice
    const giftMsg: LiveMeChatMessage = {
      id: `gift-${Date.now()}`,
      user: currentUser.name,
      handle: currentUser.handle,
      level: getDeterministicLevel(currentUser.handle),
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
        },
      });
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

            {/* Close / End Live Button (Prominent X button at very top right) */}
            <button
              type="button"
              id="liveme-end-broadcast-btn"
              className="liveme-close-btn"
              onClick={isHost ? () => setIsConfirmEndOpen(true) : () => onClose({ wasEnded: false, isHost: false })}
              title={isHost ? 'End Broadcast' : 'Close Stream'}
              aria-label={isHost ? 'End Broadcast' : 'Close Stream'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Row 2: Sub-pills row (Exact TikTok LIVE Spec: Daily Ranking, Goal, Gallery) */}
        <div className="liveme-sub-pills-row">
          <div
            className="liveme-sub-pill ranking"
            onClick={() => showToast(`🔥 Daily Creator Ranking: #1 in Privity LIVE (${diamondsEarned > 0 ? diamondsEarned.toLocaleString() : '12.4K'} pts)`)}
            style={{ cursor: 'pointer' }}
            title="Click to view Daily Ranking details"
          >
            <span>🔥</span>
            <span>Daily Ranking #1</span>
          </div>
          <div
            className={`liveme-sub-pill goal ${chatMessages.filter((m) => m.isSystem && m.giftInfo).reduce((acc, m) => acc + (m.giftInfo?.count || 1), 0) >= 10 ? 'completed' : ''}`}
            onClick={() => {
              const giftCount = chatMessages.filter((m) => m.isSystem && m.giftInfo).reduce((acc, m) => acc + (m.giftInfo?.count || 1), 0);
              if (giftCount >= 10) {
                showToast(`🎉 Live Goal Achieved! ${giftCount}/10 gifts sent!`);
              } else {
                showToast(`🎯 Live Stream Goal: ${giftCount}/10 gifts sent to reach the creator milestone!`);
              }
            }}
            style={{ cursor: 'pointer' }}
            title="Live Gift Goal Progress"
          >
            <span>{chatMessages.filter((m) => m.isSystem && m.giftInfo).reduce((acc, m) => acc + (m.giftInfo?.count || 1), 0) >= 10 ? '🏆' : '🎯'}</span>
            <span>{Math.min(10, chatMessages.filter((m) => m.isSystem && m.giftInfo).reduce((acc, m) => acc + (m.giftInfo?.count || 1), 0))}/10</span>
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

        {/* ================================================================ */}
        {/* 5. FLOATING LIVE CHAT STREAM (EXACT TIKTOK LIVE SPEC)            */}
        {/* ================================================================ */}
        <div className="liveme-chat-stream-layer">
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
              className="liveme-chat-join-row"
              onClick={() =>
                handleOpenUserProfile(currentUser.handle, {
                  name: currentUser.name,
                  avatar: currentUser.avatar,
                })
              }
              style={{ cursor: 'pointer' }}
              title="Click to view profile"
            >
              <span className="liveme-join-hand">👋</span>
              <span className="liveme-join-gem">💎{getDeterministicLevel(currentUser.handle)}</span>
              <span className="liveme-join-name">{currentUser.name} 🇨🇺</span>
              <span className="liveme-join-text">joined</span>
            </div>

            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`liveme-chat-row ${msg.isSystem ? 'gift-notice' : ''} ${msg.isJoin ? 'join-notice' : ''}`}
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
                placeholder={isUserMuted ? "🔇 You are muted by the host" : "Type..."}
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

          {/* Right Toolbar Action Icons */}
          <div className="liveme-toolbar-actions">
            {isHost ? (
              <>
                {/* 1. PK Battle Matchmaker Trigger */}
                <button
                  type="button"
                  className={`liveme-tool-btn liveme-match-trigger ${isPkBattleActive ? 'active' : ''}`}
                  onClick={() => setIsPkMatchModalOpen(true)}
                  title={isPkBattleActive ? "Manage PK Battle" : "Find PK Battle Match"}
                >
                  ⚔️
                </button>

                {/* 2. Voice Monitor ("Hear Myself" in headphones) */}
                <button
                  type="button"
                  className={`liveme-tool-btn liveme-hear-myself-btn ${isAudioMonitoring ? 'active' : ''}`}
                  onClick={() => {
                    setIsAudioMonitoring((prev) => {
                      const next = !prev;
                      showToast(next ? '🎧 Voice Monitoring ON: You can now hear yourself in headphones.' : '🎧 Voice Monitoring OFF.');
                      return next;
                    });
                  }}
                  title={isAudioMonitoring ? "Hear Myself (Voice Monitoring ON 🎧)" : "Hear Myself (Voice Monitor 🎧)"}
                >
                  🎧
                  {micAudioLevel > 10 && <span className="liveme-mic-vu-dot" />}
                </button>

                {/* 3. Moderation Management Panel */}
                <button
                  type="button"
                  className="liveme-tool-btn liveme-mod-btn"
                  onClick={() => setIsModerationModalOpen(true)}
                  title={`Moderation Panel (${mutedUsers.length + kickedUsers.length + blockedUsers.length} restricted)`}
                >
                  🛡️
                  {(mutedUsers.length + kickedUsers.length + blockedUsers.length) > 0 && (
                    <span className="liveme-mod-badge">{mutedUsers.length + kickedUsers.length + blockedUsers.length}</span>
                  )}
                </button>

                {/* 4. Flip Camera Front/Back */}
                <button
                  type="button"
                  className="liveme-tool-btn"
                  onClick={handleFlipCamera}
                  title="Flip Camera (Front/Back)"
                >
                  🔄
                </button>

                {/* 5. Mirror Angle Reflection */}
                <button
                  type="button"
                  className={`liveme-tool-btn ${isMirrored ? 'active' : ''}`}
                  onClick={handleToggleMirror}
                  title="Toggle Mirror Reflection for Best Angle"
                >
                  🪞
                </button>

                {/* 6. Mute Microphone */}
                <button
                  type="button"
                  className={`liveme-tool-btn ${isMicMuted ? 'danger' : ''}`}
                  onClick={handleToggleMic}
                  title={isMicMuted ? "Unmute Mic" : `Mute Mic (Mic Level: ${micAudioLevel}%)`}
                >
                  {isMicMuted ? '🔇' : '🎙️'}
                </button>

                {/* 7. Toggle Video Camera */}
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
