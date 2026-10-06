import React from 'react';
import { BattleView } from './deriveBattleView';
import './battle.css';

interface PullProgressProps {
  view: BattleView;
}

export const PullProgress: React.FC<PullProgressProps> = ({ view }) => {
  const { pull, scores } = view;
  if (!pull || pull.total <= 1) return null;

  const pullScores = scores.pulls || [];

  return (
    <div className="live-pull-progress" aria-label={`Round ${pull.current} of ${pull.total}`}>
      {Array.from({ length: pull.total }).map((_, idx) => {
        const pullNo = idx + 1;
        const pastScore = pullScores.find((p) => p.pull_no === pullNo);
        let dotClass = 'live-pull-dot';

        if (pastScore) {
          if (pastScore.a > pastScore.b) {
            dotClass += ' won-a';
          } else if (pastScore.b > pastScore.a) {
            dotClass += ' won-b';
          } else {
            dotClass += ' active';
          }
        } else if (pull.current === pullNo) {
          dotClass += ' active';
        }

        return (
          <div
            key={pullNo}
            className={dotClass}
            title={`Round ${pullNo}`}
          />
        );
      })}
    </div>
  );
};
