import React from 'react';
import { LiveShowEngine } from './LiveShowEngine';
import { useLane } from './useLane';
import { renderMoment } from './momentContent';
import '../moments/moments.css';

interface CornerHostProps {
  engine: LiveShowEngine;
}

/** Corner lane: small stacked toasts (max count set by the show config rhythm). */
export const CornerHost: React.FC<CornerHostProps> = ({ engine }) => {
  const activeMoments = useLane(engine, 'corner');
  if (!activeMoments || activeMoments.length === 0) return null;
  return (
    <div className="live-corner-lane" aria-live="polite">
      {activeMoments.map(({ moment }) => (
        <React.Fragment key={moment.id}>{renderMoment(moment, 'corner')}</React.Fragment>
      ))}
    </div>
  );
};
