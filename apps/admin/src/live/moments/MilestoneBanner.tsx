import React from 'react';
import { Sparkles, Trophy } from '../design/icons';
import './moments.css';

interface MilestoneBannerProps {
  type: 'supporter' | 'viewer';
  title: string;
  subtitle?: string;
}

export const MilestoneBanner: React.FC<MilestoneBannerProps> = ({
  type,
  title,
  subtitle,
}) => {
  return (
    <div className="live-milestone-banner" role="status" aria-live="polite">
      {type === 'supporter' ? (
        <Trophy size={15} color="#fbbf24" />
      ) : (
        <Sparkles size={15} color="#60a5fa" />
      )}
      <span>{title}</span>
      {subtitle && (
        <span style={{ color: 'var(--live-text-muted)', fontSize: '11px' }}>
          ({subtitle})
        </span>
      )}
    </div>
  );
};
