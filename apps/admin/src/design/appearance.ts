/**
 * Privity appearance (Light / Dark / System).
 *
 * Light Liquid Glass is the default. The preference persists per device and is applied to
 * <html data-theme> before React renders, so there is no flash of the wrong theme.
 */
export type AppearancePref = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'privity_appearance';
const listeners = new Set<(pref: AppearancePref, theme: ResolvedTheme) => void>();

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function getAppearance(): AppearancePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return 'light';
}

export function resolveTheme(pref: AppearancePref = getAppearance()): ResolvedTheme {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
}

export function applyAppearance(pref: AppearancePref = getAppearance()): ResolvedTheme {
  const theme = resolveTheme(pref);
  if (typeof document !== 'undefined') {
    const el = document.documentElement;
    el.dataset.theme = theme;
    el.style.colorScheme = theme;
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme === 'light' ? '#F7F8FC' : '#05070c';
  }
  return theme;
}

/** Persists and applies the preference. Returns the theme actually applied. */
export function setAppearance(pref: AppearancePref): ResolvedTheme {
  try {
    localStorage.setItem(KEY, pref);
  } catch {}
  const theme = applyAppearance(pref);
  listeners.forEach((fn) => fn(pref, theme));
  return theme;
}

export function subscribeAppearance(fn: (pref: AppearancePref, theme: ResolvedTheme) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Call once at startup: applies the stored preference and follows OS changes in System mode. */
export function initAppearance(): void {
  applyAppearance();
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getAppearance() === 'system') {
        const theme = applyAppearance('system');
        listeners.forEach((fn) => fn('system', theme));
      }
    });
  } catch {}
}
