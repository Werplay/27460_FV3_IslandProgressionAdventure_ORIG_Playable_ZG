// One-shot sound effects.
//
// Separate from Music because the two want different things: the track is one long loop that
// needs pausing and volume, while these are short, fire-and-forget, and occasionally overlap.
//
// A small pool of elements per sound rather than one: playing the same element twice restarts
// it, which cuts the first play off mid-way. Three copies is enough for anything here — the
// effects are all under a second and nothing fires more than a couple at a time.
//
// Every one of these is triggered BY A TAP, so the autoplay policy is never in the way (unlike
// the music, which has to wait for a gesture — see Music.start).
// Transcoded from the 162 KB source wav to mono 96 kbps: 22 KB, and nothing an ad heard through
// a phone speaker can tell apart. The wavs are still in assets/audio if a better encode is ever
// wanted — nothing imports them, so they cost the bundle nothing.
import stonesSrc from 'assets/audio/stones_spawn_04.mp3';
import chopSrc from 'assets/audio/wood-hit-hard-SBA-300156883.mp3';
import cowSrc from 'assets/audio/cow_happy_02.mp3';
import bridgeSrc from 'assets/audio/select_bridge.mp3';
import barnSrc from 'assets/audio/select_barn.mp3';
import cropSrc from 'assets/audio/crop_fly_02.mp3';
import treeLandSrc from 'assets/audio/crop_hit_ground_02.mp3';
import zoomSrc from 'assets/audio/camera_zoom_in.mp3';
import pullSrc from 'assets/audio/camera_zoom_out.mp3';

/** Each effect, and its own level in the mix. */
const SFX = {
  stones: { src: stonesSrc, volume: 0.1 },
  // Once per TREE, and a grove goes down one tree every CHOP.stagger — which is what the pool
  // above is for: on a single element the second chop would cut the first one off.
  chop: { src: chopSrc, volume: 0.1 },
  // The other half of a chop: `chop` is the axe going in, this is the trunk landing CHOP.fall
  // (0.7s) later. Two sounds for one tap, which is the point — the tap is answered at once and
  // the fall gets its own weight at the end of it.
  //
  // It is the ONE effect here that is not fired BY a tap; it comes off the topple finishing.
  // That is fine for the autoplay policy — the tap that started the fall is the gesture — but
  // it does mean several can be in the air at once when the axe takes a whole stand. They land
  // CHOP.stagger (0.35s) apart against a clip 0.16s long, so in practice they never overlap;
  // the pool is there for the case where they do.
  treeLand: { src: treeLandSrc, volume: 0.1 },
  cow: { src: cowSrc, volume: 0.2 },
  bridge: { src: bridgeSrc, volume: 0.1 },
  barn: { src: barnSrc, volume: 0.1 },
  crop: { src: cropSrc, volume: 0.1 },
  // The one exception to the tap rule above: this rides the fog reveal, so if the player has
  // not touched the screen yet the browser silences it. Nothing to do about that — the reveal
  // must not wait for a gesture — and a missed whoosh costs nothing.
  cameraZoom: { src: zoomSrc, volume: 0.2 },
  // The other half of the pair, out of the reference's own audio: the expansion PULLS BACK, and
  // the zoom-in whoosh played backwards is what a push-in sounds like, not a reveal.
  cameraPull: { src: pullSrc, volume: 0.2 }
};

export type SfxName = keyof typeof SFX;

class SfxPlayer {
  private pools = new Map<SfxName, HTMLAudioElement[]>();
  private next = new Map<SfxName, number>();
  private master = 1;

  /** Play it, unless the network has muted the ad. */
  public play(name: SfxName): void {
    if (this.master <= 0) return;
    const sound = SFX[name];
    if (!sound) return;

    let pool = this.pools.get(name);
    if (!pool) {
      pool = Array.from({ length: 3 }, () => {
        const el = new Audio(sound.src);
        el.preload = 'auto';
        return el;
      });
      this.pools.set(name, pool);
      this.next.set(name, 0);
    }

    const turn = this.next.get(name) ?? 0;
    this.next.set(name, (turn + 1) % pool.length);
    const el = pool[turn];
    el.volume = sound.volume * this.master;
    el.currentTime = 0;
    // A rejected play() is not worth reporting: it means the tab lost audio, and a missing
    // effect must never take the beat down with it.
    void el.play().catch(() => {});
  }

  /** The SDK's volume, 0..1. Scales every effect's own level; 0 silences them. */
  public setVolume(value: number): void {
    this.master = Math.max(0, Math.min(1, value));
  }
}

/** One player for the whole ad — the scene reaches for it directly rather than being handed it. */
export const sfx = new SfxPlayer();
