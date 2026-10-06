import { ReactNode, useEffect } from 'react';
import type { EffectsController } from '../show/effects';
import { useEffectPrefs } from '../show/useLane';
import '../design/tokens.css';
import '../design/motion.css';
import './live.css';

/**
 * Root of every LIVE screen: design tokens, scoped reduced-motion (OS setting OR in-app
 * preference), safe areas, and audio unlock on the first gesture (autoplay policy).
 */
export function LiveFrame({
  effects,
  variant,
  children,
  label,
}: {
  effects: EffectsController;
  variant: 'viewer' | 'host';
  children: ReactNode;
  label: string;
}) {
  const prefs = useEffectPrefs(effects);
  useEffect(() => {
    if (effects.isAudioUnlocked) return;
    const unlock = () => effects.unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [effects]);
  return (
    <main className={`plv-root plv-screen plv-screen--${variant}`} data-reduced-motion={prefs.reducedMotion ? 'true' : undefined} aria-label={label}>
      {children}
    </main>
  );
}
