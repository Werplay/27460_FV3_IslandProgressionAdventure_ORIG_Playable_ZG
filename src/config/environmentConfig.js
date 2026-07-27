/**
 * Environment layout — the single place to set up the 3D scene.
 *
 * 1. Register the FBX in fbxModels.js (npm run base64 first)
 * 2. Add a prop entry below, or a grid entry for repeated models
 *
 * Props: single placed models (buildings, decorations, etc.)
 *   worldSize  — number (uniform), or per-axis in model local space (before rotation):
 *                { x, y, z }  — explicit axes
 *                { length, width, height }  — aliases for z, x, y (handy for roads)
 *                Omit an axis to leave it at 1. scaleMode is ignored when using an object.
 *   scaleMode  — for numeric worldSize only: 'max' | 'height'/'y' | 'x' | 'z' | 'xz'
 *   scale      — fixed uniform number, or { x, y, z } — skips worldSize/scaleMode
 * Map: textured ground plane (see textureKey in fbxTextures.js)
 * Grids: repeated models in rows/columns (crop plots, trees, etc.)
 *   rotation   — degrees { x, y, z }; merges with model placement defaults in fbxModels.js
 * Scatters: random clones within a bounds box (flowers, trees, bushes, etc.)
 *   layer: 'decal' (flowers) | 'vegetation' (trees/bushes)
 *   placement: 'random' | 'perimeter' | 'ring'
 */
export const ENVIRONMENT_CONFIG = {
  // World-space nudge (3D axes). Usually keep at zero.
  containerOffset: { x: 0, y: 0, z: 0 },
  // Screen-space nudge in pixels — positive y moves the farm down on screen.
  containerScreenOffset: { x: 0, y: 100 },

  // Keep the playable farm cluster clear for trees/bushes.
  excludeRects: [
    { minX: -9, maxX: 5, minZ: -11, maxZ: 5 },
  ],

  farmCenter: { x: -4, z: -1 },

  map: {
    textureKey: 'ground3',
    worldSize: 48, // finite island land; water fills around it
    position: { x: 0, y: 0, z: 0 },
    flipY: true,
  },

  props: [
    {
      id: 'bakery',
      modelKey: 'bakery',
      position: { x: 1, y: 0, z: -2.5 },
      worldSize: 2.2,
    },
    {
      id: 'cowShed',
      modelKey: 'cowShed',
      position: { x: -3.5, y: 0, z: -7 },
      rotation: { x: 0, y: 180, z: 0 },
      worldSize: 3.5,
    },
    {
      id: 'silo',
      modelKey: 'silo',
      position: { x: -8.3, y: 0, z: -6.8 },
      rotation: { x: 0, y: 200, z: 0},
      worldSize: 2.3,
    },
    {
      id: 'merryweatherClassic',
      modelKey: 'merryweatherClassic',
      position: { x: -9, y: 0.1, z: -4.5 },
      rotation: { x: 0, y: 90, z: 0 },
      worldSize: 0.02,
    },
    {
      id: 'chickenCoop',
      modelKey: 'chickenCoop',
      position: { x: -7, y: 0, z: -1.5 },
      rotation: { x: 0, y: 0, z: 0 },
      worldSize: 3.4,
    },

    {
      id: 'chickenLeghorn',
      modelKey: 'chickenLeghorn',
      position: { x: -7, y: 0.12, z: -1.5 },
      rotation: { x: 0, y: 90, z: 0},
      worldSize: 0.01,
    },

    {
      id: 'feedMaker',
      modelKey: 'feedMaker',
      position: { x: -9, y: 0, z: -10 },
      rotation: { x: -90, y: 0, z: 0 },
      worldSize: 0.02,
    },
    {
      id: 'cowAngus',
      modelKey: 'cowAngus',
      position: { x: -3, y: 0.1, z: -6.5 },
      rotation: { x: 0, y: -90, z: 0},
      worldSize: 0.02,
    },
    // farmHouse omitted — its model is .fbx (can't inline). See fbxModels.js.
    // {
    //   id: 'farmHouse',
    //   modelKey: 'farmHouse',
    //   position: { x: -10.5, y: 0, z: -7 },
    //   rotation: { x: 0, y: 360, z: 0 },
    //   worldSize: 3,
    // },
    {
      id: 'road',
      modelKey: 'road',
      position: { x: -11, y: 0, z: -4.5 },
      rotation: { x: 0, y: 90, z: 0 },
      worldSize: 13,
    },
    {
      id: 'road1',
      modelKey: 'road',
      position: { x: -3.5, y: 0, z: 3 },
      rotation: { x: 0, y: 180, z: 0 },
      worldSize: 13,
    },

    {
      id: 'road2',
      modelKey: 'road',
      position: { x: -3.5, y: 0, z: 14 },
      rotation: { x: 0, y: 180, z: 0 },
      worldSize: 13,
    },
    // {
    //   id: 'road2',
    //   modelKey: 'road',
    //   position: { x: -1, y: 0, z: 0 },
    //   rotation: { x: 0, y: 0, z: 0 },
    //   worldSize: 17,
    //   scaleMode: 'z',
    // },

    {
      id: 'roadCorner',
      modelKey: 'roadCorner',
      position: { x: -3.78, y: 0.01, z: -4.2 },
      rotation: { x: -180, y: 90, z: 0 },
      worldSize: 1.8,
      scaleMode: 'z',
    },

    {
      id: 'lamp',
      modelKey: 'lamp',
      position: { x: -11.3, y: 0.2, z: -5.7 },
      rotation: { x: 0, y: 0, z: 0 },
      worldSize: 1.4,
    },
    {
      id: 'scarecrow',
      modelKey: 'scarecrow',
      position: { x: 0, y: 0.2, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      worldSize: 1.4,
    },
    {
      id: 'rubblePath',
      modelKey: 'rubblePath',
      position: { x: -10.5, y: 0, z: -5.7 },
      rotation: { x: 0, y: 0, z: 0 },
      worldSize: 1,
    },
    {
      id: 'dairyFactory',
      modelKey: 'dairyFactory',
      position: { x: -6.3, y: 0, z: -7.2 },
      rotation: { x: 0, y: -180, z: 0 },
      worldSize: 1.5,
    },
    {
      id: 'milkJug',
      modelKey: 'milkJug',
      position: { x: -6.5, y: 0, z: -6.2 },
      rotation: { x: 0, y: -180, z: 0 },
      worldSize: 0.5,
    },
    {
      id: 'milkJug1',
      modelKey: 'milkJug',
      position: { x: -6.1, y: 0, z: -6.2 },
      rotation: { x: 0, y: -180, z: 0 },
      worldSize: 0.5,
    },

    // --- New imports (dummy placement — adjust position/rotation/size as needed) ---
    {
      id: 'classicLivinghouseFiller1',
      modelKey: 'classicLivinghouseFiller1',
      position: { x: -8, y: 0, z: -8 },
      worldSize: 0.8,
    },
    {
      id: 'countyFairBoardCrateApple',
      modelKey: 'countyFairBoardCrateApple',
      position: { x: 2, y: 0, z: 0 },
      worldSize: 1,
    },
    {
      id: 'desertStation',
      modelKey: 'desertStation',
      position: { x: 5, y: 0, z: -10 },
      rotation: { x: 0, y: 90, z: 0 },
      worldSize: 3,
    },
    {
      id: 'jamStation',
      modelKey: 'jamStation',
      position: { x: 2, y: 0, z: -6 },
      rotation: { x: 0, y: 10, z: 0 },
      worldSize: 0.08,
    },
    {
      id: 'mailbox',
      modelKey: 'mailbox',
      position: { x: -10, y: 0, z: 8 },
      rotation: { x: 0, y: 180, z: 0 },
      worldSize: 1,
    },

    {
      id: 'pigHabitatAbandoned',
      modelKey: 'pigHabitatAbandoned',
      position: { x: -11, y: 0, z: 2 },
      rotation: { x: 0, y: 90, z: 0 },
      worldSize: 3.5,
    },
    {
      id: 'sawmill',
      modelKey: 'sawmill',
      position: { x: -14, y: -0.2, z: 4 },
      rotation: { x: 0, y: 90, z: 0 },
      worldSize: 2.5,
    },
    {
      id: 'vanAbandoned',
      modelKey: 'vanAbandoned',
      position: { x: -1.2, y: 0, z: 3 },
      rotation: { x: 0, y: 90, z: 0 },
      worldSize: 2,
    },
    {
      id: 'victorianBarnLvl3',
      modelKey: 'victorianBarnLvl3',
      position: { x: -5, y: 0, z: -12 },
      rotation: { x: 0, y: 180, z: 0 },
      worldSize: 4,
    },
    {
      id: 'wellLv1',
      modelKey: 'wellLv1',
      position: { x: -7, y: 0, z: 2.5 },
      rotation: { x: 0, y: 180, z: 0 },
      worldSize: 2.5,
    },
    {
      id: 'windmill',
      modelKey: 'windmill',
      position: { x: -11, y: 0, z: -2 },
      rotation: { x: 0, y: 90, z: 0 },
      worldSize: 3.5,
    },
    {
      id: 'windChime',
      modelKey: 'windChime',
      position: { x: -12.5, y: 0, z: -6.5 },
      worldSize: 2,
    },

    // --- Decorative accents ---
    {
      id: 'flowerKangaroo',
      modelKey: 'flowerKangaroo',
      position: { x: -8.6, y: 0, z: -2.4 },
      rotation: { x: 0, y: -20, z: 0 },
      worldSize: 1.7,
    },
    {
      id: 'campTent',
      modelKey: 'tent',
      position: { x: -17.6, y: 0, z: -6 },
      rotation: { x: 0, y: 180, z: 0 },
      worldSize: 2.3,
    },
    {
      id: 'campBonfire',
      modelKey: 'bonfire',
      position: { x: -17.6, y: 0, z: -4.5 },
      rotation: { x: 0, y: 15, z: 0 },
      worldSize: 1.1,
    },
    {
      id: 'rocksByWell',
      modelKey: 'rocks',
      position: { x: -5.6, y: 0, z: 3.1 },
      rotation: { x: 0, y: 55, z: 0 },
      worldSize: 0.9,
    },
    {
      id: 'rocksByWell2',
      modelKey: 'rocks',
      position: { x: -5.1, y: 0, z: 2.4 },
      rotation: { x: 0, y: -30, z: 0 },
      worldSize: 1.5,
    },
    {
      id: 'rocksBySawmill',
      modelKey: 'rocks',
      position: { x: 7.2, y: 0, z: -3.8 },
      rotation: { x: 0, y: 110, z: 0 },
      worldSize: 3.5,
    },
  ],

  grids: [
    {
      id: 'wheatField',
      modelKey: 'plotWheat',
      count: 16,
      columns: 4,
      rows: 4,
      position: { x: 2.5, y: 0, z: 3.5},
      cellWorldSize: 1.2,
      spacing: 1.2,
    },

    // Wheat crop pen — white fence on three sides; west side open toward the path
    {
      id: 'wheatFenceSouth',
      modelKey: 'woodenFenceWhiteStraight',
      count: 4,
      columns: 5,
      rows: 1,
      position: { x: 2.8, y: 0, z: 0.8 },
      cellWorldSize: 0.6,
      spacing: 1.2,
    },
    {
      id: 'wheatFenceNorth',
      modelKey: 'woodenFenceWhiteStraight',
      count: 5,
      columns: 5,
      rows: 1,
      position: { x: 2.5, y: 0, z: 6.3 },
      cellWorldSize: 0.6,
      spacing: 1.0,
    },
    {
      id: 'wheatFenceEast',
      modelKey: 'woodenFenceWhiteStraight',
      count: 4,
      columns: 1,
      rows: 4,
      position: { x: 5.05, y: 0, z: 3.5 },
      rotation: { z: 90 },
      cellWorldSize: 0.6,
      spacing: 1.0,
    },
    {
      id: 'wheatFenceWest',
      modelKey: 'woodenFenceWhiteStraight',
      count: 3,
      columns: 1,
      rows: 3,
      position: { x: -0.05, y: 0, z: 4.85 },
      rotation: { z: 90 },
      cellWorldSize: 0.6,
      spacing: 1.0,
    },

    // Cow shed pen — fenced yard around the shed and grazing cow
    {
      id: 'cowPenFenceSouth',
      modelKey: 'woodenFenceWhiteStraight',
      count: 5,
      columns: 5,
      rows: 1,
      position: { x: -3.5, y: 0, z: -8.75 },
      cellWorldSize: 0.5,
      spacing: 1.0,
    },
    {
      id: 'cowPenFenceNorth',
      modelKey: 'woodenFenceWhiteStraight',
      count: 5,
      columns: 5,
      rows: 1,
      position: { x: -3.5, y: 0, z: -5.25 },
      cellWorldSize: 0.5,
      spacing: 1.0,
    },
    {
      id: 'cowPenFenceEast',
      modelKey: 'woodenFenceWhiteStraight',
      count: 4,
      columns: 1,
      rows: 4,
      position: { x: -1.15, y: 0, z: -7 },
      rotation: { z: 90 },
      cellWorldSize: 0.5,
      spacing: 1.0,
    },
    // {
    //   id: 'cowPenFenceWest',
    //   modelKey: 'woodenFenceWhiteStraight',
    //   count: 3,
    //   columns: 1,
    //   rows: 3,
    //   position: { x: -5.85, y: 0, z: -6.35 },
    //   rotation: { z: 90 },
    //   cellWorldSize: 1.0,
    //   spacing: 1.0,
    // },

    // Chicken coop — compact fence ring
    {
      id: 'chickenCoopFenceSouth',
      modelKey: 'woodenFenceWhiteStraight',
      count: 3,
      columns: 4,
      rows: 1,
      position: { x: -7, y: 0, z: -3.15 },
      cellWorldSize: 0.6,
      spacing: 0.9,
    },
    {
      id: 'chickenCoopFenceNorth',
      modelKey: 'woodenFenceWhiteStraight',
      count: 3,
      columns: 4,
      rows: 1,
      position: { x: -6.5, y: 0, z: 0.15 },
      cellWorldSize: 0.6,
      spacing: 1.1,
    },
    // {
    //   id: 'chickenCoopFenceEast',
    //   modelKey: 'woodenFenceWhiteStraight',
    //   count: 4,
    //   columns: 1,
    //   rows: 4,
    //   position: { x: -5.35, y: 0, z: -1.5 },
    //   rotation: { z: 90 },
    //   cellWorldSize: 0.6,
    //   spacing: 0.9,
    // },
    {
      id: 'chickenCoopFenceWest',
      modelKey: 'woodenFenceWhiteStraight',
      count: 2,
      columns: 1,
      rows: 3,
      position: { x: -8.65, y: 0, z: -0.75 },
      rotation: { z: 90 },
      cellWorldSize: 0.6,
      spacing: 0.9,
    },
  ],

  scatters: [
    {
      id: 'flowersGrowing',
      modelKey: 'flowersGrowing',
      count: 100,
      seed: 42,
      layer: 'decal',
      avoidPlacement: false,
      worldSize: 2,
      bounds: { minX: -18, maxX: 10, minZ: -18, maxZ: 18 },
      position: { x: 0, y: 0.045, z: 0 },
      rotationY: { min: 0, max: 360 },
    },
    {
      id: 'grassPatches',
      modelKeys: ['grassSmall', 'grassMedium', 'grassBig', 'grassFancy'],
      seed: 77,
      layer: 'decal',
      avoidPlacement: true,
      bounds: { minX: -18, maxX: 10, minZ: -18, maxZ: 18 },
      position: { x: 0, y: -0.02, z: 0 },
    },
    {
      id: 'rockScatter',
      modelKey: 'rocks',
      seed: 311,
      layer: 'decal',
      avoidPlacement: true,
      placement: 'ring',
      farmCenter: { x: -2, z: -1 },
      innerRadius: 6.5,
      outerRadius: 15.5,
      bounds: { minX: -17, maxX: 10, minZ: -16, maxZ: 16 },
      position: { x: 0, y: 0.02, z: 0 },
    },
    {
      id: 'flowerGrassScatter',
      modelKey: 'flowerGrass',
      seed: 412,
      layer: 'decal',
      avoidPlacement: true,
      placement: 'ring',
      farmCenter: { x: -2, z: -1 },
      innerRadius: 5,
      outerRadius: 13.5,
      bounds: { minX: -17, maxX: 10, minZ: -16, maxZ: 16 },
      position: { x: 0, y: 0.04, z: 0 },
    },
    {
      id: 'farmPerimeterTrees',
      modelKeys: [
        'acacia',
        'birchTree',
        'treeDense',
        'treeRound',
        'almondTreeStage',
        'appleTreeStage',
        'lemonTreeStage',
      ],
      count: 100,
      seed: 300,
      layer: 'vegetation',
      placement: 'ring',
      farmCenter: { x: -2, z: -1 },
      innerRadius: 12,
      outerRadius: 18,
      bounds: { minX: -17, maxX: 11, minZ: -17, maxZ: 17 },
      worldSize: { min: 2.8, max: 4.2 },
      scaleMode: 'height',
      minSpacing: 2.2,
      renderOrder: 1.5,
      rotationY: { min: 150, max: 180 },
    },
    {
      id: 'farmBushes',
      modelKeys: ['bushDark', 'bushLight'],
      count: 60,
      seed: 202,
      layer: 'vegetation',
      placement: 'ring',
      farmCenter: { x: 0, z: 0 },
      innerRadius: 7,
      outerRadius: 8.5,
      bounds: { minX: -17, maxX: 11, minZ: -17, maxZ: 17 },
      worldSize: { min: 0.9, max: 1.5 },
      scaleMode: 'max',
      minSpacing: 1.6,
      renderOrder: 1.5,
      rotationY: { min: 0, max: 100 },
    },
  ],
};

// --- Temporary: hide all buildings/structures for now ---
// Keeps animals, character, roads, nature, grass, and fences. Delete this block
// to bring the buildings back.
const HIDDEN_BUILDING_IDS = new Set([
  'bakery',
  'cowShed',
  'silo',
  'chickenCoop',
  'feedMaker',
  'dairyFactory',
  'classicLivinghouseFiller1',
  'desertStation',
  'jamStation',
  'pigHabitatAbandoned',
  'sawmill',
  'victorianBarnLvl3',
  'wellLv1',
  'windmill',
]);

ENVIRONMENT_CONFIG.props = ENVIRONMENT_CONFIG.props.filter(
  (prop) => !HIDDEN_BUILDING_IDS.has(prop.id)
);
