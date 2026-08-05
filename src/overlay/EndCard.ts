// The end card, ported from the shipped Make Marie a Muffin playable
// (its src/ui/EndCard.js): background, logo, hero art, the two store badges and a pulsing
// CTA, tweened in one after another. Same sizes, same positions, same durations and eases —
// only the plumbing is this project's, because there is no `ui` layer here to hang it off.
//
// It is its own Phaser scene in its own Phaser game rather than a scene in the intro overlay,
// for two reasons: the intro overlay does not exist at all on a debug start (see Game), and by
// the time this runs the intro is finished with, so there is nothing to share.
import * as Phaser from 'phaser';
import { sdk } from '@smoud/playable-sdk';
import bgSrc from 'assets/images/EndcardBg.webp';
import logoSrc from 'assets/images/Logo.webp';
import heroSrc from 'assets/images/character_with_muffin_and_animals.png';
import ctaSrc from 'assets/images/play_now_button.png';
import googleSrc from 'assets/images/google-button.png';
import appleSrc from 'assets/images/apple-button.png';

/** Design resolution, from src/ui/UiScale.js — fixed px below are against this. */
const DESIGN = { width: 1136, height: 640 };

/** Display sizes at scale 1, in design px. The reference's END_CARD_BASE, unchanged. */
const BASE = {
  logo: { width: 340, height: 95 },
  hero: { width: 560, height: 403 },
  store: { width: 192, height: 58 },
  cta: { width: 300, height: 84 }
};

/**
 * Where each piece sits, as a fraction of the screen, and how big — the reference's own
 * numbers, out of its playableConfig endCard block.
 */
const AT = {
  logo: { portrait: { x: 0.5, y: 0.1 }, landscape: { x: 0.5, y: 0.1 } },
  hero: { portrait: { x: 0.55, y: 0.43 }, landscape: { x: 0.5, y: 0.45 } },
  store: { portrait: { x: 0.5, y: 0.75 }, landscape: { x: 0.5, y: 0.75 } },
  cta: { portrait: { x: 0.5, y: 0.85 }, landscape: { x: 0.5, y: 0.84 } }
};

/**
 * Per-item scale, on top of the design scale. The portrait numbers look enormous because the
 * design resolution is LANDSCAPE (1136x640): on a 375-wide phone the design scale is only
 * 0.33, and these multiply it back up. Straight from the reference.
 */
const ZOOM = {
  logo: { portrait: 3, landscape: 1 },
  hero: { portrait: 2.7, landscape: 0.8 },
  store: { portrait: 2, landscape: 0.7 },
  cta: { portrait: 2.3, landscape: 0.6 }
};
const STORE_GAP = { portrait: 28, landscape: 22 }; // design px between the two badges

/**
 * The legal block. Not decoration — these are the lines the campaign is required to carry, so
 * they come across with the rest of the card rather than being left behind.
 */
const LEGAL = {
  at: { portrait: { x: 0.5, y: 0.98 }, landscape: { x: 0.5, y: 0.99 } },
  fontSize: { portrait: 22, landscape: 15 },
  lineGap: { portrait: 13, landscape: 2 },
  maxWidth: { portrait: 0.99, landscape: 1 },
  lines: {
    portrait: [
      'Contains items available for purchase or unlocked through gameplay (Including random items)',
      '© 2026 Zynga, Inc. Zynga Inc, the Zynga logo and Farmville 3 are trademarks of Zynga, Inc. All rights reserved.',
      'App Store and the App Store logo are trademarks of Apple Inc, registered in the U.S. and other countries.',
      'Google Play and the Google Play logo are trademarks of Google LLC.'
    ],
    landscape: [
      'Contains items available for purchase or unlocked through gameplay (Including random items)  © 2026 Zynga, Inc. Zynga Inc, the Zynga logo and Farmville 3 are trademarks of Zynga, Inc. All rights reserved.',
      'App Store and the App Store logo are trademarks of Apple Inc, registered in the U.S. and other countries.  Google Play and the Google Play logo are trademarks of Google LLC.'
    ]
  }
};

const KEYS = { bg: 'endCardBg', logo: 'endCardLogo', hero: 'endCardHero', cta: 'endCardCta', google: 'endCardGoogle', apple: 'endCardApple' };

export class EndCardScene extends Phaser.Scene {
  private pieces: Array<{ image: Phaser.GameObjects.Image; part: keyof typeof BASE | 'bg'; at?: { portrait: { x: number; y: number }; landscape: { x: number; y: number } } }> = [];
  private pulse?: Phaser.Tweens.Tween;
  private legal: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('EndCard');
  }

  preload(): void {
    this.load.image(KEYS.bg, bgSrc);
    this.load.image(KEYS.logo, logoSrc);
    this.load.image(KEYS.hero, heroSrc);
    this.load.image(KEYS.cta, ctaSrc);
    this.load.image(KEYS.google, googleSrc);
    this.load.image(KEYS.apple, appleSrc);
  }

  create(): void {
    const { width, height } = this.scale;

    // The background covers, whatever the aspect: scaled on the LARGER of the two ratios, so
    // it is cropped rather than letterboxed.
    const bg = this.add.image(width * 0.5, height * 0.5, KEYS.bg).setOrigin(0.5);
    bg.setScale(Math.max(width / bg.width, height / bg.height));
    this.pieces.push({ image: bg, part: 'bg' });

    const logo = this.piece(KEYS.logo, 'logo', AT.logo);
    const hero = this.piece(KEYS.hero, 'hero', AT.hero);
    const google = this.piece(KEYS.google, 'store', AT.store);
    const apple = this.piece(KEYS.apple, 'store', AT.store);
    const cta = this.piece(KEYS.cta, 'cta', AT.cta);

    // The badges sit either side of the store position, as a pair.
    this.layoutStorePair(google, apple);

    // Install on POINTERDOWN, not pointerup: Mintegral and AppLovin webviews can read a touch
    // as the start of a scroll and fire touchcancel, so touchend never reaches the creative
    // and pointerup never comes. touchstart always lands. (Kept from the reference, which
    // carries the same note — it is a hard-won one.)
    [google, apple, cta].forEach((image) => {
      image.setInteractive({ useHandCursor: true });
      image.on('pointerdown', () => sdk.install());
    });

    const legal = this.buildLegal();

    // Everything arrives in order, and the CTA keeps breathing once it has.
    this.reveal([
      { image: logo, delay: 120, duration: 700, from: 0.6 },
      { image: hero, delay: 280, duration: 850, from: 0.75 },
      { image: google, delay: 420, duration: 600, from: 0.5 },
      { image: apple, delay: 460, duration: 600, from: 0.5 },
      { image: cta, delay: 560, duration: 650, from: 0.5, pulse: true }
    ]);
    this.tweens.add({ targets: legal, alpha: 1, duration: 500, delay: 700, ease: 'Cubic.easeOut' });

    this.scale.on('resize', () => this.layout());
  }

  /**
   * The required legal lines, stacked bottom-up from LEGAL.at so the block grows upwards and
   * its last line always sits the same distance off the bottom edge.
   */
  private buildLegal(): Phaser.GameObjects.Text[] {
    const lines = this.pick(LEGAL.lines);
    const size = this.pick(LEGAL.fontSize) * this.ui();
    const gap = this.pick(LEGAL.lineGap) * this.ui();
    const spot = this.spot(LEGAL.at);
    const wrap = this.scale.width * this.pick(LEGAL.maxWidth);

    const texts: Phaser.GameObjects.Text[] = [];
    let bottom = spot.y;
    // Built last line first, walking up: a wrapped line can be two rows tall, and stacking
    // downwards from the top would then push the tail of the block off the screen.
    for (const line of [...lines].reverse()) {
      const text = this.add
        .text(spot.x, bottom, line, {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: `${Math.max(size, 6)}px`,
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: wrap, useAdvancedWrap: true }
        })
        .setOrigin(0.5, 1)
        .setAlpha(0)
        .setShadow(0, 1, 'rgba(0,0,0,0.45)', 2);
      texts.push(text);
      bottom -= text.height + gap;
    }
    this.legal = texts;
    return texts;
  }

  /** One piece, positioned and sized for the current screen. */
  private piece(
    key: string,
    part: keyof typeof BASE,
    at: { portrait: { x: number; y: number }; landscape: { x: number; y: number } }
  ): Phaser.GameObjects.Image {
    const spot = this.spot(at);
    const image = this.add.image(spot.x, spot.y, key).setOrigin(0.5);
    image.setScale(this.scaleFor(image, part));
    image.setAlpha(0);
    this.pieces.push({ image, part, at });
    return image;
  }

  /** The uniform scale that puts `part` at its design width on this screen. */
  private scaleFor(image: Phaser.GameObjects.Image, part: keyof typeof BASE): number {
    return (BASE[part].width * this.pick(ZOOM[part]) * this.ui()) / image.width;
  }

  /** The design scale: fixed px against a 1136x640 design, whichever fits. */
  private ui(): number {
    return Math.min(this.scale.width / DESIGN.width, this.scale.height / DESIGN.height);
  }

  /** Whichever of a portrait/landscape pair this screen wants. */
  private pick<T>(pair: { portrait: T; landscape: T }): T {
    return this.scale.width > this.scale.height ? pair.landscape : pair.portrait;
  }

  private spot(at: { portrait: { x: number; y: number }; landscape: { x: number; y: number } }): {
    x: number;
    y: number;
  } {
    const { width, height } = this.scale;
    const frac = this.pick(at);
    return { x: width * frac.x, y: height * frac.y };
  }

  private layoutStorePair(google: Phaser.GameObjects.Image, apple: Phaser.GameObjects.Image): void {
    const gap = this.pick(STORE_GAP) * this.ui();
    const googleW = google.width * this.scaleFor(google, 'store');
    const appleW = apple.width * this.scaleFor(apple, 'store');
    const middle = this.spot(AT.store);
    const pair = googleW + gap + appleW;
    google.setPosition(middle.x - pair * 0.5 + googleW * 0.5, middle.y);
    apple.setPosition(middle.x + pair * 0.5 - appleW * 0.5, middle.y);
  }

  /**
   * Fade and scale each piece in on its own delay, growing past its resting size and settling
   * back — Back.easeOut, which is what gives the card its bounce.
   */
  private reveal(
    steps: Array<{
      image: Phaser.GameObjects.Image;
      delay: number;
      duration: number;
      from: number;
      pulse?: boolean;
    }>
  ): void {
    steps.forEach((step) => {
      const rest = step.image.scale;
      step.image.setScale(rest * step.from);
      this.tweens.add({
        targets: step.image,
        alpha: 1,
        scale: rest,
        duration: step.duration,
        delay: step.delay,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (!step.pulse) return;
          this.pulse = this.tweens.add({
            targets: step.image,
            scale: rest * 1.06,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
      });
    });
  }

  /** Re-place everything after a resize. The CTA's pulse is restarted at the new size. */
  private layout(): void {
    const { width, height } = this.scale;
    let google: Phaser.GameObjects.Image | undefined;
    let apple: Phaser.GameObjects.Image | undefined;

    this.pieces.forEach(({ image, part, at }) => {
      if (part === 'bg') {
        image.setPosition(width * 0.5, height * 0.5);
        image.setScale(Math.max(width / image.width, height / image.height));
        return;
      }
      const spot = this.spot(at!);
      image.setPosition(spot.x, spot.y);
      image.setScale(this.scaleFor(image, part));
      if (part === 'store') (google ? (apple = image) : (google = image));
    });

    if (google && apple) this.layoutStorePair(google, apple);

    // The legal block is rebuilt rather than moved: its wrapping depends on the width, so a
    // rotation can change how many rows each line takes.
    const wasVisible = this.legal[0]?.alpha ?? 0;
    this.legal.forEach((text) => text.destroy());
    this.buildLegal().forEach((text) => text.setAlpha(wasVisible));
    if (this.pulse) {
      this.pulse.stop();
      const cta = this.pieces.find((p) => p.part === 'cta');
      if (cta) {
        const rest = cta.image.scale;
        this.pulse = this.tweens.add({
          targets: cta.image,
          scale: rest * 1.06,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    }
  }
}

/**
 * Put the card up in its own Phaser game, above everything else.
 *
 * sdk.finish() is NOT called here: whoever ends the ad calls it, and this runs off the SDK's
 * own finish event (see Game.finish). That order matters — sdk.install() defers through a
 * setTimeout while the ad is unfinished, which breaks the user-gesture chain and makes
 * mraid.open() invisible to AppLovin's validator. Finishing first keeps install() synchronous
 * inside the tap.
 */
export function showEndCard(width: number, height: number): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width,
    height,
    transparent: true,
    parent: document.body,
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
    scene: EndCardScene
  });
  const canvas = game.canvas;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '30'; // over the 3D canvas, and over the tool row's 20
  return game;
}
