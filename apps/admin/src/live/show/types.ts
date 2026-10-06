/**
 * LiveMoment — a single orchestrated presentation, always traceable to an authoritative fact.
 *
 * `source: 'event'`    → caused by a server event (server_event_id = event_id)
 * `source: 'timeline'` → caused by crossing a boundary of the server-compiled battle timeline
 *                         (server_event_id = `timeline:<battle_id>:<key>:<segment_idx>`).
 *                         The matching server event (e.g. DOUBLE_STARTED) shares the dedupe_key,
 *                         so whichever arrives first is shown and the other is ignored.
 */

import {
  BattleResult,
  BattleSideInfo,
  GiftBattleOutcome,
  GiftRef,
  Side,
  UserRef,
} from '../core/events';
import { HapticPattern, MomentKey, MomentLane, MomentPriority } from './config';

export interface GiftMomentPayload {
  sender: UserRef;
  gift: GiftRef;
  quantity: number;
  coin_value: number;
  battle_side: Side | null;
  battle_points: number;
  multiplier: number;
  sender_live_total: number;
  /** D6: present 'excluded' gifts as "did not affect the battle score". */
  battle_outcome: GiftBattleOutcome;
}

export interface MomentPayloads {
  gift_common: GiftMomentPayload;
  gift_rare: GiftMomentPayload;
  gift_epic: GiftMomentPayload;
  gift_legendary: GiftMomentPayload;
  gift_aggregate: { count: number; unique_senders: number; total_coins: number; top: GiftMomentPayload };
  gift_streak: { sender: UserRef; gift: GiftRef; streak: number };
  bar_tick: { side: Side; points: number };
  bar_surge: { side: Side; points: number };
  supporter_top: { supporter: UserRef; total: number; previous: UserRef | null };
  supporter_milestone: { supporter: UserRef; total: number; threshold: number };
  viewers_joined: { count: number; sample: UserRef[] };
  viewer_milestone: { milestone: number; count: number };
  follow: { count: number; followers: UserRef[] };
  follow_milestone: { milestone: number; count: number };
  guest_joined: { guest: UserRef };
  guest_left: { guest: UserRef; reason: 'left' | 'disconnected' | 'removed' };
  battle_intro: { battle_id: string; side_a: BattleSideInfo; side_b: BattleSideInfo; starts_at_ms: number };
  battle_countdown: { battle_id: string; fight_at_ms: number };
  double_warning: { battle_id: string; multiplier: number; starts_at_ms: number };
  double_started: { battle_id: string; multiplier: number; ends_at_ms: number | null };
  double_ended: { battle_id: string };
  pull_started: { battle_id: string; pull: number; total: number; multiplier: number };
  final_countdown: { battle_id: string; ends_at_ms: number };
  lead_change: { battle_id: string; lead_side: Side; leader: UserRef; score_a: number; score_b: number };
  lead_change_final: { battle_id: string; lead_side: Side; leader: UserRef; score_a: number; score_b: number };
  comeback: { battle_id: string; side: Side; host: UserRef; deficit_before: number; deficit_after: number };
  swing: { battle_id: string; side: Side; points: number; sender: UserRef; gift: GiftRef };
  battle_result: { battle_id: string; result: BattleResult; side_a: BattleSideInfo; side_b: BattleSideInfo };
  live_ended: { reason: 'host_ended' | 'moderation' | 'stale' | 'admin' };
  system_notice: { message: string; severity: 'info' | 'warning' };
  moderation_notice: { message: string; action: string; target: UserRef | null };
}

export type MomentKind =
  | 'gift'
  | 'supporter'
  | 'milestone'
  | 'battle'
  | 'follow'
  | 'guest'
  | 'viewer'
  | 'system'
  | 'moderation';

export type AggregateGroup = 'gifts' | 'joins' | 'follows';

export interface LiveMoment<K extends MomentKey = MomentKey> {
  id: string;
  key: K;
  kind: MomentKind;
  source: 'event' | 'timeline';
  server_event_id: string;
  priority: MomentPriority;
  lane: MomentLane;
  duration_ms: number;
  cooldown_key: string;
  cooldown_ms: number;
  max_wait_ms: number;
  preemptible: boolean;
  dedupe_key: string;
  aggregate_group: AggregateGroup | null;
  effects: { sound: string | null; haptic: HapticPattern | null };
  payload: MomentPayloads[K];
  /** Server time of the underlying fact (ms). */
  created_at: number;
}

export type AnyMoment = { [K in MomentKey]: LiveMoment<K> }[MomentKey];

/** A moment that is currently on screen. */
export interface ActiveMoment {
  moment: AnyMoment;
  started_at: number;
  ends_at: number;
}

export type ChatLineTone = 'gift' | 'battle' | 'supporter' | 'viewer' | 'guest' | 'system' | 'moderation';

/** Accessible, permanent record of a fact in the chat stream (never throttled). */
export interface ShowChatLine {
  id: string;
  server_event_id: string;
  tone: ChatLineTone;
  actor: UserRef | null;
  text: string;
  created_at: number;
}
