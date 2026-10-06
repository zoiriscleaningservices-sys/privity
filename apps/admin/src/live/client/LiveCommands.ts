/**
 * LiveCommands — the client's ONLY way to ask the server to change LIVE state.
 *
 * Mirrors the S2 Supabase RPC contract one-to-one (supabase/migrations/*_live_v2_*.sql).
 * Every result is the server's answer; the client never computes balances, prices, battle
 * points, multipliers or permissions itself. Failures carry the server's error code so the UI
 * can explain what happened and what to do next (see errors.ts).
 */

import { GuestStatus, GiftBattleOutcome, GiftRarity, LiveSnapshot, Side, UserRef } from '../core/events';
import { BattleFormatDefinition } from '../battle/timeline';

export type CommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; details?: Record<string, unknown> };

export interface WalletInfo {
  coins: number;
  test_coins: number;
  earnings: number;
  active_currency: 'coins' | 'test_coins';
  /** What can be spent on gifts right now (server decides which currency is active). */
  spendable: number;
  test_credits: boolean;
  purchases_enabled: boolean;
  environment: string;
}

export interface CatalogGift {
  id: string;
  name: string;
  description: string | null;
  coin_cost: number;
  rarity: GiftRarity;
  presentation: 'corner' | 'banner' | 'stage';
  icon_url: string;
  animation_url: string | null;
  animation_fallback_url: string | null;
  sound_url: string | null;
  animation_duration_ms: number;
}

export interface GiftCatalog {
  gifts: CatalogGift[];
  battle_formats: Array<{ id: string; name: string; version?: number; definition: BattleFormatDefinition }>;
  max_quantity: number;
}

export type BattleMode = 'auto' | 'outside_battle';

export interface SendGiftInput {
  liveId: string;
  giftId: string;
  quantity: number;
  /** 8..128 chars, unique per attempt; re-sending the same key never double-charges. */
  idempotencyKey: string;
  battleMode: BattleMode;
  expectedBattleId: string | null;
}

export interface GiftSendData {
  replayed: boolean;
  tx_id: string;
  coin_value: number;
  currency: 'coins' | 'test_coins';
  battle_id: string | null;
  battle_side: Side | null;
  battle_points: number;
  multiplier: number;
  battle_outcome: GiftBattleOutcome;
  message: string | null;
  balance: number;
}

export interface GuestRequestRow {
  request_id: string;
  user: UserRef;
  requested_at: string;
}

export interface LiveCommands {
  getSnapshot(liveId: string): Promise<CommandResult<LiveSnapshot>>;
  getWallet(): Promise<CommandResult<WalletInfo>>;
  getCatalog(): Promise<CommandResult<GiftCatalog>>;
  sendGift(input: SendGiftInput): Promise<CommandResult<GiftSendData>>;

  comment(liveId: string, text: string): Promise<CommandResult<{ comment_id: string; created_at: string }>>;
  deleteComment(commentId: string): Promise<CommandResult<Record<string, never>>>;
  setCommentsEnabled(liveId: string, enabled: boolean): Promise<CommandResult<{ comments_enabled: boolean }>>;
  mute(liveId: string, userId: string, minutes: number): Promise<CommandResult<{ muted_until: string }>>;
  unmute(liveId: string, userId: string): Promise<CommandResult<Record<string, never>>>;
  kick(liveId: string, userId: string, reason?: string): Promise<CommandResult<Record<string, never>>>;

  follow(userId: string): Promise<CommandResult<{ following: boolean }>>;
  unfollow(userId: string): Promise<CommandResult<{ following: boolean }>>;
  block(userId: string): Promise<CommandResult<{ blocked: boolean }>>;

  requestGuest(liveId: string): Promise<CommandResult<{ status: GuestStatus }>>;
  cancelGuestRequest(liveId: string): Promise<CommandResult<Record<string, never>>>;
  respondGuest(liveId: string, userId: string, accept: boolean): Promise<CommandResult<{ status: GuestStatus; slot?: number }>>;
  removeGuest(liveId: string, userId: string): Promise<CommandResult<Record<string, never>>>;
  leaveGuest(liveId: string): Promise<CommandResult<Record<string, never>>>;
  listGuestRequests(liveId: string): Promise<CommandResult<GuestRequestRow[]>>;

  battleRespond(battleId: string, accept: boolean): Promise<CommandResult<Record<string, unknown>>>;
  battleForfeit(battleId: string): Promise<CommandResult<Record<string, unknown>>>;

  endLive(liveId: string): Promise<CommandResult<Record<string, unknown>>>;
}

/** Idempotency key for one user-initiated gift attempt (reuse it only for retries of that attempt). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `gift-${crypto.randomUUID()}`;
  return `gift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
