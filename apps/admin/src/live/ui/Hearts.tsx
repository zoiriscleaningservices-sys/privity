import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Heart } from 'lucide-react';

export interface HeartCoords {
  x: number;
  y: number;
}

export interface HeartsHandle {
  burst(coords?: HeartCoords | null): void;
}

const MAX_HEARTS = 36;
const HUES = [338, 352, 12, 280, 262, 345, 18, 325];

interface ActiveHeart {
  id: number;
  x: number;
  y?: number;
  dx: number;
  hue: number;
  scale: number;
  isTap: boolean;
}

/**
 * Tap hearts & corner reaction stream.
 * Purely a local + synchronized reactive layer: bounded DOM, zero frame lag.
 */
export const HeartsLayer = forwardRef<HeartsHandle>(function HeartsLayer(_props, ref) {
  const [hearts, setHearts] = useState<ActiveHeart[]>([]);
  const seq = useRef(0);

  const burst = useCallback((coords?: HeartCoords | null) => {
    const id = ++seq.current;
    const isTap = coords != null && typeof coords.x === 'number' && typeof coords.y === 'number';
    const heart: ActiveHeart = isTap
      ? {
          id,
          x: Math.round(coords!.x),
          y: Math.round(coords!.y),
          dx: Math.round((Math.random() - 0.5) * 48),
          hue: HUES[id % HUES.length],
          scale: 0.95 + Math.random() * 0.45,
          isTap: true,
        }
      : {
          id,
          x: Math.round(Math.random() * 28 - 14),
          dx: 0,
          hue: HUES[id % HUES.length],
          scale: 0.85 + Math.random() * 0.4,
          isTap: false,
        };

    setHearts((list) => [...list.slice(-(MAX_HEARTS - 1)), heart]);
  }, []);

  useImperativeHandle(ref, () => ({ burst }), [burst]);

  return (
    <div className="plv-hearts" aria-hidden="true">
      {hearts.map((h) => (
        <span
          key={h.id}
          className={`plv-heart ${h.isTap ? 'plv-heart--tap' : 'plv-heart--rise'}`}
          style={{
            ...(h.isTap && h.y != null
              ? { left: `${h.x}px`, top: `${h.y}px` }
              : { ['--x' as string]: `${h.x}px` }),
            ['--dx' as string]: `${h.dx}px`,
            ['--h' as string]: h.hue,
            ['--s' as string]: h.scale,
          }}
          onAnimationEnd={() => setHearts((list) => list.filter((x) => x.id !== h.id))}
        >
          <Heart size={h.isTap ? 32 : 26} fill="currentColor" strokeWidth={0} />
        </span>
      ))}
    </div>
  );
});
