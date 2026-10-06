import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHOW_CONFIG, LiveShowConfig, MomentKey, mergeShowConfig, resultsDurationMs } from '../show/config';
import { buildMoment } from '../show/rules';
import { DropReason, MomentScheduler } from '../show/scheduler';
import { AnyMoment } from '../show/types';

describe('mergeShowConfig', () => {
  it('returns defaults for non-object input', () => {
    expect(mergeShowConfig(DEFAULT_SHOW_CONFIG, null)).toBe(DEFAULT_SHOW_CONFIG);
    expect(mergeShowConfig(DEFAULT_SHOW_CONFIG, 'x')).toBe(DEFAULT_SHOW_CONFIG);
  });

  it('clamps unsafe values and ignores invalid enums and unknown keys', () => {
    const merged = mergeShowConfig(DEFAULT_SHOW_CONFIG, {
      version: 7,
      moments: {
        gift_epic: { duration_ms: 0, priority: 'ultra', lane: 'stage' },
        gift_rare: { duration_ms: 600_000, haptic: 'explode', sound: null },
        not_a_moment: { duration_ms: 1000 },
      },
      rhythm: { corner_max: 99, quiet_ms: -5 },
      final_countdown: { tiers_s: [1, 2] },
    });
    expect(merged.version).toBe(7);
    expect(merged.moments.gift_epic).toMatchObject({ duration_ms: 300, priority: 'high', lane: 'stage' });
    expect(merged.moments.gift_rare).toMatchObject({ duration_ms: 20_000, haptic: null, sound: null });
    expect('not_a_moment' in merged.moments).toBe(false);
    expect(merged.rhythm.corner_max).toBe(4);
    expect(merged.rhythm.quiet_ms).toBe(0);
    expect(merged.final_countdown.tiers_s).toEqual(DEFAULT_SHOW_CONFIG.final_countdown.tiers_s);
  });

  it('results sequence lasts 11.4 s by default', () => {
    expect(resultsDurationMs(DEFAULT_SHOW_CONFIG)).toBe(11_400);
  });
});

// ---------------------------------------------------------------------------

let idSeq = 0;
function mom(key: MomentKey, over: Partial<AnyMoment> = {}, cfg: LiveShowConfig = DEFAULT_SHOW_CONFIG): AnyMoment {
  const id = `e${++idSeq}`;
  const built = buildMoment(cfg, {
    key,
    kind: 'system',
    source: 'event',
    server_event_id: id,
    created_at: Date.now(),
    // payload shape is irrelevant to scheduling
    payload: {} as never,
  });
  if (!built) throw new Error(`moment ${key} disabled`);
  return { ...built, ...over } as AnyMoment;
}

function setup(cfg: LiveShowConfig = DEFAULT_SHOW_CONFIG) {
  const dropped: Array<[string, DropReason]> = [];
  const shown: string[] = [];
  const s = new MomentScheduler({
    config: () => cfg,
    now: () => Date.now(),
    onActivate: (a) => shown.push(a.moment.key),
    onDrop: (m, r) => dropped.push([m.key, r]),
  });
  const keys = (lane: Parameters<typeof s.getLane>[0]) => s.getLane(lane).map((a) => a.moment.key);
  return { s, dropped, shown, keys };
}

describe('MomentScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-10-04T20:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('respects corner capacity and shows queued items when a slot frees', () => {
    const { s, keys } = setup();
    s.submit(mom('gift_common'));
    s.submit(mom('gift_common'));
    s.submit(mom('guest_left'));
    expect(keys('corner')).toEqual(['gift_common', 'gift_common']);
    expect(s.queuedCount('corner')).toBe(1);
    vi.advanceTimersByTime(2600);
    expect(keys('corner')).toEqual(['guest_left']);
  });

  it('orders the queue by priority, then arrival', () => {
    const { s, shown } = setup();
    s.submit(mom('system_notice'));
    s.submit(mom('system_notice'));
    s.submit(mom('guest_left', { max_wait_ms: 10_000 })); // low
    s.submit(mom('guest_joined')); // medium, arrives later
    vi.advanceTimersByTime(4000);
    expect(shown.slice(2)).toEqual(['guest_joined', 'guest_left']);
  });

  it('drops queued moments that exceed max_wait', () => {
    const { s, dropped } = setup();
    s.submit(mom('system_notice'));
    s.submit(mom('system_notice'));
    s.submit(mom('gift_common', { max_wait_ms: 1000 }));
    vi.advanceTimersByTime(4000);
    expect(dropped).toContainEqual(['gift_common', 'expired']);
  });

  it('shows a dedupe key once, even after reset', () => {
    const { s, dropped } = setup();
    s.submit(mom('double_started', { dedupe_key: 'double_started:b1:3' }));
    s.submit(mom('double_started', { dedupe_key: 'double_started:b1:3' }));
    s.reset();
    s.submit(mom('double_started', { dedupe_key: 'double_started:b1:3' }));
    expect(dropped).toEqual([
      ['double_started', 'duplicate'],
      ['double_started', 'duplicate'],
    ]);
  });

  it('drops low/medium moments on cooldown; high moments wait for it', () => {
    const { s, dropped, shown } = setup();
    s.submit(mom('supporter_top'));
    s.submit(mom('supporter_top'));
    expect(dropped).toEqual([['supporter_top', 'cooldown']]);

    s.submit(mom('lead_change'));
    s.submit(mom('lead_change', { max_wait_ms: 10_000 }));
    expect(shown.filter((k) => k === 'lead_change')).toHaveLength(1);
    vi.advanceTimersByTime(5_999);
    expect(shown.filter((k) => k === 'lead_change')).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(shown.filter((k) => k === 'lead_change')).toHaveLength(2);
  });

  it('critical preempts a preemptible moment, which is re-queued', () => {
    const { s, keys, shown } = setup();
    s.submit(mom('double_started'));
    expect(keys('banner')).toEqual(['double_started']);
    s.submit(mom('moderation_notice'));
    expect(keys('banner')).toEqual(['moderation_notice']);
    vi.advanceTimersByTime(3500);
    expect(keys('banner')).toEqual(['double_started']);
    expect(shown).toEqual(['double_started', 'moderation_notice', 'double_started']);
  });

  it('never preempts intro/countdown, runs them before queued gifts, and shortens them when they waited', () => {
    const { s, keys } = setup();
    s.submit(mom('battle_intro', { duration_ms: 1000 }));
    s.submit(mom('gift_legendary')); // critical, arrives during the intro
    s.submit(mom('battle_countdown', { duration_ms: 3700 }));
    expect(keys('stage')).toEqual(['battle_intro']);
    vi.advanceTimersByTime(1000);
    const countdown = s.getLane('stage')[0];
    expect(countdown.moment.key).toBe('battle_countdown');
    expect(countdown.ends_at - countdown.started_at).toBe(2700); // aligned to the fight time
    vi.advanceTimersByTime(2700);
    expect(keys('stage')).toEqual(['gift_legendary']);
  });

  it('countdown interrupts a legendary gift, which is replayed afterwards', () => {
    const { s, keys, shown } = setup();
    s.submit(mom('gift_legendary'));
    vi.advanceTimersByTime(1000);
    s.submit(mom('battle_countdown', { duration_ms: 3700 }));
    expect(keys('stage')).toEqual(['battle_countdown']);
    vi.advanceTimersByTime(3700);
    expect(keys('stage')).toEqual(['gift_legendary']);
    expect(shown).toEqual(['gift_legendary', 'battle_countdown', 'gift_legendary']);
  });

  it('nothing interrupts results', () => {
    const { s, keys } = setup();
    s.submit(mom('battle_result'));
    s.submit(mom('gift_legendary'));
    s.submit(mom('battle_countdown'));
    expect(keys('stage')).toEqual(['battle_result']);
  });

  it('keeps stage/banner quiet after a high moment, for anything below high', () => {
    const { s, keys } = setup();
    s.submit(mom('double_started')); // high banner, 2600 ms → quiet until 5100
    vi.advanceTimersByTime(100);
    s.submit(mom('viewer_milestone')); // medium banner
    vi.advanceTimersByTime(4900);
    expect(keys('banner')).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(keys('banner')).toEqual(['viewer_milestone']);
  });

  it('never blocks corner moments with the quiet window', () => {
    const { s, keys } = setup();
    s.submit(mom('double_started'));
    s.submit(mom('gift_common'));
    expect(keys('corner')).toEqual(['gift_common']);
  });

  it('only critical banners appear over a non-preemptible stage moment (results)', () => {
    const { s, keys } = setup();
    s.submit(mom('battle_result'));
    s.submit(mom('lead_change'));
    expect(keys('banner')).toEqual([]);
    s.submit(mom('moderation_notice'));
    expect(keys('banner')).toEqual(['moderation_notice']);
  });

  it('suppresses low corner moments during the final countdown', () => {
    const { s, dropped, keys } = setup();
    s.submit(mom('system_notice'));
    s.submit(mom('system_notice'));
    s.submit(mom('guest_left')); // queued low corner
    s.setContext({ finalCountdown: true });
    expect(dropped).toContainEqual(['guest_left', 'suppressed']);
    s.submit(mom('gift_common'));
    expect(dropped).toContainEqual(['gift_common', 'suppressed']);
    vi.advanceTimersByTime(4000);
    s.submit(mom('gift_rare'));
    expect(keys('corner')).toEqual(['gift_rare']);
  });

  it('bar effects never queue', () => {
    const { s, dropped, keys } = setup();
    for (let i = 0; i < 4; i++) s.submit(mom('bar_surge'));
    expect(keys('bar_fx')).toHaveLength(3);
    expect(dropped).toEqual([['bar_surge', 'lane_full']]);
  });

  it('purges matching active and queued moments', () => {
    const { s, keys, dropped } = setup();
    s.submit(mom('lead_change'));
    s.submit(mom('comeback'));
    s.purge((m) => m.key === 'lead_change' || m.key === 'comeback');
    expect(keys('banner')).toEqual([]);
    expect(dropped).toEqual([['comeback', 'purged']]);
  });

  it('dismiss frees the slot immediately', () => {
    const { s, keys } = setup();
    const m = mom('system_notice');
    s.submit(m);
    s.dismiss(m.id);
    expect(keys('corner')).toEqual([]);
  });

  it('lane snapshots are referentially stable between changes', () => {
    const { s } = setup();
    const listener = vi.fn();
    s.subscribe('corner', listener);
    const before = s.getLane('corner');
    expect(s.getLane('corner')).toBe(before);
    s.submit(mom('gift_common'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(s.getLane('corner')).not.toBe(before);
  });

  it('ignores moments configured for the chat lane only', () => {
    const cfg: LiveShowConfig = {
      ...DEFAULT_SHOW_CONFIG,
      moments: { ...DEFAULT_SHOW_CONFIG.moments, follow: { ...DEFAULT_SHOW_CONFIG.moments.follow, lane: 'chat_line' } },
    };
    const { s, dropped } = setup(cfg);
    s.submit(mom('follow', {}, cfg));
    expect(dropped).toEqual([['follow', 'not_visual']]);
  });
});
