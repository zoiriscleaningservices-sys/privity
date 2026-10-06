/**
 * Live Show configuration.
 *
 * The authoritative document lives in `live_show_config` (versioned, admin-published) and is
 * delivered with the snapshot / CONFIG_UPDATED. The client ships these defaults so the show
 * still works if the config cannot be fetched. Server values are merged and CLAMPED so a bad
 * publish can never produce unusable presentation (e.g. 0 ms or 10 minute banners).
 *
 * Detector thresholds (lead hysteresis, comeback, swing, supporter, streak, viewer milestones)
 * are evaluated on the SERVER; they are part of the same document so ops edit one place.
 */

export type MomentPriority = 'critical' | 'high' | 'medium' | 'low';
export type MomentLane = 'stage' | 'banner' | 'corner' | 'bar_fx' | 'chat_line';
export type HapticPattern = 'tap' | 'success' | 'heavy';

export const PRIORITY_RANK: Record<MomentPriority, number> = { critical: 3, high: 2, medium: 1, low: 0 };

export type MomentKey =
  | 'gift_common'
  | 'gift_rare'
  | 'gift_epic'
  | 'gift_legendary'
  | 'gift_aggregate'
  | 'gift_streak'
  | 'bar_tick'
  | 'bar_surge'
  | 'supporter_top'
  | 'supporter_milestone'
  | 'viewers_joined'
  | 'viewer_milestone'
  | 'follow'
  | 'follow_milestone'
  | 'guest_joined'
  | 'guest_left'
  | 'battle_intro'
  | 'battle_countdown'
  | 'double_warning'
  | 'double_started'
  | 'double_ended'
  | 'pull_started'
  | 'final_countdown'
  | 'lead_change'
  | 'lead_change_final'
  | 'comeback'
  | 'swing'
  | 'battle_result'
  | 'live_ended'
  | 'system_notice'
  | 'moderation_notice';

export interface MomentSpec {
  enabled: boolean;
  priority: MomentPriority;
  lane: MomentLane;
  duration_ms: number;
  cooldown_ms: number;
  max_wait_ms: number;
  /** Critical moments may preempt preemptible moments in stage/banner lanes. */
  preemptible: boolean;
  /** Low-priority moments may be batched by the aggregator. */
  aggregatable: boolean;
  sound: string | null;
  haptic: HapticPattern | null;
}

export interface LiveShowConfig {
  version: number;
  moments: Record<MomentKey, MomentSpec>;
  rhythm: {
    /** Quiet window after a critical/high stage or banner moment. */
    quiet_ms: number;
    corner_max: number;
    bar_fx_max: number;
    aggregate_window_ms: number;
    /** Events older than this (server time) update state but are not animated. */
    stale_after_ms: number;
  };
  final_countdown: { tiers_s: [number, number, number]; suppress_low_corner: boolean };
  results: { steps_ms: { complete: number; settle: number; winner: number; supporters: number; stats: number } };
  /** Server-evaluated thresholds (documented here, not used for decisions on the client). */
  detectors: {
    lead: { hysteresis_points: number; hysteresis_pct: number; cooldown_s: number; final_moment_s: number };
    comeback: { min_deficit_pct: number; min_deficit_points: number; close_pct: number };
    swing: { pct_of_total: number; min_points: number };
    supporter: { top_min_coins: number; top_cooldown_s: number; thresholds: number[] };
    streak: { window_ms: number; emit_at: number[] };
    viewers: { milestones: number[]; join_sample: number };
    /** New followers gained during one LIVE. */
    follows: { milestones: number[] };
  };
}

const m = (
  priority: MomentPriority,
  lane: MomentLane,
  duration_ms: number,
  cooldown_ms: number,
  max_wait_ms: number,
  extra: Partial<MomentSpec> = {},
): MomentSpec => ({
  enabled: true,
  priority,
  lane,
  duration_ms,
  cooldown_ms,
  max_wait_ms,
  preemptible: priority !== 'critical',
  aggregatable: false,
  sound: null,
  haptic: null,
  ...extra,
});

export const DEFAULT_SHOW_CONFIG: LiveShowConfig = {
  version: 0,
  moments: {
    gift_common: m('low', 'corner', 2600, 0, 4000, { aggregatable: true }),
    gift_rare: m('medium', 'corner', 3200, 0, 5000, { sound: 'gift_rare' }),
    gift_epic: m('high', 'banner', 3800, 0, 6000, { sound: 'gift_epic', haptic: 'success' }),
    gift_legendary: m('critical', 'stage', 6500, 0, 15000, { sound: 'gift_legendary', haptic: 'heavy' }),
    gift_aggregate: m('low', 'corner', 2800, 0, 4000),
    gift_streak: m('medium', 'corner', 2600, 4000, 4000),
    bar_tick: m('low', 'bar_fx', 500, 350, 0),
    bar_surge: m('high', 'bar_fx', 900, 0, 0, { haptic: 'tap' }),
    supporter_top: m('medium', 'corner', 3600, 15000, 6000, { sound: 'supporter' }),
    supporter_milestone: m('medium', 'corner', 3600, 0, 6000, { sound: 'supporter' }),
    viewers_joined: m('low', 'corner', 2400, 0, 3000, { aggregatable: true }),
    viewer_milestone: m('medium', 'banner', 3200, 0, 8000, { sound: 'milestone' }),
    follow: m('low', 'corner', 2400, 0, 3000, { aggregatable: true }),
    follow_milestone: m('medium', 'banner', 3200, 0, 8000, { sound: 'milestone' }),
    guest_joined: m('medium', 'corner', 2800, 0, 5000),
    guest_left: m('low', 'corner', 2200, 0, 3000),
    // Intro and countdown are aligned to the server timeline: never preempted.
    battle_intro: m('high', 'stage', 3500, 0, 2500, { preemptible: false, sound: 'battle_intro', haptic: 'success' }),
    battle_countdown: m('high', 'stage', 3700, 0, 1500, { preemptible: false, sound: 'countdown' }),
    double_warning: m('high', 'banner', 3000, 0, 5000, { sound: 'double_warning' }),
    double_started: m('high', 'banner', 2600, 0, 4000, { sound: 'double_start', haptic: 'success' }),
    double_ended: m('low', 'corner', 2200, 0, 3000),
    pull_started: m('high', 'banner', 2200, 0, 3000, { sound: 'pull' }),
    final_countdown: m('high', 'banner', 2400, 0, 3000, { sound: 'final' , haptic: 'tap' }),
    lead_change: m('high', 'banner', 1800, 6000, 2500, { sound: 'lead', haptic: 'tap' }),
    lead_change_final: m('critical', 'banner', 2000, 0, 2000, { sound: 'lead_final', haptic: 'heavy' }),
    comeback: m('high', 'banner', 2400, 10000, 3000, { sound: 'comeback', haptic: 'success' }),
    swing: m('high', 'bar_fx', 1000, 1500, 0),
    battle_result: m('critical', 'stage', 11400, 0, 30000, { preemptible: false, sound: 'result', haptic: 'success' }),
    live_ended: m('critical', 'stage', 4000, 0, 30000, { preemptible: false }),
    system_notice: m('medium', 'corner', 4000, 0, 10000),
    moderation_notice: m('critical', 'banner', 3500, 0, 10000),
  },
  rhythm: {
    quiet_ms: 2500,
    corner_max: 2,
    bar_fx_max: 3,
    aggregate_window_ms: 2000,
    stale_after_ms: 8000,
  },
  final_countdown: { tiers_s: [20, 10, 5], suppress_low_corner: true },
  results: { steps_ms: { complete: 1200, settle: 1200, winner: 2500, supporters: 2500, stats: 4000 } },
  detectors: {
    lead: { hysteresis_points: 50, hysteresis_pct: 0.02, cooldown_s: 6, final_moment_s: 10 },
    comeback: { min_deficit_pct: 0.3, min_deficit_points: 500, close_pct: 0.6 },
    swing: { pct_of_total: 0.15, min_points: 2000 },
    supporter: { top_min_coins: 100, top_cooldown_s: 20, thresholds: [500, 1000, 5000, 10000] },
    streak: { window_ms: 4000, emit_at: [5, 10, 25, 50] },
    viewers: { milestones: [100, 500, 1000, 5000, 10000], join_sample: 3 },
    follows: { milestones: [10, 50, 100, 500, 1000] },
  },
};

// ---------------------------------------------------------------------------
// Merge + clamp
// ---------------------------------------------------------------------------

const PRIORITIES = new Set<MomentPriority>(['critical', 'high', 'medium', 'low']);
const LANES = new Set<MomentLane>(['stage', 'banner', 'corner', 'bar_fx', 'chat_line']);
const HAPTICS = new Set<HapticPattern>(['tap', 'success', 'heavy']);

const clamp = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

function mergeMoment(base: MomentSpec, patch: unknown): MomentSpec {
  if (typeof patch !== 'object' || patch === null) return base;
  const p = patch as Partial<Record<keyof MomentSpec, unknown>>;
  return {
    enabled: typeof p.enabled === 'boolean' ? p.enabled : base.enabled,
    priority: PRIORITIES.has(p.priority as MomentPriority) ? (p.priority as MomentPriority) : base.priority,
    lane: LANES.has(p.lane as MomentLane) ? (p.lane as MomentLane) : base.lane,
    duration_ms: clamp(p.duration_ms, 300, 20000, base.duration_ms),
    cooldown_ms: clamp(p.cooldown_ms, 0, 300000, base.cooldown_ms),
    max_wait_ms: clamp(p.max_wait_ms, 0, 60000, base.max_wait_ms),
    preemptible: typeof p.preemptible === 'boolean' ? p.preemptible : base.preemptible,
    aggregatable: typeof p.aggregatable === 'boolean' ? p.aggregatable : base.aggregatable,
    sound: p.sound === null || typeof p.sound === 'string' ? (p.sound as string | null) : base.sound,
    haptic: p.haptic === null || HAPTICS.has(p.haptic as HapticPattern) ? (p.haptic as HapticPattern | null) : base.haptic,
  };
}

/** Merge an untrusted server config document onto defaults with validation and clamping. */
export function mergeShowConfig(base: LiveShowConfig, patch: unknown): LiveShowConfig {
  if (typeof patch !== 'object' || patch === null) return base;
  const p = patch as Record<string, any>;
  const moments = { ...base.moments };
  if (p.moments && typeof p.moments === 'object') {
    for (const key of Object.keys(moments) as MomentKey[]) {
      if (key in p.moments) moments[key] = mergeMoment(moments[key], p.moments[key]);
    }
  }
  const r = p.rhythm ?? {};
  const tiers = Array.isArray(p.final_countdown?.tiers_s) && p.final_countdown.tiers_s.length === 3
    ? (p.final_countdown.tiers_s.map((v: unknown, i: number) =>
        clamp(v, 1, 600, base.final_countdown.tiers_s[i]),
      ) as [number, number, number])
    : base.final_countdown.tiers_s;
  const steps = p.results?.steps_ms ?? {};
  const bs = base.results.steps_ms;
  return {
    version: clamp(p.version, 0, Number.MAX_SAFE_INTEGER, base.version),
    moments,
    rhythm: {
      quiet_ms: clamp(r.quiet_ms, 0, 15000, base.rhythm.quiet_ms),
      corner_max: Math.round(clamp(r.corner_max, 1, 4, base.rhythm.corner_max)),
      bar_fx_max: Math.round(clamp(r.bar_fx_max, 1, 8, base.rhythm.bar_fx_max)),
      aggregate_window_ms: clamp(r.aggregate_window_ms, 250, 10000, base.rhythm.aggregate_window_ms),
      stale_after_ms: clamp(r.stale_after_ms, 1000, 120000, base.rhythm.stale_after_ms),
    },
    final_countdown: {
      tiers_s: tiers,
      suppress_low_corner:
        typeof p.final_countdown?.suppress_low_corner === 'boolean'
          ? p.final_countdown.suppress_low_corner
          : base.final_countdown.suppress_low_corner,
    },
    results: {
      steps_ms: {
        complete: clamp(steps.complete, 300, 10000, bs.complete),
        settle: clamp(steps.settle, 300, 10000, bs.settle),
        winner: clamp(steps.winner, 300, 10000, bs.winner),
        supporters: clamp(steps.supporters, 300, 10000, bs.supporters),
        stats: clamp(steps.stats, 300, 15000, bs.stats),
      },
    },
    detectors: typeof p.detectors === 'object' && p.detectors !== null
      ? { ...base.detectors, ...p.detectors }
      : base.detectors,
  };
}

export function resultsDurationMs(cfg: LiveShowConfig): number {
  const s = cfg.results.steps_ms;
  return s.complete + s.settle + s.winner + s.supporters + s.stats;
}
