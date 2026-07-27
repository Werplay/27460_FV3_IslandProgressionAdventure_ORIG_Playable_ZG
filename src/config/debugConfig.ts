/**
 * Debug boot options — skip the intro and drop straight into a 3D scene.
 *
 * Set `debugStart: true` and pick a `scene`, then refresh. The intro video and
 * the cloud-sweep transition are skipped entirely; the chosen scene renders
 * immediately with no overlay on top.
 *
 * Faster still, without editing this file, append a query param in dev:
 *   ?debugStart=island   ?debugStart=farm   ?debugStart=scene3d
 *   ?debugStart=1        use the `scene` configured below
 *   ?debugStart=0        force the normal intro even if debugStart is true
 *
 * DEV ONLY: production builds (`npm run build`) always play the full intro, so
 * a flag left on here can never ship. The farm/scene3d bundles are loaded
 * lazily inside a `__DEV__` branch, which webpack strips from release builds —
 * their models and textures stay out of the shipped playable.
 */

/** 3D layers the playable can boot into. */
export type DebugScene =
  | 'island' // src/scenes/IslandScene.ts — the clean ortho-isometric island (normal start)
  | 'farm' // src/farm/FarmBoot.ts — the full ported farm environment
  | 'scene3d'; // src/scenes/Scene3D.ts — the older perspective island

export const DEBUG_CONFIG = {
  /** true = skip the intro video + cloud wipe and boot straight into `scene`. */
  debugStart: true,

  /** Which scene `debugStart` boots into. */
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

/** Config value, overridden by the `?debugStart=` query param when in dev. */
export function resolveDebugStart(): DebugStart {
  const base: DebugStart = { enabled: DEBUG_CONFIG.debugStart, scene: DEBUG_CONFIG.scene };

  // Release builds ignore the flag outright — ad networks get the full intro.
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
