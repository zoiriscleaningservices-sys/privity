/**
 * Effects — sound and haptics hooks for show moments.
 *
 * - Sound plays only after `unlockAudio()` has been called from a user gesture (browser
 *   autoplay policy) and only if the viewer has sound enabled.
 * - Haptics use the Vibration API where available (Android); a no-op elsewhere.
 * - Reduced motion is a VISUAL preference; components read it through `getPrefs()`.
 * - Preferences persist per device in localStorage.
 *
 * Sound assets are registered by name (`MomentSpec.sound`). Unknown names are ignored, so a
 * moment never fails because an asset is missing.
 */

import { HapticPattern } from './config';
import { AnyMoment } from './types';

export interface EffectPrefs {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
}

export interface SoundPlayer {
  unlock(): void;
  play(name: string): void;
}

export type VibrateFn = (pattern: number[]) => void;

export const HAPTIC_PATTERNS: Record<HapticPattern, number[]> = {
  tap: [12],
  success: [10, 40, 18],
  heavy: [28, 30, 60],
};

const PREFS_KEY = 'privity.live.effects.v1';

export function detectReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function loadEffectPrefs(): EffectPrefs {
  const fallback: EffectPrefs = { sound: true, haptics: true, reducedMotion: detectReducedMotion() };
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<EffectPrefs>;
    return {
      sound: typeof p.sound === 'boolean' ? p.sound : fallback.sound,
      haptics: typeof p.haptics === 'boolean' ? p.haptics : fallback.haptics,
      reducedMotion: typeof p.reducedMotion === 'boolean' ? p.reducedMotion : fallback.reducedMotion,
    };
  } catch {
    return fallback;
  }
}

export function saveEffectPrefs(prefs: EffectPrefs): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable (private mode / quota) — preferences stay in memory */
  }
}

export const browserVibrate: VibrateFn = (pattern) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
};

/** HTMLAudioElement-based player. `urls` maps sound names to asset URLs. */
export function createAudioSoundPlayer(urls: Record<string, string>, volume = 0.6): SoundPlayer {
  const cache = new Map<string, HTMLAudioElement>();
  let unlocked = false;
  const get = (name: string): HTMLAudioElement | null => {
    const url = urls[name];
    if (!url || typeof Audio === 'undefined') return null;
    let el = cache.get(name);
    if (!el) {
      el = new Audio(url);
      el.preload = 'auto';
      el.volume = volume;
      cache.set(name, el);
    }
    return el;
  };
  return {
    unlock() {
      unlocked = true;
      for (const name of Object.keys(urls)) get(name);
    },
    play(name) {
      if (!unlocked) return;
      const el = get(name);
      if (!el) return;
      try {
        el.currentTime = 0;
        void el.play().catch(() => undefined);
      } catch {
        /* playback refused by the browser — ignore */
      }
    },
  };
}

export interface EffectsOptions {
  player?: SoundPlayer | null;
  vibrate?: VibrateFn | null;
  prefs?: EffectPrefs;
  persist?: boolean;
}

export class EffectsController {
  private prefs: EffectPrefs;
  private audioUnlocked = false;
  private readonly listeners = new Set<() => void>();
  private readonly player: SoundPlayer | null;
  private readonly vibrate: VibrateFn | null;
  private readonly persist: boolean;

  constructor(opts: EffectsOptions = {}) {
    this.player = opts.player ?? null;
    this.vibrate = opts.vibrate === undefined ? browserVibrate : opts.vibrate;
    this.persist = opts.persist ?? true;
    this.prefs = opts.prefs ?? (this.persist ? loadEffectPrefs() : { sound: true, haptics: true, reducedMotion: false });
  }

  getPrefs(): EffectPrefs {
    return this.prefs;
  }

  setPrefs(patch: Partial<EffectPrefs>): void {
    this.prefs = { ...this.prefs, ...patch };
    if (this.persist) saveEffectPrefs(this.prefs);
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  get isAudioUnlocked(): boolean {
    return this.audioUnlocked;
  }

  /** Must be called from a user gesture handler (tap / click). */
  unlockAudio(): void {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    this.player?.unlock();
  }

  playFor(m: AnyMoment): void {
    const { sound, haptic } = m.effects;
    if (sound && this.prefs.sound && this.audioUnlocked) this.player?.play(sound);
    if (haptic && this.prefs.haptics) this.vibrate?.(HAPTIC_PATTERNS[haptic]);
  }
}
