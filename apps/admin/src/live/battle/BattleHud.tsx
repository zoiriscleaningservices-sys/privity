import React from 'react';
import { BattleView } from './deriveBattleView';
import { BattleBar } from './BattleBar';
import { BattleTimer } from './BattleTimer';
import { BattlePhaseBadge } from './BattlePhaseBadge';
import { PullProgress } from './PullProgress';
import './battle.css';

interface BattleHudProps {
  view: BattleView;
  surgeSide?: 'a' | 'b' | null;
}

export const BattleHud: React.FC<BattleHudProps> = ({ view, surgeSide }) => {
  if (view.stage === 'IDLE') {
    return null;
  }

  return (
    <div className="live-battle-hud" aria-label="Battle status">
      {/* Top Meta Row: Phase Badge, Pull Dots, Timer */}
      <div className="live-battle-hud-top">
        <BattlePhaseBadge view={view} />
        <PullProgress view={view} />
        <BattleTimer view={view} />
      </div>

      {/* Signature Battle Bar */}
      <BattleBar view={view} surgeSide={surgeSide} />
    </div>
  );
};
