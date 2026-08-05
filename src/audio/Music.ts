// The background track, taken from the shipped Make Marie a Muffin playable (its
// assets/audio/music_intro.mp3, at the 0.35 volume its audioConfig gives it).
//
// One looping HTMLAudioElement rather than WebAudio: there is a single track, it loops for the
// whole ad, and an element gives looping, volume and pause for nothing. If sound effects arrive
// later they will want a shared AudioContext — that is the point to swap this over, because
// dozens of overlapping one-shots is what an element is bad at, not one loop.
//
// It KEEPS TRYING until it is actually playing, which is the whole design of this file. The
// first version tried once, then once more on the first pointerdown, and gave up — so a single
// swallowed rejection, a webview that reports a different gesture event, or a network that sends
// volume 0 at boot and unmutes later, each left the ad silent for the rest of its run with
// nothing in the console to say so. Every one of those is a thing that happens in ad webviews.
import trackSrc from 'assets/audio/theme.mp3';

const MUSIC = {
  // The reference's own level for this track. Everything the SDK sends through `volume` scales
  // this rather than replacing it, so a network turning the ad down keeps the mix.
  volume: 0.35,
  // Between retries while it is wanted but silent, and how long to keep trying. Playback needs a
  // gesture, and on the fog-only opening the first tap can be several seconds in — but a timer
  // that never stops is a timer that runs under the end card, so it is bounded.
  retryMs: 1200,
  giveUpMs: 40000,
  // How many times to rebuild the element after a load error. A fresh element re-fetches the
  // source, which is what recovers a decode that failed under memory pressure.
  reloads: 2
};

/** Anything a webview might call a first touch. Different hosts deliver different ones. */
const GESTURES = ['pointerdown', 'touchstart', 'mousedown', 'click', 'keydown'] as const;

export class Music {
  private el!: HTMLAudioElement;
  private master = 1;
  private wanted = false; // has anything asked it to play?
  private playing = false; // ...and is it actually making sound?
  private listening = false;
  private timer?: number;
  private since = 0;
  private reloads = 0;

  constructor() {
    this.el = this.build();
    // Same dev-only hook the scene has (window.island): audio is the one part of this ad that
    // fails silently, so there has to be a way to ask it whether it is actually playing.
    if (__DEV__) (window as unknown as { music: unknown }).music = this;
  }

  /** For the dev hook above: what state is it actually in? */
  public get state(): { wanted: boolean; playing: boolean; waiting: boolean; volume: number; muted: boolean } {
    return {
      wanted: this.wanted,
      playing: this.playing,
      waiting: this.listening,
      volume: +this.el.volume.toFixed(3),
      muted: this.el.muted
    };
  }

  private build(): HTMLAudioElement {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = MUSIC.volume * this.master;
    el.muted = this.master <= 0;
    // `playing` is the only trustworthy signal that it worked: play() can resolve on a element
    // that is still stalled, and the promise says nothing about audibility.
    el.addEventListener('playing', () => {
      this.playing = true;
      this.stopWaiting();
    });
    el.addEventListener('pause', () => (this.playing = false));
    el.addEventListener('error', () => this.reload());
    el.src = trackSrc;
    return el;
  }

  /** Load it again from scratch: the recovery for a source that failed to decode. */
  private reload(): void {
    if (this.reloads >= MUSIC.reloads) {
      console.error('Music failed to load; the ad runs silent.');
      return;
    }
    this.reloads++;
    this.el.remove();
    this.el = this.build();
    if (this.wanted) this.attempt();
  }

  /** Ask it to play, and keep asking until it does. */
  public start(): void {
    this.wanted = true;
    this.since = Date.now();
    this.attempt();
  }

  private attempt(): void {
    if (!this.wanted || this.playing || this.master <= 0) return;
    void this.el.play().catch(() => this.waitForGesture());
  }

  /**
   * Retry on any gesture, and on a timer as well.
   *
   * Not `{ once: true }`: the first tap can be REFUSED too — it might land on a button whose
   * handler runs before the audio is unlocked, or arrive as an event type this host does not
   * deliver. The listeners come off only once the element reports it is playing.
   */
  private waitForGesture(): void {
    if (this.listening || this.playing) return;
    this.listening = true;
    GESTURES.forEach((name) =>
      window.addEventListener(name, this.onGesture, { capture: true, passive: true })
    );
    this.timer = window.setInterval(() => {
      if (this.playing || Date.now() - this.since > MUSIC.giveUpMs) {
        this.stopWaiting();
        return;
      }
      this.attempt();
    }, MUSIC.retryMs);
  }

  private onGesture = (): void => {
    this.attempt();
  };

  private stopWaiting(): void {
    if (!this.listening) return;
    this.listening = false;
    GESTURES.forEach((name) =>
      window.removeEventListener(name, this.onGesture, { capture: true })
    );
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  /**
   * The SDK's volume, 0..1. Networks mute an ad this way, so 0 has to be silent — and coming
   * back UP has to start it, because a host that boots at 0 and unmutes later would otherwise
   * never get any music at all.
   */
  public setVolume(value: number): void {
    this.master = Math.max(0, Math.min(1, value));
    this.el.volume = MUSIC.volume * this.master;
    this.el.muted = this.master <= 0;
    if (this.master > 0 && this.wanted && !this.playing) this.attempt();
  }

  public pause(): void {
    this.el.pause();
  }

  public resume(): void {
    if (this.wanted) this.attempt();
  }

  public stop(): void {
    this.wanted = false;
    this.stopWaiting();
    this.el.pause();
    this.el.currentTime = 0;
  }
}
