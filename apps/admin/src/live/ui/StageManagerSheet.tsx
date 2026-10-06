import { memo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Columns2,
  Ellipsis,
  GripVertical,
  LayoutGrid,
  MicOff,
  Pin,
  PictureInPicture2,
  RefreshCw,
  Sparkles,
  Square,
  UserMinus,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { LiveGuest } from '../core/events';
import type { ParticipantMedia } from '../client/connection';
import type { GuestEntry } from '../stage/guestRequests';
import { pendingRequests, requestHistory } from '../stage/guestRequests';
import { LAYOUT_LABELS, StageLayoutMode } from '../stage/stageLayout';
import type { StagePresentation } from '../stage/stagePresentation';
import { Avatar } from './Avatar';
import { ConfirmDialog, Sheet } from './primitives';

type Tab = 'stage' | 'requests' | 'history';

const LAYOUT_ICONS: Record<StageLayoutMode, JSX.Element> = {
  auto: <Sparkles size={18} />,
  solo: <Square size={18} />,
  split: <Columns2 size={18} />,
  grid: <LayoutGrid size={18} />,
  spotlight: <PictureInPicture2 size={18} />,
};

const HISTORY_TEXT: Record<string, string> = {
  declined: 'Declined',
  cancelled: 'Cancelled their request',
  removed: 'Removed from stage',
  left: 'Left the stage',
};

export interface StageManagerProps {
  open: boolean;
  onClose: () => void;
  guests: ReadonlyArray<LiveGuest>;
  presentation: StagePresentation;
  presence: ReadonlyMap<string, ParticipantMedia>;
  requests: ReadonlyArray<GuestEntry>;
  localMuted: ReadonlySet<string>;
  battleActive: boolean;
  onRespond: (userId: string, accept: boolean) => void;
  onRemove: (userId: string) => Promise<boolean>;
  onMove: (userId: string, delta: number) => void;
  onMoveTo: (userId: string, index: number) => void;
  onFeature: (userId: string) => void;
  onLayout: (mode: StageLayoutMode) => void;
  onToggleLocalMute: (userId: string) => void;
  onRefreshRequests: () => void;
  onClearHistory: () => void;
  initialTab?: Tab;
}

/**
 * Stage Manager. WHO is on stage is the server's decision (accept / remove RPCs + events).
 * Order, featured guest and layout are the host's presentation choices on this device.
 */
export const StageManagerSheet = memo(function StageManagerSheet(props: StageManagerProps) {
  const { open, onClose, guests, presentation, requests } = props;
  const pending = pendingRequests(requests);
  const history = requestHistory(requests);
  const [tab, setTab] = useState<Tab>(props.initialTab ?? (pending.length ? 'requests' : 'stage'));
  const ordered = presentation.order
    .map((id) => guests.find((g) => g.id === id))
    .filter((g): g is LiveGuest => !!g);

  return (
    <Sheet open={open} onClose={onClose} title="Stage" subtitle={`${guests.length} on stage with you`} size="tall" id="plv-stage-manager">
      <div className="plv-tabs" role="tablist" aria-label="Stage manager">
        <TabButton id="stage" tab={tab} setTab={setTab} label={`On stage · ${guests.length}`} />
        <TabButton id="requests" tab={tab} setTab={setTab} label="Requests" badge={pending.length} />
        <TabButton id="history" tab={tab} setTab={setTab} label="History" />
      </div>

      {tab === 'stage' && (
        <div role="tabpanel" aria-label="On stage">
          <LayoutPicker {...props} />
          {ordered.length === 0 ? (
            <p className="plv-empty">
              Nobody is on stage yet. Viewers can ask to join from their LIVE menu; requests appear under <strong>Requests</strong>.
            </p>
          ) : (
            <GuestList ordered={ordered} {...props} />
          )}
          <p className="plv-help">
            Inviting a specific viewer is not available yet — viewers request to join and you accept.
          </p>
        </div>
      )}

      {tab === 'requests' && (
        <div role="tabpanel" aria-label="Requests">
          <div className="plv-panel-head">
            <span>{pending.length ? `${pending.length} waiting` : 'No one is waiting'}</span>
            <button type="button" className="plv-link-btn" onClick={props.onRefreshRequests}>
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </button>
          </div>
          <ul className="plv-list">
            {pending.map((r) => (
              <li key={r.userId} className="plv-row" data-request-user={r.userId}>
                <Avatar user={r.user} size={40} decorative />
                <div className="plv-row-text">
                  <span className="plv-row-title">{r.user.display_name || r.user.handle}</span>
                  <span className="plv-row-sub">
                    {r.status === 'failed' ? <span className="plv-text-warn">{r.error}</span> : `@${r.user.handle} · asked ${timeAgo(r.requestedAt)}`}
                  </span>
                </div>
                <div className="plv-row-actions">
                  <button
                    type="button"
                    className="plv-btn plv-btn--small plv-btn--ghost"
                    disabled={r.status === 'accepting' || r.status === 'declining'}
                    onClick={() => props.onRespond(r.userId, false)}
                    aria-label={`Decline ${r.user.display_name || r.user.handle}`}
                  >
                    {r.status === 'declining' ? '…' : <X size={16} aria-hidden="true" />}
                    <span className="plv-hide-narrow">Decline</span>
                  </button>
                  <button
                    type="button"
                    className="plv-btn plv-btn--small plv-btn--iris"
                    disabled={r.status === 'accepting' || r.status === 'declining'}
                    onClick={() => props.onRespond(r.userId, true)}
                    aria-label={`Accept ${r.user.display_name || r.user.handle}`}
                  >
                    {r.status === 'accepting' ? '…' : <Check size={16} aria-hidden="true" />}
                    <span className="plv-hide-narrow">{r.status === 'accepting' ? 'Accepting' : 'Accept'}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'history' && (
        <div role="tabpanel" aria-label="History">
          <div className="plv-panel-head">
            <span>This LIVE</span>
            {history.length > 0 && (
              <button type="button" className="plv-link-btn" onClick={props.onClearHistory}>
                Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="plv-empty">Declined, cancelled and removed requests show up here.</p>
          ) : (
            <ul className="plv-list">
              {history.map((h) => (
                <li key={`${h.userId}:${h.updatedAt}`} className="plv-row plv-row--quiet">
                  <Avatar user={h.user} size={32} decorative />
                  <div className="plv-row-text">
                    <span className="plv-row-title">{h.user.display_name || h.user.handle}</span>
                    <span className="plv-row-sub">
                      {HISTORY_TEXT[h.status] ?? h.status} · {timeAgo(h.updatedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
});

function TabButton({ id, tab, setTab, label, badge }: { id: Tab; tab: Tab; setTab: (t: Tab) => void; label: string; badge?: number }) {
  return (
    <button type="button" role="tab" aria-selected={tab === id} className={`plv-tab ${tab === id ? 'is-on' : ''}`} onClick={() => setTab(id)} id={`plv-tab-${id}`}>
      {label}
      {badge ? <span className="plv-tab-badge">{badge}</span> : null}
    </button>
  );
}

function LayoutPicker({ presentation, guests, onLayout, battleActive }: StageManagerProps) {
  const n = guests.length;
  const modes: StageLayoutMode[] = ['auto', 'solo', 'split', 'grid', 'spotlight'];
  return (
    <div className="plv-layout-picker">
      <div className="plv-segmented" role="radiogroup" aria-label="Stage layout">
        {modes.map((m) => {
          const disabled = battleActive || (m !== 'auto' && m !== 'solo' && n === 0);
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={presentation.mode === m}
              className={`plv-seg ${presentation.mode === m ? 'is-on' : ''}`}
              disabled={disabled}
              onClick={() => onLayout(m)}
              id={`plv-layout-${m}`}
            >
              <span aria-hidden="true">{LAYOUT_ICONS[m]}</span>
              <span>{LAYOUT_LABELS[m]}</span>
            </button>
          );
        })}
      </div>
      <p className="plv-help">
        {battleActive
          ? 'During a battle the stage shows both creators side by side.'
          : 'Arrangement applies to your studio view. Viewers see the standard layout until layout sync is connected.'}
      </p>
    </div>
  );
}

function GuestList({
  ordered,
  presentation,
  presence,
  localMuted,
  onMove,
  onMoveTo,
  onFeature,
  onRemove,
  onToggleLocalMute,
}: StageManagerProps & { ordered: LiveGuest[] }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<LiveGuest | null>(null);
  const [removing, setRemoving] = useState(false);

  return (
    <>
      <ol className="plv-list plv-guest-list" aria-label="Guests in stage order">
        {ordered.map((g, i) => {
          const media = presence.get(g.id);
          const featured = presentation.featuredId === g.id;
          const muted = localMuted.has(g.id);
          const name = g.display_name || g.handle;
          return (
            <li
              key={g.id}
              className={`plv-row plv-guest-row ${dragId === g.id ? 'is-dragging' : ''} ${overIdx === i && dragId && dragId !== g.id ? 'is-drop-target' : ''}`}
              draggable
              onDragStart={(e) => {
                setDragId(g.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', g.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIdx(i);
              }}
              onDragLeave={() => setOverIdx((v) => (v === i ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain') || dragId;
                if (id) onMoveTo(id, i);
                setDragId(null);
                setOverIdx(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverIdx(null);
              }}
              data-guest-id={g.id}
            >
              <span className="plv-grip" aria-hidden="true">
                <GripVertical size={16} />
              </span>
              <span className="plv-order-num" aria-hidden="true">
                {i + 1}
              </span>
              <Avatar user={g} size={40} decorative />
              <div className="plv-row-text">
                <span className="plv-row-title">
                  {name}
                  {featured && (
                    <span className="plv-role-tag">
                      <Pin size={10} aria-hidden="true" /> Featured
                    </span>
                  )}
                </span>
                <span className="plv-row-sub plv-media-flags">
                  {!media ? (
                    'Waiting for video'
                  ) : media.status !== 'connected' ? (
                    <span className="plv-text-warn">{media.status === 'reconnecting' ? 'Reconnecting…' : 'Disconnected'}</span>
                  ) : (
                    <>
                      {!media.cameraOn && (
                        <span>
                          <VideoOff size={12} aria-hidden="true" /> Camera off
                        </span>
                      )}
                      {!media.micOn && (
                        <span>
                          <MicOff size={12} aria-hidden="true" /> Muted themselves
                        </span>
                      )}
                      {media.cameraOn && media.micOn && <span>Live</span>}
                    </>
                  )}
                  {muted && (
                    <span className="plv-text-warn">
                      <VolumeX size={12} aria-hidden="true" /> Muted for you
                    </span>
                  )}
                </span>
              </div>
              <div className="plv-row-actions">
                <button type="button" className="plv-mini-btn" onClick={() => onMove(g.id, -1)} disabled={i === 0} aria-label={`Move ${name} up`}>
                  <ChevronUp size={18} />
                </button>
                <button type="button" className="plv-mini-btn" onClick={() => onMove(g.id, 1)} disabled={i === ordered.length - 1} aria-label={`Move ${name} down`}>
                  <ChevronDown size={18} />
                </button>
                <button
                  type="button"
                  className={`plv-mini-btn ${featured ? 'is-on' : ''}`}
                  onClick={() => onFeature(g.id)}
                  aria-pressed={featured}
                  aria-label={featured ? `Unfeature ${name}` : `Feature ${name}`}
                >
                  <Pin size={16} />
                </button>
                <button type="button" className="plv-mini-btn" onClick={() => setMenuId(menuId === g.id ? null : g.id)} aria-expanded={menuId === g.id} aria-label={`More for ${name}`}>
                  <Ellipsis size={16} />
                </button>
              </div>
              {menuId === g.id && (
                <div className="plv-row-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onToggleLocalMute(g.id);
                      setMenuId(null);
                    }}
                  >
                    {muted ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
                    <span>
                      {muted ? 'Unmute for me' : 'Mute for me'}
                      <small>Local playback only — viewers still hear {name}.</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="is-danger"
                    onClick={() => {
                      setConfirmRemove(g);
                      setMenuId(null);
                    }}
                  >
                    <UserMinus size={16} aria-hidden="true" />
                    <span>
                      Remove from stage
                      <small>Ends their stage access for this LIVE.</small>
                    </span>
                  </button>
                  <p className="plv-row-menu-note">
                    Stopping a guest&rsquo;s audio for everyone needs server-side track permissions, which arrive with the video infrastructure. Guests control their own camera and microphone.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <ConfirmDialog
        open={!!confirmRemove}
        title={`Remove ${confirmRemove?.display_name || confirmRemove?.handle || ''} from the stage?`}
        body="They go back to watching. They cannot request to join again during this LIVE."
        confirmLabel="Remove"
        busy={removing}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (!confirmRemove) return;
          setRemoving(true);
          void onRemove(confirmRemove.id).then(() => {
            setRemoving(false);
            setConfirmRemove(null);
          });
        }}
      />
    </>
  );
}

function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}
