// The background track, taken from the shipped Make Marie a Muffin playable (its
// assets/audio/music_intro.mp3, at the 0.35 volume its audioConfig gives it).
//
// One looping HTMLAudioElement rather than WebAudio: there is a single track, it loops for the
// whole ad, and an element gives looping, volume and pause for nothing. If sound effects arrive
// later they will want a shared AudioContext — that is the point to swap this over, because
// dozens of overlapping one-shots is what an element is bad at, not one loop.
import trackSrc from 'assets/audio/theme.mp3';

const MUSIC = {
  // The reference's own level for this track. Everything the SDK sends through `volume` scales
  // this rather than replacing it, so a network turning the ad down keeps the mix.
  volume: 0.15
};

export class Music {
  private el: HTMLAudioElement;
  private master = 1;
  private wanted = false; // has anything asked it to play?
  private waiting = false; // ...and is it held up waiting for a gesture?

  constructor() {
    this.el = new Audio(trackSrc);
    this.el.loop = true;
    this.el.preload = 'auto';
    this.el.volume = MUSIC.volume;
  }

  /**
   * Start it, or arrange for it to start.
   *
   * Audible playback needs a user gesture in every current browser, and a playable ad opens
   * without one — so a rejected play() is the NORMAL path here, not an error. The first tap the
   * player makes is the gesture, and this playable's first tap always comes (it is how the ad
   * begins), so one listener is enough.
   */
  public start(): void {
    this.wanted = true;
    void this.el.play().catch(() => {
      if (this.waiting) return;
      this.waiting = true;
      window.addEventListener(
        'pointerdown',
        () => {
          this.waiting = false;
          if (this.wanted && this.master > 0) void this.el.play().catch(() => {});
        },
        { once: true, capture: true }
      );
    });
  }

  /** The SDK's volume, 0..1. Networks mute an ad this way, so 0 has to be silent. */
  public setVolume(value: number): void {
    this.master = Math.max(0, Math.min(1, value));
    this.el.volume = MUSIC.volume * this.master;
    this.el.muted = this.master <= 0;
  }

  public pause(): void {
    this.el.pause();
  }

  public resume(): void {
    if (this.wanted) this.start();
  }

  public stop(): void {
    this.wanted = false;
    this.el.pause();
    this.el.currentTime = 0;
  }
}
