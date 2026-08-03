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
// The cow, and the one model here that is NOT one of the farm's own GLBs: it is
// Cow-Anim2.fbx put through scripts_fbx2glb.mjs, so flipY TRUE like the two
// characters, not the FALSE that A_Cow_Angus.glb wanted. It replaces that file
// because its take carries a walk and a run as well as the idle/eat/happy —
// which is what lets her come along instead of being left behind. Costs 130 KB
// more in the bundle (383 KB against 253).
import cowSrc from 'assets/models/Cow-Anim2.glb';
import cowTextureSrc from 'assets/images/A_Cow_Shorthorn.jpg';
// Farm plot, same convention as the tree and the cow: flipY FALSE. It carries
// BOTH halves of the farming beat in one file — a flat tilled bed on the
// buildings atlas, with the finished wheat as a child node on the crop atlas —
// so empty farmland is that child hidden and planting is it shown.
// (assets/models/PlotWheat (1).glb is a byte-identical duplicate of this and can
// be deleted.)
import plotSrc from 'assets/models/PlotWheat.glb';
import cropTextureSrc from 'assets/images/Crops_Texture.png';
import wheatSrc from 'assets/images/Wheat.png';
import appleSrc from 'assets/images/Apple.png';
import carrotSrc from 'assets/images/Carrot.png';
// Scenery. Every one of these is ALREADY imported by src/config/fbxModels.js for
// the farm scene, so bundling them here is free — webpack hands the same module
// to both, and the playable's one file carries each GLB once. Which atlas each
// asks for, and flipY FALSE for all of them, is taken from that same config
// rather than guessed: it is the farm's own binding table.
import bushDarkSrc from 'assets/models/Bush_Dark.glb';
import bushLightSrc from 'assets/models/Bush_Light.glb';
import grassSmallSrc from 'assets/models/GrassSmall.glb';
import grassMediumSrc from 'assets/models/Grass_Medium.glb';
import grassFancySrc from 'assets/models/Grass_Fancy.glb';
import flowersSrc from 'assets/models/Flowers_Growing.glb';
import flowerGrassSrc from 'assets/models/FlowerGrass.glb';
import birchSrc from 'assets/models/BirchTree.glb';
import acaciaSrc from 'assets/models/Acacia.glb';
import treeDenseSrc from 'assets/models/Tree_Dense.glb';
import rocksSrc from 'assets/models/Rocks.glb';
import scarecrowSrc from 'assets/models/Scarecrow.glb';
// The barn the last beat puts right: Barn.fbx through scripts_fbx2glb.mjs, so
// flipY TRUE like the characters and the cow — NOT the flipY false the farm's own
// GLBs want. Its material asks for Buildings_B, i.e. the buildings atlas. One mesh,
// 2493 verts, 51 KB quantized, and authored Y-up so it needs no righting.
import barnSrc from 'assets/models/Barn.glb';
import pointerSrc from 'assets/images/PointerHand.png';
import hammerSrc from 'assets/images/props/Hammer.png';
import axeSrc from 'assets/images/props/Axe.png';
import broomSrc from 'assets/images/props/broom.png';
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

// The stone blocker asks WHICH tool before it will break: two white buttons at
// the bottom of the screen, hammer and broom, with the hand on the one that
// works. This one beat is DOM rather than a world sprite — it is a HUD pinned to
// the screen, not something standing in the world, and the browser already lays
// a row of buttons out and rounds their corners for free. Sizes are in vmin so
// the row holds its proportions on any screen the ad lands on.
const TOOL_CHOICE = {
  button: 'min(22vmin, 130px)', // square white button
  icon: '72%', // of the button, leaving a margin inside it
  gap: '5vmin', // between the two
  bottom: '7vmin', // clear of the screen edge and any store furniture
  radius: '3vmin',
  fade: 250, // ms, in and again once one is picked
  // The pointing hand, as a fraction of the button. Its fingertip is at the top
  // edge of its own PNG, so it hangs BELOW the button and points up at it —
  // over the button it would hide the very icon the player has to read.
  hand: 0.9,
  hint: 1200, // ms before the hand appears, matching TAP_HINT.delay
  shake: 400 // ms the wrong tool wobbles for
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
  arc: 1.6, // how high the log lifts on the way, world units
  stagger: 0.35 // seconds between trees when the axe takes the whole stand —
  // felling them on the same frame reads as one event, not three
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

// Off the bridge and on. The far bank has a cow penned in behind a stand of
// trees; clearing them lets it out.
//
// Everything here hangs off COW_STOP, which is worked out the same way the
// crossing is: the deck's far end is STREAM.x + half the span, they carry on
// CROSSING.beyond past it, then walk FORWARD.distance further. So moving the
// stream or the run moves this whole scene with it.
const FORWARD = {
  distance: 2, // world units off the end of the bridge
  headingDeg: 90 // straight along +X, which is where the far bank opens up
};

const COW_STOP = {
  x: STREAM.x + BRIDGE.span / 2 + CROSSING.beyond + FORWARD.distance,
  z: BRIDGE.z // the two lanes sit either side of it, so their middle is on it
};

// The cow. Its take is one 391-frame baked clip, split the way the farm's own
// config splits it — idle, eating, then happy at the end.
const COW = {
  height: 0.78, // 0.87x a character: a cow's head is a little below a person's
  offset: { x: 3.5, z: -0.5 }, // from COW_STOP
  yawDeg: 250, // turned back towards the pair, so it is looking at them
  // Frame ranges in Cow-Anim2's single 441-frame take, all verified against the
  // converted GLB rather than taken on trust:
  //   1-156    still, ears and tail only          -> idle
  //   157-300  head down, neck working            -> eating (not used here)
  //   309-372  bobbing on the spot                -> happy
  //   392-410  19-frame leg cycle, upright        -> the faster gait, run
  //   411-441  31-frame leg cycle, PITCHED 90deg  -> the slower gait, walk
  // 373-391 is a dead-still tail, which is why happy stops at 372 and not at the
  // 391 the old asset's config used — looping through those frames put a
  // half-second hold in the middle of the celebration.
  idle: { startFrame: 1, endFrame: 156 },
  happy: { startFrame: 309, endFrame: 372 },
  run: { startFrame: 392, endFrame: 410 },
  walk: { startFrame: 411, endFrame: 441 },
  // The walk is authored Z-UP inside a Y-up take — the same mistake the wheat
  // carries — so it plays with the cow pitched nose-down and her hooves 0.08
  // BELOW the grass. Counter-rotating the root bone recovers it exactly: 5.9 deg
  // of body tilt and the lowest hoof 0.022 above the grass, which is what the
  // other clips measure. Set this to 0 if the FBX ever gets re-exported upright.
  walkUprightDeg: -90,
  // How fast she travels, against how fast her legs were authored to cycle.
  //
  // The two cycles only carry a 0.19u foot excursion, which is a footfall speed
  // of 0.30 u/s running and 0.13 walking — a third of what a character does.
  // Holding station behind a pair that runs at 1.3 therefore has to give
  // somewhere: at the authored rate her legs would barely move, and at the rate
  // that matches her ground speed exactly (3.8x) they blur. gaitRate 2 is the
  // compromise, and it is the knob — the feet slide the rest of the way, which
  // at this camera distance is not something the eye picks up.
  walkSpeed: 0.75,
  runSpeed: 1.15, // a shade under a character's, so she trails rather than leads
  gaitRate: 2,
  joinGap: 1.15, // how close she comes before settling
  settle: 0.2, // ...and how much slack in that before she bothers to move again
  chase: 2.2, // how far behind she has to fall before breaking into the run
  cheer: 1.1, // seconds of celebrating before she comes over
  blend: 0.25 // crossfade between her gaits
};

// The trees penning it in: a straight LINE running top to bottom of the screen,
// with the cow standing behind it. The pair arrives from screen-left, so the
// line is set off to the cow's left and stands between them and her.
//
// The line is laid along the ground direction that projects to screen-VERTICAL,
// which at this camera is not a world axis — see screenAxes below. That is what
// keeps it a clean vertical bar however the yaw is retuned.
const COW_TREES = {
  height: 1.6, // a touch shorter than the wood grove, so the cow clears them
  count: 4,
  // Between trunks along the line. This axis runs INTO the screen, and at
  // VIEW_ELEV_DEG 20 a unit of it is only sin(20) = 0.34 of a unit up the
  // screen — so ground spacing has to be about three times what it should look
  // like. 2 puts 0.68 of clear screen between trunks, which is what keeps the
  // four countable (the beat is four taps) instead of one stacked clump.
  spacing: 2,
  standoff: 1.7, // how far the line stands to the cow's screen-LEFT
  shift: 0, // slides the whole line up (-) or down (+) the screen, if the cow
  // ends up level with a trunk rather than a gap
  // A trunk already down at the foot of the line, leaning on the last tree. It
  // is what makes the cow read as penned in rather than just standing behind
  // some trees — and it is NOT one of the four, so freeing her is still four
  // taps.
  fallen: { onto: 3, deg: 58 }
};

/**
 * The two ground directions that project to screen DOWN and screen RIGHT at the
 * current camera yaw. A function, not a constant, because VIEW_YAW_DEG is
 * declared further down the file and would still be in its dead zone here —
 * every caller runs long after the module has finished loading.
 */
function screenAxes(): { down: { x: number; z: number }; right: { x: number; z: number } } {
  const az = THREE.MathUtils.degToRad(VIEW_YAW_DEG);
  return {
    down: { x: Math.cos(az), z: Math.sin(az) },
    right: { x: Math.sin(az), z: -Math.cos(az) }
  };
}

/** The line, handed back as offsets from COW_STOP like every other placement. */
function cowTreeOffsets(): Array<{ x: number; z: number }> {
  const { down, right } = screenAxes();
  return Array.from({ length: COW_TREES.count }, (_, i) => {
    // Centred on the cow, so she sits behind the middle of the line rather than
    // off one end of it.
    const along = (i - (COW_TREES.count - 1) / 2) * COW_TREES.spacing + COW_TREES.shift;
    return {
      x: COW.offset.x - right.x * COW_TREES.standoff + down.x * along,
      z: COW.offset.z - right.z * COW_TREES.standoff + down.z * along
    };
  });
}

// The shot for that beat, solved from the screen bounds of the pair, the trees
// and the cow — same method as ARRIVAL.
const COW_SHOT = {
  fit: FIT_RADIUS,
  offset: { x: 2.02, z: -1.61 }, // from COW_STOP; re-solved for the ring
  ease: 1
};

// The last beat: a patch of empty farmland, three crops to choose from, and the
// field filling with wheat.
//
// They walk DOWN-SCREEN to get there, near enough at the camera — see farmLeg
// below. That is not decoration: the cow settles a cow's length off their +X
// shoulder when she joins them, which is exactly where a walk along +X would take
// them, so heading down the screen is what keeps them from walking through her.
// It also turns their faces to the lens for the beat the player has to read.
const FARM = {
  // Where the field sits, measured in SCREEN directions from where the cow was
  // freed: down the screen and off to the screen-RIGHT, which puts it past the
  // cow's stand rather than alongside it.
  //
  // Both numbers are large because that stand runs DOWN the screen (see
  // COW_TREES) with its fallen trunk at the foot, so clearing it means getting
  // past the end of a line, not stepping around one prop. The four trees are
  // felled and gone by the time this beat starts; the trunk is scenery and stays,
  // so it is what the placement is solved against — these values leave 1.6 world
  // units between it and the nearest bed, and no bed is closer than 1.6 to
  // anything. The cost is the walk: about 6.2u, near enough five seconds. Pull
  // both numbers down together to trade that back (1u of walk per ~0.2 of trunk
  // clearance, so it goes quickly).
  down: 6.8,
  right: 4.5,
  // How far short of the field's middle they pull up, so they stand at the edge
  // of the soil rather than in it. 2.5 rather than the ~1.7 the beds actually
  // measure: the walk now comes in DIAGONALLY across a field squared to the world
  // axes, so its near CORNER is what they meet, and the lane offset carries one of
  // them another swing sideways into it. At 1.9 that character finished the walk
  // standing in the wheat.
  ahead: 2.5,
  // One plot's width, in world units. The bed is authored 4.4 across with its
  // wheat 2.9 tall, so the crop always stands 0.65x this — at 1.2 that is 0.78,
  // about shoulder height on a 0.9 character, which is what real wheat does.
  plot: 1.2,
  cols: 2,
  rows: 2,
  gap: 0.12, // between beds, so the field reads as plots and not as one mat
  // The bed is a flat quad with no thickness at all, so on the grass exactly it
  // z-fights with it — held the same hair above it the rubble path is (spelt out
  // rather than read off RUBBLE_PATH, which is declared further down the file).
  lift: 0.004,
  // The wheat inside the GLB is authored Z-UP in a Y-up scene (its own longest
  // axis runs along z), so it arrives lying flat. This stands it up. The knob is
  // here rather than inline in case the art gets re-exported the right way up:
  // 0 then, and nothing else changes.
  cropUprightDeg: 90,
  delay: 0.6, // seconds after the cow settles before they set off
  grow: 0.45, // seconds for one plot's crop to spring up
  stagger: 0.12, // between plots, so the field FILLS instead of blinking on
  // The shot, solved like ARRIVAL and COW_SHOT — but as a FRACTION of the way
  // from where they stop to the middle of the field, not a fixed offset: the
  // field is off to one side, so a fixed down-screen offset framed the pair
  // nicely and hung the far beds off the frame edge. 0.7 leans the shot towards
  // the field, which is what balances the two: the beds are wide and the pair is
  // narrow, so splitting the difference down the middle wasted half the frame on
  // two characters. Solved against the screen bounds — at 0.7 the widest bed
  // corner sits 2.08 into the 2.5 half-width, with the pair still inside it.
  fit: FIT_RADIUS,
  shot: 0.7,
  ease: 1
};

// The last beat: a barn standing broken past the farmland, which the same axe and
// the same timber put right.
//
// It is the BRIDGE beat again, and deliberately so — chop a stand, the logs fly
// in, a poof of smoke covers the change — so it runs on the same machinery rather
// than a copy of it. The one thing the barn cannot borrow is the bridge's second
// model: there is no broken barn in the pack, so "broken" is the barn itself
// leaning over with its planks on the ground, and the repair stands it back up.
const BARN = {
  // Where it sits, in screen directions from the middle of the wheat: down-screen
  // and well over to the LEFT, which is not a look but a route. The pair pulls up
  // 0.55 off the near corner of the beds, so a barn anywhere down-screen of them
  // puts the WHEAT on the straight line to it — solving the whole screen plane for
  // a spot they can reach without walking over the crop leaves only this band. At
  // -5.25 they pass the left edge of the field with 0.54 to spare, on a 4.2u walk;
  // moving it back towards the field trades that clearance away fast.
  down: 3.75,
  right: -5.25,
  ahead: 2.8, // how far short of it they pull up
  // Height in world units: 2.3x a character, which is what a barn should be next
  // to the people using it.
  height: 2.1,
  // Its widest horizontal against that height, measured off the model (18.0 across
  // by 20.8 tall). The scenery scatter needs the barn's footprint BEFORE the model
  // has loaded — it settles every position up front — so this cannot be measured
  // at load time like the scale is.
  spread: 18.02 / 20.83,
  // Turned so its LONG side faces the camera. This model runs its 18 units along
  // its own X and only 13 across, so 25 degrees is what lays that length along the
  // screen at a 65-degree camera. Tune it if the doors end up round the back.
  yawDeg: 25,
  // Broken: leaning, and settled into the ground at the low corner. The lean is
  // about the screen-DOWN axis, which is what tips it left-right on screen where
  // it reads; tipping it about the other axis only foreshortens it.
  tiltDeg: 9,
  sink: 0.12,
  // Planks on the ground at its foot, so the lean reads as damage rather than as
  // a badly placed barn. Sprites of the same Wood.png the logs are drawn with —
  // no model, no material, nothing new in the bundle.
  planks: [
    { r: 0.75, d: 0.95, size: 0.42, spin: 18 },
    { r: -0.95, d: 0.7, size: 0.36, spin: -35 },
    { r: 0.15, d: 1.25, size: 0.3, spin: 62 }
  ],
  // The stand that pays for it, as screen offsets from the barn. Every one is
  // UP-screen (negative d): a tree down-screen of the barn draws its canopy
  // straight over it, which is the trap TREES.offsets and SCENERY both document.
  trees: [
    { r: 1.7, d: -0.5 },
    { r: 2.3, d: -2.0 },
    { r: 0.9, d: -2.8 }
  ],
  treeHeight: 1.8,
  delay: 1.4, // seconds after the wheat comes up before they move on
  // The shot. It holds the scene's own zoom like every other beat — the barn, its
  // three trees and both characters come to 2.14 of the 2.5 half-width, so there
  // is nothing to open out for.
  fit: FIT_RADIUS,
  shot: 0.4,
  ease: 1,
  // The repair, same shape as the bridge's: smoke out, the change under cover of
  // it, and it settles as the smoke thins.
  repair: 0.7,
  straighten: 0.45, // seconds for it to come upright once the smoke is thick
  poof: { puffs: 9, size: 1.35, spread: 1.5, rise: 0.55, swap: 0.16 }
};

/** Where the barn stands. A function for the usual reason: it reads screenAxes. */
function barnAt(): { x: number; z: number } {
  const { down, right } = screenAxes();
  const field = farmField();
  return {
    x: field.x + down.x * BARN.down + right.x * BARN.right,
    z: field.z + down.z * BARN.down + right.z * BARN.right
  };
}

/** The walk from the farmland to it, pulled up BARN.ahead short. */
function barnLeg(): {
  heading: number;
  distance: number;
  stop: { x: number; z: number };
} {
  const from = farmLeg().stop;
  const barn = barnAt();
  const dx = barn.x - from.x;
  const dz = barn.z - from.z;
  const length = Math.hypot(dx, dz);
  const distance = length - BARN.ahead;

  return {
    heading: Math.atan2(dx, dz),
    distance,
    stop: { x: from.x + (dx / length) * distance, z: from.z + (dz / length) * distance }
  };
}

/** Screen offsets round the barn, handed back as world points. */
function barnSpots(spots: Array<{ r: number; d: number }>): Array<{ x: number; z: number }> {
  const { down, right } = screenAxes();
  const barn = barnAt();
  return spots.map((s) => ({
    x: barn.x + right.x * s.r + down.x * s.d,
    z: barn.z + right.z * s.r + down.z * s.d
  }));
}

/**
 * The middle of the field. A function rather than a constant for the same reason
 * cowTreeOffsets is one: screenAxes reads VIEW_YAW_DEG, which is declared
 * further down the file and would still be in its dead zone up here.
 */
function farmField(): { x: number; z: number } {
  const { down, right } = screenAxes();
  return {
    x: COW_STOP.x + down.x * FARM.down + right.x * FARM.right,
    z: COW_STOP.z + down.z * FARM.down + right.z * FARM.right
  };
}

/**
 * The walk that gets them there: one straight line from where the cow was freed
 * to the middle of the field, pulled up FARM.ahead short of it. Everything about
 * the leg comes off that line, so moving the field moves the walk, the heading
 * and the shot with it — there is no second place to retune.
 */
function farmLeg(): {
  heading: number;
  distance: number;
  stop: { x: number; z: number };
} {
  const field = farmField();
  const dx = field.x - COW_STOP.x;
  const dz = field.z - COW_STOP.z;
  const length = Math.hypot(dx, dz);
  const distance = length - FARM.ahead;

  return {
    heading: Math.atan2(dx, dz), // models face +Z, so this is their yaw too
    distance,
    stop: {
      x: COW_STOP.x + (dx / length) * distance,
      z: COW_STOP.z + (dz / length) * distance
    }
  };
}

// Dressing the empty grass, so the island reads as a place rather than a lawn
// with four props on it.
//
// Everything is scattered by rejection sampling against the PLAY AREA: the whole
// route from where the pair starts to the farmland is fenced off as a set of
// capsules (see keepClear), and a candidate that lands inside one, in the stream,
// on the beach, or on top of a prop already placed is thrown away and another
// tried. So this fills whatever is left over — which means the beats can all be
// retuned without a single scenery position needing to move.
//
// heights are in world units against a 0.9-unit character, like every other prop
// here. atlas is which of the two bound textures the model's material asks for.
const SCENERY = {
  margin: 1.3, // in from the grass edge, so nothing stands on the beach
  spacing: 0.5, // between two props, measured on their footprints
  clear: 0.8, // extra breathing room added to every play-area capsule
  tries: 60, // candidates per prop before giving up on it
  // ponytail: one mesh per prop, ~90 of them, no instancing. Three frustum-culls
  // them so only what is on screen costs anything, and at this size that is
  // 20-40 draws. If it ever shows on a low-end phone, the grass is the half of
  // the list worth turning into an InstancedMesh — the trees are too few to care.
  props: [
    { src: bushDarkSrc, atlas: 'vegetation', height: 0.5, count: 8, salt: 40 },
    { src: bushLightSrc, atlas: 'vegetation', height: 0.45, count: 8, salt: 41 },
    { src: grassSmallSrc, atlas: 'vegetation', height: 0.28, count: 14, salt: 42 },
    { src: grassMediumSrc, atlas: 'buildings', height: 0.34, count: 10, salt: 43 },
    { src: grassFancySrc, atlas: 'buildings', height: 0.4, count: 8, salt: 44 },
    { src: flowersSrc, atlas: 'vegetation', height: 0.26, count: 10, salt: 45 },
    { src: flowerGrassSrc, atlas: 'vegetation', height: 0.3, count: 8, salt: 46 },
    { src: birchSrc, atlas: 'vegetation', height: 2.1, count: 6, salt: 47 },
    { src: acaciaSrc, atlas: 'vegetation', height: 2.3, count: 4, salt: 48 },
    { src: treeDenseSrc, atlas: 'vegetation', height: 1.9, count: 6, salt: 49 },
    { src: rocksSrc, atlas: 'buildings', height: 0.45, count: 5, salt: 50 },
    { src: scarecrowSrc, atlas: 'buildings', height: 1.15, count: 1, salt: 51 }
  ]
};

/**
 * How far DOWN-SCREEN of a subject a prop can still stand and hide it, per unit
 * of the prop's height.
 *
 * A prop draws its canopy height * cos(elev) up the screen, while a unit of ground
 * travelled towards the camera only carries it sin(elev) down — so one unit of
 * height covers cos/sin, about 2.75 units of ground at this camera. That is why
 * the scatter makes a 2-unit tree keep five and a half units clear of a beat
 * rather than its own width, and it is the same trap TREES.offsets documents.
 *
 * A function, not a constant: VIEW_ELEV_DEG is declared further down the file.
 */
function screenReachPerHeight(): number {
  const elev = THREE.MathUtils.degToRad(VIEW_ELEV_DEG);
  return Math.cos(elev) / Math.sin(elev);
}

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
  tool: 'Pick a tool!', // both obstacles ask it, so both say it
  trees: 'Timber!',
  freeCow: 'Free the cow!',
  cowJoined: 'She\u2019s free!\nLet\u2019s go!',
  cross: "Bridge fixed!\nLet's go!",
  crop: 'Pick a crop!',
  planted: 'Wheat it is!',
  barnFixed: 'Barn\u2019s good\nas new!'
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

/**
 * Overshoots a touch and settles back, so a thing LANDS rather than merely
 * arriving. Used by everything here that springs into place — the path, the
 * repaired bridge, the crops. The constants are the standard easeOutBack ones.
 */
function easeOutBack(k: number): number {
  const c1 = 1.70158;
  return 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

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
 * Stand a clip back up.
 *
 * One stretch of the cow's take was authored Z-up inside a Y-up file, so it
 * plays with her pitched over on her nose. The whole error sits in the ROOT
 * bone's rotation, so composing the inverse onto that one track fixes the clip
 * and leaves every other bone — and every other clip cut from the same take —
 * untouched. subclip hands back a clone, so this cannot leak into the source.
 */
function unpitchClip(clip: THREE.AnimationClip, root: string, degrees: number): THREE.AnimationClip {
  if (!degrees) return clip;

  const track = clip.tracks.find((t) => t.name === `${root}.quaternion`);
  if (!track) {
    console.warn(`${clip.name}: no ${root}.quaternion to upright`);
    return clip;
  }

  const fix = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    THREE.MathUtils.degToRad(degrees)
  );
  const q = new THREE.Quaternion();
  for (let i = 0; i < track.times.length; i++) {
    q.fromArray(track.values as unknown as number[], i * 4)
      .premultiply(fix)
      .toArray(track.values as unknown as number[], i * 4);
  }

  return clip;
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
 * The play area, as capsules: a line from a to b with a radius, which covers a
 * plain circle too when a and b are the same point. Everything the player looks
 * at or walks through is in here, and the scenery scatter stays out of all of it.
 *
 * A function, not a constant: it reads farmLeg/farmField, which read screenAxes,
 * which reads VIEW_YAW_DEG from further down the file.
 */
function keepClear(): Array<{ ax: number; az: number; bx: number; bz: number; r: number }> {
  const { stop } = farmLeg();
  const field = farmField();
  const barn = barnAt();
  const barnStop = barnLeg().stop;
  const deckEnd = STREAM.x + BRIDGE.span / 2 + CROSSING.beyond;
  const spot = (x: number, z: number, r: number) => ({ ax: x, az: z, bx: x, bz: z, r });
  const lane = (
    a: { x: number; z: number },
    b: { x: number; z: number },
    r: number
  ) => ({ ax: a.x, az: a.z, bx: b.x, bz: b.z, r });

  return [
    // The opening shot: the pair, the ring of rubble and the moored boat.
    spot(RUBBLE_CENTRE.x, RUBBLE_CENTRE.z, RUBBLE.radius + 1.2),
    spot(BOAT.x, BOAT.z, 1.8),
    // The stream, bank to bank and all the way across the island, plus the bridge.
    lane({ x: STREAM.x, z: -ISLAND_HALF }, { x: STREAM.x, z: ISLAND_HALF }, STREAM.width / 2 + 0.5),
    spot(STREAM.x, BRIDGE.z, 2.2),
    // The run to the water, the wood grove it pays with, and the crossing.
    lane(RUBBLE_CENTRE, RUN_STOP, 1.6),
    ...TREES.offsets.map((o) => spot(RUN_STOP.x + o.x, RUN_STOP.z + o.z, 1.3)),
    lane({ x: deckEnd, z: BRIDGE.z }, COW_STOP, 1.6),
    // The cow's clearing: her pen, the stand that fenced her in, the fallen trunk.
    spot(COW_STOP.x, COW_STOP.z, 2.6),
    spot(COW_STOP.x + COW.offset.x, COW_STOP.z + COW.offset.z, 2.8),
    ...cowTreeOffsets().map((o) => spot(COW_STOP.x + o.x, COW_STOP.z + o.z, 1.2)),
    // The farmland: the walk out to it, where they stand, and the beds.
    lane(COW_STOP, stop, 1.6),
    spot(stop.x, stop.z, 1.4),
    spot(field.x, field.z, Math.max(FARM.cols, FARM.rows) * (FARM.plot + FARM.gap) * 0.75 + 0.6),
    // And the barn: the last walk, where they stand for it, the barn's own
    // footprint, and the stand that pays for it.
    lane(stop, barnStop, 1.6),
    spot(barnStop.x, barnStop.z, 1.4),
    spot(barn.x, barn.z, (BARN.height * BARN.spread) / 2 + 0.8),
    ...barnSpots(BARN.trees).map((o) => spot(o.x, o.z, 1.3))
  ];
}

/**
 * The ground between the camera and each thing the player has to watch. A TALL
 * prop in here is drawn OVER that beat, so the scatter keeps them out; short ones
 * are welcome, and standing a bush in front of the action is what gives the shot
 * some depth. How far each capsule reaches depends on the prop's own height —
 * see screenReachPerHeight.
 */
function sightlines(height: number): Array<{ ax: number; az: number; bx: number; bz: number; r: number }> {
  const { down } = screenAxes();
  const { stop } = farmLeg();
  const reach = height * screenReachPerHeight();

  return [
    RUBBLE_CENTRE,
    RUN_STOP,
    { x: COW_STOP.x + COW.offset.x, z: COW_STOP.z + COW.offset.z },
    COW_STOP,
    farmField(),
    stop,
    barnAt(),
    barnLeg().stop
  ].map((subject) => ({
    // Started a little clear of the subject itself, which keepClear already fences.
    ax: subject.x + down.x * 0.4,
    az: subject.z + down.z * 0.4,
    bx: subject.x + down.x * reach,
    bz: subject.z + down.z * reach,
    r: 1.9
  }));
}

/** How far a point is from a capsule's centre line. */
function distanceToLane(
  x: number,
  z: number,
  lane: { ax: number; az: number; bx: number; bz: number }
): number {
  const dx = lane.bx - lane.ax;
  const dz = lane.bz - lane.az;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq === 0 ? 0 : THREE.MathUtils.clamp(((x - lane.ax) * dx + (z - lane.az) * dz) / lengthSq, 0, 1);
  return Math.hypot(x - (lane.ax + dx * t), z - (lane.az + dz * t));
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
  // What the felled logs are paying for right now: which stand pays, where its
  // logs fly to, and what happens when enough have landed. Two beats want this —
  // the bridge and the barn — so it is state rather than a hardcoded destination.
  private repairing?: { grove: 'wood' | 'barn'; target: THREE.Vector3; done: () => void };
  private barn?: { pivot: THREE.Group; planks: THREE.Sprite[]; upright: THREE.Quaternion };
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
  // The button row offering the two tools. Present only while the choice is up.
  private toolChoice?: HTMLDivElement;
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
    grove: 'wood' | 'cow' | 'barn'; // what felling it is for
    axis: THREE.Vector3; // the horizontal it topples about
    tilt: number; // how far over it already is; the leaning one starts part-way
  }> = [];
  // Which stand is live. There are two — the one that pays for the bridge and
  // the one penning the cow in — and only ever one of them answers to a tap.
  private grove?: 'wood' | 'cow' | 'barn';
  // The cow keeps four clips now, and remembers which one is up so the follow
  // only crossfades on an actual change of gait rather than every frame.
  private cow?: {
    pivot: THREE.Group;
    gaits: Record<'idle' | 'happy' | 'walk' | 'run', THREE.AnimationAction>;
    gait: 'idle' | 'happy' | 'walk' | 'run';
  };
  // The farmland. Only the CROP of each plot is held: the bed is scenery from
  // the moment it loads, the crop is the thing that gets planted. grown is the
  // scale it has to arrive at, kept because the node comes in at 0.01 of the bed
  // and springing it up has to end there rather than at 1.
  private plots: Array<{ crop: THREE.Object3D; grown: THREE.Vector3 }> = [];
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
    this.addCow();
    this.addFarm();
    this.addBarn();
    this.addScenery(); // last, so its keep-clear list is measured against the lot

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
          // Stone: the hammer breaks it, the broom is no use against rock.
          this.showToolChoice([hammerSrc, broomSrc], () => this.breakRubble());
          this.say(SPEECH_LINES.tool);
        }
      },
      undefined,
      (err: unknown) => console.error('Rubble model failed to load:', err)
    );
  }

  /**
   * A choice of icons: white buttons along the bottom of the screen, with the
   * hand pointing up at the FIRST one — which is always the one that works. Both
   * obstacles ask it of a TOOL and the farmland asks it of a CROP; it is the
   * same row either way, which is why it is not named for either. Tapping
   * any other only wobbles it; the obstacle gives way to the right tool and
   * nothing else. Each button handles its own tap, so the scene's raycast never
   * sees these; onPointerDown stands the world down while the row is up.
   */
  private showToolChoice(icons: string[], onPick: () => void): void {
    const row = document.createElement('div');
    Object.assign(row.style, {
      position: 'absolute',
      left: '0',
      right: '0',
      bottom: TOOL_CHOICE.bottom,
      display: 'flex',
      justifyContent: 'center',
      gap: TOOL_CHOICE.gap,
      pointerEvents: 'none', // only the buttons take taps; the rest of the row
      // is dead space over the canvas
      opacity: '0',
      transition: `opacity ${TOOL_CHOICE.fade}ms`
    } as CSSStyleDeclaration);

    const button = (src: string, onTap: (el: HTMLElement) => void): HTMLElement => {
      const el = document.createElement('button');
      Object.assign(el.style, {
        position: 'relative', // the hand is hung off the button it points at
        width: TOOL_CHOICE.button,
        height: TOOL_CHOICE.button,
        padding: '0',
        border: 'none',
        borderRadius: TOOL_CHOICE.radius,
        background: '#fff',
        boxShadow: '0 0.6vmin 1.4vmin rgba(0,0,0,0.25)',
        cursor: 'pointer',
        pointerEvents: 'auto'
      } as CSSStyleDeclaration);

      const icon = document.createElement('img');
      icon.src = src;
      // Contained rather than stretched: the broom art is 200x137, not square,
      // and only the hammer is authored square.
      Object.assign(icon.style, {
        width: TOOL_CHOICE.icon,
        height: TOOL_CHOICE.icon,
        objectFit: 'contain',
        display: 'block',
        margin: 'auto'
      } as CSSStyleDeclaration);
      el.appendChild(icon);

      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        onTap(el);
      });
      row.appendChild(el);
      return el;
    };

    const right = button(icons[0], () => {
      this.clearToolChoice();
      onPick();
    });
    icons.slice(1).forEach((src) => button(src, (el) => this.wobbleTool(el)));

    document.body.appendChild(row);
    this.toolChoice = row;
    requestAnimationFrame(() => (row.style.opacity = '1')); // a frame late, or
    // the transition has nothing to run from

    // The same press-press-rest beat as the world tap hint, in the same PNG.
    const hand = document.createElement('img');
    hand.src = pointerSrc;
    Object.assign(hand.style, {
      position: 'absolute',
      top: '100%', // fingertip at the bottom edge of the button, pointing up
      left: '60%',
      width: `calc(${TOOL_CHOICE.button} * ${TOOL_CHOICE.hand})`,
      pointerEvents: 'none'
    } as CSSStyleDeclaration);
    right.appendChild(hand);
    hand.animate(
      [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-8%) scale(0.94)', offset: 0.06 },
        { transform: 'translateY(0) scale(1)', offset: 0.12 },
        { transform: 'translateY(-8%) scale(0.94)', offset: 0.35 },
        { transform: 'translateY(0) scale(1)', offset: 0.41 },
        { transform: 'translateY(0) scale(1)' }
      ],
      { duration: TAP_HINT.cycle * 1000, iterations: Infinity, delay: TOOL_CHOICE.hint }
    );
  }

  /**
   * The axe going through a whole stand, one tree every CHOP.stagger. Each one
   * still goes through chopTree, so the wood grove's logs still fly and still
   * count towards the bridge, and the last cow tree still frees the cow —
   * exactly as when the player felled them by hand.
   */
  private fellGrove(grove: 'wood' | 'cow' | 'barn'): void {
    const standing = this.trees.filter((tree) => tree.grove === grove && !tree.chopped);

    let elapsed = 0;
    let next = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      while (next < standing.length && elapsed >= next * CHOP.stagger) {
        this.chopTree(standing[next++]);
      }
      return next < standing.length;
    });
  }

  /** Fade the row out and drop it, once the choice has been made. */
  private clearToolChoice(): void {
    const row = this.toolChoice;
    if (!row) return;
    this.toolChoice = undefined;

    row.style.opacity = '0';
    row.style.pointerEvents = 'none';
    window.setTimeout(() => row.remove(), TOOL_CHOICE.fade);
  }

  /** The wrong tool: it shakes its head and the choice stays up. */
  private wobbleTool(el: HTMLElement): void {
    el.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6%)' },
        { transform: 'translateX(6%)' },
        { transform: 'translateX(-4%)' },
        { transform: 'translateX(0)' }
      ],
      { duration: TOOL_CHOICE.shake }
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
    this.afterRun = () => this.walkOnward(); // the far bank is not the end

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
    this.moveCamera(
      new THREE.Vector3(
        RUN_STOP.x + ARRIVAL.offset.x,
        CAMERA_FOLLOW.aimHeight,
        RUN_STOP.z + ARRIVAL.offset.z
      ),
      ARRIVAL.fit,
      ARRIVAL.ease,
      () => {
        // The choice and the instruction both wait for the move to settle. The
        // bridge wants timber, so this one is the axe — the hammer that broke
        // the rocks is the wrong tool here. The axe takes the whole stand: the
        // trees are the payment for the bridge, not a second tapping game.
        this.wood = 0;
        this.repairing = {
          grove: 'wood',
          target: new THREE.Vector3(STREAM.x, 0.6, BRIDGE.z),
          done: () => this.repairBridge()
        };
        this.showToolChoice([axeSrc, hammerSrc], () => {
          this.fellGrove('wood');
          this.say(SPEECH_LINES.trees);
        });
        this.say(SPEECH_LINES.tool);
      }
    );
  }

  /**
   * Ease the shot to a new place and zoom, then hand back. Every beat that
   * reframes goes through here, so they all move the same way.
   */
  private moveCamera(
    to: THREE.Vector3,
    fit: number,
    ease: number,
    done?: () => void
  ): void {
    const from = this.cameraTarget.clone();
    const fromFit = this.fitRadius;

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      const k = THREE.MathUtils.smoothstep(elapsed, 0, ease);

      this.cameraTarget.lerpVectors(from, to, k);
      this.fitRadius = THREE.MathUtils.lerp(fromFit, fit, k);
      this.camera.position.copy(ISO_DIR).multiplyScalar(CAM_DISTANCE).add(this.cameraTarget);
      this.camera.lookAt(this.cameraTarget);
      this.updateCamera();

      if (elapsed < ease) return true;
      if (done) done();
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

        // Two stands from the one model: the grove that pays for the bridge,
        // and the one penning the cow in on the far bank.
        const plant = (
          grove: 'wood' | 'cow' | 'barn',
          height: number,
          anchor: { x: number; z: number },
          offsets: Array<{ x: number; z: number }>,
          seed: number,
          fallFrom: { x: number; z: number } // trees topple away from this
        ) => {
          const baseScale = height / size.y;

          offsets.forEach((offset, n) => {
            const i = n + seed;
            const tree = source.clone(true);
            tree.scale.setScalar(baseScale * (0.85 + jitter(i, 21) * 0.3));

            // Centred on its trunk and stood on the grass, so the pivot it
            // hangs from is the point it will topple about.
            const box = new THREE.Box3().setFromObject(tree);
            const centre = box.getCenter(new THREE.Vector3());
            tree.position.set(-centre.x, -box.min.y, -centre.z);

            const pivot = new THREE.Group();
            pivot.name = `${grove}Tree${n}`;
            pivot.add(tree);
            pivot.position.set(anchor.x + offset.x, 0, anchor.z + offset.z);
            pivot.rotation.y = jitter(i, 22) * Math.PI * 2;
            this.scene.add(pivot);

            // Which way it goes over, worked out once and kept: away from
            // whatever it is standing around, so a falling tree never lands on
            // the pair or on the cow.
            const bearing = Math.atan2(
              pivot.position.x - fallFrom.x,
              pivot.position.z - fallFrom.z
            );
            const axis = new THREE.Vector3(Math.cos(bearing), 0, -Math.sin(bearing)).normalize();

            // Tap target, sized off the trunk rather than the canopy: a padded
            // canopy on a tree this size would swallow a third of the screen.
            const stood = new THREE.Box3().setFromObject(pivot);
            const spread = stood.getSize(new THREE.Vector3());
            this.trees.push({
              pivot,
              centre: new THREE.Vector3(pivot.position.x, height * 0.45, pivot.position.z),
              radius: (Math.max(spread.x, spread.z) / 2) * CHOP.hitPadding,
              top: stood.max.y,
              chopped: false,
              grove,
              axis,
              tilt: 0
            });
          });
        };

        plant('wood', TREES.height, RUN_STOP, TREES.offsets, 0, RUN_STOP);
        // The barn's stand. Its offsets are worked out in SCREEN directions rather
        // than written as world pairs, so they stay beside the barn if the camera
        // yaw is ever retuned — and they topple AWAY from the barn, which is what
        // keeps a falling tree off the thing being repaired.
        const barn = barnAt();
        plant(
          'barn',
          BARN.treeHeight,
          barn,
          barnSpots(BARN.trees).map((spot) => ({ x: spot.x - barn.x, z: spot.z - barn.z })),
          20,
          barn
        );
        const cowAt = { x: COW_STOP.x + COW.offset.x, z: COW_STOP.z + COW.offset.z };
        const cowLine = cowTreeOffsets();
        plant('cow', COW_TREES.height, COW_STOP, cowLine, 10, cowAt);

        // The trunk that is already down: one spacing past the foot of the line,
        // leaning back on the last tree so it closes that end off. Scenery, not
        // a target — it stays put once the cow is out, and she comes out around
        // the other end, so it never gets in her way.
        const fell = COW_TREES.fallen;
        const { down } = screenAxes();
        const foot = cowLine[cowLine.length - 1];
        const base = {
          x: COW_STOP.x + foot.x + down.x * COW_TREES.spacing,
          z: COW_STOP.z + foot.z + down.z * COW_TREES.spacing
        };
        const onto = {
          x: COW_STOP.x + cowLine[fell.onto].x,
          z: COW_STOP.z + cowLine[fell.onto].z
        };

        const trunk = source.clone(true);
        trunk.scale.setScalar(COW_TREES.height / size.y);
        const trunkBox = new THREE.Box3().setFromObject(trunk);
        const trunkMid = trunkBox.getCenter(new THREE.Vector3());
        trunk.position.set(-trunkMid.x, -trunkBox.min.y, -trunkMid.z);

        const trunkPivot = new THREE.Group();
        trunkPivot.name = 'fallenTrunk';
        trunkPivot.add(trunk);
        trunkPivot.position.set(base.x, 0, base.z);
        trunkPivot.rotation.y = jitter(20, 22) * Math.PI * 2;
        // Tipped over towards the tree it came to rest on, composed onto that
        // yaw so the trunk keeps the face it was turned to.
        const towards = Math.atan2(onto.x - base.x, onto.z - base.z);
        trunkPivot.quaternion.premultiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(Math.cos(towards), 0, -Math.sin(towards)).normalize(),
            THREE.MathUtils.degToRad(fell.deg)
          )
        );
        this.scene.add(trunkPivot);
      },
      undefined,
      (err: unknown) => console.error('Tree model failed to load:', err)
    );
  }

  /**
   * The cow, penned in behind the far stand of trees. It chews away on its idle
   * from the start — the player only meets it once the trees come down.
   */
  private addCow(): void {
    const texture = new THREE.TextureLoader().load(cowTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    // TRUE now, where the old A_Cow_Angus.glb wanted FALSE: this model came out
    // of scripts_fbx2glb.mjs, which copies the FBX's UVs across untouched, so it
    // wants its FBX's orientation like Merry and the Hipster do. If her hide comes
    // through scrambled, this is the flag.
    texture.flipY = true;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    new GLTFLoader().load(
      cowSrc,
      (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => {
        const model = gltf.scene;
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
        model.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.SkinnedMesh;
          if (!mesh.isMesh) return;
          mesh.material = material;
          if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
        });

        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        model.scale.setScalar(COW.height / size.y);

        const box = new THREE.Box3().setFromObject(model);
        const centre = box.getCenter(new THREE.Vector3());
        model.position.set(-centre.x, -box.min.y, -centre.z);

        const pivot = new THREE.Group();
        pivot.name = 'cow';
        pivot.add(model);
        pivot.position.set(COW_STOP.x + COW.offset.x, 0, COW_STOP.z + COW.offset.z);
        pivot.rotation.y = THREE.MathUtils.degToRad(COW.yawDeg);
        this.scene.add(pivot);

        const take = gltf.animations[0];
        if (!take) return;

        const mixer = new THREE.AnimationMixer(model);
        const cut = (name: string, range: { startFrame: number; endFrame: number }) =>
          mixer.clipAction(cutClip(take, `cow-${name}`, range));

        const gaits = {
          idle: cut('idle', COW.idle),
          happy: cut('happy', COW.happy),
          // The walk is the clip that needs standing up; unpitchClip works on the
          // subclip, so the other three are unaffected.
          walk: mixer.clipAction(
            unpitchClip(cutClip(take, 'cow-walk', COW.walk), 'Pelvis', COW.walkUprightDeg)
          ),
          run: cut('run', COW.run)
        };
        // Both gaits play faster than authored — see COW.gaitRate for why.
        gaits.walk.timeScale = COW.gaitRate;
        gaits.run.timeScale = COW.gaitRate;

        gaits.idle.play();
        this.mixers.push(mixer);
        this.cow = { pivot, gaits, gait: 'idle' };
      },
      undefined,
      (err: unknown) => console.error('Cow model failed to load:', err)
    );
  }

  /** Off the bridge and on up the far bank, to where the cow is penned in. */
  private walkOnward(): void {
    this.afterRun = () => this.meetCow();
    const heading = THREE.MathUtils.degToRad(FORWARD.headingDeg);
    this.actions.forEach((entry) => this.sendRunner(entry, heading, FORWARD.distance));
  }

  /** They pull up at the stand. The shot opens on it and the trees go live. */
  private meetCow(): void {
    this.moveCamera(
      new THREE.Vector3(
        COW_STOP.x + COW_SHOT.offset.x,
        CAMERA_FOLLOW.aimHeight,
        COW_STOP.z + COW_SHOT.offset.z
      ),
      COW_SHOT.fit,
      COW_SHOT.ease,
      () => {
        // Timber again, so the axe again — and the hammer is the wrong tool
        // twice over. It takes the whole line down and the last one felled
        // frees the cow.
        this.showToolChoice([axeSrc, hammerSrc], () => {
          this.fellGrove('cow');
          this.say(SPEECH_LINES.freeCow);
        });
        this.say(SPEECH_LINES.tool);
      }
    );
  }

  /**
   * The last tree is down. The cow celebrates on the spot, then comes along for
   * good — see followPair, which is what actually moves her from here on.
   */
  private rescueCow(): void {
    if (!this.cow) return;

    this.grove = undefined;
    this.hideTapHint();
    this.say(SPEECH_LINES.cowJoined, 4);

    this.setCowGait('happy');
    this.wait(COW.cheer, () => this.followPair());
  }

  /** Hand the cow from one clip to the next. Nothing happens if it is already up. */
  private setCowGait(next: 'idle' | 'happy' | 'walk' | 'run'): void {
    const cow = this.cow;
    if (!cow || cow.gait === next) return;

    const from = cow.gaits[cow.gait];
    const to = cow.gaits[next];
    to.reset();
    to.setLoop(THREE.LoopRepeat, Infinity);
    to.play();
    to.crossFadeFrom(from, COW.blend, false);
    cow.gait = next;
  }

  /**
   * The cow, once she is free: she holds station a cow's length UP-SCREEN of the
   * pair, walking to close a small gap and running to close a big one, for the
   * rest of the scene. So she comes over when they are standing about, and she
   * follows them to the farmland without being told to.
   *
   * Up-screen is not cosmetic. The walk to the farmland sets off down-screen and
   * to the right, so a cow holding station anywhere on THAT side of them stands in
   * the road — and since she only ever closes a gap and never yields, the pair
   * would walk straight through her. Behind is the one place a follower can wait.
   *
   * The station is recomputed every frame off wherever the pair currently is,
   * which is why one effect covers both the joining and the following, and why it
   * never needs to know which leg of the sequence is running.
   */
  private followPair(): void {
    const cow = this.cow;
    if (!cow) return;

    const { down } = screenAxes();
    const station = new THREE.Vector3();
    let joined = false;

    this.effects.push((delta: number) => {
      station.set(0, 0, 0);
      this.actions.forEach(({ pivot }) => station.add(pivot.position));
      station.divideScalar(Math.max(this.actions.length, 1));
      station.x -= down.x * COW.joinGap;
      station.z -= down.z * COW.joinGap;

      const toward = station.clone().sub(cow.pivot.position).setY(0);
      const gap = toward.length();
      const gait = gap > COW.chase ? 'run' : gap > COW.settle ? 'walk' : 'idle';
      this.setCowGait(gait);

      if (gait !== 'idle') {
        const speed = gait === 'run' ? COW.runSpeed : COW.walkSpeed;
        toward.normalize();
        cow.pivot.position.addScaledVector(toward, Math.min(speed * delta, gap));
        // Face the way she is going, models here being authored towards +Z.
        cow.pivot.rotation.y = Math.atan2(toward.x, toward.z);
      } else if (!joined) {
        // First time she settles is the cue to move the story on.
        joined = true;
        this.wait(FARM.delay, () => this.walkToFarm());
      }

      return true; // she keeps station for as long as the scene runs
    });
  }

  /** Hold for a beat, then do the thing. */
  private wait(seconds: number, done: () => void): void {
    let waited = 0;
    this.effects.push((delta: number) => {
      waited += delta;
      if (waited < seconds) return true;
      done();
      return false;
    });
  }

  /**
   * The plots, laid out as a small field and loaded with the scene like
   * everything else, standing empty until the player picks a crop.
   */
  private addFarm(): void {
    // Both flipY FALSE — a farm GLB, per the note at the imports. The bed reads
    // off the buildings atlas like the bridge does; the wheat has its own.
    const bedTexture = new THREE.TextureLoader().load(boatTextureSrc);
    bedTexture.colorSpace = THREE.SRGBColorSpace;
    bedTexture.flipY = false;
    bedTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const cropTexture = new THREE.TextureLoader().load(cropTextureSrc);
    cropTexture.colorSpace = THREE.SRGBColorSpace;
    cropTexture.flipY = false;
    cropTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    new GLTFLoader().load(
      plotSrc,
      (gltf: { scene: THREE.Group }) => {
        const source = gltf.scene;
        const bedMaterial = new THREE.MeshStandardMaterial({ map: bedTexture, roughness: 1 });
        const cropMaterial = new THREE.MeshStandardMaterial({
          map: cropTexture,
          roughness: 1,
          alphaTest: 0.5, // the sheaves are cutout cards, like the tree's leaves
          side: THREE.DoubleSide
        });

        // Two atlases in one model, so the material a mesh ASKS for decides
        // which it gets. The single-material traverse every other prop here uses
        // would paint the wheat with the buildings atlas.
        source.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          const asked = (mesh.material as THREE.Material).name;
          mesh.material = asked === 'cropMat' ? cropMaterial : bedMaterial;
        });

        // The bed is measured off its own GEOMETRY rather than as an object,
        // because the wheat is its CHILD — a box round the object would size the
        // plot to the crop standing in it and come out two thirds too small.
        const bed = source.getObjectByName('PlotWheat') as THREE.Mesh | undefined;
        if (!bed?.geometry) {
          console.warn('Farm plot: no PlotWheat bed in the model');
          return;
        }
        bed.geometry.computeBoundingBox();
        const bedSize = bed.geometry.boundingBox!.getSize(new THREE.Vector3());
        const scale = FARM.plot / Math.max(bedSize.x, bedSize.z);

        // Laid out on the WORLD axes, not the screen ones the cow's tree line
        // uses: the beds are square in world space, so anything else leaves gaps
        // between them that no amount of tuning closes.
        const field = farmField();
        const step = FARM.plot + FARM.gap;
        const group = new THREE.Group();
        group.name = 'farm';

        for (let row = 0; row < FARM.rows; row++) {
          for (let col = 0; col < FARM.cols; col++) {
            const plot = source.clone(true);
            plot.scale.setScalar(scale);
            plot.position.set(
              field.x + (col - (FARM.cols - 1) / 2) * step,
              FARM.lift,
              field.z + (row - (FARM.rows - 1) / 2) * step
            );

            const crop = plot.getObjectByName('Wheat_Finished');
            if (crop) {
              crop.rotation.x = THREE.MathUtils.degToRad(FARM.cropUprightDeg);
              crop.visible = false; // empty farmland, until the player plants it
              this.plots.push({ crop, grown: crop.scale.clone() });
            }
            group.add(plot);
          }
        }

        this.scene.add(group);
      },
      undefined,
      (err: unknown) => console.error('Farm plot model failed to load:', err)
    );
  }

  /**
   * Fill the empty grass. Positions are solved FIRST, all of them, before a
   * single model is fetched: the scatter only needs each prop's footprint, and
   * settling it up front is what keeps the arrangement identical on every load.
   * Deciding as the loads landed would have let their order — which nothing here
   * controls — reshuffle the island.
   */
  private addScenery(): void {
    const fenced = keepClear();
    const taken: Array<{ x: number; z: number; r: number }> = [];
    const reach = ISLAND_HALF - SCENERY.margin;

    // Where each prop of each kind goes. A candidate has to clear the play area,
    // the stream, and everything already placed.
    const plan = SCENERY.props.map((prop) => {
      const footprint = prop.height * 0.35;
      const spots: Array<{ x: number; z: number; scale: number; yaw: number }> = [];

      // Only tall props answer to the sightlines, so this is worked out once per
      // kind rather than per candidate.
      const blocking = prop.height > 1 ? sightlines(prop.height) : [];

      for (let i = 0; spots.length < prop.count && i < SCENERY.tries * prop.count; i++) {
        const x = -reach + jitter(i, prop.salt) * reach * 2;
        const z = -reach + jitter(i, prop.salt + 100) * reach * 2;

        if (fenced.some((lane) => distanceToLane(x, z, lane) < lane.r + footprint + SCENERY.clear)) continue;
        if (blocking.some((lane) => distanceToLane(x, z, lane) < lane.r)) continue;
        if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + footprint + SCENERY.spacing)) continue;

        taken.push({ x, z, r: footprint });
        spots.push({
          x,
          z,
          // Sized and spun per instance, so a dozen of one bush is not a dozen
          // copies of the same silhouette.
          scale: 0.85 + jitter(i, prop.salt + 200) * 0.3,
          yaw: jitter(i, prop.salt + 300) * Math.PI * 2
        });
      }

      if (spots.length < prop.count) {
        console.warn(`scenery: only fitted ${spots.length} of ${prop.count} (island is full)`);
      }
      return { prop, spots };
    });

    // Two materials for the lot: the atlas each model's own material asks for,
    // both flipY FALSE like every farm GLB, both alpha-cutout because the grass
    // and foliage are cards. A JPG atlas has no alpha channel, so the cutout
    // costs the solid props nothing.
    const atlas = (src: string) => {
      const texture = new THREE.TextureLoader().load(src);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 1,
        alphaTest: 0.5,
        side: THREE.DoubleSide
      });
    };
    const materials = { vegetation: atlas(rubbleTextureSrc), buildings: atlas(boatTextureSrc) };

    const group = new THREE.Group();
    group.name = 'scenery';
    this.scene.add(group);

    const loader = new GLTFLoader();
    plan.forEach(({ prop, spots }) => {
      if (!spots.length) return;
      loader.load(
        prop.src,
        (gltf: { scene: THREE.Group }) => {
          const source = gltf.scene;
          const material = materials[prop.atlas as 'vegetation' | 'buildings'];
          source.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
          });

          // Measured and scaled on HEIGHT, then stood on the grass — the same
          // treatment the trees get, so everything stays in proportion.
          const size = new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
          const base = prop.height / size.y;

          spots.forEach((spot) => {
            const model = source.clone(true);
            model.scale.setScalar(base * spot.scale);

            const box = new THREE.Box3().setFromObject(model);
            const centre = box.getCenter(new THREE.Vector3());
            model.position.set(-centre.x, -box.min.y, -centre.z);

            const pivot = new THREE.Group();
            pivot.add(model);
            pivot.position.set(spot.x, 0, spot.z);
            pivot.rotation.y = spot.yaw;
            group.add(pivot);
          });
        },
        undefined,
        (err: unknown) => console.error(`Scenery model failed to load (${prop.src.slice(0, 40)}):`, err)
      );
    });
  }

  /** Off to the empty plots, down-screen and away from the felled stand. */
  private walkToFarm(): void {
    this.afterRun = () => this.chooseCrop();
    const { heading, distance } = farmLeg();
    this.actions.forEach((entry) => this.sendRunner(entry, heading, distance));
  }

  /**
   * They have reached the farmland. The shot settles on the field and the three
   * crops come up — same rule as the tools, so the FIRST icon is the one that
   * works and the hand is already on it. Apple and carrot only wobble: there is
   * one crop modelled and the beat is "plant the wheat", not a menu.
   */
  private chooseCrop(): void {
    const { stop } = farmLeg();
    const field = farmField();

    this.moveCamera(
      new THREE.Vector3(
        THREE.MathUtils.lerp(stop.x, field.x, FARM.shot),
        CAMERA_FOLLOW.aimHeight,
        THREE.MathUtils.lerp(stop.z, field.z, FARM.shot)
      ),
      FARM.fit,
      FARM.ease,
      () => {
        this.showToolChoice([wheatSrc, appleSrc, carrotSrc], () => this.plantWheat());
        this.say(SPEECH_LINES.crop);
      }
    );
  }

  /**
   * Wheat it is: the crop springs up one plot at a time, so the field FILLS
   * across rather than blinking on in one frame.
   */
  private plantWheat(): void {
    this.say(SPEECH_LINES.planted, 4);
    // A beat to look at the crop, then they spot the barn.
    this.wait(BARN.delay, () => this.walkToBarn());

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;

      let growing = false;
      this.plots.forEach(({ crop, grown }, i) => {
        const k = THREE.MathUtils.clamp((elapsed - i * FARM.stagger) / FARM.grow, 0, 1);
        if (k <= 0) {
          growing = true; // still waiting its turn
          return;
        }
        crop.visible = true;
        crop.scale.copy(grown).multiplyScalar(Math.max(0.0001, easeOutBack(k)));
        if (k < 1) growing = true;
      });
      return growing;
    });
  }

  /** On past the wheat, to whatever that is leaning over in the corner. */
  private walkToBarn(): void {
    this.afterRun = () => this.findBarn();
    const { heading, distance } = barnLeg();
    this.actions.forEach((entry) => this.sendRunner(entry, heading, distance));
  }

  /**
   * They have found it. The shot opens out — a barn is bigger than anything else
   * in this scene — and the axe comes up again. Same beat as the bridge, down to
   * the wrong tool being the hammer: chop the stand, the logs fly in, the barn
   * goes back up.
   */
  private findBarn(): void {
    const { stop } = barnLeg();
    const barn = barnAt();

    this.moveCamera(
      new THREE.Vector3(
        THREE.MathUtils.lerp(stop.x, barn.x, BARN.shot),
        CAMERA_FOLLOW.aimHeight,
        THREE.MathUtils.lerp(stop.z, barn.z, BARN.shot)
      ),
      BARN.fit,
      BARN.ease,
      () => {
        this.wood = 0; // the bridge spent its own logs; this beat counts its own
        this.repairing = {
          grove: 'barn',
          target: new THREE.Vector3(barn.x, BARN.height * 0.55, barn.z),
          done: () => this.repairBarn()
        };
        this.showToolChoice([axeSrc, hammerSrc], () => {
          this.fellGrove('barn');
          this.say(SPEECH_LINES.trees);
        });
        this.say(SPEECH_LINES.tool);
      }
    );
  }

  /**
   * Enough timber: the smoke goes up, the barn comes straight, and the planks that
   * were lying at its foot are gone when it clears.
   */
  private repairBarn(): void {
    const barn = this.barn;
    if (!barn) return;

    const centre = new THREE.Vector3(barn.pivot.position.x, BARN.height * 0.4, barn.pivot.position.z);
    this.smoke(centre, BARN.poof, BARN.repair);

    const leaning = barn.pivot.quaternion.clone();
    let elapsed = 0;

    this.effects.push((delta: number) => {
      elapsed += delta;

      // Straightening starts under full cover, so the eye never catches the barn
      // moving — it was leaning before the smoke and it is square after.
      const k = THREE.MathUtils.clamp((elapsed - BARN.poof.swap) / BARN.straighten, 0, 1);
      barn.pivot.quaternion.slerpQuaternions(leaning, barn.upright, easeOutBack(k) );
      // The planks go with it, fading over the same stretch.
      barn.planks.forEach((plank) => {
        (plank.material as THREE.SpriteMaterial).opacity = 1 - k;
        plank.visible = k < 1;
      });

      if (elapsed < BARN.repair + 0.15) return true;

      barn.pivot.quaternion.copy(barn.upright);
      barn.planks.forEach((plank) => {
        plank.removeFromParent();
        (plank.material as THREE.SpriteMaterial).dispose();
      });
      barn.planks.length = 0;
      this.say(SPEECH_LINES.barnFixed, 4);
      return false;
    });
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
    // run up to the bank. The rubble asks for the hammer, so while the choice
    // is up the rock itself is not a target — the icons are.
    if (this.toolChoice) return; // the buttons answer for themselves
    if (this.breakable && !this.breakable.broken) return;

    if (!this.grove) return;
    const tree = this.trees.find(
      (entry) => !entry.chopped && entry.grove === this.grove && hits(entry.centre, entry.radius)
    );
    if (tree) this.chopTree(tree);
  };

  /**
   * Fell one tree: it topples about its base, lies there a moment, then fades
   * out as its log flies over to the bridge.
   */
  private chopTree(tree: IslandScene['trees'][number]): void {
    tree.chopped = true;
    this.hideTapHint();

    // Its topple axis was settled when it was planted — away from whatever it
    // stands around — and the leaning one is already part-way over, so it only
    // has the rest of the way to go.
    const axis = tree.axis;
    const remaining = Math.PI / 2 - tree.tilt;
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
      tilt.setFromAxisAngle(axis, remaining * k * k);
      tree.pivot.quaternion.copy(tilt).multiply(upright);

      if (elapsed < CHOP.fall + CHOP.linger) return true;

      const shrink = (elapsed - CHOP.fall - CHOP.linger) / 0.3;
      model.scale.copy(grown).multiplyScalar(Math.max(0.0001, 1 - shrink));
      if (shrink < 1) return true;

      tree.pivot.removeFromParent();
      return false;
    });

    // Two stands pay for something — the bridge's and the barn's. The one that
    // penned the cow in is only in the way, so its timber goes nowhere.
    if (tree.grove !== 'cow') {
      this.flyLog(tree.pivot.position.clone());
      return;
    }

    if (this.trees.some((entry) => entry.grove === 'cow' && !entry.chopped)) {
      this.pointAtNextTree();
      return;
    }
    this.rescueCow();
  }

  /**
   * The barn, standing broken past the farmland: leaning, settled into the ground
   * at its low corner, with its planks on the grass beside it. Loaded with the
   * scene like everything else, so it is already there to be found.
   */
  private addBarn(): void {
    // Buildings atlas, flipY TRUE — see the note at the import: this one came out
    // of the FBX converter, not the farm's pipeline.
    const texture = new THREE.TextureLoader().load(boatTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    new GLTFLoader().load(
      barnSrc,
      (gltf: { scene: THREE.Group }) => {
        const model = gltf.scene;
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
        model.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
        });

        // Scaled on HEIGHT like every other prop, then stood on the grass and
        // dropped BARN.sink into it.
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        model.scale.setScalar(BARN.height / size.y);

        const box = new THREE.Box3().setFromObject(model);
        const centre = box.getCenter(new THREE.Vector3());
        model.position.set(-centre.x, -box.min.y - BARN.sink, -centre.z);

        const at = barnAt();
        const pivot = new THREE.Group();
        pivot.name = 'barn';
        pivot.add(model);
        pivot.position.set(at.x, 0, at.z);
        pivot.rotation.y = THREE.MathUtils.degToRad(BARN.yawDeg);

        // Held BEFORE the lean goes on, because the repair eases back to it —
        // and composed onto the yaw rather than replacing it, or the barn would
        // snap square on the first frame of the straighten.
        const upright = pivot.quaternion.clone();
        const { down } = screenAxes();
        pivot.quaternion
          .copy(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(down.x, 0, down.z).normalize(),
              THREE.MathUtils.degToRad(BARN.tiltDeg)
            )
          )
          .multiply(upright);
        this.scene.add(pivot);

        // The planks. Sprites of the log texture, laid at the foot of the barn and
        // spun a little so three of one image do not read as three of one image.
        const planks = barnSpots(BARN.planks).map((spot, i) => {
          const plank = BARN.planks[i];
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: this.woodTexture, transparent: true, rotation: THREE.MathUtils.degToRad(plank.spin) })
          );
          sprite.scale.setScalar(plank.size);
          // Half its own height up, so it sits ON the grass rather than half under.
          sprite.position.set(spot.x, plank.size * 0.32, spot.z);
          this.scene.add(sprite);
          return sprite;
        });

        this.barn = { pivot, planks, upright };
      },
      undefined,
      (err: unknown) => console.error('Barn model failed to load:', err)
    );
  }

  /** One log arcing from a felled tree to whatever it is paying for. */
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

    const job = this.repairing;
    const to = job ? job.target : new THREE.Vector3(STREAM.x, 0.6, BRIDGE.z);
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
      // Against the stand that is PAYING, and no other. this.trees holds every
      // stand in the scene at once — the bridge's, the one that penned the cow in,
      // the barn's — and counting all of them left the bridge waiting on logs that
      // were never coming.
      const needed = this.trees.filter((entry) => entry.grove === job?.grove).length;
      if (job && this.wood >= needed) job.done();
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

  /**
   * A ring of smoke bursting over a spot and thinning away, which is how both
   * repairs in this scene hide their change: there is no transition to look at, so
   * there is none to get wrong. Hands back nothing — the caller runs its own
   * effect alongside and does the changing under cover of this.
   *
   * stretch pulls the ring along world X, for a thing that is longer than it is
   * deep (the bridge); 1 leaves it round (the barn).
   */
  private smoke(
    centre: THREE.Vector3,
    poof: { puffs: number; size: number; spread: number; rise: number },
    seconds: number,
    stretch = 1
  ): void {
    const puffs = Array.from({ length: poof.puffs }, (_, i) => {
      const material = new THREE.SpriteMaterial({
        map: this.puffTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false // smoke reads as being in front of the prop, not in it
      });
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 997;

      // A ring around the thing. Sizes and delays vary per puff, or all of them
      // bloom as one disc.
      const angle = (i / poof.puffs) * Math.PI * 2;
      const reach = poof.spread * (0.55 + jitter(i, 31) * 0.6);
      sprite.position.set(
        centre.x + Math.cos(angle) * reach * stretch,
        centre.y,
        centre.z + Math.sin(angle) * reach * (stretch === 1 ? 1 : 0.8)
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

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;

      puffs.forEach((p) => {
        const k = THREE.MathUtils.clamp((elapsed - p.delay) / seconds, 0, 1);
        if (k <= 0) return;
        // Out fast, then hang and thin away — smoke, not a balloon.
        const grow = 1 - Math.pow(1 - k, 3);
        p.sprite.scale.setScalar(Math.max(0.001, p.size * grow));
        p.sprite.position.y = p.baseY + p.rise * grow;
        p.material.opacity = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
      });

      if (elapsed < seconds + 0.15) return true;
      puffs.forEach((p) => {
        p.sprite.removeFromParent();
        p.material.dispose();
      });
      return false;
    });
  }

  /** Enough wood: a poof of smoke swallows the wreck and leaves the new span. */
  private repairBridge(): void {
    const broken = this.bridgeBroken;
    const restored = this.bridgeRestored;
    if (!restored) return;

    const poof = BRIDGE.poof;
    const centre = new THREE.Vector3(STREAM.x, 0.35, BRIDGE.z);
    this.smoke(centre, poof, BRIDGE.repair, 1.15);

    restored.scale.setScalar(0.001);
    let elapsed = 0;
    let swapped = false;

    this.effects.push((delta: number) => {
      elapsed += delta;

      // The swap itself, at full cover. This is the whole point of the poof:
      // there is no transition to look at, so there is none to get wrong.
      if (!swapped && elapsed >= poof.swap) {
        swapped = true;
        if (broken) broken.visible = false;
        restored.visible = true;
      }

      if (swapped) {
        const k = THREE.MathUtils.clamp((elapsed - poof.swap) / poof.pop, 0, 1);
        restored.scale.setScalar(Math.max(0.001, easeOutBack(k)));
      }

      if (elapsed < BRIDGE.repair + 0.15) return true;

      restored.scale.setScalar(1);
      if (broken) broken.removeFromParent();
      this.say(SPEECH_LINES.cross, 3.5); // this one is a payoff, so it times out

      // A beat to see what they built, then over they go.
      this.wait(CROSSING.delay, () => this.crossBridge());
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
    const next = this.trees.find((tree) => !tree.chopped && tree.grove === this.grove);
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
      path.scale.setScalar(Math.max(0.0001, easeOutBack(k)));

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
    this.toolChoice?.remove();
    window.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
