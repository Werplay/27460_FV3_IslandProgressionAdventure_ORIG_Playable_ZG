// Phaser 2D overlay layer, rendered on a transparent canvas above the Three.js
// 3D scene. Owns the intro video and the cloud-sweep transition.
//
// Flow: play the intro video (muted autoplay, with a Skip button) -> on end,
// play the cloud spritesheet FORWARD to cover the screen -> at full coverage
// call `onCovered` (the coordinator drops the video and builds the 3D scene
// underneath) -> play the sheet in REVERSE so the clouds recede and reveal the
// 3D world -> call `onDone`.
import * as Phaser from 'phaser';
import introSrc from 'assets/videos/intro.mp4';
import cloudsSrc from 'assets/images/cloud-sweep_540x960_4x7.png';

// Cloud spritesheet: 4x4 grid of 540x960 frames. It is a one-way "cover"
// animation — frame 0 is transparent, frame 8 is fully opaque white (8-15 are
// identical holds). We play 0->8 to cover and 8->0 to reveal.
const CLOUD_FRAME_W = 540;
const CLOUD_FRAME_H = 960;
const CLOUD_PEAK = 8;
const CLOUD_FPS = 18;

const VIDEO_W = 1080; // intro.mp4 is 1080x1080 (fallback for cover-fit)
const VIDEO_H = 1080;

interface OverlayHooks {
  onCovered: () => void; // full coverage — swap intro -> 3D scene
  onDone: () => void; // clouds receded — overlay finished
}

export class OverlayScene extends Phaser.Scene {
  private hooks!: OverlayHooks;
  private video?: Phaser.GameObjects.Video;
  private clouds?: Phaser.GameObjects.Sprite;
  private skip?: Phaser.GameObjects.Text;
  private wiping = false;

  constructor() {
    super('Overlay');
  }

  preload(): void {
    this.load.spritesheet('clouds', cloudsSrc, {
      frameWidth: CLOUD_FRAME_W,
      frameHeight: CLOUD_FRAME_H
    });
  }

  create(): void {
    this.hooks = this.registry.get('hooks') as OverlayHooks;

    this.anims.create({
      key: 'cloud-cover',
      frames: this.anims.generateFrameNumbers('clouds', { start: 0, end: CLOUD_PEAK }),
      frameRate: CLOUD_FPS
    });
    this.anims.create({
      key: 'cloud-reveal',
      // reverse order: peak -> 0
      frames: this.anims.generateFrameNumbers('clouds', {
        frames: Array.from({ length: CLOUD_PEAK + 1 }, (_, i) => CLOUD_PEAK - i)
      }),
      frameRate: CLOUD_FPS
    });

    this.createVideo();
    this.createSkip();

    this.scale.on('resize', this.layout, this);
  }
  

  update(): void {
    // Re-cover the intro video every frame while it's on screen. When the video
    // texture loads, Phaser's setSizeToFrame() changes the object's intrinsic
    // width (256 -> 1080) but keeps scaleX, which balloons a single earlier fit.
    // setDisplaySize forces the correct display size for the *current* width, so
    // re-fitting each frame keeps it correct from first start — no resize needed.
    if (this.video && !this.wiping) {
      this.fitVideo();
    }
  }

  private createVideo(): void {
    const { width, height } = this.scale.gameSize;
    const Events = Phaser.GameObjects.Events;

    this.video = this.add.video(width / 2, height / 2).setDepth(0);
    // Muted autoplay is required by browser policy; SDK volume can unmute later.
    this.video.loadURL(introSrc, true);
    this.video.play(false);
    this.fitVideo();

    // Re-fit whenever the video's real dimensions become known or change.
    // (Native size can arrive at metadata, texture creation, or first play.)
    this.video.on(Events.VIDEO_METADATA, () => this.fitVideo());
    this.video.on(Events.VIDEO_TEXTURE, () => this.fitVideo());
    this.video.on(Events.VIDEO_PLAYING, () => this.fitVideo());
    // Advance to the game when the clip ends.
    this.video.on(Events.VIDEO_COMPLETE, () => this.startWipe());
    // If the source can't play at all, don't strand the user.
    this.video.on(Events.VIDEO_ERROR, () => this.startWipe());
    this.video.on(Events.VIDEO_UNSUPPORTED, () => this.startWipe());
  }

  private createSkip(): void {
    const { width } = this.scale.gameSize;
    this.skip = this.add
      .text(width - 16, 16, 'Skip ▸', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 12, y: 6 }
      })
      .setOrigin(1, 0)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });
    this.skip.on('pointerdown', () => this.startWipe());
  }

  /** Begin the cloud wipe: cover, swap underneath, then reveal. */
  private startWipe(): void {
    if (this.wiping) return;
    this.wiping = true;

    this.skip?.destroy();
    this.skip = undefined;

    const { width, height } = this.scale.gameSize;
    this.clouds = this.add.sprite(width / 2, height / 2, 'clouds', 0).setDepth(1);
    this.fitClouds();

    this.clouds.play('cloud-cover');
    this.clouds.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'cloud-cover', () => {
      // Screen is fully white: swap intro out and the 3D scene in, unseen.
      this.hooks.onCovered();
      this.video?.destroy();
      this.video = undefined;

      this.clouds?.play('cloud-reveal');
      this.clouds?.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'cloud-reveal', () => {
        this.clouds?.destroy();
        this.clouds = undefined;
        this.hooks.onDone();
      });
    });
  }

  /**
   * Scale an object so a WxH source covers the whole screen (crop to fill),
   * preserving aspect ratio and centering. Works for any screen size/aspect —
   * portrait, landscape, or square — and re-runs on every resize.
   */
  private cover(obj: Phaser.GameObjects.GameObject, srcW: number, srcH: number): void {
    const { width, height } = this.scale.gameSize;
    if (!srcW || !srcH || !width || !height) return; // avoid NaN before sizes exist
    const scale = Math.max(width / srcW, height / srcH);
    (obj as any).setDisplaySize(srcW * scale, srcH * scale);
    (obj as any).setPosition(width / 2, height / 2);
  }

  private fitVideo(): void {
    if (!this.video) return;
    // Prefer the real element dimensions; fall back to Phaser's, then to the
    // known intro size. This keeps the cover-fit correct even before the
    // texture is ready and after orientation changes.
    const el = this.video.video;
    const vw = (el && el.videoWidth) || this.video.width || VIDEO_W;
    const vh = (el && el.videoHeight) || this.video.height || VIDEO_H;
    this.cover(this.video, vw, vh);
  }

  private fitClouds(): void {
    if (!this.clouds) return;
    this.cover(this.clouds, CLOUD_FRAME_W, CLOUD_FRAME_H);
  }

  private layout(): void {
    this.fitVideo();
    this.fitClouds();
    if (this.skip) this.skip.setPosition(this.scale.gameSize.width - 16, 16);
  }

  // --- forwarded from the coordinator ---

  public setVolume(value: number): void {
    if (!this.video) return;
    this.video.setMute(value <= 0);
    this.video.setVolume(Math.max(0, Math.min(1, value)));
  }

  public setPaused(paused: boolean): void {
    if (paused) {
      this.video?.setPaused(true);
      this.anims.pauseAll();
    } else {
      this.video?.setPaused(false);
      this.anims.resumeAll();
    }
  }
}
