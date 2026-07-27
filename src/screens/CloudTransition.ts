// Cloud-sweep transition wipe.
// The spritesheet is a 4x4 grid of 16 frames (540x960 each). It is a one-way
// "cover" animation: frame 0 is mostly transparent and the clouds rise until the
// screen is fully opaque white at frame 8 (frames 8-15 are identical holds).
//
// A full wipe therefore plays the sheet FORWARD to cover the screen, swaps what
// is underneath at full coverage (unseen), then plays it in REVERSE so the
// clouds recede and reveal the new content.
//   `onCovered` fires the instant the screen is fully white (swap intro -> game).
//   `onDone`    fires once the clouds have receded and the overlay is removed.
import sheetSrc from '../assets/images/cloud-sweep_540x960_4x7.png';

const COLS = 4;
const ROWS = 4;
const PEAK = 8; // first fully-opaque frame (0-indexed) — full coverage
const FRAME_MS = 55; // ~0.9s round trip (cover + reveal)

// Frame playback order: 0..PEAK (cover), then PEAK-1..0 (reveal).
const SEQUENCE: number[] = [];
for (let i = 0; i <= PEAK; i++) SEQUENCE.push(i);
for (let i = PEAK - 1; i >= 0; i--) SEQUENCE.push(i);

export class CloudTransition {
  private root: HTMLDivElement;
  private onCovered: () => void;
  private onDone: () => void;

  private swapped = false;
  private finished = false;
  private paused = false;
  private elapsed = 0;
  private lastTs = -1;
  private rafId = 0;

  constructor(onCovered: () => void, onDone: () => void) {
    this.onCovered = onCovered;
    this.onDone = onDone;

    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundImage: `url(${sheetSrc})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${COLS * 100}% ${ROWS * 100}%`, // one frame fills the viewport
      pointerEvents: 'none',
      zIndex: '20'
    } as CSSStyleDeclaration);
    this.showFrame(SEQUENCE[0]);
    document.body.appendChild(this.root);

    // Decode the sheet before animating so the first frames don't hitch.
    const img = new Image();
    img.onload = () => this.begin();
    img.onerror = () => this.failSafe();
    img.src = sheetSrc;
  }

  private begin(): void {
    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  /** If the sheet can't load, still perform the swap so the game appears. */
  private failSafe(): void {
    if (!this.swapped) {
      this.swapped = true;
      this.onCovered();
    }
    this.finish();
  }

  private showFrame(frame: number): void {
    const col = frame % COLS;
    const row = Math.floor(frame / COLS);
    // Percentage background-position steps through the grid cells.
    const x = (col / (COLS - 1)) * 100;
    const y = (row / (ROWS - 1)) * 100;
    this.root.style.backgroundPosition = `${x}% ${y}%`;
  }

  private animate(ts: number): void {
    if (this.finished) return;
    this.rafId = requestAnimationFrame(this.animate);

    if (this.paused) {
      this.lastTs = ts;
      return;
    }
    if (this.lastTs < 0) this.lastTs = ts;
    this.elapsed += ts - this.lastTs;
    this.lastTs = ts;

    const step = Math.floor(this.elapsed / FRAME_MS);

    // At full coverage (reaching the peak frame) swap what's underneath.
    if (!this.swapped && step >= PEAK) {
      this.swapped = true;
      this.onCovered();
    }

    if (step >= SEQUENCE.length) {
      this.finish();
      return;
    }

    this.showFrame(SEQUENCE[step]);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    cancelAnimationFrame(this.rafId);
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.onDone();
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
    this.lastTs = -1; // avoid a time jump after pausing
  }

  public destroy(): void {
    this.finished = true;
    cancelAnimationFrame(this.rafId);
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
