import React from 'react';
import { BattleView } from './deriveBattleView';
import { UserRef } from '../core/events';
import { Avatar } from '../ui/Avatar';
import './battle.css';

interface BattleIntroProps {
  view: BattleView;
  hostA?: UserRef | null;
  hostB?: UserRef | null;
}

/**
 * VS intro and 3-2-1 countdown. Timing is the server-compiled timeline (view.stage /
 * view.countdownValue come from deriveBattleView); nothing here runs its own timer.
 */
export const BattleIntro: React.FC<BattleIntroProps> = ({ view, hostA, hostB }) => {
  const { stage, countdownValue } = view;
  if (stage !== 'INTRO' && stage !== 'COUNTDOWN') return null;

  const side = (host: UserRef | null | undefined, s: 'a' | 'b') => (
    <div className={`plv-vs-side plv-vs-side--${s}`}>
      {host ? <Avatar user={host} size={84} ring={s} /> : <span className="plv-vs-empty" />}
      <span className="plv-vs-name">{host?.display_name || host?.handle || (s === 'a' ? 'Host' : 'Opponent')}</span>
      {host?.handle && <span className="plv-vs-handle">@{host.handle}</span>}
    </div>
  );

  return (
    <div className="plv-vs" role="dialog" aria-modal="false" aria-label={stage === 'COUNTDOWN' ? `Battle starts in ${countdownValue}` : 'Battle about to start'}>
      <div className="plv-vs-row">
        {side(hostA, 'a')}
        <div className="plv-vs-center" aria-live="assertive">
          {stage === 'COUNTDOWN' && countdownValue !== null ? (
            <span key={countdownValue} className="plv-vs-count">
              {countdownValue}
            </span>
          ) : (
            <span className="plv-vs-word">VS</span>
          )}
        </div>
        {side(hostB, 'b')}
      </div>
      <p className="plv-vs-caption">{stage === 'COUNTDOWN' ? 'Get ready — gifts count from the start' : 'LIVE Battle'}</p>
    </div>
  );
};
