import { memo } from 'react';
import type { LiveShowEngine } from '../show/LiveShowEngine';
import { useBattleView } from '../show/useLane';
import { BarFxHost } from '../show/BarFxHost';
import { BannerHost } from '../show/BannerHost';
import { CornerHost } from '../show/CornerHost';
import { StageHost } from '../show/StageHost';
import { BattleHud } from '../battle/BattleHud';

const HUD_STAGES = new Set(['INTRO', 'COUNTDOWN', 'ACTIVE', 'FINAL_COUNTDOWN', 'LOCKED']);

/**
 * Everything the Live Show Engine orchestrates, layered over the video:
 * battle HUD (authoritative scores), banner lane, corner lane and the full-stage lane.
 * Screens only decide WHERE the lanes sit (CSS variables), never WHAT plays or when.
 */
export const ShowOverlay = memo(function ShowOverlay({ engine }: { engine: LiveShowEngine }) {
  const view = useBattleView(engine);
  return (
    <>
      {HUD_STAGES.has(view.stage) && (
        <div className="plv-battle-slot">
          <BarFxHost engine={engine}>{(surge) => <BattleHud view={view} surgeSide={surge} />}</BarFxHost>
        </div>
      )}
      <BannerHost engine={engine} />
      <CornerHost engine={engine} />
      <StageHost engine={engine} />
    </>
  );
});
