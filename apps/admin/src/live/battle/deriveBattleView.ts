/**
 * Battle UI state machine — DERIVED, not toggled.
 *
 * The entire battle presentation is a pure function of (authoritative battle snapshot,
 * estimated server time). There are no scattered booleans: components render `BattleView`.
 *
 * Time-driven stages (INTRO → COUNTDOWN → ACTIVE → FINAL_COUNTDOWN → LOCKED) come from the
 * server-compiled timeline. Fact-driven stages (RESULTS, cancellation) require a server event.
 * The client never declares a winner: past `ends_at` without a result it shows LOCKED.
 */

import { BattleSnapshot, PullScore, Side, TimelineSegment, toMs } from '../core/events';

export type BattleStage =
  | 'IDLE'
  | 'INVITED'
  | 'INTRO'
  | 'COUNTDOWN'
  | 'ACTIVE'
  | 'FINAL_COUNTDOWN'
  | 'LOCKED'
  | 'RESULTS';

export type BonusState = 'none' | 'warning' | 'active';
export type Intensity = 0 | 1 | 2 | 3 | 4;

export interface BattleView {
  battleId: string | null;
  stage: BattleStage;
  bonus: BonusState;
  /** Multiplier of the active or upcoming bonus (display only; scoring is server-side). */
  bonusMultiplier: number;
  /** ms until the upcoming bonus starts (only while bonus === 'warning'). */
  msToBonus: number | null;
  /** ms until the active bonus ends (only while bonus === 'active'). */
  bonusMsRemaining: number | null;
  bonusSegmentIdx: number | null;
  pull: { current: number; total: number } | null;
  inBreak: boolean;
  /** Final countdown urgency tier: 0 outside, then 1..4 as time runs out. */
  intensity: Intensity;
  /** ms until ends_at (0 when locked). */
  msRemaining: number;
  /** 3, 2, 1 during COUNTDOWN; null otherwise. */
  countdownValue: number | null;
  segment: TimelineSegment | null;
  /** Current server-published multiplier for the running segment (display only). */
  multiplier: number;
  scores: { a: number; b: number; pulls: PullScore[] };
  leadSide: Side | null;
  /** Share of the bar owned by side A, 0..1 (0.5 when both are 0). */
  shareA: number;
}

export interface DeriveOptions {
  /** Seconds remaining at which intensity steps up: [tier2, tier3, tier4]. */
  finalTiersS: [number, number, number];
}

export const DEFAULT_DERIVE_OPTIONS: DeriveOptions = { finalTiersS: [20, 10, 5] };

const IDLE_VIEW: BattleView = {
  battleId: null,
  stage: 'IDLE',
  bonus: 'none',
  bonusMultiplier: 1,
  msToBonus: null,
  bonusMsRemaining: null,
  bonusSegmentIdx: null,
  pull: null,
  inBreak: false,
  intensity: 0,
  msRemaining: 0,
  countdownValue: null,
  segment: null,
  multiplier: 0,
  scores: { a: 0, b: 0, pulls: [] },
  leadSide: null,
  shareA: 0.5,
};

function intensityFor(msRemaining: number, tiers: [number, number, number]): Intensity {
  const s = msRemaining / 1000;
  if (s > tiers[0]) return 1;
  if (s > tiers[1]) return 2;
  if (s > tiers[2]) return 3;
  return 4;
}

export function barShareA(a: number, b: number): number {
  const total = a + b;
  return total <= 0 ? 0.5 : a / total;
}

export function deriveBattleView(
  battle: BattleSnapshot | null,
  serverNowMs: number,
  options: DeriveOptions = DEFAULT_DERIVE_OPTIONS,
): BattleView {
  if (!battle || battle.status === 'cancelled' || battle.status === 'expired') return IDLE_VIEW;

  const base: BattleView = {
    ...IDLE_VIEW,
    battleId: battle.battle_id,
    scores: { a: battle.score_a, b: battle.score_b, pulls: battle.pull_scores },
    leadSide: battle.lead_side,
    shareA: barShareA(battle.score_a, battle.score_b),
  };

  if (battle.status === 'invited') return { ...base, stage: 'INVITED' };
  if (battle.result || battle.status === 'finalized') return { ...base, stage: 'RESULTS' };

  const startsAt = toMs(battle.starts_at);
  const endsAt = toMs(battle.ends_at);
  if (startsAt === null || endsAt === null) return { ...base, stage: 'INTRO' };

  const t = serverNowMs;
  if (battle.status === 'locked' || t >= endsAt) return { ...base, stage: 'LOCKED', msRemaining: 0 };

  const timeline = battle.timeline;
  const pullNumbers = Array.from(
    new Set(timeline.filter((s) => s.pull_no !== null).map((s) => s.pull_no as number)),
  );
  const totalPulls = pullNumbers.length;

  let segment: TimelineSegment | null = null;
  for (const seg of timeline) {
    const s0 = Date.parse(seg.starts_at);
    const s1 = Date.parse(seg.ends_at);
    if (t >= s0 && t < s1) {
      segment = seg;
      break;
    }
  }

  const msRemaining = Math.max(0, endsAt - t);
  const view: BattleView = { ...base, segment, msRemaining, multiplier: segment?.multiplier ?? 0 };

  // --- Stage -----------------------------------------------------------------
  if (t < startsAt) {
    if (segment?.kind === 'countdown') {
      const left = Date.parse(segment.ends_at) - t;
      view.stage = 'COUNTDOWN';
      view.countdownValue = Math.max(1, Math.ceil(left / 1000));
    } else {
      view.stage = 'INTRO';
    }
    view.msRemaining = endsAt - startsAt; // full battle length still ahead
    return view;
  }

  const finalMs = battle.final_countdown_ms;
  if (finalMs > 0 && msRemaining <= finalMs) {
    view.stage = 'FINAL_COUNTDOWN';
    view.intensity = intensityFor(msRemaining, options.finalTiersS);
  } else {
    view.stage = 'ACTIVE';
  }

  // --- Pulls -----------------------------------------------------------------
  if (totalPulls > 0) {
    if (segment?.kind === 'pull' && segment.pull_no !== null) {
      view.pull = { current: segment.pull_no, total: totalPulls };
    } else if (segment?.kind === 'break') {
      const nextPull = timeline.find((s) => s.kind === 'pull' && Date.parse(s.starts_at) >= t);
      view.inBreak = true;
      view.pull = { current: nextPull?.pull_no ?? totalPulls, total: totalPulls };
    }
  }

  // --- Bonus (orthogonal to stage; may overlap the final countdown) ------------
  if (segment && segment.multiplier > 1) {
    view.bonus = 'active';
    view.bonusMultiplier = segment.multiplier;
    view.bonusMsRemaining = Date.parse(segment.ends_at) - t;
    view.bonusSegmentIdx = segment.idx;
  } else {
    const upcoming = timeline.find(
      (s) => s.multiplier > 1 && s.warning_ms > 0 && Date.parse(s.starts_at) > t,
    );
    if (upcoming) {
      const msTo = Date.parse(upcoming.starts_at) - t;
      if (msTo <= upcoming.warning_ms) {
        view.bonus = 'warning';
        view.bonusMultiplier = upcoming.multiplier;
        view.msToBonus = msTo;
        view.bonusSegmentIdx = upcoming.idx;
      }
    }
  }

  return view;
}

/** Formats ms as m:ss for timers (ceil so "0:01" shows until the very end). */
export function formatBattleClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
