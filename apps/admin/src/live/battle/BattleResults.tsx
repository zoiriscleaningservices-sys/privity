import React from 'react';
import { Crown, Gift, Repeat, Users } from 'lucide-react';
import { BattleResult, UserRef } from '../core/events';
import { Avatar } from '../ui/Avatar';
import './battle.css';

interface BattleResultsProps {
  result: BattleResult;
  hostA?: UserRef | null;
  hostB?: UserRef | null;
  onDismiss: () => void;
}

/** Final result card. Every number is from the server's BATTLE_RESULT. */
export const BattleResults: React.FC<BattleResultsProps> = ({ result, hostA, hostB, onDismiss }) => {
  const { winner_side, final_a, final_b, pull_wins, stats } = result;
  const isDraw = winner_side === null;
  const winner = winner_side === 'a' ? hostA : winner_side === 'b' ? hostB : null;

  const side = (host: UserRef | null | undefined, s: 'a' | 'b', score: number) => {
    const won = winner_side === s;
    return (
      <div className={`plv-res-side plv-res-side--${s} ${won ? 'is-winner' : ''}`}>
        <div className="plv-res-avatar">
          {won && <Crown size={22} className="plv-res-crown" aria-label="Winner" />}
          {host ? <Avatar user={host} size={64} ring={s} decorative /> : null}
        </div>
        <span className="plv-res-name">{host?.display_name || (s === 'a' ? 'Host' : 'Opponent')}</span>
        <span className="plv-res-score plv-num">{score.toLocaleString()}</span>
      </div>
    );
  };

  return (
    <div className="plv-results" role="dialog" aria-modal="false" aria-labelledby="plv-results-title">
      <div className="plv-results-card">
        <h2 id="plv-results-title" className="plv-results-title">
          {isDraw ? "It's a draw" : `${winner?.display_name || (winner_side === 'a' ? 'Host' : 'Opponent')} wins`}
        </h2>
        <div className="plv-res-row">
          {side(hostA, 'a', final_a)}
          <span className="plv-res-vs">{pull_wins ? `${pull_wins.a} – ${pull_wins.b}` : 'vs'}</span>
          {side(hostB, 'b', final_b)}
        </div>
        {pull_wins && <p className="plv-res-note">Rounds won</p>}

        {stats.top_supporters.length > 0 && (
          <div className="plv-res-supporters">
            <span className="plv-res-label">Top supporters</span>
            <ol>
              {stats.top_supporters.slice(0, 3).map((s) => (
                <li key={`${s.side}:${s.user.id}`} className={`plv-res-supporter plv-res-supporter--${s.side}`}>
                  <Avatar user={s.user} size={28} decorative />
                  <span className="plv-res-supporter-name">{s.user.display_name || s.user.handle}</span>
                  <span className="plv-num">{s.points.toLocaleString()} pts</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="plv-res-stats">
          <span>
            <Gift size={14} aria-hidden="true" /> {stats.total_gifts.toLocaleString()} gifts
          </span>
          <span>
            <Repeat size={14} aria-hidden="true" /> {stats.lead_changes} lead changes
          </span>
          {stats.peak_viewers != null && (
            <span>
              <Users size={14} aria-hidden="true" /> {stats.peak_viewers.toLocaleString()} peak
            </span>
          )}
        </div>
        {stats.biggest_gift && (
          <p className="plv-res-biggest">
            Biggest gift: {stats.biggest_gift.gift.name} from {stats.biggest_gift.sender.display_name || `@${stats.biggest_gift.sender.handle}`} (
            {stats.biggest_gift.coin_value.toLocaleString()} coins)
          </p>
        )}
        <button type="button" className="plv-btn plv-btn--iris plv-btn--block" onClick={onDismiss} id="plv-results-continue">
          Continue
        </button>
      </div>
    </div>
  );
};
