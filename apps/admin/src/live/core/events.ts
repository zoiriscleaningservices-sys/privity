/**
 * Privity LIVE — realtime event contract (schema v1).
 *
 * Every authoritative LIVE fact is produced by the server (Postgres RPCs / triggers / cron)
 * and delivered on the private channel `live:{live_id}` wrapped in a LiveEventEnvelope.
 * Clients NEVER author these events. The client only parses, orders and presents them.
 */

export const LIVE_EVENT_SCHEMA_VERSION = 1 as const;

export type Side = 'a' | 'b';
export type GiftRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type GiftBattleOutcome = 'no_battle' | 'counted' | 'excluded';
export type LiveVisibility = 'public' | 'followers' | 'private';
export type GuestStatus = 'requested' | 'accepted' | 'left' | 'removed' | 'declined' | 'cancelled';

export interface UserRef {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
}

export interface GiftRef {
  id: string;
  name: string;
  rarity: GiftRarity;
  coin_cost: number;
  icon_url: string;
  animation_url: string | null;
}

// ---------------------------------------------------------------------------
// Battle data (server-computed)
// ---------------------------------------------------------------------------

/**
 * Non-overlapping, absolute timeline segment. Compiled once on the server when a battle is
 * accepted. `multiplier` is the authoritative scoring multiplier for contributions whose
 * server timestamp falls in [starts_at, ends_at). 0 means contributions do not score.
 */
export interface TimelineSegment {
  idx: number;
  kind: 'intro' | 'countdown' | 'normal' | 'bonus' | 'pull' | 'break';
  starts_at: string;
  ends_at: string;
  multiplier: number;
  pull_no: number | null;
  /** How long before this segment starts the audience is warned (bonus segments). */
  warning_ms: number;
  label_key: string | null;
}

export type BattleStatus =
  | 'invited'
  | 'accepted'
  | 'live'
  | 'locked'
  | 'finalized'
  | 'cancelled'
  | 'expired';

export interface BattleSideInfo {
  live_id: string;
  host: UserRef;
}

export interface PullScore {
  pull_no: number;
  a: number;
  b: number;
}

export interface BattleSupporter {
  side: Side;
  user: UserRef;
  points: number;
}

export interface BattleResultStats {
  total_gifts: number;
  biggest_gift: { sender: UserRef; gift: GiftRef; coin_value: number; side: Side } | null;
  top_supporters: BattleSupporter[];
  lead_changes: number;
  comebacks: number;
  peak_viewers: number | null;
}

export interface BattleResult {
  /** null = draw */
  winner_side: Side | null;
  final_a: number;
  final_b: number;
  pull_wins: { a: number; b: number } | null;
  stats: BattleResultStats;
}

export interface BattleSnapshot {
  battle_id: string;
  format_id: string;
  status: BattleStatus;
  side_a: BattleSideInfo;
  side_b: BattleSideInfo;
  scoring: 'total' | 'pulls';
  invite_expires_at: string | null;
  intro_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  final_countdown_ms: number;
  timeline: TimelineSegment[];
  score_a: number;
  score_b: number;
  pull_scores: PullScore[];
  lead_side: Side | null;
  /** Monotonic per battle. Clients ignore score updates with a lower version. */
  score_version: number;
  result: BattleResult | null;
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

export interface LiveEventPayloads {
  LIVE_STARTED: { title: string; host: UserRef };
  LIVE_ENDED: { reason: 'host_ended' | 'moderation' | 'stale' | 'admin' };
  VIEWERS_JOINED: { count: number; sample: UserRef[] };
  VIEWER_COUNT: { count: number; peak: number };
  VIEWER_MILESTONE: { milestone: number; count: number };
  FOLLOW_RECEIVED: { follower: UserRef };
  FOLLOW_MILESTONE: { milestone: number; count: number };
  COMMENT_CREATED: { comment_id: string; author: UserRef; text: string };
  COMMENT_DELETED: { comment_id: string };
  GIFT_RECEIVED: {
    tx_id: string;
    sender: UserRef;
    recipient_id: string;
    gift: GiftRef;
    quantity: number;
    coin_value: number;
    /** Set ONLY when the gift counted toward a battle (battle_outcome === 'counted'). */
    battle_id: string | null;
    battle_side: Side | null;
    battle_points: number;
    multiplier: number;
    sender_live_total: number;
    /**
     * D6: 'excluded' means the sender explicitly chose to send the gift outside a battle
     * (e.g. after the battle was locked). The UI must never present it as a battle contribution.
     */
    battle_outcome: GiftBattleOutcome;
  };
  GIFT_STREAK: { sender: UserRef; gift: GiftRef; streak: number };
  SUPPORTER_MILESTONE: { supporter: UserRef; threshold: number; total: number };
  TOP_SUPPORTER_CHANGED: {
    supporter: UserRef;
    total: number;
    previous: UserRef | null;
    previous_total: number | null;
  };
  BATTLE_INVITED: { battle: BattleSnapshot; from: UserRef };
  BATTLE_ACCEPTED: { battle: BattleSnapshot };
  BATTLE_CANCELLED: { battle_id: string; reason: 'declined' | 'expired' | 'cancelled' | 'host_left' };
  BATTLE_PHASE_CHANGED: {
    battle_id: string;
    segment_idx: number;
    kind: TimelineSegment['kind'];
    multiplier: number;
    pull_no: number | null;
  };
  DOUBLE_WARNING: { battle_id: string; segment_idx: number; starts_at: string; multiplier: number };
  DOUBLE_STARTED: { battle_id: string; segment_idx: number; ends_at: string; multiplier: number };
  DOUBLE_ENDED: { battle_id: string; segment_idx: number };
  BATTLE_SCORE: {
    battle_id: string;
    score_a: number;
    score_b: number;
    pull_scores: PullScore[];
    lead_side: Side | null;
    score_version: number;
    last_contribution: { side: Side; points: number; sender: UserRef } | null;
  };
  BATTLE_LEAD_CHANGED: {
    battle_id: string;
    lead_side: Side;
    score_a: number;
    score_b: number;
    is_final_moment: boolean;
  };
  BATTLE_COMEBACK: { battle_id: string; side: Side; deficit_before: number; deficit_after: number };
  BATTLE_SWING: { battle_id: string; side: Side; points: number; sender: UserRef; gift: GiftRef };
  FINAL_COUNTDOWN_STARTED: { battle_id: string; ends_at: string };
  BATTLE_ENDED: { battle_id: string; score_a: number; score_b: number };
  BATTLE_RESULT: { battle_id: string; result: BattleResult };
  GUEST_REQUESTED: { request_id: string; user: UserRef };
  GUEST_JOINED: { guest: UserRef; slot: number };
  GUEST_LEFT: { guest: UserRef; reason: 'left' | 'disconnected' };
  GUEST_REMOVED: { guest: UserRef };
  SYSTEM_NOTICE: { code: string; message: string; severity: 'info' | 'warning' };
  MODERATION_NOTICE: {
    action: 'muted' | 'removed' | 'blocked' | 'comment_deleted' | 'room_muted';
    target: UserRef | null;
    message: string;
  };
  CONFIG_UPDATED: { version: number };
}

export type LiveEventType = keyof LiveEventPayloads;

export const LIVE_EVENT_TYPES: ReadonlyArray<LiveEventType> = [
  'LIVE_STARTED', 'LIVE_ENDED', 'VIEWERS_JOINED', 'VIEWER_COUNT', 'VIEWER_MILESTONE',
  'FOLLOW_RECEIVED', 'FOLLOW_MILESTONE', 'COMMENT_CREATED', 'COMMENT_DELETED', 'GIFT_RECEIVED', 'GIFT_STREAK',
  'SUPPORTER_MILESTONE', 'TOP_SUPPORTER_CHANGED', 'BATTLE_INVITED', 'BATTLE_ACCEPTED',
  'BATTLE_CANCELLED', 'BATTLE_PHASE_CHANGED', 'DOUBLE_WARNING', 'DOUBLE_STARTED', 'DOUBLE_ENDED',
  'BATTLE_SCORE', 'BATTLE_LEAD_CHANGED', 'BATTLE_COMEBACK', 'BATTLE_SWING',
  'FINAL_COUNTDOWN_STARTED', 'BATTLE_ENDED', 'BATTLE_RESULT', 'GUEST_REQUESTED', 'GUEST_JOINED',
  'GUEST_LEFT', 'GUEST_REMOVED', 'SYSTEM_NOTICE', 'MODERATION_NOTICE', 'CONFIG_UPDATED',
];

const KNOWN_TYPES = new Set<string>(LIVE_EVENT_TYPES);

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface LiveEventEnvelope<T extends LiveEventType = LiveEventType> {
  event_id: string;
  live_id: string;
  battle_id: string | null;
  event_type: T;
  actor_id: string | null;
  server_ts: string;
  seq: number;
  schema_version: typeof LIVE_EVENT_SCHEMA_VERSION;
  payload: LiveEventPayloads[T];
}

/** Discriminated union over all known event types — enables exhaustive `switch`. */
export type AnyLiveEvent = { [K in LiveEventType]: LiveEventEnvelope<K> }[LiveEventType];

/**
 * An envelope whose sequencing fields are valid but whose type this client does not know
 * (e.g. a newer server). It must still advance the sequence so it never causes a false gap.
 */
export interface UnknownLiveEvent {
  event_id: string;
  live_id: string;
  seq: number;
  server_ts: string;
  event_type: string;
  unknown: true;
}

export type ParsedLiveEvent =
  | { ok: true; event: AnyLiveEvent }
  | { ok: true; event: UnknownLiveEvent }
  | { ok: false; reason: string };

export function isUnknownEvent(e: AnyLiveEvent | UnknownLiveEvent): e is UnknownLiveEvent {
  return (e as UnknownLiveEvent).unknown === true;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validates the envelope shape. Payload contents are trusted only because the channel is
 * private and write-protected (server-originated); the envelope check protects ordering logic.
 */
export function parseLiveEvent(raw: unknown): ParsedLiveEvent {
  if (!isRecord(raw)) return { ok: false, reason: 'not_an_object' };
  const { event_id, live_id, event_type, server_ts, seq, schema_version, payload } = raw;
  if (typeof event_id !== 'string' || event_id.length === 0) return { ok: false, reason: 'event_id' };
  if (typeof live_id !== 'string' || live_id.length === 0) return { ok: false, reason: 'live_id' };
  if (typeof event_type !== 'string') return { ok: false, reason: 'event_type' };
  if (typeof server_ts !== 'string' || Number.isNaN(Date.parse(server_ts))) {
    return { ok: false, reason: 'server_ts' };
  }
  if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 1) return { ok: false, reason: 'seq' };
  if (schema_version !== LIVE_EVENT_SCHEMA_VERSION) {
    // Unknown schema: keep sequencing intact but do not interpret.
    return { ok: true, event: { event_id, live_id, seq, server_ts, event_type, unknown: true } };
  }
  if (!KNOWN_TYPES.has(event_type)) {
    return { ok: true, event: { event_id, live_id, seq, server_ts, event_type, unknown: true } };
  }
  if (!isRecord(payload)) return { ok: false, reason: 'payload' };
  return { ok: true, event: raw as unknown as AnyLiveEvent };
}

// ---------------------------------------------------------------------------
// Snapshot (get_live_snapshot RPC)
// ---------------------------------------------------------------------------

export interface SupporterEntry {
  user: UserRef;
  total: number;
}

/** An accepted on-stage guest (UserRef plus the stage slot assigned by the server). */
export interface LiveGuest extends UserRef {
  slot: number;
}

export interface SnapshotComment {
  comment_id: string;
  author: UserRef;
  text: string;
  created_at: string;
}

/** The requesting user's own relationship to the LIVE (never other users' data). */
export interface SnapshotMe {
  user_id: string;
  is_host: boolean;
  guest_status: GuestStatus | null;
  muted_until: string | null;
  following_host: boolean;
}

export interface LiveSnapshot {
  live_id: string;
  last_seq: number;
  server_now: string;
  status: 'live' | 'ended';
  title: string;
  visibility: LiveVisibility;
  started_at: string;
  host: UserRef;
  viewer_count: number;
  peak_viewers: number;
  top_supporters: SupporterEntry[];
  battle: BattleSnapshot | null;
  config_version: number;
  comments_enabled: boolean;
  guests: LiveGuest[];
  /** Oldest → newest, at most 50, deleted comments excluded. */
  recent_comments: SnapshotComment[];
  me: SnapshotMe;
}

export function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const v = Date.parse(iso);
  return Number.isNaN(v) ? null : v;
}
