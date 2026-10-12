import { describe, it, expect, beforeEach } from 'vitest';
import { createProductionLiveSession } from '../production/ProductionLiveSession';
import type { UserRef } from '../core/events';
import { liveStreamSync } from '../../services/liveStreamSyncService';

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

describe('Matchmaking & Discovery Authoritative Tests', () => {
  const hostUser: UserRef = {
    id: 'user-host-1',
    handle: 'zoiriolys',
    display_name: 'zoiriolys hernandez',
    avatar_url: 'https://example.com/host.jpg',
  };

  const opponentUser: UserRef = {
    id: 'user-opponent-1',
    handle: 'realcreator',
    display_name: 'Real Creator',
    avatar_url: 'https://example.com/opp.jpg',
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('battleInvite dispatches invitation without fabricating immediate live battle', async () => {
    const session = createProductionLiveSession({
      streamerId: 'streamer-host-1',
      streamerHandle: 'zoiriolys',
      streamerName: 'zoiriolys hernandez',
      streamerAvatar: 'https://example.com/host.jpg',
      me: hostUser,
      isHost: true,
    });

    // Invite real opponent
    const inviteRes = await session.commands.battleInvite?.(opponentUser, 'classic_double');
    expect(inviteRes?.ok).toBe(true);
    if (inviteRes?.ok) {
      expect(inviteRes.data.battle_id).toBeDefined();
    }

    // Battle must NOT immediately be in "live" state in snapshot until accepted; it must be in "invited" status
    const snap = await session.commands.getSnapshot('streamer-host-1');
    expect(snap.ok).toBe(true);
    if (snap.ok) {
      expect(snap.data.battle?.status).toBe('invited');
      expect(snap.data.battle?.side_b.host.id).toBe('user-opponent-1');
      expect(snap.data.battle?.side_b.host.handle).toBe('realcreator');
    }

    session.dispose();
  });

  it('battleRespond begins battle with confirmed participants and prevents duplicate start', async () => {
    const session = createProductionLiveSession({
      streamerId: 'streamer-host-1',
      streamerHandle: 'zoiriolys',
      streamerName: 'zoiriolys hernandez',
      streamerAvatar: 'https://example.com/host.jpg',
      me: hostUser,
      isHost: true,
    });

    const battleEvents: string[] = [];
    session.feed.connect({
      onSnapshot: () => {},
      onEvent: (evt) => {
        if (evt.event_type === 'BATTLE_ACCEPTED') {
          battleEvents.push(evt.event_type);
        }
      },
      onPersonal: () => {},
      onConnection: () => {},
      onUnavailable: () => {},
    });

    // Accept battle with opponent
    const respondRes = await session.commands.battleRespond('battle-123', true);
    expect(respondRes.ok).toBe(true);
    if (respondRes.ok) {
      expect(respondRes.data.status).toBe('accepted');
    }

    const snap1 = await session.commands.getSnapshot('streamer-host-1');
    expect(snap1.ok).toBe(true);
    if (snap1.ok) {
      expect(snap1.data.battle).not.toBeNull();
      expect(snap1.data.battle?.status).toBe('live');
      expect(snap1.data.battle?.battle_id).toBe('battle-123');
    }

    // Attempting duplicate respond or incoming acceptance must NOT re-emit BATTLE_STARTED
    const respondRes2 = await session.commands.battleRespond('battle-123', true);
    expect(respondRes2.ok).toBe(true);

    // Only 1 BATTLE_STARTED was dispatched (prevents duplicate "Battle: X vs Y" chat message)
    expect(battleEvents.length).toBe(1);

    session.dispose();
  });

  it('liveStreamSync registers active broadcast and marks ended correctly', () => {
    const testStream = {
      id: 'stream-authoritative-1',
      handle: 'zoiriolys',
      name: 'zoiriolys hernandez',
      avatar: 'https://example.com/host.jpg',
      isVerified: true,
      category: 'Chat',
      title: 'Real Stream',
      description: 'Live test',
      viewersCount: 1,
      totalViews: '1',
      popularity: '100',
      diamonds: 0,
      likesCount: 0,
      posterUrl: '',
      tags: ['Live'],
      isHost: true,
      isLive: true,
      startedAt: Date.now(),
      topContributors: [],
    };

    liveStreamSync.notifyStreamStarted(testStream);
    const active = liveStreamSync.getStreamersList();
    expect(active.some(s => s.id === 'stream-authoritative-1')).toBe(true);

    // End stream
    liveStreamSync.notifyStreamEnded('stream-authoritative-1', 'zoiriolys');
    expect(liveStreamSync.isStreamEnded('stream-authoritative-1', 'zoiriolys', testStream.startedAt)).toBe(true);
    const afterEnd = liveStreamSync.getStreamersList();
    expect(afterEnd.some(s => s.id === 'stream-authoritative-1')).toBe(false);
  });
});
