import React, { useState, useEffect } from 'react';
import './livePipPlayer.css';
import { LiveMeStreamer } from './types';
import { IconX } from '../Icons';
import { liveStreamSync, getRoomIdFromHandle } from '../../services/liveStreamSyncService';

export interface LivePipPlayerProps {
  streamer: LiveMeStreamer;
  onMaximize: () => void;
  onClose: () => void;
}

export const LivePipPlayer: React.FC<LivePipPlayerProps> = ({
  streamer,
  onMaximize,
  onClose,
}) => {
  const [liveFrame, setLiveFrame] = useState<string | null>(null);

  useEffect(() => {
    const roomId = streamer.id || getRoomIdFromHandle(streamer.handle);
    let frameBus: BroadcastChannel | null = null;

    try {
      frameBus = new BroadcastChannel('privity_live_frames');
      frameBus.onmessage = (e) => {
        if (e.data?.type === 'FRAME' && e.data.handle && e.data.frame) {
          const normA = e.data.handle.toLowerCase().replace('@', '').trim();
          const normB = (streamer.handle || '').toLowerCase().replace('@', '').trim();
          if (normA === normB) {
            setLiveFrame(e.data.frame);
          }
        }
      };
    } catch {}

    const unsubRoom = liveStreamSync.subscribeToRoomEvents(roomId, (evt) => {
      if (evt.type === 'LIVE_FRAME' && evt.frame) {
        setLiveFrame(evt.frame);
      } else if (evt.type === 'LIVE_ENDED') {
        // Stream ended while in PiP - terminate PiP immediately!
        onClose();
      }
    });

    return () => {
      if (frameBus) frameBus.close();
      unsubRoom();
    };
  }, [streamer.id, streamer.handle, onClose]);

  return (
    <div
      className="live-pip-container"
      onClick={onMaximize}
      title={`Tap to maximize @${streamer.handle}'s live stream`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onMaximize();
        }
      }}
    >
      {/* Live Video Media Canvas */}
      <div className="live-pip-media-frame">
        {liveFrame ? (
          <img
            src={liveFrame}
            alt={streamer.name}
            className="live-pip-video live-camera-active"
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        ) : streamer.videoStreamUrl ? (
          <video
            src={streamer.videoStreamUrl}
            poster={streamer.posterUrl || streamer.avatar}
            autoPlay
            loop
            muted
            playsInline
            className="live-pip-video"
          />
        ) : (
          <img
            src={streamer.posterUrl || streamer.avatar}
            alt={streamer.name}
            className="live-pip-poster"
          />
        )}

        {/* Readability Scrims */}
        <div className="live-pip-top-scrim" />
        <div className="live-pip-bottom-scrim" />

        {/* Top Header Controls */}
        <div className="live-pip-header-bar">
          <div className="live-pip-live-badge">
            <span className="live-pip-pulse-dot" />
            <span>LIVE</span>
          </div>

          {/* Close X Button - Completely terminates the minimized stream */}
          <button
            type="button"
            className="live-pip-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close Live Stream completely"
            aria-label="Close Live Stream completely"
          >
            <IconX size={13} color="#ffffff" />
          </button>
        </div>

        {/* Bottom Streamer Info */}
        <div className="live-pip-bottom-meta">
          <img
            src={streamer.avatar}
            alt={streamer.name}
            className="live-pip-streamer-avatar"
          />
          <div className="live-pip-streamer-text">
            <span className="live-pip-name">{streamer.name}</span>
            <span className="live-pip-heat">🔥 {streamer.popularity || streamer.viewersCount}</span>
          </div>
        </div>

        {/* Specular Ambient Glow Border */}
        <div className="live-pip-specular-ring" />
      </div>
    </div>
  );
};
