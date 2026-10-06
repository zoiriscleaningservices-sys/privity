import React, { useMemo } from 'react';
import { BattleView } from './deriveBattleView';
import { Crown, Zap } from '../design/icons';
import './battle.css';

interface BattleBarProps {
  view: BattleView;
  surgeSide?: 'a' | 'b' | null;
}

export const BattleBar: React.FC<BattleBarProps> = ({ view, surgeSide }) => {
  const { scores, shareA, leadSide, bonus, bonusMultiplier, intensity, stage } = view;

  const pctA = Math.round(shareA * 100);
  const pctB = 100 - pctA;

  const trackClasses = useMemo(() => {
    const list = ['live-battle-bar-track'];
    if (bonus === 'active') list.push('bonus-active');
    if (intensity > 0) list.push(`intensity-${intensity}`);
    if (surgeSide === 'a') list.push('surge-a');
    if (surgeSide === 'b') list.push('surge-b');
    return list.join(' ');
  }, [bonus, intensity, surgeSide]);

  return (
    <div className="live-battle-bar-container" role="progressbar" aria-valuenow={pctA} aria-valuemin={0} aria-valuemax={100}>
      <div className={trackClasses}>
        {/* Fill Side A */}
        <div
          className="live-battle-bar-fill-a"
          style={{ width: `${pctA}%` }}
        />

        {/* Divider Spark */}
        <div
          className="live-battle-bar-divider"
          style={{ left: `${pctA}%` }}
        />

        {/* Fill Side B */}
        <div
          className="live-battle-bar-fill-b"
          style={{ width: `${pctB}%` }}
        />

        {/* Score Overlay */}
        <div className="live-battle-bar-scores">
          {/* Side A Score */}
          <div className={`live-battle-score-pill ${leadSide === 'a' ? 'lead-a' : ''}`}>
            {leadSide === 'a' && <Crown size={14} className="crown-glow" />}
            <span>{scores.a.toLocaleString()}</span>
          </div>

          {/* Center Multiplier or Status */}
          {bonus === 'active' && (
            <div className="live-battle-bar-multiplier-pill" style={{
              background: 'var(--live-double-gradient)',
              color: '#030407',
              fontSize: '11px',
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              boxShadow: '0 0 10px rgba(245, 158, 11, 0.6)'
            }}>
              <Zap size={11} fill="#030407" />
              <span>{bonusMultiplier}X</span>
            </div>
          )}

          {stage === 'LOCKED' && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.85)',
              color: '#cbd5e1',
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              FINALIZING...
            </div>
          )}

          {/* Side B Score */}
          <div className={`live-battle-score-pill ${leadSide === 'b' ? 'lead-b' : ''}`}>
            <span>{scores.b.toLocaleString()}</span>
            {leadSide === 'b' && <Crown size={14} className="crown-glow" />}
          </div>
        </div>
      </div>
    </div>
  );
};
