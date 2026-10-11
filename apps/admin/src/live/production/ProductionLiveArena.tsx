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
  onCoinsChange,
  showToast: _showToast,
  onClose,
  onViewProfile: _onViewProfile,
}) => {
  const cleanMyHandle = (currentUser.handle || 'user').replace(/^@/, '').toLowerCase().trim();
  const me: UserRef = useMemo(
    () => ({
      id: currentUser.id || cleanMyHandle,
      handle: cleanMyHandle,
      display_name: currentUser.name || cleanMyHandle || 'Creator',
      avatar_url: currentUser.avatar || null,
    }),
    [currentUser.id, cleanMyHandle, currentUser.name, currentUser.avatar]
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

  const session = useMemo(
    () =>
      createProductionLiveSession({
        streamerId: streamer.id,
        streamerHandle,
        streamerName,
        streamerAvatar,
        me,
        isHost,
        onCoinsChange,
      }),
    [streamer.id, streamerHandle, streamerName, streamerAvatar, me, isHost, onCoinsChange]
  );

  const mediaTransport = useMemo(
    () =>
      new ProductionMediaTransport({
        streamerId: streamer.id,
        streamerHandle,
        myId: me.id,
        myHandle: me.handle,
        isHost,
        initialStream: userMediaStream,
      }),
    [streamer.id, streamerHandle, me.id, me.handle, isHost, userMediaStream]
  );

  useEffect(() => {
    return () => {
      session.dispose();
      mediaTransport.dispose();
    };
  }, [session, mediaTransport]);

  return (
    <div
      className="privity-live-arena-root"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: '#04060d',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
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
          onExit={() => onClose({ isHost: true, wasEnded: true })}
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
          onLeave={() => onClose({ isHost: false })}
        />
      )}
    </div>
  );
};
