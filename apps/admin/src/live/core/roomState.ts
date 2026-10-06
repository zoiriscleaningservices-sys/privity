/**
 * LiveRoomState — client projection of authoritative server state.
 *
 * Built from a snapshot, then advanced with ordered events from LiveEventStore.
 * Absolute values (scores, counts, totals) are always REPLACED with server values; the client
 * never adds scores up itself.
 */

import {
  AnyLiveEvent,
  BattleSnapshot,
  LiveGuest,
  LiveSnapshot,
  SupporterEntry,
  UserRef,
} from './events';

export interface LiveRoomState {
  liveId: string;
  status: 'live' | 'ended';
  title: string;
  host: UserRef;
  viewerCount: number;
  peakViewers: number;
  topSupporters: SupporterEntry[];
  battle: BattleSnapshot | null;
  /** Accepted guests ordered by stage slot. */
  guests: LiveGuest[];
  commentsEnabled: boolean;
  configVersion: number;
}

const TOP_SUPPORTERS_KEPT = 3;

function bySlot(a: LiveGuest, b: LiveGuest): number {
  return a.slot - b.slot;
}

export function roomStateFromSnapshot(s: LiveSnapshot): LiveRoomState {
  return {
    liveId: s.live_id,
    status: s.status,
    title: s.title,
    host: s.host,
    viewerCount: s.viewer_count,
    peakViewers: s.peak_viewers,
    topSupporters: s.top_supporters.slice(0, TOP_SUPPORTERS_KEPT),
    battle: s.battle,
    guests: [...(s.guests ?? [])].sort(bySlot),
    commentsEnabled: s.comments_enabled ?? true,
    configVersion: s.config_version,
  };
}

function upsertSupporter(list: SupporterEntry[], user: UserRef, total: number): SupporterEntry[] {
  const without = list.filter((e) => e.user.id !== user.id);
  without.push({ user, total });
  without.sort((x, y) => y.total - x.total);
  return without.slice(0, TOP_SUPPORTERS_KEPT);
}

function patchBattle(
  state: LiveRoomState,
  battleId: string,
  patch: (b: BattleSnapshot) => BattleSnapshot,
): LiveRoomState {
  if (!state.battle || state.battle.battle_id !== battleId) return state;
  return { ...state, battle: patch(state.battle) };
}

export function applyLiveEvent(state: LiveRoomState, e: AnyLiveEvent): LiveRoomState {
  switch (e.event_type) {
    case 'LIVE_STARTED':
      return { ...state, status: 'live', title: e.payload.title, host: e.payload.host };
    case 'LIVE_ENDED':
      return { ...state, status: 'ended', guests: [] };
    case 'VIEWER_COUNT':
      return { ...state, viewerCount: e.payload.count, peakViewers: e.payload.peak };
    case 'GIFT_RECEIVED':
      return {
        ...state,
        topSupporters: upsertSupporter(state.topSupporters, e.payload.sender, e.payload.sender_live_total),
      };
    case 'TOP_SUPPORTER_CHANGED':
      return {
        ...state,
        topSupporters: upsertSupporter(state.topSupporters, e.payload.supporter, e.payload.total),
      };
    case 'BATTLE_INVITED':
      return { ...state, battle: e.payload.battle };
    case 'BATTLE_ACCEPTED':
      return { ...state, battle: e.payload.battle };
    case 'BATTLE_CANCELLED':
      return state.battle?.battle_id === e.payload.battle_id ? { ...state, battle: null } : state;
    case 'BATTLE_SCORE':
      return patchBattle(state, e.payload.battle_id, (b) =>
        e.payload.score_version <= b.score_version || b.status === 'finalized' || b.result
          ? b // stale/duplicate update, or the result is already final
          : {
              ...b,
              status: b.status === 'accepted' ? 'live' : b.status,
              score_a: e.payload.score_a,
              score_b: e.payload.score_b,
              pull_scores: e.payload.pull_scores,
              lead_side: e.payload.lead_side,
              score_version: e.payload.score_version,
            },
      );
    case 'BATTLE_ENDED':
      return patchBattle(state, e.payload.battle_id, (b) =>
        b.status === 'finalized' || b.result
          ? b
          : { ...b, status: 'locked', score_a: e.payload.score_a, score_b: e.payload.score_b },
      );
    case 'BATTLE_RESULT':
      return patchBattle(state, e.payload.battle_id, (b) => ({
        ...b,
        status: 'finalized',
        score_a: e.payload.result.final_a,
        score_b: e.payload.result.final_b,
        result: e.payload.result,
      }));
    case 'GUEST_JOINED':
      return state.guests.some((g) => g.id === e.payload.guest.id)
        ? state
        : { ...state, guests: [...state.guests, { ...e.payload.guest, slot: e.payload.slot }].sort(bySlot) };
    case 'GUEST_LEFT':
    case 'GUEST_REMOVED':
      return { ...state, guests: state.guests.filter((g) => g.id !== e.payload.guest.id) };
    case 'MODERATION_NOTICE':
      return e.payload.action === 'room_muted' ? { ...state, commentsEnabled: false } : state;
    case 'SYSTEM_NOTICE':
      return e.payload.code === 'comments_enabled' ? { ...state, commentsEnabled: true } : state;
    case 'CONFIG_UPDATED':
      return { ...state, configVersion: e.payload.version };
    default:
      return state;
  }
}

/** Clears a finished battle once its results presentation is done. */
export function clearFinishedBattle(state: LiveRoomState, battleId: string): LiveRoomState {
  if (state.battle?.battle_id !== battleId) return state;
  if (state.battle.status !== 'finalized' && state.battle.status !== 'cancelled') return state;
  return { ...state, battle: null };
}
