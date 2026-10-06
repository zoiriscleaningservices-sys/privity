/**
 * LiveRoomController — the single client-side source of truth a LIVE screen renders from.
 *
 *   LiveFeed (snapshot + ordered events + personal notices + link status)
 *     ├─► roomState reducer (S1)        → room
 *     ├─► LiveShowEngine (S1)           → moments, battle view, show chat
 *     ├─► CommentStore                  → comments
 *     └─► me (snapshot.me + events + notices + confirmed command results)
 *
 * Production feed = LiveEventStore over the private `live:{id}` + `user:{id}` channels.
 * LIVE Lab feed   = SimulatedLiveBackend implementing the same server contract.
 * Nothing here invents authoritative values.
 */

import { AnyLiveEvent, BattleSnapshot, GuestStatus, LiveSnapshot, SnapshotMe, UserRef, toMs } from '../core/events';
import { LiveRoomState, applyLiveEvent, clearFinishedBattle, roomStateFromSnapshot } from '../core/roomState';
import { EffectsController } from '../show/effects';
import { LiveShowEngine } from '../show/LiveShowEngine';
import { CommentStore } from './commentStore';
import { ConnectionState, INITIAL_CONNECTION, ParticipantMedia } from './connection';

/** Notices on the personal `user:{id}` channel (live.notify_user). */
export type PersonalNotice =
  | { type: 'GUEST_REQUESTED'; live_id: string; request_id: string; user: UserRef; server_ts: string }
  | { type: 'GUEST_REQUEST_CANCELLED'; live_id: string; request_id: string; server_ts: string }
  | { type: 'GUEST_ACCEPTED'; live_id: string; slot: number; server_ts: string }
  | { type: 'GUEST_DECLINED'; live_id: string; server_ts: string }
  | { type: 'GUEST_REMOVED'; live_id: string; server_ts: string }
  | { type: 'MUTED'; live_id: string; muted_until: string; server_ts: string }
  | { type: 'UNMUTED'; live_id: string; server_ts: string }
  | { type: 'REMOVED_FROM_LIVE'; live_id: string; server_ts: string }
  | { type: 'BATTLE_INVITED'; battle: BattleSnapshot; from: UserRef; server_ts: string }
  | { type: 'BATTLE_CANCELLED'; battle_id: string; reason: string; server_ts: string };

export interface LiveFeedHandlers {
  onSnapshot(s: LiveSnapshot): void;
  onEvent(e: AnyLiveEvent, ctx: { replayed: boolean }): void;
  onPersonal(n: PersonalNotice): void;
  onConnection(c: ConnectionState): void;
  onUnavailable(code: string, message: string): void;
}

export interface LiveFeed {
  connect(h: LiveFeedHandlers): () => void;
  /** Re-fetch an authoritative snapshot (reconnect, overdue battle finalization). */
  resync(): void;
}

/** Remote participants' media (Stage 4: LiveKit). */
export interface MediaPresenceSource {
  get(): ReadonlyMap<string, ParticipantMedia>;
  subscribe(fn: () => void): () => void;
}

export type RoomPhase = 'connecting' | 'ready' | 'unavailable';

export interface RoomView {
  phase: RoomPhase;
  unavailable: { code: string; message: string } | null;
  room: LiveRoomState | null;
  me: SnapshotMe | null;
  startedAt: number | null;
  connection: ConnectionState;
  /** Set when the server removed this user from the LIVE (kick / block). */
  removed: boolean;
}

const INITIAL_VIEW: RoomView = {
  phase: 'connecting',
  unavailable: null,
  room: null,
  me: null,
  startedAt: null,
  connection: INITIAL_CONNECTION,
  removed: false,
};

export interface LiveRoomControllerOptions {
  feed: LiveFeed;
  effects: EffectsController;
  now?: () => number;
}

export class LiveRoomController {
  readonly engine: LiveShowEngine;
  readonly comments = new CommentStore();
  readonly effects: EffectsController;
  private view: RoomView = INITIAL_VIEW;
  private readonly listeners = new Set<() => void>();
  private readonly personalListeners = new Set<(n: PersonalNotice) => void>();
  private disconnect: (() => void) | null = null;
  private disposed = false;

  constructor(private readonly opts: LiveRoomControllerOptions) {
    this.effects = opts.effects;
    this.engine = new LiveShowEngine({
      now: opts.now ?? (() => Date.now()),
      effects: opts.effects,
      onResultsComplete: (battleId) => {
        const room = this.view.room;
        if (!room) return;
        const next = clearFinishedBattle(room, battleId);
        if (next !== room) {
          this.patch({ room: next });
          this.engine.applySnapshot(next);
        }
      },
      // The client never declares a winner: ask for a fresh authoritative snapshot instead.
      onFinalizeOverdue: () => opts.feed.resync(),
    });
  }

  start(): void {
    if (this.disconnect || this.disposed) return;
    this.disconnect = this.opts.feed.connect({
      onSnapshot: (s) => this.onSnapshot(s),
      onEvent: (e, ctx) => this.onEvent(e, ctx),
      onPersonal: (n) => this.onPersonal(n),
      onConnection: (c) => this.patch({ connection: c }),
      onUnavailable: (code, message) => this.patch({ phase: 'unavailable', unavailable: { code, message } }),
    });
  }

  dispose(): void {
    this.disposed = true;
    this.disconnect?.();
    this.disconnect = null;
    this.engine.dispose();
    this.listeners.clear();
    this.personalListeners.clear();
  }

  getView(): RoomView {
    return this.view;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  onPersonalNotice(fn: (n: PersonalNotice) => void): () => void {
    this.personalListeners.add(fn);
    return () => {
      this.personalListeners.delete(fn);
    };
  }

  /** Applies a field the SERVER confirmed in a command result (e.g. live_follow → following). */
  confirmMe(patch: Partial<Pick<SnapshotMe, 'following_host' | 'guest_status'>>): void {
    if (!this.view.me) return;
    this.patch({ me: { ...this.view.me, ...patch } });
  }

  resync(): void {
    this.opts.feed.resync();
  }

  // ---------------------------------------------------------------------------

  private onSnapshot(s: LiveSnapshot): void {
    const room = roomStateFromSnapshot(s);
    this.comments.reset(s.recent_comments ?? []);
    this.patch({ phase: 'ready', unavailable: null, room, me: s.me, startedAt: toMs(s.started_at) });
    this.engine.applySnapshot(room);
  }

  private onEvent(e: AnyLiveEvent, ctx: { replayed: boolean }): void {
    const room = this.view.room;
    if (!room) return;
    const next = applyLiveEvent(room, e);
    this.comments.apply(e);
    const me = this.view.me ? nextMe(this.view.me, e) : null;
    this.patch({ room: next, me });
    this.engine.handleEvent(e, ctx, next);
  }

  private onPersonal(n: PersonalNotice): void {
    const me = this.view.me;
    if (me) {
      const status = guestStatusFromNotice(n);
      if (status) this.patch({ me: { ...me, guest_status: status } });
      if (n.type === 'MUTED') this.patch({ me: { ...(this.view.me as SnapshotMe), muted_until: n.muted_until } });
      if (n.type === 'UNMUTED') this.patch({ me: { ...(this.view.me as SnapshotMe), muted_until: null } });
    }
    if (n.type === 'REMOVED_FROM_LIVE') this.patch({ removed: true });
    for (const fn of this.personalListeners) fn(n);
  }

  private patch(p: Partial<RoomView>): void {
    if (this.disposed) return;
    this.view = { ...this.view, ...p };
    for (const fn of this.listeners) fn();
  }
}

function guestStatusFromNotice(n: PersonalNotice): GuestStatus | null {
  switch (n.type) {
    case 'GUEST_ACCEPTED':
      return 'accepted';
    case 'GUEST_DECLINED':
      return 'declined';
    case 'GUEST_REMOVED':
      return 'removed';
    default:
      return null;
  }
}

function nextMe(me: SnapshotMe, e: AnyLiveEvent): SnapshotMe {
  switch (e.event_type) {
    case 'GUEST_JOINED':
      return e.payload.guest.id === me.user_id ? { ...me, guest_status: 'accepted' } : me;
    case 'GUEST_LEFT':
      return e.payload.guest.id === me.user_id ? { ...me, guest_status: 'left' } : me;
    case 'GUEST_REMOVED':
      return e.payload.guest.id === me.user_id ? { ...me, guest_status: 'removed' } : me;
    case 'LIVE_ENDED':
      return me.guest_status === 'accepted' || me.guest_status === 'requested' ? { ...me, guest_status: null } : me;
    default:
      return me;
  }
}
