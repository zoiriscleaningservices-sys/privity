import React from 'react';
import { LiveShowEngine } from './LiveShowEngine';
import { useBattleView, useLane } from './useLane';
import { MomentPayloads } from './types';
import { GiftMomentView } from '../moments/GiftMomentView';
import { BattleResults } from '../battle/BattleResults';
import { BattleIntro } from '../battle/BattleIntro';
import '../moments/moments.css';

interface StageHostProps {
  engine: LiveShowEngine;
  onDismissResults?: () => void;
}

/**
 * Full-stage lane: legendary gifts, battle intro / 3-2-1 countdown and battle results.
 * Exactly one stage moment is visible at a time; priority, cooldown and preemption are decided
 * by the engine's scheduler, never here.
 */
export const StageHost: React.FC<StageHostProps> = ({ engine, onDismissResults }) => {
  const activeMoments = useLane(engine, 'stage');
  const view = useBattleView(engine);

  if (!activeMoments || activeMoments.length === 0) {
    return null;
  }

  const { moment } = activeMoments[0];

  switch (moment.key) {
    case 'gift_legendary':
      return (
        <div className="live-stage-lane" aria-live="assertive">
          <GiftMomentView payload={moment.payload as MomentPayloads['gift_legendary']} variant="stage" />
        </div>
      );
    case 'battle_intro':
    case 'battle_countdown': {
      const room = engine.getRoom();
      const battle = room?.battle;
      return (
        <div className="live-stage-lane live-stage-lane--opaque" aria-live="assertive">
          <BattleIntro view={view} hostA={battle?.side_a.host} hostB={battle?.side_b.host} />
        </div>
      );
    }
    case 'battle_result': {
      const p = moment.payload as MomentPayloads['battle_result'];
      return (
        <div className="live-stage-lane live-stage-lane--opaque" aria-live="assertive">
          <BattleResults
            result={p.result}
            hostA={p.side_a?.host}
            hostB={p.side_b?.host}
            onDismiss={onDismissResults ?? (() => engine.dismiss(moment.id))}
          />
        </div>
      );
    }
    default:
      // live_ended: the screen itself switches to its ended state.
      return null;
  }
};
