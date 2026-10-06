/**
 * Battle format definitions → absolute timeline.
 *
 * The SERVER compiles the authoritative timeline (SQL mirror of `compileTimeline`) when a
 * battle is accepted and freezes it on the battle row. This TS implementation exists so that
 * formats can be validated in admin tooling, used by the dev simulator, and tested against the
 * same rules as the SQL version.
 */

import { TimelineSegment } from '../core/events';

export type FormatSegmentKind = 'normal' | 'bonus' | 'pull' | 'break';

export interface FormatSegment {
  kind: FormatSegmentKind;
  /** Duration in seconds. */
  s: number;
  multiplier?: number;
  /** Seconds of advance audience warning (bonus / multiplied pulls). */
  warning_s?: number;
  pull?: number;
  label?: string;
}

export interface BattleFormatDefinition {
  intro_ms: number;
  countdown_s: number;
  scoring: 'total' | 'pulls';
  tiebreak?: 'total' | 'draw';
  final_countdown_s: number;
  segments: FormatSegment[];
}

export const FORMAT_LIMITS = {
  minActiveS: 30,
  maxActiveS: 30 * 60,
  maxMultiplier: 5,
  maxIntroMs: 10_000,
  maxCountdownS: 10,
} as const;

export function activeDurationS(def: BattleFormatDefinition): number {
  return def.segments.reduce((sum, seg) => sum + seg.s, 0);
}

function segmentMultiplier(seg: FormatSegment): number {
  if (seg.kind === 'break') return 0;
  if (seg.kind === 'normal') return 1;
  return seg.multiplier ?? (seg.kind === 'bonus' ? 2 : 1);
}

/** Returns human-readable validation errors; empty array means valid. */
export function validateFormat(def: BattleFormatDefinition): string[] {
  const errors: string[] = [];
  if (!Array.isArray(def.segments) || def.segments.length === 0) {
    return ['Format must contain at least one segment.'];
  }
  if (def.intro_ms < 0 || def.intro_ms > FORMAT_LIMITS.maxIntroMs) errors.push('intro_ms out of range.');
  if (def.countdown_s < 0 || def.countdown_s > FORMAT_LIMITS.maxCountdownS) {
    errors.push('countdown_s out of range.');
  }

  const total = activeDurationS(def);
  if (total < FORMAT_LIMITS.minActiveS || total > FORMAT_LIMITS.maxActiveS) {
    errors.push(`Active duration ${total}s must be between ${FORMAT_LIMITS.minActiveS}s and ${FORMAT_LIMITS.maxActiveS}s.`);
  }
  if (def.final_countdown_s < 0 || def.final_countdown_s > total) {
    errors.push('final_countdown_s must be within the active duration.');
  }
  if (def.segments[0].kind === 'break' || def.segments[def.segments.length - 1].kind === 'break') {
    errors.push('A format cannot start or end with a break.');
  }

  let elapsed = 0;
  let expectedPull = 1;
  def.segments.forEach((seg, i) => {
    if (!(seg.s > 0) || !Number.isFinite(seg.s)) errors.push(`Segment ${i}: duration must be > 0.`);
    const m = segmentMultiplier(seg);
    if (m < 0 || m > FORMAT_LIMITS.maxMultiplier) errors.push(`Segment ${i}: multiplier out of range.`);
    if (seg.kind === 'bonus' && m <= 1) errors.push(`Segment ${i}: bonus multiplier must be > 1.`);
    if (seg.warning_s !== undefined) {
      if (seg.warning_s < 0) errors.push(`Segment ${i}: warning_s must be >= 0.`);
      if (seg.warning_s > elapsed) errors.push(`Segment ${i}: warning_s exceeds the time before the segment.`);
    }
    if (seg.kind === 'pull') {
      if (seg.pull !== expectedPull) errors.push(`Segment ${i}: pulls must be numbered sequentially from 1.`);
      expectedPull += 1;
    }
    elapsed += seg.s;
  });

  const hasPulls = def.segments.some((s) => s.kind === 'pull');
  if (def.scoring === 'pulls' && !hasPulls) errors.push('Pull scoring requires pull segments.');
  if (hasPulls && def.segments.some((s) => s.kind === 'normal' || s.kind === 'bonus')) {
    errors.push('Pull formats cannot mix normal/bonus segments.');
  }
  return errors;
}

export interface CompiledTimeline {
  intro_at: string;
  starts_at: string;
  ends_at: string;
  final_countdown_ms: number;
  timeline: TimelineSegment[];
}

const iso = (ms: number) => new Date(ms).toISOString();

export function compileTimeline(def: BattleFormatDefinition, introAtMs: number): CompiledTimeline {
  const errors = validateFormat(def);
  if (errors.length > 0) throw new Error(`Invalid battle format: ${errors.join(' ')}`);

  const timeline: TimelineSegment[] = [];
  let cursor = introAtMs;
  const push = (seg: Omit<TimelineSegment, 'idx' | 'starts_at' | 'ends_at'>, durationMs: number) => {
    if (durationMs <= 0) return;
    timeline.push({ ...seg, idx: timeline.length, starts_at: iso(cursor), ends_at: iso(cursor + durationMs) });
    cursor += durationMs;
  };

  push({ kind: 'intro', multiplier: 0, pull_no: null, warning_ms: 0, label_key: null }, def.intro_ms);
  push({ kind: 'countdown', multiplier: 0, pull_no: null, warning_ms: 0, label_key: null }, def.countdown_s * 1000);
  const startsAt = cursor;
  for (const seg of def.segments) {
    push(
      {
        kind: seg.kind,
        multiplier: segmentMultiplier(seg),
        pull_no: seg.kind === 'pull' ? seg.pull ?? null : null,
        warning_ms: (seg.warning_s ?? 0) * 1000,
        label_key: seg.label ?? null,
      },
      seg.s * 1000,
    );
  }
  return {
    intro_at: iso(introAtMs),
    starts_at: iso(startsAt),
    ends_at: iso(cursor),
    final_countdown_ms: def.final_countdown_s * 1000,
    timeline,
  };
}

/** Segment containing t, using [starts_at, ends_at) — identical to the SQL lookup. */
export function segmentAt(timeline: TimelineSegment[], tMs: number): TimelineSegment | null {
  for (const seg of timeline) {
    if (tMs >= Date.parse(seg.starts_at) && tMs < Date.parse(seg.ends_at)) return seg;
  }
  return null;
}

/** Built-in formats. The server's `battle_formats` table is the source of truth; these seed it. */
export const BUILTIN_FORMATS: Record<string, BattleFormatDefinition> = {
  classic_double: {
    intro_ms: 3500,
    countdown_s: 3,
    scoring: 'total',
    final_countdown_s: 30,
    segments: [
      { kind: 'normal', s: 120 },
      { kind: 'bonus', s: 60, multiplier: 2, warning_s: 30, label: 'double' },
      { kind: 'normal', s: 120 },
    ],
  },
  three_pulls: {
    intro_ms: 3500,
    countdown_s: 3,
    scoring: 'pulls',
    tiebreak: 'total',
    final_countdown_s: 15,
    segments: [
      { kind: 'pull', s: 60, pull: 1 },
      { kind: 'break', s: 5 },
      { kind: 'pull', s: 60, pull: 2 },
      { kind: 'break', s: 5 },
      { kind: 'pull', s: 60, pull: 3, multiplier: 2, warning_s: 5, label: 'double' },
    ],
  },
};
