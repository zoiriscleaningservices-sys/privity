import { describe, expect, it } from 'vitest';
import { BUILTIN_FORMATS, BattleFormatDefinition, compileTimeline, segmentAt, validateFormat } from '../battle/timeline';
import { barShareA, deriveBattleView, formatBattleClock } from '../battle/deriveBattleView';
import { makeBattle, makeResult } from '../dev/fixtures';

const T = Date.parse('2026-10-04T20:00:00.000Z');
const ms = (iso: string | null) => Date.parse(iso as string);

describe('compileTimeline', () => {
  it('compiles classic_double into contiguous, non-overlapping segments', () => {
    const c = compileTimeline(BUILTIN_FORMATS.classic_double, T);
    expect(c.timeline.map((s) => s.kind)).toEqual(['intro', 'countdown', 'normal', 'bonus', 'normal']);
    expect(ms(c.starts_at)).toBe(T + 3500 + 3000);
    expect(ms(c.ends_at)).toBe(ms(c.starts_at) + 300_000);
    expect(c.final_countdown_ms).toBe(30_000);
    for (let i = 1; i < c.timeline.length; i++) expect(c.timeline[i].starts_at).toBe(c.timeline[i - 1].ends_at);
    const bonus = c.timeline[3];
    expect(bonus).toMatchObject({ multiplier: 2, warning_ms: 30_000 });
    expect(ms(bonus.starts_at)).toBe(ms(c.starts_at) + 120_000);
    expect(c.timeline[0].multiplier).toBe(0); // intro does not score
    expect(c.timeline[1].multiplier).toBe(0); // countdown does not score
  });

  it('compiles three_pulls with non-scoring breaks and a multiplied final pull', () => {
    const c = compileTimeline(BUILTIN_FORMATS.three_pulls, T);
    const active = c.timeline.slice(2);
    expect(active.map((s) => [s.kind, s.pull_no, s.multiplier])).toEqual([
      ['pull', 1, 1],
      ['break', null, 0],
      ['pull', 2, 1],
      ['break', null, 0],
      ['pull', 3, 2],
    ]);
    expect(active[4].warning_ms).toBe(5000);
  });

  it('rejects invalid formats', () => {
    const base: BattleFormatDefinition = { intro_ms: 0, countdown_s: 0, scoring: 'total', final_countdown_s: 10, segments: [] };
    expect(validateFormat(base)).toHaveLength(1);
    expect(validateFormat({ ...base, segments: [{ kind: 'normal', s: 10 }] }).join()).toMatch(/Active duration/);
    expect(validateFormat({ ...base, segments: [{ kind: 'normal', s: 60 }, { kind: 'bonus', s: 60, multiplier: 1 }] }).join()).toMatch(/bonus multiplier/);
    expect(validateFormat({ ...base, segments: [{ kind: 'normal', s: 20 }, { kind: 'bonus', s: 60, warning_s: 30 }] }).join()).toMatch(/warning_s exceeds/);
    expect(validateFormat({ ...base, segments: [{ kind: 'break', s: 5 }, { kind: 'normal', s: 60 }] }).join()).toMatch(/break/);
    expect(
      validateFormat({ ...base, scoring: 'pulls', segments: [{ kind: 'pull', s: 60, pull: 2 }] }).join(),
    ).toMatch(/sequentially/);
    expect(
      validateFormat({ ...base, segments: [{ kind: 'pull', s: 60, pull: 1 }, { kind: 'normal', s: 60 }] }).join(),
    ).toMatch(/cannot mix/);
    expect(validateFormat({ ...base, segments: [{ kind: 'normal', s: 60 }], final_countdown_s: 61 }).join()).toMatch(/final_countdown_s/);
    expect(() => compileTimeline(base, T)).toThrow(/Invalid battle format/);
    expect(validateFormat(BUILTIN_FORMATS.classic_double)).toEqual([]);
    expect(validateFormat(BUILTIN_FORMATS.three_pulls)).toEqual([]);
  });

  it('segmentAt uses [start, end) boundaries', () => {
    const c = compileTimeline(BUILTIN_FORMATS.classic_double, T);
    const bonus = c.timeline[3];
    expect(segmentAt(c.timeline, ms(bonus.starts_at))?.kind).toBe('bonus');
    expect(segmentAt(c.timeline, ms(bonus.starts_at) - 1)?.kind).toBe('normal');
    expect(segmentAt(c.timeline, ms(bonus.ends_at))?.kind).toBe('normal');
    expect(segmentAt(c.timeline, ms(c.ends_at))).toBeNull();
    expect(segmentAt(c.timeline, T - 1)).toBeNull();
  });
});

describe('deriveBattleView', () => {
  const b = makeBattle('classic_double', T);
  const S = ms(b.starts_at);
  const E = ms(b.ends_at);

  it('maps missing / invited / cancelled battles', () => {
    expect(deriveBattleView(null, T).stage).toBe('IDLE');
    expect(deriveBattleView({ ...b, status: 'invited' }, T).stage).toBe('INVITED');
    expect(deriveBattleView({ ...b, status: 'cancelled' }, T).stage).toBe('IDLE');
  });

  it('walks intro → countdown → active from the server timeline', () => {
    expect(deriveBattleView(b, T + 100).stage).toBe('INTRO');
    const c3 = deriveBattleView(b, S - 2500);
    expect([c3.stage, c3.countdownValue]).toEqual(['COUNTDOWN', 3]);
    expect(deriveBattleView(b, S - 1500).countdownValue).toBe(2);
    expect(deriveBattleView(b, S - 1).countdownValue).toBe(1);
    const active = deriveBattleView(b, S);
    expect([active.stage, active.multiplier, active.msRemaining]).toEqual(['ACTIVE', 1, 300_000]);
  });

  it('warns exactly warning_ms before the bonus and then activates it', () => {
    expect(deriveBattleView(b, S + 89_999).bonus).toBe('none');
    const w = deriveBattleView(b, S + 90_000);
    expect([w.bonus, w.msToBonus, w.bonusMultiplier, w.bonusSegmentIdx]).toEqual(['warning', 30_000, 2, 3]);
    const a = deriveBattleView(b, S + 120_000);
    expect([a.bonus, a.multiplier, a.bonusMsRemaining]).toEqual(['active', 2, 60_000]);
    expect(deriveBattleView(b, S + 180_000).bonus).toBe('none');
  });

  it('raises intensity through the final countdown tiers', () => {
    expect(deriveBattleView(b, E - 30_001).stage).toBe('ACTIVE');
    const f = (t: number) => deriveBattleView(b, t);
    expect([f(E - 30_000).stage, f(E - 30_000).intensity]).toEqual(['FINAL_COUNTDOWN', 1]);
    expect(f(E - 15_000).intensity).toBe(2);
    expect(f(E - 8_000).intensity).toBe(3);
    expect(f(E - 3_000).intensity).toBe(4);
  });

  it('allows the bonus to overlap the final countdown', () => {
    const def: BattleFormatDefinition = {
      intro_ms: 0,
      countdown_s: 3,
      scoring: 'total',
      final_countdown_s: 30,
      segments: [{ kind: 'normal', s: 60 }, { kind: 'bonus', s: 60, multiplier: 3, warning_s: 10 }],
    };
    const ob = makeBattle(def, T);
    const v = deriveBattleView(ob, ms(ob.ends_at) - 10_000);
    expect([v.stage, v.bonus, v.multiplier]).toEqual(['FINAL_COUNTDOWN', 'active', 3]);
  });

  it('locks at ends_at without declaring a winner, and shows results only with a server result', () => {
    const locked = deriveBattleView({ ...b, score_a: 10, score_b: 5 }, E);
    expect([locked.stage, locked.msRemaining]).toEqual(['LOCKED', 0]);
    expect(deriveBattleView({ ...b, status: 'locked' }, S + 1000).stage).toBe('LOCKED');
    expect(deriveBattleView({ ...b, status: 'finalized', result: makeResult(10, 5) }, E).stage).toBe('RESULTS');
  });

  it('tracks pulls, breaks and the multiplied final pull', () => {
    const p = makeBattle('three_pulls', T);
    const PS = ms(p.starts_at);
    const v1 = deriveBattleView(p, PS + 1000);
    expect([v1.pull, v1.inBreak]).toEqual([{ current: 1, total: 3 }, false]);
    const brk = deriveBattleView(p, PS + 61_000);
    expect([brk.pull, brk.inBreak, brk.multiplier]).toEqual([{ current: 2, total: 3 }, true, 0]);
    const warn = deriveBattleView(p, PS + 60_000 + 5_000 + 60_000 + 1_000); // second break
    expect([warn.bonus, warn.pull?.current]).toEqual(['warning', 3]);
    const last = deriveBattleView(p, PS + 60_000 + 5_000 + 60_000 + 5_000 + 1_000);
    expect([last.pull?.current, last.bonus, last.multiplier]).toEqual([3, 'active', 2]);
  });

  it('a viewer reconnecting inside the final countdown gets the same view as everyone else', () => {
    const fresh = deriveBattleView({ ...b, score_a: 900, score_b: 1200, lead_side: 'b' }, E - 7_000);
    expect(fresh).toMatchObject({ stage: 'FINAL_COUNTDOWN', intensity: 3, leadSide: 'b', msRemaining: 7_000 });
  });

  it('bar share and clock formatting', () => {
    expect(barShareA(0, 0)).toBe(0.5);
    expect(barShareA(300, 100)).toBe(0.75);
    expect(formatBattleClock(61_000)).toBe('1:01');
    expect(formatBattleClock(500)).toBe('0:01');
    expect(formatBattleClock(0)).toBe('0:00');
    expect(formatBattleClock(-5)).toBe('0:00');
  });
});
