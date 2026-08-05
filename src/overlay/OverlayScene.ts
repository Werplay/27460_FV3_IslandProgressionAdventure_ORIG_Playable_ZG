// Phaser 2D overlay layer, rendered on a transparent canvas above the Three.js
// 3D scene. Owns the intro video and the transition out of it.
//
// Flow: play the intro video (muted autoplay, with a Skip button) -> on end, roll FOG in from
// both sides until it meets in the middle and covers the screen -> at full coverage call
// `onCovered` (the coordinator drops the video; the 3D scene has been rendering underneath all
// along) -> roll the fog back out to reveal the world -> call `onDone`.
//
// The fog is DRAWN HERE, into a canvas texture, not loaded: it replaced a 540x960 sixteen-frame
// cloud spritesheet that cost 629 KB on disk and about 840 KB inlined as a data URI. A gradient
// with a few dozen soft blobs torn out of its leading edge reads as fog at any screen size, and
// it costs nothing.
import * as Phaser from 'phaser';
import introSrc from 'assets/videos/intro.mp4';

/**
 * The fog: how it is drawn, and how it moves.
 *
 * Two banks, one per side, each wider than the screen so that when they meet their SOLID parts
 * overlap rather than their soft edges — two soft edges meeting in the middle would leave a
 * translucent seam down it, and the swap underneath would show through.
 */
const FOG = {
  texture: { width: 512, height: 512, solid: 0.58, puffs: 34, bite: 22 },
  // Each bank as a multiple of the screen's width. It travels EXACTLY its own width and no
  // further: a bank's outer edge is hard (the texture is opaque there), so overshooting drags
  // that edge into view as a straight vertical band with clear screen beside it. At a travel of
  // exactly one width the outer edge lands on the screen's edge, and coverage comes instead
  // from `solid` — 0.58 of a 1.4-wide bank is 0.81 of the screen opaque from each side.
  bank: { width: 1.4, stagger: 0.06 }, // stagger: each layer's y offset, in screen heights
  /**
   * Three layers a side, and every one of them moves, grows, drifts and FADES on its own clock.
   *
   * Two rigid banks translating in read as slabs sliding across, whatever the texture on them
   * looks like — the eye follows the hard front. Fog does not arrive, it thickens: so each layer
   * comes in on a different lead and speed (`lead`), swells as it comes (`grow`), slides a
   * little vertically (`drift`), and rises from nothing to its own opacity, so the density
   * builds where it stands rather than being carried in.
   */
  layers: [
    { alpha: 0.95, scale: 1, lead: 0, grow: 1.08, drift: -0.04 },
    { alpha: 0.8, scale: 1.18, lead: 0.16, grow: 1.14, drift: 0.05 },
    { alpha: 0.65, scale: 1.35, lead: 0.34, grow: 1.2, drift: -0.02 }
  ],
  /**
   * ...and puffs blooming across the middle at the same time, growing from nothing where they
   * stand. This is what stops the whole thing reading as two things meeting: fog appears in the
   * middle of the screen as well as travelling into it.
   */
  bloom: { count: 11, size: 0.62, grow: 2.1, alpha: 0.85, spread: 0.72 },
  cover: 1050, // ms until the screen is solid
  hold: 180, // ...held while the intro is swapped out behind it
  clear: 1100, // ...and to thin back out
  // How far into that thinning the world is actually LEGIBLE, and so the moment anything meant
  // to ride the reveal (the camera push-in and its whoosh) should start. Not zero: the banks
  // hold for `hold`, their tweens are staggered by up to a quarter of `clear` on top, and the
  // ease is Sine.easeIn — so for the first half-second after full coverage the screen is still
  // solid fog and a move started there is half over before anyone can see it.
  reveal: 520,
  // How long BEFORE the video ends the fog starts. The clip keeps playing behind it, so the
  // player never sees it stop: by the time the last frame goes by, the fog is most of the way in
  // and the swap happens inside it. Waiting for the end event instead put a visible beat of
  // finished video on screen — the moment the ad looks like it has two halves.
  //
  // Kept under `cover` on purpose: much more and the fog is solid while there is still video
  // worth watching underneath it.
  lead: 800
};

const VIDEO_W = 1080; // intro.mp4 is 1080x1080 (fallback for cover-fit)
const VIDEO_H = 1080;

interface OverlayHooks {
  onCovered: () => void; // full coverage — swap intro -> 3D scene
  onClearing: () => void; // fog thinning and the world showing through — see FOG.reveal
  onDone: () => void; // clouds receded — overlay finished
}

export class OverlayScene extends Phaser.Scene {
  private hooks!: OverlayHooks;
  private video?: Phaser.GameObjects.Video;
  private fog: Phaser.GameObjects.Image[] = [];
  private skip?: Phaser.GameObjects.Text;
  private wiping = false;

  constructor() {
    super('Overlay');
  }

  create(): void {
    this.hooks = this.registry.get('hooks') as OverlayHooks;

    this.drawFog();
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

      // Start the transition a beat BEFORE the clip runs out. Driven off the playback position
      // rather than a timer set when it began: a video that stalls or buffers would leave a timer
      // running ahead of the picture and fog the screen over a clip still mid-scene.
      const duration = this.video.getDuration();
      if (duration > 0 && this.video.getCurrentTime() >= duration - FOG.lead / 1000) {
        this.startWipe();
      }
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
    // A backstop: update() normally starts the transition FOG.lead before this fires. This
    // catches a clip whose duration never became known, so the fog still comes in.
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

  /**
   * One bank of fog, drawn into a canvas texture: solid at its outer edge, fading towards the
   * leading one, with blobs torn out of that edge and wisps scattered ahead of it. Drawn once —
   * both banks share it, the right-hand one flipped.
   */
  private drawFog(): void {
    if (this.textures.exists('fog')) return;
    const { width: w, height: h, solid, puffs, bite } = FOG.texture;
    const canvas = this.textures.createCanvas('fog', w, h);
    const ctx = canvas?.getContext();
    if (!canvas || !ctx) return;

    // The same hash the 3D scene uses, so the shape is fixed rather than different every run.
    const at = (i: number, salt: number) => {
      const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    const blob = (x: number, y: number, r: number, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.75})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(solid, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Wisps ahead of the edge, so the fog arrives before its front does.
    for (let i = 0; i < puffs; i++) {
      const x = w * (solid + at(i, 3) * (1 - solid) * 1.05);
      blob(x, h * at(i, 5), w * (0.06 + at(i, 7) * 0.1), 0.4 + at(i, 9) * 0.35);
    }
    // ...and bites out of it, so the front is ragged rather than a straight gradient.
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < bite; i++) {
      const x = w * (solid * 0.75 + at(i, 11) * (1 - solid * 0.75));
      blob(x, h * at(i, 13), w * (0.05 + at(i, 17) * 0.09), 0.75);
    }
    ctx.globalCompositeOperation = 'source-over';
    canvas.refresh();

    // One soft blob on its own, for the puffs that bloom mid-screen.
    const puff = this.textures.createCanvas('fogPuff', 256, 256);
    const pctx = puff?.getContext();
    if (!puff || !pctx) return;
    const g = pctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    pctx.fillStyle = g;
    pctx.fillRect(0, 0, 256, 256);
    puff.refresh();
  }

  /** Thicken the fog in, swap the intro out behind it, then let it thin back out. */
  private startWipe(): void {
    if (this.wiping) return;
    this.wiping = true;

    this.skip?.destroy();
    this.skip = undefined;

    const { width, height } = this.scale.gameSize;
    const bankWidth = width * FOG.bank.width;
    const at = (i: number, salt: number) => {
      const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };

    this.fog = [];
    // Every layer gets its OWN tween rather than one tween over all of them with per-index
    // values. That indexed form is what hid a sign error last time: the banks slid off their own
    // edges of the screen and, because a finished video stops rendering, the cut still "worked".
    const settle: Array<{ image: Phaser.GameObjects.Image; x: number }> = [];
    let last = 0;

    FOG.layers.forEach((layer, depth) => {
      [-1, 1].forEach((side) => {
        const home = side < 0 ? 0 : width;
        const image = this.add
          .image(home, height / 2 + depth * height * FOG.bank.stagger, 'fog')
          .setOrigin(side < 0 ? 1 : 0, 0.5)
          .setDisplaySize(bankWidth * layer.scale, height * 1.02 * layer.scale)
          .setAlpha(0)
          .setDepth(1 - depth * 0.01)
          .setFlipX(side > 0) // the leading edge faces the middle on both sides
          // ...and the right bank is flipped VERTICALLY too: both share one texture, so
          // mirroring alone lined their torn edges up and left a seam down the middle.
          .setFlipY(side > 0);
        this.fog.push(image);
        settle.push({ image, x: home });

        // It arrives, swells and thickens at once, on its own clock.
        const travel = FOG.cover * (1 - layer.lead * 0.35);
        const delay = FOG.cover * layer.lead * 0.5;
        last = Math.max(last, delay + travel);
        this.tweens.add({
          targets: image,
          x: home - side * bankWidth,
          y: image.y + height * layer.drift,
          alpha: layer.alpha,
          scaleX: image.scaleX * layer.grow,
          scaleY: image.scaleY * layer.grow,
          duration: travel,
          delay,
          ease: 'Sine.easeInOut'
        });
      });
    });

    // ...while puffs bloom in the middle, out of nothing, so the fog forms there too instead of
    // only being carried in from the sides.
    for (let i = 0; i < FOG.bloom.count; i++) {
      const puff = this.add
        .image(
          width * (0.5 + (at(i, 21) - 0.5) * FOG.bloom.spread),
          height * (0.5 + (at(i, 23) - 0.5) * 0.9),
          'fogPuff'
        )
        .setDisplaySize(width * FOG.bloom.size, width * FOG.bloom.size)
        .setAlpha(0)
        .setScale(0.35)
        .setDepth(1.01)
        .setAngle(at(i, 27) * 360);
      this.fog.push(puff);
      settle.push({ image: puff, x: puff.x });

      const delay = FOG.cover * 0.15 + at(i, 29) * FOG.cover * 0.5;
      last = Math.max(last, delay + FOG.cover * 0.6);
      this.tweens.add({
        targets: puff,
        alpha: FOG.bloom.alpha,
        scale: FOG.bloom.grow * (0.85 + at(i, 31) * 0.3),
        angle: puff.angle + (at(i, 33) - 0.5) * 40,
        duration: FOG.cover * 0.6,
        delay,
        ease: 'Sine.easeOut'
      });
    }

    // Fired off a timer rather than a tween's onComplete: with a dozen tweens on their own
    // clocks, "covered" is when the LAST of them has landed.
    this.time.delayedCall(last, () => {
      this.hooks.onCovered();
      this.video?.destroy();
      this.video = undefined;

      let out = 0;
      settle.forEach(({ image, x }, i) => {
        const delay = FOG.hold + at(i, 37) * FOG.clear * 0.25;
        out = Math.max(out, delay + FOG.clear);
        this.tweens.add({
          targets: image,
          x,
          alpha: 0,
          scale: image.scale * 1.15, // thins as it spreads, rather than shrinking away
          duration: FOG.clear,
          delay,
          ease: 'Sine.easeIn'
        });
      });

      this.time.delayedCall(FOG.reveal, () => this.hooks.onClearing());

      this.time.delayedCall(out, () => {
        this.fog.forEach((image) => image.destroy());
        this.fog = [];
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

  private layout(): void {
    this.fitVideo();
    // The fog is not re-fitted mid-wipe: its tweens are driving x, and a rotation during the
    // second or two it is on screen would fight them. It is destroyed the moment it clears.
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
