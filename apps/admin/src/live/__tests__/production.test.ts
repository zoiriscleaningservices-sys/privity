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
});
