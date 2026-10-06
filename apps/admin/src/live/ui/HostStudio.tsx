import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mic,
  MicOff,
  PictureInPicture2,
  Power,
  RefreshCw,
  Settings2,
  SwitchCamera,
  Users,
  Video,
  VideoOff,
  WandSparkles,
  X,
  MicVocal,
} from 'lucide-react';
import type { UserRef } from '../core/events';
import type { LiveCommands } from '../client/LiveCommands';
import type { LiveFeed, LiveRoomController, PersonalNotice } from '../client/LiveRoomController';
import type { LiveComment } from '../client/commentStore';
import type { MediaTransport } from '../client/mediaTransport';
import { describeLiveError } from '../client/errors';
import type { EffectsController } from '../show/effects';
import { useBattleView, useEffectPrefs, useShowChat } from '../show/useLane';
import { FilteredPreview, StreamVideo } from '../media/FilteredPreview';
import type { FilterPipeline } from '../media/FilterPipeline';
import type { FilterParams } from '../media/filterTypes';
import { NO_FILTER_ID } from '../media/filterPresets';
import type { FilterPresetStore } from '../media/presetStore';
import { LocalMediaController, LocalMediaState, MediaSourceKind } from '../media/LocalMediaController';
import { useFilterLibrary, useLocalMedia } from '../media/hooks';
import { TopSupporterChip } from '../moments/TopSupporterChip';
import { LiveFrame } from './LiveFrame';
import { formatDuration, useComments, useLiveRoom, useMediaPresence, usePersonalNotices, useRoomView } from './hooks';
import { ConfirmDialog, IconButton } from './primitives';
import { ConnectionIndicator, LiveBadge, StateScreen, ToastStack, ViewerCount, useToasts } from './status';
import { VideoStage } from './VideoStage';
import { buildStage, battleSides } from './buildStage';
import { ShowOverlay } from './ShowOverlay';
import { CommentComposer, CommentList } from './Comments';
import { FilterSheet } from './FilterSheet';
import { StageManagerSheet } from './StageManagerSheet';
import { BattleInviteCard, HostSettingsSheet, ModerationSheet } from './HostSheets';
import { useGuestRequests, useStagePresentation } from './useHostStage';
import { SupportersSheet } from './ViewerSheets';

export interface HostStudioProps {
  feed: LiveFeed;
  commands: LiveCommands;
  me: UserRef;
  effects: EffectsController;
  media: MediaTransport | null;
  filterStore: FilterPresetStore;
  /** 'camera' in production; the Lab may use the labelled test signal. */
  mediaSource: MediaSourceKind;
  onExit: () => void;
}

/** The creator's control room: the camera stays the hero, controls stay at the edges. */
export function HostStudio(props: HostStudioProps) {
  const controller = useLiveRoom(props.feed, props.effects);
  const localMedia = useHostLocalMedia(props.mediaSource);
  return (
    <LiveFrame effects={props.effects} variant="host" label="LIVE Studio">
      {controller && localMedia ? (
        <StudioBody controller={controller} localMedia={localMedia} {...props} />
      ) : (
        <div className="plv-joining" role="status">
          <span className="plv-joining-ring" aria-hidden="true" />
          <span>Opening your studio…</span>
        </div>
      )}
    </LiveFrame>
  );
}

function useHostLocalMedia(source: MediaSourceKind): LocalMediaController | null {
  const [c, setC] = useState<LocalMediaController | null>(null);
  useEffect(() => {
    const m = new LocalMediaController(source);
    setC(m);
    void m.start({ video: true, audio: true });
    return () => {
      m.dispose();
      setC(null);
    };
  }, [source]);
  return c;
}

type SheetKind = null | 'filters' | 'stage' | 'settings' | 'supporters' | 'moderate' | 'end';

const PROBLEM: Partial<Record<LocalMediaState['camera']['status'], string>> = {
  denied: 'Camera blocked',
  unavailable: 'No camera found',
  'in-use': 'Camera busy',
  insecure: 'Secure connection required',
  error: 'Camera error',
};

function StudioBody({
  controller,
  localMedia,
  commands,
  me,
  effects,
  media,
  filterStore,
  onExit,
}: HostStudioProps & { controller: LiveRoomController; localMedia: LocalMediaController }) {
  const view = useRoomView(controller);
  const comments = useComments(controller);
  const showChat = useShowChat(controller.engine);
  const battleView = useBattleView(controller.engine);
  const presence = useMediaPresence(media);
  const prefs = useEffectPrefs(effects);
  const local = useLocalMedia(localMedia);
  const library = useFilterLibrary(filterStore);
  const { items: toasts, push: toast } = useToasts();

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [draft, setDraft] = useState<{ params: FilterParams; intensity: number } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [pipeline, setPipeline] = useState<FilterPipeline | null>(null);
  const [localMuted, setLocalMuted] = useState<ReadonlySet<string>>(new Set());
  const [modComment, setModComment] = useState<LiveComment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [battleError, setBattleError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);

  const room = view.room;
  const live = room?.status === 'live';
  const guests = room?.guests ?? EMPTY_GUESTS;
  const stageReq = useGuestRequests(controller, commands, room?.liveId ?? null, guests);
  const pres = useStagePresentation(guests);
  const pendingCount = stageReq.requests.filter((r) => r.status === 'pending' || r.status === 'failed').length;

  const onNotice = useCallback(
    (n: PersonalNotice) => {
      if (n.type === 'GUEST_REQUESTED') toast(`${n.user.display_name || n.user.handle} wants to join the stage`, 'info');
    },
    [toast],
  );
  usePersonalNotices(controller, onNotice);

  // ---- Publish the processed camera + mic through the media transport ---------------
  const processed = useMemo(() => pipeline?.captureStream(30) ?? null, [pipeline]);
  const cameraLive = local.camera.status === 'live';
  const micLive = local.mic.status === 'live' && local.mic.enabled;
  useEffect(() => {
    if (!media) return;
    if (!live) {
      media.unpublish(me.id);
      return;
    }
    const tracks: MediaStreamTrack[] = [];
    if (processed && cameraLive) tracks.push(...processed.getVideoTracks());
    if (local.audioTrack) tracks.push(local.audioTrack);
    media.publish(me.id, { stream: tracks.length ? new MediaStream(tracks) : null, cameraOn: cameraLive && !!processed, micOn: micLive });
  }, [media, me.id, processed, cameraLive, micLive, local.audioTrack, live]);
  useEffect(() => () => media?.unpublish(me.id), [media, me.id]);

  // Stop my devices as soon as the LIVE has ended.
  useEffect(() => {
    if (room && !live) {
      void localMedia.setCameraEnabled(false);
      void localMedia.setMicEnabled(false);
    }
  }, [room, live, localMedia]);

  const active = library.active;
  const params = draft?.params ?? active.params;
  const intensity = draft ? draft.intensity : active.id === NO_FILTER_ID ? 0 : library.selection.intensity;
  const mirrored = local.camera.facing === 'user';

  const selfTile = useMemo(
    () => ({
      id: me.id,
      local: (
        <FilteredPreview
          stream={local.videoStream}
          params={params}
          intensity={intensity}
          bypass={comparing}
          mirror={false}
          className={mirrored ? 'is-mirrored' : undefined}
          onPipeline={setPipeline}
        />
      ),
      cameraOn: cameraLive,
      micOn: micLive,
    }),
    [me.id, local.videoStream, params, intensity, comparing, mirrored, cameraLive, micLive],
  );

  const stage = useMemo(
    () =>
      room
        ? buildStage({
            room,
            battle: battleSides(room),
            mode: pres.presentation.mode,
            order: pres.presentation.order,
            featuredId: pres.presentation.featuredId,
            presence,
            self: selfTile,
            localPlaybackMuted: localMuted,
            onSelect: () => setSheet('stage'),
          })
        : null,
    [room, pres.presentation, presence, selfTile, localMuted],
  );

  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }>, okText?: string) => {
      setBusy(key);
      const res = await fn();
      setBusy(null);
      if (!res.ok) {
        const d = describeLiveError(res.code, res.message);
        toast(`${d.title}. ${d.body}`, 'warn');
        return null;
      }
      if (okText) toast(okText, 'success');
      return res.data;
    },
    [toast],
  );

  const closeSheet = useCallback(() => setSheet(null), []);
  const onDraft = useCallback((d: { params: FilterParams; intensity: number } | null) => setDraft(d), []);
  const onCompare = useCallback((v: boolean) => setComparing(v), []);

  // ---- Terminal states ----------------------------------------------------------
  if (view.phase === 'unavailable') {
    const d = describeLiveError(view.unavailable?.code ?? 'LIVE_NOT_FOUND', view.unavailable?.message);
    return <StateScreen title={d.title} body={d.body} primary={{ label: 'Close studio', onClick: onExit, id: 'plv-exit' }} />;
  }
  if (!room || !view.me) {
    return (
      <div className="plv-joining" role="status">
        <span className="plv-joining-ring" aria-hidden="true" />
        <span>Connecting to your LIVE…</span>
      </div>
    );
  }
  if (!view.me.is_host) {
    return <StateScreen title="Not your LIVE" body="Only the creator who started this LIVE can open its studio." primary={{ label: 'Close', onClick: onExit }} />;
  }
  if (!live) {
    return (
      <StateScreen
        icon={<Power size={28} />}
        title="Your LIVE has ended"
        body={
          <>
            {view.startedAt ? <p>You were live for {formatDuration(Date.now() - view.startedAt)}.</p> : null}
            <p>Peak audience: {room.peakViewers.toLocaleString()}.</p>
          </>
        }
        primary={{ label: 'Done', onClick: onExit, id: 'plv-done' }}
      />
    );
  }

  const cam = local.camera;
  const mic = local.mic;
  const camProblem = cam.enabled ? PROBLEM[cam.status] : undefined;
  const micProblem = mic.enabled && mic.status !== 'live' && mic.status !== 'requesting' && mic.status !== 'off' ? mic.message : null;
  const battle = room.battle;
  const invite = battle && battle.status === 'invited' ? battle : null;
  const opponent = invite ? (invite.side_a.host.id === me.id ? invite.side_b.host : invite.side_a.host) : null;
  const battleOnStage = !!battleSides(room);
  const topSupporter = room.topSupporters[0] ?? null;
  const dual = local.dual;
  const link = view.connection.link;

  return (
    <div className="plv-studio">
      <div className="plv-video-layer">
        {stage && <VideoStage layout={stage.layout} columns={stage.columns} tiles={stage.tiles} overflow={stage.overflow} onOverflow={() => setSheet('stage')} />}
        {dual.status === 'on' && dual.stream && (
          <div className="plv-dual-pip" aria-label="Dual: second camera">
            <StreamVideo stream={dual.stream} className="plv-tile-video" label="Second camera" />
            <span className="plv-dual-tag">Dual · preview</span>
          </div>
        )}
      </div>
      <div className="plv-scrim plv-scrim--top" aria-hidden="true" />
      <div className="plv-scrim plv-scrim--bottom" aria-hidden="true" />

      {camProblem && (
        <div className="plv-device-card" role="alert">
          <VideoOff size={22} aria-hidden="true" />
          <strong>{camProblem}</strong>
          <p>{cam.message}</p>
          <button type="button" className="plv-btn plv-btn--iris plv-btn--small" onClick={() => void localMedia.setCameraEnabled(true)} id="plv-camera-retry">
            <RefreshCw size={14} aria-hidden="true" /> Try again
          </button>
        </div>
      )}

      <header className="plv-studio-head">
        <div className="plv-studio-status">
          <LiveBadge startedAt={view.startedAt} />
          <ViewerCount count={room.viewerCount} />
          <ConnectionIndicator connection={view.connection} />
        </div>
        <button type="button" className="plv-end-btn" onClick={() => setSheet('end')} id="plv-end-live">
          End
        </button>
        <div className="plv-head-row2">
          <TopSupporterChip supporter={topSupporter?.user ?? null} totalCoins={topSupporter?.total} onClick={() => setSheet('supporters')} />
          {active.id !== NO_FILTER_ID && (
            <button type="button" className="plv-chip plv-chip--btn" onClick={() => setSheet('filters')} aria-label={`Filter ${active.name}, ${Math.round(library.selection.intensity * 100)}%. Change`}>
              <WandSparkles size={13} aria-hidden="true" /> {active.name} · {Math.round(library.selection.intensity * 100)}%
            </button>
          )}
          {pendingCount > 0 && (
            <button type="button" className="plv-chip plv-chip--btn plv-chip--accent" onClick={() => setSheet('stage')}>
              <Users size={13} aria-hidden="true" /> {pendingCount} {pendingCount === 1 ? 'request' : 'requests'}
            </button>
          )}
          {micProblem && (
            <button type="button" className="plv-chip plv-chip--btn plv-chip--warn" onClick={() => void localMedia.setMicEnabled(true)} title={micProblem}>
              <MicOff size={13} aria-hidden="true" /> Mic unavailable · Retry
            </button>
          )}
        </div>
      </header>

      {link !== 'connected' && (
        <div className="plv-link-banner" role="alert">
          <RefreshCw size={16} className="plv-spin" aria-hidden="true" />
          <span>{link === 'disconnected' ? 'You are offline. Viewers may not see updates.' : 'Reconnecting to your LIVE…'}</span>
          {link === 'disconnected' && (
            <button type="button" className="plv-link-btn" onClick={() => controller.resync()}>
              Retry
            </button>
          )}
        </div>
      )}

      <ShowOverlay engine={controller.engine} />

      {invite && opponent && (
        <BattleInviteCard
          battle={invite}
          from={opponent}
          busy={busy === 'battle'}
          error={battleError}
          onRespond={(accept) => {
            setBattleError(null);
            void run('battle', () => commands.battleRespond(invite.battle_id, accept)).then((d) => {
              if (!d) setBattleError('Could not answer the invitation. It may have expired.');
            });
          }}
        />
      )}

      <nav className="plv-rail" aria-label="Studio tools">
        {cam.canFlip && cam.status === 'live' && (
          <IconButton id="plv-flip" label="Switch camera" icon={<SwitchCamera size={22} />} onClick={() => void localMedia.flip()} disabled={cam.flipping} />
        )}
        <IconButton
          id="plv-filters"
          label="Filters"
          icon={<WandSparkles size={22} />}
          pressed={active.id !== NO_FILTER_ID}
          onClick={() => setSheet('filters')}
        />
        <IconButton id="plv-stage" label="Stage and guests" icon={<Users size={22} />} badge={pendingCount} onClick={() => setSheet('stage')} />
        <IconButton
          id="plv-dual"
          label={dual.status === 'on' ? 'Turn Dual off' : 'Dual: use both cameras'}
          icon={<PictureInPicture2 size={22} />}
          pressed={dual.status === 'on'}
          disabled={dual.status === 'starting' || !cameraLive || battleOnStage}
          onClick={() => void (dual.status === 'on' ? localMedia.stopDual() : localMedia.startDual())}
        />
        <IconButton id="plv-settings" label="LIVE settings" icon={<Settings2 size={22} />} onClick={() => setSheet('settings')} />
      </nav>

      {(dual.status === 'unsupported' || dual.status === 'error') && (
        <div className="plv-inline-alert" role="alert">
          <span>{dual.message}</span>
          <button type="button" aria-label="Dismiss" className="plv-mini-btn" onClick={() => localMedia.dismissDualNotice()}>
            <X size={16} />
          </button>
        </div>
      )}

      <section className={`plv-studio-bottom ${chatOpen ? '' : 'is-chat-collapsed'}`} aria-label="Chat and controls">
        <div className="plv-studio-chat">
          <button type="button" className="plv-chat-toggle" onClick={() => setChatOpen((v) => !v)} aria-expanded={chatOpen} id="plv-chat-toggle">
            {chatOpen ? 'Hide chat' : `Show chat${comments.length ? ` · ${comments.length}` : ''}`}
          </button>
          {chatOpen && (
            <CommentList
              variant="panel"
              comments={comments}
              events={showChat}
              hostId={me.id}
              meId={me.id}
              label="LIVE chat"
              onSelect={(c) => {
                if (c.author.id === me.id) return;
                setModComment(c);
                setSheet('moderate');
              }}
            />
          )}
          {!room.commentsEnabled && <p className="plv-help">Comments are off for viewers.</p>}
        </div>
        <div className="plv-studio-controls">
          <CommentComposer
            id="plv-host-comment"
            placeholder="Reply to chat…"
            disabledReason={link !== 'connected' ? 'Reconnecting…' : null}
            send={async (text) => {
              const res = await commands.comment(room.liveId, text);
              return res.ok ? { ok: true as const } : res;
            }}
          />
          <IconButton
            id="plv-mic"
            size="lg"
            label={micLive ? 'Mute microphone' : 'Unmute microphone'}
            pressed={!micLive}
            tone={micLive ? 'solid' : 'danger'}
            icon={micLive ? <Mic size={24} /> : mic.status === 'requesting' ? <MicVocal size={24} /> : <MicOff size={24} />}
            onClick={() => void localMedia.setMicEnabled(!micLive)}
            disabled={mic.status === 'requesting'}
          />
          <IconButton
            id="plv-camera"
            size="lg"
            label={cameraLive ? 'Turn camera off' : 'Turn camera on'}
            pressed={!cameraLive}
            tone={cameraLive ? 'solid' : 'danger'}
            icon={cameraLive ? <Video size={24} /> : <VideoOff size={24} />}
            onClick={() => void localMedia.setCameraEnabled(!cameraLive)}
            disabled={cam.status === 'requesting' || cam.flipping}
          />
        </div>
      </section>

      <ToastStack items={toasts} />

      <FilterSheet
        open={sheet === 'filters'}
        onClose={closeSheet}
        library={library}
        comparing={comparing}
        onCompare={onCompare}
        onDraft={onDraft}
        pipelineReady={cameraLive && !!pipeline}
      />
      <StageManagerSheet
        open={sheet === 'stage'}
        onClose={closeSheet}
        guests={guests}
        presentation={pres.presentation}
        presence={presence}
        requests={stageReq.requests}
        localMuted={localMuted}
        battleActive={battleOnStage}
        onRespond={(id, accept) => void stageReq.respond(id, accept)}
        onRemove={async (id) => {
          const res = await stageReq.remove(id);
          if (!res.ok) {
            const d = describeLiveError(res.code, res.message);
            toast(`${d.title}. ${d.body}`, 'warn');
          }
          return res.ok;
        }}
        onMove={pres.move}
        onMoveTo={pres.moveTo}
        onFeature={pres.feature}
        onLayout={pres.layout}
        onToggleLocalMute={(id) =>
          setLocalMuted((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onRefreshRequests={() => void stageReq.refresh()}
        onClearHistory={stageReq.clearHistory}
      />
      <HostSettingsSheet
        open={sheet === 'settings'}
        onClose={closeSheet}
        commands={commands}
        title={room.title}
        startedAt={view.startedAt}
        viewers={room.viewerCount}
        peakViewers={room.peakViewers}
        commentsEnabled={room.commentsEnabled}
        togglingComments={busy === 'comments'}
        onToggleComments={(enabled) => void run('comments', () => commands.setCommentsEnabled(room.liveId, enabled))}
        prefs={prefs}
        onPrefs={(p) => effects.setPrefs(p)}
        battle={
          battle && (battleView.stage === 'ACTIVE' || battleView.stage === 'FINAL_COUNTDOWN' || battleView.stage === 'INTRO' || battleView.stage === 'COUNTDOWN')
            ? { busy: busy === 'forfeit', onForfeit: () => void run('forfeit', () => commands.battleForfeit(battle.battle_id), 'You forfeited the battle.') }
            : null
        }
      />
      <SupportersSheet open={sheet === 'supporters'} onClose={closeSheet} supporters={room.topSupporters} />
      <ModerationSheet
        open={sheet === 'moderate'}
        onClose={closeSheet}
        comment={modComment}
        busy={busy}
        onDelete={() =>
          modComment &&
          void run('delete', () => commands.deleteComment(modComment.id), 'Comment deleted.').then((d) => d && setSheet(null))
        }
        onMute={(m) =>
          modComment &&
          void run('mute', () => commands.mute(room.liveId, modComment.author.id, m), `Muted for ${m < 60 ? `${m} minutes` : `${m / 60} hours`}.`).then(
            (d) => d && setSheet(null),
          )
        }
        onKick={() =>
          modComment && void run('kick', () => commands.kick(room.liveId, modComment.author.id), 'Removed from this LIVE.').then((d) => d && setSheet(null))
        }
        onBlock={() =>
          modComment && void run('block', () => commands.block(modComment.author.id), 'Account blocked.').then((d) => d && setSheet(null))
        }
      />
      <ConfirmDialog
        open={sheet === 'end'}
        title="End your LIVE?"
        body={`${room.viewerCount.toLocaleString()} ${room.viewerCount === 1 ? 'person is' : 'people are'} watching.${battleOnStage ? ' The current battle will be cancelled.' : ''} This cannot be undone.`}
        confirmLabel="End LIVE"
        busy={busy === 'end'}
        onCancel={closeSheet}
        onConfirm={() => void run('end', () => commands.endLive(room.liveId)).then(() => setSheet(null))}
      />
    </div>
  );
}

const EMPTY_GUESTS: ReadonlyArray<never> = [];
