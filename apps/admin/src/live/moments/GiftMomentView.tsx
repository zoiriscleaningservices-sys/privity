import React, { useState } from 'react';
import { Coins, Zap } from 'lucide-react';
import { GiftMomentPayload } from '../show/types';
import { Avatar } from '../ui/Avatar';
import './moments.css';

interface GiftMomentViewProps {
  payload: GiftMomentPayload;
  variant?: 'corner' | 'banner' | 'stage';
}

const EXCLUDED_TEXT = 'Sent as a LIVE gift — it did not affect the battle score.';

/**
 * Gift presentation. Values shown (coins, points, multiplier, D6 outcome) are exactly what the
 * server put in GIFT_RECEIVED. The stage variant plays the gift's configured animation asset
 * (e.g. the Legendary Dragon) and falls back to the icon if the video cannot play.
 */
export const GiftMomentView: React.FC<GiftMomentViewProps> = ({ payload, variant = 'corner' }) => {
  const { sender, gift, quantity, coin_value, multiplier, battle_outcome, battle_points } = payload;
  const senderName = sender.display_name || sender.handle;
  const isExcluded = battle_outcome === 'excluded';
  const counted = battle_outcome === 'counted' && battle_points > 0;
  const [videoFailed, setVideoFailed] = useState(false);

  if (variant === 'stage') {
    const playVideo = !!gift.animation_url && !videoFailed;
    return (
      <div className={`plv-legendary plv-legendary--${gift.rarity}`} role="alert" aria-live="assertive">
        <div className="plv-legendary-glow" aria-hidden="true" />
        <div className="plv-legendary-media">
          {playVideo ? (
            <video
              className="plv-legendary-video"
              src={gift.animation_url as string}
              autoPlay
              muted
              playsInline
              onError={() => setVideoFailed(true)}
              aria-hidden="true"
            />
          ) : (
            <img src={gift.icon_url} alt="" className="plv-legendary-icon" aria-hidden="true" />
          )}
        </div>
        <div className="plv-legendary-card">
          <Avatar user={sender} size={44} ring="gold" decorative />
          <div className="plv-legendary-text">
            <span className="plv-legendary-sender">{senderName}</span>
            <span className="plv-legendary-title">
              sent {quantity > 1 ? `${quantity}× ` : ''}
              {gift.name}
            </span>
            <span className="plv-legendary-value">
              <Coins size={13} aria-hidden="true" /> {coin_value.toLocaleString()} coins
              {counted && (
                <>
                  {' '}· +{battle_points.toLocaleString()} pts{multiplier > 1 ? ` (${multiplier}×)` : ''}
                </>
              )}
            </span>
            {isExcluded && <span className="live-gift-excluded-tag">{EXCLUDED_TEXT}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`live-moment-toast ${gift.rarity} ${variant === 'banner' ? 'plv-gift-banner' : ''}`} role="status">
      <Avatar user={sender} size={variant === 'banner' ? 36 : 32} decorative />
      <div className="live-moment-details">
        <span className="live-moment-sender">{senderName}</span>
        <span className="live-moment-action">
          sent {quantity > 1 ? `${quantity}× ` : ''}
          <strong className="plv-gift-name-strong">{gift.name}</strong>
          {counted && multiplier > 1 && (
            <span className="plv-mult-tag">
              <Zap size={10} aria-hidden="true" /> {multiplier}×
            </span>
          )}
        </span>
        {isExcluded && <span className="live-gift-excluded-tag">{EXCLUDED_TEXT}</span>}
      </div>
      <img src={gift.icon_url} alt="" className="live-moment-icon" aria-hidden="true" />
    </div>
  );
};
