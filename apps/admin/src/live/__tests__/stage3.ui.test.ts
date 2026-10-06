import { describe, expect, it } from 'vitest';
import type { LiveRoomState } from '../core/roomState';
import type { UserRef, BattleSnapshot } from '../core/events';
import type { ParticipantMedia } from '../client/connection';
import { buildStage, battleSides } from '../ui/buildStage';
import { renderMoment } from '../show/momentContent';
import type { AnyMoment, LiveMoment, MomentPayloads } from '../show/types';
import type { MomentKey, MomentLane, MomentPriority } from '../show/config';
import { LabMediaHub } from '../dev/LabMediaHub';

const u = (id: string, name = id): UserRef => ({
  id,
  handle: name.toLowerCase(),
  display_name: name,
  avatar_url: null,
});

function makeRoom(overrides?: Partial<LiveRoomState>): LiveRoomState {
  return {
    liveId: 'live-test',
    status: 'live',
    title: 'Test Live',
    host: u('host-1', 'Host'),
    viewerCount: 42,
    peakViewers: 100,
    topSupporters: [],
    battle: null,
    commentsEnabled: true,
    guests: [],
    configVersion: 1,
    ...overrides,
  };
}

describe('buildStage', () => {
  it('builds solo stage for host only', () => {
    const room = makeRoom();
    const stage = buildStage({
      room,
      battle: null,
      mode: 'auto',
      presence: new Map(),
    });
    expect(stage.layout).toBe('solo');
    expect(stage.columns).toBe(1);
    expect(stage.tiles).toHaveLength(1);
    expect(stage.tiles[0].id).toBe('host-1');
    expect(stage.tiles[0].role).toBe('host');
    expect(stage.tiles[0].area).toBe('main');
  });

  it('builds split stage with 1 guest', () => {
    const room = makeRoom({
      guests: [{ ...u('guest-1', 'Guest 1'), slot: 0 }],
    });
    const stage = buildStage({
      room,
      battle: null,
      mode: 'auto',
      presence: new Map(),
    });
    expect(stage.layout).toBe('split');
    expect(stage.tiles).toHaveLength(2);
    expect(stage.tiles[0].id).toBe('host-1');
    expect(stage.tiles[1].id).toBe('guest-1');
  });

  it('builds battle stage with A and B sides and guest strip', () => {
    const battle: BattleSnapshot = {
      battle_id: 'b-1',
      format_id: 'classic_double',
      status: 'live',
      side_a: { live_id: 'live-test', host: u('host-1', 'Host') },
      side_b: { live_id: 'live-opp', host: u('opp-1', 'Opponent') },
      scoring: 'total',
      invite_expires_at: null,
      intro_at: null,
      starts_at: '2026-10-06T00:00:00Z',
      ends_at: null,
      final_countdown_ms: 30000,
      timeline: [],
      score_a: 100,
      score_b: 200,
      pull_scores: [],
      lead_side: 'b',
      score_version: 1,
      result: null,
    };
    const room = makeRoom({
      battle,
      guests: [{ ...u('guest-1', 'Guest 1'), slot: 0 }],
    });
    const sides = battleSides(room);
    expect(sides).not.toBeNull();
    expect(sides?.a.id).toBe('host-1');
    expect(sides?.b.id).toBe('opp-1');

    const stage = buildStage({
      room,
      battle: sides,
      mode: 'auto',
      presence: new Map(),
    });
    expect(stage.layout).toBe('battle');
    expect(stage.columns).toBe(2);
    expect(stage.tiles).toHaveLength(3); // side A, side B, guest in strip
    expect(stage.tiles[0].side).toBe('a');
    expect(stage.tiles[1].side).toBe('b');
    expect(stage.tiles[2].area).toBe('strip');
  });

  it('battleSides returns null for cancelled or expired battles', () => {
    const room = makeRoom({
      battle: {
        battle_id: 'b-2',
        format_id: 'classic_double',
        status: 'cancelled',
        side_a: { live_id: 'live-1', host: u('h1') },
        side_b: { live_id: 'live-2', host: u('h2') },
        scoring: 'total',
        invite_expires_at: null,
        intro_at: null,
        starts_at: null,
        ends_at: null,
        final_countdown_ms: 30000,
        timeline: [],
        score_a: 0,
        score_b: 0,
        pull_scores: [],
        lead_side: null,
        score_version: 0,
        result: null,
      },
    });
    expect(battleSides(room)).toBeNull();
  });

  it('correctly maps presence and localPlaybackMuted', () => {
    const presence = new Map<string, ParticipantMedia>([
      ['guest-1', { id: 'guest-1', status: 'connected', cameraOn: true, micOn: false, stream: null }],
    ]);
    const localPlaybackMuted = new Set(['guest-1']);
    const room = makeRoom({
      guests: [{ ...u('guest-1', 'Guest 1'), slot: 0 }],
    });

    const stage = buildStage({
      room,
      battle: null,
      mode: 'auto',
      presence,
      localPlaybackMuted,
    });
    const guestTile = stage.tiles.find((t) => t.id === 'guest-1');
    expect(guestTile?.media?.cameraOn).toBe(true);
    expect(guestTile?.media?.micOn).toBe(false);
    expect(guestTile?.localPlaybackMuted).toBe(true);
  });
});

describe('renderMoment', () => {
  const sender = u('sender-1', 'Sender');
  const gift = {
    id: 'rose',
    name: 'Rose',
    coin_cost: 10,
    rarity: 'common' as const,
    icon_url: '/gifts/rose/icon.webp',
    animation_url: null,
  };

  function makeMoment<K extends MomentKey>(
    key: K,
    lane: MomentLane,
    priority: MomentPriority,
    payload: MomentPayloads[K],
  ): LiveMoment<K> {
    return {
      id: `m-${key}`,
      key,
      kind: 'gift',
      source: 'event',
      server_event_id: `se-${key}`,
      priority,
      lane,
      duration_ms: 3000,
      cooldown_key: key,
      cooldown_ms: 0,
      max_wait_ms: 0,
      preemptible: true,
      dedupe_key: `dk-${key}`,
      aggregate_group: null,
      effects: { sound: null, haptic: null },
      payload,
      created_at: 1000,
    };
  }

  it('renders gift moments for corner and banner surfaces', () => {
    const moment = makeMoment('gift_common', 'corner', 'medium', {
      sender,
      gift,
      quantity: 1,
      coin_value: 10,
      multiplier: 1,
      battle_side: null,
      battle_outcome: 'counted',
      battle_points: 10,
      sender_live_total: 10,
    });

    const cornerNode = renderMoment(moment as AnyMoment, 'corner');
    expect(cornerNode).toBeDefined();

    const bannerNode = renderMoment(moment as AnyMoment, 'banner');
    expect(bannerNode).toBeDefined();
  });

  it('renders all standard moment keys without error', () => {
    const moments: AnyMoment[] = [
      makeMoment('double_started', 'banner', 'high', {
        battle_id: 'b-1',
        multiplier: 2,
        ends_at_ms: 5000,
      }) as AnyMoment,
      makeMoment('gift_streak', 'corner', 'medium', {
        sender,
        gift,
        streak: 5,
      }) as AnyMoment,
      makeMoment('guest_joined', 'corner', 'medium', {
        guest: u('g1', 'Maya'),
      }) as AnyMoment,
      makeMoment('system_notice', 'corner', 'medium', {
        message: 'Maintenance in 10 mins',
        severity: 'info',
      }) as AnyMoment,
    ];

    for (const m of moments) {
      const rendered = renderMoment(m, m.lane as 'corner' | 'banner');
      expect(rendered).toBeDefined();
    }
  });
});

describe('LabMediaHub', () => {
  it('publishes and unpublishes media for participants', () => {
    const hub = new LabMediaHub();
    let updates = 0;
    const unsub = hub.subscribe(() => {
      updates += 1;
    });

    hub.publish('user-1', {
      stream: null,
      cameraOn: true,
      micOn: true,
    });
    expect(updates).toBe(1);
    expect(hub.get().get('user-1')?.cameraOn).toBe(true);

    hub.unpublish('user-1');
    expect(updates).toBe(2);
    expect(hub.get().get('user-1')).toBeUndefined();

    unsub();
    hub.dispose();
  });

  it('syncs simulated participants and tracks their simulated state', () => {
    const hub = new LabMediaHub();
    hub.syncSimulated([
      { id: 'sim-1', label: 'Sim User 1' },
      { id: 'sim-2', label: 'Sim User 2' },
    ]);

    expect(hub.simulatedIds()).toEqual(['sim-1', 'sim-2']);
    expect(hub.get().get('sim-1')?.status).toBe('connected');

    hub.setSimulatedState('sim-1', { cameraOn: false, status: 'reconnecting' });
    expect(hub.get().get('sim-1')?.cameraOn).toBe(false);
    expect(hub.get().get('sim-1')?.status).toBe('reconnecting');

    hub.dispose();
  });
});
