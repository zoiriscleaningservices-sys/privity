import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_ID = 'rnpjtailldnkwaglvdiu';
export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  `https://${SUPABASE_PROJECT_ID}.supabase.co`;

const STORAGE_ANON_KEY = 'privity_supabase_anon_key';

export const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_uFUkA9x1C2Zb-Lh_0-lzcw_RKWGKRCK';
export const DEFAULT_GOOGLE_CLIENT_ID = '723694367508-8h7rqo8gf2217ma8053hk5v1otqfdic1.apps.googleusercontent.com';

export function getSupabaseAnonKey(): string {
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  try {
    const saved = localStorage.getItem(STORAGE_ANON_KEY);
    if (saved && saved.trim().length > 0) return saved.trim();
  } catch {}
  return DEFAULT_PUBLISHABLE_KEY;
}

export function getGoogleClientId(): string {
  const envKey = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return DEFAULT_GOOGLE_CLIENT_ID;
}

export function saveSupabaseAnonKey(key: string) {
  try {
    if (key.trim()) {
      localStorage.setItem(STORAGE_ANON_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_ANON_KEY);
    }
  } catch {}
}

let clientInstance: SupabaseClient | null = null;
let currentKeyUsed: string = '';

export function getSupabaseClient(): SupabaseClient | null {
  const anonKey = getSupabaseAnonKey();
  if (!anonKey) return null;

  if (!clientInstance || currentKeyUsed !== anonKey) {
    try {
      clientInstance = createClient(SUPABASE_URL, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      currentKeyUsed = anonKey;
    } catch (err) {
      console.error('[Supabase] Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return clientInstance;
}

export const isSupabaseConfigured = (): boolean => {
  return Boolean(getSupabaseAnonKey());
};

let realtimeSyncChannel: any = null;
const broadcastListeners = new Set<(payload: any) => void>();
let isBroadcastAttached = false;
let reconnectTimer: any = null;

export function reconnectSupabaseRealtime(_force = false) {
  const sb = getSupabaseClient();
  if (!sb) return null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    if (realtimeSyncChannel) {
      try {
        sb.removeChannel(realtimeSyncChannel);
      } catch {}
      realtimeSyncChannel = null;
      isBroadcastAttached = false;
    }
    return getSupabaseRealtimeChannel();
  } catch (err) {
    console.warn('[Supabase Realtime] Reconnect failed:', err);
    return null;
  }
}

const chunkBuffers = new Map<string, { total: number; chunks: string[]; received: number; timer: any }>();

export function getSupabaseRealtimeChannel() {
  const sb = getSupabaseClient();
  if (!sb) return null;

  if (realtimeSyncChannel && (realtimeSyncChannel.state === 'closed' || realtimeSyncChannel.state === 'errored')) {
    try {
      sb.removeChannel(realtimeSyncChannel);
    } catch {}
    realtimeSyncChannel = null;
    isBroadcastAttached = false;
  }

  if (!realtimeSyncChannel) {
    try {
      realtimeSyncChannel = sb.channel('privity_sync_v370', {
        config: { broadcast: { self: false } },
      });

      realtimeSyncChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Connected to privity_sync_v370');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[Supabase Realtime] Channel status:', status, 'Scheduling auto-reconnect...');
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              reconnectSupabaseRealtime(true);
            }, 1200);
          }
        }
      });

      if (!isBroadcastAttached) {
        isBroadcastAttached = true;

        // 1. Single frame events
        realtimeSyncChannel.on('broadcast', { event: 'privity_event' }, ({ payload }: any) => {
          broadcastListeners.forEach((listener) => {
            try {
              listener(payload);
            } catch (err) {
              console.error('[Supabase Realtime] Listener error:', err);
            }
          });
        });

        // 2. Chunked streaming reassembly for large payloads (photos, videos, banners)
        realtimeSyncChannel.on('broadcast', { event: 'privity_chunk' }, ({ payload }: any) => {
          try {
            const { transferId, index, total, chunk } = payload || {};
            if (!transferId || total === undefined || index === undefined) return;

            let entry = chunkBuffers.get(transferId);
            if (!entry) {
              entry = {
                total,
                chunks: new Array(total).fill(''),
                received: 0,
                timer: setTimeout(() => {
                  chunkBuffers.delete(transferId);
                }, 45000),
              };
              chunkBuffers.set(transferId, entry);
            }

            if (!entry.chunks[index]) {
              entry.chunks[index] = chunk;
              entry.received++;
            }

            if (entry.received === entry.total) {
              clearTimeout(entry.timer);
              chunkBuffers.delete(transferId);
              const fullJson = entry.chunks.join('');
              const fullPayload = JSON.parse(fullJson);
              broadcastListeners.forEach((listener) => {
                try {
                  listener(fullPayload);
                } catch (err) {
                  console.error('[Supabase Realtime] Listener error:', err);
                }
              });
            }
          } catch (err) {
            console.error('[Supabase Realtime] Chunk assembly error:', err);
          }
        });
      }
    } catch (e) {
      console.warn('[Supabase Realtime] Failed to create channel:', e);
      return null;
    }
  }
  return realtimeSyncChannel;
}

export function broadcastViaSupabase(payload: any) {
  try {
    let ch = getSupabaseRealtimeChannel();
    if (!ch || ch.state === 'closed' || ch.state === 'errored') {
      ch = reconnectSupabaseRealtime(true);
    }
    if (ch) {
      const jsonStr = JSON.stringify(payload);
      // Small payloads (<= 28KB): send as single WebSocket frame
      if (jsonStr.length <= 28000) {
        ch.send({
          type: 'broadcast',
          event: 'privity_event',
          payload,
        });
      } else {
        // Large payloads (photos, videos, banners): chunk into 24KB slices to never exceed WebSocket limits
        const CHUNK_SIZE = 24000;
        const totalChunks = Math.ceil(jsonStr.length / CHUNK_SIZE);
        const transferId = 'tr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        for (let i = 0; i < totalChunks; i++) {
          const chunkData = jsonStr.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          ch.send({
            type: 'broadcast',
            event: 'privity_chunk',
            payload: {
              transferId,
              index: i,
              total: totalChunks,
              chunk: chunkData,
            },
          });
        }
      }
    }
  } catch (e) {
    console.warn('[Supabase Realtime] Broadcast failed:', e);
  }
}

export function onSupabaseBroadcast(callback: (payload: any) => void): () => void {
  broadcastListeners.add(callback);
  getSupabaseRealtimeChannel();
  return () => {
    broadcastListeners.delete(callback);
  };
}

// Auto-reconnect on Mobile OS and browser lifecycle events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Supabase Realtime] Network returned online -> Reconnecting channel');
    reconnectSupabaseRealtime(true);
  });
  window.addEventListener('pageshow', () => {
    console.log('[Supabase Realtime] Mobile pageshow -> Reconnecting channel');
    reconnectSupabaseRealtime(true);
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[Supabase Realtime] Mobile app visible -> Reconnecting channel');
        reconnectSupabaseRealtime(true);
      }
    });
  }
}


