import { memo, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { LogOut, Mic, MicOff, RefreshCw, SwitchCamera, Video, VideoOff } from 'lucide-react';
import type { MediaTransport } from '../client/mediaTransport';
import { LocalMediaController, LocalMediaState, MediaSourceKind } from '../media/LocalMediaController';
import { ConnectionState } from '../client/connection';
import { IconButton } from './primitives';

/**
 * A guest's OWN camera and microphone while on stage. Started when the server accepts the
 * guest, stopped when they leave / are removed / the LIVE ends. Published through the
 * MediaTransport (Stage 4: LiveKit). Only this device's hardware is ever touched.
 */
export function useGuestMedia(
  active: boolean,
  userId: string,
  source: MediaSourceKind,
  transport: MediaTransport | null,
): { controller: LocalMediaController | null; state: LocalMediaState | null } {
  const [controller, setController] = useState<LocalMediaController | null>(null);

  useEffect(() => {
    if (!active) return;
    const c = new LocalMediaController(source);
    setController(c);
    void c.start({ video: true, audio: true });
    return () => {
      transport?.unpublish(userId);
      c.dispose();
      setController(null);
    };
  }, [active, source, userId, transport]);

  const state = useLocalMediaOrNull(controller);

  useEffect(() => {
    if (!controller || !state || !transport) return;
    const tracks: MediaStreamTrack[] = [];
    if (state.videoStream) tracks.push(...state.videoStream.getVideoTracks());
    if (state.audioTrack) tracks.push(state.audioTrack);
    transport.publish(userId, {
      stream: tracks.length ? new MediaStream(tracks) : null,
      cameraOn: state.camera.status === 'live',
      micOn: state.mic.status === 'live' && state.mic.enabled,
    });
  }, [controller, state?.videoStream, state?.audioTrack, state?.camera.status, state?.mic.status, state?.mic.enabled, transport, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { controller, state };
}

function useLocalMediaOrNull(c: LocalMediaController | null): LocalMediaState | null {
  return useSyncExternalStore(
    (fn) => (c ? c.subscribe(fn) : () => undefined),
    () => (c ? c.getState() : null),
  );
}

const STATUS_TEXT: Record<string, string> = {
  denied: 'blocked',
  unavailable: 'not found',
  'in-use': 'busy in another app',
  insecure: 'needs HTTPS',
  error: 'failed',
};

/** Guest controls dock: self mute, camera, flip, leave, connection and permission status. */
export const GuestDock = memo(function GuestDock({
  controller,
  state,
  connection,
  onLeave,
  leaving,
}: {
  controller: LocalMediaController;
  state: LocalMediaState;
  connection: ConnectionState;
  onLeave: () => void;
  leaving: boolean;
}) {
  const cam = state.camera;
  const mic = state.mic;
  const camProblem = cam.enabled && STATUS_TEXT[cam.status];
  const micProblem = mic.enabled && STATUS_TEXT[mic.status];
  const problems = useMemo(
    () => [camProblem ? cam.message : null, micProblem ? mic.message : null].filter(Boolean) as string[],
    [camProblem, micProblem, cam.message, mic.message],
  );
  const linkText =
    connection.link === 'connected' ? 'On stage' : connection.link === 'reconnecting' ? 'Reconnecting…' : connection.link === 'disconnected' ? 'Offline' : 'Connecting…';

  return (
    <section className="plv-guest-dock" aria-label="Your stage controls">
      <div className={`plv-guest-status plv-guest-status--${connection.link}`} role="status">
        <span className="plv-guest-status-dot" aria-hidden="true" />
        {linkText}
      </div>
      <IconButton
        id="plv-guest-mic"
        label={mic.enabled && mic.status === 'live' ? 'Mute your microphone' : 'Unmute your microphone'}
        pressed={!(mic.enabled && mic.status === 'live')}
        tone={mic.enabled && mic.status === 'live' ? 'glass' : 'danger'}
        icon={mic.enabled && mic.status === 'live' ? <Mic size={20} /> : <MicOff size={20} />}
        onClick={() => void controller.setMicEnabled(!(mic.enabled && mic.status === 'live'))}
        disabled={mic.status === 'requesting'}
      />
      <IconButton
        id="plv-guest-camera"
        label={cam.status === 'live' ? 'Turn your camera off' : 'Turn your camera on'}
        pressed={cam.status !== 'live'}
        tone={cam.status === 'live' ? 'glass' : 'danger'}
        icon={cam.status === 'live' ? <Video size={20} /> : <VideoOff size={20} />}
        onClick={() => void controller.setCameraEnabled(cam.status !== 'live')}
        disabled={cam.status === 'requesting' || cam.flipping}
      />
      {cam.canFlip && cam.status === 'live' && (
        <IconButton
          id="plv-guest-flip"
          label="Switch camera"
          icon={<SwitchCamera size={20} />}
          onClick={() => void controller.flip()}
          disabled={cam.flipping}
        />
      )}
      <IconButton id="plv-guest-leave" label="Leave the stage" tone="danger" icon={<LogOut size={20} />} onClick={onLeave} disabled={leaving} />
      {problems.length > 0 && (
        <div className="plv-guest-problems" role="alert">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <button
            type="button"
            className="plv-link-btn"
            onClick={() => {
              if (camProblem) void controller.setCameraEnabled(true);
              if (micProblem) void controller.setMicEnabled(true);
            }}
          >
            <RefreshCw size={14} aria-hidden="true" /> Try again
          </button>
        </div>
      )}
    </section>
  );
});
