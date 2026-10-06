import React from 'react';
import { GiftMomentPayload } from '../show/types';
import { Sparkles } from '../design/icons';
import './moments.css';

interface GiftAggregateToastProps {
  payload: {
    count: number;
    unique_senders: number;
    total_coins: number;
    top: GiftMomentPayload;
  };
}

export const GiftAggregateToast: React.FC<GiftAggregateToastProps> = ({ payload }) => {
  const { count, unique_senders, total_coins, top } = payload;

  return (
    <div className="live-moment-toast" role="status" style={{ border: '1px solid rgba(245, 158, 11, 0.4)' }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'var(--live-double-gradient)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#030407'
      }}>
        <Sparkles size={16} />
      </div>

      <div className="live-moment-details">
        <span className="live-moment-sender">
          {count} gifts from {unique_senders} supporters
        </span>
        <span className="live-moment-action">
          Total: <strong style={{ color: '#fbbf24' }}>{total_coins.toLocaleString()} coins</strong>
        </span>
      </div>

      {top?.gift?.icon_url && (
        <img src={top.gift.icon_url} alt="Top gift" className="live-moment-icon" />
      )}
    </div>
  );
};
