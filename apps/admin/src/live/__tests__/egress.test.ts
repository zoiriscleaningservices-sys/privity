import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture everything that would be sent over the shared Supabase Realtime channel.
const sent: any[] = [];
vi.mock('../../services/supabaseClient', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    broadcastViaSupabase: (p: any) => sent.push(p),
    onSupabaseBroadcast: () => () => {},
    getSupabaseClient: () => null,
  };
});

import { sanitizeOutboundPayload } from '../../services/supabaseClient';
import { liveStreamSync } from '../../services/liveStreamSyncService';

describe('Supabase egress + privacy guards', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it('strips private account fields at any depth, keeps public ones', () => {
    const out: any = sanitizeOutboundPayload({
      action: 'SYNC_PROFILES_REGISTRY',
      registry: { alice: { handle: 'alice', name: 'Alice', email: 'alice@example.com' } },
      accounts: { alice: { email: 'alice@example.com' } },
      account: { handle: 'bob', email: 'bob@example.com', password: 'x', access_token: 't' },
      list: [{ email: 'c@example.com', handle: 'c' }],
    });
    expect(out.accounts).toBeUndefined();
    expect(out.registry.alice).toEqual({ handle: 'alice', name: 'Alice' });
    expect(out.account).toEqual({ handle: 'bob' });
    expect(out.list[0]).toEqual({ handle: 'c' });
    expect(JSON.stringify(out)).not.toContain('@example.com');
  });

  it('never sends camera preview frames through Supabase', () => {
    liveStreamSync.sendRoomEvent('hostA', { type: 'GUEST_LIVE_FRAME', guestHandle: 'g', frame: 'data:image/jpeg;base64,AAAA' });
    liveStreamSync.sendRoomEvent('hostA', { type: 'LIVE_FRAME', streamerId: 'hostA', frame: 'data:image/jpeg;base64,BBBB' });
    expect(sent.filter((p) => p?.action === 'ROOM_EVENT')).toHaveLength(0);
  });

  it('still delivers normal room events (comments, gifts, taps) through Supabase', () => {
    liveStreamSync.sendRoomEvent('hostA', { type: 'REACTION_SENT', count: 3, senderHandle: 'v' });
    const roomEvents = sent.filter((p) => p?.action === 'ROOM_EVENT');
    expect(roomEvents).toHaveLength(1);
    expect(roomEvents[0].streamId).toBe('hosta');
  });

  it('does not run the Supabase "who is live" query when no discovery screen is open', () => {
    liveStreamSync.queryNetworkStreams();
    expect(sent.filter((p) => p?.action === 'QUERY_ACTIVE_STREAMS')).toHaveLength(0);
  });
});
