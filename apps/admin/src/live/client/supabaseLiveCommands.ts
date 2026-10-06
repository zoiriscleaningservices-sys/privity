/**
 * Supabase implementation of LiveCommands (S2 RPCs).
 *
 * Not wired into the app yet — `live_v2` stays OFF. The client is injected so this module
 * has no side effects and can be unit-tested with a fake `rpc`.
 *
 * Error mapping:
 *  - `{ ok:false, code, message }` business results → same code
 *  - raised `live.fail(CODE)` (P0001, message = CODE) → CODE
 *  - serialization retry ('RETRY', SQLSTATE 40001) → retried once with the SAME idempotency key
 *  - fetch/transport failures → NETWORK_ERROR
 */

import { LiveSnapshot } from '../core/events';
import { CommandResult, GiftCatalog, GiftSendData, GuestRequestRow, LiveCommands, WalletInfo } from './LiveCommands';

export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
}

const CODE_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

export async function callRpc<T>(client: RpcClient, fn: string, args: Record<string, unknown> = {}): Promise<CommandResult<T>> {
  let res: { data: unknown; error: { message?: string; code?: string } | null };
  try {
    res = await client.rpc(fn, args);
  } catch (err) {
    return { ok: false, code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Network error' };
  }
  if (res.error) {
    const msg = res.error.message ?? '';
    if (res.error.code === '40001' || msg === 'RETRY') return { ok: false, code: 'RETRY', message: msg };
    if (CODE_RE.test(msg)) return { ok: false, code: msg, message: msg };
    if (/fetch|network|Failed to fetch|timeout/i.test(msg)) return { ok: false, code: 'NETWORK_ERROR', message: msg };
    return { ok: false, code: 'SERVER_ERROR', message: msg || 'Server error' };
  }
  const data = res.data as Record<string, unknown> | null;
  if (data && typeof data === 'object' && !Array.isArray(data) && data.ok === false) {
    return {
      ok: false,
      code: typeof data.code === 'string' ? data.code : 'SERVER_ERROR',
      message: typeof data.message === 'string' ? data.message : '',
      details: data,
    };
  }
  return { ok: true, data: data as T };
}

export function createSupabaseLiveCommands(client: RpcClient): LiveCommands {
  const call = <T>(fn: string, args?: Record<string, unknown>) => callRpc<T>(client, fn, args);
  return {
    getSnapshot: (liveId) => call<LiveSnapshot>('live_get_snapshot', { p_live_id: liveId }),
    getWallet: () => call<WalletInfo>('live_get_wallet'),
    getCatalog: () => call<GiftCatalog>('live_get_catalog'),
    async sendGift(input) {
      const args = {
        p_live_id: input.liveId,
        p_gift_id: input.giftId,
        p_quantity: input.quantity,
        p_idempotency_key: input.idempotencyKey,
        p_battle_mode: input.battleMode,
        p_expected_battle_id: input.expectedBattleId,
      };
      const first = await call<GiftSendData>('live_send_gift', args);
      if (!first.ok && first.code === 'RETRY') return call<GiftSendData>('live_send_gift', args);
      return first;
    },
    comment: (liveId, text) => call('live_comment', { p_live_id: liveId, p_text: text }),
    deleteComment: (commentId) => call('live_delete_comment', { p_comment_id: commentId }),
    setCommentsEnabled: (liveId, enabled) => call('live_set_comments_enabled', { p_live_id: liveId, p_enabled: enabled }),
    mute: (liveId, userId, minutes) => call('live_mute', { p_live_id: liveId, p_user_id: userId, p_minutes: minutes }),
    unmute: (liveId, userId) => call('live_unmute', { p_live_id: liveId, p_user_id: userId }),
    kick: (liveId, userId, reason) => call('live_kick', { p_live_id: liveId, p_user_id: userId, p_reason: reason ?? null }),
    follow: (userId) => call('live_follow', { p_user_id: userId }),
    unfollow: (userId) => call('live_unfollow', { p_user_id: userId }),
    block: (userId) => call('live_block', { p_user_id: userId }),
    requestGuest: (liveId) => call('live_request_guest', { p_live_id: liveId }),
    cancelGuestRequest: (liveId) => call('live_cancel_guest_request', { p_live_id: liveId }),
    respondGuest: (liveId, userId, accept) => call('live_respond_guest', { p_live_id: liveId, p_user_id: userId, p_accept: accept }),
    removeGuest: (liveId, userId) => call('live_remove_guest', { p_live_id: liveId, p_user_id: userId }),
    leaveGuest: (liveId) => call('live_leave_guest', { p_live_id: liveId }),
    listGuestRequests: (liveId) => call<GuestRequestRow[]>('live_list_guest_requests', { p_live_id: liveId }),
    battleRespond: (battleId, accept) => call('live_battle_respond', { p_battle_id: battleId, p_accept: accept }),
    battleForfeit: (battleId) => call('live_battle_forfeit', { p_battle_id: battleId }),
    endLive: (liveId) => call('live_end', { p_live_id: liveId }),
  };
}
