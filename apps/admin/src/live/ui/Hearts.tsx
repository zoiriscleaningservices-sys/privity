import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Heart } from 'lucide-react';

export interface HeartsHandle {
  burst(): void;
}

const MAX_HEARTS = 14;
const HUES = [338, 352, 12, 280, 262];

/**
 * Tap hearts. Purely a local reaction: the S2 contract has no like/reaction RPC, so hearts
 * are drawn on this screen only and never presented as a count. Bounded DOM.
 */
export const HeartsLayer = forwardRef<HeartsHandle>(function HeartsLayer(_props, ref) {
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; hue: number; scale: number }>>([]);
  const seq = useRef(0);
  const burst = useCallback(() => {
    const id = ++seq.current;
    const heart = { id, x: Math.round(Math.random() * 28 - 14), hue: HUES[id % HUES.length], scale: 0.85 + Math.random() * 0.4 };
    setHearts((list) => [...list.slice(-(MAX_HEARTS - 1)), heart]);
  }, []);
  useImperativeHandle(ref, () => ({ burst }), [burst]);
  return (
    <div className="plv-hearts" aria-hidden="true">
      {hearts.map((h) => (
        <span
          key={h.id}
          className="plv-heart"
          style={{ ['--x' as string]: `${h.x}px`, ['--h' as string]: h.hue, ['--s' as string]: h.scale }}
          onAnimationEnd={() => setHearts((list) => list.filter((x) => x.id !== h.id))}
        >
          <Heart size={26} fill="currentColor" strokeWidth={0} />
        </span>
      ))}
    </div>
  );
});
