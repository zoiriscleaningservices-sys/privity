import { ReactNode, memo, useEffect, useRef } from 'react';
import { MicOff, Pin, RefreshCw, VideoOff, VolumeX, WifiOff } from 'lucide-react';
import type { UserRef } from '../core/events';
import type { ParticipantMedia } from '../client/connection';
import type { ResolvedLayout, TileArea } from '../stage/stageLayout';
import { StreamVideo } from '../media/FilteredPreview';
import { Avatar } from './Avatar';

export interface TileModel {
  id: string;
  role: 'host' | 'guest' | 'opponent' | 'self';
  area: TileArea;
  user: UserRef;
  /** Pre-rendered local preview (own camera through the filter pipeline). */
  local?: ReactNode;
  /** Remote media presence (Stage 4: LiveKit; Lab: loopback). null = no media connection. */
  media?: ParticipantMedia | null;
  /** Own camera state when `local` is used. */
  localCameraOn?: boolean;
  localMicOn?: boolean;
  featured?: boolean;
  /** Host silenced this participant's audio for themselves only. */
  localPlaybackMuted?: boolean;
  /** Small caption shown on the tile, e.g. "You", "Host", side label. */
  caption?: string;
  side?: 'a' | 'b';
  onSelect?: () => void;
}

/** Plays a remote participant's audio track; muted only on THIS device when asked. */
const RemoteAudio = memo(function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [stream]);
  return <audio ref={ref} muted={muted} autoPlay hidden />;
});

const Tile = memo(function Tile({ t }: { t: TileModel }) {
  const name = t.user.display_name || `@${t.user.handle}`;
  const media = t.media;
  const isLocal = t.local !== undefined;
  const cameraOn = isLocal ? !!t.localCameraOn : !!media?.cameraOn;
  const micOn = isLocal ? t.localMicOn : media?.micOn;
  const status = isLocal ? 'connected' : media?.status ?? 'none';
  const hasAudio = !isLocal && !!media?.stream && media.stream.getAudioTracks().length > 0;

  let body: ReactNode;
  if (isLocal && cameraOn) body = t.local;
  else if (!isLocal && media?.stream && cameraOn && status === 'connected') {
    body = <StreamVideo stream={media.stream} className="plv-tile-video" label={`${name} video`} />;
  } else {
    const reason = isLocal
      ? 'Your camera is off'
      : !media
        ? 'Waiting for video'
        : status === 'reconnecting'
          ? 'Reconnecting…'
          : status === 'disconnected'
            ? 'Connection lost'
            : 'Camera off';
    const Icon = !media && !isLocal ? null : status === 'reconnecting' ? RefreshCw : status === 'disconnected' ? WifiOff : VideoOff;
    body = (
      <div className="plv-tile-placeholder">
        <Avatar user={t.user} size={t.area === 'strip' ? 40 : t.area === 'main' ? 96 : 64} decorative />
        <span className="plv-tile-reason">
          {Icon && <Icon size={14} className={status === 'reconnecting' ? 'plv-spin' : undefined} aria-hidden="true" />}
          {reason}
        </span>
      </div>
    );
  }

  const Wrapper = t.onSelect ? 'button' : 'div';
  return (
    <Wrapper
      type={t.onSelect ? 'button' : undefined}
      className={`plv-tile plv-tile--${t.area} plv-tile--${t.role} ${t.featured ? 'is-featured' : ''} ${t.side ? `plv-tile--side-${t.side}` : ''}`}
      data-tile-id={t.id}
      onClick={t.onSelect}
      aria-label={t.onSelect ? `${name} — open options` : undefined}
    >
      {body}
      {hasAudio && media?.stream && <RemoteAudio stream={media.stream} muted={!!t.localPlaybackMuted} />}
      {t.area !== 'main' || t.role !== 'host' || t.caption ? (
        <span className="plv-tile-label">
          {t.featured && <Pin size={12} aria-label="Featured" />}
          <span className="plv-tile-name">{t.caption ? `${t.caption}` : name}</span>
          {micOn === false && <MicOff size={12} aria-label="Microphone off" />}
          {t.localPlaybackMuted && <VolumeX size={12} aria-label="Muted for you" />}
        </span>
      ) : null}
    </Wrapper>
  );
});

/**
 * The video stage. Pure presentation of a computed layout: the host / featured participant
 * stays large, extra participants go to a filmstrip, the rest collapse into "+N".
 */
export const VideoStage = memo(function VideoStage({
  layout,
  columns,
  tiles,
  overflow,
  onOverflow,
}: {
  layout: ResolvedLayout | 'battle';
  columns: number;
  tiles: ReadonlyArray<TileModel>;
  overflow: number;
  onOverflow?: () => void;
}) {
  const big = tiles.filter((t) => t.area !== 'strip');
  const strip = tiles.filter((t) => t.area === 'strip');
  return (
    <div className={`plv-stage plv-stage--${layout}`} style={{ ['--plv-cols' as string]: columns }}>
      <div className="plv-stage-main">
        {big.map((t) => (
          <Tile key={t.id} t={t} />
        ))}
      </div>
      {(strip.length > 0 || overflow > 0) && (
        <div className="plv-stage-strip" aria-label="More people on stage">
          {strip.map((t) => (
            <Tile key={t.id} t={t} />
          ))}
          {overflow > 0 &&
            (onOverflow ? (
              <button type="button" className="plv-tile plv-tile--strip plv-tile-more" onClick={onOverflow} aria-label={`${overflow} more on stage`}>
                +{overflow}
              </button>
            ) : (
              <span className="plv-tile plv-tile--strip plv-tile-more" aria-label={`${overflow} more on stage`}>
                +{overflow}
              </span>
            ))}
        </div>
      )}
    </div>
  );
});
