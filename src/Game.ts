import { sdk } from '@smoud/playable-sdk';
import * as Phaser from 'phaser';
import { OverlayScene } from './overlay/OverlayScene';
import { LoadingScreen } from './overlay/LoadingScreen';
import { showEndCard } from './overlay/EndCard';
import { Music } from './audio/Music';
import { sfx } from './audio/Sfx';
import { IslandScene } from './scenes/IslandScene';
import { resolveDebugStart, type DebugScene, type IslandStage } from './config/debugConfig';

/** Everything the coordinator needs from whichever 3D layer is active. */
interface PlayableScene {
  resize(width: number, height: number): void;
  /** Show the layer: the overlay has the screen covered, so it is safe to be looked at. */
  reveal?(): void;
  /** The fog is about to part: push the camera in behind it. */
  introZoom?(): void;
  /** The overlay has finished: start whatever the player is meant to watch. */
  begin?(): void;
  /** 0..1 while its models and textures decode, and the moment the last of them lands. */
  onLoadProgress?: (fraction: number) => void;
  onLoaded?: () => void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

/**
 * How long the opening will wait for the island before going anyway.
 *
 * Every asset is inlined in this one file, so "loading" is decode and upload rather than
 * network, and eight seconds is far beyond any device that can run the ad at all. It is here
 * for the case the arithmetic never completes — a loader that silently drops an item leaves the
 * queue one short and nothing else would ever release the fog. An ad stuck on its own loading
 * screen is the one failure that costs the whole impression, so it is worth the four lines.
 */
const LOAD_TIMEOUT = 8000;

export class Game {
  private overlay?: Phaser.Game; // absent on a debug start
  private island?: PlayableScene;
  private width: number;
  private height: number;
  private paused = false;
  private finished = false;
  private endCard?: Phaser.Game;
  private music = new Music();
  private loading?: LoadingScreen;
  /** The overlay's own "start thinning" function, held until the island is loaded. */
  private releaseFog?: () => void;
  private loaded = false;
  private handedOver = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Signal to the SDK that the playable is ready and the experience begins.
    sdk.start();

    // The track runs under everything, intro video included. It cannot actually sound until the
    // player touches the screen — see Music.start — so this is a request, not a guarantee.
    this.music.start();

    const debug = resolveDebugStart();
    if (debug.enabled) {
      console.log(
        `[debugStart] booting "${debug.scene}"${debug.scene === 'island' ? ` at stage "${debug.stage}"` : ''} — intro skipped`
      );
      void this.startDebugScene(debug.scene, debug.stage);
      return;
    }

    // Up FIRST, before anything that takes time to build: it is what the player looks at while
    // the island decodes, and a loading screen that appears after the loading has started has
    // missed the part it was for.
    this.loading = new LoadingScreen();

    // Start the 3D scene right away so it's already rendering (behind the video)
    // by the time the clouds part.
    this.island = new IslandScene(width, height);
    this.island.onLoadProgress = (fraction) => this.loading?.setProgress(fraction);
    this.island.onLoaded = () => this.markLoaded();
    // ...and a floor under it, so a load that never reports finished cannot strand the ad.
    window.setTimeout(() => this.markLoaded(), LOAD_TIMEOUT);

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
      // The fog is thinning and the world is coming through: push the camera in NOW, with the
      // whoosh, rather than at full coverage — a move started behind solid fog is half over
      // before it can be seen, so the sound arrived ahead of any visible zoom.
      onClearing: () => this.island?.introZoom?.(),
      // Clouds receded, world on screen: only NOW does the first beat run. The scene has been
      // rendering behind the intro all along, which is what makes the reveal instant, but its
      // opening choice used to be offered while the video still covered it.
      onDone: () => this.island?.begin?.(),
      // The fog is drawn and solid, and hands us the function that thins it. Kept rather than
      // called: it may arrive before the island has finished loading or after, and handOver is
      // what puts the two in order — see there.
      whenReady: (start: () => void) => {
        this.releaseFog = start;
        this.handOver();
      }
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
    // A debug start has no overlay at all, so nothing else will ever show or start it.
    scene.reveal?.();
    scene.begin?.();
    if (this.paused) scene.pause();
  }

  /**
   * Brand off, fog on: the one place the opening's two clocks are put in order.
   *
   * Two things have to have happened before the fog may thin, and they finish in either order —
   * the island's assets have to be in (or to have run out of time), and Phaser has to have booted
   * far enough to draw the fog and hand back the function that clears it. Whichever lands second
   * calls this, both are checked, and only then does the loading screen come off.
   *
   * The ORDER of the last two steps is the point. The loading screen is faded out first and the
   * fog released only once it is gone, because those are the only two things covering the island:
   * releasing the fog first would clear it behind a loading screen still on top, and the player
   * would meet the world already a second into its first beat.
   */
  private markLoaded(): void {
    this.loaded = true;
    this.handOver();
  }

  private handOver(): void {
    if (this.handedOver || !this.loaded || !this.releaseFog) return;
    this.handedOver = true;

    const start = this.releaseFog;
    const loading = this.loading;
    this.loading = undefined;
    if (loading) void loading.finish().then(start);
    else start(); // a debug start builds none
  }

  /** Called at full cloud coverage. The scene is already rendering underneath. */
  /**
   * Full coverage: the scene has been rendering all along, and now it can be SEEN. Until this
   * point its canvas is hidden, so a half-loaded island cannot appear in the gap between this
   * scene starting and the overlay booting.
   */
  private revealScene(): void {
    this.island?.reveal?.();
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
    this.music.pause();
    this.overlayScene?.setPaused(true);
    this.island?.pause();
  }

  public resume(): void {
    this.paused = false;
    this.music.resume();
    this.overlayScene?.setPaused(false);
    this.island?.resume();
  }

  public volume(value: number): void {
    this.music.setVolume(value);
    sfx.setVolume(value);
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
    // The end card is the network's moment, not the ad's: the track stops with the gameplay.
    this.music.stop();
    this.endCard = showEndCard(this.width, this.height);
    window.setTimeout(() => {
      this.island?.destroy();
      this.island = undefined;
    }, 1200);
  }
}