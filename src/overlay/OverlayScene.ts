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
  // ...and to thin back out. THE knob for how long the fog takes to go: every delay and every
  // duration in the clear is a multiple of it — the banks, the patches that tear it up and the
  // wisps that outlast them — so this one number scales the whole thing rather than the front
  // of it. 750 rather than 1100: the clearing takes 0.98s where it took 1.43s, and the last
  // straggler is gone at 2.67s instead of 3.82s.
  clear: 750,
  /**
   * How the fog LEAVES. It came in as banks travelling from the edges, and sending them back
   * the way they came is what read as two slabs sliding off — the eye follows the hard outer
   * edge across the screen, exactly as it does on the way in.
   *
   * So it does not travel out AT ALL. There was a `drift` here — a fraction of the return trip,
   * meant to keep the mass moving — and it had to go: every bank drifting back towards its own
   * edge is left-half-left, right-half-right, which is a curtain opening. Small enough not to be
   * followed, still perfectly readable as a horizontal split. Symmetry about the middle is the
   * thing the eye catches, not the distance travelled.
   *
   * What clears the screen is `grow` — every piece swells past the frame while it fades, so the
   * density drops where it stands and the world comes through the middle of it rather than from
   * behind a receding wall.
   *
   * `vary` jitters each piece's own duration so they do not all thin at one rate, which is the
   * other half of a slab: uniform alpha over a whole bank reads as one object dimming.
   *
   * The rest is what makes it read as WEATHER rather than as a fade:
   *
   * `wind` — one direction every piece leans in, up-screen and slightly across, as fractions of
   * the screen. Fog lifts; it does not evaporate on the spot. This is shared, unlike `drift`,
   * which is per-side: a common direction is what says "air is moving" instead of "objects are
   * animating".
   *
   * `linger`/`lingerDelay` — the mid-screen puffs outlast the banks by half again and start
   * later. Real fog goes in that order: the mass thins first and the last of it hangs in torn
   * wisps. It is also what stops the clear finishing all at once, which no fog does.
   *
   * `curl` — degrees the wisps turn as they go, so they deform rather than translate. Banks
   * never rotate: they are screen-sized quads and a turned one shows its corner.
   *
   * `ripple` — density does not fall smoothly. A clearing bank thins, thickens where it folds
   * over itself, then goes. This rides a small wave on top of the easeOut, phased per piece, so
   * the thinning breathes. It moves the scale and the drift with it, which is the billow.
   */
  clearOut: {
    grow: 1.55,
    vary: 0.35,
    wind: { x: 0.05, y: -0.11 },
    // Pulled in with `clear`, and by more than it: at 1.5 and 0.45 the last wisp was still
    // fading a full second after the game had started, which is most of what "the fog takes
    // too long" actually was — the mass had gone and the screen still had fog on it.
    linger: 1.2,
    lingerDelay: 0.3,
    curl: 26,
    ripple: 0.12,
    // How far into the clear the BANKS are gone. They hand over to the patches (FOG.tear) at
    // this point rather than lasting the whole move: a screen-sized quad has no interior, so
    // however it is eased, all it can ever do on its own is dim.
    bankFade: 0.55
  },
  /**
   * What actually breaks the fog APART.
   *
   * The banks cover the screen with two quads a layer. That is right for arriving — a quad can
   * travel and thicken — but it is the whole reason the clear read as a fade: there is nothing
   * in a quad to come apart. Fading it faster, rippling it, drifting it, none of that gives it
   * an interior it does not have.
   *
   * So the clear lays a GRID of soft round patches over the banks and dissolves the banks under
   * them. Each patch then goes on its own clock, drifts out from the middle of the screen, turns,
   * swells and fades — so holes open where the thin ones went, clumps hang on where two overlap,
   * and the mass tears into pieces instead of dimming as one. Holes opening early is the effect,
   * not a leak: the intro is already swapped out behind it before any of this starts.
   *
   * `grid` is the spacing and `size` the diameter, both in screen widths — size MUST stay well
   * above grid or the patches start separated and the fog opens all at once on the first frame.
   * `scatter` is how far a patch wanders as it goes, in screen widths, in a direction of its
   * own. It replaced an outward-from-centre push, which was a mistake for the same reason the
   * banks' drift was: pushing every patch away from the middle is radially symmetric, and on a
   * screen far taller than it is wide that resolves into left-going and right-going halves — the
   * curtain again, now made of patches. Fog has no centre to flee. The break-up has to come from
   * the timings, not from the directions.
   *
   * These two numbers were measured, not guessed. Compositing the puff gradient over the grid,
   * 0.34/0.78 left a 24% hole in one corner of a 414x896 screen — a thin spot in the SAME place
   * every run, which reads as a bug rather than as weather. 0.30/0.90 holds 97% everywhere from
   * 320x568 to landscape. Tightening `grid` costs patches: it is 45 of them on a tall phone.
   */
  tear: {
    grid: 0.3,
    size: 0.9,
    jitter: 0.5, // how far off its slot a patch sits, in spacings — kills the grid pattern
    alpha: 0.92,
    scatter: 0.09,
    grow: 1.7,
    curl: 70
  },
  // How long the fog sits there before clearing when there is NO video (WITH_VIDEO false).
  //
  // It used to be a LOAD BUDGET as well as a beat — a guess at how long the island needs to
  // decode, with a slow device that took longer showing a half-built one. It is not a guess any
  // more: the loading screen waits on the loader itself and the fog is not released until that
  // has gone (see OverlayHooks.whenReady), so all this has left to do is give the fog a beat of
  // its own between the brand coming off and the world coming through. Safe to tune for looks
  // now — it is no longer holding anything up.
  soloHold: 0,
  // How far into that thinning the world is actually LEGIBLE, and so the moment anything meant
  // to ride the reveal (the camera push-in and its whoosh) should start. Not zero: the banks
  // hold for `hold` and their tweens are staggered by up to a quarter of `clear` on top.
  //
  // It is about a third of `clear` — the clear eases OUT, so the density falls in the first
  // third of the move rather than the last — and it has to be RE-SCALED whenever that changes,
  // or the push-in starts against fog that has already gone. 245 is that third of 750, as 360
  // was of 1100.
  reveal: 245,
  // How long BEFORE the video ends the fog starts. The clip keeps playing behind it, so the
  // player never sees it stop: by the time the last frame goes by, the fog is most of the way in
  // and the swap happens inside it. Waiting for the end event instead put a visible beat of
  // finished video on screen — the moment the ad looks like it has two halves.
  //
  // Kept under `cover` on purpose: much more and the fog is solid while there is still video
  // worth watching underneath it.
  lead: 800
};

/**
 * CONCEPT SWITCH. Two openings:
 *
 *   true   the intro video plays, and the fog rolls in over its last second (FOG.lead).
 *   false  no video at all: the screen starts ALREADY fogged and clears straight into the game.
 *
 * The second is the cheaper and faster of the two — it drops assets/videos/intro.mp4, 313 KB
 * on disk and about 420 KB inlined, and puts the player in the game a good six seconds sooner.
 * What it gives up is the loading cover: with the video there, the 3D scene had seven seconds to
 * fetch and decode its models behind it. Fog-only has the LOADING SCREEN instead, which covers
 * for exactly as long as the loading actually takes rather than for a number somebody guessed —
 * so a slow device no longer reveals a half-built island, it just shows the bar for longer.
 *
 * With this false, delete the intro.mp4 import below as well — an unused asset import may still
 * be inlined, and the saving is the whole point.
 */
const WITH_VIDEO = false;

/**
 * The clip's data URI — and the ONE LINE that decides whether the ad carries it.
 *
 * This is a manual toggle on purpose. Neither an unused `import` nor a require behind a
 * literal-false branch gets dropped: both leave `data:video/mp4;base64,...` in the built file
 * (checked — flipping WITH_VIDEO alone moved the build by 600 bytes out of 6.4 MB). So with
 * WITH_VIDEO false, comment the require out as well and the 420 KB actually goes.
 *
 *   WITH_VIDEO true  ->  const introSrc: string = require('assets/videos/intro.mp4');
 *   WITH_VIDEO false ->  const introSrc = '';
 */
const introSrc = '';

const VIDEO_W = 1080; // intro.mp4 is 1080x1080 (fallback for cover-fit)
const VIDEO_H = 1080;

interface OverlayHooks {
  onCovered: () => void; // full coverage — swap intro -> 3D scene
  onClearing: () => void; // fog thinning and the world showing through — see FOG.reveal
  onDone: () => void; // clouds receded — overlay finished
  /**
   * The fog is drawn and solid; hand back the moment it may thin.
   *
   * This is the no-video opening's only clock, and it belongs to the COORDINATOR rather than to
   * a number in here, because what it is waiting for is the island finishing loading and the
   * loading screen coming off the top of it. Handing the start function out — rather than
   * asking whether it is time — means the fog cannot begin clearing before whoever is covering
   * it has gone, whichever of the two is ready first.
   */
  whenReady: (start: () => void) => void;
}

export class OverlayScene extends Phaser.Scene {
  private hooks!: OverlayHooks;
  private video?: Phaser.GameObjects.Video;
  /**
   * Each piece of fog with what re-placing it needs. Kept because the fog HAS to survive a
   * resize: on the fog-only opening it is on screen from the first frame, and a playable's
   * viewport routinely changes size in those first moments — the SDK's boot size is not always
   * the final one. Sized for the wrong screen, the banks leave the rest of it uncovered, which
   * on a device showed as the game behind big black gaps.
   */
  private fog: Array<{
    image: Phaser.GameObjects.Image;
    role: 'bank' | 'puff';
    side: number; // banks: which edge it came from
    depth: number; // banks: which layer
    fx: number; // puffs: position as a fraction of the screen
    fy: number;
    grown: number; // puffs: its settled scale
  }> = [];
  private fogPhase: 'none' | 'cover' | 'clear' = 'none';
  private skip?: Phaser.GameObjects.Text;
  private wiping = false;

  constructor() {
    super('Overlay');
  }

  create(): void {
    this.hooks = this.registry.get('hooks') as OverlayHooks;

    this.drawFog();
    if (WITH_VIDEO) {
      this.createVideo();
      this.createSkip();
    } else {
      // Opens on solid fog and clears into the game — no video, nothing to skip.
      this.startWipe(true);
    }

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
    // Drawn into a canvas of MY OWN and handed over with addCanvas, rather than asking Phaser
    // for one with createCanvas. createCanvas hands back null on any of several conditions and
    // leaves nothing in the manager; an Image built against a missing key silently falls back to
    // Phaser's __MISSING texture, which stretched over a full-screen quad is a black rectangle.
    // That is what a device showed: the game visible at two corners, black across everything the
    // fog was meant to cover. This way the canvas is definitely mine and definitely drawn.
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    const ctx = el.getContext('2d');
    if (!ctx) {
      console.error('Fog: no 2d context; the transition will be skipped.');
      return;
    }

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
    this.textures.addCanvas('fog', el);

    // One soft blob on its own, for the puffs that bloom mid-screen.
    const puffEl = document.createElement('canvas');
    puffEl.width = 256;
    puffEl.height = 256;
    const pctx = puffEl.getContext('2d');
    if (!pctx) return;
    const g = pctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    pctx.fillStyle = g;
    pctx.fillRect(0, 0, 256, 256);
    this.textures.addCanvas('fogPuff', puffEl);
  }

  /**
   * Is the fog actually usable? Both textures have to be present AND not Phaser's missing-texture
   * placeholder, because that placeholder is what turns a failed transition into a black screen
   * over a working game. If it is not usable the fog is skipped entirely: the ad opening with no
   * transition is a small loss, opening behind a black rectangle is a dead ad.
   */
  private fogReady(): boolean {
    const ok = ['fog', 'fogPuff'].every(
      (key) => this.textures.exists(key) && this.textures.get(key).key !== '__MISSING'
    );
    if (!ok) console.error('Fog textures missing; going straight to the game.');
    return ok;
  }

  /**
   * Thicken the fog in, swap the intro out behind it, then let it thin back out.
   *
   * `alreadyThere` puts it at full cover on the first frame instead of rolling it in — the
   * no-video opening. Same objects, same end state, same clearing: only the arrival is skipped,
   * so the two concepts cannot drift apart.
   */
  private startWipe(alreadyThere = false): void {
    if (this.wiping) return;
    this.wiping = true;

    this.skip?.destroy();
    this.skip = undefined;

    // No usable fog: hand over rather than leaving a hole where the transition was. Still
    // through whenReady on the fog-only opening — there is no fog to cover the island now, so
    // the loading screen is the ONLY thing covering it, and starting the game under that would
    // play the first beat where nobody can see it.
    if (!this.fogReady()) {
      const handOver = (): void => {
        this.hooks.onCovered();
        this.video?.destroy();
        this.video = undefined;
        this.hooks.onClearing();
        this.hooks.onDone();
      };
      if (alreadyThere) this.hooks.whenReady(handOver);
      else handOver();
      return;
    }

    const { width, height } = this.scale.gameSize;
    const bankWidth = width * FOG.bank.width;
    const at = (i: number, salt: number) => {
      const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };

    this.fog = [];
    this.fogPhase = 'cover';
    // Every layer gets its OWN tween rather than one tween over all of them with per-index
    // values. That indexed form is what hid a sign error last time: the banks slid off their own
    // edges of the screen and, because a finished video stops rendering, the cut still "worked".
    /**
     * `clock` is which set of random numbers a piece clears on, and it is NOT the piece's index.
     *
     * The two banks of a layer are one continuous mass across the screen — they overlap in the
     * middle by design. Given a clock each, the left one finished measurably before the right,
     * and what that looks like is the screen clearing in halves with a vertical boundary down
     * it. So a layer shares one clock and goes as one thing. Only pieces that ARE separate
     * things — the mid-screen puffs — get their own.
     */
    const settle: Array<{ image: Phaser.GameObjects.Image; clock: number; wisp: boolean }> = [];
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
        this.fog.push({ image, role: 'bank', side, depth, fx: 0, fy: 0, grown: 1 });
        settle.push({ image, clock: depth, wisp: false });

        // Where it ends up, whether it is tweened there or simply put there.
        const to = {
          x: home - side * bankWidth,
          y: image.y + height * layer.drift,
          alpha: layer.alpha,
          scaleX: image.scaleX * layer.grow,
          scaleY: image.scaleY * layer.grow
        };
        if (alreadyThere) {
          image.setPosition(to.x, to.y).setAlpha(to.alpha).setScale(to.scaleX, to.scaleY);
        } else {
          // It arrives, swells and thickens at once, on its own clock.
          const travel = FOG.cover * (1 - layer.lead * 0.35);
          const delay = FOG.cover * layer.lead * 0.5;
          last = Math.max(last, delay + travel);
          this.tweens.add({ targets: image, ...to, duration: travel, delay, ease: 'Sine.easeInOut' });
        }
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
      this.fog.push({
        image: puff,
        role: 'puff',
        side: 0,
        depth: 0,
        fx: puff.x / width,
        fy: puff.y / height,
        grown: FOG.bloom.grow * (0.85 + at(i, 31) * 0.3)
      });
      // Past the banks' clocks (one per layer), so the two sets cannot collide.
      settle.push({ image: puff, clock: FOG.layers.length + i, wisp: true });

      const grown = FOG.bloom.grow * (0.85 + at(i, 31) * 0.3);
      if (alreadyThere) {
        puff.setAlpha(FOG.bloom.alpha).setScale(grown);
      } else {
        const delay = FOG.cover * 0.15 + at(i, 29) * FOG.cover * 0.5;
        last = Math.max(last, delay + FOG.cover * 0.6);
        this.tweens.add({
          targets: puff,
          alpha: FOG.bloom.alpha,
          scale: grown,
          angle: puff.angle + (at(i, 33) - 0.5) * 40,
          duration: FOG.cover * 0.6,
          delay,
          ease: 'Sine.easeOut'
        });
      }
    }

    // Fired off a timer rather than a tween's onComplete: with a dozen tweens on their own
    // clocks, "covered" is when the LAST of them has landed.
    //
    // On the no-video opening the fog is already at full cover on this frame, so `last` is 0 and
    // there is nothing to wait for HERE — what it waits for instead is the coordinator saying
    // the island is loaded and the loading screen has gone. See OverlayHooks.whenReady.
    const covered = () => {
      this.fogPhase = 'clear';
      this.hooks.onCovered();
      this.video?.destroy();
      this.video = undefined;

      // `out` is when the MASS is gone and the game may start; `gone` is when the last wisp has
      // faded and the objects can go. They are not the same moment any more — the wisps outlive
      // the banks on purpose (FOG.clearOut.linger), and holding the first beat back for them
      // would trade a second of play for scenery nobody is looking at.
      let out = 0;
      let gone = 0;
      const { grow, vary, wind, linger, lingerDelay, curl, ripple, bankFade } = FOG.clearOut;
      const hold = alreadyThere ? FOG.soloHold : FOG.hold;

      // Lay the patches over the banks FIRST, so the banks have something to hand the coverage
      // to as they go. This is what tears the fog up; the tweens below only see it out.
      //
      // Counted into `out` as well as `gone`: the patches ARE the mass once the banks have
      // handed over, so the first beat waits for them. Only the bloom wisps are allowed to
      // outlive it.
      const torn = this.tearApart(width, height, hold, at);
      out = Math.max(out, torn);
      gone = Math.max(gone, torn);

      settle.forEach(({ image, clock, wisp }) => {
        const delay = hold + at(clock, 37) * FOG.clear * (wisp ? lingerDelay : 0.25);
        // The banks are on a shorter clock than everything else: they are the smooth mass, and
        // once the patches are carrying the screen there is nothing to be gained by keeping them.
        const duration =
          FOG.clear * (wisp ? linger : bankFade) * (1 - vary / 2 + at(clock, 41) * vary);
        gone = Math.max(gone, delay + duration);
        if (!wisp) out = Math.max(out, delay + duration);
        this.tweens.add({
          targets: image,
          // The only travel left is the wind, and it is the SAME for every piece — one direction
          // the whole mass leans in. Anything per-side goes back to being a curtain.
          x: image.x + width * wind.x * (0.7 + at(clock, 43) * 0.6),
          y: image.y + height * wind.y * (0.7 + at(clock, 45) * 0.6),
          alpha: 0,
          // scaleX and scaleY, NOT `scale`. Phaser's `scale` getter is the AVERAGE of the two,
          // so tweening it on a bank — whose quad is far taller than it is wide — snapped both
          // to that average on the first frame: the bank lost about a sixth of its height in
          // one frame and showed the game through the top and bottom of the screen before it
          // had faded at all. That snap was most of what read as the fog "leaving" abruptly.
          scaleX: image.scaleX * grow * (wisp ? 1.25 : 1),
          scaleY: image.scaleY * grow * (wisp ? 1.25 : 1),
          // Only the wisps turn — a rotated full-screen bank shows its own corner.
          ...(wisp ? { angle: image.angle + (at(clock, 47) - 0.5) * 2 * curl } : {}),
          duration,
          delay,
          // easeOut, not easeIn: the density has to fall AT ONCE and trail off, which is what
          // dissipating looks like. easeIn held it solid for half the clear and then whipped it
          // away — the reveal was the last third of the move, so the move itself was the event.
          // The ripple on top keeps that fall from being a clean curve; see FOG.clearOut.
          ease: (t: number) =>
            Math.sin((t * Math.PI) / 2) +
            ripple *
              Math.sin(t * Math.PI * 3 + at(clock, 49) * Math.PI * 2) *
              Math.sin(t * Math.PI)
        });
      });

      this.time.delayedCall(hold + FOG.reveal, () => this.hooks.onClearing());

      this.time.delayedCall(out, () => {
        this.fogPhase = 'none';
        this.hooks.onDone();
      });

      // The wisps are still fading over the running game at this point, which is the whole
      // point of them. Nothing here is interactive, so they cost the player nothing.
      this.time.delayedCall(gone, () => {
        this.fog.forEach(({ image }) => image.destroy());
        this.fog = [];
      });
    };

    // The video opening runs on its own clock — the fog is still travelling in and `last` is
    // when it lands. Only the fog-only opening waits on the coordinator.
    if (alreadyThere) this.hooks.whenReady(covered);
    else this.time.delayedCall(last, covered);
  }

  /**
   * Lay a grid of soft patches over the covering banks and dissolve them one by one, so the fog
   * COMES APART instead of dimming. See FOG.tear for why this exists at all.
   *
   * Each patch gets the shared wind, a small wander of its own (FOG.tear.scatter), and its own
   * delay, rate, spin and swell. The delays are the important part: a patch that has finished
   * while its neighbours are half-way is a hole, and holes appearing all over at different
   * moments is what breaking apart looks like. The motion is only there so the pieces are not
   * static while they do it.
   *
   * Returns when the last patch has faded, which is when the mass is really gone.
   */
  private tearApart(
    width: number,
    height: number,
    hold: number,
    at: (i: number, salt: number) => number
  ): number {
    const { grid, size, jitter, alpha, scatter, grow, curl } = FOG.tear;
    const { wind, ripple } = FOG.clearOut;
    const step = width * grid;
    const cols = Math.ceil(1 / grid) + 1;
    const rows = Math.ceil(height / step) + 1;
    let end = 0;
    let i = 0;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        i++;
        const x = width / 2 + (c - (cols - 1) / 2) * step + (at(i, 51) - 0.5) * step * jitter;
        const y = height / 2 + (r - (rows - 1) / 2) * step + (at(i, 53) - 0.5) * step * jitter;
        const span = width * size * (0.8 + at(i, 55) * 0.5);
        const patch = this.add
          .image(x, y, 'fogPuff')
          .setDisplaySize(span, span)
          .setAlpha(alpha)
          .setDepth(1.02) // over the banks, under nothing
          .setAngle(at(i, 57) * 360);
        // Registered like everything else so it is destroyed with the rest and cannot outlive
        // the transition. refitFog leaves it alone: that only runs while COVERING.
        this.fog.push({
          image: patch,
          role: 'puff',
          side: 0,
          depth: 0,
          fx: x / width,
          fy: y / height,
          grown: patch.scale
        });

        // A direction of its OWN — not one derived from where it sits, which is how the last
        // version rebuilt the curtain out of patches. Two neighbours can wander opposite ways;
        // across the screen it averages to nothing, which is the point.
        //
        // The golden angle rather than the hash used everywhere else here. That hash is one sine
        // and it is not independent enough of the loop index to be trusted with a DIRECTION: the
        // patches are laid out column by column, so its output lined up with the column often
        // enough to put a 0.36 correlation between which side of the screen a patch starts on and
        // which way it travels — a faint curtain, baked in identically for every player, because
        // none of this is actually random. Turning by the golden angle each time cannot line up
        // with any grid: 0.09 across every screen size.
        const angle = i * 2.399963;
        const push = width * scatter * (0.5 + at(i, 63));

        const delay = hold + at(i, 65) * FOG.clear * 0.4;
        const duration = FOG.clear * (0.55 + at(i, 67) * 0.4);
        end = Math.max(end, delay + duration);

        this.tweens.add({
          targets: patch,
          x: x + Math.cos(angle) * push + width * wind.x,
          y: y + Math.sin(angle) * push + height * wind.y,
          alpha: 0,
          scale: patch.scale * grow, // square, so the average-scale trap does not apply here
          angle: patch.angle + (at(i, 69) - 0.5) * 2 * curl,
          duration,
          delay,
          ease: (t: number) =>
            Math.sin((t * Math.PI) / 2) +
            ripple * Math.sin(t * Math.PI * 3 + at(i, 71) * Math.PI * 2) * Math.sin(t * Math.PI)
        });
      }
    }
    return end;
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
    this.refitFog();
    if (this.skip) this.skip.setPosition(this.scale.gameSize.width - 16, 16);
  }

  /**
   * Re-place the fog for the screen it is now on.
   *
   * Only while it is still COVERING: at that point every piece is meant to be at its end state,
   * so it can simply be put there again at the new size — and covering is the phase where being
   * wrong matters, because a gap shows the game through what is supposed to be solid. Once it is
   * clearing it is a second from gone and its tweens own the positions; re-placing then would
   * fight them for no gain.
   */
  private refitFog(): void {
    if (this.fogPhase !== 'cover' || !this.fog.length) return;
    const { width, height } = this.scale.gameSize;
    const bankWidth = width * FOG.bank.width;

    this.fog.forEach(({ image, role, side, depth, fx, fy, grown }) => {
      if (role === 'bank') {
        const layer = FOG.layers[depth];
        const home = side < 0 ? 0 : width;
        image.setDisplaySize(bankWidth * layer.scale, height * 1.02 * layer.scale);
        image.setScale(image.scaleX * layer.grow, image.scaleY * layer.grow);
        image.setPosition(
          home - side * bankWidth,
          height / 2 + depth * height * FOG.bank.stagger + height * layer.drift
        );
        return;
      }
      image.setDisplaySize(width * FOG.bloom.size, width * FOG.bloom.size);
      image.setScale(grown);
      image.setPosition(width * fx, height * fy);
    });
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
