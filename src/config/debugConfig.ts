export type DebugScene =
  | 'island' // src/scenes/IslandScene.ts — the clean ortho-isometric island (normal start)
  | 'farm' // src/farm/FarmBoot.ts — the full ported farm environment
  | 'scene3d'; // src/scenes/Scene3D.ts — the older perspective island

export const DEBUG_CONFIG = {

  debugStart: true,
  scene: 'island' as DebugScene
};

export interface DebugStart {
  enabled: boolean;
  scene: DebugScene;
}

const SCENES: DebugScene[] = ['island', 'farm', 'scene3d'];

function isDebugScene(value: string): value is DebugScene {
  return (SCENES as string[]).indexOf(value) !== -1;
}


export function resolveDebugStart(): DebugStart {
  const base: DebugStart = { enabled: DEBUG_CONFIG.debugStart, scene: DEBUG_CONFIG.scene };


  if (!__DEV__) return { enabled: false, scene: base.scene };

  const param = new URLSearchParams(window.location.search).get('debugStart');
  if (param === null) return base;

  const value = param.toLowerCase();
  if (value === '' || value === '1' || value === 'true') return { ...base, enabled: true };
  if (value === '0' || value === 'false') return { ...base, enabled: false };
  if (isDebugScene(value)) return { enabled: true, scene: value };

  console.warn(`[debugStart] unknown scene "${param}" — expected one of: ${SCENES.join(', ')}`);
  return base;
}
