import { useCallback, useMemo, useRef, useState } from 'react';
import { Ellipsis, Gift, Heart, Radio, Share2, UserCheck, UserPlus, WifiOff, X } from 'lucide-react';
import type { UserRef } from '../core/events';
import type { LiveCommands } from '../client/LiveCommands';
import type { LiveFeed, LiveRoomController, PersonalNotice } from '../client/LiveRoomController';
import type { LiveComment } from '../client/commentStore';
import type { MediaTransport } from '../client/mediaTransport';
import { describeLiveError } from '../client/errors';
import type { EffectsController } from '../show/effects';
import { useBattleView, useEffectPrefs, useShowChat } from '../show/useLane';
import type { MediaSourceKind } from '../media/LocalMediaController';
import { StreamVideo } from '../media/FilteredPreview';
import { TopSupporterChip } from '../moments/TopSupporterChip';
import { LiveFrame } from './LiveFrame';
import { useComments, useLiveRoom, useMediaPresence, usePersonalNotices, useRoomView } from './hooks';
import { Avatar } from './Avatar';
import { IconButton } from './primitives';
import { ConnectionIndicator, LiveBadge, StateScreen, ToastStack, ViewerCount, useToasts } from './status';
import { VideoStage } from './VideoStage';
import { buildStage, battleSides } from './buildStage';
import { ShowOverlay } from './ShowOverlay';
import { CommentComposer, CommentList } from './Comments';
import { GiftTray } from './GiftTray';
import { HeartsHandle, HeartsLayer } from './Hearts';
import { CommentActionsSheet, GuestRequestUi, ShareSheet, SupportersSheet, ViewerMoreSheet } from './ViewerSheets';
import { GuestDock, useGuestMedia } from './GuestDock';

export interface ViewerLiveScreenProps {
  feed: LiveFeed;
  commands: LiveCommands;
  me: UserRef;
  effects: EffectsController;
  /** Remote media + own publishing (Stage 4: LiveKit). null = no media layer connected. */
  media: MediaTransport | null;
  /** Where a guest's own video comes from (Lab can use the labelled test pattern). */
  guestMediaSource?: MediaSourceKind;
  shareUrl: string;
  onLeave: () => void;
}

/** The audience experience: the video first, chat low, actions in reach of the thumb. */
export function ViewerLiveScreen(props: ViewerLiveScreenProps) {
  const controller = useLiveRoom(props.feed, props.effects);
  return (
    <LiveFrame effects={props.effects} variant="viewer" label="LIVE">
      {controller ? (
        <ViewerBody controller={controller} {...props} />
      ) : (
        <JoiningState />
      )}
    </LiveFrame>
  );
}

function JoiningState() {
  return (
    <div className="plv-joining" role="status">
      <span className="plv-joining-ring" aria-hidden="true" />
      <span>Joining LIVE…</span>
    </div>
  );
}

type SheetKind = null | 'gift' | 'share' | 'more' | 'supporters' | 'comment';

function ViewerBody({
  controller,
  commands,
  me,
  effects,
  media,
  guestMediaSource = 'camera',
  shareUrl,
  onLeave,
}: ViewerLiveScreenProps & { controller: LiveRoomController }) {
  const view = useRoomView(controller);
  const comments = useComments(controller);
  const showChat = useShowChat(controller.engine);
  const battleView = useBattleView(controller.engine);
  const presence = useMediaPresence(media);
  const prefs = useEffectPrefs(effects);
  const { items: toasts, push: toast } = useToasts();
  const hearts = useRef<HeartsHandle>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [selected, setSelected] = useState<LiveComment | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);

  const room = view.room;
  const meState = view.me;
  const live = room?.status === 'live';
  const isGuest = meState?.guest_status === 'accepted' && live;
  const guest = useGuestMedia(!!isGuest, me.id, guestMediaSource, media);

  const onNotice = useCallback(
    (n: PersonalNotice) => {
      switch (n.type) {
        case 'GUEST_ACCEPTED':
          toast('You are on stage. Your camera and mic are starting.', 'success');
          break;
        case 'GUEST_DECLINED':
          toast('The host declined your request to join.', 'info');
          break;
        case 'GUEST_REMOVED':
          toast('The host removed you from the stage.', 'warn');
          break;
        case 'MUTED':
          toast('The host muted you in this LIVE.', 'warn');
          break;
        case 'UNMUTED':
          toast('You can comment again.', 'info');
          break;
        default:
          break;
      }
    },
    [toast],
  );
  usePersonalNotices(controller, onNotice);

  const self = useMemo(
    () =>
      isGuest && guest.state
        ? {
            id: me.id,
            local: <StreamVideo stream={guest.state.videoStream} mirror={guest.state.camera.facing === 'user'} className="plv-tile-video" label="Your camera" />,
            cameraOn: guest.state.camera.status === 'live',
            micOn: guest.state.mic.status === 'live' && guest.state.mic.enabled,
          }
        : null,
    [isGuest, guest.state, me.id],
  );

  const stage = useMemo(
    () => (room ? buildStage({ room, battle: battleSides(room), mode: 'auto', presence, self }) : null),
    [room, presence, self],
  );

  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }>) => {
      setBusy(key);
      const res = await fn();
      setBusy(null);
      if (!res.ok) {
        const d = describeLiveError(res.code, res.message);
        toast(`${d.title}. ${d.body}`, 'warn');
        return null;
      }
      return res.data;
    },
    [toast],
  );

  // ---- Terminal states -------------------------------------------------------
  if (view.phase === 'connecting' || (!room && view.phase !== 'unavailable')) return <JoiningState />;
  if (view.phase === 'unavailable' || !room || !meState) {
    const d = describeLiveError(view.unavailable?.code ?? 'LIVE_NOT_FOUND', view.unavailable?.message);
    return <StateScreen title={d.title} body={d.body} primary={{ label: 'Leave', onClick: onLeave, id: 'plv-leave' }} />;
  }
  if (view.removed) {
    return (
      <StateScreen
        tone="bad"
        title="You were removed from this LIVE"
        body="The host removed you. You can keep using Privity, but you cannot rejoin this LIVE."
        primary={{ label: 'Leave', onClick: onLeave, id: 'plv-leave' }}
      />
    );
  }

  const host = room.host;
  const following = meState.following_host;
  const mutedUntil = meState.muted_until ? Date.parse(meState.muted_until) : 0;
  const isMuted = mutedUntil > Date.now();
  const link = view.connection.link;

  if (!live) {
    return (
      <StateScreen
        icon={<Avatar user={host} size={72} decorative />}
        title={`${host.display_name || host.handle}'s LIVE has ended`}
        body={following ? 'You follow this creator — you will see their next LIVE.' : 'Follow to catch their next LIVE.'}
        primary={
          following
            ? { label: 'Leave', onClick: onLeave, id: 'plv-leave' }
            : {
                label: busy === 'follow' ? 'Following…' : 'Follow',
                id: 'plv-ended-follow',
                onClick: () =>
                  void run('follow', () => commands.follow(host.id)).then((d) => d && controller.confirmMe({ following_host: d.following })),
              }
        }
        secondary={following ? undefined : { label: 'Leave', onClick: onLeave, id: 'plv-leave' }}
      />
    );
  }

  const composerDisabled = !room.commentsEnabled
    ? 'Comments are turned off'
    : isMuted
      ? `You are muted until ${new Date(mutedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : link !== 'connected'
        ? 'Reconnecting…'
        : null;

  const guestUi: GuestRequestUi =
    busy === 'guest' ? 'busy' : meState.guest_status === 'requested' ? 'requested' : meState.guest_status === 'accepted' ? 'accepted' : 'none';
  const battleId = room.battle && room.battle.status !== 'cancelled' && room.battle.status !== 'expired' ? room.battle.battle_id : null;
  const battleScoring = battleView.stage === 'ACTIVE' || battleView.stage === 'FINAL_COUNTDOWN';
  const topSupporter = room.topSupporters[0] ?? null;

  const toggleFollow = () =>
    void run('follow', () => (following ? commands.unfollow(host.id) : commands.follow(host.id))).then((d) => {
      if (d) controller.confirmMe({ following_host: d.following });
    });

  return (
    <div className={`plv-viewer ${typing ? 'is-typing' : ''} ${isGuest ? 'is-guest' : ''}`}>
      <div className="plv-video-layer">
        {stage && <VideoStage layout={stage.layout} columns={stage.columns} tiles={stage.tiles} overflow={stage.overflow} />}
      </div>
      <div className="plv-scrim plv-scrim--top" aria-hidden="true" />
      <div className="plv-scrim plv-scrim--bottom" aria-hidden="true" />

      <header className="plv-viewer-head">
        <div className="plv-creator">
          <Avatar user={host} size={40} ring="live" decorative />
          <div className="plv-creator-text">
            <span className="plv-creator-name">{host.display_name || host.handle}</span>
            <span className="plv-creator-handle">@{host.handle}</span>
          </div>
          {host.id !== me.id && (
            <button
              id="plv-follow"
              type="button"
              className={`plv-follow ${following ? 'is-following' : ''}`}
              onClick={toggleFollow}
              disabled={busy === 'follow'}
              aria-pressed={following}
            >
              {following ? <UserCheck size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        <div className="plv-head-right">
          <ViewerCount count={room.viewerCount} />
          <IconButton id="plv-leave" label="Leave LIVE" icon={<X size={20} />} onClick={onLeave} tone="glass" />
        </div>
        <div className="plv-head-row2">
          <LiveBadge startedAt={view.startedAt} />
          <TopSupporterChip supporter={topSupporter?.user ?? null} totalCoins={topSupporter?.total} onClick={() => setSheet('supporters')} />
          <ConnectionIndicator connection={view.connection} compact />
        </div>
      </header>

      {link !== 'connected' && (
        <div className="plv-link-banner" role="alert">
          <WifiOff size={16} aria-hidden="true" />
          <span>
            {link === 'disconnected' ? 'You are offline.' : 'Connection lost — reconnecting.'} What you see may be out of date.
          </span>
          {link === 'disconnected' && (
            <button type="button" className="plv-link-btn" onClick={() => controller.resync()}>
              Retry
            </button>
          )}
        </div>
      )}

      <ShowOverlay engine={controller.engine} />
      <HeartsLayer ref={hearts} />

      {isGuest && guest.controller && guest.state && (
        <GuestDock
          controller={guest.controller}
          state={guest.state}
          connection={view.connection}
          leaving={busy === 'leave'}
          onLeave={() =>
            void run('leave', () => commands.leaveGuest(room.liveId)).then((d) => {
              if (d) controller.confirmMe({ guest_status: 'left' });
            })
          }
        />
      )}
      {guestUi === 'requested' && (
        <div className="plv-request-pill" role="status">
          <Radio size={14} aria-hidden="true" /> Request sent — waiting for the host
        </div>
      )}

      <section className="plv-viewer-bottom" aria-label="Chat and actions">
        <CommentList
          comments={comments}
          events={showChat}
          hostId={host.id}
          meId={me.id}
          hiddenAuthors={hidden}
          onSelect={(c) => {
            if (c.author.id === me.id) return;
            setSelected(c);
            setSheet('comment');
          }}
        />
        <div className="plv-action-row">
          <CommentComposer
            onFocusChange={setTyping}
            disabledReason={composerDisabled}
            send={async (text) => {
              const res = await commands.comment(room.liveId, text);
              return res.ok ? { ok: true as const } : res;
            }}
          />
          <div className="plv-action-buttons">
            <IconButton id="plv-like" label="Like" icon={<Heart size={22} />} onClick={() => hearts.current?.burst()} />
            <IconButton id="plv-share" label="Share" icon={<Share2 size={21} />} onClick={() => setSheet('share')} />
            <IconButton id="plv-more" label="More options" icon={<Ellipsis size={22} />} onClick={() => setSheet('more')} />
            {host.id !== me.id && (
              <IconButton id="plv-gift" label="Send a gift" tone="iris" size="lg" icon={<Gift size={24} />} onClick={() => setSheet('gift')} />
            )}
          </div>
        </div>
      </section>

      <ToastStack items={toasts} />

      <GiftTray
        open={sheet === 'gift'}
        onClose={() => setSheet(null)}
        commands={commands}
        liveId={room.liveId}
        battleId={battleId}
        battleScoring={battleScoring}
        recipientName={host.display_name || host.handle}
      />
      <ShareSheet open={sheet === 'share'} onClose={() => setSheet(null)} url={shareUrl} title={`${host.display_name || host.handle} is LIVE on Privity`} />
      <SupportersSheet open={sheet === 'supporters'} onClose={() => setSheet(null)} supporters={room.topSupporters} />
      <ViewerMoreSheet
        open={sheet === 'more'}
        onClose={() => setSheet(null)}
        guestState={guestUi}
        canRequest={link === 'connected' && host.id !== me.id}
        requestHint={null}
        prefs={prefs}
        onPrefs={(p) => effects.setPrefs(p)}
        onRequestJoin={() =>
          void run('guest', () => commands.requestGuest(room.liveId)).then((d) => {
            if (d) {
              controller.confirmMe({ guest_status: d.status });
              toast('Request sent. The host will decide.', 'info');
              setSheet(null);
            }
          })
        }
        onCancelRequest={() =>
          void run('guest', () => commands.cancelGuestRequest(room.liveId)).then((d) => {
            if (d) {
              controller.confirmMe({ guest_status: 'cancelled' });
              setSheet(null);
            }
          })
        }
      />
      <CommentActionsSheet
        open={sheet === 'comment'}
        onClose={() => setSheet(null)}
        author={selected?.author ?? null}
        hidden={!!selected && hidden.has(selected.author.id)}
        blocking={busy === 'block'}
        onToggleHide={() => {
          if (!selected) return;
          const id = selected.author.id;
          setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
          setSheet(null);
        }}
        onBlock={() => {
          if (!selected) return;
          const id = selected.author.id;
          void run('block', () => commands.block(id)).then((d) => {
            if (d?.blocked) {
              setHidden((prev) => new Set(prev).add(id));
              toast('Account blocked.', 'info');
              setSheet(null);
            }
          });
        }}
      />
    </div>
  );
}
