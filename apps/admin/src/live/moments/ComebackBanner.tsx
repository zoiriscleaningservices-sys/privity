import React from 'react';
import { Side, UserRef } from '../core/events';
import { Flame } from '../design/icons';
import './moments.css';

interface ComebackBannerProps {
  side: Side;
  host: UserRef;
  deficitBefore: number;
  deficitAfter: number;
}

export const ComebackBanner: React.FC<ComebackBannerProps> = ({
  side,
  host,
  deficitBefore,
  deficitAfter,
}) => {
  const hostName = host.display_name || host.handle;
  const closedAmount = Math.max(0, deficitBefore - deficitAfter);

  return (
    <div className={`live-comeback-banner side-${side}`} role="status" aria-live="polite">
      <Flame size={16} fill="#ffffff" />
      <span>
        MASSIVE COMEBACK! {hostName.toUpperCase()} RECOVERED {closedAmount.toLocaleString()} POINTS!
      </span>
    </div>
  );
};
