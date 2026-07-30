// Clean standalone island scene: just the grass island, sandy beach, and toon
// water, viewed through a true ORTHOGRAPHIC ISOMETRIC camera. Because the camera
// is orthographic, the water reads as an even border on every side of the island
// (no perspective horizon), which is the classic Hay Day / FarmVille map look.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createIslandWater } from '../three/IslandWater.js';
import grassTextureSrc from 'assets/images/Ground3.jpg';
// Every model here is GLB. Webpack inlines that straight into the one build
// file, and it costs about half what a base64 .fbx did — the FBX exports are
// still in assets/models as the source art, converted with:
//   node scripts_fbx2glb.mjs assets/models/<name>.fbx assets/models/<name>.glb
//   npx -y -p @gltf-transform/cli gltf-transform quantize <out.glb> <out.glb>
//
// IMPORTANT: every GLB converted that way keeps the UV orientation of the FBX
// it came from, so its texture wants flipY = TRUE. Only Rubble_path.glb — which
// predates this and came out of a V-flipping pipeline, like the farm's models —
// wants flipY = false. Each one says which it is where its texture is bound.
import boatSrc from 'assets/models/B_Boat.glb';
import boatTextureSrc from 'assets/images/Buildings.jpg';
import merrySrc from 'assets/models/Merry-Anim.glb';
import merryTextureSrc from 'assets/images/C_Merryweather_Classic.jpg';
import hipsterSrc from 'assets/models/Hipster-Anim.glb';
import hipsterTextureSrc from 'assets/images/C_Hipster_Classic.jpg';
import rubbleSrc from 'assets/models/Rubble_Rock_gray.glb';
// The rock's material is Vegetation_B, so it reads its colour off the vegetation
// atlas — one flat 0.02-wide patch of it, not a painted rock.
import rubbleTextureSrc from 'assets/images/Vegetation.png';
import pathSrc from 'assets/models/Rubble_path.glb';
// Both bridges are FBX conversions, so flipY TRUE, and their material is
// Buildings_B — the same atlas as the boat, where their UVs read as wood brown.
import bridgeBrokenSrc from 'assets/models/Bridge_Broken.glb';
import bridgeRestoredSrc from 'assets/models/Bridge_Restored.glb';
// The tree is one of the farm's own GLBs, so it is the exception: flipY FALSE,
// and its foliage is an alpha CUTOUT on the vegetation atlas.
import treeSrc from 'assets/models/Tree_Round.glb';
import pointerSrc from 'assets/images/PointerHand.png';
import woodSrc from 'assets/images/Wood.png';
import bubbleSrc from 'assets/images/speechBubble.png';

const ISLAND_SIZE = 25; // grass land width/depth
const ISLAND_HEIGHT = 2;
const ISLAND_HALF = ISLAND_SIZE / 2;
const FIT_RADIUS = 2.5; // world radius kept in frame (island + water margin)
const GRASS_TINT = 0x8fe25a;
const WATER_Y = -0.4; // must match the water plane in createIslandWater
const SAND_EDGE = ISLAND_HALF + 1; // outer edge of the beach skirt

// Boat moored on the shoreline. x/z are where it sits in world space; the sand
// edge is at SAND_EDGE (13.5), so an |x| slightly beyond that puts it in the
// water just off the beach. At the current camera (FIT_RADIUS 3, panned to
// x -10) only the stretch around z -8..-2 of that -X shore is on screen — move
// z within that range to slide the boat along the beach.
const BOAT = {
  x: -(SAND_EDGE + 0.8), // just past the sand, floating off the -X beach
  z: -3,
  yawDeg: 65,
  // Hull length in world units. The island is ISLAND_SIZE (25) across, so 2 puts
  // the boat at about a twelfth of the island's width. The camera frames
  // 2 * FIT_RADIUS units, so at FIT_RADIUS 3 this fills a third of the screen —
  // check both numbers when you change it.
  length: 1.5,
  // Where the waterline sits on the HULL: 0 = keel just skimming the surface,
  // 1 = swamped to the deck. Measured against BOAT_HULL_FRACTION below, not the
  // whole model, so the mast never drags the boat under.
  draft: 0.15
};

// How the moored boat rides the water. The sea itself only swells about ±0.045
// world units at this zoom (IslandWater's waveAmp, divided down by the detail
// scale), so the heave is kept to that scale and the ROLL does the visible work.
// The three rates are deliberately unequal, so the motions drift in and out of
// phase instead of pumping in lockstep; heave borrows the water shader's own
// 0.9 rad/s so the boat rises with the swell rather than against it.
const BOAT_BOB = {
  heave: 0.0001, // vertical rise and fall, world units
  heaveRate: 0.9, // rad/s
  rollDeg: 3.5, // side to side, about the keel line
  rollRate: 0.62,
  pitchDeg: 1.6, // bow lifting and dipping
  pitchRate: 1.24
};

// Merryweather and the Hipster, standing on the grass between the camera and the
// moored boat. x/z are where their FEET go (the grass top is y = 0); at the
// current camera only about x -12..-8, z -6..0 of this shore is on screen, so
// keep them inside that and check the framing when you move them.
//
// yawDeg turns them on the spot. Both models are authored facing +Z and the
// camera looks along (0.42, 0.91) in XZ, so 25 is square-on to the camera —
// less turns them towards the sea, more towards the island.
//
// height is sole-to-hat in world units. The boat's hull is BOAT.length (1.5)
// long, and these two are authored in the same ~cm units as it (Merry measures
// 241 units, the Hipster 199), so 0.9 / 0.82 keeps all three in proportion.
//
// idle and run are frame ranges inside each model's single baked take,
// INCLUSIVE, at CLIP_FPS. idle loops from the start; run takes over when the
// rock breaks. Both idle ranges close on a repeat of their own first frame,
// which is what lets them loop without a hitch — verified against the takes, so
// trim them only against the source animation, not by eye.
const CLIP_FPS = 30; // the rate both takes were baked at
const CHARACTERS = [
  {
    key: 'merry',
    model: merrySrc,
    texture: merryTextureSrc,
    idle: { startFrame: 17, endFrame: 107 },
    run: { startFrame: 0, endFrame: 16 },
    // World units per second while running. Measured off the clip, not guessed:
    // her planted foot slides back 0.737 units over the 0.533s cycle, so this is
    // the speed at which the feet grip the ground instead of skating over it.
    runSpeed: 1.38,
    x: -10.8,
    z: -0.5,
    yawDeg: 72,
    height: 0.9
  },
  {
    key: 'hipster',
    model: hipsterSrc,
    texture: hipsterTextureSrc,
    idle: { startFrame: 0, endFrame: 298 },
    run: { startFrame: 299, endFrame: 315 },
    runSpeed: 1.23, // 0.694 units of foot slide over his 0.567s cycle
    x: -10.6,
    z: 1,
    yawDeg: 65,
    height: 0.82
  }
];

// Rubble laid in a semi-circle around the pair, left OPEN on the camera side so
// no rock ever stands between the characters and the viewer.
//
// The arc is centred on the characters' own midpoint (RUBBLE_CENTRE below), so
// moving either of them drags the ring along. Angles are compass-style about
// that centre: 0 = +Z, 90 = +X, growing clockwise seen from above. The camera
// looks in from 25°, which is why arcCentreDeg is 205 (25 + 180) — that puts the
// closed back of the arc directly behind them and the gap facing the lens. Swing
// arcCentreDeg and the opening swings with it.
const RUBBLE = {
  count: 7,
  radius: 2, // from the midpoint. The two characters sit 0.75 either side of
  // it, so anything under ~1 starts crowding them.
  arcCentreDeg: 100,
  arcSpanDeg: 180, // 180 is a true semi-circle; 360 would close the ring
  size: 1, // widest horizontal dimension of a rock, in world units, before jitter
  sizeJitter: 0.0, // ± this fraction of size, so the seven are not clones
  radiusJitter: 0.2, // ± world units in and out, so the arc is not a drawn curve
  sink: 0.05 // fraction of its height buried, so a rock sits IN the grass not on it
};

// The characters' midpoint, which the arc is built around — and, through
// RUN_STOP, everything past it. Declared here because the run and the crossing
// are both measured from it.
const RUBBLE_CENTRE = {
  x: CHARACTERS.reduce((sum, c) => sum + c.x, 0) / CHARACTERS.length,
  z: CHARACTERS.reduce((sum, c) => sum + c.z, 0) / CHARACTERS.length
};

// Tapping the rock at the PEAK of the arc breaks it open and leaves a path
// through the gap. That one rock is the only interactive thing in the scene —
// the other six are scenery.
const RUBBLE_BREAK = {
  // Which rock takes the tap: the one sitting at arcCentreDeg, i.e. the middle
  // of the run. An even count has no exact middle, so this rounds to the nearer.
  index: Math.round((RUBBLE.count - 1) / 2),
  // How many rocks either side of it go with it. 1 = three rocks, which opens
  // the arc to about 3.2u of clear ground: the pair runs through abreast 1.5u
  // wide, and a single rock's 1.1u gap left one going through each of them.
  spread: 1,
  // Tap target, as a multiple of the rock's own bounding sphere. A bare mesh hit
  // on something a world unit across is a fiddly target on a phone, so the
  // catchment is widened to something thumb-sized.
  hitPadding: 1.5,
  shatter: 0.5, // seconds from tap to the last chunk settling
  collapse: 0.3, // ... of which this much is the rock itself shrinking away
  debris: 6, // chunks thrown out of the break
  debrisScale: 0.3, // each one this fraction of the rock it came from
  debrisSpeed: 1.1, // outward, world units per second
  debrisLift: 1.7, // and upward, before gravity takes them
  gravity: 6
};

// The pointing hand that tells the player what to tap. It is a sprite parked in
// the world above the breakable rock rather than a DOM or Phaser overlay, so it
// tracks the rock through any resize without a line of layout code.
const TAP_HINT = {
  size: 0.95, // world units square. The rock is RUBBLE.size across, for scale
  offsetX: 0.1, // screen-RIGHT of the rock, world units
  offsetY: 0.05, // how far the FINGERTIP clears the top of the rock
  delay: 1.2, // seconds before it appears — the cloud intro is still clearing
  fade: 0.35, // seconds to fade in, and again to fade out once tapped
  cycle: 1.9, // one full press-press-rest before it starts over
  gap: 0.55, // seconds between the first press and the second
  press: 0.22, // how long a single press takes
  dip: 0.16 // how far it drops on a press, as a fraction of size
};

// How the characters take off once the way is open.
//
// They run PARALLEL, on one shared heading, so the gap between them never
// changes and their paths cannot cross. Aiming each of them at the gap instead
// would converge them onto the same point and swap their sides as they came out
// the far side of it — which is the crossing this avoids.
//
// headingDeg is that shared heading, compass-style like RUBBLE.arcCentreDeg
// (0 = +Z, 90 = +X). Leave it null to run straight out through the break: the
// heading is then measured from the pair's own midpoint to the rock that broke,
// so the formation straddles the gap. Their idle yaw is framing rather than a
// heading, so they swing onto this as they set off and the tuned facing is left
// untouched.
//
// speed is per character in CHARACTERS, matched to each one's own stride.
const RUN = {
  fade: 0.25, // seconds of crossfade from idle into the run
  turn: 0.3, // seconds to swing onto the heading
  headingDeg: null as number | null,
  rampUp: 0.35, // seconds from standstill to full speed, so they lean into it
  distance: 4, // world units before they pull up. The camera follows them, so
  // they cannot be left running off frame — and everything they run TO (the
  // stream, the bridge, the trees) is placed off this number, so changing it
  // moves the whole crossing with them rather than stranding them short of it.
  bankMargin: 1.15, // how far short of the water's edge they stop
  settle: 0.3 // seconds to blend back down into the idle once they stop
};

// Where they end up, which the rest of the scene is built around. The heading is
// RUBBLE.arcCentreDeg because that is what startRunning aims them along when
// RUN.headingDeg is left null.
const RUN_STOP = {
  x: RUBBLE_CENTRE.x + Math.sin(THREE.MathUtils.degToRad(RUBBLE.arcCentreDeg)) * RUN.distance,
  z: RUBBLE_CENTRE.z + Math.cos(THREE.MathUtils.degToRad(RUBBLE.arcCentreDeg)) * RUN.distance
};

// The stream that cuts the island in two, and everything that happens at it.
//
// There is no stream surface of its own: the channel is a slot cut through BOTH
// the grass slabs and the beach skirt, and what shows through it is the island's
// own sea. Same shader, same swell, same drifting patches, and it even foams
// where the slot reaches the shore — none of which a hand-made strip of blue
// would have matched. It also gains real depth for free: the sea sits at
// WATER_Y, 0.4 below the grass, so the slab edges read as banks.
// Sizes below are quoted in MERRY-HEIGHTS (0.9 world units), because that is
// what "out of scale" actually means here — the source pack puts a 7m tree next
// to a 2.4m person, and sizing each prop against its own model rather than
// against a character had trees at 2.4x a character with canopies wider than
// they were tall, and a broken bridge whose railing post stood taller than
// Merry. Everything on this page is now set against her.
const STREAM_WIDTH = 1.7; // named out here because STREAM.x is measured off it
const STREAM = {
  width: STREAM_WIDTH,
  // Placed just past where they pull up, so the run always ends at the water.
  x: RUN_STOP.x + RUN.bankMargin + STREAM_WIDTH / 2
};

// The bridge over it. Both models span their own Z and carry their railings on
// ±X, so a 90° yaw is what lays them across the channel.
const BRIDGE = {
  z: RUN_STOP.z, // it meets them where they stop
  // Bank to bank, measured across the model's long axis. 2.6 puts the repaired
  // span's railings at 0.62x a character — chest height, where a railing belongs
  // — and leaves 0.45u of deck on each bank. The wreck reads taller than that
  // because of the broken post it throws up, which is the point of it.
  span: 2.6,
  sink: 0.06, // how far the deck settles into the banks
  // The repair is a poof: a ring of smoke bursts over the wreck, the swap
  // happens inside it where nobody can see the seam, and the new span springs
  // out as the smoke thins. Hiding a cut behind a puff is an old trick and it
  // beats any amount of easing — there is no motion to get wrong.
  repair: 0.65, // seconds of smoke
  poof: {
    puffs: 7,
    size: 1.15, // world units across, each puff, before its own variation
    spread: 0.95, // how far out the ring sits from the middle of the bridge
    rise: 0.4, // how far the smoke drifts up as it expands
    swap: 0.14, // when the bridges change hands, under full cover
    pop: 0.36 // seconds for the new span to spring to full size
  }
};

// Trees on the near bank, back from the water so the pair has somewhere to
// stand. Verified against the arrival shot: each is at least 1.9u from a
// character and 3.2u from the next tree, and all three are in frame.
const TREES = {
  height: 1.8, // 2.0x a character, with a canopy 1.5x their height across
  // Offsets from RUN_STOP, so they travel with the rest of the crossing.
  //
  // All three sit to one side rather than ringing the clearing, and that is
  // forced: a canopy is drawn from a point 1.3 up, and world +Y is very nearly
  // screen up, so a tree covers a patch of screen well ABOVE its own trunk.
  // Clearing the rubble in world space is not enough — these are the spots that
  // clear it on SCREEN, checked against all seven rocks and both characters at
  // each end of the run. The band that does is the -z side of the clearing.
  offsets: [
    { x: 0.36, z: -2.36 },
    { x: -1.14, z: -3.06 },
    { x: 0.56, z: -3.96 }
  ]
};

// Chopping them, and the wood that repairs the bridge.
const CHOP = {
  hitPadding: 1.15, // multiple of the tree's own width, kept modest because a
  // padded canopy is already a wide target
  fall: 0.7, // seconds for a tree to topple
  linger: 0.25, // and how long the felled trunk lies there before it fades
  logFlight: 0.8, // seconds for its log to arc across to the bridge
  logSize: 0.55, // world units
  arc: 1.6 // how high the log lifts on the way, world units
};

// The pull-back when they arrive. At the running zoom the bridge runs off the
// side of a portrait frame, so the shot opens out to take in the trees, the
// pair and the crossing at once. fit/target come from solving the cluster's
// screen bounds — see the note on FIT_RADIUS for what fit means.
const ARRIVAL = {
  // The zoom stays where it is. Once the props were cut to character scale the
  // whole crossing fits inside a half-extent of about 1.8, so the shot only
  // needs recentring — opening it out as well just made everything small.
  fit: FIT_RADIUS,
  offset: { x: 0.28, z: -3.19 }, // from RUN_STOP, again so it follows the run
  ease: 1.1 // seconds for the move
};

// What the characters tell the player to do, and how it is drawn.
//
// The bubble is one 197x155 PNG with its tail on the LEFT, so it hangs off the
// speaker's right shoulder and the tail points back at whoever is talking. The
// words are drawn INTO it on a canvas rather than laid over it as a second
// sprite: one texture, one draw, and the text cannot drift out of the bubble on
// a different aspect ratio.
//
// Each line is spoken by the other character — SPEECH_LINES is read in order and
// say() alternates the speaker every time it is called.
const SPEECH = {
  // World units across.
  width: 0.95,
  // ...and how much of the art's own height to keep. The blob is nearly round
  // (1.27:1), so at full height it stands as tall as the character saying it,
  // while a single short line of text only ever needs a wide, shallow bubble.
  // Shrinking the whole sprite to fix that takes the text down with it and it
  // stops reading on a phone, so the bubble is squashed instead and the text is
  // counter-stretched by the same factor when it is drawn — the words come out
  // exactly the size and shape they would have been, in a bubble two thirds the
  // height. 1 = the art as authored.
  squash: 0.68,
  // The bubble is hung by its TAIL, not by its middle. The tip of the tail is
  // parked just off the speaker's head and the rest of the bubble is placed
  // from there, so it reads as coming out of their mouth however big the art is
  // or wherever they happen to be standing. Measured off the PNG: the leftmost
  // opaque pixel is (1, 87) of 197x155.
  tail: { x: 0.005, y: 0.439 }, // fraction of the sprite, from its bottom-left
  // Where that tip lands on the speaker. Height is a fraction of THEIRS, so it
  // holds for both characters despite one being shorter: 0.80 is about mouth
  // level (their eyes sit at 0.79 of their height, the top of the head at 1.0).
  // Anchoring at 1.0 put the bubble over their head like a thought balloon.
  faceHeight: 0.8,
  faceGap: 0.15, // out past the cheek, so it sits BESIDE the face, not over it
  fade: 0.25,
  // Body of the bubble in texture space. Measured off the art rather than
  // guessed: ignoring the tail, the blob runs x 0.071..0.980 and y 0..0.981, so
  // its middle is (0.525, 0.490) — not (0.5, 0.5), because the tail pulls the
  // shape leftward. Text centred on the sprite would sit off-centre in the
  // bubble. This is inset from the blob to leave a margin.
  body: { x: 0.13, y: 0.15, width: 0.79, height: 0.68 },
  colour: '#6b5636',
  // Starting size, in the art's own pixels. The text is MEASURED and shrunk
  // until it fits the body — a fixed size is a guess that breaks the moment
  // anyone edits a line, and every one of the three below overran the bubble at
  // the size that looked right on paper.
  fontSize: 34,
  fontStack: '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
  lineSpacing: 1.15
};

// Read in order, alternating speaker. Short enough to take in at a glance —
// this is an instruction, not dialogue.
const SPEECH_LINES = {
  rubble: 'Tap the rocks!',
  trees: 'Chop 3 trees!',
  cross: "Bridge fixed!\nLet's go!"
};

// Crossing it, once it is whole again.
//
// They go over in lanes rather than abreast: the deck is 1.94 wide between its
// railings and the pair stands 1.5 apart, which would put a shoulder through
// each railing. Half a metre either side of the centre line takes them over
// cleanly, and since one starts on each side of it they converge into their
// lanes without their paths ever crossing.
const CROSSING = {
  lane: 0.4, // either side of the deck's centre line
  beyond: 1.3, // how far onto the far bank they carry on before pulling up
  delay: 0.4, // seconds after the smoke clears before they set off
  // The planks sit a little above the grass — measured off the model, not
  // guessed — so they step up onto the deck and back down at the far end
  // instead of wading through it.
  deckY: 0.08,
  edge: 0.35 // how much of each end that step-up is spread over
};

// The camera goes with them, but only once they have run up to the middle of
// the frame — before that the shot holds still and they run INTO it, which
// reads better than panning from the first stride.
const CAMERA_FOLLOW = {
  enabled: true,
  // Seconds to close most of the gap. This is also what decides how far off
  // centre they sit once it has locked on: the steady lag is roughly
  // speed * ease, so at 1.3 u/s a 0.35 ease left them 0.45u to the right.
  ease: 0.15,
  // What the camera aims at, measured up from their feet. The shot is framed
  // on this point, so aiming at mid-body is what actually centres them —
  // holding the old PAN height (1) instead sat them a full unit low.
  aimHeight: 0.45
};

/** Shortest way round to an angle, so a turn never takes the long way. */
function shortestTurn(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

// The path left behind once the rock is gone.
const RUBBLE_PATH = {
  size: 3, // widest horizontal dimension, world units — fills the three-rock
  // opening, which runs about 3.2u wide between the rocks left standing
  yawOffsetDeg: 0, // it lies square across the arc's radius; turn it from there
  delay: 0.12, // seconds after the tap before it starts to show
  grow: 0.35, // seconds to swell into place
  lift: 0.004 // held a hair above the grass so the two cannot z-fight
};

/**
 * Cut one action out of a model's single baked take.
 *
 * subclip keeps samples where startFrame <= time * fps < endFrame, and
 * time * fps of a whole frame is a float that can land either side of the bound
 * it means to keep. Half a frame of padding makes the range reliably inclusive,
 * which matters because these ranges close on a repeat of their own first frame
 * — that repeat is what seals the loop.
 */
function cutClip(
  take: THREE.AnimationClip,
  name: string,
  range: { startFrame: number; endFrame: number }
): THREE.AnimationClip {
  const clip = THREE.AnimationUtils.subclip(
    take,
    name,
    range.startFrame - 0.5,
    range.endFrame + 0.5,
    CLIP_FPS
  );
  return closeLoop(clip);
}

/**
 * Make a clip loop cleanly by appending a copy of its opening frame one frame
 * past the end, so the wrap interpolates instead of snapping.
 *
 * Ranges that already close on themselves (both idles, and Merry's run) are
 * left alone — a duplicate frame there would only add a one-frame hold. The
 * Hipster's run is the one that needs it: its last frame sits 25° of Thigh_R
 * away from its first, which pops every 0.57s without this.
 */
function closeLoop(clip: THREE.AnimationClip): THREE.AnimationClip {
  const CLOSED = 1e-3; // per-value slack before a clip counts as already looping

  const open = clip.tracks.some((track) => {
    const size = track.getValueSize();
    const last = (track.times.length - 1) * size;
    for (let i = 0; i < size; i++) {
      if (Math.abs(track.values[i] - track.values[last + i]) > CLOSED) return true;
    }
    return false;
  });
  if (!open) return clip;

  clip.tracks.forEach((track) => {
    const size = track.getValueSize();
    const times = new Float32Array(track.times.length + 1);
    times.set(track.times);
    times[track.times.length] = track.times[track.times.length - 1] + 1 / CLIP_FPS;

    const values = new Float32Array(track.values.length + size);
    values.set(track.values);
    for (let i = 0; i < size; i++) values[track.values.length + i] = track.values[i];

    track.times = times;
    track.values = values;
  });
  clip.resetDuration();

  return clip;
}

/**
 * Deterministic stand-in for Math.random, keyed on the rock's index. This is a
 * fixed shot that gets tuned by eye, so the arrangement has to come back
 * identical on every load — real randomness would reshuffle it each time.
 */
function jitter(index: number, salt: number): number {
  const n = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// Measured from B_Boat.fbx: its vertices run Y -96.8 .. +184.7, but everything
// above roughly +20 is mast and cabin — the wide hull is only the bottom ~41%.
// The waterline has to be computed against the hull alone, or the boat sinks to
// its gunwales.
const BOAT_HULL_FRACTION = 0.51;

// Camera orbit — rotates the view around the island. The island, beach and foam
// ring are all axis-aligned to each other, so spinning the CAMERA is how you
// turn the island: everything stays in sync and only the presented angle
// changes. (Rotating the island mesh itself would leave the square beach and
// the shader's foam ring behind, unrotated.)
//
//   VIEW_YAW_DEG   which side you look from, spun around the vertical axis.
//                  45 = corner-on (the default diamond/Hay Day look), 0 or 90 =
//                  a flat edge faces the camera square-on. The island is a
//                  square, so only 0-90 is distinct — 135 looks like 45 again.
//                  Increasing it swings the camera anticlockwise seen from
//                  above, so the island appears to turn clockwise.
//   VIEW_ELEV_DEG  how high above the horizon the camera sits. 90 = straight
//                  top-down (no island sides visible), 35.26 = true isometric,
//                  lower = flatter and more side-on, showing more of the cliff
//                  faces and squashing the water border.
//
// Defaults reproduce the classic (1,1,1) isometric direction exactly.
// NOTE: PAN below maps to screen directions assuming a 45° yaw — change the
// yaw and those diagonal pairings rotate with it.
// 45 / 35.264 reproduces the classic (1,1,1) true-isometric direction.
const VIEW_YAW_DEG = 65;
const VIEW_ELEV_DEG = 20;

const ISO_DIR = (() => {
  const el = THREE.MathUtils.degToRad(VIEW_ELEV_DEG);
  const az = THREE.MathUtils.degToRad(VIEW_YAW_DEG);
  return new THREE.Vector3(
    Math.cos(el) * Math.cos(az),
    Math.sin(el),
    Math.cos(el) * Math.sin(az)
  ).normalize();
})();

// Camera pan, in world units. Both the camera and its look-at point shift by
// this offset, so the isometric angle and the zoom are untouched — only which
// part of the world sits in frame changes. (Zoom is FIT_RADIUS above.)
//
// The view is yawed 45°, so world axes land DIAGONALLY on screen. Per axis, the
// framed area slides:
//   x: +  screen RIGHT and DOWN   (so the island appears to move left and up)
//      -  screen LEFT and UP
//   z: +  screen LEFT and DOWN
//      -  screen RIGHT and UP
//   y: +  straight UP             (so the island appears to sink)
//      -  straight DOWN
//
// Pair x and z to get a pure screen direction — their diagonal halves cancel:
//   LEFT  ->  x: -n, z: +n          RIGHT ->  x: +n, z: -n
//   UP    ->  x: -n, z: -n          DOWN  ->  x: +n, z: +n
// e.g. { x: -6, y: 0, z: 6 } frames more water off the island's left shore.
// y: +n is exactly the UP pair (x: -n, z: -n); use whichever reads clearer.
const PAN = { x: -10, y: 1, z: 0 };
const PAN_VEC = new THREE.Vector3(PAN.x, PAN.y, PAN.z);

// How far back the camera stands, and its clip range. In an ORTHOGRAPHIC
// projection distance has no effect on framing (that is FIT_RADIUS's job) — it
// only decides what falls inside the near/far clip. So these are deliberately
// generous and independent of the zoom: the camera clears the island and the
// 400-unit water plane at any yaw, elevation or zoom, and the sea never gets
// sliced off by the far plane when you tune those.
const CAM_DISTANCE = 300;
const CAM_NEAR = 0.1;
const CAM_FAR = 1000;

export class IslandScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private water!: { group: THREE.Group; update: (s: number) => void };
  private width: number;
  private height: number;
  private running = true;
  private rafId = 0;
  private startMs = 0;
  private lastMs = 0;
  private mixers: THREE.AnimationMixer[] = [];
  // pivot carries the mooring position and the heave, rock only tips the hull —
  // splitting them keeps the roll centred on the waterline instead of swinging
  // the boat around the model's authored origin.
  private boat?: { pivot: THREE.Group; rock: THREE.Group };
  // Timed animations that are not the boat or a mixer — the shatter and the
  // path growing in. Each is called with the frame delta and returns false when
  // it is finished with itself.
  private effects: Array<(delta: number) => boolean> = [];
  private raycaster = new THREE.Raycaster();
  private rubbleMaterial?: THREE.MeshStandardMaterial;
  // The one rock that answers to a tap, with the tap target worked out from its
  // own size. angle is where it sits on the arc, which the path lines up with.
  private rocks: Array<{ pivot: THREE.Group; rock: THREE.Object3D }> = [];
  private breakable?: {
    index: number; // into this.rocks — the break takes its neighbours too
    pivot: THREE.Group;
    centre: THREE.Vector3;
    radius: number;
    angle: number;
    broken: boolean;
  };
  private path?: THREE.Group; // loaded up front, hidden until the rock breaks
  // Both clips per character, plus what the break needs to send them running.
  private actions: Array<{
    key: string;
    idle: THREE.AnimationAction;
    run: THREE.AnimationAction;
    pivot: THREE.Group;
    speed: number;
    height: number; // where a speech bubble has to clear
  }> = [];
  private speech?: THREE.Sprite; // only ever one, and it follows its speaker
  private speaker = 0; // whose turn it is to talk; every line swaps it
  private bubbleImage?: HTMLImageElement;
  // Characters currently under way. Populated by the break, emptied as each one
  // covers RUN.distance.
  private runners: Array<{
    pivot: THREE.Group;
    idle: THREE.AnimationAction;
    run: THREE.AnimationAction;
    fromYaw: number;
    turn: number; // shortest way round from fromYaw to the shared heading
    speed: number;
    elapsed: number;
    travelled: number;
    distance: number; // per runner, since the crossing gives each its own lane
    deck?: { minX: number; maxX: number; y: number; edge: number };
  }> = [];
  private runHeading = 0; // the heading of the first leg, which they share
  private afterRun?: () => void; // what happens when the last one pulls up
  private deck?: { minX: number; maxX: number; y: number; edge: number };
  // The camera looks at this, and starts easing it after the runners once they
  // reach the middle of the frame.
  private cameraTarget = PAN_VEC.clone();
  private cameraFollowing = false;
  private tapHint?: THREE.Sprite;
  private pointerTexture = new THREE.TextureLoader().load(pointerSrc);
  private woodTexture = new THREE.TextureLoader().load(woodSrc);
  // The crossing: the wreck, the repaired span waiting under it, and the trees
  // that pay for the swap.
  private bridgeBroken?: THREE.Group;
  private bridgeRestored?: THREE.Group;
  private puff?: THREE.CanvasTexture; // drawn on demand, shared by every puff
  private trees: Array<{
    pivot: THREE.Group;
    centre: THREE.Vector3;
    radius: number;
    top: number;
    chopped: boolean;
  }> = [];
  private choppingOpen = false; // only once they have run up to the bank
  private wood = 0;
  // Live zoom, so the arrival can open the shot out. FIT_RADIUS is the start.
  private fitRadius = FIT_RADIUS;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    Object.assign(this.renderer.domElement.style, {
      position: 'absolute',
      top: '0',
      left: '0'
    } as CSSStyleDeclaration);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd6f2); // sky

    // Both UI sprites are authored in sRGB like every other texture here.
    this.pointerTexture.colorSpace = THREE.SRGBColorSpace;
    this.woodTexture.colorSpace = THREE.SRGBColorSpace;

    // Decoded up front because the speech bubble is drawn INTO a canvas rather
    // than used as a texture directly, and a canvas needs a decoded image.
    const bubble = new Image();
    bubble.onload = () => {
      this.bubbleImage = bubble;
    };
    bubble.src = bubbleSrc;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, CAM_NEAR, CAM_FAR);
    // cameraTarget starts at PAN and only moves if the runners drag it along.
    this.camera.position.copy(ISO_DIR).multiplyScalar(CAM_DISTANCE).add(this.cameraTarget);
    this.camera.lookAt(this.cameraTarget);
    this.updateCamera();

    this.addLights();
    this.addIsland();
    this.addBoat();
    this.addCharacters();
    this.addRubble();
    this.addPath();
    this.addBridge();
    this.addTrees();

    // Taps are read off the WINDOW in the capture phase, not off this canvas:
    // Game.ts parks the Phaser overlay on top at z-index 10, and a canvas takes
    // pointer events whether or not it is transparent, so a listener down here
    // would never see them. Capture also puts us ahead of anything the overlay
    // might swallow.
    window.addEventListener('pointerdown', this.onPointerDown, { capture: true });

    // Beach skirt + toon water, centered on the island. viewRadius tells the
    // water how much world is on screen so its blobs and foam scale with the
    // zoom — without it a tight FIT_RADIUS frames less than a single feature.
    this.water = createIslandWater({
      islandHalf: ISLAND_HALF,
      viewRadius: FIT_RADIUS,
      // Slots the same gap through the beach skirt that addIsland cuts in the
      // grass, so the sea below shows through it as the stream.
      channel: { x: STREAM.x, width: STREAM.width }
    });
    this.scene.add(this.water.group);

    this.startMs = performance.now();
    this.lastMs = this.startMs;
    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(10, 40, 10);
    this.scene.add(sun);
  }

  private addIsland(): void {
    const texture = new THREE.TextureLoader().load(grassTextureSrc);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const side = new THREE.MeshStandardMaterial({ color: 0x3f9a2b, roughness: 1 }); // darker green cliff

    // The island is TWO slabs with the stream's channel between them, rather
    // than one box. Each gets its own copy of the grass texture repeated in
    // proportion to its own width — sharing one would stretch the grass across
    // the wider slab and shrink it on the narrower.
    const slab = (fromX: number, toX: number) => {
      const width = toX - fromX;
      const map = texture.clone();
      map.repeat.set((4 * width) / ISLAND_SIZE, 4);
      map.needsUpdate = true;

      const grass = new THREE.MeshStandardMaterial({ map, color: GRASS_TINT, roughness: 1 });
      // BoxGeometry material order: [ +x, -x, +y(top), -y(bottom), +z, -z ].
      const geometry = new THREE.BoxGeometry(width, ISLAND_HEIGHT, ISLAND_SIZE);
      const mesh = new THREE.Mesh(geometry, [side, side, grass, side, side, side]);
      mesh.position.set(fromX + width / 2, -ISLAND_HEIGHT / 2, 0); // grass top at y = 0
      this.scene.add(mesh);
    };

    const bank = STREAM.width / 2;
    slab(-ISLAND_HALF, STREAM.x - bank);
    slab(STREAM.x + bank, ISLAND_HALF);
  }

  /**
   * Boat moored on the shore. Loaded asynchronously, so it pops in a frame or
   * two after the scene — harmless here because the intro covers the start.
   */
  private addBoat(): void {
    // The source art names an absolute Buildings.png from the authoring machine
    // that cannot resolve in a bundle, so the project's copy of that atlas is
    // bound here instead. (The conversion to GLB dropped the dead reference, so
    // nothing tries to fetch it any more either.)
    //
    // flipY TRUE, per the note at the imports: the hull's UVs still use the
    // FBX/OpenGL bottom-left origin, and this atlas is mostly empty black
    // space. flipY = false drops about a third of the hull's surface onto that
    // black area and lands the rest on the wrong tiles.
    const texture = new THREE.TextureLoader().load(boatTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    new GLTFLoader().load(
      boatSrc,
      (gltf: { scene: THREE.Group }) => {
        const model = gltf.scene;
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
        model.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
        });

        // The art is authored in its own units (this one is ~396 long), so rather
        // than guess a conversion factor we measure and scale to BOAT.length.
        // Only the HORIZONTAL axes count: taking the largest of all three would
        // let the mast decide the scale and leave the hull far too small.
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        model.scale.setScalar(BOAT.length / Math.max(size.x, size.z));

        // Re-measure after scaling, then seat the model on its own WATERLINE
        // rather than its keel — the parent group sits exactly at the water
        // surface, so BOAT.draft alone decides how deep the hull sits and the
        // sea can never cut across the deck. The group also owns the yaw, so
        // turning spins the boat about itself instead of about the world origin.
        const box = new THREE.Box3().setFromObject(model);
        const centre = box.getCenter(new THREE.Vector3());
        const hullHeight = (box.max.y - box.min.y) * BOAT_HULL_FRACTION;
        const waterline = box.min.y + hullHeight * BOAT.draft;
        model.position.set(-centre.x, -waterline, -centre.z);

        // rock sits between the two so it turns about the pivot's origin — the
        // waterline centre — which is what the hull would actually rock about.
        const rock = new THREE.Group();
        rock.add(model);

        const pivot = new THREE.Group();
        pivot.name = 'boat';
        pivot.add(rock);
        pivot.position.set(BOAT.x, WATER_Y, BOAT.z);
        pivot.rotation.y = THREE.MathUtils.degToRad(BOAT.yawDeg);
        this.scene.add(pivot);
        this.boat = { pivot, rock };
      },
      undefined,
      (err: unknown) => console.error('Boat model failed to load:', err)
    );
  }

  /**
   * The two farm characters standing on the shore, each looping its idle. Their
   * FBXs bake every action into ONE take, so the idle is cut out of it by frame
   * range rather than picked by clip name.
   */
  private addCharacters(): void {
    const loader = new GLTFLoader();

    CHARACTERS.forEach((character) => {
      const texture = new THREE.TextureLoader().load(character.texture);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      // TRUE, even though these are GLBs and the path below is false. The farm's
      // GLBs came from a pipeline that flips V on the way out of FBX; these two
      // were converted with three's own exporter, which copies UVs across
      // untouched, so they still want the orientation their FBX wanted.
      texture.flipY = true;

      loader.load(
        character.model,
        (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => {
          const model = gltf.scene;
          // The model names a texture path from the authoring machine, which
          // cannot resolve in a bundle, so the atlas is bound here instead.
          const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
          model.traverse((child: THREE.Object3D) => {
            const mesh = child as THREE.SkinnedMesh;
            if (!mesh.isMesh) return;
            mesh.material = material;
            // The idle swings the bones outside the bind-pose bounds three culls
            // against, which can blink the character out near the frame edge.
            if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
          });

          // Measure and scale like the boat, but on HEIGHT — that is the
          // dimension that has to read on screen for a character.
          const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
          model.scale.setScalar(character.height / size.y);

          // Re-measure, then centre horizontally on the pivot and stand the
          // soles on the grass, so CHARACTERS x/z is simply where the feet land.
          const box = new THREE.Box3().setFromObject(model);
          const centre = box.getCenter(new THREE.Vector3());
          model.position.set(-centre.x, -box.min.y, -centre.z);

          // The pivot owns where the character stands and which way they face,
          // so it is what the run moves — the model inside it only ever holds
          // the centring offset.
          const pivot = new THREE.Group();
          pivot.name = character.key;
          pivot.add(model);
          pivot.position.set(character.x, 0, character.z);
          pivot.rotation.y = THREE.MathUtils.degToRad(character.yawDeg);
          this.scene.add(pivot);

          const take = gltf.animations[0];
          if (take) {
            const mixer = new THREE.AnimationMixer(model);
            const idle = mixer.clipAction(cutClip(take, `${character.key}-idle`, character.idle));
            const run = mixer.clipAction(cutClip(take, `${character.key}-run`, character.run));
            idle.play();
            this.mixers.push(mixer);
            this.actions.push({
              key: character.key,
              idle,
              run,
              pivot,
              speed: character.runSpeed,
              height: character.height
            });
          } else {
            console.warn(`${character.key}: model carries no baked animation take`);
          }
        },
        undefined,
        (err: unknown) => console.error(`${character.key} model failed to load:`, err)
      );
    });
  }

  /**
   * The semi-circle of rubble around the characters. One model is loaded and
   * then cloned per rock, so all seven share the geometry and the material and
   * cost little more than one.
   */
  private addRubble(): void {
    const texture = new THREE.TextureLoader().load(rubbleTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true; // FBX-derived UVs — see the note at the imports
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    new GLTFLoader().load(
      rubbleSrc,
      (gltf: { scene: THREE.Group }) => {
        const source = gltf.scene;
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
        source.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
        });
        this.rubbleMaterial = material; // the shatter clones it for its debris

        // Measured once on the source, then reused: every clone is the same
        // model, so only the per-rock jitter has to be worked out in the loop.
        const size = new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
        const baseScale = RUBBLE.size / Math.max(size.x, size.z);

        const group = new THREE.Group();
        group.name = 'rubble';

        for (let i = 0; i < RUBBLE.count; i++) {
          const rock = source.clone(true);
          rock.scale.setScalar(baseScale * (1 + (jitter(i, 1) - 0.5) * 2 * RUBBLE.sizeJitter));

          // Centre the model on its pivot and drop it to the grass, then bury
          // the sink fraction of it. Measured after scaling, like the boat.
          const box = new THREE.Box3().setFromObject(rock);
          const centre = box.getCenter(new THREE.Vector3());
          const height = box.max.y - box.min.y;
          rock.position.set(-centre.x, -box.min.y - height * RUBBLE.sink, -centre.z);

          // Walk the arc from one end to the other, nudging each rock in or out
          // so the seven do not read as beads on a drawn circle.
          const step = RUBBLE.count === 1 ? 0.5 : i / (RUBBLE.count - 1);
          const angle = THREE.MathUtils.degToRad(
            RUBBLE.arcCentreDeg - RUBBLE.arcSpanDeg / 2 + RUBBLE.arcSpanDeg * step
          );
          const radius = RUBBLE.radius + (jitter(i, 2) - 0.5) * 2 * RUBBLE.radiusJitter;

          const pivot = new THREE.Group();
          pivot.add(rock);
          pivot.position.set(
            RUBBLE_CENTRE.x + Math.sin(angle) * radius,
            0,
            RUBBLE_CENTRE.z + Math.cos(angle) * radius
          );
          pivot.rotation.y = jitter(i, 3) * Math.PI * 2; // spun so no two show the same face
          group.add(pivot);
          this.rocks.push({ pivot, rock });

          if (i === RUBBLE_BREAK.index) {
            // The tap target is a sphere around the rock, sized from the rock
            // itself so retuning RUBBLE.size cannot leave it stranded. Half the
            // largest side, NOT the box's bounding sphere — that sphere has to
            // reach the corners of an already rotated box, and comes out about
            // double the rock, which at this zoom is half the screen.
            pivot.updateMatrixWorld(true);
            const hitBox = new THREE.Box3().setFromObject(pivot);
            const hitSize = hitBox.getSize(new THREE.Vector3());
            this.breakable = {
              index: i,
              pivot,
              centre: hitBox.getCenter(new THREE.Vector3()),
              radius: (Math.max(hitSize.x, hitSize.y, hitSize.z) / 2) * RUBBLE_BREAK.hitPadding,
              angle,
              broken: false
            };
            this.renderer.domElement.style.cursor = 'pointer';
          }
        }

        this.scene.add(group);
        // Needs the breakable rock, which only exists now.
        if (this.breakable) {
          this.showTapHint(this.breakable.centre, new THREE.Box3().setFromObject(this.breakable.pivot).max.y);
          this.say(SPEECH_LINES.rubble);
        }
      },
      undefined,
      (err: unknown) => console.error('Rubble model failed to load:', err)
    );
  }

  /**
   * The pointing hand over the breakable rock: fades in a moment after the
   * scene settles, taps twice, rests, repeats — and leaves for good once the
   * player does what it asked.
   */
  private showTapHint(centre: THREE.Vector3, top: number, delay = TAP_HINT.delay): void {
    this.hideTapHint(); // only ever one hand, wherever the beat has moved to

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.pointerTexture,
        transparent: true,
        opacity: 0,
        depthTest: false, // it is UI: nothing in the scene may cover it
        depthWrite: false
      })
    );
    sprite.scale.setScalar(TAP_HINT.size);
    sprite.renderOrder = 999;

    // Screen-right comes off the camera's own X axis, since world X points
    // diagonally at this yaw. Its world matrix is only refreshed by a render,
    // and this can run off a load callback that beats the first frame.
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);

    // The hand points UP with its fingertip at the top edge of the image, so
    // the sprite hangs half its own height below wherever that tip should land
    // — offsetY is the tip's clearance over the target, not the sprite's.
    const base = new THREE.Vector3(
      centre.x,
      top + TAP_HINT.offsetY - TAP_HINT.size / 2,
      centre.z
    ).addScaledVector(right, TAP_HINT.offsetX);
    sprite.position.copy(base);

    this.scene.add(sprite);
    this.tapHint = sprite;

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      if (elapsed < delay) return true;

      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity = Math.min((elapsed - delay) / TAP_HINT.fade, 1);

      // Two presses per cycle: one at the top of it, one TAP_HINT.gap later,
      // then the rest of the cycle is the rest between them.
      const beat = (elapsed - delay) % TAP_HINT.cycle;
      const into = Math.min(beat, Math.abs(beat - TAP_HINT.gap));
      const press = into < TAP_HINT.press ? Math.sin((into / TAP_HINT.press) * Math.PI) : 0;

      sprite.position.y = base.y - press * TAP_HINT.size * TAP_HINT.dip;
      sprite.scale.setScalar(TAP_HINT.size * (1 - press * 0.08));

      return this.tapHint === sprite; // dropped the moment the rock is tapped
    });
  }

  /** Retire the hand once its job is done. */
  private hideTapHint(): void {
    const sprite = this.tapHint;
    if (!sprite) return;
    this.tapHint = undefined; // ends the pulse effect on its next frame

    const material = sprite.material as THREE.SpriteMaterial;
    const from = material.opacity;
    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      const k = Math.min(elapsed / TAP_HINT.fade, 1);
      material.opacity = from * (1 - k);
      if (k < 1) return true;

      sprite.removeFromParent();
      material.dispose();
      return false;
    });
  }

  /**
   * Hand both characters from their idle into the run and send them off through
   * the break. The gap is wherever the tapped rock stood.
   */
  private startRunning(): void {
    if (!this.actions.length) return;

    // One heading for everyone — that is what keeps them parallel. Measured
    // from the pair's midpoint to the gap, so the formation straddles it
    // instead of converging on it. Models face +Z, so a yaw of y sends them
    // off along (sin y, cos y).
    const gap = this.breakable?.pivot.position;
    if (RUN.headingDeg !== null) {
      this.runHeading = THREE.MathUtils.degToRad(RUN.headingDeg);
    } else if (gap) {
      const midpoint = new THREE.Vector3();
      this.actions.forEach(({ pivot }) => midpoint.add(pivot.position));
      midpoint.divideScalar(this.actions.length);
      this.runHeading = Math.atan2(gap.x - midpoint.x, gap.z - midpoint.z);
    } else {
      this.runHeading = this.actions[0].pivot.rotation.y;
    }

    this.afterRun = () => this.arriveAtBridge();
    this.actions.forEach((entry) => this.sendRunner(entry, this.runHeading, RUN.distance));
  }

  /** Put one character on the road: blend into the run and start it moving. */
  private sendRunner(
    entry: IslandScene['actions'][number],
    heading: number,
    distance: number,
    deck?: IslandScene['deck']
  ): void {
    const { run, idle, pivot, speed } = entry;
    run.reset();
    run.setLoop(THREE.LoopRepeat, Infinity);
    run.play();
    // The two poses are far apart (about 20 units of summed bone delta), so
    // this has to be a blend — cutting straight to the run snaps visibly.
    run.crossFadeFrom(idle, RUN.fade, false);

    this.runners.push({
      pivot,
      idle,
      run,
      fromYaw: pivot.rotation.y,
      turn: shortestTurn(heading - pivot.rotation.y),
      speed,
      elapsed: 0,
      travelled: 0,
      distance,
      deck
    });
  }

  /**
   * Over the bridge. Each one aims at its own lane on the far bank, so they
   * turn onto slightly different headings and converge into single file on the
   * deck without ever swapping sides.
   */
  private crossBridge(): void {
    if (!this.actions.length) return;

    const farX = this.deck ? this.deck.maxX : STREAM.x + BRIDGE.span / 2;
    this.afterRun = undefined; // the far bank is the end of the road for now

    this.actions.forEach((entry) => {
      const from = entry.pivot.position;
      // One of them stands each side of the centre line already, so this keeps
      // whichever side they are on.
      const side = Math.sign(from.z - BRIDGE.z) || 1;
      const toX = farX + CROSSING.beyond;
      const toZ = BRIDGE.z + side * CROSSING.lane;

      this.sendRunner(
        entry,
        Math.atan2(toX - from.x, toZ - from.z),
        Math.hypot(toX - from.x, toZ - from.z),
        this.deck
      );
    });
  }

  /**
   * Carry the running characters forward. They swing onto the heading and pick
   * up speed at the same time, so the first stride curves out of the turn
   * rather than snapping onto a line.
   */
  private driveRunners(delta: number): void {
    if (!this.runners.length) return;

    this.runners = this.runners.filter((runner) => {
      runner.elapsed += delta;

      const turned = THREE.MathUtils.smoothstep(runner.elapsed, 0, RUN.turn);
      runner.pivot.rotation.y = runner.fromYaw + runner.turn * turned;

      // Ramped, so they accelerate out of the idle instead of leaving at full
      // pace on the first frame — which would slide the feet.
      const step = runner.speed * THREE.MathUtils.smoothstep(runner.elapsed, 0, RUN.rampUp) * delta;
      runner.pivot.position.x += Math.sin(runner.pivot.rotation.y) * step;
      runner.pivot.position.z += Math.cos(runner.pivot.rotation.y) * step;
      runner.travelled += step;

      // On the bridge, walk on the planks rather than through them: up at the
      // near end, level across, back down at the far one.
      if (runner.deck) {
        const { minX, maxX, y, edge } = runner.deck;
        const x = runner.pivot.position.x;
        const on =
          THREE.MathUtils.smoothstep(x, minX, minX + edge) -
          THREE.MathUtils.smoothstep(x, maxX - edge, maxX);
        runner.pivot.position.y = y * THREE.MathUtils.clamp(on, 0, 1);
      }

      if (runner.travelled < runner.distance) return true;
      runner.pivot.position.y = 0; // back on the grass

      // They pull up where they stopped. With the camera following they are
      // still on screen, so leaving them jogging on the spot is not an option.
      runner.idle.reset();
      runner.idle.play();
      runner.idle.crossFadeFrom(runner.run, RUN.settle, false);
      return false;
    });

    if (this.runners.length) {
      this.followRunners(delta);
      return;
    }

    // The last one has pulled up. Whatever was waiting on that happens now, and
    // only once — the crossing sets nothing, so the far bank is where it ends.
    const done = this.afterRun;
    this.afterRun = undefined;
    if (done) done();
  }

  /**
   * They have pulled up at the water. The shot opens out — at the running zoom
   * the bridge runs off the side of a portrait frame — and the trees become
   * live once it has.
   */
  private arriveAtBridge(): void {
    this.choppingOpen = true;

    const from = this.cameraTarget.clone();
    const to = new THREE.Vector3(
      RUN_STOP.x + ARRIVAL.offset.x,
      CAMERA_FOLLOW.aimHeight,
      RUN_STOP.z + ARRIVAL.offset.z
    );
    const fromFit = this.fitRadius;

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      const k = THREE.MathUtils.smoothstep(elapsed, 0, ARRIVAL.ease);

      this.cameraTarget.lerpVectors(from, to, k);
      this.fitRadius = THREE.MathUtils.lerp(fromFit, ARRIVAL.fit, k);
      this.camera.position.copy(ISO_DIR).multiplyScalar(CAM_DISTANCE).add(this.cameraTarget);
      this.camera.lookAt(this.cameraTarget);
      this.updateCamera();

      if (elapsed < ARRIVAL.ease) return true;
      // The hand and the next instruction both wait for the move to settle.
      this.pointAtNextTree();
      this.say(SPEECH_LINES.trees);
      return false;
    });
  }

  /**
   * Pan with the runners, but only from the moment they reach the middle of the
   * frame — up to then the shot is still and they run into it. The trigger is
   * measured along their own heading, so it fires as they cross the centre and
   * can never snap the camera backwards.
   */
  private followRunners(delta: number): void {
    if (!CAMERA_FOLLOW.enabled || !this.runners.length) return;

    const midpoint = new THREE.Vector3();
    this.runners.forEach(({ pivot }) => midpoint.add(pivot.position));
    midpoint.divideScalar(this.runners.length);
    midpoint.y = CAMERA_FOLLOW.aimHeight; // mid-body, so they sit on the centre

    if (!this.cameraFollowing) {
      const ahead = new THREE.Vector3(Math.sin(this.runHeading), 0, Math.cos(this.runHeading));
      if (midpoint.clone().sub(this.cameraTarget).dot(ahead) < 0) return;
      this.cameraFollowing = true;
    }

    // Frame-rate independent ease. The lag is deliberate: the pair drifts a
    // little ahead of centre as the camera picks them up, which is what makes
    // it read as a camera move rather than as the world sliding underneath.
    this.cameraTarget.lerp(midpoint, 1 - Math.exp(-delta / CAMERA_FOLLOW.ease));
    this.camera.position.copy(ISO_DIR).multiplyScalar(CAM_DISTANCE).add(this.cameraTarget);
    this.camera.lookAt(this.cameraTarget);
  }

  /**
   * The path that takes the broken rock's place. Loaded with the scene and left
   * hidden, because a tap has to answer instantly — fetching and parsing it on
   * the tap would put a hitch exactly where the playable can least afford one.
   */
  private addPath(): void {
    // GLB, so flipY is FALSE here: glTF puts its UV origin at the top left,
    // the opposite of every FBX above. Same atlas as the boat.
    const texture = new THREE.TextureLoader().load(boatTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    new GLTFLoader().load(
      pathSrc,
      (gltf: { scene: THREE.Group }) => {
        const model = gltf.scene;
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
        model.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
        });

        // Unlike the FBX props this is authored in world-ish units (about 2
        // across), but it is still measured rather than trusted.
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        model.scale.setScalar(RUBBLE_PATH.size / Math.max(size.x, size.z));

        const box = new THREE.Box3().setFromObject(model);
        const centre = box.getCenter(new THREE.Vector3());
        model.position.set(-centre.x, -box.min.y, -centre.z);

        const pivot = new THREE.Group();
        pivot.name = 'rubblePath';
        pivot.add(model);
        pivot.visible = false;
        this.scene.add(pivot);
        this.path = pivot;
      },
      undefined,
      (err: unknown) => console.error('Rubble path model failed to load:', err)
    );
  }

  /**
   * Both bridges, loaded together and stacked in the same place: the broken one
   * showing, the repaired one waiting under the ground for the wood to arrive.
   */
  private addBridge(): void {
    // Buildings atlas, flipY TRUE — these are FBX conversions, see the imports.
    const texture = new THREE.TextureLoader().load(boatTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });

    const place = (src: string, onReady: (pivot: THREE.Group) => void) => {
      new GLTFLoader().load(
        src,
        (gltf: { scene: THREE.Group }) => {
          const model = gltf.scene;
          model.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
          });

          // Both models run their deck along their own Z and carry the railings
          // on ±X, so the span is measured on Z and a 90° yaw lays it across
          // the channel.
          const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
          model.scale.setScalar(BRIDGE.span / size.z);

          const box = new THREE.Box3().setFromObject(model);
          const centre = box.getCenter(new THREE.Vector3());
          model.position.set(-centre.x, -box.min.y - BRIDGE.sink, -centre.z);

          const pivot = new THREE.Group();
          pivot.add(model);
          pivot.position.set(STREAM.x, 0, BRIDGE.z);
          pivot.rotation.y = Math.PI / 2;
          this.scene.add(pivot);
          onReady(pivot);
        },
        undefined,
        (err: unknown) => console.error('Bridge model failed to load:', err)
      );
    };

    place(bridgeBrokenSrc, (pivot) => {
      pivot.name = 'bridgeBroken';
      this.bridgeBroken = pivot;
    });
    place(bridgeRestoredSrc, (pivot) => {
      pivot.name = 'bridgeRestored';
      pivot.visible = false; // sits exactly where the wreck is, waiting its turn
      this.bridgeRestored = pivot;

      // Where the crossing walks. Taken off the repaired span itself, so the
      // deck the characters step onto is the one that is actually there.
      const box = new THREE.Box3().setFromObject(pivot);
      this.deck = {
        minX: box.min.x,
        maxX: box.max.x,
        y: CROSSING.deckY,
        edge: CROSSING.edge
      };
    });
  }

  /**
   * The trees on the near bank. One model, cloned per position, each turned and
   * sized a little differently so the three do not read as copies.
   */
  private addTrees(): void {
    // The farm's own GLB, so flipY FALSE here — and its foliage is an alpha
    // cutout on the vegetation atlas, which needs alphaTest or the leaves come
    // through as solid cards.
    const texture = new THREE.TextureLoader().load(rubbleTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    new GLTFLoader().load(
      treeSrc,
      (gltf: { scene: THREE.Group }) => {
        const source = gltf.scene;
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 1,
          alphaTest: 0.5,
          side: THREE.DoubleSide // leaf cards are single-sided in the source
        });
        source.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
        });

        const size = new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
        const baseScale = TREES.height / size.y;

        TREES.offsets.forEach((offset, i) => {
          const tree = source.clone(true);
          tree.scale.setScalar(baseScale * (0.85 + jitter(i, 21) * 0.3));

          // Centred on its trunk and stood on the grass, so the pivot it hangs
          // from is the point it will topple about.
          const box = new THREE.Box3().setFromObject(tree);
          const centre = box.getCenter(new THREE.Vector3());
          tree.position.set(-centre.x, -box.min.y, -centre.z);

          const pivot = new THREE.Group();
          pivot.name = `tree${i}`;
          pivot.add(tree);
          pivot.position.set(RUN_STOP.x + offset.x, 0, RUN_STOP.z + offset.z);
          pivot.rotation.y = jitter(i, 22) * Math.PI * 2;
          this.scene.add(pivot);

          // Tap target, sized off the trunk rather than the canopy: a padded
          // canopy on a 2.2u tree would swallow a third of the screen.
          const stood = new THREE.Box3().setFromObject(pivot);
          const spread = stood.getSize(new THREE.Vector3());
          this.trees.push({
            pivot,
            centre: new THREE.Vector3(
              pivot.position.x,
              TREES.height * 0.45,
              pivot.position.z
            ),
            radius: (Math.max(spread.x, spread.z) / 2) * CHOP.hitPadding,
            top: stood.max.y,
            chopped: false
          });
        });
      },
      undefined,
      (err: unknown) => console.error('Tree model failed to load:', err)
    );
  }

  /** A tap anywhere within the breakable rock's catchment sets it off. */
  private onPointerDown = (event: PointerEvent): void => {
    if (!this.running) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    // The camera is ORTHOGRAPHIC, so every ray runs parallel and the world has
    // one uniform scale on screen. That makes the ray's distance to a target's
    // centre exactly the miss distance as the player sees it — plain round tap
    // targets, with no mesh intersection to snag on a gap between chunks or a
    // hole in a canopy.
    const hits = (centre: THREE.Vector3, radius: number) =>
      this.raycaster.ray.distanceToPoint(centre) <= radius;

    // One beat at a time: the rubble first, and the trees only once they have
    // run up to the bank.
    if (this.breakable && !this.breakable.broken) {
      if (hits(this.breakable.centre, this.breakable.radius)) this.breakRubble();
      return;
    }

    if (!this.choppingOpen) return;
    const tree = this.trees.find((entry) => !entry.chopped && hits(entry.centre, entry.radius));
    if (tree) this.chopTree(tree);
  };

  /**
   * Fell one tree: it topples about its base, lies there a moment, then fades
   * out as its log flies over to the bridge.
   */
  private chopTree(tree: IslandScene['trees'][number]): void {
    tree.chopped = true;
    this.hideTapHint();

    // Away from the pair, so a falling tree never lands on top of them.
    const away = Math.atan2(
      tree.pivot.position.x - RUN_STOP.x,
      tree.pivot.position.z - RUN_STOP.z
    );
    const axis = new THREE.Vector3(Math.cos(away), 0, -Math.sin(away)).normalize();
    const model = tree.pivot.children[0];
    // Held so the topple can be composed ON TOP of them. Overwriting the pivot's
    // rotation outright would snap away the tree's yaw on the first frame, and
    // overwriting the model's scale would snap it to full size — both are
    // already carrying values from addTrees.
    const upright = tree.pivot.quaternion.clone();
    const grown = model.scale.clone();
    const tilt = new THREE.Quaternion();

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      const k = Math.min(elapsed / CHOP.fall, 1);
      // Accelerating, because a tree does not topple at a constant rate — it
      // hinges slowly off the stump and then goes over all at once.
      tilt.setFromAxisAngle(axis, (Math.PI / 2) * k * k);
      tree.pivot.quaternion.copy(tilt).multiply(upright);

      if (elapsed < CHOP.fall + CHOP.linger) return true;

      const shrink = (elapsed - CHOP.fall - CHOP.linger) / 0.3;
      model.scale.copy(grown).multiplyScalar(Math.max(0.0001, 1 - shrink));
      if (shrink < 1) return true;

      tree.pivot.removeFromParent();
      return false;
    });

    this.flyLog(tree.pivot.position.clone());
  }

  /** One log arcing from a felled tree to the bridge, and the count it feeds. */
  private flyLog(from: THREE.Vector3): void {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.woodTexture,
        transparent: true,
        depthTest: false, // it is feedback, not scenery
        depthWrite: false
      })
    );
    sprite.scale.setScalar(CHOP.logSize);
    sprite.renderOrder = 998;
    sprite.position.copy(from).setY(TREES.height * 0.4);
    this.scene.add(sprite);

    const to = new THREE.Vector3(STREAM.x, 0.6, BRIDGE.z);
    const start = sprite.position.clone();
    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      const k = Math.min(elapsed / CHOP.logFlight, 1);
      sprite.position.lerpVectors(start, to, k);
      sprite.position.y += Math.sin(k * Math.PI) * CHOP.arc; // lob, not a slide
      sprite.scale.setScalar(CHOP.logSize * (1 - k * 0.35)); // shrinks as it lands
      if (k < 1) return true;

      sprite.removeFromParent();
      (sprite.material as THREE.SpriteMaterial).dispose();
      this.wood++;
      if (this.wood >= this.trees.length) this.repairBridge();
      else this.pointAtNextTree();
      return false;
    });
  }

  /**
   * One soft round puff, drawn once and shared by every particle that needs it.
   * Painted here rather than imported: it is a radial gradient, which costs a
   * dozen lines and nothing in the bundle, against a PNG that would cost
   * kilobytes and still only be a radial gradient.
   */
  private puffTexture(): THREE.Texture {
    if (this.puff) return this.puff;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const half = size / 2;
      const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.8, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }

    this.puff = new THREE.CanvasTexture(canvas);
    this.puff.colorSpace = THREE.SRGBColorSpace;
    return this.puff;
  }

  /** Enough wood: a poof of smoke swallows the wreck and leaves the new span. */
  private repairBridge(): void {
    const broken = this.bridgeBroken;
    const restored = this.bridgeRestored;
    if (!restored) return;

    const poof = BRIDGE.poof;
    const centre = new THREE.Vector3(STREAM.x, 0.35, BRIDGE.z);

    const puffs = Array.from({ length: poof.puffs }, (_, i) => {
      const material = new THREE.SpriteMaterial({
        map: this.puffTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false // smoke reads as being in front of the bridge, not in it
      });
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 997;

      // A ring around the deck, stretched along the span so the smoke covers a
      // bridge rather than a ball. Sizes and delays vary per puff, or the seven
      // of them bloom as one disc.
      const angle = (i / poof.puffs) * Math.PI * 2;
      const reach = poof.spread * (0.55 + jitter(i, 31) * 0.6);
      sprite.position.set(
        centre.x + Math.cos(angle) * reach * 1.15,
        centre.y,
        centre.z + Math.sin(angle) * reach * 0.8
      );
      sprite.scale.setScalar(0.001);
      this.scene.add(sprite);

      return {
        sprite,
        material,
        delay: jitter(i, 32) * 0.1,
        size: poof.size * (0.7 + jitter(i, 33) * 0.6),
        rise: poof.rise * (0.6 + jitter(i, 34) * 0.8),
        baseY: centre.y
      };
    });

    restored.scale.setScalar(0.001);
    let elapsed = 0;
    let swapped = false;

    this.effects.push((delta: number) => {
      elapsed += delta;

      puffs.forEach((p) => {
        const k = THREE.MathUtils.clamp((elapsed - p.delay) / BRIDGE.repair, 0, 1);
        if (k <= 0) return;
        // Out fast, then hang and thin away — smoke, not a balloon.
        const grow = 1 - Math.pow(1 - k, 3);
        p.sprite.scale.setScalar(Math.max(0.001, p.size * grow));
        p.sprite.position.y = p.baseY + p.rise * grow;
        p.material.opacity = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
      });

      // The swap itself, at full cover. This is the whole point of the poof:
      // there is no transition to look at, so there is none to get wrong.
      if (!swapped && elapsed >= poof.swap) {
        swapped = true;
        if (broken) broken.visible = false;
        restored.visible = true;
      }

      if (swapped) {
        const k = THREE.MathUtils.clamp((elapsed - poof.swap) / poof.pop, 0, 1);
        // Back-out, so it lands into place instead of merely arriving.
        const c1 = 1.70158;
        const eased = 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
        restored.scale.setScalar(Math.max(0.001, eased));
      }

      if (elapsed < BRIDGE.repair + 0.15) return true;

      puffs.forEach((p) => {
        p.sprite.removeFromParent();
        p.material.dispose();
      });
      restored.scale.setScalar(1);
      if (broken) broken.removeFromParent();
      this.say(SPEECH_LINES.cross, 3.5); // this one is a payoff, so it times out

      // A beat to see what they built, then over they go.
      let waited = 0;
      this.effects.push((wait: number) => {
        waited += wait;
        if (waited < CROSSING.delay) return true;
        this.crossBridge();
        return false;
      });
      return false;
    });
  }

  /**
   * Put a line above the next character's head, telling the player what to do.
   * The speaker alternates on every call, so the two of them take turns.
   *
   * @param hold seconds to stay up; 0 leaves it until the next line replaces it
   */
  private say(text: string, hold = 0): void {
    if (!this.actions.length) return;

    const speaker = this.actions[this.speaker % this.actions.length];
    this.speaker++;

    // The bubble art has to be decoded before it can be drawn into a canvas.
    // It is a data URI so this is quick, but the first line goes up early.
    if (!this.bubbleImage) {
      this.effects.push(() => {
        if (!this.bubbleImage) return true;
        this.showSpeech(speaker, text, hold);
        return false;
      });
      return;
    }

    this.showSpeech(speaker, text, hold);
  }

  /** Draw the line into the bubble and hang it off the speaker. */
  private showSpeech(
    speaker: IslandScene['actions'][number],
    text: string,
    hold: number
  ): void {
    const image = this.bubbleImage;
    if (!image) return;

    this.hideSpeech(); // one at a time

    // Drawn at twice the art's size so the words stay crisp — the bubble is
    // only 197px wide but covers a good part of a phone screen.
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = SPEECH.colour;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shrink until the longest line clears the body. The body is only ~79% of
    // the art's width, so a line set by eye overruns the bubble's edge easily.
    // Height is measured against the PRE-STRETCHED block, since the drawing
    // below is 1/squash taller than the font size before the sprite squashes it
    // back.
    const lines = text.split('\n');
    const maxWidth = SPEECH.body.width * canvas.width;
    const maxHeight = SPEECH.body.height * canvas.height;
    let size = SPEECH.fontSize * scale;
    while (size > 8) {
      ctx.font = `bold ${size}px ${SPEECH.fontStack}`;
      const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
      const tall = (lines.length * size * SPEECH.lineSpacing) / SPEECH.squash;
      if (widest <= maxWidth && tall <= maxHeight) break;
      size -= 1;
    }

    // Drawn stretched by exactly the amount the sprite is about to squash, so
    // the letters land unsquashed on screen.
    const midX = (SPEECH.body.x + SPEECH.body.width / 2) * canvas.width;
    const midY = (SPEECH.body.y + SPEECH.body.height / 2) * canvas.height;
    const step = size * SPEECH.lineSpacing;
    ctx.save();
    ctx.translate(midX, midY);
    ctx.scale(1, 1 / SPEECH.squash);
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * step);
    });
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false, // UI: it sits over the scene, never inside it
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 996; // under the pointing hand, over everything else
    // The squash lives here, on the sprite, which is why the text had to be
    // drawn pre-stretched above.
    const height = (SPEECH.width * image.height * SPEECH.squash) / image.width;
    sprite.scale.set(SPEECH.width, height, 1);
    this.scene.add(sprite);
    this.speech = sprite;

    // A sprite always faces the camera, so it is laid out along the CAMERA's
    // axes, not the world's — the camera is tilted 20°, and using world up here
    // would slide the bubble off the speaker's head as it rose.
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);

    // From the tail tip to the middle of the sprite. The tip goes on the
    // speaker; this puts everything else where it belongs relative to it.
    const fromTail = new THREE.Vector3()
      .addScaledVector(right, (0.5 - SPEECH.tail.x) * SPEECH.width)
      .addScaledVector(up, (0.5 - SPEECH.tail.y) * height);

    let elapsed = 0;
    let closing = false;
    this.effects.push((delta: number) => {
      elapsed += delta;

      // Follow the speaker: they run, and the bubble goes with them. The tail
      // tip sits beside their face and the bubble hangs off that, so it reads
      // as speech coming out of them rather than a label over their head.
      sprite.position
        .copy(speaker.pivot.position)
        .add(new THREE.Vector3(0, speaker.height * SPEECH.faceHeight, 0))
        .addScaledVector(right, SPEECH.faceGap)
        .add(fromTail);

      if (this.speech !== sprite) closing = true; // a newer line took over
      if (hold > 0 && elapsed > hold) closing = true;

      if (!closing) {
        material.opacity = Math.min(elapsed / SPEECH.fade, 1);
        return true;
      }

      material.opacity -= delta / SPEECH.fade;
      if (material.opacity > 0) return true;

      sprite.removeFromParent();
      material.dispose();
      texture.dispose();
      if (this.speech === sprite) this.speech = undefined;
      return false;
    });
  }

  /** Let the current line fade itself out on its next frame. */
  private hideSpeech(): void {
    this.speech = undefined;
  }

  /** Move the hand to whichever tree is still standing. */
  private pointAtNextTree(): void {
    const next = this.trees.find((tree) => !tree.chopped);
    if (next) this.showTapHint(next.centre, next.top);
  }

  /**
   * Break the tapped rock: it shrinks away, throws a handful of chunks that
   * arc out and land, and the path swells up in the gap it leaves.
   */
  private breakRubble(): void {
    if (!this.breakable || this.breakable.broken || !this.rubbleMaterial) return;

    const { angle, index } = this.breakable;
    this.breakable.broken = true;
    this.renderer.domElement.style.cursor = '';
    this.hideTapHint();

    // Debris shares one clone of the rock material: cloned so fading it cannot
    // drag the standing rocks down with it, shared so the fade is one write.
    const material = this.rubbleMaterial.clone();
    material.transparent = true;

    // The tap takes its neighbours with it, so the opening is wide enough for
    // two to run through abreast — one rock leaves a 1.1u gap and the pair is
    // 1.5u across, which put a rock through each of them.
    for (let offset = -RUBBLE_BREAK.spread; offset <= RUBBLE_BREAK.spread; offset++) {
      const target = this.rocks[index + offset];
      if (target) this.shatterRock(target.pivot, target.rock, material, index + offset);
    }
    // One fade for all of them, run off the widest rock's timeline.
    let fading = 0;
    this.effects.push((delta: number) => {
      fading += delta;
      const fade = (fading - RUBBLE_BREAK.shatter * 0.6) / (RUBBLE_BREAK.shatter * 0.4);
      material.opacity = 1 - THREE.MathUtils.clamp(fade, 0, 1);
      if (fading < RUBBLE_BREAK.shatter) return true;
      material.dispose();
      return false;
    });

    this.startRunning();
    this.growPath(angle);
  }

  /** One rock coming apart: it shrinks away and throws a handful of chunks. */
  private shatterRock(
    pivot: THREE.Group,
    rock: THREE.Object3D,
    material: THREE.MeshStandardMaterial,
    seed: number
  ): void {
    // Chunks leave from mid-rock rather than from the ground, so the burst
    // reads as the rock coming apart instead of erupting out of the grass.
    const rockHeight = new THREE.Box3().setFromObject(pivot).getSize(new THREE.Vector3()).y;

    const chunks = Array.from({ length: RUBBLE_BREAK.debris }, (_, n) => {
      const i = n + seed * RUBBLE_BREAK.debris; // so neighbours do not burst alike
      const chunk = rock.clone(true);
      chunk.scale.multiplyScalar(RUBBLE_BREAK.debrisScale);
      chunk.position.multiplyScalar(RUBBLE_BREAK.debrisScale); // keep it centred as it shrinks
      chunk.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
      });

      // Thrown evenly around the compass, with the speeds varied per chunk so
      // they do not travel as one ring.
      const heading = (n / RUBBLE_BREAK.debris) * Math.PI * 2;
      const speed = RUBBLE_BREAK.debrisSpeed * (0.6 + jitter(i, 4) * 0.8);
      const holder = new THREE.Group();
      holder.position.copy(pivot.position);
      holder.position.y += rockHeight * 0.45;
      holder.add(chunk);
      this.scene.add(holder);

      return {
        holder,
        velocity: new THREE.Vector3(
          Math.sin(heading) * speed,
          RUBBLE_BREAK.debrisLift * (0.7 + jitter(i, 5) * 0.6),
          Math.cos(heading) * speed
        ),
        spin: new THREE.Vector3(jitter(i, 6) - 0.5, jitter(i, 7) - 0.5, jitter(i, 8) - 0.5)
          .multiplyScalar(12)
      };
    });

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;

      // The rock drops out from under the debris over the first part of it.
      pivot.scale.setScalar(Math.max(0, 1 - elapsed / RUBBLE_BREAK.collapse));

      chunks.forEach(({ holder, velocity, spin }) => {
        velocity.y -= RUBBLE_BREAK.gravity * delta;
        holder.position.addScaledVector(velocity, delta);
        if (holder.position.y <= 0) {
          holder.position.y = 0;
          velocity.set(0, 0, 0); // landed, and it stays where it landed
        }
        holder.rotation.x += spin.x * delta;
        holder.rotation.y += spin.y * delta;
        holder.rotation.z += spin.z * delta;
      });

      if (elapsed < RUBBLE_BREAK.shatter) return true;

      chunks.forEach(({ holder }) => this.scene.remove(holder));
      pivot.removeFromParent();
      return false;
    });
  }

  /** Swell the path into the gap, lined up with the arc's radius. */
  private growPath(angle: number): void {
    const path = this.path;
    if (!path || !this.breakable) return;

    path.position.set(this.breakable.pivot.position.x, RUBBLE_PATH.lift, this.breakable.pivot.position.z);
    path.rotation.y = angle + THREE.MathUtils.degToRad(RUBBLE_PATH.yawOffsetDeg);
    path.scale.setScalar(0.0001);
    path.visible = true;

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      const step = (elapsed - RUBBLE_PATH.delay) / RUBBLE_PATH.grow;
      if (step <= 0) return true;

      const k = Math.min(step, 1);
      // Back-out easing: overshoots a touch on the way in, so it lands rather
      // than simply arriving. The constants are the usual easeOutBack ones.
      const c1 = 1.70158;
      const eased = 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
      path.scale.setScalar(Math.max(0.0001, eased));

      if (k < 1) return true;
      path.scale.setScalar(1);
      return false;
    });
  }

  /** Heave and rock, so the moored boat rides the sea instead of sitting in it. */
  private floatBoat(elapsed: number): void {
    if (!this.boat) return;

    const { pivot, rock } = this.boat;
    pivot.position.y = WATER_Y + Math.sin(elapsed * BOAT_BOB.heaveRate) * BOAT_BOB.heave;
    // Local X is the hull's long axis (the FBX is 396 units along x, 257 across),
    // so x tips the boat side to side and z lifts the bow.
    rock.rotation.x =
      THREE.MathUtils.degToRad(BOAT_BOB.rollDeg) * Math.sin(elapsed * BOAT_BOB.rollRate);
    rock.rotation.z =
      THREE.MathUtils.degToRad(BOAT_BOB.pitchDeg) * Math.cos(elapsed * BOAT_BOB.pitchRate);
  }

  /** Orthographic frustum that fits the current zoom on any aspect ratio. */
  private updateCamera(): void {
    const aspect = this.width / this.height;
    const halfH = this.fitRadius / Math.min(1, aspect);
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  private animate(): void {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.animate);

    const now = performance.now();
    // The water and the boat run off elapsed time so they cannot drift apart;
    // the mixers need a per-frame delta, clamped so a backgrounded tab does not
    // hand them a multi-second jump and fast-forward the idles.
    const elapsed = (now - this.startMs) / 1000;
    const delta = Math.min((now - this.lastMs) / 1000, 0.1);
    this.lastMs = now;

    this.water.update(elapsed);
    this.floatBoat(elapsed);
    this.mixers.forEach((mixer) => mixer.update(delta));
    this.driveRunners(delta);
    // Effects spawn effects: the last log landing starts the bridge repair, the
    // arrival move starts the hand. Filtering this.effects in place would drop
    // every one of those — a push during the pass lands on the array being
    // filtered, which filter never revisits, and the filtered copy then replaces
    // it. So the list is detached first, and survivors go back on top of
    // whatever accumulated while it ran.
    const running = this.effects;
    this.effects = [];
    running.forEach((effect) => {
      if (effect(delta)) this.effects.push(effect);
    });
    this.renderer.render(this.scene, this.camera);
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
    this.updateCamera();
  }

  public pause(): void {
    this.running = false;
  }

  public resume(): void {
    if (this.running) return;
    this.running = true;
    this.lastMs = performance.now(); // drop the paused stretch instead of replaying it
    this.rafId = requestAnimationFrame(this.animate);
  }

  public destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
