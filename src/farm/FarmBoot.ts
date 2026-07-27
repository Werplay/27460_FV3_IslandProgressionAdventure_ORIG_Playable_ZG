// Dedicated Phaser.Game that hosts the ported farm environment.
// It decodes the base64 textures/models in a Preloader scene, then a Farm scene
// builds the Three.js ThreeSceneManager (which owns its own canvas, inserted as
// document.body.firstChild so it renders beneath our overlay).
import * as Phaser from 'phaser';
import { LoadBase64Textures } from '../utils/LoadBase64Textures.js';
import { LoadBase64FBX } from '../utils/LoadBase64FBX.js';
import { FBX_TEXTURES } from '../config/fbxTextures.js';
import { FBX_MODELS } from '../config/fbxModels.js';
import * as THREE from 'three';
import { ThreeSceneManager } from '../three/ThreeSceneManager.js';
import { createIslandWater } from '../three/IslandWater.js';

class FarmPreloader extends Phaser.Scene {
  constructor() {
    super('FarmPreload');
  }

  create(): void {
    LoadBase64Textures(this, FBX_TEXTURES)
      .then(() => LoadBase64FBX(this, FBX_MODELS))
      .then(() => this.scene.start('Farm'))
      .catch((err: unknown) => {
        console.error('Farm asset decode failed:', err);
      });
  }
}

class FarmScene extends Phaser.Scene {
  public three?: ThreeSceneManager;
  private water?: { group: any; update: (s: number) => void };
  private startMs = 0;

  constructor() {
    super('Farm');
  }

  create(): void {
    this.three = new ThreeSceneManager(this);
    this.three.setup();

    // Sky-blue background so any far gap beyond the water reads as sky, not the
    // white page.
    this.three.threeScene.background = new THREE.Color(0x8fd6f2);

    // Turn the flat farm ground into an island: beach skirt + toon water added
    // to the same group as the ground so they shift together. islandHalf matches
    // half the ground worldSize (48 / 2 = 24). viewDir matches the camera angle.
    this.water = createIslandWater({
      islandHalf: 24,
      sunDir: [10, 40, 10],
      viewDir: [1, 1.4, 1]
    });
    this.three.environmentGroup.add(this.water.group);
    this.startMs = performance.now();
  }

  update(_time: number, delta: number): void {
    if (!this.three) return;
    this.water?.update((performance.now() - this.startMs) / 1000);
    this.three.update(delta);
    this.three.render();
  }
}

export class FarmBoot {
  private game: Phaser.Game;

  constructor(width: number, height: number) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      width,
      height,
      transparent: true,
      parent: document.body,
      scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
      scene: [FarmPreloader, FarmScene]
    });
  }

  private get farmScene(): FarmScene | undefined {
    return this.game.scene?.getScene('Farm') as FarmScene | undefined;
  }

  private get three(): ThreeSceneManager | undefined {
    return this.farmScene?.three;
  }

  public resize(width: number, height: number): void {
    this.game.scale.resize(width, height);
    const three = this.three;
    if (!three) return;
    const rect = this.game.scale.canvas.getBoundingClientRect();
    three.resize(width, height, rect, {});
  }

  public pause(): void {
    const scene = this.farmScene;
    if (scene) this.game.scene.pause('Farm');
  }

  public resume(): void {
    const scene = this.farmScene;
    if (scene) this.game.scene.resume('Farm');
  }

  public destroy(): void {
    this.game.destroy(true);
  }
}
