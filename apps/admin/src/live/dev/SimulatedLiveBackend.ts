/**
 * SimulatedLiveBackend — plays the SERVER's role in the LIVE Lab.
 *
 * It implements the same contract as S2 (LiveCommands + realtime events + personal notices)
 * so every Lab screen exercises the real client path: UI → LiveCommands → "server" decides →
 * events → room reducer → LiveShowEngine. Prices come from the seed catalog mirror, balances
 * from simulated test-credit wallets, battle points from the compiled timeline segment at
 * "server" time — exactly the rules in `live_send_gift`. UI code never computes any of these.
 *
 * DEV ONLY. Never imported by production code paths.
 */

import {
  AnyLiveEvent,
  BattleResult,
  BattleSnapshot,
  GiftRef,
  GuestStatus,
  LiveEventPayloads,
  LiveEventType,
  LiveSnapshot,
  Side,
  SnapshotComment,
  UserRef,
} from '../core/events';
import { BUILTIN_FORMATS, compileTimeline, segmentAt } from '../battle/timeline';
import { EventFactory } from './fixtures';
import { simCatalog, SIM_MAX_QUANTITY } from './simCatalog';
import {
  CatalogGift,
  CommandResult,
  GiftSendData,
  GuestRequestRow,
  LiveCommands,
  SendGiftInput,
  WalletInfo,
} from '../client/LiveCommands';
import { ConnectionState, MediaQuality } from '../client/connection';
import { LiveFeed, LiveFeedHandlers, PersonalNotice } from '../client/LiveRoomController';

interface SimUser {
  ref: UserRef;
  testCoins: number;
  earnings: number;
}

interface Supporter {
  total: number;
  firstAt: number;
  streakGift: string | null;
  streakCount: number;
  streakLastAt: number;
  thresholds: Set<number>;
}

interface GuestRow {
  status: GuestStatus;
  slot: number | null;
  requestedAt: number;
  decidedAt: number | null;
}

interface FeedSub {
  userId: string;
  liveId: string;
  h: LiveFeedHandlers;
}

export interface SimConfig {
  guestSlots: number;
  commentMinIntervalMs: number;
  commentMaxPer10s: number;
  supporterThresholds: number[];
  topMinCoins: number;
  topCooldownMs: number;
  streakWindowMs: number;
  streakEmitAt: number[];
  viewerMilestones: number[];
  followMilestones: number[];
  leadHysteresisPoints: number;
  leadCooldownMs: number;
  finalMomentMs: number;
  latencyMs: number;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  // The server default is 3 (hard max 8). The Lab uses the hard max to exercise larger layouts.
  guestSlots: 8,
  commentMinIntervalMs: 1000,
  commentMaxPer10s: 5,
  supporterThresholds: [500, 1000, 5000, 10000],
  topMinCoins: 100,
  topCooldownMs: 20000,
  streakWindowMs: 4000,
  streakEmitAt: [5, 10, 25, 50],
  viewerMilestones: [100, 500, 1000, 5000, 10000],
  followMilestones: [10, 50, 100, 500, 1000],
  leadHysteresisPoints: 50,
  leadCooldownMs: 6000,
  finalMomentMs: 10000,
  latencyMs: 140,
};

type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; code: string; message: string; details?: Record<string, unknown> };
const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
const fail = (code: string, message = code, details?: Record<string, unknown>): Fail => ({ ok: false, code, message, details });

const REJECT_MESSAGES: Record<string, string> = {
  BATTLE_LOCKED: 'Battle ended — this gift will not affect the battle score.',
  BATTLE_NOT_STARTED: 'The battle has not started yet — this gift would not affect the battle score.',
  BATTLE_BREAK: 'The battle is between rounds — this gift would not affect the battle score.',
  BATTLE_CHANGED: 'The battle changed. Please review and send again.',
  BATTLE_SCORING_ACTIVE: 'The battle is live — gifts count toward the battle score.',
  INSUFFICIENT_FUNDS: 'Not enough coins.',
};

export class SimulatedLiveBackend {
  readonly liveId: string;
  readonly host: UserRef;
  readonly config: SimConfig;
  private readonly now: () => number;
  private readonly factory: EventFactory;
  private readonly catalog = simCatalog();
  private readonly users = new Map<string, SimUser>();
  private readonly subs = new Set<FeedSub>();

  // Session state
  private status: 'live' | 'ended' = 'live';
  private title: string;
  private startedAt: number;
  private viewerCount = 0;
  private peakViewers = 0;
  private viewerMilestonesHit = new Set<number>();
  private commentsEnabled = true;
  private comments: SnapshotComment[] = [];
  private commentTimes = new Map<string, number[]>();
  private mutes = new Map<string, number>();
  private bans = new Set<string>();
  private follows = new Set<string>();
  private newFollowers = 0;
  private followMilestonesHit = new Set<number>();
  private guests = new Map<string, GuestRow>();
  private supporters = new Map<string, Supporter>();
  private topSupporterId: string | null = null;
  private topSupporterEventAt: number | null = null;
  private idempotency = new Map<string, { input: SendGiftInput; result: GiftSendData }>();
  private battle: BattleSnapshot | null = null;
  private battleMeta: {
    finalizedAt: number | null;
    lastSegIdx: number | null;
    warned: Set<number>;
    finalCountdownSent: boolean;
    lastLeadSide: Side | null;
    lastLeadAt: number;
    leadChanges: number;
    comebacks: number;
    totalGifts: number;
    biggest: BattleResult['stats']['biggest_gift'];
    supporters: Map<string, { side: Side; user: UserRef; points: number }>;
    maxDeficit: { a: number; b: number };
  } | null = null;
  private battleTimer: ReturnType<typeof setInterval> | null = null;
  private inviteTimer: ReturnType<typeof setTimeout> | null = null;

  // Transport simulation
  private link: ConnectionState['link'] = 'connected';
  private quality: MediaQuality = 'unknown';
  private failNext = new Map<string, string>();
  private disposed = false;
  private readonly listeners = new Set<() => void>();

  constructor(opts: { host: UserRef; liveId?: string; title?: string; now?: () => number; config?: Partial<SimConfig> }) {
    this.host = opts.host;
    this.liveId = opts.liveId ?? 'live-lab-1';
    this.title = opts.title ?? 'LIVE';
    this.now = opts.now ?? (() => Date.now());
    this.config = { ...DEFAULT_SIM_CONFIG, ...opts.config };
    this.factory = new EventFactory(this.liveId);
    this.startedAt = this.now();
    this.ensureUser(opts.host, 0);
  }

  // ===========================================================================
  // Lab plumbing
  // ===========================================================================

  /** Notifies the Lab inspector when backend state changes. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  ensureUser(ref: UserRef, testCoins = 0): void {
    const u = this.users.get(ref.id);
    if (u) u.ref = ref;
    else this.users.set(ref.id, { ref, testCoins, earnings: 0 });
  }

  getUser(id: string): SimUser | null {
    return this.users.get(id) ?? null;
  }

  inspect() {
    return {
      status: this.status,
      viewers: this.viewerCount,
      link: this.link,
      quality: this.quality,
      battle: this.battle ? { id: this.battle.battle_id, status: this.battle.status, a: this.battle.score_a, b: this.battle.score_b } : null,
      guests: [...this.guests.entries()].filter(([, g]) => g.status === 'accepted').length,
      requests: [...this.guests.entries()].filter(([, g]) => g.status === 'requested').length,
      lastSeq: this.factory.lastSeq,
      hostEarnings: this.users.get(this.host.id)?.earnings ?? 0,
    };
  }

  dispose(): void {
    this.disposed = true;
    this.stopBattleTimer();
    if (this.inviteTimer) clearTimeout(this.inviteTimer);
    this.subs.clear();
    this.listeners.clear();
  }

  // ===========================================================================
  // Transport: feeds and commands
  // ===========================================================================

  feedFor(userId: string, liveId: string = this.liveId): LiveFeed {
    let sub: FeedSub | null = null;
    return {
      connect: (h) => {
        sub = { userId, liveId, h };
        this.subs.add(sub);
        const s = sub;
        this.later(() => this.deliverInitial(s));
        return () => {
          if (s) this.subs.delete(s);
        };
      },
      resync: () => {
        const s = sub;
        if (s && this.link === 'connected') this.later(() => this.deliverInitial(s));
      },
    };
  }

  commandsFor(userId: string): LiveCommands {
    const run = <T>(name: string, fn: () => Ok<T> | Fail): Promise<CommandResult<T>> =>
      new Promise((resolve) => {
        setTimeout(() => {
          if (this.link !== 'connected') return resolve(fail('NETWORK_ERROR', 'Network unavailable'));
          const injected = this.failNext.get(name) ?? this.failNext.get('*');
          if (injected) {
            this.failNext.delete(this.failNext.has(name) ? name : '*');
            return resolve(fail(injected, injected));
          }
          try {
            resolve(fn());
          } catch (err) {
            resolve(fail(err instanceof SimFail ? err.code : 'SERVER_ERROR', err instanceof Error ? err.message : 'error'));
          } finally {
            this.notifyInspector();
          }
        }, this.config.latencyMs);
      });

    return {
      getSnapshot: (liveId) => run('getSnapshot', () => (liveId === this.liveId ? ok(this.snapshotFor(userId)) : fail('LIVE_NOT_FOUND'))),
      getWallet: () => run('getWallet', () => ok(this.walletFor(userId))),
      getCatalog: () => run('getCatalog', () => ok(simCatalog())),
      sendGift: (input) => run('sendGift', () => this.sendGift(userId, input)),
      comment: (liveId, text) => run('comment', () => this.comment(userId, liveId, text)),
      deleteComment: (commentId) => run('deleteComment', () => this.deleteComment(userId, commentId)),
      setCommentsEnabled: (liveId, enabled) => run('setCommentsEnabled', () => this.setCommentsEnabled(userId, liveId, enabled)),
      mute: (liveId, target, minutes) => run('mute', () => this.mute(userId, liveId, target, minutes)),
      unmute: (liveId, target) => run('unmute', () => this.unmute(userId, liveId, target)),
      kick: (liveId, target) => run('kick', () => this.kick(userId, liveId, target)),
      follow: (target) => run('follow', () => this.follow(userId, target)),
      unfollow: (target) => run('unfollow', () => this.unfollow(userId, target)),
      block: (target) => run('block', () => this.block(userId, target)),
      requestGuest: (liveId) => run('requestGuest', () => this.requestGuest(userId, liveId)),
      cancelGuestRequest: (liveId) => run('cancelGuestRequest', () => this.cancelGuestRequest(userId, liveId)),
      respondGuest: (liveId, target, accept) => run('respondGuest', () => this.respondGuest(userId, liveId, target, accept)),
      removeGuest: (liveId, target) => run('removeGuest', () => this.removeGuest(userId, liveId, target)),
      leaveGuest: (liveId) => run('leaveGuest', () => this.leaveGuest(userId, liveId)),
      listGuestRequests: (liveId) => run('listGuestRequests', () => this.listGuestRequests(userId, liveId)),
      battleRespond: (battleId, accept) => run('battleRespond', () => this.battleRespond(userId, battleId, accept)),
      battleForfeit: (battleId) => run('battleForfeit', () => this.battleForfeit(userId, battleId)),
      endLive: (liveId) => run('endLive', () => this.endLive(userId, liveId)),
    };
  }

  // ===========================================================================
  // Server logic (mirrors S2 RPC semantics)
  // ===========================================================================

  private requireLive(liveId: string): void {
    if (liveId !== this.liveId) throw new SimFail('LIVE_NOT_FOUND');
    if (this.status !== 'live') throw new SimFail('LIVE_NOT_ACTIVE');
  }

  private canView(userId: string): boolean {
    return !this.bans.has(userId);
  }

  private sendGift(uid: string, input: SendGiftInput): Ok<GiftSendData> | Fail {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > SIM_MAX_QUANTITY) throw new SimFail('INVALID_QUANTITY');
    if (!input.idempotencyKey || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 128) throw new SimFail('INVALID_IDEMPOTENCY_KEY');
    if (input.liveId !== this.liveId) throw new SimFail('LIVE_NOT_FOUND');
    if (uid === this.host.id) throw new SimFail('CANNOT_GIFT_SELF');

    const idemKey = `${uid}:${input.idempotencyKey}`;
    const prior = this.idempotency.get(idemKey);
    if (prior) {
      const p = prior.input;
      if (p.liveId !== input.liveId || p.giftId !== input.giftId || p.quantity !== input.quantity || p.battleMode !== input.battleMode) {
        throw new SimFail('IDEMPOTENCY_KEY_REUSED');
      }
      return ok({ ...prior.result, replayed: true, balance: this.users.get(uid)?.testCoins ?? 0 });
    }

    if (this.status !== 'live') throw new SimFail('LIVE_NOT_ACTIVE');
    if (!this.canView(uid)) throw new SimFail('LIVE_ACCESS_DENIED');
    const g = this.catalog.gifts.find((x) => x.id === input.giftId);
    if (!g) throw new SimFail('GIFT_UNAVAILABLE');

    const sender = this.users.get(uid);
    const cost = g.coin_cost * input.quantity;
    const balance = sender?.testCoins ?? 0;
    if (balance < cost) {
      return fail('INSUFFICIENT_FUNDS', REJECT_MESSAGES.INSUFFICIENT_FUNDS, { currency: 'test_coins', balance, required: cost });
    }

    // Battle decision on "server" time.
    const now = this.now();
    const b = this.battle;
    let outcome: GiftSendData['battle_outcome'] = 'no_battle';
    let points = 0;
    let mult = 0;
    let reject: string | null = null;
    let seg: ReturnType<typeof segmentAt> = null;
    const finalizedRecently = b?.status === 'finalized' && (this.battleMeta?.finalizedAt ?? 0) > now - 60000;
    if (b && (b.status === 'accepted' || b.status === 'live' || b.status === 'locked' || finalizedRecently)) {
      const starts = Date.parse(b.starts_at ?? '');
      const ends = Date.parse(b.ends_at ?? '');
      if (input.battleMode === 'auto' && input.expectedBattleId && input.expectedBattleId !== b.battle_id) reject = 'BATTLE_CHANGED';
      else if (b.status === 'locked' || b.status === 'finalized' || now >= ends) {
        outcome = 'excluded';
        if (input.battleMode === 'auto') reject = 'BATTLE_LOCKED';
      } else if (now < starts) {
        outcome = 'excluded';
        if (input.battleMode === 'auto') reject = 'BATTLE_NOT_STARTED';
      } else {
        seg = segmentAt(b.timeline, now);
        if (!seg || seg.multiplier === 0) {
          outcome = 'excluded';
          if (input.battleMode === 'auto') reject = 'BATTLE_BREAK';
        } else if (input.battleMode === 'outside_battle') reject = 'BATTLE_SCORING_ACTIVE';
        else {
          outcome = 'counted';
          mult = seg.multiplier;
          points = Math.max(1, Math.floor(cost * mult));
        }
      }
    } else if (input.battleMode === 'auto' && input.expectedBattleId) {
      reject = 'BATTLE_LOCKED';
    }
    if (reject) return fail(reject, REJECT_MESSAGES[reject] ?? reject, { battle_id: b?.battle_id ?? input.expectedBattleId });

    // Money.
    if (!sender) throw new SimFail('INSUFFICIENT_FUNDS');
    sender.testCoins -= cost;
    const hostUser = this.users.get(this.host.id);
    if (hostUser) hostUser.earnings += cost;

    const txId = `tx-${this.factory.lastSeq + 1}-${Math.random().toString(36).slice(2, 8)}`;
    const side: Side | null = outcome === 'counted' ? 'a' : outcome === 'excluded' ? 'a' : null;
    const result: GiftSendData = {
      replayed: false,
      tx_id: txId,
      coin_value: cost,
      currency: 'test_coins',
      battle_id: outcome !== 'no_battle' ? b?.battle_id ?? null : null,
      battle_side: outcome !== 'no_battle' ? side : null,
      battle_points: points,
      multiplier: mult,
      battle_outcome: outcome,
      message: outcome === 'excluded' ? 'Sent as a LIVE gift — it did not affect the battle score.' : null,
      balance: sender.testCoins,
    };
    this.idempotency.set(idemKey, { input, result });

    // Supporters / streaks / milestones.
    const sup = this.supporters.get(uid) ?? { total: 0, firstAt: now, streakGift: null, streakCount: 0, streakLastAt: 0, thresholds: new Set<number>() };
    const prevTotal = sup.total;
    const prevStreak = sup.streakGift === g.id && sup.streakLastAt > now - this.config.streakWindowMs ? sup.streakCount : 0;
    const streak = prevStreak + input.quantity;
    const streakHit = this.config.streakEmitAt.filter((e) => e > prevStreak && e <= streak).pop() ?? null;
    const crossed = this.config.supporterThresholds.filter((t) => t > prevTotal && t <= prevTotal + cost && !sup.thresholds.has(t));
    sup.total += cost;
    sup.streakGift = g.id;
    sup.streakCount = streak;
    sup.streakLastAt = now;
    crossed.forEach((t) => sup.thresholds.add(t));
    this.supporters.set(uid, sup);

    const giftRef = toGiftRef(g);
    const senderRef = sender.ref;
    this.emit('GIFT_RECEIVED', {
      tx_id: txId,
      sender: senderRef,
      recipient_id: this.host.id,
      gift: giftRef,
      quantity: input.quantity,
      coin_value: cost,
      battle_id: outcome === 'counted' ? b!.battle_id : null,
      battle_side: outcome === 'counted' ? 'a' : null,
      battle_points: points,
      multiplier: mult,
      sender_live_total: sup.total,
      battle_outcome: outcome,
    });
    if (streakHit !== null) this.emit('GIFT_STREAK', { sender: senderRef, gift: giftRef, streak: streakHit });
    if (crossed.length > 0) this.emit('SUPPORTER_MILESTONE', { supporter: senderRef, threshold: crossed[crossed.length - 1], total: sup.total });
    this.updateTopSupporter(now);

    if (outcome === 'counted' && b && seg) this.applyContribution('a', points, senderRef, giftRef, cost, seg.pull_no, now);
    return ok(result);
  }

  private updateTopSupporter(now: number): void {
    let topId: string | null = null;
    let top: Supporter | null = null;
    for (const [id, s] of this.supporters) {
      if (!top || s.total > top.total || (s.total === top.total && s.firstAt < top.firstAt)) {
        top = s;
        topId = id;
      }
    }
    if (!topId || !top || topId === this.topSupporterId) return;
    if (top.total < this.config.topMinCoins) return;
    if (this.topSupporterEventAt !== null && this.topSupporterEventAt > now - this.config.topCooldownMs) return;
    const prev = this.topSupporterId;
    this.topSupporterId = topId;
    this.topSupporterEventAt = now;
    this.emit('TOP_SUPPORTER_CHANGED', {
      supporter: this.users.get(topId)!.ref,
      total: top.total,
      previous: prev ? this.users.get(prev)?.ref ?? null : null,
      previous_total: prev ? this.supporters.get(prev)?.total ?? null : null,
    });
  }

  private applyContribution(side: Side, points: number, sender: UserRef, giftRef: GiftRef, coinValue: number, pullNo: number | null, now: number): void {
    const b = this.battle;
    const m = this.battleMeta;
    if (!b || !m) return;
    const beforeA = b.score_a;
    const beforeB = b.score_b;
    const pulls = b.pull_scores.map((p) => (p.pull_no === pullNo ? { ...p, [side]: p[side] + points } : p));
    const a = beforeA + (side === 'a' ? points : 0);
    const bb = beforeB + (side === 'b' ? points : 0);
    const lead: Side | null = a > bb ? 'a' : bb > a ? 'b' : null;
    m.totalGifts += 1;
    if (!m.biggest || coinValue > m.biggest.coin_value) m.biggest = { sender, gift: giftRef, coin_value: coinValue, side };
    const sup = m.supporters.get(sender.id) ?? { side, user: sender, points: 0 };
    sup.points += points;
    m.supporters.set(sender.id, sup);

    this.battle = {
      ...b,
      status: b.status === 'accepted' ? 'live' : b.status,
      score_a: a,
      score_b: bb,
      pull_scores: pulls,
      lead_side: lead,
      score_version: b.score_version + 1,
    };
    this.emit('BATTLE_SCORE', {
      battle_id: b.battle_id,
      score_a: a,
      score_b: bb,
      pull_scores: pulls,
      lead_side: lead,
      score_version: b.score_version + 1,
      last_contribution: { side, points, sender },
    });

    // Detectors (simplified mirror of live.battle_on_contribution thresholds).
    const ends = Date.parse(b.ends_at ?? '');
    const diff = Math.abs(a - bb);
    if (lead && lead !== m.lastLeadSide && diff >= this.config.leadHysteresisPoints && now - m.lastLeadAt >= this.config.leadCooldownMs) {
      const hadLeader = m.lastLeadSide !== null;
      m.lastLeadSide = lead;
      m.lastLeadAt = now;
      if (hadLeader) m.leadChanges += 1;
      this.emit('BATTLE_LEAD_CHANGED', {
        battle_id: b.battle_id,
        lead_side: lead,
        score_a: a,
        score_b: bb,
        is_final_moment: ends - now <= this.config.finalMomentMs,
      });
    }
    const deficitBefore = side === 'a' ? beforeB - beforeA : beforeA - beforeB;
    const deficitAfter = side === 'a' ? bb - a : a - bb;
    m.maxDeficit[side] = Math.max(m.maxDeficit[side], deficitBefore);
    const leaderTotal = Math.max(beforeA, beforeB);
    if (deficitBefore >= 500 && deficitBefore >= leaderTotal * 0.3 && deficitAfter <= deficitBefore * 0.4) {
      m.comebacks += 1;
      this.emit('BATTLE_COMEBACK', { battle_id: b.battle_id, side, deficit_before: deficitBefore, deficit_after: Math.max(0, deficitAfter) });
    }
    if (points >= 2000 && points >= (a + bb) * 0.15) {
      this.emit('BATTLE_SWING', { battle_id: b.battle_id, side, points, sender, gift: giftRef });
    }
  }

  private comment(uid: string, liveId: string, text: string): Ok<{ comment_id: string; created_at: string }> {
    this.requireLive(liveId);
    if (!this.canView(uid)) throw new SimFail('LIVE_ACCESS_DENIED');
    const isHost = uid === this.host.id;
    if (!this.commentsEnabled && !isHost) throw new SimFail('COMMENTS_DISABLED');
    if ((this.mutes.get(uid) ?? 0) > this.now()) throw new SimFail('MUTED');
    // eslint-disable-next-line no-control-regex
    const clean = text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
    if (clean.length < 1 || clean.length > 300) throw new SimFail('INVALID_COMMENT');
    const now = this.now();
    if (!isHost) {
      const times = (this.commentTimes.get(uid) ?? []).filter((t) => t > now - 10000);
      if (times.some((t) => t > now - this.config.commentMinIntervalMs)) throw new SimFail('RATE_LIMITED');
      if (times.length >= this.config.commentMaxPer10s) throw new SimFail('RATE_LIMITED');
      times.push(now);
      this.commentTimes.set(uid, times);
    }
    const author = this.users.get(uid)?.ref ?? { id: uid, handle: uid, display_name: uid, avatar_url: null };
    const id = `c-${this.factory.lastSeq + 1}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date(now).toISOString();
    this.comments = [...this.comments, { comment_id: id, author, text: clean, created_at: createdAt }].slice(-50);
    this.emit('COMMENT_CREATED', { comment_id: id, author, text: clean });
    return ok({ comment_id: id, created_at: createdAt });
  }

  private deleteComment(uid: string, commentId: string): Ok<Record<string, never>> {
    const c = this.comments.find((x) => x.comment_id === commentId);
    if (!c) throw new SimFail('COMMENT_NOT_FOUND');
    if (c.author.id !== uid && uid !== this.host.id) throw new SimFail('NOT_AUTHORIZED');
    this.comments = this.comments.filter((x) => x.comment_id !== commentId);
    this.emit('COMMENT_DELETED', { comment_id: commentId });
    return ok({});
  }

  private setCommentsEnabled(uid: string, liveId: string, enabled: boolean): Ok<{ comments_enabled: boolean }> {
    if (uid !== this.host.id) throw new SimFail('NOT_AUTHORIZED');
    this.requireLive(liveId);
    if (this.commentsEnabled === enabled) return ok({ comments_enabled: enabled });
    this.commentsEnabled = enabled;
    if (enabled) this.emit('SYSTEM_NOTICE', { code: 'comments_enabled', message: 'Comments are on.', severity: 'info' });
    else this.emit('MODERATION_NOTICE', { action: 'room_muted', target: null, message: 'Comments are turned off.' });
    return ok({ comments_enabled: enabled });
  }

  private mute(uid: string, liveId: string, target: string, minutes: number): Ok<{ muted_until: string }> {
    this.requireLive(liveId);
    if (uid !== this.host.id) throw new SimFail('NOT_AUTHORIZED');
    if (target === this.host.id || target === uid) throw new SimFail('INVALID_TARGET');
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new SimFail('INVALID_DURATION');
    const until = this.now() + minutes * 60000;
    this.mutes.set(target, until);
    this.emit('MODERATION_NOTICE', { action: 'muted', target: this.refOf(target), message: 'Muted in this LIVE.' });
    this.notify(target, { type: 'MUTED', live_id: this.liveId, muted_until: new Date(until).toISOString(), server_ts: this.iso() });
    return ok({ muted_until: new Date(until).toISOString() });
  }

  private unmute(uid: string, _liveId: string, target: string): Ok<Record<string, never>> {
    if (uid !== this.host.id) throw new SimFail('NOT_AUTHORIZED');
    this.mutes.delete(target);
    this.notify(target, { type: 'UNMUTED', live_id: this.liveId, server_ts: this.iso() });
    return ok({});
  }

  private kick(uid: string, liveId: string, target: string): Ok<Record<string, never>> {
    if (liveId !== this.liveId) throw new SimFail('LIVE_NOT_FOUND');
    if (uid !== this.host.id) throw new SimFail('NOT_AUTHORIZED');
    if (target === this.host.id || target === uid) throw new SimFail('INVALID_TARGET');
    this.bans.add(target);
    const g = this.guests.get(target);
    if (g?.status === 'accepted') {
      this.guests.set(target, { ...g, status: 'removed', slot: null });
      this.emit('GUEST_REMOVED', { guest: this.refOf(target) });
    } else if (g?.status === 'requested') {
      this.guests.set(target, { ...g, status: 'cancelled' });
    }
    this.emit('MODERATION_NOTICE', { action: 'removed', target: this.refOf(target), message: 'Removed from this LIVE.' });
    this.notify(target, { type: 'REMOVED_FROM_LIVE', live_id: this.liveId, server_ts: this.iso() });
    return ok({});
  }

  private follow(uid: string, target: string): Ok<{ following: boolean }> {
    if (target === uid) throw new SimFail('INVALID_TARGET');
    if (target !== this.host.id) return ok({ following: true });
    if (!this.follows.has(uid)) {
      this.follows.add(uid);
      if (this.status === 'live') {
        this.newFollowers += 1;
        this.emit('FOLLOW_RECEIVED', { follower: this.refOf(uid) });
        const crossed = this.config.followMilestones.filter((m) => m <= this.newFollowers && !this.followMilestonesHit.has(m));
        crossed.forEach((m) => this.followMilestonesHit.add(m));
        if (crossed.length) this.emit('FOLLOW_MILESTONE', { milestone: crossed[crossed.length - 1], count: this.newFollowers });
      }
    }
    return ok({ following: true });
  }

  private unfollow(uid: string, target: string): Ok<{ following: boolean }> {
    if (target === this.host.id) this.follows.delete(uid);
    return ok({ following: false });
  }

  private block(uid: string, target: string): Ok<{ blocked: boolean }> {
    if (target === uid) throw new SimFail('INVALID_TARGET');
    this.follows.delete(uid);
    if (target === this.host.id) {
      // Blocking the host: I leave their LIVE (as a guest too).
      const g = this.guests.get(uid);
      if (g?.status === 'accepted') {
        this.guests.set(uid, { ...g, status: 'left', slot: null });
        this.emit('GUEST_LEFT', { guest: this.refOf(uid), reason: 'left' });
      }
      this.bans.add(uid);
    } else if (uid === this.host.id) {
      this.bans.add(target);
      const g = this.guests.get(target);
      if (g?.status === 'accepted') {
        this.guests.set(target, { ...g, status: 'removed', slot: null });
        this.emit('GUEST_REMOVED', { guest: this.refOf(target) });
      }
    }
    return ok({ blocked: true });
  }

  private requestGuest(uid: string, liveId: string): Ok<{ status: GuestStatus }> {
    this.requireLive(liveId);
    if (uid === this.host.id) throw new SimFail('INVALID_TARGET');
    if (!this.canView(uid)) throw new SimFail('LIVE_ACCESS_DENIED');
    const g = this.guests.get(uid);
    const now = this.now();
    if (g) {
      if (g.status === 'requested') return ok({ status: 'requested' });
      if (g.status === 'accepted') throw new SimFail('ALREADY_GUEST');
      if (g.status === 'removed') throw new SimFail('GUEST_REMOVED_BY_HOST');
      if (g.status === 'declined' && (g.decidedAt ?? 0) > now - 60000) throw new SimFail('GUEST_REQUEST_COOLDOWN');
    }
    if ([...this.guests.values()].filter((x) => x.status === 'requested').length >= 50) throw new SimFail('GUEST_QUEUE_FULL');
    this.guests.set(uid, { status: 'requested', slot: null, requestedAt: now, decidedAt: null });
    this.notify(this.host.id, { type: 'GUEST_REQUESTED', live_id: this.liveId, request_id: uid, user: this.refOf(uid), server_ts: this.iso() });
    return ok({ status: 'requested' });
  }

  private cancelGuestRequest(uid: string, _liveId: string): Ok<Record<string, never>> {
    const g = this.guests.get(uid);
    if (g?.status === 'requested') {
      this.guests.set(uid, { ...g, status: 'cancelled', decidedAt: this.now() });
      this.notify(this.host.id, { type: 'GUEST_REQUEST_CANCELLED', live_id: this.liveId, request_id: uid, server_ts: this.iso() });
    }
    return ok({});
  }

  private respondGuest(uid: string, liveId: string, target: string, accept: boolean): Ok<{ status: GuestStatus; slot?: number }> {
    if (liveId !== this.liveId || uid !== this.host.id) throw new SimFail('NOT_AUTHORIZED');
    if (this.status !== 'live') throw new SimFail('LIVE_NOT_ACTIVE');
    const g = this.guests.get(target);
    if (!g || g.status !== 'requested') throw new SimFail('GUEST_REQUEST_NOT_FOUND');
    const now = this.now();
    if (!accept) {
      this.guests.set(target, { ...g, status: 'declined', decidedAt: now });
      this.notify(target, { type: 'GUEST_DECLINED', live_id: this.liveId, server_ts: this.iso() });
      return ok({ status: 'declined' });
    }
    if (!this.canView(target)) {
      this.guests.set(target, { ...g, status: 'cancelled', decidedAt: now });
      throw new SimFail('GUEST_UNAVAILABLE');
    }
    const used = new Set([...this.guests.values()].filter((x) => x.status === 'accepted').map((x) => x.slot));
    let slot: number | null = null;
    for (let n = 1; n <= this.config.guestSlots; n += 1) {
      if (!used.has(n)) {
        slot = n;
        break;
      }
    }
    if (slot === null) throw new SimFail('GUEST_SLOTS_FULL');
    this.guests.set(target, { ...g, status: 'accepted', slot, decidedAt: now });
    this.emit('GUEST_JOINED', { guest: this.refOf(target), slot });
    this.notify(target, { type: 'GUEST_ACCEPTED', live_id: this.liveId, slot, server_ts: this.iso() });
    return ok({ status: 'accepted', slot });
  }

  private removeGuest(uid: string, _liveId: string, target: string): Ok<Record<string, never>> {
    if (uid !== this.host.id) throw new SimFail('NOT_AUTHORIZED');
    const g = this.guests.get(target);
    if (!g || g.status !== 'accepted') throw new SimFail('GUEST_NOT_FOUND');
    this.guests.set(target, { ...g, status: 'removed', slot: null, decidedAt: this.now() });
    this.emit('GUEST_REMOVED', { guest: this.refOf(target) });
    this.notify(target, { type: 'GUEST_REMOVED', live_id: this.liveId, server_ts: this.iso() });
    return ok({});
  }

  private leaveGuest(uid: string, _liveId: string): Ok<Record<string, never>> {
    const g = this.guests.get(uid);
    if (g?.status === 'accepted') {
      this.guests.set(uid, { ...g, status: 'left', slot: null });
      this.emit('GUEST_LEFT', { guest: this.refOf(uid), reason: 'left' });
    }
    return ok({});
  }

  private listGuestRequests(uid: string, liveId: string): Ok<GuestRequestRow[]> {
    if (uid !== this.host.id || liveId !== this.liveId) throw new SimFail('NOT_AUTHORIZED');
    return ok(
      [...this.guests.entries()]
        .filter(([, g]) => g.status === 'requested')
        .sort((x, y) => x[1].requestedAt - y[1].requestedAt)
        .map(([id, g]) => ({ request_id: id, user: this.refOf(id), requested_at: new Date(g.requestedAt).toISOString() })),
    );
  }

  private battleRespond(uid: string, battleId: string, accept: boolean): Ok<Record<string, unknown>> {
    const b = this.battle;
    if (uid !== this.host.id) throw new SimFail('NOT_AUTHORIZED');
    if (!b || b.battle_id !== battleId || b.status !== 'invited') throw new SimFail('BATTLE_NOT_FOUND');
    if (this.inviteTimer) clearTimeout(this.inviteTimer);
    this.inviteTimer = null;
    if (!accept) {
      this.battle = null;
      this.battleMeta = null;
      this.emit('BATTLE_CANCELLED', { battle_id: battleId, reason: 'declined' });
      return ok({ status: 'cancelled' });
    }
    this.acceptBattle(b.format_id, b.side_b.host, 1500, b.battle_id);
    return ok({ status: 'accepted' });
  }

  private battleForfeit(uid: string, battleId: string): Ok<Record<string, unknown>> {
    const b = this.battle;
    if (uid !== this.host.id) throw new SimFail('NOT_AUTHORIZED');
    if (!b || b.battle_id !== battleId || (b.status !== 'live' && b.status !== 'accepted')) throw new SimFail('BATTLE_NOT_FOUND');
    this.finalizeBattle('b');
    return ok({ status: 'finalized' });
  }

  private endLive(uid: string, liveId: string): Ok<Record<string, unknown>> {
    if (uid !== this.host.id || liveId !== this.liveId) throw new SimFail('NOT_AUTHORIZED');
    this.endSession('host_ended');
    return ok({ status: 'ended' });
  }

  // ===========================================================================
  // Battles (server tick role)
  // ===========================================================================

  private acceptBattle(formatId: string, opponent: UserRef, leadMs: number, battleId?: string, fightElapsedMs?: number): void {
    const def = BUILTIN_FORMATS[formatId] ?? BUILTIN_FORMATS.classic_double;
    const introAt =
      fightElapsedMs === undefined
        ? this.now() + leadMs
        : this.now() - fightElapsedMs - def.intro_ms - def.countdown_s * 1000;
    const c = compileTimeline(def, introAt);
    const pulls = def.scoring === 'pulls' ? def.segments.filter((s) => s.kind === 'pull').map((s) => ({ pull_no: s.pull ?? 0, a: 0, b: 0 })) : [];
    this.battle = {
      battle_id: battleId ?? `battle-${this.factory.lastSeq + 1}`,
      format_id: formatId,
      status: 'accepted',
      side_a: { live_id: this.liveId, host: this.host },
      side_b: { live_id: `${this.liveId}-opponent`, host: opponent },
      scoring: def.scoring,
      invite_expires_at: null,
      intro_at: c.intro_at,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      final_countdown_ms: c.final_countdown_ms,
      timeline: c.timeline,
      score_a: 0,
      score_b: 0,
      pull_scores: pulls,
      lead_side: null,
      score_version: 0,
      result: null,
    };
    this.battleMeta = {
      finalizedAt: null,
      lastSegIdx: null,
      warned: new Set(),
      finalCountdownSent: false,
      lastLeadSide: null,
      lastLeadAt: 0,
      leadChanges: 0,
      comebacks: 0,
      totalGifts: 0,
      biggest: null,
      supporters: new Map(),
      maxDeficit: { a: 0, b: 0 },
    };
    this.ensureUser(opponent, 0);
    this.emit('BATTLE_ACCEPTED', { battle: this.battle });
    this.startBattleTimer();
  }

  private startBattleTimer(): void {
    this.stopBattleTimer();
    this.battleTimer = setInterval(() => this.battleTick(), 200);
  }

  private stopBattleTimer(): void {
    if (this.battleTimer) clearInterval(this.battleTimer);
    this.battleTimer = null;
  }

  private battleTick(): void {
    const b = this.battle;
    const m = this.battleMeta;
    if (!b || !m || this.disposed) return this.stopBattleTimer();
    const now = this.now();
    const ends = Date.parse(b.ends_at ?? '');

    if (b.status === 'finalized') {
      if (m.finalizedAt !== null && now - m.finalizedAt > 60000) {
        this.battle = null;
        this.battleMeta = null;
        this.stopBattleTimer();
      }
      return;
    }

    if (now < ends) {
      const seg = segmentAt(b.timeline, now);
      if (seg && seg.idx !== m.lastSegIdx) {
        const prev = m.lastSegIdx !== null ? b.timeline[m.lastSegIdx] : null;
        m.lastSegIdx = seg.idx;
        if (prev && prev.kind === 'bonus') this.emit('DOUBLE_ENDED', { battle_id: b.battle_id, segment_idx: prev.idx });
        if (seg.kind !== 'intro' && seg.kind !== 'countdown') {
          if (b.status === 'accepted') this.battle = { ...b, status: 'live' };
          this.emit('BATTLE_PHASE_CHANGED', { battle_id: b.battle_id, segment_idx: seg.idx, kind: seg.kind, multiplier: seg.multiplier, pull_no: seg.pull_no });
          if (seg.multiplier > 1) {
            this.emit('DOUBLE_STARTED', { battle_id: b.battle_id, segment_idx: seg.idx, ends_at: seg.ends_at, multiplier: seg.multiplier });
          }
        }
      }
      for (const s of b.timeline) {
        if (s.multiplier > 1 && s.warning_ms > 0 && !m.warned.has(s.idx)) {
          const st = Date.parse(s.starts_at);
          if (now >= st - s.warning_ms && now < st) {
            m.warned.add(s.idx);
            this.emit('DOUBLE_WARNING', { battle_id: b.battle_id, segment_idx: s.idx, starts_at: s.starts_at, multiplier: s.multiplier });
          }
        }
      }
      if (!m.finalCountdownSent && now >= ends - b.final_countdown_ms) {
        m.finalCountdownSent = true;
        this.emit('FINAL_COUNTDOWN_STARTED', { battle_id: b.battle_id, ends_at: b.ends_at ?? '' });
      }
      return;
    }

    if (b.status !== 'locked') {
      this.battle = { ...this.battle!, status: 'locked' };
      this.emit('BATTLE_ENDED', { battle_id: b.battle_id, score_a: b.score_a, score_b: b.score_b });
      return;
    }
    // Server finalizes shortly after lock (tick cron).
    if (now >= ends + 1500) this.finalizeBattle(null);
  }

  private finalizeBattle(forfeitWinner: Side | null): void {
    const b = this.battle;
    const m = this.battleMeta;
    if (!b || !m || b.status === 'finalized') return;
    let winner: Side | null;
    let pullWins: BattleResult['pull_wins'] = null;
    if (forfeitWinner) winner = forfeitWinner;
    else if (b.scoring === 'pulls') {
      const w = { a: 0, b: 0 };
      for (const p of b.pull_scores) {
        if (p.a > p.b) w.a += 1;
        else if (p.b > p.a) w.b += 1;
      }
      pullWins = w;
      winner = w.a > w.b ? 'a' : w.b > w.a ? 'b' : b.score_a > b.score_b ? 'a' : b.score_b > b.score_a ? 'b' : null;
    } else winner = b.score_a > b.score_b ? 'a' : b.score_b > b.score_a ? 'b' : null;

    const result: BattleResult = {
      winner_side: winner,
      final_a: b.score_a,
      final_b: b.score_b,
      pull_wins: pullWins,
      stats: {
        total_gifts: m.totalGifts,
        biggest_gift: m.biggest,
        top_supporters: [...m.supporters.values()].sort((x, y) => y.points - x.points).slice(0, 3),
        lead_changes: m.leadChanges,
        comebacks: m.comebacks,
        peak_viewers: this.peakViewers,
      },
    };
    if (b.status !== 'locked') this.emit('BATTLE_ENDED', { battle_id: b.battle_id, score_a: b.score_a, score_b: b.score_b });
    this.battle = { ...b, status: 'finalized', result };
    m.finalizedAt = this.now();
    this.emit('BATTLE_RESULT', { battle_id: b.battle_id, result });
  }

  private endSession(reason: LiveEventPayloads['LIVE_ENDED']['reason']): void {
    if (this.status === 'ended') return;
    this.status = 'ended';
    this.stopBattleTimer();
    if (this.battle && this.battle.status !== 'finalized') {
      this.emit('BATTLE_CANCELLED', { battle_id: this.battle.battle_id, reason: 'host_left' });
      this.battle = null;
    }
    for (const [id, g] of this.guests) if (g.status === 'accepted' || g.status === 'requested') this.guests.set(id, { ...g, status: 'left', slot: null });
    this.emit('LIVE_ENDED', { reason });
  }

  // ===========================================================================
  // Lab controls: things other people / the server cron do
  // ===========================================================================

  readonly dev = {
    setViewers: (count: number, sample: UserRef[] = []): void => {
      const prev = this.viewerCount;
      this.viewerCount = Math.max(0, Math.floor(count));
      this.peakViewers = Math.max(this.peakViewers, this.viewerCount);
      if (this.viewerCount > prev) this.emit('VIEWERS_JOINED', { count: this.viewerCount - prev, sample: sample.slice(0, 3) });
      this.emit('VIEWER_COUNT', { count: this.viewerCount, peak: this.peakViewers });
      const crossed = this.config.viewerMilestones.filter((m) => m <= this.viewerCount && !this.viewerMilestonesHit.has(m));
      crossed.forEach((m) => this.viewerMilestonesHit.add(m));
      if (crossed.length) this.emit('VIEWER_MILESTONE', { milestone: crossed[crossed.length - 1], count: this.viewerCount });
      this.notifyInspector();
    },
    grantTestCredits: (userId: string, amount: number): void => {
      const u = this.users.get(userId);
      if (u) u.testCoins += Math.max(0, Math.floor(amount));
      this.notifyInspector();
    },
    inviteBattle: (from: UserRef, formatId = 'classic_double', ttlMs = 30000): void => {
      if (this.battle && this.battle.status !== 'finalized') return;
      const def = BUILTIN_FORMATS[formatId] ?? BUILTIN_FORMATS.classic_double;
      this.ensureUser(from, 0);
      const battle: BattleSnapshot = {
        battle_id: `battle-${this.factory.lastSeq + 1}`,
        format_id: formatId,
        status: 'invited',
        side_a: { live_id: this.liveId, host: this.host },
        side_b: { live_id: `${this.liveId}-opponent`, host: from },
        scoring: def.scoring,
        invite_expires_at: new Date(this.now() + ttlMs).toISOString(),
        intro_at: null,
        starts_at: null,
        ends_at: null,
        final_countdown_ms: def.final_countdown_s * 1000,
        timeline: [],
        score_a: 0,
        score_b: 0,
        pull_scores: [],
        lead_side: null,
        score_version: 0,
        result: null,
      };
      this.battle = battle;
      this.battleMeta = null;
      this.emit('BATTLE_INVITED', { battle, from });
      this.notify(this.host.id, { type: 'BATTLE_INVITED', battle, from, server_ts: this.iso() });
      if (this.inviteTimer) clearTimeout(this.inviteTimer);
      this.inviteTimer = setTimeout(() => {
        if (this.battle?.battle_id === battle.battle_id && this.battle.status === 'invited') {
          this.battle = null;
          this.emit('BATTLE_CANCELLED', { battle_id: battle.battle_id, reason: 'expired' });
          this.notifyInspector();
        }
      }, ttlMs);
      this.notifyInspector();
    },
    /**
     * Both hosts already accepted. `fightElapsedMs` places "now" relative to the fight start
     * (negative = still in intro/countdown); omitted = normal accept with intro (Lab only).
     */
    startBattle: (opponent: UserRef, formatId = 'classic_double', fightElapsedMs?: number): void => {
      this.acceptBattle(formatId, opponent, 1500, undefined, fightElapsedMs);
      if (fightElapsedMs !== undefined) this.battleTick();
      this.notifyInspector();
    },
    /** A gift sent in the OPPONENT's room — scored for side B by the same server rules. */
    opponentGift: (sender: UserRef, giftId: string, quantity = 1): string | null => {
      const b = this.battle;
      const g = this.catalog.gifts.find((x) => x.id === giftId);
      if (!b || !g) return 'NO_BATTLE';
      const now = this.now();
      const seg = segmentAt(b.timeline, now);
      if (b.status === 'locked' || b.status === 'finalized' || !seg || seg.multiplier === 0 || now < Date.parse(b.starts_at ?? '')) return 'NOT_SCORING';
      const cost = g.coin_cost * quantity;
      const points = Math.max(1, Math.floor(cost * seg.multiplier));
      this.ensureUser(sender, 0);
      this.applyContribution('b', points, sender, toGiftRef(g), cost, seg.pull_no, now);
      this.notifyInspector();
      return null;
    },
    endLive: (reason: LiveEventPayloads['LIVE_ENDED']['reason'] = 'host_ended'): void => {
      this.endSession(reason);
      this.notifyInspector();
    },
    systemNotice: (message: string, severity: 'info' | 'warning' = 'info'): void => {
      this.emit('SYSTEM_NOTICE', { code: 'lab', message, severity });
    },
    /** Realtime link state for every connected client. Restoring re-syncs from a snapshot. */
    setLink: (link: ConnectionState['link']): void => {
      const was = this.link;
      this.link = link;
      for (const s of this.subs) s.h.onConnection(this.connectionState());
      if (link === 'connected' && was !== 'connected') for (const s of this.subs) this.later(() => this.deliverInitial(s));
      this.notifyInspector();
    },
    /** Injected MEDIA quality for QA. Always reported with source 'simulated'. */
    setQuality: (q: MediaQuality): void => {
      this.quality = q;
      for (const s of this.subs) s.h.onConnection(this.connectionState());
      this.notifyInspector();
    },
    /** Makes the next call of `command` (or '*') fail with `code` (rate limit, server error…). */
    failNext: (command: string, code: string): void => {
      this.failNext.set(command, code);
    },
  };

  // ===========================================================================
  // Internals
  // ===========================================================================

  private snapshotFor(uid: string): LiveSnapshot {
    const supporters = [...this.supporters.entries()]
      .sort((x, y) => y[1].total - x[1].total)
      .slice(0, 3)
      .map(([id, s]) => ({ user: this.refOf(id), total: s.total }));
    const guests = [...this.guests.entries()]
      .filter(([, g]) => g.status === 'accepted' && g.slot !== null)
      .map(([id, g]) => ({ ...this.refOf(id), slot: g.slot as number }))
      .sort((a, b) => a.slot - b.slot);
    const g = this.guests.get(uid);
    const muted = this.mutes.get(uid);
    return {
      live_id: this.liveId,
      last_seq: this.factory.lastSeq,
      server_now: this.iso(),
      status: this.status,
      title: this.title,
      visibility: 'public',
      started_at: new Date(this.startedAt).toISOString(),
      host: this.host,
      viewer_count: this.viewerCount,
      peak_viewers: this.peakViewers,
      top_supporters: supporters,
      battle: this.battle,
      config_version: 1,
      comments_enabled: this.commentsEnabled,
      guests,
      recent_comments: this.comments.slice(-50),
      me: {
        user_id: uid,
        is_host: uid === this.host.id,
        guest_status: g?.status ?? null,
        muted_until: muted && muted > this.now() ? new Date(muted).toISOString() : null,
        following_host: this.follows.has(uid),
      },
    };
  }

  private walletFor(uid: string): WalletInfo {
    const u = this.users.get(uid);
    return {
      coins: 0,
      test_coins: u?.testCoins ?? 0,
      earnings: u?.earnings ?? 0,
      active_currency: 'test_coins',
      spendable: u?.testCoins ?? 0,
      test_credits: true,
      purchases_enabled: false,
      environment: 'lab',
    };
  }

  private connectionState(): ConnectionState {
    return {
      link: this.link,
      quality: this.link === 'connected' ? this.quality : 'unknown',
      source: this.quality === 'unknown' ? 'none' : 'simulated',
      rttMs: null,
      packetLossPct: null,
    };
  }

  private deliverInitial(s: FeedSub): void {
    if (!this.subs.has(s) || this.link !== 'connected') return;
    if (s.liveId !== this.liveId) {
      s.h.onUnavailable('LIVE_NOT_FOUND', 'This LIVE does not exist.');
      return;
    }
    if (!this.canView(s.userId) && s.userId !== this.host.id) {
      s.h.onUnavailable('LIVE_ACCESS_DENIED', 'You do not have access to this LIVE.');
      return;
    }
    s.h.onConnection(this.connectionState());
    s.h.onSnapshot(this.snapshotFor(s.userId));
  }

  private emit<T extends LiveEventType>(type: T, payload: LiveEventPayloads[T]): void {
    const e: AnyLiveEvent = this.factory.make(type, payload, this.now());
    if (this.link !== 'connected') return; // missed while offline; recovered by snapshot on reconnect
    for (const s of this.subs) {
      if (s.liveId !== this.liveId) continue;
      if (this.bans.has(s.userId) && s.userId !== this.host.id && type !== 'MODERATION_NOTICE') continue;
      s.h.onEvent(e, { replayed: false });
    }
    this.notifyInspector();
  }

  private notify(userId: string, n: PersonalNotice): void {
    if (this.link !== 'connected') return;
    for (const s of this.subs) if (s.userId === userId) s.h.onPersonal(n);
  }

  private refOf(id: string): UserRef {
    return this.users.get(id)?.ref ?? { id, handle: id, display_name: id, avatar_url: null };
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }

  private later(fn: () => void): void {
    setTimeout(() => {
      if (!this.disposed) fn();
    }, this.config.latencyMs);
  }

  private notifyInspector(): void {
    for (const fn of this.listeners) fn();
  }
}

class SimFail extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function toGiftRef(g: CatalogGift): GiftRef {
  return { id: g.id, name: g.name, rarity: g.rarity, coin_cost: g.coin_cost, icon_url: g.icon_url, animation_url: g.animation_url };
}
