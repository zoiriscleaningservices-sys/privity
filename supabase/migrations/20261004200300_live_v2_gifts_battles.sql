-- =============================================================================
-- Privity LIVE v2 — gifts, battles, moment detectors
--
-- GLOBAL LOCK ORDER (deadlock freedom):
--   wallets (by user_id) → sessions (by id) → battles
-- Every path that touches more than one of these acquires them in this order.
-- Rollback: supabase/rollback/20261004200100_live_v2_down.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Feature flag that may also be enabled for an explicit allow-list of testers:
-- rules = {"allow_users": ["<uuid>", ...]}
create function live.flag_for(p_key text, p_uid uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((
    select f.enabled or (p_uid is not null and coalesce(f.rules -> 'allow_users', '[]'::jsonb) ? p_uid::text)
    from live.feature_flags f where f.key = p_key), false)
$$;

-- Locks session rows in id order. ORDER BY below LockRows ⇒ rows are locked in sorted order.
-- NO KEY UPDATE: serializes every writer of the row (incl. live.emit's seq increment) but does
-- not block FK inserts (viewers/comments/supporters take KEY SHARE).
create function live.lock_sessions(p_ids uuid[]) returns void
language plpgsql set search_path = '' as $$
begin
  perform 1 from live.sessions s where s.id = any(p_ids) order by s.id for no key update;
end $$;

-- Segment containing p_ts, using [starts_at, ends_at) — identical to TS segmentAt().
create function live.segment_at(p_battle_id uuid, p_ts timestamptz) returns live.battle_timeline
language sql stable set search_path = '' as $$
  select t.* from live.battle_timeline t
  where t.battle_id = p_battle_id and t.starts_at <= p_ts and p_ts < t.ends_at
  order by t.idx limit 1
$$;

create function live.gift_ref(p_gift_id text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', g.id, 'name', g.name, 'rarity', g.rarity_tier, 'coin_cost', g.coin_cost,
                            'icon_url', g.icon_url, 'animation_url', g.animation_url)
  from live.gifts g where g.id = p_gift_id
$$;

create function live.active_battle_id(p_live_id uuid) returns uuid
language sql stable set search_path = '' as $$
  select b.id from live.sessions s join live.battles b on b.id = s.battle_id
  where s.id = p_live_id and b.status in ('accepted', 'live', 'locked')
$$;

-- Emits the same fact on both battle streams (in session-id order; the caller holds both locks).
create function live.emit_battle(p_battle live.battles, p_type text, p_payload jsonb, p_actor uuid default null)
returns void
language plpgsql set search_path = '' as $$
begin
  if p_battle.live_a < p_battle.live_b then
    perform live.emit(p_battle.live_a, p_type, p_payload, p_battle.id, p_actor);
    perform live.emit(p_battle.live_b, p_type, p_payload, p_battle.id, p_actor);
  else
    perform live.emit(p_battle.live_b, p_type, p_payload, p_battle.id, p_actor);
    perform live.emit(p_battle.live_a, p_type, p_payload, p_battle.id, p_actor);
  end if;
end $$;

create function live.gift_reject_message(p_code text) returns text
language sql immutable set search_path = '' as $$
  select case p_code
    when 'BATTLE_LOCKED' then 'Battle ended — this gift will not affect the battle score.'
    when 'BATTLE_NOT_STARTED' then 'The battle has not started yet — this gift would not affect the battle score.'
    when 'BATTLE_BREAK' then 'The battle is between rounds — this gift would not affect the battle score.'
    when 'BATTLE_CHANGED' then 'The battle changed. Please review and send again.'
    when 'BATTLE_SCORING_ACTIVE' then 'The battle is live — gifts count toward the battle score.'
    when 'INSUFFICIENT_FUNDS' then 'Not enough coins.'
    else p_code end
$$;

create function live.gift_result(p_tx live.gift_transactions, p_replayed boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'ok', true,
    'replayed', p_replayed,
    'tx_id', p_tx.id,
    'live_id', p_tx.live_id,
    'gift_id', p_tx.gift_id,
    'quantity', p_tx.quantity,
    'coin_value', p_tx.coin_value,
    'currency', p_tx.currency,
    'battle_id', p_tx.battle_id,
    'battle_side', p_tx.battle_side,
    'battle_points', p_tx.battle_points,
    'multiplier', p_tx.multiplier,
    'battle_outcome', p_tx.battle_outcome,
    'message', case when p_tx.battle_outcome = 'excluded'
                    then 'Sent as a LIVE gift — it did not affect the battle score.' end,
    'balance', (select case when p_tx.currency = 'test_coins' then w.test_coins else w.coins end
                from live.wallets w where w.user_id = p_tx.sender_id),
    'created_at', live.iso(p_tx.created_at))
$$;

-- -----------------------------------------------------------------------------
-- Battle detectors (run inside the gift transaction, battle row already locked)
-- -----------------------------------------------------------------------------
create function live.battle_on_contribution(p_battle_id uuid, p_side text, p_points bigint, p_sender uuid,
                                            p_gift jsonb, p_now timestamptz)
returns void
language plpgsql set search_path = '' as $$
declare
  b live.battles;
  v_total bigint;
  v_diff bigint;
  v_leader text;
  v_is_final boolean;
  v_lead_changed boolean := false;
  v_lead_emit boolean := false;
  v_def_a bigint;
  v_def_b bigint;
  v_cb_side text;
  v_cb_before bigint;
  v_cb_after bigint;
  v_swing boolean;
  v_sender jsonb := live.user_ref(p_sender);
  c_hpts numeric := live.cfg_num('{detectors,lead,hysteresis_points}', 50, 0, 1e12);
  c_hpct numeric := live.cfg_num('{detectors,lead,hysteresis_pct}', 0.02, 0, 1);
  c_lcool numeric := live.cfg_num('{detectors,lead,cooldown_s}', 6, 0, 3600);
  c_final numeric := live.cfg_num('{detectors,lead,final_moment_s}', 10, 0, 600);
  c_cb_pct numeric := live.cfg_num('{detectors,comeback,min_deficit_pct}', 0.3, 0, 10);
  c_cb_pts numeric := live.cfg_num('{detectors,comeback,min_deficit_points}', 500, 1, 1e12);
  c_cb_close numeric := live.cfg_num('{detectors,comeback,close_pct}', 0.6, 0.05, 1);
  c_sw_pct numeric := live.cfg_num('{detectors,swing,pct_of_total}', 0.15, 0.01, 1);
  c_sw_min numeric := live.cfg_num('{detectors,swing,min_points}', 2000, 1, 1e12);
begin
  select * into b from live.battles where id = p_battle_id;
  v_total := b.score_a + b.score_b;
  v_diff := abs(b.score_a - b.score_b);
  v_leader := case when b.score_a > b.score_b then 'a' when b.score_b > b.score_a then 'b' end;
  v_is_final := b.ends_at - p_now <= make_interval(secs => c_final);

  -- Lead (hysteresis; cooldown suppresses the announcement, never the state)
  if v_leader is not null and v_leader is distinct from b.lead_side
     and v_diff >= greatest(c_hpts, c_hpct * v_total) then
    v_lead_changed := b.lead_side is not null;   -- the very first lead is a state change, not a "lead change"
    v_lead_emit := (v_lead_changed or v_is_final)
      and (v_is_final or b.lead_event_at is null or b.lead_event_at <= p_now - make_interval(secs => c_lcool));
    b.lead_side := v_leader;
    if v_lead_changed then b.lead_changes := b.lead_changes + 1; end if;
    if v_lead_emit then b.lead_event_at := p_now; end if;
  end if;

  -- Comeback: record qualifying deficits, then fire once per episode for the contributing side
  v_def_a := greatest(b.score_b - b.score_a, 0);
  v_def_b := greatest(b.score_a - b.score_b, 0);
  if v_def_a >= c_cb_pts and v_def_a >= c_cb_pct * b.score_b then b.max_deficit_a := greatest(b.max_deficit_a, v_def_a); end if;
  if v_def_b >= c_cb_pts and v_def_b >= c_cb_pct * b.score_a then b.max_deficit_b := greatest(b.max_deficit_b, v_def_b); end if;
  if p_side = 'a' and b.max_deficit_a > 0 and v_def_a <= b.max_deficit_a * (1 - c_cb_close) then
    v_cb_side := 'a'; v_cb_before := b.max_deficit_a; v_cb_after := v_def_a; b.max_deficit_a := 0;
  elsif p_side = 'b' and b.max_deficit_b > 0 and v_def_b <= b.max_deficit_b * (1 - c_cb_close) then
    v_cb_side := 'b'; v_cb_before := b.max_deficit_b; v_cb_after := v_def_b; b.max_deficit_b := 0;
  end if;
  if v_cb_side is not null then b.comebacks := b.comebacks + 1; end if;

  -- Swing
  v_swing := p_points >= c_sw_min or (v_total >= c_sw_min and p_points >= c_sw_pct * v_total);

  update live.battles set
    lead_side = b.lead_side, lead_changes = b.lead_changes, lead_event_at = b.lead_event_at,
    max_deficit_a = b.max_deficit_a, max_deficit_b = b.max_deficit_b, comebacks = b.comebacks
  where id = b.id;

  perform live.emit_battle(b, 'BATTLE_SCORE', jsonb_build_object(
    'battle_id', b.id, 'score_a', b.score_a, 'score_b', b.score_b,
    'pull_scores', live.pull_scores_json(b.id), 'lead_side', b.lead_side, 'score_version', b.score_version,
    'last_contribution', jsonb_build_object('side', p_side, 'points', p_points, 'sender', v_sender)), p_sender);

  if v_swing then
    perform live.emit_battle(b, 'BATTLE_SWING', jsonb_build_object(
      'battle_id', b.id, 'side', p_side, 'points', p_points, 'sender', v_sender, 'gift', p_gift), p_sender);
  end if;
  if v_cb_side is not null then
    perform live.emit_battle(b, 'BATTLE_COMEBACK', jsonb_build_object(
      'battle_id', b.id, 'side', v_cb_side, 'deficit_before', v_cb_before, 'deficit_after', v_cb_after), p_sender);
  end if;
  if v_lead_emit then
    perform live.emit_battle(b, 'BATTLE_LEAD_CHANGED', jsonb_build_object(
      'battle_id', b.id, 'lead_side', b.lead_side, 'score_a', b.score_a, 'score_b', b.score_b,
      'is_final_moment', v_is_final), p_sender);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Battle cancellation / finalization (internal)
-- -----------------------------------------------------------------------------

-- Caller holds the session locks (sorted) and the battle row lock.
create function live.cancel_battle(p_battle_id uuid, p_reason text) returns void
language plpgsql set search_path = '' as $$
declare b live.battles; v_was text;
begin
  select * into b from live.battles where id = p_battle_id;
  v_was := b.status;
  if v_was not in ('invited', 'accepted') then return; end if;
  update live.battles set status = 'cancelled', cancel_reason = p_reason where id = p_battle_id returning * into b;
  update live.sessions set battle_id = null where battle_id = p_battle_id;
  if v_was = 'accepted' then
    -- Audiences already saw BATTLE_ACCEPTED → they get the cancellation on the stream.
    perform live.emit_battle(b, 'BATTLE_CANCELLED', jsonb_build_object('battle_id', b.id, 'reason', p_reason));
  end if;
  perform live.notify_user(b.host_a, 'BATTLE_CANCELLED', jsonb_build_object('battle_id', b.id, 'reason', p_reason));
  perform live.notify_user(b.host_b, 'BATTLE_CANCELLED', jsonb_build_object('battle_id', b.id, 'reason', p_reason));
end $$;

-- Expires due invites (optionally only those touching p_live_ids). Invites are not on
-- any LIVE stream (viewers never saw them) → hosts are notified personally.
create function live.expire_invites(p_live_ids uuid[] default null) returns integer
language plpgsql set search_path = '' as $$
declare b live.battles; n integer := 0;
begin
  for b in
    update live.battles x set status = 'expired', cancel_reason = 'expired'
    where x.status = 'invited' and x.invite_expires_at <= clock_timestamp()
      and (p_live_ids is null or x.live_a = any(p_live_ids) or x.live_b = any(p_live_ids))
    returning x.*
  loop
    n := n + 1;
    perform live.notify_user(b.host_a, 'BATTLE_CANCELLED', jsonb_build_object('battle_id', b.id, 'reason', 'expired'));
    perform live.notify_user(b.host_b, 'BATTLE_CANCELLED', jsonb_build_object('battle_id', b.id, 'reason', 'expired'));
  end loop;
  return n;
end $$;

-- Idempotent. Without a forfeit it is a no-op until ends_at. Concurrent callers serialize
-- on the session + battle locks; exactly one produces BATTLE_ENDED/BATTLE_RESULT.
create function live.finalize_battle(p_battle_id uuid, p_forfeit_side text default null) returns boolean
language plpgsql set search_path = '' as $$
declare
  b live.battles;
  v_now timestamptz;
  v_winner text;
  v_pull_wins jsonb;
  v_wa integer;
  v_wb integer;
  v_stats jsonb;
  v_result jsonb;
begin
  select * into b from live.battles where id = p_battle_id;
  if not found then return false; end if;
  perform live.lock_sessions(array[b.live_a, b.live_b]);
  select * into b from live.battles where id = p_battle_id for update;
  if b.status not in ('accepted', 'live', 'locked') then return false; end if;
  v_now := clock_timestamp();
  if p_forfeit_side is null and v_now < b.ends_at then return false; end if;

  if b.scoring = 'pulls' then
    select count(*) filter (where p.a > p.b), count(*) filter (where p.b > p.a)
      into v_wa, v_wb from live.battle_pull_scores p where p.battle_id = b.id;
    v_pull_wins := jsonb_build_object('a', v_wa, 'b', v_wb);
    v_winner := case
      when v_wa > v_wb then 'a'
      when v_wb > v_wa then 'b'
      when b.tiebreak = 'total' and b.score_a > b.score_b then 'a'
      when b.tiebreak = 'total' and b.score_b > b.score_a then 'b'
    end;
  else
    v_winner := case when b.score_a > b.score_b then 'a' when b.score_b > b.score_a then 'b' end;
  end if;
  if p_forfeit_side is not null then
    v_winner := case when p_forfeit_side = 'a' then 'b' else 'a' end;
  end if;

  v_stats := jsonb_build_object(
    'total_gifts', (select coalesce(sum(t.quantity), 0) from live.gift_transactions t
                    where t.battle_id = b.id and t.battle_outcome = 'counted'),
    'biggest_gift', (select jsonb_build_object('sender', live.user_ref(t.sender_id), 'gift', live.gift_ref(t.gift_id),
                                               'coin_value', t.coin_value, 'side', t.battle_side)
                     from live.gift_transactions t where t.battle_id = b.id and t.battle_outcome = 'counted'
                     order by t.coin_value desc, t.created_at limit 1),
    'top_supporters', (select coalesce(jsonb_agg(jsonb_build_object('side', x.side, 'user', live.user_ref(x.sender_id),
                                                                    'points', x.pts) order by x.side, x.rn), '[]'::jsonb)
                       from (select c.side, c.sender_id, sum(c.points) as pts,
                                    row_number() over (partition by c.side order by sum(c.points) desc, min(c.id)) as rn
                             from live.battle_contributions c where c.battle_id = b.id
                             group by c.side, c.sender_id) x
                       where x.rn <= 3),
    'lead_changes', b.lead_changes,
    'comebacks', b.comebacks,
    -- Peak audience during the battle window is not tracked separately (no estimate is shown).
    'peak_viewers', null);

  v_result := jsonb_build_object('winner_side', v_winner, 'final_a', b.score_a, 'final_b', b.score_b,
                                 'pull_wins', v_pull_wins, 'stats', v_stats, 'forfeit_side', p_forfeit_side);

  update live.battles set status = 'finalized', locked_at = coalesce(locked_at, v_now), finalized_at = v_now,
                          winner_side = v_winner, result = v_result
  where id = b.id returning * into b;

  perform live.emit_battle(b, 'BATTLE_ENDED', jsonb_build_object('battle_id', b.id, 'score_a', b.score_a, 'score_b', b.score_b));
  perform live.emit_battle(b, 'BATTLE_RESULT', jsonb_build_object('battle_id', b.id, 'result', v_result));
  return true;
end $$;

-- -----------------------------------------------------------------------------
-- GIFT TRANSACTION — the only way coins move between users.
--
-- Business rejections return {ok:false, code, message} and write NOTHING.
-- Invalid requests raise. Any failure rolls back everything, including events.
-- -----------------------------------------------------------------------------
create function public.live_send_gift(
  p_live_id uuid,
  p_gift_id text,
  p_quantity integer,
  p_idempotency_key text,
  p_battle_mode text default 'auto',
  p_expected_battle_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := live.require_uid();
  v_host uuid;
  v_battle_id uuid;
  v_b live.battles;
  v_s live.sessions;
  v_gift live.gifts;
  v_tx live.gift_transactions;
  v_seg live.battle_timeline;
  v_now timestamptz;
  v_currency text;
  v_earn text;
  v_cost bigint;
  v_balance bigint;
  v_host_balance bigint;
  v_side text;
  v_points bigint := 0;
  v_mult numeric := 0;
  v_outcome text := 'no_battle';
  v_reject text;
  v_sup live.supporters;
  v_prev_total bigint;
  v_prev_streak integer;
  v_streak integer;
  v_streak_hit integer;
  v_crossed integer[];
  v_top_uid uuid;
  v_top_total bigint;
  v_sender jsonb;
  v_gift_json jsonb;
  c_max_qty integer := live.cfg_num('{limits,gift_max_quantity}', 99, 1, 999)::integer;
  c_window numeric := live.cfg_num('{detectors,streak,window_ms}', 4000, 500, 60000);
  c_emit_at integer[] := live.cfg_ints('{detectors,streak,emit_at}', '{5,10,25,50}');
  c_thresholds integer[] := live.cfg_ints('{detectors,supporter,thresholds}', '{500,1000,5000,10000}');
  c_top_min numeric := live.cfg_num('{detectors,supporter,top_min_coins}', 100, 0, 1e12);
  c_top_cool numeric := live.cfg_num('{detectors,supporter,top_cooldown_s}', 20, 0, 3600);
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > c_max_qty then perform live.fail('INVALID_QUANTITY'); end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 128 then
    perform live.fail('INVALID_IDEMPOTENCY_KEY');
  end if;
  if p_battle_mode is null or p_battle_mode not in ('auto', 'outside_battle') then perform live.fail('INVALID_BATTLE_MODE'); end if;

  select s.host_id, s.battle_id into v_host, v_battle_id from live.sessions s where s.id = p_live_id;
  if v_host is null then perform live.fail('LIVE_NOT_FOUND'); end if;
  if v_host = v_uid then perform live.fail('CANNOT_GIFT_SELF'); end if;

  -- (1) Wallets, sorted. The host wallet is created by live_start; a missing sender
  --     wallet simply means a zero balance (nothing is created on rejection).
  perform 1 from live.wallets w where w.user_id in (v_uid, v_host) order by w.user_id for update;

  -- (2) Idempotency, serialized by the sender wallet lock.
  select * into v_tx from live.gift_transactions t where t.sender_id = v_uid and t.idempotency_key = p_idempotency_key;
  if found then
    if v_tx.live_id <> p_live_id or v_tx.gift_id <> p_gift_id or v_tx.quantity <> p_quantity
       or v_tx.battle_mode <> p_battle_mode then
      perform live.fail('IDEMPOTENCY_KEY_REUSED');
    end if;
    return live.gift_result(v_tx, true);
  end if;

  -- (3) Sessions (both sides when in a battle), then re-check the battle link.
  if v_battle_id is not null then
    select * into v_b from live.battles b where b.id = v_battle_id;
    perform live.lock_sessions(array[v_b.live_a, v_b.live_b]);
  else
    perform live.lock_sessions(array[p_live_id]);
  end if;
  select * into v_s from live.sessions s where s.id = p_live_id;
  if v_s.battle_id is distinct from v_battle_id then
    -- A battle was attached/detached between the unlocked read and the lock. Safe to retry
    -- with the SAME idempotency key (nothing was written).
    raise exception using errcode = '40001', message = 'RETRY', detail = 'battle changed while acquiring locks';
  end if;

  -- (4) Validation
  if v_s.status <> 'live' then perform live.fail('LIVE_NOT_ACTIVE'); end if;
  if not live.can_view(p_live_id, v_uid) then perform live.fail('LIVE_ACCESS_DENIED'); end if;
  select * into v_gift from live.gifts g where g.id = p_gift_id and g.enabled;
  if not found then perform live.fail('GIFT_UNAVAILABLE'); end if;
  if not exists (select 1 from live.wallets w where w.user_id = v_host) then perform live.fail('RECIPIENT_WALLET_MISSING'); end if;

  v_cost := v_gift.coin_cost::bigint * p_quantity;
  v_currency := case when live.flag('test_credits') then 'test_coins' else 'coins' end;
  v_earn := case when v_currency = 'test_coins' then 'test_earnings' else 'earnings' end;
  select case when v_currency = 'test_coins' then w.test_coins else w.coins end into v_balance
  from live.wallets w where w.user_id = v_uid;
  v_balance := coalesce(v_balance, 0);
  if v_balance < v_cost then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_FUNDS', 'message', live.gift_reject_message('INSUFFICIENT_FUNDS'),
                              'currency', v_currency, 'balance', v_balance, 'required', v_cost);
  end if;

  -- (5) Battle state, decided under the battle row lock on server time.
  if v_battle_id is not null then
    select * into v_b from live.battles b where b.id = v_battle_id for update;
  end if;
  v_now := clock_timestamp();

  if v_b.id is not null and (v_b.status in ('accepted', 'live', 'locked')
       or (v_b.status = 'finalized' and v_b.finalized_at > v_now - interval '60 seconds')) then
    v_side := case when v_b.live_a = p_live_id then 'a' else 'b' end;
    if p_battle_mode = 'auto' and p_expected_battle_id is not null and p_expected_battle_id <> v_b.id then
      v_reject := 'BATTLE_CHANGED';
    elsif v_b.status in ('locked', 'finalized') or v_now >= v_b.ends_at then
      v_outcome := 'excluded';
      if p_battle_mode = 'auto' then v_reject := 'BATTLE_LOCKED'; end if;
    elsif v_now < v_b.starts_at then
      v_outcome := 'excluded';
      if p_battle_mode = 'auto' then v_reject := 'BATTLE_NOT_STARTED'; end if;
    else
      v_seg := live.segment_at(v_b.id, v_now);
      if coalesce(v_seg.multiplier, 0) = 0 then
        v_outcome := 'excluded';
        if p_battle_mode = 'auto' then v_reject := 'BATTLE_BREAK'; end if;
      elsif p_battle_mode = 'outside_battle' then
        v_reject := 'BATTLE_SCORING_ACTIVE';
      else
        v_outcome := 'counted';
        v_mult := v_seg.multiplier;
        v_points := greatest(1, floor(v_cost * v_mult))::bigint;
      end if;
    end if;
  elsif p_battle_mode = 'auto' and p_expected_battle_id is not null then
    -- The client still shows a battle that is no longer attached to this LIVE.
    v_reject := case when exists (select 1 from live.battles x where x.id = p_expected_battle_id
                                  and x.status in ('locked', 'finalized'))
                     then 'BATTLE_LOCKED' else 'BATTLE_CHANGED' end;
  end if;

  if v_reject is not null then
    return jsonb_build_object('ok', false, 'code', v_reject, 'message', live.gift_reject_message(v_reject),
                              'battle_id', coalesce(v_b.id, p_expected_battle_id));
  end if;

  -- (6) Money: debit sender, credit recipient, ledger both sides.
  if v_currency = 'test_coins' then
    update live.wallets w set test_coins = w.test_coins - v_cost, updated_at = now()
    where w.user_id = v_uid returning w.test_coins into v_balance;
    update live.wallets w set test_earnings = w.test_earnings + v_cost, updated_at = now()
    where w.user_id = v_host returning w.test_earnings into v_host_balance;
  else
    update live.wallets w set coins = w.coins - v_cost, updated_at = now()
    where w.user_id = v_uid returning w.coins into v_balance;
    update live.wallets w set earnings = w.earnings + v_cost, updated_at = now()
    where w.user_id = v_host returning w.earnings into v_host_balance;
  end if;

  insert into live.gift_transactions (sender_id, recipient_id, live_id, gift_id, quantity, unit_cost, coin_value, currency,
                                      battle_id, battle_side, battle_points, multiplier, battle_mode, battle_outcome,
                                      idempotency_key, created_at)
  values (v_uid, v_host, p_live_id, v_gift.id, p_quantity, v_gift.coin_cost, v_cost, v_currency,
          case when v_outcome <> 'no_battle' then v_b.id end, case when v_outcome <> 'no_battle' then v_side end,
          v_points, v_mult, p_battle_mode, v_outcome, p_idempotency_key, v_now)
  returning * into v_tx;

  insert into live.coin_ledger (user_id, currency, delta, balance_after, reason, ref_id, actor_id)
  values (v_uid, v_currency, -v_cost, v_balance, 'gift_sent', v_tx.id, v_uid),
         (v_host, v_earn, v_cost, v_host_balance, 'gift_received', v_tx.id, v_uid);

  -- (7) Battle contribution + totals
  if v_outcome = 'counted' then
    insert into live.battle_contributions (battle_id, side, sender_id, gift_tx_id, base_points, multiplier, points,
                                           timeline_idx, pull_no, created_at)
    values (v_b.id, v_side, v_uid, v_tx.id, v_cost, v_mult, v_points, v_seg.idx, v_seg.pull_no, v_now);
    update live.battles b set
      score_a = b.score_a + case when v_side = 'a' then v_points else 0 end,
      score_b = b.score_b + case when v_side = 'b' then v_points else 0 end,
      score_version = b.score_version + 1,
      status = case when b.status = 'accepted' then 'live' else b.status end
    where b.id = v_b.id;
    if v_seg.pull_no is not null then
      update live.battle_pull_scores p set
        a = p.a + case when v_side = 'a' then v_points else 0 end,
        b = p.b + case when v_side = 'b' then v_points else 0 end
      where p.battle_id = v_b.id and p.pull_no = v_seg.pull_no;
    end if;
  end if;

  -- (8) Supporters, streaks, milestones
  insert into live.supporters (live_id, user_id, first_gift_at, updated_at)
  values (p_live_id, v_uid, v_now, v_now) on conflict (live_id, user_id) do nothing;
  select * into v_sup from live.supporters s where s.live_id = p_live_id and s.user_id = v_uid for update;
  v_prev_total := v_sup.total_coins;
  v_prev_streak := case when v_sup.streak_gift_id = v_gift.id
                          and v_sup.streak_last_at > v_now - make_interval(secs => c_window / 1000.0)
                        then v_sup.streak_count else 0 end;
  v_streak := v_prev_streak + p_quantity;
  select max(e) into v_streak_hit from unnest(c_emit_at) e where e > v_prev_streak and e <= v_streak;
  select coalesce(array_agg(t order by t), '{}') into v_crossed
  from unnest(c_thresholds) t
  where t > v_prev_total and t <= v_prev_total + v_cost and not (t = any(v_sup.thresholds_reached));

  update live.supporters s set
    total_coins = s.total_coins + v_cost,
    gift_count = s.gift_count + p_quantity,
    streak_gift_id = v_gift.id,
    streak_count = v_streak,
    streak_last_at = v_now,
    thresholds_reached = (select coalesce(array_agg(distinct x order by x), '{}')
                          from unnest(s.thresholds_reached || v_crossed) x),
    updated_at = v_now
  where s.live_id = p_live_id and s.user_id = v_uid
  returning * into v_sup;

  -- (9) Events (same transaction; nothing is broadcast unless all of the above commits)
  v_sender := live.user_ref(v_uid);
  v_gift_json := jsonb_build_object('id', v_gift.id, 'name', v_gift.name, 'rarity', v_gift.rarity_tier,
                                    'coin_cost', v_gift.coin_cost, 'icon_url', v_gift.icon_url,
                                    'animation_url', v_gift.animation_url);

  perform live.emit(p_live_id, 'GIFT_RECEIVED', jsonb_build_object(
    'tx_id', v_tx.id,
    'sender', v_sender,
    'recipient_id', v_host,
    'gift', v_gift_json,
    'quantity', p_quantity,
    'coin_value', v_cost,
    'battle_id', case when v_outcome = 'counted' then v_b.id end,
    'battle_side', case when v_outcome = 'counted' then v_side end,
    'battle_points', v_points,
    'multiplier', v_mult,
    'sender_live_total', v_sup.total_coins,
    'battle_outcome', v_outcome), case when v_outcome = 'counted' then v_b.id end, v_uid);

  if v_streak_hit is not null then
    perform live.emit(p_live_id, 'GIFT_STREAK',
      jsonb_build_object('sender', v_sender, 'gift', v_gift_json, 'streak', v_streak_hit), null, v_uid);
  end if;

  if array_length(v_crossed, 1) > 0 then
    perform live.emit(p_live_id, 'SUPPORTER_MILESTONE',
      jsonb_build_object('supporter', v_sender, 'threshold', v_crossed[array_length(v_crossed, 1)],
                         'total', v_sup.total_coins), null, v_uid);
  end if;

  -- Top supporter: top_supporter_id is the last ANNOUNCED #1. An overtake during the
  -- cooldown is announced on the next gift after the cooldown.
  select s.user_id, s.total_coins into v_top_uid, v_top_total
  from live.supporters s where s.live_id = p_live_id
  order by s.total_coins desc, s.first_gift_at, s.user_id limit 1;
  if v_top_uid = v_s.top_supporter_id then
    update live.sessions set top_supporter_total = v_top_total where id = p_live_id;
  elsif v_top_total >= c_top_min
        and (v_s.top_supporter_event_at is null or v_s.top_supporter_event_at <= v_now - make_interval(secs => c_top_cool)) then
    update live.sessions set top_supporter_id = v_top_uid, top_supporter_total = v_top_total, top_supporter_event_at = v_now
    where id = p_live_id;
    perform live.emit(p_live_id, 'TOP_SUPPORTER_CHANGED', jsonb_build_object(
      'supporter', live.user_ref(v_top_uid),
      'total', v_top_total,
      'previous', case when v_s.top_supporter_id is not null then live.user_ref(v_s.top_supporter_id) end,
      'previous_total', (select s.total_coins from live.supporters s
                         where s.live_id = p_live_id and s.user_id = v_s.top_supporter_id)), null, v_uid);
  end if;

  if v_outcome = 'counted' then
    perform live.battle_on_contribution(v_b.id, v_side, v_points, v_uid, v_gift_json, v_now);
  end if;

  return live.gift_result(v_tx, false);
end $$;

-- -----------------------------------------------------------------------------
-- BATTLES
-- -----------------------------------------------------------------------------
create function public.live_battle_invite(p_target_live_id uuid, p_format_id text default 'classic_double')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := live.require_uid();
  v_my uuid;
  s_my live.sessions;
  s_t live.sessions;
  v_f live.battle_formats;
  v_errs text[];
  v_id uuid;
  v_battle jsonb;
  c_ttl numeric := live.cfg_num('{limits,invite_ttl_s}', 30, 10, 300);
begin
  select s.id into v_my from live.sessions s where s.host_id = v_uid and s.status = 'live';
  if v_my is null then perform live.fail('NOT_LIVE'); end if;
  if p_target_live_id is null or p_target_live_id = v_my then perform live.fail('INVALID_TARGET'); end if;

  perform live.lock_sessions(array[v_my, p_target_live_id]);
  select * into s_my from live.sessions where id = v_my;
  select * into s_t from live.sessions where id = p_target_live_id;
  if s_t.id is null or s_t.status <> 'live' then perform live.fail('TARGET_NOT_LIVE'); end if;
  if s_my.visibility <> 'public' or s_t.visibility <> 'public' then perform live.fail('BATTLE_REQUIRES_PUBLIC'); end if;
  if live.is_blocked_between(v_uid, s_t.host_id) or live.is_platform_banned(s_t.host_id) then
    perform live.fail('TARGET_UNAVAILABLE');
  end if;
  if live.active_battle_id(v_my) is not null then perform live.fail('ALREADY_IN_BATTLE'); end if;
  if live.active_battle_id(p_target_live_id) is not null then perform live.fail('TARGET_IN_BATTLE'); end if;

  perform live.expire_invites(array[v_my, p_target_live_id]);
  if exists (select 1 from live.battles b where b.status = 'invited'
             and (b.live_a in (v_my, p_target_live_id) or b.live_b in (v_my, p_target_live_id))) then
    perform live.fail('INVITE_PENDING');
  end if;
  if exists (select 1 from live.battles b where b.invited_by = v_uid and b.live_b = p_target_live_id
             and b.cancel_reason = 'declined' and b.created_at > clock_timestamp() - interval '30 seconds') then
    perform live.fail('INVITE_COOLDOWN');
  end if;

  select * into v_f from live.battle_formats f where f.id = p_format_id and f.enabled;
  if not found then perform live.fail('FORMAT_UNAVAILABLE'); end if;
  v_errs := live.validate_format(v_f.definition);
  if coalesce(array_length(v_errs, 1), 0) > 0 then perform live.fail('INVALID_BATTLE_FORMAT', array_to_string(v_errs, ' ')); end if;

  insert into live.battles (format_id, format_snapshot, live_a, live_b, host_a, host_b, status, invited_by,
                            invite_expires_at, scoring, tiebreak)
  values (v_f.id, v_f.definition, v_my, p_target_live_id, v_uid, s_t.host_id, 'invited', v_uid,
          clock_timestamp() + make_interval(secs => c_ttl), v_f.definition ->> 'scoring',
          coalesce(v_f.definition ->> 'tiebreak', 'draw'))
  returning id into v_id;

  v_battle := live.battle_json(v_id);
  perform live.notify_user(s_t.host_id, 'BATTLE_INVITED', jsonb_build_object('battle', v_battle, 'from', live.user_ref(v_uid)));
  perform live.notify_user(v_uid, 'BATTLE_INVITED', jsonb_build_object('battle', v_battle, 'from', live.user_ref(v_uid)));
  return v_battle;
end $$;

create function public.live_battle_respond(p_battle_id uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := live.require_uid();
  b live.battles;
  s_a live.sessions;
  s_b live.sessions;
  v_c jsonb;
  v_battle jsonb;
  c_lead numeric := live.cfg_num('{limits,accept_lead_ms}', 1500, 0, 10000);
begin
  select * into b from live.battles where id = p_battle_id;
  if not found then perform live.fail('BATTLE_NOT_FOUND'); end if;
  if b.host_b <> v_uid then perform live.fail('NOT_AUTHORIZED'); end if;

  perform live.lock_sessions(array[b.live_a, b.live_b]);
  select * into b from live.battles where id = p_battle_id for update;
  if b.status <> 'invited' then perform live.fail('BATTLE_INVITE_NOT_PENDING'); end if;
  if b.invite_expires_at <= clock_timestamp() then
    perform live.expire_invites(array[b.live_a, b.live_b]);
    return jsonb_build_object('ok', false, 'code', 'BATTLE_INVITE_EXPIRED');
  end if;

  if not coalesce(p_accept, false) then
    perform live.cancel_battle(b.id, 'declined');
    return jsonb_build_object('ok', true, 'status', 'cancelled');
  end if;

  select * into s_a from live.sessions where id = b.live_a;
  select * into s_b from live.sessions where id = b.live_b;
  if s_a.status <> 'live' or s_b.status <> 'live' or s_a.visibility <> 'public' or s_b.visibility <> 'public'
     or live.is_blocked_between(b.host_a, b.host_b)
     or live.active_battle_id(b.live_a) is not null or live.active_battle_id(b.live_b) is not null then
    perform live.cancel_battle(b.id, 'cancelled');
    return jsonb_build_object('ok', false, 'code', 'BATTLE_UNAVAILABLE');
  end if;

  v_c := live.compile_timeline_json(b.format_snapshot,
                                    clock_timestamp() + make_interval(secs => round(c_lead) / 1000.0));
  insert into live.battle_timeline (battle_id, idx, kind, starts_at, ends_at, multiplier, pull_no, warning_ms, label_key)
  select b.id, (e ->> 'idx')::integer, e ->> 'kind', (e ->> 'starts_at')::timestamptz, (e ->> 'ends_at')::timestamptz,
         (e ->> 'multiplier')::numeric, (e ->> 'pull_no')::numeric::integer, (e ->> 'warning_ms')::numeric::integer, e ->> 'label_key'
  from jsonb_array_elements(v_c -> 'timeline') e;
  insert into live.battle_pull_scores (battle_id, pull_no)
  select distinct b.id, t.pull_no from live.battle_timeline t where t.battle_id = b.id and t.pull_no is not null;

  update live.battles set status = 'accepted',
    intro_at = (v_c ->> 'intro_at')::timestamptz,
    starts_at = (v_c ->> 'starts_at')::timestamptz,
    ends_at = (v_c ->> 'ends_at')::timestamptz,
    final_countdown_ms = (v_c ->> 'final_countdown_ms')::numeric::integer
  where id = b.id returning * into b;
  update live.sessions set battle_id = b.id where id in (b.live_a, b.live_b);

  v_battle := live.battle_json(b.id);
  perform live.emit_battle(b, 'BATTLE_ACCEPTED', jsonb_build_object('battle', v_battle), v_uid);
  return jsonb_build_object('ok', true, 'battle', v_battle);
end $$;

-- Either host may withdraw before the scoring starts.
create function public.live_battle_cancel(p_battle_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); b live.battles;
begin
  select * into b from live.battles where id = p_battle_id;
  if not found or v_uid not in (b.host_a, b.host_b) then perform live.fail('BATTLE_NOT_FOUND'); end if;
  perform live.lock_sessions(array[b.live_a, b.live_b]);
  select * into b from live.battles where id = p_battle_id for update;
  if b.status = 'invited' or (b.status = 'accepted' and clock_timestamp() < b.starts_at) then
    perform live.cancel_battle(b.id, 'cancelled');
    return jsonb_build_object('ok', true);
  end if;
  if b.status in ('cancelled', 'expired') then return jsonb_build_object('ok', true); end if;
  perform live.fail('BATTLE_ALREADY_STARTED');
end $$;

-- A host leaves a running battle: the leaving side loses (before the start it is a cancel).
create function public.live_battle_forfeit(p_battle_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := live.require_uid(); b live.battles; v_side text;
begin
  select * into b from live.battles where id = p_battle_id;
  if not found or v_uid not in (b.host_a, b.host_b) then perform live.fail('BATTLE_NOT_FOUND'); end if;
  v_side := case when v_uid = b.host_a then 'a' else 'b' end;
  perform live.lock_sessions(array[b.live_a, b.live_b]);
  select * into b from live.battles where id = p_battle_id for update;
  if b.status not in ('accepted', 'live', 'locked') then perform live.fail('BATTLE_NOT_ACTIVE'); end if;
  if clock_timestamp() < b.starts_at then
    perform live.cancel_battle(b.id, 'cancelled');
  elsif clock_timestamp() < b.ends_at then
    perform live.finalize_battle(b.id, v_side);
  else
    perform live.finalize_battle(b.id, null);
  end if;
  return jsonb_build_object('ok', true, 'battle', live.battle_json(b.id));
end $$;
