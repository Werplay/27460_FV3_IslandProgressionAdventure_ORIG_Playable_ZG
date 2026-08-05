import { sdk } from '@smoud/playable-sdk';
import * as Phaser from 'phaser';
import { OverlayScene } from './overlay/OverlayScene';
import { showEndCard } from './overlay/EndCard';
import { IslandScene } from './scenes/IslandScene';
import { resolveDebugStart, type DebugScene, type IslandStage } from './config/debugConfig';

/** Everything the coordinator needs from whichever 3D layer is active. */
interface PlayableScene {
  resize(width: number, height: number): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export class Game {
  private overlay?: Phaser.Game; // absent on a debug start
  private island?: PlayableScene;
  private width: number;
  private height: number;
  private paused = false;
  private finished = false;
  private endCard?: Phaser.Game;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Signal to the SDK that the playable is ready and the experience begins.
    sdk.start();

    const debug = resolveDebugStart();
    if (debug.enabled) {
      console.log(
        `[debugStart] booting "${debug.scene}"${debug.scene === 'island' ? ` at stage "${debug.stage}"` : ''} — intro skipped`
      );
      void this.startDebugScene(debug.scene, debug.stage);
      return;
    }

    // Start the 3D scene right away so it's already rendering (behind the video)
    // by the time the clouds part.
    this.island = new IslandScene(width, height);

    // Callbacks the overlay scene fires as the transition progresses.
    // Set before boot so the scene can read them in create().
    this.overlay = new Phaser.Game({
      type: Phaser.AUTO,
      width,
      height,
      transparent: true, // let the Three.js canvas show through
      parent: document.body,
      scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
      scene: OverlayScene
    });
    this.overlay.registry.set('hooks', {
      onCovered: () => this.revealScene(),
      onDone: () => {}
    });

    // Keep the overlay canvas on top of the Three.js canvas.
    const canvas = this.overlay.canvas;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '10';
  }

  /**
   * Build the scene named by debugStart and adopt it as the active layer.
   * Farm/Scene3D are imported lazily so their models and textures only enter
   * the bundle in dev — `__DEV__` is false in release builds, so webpack drops
   * this whole branch (and everything it pulls in) from the shipped playable.
   */
  private async startDebugScene(name: DebugScene, stage: IslandStage): Promise<void> {
    let scene: PlayableScene;

    if (__DEV__ && name === 'farm') {
      const { FarmBoot } = await import('./farm/FarmBoot');
      scene = new FarmBoot(this.width, this.height);
    } else if (__DEV__ && name === 'scene3d') {
      const { Scene3D } = await import('./scenes/Scene3D');
      scene = new Scene3D(this.width, this.height);
    } else {
      scene = new IslandScene(this.width, this.height, stage);
    }

    // Lifecycle events can land while the dynamic import is in flight, so apply
    // whatever state accumulated in the meantime.
    if (this.finished) {
      scene.destroy();
      return;
    }
    this.island = scene;
    scene.resize(this.width, this.height);
    if (this.paused) scene.pause();
  }

  /** Called at full cloud coverage. The scene is already rendering underneath. */
  private revealScene(): void {
    // Scene is started in the constructor; nothing to build here yet.
  }

  private get overlayScene(): OverlayScene | undefined {
    return this.overlay?.scene.getScene('Overlay') as OverlayScene | undefined;
  }

  // --- SDK lifecycle events, forwarded to both layers ---

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.overlay?.scale.resize(width, height);
    this.endCard?.scale.resize(width, height);
    this.island?.resize(width, height);
  }

  public pause(): void {
    this.paused = true;
    this.overlayScene?.setPaused(true);
    this.island?.pause();
  }

  public resume(): void {
    this.paused = false;
    this.overlayScene?.setPaused(false);
    this.island?.resume();
  }

  public volume(value: number): void {
    this.overlayScene?.setVolume(value);
  }

  /**
   * The ad is over: up goes the end card.
   *
   * This is the SDK's own `finish` event, so it covers both ways in — the player tapping an
   * upgrade on the expansion beat (IslandScene calls sdk.finish) and the network ending the ad
   * itself. The 3D layer is torn down a beat LATER, not here: the card fades in over about
   * 450ms, and dropping the world first leaves a white flash under it.
   */
  public finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.overlay?.destroy(true); // the intro layer has done its job
    this.overlay = undefined;
    this.endCard = showEndCard(this.width, this.height);
    window.setTimeout(() => {
      this.island?.destroy();
      this.island = undefined;
    }, 1200);
  }
}