import { memo, useState } from 'react';
import type { UserRef } from '../core/events';

const HUES = [252, 280, 330, 12, 168, 200, 42];

function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

function initials(user: Pick<UserRef, 'display_name' | 'handle'>): string {
  const src = (user.display_name || user.handle || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return chars.toUpperCase();
}

/**
 * User avatar with a deterministic initials fallback (never a stand-in image that could be
 * mistaken for someone's photo or a gift).
 */
export const Avatar = memo(function Avatar({
  user,
  size = 36,
  ring,
  className,
  decorative = false,
}: {
  user: Pick<UserRef, 'id' | 'display_name' | 'handle' | 'avatar_url'>;
  size?: number;
  ring?: 'live' | 'a' | 'b' | 'gold';
  className?: string;
  /** True when a visible name sits next to the avatar (screen readers skip it). */
  decorative?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = !!user.avatar_url && !broken;
  const label = decorative ? undefined : user.display_name || `@${user.handle}`;
  return (
    <span
      className={`plv-avatar ${ring ? `plv-avatar--${ring}` : ''} ${className ?? ''}`}
      style={{ width: size, height: size, ['--plv-avatar-hue' as string]: hueFor(user.id) }}
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative || undefined}
    >
      {showImg ? (
        <img src={user.avatar_url as string} alt="" onError={() => setBroken(true)} draggable={false} />
      ) : (
        <span className="plv-avatar-initials" style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}>
          {initials(user)}
        </span>
      )}
    </span>
  );
});
