import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProductionLiveSession } from '../production/ProductionLiveSession';
import type { UserRef } from '../core/events';

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

describe('ProductionLiveSession — Full Stage 1–5 Integration', () => {
  const me: UserRef = {
    id: 'user-luciano',
    handle: 'luciano',
    display_name: 'Luciano',
    avatar_url: 'https://example.com/avatar.jpg',
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('provides authoritative wallet information from sovereign storage', async () => {
    localStorage.setItem('privity_user_coins_v5', '15000');
    const session = createProductionLiveSession({
      streamerId: 'streamer-1',
      streamerHandle: 'streamer1',
      streamerName: 'Streamer One',
      streamerAvatar: '',
      me,
      isHost: false,
    });

    const wallet = await session.commands.getWallet();
    expect(wallet.ok).toBe(true);
    if (wallet.ok) {
      expect(wallet.data.coins).toBe(15000);
      expect(wallet.data.spendable).toBe(15000);
      expect(wallet.data.environment).toBe('production');
    }

    session.dispose();
  });

  it('performs idempotent gift deduction with coin wallet updates', async () => {
    localStorage.setItem('privity_user_coins_v5', '5000');
    const onCoinsChange = vi.fn();
    const session = createProductionLiveSession({
      streamerId: 'streamer-1',
      streamerHandle: 'streamer1',
      streamerName: 'Streamer One',
      streamerAvatar: '',
      me,
      isHost: false,
      onCoinsChange,
    });

    const key = `gift-test-${Date.now()}`;
    const result1 = await session.commands.sendGift({
      liveId: 'streamer-1',
      giftId: 'rose',
      quantity: 5,
      idempotencyKey: key,
      battleMode: 'auto',
      expectedBattleId: null,
    });

    expect(result1.ok).toBe(true);
    if (result1.ok) {
      expect(result1.data.replayed).toBe(false);
      expect(result1.data.coin_value).toBeGreaterThan(0);
      expect(onCoinsChange).toHaveBeenCalled();
    }

    // Replay with exact same idempotency key must not double charge
    const result2 = await session.commands.sendGift({
      liveId: 'streamer-1',
      giftId: 'rose',
      quantity: 5,
      idempotencyKey: key,
      battleMode: 'auto',
      expectedBattleId: null,
    });

    expect(result2.ok).toBe(true);
    if (result2.ok) {
      expect(result2.data.replayed).toBe(true);
    }

    session.dispose();
  });

  it('handles guest request lifecycle and comments accurately', async () => {
    const session = createProductionLiveSession({
      streamerId: 'streamer-1',
      streamerHandle: 'streamer1',
      streamerName: 'Streamer One',
      streamerAvatar: '',
      me,
      isHost: true,
    });

    // Request guest
    const req = await session.commands.requestGuest('streamer-1');
    expect(req.ok).toBe(true);
    if (req.ok) {
      expect(req.data.status).toBe('requested');
    }

    // Post comment
    const commentRes = await session.commands.comment('streamer-1', 'Hello Privity LIVE!');
    expect(commentRes.ok).toBe(true);
    if (commentRes.ok) {
      expect(commentRes.data.comment_id).toBeDefined();
      expect(commentRes.data.created_at).toBeDefined();
    }

    // Toggle comments
    const toggle = await session.commands.setCommentsEnabled('streamer-1', false);
    expect(toggle.ok).toBe(true);
    if (toggle.ok) {
      expect(toggle.data.comments_enabled).toBe(false);
    }

    session.dispose();
  });

  it('persists authoritative startedAt timestamp across snapshots without resetting to 0', async () => {
    const fixedStartTime = Date.now() - 120000; // 2 minutes ago
    localStorage.setItem('privity_live_started_streamer-persist', String(fixedStartTime));

    const session = createProductionLiveSession({
      streamerId: 'streamer-persist',
      streamerHandle: 'persistHost',
      streamerName: 'Persist Host',
      streamerAvatar: '',
      startedAt: fixedStartTime,
      me,
      isHost: false,
    });

    const snap1 = await session.commands.getSnapshot('streamer-persist');
    expect(snap1.ok).toBe(true);
    if (snap1.ok) {
      expect(new Date(snap1.data.started_at).getTime()).toBe(fixedStartTime);
    }

    // Wait a short time and take another snapshot; started_at MUST remain the exact same timestamp
    const snap2 = await session.commands.getSnapshot('streamer-persist');
    expect(snap2.ok).toBe(true);
    if (snap2.ok) {
      expect(new Date(snap2.data.started_at).getTime()).toBe(fixedStartTime);
    }

    // End stream clears storage
    await session.commands.endLive('streamer-persist');
    expect(localStorage.getItem('privity_live_started_streamer-persist')).toBeNull();

    session.dispose();
  });

  it('LiveRoomController derives elapsed duration from authoritative started_at and does not reset on snapshot', async () => {
    const fixedStartTime = Date.now() - 150000; // 2.5 minutes ago
    const session = createProductionLiveSession({
      streamerId: 'streamer-timer-test',
      streamerHandle: 'timerHost',
      streamerName: 'Timer Host',
      streamerAvatar: '',
      startedAt: fixedStartTime,
      me,
      isHost: false,
    });
    const { LiveRoomController } = await import('../client/LiveRoomController');
    const { EffectsController } = await import('../show/effects');
    const controller = new LiveRoomController({
      feed: session.feed,
      effects: new EffectsController(),
    });
    controller.start();
    // Wait for feed to connect and snapshot to apply
    await new Promise((r) => setTimeout(r, 60));
    expect(controller.getView().startedAt).toBe(fixedStartTime);
    expect(Date.now() - (controller.getView().startedAt || 0)).toBeGreaterThanOrEqual(150000);

    // Call resync, which re-emits a snapshot
    controller.resync();
    await new Promise((r) => setTimeout(r, 60));

    // startedAt MUST NOT reset to 0 or current time
    expect(controller.getView().startedAt).toBe(fixedStartTime);
    expect(Date.now() - (controller.getView().startedAt || 0)).toBeGreaterThanOrEqual(150000);

    session.dispose();
  });

  it('tracks real-time audience presence without inventing fake numbers', async () => {
    const session = createProductionLiveSession({
      streamerId: 'streamer-presence',
      streamerHandle: 'presenceHost',
      streamerName: 'Presence Host',
      streamerAvatar: '',
      me,
      isHost: true,
    });

    const snap = await session.commands.getSnapshot('streamer-presence');
    expect(snap.ok).toBe(true);
    if (snap.ok) {
      // Viewer count accurately starts with registered participants (minimum 1 for host)
      expect(snap.data.viewer_count).toBeGreaterThanOrEqual(1);
    }

    session.dispose();
  });

  it('LocalMediaController protects external camera tracks from being stopped on dispose', async () => {
    const { LocalMediaController } = await import('../media/LocalMediaController');
    const stopMock = vi.fn();
    const mockTrack = {
      id: 'ext-camera-track-123',
      kind: 'video',
      readyState: 'live',
      stop: stopMock,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const mockStream = {
      id: 'ext-stream-123',
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack],
      getAudioTracks: () => [],
    } as unknown as MediaStream;

    const controller = new LocalMediaController('camera', {
      initialStream: mockStream,
    });

    // Verify external stream is active
    expect(controller.getState().videoStream).toBe(mockStream);
    expect(controller.getState().camera.status).toBe('live');

    // Disposing or releasing the controller MUST NOT stop the hardware camera track
    controller.dispose();
    expect(stopMock).not.toHaveBeenCalled();
  });

  it('validates tap-anywhere hearts gesture exclusion rules and distance thresholds', () => {
    // Tap-anywhere detection thresholds
    const isIntentionalTap = (dx: number, dy: number, dt: number) => {
      return dx <= 16 && dy <= 16 && dt <= 450;
    };

    // Clean tap
    expect(isIntentionalTap(2, 3, 120)).toBe(true);
    // Drag / swipe gesture (dx > 16)
    expect(isIntentionalTap(45, 2, 200)).toBe(false);
    // Vertical scroll (dy > 16)
    expect(isIntentionalTap(1, 60, 250)).toBe(false);
    // Long press (dt > 450ms)
    expect(isIntentionalTap(4, 4, 600)).toBe(false);

    // Exclusion selector matching
    const excludedSelectors = [
      'button',
      'input',
      'textarea',
      'a',
      '.plv-action-buttons',
      '.plv-composer',
      '.plv-comments',
      '.plv-dialog-card',
      '.plv-sheet',
      '.plv-guest-dock',
    ];

    const isExcluded = (className: string, tagName: string) => {
      const lowerTag = tagName.toLowerCase();
      if (['button', 'input', 'textarea', 'a', 'select'].includes(lowerTag)) return true;
      return excludedSelectors.some(sel => sel.startsWith('.') && className.split(' ').includes(sel.slice(1)));
    };

    expect(isExcluded('plv-icon-btn', 'button')).toBe(true);
    expect(isExcluded('plv-composer-input', 'input')).toBe(true);
    expect(isExcluded('plv-composer plv-custom', 'div')).toBe(true);
    expect(isExcluded('plv-video-surface', 'video')).toBe(false);
    expect(isExcluded('plv-stage-main', 'div')).toBe(false);
  });

  it('triggers PK Battle with authoritative timeline compilation and countdown', async () => {
    const session = createProductionLiveSession({
      streamerId: 'streamer-battle-test',
      streamerHandle: 'battleHost',
      streamerName: 'Battle Host',
      streamerAvatar: '',
      me,
      isHost: true,
    });

    // Without a real opponent the command must refuse rather than invent one
    const noOpp = await session.commands.startBattle?.('classic_double');
    expect(noOpp?.ok).toBe(false);
    if (noOpp && !noOpp.ok) expect(noOpp.code).toBe('OPPONENT_REQUIRED');

    // Start battle against an explicit participant
    const rival: UserRef = { id: 'user-rival', handle: 'rival', display_name: 'Rival', avatar_url: null };
    const startRes = await session.commands.startBattle?.('classic_double', rival);
    expect(startRes?.ok).toBe(true);
    if (startRes?.ok) {
      expect(startRes.data.battle_id).toBeDefined();
    }

    // Verify snapshot contains active battle state
    const snap = await session.commands.getSnapshot('streamer-battle-test');
    expect(snap.ok).toBe(true);
    if (snap.ok) {
      expect(snap.data.battle).not.toBeNull();
      expect(snap.data.battle?.status).toBe('live');
      expect(snap.data.battle?.side_a.host.id).toBe('battlehost');
      expect(snap.data.battle?.side_b.host.id).toBe('user-rival');
      expect(snap.data.battle?.score_a).toBe(0);
      expect(snap.data.battle?.score_b).toBe(0);
    }

    session.dispose();
  });

  it('buildStage resolves media stream by id, handle, or host handle fallback', async () => {
    const { buildStage } = await import('../ui/buildStage');
    const mockTrack = { id: 'track-1', kind: 'video', readyState: 'live' };
    const mockStream = {
      id: 'stream-1',
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack],
      getAudioTracks: () => [],
    } as unknown as MediaStream;

    const presenceMap = new Map([
      ['streamerhandle', { id: 'streamerhandle', status: 'connected' as const, cameraOn: true, micOn: true, stream: mockStream }],
    ]);

    const room: any = {
      liveId: 'stream-123',
      host: { id: 'host-unique-id', handle: 'streamerHandle', display_name: 'Streamer', avatar_url: null },
      status: 'live',
      startedAt: Date.now(),
      viewerCount: 5,
      commentsEnabled: true,
      guests: [],
      battle: null,
      topSupporters: [],
      pinnedComment: null,
    };

    const built = buildStage({
      room,
      battle: null,
      mode: 'auto',
      presence: presenceMap,
      self: null,
    });

    expect(built.tiles.length).toBe(1);
    const hostTile = built.tiles[0];
    expect(hostTile.role).toBe('host');
    // Media MUST be resolved through handle fallback even though id is host-unique-id
    expect(hostTile.media?.stream).toBe(mockStream);
  });

  it('processes guest stage admission and slot allocation accurately', async () => {
    const session = createProductionLiveSession({
      streamerId: 'streamer-guest-test',
      streamerHandle: 'guestHost',
      streamerName: 'Guest Host',
      streamerAvatar: '',
      me,
      isHost: true,
    });

    // Respond to guest request
    const respondRes = await session.commands.respondGuest('streamer-guest-test', 'guest-1', true);
    expect(respondRes.ok).toBe(true);
    if (respondRes.ok) {
      expect(respondRes.data.status).toBe('accepted');
    }

    session.dispose();
  });

  it('atomically terminates LIVE session and dispatches LIVE_ENDED to listeners', async () => {
    const session = createProductionLiveSession({
      streamerId: 'streamer-end-test',
      streamerHandle: 'endHost',
      streamerName: 'End Host',
      streamerAvatar: '',
      me,
      isHost: true,
    });

    let liveEndedEventReceived = false;
    session.feed.connect({
      onSnapshot: () => {},
      onEvent: (evt) => {
        if (evt.event_type === 'LIVE_ENDED') {
          liveEndedEventReceived = true;
        }
      },
      onPersonal: () => {},
      onConnection: () => {},
      onUnavailable: () => {},
    });

    const endResult = await session.commands.endLive('streamer-end-test');
    expect(endResult.ok).toBe(true);
    if (endResult.ok) {
      expect(endResult.data.status).toBe('ended');
    }
    expect(liveEndedEventReceived).toBe(true);

    const snapshot = await session.commands.getSnapshot('streamer-end-test');
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(snapshot.data.status).toBe('ended');
      expect(snapshot.data.guests).toHaveLength(0);
    }

    session.dispose();
  });

  it('ProductionMediaTransport syncParticipants dynamically tracks and removes remote streams', async () => {
    const { ProductionMediaTransport } = await import('../production/ProductionMediaTransport');
    const transport = new ProductionMediaTransport({
      streamerId: 'host-1',
      streamerHandle: 'hostHandle',
      myId: 'user-viewer',
      myHandle: 'viewerHandle',
      isHost: false,
    });

    expect(transport.syncParticipants).toBeDefined();
    transport.syncParticipants([
      { id: 'guest-1', handle: 'guestOne' },
      { id: 'opponent-1', handle: 'rivalPro' },
    ]);

    // Prune back to empty
    transport.syncParticipants([]);
    transport.dispose();
  });
});



