import React from 'react';
import { Zap, AlertTriangle } from '../design/icons';
import './moments.css';

interface DoubleBannerProps {
  status: 'warning' | 'active';
  multiplier?: number;
}

export const DoubleBanner: React.FC<DoubleBannerProps> = ({
  status,
  multiplier = 2,
}) => {
  if (status === 'warning') {
    return (
      <div
        className="live-double-banner"
        style={{ background: 'linear-gradient(90deg, #d97706, #f59e0b)', color: '#ffffff' }}
        role="status"
        aria-live="polite"
      >
        <AlertTriangle size={16} />
        <span>DOUBLE INCOMING! GET READY FOR {multiplier}X POINTS!</span>
      </div>
    );
  }

  return (
    <div className="live-double-banner" role="status" aria-live="polite">
      <Zap size={16} fill="#030407" />
      <span>DOUBLE ACTIVATED! ALL GIFTS COUNT {multiplier}X POINTS!</span>
    </div>
  );
};
