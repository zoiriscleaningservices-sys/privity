import React from 'react';
import { BattleView, formatBattleClock } from './deriveBattleView';
import { Flame, Radio } from '../design/icons';
import './battle.css';

interface BattleTimerProps {
  view: BattleView;
}

export const BattleTimer: React.FC<BattleTimerProps> = ({ view }) => {
  const { msRemaining, intensity, stage } = view;

  const isFinal = stage === 'FINAL_COUNTDOWN' || intensity >= 2;
  const timeFormatted = formatBattleClock(msRemaining);

  return (
    <div
      className={`live-battle-timer-badge ${isFinal ? 'urgency-final' : ''}`}
      aria-label={`Battle timer: ${timeFormatted}`}
      role="timer"
    >
      {isFinal ? (
        <Flame size={14} className="battle-timer-icon-flame" />
      ) : (
        <Radio size={12} className="battle-timer-icon-live" />
      )}
      <span className="live-battle-timer-digits">{timeFormatted}</span>
    </div>
  );
};
