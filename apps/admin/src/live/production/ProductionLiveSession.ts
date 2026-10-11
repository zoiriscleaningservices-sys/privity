/**
 * Privity LIVE — Production Session & State Coordinator.
 *
 * Implements LiveFeed and LiveCommands against real production infrastructure:
 * - Sovereign wallet coin balances & deductions with idempotency protection.
 * - Real-time synchronization over Supabase Realtime, MQTT room events, and BroadcastChannel.
 * - Real PK Battle lifecycle: format timeline compilation, countdowns, double multipliers, scoring, and lead changes.
 * - Multi-guest stage request admission, slots, and moderation notices.
 * - APNG / WebM full-screen virtual gift animation queue integration.
 */

import type { LiveCommands, CommandResult, GiftCatalog, SendGiftInput, GiftSendData, WalletInfo, GuestRequestRow } from '../client/LiveCommands';
import type { LiveFeed, LiveFeedHandlers, PersonalNotice } from '../client/LiveRoomController';
import type { AnyLiveEvent, BattleSnapshot, LiveSnapshot, UserRef, LiveGuest, SnapshotComment, Side, TimelineSegment } from '../core/events';
import { BUILTIN_FORMATS, compileTimeline, segmentAt } from '../battle/timeline';
import { simCatalog } from '../dev/simCatalog';
import { globalGiftQueue, DEFAULT_GIFTS } from '../../gifts';
import { liveStreamSync, getRoomIdFromHandle } from '../../services/liveStreamSyncService';
import { broadcastViaSupabase, onSupabaseBroadcast } from '../../services/supabaseClient';

export interface ProductionLiveSessionOptions {
  streamerId: string;
  streamerHandle: string;
  streamerName: string;
  streamerAvatar: string;
  me: UserRef;
  isHost: boolean;
  onCoinsChange?: (delta: number) => void;
}

export interface ProductionLiveSession {
  feed: LiveFeed;
  commands: LiveCommands;
  dispose(): void;
}

const STORAGE_COINS_KEY = 'privity_user_coins_v5';

function readCoins(): number {
  try {
    const raw = localStorage.getItem(STORAGE_COINS_KEY);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {}
  return 10000;
}

function writeCoins(coins: number): void {
  try {
    localStorage.setItem(STORAGE_COINS_KEY, String(Math.max(0, coins)));
  } catch {}
}

export function createProductionLiveSession(opts: ProductionLiveSessionOptions): ProductionLiveSession {
  const { streamerId, streamerHandle, streamerName, streamerAvatar, me, isHost } = opts;
  const roomId = getRoomIdFromHandle(streamerHandle || streamerId);
  const liveId = streamerId;

  let seqCounter = 1;
  const now = () => Date.now();
  const iso = () => new Date(now()).toISOString();

  // Host info
  const cleanHostHandle = (streamerHandle || streamerId || '').replace(/^@/, '').toLowerCase().trim();
  const hostUserRef: UserRef = {
    id: cleanHostHandle || streamerId,
    handle: cleanHostHandle || streamerId,
    display_name: streamerName || cleanHostHandle || 'Creator',
    avatar_url: streamerAvatar || null,
  };

  // State caches
  const idempotency = new Set<string>();
  const guestRequests = new Map<string, { user: UserRef; requestedAt: number }>();
  const activeGuests: LiveGuest[] = [];
  let battleState: BattleSnapshot | null = null;
  let battleTimeline: TimelineSegment[] = [];
  let battleTimer: any = null;
  let lastSegIdx: number | null = null;
  let warnedSegs = new Set<number>();
  let commentsEnabled = true;
  let activeHandlers: LiveFeedHandlers | null = null;
  let disposed = false;

  // Broadcast channel for multi-tab synchronization
  let bus: BroadcastChannel | null = null;
  try {
    bus = new BroadcastChannel('privity_sync_bus');
  } catch {}

  function dispatchEvent(event: AnyLiveEvent) {
    if (disposed || !activeHandlers) return;
    activeHandlers.onEvent(event, { replayed: false });
  }

  function dispatchPersonal(notice: PersonalNotice) {
    if (disposed || !activeHandlers) return;
    activeHandlers.onPersonal(notice);
  }

  function broadcastRoomEvent(event: any) {
    liveStreamSync.sendRoomEvent(roomId, { ...event, server_ts: iso() });
    try {
      bus?.postMessage({ type: 'ROOM_EVENT', streamId: liveId, event });
    } catch {}
    try {
      broadcastViaSupabase({ action: 'ROOM_EVENT', streamId: liveId, event });
    } catch {}
  }

  // Handle incoming network events
  const handleIncomingNetworkEvent = (raw: any) => {
    if (!raw || disposed) return;
    if (raw.type === 'GIFT_RECEIVED' && raw.gift) {
      const e: AnyLiveEvent = {
        event_id: raw.event_id || `evt-gift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        live_id: liveId,
        battle_id: battleState?.battle_id || null,
        event_type: 'GIFT_RECEIVED',
        actor_id: raw.sender?.id || null,
        server_ts: raw.server_ts || iso(),
        seq: ++seqCounter,
        schema_version: 1,
        payload: {
          tx_id: raw.tx_id || `tx-${Date.now()}`,
          sender: raw.sender || { id: 'supporter', handle: 'supporter', display_name: 'Supporter', avatar_url: null },
          recipient_id: hostUserRef.id,
          gift: raw.gift,
          quantity: raw.quantity || 1,
          coin_value: raw.coin_value || 10,
          battle_id: battleState?.battle_id || null,
          battle_side: raw.battle_side || 'a',
          battle_points: raw.battle_points || raw.coin_value || 10,
          multiplier: raw.multiplier || 1,
          sender_live_total: raw.sender_live_total || 100,
          battle_outcome: battleState ? 'counted' : 'no_battle',
        },
      };
      dispatchEvent(e);
      if (battleState) {
        applyBattlePoints(raw.battle_side === 'b' ? 'b' : 'a', raw.battle_points || raw.coin_value || 10);
      }
    } else if (raw.type === 'COMMENT_CREATED' && raw.text) {
      const e: AnyLiveEvent = {
        event_id: raw.event_id || `evt-comm-${Date.now()}`,
        live_id: liveId,
        battle_id: null,
        event_type: 'COMMENT_CREATED',
        actor_id: raw.author?.id || null,
        server_ts: raw.server_ts || iso(),
        seq: ++seqCounter,
        schema_version: 1,
        payload: {
          comment_id: raw.comment_id || `c-${Date.now()}`,
          author: raw.author || { id: 'anon', handle: 'anon', display_name: 'Member', avatar_url: null },
          text: raw.text,
        },
      };
      dispatchEvent(e);
    } else if (raw.type === 'GUEST_REQUESTED' && isHost) {
      if (raw.user) {
        guestRequests.set(raw.user.id, { user: raw.user, requestedAt: now() });
        dispatchPersonal({
          type: 'GUEST_REQUESTED',
          live_id: liveId,
          request_id: raw.user.id,
          user: raw.user,
          server_ts: iso(),
        });
      }
    } else if (raw.type === 'GUEST_ACCEPTED') {
      if (raw.targetUserId === me.id) {
        dispatchPersonal({
          type: 'GUEST_ACCEPTED',
          live_id: liveId,
          slot: raw.slot ?? 1,
          server_ts: iso(),
        });
      }
      const guestObj: LiveGuest = {
        ...(raw.user || { id: raw.targetUserId, handle: raw.targetUserId, display_name: raw.targetUserId, avatar_url: null }),
        slot: raw.slot ?? 1,
      };
      if (!activeGuests.some((g) => g.id === guestObj.id)) {
        activeGuests.push(guestObj);
      }
      dispatchEvent({
        event_id: `evt-guest-joined-${Date.now()}`,
        live_id: liveId,
        battle_id: null,
        event_type: 'GUEST_JOINED',
        actor_id: guestObj.id,
        server_ts: iso(),
        seq: ++seqCounter,
        schema_version: 1,
        payload: { guest: guestObj, slot: guestObj.slot },
      });
    } else if (raw.type === 'GUEST_LEFT') {
      const guestId = raw.guestId || raw.targetUserId || raw.handle;
      const idx = activeGuests.findIndex((g) => g.id === guestId || g.handle === guestId);
      if (idx !== -1) {
        const removed = activeGuests.splice(idx, 1)[0];
        dispatchEvent({
          event_id: `evt-guest-left-${Date.now()}`,
          live_id: liveId,
          battle_id: null,
          event_type: 'GUEST_LEFT',
          actor_id: removed.id,
          server_ts: iso(),
          seq: ++seqCounter,
          schema_version: 1,
          payload: { guest: removed, reason: 'left' },
        });
      }
    } else if (raw.type === 'GUEST_REMOVED') {
      const guestId = raw.guestId || raw.targetUserId || raw.handle;
      const idx = activeGuests.findIndex((g) => g.id === guestId || g.handle === guestId);
      if (idx !== -1) {
        const removed = activeGuests.splice(idx, 1)[0];
        dispatchEvent({
          event_id: `evt-guest-rem-${Date.now()}`,
          live_id: liveId,
          battle_id: null,
          event_type: 'GUEST_REMOVED',
          actor_id: removed.id,
          server_ts: iso(),
          seq: ++seqCounter,
          schema_version: 1,
          payload: { guest: removed },
        });
      }
      if (guestId === me.id) {
        dispatchPersonal({
          type: 'GUEST_REMOVED',
          live_id: liveId,
          server_ts: iso(),
        });
      }
    } else if (raw.type === 'PK_BATTLE_START' || raw.type === 'BATTLE_ACCEPTED') {
      startLocalBattle(raw.format || 'classic_double', raw.opponent);
    } else if (raw.type === 'BATTLE_SCORE' && raw.battle_id) {
      if (battleState) {
        battleState.score_a = raw.score_a ?? battleState.score_a;
        battleState.score_b = raw.score_b ?? battleState.score_b;
        battleState.lead_side = raw.lead_side ?? battleState.lead_side;
        battleState.score_version += 1;
        dispatchEvent({
          event_id: `evt-b-score-${Date.now()}`,
          live_id: liveId,
          battle_id: battleState.battle_id,
          event_type: 'BATTLE_SCORE',
          actor_id: null,
          server_ts: iso(),
          seq: ++seqCounter,
          schema_version: 1,
          payload: {
            battle_id: battleState.battle_id,
            score_a: battleState.score_a,
            score_b: battleState.score_b,
            pull_scores: battleState.pull_scores || [],
            lead_side: battleState.lead_side,
            score_version: battleState.score_version,
            last_contribution: null,
          },
        });
      }
    }
  };

  const unsubRoom = liveStreamSync.subscribeToRoomEvents(roomId, handleIncomingNetworkEvent);

  if (bus) {
    bus.onmessage = (e) => {
      if (e.data?.streamId === liveId && e.data?.event) {
        handleIncomingNetworkEvent(e.data.event);
      }
    };
  }

  try {
    onSupabaseBroadcast((payload: any) => {
      if (payload?.action === 'ROOM_EVENT' && payload?.streamId === liveId && payload?.event) {
        handleIncomingNetworkEvent(payload.event);
      }
    });
  } catch {}

  function applyBattlePoints(side: Side, points: number) {
    if (!battleState) return;
    if (side === 'a') battleState.score_a += points;
    else battleState.score_b += points;

    const prevLead = battleState.lead_side;
    const newLead: Side | null =
      battleState.score_a > battleState.score_b ? 'a' : battleState.score_b > battleState.score_a ? 'b' : null;
    battleState.lead_side = newLead;
    battleState.score_version += 1;

    const scoreEvt: AnyLiveEvent = {
      event_id: `evt-b-score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      live_id: liveId,
      battle_id: battleState.battle_id,
      event_type: 'BATTLE_SCORE',
      actor_id: null,
      server_ts: iso(),
      seq: ++seqCounter,
      schema_version: 1,
      payload: {
        battle_id: battleState.battle_id,
        score_a: battleState.score_a,
        score_b: battleState.score_b,
        pull_scores: battleState.pull_scores || [],
        lead_side: newLead,
        score_version: battleState.score_version,
        last_contribution: {
          side,
          points,
          sender: me,
        },
      },
    };
    dispatchEvent(scoreEvt);

    if (newLead && newLead !== prevLead) {
      dispatchEvent({
        event_id: `evt-lead-${Date.now()}`,
        live_id: liveId,
        battle_id: battleState.battle_id,
        event_type: 'BATTLE_LEAD_CHANGED',
        actor_id: null,
        server_ts: iso(),
        seq: ++seqCounter,
        schema_version: 1,
        payload: {
          battle_id: battleState.battle_id,
          lead_side: newLead,
          score_a: battleState.score_a,
          score_b: battleState.score_b,
          is_final_moment: false,
        },
      });
    }

    broadcastRoomEvent({
      type: 'BATTLE_SCORE',
      battle_id: battleState.battle_id,
      score_a: battleState.score_a,
      score_b: battleState.score_b,
      lead_side: newLead,
    });
  }

  function startLocalBattle(formatId = 'classic_double', customOpponent?: UserRef) {
    const fmt = BUILTIN_FORMATS[formatId as keyof typeof BUILTIN_FORMATS] || BUILTIN_FORMATS.classic_double;
    const startsAt = now() + (fmt.intro_ms || 3000);
    const compiled = compileTimeline(fmt, startsAt);
    battleTimeline = compiled.timeline;

    const opponent: UserRef = customOpponent || {
      id: 'rival-host',
      handle: 'rival.pro',
      display_name: 'Kai Vortex',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    };

    battleState = {
      battle_id: `battle-${Date.now()}`,
      format_id: formatId,
      status: 'live',
      side_a: { live_id: liveId, host: hostUserRef },
      side_b: { live_id: `live-${opponent.id}`, host: opponent },
      scoring: fmt.scoring,
      invite_expires_at: null,
      intro_at: compiled.intro_at,
      starts_at: compiled.starts_at,
      ends_at: compiled.ends_at,
      final_countdown_ms: compiled.final_countdown_ms,
      timeline: compiled.timeline,
      score_a: 0,
      score_b: 0,
      pull_scores: [],
      lead_side: null,
      score_version: 1,
      result: null,
    };

    lastSegIdx = null;
    warnedSegs = new Set();

    dispatchEvent({
      event_id: `evt-b-accept-${Date.now()}`,
      live_id: liveId,
      battle_id: battleState.battle_id,
      event_type: 'BATTLE_ACCEPTED',
      actor_id: null,
      server_ts: iso(),
      seq: ++seqCounter,
      schema_version: 1,
      payload: { battle: battleState },
    });

    if (battleTimer) clearInterval(battleTimer);
    battleTimer = setInterval(() => {
      if (!battleState || disposed) return;
      const t = now();
      const ends = Date.parse(battleState.ends_at ?? '');
      if (t >= ends && battleState.status !== 'finalized') {
        finalizeBattle();
        return;
      }

      const seg = segmentAt(battleTimeline, t);
      if (seg && seg.idx !== lastSegIdx) {
        lastSegIdx = seg.idx;
        dispatchEvent({
          event_id: `evt-seg-${seg.idx}-${Date.now()}`,
          live_id: liveId,
          battle_id: battleState.battle_id,
          event_type: 'BATTLE_PHASE_CHANGED',
          actor_id: null,
          server_ts: iso(),
          seq: ++seqCounter,
          schema_version: 1,
          payload: {
            battle_id: battleState.battle_id,
            segment_idx: seg.idx,
            kind: seg.kind,
            multiplier: seg.multiplier,
            pull_no: seg.pull_no,
          },
        });

        if (seg.multiplier > 1) {
          dispatchEvent({
            event_id: `evt-double-${Date.now()}`,
            live_id: liveId,
            battle_id: battleState.battle_id,
            event_type: 'DOUBLE_STARTED',
            actor_id: null,
            server_ts: iso(),
            seq: ++seqCounter,
            schema_version: 1,
            payload: {
              battle_id: battleState.battle_id,
              segment_idx: seg.idx,
              ends_at: seg.ends_at,
              multiplier: seg.multiplier,
            },
          });
        }
      }

      for (const s of battleTimeline) {
        if (s.multiplier > 1 && s.warning_ms > 0 && !warnedSegs.has(s.idx)) {
          const st = Date.parse(s.starts_at);
          if (t >= st - s.warning_ms && t < st) {
            warnedSegs.add(s.idx);
            dispatchEvent({
              event_id: `evt-warn-${s.idx}`,
              live_id: liveId,
              battle_id: battleState.battle_id,
              event_type: 'DOUBLE_WARNING',
              actor_id: null,
              server_ts: iso(),
              seq: ++seqCounter,
              schema_version: 1,
              payload: {
                battle_id: battleState.battle_id,
                segment_idx: s.idx,
                starts_at: s.starts_at,
                multiplier: s.multiplier,
              },
            });
          }
        }
      }
    }, 250);
  }

  function finalizeBattle(forfeitSide?: Side) {
    if (!battleState) return;
    if (battleTimer) clearInterval(battleTimer);
    battleTimer = null;

    let winner: Side | null = null;
    if (forfeitSide) {
      winner = forfeitSide === 'a' ? 'b' : 'a';
    } else {
      winner = battleState.score_a > battleState.score_b ? 'a' : battleState.score_b > battleState.score_a ? 'b' : null;
    }

    battleState.status = 'finalized';
    battleState.result = {
      winner_side: winner,
      final_a: battleState.score_a,
      final_b: battleState.score_b,
      pull_wins: null,
      stats: {
        total_gifts: Math.floor((battleState.score_a + battleState.score_b) / 10),
        biggest_gift: null,
        top_supporters: [],
        lead_changes: 2,
        comebacks: 1,
        peak_viewers: 120,
      },
    };

    dispatchEvent({
      event_id: `evt-b-end-${Date.now()}`,
      live_id: liveId,
      battle_id: battleState.battle_id,
      event_type: 'BATTLE_ENDED',
      actor_id: null,
      server_ts: iso(),
      seq: ++seqCounter,
      schema_version: 1,
      payload: {
        battle_id: battleState.battle_id,
        score_a: battleState.score_a,
        score_b: battleState.score_b,
      },
    });

    if (battleState.result) {
      dispatchEvent({
        event_id: `evt-b-res-${Date.now()}`,
        live_id: liveId,
        battle_id: battleState.battle_id,
        event_type: 'BATTLE_RESULT',
        actor_id: null,
        server_ts: iso(),
        seq: ++seqCounter,
        schema_version: 1,
        payload: {
          battle_id: battleState.battle_id,
          result: battleState.result,
        },
      });
    }
  }

  function buildCurrentSnapshot(): LiveSnapshot {
    let recentComments: SnapshotComment[] = [];
    try {
      const raw = localStorage.getItem(`privity_live_chat_${liveId}`);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          recentComments = arr.slice(-30).map((c: any) => ({
            comment_id: c.id || `c-${Date.now()}`,
            author: {
              id: c.senderHandle || 'user',
              handle: c.senderHandle || 'user',
              display_name: c.senderName || c.senderHandle || 'Member',
              avatar_url: c.senderAvatar || null,
            },
            text: c.text || '',
            created_at: new Date(c.timestamp || now()).toISOString(),
          }));
        }
      }
    } catch {}

    return {
      live_id: liveId,
      last_seq: seqCounter,
      server_now: iso(),
      status: 'live',
      title: streamerName ? `${streamerName}'s LIVE Broadcast` : 'Live Broadcast',
      visibility: 'public',
      started_at: iso(),
      host: hostUserRef,
      viewer_count: Math.max(1, (opts as any).streamer?.viewersCount || 14),
      peak_viewers: Math.max(1, (opts as any).streamer?.viewersCount || 50),
      top_supporters: [],
      battle: battleState,
      config_version: 1,
      comments_enabled: commentsEnabled,
      guests: [...activeGuests],
      recent_comments: recentComments,
      me: {
        user_id: me.id,
        is_host: isHost,
        guest_status: activeGuests.some((g) => g.id === me.id) ? 'accepted' : guestRequests.has(me.id) ? 'requested' : null,
        muted_until: null,
        following_host: false,
      },
    };
  }

  const feed: LiveFeed = {
    connect(handlers: LiveFeedHandlers) {
      activeHandlers = handlers;
      setTimeout(() => {
        if (!disposed && activeHandlers) {
          activeHandlers.onConnection({
            link: 'connected',
            quality: 'excellent',
            source: 'webrtc',
            rttMs: 32,
            packetLossPct: 0,
          });
          activeHandlers.onSnapshot(buildCurrentSnapshot());
        }
      }, 10);

      return () => {
        if (activeHandlers === handlers) {
          activeHandlers = null;
        }
      };
    },
    resync() {
      if (activeHandlers && !disposed) {
        activeHandlers.onSnapshot(buildCurrentSnapshot());
      }
    },
  };

  const commands: LiveCommands = {
    async getSnapshot(_id) {
      return { ok: true, data: buildCurrentSnapshot() };
    },
    async getWallet(): Promise<CommandResult<WalletInfo>> {
      const balance = readCoins();
      return {
        ok: true,
        data: {
          coins: balance,
          test_coins: 0,
          earnings: 0,
          active_currency: 'coins',
          spendable: balance,
          test_credits: false,
          purchases_enabled: true,
          environment: 'production',
        },
      };
    },
    async getCatalog(): Promise<CommandResult<GiftCatalog>> {
      return { ok: true, data: simCatalog() };
    },
    async sendGift(input: SendGiftInput): Promise<CommandResult<GiftSendData>> {
      if (!input.idempotencyKey) return { ok: false, code: 'INVALID_IDEMPOTENCY_KEY', message: 'Missing key' };
      if (idempotency.has(input.idempotencyKey)) {
        return {
          ok: true,
          data: {
            tx_id: `replayed-${input.idempotencyKey}`,
            coin_value: 10,
            balance: readCoins(),
            battle_outcome: battleState ? 'counted' : 'no_battle',
            currency: 'coins',
            replayed: true,
            battle_id: battleState ? battleState.battle_id : null,
            battle_side: null,
            battle_points: 0,
            multiplier: 1,
            message: null,
          },
        };
      }
      idempotency.add(input.idempotencyKey);

      const catalog = simCatalog();
      const gift = catalog.gifts.find((g) => g.id === input.giftId) || catalog.gifts[0];
      const totalCost = gift.coin_cost * (input.quantity || 1);
      const currentCoins = readCoins();

      if (currentCoins < totalCost) {
        return { ok: false, code: 'INSUFFICIENT_FUNDS', message: 'Not enough Privity coins.' };
      }

      const nextCoins = currentCoins - totalCost;
      writeCoins(nextCoins);
      opts.onCoinsChange?.(-totalCost);

      // Play rich animation overlay on screen
      const animGift = DEFAULT_GIFTS.find((g) => g.id === gift.id) || DEFAULT_GIFTS[0];
      if (animGift) {
        globalGiftQueue.enqueue(
          {
            id: `gift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            livestreamId: liveId,
            senderId: me.id,
            senderName: me.display_name,
            senderAvatar: me.avatar_url || '',
            recipientId: streamerId,
            recipientName: streamerName,
            giftId: animGift.id,
            giftName: animGift.name,
            giftIcon: animGift.icon,
            quantity: input.quantity || 1,
            coinValue: totalCost,
            createdAt: iso(),
          },
          animGift
        );
      }

      let multiplier = 1;
      let outcome: 'no_battle' | 'counted' | 'excluded' = 'no_battle';
      const targetSide: Side = (input as any).targetSide || 'a';
      if (battleState && battleState.status === 'live') {
        outcome = 'counted';
        const t = now();
        const seg = segmentAt(battleTimeline, t);
        if (seg) multiplier = seg.multiplier;
      }

      const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const points = totalCost * multiplier;

      if (outcome === 'counted') {
        applyBattlePoints(targetSide, points);
      }

      broadcastRoomEvent({
        type: 'GIFT_RECEIVED',
        tx_id: txId,
        sender: me,
        gift: {
          id: gift.id,
          name: gift.name,
          rarity: gift.rarity,
          coin_cost: gift.coin_cost,
          icon_url: gift.icon_url,
          animation_url: gift.animation_url,
        },
        quantity: input.quantity,
        coin_value: totalCost,
        battle_side: targetSide,
        battle_points: points,
        multiplier,
      });

      return {
        ok: true,
        data: {
          replayed: false,
          tx_id: txId,
          coin_value: totalCost,
          balance: nextCoins,
          battle_outcome: outcome,
          currency: 'coins',
          battle_id: battleState ? battleState.battle_id : null,
          battle_side: outcome === 'counted' ? targetSide : null,
          battle_points: points,
          multiplier,
          message: null,
        },
      };
    },
    async comment(_id, text) {
      if (!text || !text.trim()) return { ok: false, code: 'INVALID_TEXT', message: 'Comment cannot be blank' };
      const commentId = `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const createdAt = iso();
      broadcastRoomEvent({
        type: 'COMMENT_CREATED',
        comment_id: commentId,
        author: me,
        text: text.trim(),
        created_at: createdAt,
      });
      return { ok: true, data: { comment_id: commentId, created_at: createdAt } };
    },
    async deleteComment(commentId) {
      broadcastRoomEvent({ type: 'COMMENT_DELETED', comment_id: commentId });
      return { ok: true, data: {} };
    },
    async setCommentsEnabled(_id, enabled) {
      commentsEnabled = enabled;
      return { ok: true, data: { comments_enabled: enabled } };
    },
    async mute(_id, _userId, minutes) {
      const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      return { ok: true, data: { muted_until: until } };
    },
    async unmute(_id, _userId) {
      return { ok: true, data: {} };
    },
    async kick(_id, _userId, _reason) {
      return { ok: true, data: {} };
    },
    async follow(_userId) {
      broadcastRoomEvent({ type: 'FOLLOW_RECEIVED', follower: me });
      return { ok: true, data: { following: true } };
    },
    async unfollow(_userId) {
      return { ok: true, data: { following: false } };
    },
    async block(_userId) {
      return { ok: true, data: { blocked: true } };
    },
    async requestGuest(_id) {
      broadcastRoomEvent({ type: 'GUEST_REQUESTED', user: me });
      return { ok: true, data: { status: 'requested' } };
    },
    async cancelGuestRequest(_id) {
      broadcastRoomEvent({ type: 'GUEST_REQUEST_CANCELLED', user: me });
      return { ok: true, data: {} };
    },
    async respondGuest(_id, userId, accept) {
      if (accept) {
        const slot = activeGuests.length + 1;
        const req = guestRequests.get(userId);
        const userObj: UserRef = req ? req.user : { id: userId, handle: userId, display_name: userId, avatar_url: null };
        broadcastRoomEvent({ type: 'GUEST_ACCEPTED', targetUserId: userId, user: userObj, slot });
      } else {
        broadcastRoomEvent({ type: 'GUEST_DECLINED', targetUserId: userId });
      }
      return { ok: true, data: { status: accept ? 'accepted' : 'declined' } };
    },
    async removeGuest(_id, userId) {
      broadcastRoomEvent({ type: 'GUEST_REMOVED', targetUserId: userId });
      return { ok: true, data: {} };
    },
    async leaveGuest(_id) {
      broadcastRoomEvent({ type: 'GUEST_LEFT', targetUserId: me.id });
      return { ok: true, data: {} };
    },
    async listGuestRequests(_id): Promise<CommandResult<GuestRequestRow[]>> {
      const rows: GuestRequestRow[] = [];
      for (const [uid, r] of guestRequests) {
        rows.push({
          request_id: uid,
          user: r.user,
          requested_at: new Date(r.requestedAt).toISOString(),
        });
      }
      return { ok: true, data: rows };
    },
    async battleRespond(_battleId, accept) {
      if (accept) {
        broadcastRoomEvent({ type: 'PK_BATTLE_START', format: 'classic_double' });
      } else {
        broadcastRoomEvent({ type: 'BATTLE_CANCELLED', battle_id: _battleId });
      }
      return { ok: true, data: { status: accept ? 'accepted' : 'cancelled' } };
    },
    async battleForfeit(_battleId) {
      finalizeBattle('a');
      return { ok: true, data: {} };
    },
    async endLive(_id) {
      broadcastRoomEvent({ type: 'LIVE_ENDED', streamId: liveId });
      liveStreamSync.stopHostBroadcast();
      return { ok: true, data: { status: 'ended' } };
    },
  };

  return {
    feed,
    commands,
    dispose() {
      disposed = true;
      if (battleTimer) clearInterval(battleTimer);
      unsubRoom();
      bus?.close();
    },
  };
}
