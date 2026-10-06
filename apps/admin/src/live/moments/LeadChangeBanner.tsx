import React from 'react';
import { Side, UserRef } from '../core/events';
import { Crown, Flame } from '../design/icons';
import './moments.css';

interface LeadChangeBannerProps {
  leadSide: Side;
  leader?: UserRef | null;
  scoreA: number;
  scoreB: number;
  isFinalMoment?: boolean;
}

export const LeadChangeBanner: React.FC<LeadChangeBannerProps> = ({
  leadSide,
  leader,
  scoreA,
  scoreB,
  isFinalMoment = false,
}) => {
  const leaderName = leader?.display_name || (leadSide === 'a' ? 'Team A' : 'Team B');

  return (
    <div
      className={`live-lead-banner side-${leadSide}`}
      role="status"
      aria-live="polite"
    >
      {isFinalMoment ? (
        <Flame size={16} fill="#ffffff" />
      ) : (
        <Crown size={16} fill="#ffffff" />
      )}
      <span>
        {leaderName.toUpperCase()} TAKES THE LEAD! ({scoreA.toLocaleString()} - {scoreB.toLocaleString()})
      </span>
    </div>
  );
};
