import React, { useState, useRef, useEffect, useCallback } from 'react';
import './camera.css';
import {
  CameraMode,
  DurationMode,
  CameraFilter,
  ARSticker,
  SoundTrack,
  CapturedMedia,
  PRESET_SOUNDS,
  FILTER_PRESETS,
} from './cameraTypes';
import {
  playShutterSound,
  playCountdownBeep,
  playRecordStartSound,
  playRecordStopSound,
  playGoLiveFanfare,
} from './cameraSounds';
import {
  IconCameraFlip,
  IconCameraEnhance,
  IconCameraEffects,
  IconCameraSettings,
  IconCameraMultiGuest,
  IconCameraBusiness,
  IconCameraServicePlus,
  IconCameraFanClub,
  IconCameraInteract,
  IconCameraShare,
  IconCameraPromote,
  IconCameraSpeedStar,
  IconCameraBeautySmiley,
  IconCameraTimer,
  IconCameraGrid,
  IconCameraDual,
  IconCameraChevronDown,
  IconLiveGoalTarget,
  IconVoiceChatHandset,
  IconDeviceCameraVideo,
  IconLockManagement,
} from './CameraIcons';
import { IconX } from '../components/Icons';

export interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    name: string;
    handle: string;
    avatar: string;
    isVerified?: boolean;
    followersCount?: number;
  };
  onPublishPost: (postData: {
    caption: string;
    mediaUrl?: string | null;
    mediaType?: 'photo' | 'video';
    tags: string;
    privacy: 'close_friends' | 'followers' | 'public';
    soundName?: string;
    targetDestination?: 'feed' | 'story';
  }) => void;
  onGoLive: (liveData: {
    title: string;
    category: string;
    goal: string;
    cameraStream?: MediaStream | null;
  }) => void;
  initialTab?: CameraMode;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPublishPost,
  onGoLive,
  initialTab,
}) => {
  // Navigation Modes
  const [activeTab, setActiveTab] = useState<CameraMode>(initialTab || 'POST');
  const [durationMode, setDurationMode] = useState<DurationMode>('PHOTO');

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Media Stream & Camera Hardware State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const isAcquiringCameraRef = useRef<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Tools & Overlays
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);
  const [isGridActive, setIsGridActive] = useState<boolean>(false);
  const [isDualPipActive, setIsDualPipActive] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<CameraFilter>('none');
  const [activeArSticker, setActiveArSticker] = useState<ARSticker>('none');
  const [timerSeconds, setTimerSeconds] = useState<0 | 3 | 10>(0);
  const [recordingSpeed, setRecordingSpeed] = useState<'0.5x' | '1x' | '2x' | '3x'>('1x');

  // Audio / Sound Track
  const [selectedSound, setSelectedSound] = useState<SoundTrack | null>(null);
  const [isSoundDrawerOpen, setIsSoundDrawerOpen] = useState<boolean>(false);

  // Interactive Live Tool Drawers
  const [activeLiveDrawer, setActiveLiveDrawer] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Countdown & Flash Screen Animation State
  const [countdownCurrent, setCountdownCurrent] = useState<number | null>(null);
  const [showFlashOverlay, setShowFlashOverlay] = useState<boolean>(false);

  // Video Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerIntervalRef = useRef<any>(null);

  // Captured Media & Post Review State
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
  const [reviewCaption, setReviewCaption] = useState<string>('');
  const [reviewTags, setReviewTags] = useState<string>('#privity #moments');
  const [reviewPrivacy, setReviewPrivacy] = useState<'close_friends' | 'followers' | 'public'>('public');

  // Text Creator Mode State
  const [storyText, setStoryText] = useState<string>('');
  const [storyBgIndex, setStoryBgIndex] = useState<number>(0);
  const STORY_GRADIENTS = [
    'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
    'linear-gradient(135deg, #00f0ff 0%, #3b82f6 100%)',
    'linear-gradient(135deg, #10b981 0%, #064e3b 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #4338ca 100%)',
    'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  ];

  // LIVE Mode Setup State (Screenshot 2)
  const [liveTitle, setLiveTitle] = useState<string>('Live Chill & Sparks PK Battle 🔥');
  const [liveGoal, setLiveGoal] = useState<string>('🎯 Goal: 1,000 Sparks');
  const [isQuestBannerVisible, setIsQuestBannerVisible] = useState<boolean>(true);
  const [liveSubMode, setLiveSubMode] = useState<'voice' | 'device' | 'management'>('device');
  const [liveCountDown, setLiveCountDown] = useState<number | null>(null);

  // File Input for Device Gallery Pick
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Callback ref for camera video element to guarantee immediate stream binding without glitchy reloads
  const bindVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && mediaStreamRef.current) {
      if (node.srcObject !== mediaStreamRef.current) {
        node.srcObject = mediaStreamRef.current;
      }
      node.setAttribute('playsinline', 'true');
      node.setAttribute('webkit-playsinline', 'true');
      node.muted = true;
      node.play().catch(() => {});
    }
  }, []);

  // Start real camera stream via getUserMedia with mobile-first multi-tier fallback
  const startCameraStream = useCallback(async (targetFacing: 'user' | 'environment' = 'user') => {
    if (isAcquiringCameraRef.current) return;
    isAcquiringCameraRef.current = true;
    try {
      setCameraError(null);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        let stream: MediaStream | null = null;

        // Tier 1: Front / Target facing mode with video (audio false avoids iOS Safari permission blockage on preview)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: targetFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (tier1Err) {
          console.warn('Tier 1 camera failed, trying soft facing constraint:', tier1Err);
          try {
            // Tier 2: Soft facingMode constraint without rigid aspect constraints
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: targetFacing },
              },
              audio: false,
            });
          } catch (tier2Err) {
            console.warn('Tier 2 facingMode failed, enumerating devices for front camera:', tier2Err);
            try {
              const devices = await navigator.mediaDevices.enumerateDevices();
              const videoInputs = devices.filter((d) => d.kind === 'videoinput');
              const isTargetUser = targetFacing === 'user';
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
              console.warn('Tier 3 deviceId failed, falling back to generic video:', tier3Err);
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
              });
            }
          }
        }

        if (stream) {
          mediaStreamRef.current = stream;
          setIsCameraActive(true);

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

          if (videoRef.current) {
            if (videoRef.current.srcObject !== stream) {
              videoRef.current.srcObject = stream;
            }
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.setAttribute('webkit-playsinline', 'true');
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        }
      } else {
        setIsCameraActive(false);
        setCameraError('Camera API not supported on this device');
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setIsCameraActive(false);
      setCameraError('Camera permission needed. Tap to enable');
    } finally {
      isAcquiringCameraRef.current = false;
    }
  }, []);

  // Manage camera lifecycle
  useEffect(() => {
    if (isOpen) {
      startCameraStream(cameraFacing);
    } else {
      stopCameraStream();
      setCapturedMedia(null);
      setIsRecording(false);
      setRecordedDuration(0);
      setCountdownCurrent(null);
      setLiveCountDown(null);
      setActiveLiveDrawer(null);
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, startCameraStream, stopCameraStream]);

  // Flip Camera between Front & Back
  const handleFlipCamera = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    setIsMirrored(nextFacing === 'user');
    startCameraStream(nextFacing);
    showToast(nextFacing === 'user' ? 'Front camera 🤳' : 'Back camera 📷');
  };

  // Toggle Horizontal Mirror / Good Angle Reflection
  const handleToggleMirror = () => {
    setIsMirrored((prev) => {
      const next = !prev;
      showToast(next ? 'Mirror angle ON 🪞 (Selfie reflection)' : 'True view ON (Standard angle)');
      return next;
    });
  };

  // Flashbang animation
  const triggerFlash = () => {
    setShowFlashOverlay(true);
    setTimeout(() => setShowFlashOverlay(false), 320);
  };

  // Real Photo Capture
  const takePhotoSnapshot = () => {
    playShutterSound();
    triggerFlash();

    let dataUrl = '';
    const video = videoRef.current;

    if (video && isCameraActive && video.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      let w = video.videoWidth;
      let h = video.videoHeight;
      const maxDim = 640;
      if (w > h && w > maxDim) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else if (h > maxDim) {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        const selectedPreset = FILTER_PRESETS.find((f) => f.id === activeFilter);
        if (selectedPreset && selectedPreset.filterStyle !== 'none') {
          ctx.filter = selectedPreset.filterStyle;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.58);
      }
    }

    if (!dataUrl) {
      dataUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900';
    }

    setCapturedMedia({
      type: 'photo',
      dataUrl,
    });
    setReviewCaption('');
  };

  // Start Real Video Recording
  const startVideoRecording = () => {
    recordedChunksRef.current = [];
    playRecordStartSound();

    if (mediaStreamRef.current && typeof MediaRecorder !== 'undefined') {
      try {
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';

        const recorder = new MediaRecorder(mediaStreamRef.current, {
          mimeType,
          videoBitsPerSecond: 240000,
        });

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            const videoDataUrl = (reader.result as string) || URL.createObjectURL(blob);
            setCapturedMedia({
              type: 'video',
              dataUrl: videoDataUrl,
              blob,
            });
          };
          reader.readAsDataURL(blob);
        };

        mediaRecorderRef.current = recorder;
        recorder.start(250);
      } catch (e) {
        console.warn('MediaRecorder error:', e);
      }
    }

    setIsRecording(true);
    setRecordedDuration(0);

    const maxSeconds = durationMode === '15s' ? 15 : durationMode === '60s' ? 60 : 600;

    recordingTimerIntervalRef.current = setInterval(() => {
      setRecordedDuration((prev) => {
        const next = prev + 1;
        if (next >= maxSeconds) {
          stopVideoRecording();
        }
        return next;
      });
    }, 1000);
  };

  // Stop Video Recording
  const stopVideoRecording = () => {
    if (recordingTimerIntervalRef.current) {
      clearInterval(recordingTimerIntervalRef.current);
      recordingTimerIntervalRef.current = null;
    }

    playRecordStopSound();
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      setCapturedMedia({
        type: 'video',
        dataUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-talking-on-a-video-call-42996-large.mp4',
      });
    }
  };

  // Shutter Click Handler
  const handleShutterClick = () => {
    if (timerSeconds > 0 && countdownCurrent === null && !isRecording) {
      let count = timerSeconds;
      setCountdownCurrent(count);
      playCountdownBeep(false);

      const interval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdownCurrent(count);
          playCountdownBeep(false);
        } else {
          clearInterval(interval);
          setCountdownCurrent(null);
          playCountdownBeep(true);
          executeCaptureAction();
        }
      }, 1000);
    } else {
      executeCaptureAction();
    }
  };

  // Execute Capture Action
  const executeCaptureAction = () => {
    if (durationMode === 'PHOTO') {
      takePhotoSnapshot();
    } else if (durationMode === 'TEXT') {
      setActiveTab('CREATE');
    } else {
      if (isRecording) {
        stopVideoRecording();
      } else {
        startVideoRecording();
      }
    }
  };

  // Gallery File Picker Handler
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video');
      if (isVideo) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setCapturedMedia({
            type: 'video',
            dataUrl: result,
          });
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const raw = event.target?.result as string;
          if (!raw) return;
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            const maxDim = 640;
            if (w > h && w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              setCapturedMedia({
                type: 'photo',
                dataUrl: canvas.toDataURL('image/jpeg', 0.58),
              });
            } else {
              setCapturedMedia({
                type: 'photo',
                dataUrl: raw,
              });
            }
          };
          img.src = raw;
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Publish from Review Screen
  const handlePublishReview = () => {
    if (!capturedMedia) return;

    onPublishPost({
      caption: reviewCaption.trim() || 'Shared via Privity Studio 📸',
      mediaUrl: capturedMedia.dataUrl,
      mediaType: capturedMedia.type,
      tags: reviewTags,
      privacy: reviewPrivacy,
      soundName: selectedSound ? `${selectedSound.name} - ${selectedSound.artist}` : undefined,
      targetDestination: (activeTab === 'STORY' || activeTab === 'CREATE') ? 'story' : 'feed',
    });

    onClose();
  };

  // Publish Text Story
  const handlePublishStory = () => {
    if (!storyText.trim()) return;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 1136;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(1, '#ec4899');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const lines = storyText.split('\n');
      lines.forEach((line, idx) => {
        ctx.fillText(line, canvas.width / 2, canvas.height / 2 - (lines.length * 20) + idx * 48);
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.58);
      onPublishPost({
        caption: storyText,
        mediaUrl: dataUrl,
        mediaType: 'photo',
        tags: '#privity #story',
        privacy: 'public',
        targetDestination: 'story',
      });
    }

    onClose();
  };

  // Go LIVE Click Handler (Screenshot 2)
  const handleInitiateGoLive = () => {
    playGoLiveFanfare();
    setLiveCountDown(3);

    let count = 3;
    const countdown = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setLiveCountDown(count);
        playCountdownBeep(false);
      } else {
        clearInterval(countdown);
        setLiveCountDown(null);
        playCountdownBeep(true);
        const liveStreamToHandOver = mediaStreamRef.current;
        // Detach stream reference so stopCameraStream won't kill active tracks during handover
        mediaStreamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        onGoLive({
          title: liveTitle.trim() || 'Live Broadcast · Sovereign Node',
          category: 'Visionary Host',
          goal: liveGoal,
          cameraStream: liveStreamToHandOver,
        });
        onClose();
      }
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="camera-studio-overlay">
      <div className="camera-studio-viewport">
        {/* Hidden File Input for Device Gallery Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleGalleryUpload}
        />

        {/* Floating Quick Toast Notification */}
        {toastMessage && (
          <div style={{
            position: 'absolute',
            top: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '7px 18px',
            borderRadius: 20,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            zIndex: 100,
            backdropFilter: 'blur(10px)',
          }}>
            {toastMessage}
          </div>
        )}

        {/* 1. CAMERA VIDEO SURFACE (Hardware Camera with zero-flicker binding) */}
        <video
          ref={bindVideoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }}
          className={`camera-video-surface ${isMirrored ? 'mirrored' : ''}`}
          style={{
            filter: FILTER_PRESETS.find((f) => f.id === activeFilter)?.filterStyle || 'none',
            display: isCameraActive ? 'block' : 'none',
          }}
        />

        {!isCameraActive && (
          <div className="camera-viewfinder-backdrop">
            <div className="camera-lens-aperture-pulse">
              <IconDeviceCameraVideo size={42} color="rgba(255,255,255,0.7)" />
              <div className="camera-loading-ring" />
            </div>
            {cameraError ? (
              <button className="camera-sim-badge" onClick={() => startCameraStream(cameraFacing)} title="Tap to start camera">
                <span className="camera-sim-dot" />
                <span>{cameraError}</span>
              </button>
            ) : (
              <div className="camera-init-text">Starting Camera...</div>
            )}
          </div>
        )}

        {/* 2. OVERLAYS: 3x3 Grid, Torch Glow, Flashbang, PIP, AR Reticles */}
        {isGridActive && (
          <div className="camera-grid-overlay">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="camera-grid-cell" />
            ))}
          </div>
        )}

        {isFlashActive && <div className="camera-torch-glow" />}
        {showFlashOverlay && <div className="camera-flash-overlay" />}

        {isDualPipActive && (
          <div className="camera-pip-preview">
            <video
              src="https://assets.mixkit.co/videos/preview/mixkit-woman-talking-on-a-video-call-with-her-laptop-42998-large.mp4"
              autoPlay
              loop
              muted
              playsInline
            />
          </div>
        )}

        {activeArSticker === 'hud' && (
          <div className="camera-ar-hud-overlay">
            <div className="ar-reticle-circle">
              <span className="ar-corner tl" />
              <span className="ar-corner tr" />
              <span className="ar-corner bl" />
              <span className="ar-corner br" />
              <div className="ar-hud-label">AI VISION · TARGET LOCKED</div>
            </div>
          </div>
        )}

        {activeArSticker === 'stars' && (
          <div className="camera-ar-hud-overlay" style={{ fontSize: '42px', animation: 'countdownPulse 2s infinite' }}>
            ✨ ⭐ ✨
          </div>
        )}

        {activeArSticker === 'glasses' && (
          <div className="camera-ar-hud-overlay" style={{ fontSize: '64px', marginTop: '-60px' }}>
            🕶️
          </div>
        )}

        {/* Countdown Overlay (3, 2, 1) */}
        {countdownCurrent !== null && (
          <div className="camera-countdown-overlay">
            <span className="camera-countdown-number">{countdownCurrent}</span>
          </div>
        )}

        {/* Go Live Countdown Overlay */}
        {liveCountDown !== null && (
          <div className="camera-countdown-overlay" style={{ background: 'rgba(0,0,0,0.88)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#ff2b54', marginBottom: '12px' }}>
                GOING LIVE IN
              </div>
              <span className="camera-countdown-number">{liveCountDown}</span>
            </div>
          </div>
        )}

        {/* Active Recording Pill with Blinking Dot */}
        {isRecording && (
          <div className="camera-recording-timer-pill">
            <span className="recording-dot-blink" />
            <span>
              {String(Math.floor(recordedDuration / 60)).padStart(2, '0')}:
              {String(recordedDuration % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* ================================================================ */}
        {/* TOP BAR: TikTok layout                                           */}
        {/* ================================================================ */}
        <header className="camera-top-bar">
          <button className="camera-close-btn" onClick={onClose} title="Close Camera">
            <IconX size={24} />
          </button>

          {activeTab === 'LIVE' ? (
            /* Screenshot 2 Top Badges: Est. $0.19, Shield 6, Room */
            <div className="camera-live-top-right">
              <div
                className="live-est-earnings-pill"
                onClick={() => setActiveLiveDrawer('business')}
                title="Creator Estimated Sparks Earnings"
              >
                <span>⏱</span>
                <span>Est. $0.19</span>
              </div>
              <div
                className="live-badge-square"
                onClick={() => setActiveLiveDrawer('fanclub')}
                title="Level 6 Verified Creator Badge"
              >
                <span>🛡 6</span>
              </div>
              <div
                className="live-badge-square"
                onClick={() => setActiveLiveDrawer('settings')}
                title="Broadcast Studio Settings"
              >
                <span>⌂</span>
              </div>
            </div>
          ) : (
            /* Screenshot 1 Sound Pill Button */
            <button
              className="camera-sound-pill-btn"
              onClick={() => setIsSoundDrawerOpen(true)}
              title="Add background music or sound"
            >
              <span>🎵</span>
              <span className="camera-sound-title-marquee">
                {selectedSound ? selectedSound.name : 'Add sound'}
              </span>
            </button>
          )}

          {activeTab !== 'LIVE' && (
            <button
              type="button"
              className="camera-header-live-btn"
              onClick={() => setActiveTab('LIVE')}
              title="Switch to Live Broadcast Studio"
            >
              🔴 LIVE
            </button>
          )}
        </header>

        {/* ================================================================ */}
        {/* VERTICAL RIGHT TOOLS RAIL (SCREENSHOT 1) - PURE VECTOR ICONS    */}
        {/* ================================================================ */}
        {activeTab !== 'LIVE' && (
          <aside className="camera-tools-rail">
            {/* 1. Flip Camera (Front / Back) */}
            <button className="camera-tool-item" onClick={handleFlipCamera} title="Flip camera front/back">
              <div className="camera-tool-icon-circle">
                <IconCameraFlip size={28} />
              </div>
              <span className="camera-tool-label">{cameraFacing === 'user' ? 'Front' : 'Back'}</span>
            </button>

            {/* 2. Mirror Angle Toggle (Facing My Good Angle) */}
            <button
              className={`camera-tool-item ${isMirrored ? 'active' : ''}`}
              onClick={handleToggleMirror}
              title="Toggle mirror reflection for best selfie angle"
            >
              <div className="camera-tool-icon-circle" style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}>
                <IconCameraFlip size={26} />
              </div>
              <span className="camera-tool-label">{isMirrored ? 'Mirrored' : 'True View'}</span>
            </button>

            {/* 2. Speed / Star */}
            <button
              className="camera-tool-item"
              onClick={() => {
                const speeds: ('0.5x' | '1x' | '2x' | '3x')[] = ['1x', '2x', '3x', '0.5x'];
                const nextSpeed = speeds[(speeds.indexOf(recordingSpeed) + 1) % speeds.length];
                setRecordingSpeed(nextSpeed);
                showToast(`Speed: ${nextSpeed}`);
              }}
              title="Speed"
            >
              <div className="camera-tool-icon-circle">
                <IconCameraSpeedStar size={26} />
              </div>
              <span className="camera-tool-label">{recordingSpeed}</span>
            </button>

            {/* 3. Beauty / Enhance (Smiley with cheek sparkle) */}
            <button
              className={`camera-tool-item ${activeFilter !== 'none' ? 'active' : ''}`}
              onClick={() => {
                const filters: CameraFilter[] = ['none', 'golden', 'vivid', 'cyberpunk', 'noir', 'vhs', 'emerald'];
                const nextIdx = (filters.indexOf(activeFilter) + 1) % filters.length;
                setActiveFilter(filters[nextIdx]);
                const filterObj = FILTER_PRESETS.find((f) => f.id === filters[nextIdx]);
                showToast(`Filter: ${filterObj?.label || 'Normal'}`);
              }}
              title="Enhance & Beauty filter"
            >
              <div className="camera-tool-icon-circle">
                <IconCameraBeautySmiley size={26} />
              </div>
              <span className="camera-tool-label">Enhance</span>
            </button>

            {/* 4. Timer (Off -> 3s -> 10s) */}
            <button
              className={`camera-tool-item ${timerSeconds > 0 ? 'active' : ''}`}
              onClick={() => {
                setTimerSeconds((prev) => (prev === 0 ? 3 : prev === 3 ? 10 : 0));
                showToast(timerSeconds === 0 ? 'Timer: 3s' : timerSeconds === 3 ? 'Timer: 10s' : 'Timer: Off');
              }}
              title="Countdown timer"
            >
              <div className="camera-tool-icon-circle">
                <IconCameraTimer size={26} />
              </div>
              <span className="camera-tool-label">{timerSeconds > 0 ? `${timerSeconds}s` : 'Timer'}</span>
            </button>

            {/* 5. 3x3 Grid */}
            <button
              className={`camera-tool-item ${isGridActive ? 'active' : ''}`}
              onClick={() => {
                setIsGridActive(!isGridActive);
                showToast(isGridActive ? 'Grid off' : 'Grid on');
              }}
              title="Rule-of-thirds grid"
            >
              <div className="camera-tool-icon-circle">
                <IconCameraGrid size={26} />
              </div>
              <span className="camera-tool-label">Grid</span>
            </button>

            {/* 6. Dual PIP */}
            <button
              className={`camera-tool-item ${isDualPipActive ? 'active' : ''}`}
              onClick={() => {
                setIsDualPipActive(!isDualPipActive);
                showToast(isDualPipActive ? 'Dual PIP off' : 'Dual PIP on');
              }}
              title="Dual PIP camera"
            >
              <div className="camera-tool-icon-circle">
                <IconCameraDual size={26} />
              </div>
              <span className="camera-tool-label">Dual</span>
            </button>

            {/* 7. Flash Torch */}
            <button
              className={`camera-tool-item ${isFlashActive ? 'active' : ''}`}
              onClick={() => {
                setIsFlashActive(!isFlashActive);
                showToast(isFlashActive ? 'Flash off' : 'Flash torch on');
              }}
              title="Screen Torch Flash"
            >
              <div className="camera-tool-icon-circle">
                <IconCameraChevronDown size={24} />
              </div>
              <span className="camera-tool-label">Flash</span>
            </button>
          </aside>
        )}

        {/* ================================================================ */}
        {/* SCREENSHOT 2: LIVE BROADCAST SETUP VIEW                          */}
        {/* 100% PURE VECTOR ICONS - ZERO BACKGROUND BUBBLES                */}
        {/* ================================================================ */}
        {activeTab === 'LIVE' && (
          <div className="camera-live-setup-container">
            {/* Treasure Quest Banner */}
            {isQuestBannerVisible && (
              <div className="live-quest-banner">
                <div className="live-quest-left">
                  <span className="live-quest-hammer-icon">🔨</span>
                  <span className="live-quest-title">Treasure Quest: Engage & Earn</span>
                </div>
                <button
                  className="live-quest-close-btn"
                  onClick={() => setIsQuestBannerVisible(false)}
                  title="Dismiss banner"
                >
                  <IconX size={16} />
                </button>
              </div>
            )}

            {/* Chevron expander above grid (Screenshot 2) */}
            <div className="live-grid-chevron-wrap">
              <IconCameraChevronDown size={22} color="rgba(255,255,255,0.7)" />
            </div>

            {/* 2-Row Tools Grid: Pure Vector Icons without background boxes */}
            <div className="live-tools-grid">
              {/* Row 1 */}
              <button className="live-tool-grid-item" onClick={handleFlipCamera} title="Flip camera">
                <div className="live-tool-grid-icon">
                  <IconCameraFlip size={30} />
                </div>
                <span className="live-tool-grid-label">Flip</span>
              </button>

              <button
                className="live-tool-grid-item"
                onClick={() => {
                  const filters: CameraFilter[] = ['none', 'golden', 'vivid', 'cyberpunk'];
                  const next = filters[(filters.indexOf(activeFilter) + 1) % filters.length];
                  setActiveFilter(next);
                  showToast(`Enhance: ${next}`);
                }}
                title="Enhance face & lighting"
              >
                <div className="live-tool-grid-icon">
                  <IconCameraEnhance size={30} />
                </div>
                <span className="live-tool-grid-label">Enhance</span>
              </button>

              <button
                className="live-tool-grid-item"
                onClick={() => {
                  const effects: ARSticker[] = ['none', 'hud', 'stars', 'glasses'];
                  const next = effects[(effects.indexOf(activeArSticker) + 1) % effects.length];
                  setActiveArSticker(next);
                  showToast(`Effect: ${next}`);
                }}
                title="AR broadcast effects"
              >
                <div className="live-tool-grid-icon">
                  <IconCameraEffects size={30} />
                </div>
                <span className="live-tool-grid-label">Effects</span>
              </button>

              <button
                className="live-tool-grid-item"
                onClick={() => setActiveLiveDrawer('settings')}
                title="Broadcast Settings"
              >
                <div className="live-tool-grid-icon">
                  <IconCameraSettings size={30} hasBadge={true} />
                </div>
                <span className="live-tool-grid-label">Settings</span>
              </button>

              <button
                className="live-tool-grid-item"
                onClick={() => setActiveLiveDrawer('multiguest')}
                title="Invite Multi-guest co-hosts"
              >
                <div className="live-tool-grid-icon">
                  <IconCameraMultiGuest size={30} />
                </div>
                <span className="live-tool-grid-label">Multi-guest</span>
              </button>

              {/* Row 2 */}
              <button
                className="live-tool-grid-item"
                onClick={() => setActiveLiveDrawer('business')}
                title="Business & Creator monetization"
              >
                <div className="live-tool-grid-icon">
                  <IconCameraBusiness size={30} />
                </div>
                <span className="live-tool-grid-label">Business</span>
              </button>

              <button
                className="live-tool-grid-item"
                onClick={() => {
                  showToast('Service+ Subscriber Perks active');
                }}
                title="Service+ VIP Perks"
              >
                <div className="live-tool-grid-icon">
                  <IconCameraServicePlus size={30} />
                </div>
                <span className="live-tool-grid-label">Service+</span>
              </button>

              <button
                className="live-tool-grid-item"
                onClick={() => setActiveLiveDrawer('fanclub')}
                title="Fan Club management"
              >
                <div className="live-tool-grid-icon">
                  <IconCameraFanClub size={30} />
                </div>
                <span className="live-tool-grid-label">Fan Club</span>
              </button>

              <button
                className="live-tool-grid-item"
                onClick={() => setActiveLiveDrawer('interact')}
                title="Interactive games & polls"
              >
                <div className="live-tool-grid-icon">
                  <IconCameraInteract size={30} />
                </div>
                <span className="live-tool-grid-label">Interact</span>
              </button>

              <button
                className="live-tool-grid-item"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(`https://privity.app/live/${currentUser.handle}`);
                  }
                  showToast('Live stream link copied to clipboard!');
                }}
                title="Share stream link"
              >
                <div className="live-tool-grid-icon">
                  <IconCameraShare size={30} />
                </div>
                <span className="live-tool-grid-label">Share</span>
              </button>

              {/* Row 3 (Promote) */}
              <button
                className="live-tool-grid-item"
                onClick={() => setActiveLiveDrawer('promote')}
                title="Promote live stream"
              >
                <div className="live-tool-grid-icon">
                  <IconCameraPromote size={30} />
                </div>
                <span className="live-tool-grid-label">Promote</span>
              </button>
            </div>

            {/* Bottom Live Setup Card (Screenshot 2: Avatar, Title, Goal, Go LIVE button) */}
            <div>
              <div className="live-bottom-card">
                <div className="live-bottom-card-header">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="live-creator-avatar"
                  />
                  <input
                    type="text"
                    value={liveTitle}
                    onChange={(e) => setLiveTitle(e.target.value)}
                    placeholder="Add a title"
                    className="live-title-input"
                  />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>|</span>
                  <button
                    className="live-goal-pill-btn"
                    onClick={() => {
                      const goals = ['🎯 LIVE goal', '🎯 500 Roses', '🎯 1,000 Sparks', '🎯 1 Dragon 🔥'];
                      const next = goals[(goals.indexOf(liveGoal) + 1) % goals.length];
                      setLiveGoal(next);
                      showToast(`Live Goal updated: ${next}`);
                    }}
                    title="Tap to change goal"
                  >
                    <IconLiveGoalTarget size={16} />
                    <span>{liveGoal}</span>
                  </button>
                </div>

                {/* Master Go LIVE Button (Screenshot 2: #ff2b54 pill button) */}
                <button className="btn-go-live-master" onClick={handleInitiateGoLive}>
                  <span>Go LIVE</span>
                </button>

                {/* Sub-modes Row below Go LIVE: Voice chat, Device camera, LIVE Management */}
                <div className="live-submodes-row">
                  <button
                    className={`live-submode-btn ${liveSubMode === 'voice' ? 'active' : ''}`}
                    onClick={() => {
                      setLiveSubMode('voice');
                      showToast('Switched to Voice chat broadcast');
                    }}
                  >
                    <IconVoiceChatHandset size={15} />
                    <span>Voice chat</span>
                  </button>
                  <button
                    className={`live-submode-btn ${liveSubMode === 'device' ? 'active' : ''}`}
                    onClick={() => {
                      setLiveSubMode('device');
                      showToast('Device camera active');
                    }}
                  >
                    <span className="live-submode-dot" />
                    <IconDeviceCameraVideo size={16} />
                    <span>Device camera</span>
                  </button>
                  <button
                    className={`live-submode-btn ${liveSubMode === 'management' ? 'active' : ''}`}
                    onClick={() => {
                      setLiveSubMode('management');
                      setActiveLiveDrawer('settings');
                    }}
                  >
                    <IconLockManagement size={15} />
                    <span>LIVE Management</span>
                  </button>
                </div>
              </div>

              {/* Bottom Navigation Tabs */}
              <div className="camera-bottom-tabs-row" style={{ justifyContent: 'center' }}>
                <div className="camera-modes-center-bar">
                  <button
                    className="camera-mode-nav-btn"
                    onClick={() => {
                      setActiveTab('POST');
                      setDurationMode('PHOTO');
                    }}
                  >
                    POST
                  </button>
                  <button
                    className="camera-mode-nav-btn"
                    onClick={() => {
                      setActiveTab('CREATE');
                      setDurationMode('TEXT');
                    }}
                  >
                    CREATE
                  </button>
                  <button className="camera-mode-nav-btn active">
                    LIVE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* SCREENSHOT 1: POST / CAMERA DECK (Shutter, Duration, Tabs)       */}
        {/* ================================================================ */}
        {activeTab === 'POST' && (
          <div className="camera-bottom-deck">
            {/* Submode Duration Slider: 10m, 60s, 15s, PHOTO, TEXT, 🔴 LIVE */}
            <div className="camera-duration-selector">
              {(['10m', '60s', '15s', 'PHOTO', 'TEXT'] as DurationMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`camera-duration-tab ${durationMode === mode ? 'active' : ''}`}
                  onClick={() => setDurationMode(mode)}
                >
                  {mode}
                </button>
              ))}
              <button
                type="button"
                className="camera-duration-tab live-mode-tab"
                onClick={() => setActiveTab('LIVE')}
                title="Go Live Broadcast"
              >
                🔴 LIVE
              </button>
            </div>

            {/* Shutter Controls Row */}
            <div className="camera-shutter-row">
              {/* Left AR Filter Quick Preview */}
              <button
                className="camera-side-accessory-btn"
                onClick={() => {
                  const effects: ARSticker[] = ['none', 'hud', 'stars', 'glasses'];
                  const next = effects[(effects.indexOf(activeArSticker) + 1) % effects.length];
                  setActiveArSticker(next);
                  showToast(`Effect: ${next}`);
                }}
                title="Toggle AR Effect"
              >
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"
                  alt="Effects"
                />
              </button>

              {/* Master Shutter Button (Circular Photo vs Red Video) */}
              <button
                className={`camera-shutter-master-btn ${
                  durationMode !== 'PHOTO' ? 'video-mode' : ''
                } ${isRecording ? 'recording' : ''}`}
                onClick={handleShutterClick}
                title={
                  durationMode === 'PHOTO'
                    ? 'Take photo'
                    : isRecording
                    ? 'Stop recording'
                    : 'Start recording'
                }
              >
                {/* SVG Progress Ring during Recording */}
                {isRecording && (
                  <svg className="camera-record-progress-ring">
                    <circle
                      cx="45"
                      cy="45"
                      r="41"
                      style={{
                        strokeDasharray: 257.6,
                        strokeDashoffset:
                          257.6 -
                          (257.6 * recordedDuration) /
                            (durationMode === '15s' ? 15 : durationMode === '60s' ? 60 : 600),
                      }}
                    />
                  </svg>
                )}
                <div className="camera-shutter-inner-orb" />
              </button>

              {/* Right AR Sticker Carousel Pill */}
              <button
                className="camera-side-accessory-btn"
                onClick={() => {
                  const filters: CameraFilter[] = ['none', 'cyberpunk', 'golden', 'vivid', 'noir'];
                  const next = filters[(filters.indexOf(activeFilter) + 1) % filters.length];
                  setActiveFilter(next);
                  showToast(`Filter: ${next}`);
                }}
                title="Cycle Filter Preset"
              >
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100"
                  alt="Filters"
                />
              </button>
            </div>

            {/* Bottom Tab Bar (Gallery, POST, CREATE, LIVE) */}
            <div className="camera-bottom-tabs-row">
              {/* Gallery Upload from Device Thumbnail */}
              <button
                className="camera-gallery-picker-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload Photo or Video from Device"
              >
                <div className="camera-gallery-thumb-box">
                  <img
                    src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100"
                    alt="Device Gallery"
                  />
                </div>
              </button>

              {/* Center Mode Tabs */}
              <div className="camera-modes-center-bar">
                <button className="camera-mode-nav-btn active">POST</button>
                <button
                  className="camera-mode-nav-btn"
                  onClick={() => {
                    setActiveTab('CREATE');
                    setDurationMode('TEXT');
                  }}
                >
                  CREATE
                </button>
                <button
                  className="camera-mode-nav-btn"
                  onClick={() => {
                    setActiveTab('LIVE');
                  }}
                >
                  LIVE
                </button>
              </div>

              {/* Right Spacer for balance */}
              <div style={{ width: '36px' }} />
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* CREATE TAB: STORY & TEXT CREATOR                                 */}
        {/* ================================================================ */}
        {activeTab === 'CREATE' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 15,
              background: STORY_GRADIENTS[storyBgIndex],
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '70px 20px 30px',
              transition: 'background 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {STORY_GRADIENTS.map((bg, idx) => (
                <button
                  key={idx}
                  onClick={() => setStoryBgIndex(idx)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: bg,
                    border: storyBgIndex === idx ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>

            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="Tap to type your story dispatch..."
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '28px',
                fontWeight: 700,
                textAlign: 'center',
                outline: 'none',
                resize: 'none',
                minHeight: '200px',
                fontFamily: 'inherit',
              }}
            />

            <div>
              <button
                className="camera-review-publish-btn"
                onClick={handlePublishStory}
                disabled={!storyText.trim()}
              >
                Share Story Dispatch
              </button>

              <div className="camera-bottom-tabs-row" style={{ justifyContent: 'center', marginTop: '16px' }}>
                <div className="camera-modes-center-bar">
                  <button
                    className="camera-mode-nav-btn"
                    onClick={() => {
                      setActiveTab('POST');
                      setDurationMode('PHOTO');
                    }}
                  >
                    POST
                  </button>
                  <button className="camera-mode-nav-btn active">CREATE</button>
                  <button
                    className="camera-mode-nav-btn"
                    onClick={() => {
                      setActiveTab('LIVE');
                    }}
                  >
                    LIVE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* REVIEW & PUBLISH SCREEN (After Snapshot or Recording)            */}
        {/* ================================================================ */}
        {capturedMedia && (
          <div className="camera-review-view">
            <div className="camera-review-top-bar">
              <button
                className="camera-close-btn"
                onClick={() => setCapturedMedia(null)}
                title="Discard & Retake"
              >
                <IconX size={18} />
              </button>
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#fff' }}>
                {capturedMedia.type === 'photo' ? 'Photo Preview' : 'Video Preview'}
              </span>
              <div style={{ width: '38px' }} />
            </div>

            <div className="camera-review-preview-box">
              {capturedMedia.type === 'photo' ? (
                <img
                  src={capturedMedia.dataUrl}
                  alt="Captured"
                  className="camera-review-preview-media"
                />
              ) : (
                <video
                  src={capturedMedia.dataUrl}
                  autoPlay
                  loop
                  controls
                  playsInline
                  className="camera-review-preview-media"
                />
              )}
            </div>

            <div className="camera-review-form-area">
              <textarea
                value={reviewCaption}
                onChange={(e) => setReviewCaption(e.target.value)}
                placeholder="What's on your mind? Add caption..."
                className="camera-review-caption-input"
              />

              <input
                type="text"
                value={reviewTags}
                onChange={(e) => setReviewTags(e.target.value)}
                placeholder="#tags"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  color: '#fff',
                  padding: '10px 14px',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />

              {/* Privacy Tier Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>
                  WHO CAN SEE THIS DISPATCH
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setReviewPrivacy('public')}
                    style={{
                      padding: '8px',
                      borderRadius: '10px',
                      background: reviewPrivacy === 'public' ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.05)',
                      border: reviewPrivacy === 'public' ? '1px solid #00f0ff' : '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🌐 Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewPrivacy('followers')}
                    style={{
                      padding: '8px',
                      borderRadius: '10px',
                      background: reviewPrivacy === 'followers' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                      border: reviewPrivacy === 'followers' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    👥 Followers
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewPrivacy('close_friends')}
                    style={{
                      padding: '8px',
                      borderRadius: '10px',
                      background: reviewPrivacy === 'close_friends' ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.05)',
                      border: reviewPrivacy === 'close_friends' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ⭐ Close Friends
                  </button>
                </div>
              </div>

              {selectedSound && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#00f0ff' }}>
                  <span>🎵</span>
                  <span>{selectedSound.name} — {selectedSound.artist}</span>
                </div>
              )}

              <button className="camera-review-publish-btn" onClick={handlePublishReview}>
                Publish Dispatch
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* INTERACTIVE DRAWERS FOR LIVE TOOLS                               */}
        {/* ================================================================ */}
        {activeLiveDrawer && (
          <div className="camera-tool-modal-drawer">
            <div className="camera-tool-modal-header">
              <span className="camera-tool-modal-title">
                {activeLiveDrawer === 'settings' && '⚙️ Broadcast Settings'}
                {activeLiveDrawer === 'multiguest' && '👥 Multi-Guest Connections'}
                {activeLiveDrawer === 'business' && '🛍️ Creator Business & Sparks'}
                {activeLiveDrawer === 'fanclub' && '🤍 Fan Club & Top Supporters'}
                {activeLiveDrawer === 'interact' && '💬 Live Interactions'}
                {activeLiveDrawer === 'promote' && '🔥 Promote & Boost Stream'}
              </span>
              <button
                className="camera-close-btn"
                style={{ width: 30, height: 30 }}
                onClick={() => setActiveLiveDrawer(null)}
              >
                <IconX size={16} />
              </button>
            </div>

            {activeLiveDrawer === 'settings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <span>Broadcast Quality</span>
                  <span style={{ color: '#00f0ff', fontWeight: 700 }}>1080p 60fps HD</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <span>Live Latency</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>Ultra-Low (0.3s)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <span>Cryptographic Channel</span>
                  <span style={{ color: '#ff2b54', fontWeight: 700 }}>AES-256-GCM E2E</span>
                </div>
              </div>
            )}

            {activeLiveDrawer === 'multiguest' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Elena Rodriguez', 'Marcus Vance', 'Julian Thorne', 'Chloe Vance'].map((guest, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{guest}</span>
                    <button
                      onClick={() => {
                        showToast(`Invited ${guest} as co-host`);
                        setActiveLiveDrawer(null);
                      }}
                      style={{ padding: '6px 14px', borderRadius: 14, background: '#ff2b54', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeLiveDrawer === 'business' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: '#fff', fontSize: 13 }}>
                <div style={{ padding: 14, background: 'linear-gradient(135deg, rgba(255,43,84,0.2), rgba(0,240,255,0.15))', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)' }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>TODAY'S EARNINGS (ESTIMATED)</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginTop: 4 }}>$24.50 USD</div>
                  <div style={{ fontSize: 12, color: '#00f0ff', marginTop: 2 }}>2,450 Sparks 🪙 · 70% Payout Rate</div>
                </div>
              </div>
            )}

            {activeLiveDrawer === 'fanclub' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: '#fff' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>FAN CLUB LEVEL 6 · 148 MEMBERS</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <span>⭐ Carlos (Fan #19)</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>VIP Supporter</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <span>⭐ TRIPLE</span>
                  <span style={{ color: '#00f0ff', fontWeight: 700 }}>Level 26 Fan</span>
                </div>
              </div>
            )}

            {activeLiveDrawer === 'interact' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  onClick={() => {
                    showToast('PK Battle Challenge staged!');
                    setActiveLiveDrawer(null);
                  }}
                  style={{ padding: 14, background: 'rgba(255,43,84,0.2)', border: '1px solid #ff2b54', borderRadius: 14, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  🥊 PK Battle Match
                </button>
                <button
                  onClick={() => {
                    showToast('Audience Poll opened in chat!');
                    setActiveLiveDrawer(null);
                  }}
                  style={{ padding: 14, background: 'rgba(0,240,255,0.2)', border: '1px solid #00f0ff', borderRadius: 14, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  📊 Audience Poll
                </button>
              </div>
            )}

            {activeLiveDrawer === 'promote' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: '#fff', fontSize: 13 }}>
                <div>Boost this broadcast to the top of the Discover feed for 100 Sparks.</div>
                <button
                  onClick={() => {
                    showToast('Stream promoted to #1 in Discover!');
                    setActiveLiveDrawer(null);
                  }}
                  style={{ padding: 12, background: 'linear-gradient(135deg, #ff2b54, #ff9500)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  Boost Now (100 Sparks)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* ADD SOUND SELECTION DRAWER                                       */}
        {/* ================================================================ */}
        {isSoundDrawerOpen && (
          <div className="camera-sound-drawer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>Add Sound to Dispatch</span>
              <button
                className="camera-close-btn"
                style={{ width: '32px', height: '32px' }}
                onClick={() => setIsSoundDrawerOpen(false)}
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="camera-sound-list">
              {PRESET_SOUNDS.map((snd) => (
                <div
                  key={snd.id}
                  className={`camera-sound-item ${selectedSound?.id === snd.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedSound(snd);
                    setIsSoundDrawerOpen(false);
                    showToast(`Sound: ${snd.name}`);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #6366f1, #00f0ff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '16px',
                      }}
                    >
                      🎵
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{snd.name}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                        {snd.artist} · {snd.genre}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                    {snd.duration}
                  </span>
                </div>
              ))}
            </div>

            {selectedSound && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSound(null);
                  setIsSoundDrawerOpen(false);
                }}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  padding: '10px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                Remove Current Sound
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
