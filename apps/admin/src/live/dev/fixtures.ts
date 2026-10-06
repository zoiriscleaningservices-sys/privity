/**
 * TEST / DEV FIXTURES ONLY — never imported by production code.
 * Builders for envelopes, snapshots and battles so tests read like scenarios.
 */

import {
  AnyLiveEvent,
  BattleResult,
  BattleSnapshot,
  GiftRarity,
  GiftRef,
  LIVE_EVENT_SCHEMA_VERSION,
  LiveEventPayloads,
  LiveEventType,
  LiveSnapshot,
  Side,
  UserRef,
} from '../core/events';
import { BUILTIN_FORMATS, BattleFormatDefinition, compileTimeline } from '../battle/timeline';

export const LIVE_ID = 'live-test-1';

export const user = (id: string): UserRef => ({
  id,
  handle: id,
  display_name: id.toUpperCase(),
  avatar_url: null,
});

const GIFT_COST: Record<GiftRarity, number> = { common: 1, rare: 99, epic: 999, legendary: 9999 };

export const gift = (rarity: GiftRarity, id = `gift-${rarity}`): GiftRef => ({
  id,
  name: `${rarity} gift`,
  rarity,
  coin_cost: GIFT_COST[rarity],
  icon_url: `/gifts/${id}.webp`,
  animation_url: null,
});

export class EventFactory {
  private seq: number;
  private n = 0;

  constructor(
    private readonly liveId = LIVE_ID,
    startSeq = 0,
  ) {
    this.seq = startSeq;
  }

  get lastSeq(): number {
    return this.seq;
  }

  make<T extends LiveEventType>(
    type: T,
    payload: LiveEventPayloads[T],
    atMs: number = Date.now(),
    over: { seq?: number; event_id?: string; live_id?: string } = {},
  ): AnyLiveEvent {
    const seq = over.seq ?? ++this.seq;
    const battleId =
      (payload as { battle_id?: string | null }).battle_id ??
      (payload as { battle?: { battle_id: string } }).battle?.battle_id ??
      null;
    return {
      event_id: over.event_id ?? `evt-${seq}-${++this.n}`,
      live_id: over.live_id ?? this.liveId,
      battle_id: battleId,
      event_type: type,
      actor_id: null,
      server_ts: new Date(atMs).toISOString(),
      seq,
      schema_version: LIVE_EVENT_SCHEMA_VERSION,
      payload,
    } as unknown as AnyLiveEvent;
  }
}

export function giftPayload(
  sender: UserRef,
  rarity: GiftRarity,
  opts: { battle?: { id: string; side: Side; points: number; multiplier: number }; total?: number; quantity?: number } = {},
): LiveEventPayloads['GIFT_RECEIVED'] {
  const g = gift(rarity);
  const quantity = opts.quantity ?? 1;
  return {
    tx_id: `tx-${Math.random().toString(36).slice(2)}`,
    sender,
    recipient_id: 'hostA',
    gift: g,
    quantity,
    coin_value: g.coin_cost * quantity,
    battle_id: opts.battle?.id ?? null,
    battle_side: opts.battle?.side ?? null,
    battle_points: opts.battle?.points ?? 0,
    multiplier: opts.battle?.multiplier ?? 1,
    sender_live_total: opts.total ?? g.coin_cost * quantity,
    battle_outcome: opts.battle ? 'counted' : 'no_battle',
  };
}

export function makeSnapshot(over: Partial<LiveSnapshot> = {}, nowMs: number = Date.now()): LiveSnapshot {
  return {
    live_id: LIVE_ID,
    last_seq: 0,
    server_now: new Date(nowMs).toISOString(),
    status: 'live',
    title: 'Test LIVE',
    visibility: 'public',
    started_at: new Date(nowMs).toISOString(),
    host: user('hostA'),
    viewer_count: 0,
    peak_viewers: 0,
    top_supporters: [],
    battle: null,
    config_version: 0,
    comments_enabled: true,
    guests: [],
    recent_comments: [],
    me: { user_id: 'viewer', is_host: false, guest_status: null, muted_until: null, following_host: false },
    ...over,
  };
}

export function formatOf(f: string | BattleFormatDefinition): BattleFormatDefinition {
  return typeof f === 'string' ? BUILTIN_FORMATS[f] : f;
}

/** introAt such that `nowMs` is `activeElapsedMs` after the fight starts (may be negative). */
export function introAtFor(f: string | BattleFormatDefinition, nowMs: number, activeElapsedMs: number): number {
  const def = formatOf(f);
  return nowMs - activeElapsedMs - def.intro_ms - def.countdown_s * 1000;
}

export function makeBattle(
  f: string | BattleFormatDefinition,
  introAtMs: number,
  over: Partial<BattleSnapshot> = {},
): BattleSnapshot {
  const def = formatOf(f);
  const c = compileTimeline(def, introAtMs);
  return {
    battle_id: 'battle-1',
    format_id: typeof f === 'string' ? f : 'custom',
    status: 'live',
    side_a: { live_id: LIVE_ID, host: user('hostA') },
    side_b: { live_id: 'live-test-2', host: user('hostB') },
    scoring: def.scoring,
    invite_expires_at: null,
    intro_at: c.intro_at,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    final_countdown_ms: c.final_countdown_ms,
    timeline: c.timeline,
    score_a: 0,
    score_b: 0,
    pull_scores: [],
    lead_side: null,
    score_version: 0,
    result: null,
    ...over,
  };
}

export function makeResult(final_a: number, final_b: number): BattleResult {
  return {
    winner_side: final_a === final_b ? null : final_a > final_b ? 'a' : 'b',
    final_a,
    final_b,
    pull_wins: null,
    stats: { total_gifts: 0, biggest_gift: null, top_supporters: [], lead_changes: 0, comebacks: 0, peak_viewers: null },
  };
}
