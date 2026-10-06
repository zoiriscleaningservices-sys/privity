import React from 'react';
import { LiveShowEngine } from './LiveShowEngine';
import { useLane } from './useLane';
import { Side } from '../core/events';

interface BarFxHostProps {
  engine: LiveShowEngine;
  children: (surgeSide: Side | null) => React.ReactNode;
}

export const BarFxHost: React.FC<BarFxHostProps> = ({ engine, children }) => {
  const activeMoments = useLane(engine, 'bar_fx');

  let surgeSide: Side | null = null;
  if (activeMoments && activeMoments.length > 0) {
    const m = activeMoments[0].moment;
    if (m.key === 'bar_surge' || m.key === 'bar_tick') {
      surgeSide = (m.payload as { side: Side }).side;
    }
  }

  return <>{children(surgeSide)}</>;
};
