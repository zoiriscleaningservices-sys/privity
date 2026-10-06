/**
 * Moment rules — map authoritative facts to candidate presentations.
 *
 * Rules never compute scores, multipliers, leaders or winners. They only read values that the
 * server already decided (event payloads, battle snapshot, compiled timeline).
 */

import {
  AnyLiveEvent,
  BattleSnapshot,
  GiftRarity,
  Side,
  UserRef,
  toMs,
} from '../core/events';
import { BattleView } from '../battle/deriveBattleView';
import { LiveShowConfig, MomentKey, resultsDurationMs } from './config';
import {
  AggregateGroup,
  AnyMoment,
  LiveMoment,
  MomentKind,
  MomentPayloads,
  ShowChatLine,
} from './types';

export interface RuleContext {
  config: LiveShowConfig;
  battle: BattleSnapshot | null;
}

interface BuildArgs<K extends MomentKey> {
  key: K;
  kind: MomentKind;
  source: 'event' | 'timeline';
  server_event_id: string;
  created_at: number;
  payload: MomentPayloads[K];
  dedupe_key?: string;
  cooldown_key?: string;
  aggregate_group?: AggregateGroup | null;
  /** Override the configured duration (clamped to >= 300 ms), e.g. to align with the timeline. */
  duration_ms?: number;
}

export function buildMoment<K extends MomentKey>(
  cfg: LiveShowConfig,
  a: BuildArgs<K>,
): LiveMoment<K> | null {
  const spec = cfg.moments[a.key];
  if (!spec || !spec.enabled) return null;
  return {
    id: `${a.server_event_id}:${a.key}`,
    key: a.key,
    kind: a.kind,
    source: a.source,
    server_event_id: a.server_event_id,
    priority: spec.priority,
    lane: spec.lane,
    duration_ms:
      a.duration_ms !== undefined
        ? Math.max(300, Math.round(a.duration_ms))
        : a.key === 'battle_result'
          ? resultsDurationMs(cfg)
          : spec.duration_ms,
    cooldown_key: a.cooldown_key ?? a.key,
    cooldown_ms: spec.cooldown_ms,
    max_wait_ms: spec.max_wait_ms,
    preemptible: spec.preemptible,
    dedupe_key: a.dedupe_key ?? `${a.server_event_id}:${a.key}`,
    aggregate_group: spec.aggregatable ? a.aggregate_group ?? null : null,
    effects: { sound: spec.sound, haptic: spec.haptic },
    payload: a.payload,
    created_at: a.created_at,
  };
}

const GIFT_KEY: Record<GiftRarity, 'gift_common' | 'gift_rare' | 'gift_epic' | 'gift_legendary'> = {
  common: 'gift_common',
  rare: 'gift_rare',
  epic: 'gift_epic',
  legendary: 'gift_legendary',
};

export const dedupeKeys = {
  intro: (b: string) => `intro:${b}`,
  countdown: (b: string) => `countdown:${b}`,
  doubleWarning: (b: string, idx: number) => `double_warning:${b}:${idx}`,
  doubleStarted: (b: string, idx: number) => `double_started:${b}:${idx}`,
  doubleEnded: (b: string, idx: number) => `double_ended:${b}:${idx}`,
  pull: (b: string, pull: number) => `pull:${b}:${pull}`,
  final: (b: string) => `final:${b}`,
  result: (b: string) => `result:${b}`,
};

export function hostOfSide(battle: BattleSnapshot | null, side: Side): UserRef | null {
  if (!battle) return null;
  return side === 'a' ? battle.side_a.host : battle.side_b.host;
}

function segmentByIdx(battle: BattleSnapshot | null, battleId: string, idx: number) {
  if (!battle || battle.battle_id !== battleId) return null;
  return battle.timeline.find((s) => s.idx === idx) ?? null;
}

function pullTotal(battle: BattleSnapshot | null): number {
  if (!battle) return 0;
  return new Set(battle.timeline.filter((s) => s.pull_no !== null).map((s) => s.pull_no)).size;
}

const compact = <T>(xs: Array<T | null>): T[] => xs.filter((x): x is T => x !== null);

/** Candidate moments for one authoritative event. */
export function momentsFromEvent(e: AnyLiveEvent, ctx: RuleContext): AnyMoment[] {
  const cfg = ctx.config;
  const at = toMs(e.server_ts) ?? 0;
  const base = { source: 'event' as const, server_event_id: e.event_id, created_at: at };

  switch (e.event_type) {
    case 'GIFT_RECEIVED': {
      const p = e.payload;
      const payload = {
        sender: p.sender,
        gift: p.gift,
        quantity: p.quantity,
        coin_value: p.coin_value,
        battle_side: p.battle_side,
        battle_points: p.battle_points,
        multiplier: p.multiplier,
        sender_live_total: p.sender_live_total,
        battle_outcome: p.battle_outcome ?? (p.battle_id ? 'counted' : 'no_battle'),
      };
      const key = GIFT_KEY[p.gift.rarity] ?? 'gift_common';
      const gift = buildMoment(cfg, {
        ...base,
        key,
        kind: 'gift',
        payload,
        cooldown_key: `gift:${p.sender.id}`,
        aggregate_group: 'gifts',
      });
      let bar: AnyMoment | null = null;
      // D6: only gifts the server counted toward the battle may move the battle bar.
      if (payload.battle_outcome === 'counted' && p.battle_side && p.battle_points > 0) {
        const big = p.gift.rarity === 'epic' || p.gift.rarity === 'legendary';
        bar = big
          ? buildMoment(cfg, { ...base, key: 'bar_surge', kind: 'battle', payload: { side: p.battle_side, points: p.battle_points }, cooldown_key: `bar_surge:${p.battle_side}` })
          : buildMoment(cfg, { ...base, key: 'bar_tick', kind: 'battle', payload: { side: p.battle_side, points: p.battle_points }, cooldown_key: `bar_tick:${p.battle_side}` });
      }
      return compact<AnyMoment>([gift as AnyMoment | null, bar]);
    }
    case 'GIFT_STREAK':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'gift_streak',
          kind: 'gift',
          payload: { sender: e.payload.sender, gift: e.payload.gift, streak: e.payload.streak },
          cooldown_key: `streak:${e.payload.sender.id}`,
        }),
      ]);
    case 'TOP_SUPPORTER_CHANGED':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'supporter_top',
          kind: 'supporter',
          payload: { supporter: e.payload.supporter, total: e.payload.total, previous: e.payload.previous },
          cooldown_key: 'supporter_top',
        }),
      ]);
    case 'SUPPORTER_MILESTONE':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'supporter_milestone',
          kind: 'supporter',
          payload: { supporter: e.payload.supporter, total: e.payload.total, threshold: e.payload.threshold },
          cooldown_key: `supporter_milestone:${e.payload.supporter.id}`,
        }),
      ]);
    case 'VIEWERS_JOINED':
      if (e.payload.count <= 0) return [];
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'viewers_joined',
          kind: 'viewer',
          payload: { count: e.payload.count, sample: e.payload.sample },
          aggregate_group: 'joins',
        }),
      ]);
    case 'VIEWER_MILESTONE':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'viewer_milestone',
          kind: 'milestone',
          payload: { milestone: e.payload.milestone, count: e.payload.count },
          dedupe_key: `viewer_milestone:${e.live_id}:${e.payload.milestone}`,
        }),
      ]);
    case 'FOLLOW_RECEIVED':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'follow',
          kind: 'follow',
          payload: { count: 1, followers: [e.payload.follower] },
          aggregate_group: 'follows',
        }),
      ]);
    case 'FOLLOW_MILESTONE':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'follow_milestone',
          kind: 'milestone',
          payload: { milestone: e.payload.milestone, count: e.payload.count },
          dedupe_key: `follow_milestone:${e.live_id}:${e.payload.milestone}`,
        }),
      ]);
    case 'GUEST_JOINED':
      return compact<AnyMoment>([
        buildMoment(cfg, { ...base, key: 'guest_joined', kind: 'guest', payload: { guest: e.payload.guest } }),
      ]);
    case 'GUEST_LEFT':
      return compact<AnyMoment>([
        buildMoment(cfg, { ...base, key: 'guest_left', kind: 'guest', payload: { guest: e.payload.guest, reason: e.payload.reason } }),
      ]);
    case 'GUEST_REMOVED':
      return compact<AnyMoment>([
        buildMoment(cfg, { ...base, key: 'guest_left', kind: 'guest', payload: { guest: e.payload.guest, reason: 'removed' } }),
      ]);
    case 'BATTLE_ACCEPTED': {
      const b = e.payload.battle;
      const startsAt = toMs(b.starts_at);
      if (startsAt === null || at >= startsAt) return []; // intro time already passed
      const countdownSeg = b.timeline.find((s) => s.kind === 'countdown');
      const introEnd = countdownSeg ? Date.parse(countdownSeg.starts_at) : startsAt;
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'battle_intro',
          kind: 'battle',
          payload: { battle_id: b.battle_id, side_a: b.side_a, side_b: b.side_b, starts_at_ms: startsAt },
          dedupe_key: dedupeKeys.intro(b.battle_id),
          duration_ms: Math.min(cfg.moments.battle_intro.duration_ms, Math.max(300, introEnd - at)),
        }),
      ]);
    }
    case 'DOUBLE_WARNING':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'double_warning',
          kind: 'battle',
          payload: {
            battle_id: e.payload.battle_id,
            multiplier: e.payload.multiplier,
            starts_at_ms: toMs(e.payload.starts_at) ?? at,
          },
          dedupe_key: dedupeKeys.doubleWarning(e.payload.battle_id, e.payload.segment_idx),
        }),
      ]);
    case 'DOUBLE_STARTED': {
      const seg = segmentByIdx(ctx.battle, e.payload.battle_id, e.payload.segment_idx);
      if (seg?.kind === 'pull' && seg.pull_no !== null) {
        // A multiplied pull is presented as the pull announcement (with its multiplier).
        return compact<AnyMoment>([
          buildMoment(cfg, {
            ...base,
            key: 'pull_started',
            kind: 'battle',
            payload: { battle_id: e.payload.battle_id, pull: seg.pull_no, total: pullTotal(ctx.battle), multiplier: seg.multiplier },
            dedupe_key: dedupeKeys.pull(e.payload.battle_id, seg.pull_no),
          }),
        ]);
      }
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'double_started',
          kind: 'battle',
          payload: { battle_id: e.payload.battle_id, multiplier: e.payload.multiplier, ends_at_ms: toMs(e.payload.ends_at) },
          dedupe_key: dedupeKeys.doubleStarted(e.payload.battle_id, e.payload.segment_idx),
        }),
      ]);
    }
    case 'DOUBLE_ENDED':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'double_ended',
          kind: 'battle',
          payload: { battle_id: e.payload.battle_id },
          dedupe_key: dedupeKeys.doubleEnded(e.payload.battle_id, e.payload.segment_idx),
        }),
      ]);
    case 'BATTLE_PHASE_CHANGED': {
      if (e.payload.kind !== 'pull' || e.payload.pull_no === null) return [];
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'pull_started',
          kind: 'battle',
          payload: { battle_id: e.payload.battle_id, pull: e.payload.pull_no, total: pullTotal(ctx.battle), multiplier: e.payload.multiplier },
          dedupe_key: dedupeKeys.pull(e.payload.battle_id, e.payload.pull_no),
        }),
      ]);
    }
    case 'FINAL_COUNTDOWN_STARTED':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'final_countdown',
          kind: 'battle',
          payload: { battle_id: e.payload.battle_id, ends_at_ms: toMs(e.payload.ends_at) ?? at },
          dedupe_key: dedupeKeys.final(e.payload.battle_id),
        }),
      ]);
    case 'BATTLE_LEAD_CHANGED': {
      const leader = hostOfSide(ctx.battle, e.payload.lead_side);
      if (!leader) return [];
      const payload = {
        battle_id: e.payload.battle_id,
        lead_side: e.payload.lead_side,
        leader,
        score_a: e.payload.score_a,
        score_b: e.payload.score_b,
      };
      return compact<AnyMoment>([
        e.payload.is_final_moment
          ? buildMoment(cfg, { ...base, key: 'lead_change_final', kind: 'battle', payload })
          : buildMoment(cfg, { ...base, key: 'lead_change', kind: 'battle', payload }),
      ]);
    }
    case 'BATTLE_COMEBACK': {
      const host = hostOfSide(ctx.battle, e.payload.side);
      if (!host) return [];
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'comeback',
          kind: 'battle',
          payload: {
            battle_id: e.payload.battle_id,
            side: e.payload.side,
            host,
            deficit_before: e.payload.deficit_before,
            deficit_after: e.payload.deficit_after,
          },
        }),
      ]);
    }
    case 'BATTLE_SWING':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'swing',
          kind: 'battle',
          payload: { ...e.payload },
          cooldown_key: `swing:${e.payload.side}`,
        }),
      ]);
    case 'BATTLE_RESULT': {
      const b = ctx.battle;
      if (!b || b.battle_id !== e.payload.battle_id) return [];
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'battle_result',
          kind: 'battle',
          payload: { battle_id: b.battle_id, result: e.payload.result, side_a: b.side_a, side_b: b.side_b },
          dedupe_key: dedupeKeys.result(b.battle_id),
        }),
      ]);
    }
    case 'LIVE_ENDED':
      return compact<AnyMoment>([
        buildMoment(cfg, { ...base, key: 'live_ended', kind: 'system', payload: { reason: e.payload.reason } }),
      ]);
    case 'SYSTEM_NOTICE':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'system_notice',
          kind: 'system',
          payload: { message: e.payload.message, severity: e.payload.severity },
          dedupe_key: `system:${e.payload.code}:${e.event_id}`,
        }),
      ]);
    case 'MODERATION_NOTICE':
      return compact<AnyMoment>([
        buildMoment(cfg, {
          ...base,
          key: 'moderation_notice',
          kind: 'moderation',
          payload: { message: e.payload.message, action: e.payload.action, target: e.payload.target },
        }),
      ]);
    default:
      return [];
  }
}

/** How long the "FIGHT" beat stays on screen after the countdown reaches zero. */
export const FIGHT_BEAT_MS = 700;

/**
 * Presentations caused by crossing boundaries of the server-compiled timeline.
 * Returns nothing on the first observation of a battle (baseline), so reconnecting mid-battle
 * never replays intros or countdowns that already happened.
 */
export function momentsFromTimeline(
  prev: BattleView | null,
  next: BattleView,
  battle: BattleSnapshot | null,
  cfg: LiveShowConfig,
  nowMs: number,
): AnyMoment[] {
  if (!battle || !prev || !next.battleId || prev.battleId !== next.battleId) return [];
  const id = next.battleId;
  const base = (key: string, idx: number | string) => ({
    source: 'timeline' as const,
    server_event_id: `timeline:${id}:${key}:${idx}`,
    created_at: nowMs,
  });
  const out: Array<AnyMoment | null> = [];

  if (next.stage === 'COUNTDOWN' && prev.stage !== 'COUNTDOWN') {
    const fightAt = toMs(battle.starts_at);
    if (fightAt !== null) {
      out.push(
        buildMoment(cfg, {
          ...base('countdown', 0),
          key: 'battle_countdown',
          kind: 'battle',
          payload: { battle_id: id, fight_at_ms: fightAt },
          dedupe_key: dedupeKeys.countdown(id),
          // digits until fight_at, then a short "FIGHT" beat
          duration_ms: fightAt - nowMs + FIGHT_BEAT_MS,
        }),
      );
    }
  }

  const pullChanged =
    next.pull !== null &&
    !next.inBreak &&
    (prev.pull?.current !== next.pull.current || prev.inBreak || prev.stage === 'COUNTDOWN');
  if (pullChanged && next.pull) {
    out.push(
      buildMoment(cfg, {
        ...base('pull', next.pull.current),
        key: 'pull_started',
        kind: 'battle',
        payload: { battle_id: id, pull: next.pull.current, total: next.pull.total, multiplier: next.multiplier },
        dedupe_key: dedupeKeys.pull(id, next.pull.current),
      }),
    );
  }

  const isPullSegment = next.segment?.kind === 'pull';
  if (next.bonus === 'warning' && (prev.bonus !== 'warning' || prev.bonusSegmentIdx !== next.bonusSegmentIdx)) {
    const seg = battle.timeline.find((s) => s.idx === next.bonusSegmentIdx);
    if (seg) {
      out.push(
        buildMoment(cfg, {
          ...base('double_warning', seg.idx),
          key: 'double_warning',
          kind: 'battle',
          payload: { battle_id: id, multiplier: seg.multiplier, starts_at_ms: Date.parse(seg.starts_at) },
          dedupe_key: dedupeKeys.doubleWarning(id, seg.idx),
        }),
      );
    }
  }
  if (
    next.bonus === 'active' &&
    !isPullSegment &&
    (prev.bonus !== 'active' || prev.bonusSegmentIdx !== next.bonusSegmentIdx) &&
    next.bonusSegmentIdx !== null
  ) {
    out.push(
      buildMoment(cfg, {
        ...base('double_started', next.bonusSegmentIdx),
        key: 'double_started',
        kind: 'battle',
        payload: {
          battle_id: id,
          multiplier: next.bonusMultiplier,
          ends_at_ms: next.segment ? Date.parse(next.segment.ends_at) : null,
        },
        dedupe_key: dedupeKeys.doubleStarted(id, next.bonusSegmentIdx),
      }),
    );
  }
  if (prev.bonus === 'active' && next.bonus !== 'active' && prev.bonusSegmentIdx !== null && next.stage !== 'LOCKED') {
    out.push(
      buildMoment(cfg, {
        ...base('double_ended', prev.bonusSegmentIdx),
        key: 'double_ended',
        kind: 'battle',
        payload: { battle_id: id },
        dedupe_key: dedupeKeys.doubleEnded(id, prev.bonusSegmentIdx),
      }),
    );
  }

  if (next.stage === 'FINAL_COUNTDOWN' && prev.stage !== 'FINAL_COUNTDOWN') {
    const endsAt = toMs(battle.ends_at);
    if (endsAt !== null) {
      out.push(
        buildMoment(cfg, {
          ...base('final', 0),
          key: 'final_countdown',
          kind: 'battle',
          payload: { battle_id: id, ends_at_ms: endsAt },
          dedupe_key: dedupeKeys.final(id),
        }),
      );
    }
  }

  return compact<AnyMoment>(out);
}

// ---------------------------------------------------------------------------
// Chat lines — permanent, accessible record of facts (never throttled or aggregated)
// ---------------------------------------------------------------------------

const fmt = (n: number) => n.toLocaleString('en-US');

export function chatLineFromEvent(e: AnyLiveEvent, ctx: RuleContext): ShowChatLine | null {
  const at = toMs(e.server_ts) ?? 0;
  const line = (tone: ShowChatLine['tone'], actor: UserRef | null, text: string): ShowChatLine => ({
    id: `line:${e.event_id}`,
    server_event_id: e.event_id,
    tone,
    actor,
    text,
    created_at: at,
  });
  const name = (u: UserRef | null) => (u ? u.display_name || `@${u.handle}` : 'Host');

  switch (e.event_type) {
    case 'GIFT_RECEIVED': {
      const p = e.payload;
      const qty = p.quantity > 1 ? ` ×${p.quantity}` : '';
      return line('gift', p.sender, `sent ${p.gift.name}${qty}`);
    }
    case 'GIFT_STREAK':
      return line('gift', e.payload.sender, `is on a ${e.payload.streak}× ${e.payload.gift.name} streak`);
    case 'TOP_SUPPORTER_CHANGED':
      return line('supporter', e.payload.supporter, 'is now the Top Supporter');
    case 'SUPPORTER_MILESTONE':
      return line('supporter', e.payload.supporter, `reached ${fmt(e.payload.threshold)} coins of support`);
    case 'VIEWERS_JOINED': {
      const { count, sample } = e.payload;
      if (count <= 0) return null;
      const first = sample[0] ?? null;
      if (!first) return line('viewer', null, `${fmt(count)} people joined`);
      return line('viewer', first, count === 1 ? 'joined' : `and ${fmt(count - 1)} others joined`);
    }
    case 'VIEWER_MILESTONE':
      return line('viewer', null, `${fmt(e.payload.milestone)} people are watching`);
    case 'FOLLOW_RECEIVED':
      return line('viewer', e.payload.follower, 'followed');
    case 'FOLLOW_MILESTONE':
      return line('viewer', null, `${fmt(e.payload.milestone)} new followers this LIVE`);
    case 'GUEST_JOINED':
      return line('guest', e.payload.guest, 'joined as a guest');
    case 'GUEST_LEFT':
      return line('guest', e.payload.guest, 'left the stage');
    case 'GUEST_REMOVED':
      return line('guest', e.payload.guest, 'was removed from the stage');
    case 'BATTLE_ACCEPTED':
      return line('battle', null, `Battle: ${name(e.payload.battle.side_a.host)} vs ${name(e.payload.battle.side_b.host)}`);
    case 'BATTLE_CANCELLED':
      return line('battle', null, 'Battle cancelled');
    case 'DOUBLE_WARNING':
      return line('battle', null, `×${e.payload.multiplier} starts soon`);
    case 'DOUBLE_STARTED':
      return line('battle', null, `×${e.payload.multiplier} is active`);
    case 'DOUBLE_ENDED':
      return line('battle', null, 'Multiplier ended');
    case 'BATTLE_LEAD_CHANGED':
      return line('battle', hostOfSide(ctx.battle, e.payload.lead_side), 'took the lead');
    case 'BATTLE_COMEBACK':
      return line('battle', hostOfSide(ctx.battle, e.payload.side), 'is making a comeback');
    case 'FINAL_COUNTDOWN_STARTED':
      return line('battle', null, 'Final countdown');
    case 'BATTLE_ENDED':
      return line('battle', null, 'Battle complete — scores locked');
    case 'BATTLE_RESULT': {
      const r = e.payload.result;
      const score = `${fmt(r.final_a)}–${fmt(r.final_b)}`;
      if (!r.winner_side) return line('battle', null, `Battle ended in a draw (${score})`);
      return line('battle', hostOfSide(ctx.battle, r.winner_side), `won the battle (${score})`);
    }
    case 'LIVE_ENDED':
      return line('system', null, 'This LIVE has ended');
    case 'SYSTEM_NOTICE':
      return line('system', null, e.payload.message);
    case 'MODERATION_NOTICE':
      return line('moderation', e.payload.target, e.payload.message);
    default:
      return null;
  }
}
