import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_ID = 'rnpjtailldnkwaglvdiu';
export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  `https://${SUPABASE_PROJECT_ID}.supabase.co`;

const STORAGE_ANON_KEY = 'privity_supabase_anon_key';

export const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_uFUkA9x1C2Zb-Lh_0-lzcw_RKWGKRCK';

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
