// The first thing on screen: the brand, and how far the island has got.
//
// DOM rather than Phaser or Three, because it has to be up BEFORE either of those exists —
// Phaser takes a few hundred milliseconds to boot and the 3D canvas is deliberately hidden
// until the fog covers it, so anything drawn by them cannot be the first frame. A div, an img
// and two more divs are on screen the moment the document is.
//
// It reuses the logo already in the bundle for the corner brand (IslandScene.addBrandLogo), so
// it costs no new asset.
import logoSrc from 'assets/images/Logo.webp';

const LOADING = {
  // The scene's own sky, so when this goes the colour underneath it is the one that was
  // already there. A white or black card would read as a flash between two screens.
  background: '#8fd6f2',
  // One value for both orientations rather than a media query: on a tall phone the width binds,
  // on a wide one the height does, and min() picks whichever is smaller without either being
  // told which way the phone is held.
  span: 'min(62vw, 40vh)',
  gap: '6vmin', // between the logo and the bar
  bar: {
    height: '2.2vmin',
    track: 'rgba(0, 0, 0, 0.22)',
    fill: '#8fe25a', // the grass tint, so the bar belongs to this ad and not to a template
    edge: 'rgba(255, 255, 255, 0.9)'
  },
  // How fast the DRAWN figure closes on the real one, as a fraction of the gap per second. The
  // manager reports in steps — one model lands and the figure jumps several per cent — and a
  // bar that teleports reads as broken even when it is telling the truth.
  ease: 7,
  // Milliseconds the screen stays up even if everything is already decoded. A loading screen
  // that flashes past is worse than none: it reads as a glitch, and the brand never registers.
  minShow: 700,
  fade: 0.35, // seconds to fade out
  // Over the Phaser canvas (10) and the CTA (19/20), under the end card (30). It covers the
  // whole ad until it goes, so nothing may be drawn on top of it.
  zIndex: '25'
};

export class LoadingScreen {
  private root: HTMLDivElement;
  private fill: HTMLDivElement;
  /** What the loader says, and what is actually drawn — see LOADING.ease. */
  private target = 0;
  private drawn = 0;
  private shownAt = performance.now();
  private frame = 0;
  private last = performance.now();
  private closing = false;

  constructor() {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      background: LOADING.background,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: LOADING.gap,
      opacity: '1',
      transition: `opacity ${LOADING.fade}s`,
      // It is a cover, not a control. Taps on it do nothing at all rather than being swallowed
      // by a layer the player cannot see the point of.
      pointerEvents: 'none',
      zIndex: LOADING.zIndex
    } as CSSStyleDeclaration);

    const logo = document.createElement('img');
    logo.src = logoSrc;
    logo.alt = '';
    Object.assign(logo.style, {
      width: LOADING.span,
      height: 'auto',
      display: 'block'
    } as CSSStyleDeclaration);
    this.root.appendChild(logo);

    const track = document.createElement('div');
    Object.assign(track.style, {
      width: LOADING.span,
      height: LOADING.bar.height,
      background: LOADING.bar.track,
      borderRadius: '999px',
      overflow: 'hidden',
      boxShadow: `inset 0 0 0 0.25vmin ${LOADING.bar.edge}`
    } as CSSStyleDeclaration);

    this.fill = document.createElement('div');
    Object.assign(this.fill.style, {
      width: '0%',
      height: '100%',
      background: LOADING.bar.fill,
      borderRadius: '999px'
    } as CSSStyleDeclaration);
    track.appendChild(this.fill);
    this.root.appendChild(track);

    document.body.appendChild(this.root);
    this.frame = requestAnimationFrame(this.tick);
  }

  /**
   * How far along the loader says it is, 0..1.
   *
   * Clamped so it can only ever go FORWARD: the manager's total grows as more files are asked
   * for, so a raw loaded/total genuinely does go down, and a bar that runs backwards looks like
   * a fault in the ad rather than an honest measurement.
   */
  public setProgress(fraction: number): void {
    if (!Number.isFinite(fraction)) return;
    this.target = Math.min(1, Math.max(this.target, fraction));
  }

  private tick = (now: number): void => {
    const delta = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.drawn += (this.target - this.drawn) * (1 - Math.exp(-delta * LOADING.ease));
    this.fill.style.width = `${(this.drawn * 100).toFixed(1)}%`;
    this.frame = requestAnimationFrame(this.tick);
  };

  /**
   * Everything is in. Run the bar to the end, hold the brand for its minimum, then fade out.
   *
   * Resolves once the screen is GONE, so the caller can uncover whatever is behind it knowing
   * nothing is left on top. Safe to call twice.
   */
  public async finish(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    this.target = 1;

    const held = performance.now() - this.shownAt;
    await wait(Math.max(LOADING.minShow - held, 0));
    // ...and let the bar actually ARRIVE, rather than cutting it off at 94% because the assets
    // happened to land early. Capped so a stall here can never strand the ad on a loading
    // screen — the bar is a courtesy, the hand-over is not.
    await until(() => this.drawn > 0.995, 400);

    this.root.style.opacity = '0';
    await wait(LOADING.fade * 1000);
    cancelAnimationFrame(this.frame);
    this.root.remove();
  }
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

/** Poll a condition, giving up after `limit` ms so nothing here can hang the opening. */
const until = (ready: () => boolean, limit: number): Promise<void> =>
  new Promise((resolve) => {
    const started = performance.now();
    const check = (): void => {
      if (ready() || performance.now() - started >= limit) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
