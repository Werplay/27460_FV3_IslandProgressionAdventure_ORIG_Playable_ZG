export type DebugScene =
  | 'island' // src/scenes/IslandScene.ts — the clean ortho-isometric island (normal start)
  | 'farm' // src/farm/FarmBoot.ts — the full ported farm environment
  | 'scene3d'; // src/scenes/Scene3D.ts — the older perspective island

/**
 * Which beat of the island scene to open on, so a change to a late one can be
 * looked at without playing through the earlier four (about forty seconds of
 * tapping and walking). Each name is the beat as the player meets it:
 *
 *   rubble  the rocks round the pair — the normal start
 *   bridge  pulled up at the broken bridge, axe about to come up
 *   cow     across the water, at the stand penning the cow in
 *   farm    at the empty plots, crops about to be offered
 *   barn    at the leaning barn
 *   expansion  the pull-back at the end, with the arrows over what is still to build
 *
 * Everything earlier is applied to the world at once rather than played: the
 * rocks are gone, the bridge is whole, the stands are felled, the cow is free and
 * following, the wheat is up. See IslandScene.skipTo.
 */
export type IslandStage = 'rubble' | 'bridge' | 'cow' | 'farm' | 'barn' | 'expansion';

export const DEBUG_CONFIG = {

  debugStart: true,
  scene: 'island' as DebugScene,
  stage: 'expansion' as IslandStage
};


export interface DebugStart {
  enabled: boolean;
  scene: DebugScene;
  stage: IslandStage;
}

const SCENES: DebugScene[] = ['island', 'farm', 'scene3d'];
const STAGES: IslandStage[] = ['rubble', 'bridge', 'cow', 'farm', 'barn', 'expansion'];

function isDebugScene(value: string): value is DebugScene {
  return (SCENES as string[]).indexOf(value) !== -1;
}

function isIslandStage(value: string): value is IslandStage {
  return (STAGES as string[]).indexOf(value) !== -1;
}


export function resolveDebugStart(): DebugStart {
  const base: DebugStart = {
    enabled: DEBUG_CONFIG.debugStart,
    scene: DEBUG_CONFIG.scene,
    stage: DEBUG_CONFIG.stage
  };


  if (!__DEV__) return { enabled: false, scene: base.scene, stage: 'rubble' };

  const query = new URLSearchParams(window.location.search);

  // ?stage=barn on its own is enough — asking for a beat is asking to skip the
  // intro to get to it, so it turns the debug start on by itself.
  const asked = query.get('stage');
  if (asked !== null) {
    const stage = asked.toLowerCase();
    if (isIslandStage(stage)) {
      base.enabled = true;
      base.scene = 'island';
      base.stage = stage;
    } else {
      console.warn(`[debugStart] unknown stage "${asked}" — expected one of: ${STAGES.join(', ')}`);
    }
  }

  const param = query.get('debugStart');
  if (param === null) return base;

  const value = param.toLowerCase();
  if (value === '' || value === '1' || value === 'true') return { ...base, enabled: true };
  if (value === '0' || value === 'false') return { ...base, enabled: false };
  if (isDebugScene(value)) return { ...base, enabled: true, scene: value };

  console.warn(`[debugStart] unknown scene "${param}" — expected one of: ${SCENES.join(', ')}`);
  return base;
}
