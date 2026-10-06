import React from 'react';
import { LiveShowEngine } from './LiveShowEngine';
import { useLane } from './useLane';
import { renderMoment } from './momentContent';
import '../moments/moments.css';

interface BannerHostProps {
  engine: LiveShowEngine;
}

/** Banner lane: one moment at a time, under the battle HUD. */
export const BannerHost: React.FC<BannerHostProps> = ({ engine }) => {
  const activeMoments = useLane(engine, 'banner');
  if (!activeMoments || activeMoments.length === 0) return null;
  const { moment } = activeMoments[0];
  return (
    <div className="live-banner-lane" aria-live="polite" key={moment.id}>
      {renderMoment(moment, 'banner')}
    </div>
  );
};
