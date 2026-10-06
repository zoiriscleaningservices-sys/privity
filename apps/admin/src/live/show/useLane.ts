/**
 * React bindings for the Live Show Engine (useSyncExternalStore: tear-free, no extra renders).
 */

import { useSyncExternalStore } from 'react';
import { BattleView } from '../battle/deriveBattleView';
import { EffectPrefs, EffectsController } from './effects';
import { LiveShowEngine } from './LiveShowEngine';
import { ShowLane } from './scheduler';
import { ActiveMoment, ShowChatLine } from './types';

export function useLane(engine: LiveShowEngine, lane: ShowLane): ReadonlyArray<ActiveMoment> {
  return useSyncExternalStore(
    (fn) => engine.subscribeLane(lane, fn),
    () => engine.getLane(lane),
  );
}

export function useBattleView(engine: LiveShowEngine): BattleView {
  return useSyncExternalStore(
    (fn) => engine.subscribeBattleView(fn),
    () => engine.getView(),
  );
}

export function useShowChat(engine: LiveShowEngine): ReadonlyArray<ShowChatLine> {
  return useSyncExternalStore(
    (fn) => engine.subscribeChat(fn),
    () => engine.getChat(),
  );
}

export function useEffectPrefs(effects: EffectsController): EffectPrefs {
  return useSyncExternalStore(
    (fn) => effects.subscribe(fn),
    () => effects.getPrefs(),
  );
}
