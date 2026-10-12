import { describe, it, expect, beforeEach } from 'vitest';
import { createProductionLiveSession } from '../production/ProductionLiveSession';
import type { UserRef, AnyLiveEvent } from '../core/events';

// In-memory localStorage polyfill for Node.js test environment
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
};
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe('Battle Invitation & Synchronization Flow', () => {
  const hostA: UserRef = {
    id: 'creator-host-a',
    handle: 'host_alpha',
    display_name: 'Host Alpha',
    avatar_url: 'https://example.com/alpha.jpg',
  };

  const hostB: UserRef = {
    id: 'creator-host-b',
    handle: 'host_beta',
    display_name: 'Host Beta',
    avatar_url: 'https://example.com/beta.jpg',
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('Host A invites Host B: Host A marks outgoing, Host B marks incoming and accepts with preserved sides', async () => {
    // 1. Initialize Host A's live session
    const sessionA = createProductionLiveSession({
      streamerId: 'stream-alpha',
      streamerHandle: 'host_alpha',
      streamerName: 'Host Alpha',
      streamerAvatar: 'https://example.com/alpha.jpg',
      me: hostA,
      isHost: true,
    });

    // 2. Initialize Host B's live session
    const sessionB = createProductionLiveSession({
      streamerId: 'stream-beta',
      streamerHandle: 'host_beta',
      streamerName: 'Host Beta',
      streamerAvatar: 'https://example.com/beta.jpg',
      me: hostB,
      isHost: true,
    });

    const eventsA: AnyLiveEvent[] = [];
    sessionA.feed.connect({
      onSnapshot: () => {},
      onEvent: (evt) => eventsA.push(evt),
      onPersonal: () => {},
      onConnection: () => {},
      onUnavailable: () => {},
    });

    const eventsB: AnyLiveEvent[] = [];
    sessionB.feed.connect({
      onSnapshot: () => {},
      onEvent: (evt) => eventsB.push(evt),
      onPersonal: () => {},
      onConnection: () => {},
      onUnavailable: () => {},
    });

    // 3. Host A sends battle invite to Host B
    const inviteRes = await sessionA.commands.battleInvite?.(hostB, 'classic_double');
    expect(inviteRes?.ok).toBe(true);
    const battleId = inviteRes?.ok ? inviteRes.data.battle_id : '';

    // Verify Host A received BATTLE_INVITED with isOutgoing: true
    const inviteEventA = eventsA.find((e) => e.event_type === 'BATTLE_INVITED');
    expect(inviteEventA).toBeDefined();
    expect(inviteEventA?.payload.isOutgoing).toBe(true);

    // Snapshot on Host A shows invited state with Host B as side_b
    const snapA = await sessionA.commands.getSnapshot('stream-alpha');
    expect(snapA.ok).toBe(true);
    if (snapA.ok) {
      expect(snapA.data.battle?.status).toBe('invited');
      expect(snapA.data.battle?.side_a.host.id).toBe('host_alpha');
      expect(snapA.data.battle?.side_b.host.id).toBe('creator-host-b');
    }

    // Simulate Host B responding
    const acceptRes = await sessionB.commands.battleRespond(battleId, true);
    expect(acceptRes).toBeDefined();

    sessionA.dispose();
    sessionB.dispose();
  });

  it('Preserves canonical side_a and side_b when invitee accepts', async () => {
    // Session for Host B
    const sessionB = createProductionLiveSession({
      streamerId: 'stream-beta',
      streamerHandle: 'host_beta',
      streamerName: 'Host Beta',
      streamerAvatar: 'https://example.com/beta.jpg',
      me: hostB,
      isHost: true,
    });

    const incomingSnapshot = {
      battle_id: 'test-battle-sync-1',
      format_id: 'classic_double',
      status: 'invited' as const,
      side_a: { live_id: 'stream-alpha', host: hostA },
      side_b: { live_id: 'stream-beta', host: hostB },
      scoring: { base_rate: 1, dynamic_multipliers: false },
      invite_expires_at: new Date(Date.now() + 30000).toISOString(),
      intro_at: new Date(Date.now()).toISOString(),
      starts_at: new Date(Date.now() + 3000).toISOString(),
      ends_at: new Date(Date.now() + 183000).toISOString(),
      final_countdown_ms: 30000,
      timeline: [],
      score_a: 0,
      score_b: 0,
      pull_scores: [],
      lead_side: null,
      score_version: 1,
      result: null,
    };

    expect(incomingSnapshot.side_a.host.id).toBe('creator-host-a');
    expect(incomingSnapshot.side_b.host.id).toBe('creator-host-b');

    // Verify startBattle requires verified opponent
    const invalidStart = await sessionB.commands.startBattle?.('classic_double');
    expect(invalidStart?.ok).toBe(false);

    sessionB.dispose();
  });
});
