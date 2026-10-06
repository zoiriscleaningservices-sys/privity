/**
 * Aggregator — keeps bursts of low-priority activity calm.
 *
 * Strategy per group (gifts / joins / follows):
 *  - leading edge: the first item of a quiet group passes through immediately (low latency)
 *  - trailing window: further items within `aggregate_window_ms` are collected and released as
 *    ONE moment ("29 more gifts from 12 supporters"), or as the single item if only one arrived
 *  - the group stays "hot" while activity continues; it returns to idle after an empty window
 *
 * Only moments marked aggregatable (by config) are batched. Rare/epic/legendary gifts are not
 * aggregatable, so a significant gift inside a burst always keeps its own presentation.
 */

import { Timers, defaultTimers } from '../core/EventStore';
import { LiveShowConfig } from './config';
import { buildMoment } from './rules';
import { AggregateGroup, AnyMoment, GiftMomentPayload, LiveMoment } from './types';
import { UserRef } from '../core/events';

interface GroupState {
  items: AnyMoment[];
  timer: unknown;
}

export class MomentAggregator {
  private readonly groups = new Map<AggregateGroup, GroupState>();

  constructor(
    private readonly getConfig: () => LiveShowConfig,
    private readonly emit: (m: AnyMoment) => void,
    private readonly timers: Timers = defaultTimers,
  ) {}

  submit(m: AnyMoment): void {
    const group = m.aggregate_group;
    if (!group) {
      this.emit(m);
      return;
    }
    const state = this.groups.get(group);
    if (!state) {
      this.emit(m); // leading edge
      this.open(group);
      return;
    }
    state.items.push(m);
  }

  /** Releases everything immediately (used on dispose/reset). */
  flushAll(): void {
    for (const group of Array.from(this.groups.keys())) this.flush(group, false);
  }

  dispose(): void {
    for (const s of this.groups.values()) this.timers.clearTimeout(s.timer);
    this.groups.clear();
  }

  private open(group: AggregateGroup): void {
    const timer = this.timers.setTimeout(() => this.flush(group, true), this.getConfig().rhythm.aggregate_window_ms);
    this.groups.set(group, { items: [], timer });
  }

  private flush(group: AggregateGroup, keepHot: boolean): void {
    const state = this.groups.get(group);
    if (!state) return;
    this.timers.clearTimeout(state.timer);
    this.groups.delete(group);
    if (state.items.length === 0) return; // quiet window → idle

    const out = state.items.length === 1 ? state.items[0] : this.combine(group, state.items);
    if (out) this.emit(out);
    if (keepHot) this.open(group);
  }

  private combine(group: AggregateGroup, items: AnyMoment[]): AnyMoment | null {
    const cfg = this.getConfig();
    const first = items[0];
    const last = items[items.length - 1];
    const server_event_id = `agg:${first.server_event_id}..${last.server_event_id}`;
    const common = {
      source: 'event' as const,
      server_event_id,
      created_at: last.created_at,
      aggregate_group: null,
    };

    if (group === 'gifts') {
      const gifts = items.map((m) => m.payload as GiftMomentPayload);
      const top = gifts.reduce((best, g) => (g.coin_value > best.coin_value ? g : best), gifts[0]);
      return buildMoment(cfg, {
        ...common,
        key: 'gift_aggregate',
        kind: 'gift',
        payload: {
          count: gifts.length,
          unique_senders: new Set(gifts.map((g) => g.sender.id)).size,
          total_coins: gifts.reduce((s, g) => s + g.coin_value, 0),
          top,
        },
      });
    }

    if (group === 'joins') {
      const joins = items as Array<LiveMoment<'viewers_joined'>>;
      return buildMoment(cfg, {
        ...common,
        key: 'viewers_joined',
        kind: 'viewer',
        payload: {
          count: joins.reduce((s, m) => s + m.payload.count, 0),
          sample: uniqueUsers(joins.flatMap((m) => m.payload.sample)).slice(0, 3),
        },
      });
    }

    const follows = items as Array<LiveMoment<'follow'>>;
    return buildMoment(cfg, {
      ...common,
      key: 'follow',
      kind: 'follow',
      payload: {
        count: follows.reduce((s, m) => s + m.payload.count, 0),
        followers: uniqueUsers(follows.flatMap((m) => m.payload.followers)).slice(0, 3),
      },
    });
  }
}

function uniqueUsers(users: UserRef[]): UserRef[] {
  const seen = new Set<string>();
  return users.filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
}
