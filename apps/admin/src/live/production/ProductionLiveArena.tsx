/**
 * Privity LIVE — Production Arena Screen.
 *
 * Mounts the complete Stage 1–5 HostStudio or ViewerLiveScreen with 100% feature parity
 * to the LIVE Lab simulator, connected to real production services, camera, and WebRTC streaming.
 */

import React, { useMemo, useEffect } from 'react';
import type { UserRef } from '../core/events';
import { HostStudio } from '../ui/HostStudio';
import { ViewerLiveScreen } from '../ui/ViewerLiveScreen';
import { EffectsController } from '../show/effects';
import { DeviceFilterPresetStore } from '../media/presetStore';
import { ProductionMediaTransport } from './ProductionMediaTransport';
import { createProductionLiveSession } from './ProductionLiveSession';
import type { LiveMeStreamer } from '../../components/liveme/types';
import '../design/tokens.css';
import '../design/motion.css';
import '../ui/live.css';
import '../battle/battle.css';
import '../moments/moments.css';

export interface ProductionLiveArenaProps {
  streamer: LiveMeStreamer;
  isHost: boolean;
  initialCoHostMode?: boolean;
  currentUser: {
    name: string;
    handle: string;
    avatar: string;
    id?: string;
  };
  userMediaStream?: MediaStream | null;
  userCoins: number;
  onCoinsChange: (delta: number) => void;
  showToast?: (msg: string) => void;
  onClose: (opts?: { wasEnded?: boolean; isHost?: boolean }) => void;
  onViewProfile?: (handle: string) => void;
}

export const ProductionLiveArena: React.FC<ProductionLiveArenaProps> = ({
  streamer,
  isHost,
  initialCoHostMode: _initialCoHostMode,
  currentUser,
  userMediaStream,
  userCoins: _userCoins,
  onCoinsChange,
  showToast: _showToast,
  onClose,
  onViewProfile: _onViewProfile,
}) => {
  const onCoinsChangeRef = React.useRef(onCoinsChange);
  onCoinsChangeRef.current = onCoinsChange;
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  const cleanMyHandle = (currentUser.handle || 'user').replace(/^@/, '').toLowerCase().trim();
  const myId = currentUser.id || cleanMyHandle;
  const me: UserRef = useMemo(
    () => ({
      id: myId,
      handle: cleanMyHandle,
      display_name: currentUser.name || cleanMyHandle || 'Creator',
      avatar_url: currentUser.avatar || null,
    }),
    [myId, cleanMyHandle, currentUser.name, currentUser.avatar]
  );

  const filterStore = useMemo(() => new DeviceFilterPresetStore(me.id), [me.id]);

  const effects = useMemo(
    () =>
      new EffectsController({
        persist: true,
        vibrate: typeof navigator !== 'undefined' && navigator.vibrate ? (pat) => navigator.vibrate(pat) : null,
      }),
    []
  );

  const streamerHandle = streamer.handle || (streamer as any).creatorHandle || '';
  const streamerName = streamer.name || (streamer as any).creatorName || streamerHandle || 'Creator';
  const streamerAvatar = streamer.avatar || (streamer as any).creatorAvatar || (streamer as any).previewUrl || '';
  const streamerStartedAt = (streamer as any).startedAt || (streamer as any).createdAt;

  // Session reference kept stable across parent re-renders for the same broadcast session
  const sessionRef = React.useRef<{ id: string; isHost: boolean; session: any } | null>(null);
  if (!sessionRef.current || sessionRef.current.id !== streamer.id || sessionRef.current.isHost !== isHost) {
    if (sessionRef.current) {
      sessionRef.current.session.dispose();
    }
    const createdSession = createProductionLiveSession({
      streamerId: streamer.id,
      streamerHandle,
      streamerName,
      streamerAvatar,
      startedAt: streamerStartedAt,
      me,
      isHost,
      onCoinsChange: (delta) => onCoinsChangeRef.current?.(delta),
    });
    sessionRef.current = { id: streamer.id, isHost, session: createdSession };
  }
  const session = sessionRef.current.session;

  // Media transport kept stable across parent re-renders for the same broadcast session
  const transportRef = React.useRef<{ id: string; isHost: boolean; transport: ProductionMediaTransport } | null>(null);
  if (!transportRef.current || transportRef.current.id !== streamer.id || transportRef.current.isHost !== isHost) {
    if (transportRef.current) {
      transportRef.current.transport.dispose();
    }
    const createdTransport = new ProductionMediaTransport({
      streamerId: streamer.id,
      streamerHandle,
      myId: me.id,
      myHandle: me.handle,
      isHost,
      initialStream: userMediaStream,
    });
    transportRef.current = { id: streamer.id, isHost, transport: createdTransport };
  }
  const mediaTransport = transportRef.current.transport;

  // If host camera stream updates (e.g. flipping camera), update the transport without re-creating it
  useEffect(() => {
    if (isHost && userMediaStream && transportRef.current) {
      transportRef.current.transport.updateInitialStream(userMediaStream);
    }
  }, [isHost, userMediaStream]);

  // Clean up session and transport only when the arena unmounts or session finishes
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.session.dispose();
        sessionRef.current = null;
      }
      if (transportRef.current) {
        transportRef.current.transport.dispose();
        transportRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="privity-live-arena-root"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: '#04060d',
        width: '100%',
        maxWidth: '100%',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        height: '100dvh',
        minHeight: '100dvh',
        maxHeight: '100dvh',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'manipulation',
      }}
    >
      {isHost ? (
        <HostStudio
          feed={session.feed}
          commands={session.commands}
          me={me}
          effects={effects}
          media={mediaTransport}
          filterStore={filterStore}
          mediaSource="camera"
          userMediaStream={userMediaStream}
          onExit={() => onCloseRef.current?.({ isHost: true, wasEnded: true })}
        />
      ) : (
        <ViewerLiveScreen
          feed={session.feed}
          commands={session.commands}
          me={me}
          effects={effects}
          media={mediaTransport}
          guestMediaSource="camera"
          shareUrl={window.location.href}
          onLeave={() => onCloseRef.current?.({ isHost: false })}
        />
      )}
    </div>
  );
};
