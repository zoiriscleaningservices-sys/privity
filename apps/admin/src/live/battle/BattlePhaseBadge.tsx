import React from 'react';
import { BattleView } from './deriveBattleView';
import { Zap, AlertTriangle, Shield } from '../design/icons';
import './battle.css';

interface BattlePhaseBadgeProps {
  view: BattleView;
}

export const BattlePhaseBadge: React.FC<BattlePhaseBadgeProps> = ({ view }) => {
  const { bonus, msToBonus, bonusMsRemaining, bonusMultiplier, inBreak, stage } = view;

  if (stage === 'LOCKED') {
    return (
      <div className="live-battle-phase-badge locked">
        <Shield size={12} />
        <span>BATTLE LOCKED</span>
      </div>
    );
  }

  if (inBreak) {
    return (
      <div className="live-battle-phase-badge normal">
        <span>INTERMISSION</span>
      </div>
    );
  }

  if (bonus === 'active') {
    const sRem = Math.max(0, Math.ceil((bonusMsRemaining ?? 0) / 1000));
    return (
      <div className="live-battle-phase-badge double-active">
        <Zap size={12} fill="#030407" />
        <span>DOUBLE {bonusMultiplier}X · {sRem}s</span>
      </div>
    );
  }

  if (bonus === 'warning') {
    const sTo = Math.max(0, Math.ceil((msToBonus ?? 0) / 1000));
    return (
      <div className="live-battle-phase-badge double-warning">
        <AlertTriangle size={12} />
        <span>DOUBLE IN {sTo}s</span>
      </div>
    );
  }

  return (
    <div className="live-battle-phase-badge normal">
      <span>PK BATTLE</span>
    </div>
  );
};
