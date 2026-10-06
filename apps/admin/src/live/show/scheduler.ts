/**
 * MomentScheduler — decides WHEN and WHERE a candidate moment is shown.
 *
 * Lanes (screen zones) have fixed capacities so the screen never becomes a pile of popups:
 *   stage 1 · banner 1 · corner `rhythm.corner_max` · bar_fx `rhythm.bar_fx_max` (no queue)
 *
 * Rules, in order:
 *  1. dedupe      — a dedupe_key is shown at most once (server event vs timeline twin, replays)
 *  2. suppression — low corner moments are dropped during the final countdown
 *  3. cooldown    — per cooldown_key; low/medium are dropped, high/critical wait
 *  4. queue       — timeline-aligned first (intro/countdown), then priority, then arrival order;
 *                   items older than max_wait_ms are dropped
 *  5. preemption  — a critical moment replaces a preemptible non-critical stage/banner moment;
 *                   intro/countdown replace any stage moment except results / live ended
 *                   (the replaced one is re-queued and may still show within its max_wait)
 *  6. rhythm      — after a high/critical stage/banner moment, stage/banner stay quiet for
 *                   `rhythm.quiet_ms` for anything below high. Corner moments are never blocked.
 *  7. focus       — while a non-preemptible stage moment (results, live ended) is on screen,
 *                   the banner lane only accepts critical moments.
 */

import { Timers, defaultTimers } from '../core/EventStore';
import { LiveShowConfig, MomentLane, PRIORITY_RANK } from './config';
import { ActiveMoment, AnyMoment } from './types';

export type ShowLane = Exclude<MomentLane, 'chat_line'>;
export const SHOW_LANES: ReadonlyArray<ShowLane> = ['stage', 'banner', 'corner', 'bar_fx'];

export type DropReason = 'duplicate' | 'not_visual' | 'suppressed' | 'cooldown' | 'expired' | 'lane_full' | 'purged';

export interface SchedulerDeps {
  config: () => LiveShowConfig;
  /** Monotonic-enough time source in ms (the engine passes estimated server time). */
  now: () => number;
  timers?: Timers;
  onActivate?: (active: ActiveMoment) => void;
  onEnd?: (active: ActiveMoment, reason: 'completed' | 'dismissed' | 'preempted' | 'purged' | 'reset') => void;
  onDrop?: (moment: AnyMoment, reason: DropReason) => void;
  /** Max remembered dedupe keys. */
  dedupeWindow?: number;
}

export interface SchedulerContext {
  finalCountdown: boolean;
}

interface Queued {
  moment: AnyMoment;
  enqueuedAt: number;
  order: number;
}

/** Moments whose duration is aligned to an absolute server time: waiting shortens them. */
const ALIGNED_KEYS = new Set<AnyMoment['key']>(['battle_intro', 'battle_countdown']);
/** Moments nothing may interrupt. */
const PINNED_KEYS = new Set<AnyMoment['key']>(['battle_result', 'live_ended']);
const MIN_VISIBLE_MS = 300;

const rank = (m: AnyMoment) => PRIORITY_RANK[m.priority];
const isAligned = (m: AnyMoment) => ALIGNED_KEYS.has(m.key);

/** true if `a` should be shown before `b`. Timeline-aligned moments cannot wait, so they go first. */
function before(a: Queued, b: Queued): boolean {
  const al = Number(isAligned(a.moment)) - Number(isAligned(b.moment));
  if (al !== 0) return al > 0;
  const r = rank(a.moment) - rank(b.moment);
  if (r !== 0) return r > 0;
  return a.order < b.order;
}

export class MomentScheduler {
  private readonly active: Record<ShowLane, ActiveMoment[]> = { stage: [], banner: [], corner: [], bar_fx: [] };
  private readonly queue: Record<ShowLane, Queued[]> = { stage: [], banner: [], corner: [], bar_fx: [] };
  private readonly listeners: Record<ShowLane, Set<() => void>> = {
    stage: new Set(),
    banner: new Set(),
    corner: new Set(),
    bar_fx: new Set(),
  };
  private readonly cooldowns = new Map<string, number>();
  private readonly seen = new Set<string>();
  private readonly seenOrder: string[] = [];
  private quietUntil = Number.NEGATIVE_INFINITY;
  private context: SchedulerContext = { finalCountdown: false };
  private wakeTimer: unknown = null;
  private wakeAt = Number.POSITIVE_INFINITY;
  private orderSeq = 0;
  private disposed = false;
  private readonly timers: Timers;
  private readonly dedupeWindow: number;

  constructor(private readonly deps: SchedulerDeps) {
    this.timers = deps.timers ?? defaultTimers;
    this.dedupeWindow = deps.dedupeWindow ?? 1000;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  submit(m: AnyMoment): void {
    if (this.disposed) return;
    if (this.seen.has(m.dedupe_key)) return this.drop(m, 'duplicate');
    this.remember(m.dedupe_key);

    if (m.lane === 'chat_line') return this.drop(m, 'not_visual');
    if (this.isSuppressed(m)) return this.drop(m, 'suppressed');

    const now = this.deps.now();
    if (this.onCooldown(m, now) && rank(m) < PRIORITY_RANK.high) return this.drop(m, 'cooldown');

    this.queue[m.lane].push({ moment: m, enqueuedAt: now, order: this.orderSeq++ });
    this.pump();
  }

  getLane(lane: ShowLane): ReadonlyArray<ActiveMoment> {
    return this.active[lane];
  }

  /** Number of moments waiting in a lane (diagnostics / tests). */
  queuedCount(lane: ShowLane): number {
    return this.queue[lane].length;
  }

  subscribe(lane: ShowLane, fn: () => void): () => void {
    this.listeners[lane].add(fn);
    return () => {
      this.listeners[lane].delete(fn);
    };
  }

  setContext(ctx: SchedulerContext): void {
    if (ctx.finalCountdown === this.context.finalCountdown) return;
    this.context = { ...ctx };
    if (ctx.finalCountdown) {
      for (const lane of SHOW_LANES) {
        this.queue[lane] = this.queue[lane].filter((q) => {
          if (!this.isSuppressed(q.moment)) return true;
          this.drop(q.moment, 'suppressed');
          return false;
        });
      }
    }
    this.pump();
  }

  /** Removes an on-screen moment early (e.g. the viewer closed it). */
  dismiss(momentId: string): void {
    for (const lane of SHOW_LANES) {
      const hit = this.active[lane].find((a) => a.moment.id === momentId);
      if (hit) {
        this.setActive(lane, this.active[lane].filter((a) => a !== hit));
        this.deps.onEnd?.(hit, 'dismissed');
        this.pump();
        return;
      }
    }
  }

  /** Removes queued and active moments matching the predicate (e.g. a finished battle). */
  purge(predicate: (m: AnyMoment) => boolean): void {
    for (const lane of SHOW_LANES) {
      this.queue[lane] = this.queue[lane].filter((q) => {
        if (!predicate(q.moment)) return true;
        this.drop(q.moment, 'purged');
        return false;
      });
      const keep = this.active[lane].filter((a) => !predicate(a.moment));
      if (keep.length !== this.active[lane].length) {
        const removed = this.active[lane].filter((a) => predicate(a.moment));
        this.setActive(lane, keep);
        for (const a of removed) this.deps.onEnd?.(a, 'purged');
      }
    }
    this.pump();
  }

  /** Clears everything on screen and queued. Dedupe memory is kept so nothing replays. */
  reset(): void {
    for (const lane of SHOW_LANES) {
      const was = this.active[lane];
      this.queue[lane] = [];
      if (was.length > 0) {
        this.setActive(lane, []);
        for (const a of was) this.deps.onEnd?.(a, 'reset');
      }
    }
    this.cooldowns.clear();
    this.quietUntil = Number.NEGATIVE_INFINITY;
    this.clearWake();
  }

  dispose(): void {
    this.disposed = true;
    this.clearWake();
    for (const lane of SHOW_LANES) {
      this.listeners[lane].clear();
      this.queue[lane] = [];
      this.active[lane] = [];
    }
  }

  /** Re-evaluates lanes now. Called internally; exposed for the engine tick. */
  pump(): void {
    if (this.disposed) return;
    const now = this.deps.now();
    const cfg = this.deps.config();

    // 1. complete finished moments
    for (const lane of SHOW_LANES) {
      const done = this.active[lane].filter((a) => a.ends_at <= now);
      if (done.length > 0) {
        this.setActive(lane, this.active[lane].filter((a) => a.ends_at > now));
        for (const a of done) this.deps.onEnd?.(a, 'completed');
      }
    }

    // 2. expire queued moments that waited too long
    for (const lane of SHOW_LANES) {
      this.queue[lane] = this.queue[lane].filter((q) => {
        if (now - q.enqueuedAt <= q.moment.max_wait_ms) return true;
        this.drop(q.moment, lane === 'bar_fx' ? 'lane_full' : 'expired');
        return false;
      });
    }

    // 3. activate (stage first: its focus rule affects the banner lane)
    for (const lane of SHOW_LANES) this.fillLane(lane, now, cfg);

    this.scheduleWake(now);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private capacity(lane: ShowLane, cfg: LiveShowConfig): number {
    if (lane === 'corner') return cfg.rhythm.corner_max;
    if (lane === 'bar_fx') return cfg.rhythm.bar_fx_max;
    return 1;
  }

  private isSuppressed(m: AnyMoment): boolean {
    return (
      this.context.finalCountdown &&
      this.deps.config().final_countdown.suppress_low_corner &&
      m.lane === 'corner' &&
      m.priority === 'low'
    );
  }

  private onCooldown(m: AnyMoment, now: number): boolean {
    if (m.cooldown_ms <= 0) return false;
    const until = this.cooldowns.get(m.cooldown_key);
    return until !== undefined && until > now;
  }

  private blockedByRhythm(m: AnyMoment, lane: ShowLane, now: number): boolean {
    if (lane !== 'stage' && lane !== 'banner') return false;
    if (rank(m) < PRIORITY_RANK.high && now < this.quietUntil) return true;
    if (lane === 'banner' && m.priority !== 'critical') {
      return this.active.stage.some((a) => !a.moment.preemptible);
    }
    return false;
  }

  /** Best eligible queued item; drops low/medium items that hit a cooldown. */
  private pickNext(lane: ShowLane, now: number): Queued | null {
    let best: Queued | null = null;
    const keep: Queued[] = [];
    for (const q of this.queue[lane]) {
      keep.push(q);
      if (this.onCooldown(q.moment, now)) {
        if (rank(q.moment) < PRIORITY_RANK.high) {
          keep.pop();
          this.drop(q.moment, 'cooldown');
        }
        continue;
      }
      if (this.blockedByRhythm(q.moment, lane, now)) continue;
      if (!best || before(q, best)) best = q;
    }
    this.queue[lane] = keep;
    return best;
  }

  private fillLane(lane: ShowLane, now: number, cfg: LiveShowConfig): void {
    const cap = this.capacity(lane, cfg);
    for (;;) {
      const next = this.pickNext(lane, now);
      if (!next) return;
      if (this.active[lane].length < cap) {
        this.queue[lane] = this.queue[lane].filter((q) => q !== next);
        this.activate(lane, next, now, cfg);
        continue;
      }
      // Lane full. Critical moments preempt preemptible non-critical stage/banner moments;
      // timeline-aligned moments (intro/countdown) preempt anything on stage except pinned ones.
      if (lane === 'stage' || lane === 'banner') {
        const victim = this.active[lane].find((a) =>
          isAligned(next.moment)
            ? !isAligned(a.moment) && !PINNED_KEYS.has(a.moment.key)
            : next.moment.priority === 'critical' && a.moment.preemptible && a.moment.priority !== 'critical',
        );
        if (victim) {
          this.setActive(lane, this.active[lane].filter((a) => a !== victim));
          this.deps.onEnd?.(victim, 'preempted');
          this.queue[lane] = this.queue[lane].filter((q) => q !== next);
          // Re-queue the interrupted moment; it may still show within its own max_wait.
          this.queue[lane].push({ moment: victim.moment, enqueuedAt: now, order: this.orderSeq++ });
          this.activate(lane, next, now, cfg);
          continue;
        }
      }
      if (lane === 'bar_fx') {
        // bar effects are momentary: never wait for a slot
        this.queue[lane] = this.queue[lane].filter((q) => {
          this.drop(q.moment, 'lane_full');
          return false;
        });
      }
      return;
    }
  }

  private activate(lane: ShowLane, q: Queued, now: number, cfg: LiveShowConfig): void {
    const m = q.moment;
    let duration = m.duration_ms;
    if (ALIGNED_KEYS.has(m.key)) duration = Math.max(MIN_VISIBLE_MS, duration - (now - q.enqueuedAt));
    const active: ActiveMoment = { moment: m, started_at: now, ends_at: now + duration };
    this.setActive(lane, [...this.active[lane], active]);
    if (m.cooldown_ms > 0) this.cooldowns.set(m.cooldown_key, now + m.cooldown_ms);
    if ((lane === 'stage' || lane === 'banner') && rank(m) >= PRIORITY_RANK.high) {
      this.quietUntil = Math.max(this.quietUntil, active.ends_at + cfg.rhythm.quiet_ms);
    }
    this.deps.onActivate?.(active);
  }

  private setActive(lane: ShowLane, next: ActiveMoment[]): void {
    this.active[lane] = next; // new array reference → useSyncExternalStore re-renders
    for (const fn of this.listeners[lane]) fn();
  }

  private drop(m: AnyMoment, reason: DropReason): void {
    this.deps.onDrop?.(m, reason);
  }

  private remember(key: string): void {
    this.seen.add(key);
    this.seenOrder.push(key);
    if (this.seenOrder.length > this.dedupeWindow) {
      const old = this.seenOrder.shift();
      if (old !== undefined) this.seen.delete(old);
    }
  }

  private scheduleWake(now: number): void {
    let next = Number.POSITIVE_INFINITY;
    for (const lane of SHOW_LANES) {
      for (const a of this.active[lane]) next = Math.min(next, a.ends_at);
      for (const q of this.queue[lane]) {
        next = Math.min(next, q.enqueuedAt + q.moment.max_wait_ms + 1);
        const cd = this.cooldowns.get(q.moment.cooldown_key);
        if (cd !== undefined && cd > now) next = Math.min(next, cd);
        if (this.quietUntil > now) next = Math.min(next, this.quietUntil);
      }
    }
    if (next === this.wakeAt && this.wakeTimer !== null) return;
    this.clearWake();
    if (!Number.isFinite(next)) return;
    this.wakeAt = next;
    this.wakeTimer = this.timers.setTimeout(() => {
      this.wakeTimer = null;
      this.wakeAt = Number.POSITIVE_INFINITY;
      this.pump();
    }, Math.max(0, next - now));
  }

  private clearWake(): void {
    if (this.wakeTimer !== null) {
      this.timers.clearTimeout(this.wakeTimer);
      this.wakeTimer = null;
    }
    this.wakeAt = Number.POSITIVE_INFINITY;
  }
}
