/**
 * LiveShowEngine — turns authoritative LIVE facts into a calm, coherent show.
 *
 *   LiveEventStore ──(ordered events / snapshots)──► room reducer ──► LiveShowEngine
 *                                                                     ├─ chat lines (every fact)
 *                                                                     ├─ BattleView (derived, ticked)
 *                                                                     └─ rules → aggregator → scheduler → lanes
 *
 * The engine owns NO authoritative state. It receives the room state the reducer produced and
 * only decides presentation: which moment, where, when, and for how long.
 *
 * Guarantees:
 *  - a snapshot (initial load or reconnect) never replays intros, countdowns or celebrations
 *  - events older than `rhythm.stale_after_ms` update chat/state but are not animated
 *  - after BATTLE_RESULT, late battle moments for that battle are discarded
 *  - LOCKED without a result for too long → `onFinalizeOverdue` (the room asks the server to
 *    finalize and re-fetches a snapshot; the client still never declares a winner)
 */

import { Timers, defaultTimers } from '../core/EventStore';
import { AnyLiveEvent, toMs } from '../core/events';
import { LiveRoomState } from '../core/roomState';
import { BattleStage, BattleView, deriveBattleView } from '../battle/deriveBattleView';
import { DEFAULT_SHOW_CONFIG, LiveShowConfig, resultsDurationMs } from './config';
import { EffectsController } from './effects';
import { MomentAggregator } from './aggregator';
import { chatLineFromEvent, momentsFromEvent, momentsFromTimeline } from './rules';
import { DropReason, MomentScheduler, ShowLane } from './scheduler';
import { ActiveMoment, AnyMoment, ShowChatLine } from './types';

export interface LiveShowEngineOptions {
  /** Estimated server time in ms (ServerClock.now). */
  now: () => number;
  config?: LiveShowConfig;
  timers?: Timers;
  effects?: EffectsController | null;
  tickMs?: number;
  finalizeOverdueMs?: number;
  finalizeRetryMs?: number;
  chatLimit?: number;
  onFinalizeOverdue?: (battleId: string) => void;
  onResultsComplete?: (battleId: string) => void;
  onMomentShown?: (active: ActiveMoment) => void;
  onMomentDropped?: (moment: AnyMoment, reason: DropReason) => void;
}

const TICKING_STAGES = new Set<BattleStage>(['INTRO', 'COUNTDOWN', 'ACTIVE', 'FINAL_COUNTDOWN', 'LOCKED']);

const BATTLE_SCOPED = new Set<AnyLiveEvent['event_type']>([
  'BATTLE_CANCELLED',
  'BATTLE_PHASE_CHANGED',
  'DOUBLE_WARNING',
  'DOUBLE_STARTED',
  'DOUBLE_ENDED',
  'BATTLE_SCORE',
  'BATTLE_LEAD_CHANGED',
  'BATTLE_COMEBACK',
  'BATTLE_SWING',
  'FINAL_COUNTDOWN_STARTED',
  'BATTLE_ENDED',
  'BATTLE_RESULT',
]);

function scopedBattleId(e: AnyLiveEvent): string | null {
  if (!BATTLE_SCOPED.has(e.event_type)) return null;
  return (e.payload as { battle_id: string }).battle_id;
}

export class LiveShowEngine {
  private cfg: LiveShowConfig;
  private room: LiveRoomState | null = null;
  private view: BattleView;
  private prevView: BattleView | null = null;
  private chat: ShowChatLine[] = [];
  private readonly chatListeners = new Set<() => void>();
  private readonly viewListeners = new Set<() => void>();
  private readonly scheduler: MomentScheduler;
  private readonly aggregator: MomentAggregator;
  private readonly timers: Timers;
  private tickTimer: unknown = null;
  private resultsTimer: unknown = null;
  private lastFinalizeRequest: { battleId: string; at: number } | null = null;
  private disposed = false;

  constructor(private readonly opts: LiveShowEngineOptions) {
    this.cfg = opts.config ?? DEFAULT_SHOW_CONFIG;
    this.timers = opts.timers ?? defaultTimers;
    this.view = deriveBattleView(null, 0);
    this.scheduler = new MomentScheduler({
      config: () => this.cfg,
      now: opts.now,
      timers: this.timers,
      onActivate: (a) => {
        opts.effects?.playFor(a.moment);
        opts.onMomentShown?.(a);
      },
      onDrop: opts.onMomentDropped,
    });
    this.aggregator = new MomentAggregator(() => this.cfg, (m) => this.scheduler.submit(m), this.timers);
  }

  // ---------------------------------------------------------------------------
  // Inputs
  // ---------------------------------------------------------------------------

  setConfig(cfg: LiveShowConfig): void {
    this.cfg = cfg;
  }

  getConfig(): LiveShowConfig {
    return this.cfg;
  }

  /** Re-base on an authoritative snapshot (initial load or reconnect). Nothing is replayed. */
  applySnapshot(room: LiveRoomState): void {
    if (this.disposed) return;
    this.aggregator.dispose();
    this.scheduler.reset();
    this.clearResultsTimer();
    this.lastFinalizeRequest = null;
    this.room = room;
    this.view = this.derive();
    this.prevView = this.view; // baseline: timeline transitions are detected from here on
    this.scheduler.setContext({ finalCountdown: this.view.stage === 'FINAL_COUNTDOWN' });
    if (room.battle?.result) {
      // Joined after the result: keep the summary briefly, then let the room clear it.
      this.scheduleResultsComplete(room.battle.battle_id, this.cfg.results.steps_ms.stats);
    }
    this.notifyView();
    this.ensureTicking();
  }

  /**
   * @param e        ordered, de-duplicated event from LiveEventStore
   * @param ctx      delivery context (replayed = arrived via gap range fetch)
   * @param roomAfter room state AFTER the reducer applied `e`
   */
  handleEvent(e: AnyLiveEvent, ctx: { replayed: boolean }, roomAfter: LiveRoomState): void {
    if (this.disposed) return;
    const roomBefore = this.room;
    this.room = roomAfter;
    const battle = roomAfter.battle ?? roomBefore?.battle ?? null;

    const line = chatLineFromEvent(e, { config: this.cfg, battle });
    if (line) this.pushChat(line);

    const battleId = scopedBattleId(e);
    if (battleId && (e.event_type === 'BATTLE_RESULT' || e.event_type === 'BATTLE_CANCELLED')) {
      this.scheduler.purge((m) => m.kind === 'battle' && m.key !== 'battle_result');
    }
    if (e.event_type === 'BATTLE_RESULT' && roomAfter.battle?.battle_id === battleId) {
      this.scheduleResultsComplete(e.payload.battle_id, resultsDurationMs(this.cfg));
    }

    if (this.shouldAnimate(e, ctx, roomBefore, roomAfter, battleId)) {
      for (const m of momentsFromEvent(e, { config: this.cfg, battle: roomAfter.battle })) {
        this.aggregator.submit(m);
      }
    }

    this.tick();
  }

  // ---------------------------------------------------------------------------
  // Outputs
  // ---------------------------------------------------------------------------

  getView(): BattleView {
    return this.view;
  }

  getRoom(): LiveRoomState | null {
    return this.room;
  }

  subscribeBattleView(fn: () => void): () => void {
    this.viewListeners.add(fn);
    return () => {
      this.viewListeners.delete(fn);
    };
  }

  getChat(): ReadonlyArray<ShowChatLine> {
    return this.chat;
  }

  subscribeChat(fn: () => void): () => void {
    this.chatListeners.add(fn);
    return () => {
      this.chatListeners.delete(fn);
    };
  }

  getLane(lane: ShowLane): ReadonlyArray<ActiveMoment> {
    return this.scheduler.getLane(lane);
  }

  subscribeLane(lane: ShowLane, fn: () => void): () => void {
    return this.scheduler.subscribe(lane, fn);
  }

  dismiss(momentId: string): void {
    this.scheduler.dismiss(momentId);
  }

  dispose(): void {
    this.disposed = true;
    if (this.tickTimer !== null) this.timers.clearTimeout(this.tickTimer);
    this.tickTimer = null;
    this.clearResultsTimer();
    this.aggregator.dispose();
    this.scheduler.dispose();
    this.chatListeners.clear();
    this.viewListeners.clear();
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private shouldAnimate(
    e: AnyLiveEvent,
    ctx: { replayed: boolean },
    before: LiveRoomState | null,
    after: LiveRoomState,
    battleId: string | null,
  ): boolean {
    const at = toMs(e.server_ts);
    // Events recovered by a gap fetch arrived late: animate them only while still very fresh.
    const staleAfter = ctx.replayed ? this.cfg.rhythm.stale_after_ms / 2 : this.cfg.rhythm.stale_after_ms;
    if (at !== null && this.opts.now() - at > staleAfter) return false;
    if (battleId) {
      if (after.battle?.battle_id !== battleId) return false; // not the battle on screen
      if (before?.battle?.battle_id === battleId && before.battle.result) return false; // already final
    }
    return true;
  }

  private derive(): BattleView {
    return deriveBattleView(this.room?.battle ?? null, this.opts.now(), {
      finalTiersS: this.cfg.final_countdown.tiers_s,
    });
  }

  private tick(): void {
    if (this.disposed) return;
    const now = this.opts.now();
    const next = this.derive();
    const battle = this.room?.battle ?? null;

    for (const m of momentsFromTimeline(this.prevView, next, battle, this.cfg, now)) this.aggregator.submit(m);
    this.scheduler.setContext({ finalCountdown: next.stage === 'FINAL_COUNTDOWN' });

    if (next.stage === 'LOCKED' && battle && this.opts.onFinalizeOverdue) {
      const endsAt = toMs(battle.ends_at) ?? now;
      const last = this.lastFinalizeRequest;
      const retryMs = this.opts.finalizeRetryMs ?? 5000;
      if (now - endsAt >= (this.opts.finalizeOverdueMs ?? 3000)) {
        if (!last || last.battleId !== battle.battle_id || now - last.at >= retryMs) {
          this.lastFinalizeRequest = { battleId: battle.battle_id, at: now };
          this.opts.onFinalizeOverdue(battle.battle_id);
        }
      }
    }

    const changed = !this.prevView || TICKING_STAGES.has(next.stage) || viewChanged(this.view, next);
    this.prevView = next;
    this.view = next;
    if (changed) this.notifyView();
    this.ensureTicking();
  }

  private ensureTicking(): void {
    if (this.disposed) return;
    const shouldTick = TICKING_STAGES.has(this.view.stage);
    if (shouldTick && this.tickTimer === null) {
      this.tickTimer = this.timers.setTimeout(() => {
        this.tickTimer = null;
        this.tick();
      }, this.opts.tickMs ?? 250);
    } else if (!shouldTick && this.tickTimer !== null) {
      this.timers.clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private scheduleResultsComplete(battleId: string, delayMs: number): void {
    this.clearResultsTimer();
    this.resultsTimer = this.timers.setTimeout(() => {
      this.resultsTimer = null;
      this.opts.onResultsComplete?.(battleId);
    }, Math.max(0, delayMs));
  }

  private clearResultsTimer(): void {
    if (this.resultsTimer !== null) {
      this.timers.clearTimeout(this.resultsTimer);
      this.resultsTimer = null;
    }
  }

  private pushChat(line: ShowChatLine): void {
    const limit = this.opts.chatLimit ?? 200;
    const next = this.chat.length >= limit ? this.chat.slice(this.chat.length - limit + 1) : this.chat.slice();
    next.push(line);
    this.chat = next;
    for (const fn of this.chatListeners) fn();
  }

  private notifyView(): void {
    for (const fn of this.viewListeners) fn();
  }
}

function viewChanged(a: BattleView, b: BattleView): boolean {
  return (
    a.battleId !== b.battleId ||
    a.stage !== b.stage ||
    a.bonus !== b.bonus ||
    a.scores.a !== b.scores.a ||
    a.scores.b !== b.scores.b ||
    a.scores.pulls !== b.scores.pulls ||
    a.leadSide !== b.leadSide ||
    a.pull?.current !== b.pull?.current ||
    a.inBreak !== b.inBreak
  );
}
