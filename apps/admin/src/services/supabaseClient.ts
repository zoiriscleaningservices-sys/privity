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

export function getSupabaseRealtimeChannel() {
  const sb = getSupabaseClient();
  if (!sb) return null;
  if (!realtimeSyncChannel) {
    try {
      realtimeSyncChannel = sb.channel('privity_sync_hub', {
        config: { broadcast: { self: false } },
      });
      realtimeSyncChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Connected to privity_sync_hub');
        }
      });
    } catch (e) {
      console.warn('[Supabase Realtime] Failed to create channel:', e);
      return null;
    }
  }
  return realtimeSyncChannel;
}

export function broadcastViaSupabase(payload: any) {
  try {
    const ch = getSupabaseRealtimeChannel();
    if (ch) {
      ch.send({
        type: 'broadcast',
        event: 'privity_event',
        payload,
      });
    }
  } catch (e) {
    console.warn('[Supabase Realtime] Broadcast failed:', e);
  }
}

export function onSupabaseBroadcast(callback: (payload: any) => void): () => void {
  try {
    const ch = getSupabaseRealtimeChannel();
    if (!ch) return () => {};
    ch.on('broadcast', { event: 'privity_event' }, ({ payload }: any) => {
      callback(payload);
    });
    return () => {};
  } catch {
    return () => {};
  }
}
