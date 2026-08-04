// Clean standalone island scene: just the grass island, sandy beach, and toon
// water, viewed through a true ORTHOGRAPHIC ISOMETRIC camera. Because the camera
// is orthographic, the water reads as an even border on every side of the island
// (no perspective horizon), which is the classic Hay Day / FarmVille map look.
import * as THREE from 'three';
import type { IslandStage } from '../config/debugConfig';
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
import treeDenseSrc from 'assets/models/Tree_Dense.glb';
import rocksSrc from 'assets/models/Rocks.glb';
import scarecrowSrc from 'assets/models/Scarecrow.glb';
// The barn the last beat puts right: Barn.fbx through scripts_fbx2glb.mjs, so
// flipY TRUE like the characters and the cow — NOT the flipY false the farm's own
// GLBs want. Its material asks for Buildings_B, i.e. the buildings atlas. One mesh,
// 2493 verts, 51 KB quantized, and authored Y-up so it needs no righting.
import barnSrc from 'assets/models/Barn.glb';
// ...and the wreck it replaces. Same pipeline, same atlas, same flipY. 62 KB.
import barnBrokenSrc from 'assets/models/B_Barn_Abandoned.glb';
// The expansion beat's upgrades. SheepHome and both trucks come from
// assets/models/expansion via scripts_fbx2glb.mjs, so flipY TRUE; they were welded
// and (the trucks) simplified to a quarter of their faces first, because 13k verts
// each is absurd for props seen once, at distance, for two seconds. The coop is one
// of the farm's own GLBs, so it is the odd one out at flipY FALSE.
// The homes. NOT expansion/SheepHome.fbx, which cannot be textured with anything in
// this project: its FBX points at a Buildings.png from the pack it came from, and its
// UV islands do not line up with our Buildings.jpg — whole wall faces span the atlas's
// empty black space, so it renders as a black slab under either flipY. Verified in the
// browser: forcing a plain colour onto the mesh lit it correctly, so the geometry and
// lighting are fine and only the mapping is wrong. Drop that Buildings.png into
// assets/images and SheepHome can come straight back.
import homeSrc from 'assets/models/B_Classic_Livinghouse_Filler.glb';
import truckSrc from 'assets/models/Truck.glb';
import truckElectricSrc from 'assets/models/Truck_Electric.glb';
import coopSrc from 'assets/models/B_Chicken_Coop.glb';
// The town's street and the rest of its buildings, all from the farm's own set, so
// flipY FALSE for every one of them. The road is the only thing in the scene that
// reads off the roads atlas.
import roadSrc from 'assets/models/Road.glb';
import roadTextureSrc from 'assets/images/RoadsRocks.jpg';
import bakerySrc from 'assets/models/Bakery.glb';
import dairySrc from 'assets/models/B_Dairy_Factory.glb';
import townBarnSrc from 'assets/models/B_Victorian_Barn_Lvl3.glb';
import tentSrc from 'assets/models/B_Tent.glb';
import sawmillSrc from 'assets/models/B_Sawmill.glb';
import roadCornerSrc from 'assets/models/Road_Corner.glb';
import fenceSrc from 'assets/models/Wooden_Fence_White_Straight.glb';
import mailboxSrc from 'assets/models/B_Mailbox.glb';
import milkJugSrc from 'assets/models/Milk_Jug.glb';
import crateSrc from 'assets/models/B_County_Fair_Board_Crate_Apple.glb';
// The rest of the reference farm. All of these were already sitting in assets/models,
// unused — only their farmhouse had to be copied across and converted.
import farmhouseSrc from 'assets/models/Farmhouse.glb';
import windmillSrc from 'assets/models/B_Windmill.glb';
import wellSrc from 'assets/models/B_Well_Lv1.glb';
import vanSrc from 'assets/models/B_Van_Abadoned.glb';
import pigPenSrc from 'assets/models/B_Pig_Habitat_Abandoned.glb';
import stationSrc from 'assets/models/B_Desert_Station.glb';
import windChimeSrc from 'assets/models/Wind_Chime.glb';
import bonfireSrc from 'assets/models/BonfireWoods.glb';
import kangarooSrc from 'assets/models/FlowerKangaroo.glb';
import feedMakerSrc from 'assets/models/B_Feed_Maker.glb';
import jamStationSrc from 'assets/models/B_Jam_Station.glb';
import siloSrc from 'assets/models/Silo.glb';
import cowShedSrc from 'assets/models/Cow_Shed.glb';
import lampSrc from 'assets/models/Lamp.glb';
import arrowSrc from 'assets/images/arrow.png';
import pointerSrc from 'assets/images/PointerHand.png';
import hammerSrc from 'assets/images/props/Hammer.png';
import axeSrc from 'assets/images/props/Axe.png';
import broomSrc from 'assets/images/props/broom.png';
import woodSrc from 'assets/images/Wood.png';
import bubbleSrc from 'assets/images/DialogueBox.png';

// Grass land width/depth. Big enough from the start to hold the whole playable: the beats
// run down the western half and the village sits in the east. It used to be 25 and was
// rebuilt bigger when the expansion beat opened, which meant the slabs, the beach and the
// sea all had to be thrown away and remade mid-playable to keep the foam ringing the right
// shoreline. One size, built once, is less code and nothing to get wrong.
const ISLAND_SIZE = 64;
const ISLAND_HEIGHT = 2;
const ISLAND_HALF = ISLAND_SIZE / 2;
const FIT_RADIUS = 2.5; // world half-width kept in frame at the opening

// How much a shot has to hold UP AND DOWN against how much it holds ACROSS.
//
// On a portrait phone the frame is far taller than it is wide, so the width is almost
// always what binds and the height comes free — 0.62 is what the old fixed-width framing
// worked out to on a 9:16 screen, which keeps every beat looking as it did while making the
// zoom answer to the content. On a landscape screen the height becomes the binding one,
// which is exactly what used to be cropped.
const FRAME_HEIGHT_RATIO = 0.62;

// The tightest a shot may ever get, in half-width. The two characters stand 1.5 apart, so
// this is their separation plus room for a speech bubble: it is the floor that stops a
// content-measured frame from closing in on them while the camera is merely following.
const FRAME_MIN_WIDTH = 2.1;

// Lighting, taken from the reference playable (its ThreeSceneManager.addLights).
const LIGHTS = {
  ambient: 1.2,
  sun: 1.5, // the one that casts
  fill: 1.0, // a second directional, straight down
  shadowMap: 2048,
  shadowReach: 26 // half-width of the sun's shadow box, in world units
};
const GRASS_TINT = 0x8fe25a;
const WATER_Y = -0.4; // must match the water plane in createIslandWater
const SAND_EDGE = ISLAND_HALF + 1; // outer edge of the beach skirt

// Boat moored on the shoreline. x/z are where it sits in world space; the sand
// edge is at SAND_EDGE (13.5), so an |x| slightly beyond that puts it in the
// water just off the beach. At the current camera (FIT_RADIUS 3, panned to
// x -10) only the stretch around z -8..-2 of that -X shore is on screen — move
// z within that range to slide the boat along the beach.
const BOAT = {
  x: -(SAND_EDGE + 1.5), // just past the sand, floating off the -X beach
  z: -3.5,
  yawDeg: 70, // swung with the camera, which moved from 65 to 45
  // Hull length in world units. The island is ISLAND_SIZE (25) across, so 2 puts
  // the boat at about a twelfth of the island's width. The camera frames
  // 2 * FIT_RADIUS units, so at FIT_RADIUS 3 this fills a third of the screen —
  // check both numbers when you change it.
  length: 2,
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
    x: -30.3,
    z: -0.5,
    yawDeg: 52, // was 72 at the old 65-degree camera; square-on is yaw + 7
    height: 0.9
  },
  {
    key: 'hipster',
    model: hipsterSrc,
    texture: hipsterTextureSrc,
    idle: { startFrame: 0, endFrame: 298 },
    run: { startFrame: 299, endFrame: 315 },
    runSpeed: 1.23, // 0.694 units of foot slide over his 0.567s cycle
    x: -30.1,
    z: 1,
    yawDeg: 45, // ...and this one was 65
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
  collapse: 0.3, // seconds the rock itself takes to shrink away under the burst
  debris: 6, // chunks thrown out of the break
  debrisScale: 0.3, // each one this fraction of the rock it came from
  debrisSpeed: 1.1, // outward, world units per second
  debrisLift: 2.4, // and upward, before gravity takes them
  debrisSpread: 0.5, // how far each chunk's heading wanders off its even share of
  // the compass, in shares. 0 throws them as one ring, which is what a burst must not look like.
  // Gravity, not scale-accurate on purpose. A character is 0.9u for a ~1.7m person,
  // so 1u is about 1.9m and true g would be ~5.2 — at which a 0.3u pebble hangs in a
  // slow, weightless arc. Stone wants to snap down, so this runs about 3x heavy.
  gravity: 16,
  bounce: 0.32, // fraction of the impact speed kept on the way back up
  friction: 0.55, // ... and of the slide and the tumble, scrubbed off per bounce
  rest: 0.45, // below this much downward speed it is down for good, world units/second
  sit: 0.55, // chunks come to rest this deep into their own radius, i.e. half-buried in grass
  dust: { puffs: 5, size: 0.5, spread: 0.35, rise: 0.5 } // the crack of stone, at the break
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
  // Far enough up that the HAND clears the screen. It hangs below the button (see
  // `hand`), so the row needs at least the hand's own height beneath it — at 7vmin
  // two thirds of the hand was cut off by the bottom of the frame, which is the one
  // part of this row the player is meant to follow.
  bottom: '20vmin',
  radius: '3vmin',
  fade: 250, // ms, in and again once one is picked
  // The pointing hand, as a fraction of the button. It points UP, so it hangs below the
  // button — but OVERLAPPING it, not merely touching: see handOverlay.
  hand: 0.72, // of the button. Its height plus TOOL_CHOICE.bottom has to fit on screen
  // How far the fingertip reaches INTO the button, as a fraction of the button's height.
  // 0 sits the tip exactly on the bottom edge, which read as a gap — the tip is a thin
  // point and the mass of the hand is well below it, so tangent looks detached. 0.28 puts
  // the tip on the icon's lower edge (the icon is 72% of the button, centred) so the hand
  // is unmistakably ON the button without covering what the player has to read.
  handOverlay: 0.28,
  // Where the fingertip sits inside PointerHand.png, measured off the art's alpha: 17.5%
  // across and 7.5% DOWN of its 80x80. Both matter — the 7.5% is why `top: 100%` left a
  // gap even though it puts the image's top edge exactly on the button's bottom edge.
  handTip: { x: 0.175, y: 0.075 },
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
  // How it lands. A trunk does not stop dead when it hits: it rebounds a few degrees and
  // settles, which is the difference between a tree falling and a tree being rotated.
  bounce: 6, // degrees it kicks back
  settle: 0.45, // seconds of that dying away
  // ...and the dust it throws up along its length as it hits.
  dust: { puffs: 7, size: 0.7, spread: 0.9, rise: 0.3 },
  dustFor: 0.6, // seconds of it
  dustAlong: 0.55, // how far up the fallen trunk the cloud is centred, as a fraction
  // Leaves, knocked out of the canopy as it hits. There is no leaf texture in this project
  // and one is not worth 20 KB for half a second of confetti: these are the smoke puff
  // tinted foliage green, which at this size reads as leaves and costs nothing.
  leaves: {
    count: 12,
    size: 0.17,
    colour: 0x6ea63a,
    burst: 1.5, // how hard they are thrown out, world units per second
    lift: 1.8, // ...and up
    gravity: 2.6, // gentle: a leaf falls slowly
    sway: 1.4, // how far it drifts side to side on the way down, radians per second
    life: 1.6 // seconds before the last of them has faded
  },
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
  // Air around the subjects. The zoom itself is no longer set here: the shot measures the
  // pair, the wreck and the stand and works out what it needs, so the same beat frames
  // correctly on a 375x667 phone and on a tall one. See IslandScene.framing.
  margin: 0.5,
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
  // Nose to tail, for FRAMING her. She is the one subject in the playable that is much
  // longer than she is tall, so framing her as a single point put her rump over the edge
  // of a portrait frame; the shot is fitted to both ends of her instead.
  length: 1.35,
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
  // ...and how far to one side of straight-behind-them she stands. At 0 her walk in from
  // the pen clipped the nearer character by 0.45; 0.8 to the screen-right of the station
  // opens that to 0.95 and still leaves her a cow's length off them.
  joinSide: 0.8,
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
  // How far the line stands to the cow's screen-LEFT. It has to be between her and the
  // pair, and it has to miss their screen column: the pair arrives 2.8 units to her
  // screen-left, so anything from about 1.3 to 4.4 puts a canopy over a character. 1.15 is
  // on the near side of that window — the line still fences her in, and it clears the
  // nearer character by 1.3. (At the old 65-degree camera 1.7 was clear; the angle moved.)
  standoff: 1.15,
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
  margin: 0.5, // air around the pair, the cow and her trees; the zoom is measured
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
  // Solved to keep the WALK short. This used to be 6.8 / 4.5, which put the field 8.2 units
  // from where the cow was freed and left them running for four and a half seconds between
  // two beats; at 4.25 / -2 it is a 2.2-unit stroll and everything after the bridge sits
  // close together. Every constraint is still met — nobody stands in the soil, neither lane
  // crosses it on the way, and the walk misses the cow at her station — see
  // scratchpad/tighten.mjs, which solves this and the barn's offsets together.
  down: 4.25,
  right: -2,
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
  // rather than read off a shared constant).
  lift: 0.004,
  // The wheat inside the GLB is authored Z-UP in a Y-up scene (its own longest
  // axis runs along z), so it arrives lying flat. This stands it up. The knob is
  // here rather than inline in case the art gets re-exported the right way up:
  // 0 then, and nothing else changes.
  cropUprightDeg: 90,
  delay: 0.6, // seconds after the cow settles before they set off
  grow: 0.45, // seconds for one plot's crop to spring up
  stagger: 0.12, // between plots, so the field FILLS instead of blinking on
  // Where the shot sits, as a FRACTION of the way from where they stop to the middle of the
  // field: the field is off to one side, so splitting the difference down the middle wasted
  // half the frame on two characters. 0.7 leans towards the beds. The zoom is measured from
  // the pair and all four corners of the field — see IslandScene.framing.
  margin: 0.55,
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
  // Solved with the farmland (scratchpad/tighten.mjs) for a 1.8-unit walk from the crop to
  // the barn — a couple of strides rather than the 4.2 it was. Negative `down` means it sits
  // UP-screen of the field, which is what keeps the walk off the beds they just planted.
  down: -2.75,
  right: -3.5,
  ahead: 2.8, // how far short of it they pull up
  // Height in world units: 2.3x a character, which is what a barn should be next
  // to the people using it.
  height: 2.1,
  // ...and the wreck it replaces, kept LOWER on purpose. Half of it is down, so
  // it should not stand as tall as the barn it becomes — and the difference is
  // what makes the repair read as the building coming back up rather than as one
  // prop blinking into another. 1.6 rather than 1.8 because righting it (below)
  // made it the WIDER of the two, and at 1.8 the beat no longer fits the frame.
  brokenHeight: 1.6,
  // B_Barn_Abandoned is authored Z-UP inside a Y-up file, so it arrives lying on
  // its back — the same mistake the wheat and the cow's walk carry. Verified off
  // the geometry rather than guessed: 17% of its vertices sit on the LOW face of
  // its own z (a building's flat base), and its footprint narrows towards high z
  // (a roof), while its y widens. -90 about x turns that +Z into world up. Set it
  // to 0 if the FBX is ever re-exported the right way up; the barn it becomes is
  // already Y-up and takes 0.
  brokenUprightDeg: -90,
  // Widest horizontal against height, of the WIDER of the two. That is the wreck,
  // and only once righted: standing up it measures 6.3 across on 5.4 of height,
  // against the barn's slimmer 17.6 on 20.4. The scenery scatter needs this BEFORE
  // either model has loaded — it settles every position up front — so it cannot be
  // measured at load time the way scale is.
  spread: 6.3 / 5.4,
  // Which way each of them faces, and they are SEPARATE numbers on purpose: the wreck and
  // the barn are different models with different authored fronts, so one yaw that presents
  // the barn's long side to the camera leaves the wreck showing its back — and the two are
  // swapped in the same frame, where a change of facing would be the one thing the eye
  // catches. Tune each against its own model.
  yawDeg: -90, // the repaired barn
  brokenYawDeg: 90, // the wreck it replaces
  sink: 0.04, // how far both of them settle into the grass, so neither floats
  // The stand that pays for it, as screen offsets from the barn. Every one is
  // UP-screen (negative d): a tree down-screen of the barn draws its canopy
  // straight over it, which is the trap TREES.offsets and SCENERY both document.
  // Up-screen of the barn (negative d) so no canopy is drawn over it, and off to its
  // screen-LEFT because the pair pulls up at about r 1.5 / d -2.3 — the stand used to
  // sit right on that spot with its canopies over the characters, which no amount of
  // checking the BARN's sightline was ever going to catch. Solved against the barn,
  // the pair, the wheat and the fallen trunk at once; 791 spots satisfy all of it.
  // Two stands, and only one of them is timber.
  //
  // These three stay put — they are the barn's setting, not its repair. All on the barn's
  // own bank: screen-left of it is straight at the stream from here, which is what once put
  // a tree in the water.
  keepTrees: [{ r: 1.6, d: -0.8 }],
  // ...and these two, to the barn's LEFT, are the ones the axe takes for the repair. They
  // sit down-screen of it because that is the only left-hand ground there is: the channel
  // runs immediately up-screen on that side, so every clear spot to the left is at least
  // 3.4 units below the barn. Solved against the water, the barn, the pair, the crop and
  // the three trees staying put.
  // Three of them, because EVERY tree on the barn's left has to come down: one standing
  // there afterwards reads as a tap that failed, which is exactly how the r -1.8 one looked
  // while it was in keepTrees.
  chopTrees: [
    { r: -1.8, d: 2.0 },
    { r: -1.2, d: 3.4 },
    { r: -3.2, d: 3.8 }
  ],
  treeHeight: 1.8,
  delay: 1.4, // seconds after the wheat comes up before they move on
  // Air around the barn, its stand and the pair; the zoom is measured from all three.
  margin: 0.5,
  shot: 0.4,
  ease: 1,
  // The repair. It IS the bridge's, and runs through the same code: smoke out, the
  // two models change hands under full cover, the new one springs to size as the
  // smoke thins. swap is when the change happens, pop how long the spring takes.
  repair: 0.7,
  poof: { puffs: 20, size: 1.35, spread: 1.5, rise: 0.55, swap: 0.16, pop: 0.4 }
};

// The last thing the player sees: the shot pulls back off the finished barn and the
// island opens out, with everything still to build standing on the empty side of it
// and a down-arrow bobbing over each one.
//
// The five props stand there from the FIRST frame rather than appearing for this
// beat. Nothing is gained by hiding them — the shot is tight enough all the way
// through that they are never in frame — and a pop-in would only draw the eye to
// the seam. They are simply the island's undeveloped half, and the zoom-out is what
// finally shows it.
//
// Every position was SOLVED rather than placed by eye: a search over the empty
// ground for a set that clears the stream, the cow's clearing, the wheat, the barn
// and its stand by at least a unit, keeps the props a good half-unit off each
// other, keeps the four arrows at least 1.4 apart on screen so they read as four
// things, and comes out to the tightest wide shot that still holds all of it plus
// the farm, the barn and the pair. That solution is the numbers below; moving one
// by hand is likely to break one of those five conditions, so re-run the search
// (scratchpad/expansion-solve.mjs) rather than nudging.
const EXPANSION = {
  delay: 1.6, // seconds after the barn stands up before the shot starts pulling back
  // The island GROWS for this beat: 12.5 out to 19, so 25 units across becomes 38. A
  // village needs room, and the built half of the island has none — which is the whole
  // point of an expansion.
  // The wide shot, solved to hold the village, the wheat, the barn and the pair at once.
  // The reference's own framing, worked out from its camera config: fov 100, targetSize
  // 100, zoomFactor 0.5, orthoFitScale 0.3 give a portrait half-height of 7.5 and a
  // half-width of 4.22 — and this scene's `fit` IS the portrait half-width. Its farm is
  // deliberately WIDER than that frame, which is why the reference looks dense and full
  // rather than showing a whole island at once.
  centre: { x: 0.78, z: 0.00 },
  // Opened out as far as the island allows. The reference's own frame is half-width 4.22 by
  // half-height 7.5 (what its camera config works out to), and this is that shot zoomed out
  // to 6.0 — the point at which the frame's corners reach the shoreline. At 6.2 the top-right
  // corner is exactly on the grass edge and at 6.5 there is ocean in it, which is what moving
  // the village down and left bought: room to pull back this far and still fill the frame with
  // land. Given as a BOX so it holds on any aspect — the width binds on a 9:16 phone, the
  // height on anything narrower.
  frame: { w: 8.87, h: 15.78 },
  ease: 2.4, // slow: this is the reveal, not a cut
  // --- the village ---
  //
  // This is the farm from the shipped Make Marie a Muffin playable, copied EXACTLY: every
  // position, rotation and size read straight out of its src/config/environmentConfig.js
  // by scratchpad/port-farm.mjs, at its own 1:1 scale, and only translated so it sits on
  // the empty half of this island. 45 of its 51 entries came across; the six that did not
  // are its own characters and its flower/grass scatters, which this scene already has.
  //
  // `size` is the reference's worldSize and means the same thing it does there: the
  // model's LARGEST dimension becomes that many world units. That is why the buildings are
  // in proportion to each other exactly as they are in the reference.
  // Where the village's MIDDLE lands, and the centre of its scatter rings.
  //
  // The island's, deliberately. A portrait frame's ground reach is 3.8x its half-width along
  // the screen-vertical, and at yaw 45 that axis runs down the island's DIAGONAL — 90 units,
  // against 64 for a side. So a shot centred here opens about 40% wider before its corners
  // find water than the same shot out where the village used to sit, which is most of what
  // made the whole village framable. It is 15 units clear of the barn, the last thing the
  // player touches, and every earlier beat is off the side of this frame (checked in
  // scratchpad/village-shot.mjs).
  at: { x: 0, z: 0 },
  // The middle of the layout as CONFIGURED, i.e. of the positions below as the port wrote
  // them. `scale` works about this point and `at` is where it ends up, so the two together
  // move and resize the village without touching a single position in the lists.
  middle: { x: 12.8, z: -16.0 },
  // The whole village to scale — every POSITION and every SIZE by this factor, about `at`.
  //
  // Its footprint as ported is 25 x 26 units, so its extent ACROSS the screen is its
  // diagonal, about 27. A portrait frame at this camera can hold 12.4 of that before its
  // corners run off the grass: the frame's vertical reach on the ground is 3.8x its
  // half-width (halfW / aspect / sin(elev)), so opening the shot spends land up- and
  // down-screen nearly four times faster than sideways. Neither a squeeze across the screen
  // nor a different yaw fixes that — the footprint is square, so its diagonal is its
  // diagonal whichever way it is turned — and the only map that gets the WHOLE village into
  // an ocean-free frame while keeping the reference's layout and proportions exactly is
  // scaling it as one piece.
  //
  // 0.55 is the loosest that fits, with the village recentred on `at` below: frame
  // half-width 8.87, corners reaching 30.9 of the 32 where the grass ends. It puts their cow
  // shed at 1.9 units and their barn at 2.2 — the same ballpark as the barn the player
  // repairs (2.1), so the village reads as a village rather than as models at two different
  // scales. 0.6 puts the corners in the water.
  scale: 0.55,
  roads: [
    { src: roadSrc, at: { x: 7, z: -21.5 }, yawDeg: 90, length: 13, width: 1.15 },
    { src: roadSrc, at: { x: 14.5, z: -14 }, yawDeg: 180, length: 13, width: 1.15 },
    { src: roadSrc, at: { x: 14.5, z: -3 }, yawDeg: 180, length: 13, width: 1.15 },
    { src: roadCornerSrc, at: { x: 14.22, z: -21.2 }, yawDeg: 90, length: 1.8, width: null },
  ],
  roadWidth: 1.15,
  lift: 0.01, // the roads are decals on the grass and need the same hair of clearance
  // the farm's beds do, or they z-fight
  buildings: [
    { key: 'bakery', src: bakerySrc, at: { x: 19, z: -19.5 }, size: 2.2, yawDeg: 0 },
    { key: 'cowShed', src: cowShedSrc, at: { x: 14.5, z: -24 }, size: 3.5, yawDeg: 180 },
    { key: 'silo', src: siloSrc, at: { x: 9.7, z: -23.8 }, size: 2.3, yawDeg: 200 },
    { key: 'chickenCoop', src: coopSrc, at: { x: 11, z: -18.5 }, size: 3.4, yawDeg: 0 },
    { key: 'feedMaker', src: feedMakerSrc, at: { x: 9, z: -27 }, size: 2.2, yawDeg: 0 },
    { key: 'farmHouse', src: farmhouseSrc, at: { x: 7.5, z: -24 }, size: 3, yawDeg: 360 },
    { key: 'lamp', src: lampSrc, at: { x: 6.7, z: -22.7 }, size: 1.4, yawDeg: 0 },
    { key: 'scarecrow', src: scarecrowSrc, at: { x: 18, z: -17 }, size: 1.4, yawDeg: 0 },
    { key: 'dairyFactory', src: dairySrc, at: { x: 11.7, z: -24.2 }, size: 1.5, yawDeg: -180 },
    { key: 'milkJug', src: milkJugSrc, at: { x: 11.5, z: -23.2 }, size: 0.5, yawDeg: -180 },
    { key: 'milkJug1', src: milkJugSrc, at: { x: 11.9, z: -23.2 }, size: 0.5, yawDeg: -180 },
    { key: 'classicLivinghouseFiller1', src: homeSrc, at: { x: 10, z: -25 }, size: 0.8, yawDeg: 0 },
    { key: 'countyFairBoardCrateApple', src: crateSrc, at: { x: 20, z: -17 }, size: 1, yawDeg: 0 },
    { key: 'desertStation', src: stationSrc, at: { x: 23, z: -27 }, size: 3, yawDeg: 90 },
    { key: 'jamStation', src: jamStationSrc, at: { x: 20, z: -23 }, size: 2.0, yawDeg: 10 },
    { key: 'mailbox', src: mailboxSrc, at: { x: 8, z: -9 }, size: 1, yawDeg: 180 },
    { key: 'pigHabitatAbandoned', src: pigPenSrc, at: { x: 7, z: -15 }, size: 3.5, yawDeg: 90 },
    { key: 'sawmill', src: sawmillSrc, at: { x: 4, z: -13 }, size: 2.5, yawDeg: 90 },
    { key: 'vanAbandoned', src: vanSrc, at: { x: 16.8, z: -14 }, size: 2, yawDeg: 90 },
    { key: 'victorianBarnLvl3', src: townBarnSrc, at: { x: 13, z: -29 }, size: 4, yawDeg: 180 },
    { key: 'wellLv1', src: wellSrc, at: { x: 11, z: -14.5 }, size: 2.5, yawDeg: 180 },
    { key: 'windmill', src: windmillSrc, at: { x: 7, z: -19 }, size: 3.5, yawDeg: 90 },
    { key: 'windChime', src: windChimeSrc, at: { x: 5.5, z: -23.5 }, size: 2, yawDeg: 0 },
    { key: 'flowerKangaroo', src: kangarooSrc, at: { x: 9.4, z: -19.4 }, size: 1.7, yawDeg: -20 },
    { key: 'campTent', src: tentSrc, at: { x: 0.4, z: -23 }, size: 2.3, yawDeg: 180 },
    { key: 'campBonfire', src: bonfireSrc, at: { x: 0.4, z: -21.5 }, size: 1.1, yawDeg: 15 },
    { key: 'rocksByWell', src: rocksSrc, at: { x: 12.4, z: -13.9 }, size: 0.9, yawDeg: 55 },
    { key: 'rocksByWell2', src: rocksSrc, at: { x: 12.9, z: -14.6 }, size: 1.5, yawDeg: -30 },
    { key: 'rocksBySawmill', src: rocksSrc, at: { x: 25.2, z: -20.8 }, size: 3.5, yawDeg: 110 },
  ],
  // The pens, and what makes the whole thing read as a farm: runs of white fence around
  // the cow shed, the coop and the crop. Each run is a row of panels from its middle,
  // along x unless alongZ says otherwise.
  fences: [
    { at: { x: 20.8, z: -16.2 }, count: 4, spacing: 1.2 },
    { at: { x: 20.5, z: -10.7 }, count: 5, spacing: 1 },
    { at: { x: 23.05, z: -13.5 }, count: 4, spacing: 1, alongZ: true },
    { at: { x: 17.95, z: -12.15 }, count: 3, spacing: 1, alongZ: true },
    { at: { x: 14.5, z: -25.75 }, count: 5, spacing: 1 },
    { at: { x: 14.5, z: -22.25 }, count: 5, spacing: 1 },
    { at: { x: 16.85, z: -24 }, count: 4, spacing: 1, alongZ: true },
    { at: { x: 11, z: -20.15 }, count: 3, spacing: 0.9 },
    { at: { x: 11.5, z: -16.85 }, count: 3, spacing: 1.1 },
    { at: { x: 9.35, z: -17.75 }, count: 2, spacing: 0.9, alongZ: true },
  ],
  // A fence PANEL's width, not its height: the model is a flat 2.0 x 1.1 board authored
  // Z-UP — the reference's own config rights it with rotation x -90 and scales it on z —
  // so scaling it by height turned every panel into a nine-unit sheet, and ten runs tiled
  // into one tan plaza over the whole village.
  fencePanel: 1.05,
  fenceUprightDeg: -90,
  // The crop, INSIDE its pen, at the reference's own 4 x 4 and its own spacing.
  //
  // It used to sit at (15.5, -10.5), which is outside the pen and across the road: that
  // position was left over from the first port at 0.62 scale and never moved when the layout
  // went 1:1. The reference's own grid is at (2.5, 3.5) and every prop here is its position
  // plus (18, -17) — checked against three buildings — which puts the crop at (20.5, -13.5),
  // the exact middle of the four fence runs below (x 17.95..23.05, z -16.2..-10.7).
  //
  // `spacing` is theirs too. This scene's own farm steps FARM.plot + FARM.gap so its beds
  // read as separate plots; the reference's beds touch at 1.2, and at 1.32 a 4-wide grid
  // overflows the pen it is supposed to sit in.
  farmland: { at: { x: 20.5, z: -13.5 }, cols: 4, rows: 4, spacing: 1.2 },
  // Idling on the roads — ON them: these two were also left in the old space, which parked
  // the first one inside the windmill at (7, -19).
  trucks: [
    { src: truckSrc, at: { x: 5, z: -21.5 }, height: 1.6, yawDeg: 90 },
    { src: truckElectricSrc, at: { x: 14.5, z: -7 }, height: 1.5, yawDeg: 0 }
  ],
  idle: { rise: 0.012, rate: 9.5, rock: 0.5 }, // world units, rad/s, degrees
  // One arrow per KIND of opportunity, each ON the prop it points at. These carried the same
  // stale offset the crop did, so three of the four hovered over open grass.
  arrows: [
    { at: { x: 7.5, z: -24 }, over: 3.4 }, // the farmhouse
    { at: { x: 14.5, z: -24 }, over: 3.8 }, // the cow shed and its pen
    { at: { x: 5, z: -21.5 }, over: 1.9 }, // the vehicles
    { at: { x: 20.5, z: -13.5 }, over: 0.9 } // the crop
  ],
  arrow: { size: 1.8, bob: 0.3, rate: 2.2, fade: 0.4, stagger: 0.22 },
  // --- the ground the village stands on ---
  //
  // The reference's farm is not just its buildings: it carries six scatters, and they are most
  // of why it looks full. These are those — its own counts, radii and size ranges, out of its
  // scatters block — laid down around the village instead of around its farmCentre. Every
  // model is one this scene already imports, so none of it costs bundle.
  //
  // ponytail: one mesh per prop again, about 250 of them. Three frustum-culls whatever is off
  // screen and this is the last two seconds of the playable, so it has not shown up — if it
  // ever does, the flowers and the grass are the half worth turning into InstancedMesh.
  ground: {
    // The ring of trees that closes the farm in. The reference plants 100 of these at 2.8-4.2
    // units, which is a forest — it can afford one because its camera never pulls back far
    // enough to see the ring as a ring. This shot does, and 100 read as a wall of green with a
    // village behind it, so the ring is thinned to a treeline: a third as many, pulled in
    // closer, and none of them taller than the buildings they stand behind.
    // Radii are in the same CONFIGURED space as the positions — scale applies to them too,
    // so the ring stays put relative to the village it encloses. Its outer edge is what the
    // shot's width binds on: at 14 it lands just inside the frame the buildings already
    // need, so the treeline costs nothing.
    trees: { count: 32, inner: 11.5, outer: 14, min: 2.4, max: 3.4, spacing: 2.6, salt: 300 },
    bushes: { count: 34, inner: 7, outer: 9.5, min: 0.9, max: 1.5, spacing: 1.6, salt: 202 },
    // ...and the detail on the open ground inside it
    flowers: { count: 100, inner: 0, outer: 13, min: 0.5, max: 0.9, spacing: 0.5, salt: 42 },
    grass: { count: 70, inner: 0, outer: 13, min: 0.4, max: 0.8, spacing: 0.6, salt: 77 },
    flowerGrass: { count: 40, inner: 5, outer: 13.5, min: 0.4, max: 0.7, spacing: 0.7, salt: 412 },
    rocks: { count: 25, inner: 6.5, outer: 14, min: 0.4, max: 1.0, spacing: 0.9, salt: 311 }
  }
};

/** A village position, scaled about EXPANSION.at — see EXPANSION.scale. */
function villageAt(at: { x: number; z: number }): { x: number; z: number } {
  const { at: to, middle, scale } = EXPANSION;
  return { x: to.x + (at.x - middle.x) * scale, z: to.z + (at.z - middle.z) * scale };
}

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
    { src: bushDarkSrc, atlas: 'vegetation', height: 0.5, count: 11, salt: 40 },
    { src: bushLightSrc, atlas: 'vegetation', height: 0.45, count: 11, salt: 41 },
    { src: grassSmallSrc, atlas: 'vegetation', height: 0.28, count: 19, salt: 42 },
    { src: grassMediumSrc, atlas: 'buildings', height: 0.34, count: 14, salt: 43 },
    { src: grassFancySrc, atlas: 'buildings', height: 0.4, count: 11, salt: 44 },
    { src: flowersSrc, atlas: 'vegetation', height: 0.26, count: 14, salt: 45 },
    { src: flowerGrassSrc, atlas: 'vegetation', height: 0.3, count: 11, salt: 46 },
    { src: birchSrc, atlas: 'vegetation', height: 2.1, count: 8, salt: 47 },
    // The acacia is gone and treeDense is down from 6. Both are a consequence of
    // the expansion beat fencing off the other half of the island: a tall prop has
    // to clear every beat's sightline by 2.75 units per unit of its own height, and
    // at the acacia's 2.3 that is 6.3 units of ground it may not stand on. With six
    // beats to keep out of, the sampler could not seat a single one — it warned and
    // left the island short. Counts here are what actually fits.
    { src: treeDenseSrc, atlas: 'vegetation', height: 1.9, count: 4, salt: 49 },
    { src: rocksSrc, atlas: 'buildings', height: 0.45, count: 7, salt: 50 },
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
  // World units across. DialogueBox.png is 317x130, so this comes out 0.47 tall.
  width: 1.15,
  // How much of the art's own height to keep. The old round blob stood as tall as the
  // character saying it and had to be squashed to 0.68 with the text counter-stretched;
  // DialogueBox.png is already a wide, shallow box, so it is used as authored.
  squash: 1,
  // The box is hung by its TAIL, not by its middle: the tip is parked just off the speaker's
  // face and everything else is placed from there, so it reads as coming out of their mouth
  // whatever size the art is. Measured off DialogueBox.png's alpha — the tail tapers to
  // x 30..37 at y 117 of 317x130, so its tip is (33, 117), and y here is from the BOTTOM.
  tail: { x: 0.104, y: 0.1 },
  // Where that tip lands on the speaker. Height is a fraction of THEIRS, so it holds for
  // both characters despite one being shorter: 0.80 is about mouth level (their eyes sit at
  // 0.79 of their height, the top of the head at 1.0). Anchoring at 1.0 put the bubble over
  // their head like a thought balloon.
  faceHeight: 0.8,
  faceGap: 0.15, // out past the cheek, so it sits BESIDE the face, not over it
  margin: 0.1, // world units of clearance the box keeps from the frame's edge
  fade: 0.25,
  // Body of the box in texture space, top-down, inset from the art for a margin. The panel
  // itself runs x 0.019..0.972 and y 0..0.79 (the rest is the tail).
  body: { x: 0.07, y: 0.1, width: 0.86, height: 0.6 },
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
  expand: 'So much more\nto build!',
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
 * Bounds of a model IN THE POSE IT IS CURRENTLY IN, skinning included.
 *
 * Box3.setFromObject cannot do this. For a SkinnedMesh it takes the geometry's BIND-pose
 * bounding box and ignores the skinning entirely, so a model whose bind pose is not its
 * standing pose measures wrong in both its height and where its feet are. The cow is exactly
 * that — she came out of the FBX with her legs splayed, the same Z-up authoring that pitches
 * her walk clip — and seating her on the bind box left her hooves 0.32 above the grass, 41%
 * of her own height, and her standing height 38% short of what COW.height asked for.
 *
 * So this walks the vertices through the same bone transform the GPU uses. One pass over a
 * few thousand vertices, run once at load. The model must NOT be parented yet — the box
 * comes back in its own parent-to-be space, which is what a placement needs.
 */
function posedBounds(model: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  const vertex = new THREE.Vector3();
  model.updateMatrixWorld(true);
  model.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, vertex);
      box.expandByPoint(mesh.localToWorld(vertex));
    }
  });
  return box;
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
    ...barnSpots([...BARN.keepTrees, ...BARN.chopTrees]).map((o) => spot(o.x, o.z, 1.3)),
    // And the village the expansion reveals: its roads as capsules, its buildings and its
    // crop as spots, so the scatter never drops a bush in a road or a tree through a roof.
    ...EXPANSION.roads.map((road) => {
      const at = villageAt(road.at);
      const half = (road.length * EXPANSION.scale) / 2;
      const alongX = Math.abs(Math.sin(THREE.MathUtils.degToRad(road.yawDeg))) > 0.5;
      const r = (EXPANSION.roadWidth * EXPANSION.scale) / 2 + 0.4;
      return alongX
        ? lane({ x: at.x - half, z: at.z }, { x: at.x + half, z: at.z }, r)
        : lane({ x: at.x, z: at.z - half }, { x: at.x, z: at.z + half }, r);
    }),
    ...EXPANSION.buildings.map((b) => {
      const at = villageAt(b.at);
      return spot(at.x, at.z, b.size * EXPANSION.scale * 0.5 + 0.4);
    }),
    spot(
      villageAt(EXPANSION.farmland.at).x,
      villageAt(EXPANSION.farmland.at).z,
      Math.max(EXPANSION.farmland.cols, EXPANSION.farmland.rows) *
        (FARM.plot + FARM.gap) *
        EXPANSION.scale *
        0.6 +
        0.8
    )
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
// The reference playable's camera: its isometricDirection (1, 0.75, 1) is a 45-degree yaw
// lifted atan(0.75 / sqrt(2)) = 27.95 degrees off top-down. Every screen-relative helper in
// this file reads these two numbers — screenAxes, screenReachPerHeight, the farm and barn
// legs — so they follow on their own; what does NOT follow is anything tuned BY EYE against
// the old 65/20 view, which is called out at each of those constants.
const VIEW_YAW_DEG = 45;
const VIEW_ELEV_DEG = 27.95;

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
const PAN = { x: -29.5, y: 1, z: 0 };
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
  private water?: { group: THREE.Group; update: (s: number) => void };
  // The grass slabs, held so the expansion can replace them with bigger ones.
  private islandSlabs: THREE.Mesh[] = [];
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
  // What the felled logs are paying for right now: which stand pays, where its
  // logs fly to, and what happens when enough have landed. Two beats want this —
  // the bridge and the barn — so it is state rather than a hardcoded destination.
  private repairing?: { grove: 'wood' | 'barn'; target: THREE.Vector3; done: () => void };
  private barn?: { broken: THREE.Group; repaired: THREE.Group };
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
    legAt: number; // when the CURRENT leg began, so its turn eases from there
    travelled: number;
    distance: number; // per runner, since the crossing gives each its own lane
    deck?: { minX: number; maxX: number; y: number; edge: number };
    // Where they carry straight on to. A chained leg is run WITHOUT pulling up: no
    // settle to idle, no ramp back up, just a turn onto the new heading at full pace.
    next?: { heading: number; distance: number };
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
    grove: 'wood' | 'cow' | 'barn' | 'barnKeep'; // what felling it is for, or barnKeep for never
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
  // What the shot has to SHOW, as half-extents on screen: w across, h up and down, in
  // world units. The zoom is solved from this and the device's aspect rather than being a
  // single number, which is what makes the framing survive a 375x667 phone as well as a
  // tall one — see updateCamera.
  private need = { w: FIT_RADIUS, h: FIT_RADIUS * FRAME_HEIGHT_RATIO };

  constructor(width: number, height: number, stage: IslandStage = 'rubble') {
    this.width = width;
    this.height = height;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    // Soft shadows, as the reference has them. Without this the sun's castShadow does
    // nothing and the scene goes back to looking unlit.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    this.addBridge();
    this.addTrees();
    this.addCow();
    this.addFarm();
    this.addBarn();
    this.addExpansion();
    this.addScenery(); // after the lot, so its keep-clear list is measured against // last, so its keep-clear list is measured against the lot

    // Taps are read off the WINDOW in the capture phase, not off this canvas:
    // Game.ts parks the Phaser overlay on top at z-index 10, and a canvas takes
    // pointer events whether or not it is transparent, so a listener down here
    // would never see them. Capture also puts us ahead of anything the overlay
    // might swallow.
    window.addEventListener('pointerdown', this.onPointerDown, { capture: true });

    this.addWater();

    // A handle on the scene for inspecting it from the browser console — which is
    // how the black buildings and the trees standing on the characters were found,
    // neither of which any amount of geometry checking had caught. Dev only:
    // __DEV__ is false in a release build, so webpack drops this line.
    if (__DEV__) (window as unknown as { island: unknown }).island = this;

    // Debug only, and a no-op on the normal start: jump straight to a later beat.
    this.skipTo(stage);

    this.startMs = performance.now();
    this.lastMs = this.startMs;
    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  /**
   * The reference playable's lighting, copied: a bright ambient, a strong sun that CASTS,
   * and a second directional straight down as fill.
   *
   * Ours was one ambient at 1.1 against one sun at 1.15 — nearly half the light coming from
   * everywhere at once, which is what made the scene read as unlit: no surface was much
   * darker than any other and nothing had a shadow to sit in. The sun is 1.5 here against
   * the same ambient, the fill picks up what the sun leaves black, and the shadows are what
   * actually put the props ON the ground rather than in front of it.
   */
  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, LIGHTS.ambient));

    const sun = new THREE.DirectionalLight(0xffffff, LIGHTS.sun);
    sun.position.set(10, 40, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(LIGHTS.shadowMap, LIGHTS.shadowMap);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 100;
    // The reference covers its farm with a 20-unit box. This island is bigger and the beats
    // run right across it, so the box is widened to reach them all — at 2048 that is still
    // about 0.03 world units per texel.
    sun.shadow.camera.left = -LIGHTS.shadowReach;
    sun.shadow.camera.right = LIGHTS.shadowReach;
    sun.shadow.camera.top = LIGHTS.shadowReach;
    sun.shadow.camera.bottom = -LIGHTS.shadowReach;
    // Offset depth samples so surfaces do not self-shadow (acne / diagonal banding).
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);

    // Fill, straight down, so nothing sits in pitch black.
    this.scene.add(new THREE.DirectionalLight(0xffffff, LIGHTS.fill));
  }

  /**
   * Let a loaded model take part in the lighting: it casts, and it catches what falls on it.
   * Flat things lying ON the ground (the roads, the crop beds) are told not to cast, or they
   * shadow-band against the grass they are painted onto — the reference does the same.
   */
  private shade(model: THREE.Object3D, groundSurface = false): void {
    model.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = !groundSurface;
      mesh.receiveShadow = true;
    });
  }

  /**
   * The island, at whatever size it is currently. Called again by the expansion
   * Takes a half-width so the size lives in one place; nothing calls it with anything but
   * ISLAND_HALF any more. (It used to be called again mid-playable to grow the island for
   * the expansion beat, which meant rebuilding the slabs, the beach and the sea to keep the
   * foam on the right shoreline. The island is simply built big now.)
   */
  private addIsland(half = ISLAND_HALF): void {
    // Whatever was there before goes, or the old slabs sit inside the new ones and
    // z-fight along every shared face.
    this.islandSlabs.forEach((mesh) => {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    });
    this.islandSlabs = [];

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
      // Against the CURRENT size, so the blades stay the same size on the ground
      // when the island grows instead of being stretched with it.
      map.repeat.set((4 * width) / (half * 2), (4 * half * 2) / (half * 2));
      map.needsUpdate = true;

      const grass = new THREE.MeshStandardMaterial({ map, color: GRASS_TINT, roughness: 1 });
      // BoxGeometry material order: [ +x, -x, +y(top), -y(bottom), +z, -z ].
      const geometry = new THREE.BoxGeometry(width, ISLAND_HEIGHT, half * 2);
      const mesh = new THREE.Mesh(geometry, [side, side, grass, side, side, side]);
      mesh.receiveShadow = true; // the ground catches everything and casts nothing
      mesh.position.set(fromX + width / 2, -ISLAND_HEIGHT / 2, 0); // grass top at y = 0
      this.scene.add(mesh);
      this.islandSlabs.push(mesh);
    };

    const bank = STREAM.width / 2;
    slab(-half, STREAM.x - bank);
    slab(STREAM.x + bank, half);
  }

  /** The beach skirt and the sea, sized to the island as it currently stands. */
  private addWater(half = ISLAND_HALF, viewRadius = FIT_RADIUS): void {
    if (this.water) {
      this.water.group.removeFromParent();
      this.water.group.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }
    // Beach skirt + toon water, centred on the island. viewRadius tells the water
    // how much world is on screen so its blobs and foam scale with the zoom —
    // without it a tight FIT_RADIUS frames less than a single feature, and the wide
    // shot at the end would get foam meant for a close-up.
    this.water = createIslandWater({
      islandHalf: half,
      viewRadius,
      // Slots the same gap through the beach skirt that addIsland cuts in the
      // grass, so the sea below shows through it as the stream.
      channel: { x: STREAM.x, width: STREAM.width }
    });
    this.scene.add(this.water.group);
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
        this.shade(model);

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
            mesh.castShadow = true;
            mesh.receiveShadow = true;
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
        this.shade(source);
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
      transition: `opacity ${TOOL_CHOICE.fade}ms`,
      // ABOVE the Phaser overlay, which Game.ts parks at z-index 10 with pointer events
      // ON. Without this the row draws fine and cannot be tapped at all: the overlay
      // canvas covers it and swallows every tap, so the whole playable dead-ends at the
      // first choice. Only reproducible in the normal flow — a debug start builds no
      // overlay, which is why it looked fine from ?stage=.
      zIndex: '20'
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
      // Contained rather than stretched. Every icon is 200x200 now, but the art
      // inside them is not all square — the broom is drawn 145 wide on its
      // transparent canvas — and contain is what keeps that from being pulled out
      // of shape if one is ever replaced with a differently proportioned file.
      Object.assign(icon.style, {
        width: TOOL_CHOICE.icon,
        height: TOOL_CHOICE.icon,
        objectFit: 'contain',
        display: 'block',
        margin: 'auto',
        pointerEvents: 'none' // the BUTTON takes the tap, not the picture on it
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
      // Overlaid on the button, with the fingertip handOverlay into it. Both terms are in
      // percentages OF THE BUTTON, which is what top/left resolve against: the overlay is
      // already in those units, and the tip's own 7.5% is 7.5% of the hand, hence the
      // TOOL_CHOICE.hand factor.
      top: `${100 - TOOL_CHOICE.handOverlay * 100 - TOOL_CHOICE.hand * TOOL_CHOICE.handTip.y * 100}%`,
      // Measured off the art, not guessed: the fingertip sits 17.5% across PointerHand.png,
      // so the image is pulled left by that much of ITS OWN width to put the tip under the
      // middle of the button. At left 60% the hand hung off the button's right-hand side
      // and pointed at nothing.
      left: `calc(50% - ${TOOL_CHOICE.hand * TOOL_CHOICE.handTip.x * 100}%)`,
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
    deck?: IslandScene['deck'],
    next?: { heading: number; distance: number }
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
      legAt: 0,
      travelled: 0,
      distance,
      deck,
      next
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
    // The far bank is not the end: they carry on up it to the cow without stopping, so
    // the second leg is CHAINED to this one rather than sent when this one finishes.
    this.afterRun = () => this.meetCow();
    const onward = {
      heading: THREE.MathUtils.degToRad(FORWARD.headingDeg),
      distance: FORWARD.distance
    };

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
        this.deck,
        onward
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

      const turned = THREE.MathUtils.smoothstep(runner.elapsed - runner.legAt, 0, RUN.turn);
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

      // Carrying straight on: the next leg picks up at full pace and eases onto its own
      // heading from here. Nothing else is reset — `elapsed` in particular, because the
      // ramp above is keyed to it and restarting it would drop them back to a standstill,
      // which is exactly the stutter this replaces. (The bridge and the cow used to be two
      // separate sends, so they settled to idle on the far bank and set off again.)
      if (runner.next) {
        const { heading, distance } = runner.next;
        runner.next = undefined;
        runner.fromYaw = runner.pivot.rotation.y;
        runner.turn = shortestTurn(heading - runner.fromYaw);
        runner.legAt = runner.elapsed;
        runner.travelled = 0;
        runner.distance = distance;
        return true;
      }

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
    // The pair, the wreck they have to look at, and the stand that pays for it.
    const { target, need } = this.frameOn(
      [
        ...this.pairSubjects(),
        { x: STREAM.x, z: BRIDGE.z, height: 1.0 },
        ...this.trees
          .filter((t) => t.grove === 'wood')
          .map((t) => ({ x: t.pivot.position.x, z: t.pivot.position.z, height: TREES.height }))
      ],
      ARRIVAL.margin
    );
    this.moveCamera(
      target,
      need,
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
    need: { w: number; h: number },
    ease: number,
    done?: () => void
  ): void {
    const from = this.cameraTarget.clone();
    const fromNeed = { ...this.need };

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      const k = THREE.MathUtils.smoothstep(elapsed, 0, ease);

      this.cameraTarget.lerpVectors(from, to, k);
      this.need.w = THREE.MathUtils.lerp(fromNeed.w, need.w, k);
      this.need.h = THREE.MathUtils.lerp(fromNeed.h, need.h, k);
      this.camera.position.copy(ISO_DIR).multiplyScalar(CAM_DISTANCE).add(this.cameraTarget);
      this.camera.lookAt(this.cameraTarget);
      this.updateCamera();

      if (elapsed < ease) return true;
      if (done) done();
      return false;
    });
  }

  /**
   * What a beat has to show, measured off the things themselves.
   *
   * Every subject is given as a ground point and a height; both are projected onto the
   * camera's own screen axes about `target`, and the half-extents that hold all of them
   * come back with `margin` added. So a beat says WHAT matters and the zoom follows,
   * instead of a hand-tuned number that was only ever right on one screen.
   *
   * The pair is in every one of these lists. That is the whole point: whatever else a beat
   * frames, neither character can end up off the edge.
   */
  private framing(
    subjects: Array<{ x: number; z: number; height?: number }>,
    margin: number,
    target: THREE.Vector3
  ): { w: number; h: number } {
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);

    let w = 0;
    let h = 0;
    const point = new THREE.Vector3();
    subjects.forEach((subject) => {
      // Its feet and its top: a tall prop reaches up the screen from where it stands.
      [0, subject.height ?? 0].forEach((y) => {
        point.set(subject.x, y, subject.z).sub(target);
        w = Math.max(w, Math.abs(point.dot(right)));
        h = Math.max(h, Math.abs(point.dot(up)));
      });
    });

    // Never tighter than the pair needs when the camera is merely following them.
    return { w: Math.max(w + margin, FRAME_MIN_WIDTH), h: Math.max(h + margin, FRAME_MIN_WIDTH * FRAME_HEIGHT_RATIO) };
  }

  /**
   * Where to point the camera and how much to hold, both worked out from the subjects.
   *
   * Centring on the content is what keeps the zoom tight: a hand-picked target has to be
   * paid for in extra frame on the far side, which is most of why the old shots felt zoomed
   * out. This takes the middle of the subjects' own screen bounds instead, so the frame is
   * the smallest one that still holds everything — with the pair always among them.
   */
  private frameOn(
    subjects: Array<{ x: number; z: number; height?: number }>,
    margin: number
  ): { target: THREE.Vector3; need: { w: number; h: number } } {
    const { down, right } = screenAxes();
    const first = subjects[0] ?? { x: 0, z: 0 };

    // Bounds along the two GROUND directions that project to screen across and down.
    let minR = Infinity, maxR = -Infinity, minD = Infinity, maxD = -Infinity;
    subjects.forEach((s) => {
      const dx = s.x - first.x;
      const dz = s.z - first.z;
      const r = dx * right.x + dz * right.z;
      const d = dx * down.x + dz * down.z;
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minD = Math.min(minD, d); maxD = Math.max(maxD, d);
    });
    const midR = (minR + maxR) / 2;
    const midD = (minD + maxD) / 2;
    const target = new THREE.Vector3(
      first.x + right.x * midR + down.x * midD,
      CAMERA_FOLLOW.aimHeight,
      first.z + right.z * midR + down.z * midD
    );

    return { target, need: this.framing(subjects, margin, target) };
  }

  /** Both characters, as framing subjects. */
  private pairSubjects(): Array<{ x: number; z: number; height: number }> {
    return this.actions.map(({ pivot, height }) => ({ x: pivot.position.x, z: pivot.position.z, height }));
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
          this.shade(model);

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
        this.shade(source);

        const size = new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());

        // Two stands from the one model: the grove that pays for the bridge,
        // and the one penning the cow in on the far bank.
        const plant = (
          grove: 'wood' | 'cow' | 'barn' | 'barnKeep',
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
        // The stand that pays for the repair, to the barn's left...
        plant(
          'barn',
          BARN.treeHeight,
          barn,
          barnSpots(BARN.chopTrees).map((spot) => ({ x: spot.x - barn.x, z: spot.z - barn.z })),
          20,
          barn
        );
        // ...and the ones that are only ever scenery. Nothing fells 'barnKeep'.
        plant(
          'barnKeep',
          BARN.treeHeight,
          barn,
          barnSpots(BARN.keepTrees).map((spot) => ({ x: spot.x - barn.x, z: spot.z - barn.z })),
          30,
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
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
        });

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

        // Into her standing pose BEFORE she is measured. The animation has to be applied
        // first, because her bind pose is not a cow standing on four legs and everything
        // below is measured off the pose, not off the rig — see posedBounds.
        gaits.idle.play();
        mixer.update(0);

        // Scaled and seated on the pose: COW.height is her withers-to-hoof in that stance,
        // and her lowest hoof lands ON the grass. (Her run dips about 0.02 below this and
        // her celebration bobs above it, which is a hoof pressing into grass either way.)
        const posed = posedBounds(model);
        const scale = COW.height / (posed.max.y - posed.min.y);
        model.scale.setScalar(scale);
        const centre = posed.getCenter(new THREE.Vector3());
        model.position.set(-centre.x * scale, -posed.min.y * scale, -centre.z * scale);

        const pivot = new THREE.Group();
        pivot.name = 'cow';
        pivot.add(model);
        pivot.position.set(COW_STOP.x + COW.offset.x, 0, COW_STOP.z + COW.offset.z);
        pivot.rotation.y = THREE.MathUtils.degToRad(COW.yawDeg);
        this.scene.add(pivot);

        this.mixers.push(mixer);
        this.cow = { pivot, gaits, gait: 'idle' };
      },
      undefined,
      (err: unknown) => console.error('Cow model failed to load:', err)
    );
  }

  /** They pull up at the stand. The shot opens on it and the trees go live. */
  private meetCow(): void {
    // The pair, the cow, and the line of trees penning her in.
    const { target, need } = this.frameOn(
      [
        ...this.pairSubjects(),
        // Both ends of her, since she is longer than she is tall — see COW.length.
        ...[-0.5, 0.5].map((end) => ({
          x: COW_STOP.x + COW.offset.x + Math.sin(THREE.MathUtils.degToRad(COW.yawDeg)) * COW.length * end,
          z: COW_STOP.z + COW.offset.z + Math.cos(THREE.MathUtils.degToRad(COW.yawDeg)) * COW.length * end,
          height: COW.height
        })),
        ...cowTreeOffsets().map((o) => ({ x: COW_STOP.x + o.x, z: COW_STOP.z + o.z, height: COW_TREES.height }))
      ],
      COW_SHOT.margin
    );
    this.moveCamera(
      target,
      need,
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
  private followPair(cue = true): void {
    const cow = this.cow;
    if (!cow) return;

    const { down, right } = screenAxes();
    const station = new THREE.Vector3();
    // A skip has already put the pair where the cue would have sent them, so it
    // starts as though she had long since arrived.
    let joined = !cue;

    this.effects.push((delta: number) => {
      station.set(0, 0, 0);
      this.actions.forEach(({ pivot }) => station.add(pivot.position));
      station.divideScalar(Math.max(this.actions.length, 1));
      station.x += -down.x * COW.joinGap + right.x * COW.joinSide;
      station.z += -down.z * COW.joinGap + right.z * COW.joinSide;

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

  /**
   * DEBUG: open on a later beat instead of the first one.
   *
   * Everything before the asked-for beat is APPLIED rather than played — the
   * rocks gone, the bridge whole, the stands felled, the cow free and following,
   * the wheat up — and then that beat's own entry point runs, exactly the one the
   * sequence would have called. So the beat under test behaves as it really does;
   * only the forty seconds of getting there are skipped.
   *
   * It waits for every model first. Each one loads from a data URI in a frame or
   * two, but "a frame or two" is still after the constructor, and half a skip
   * applied to a half-loaded scene is worse than no skip at all.
   */
  private skipTo(stage: IslandStage): void {
    if (stage === 'rubble') return;

    const order: IslandStage[] = ['rubble', 'bridge', 'cow', 'farm', 'barn', 'expansion'];
    const upto = order.indexOf(stage);

    this.effects.push(() => {
      const loaded =
        this.actions.length === CHARACTERS.length &&
        this.breakable &&
        this.bridgeRestored &&
        this.trees.length &&
        this.cow &&
        this.plots.length &&
        this.barn;
      if (!loaded) return true;

      // The rubble's own tool choice and first line went up as it loaded.
      this.clearToolChoice();
      this.hideTapHint();
      this.hideSpeech();

      const drop = (grove: 'wood' | 'cow' | 'barn') =>
        this.trees
          .filter((tree) => tree.grove === grove)
          .forEach((tree) => {
            tree.chopped = true;
            tree.pivot.removeFromParent();
          });

      // Past the rubble: the tapped rocks are gone, the path is in their place,
      // and the pair has run through the gap. They run PARALLEL, so the whole
      // formation is simply translated — which is what preserves their spacing.
      if (upto >= 1) {
        const breakable = this.breakable!;
        breakable.broken = true;
        this.renderer.domElement.style.cursor = '';
        // The rocks that break are simply gone here. A real break leaves their debris on
        // the grass; a skip is not trying to reproduce the shatter, only its outcome.
        for (let n = -RUBBLE_BREAK.spread; n <= RUBBLE_BREAK.spread; n++) {
          this.rocks[breakable.index + n]?.pivot.removeFromParent();
        }

        const heading = RUBBLE.arcCentreDeg;
        this.actions.forEach(({ pivot }) => {
          pivot.position.x += RUN_STOP.x - RUBBLE_CENTRE.x;
          pivot.position.z += RUN_STOP.z - RUBBLE_CENTRE.z;
          pivot.rotation.y = THREE.MathUtils.degToRad(heading);
        });
      }

      // Past the bridge: its stand paid for it, the span is whole, and they are
      // over it and up the far bank — one to each side of the deck's centre line,
      // whichever side they were already on.
      if (upto >= 2) {
        drop('wood');
        this.bridgeBroken?.removeFromParent();
        this.bridgeRestored!.visible = true;
        this.bridgeRestored!.scale.setScalar(1);

        this.actions.forEach(({ pivot }) => {
          const side = Math.sign(pivot.position.z - BRIDGE.z) || 1;
          pivot.position.set(COW_STOP.x, 0, BRIDGE.z + side * CROSSING.lane);
          pivot.rotation.y = THREE.MathUtils.degToRad(FORWARD.headingDeg);
        });
      }

      // Past the cow: her stand is down, she is out and keeping station. The
      // follow is started with its story cue OFF — it fires the walk to the
      // farmland, which the skip has already done.
      if (upto >= 3) {
        drop('cow');
        this.setCowGait('idle');
        this.followPair(false);
        this.place(farmLeg());
      }

      // Past the farmland: the crop is up.
      if (upto >= 4) {
        this.plots.forEach(({ crop, grown }) => {
          crop.visible = true;
          crop.scale.copy(grown);
        });
        this.place(barnLeg());
      }

      // Past the barn: its stand paid for it and it is standing whole.
      if (upto >= 5) {
        drop('barn');
        this.barn!.broken.removeFromParent();
        this.barn!.repaired.visible = true;
        this.barn!.repaired.scale.setScalar(1);
      }

      // The camera starts on them rather than sweeping the island to catch up,
      // and counts as already following, like it would by this point.
      const midpoint = new THREE.Vector3();
      this.actions.forEach(({ pivot }) => midpoint.add(pivot.position));
      midpoint.divideScalar(this.actions.length);
      this.cameraTarget.copy(midpoint).setY(CAMERA_FOLLOW.aimHeight);
      this.cameraFollowing = true;
      this.camera.position.copy(ISO_DIR).multiplyScalar(CAM_DISTANCE).add(this.cameraTarget);
      this.camera.lookAt(this.cameraTarget);

      // ...and then the beat itself, through its own front door.
      if (stage === 'bridge') this.arriveAtBridge();
      if (stage === 'cow') this.meetCow();
      if (stage === 'farm') this.chooseCrop();
      if (stage === 'barn') this.findBarn();
      if (stage === 'expansion') this.expansionMoment();

      return false;
    });
  }

  /**
   * DEBUG: stand the pair at the end of a walk they never took, in their lanes
   * either side of it — the runners keep their spacing, so a skip has to as well.
   */
  private place(leg: { heading: number; stop: { x: number; z: number } }): void {
    const across = { x: Math.cos(leg.heading), z: -Math.sin(leg.heading) };
    this.actions.forEach(({ pivot }, i) => {
      const side = i === 0 ? 1 : -1;
      pivot.position.set(
        leg.stop.x + across.x * CROSSING.lane * side,
        0,
        leg.stop.z + across.z * CROSSING.lane * side
      );
      pivot.rotation.y = leg.heading;
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
    this.addPlots(farmField(), FARM.cols, FARM.rows, true);
  }

  /**
   * A block of tilled beds, wheat hidden. The farm beat plants ITS beds when the
   * player picks a crop, so it asks to keep them (plant = true); the expansion's
   * spare ground never gets planted and is left out of that list.
   */
  private addPlots(
    at: { x: number; z: number },
    cols: number,
    rows: number,
    plant: boolean,
    // The village's beds are laid at EXPANSION.scale along with everything else there; the
    // farm the player plants is at 1.
    bedScale = 1,
    // Centre-to-centre between beds, before bedScale. Defaults to this scene's own farm,
    // whose beds stand apart; the village's grid passes the reference's 1.2, which touches.
    step = FARM.plot + FARM.gap
  ): void {
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
          // The bed is a flat decal on the grass — casting from it bands against the
          // ground it is painted onto. The wheat standing in it does cast.
          mesh.castShadow = asked === 'cropMat';
          mesh.receiveShadow = true;
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
        const scale = (FARM.plot * bedScale) / Math.max(bedSize.x, bedSize.z);

        // Laid out on the WORLD axes, not the screen ones the cow's tree line
        // uses: the beds are square in world space, so anything else leaves gaps
        // between them that no amount of tuning closes.
        const spacing = step * bedScale;
        const group = new THREE.Group();
        group.name = plant ? 'farm' : 'farmland';

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const plot = source.clone(true);
            plot.scale.setScalar(scale);
            plot.position.set(
              at.x + (col - (cols - 1) / 2) * spacing,
              FARM.lift,
              at.z + (row - (rows - 1) / 2) * spacing
            );

            const crop = plot.getObjectByName('Wheat_Finished');
            if (crop) {
              crop.rotation.x = THREE.MathUtils.degToRad(FARM.cropUprightDeg);
              crop.visible = false; // empty farmland, until the player plants it
              if (plant) this.plots.push({ crop, grown: crop.scale.clone() });
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
          this.shade(source);

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

  /**
   * The town on the island's empty half: a street, homes and working buildings set
   * back off it, trucks idling at the kerb, lamps between the doors, and fields on
   * the open side. It stands from the first frame — every earlier beat is framed too
   * tightly to see it, so there is nothing to gain by hiding it and a pop-in would
   * only draw the eye to the seam.
   */
  private addExpansion(): void {
    // One material per atlas-and-convention pair, shared by everything that wants
    // it. The sheep home is the only model carrying grass and foliage as well as
    // walls, so it is the only one that needs two.
    const atlas = (src: string, flipY: boolean, cutout = false) => {
      const texture = new THREE.TextureLoader().load(src);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = flipY;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 1,
        ...(cutout ? { alphaTest: 0.5, side: THREE.DoubleSide } : {})
      });
    };
    const buildings = { true: atlas(boatTextureSrc, true), false: atlas(boatTextureSrc, false) };

    const group = new THREE.Group();
    group.name = 'town';
    this.scene.add(group);

    const loader = new GLTFLoader();
    // The reference sizes every prop by its LARGEST dimension ('max' in its own config),
    // not by height the way the rest of this scene does — which is what keeps its
    // buildings in proportion to each other. So this takes that measure instead.
    const place = (
      src: string,
      at: { x: number; z: number },
      maxDim: number,
      yawDeg: number,
      flip: boolean,
      onReady?: (pivot: THREE.Group) => void
    ) => {
      loader.load(
        src,
        (gltf: { scene: THREE.Group }) => {
          const model = gltf.scene;
          model.traverse((child: THREE.Object3D) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.material = buildings[flip ? 'true' : 'false'];
          });
          this.shade(model);

          const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
          model.scale.setScalar(maxDim / Math.max(size.x, size.y, size.z));

          const box = new THREE.Box3().setFromObject(model);
          const centre = box.getCenter(new THREE.Vector3());
          model.position.set(-centre.x, -box.min.y, -centre.z);

          const pivot = new THREE.Group();
          pivot.add(model);
          pivot.position.set(at.x, 0, at.z);
          pivot.rotation.y = THREE.MathUtils.degToRad(yawDeg);
          group.add(pivot);
          if (onReady) onReady(pivot);
        },
        undefined,
        (err: unknown) => console.error(`Town model failed to load (${src.slice(0, 40)}):`, err)
      );
    };

    // The roads. Road.glb is authored as a 42-unit strip along its own Z, so each one is
    // scaled to its length and width and turned by its own yaw — and the corner piece
    // drops in where they meet.
    const roadMaterial = atlas(roadTextureSrc, false);
    const flat = (src: string, jobs: Array<{ at: { x: number; z: number }; yawDeg: number; length: number; width: number }>) => {
      new GLTFLoader().load(
        src,
        (gltf: { scene: THREE.Group }) => {
          const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
          jobs.forEach((job) => {
            const model = gltf.scene.clone(true);
            model.traverse((child: THREE.Object3D) => {
              if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = roadMaterial;
            });
            this.shade(model, true); // a road is a decal: it catches shadow, never casts
            model.scale.set(job.width / size.x, 1, job.length / size.z);

            const box = new THREE.Box3().setFromObject(model);
            const centre = box.getCenter(new THREE.Vector3());
            model.position.set(-centre.x, -box.min.y, -centre.z);

            const pivot = new THREE.Group();
            pivot.name = 'road';
            pivot.add(model);
            pivot.position.set(job.at.x, EXPANSION.lift, job.at.z);
            pivot.rotation.y = THREE.MathUtils.degToRad(job.yawDeg);
            group.add(pivot);
          });
        },
        undefined,
        (err: unknown) => console.error('Road model failed to load:', err)
      );
    };
    // Each road carries its own model: the long strips, and the corner where they meet.
    EXPANSION.roads.forEach((road) =>
      flat(road.src, [
        {
          at: villageAt(road.at),
          yawDeg: road.yawDeg,
          length: road.length * EXPANSION.scale,
          width: (road.width ?? road.length) * EXPANSION.scale
        }
      ])
    );

    // The buildings, each at the position and facing the source layout gives it.
    // flip TRUE only for the models that came through scripts_fbx2glb.mjs (their farmhouse,
    // and our two trucks); every other prop here is one of the farm's own GLBs.
    EXPANSION.buildings.forEach((b) =>
      place(b.src, villageAt(b.at), b.size * EXPANSION.scale, b.yawDeg, b.src === farmhouseSrc)
    );

    // The pens. Each run is a row of panels either side of its middle — the fence model
    // is a single straight panel, so a pen is four short rows of it.
    new GLTFLoader().load(
      fenceSrc,
      (gltf: { scene: THREE.Group }) => {
        const source = gltf.scene;
        source.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = buildings.false;
        });
        this.shade(source);
        // Righted BEFORE it is measured, or the width this scales by is the board's
        // thickness.
        source.rotation.x = THREE.MathUtils.degToRad(EXPANSION.fenceUprightDeg);
        source.updateMatrixWorld(true);
        const size = new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
        const scale = (EXPANSION.fencePanel * EXPANSION.scale) / size.x;

        EXPANSION.fences.forEach((run) => {
          const at = villageAt(run.at);
          for (let i = 0; i < run.count; i++) {
            const offset = (i - (run.count - 1) / 2) * run.spacing * EXPANSION.scale;
            const panel = source.clone(true);
            panel.scale.setScalar(scale);

            const box = new THREE.Box3().setFromObject(panel);
            const centre = box.getCenter(new THREE.Vector3());
            panel.position.set(-centre.x, -box.min.y, -centre.z);

            const pivot = new THREE.Group();
            pivot.add(panel);
            pivot.position.set(
              at.x + (run.alongZ ? 0 : offset),
              0,
              at.z + (run.alongZ ? offset : 0)
            );
            // The panel is authored along its own X, so a run down Z needs a quarter turn.
            if (run.alongZ) pivot.rotation.y = Math.PI / 2;
            group.add(pivot);
          }
        });
      },
      undefined,
      (err: unknown) => console.error('Fence model failed to load:', err)
    );

    // The trucks, left ticking over at the kerb.
    EXPANSION.trucks.forEach((truck) =>
      place(
        truck.src,
        villageAt(truck.at),
        truck.height * EXPANSION.scale,
        truck.yawDeg,
        true,
        (pivot) => this.idle(pivot)
      )
    );

    this.addPlots(
      villageAt(EXPANSION.farmland.at),
      EXPANSION.farmland.cols,
      EXPANSION.farmland.rows,
      false,
      EXPANSION.scale,
      EXPANSION.farmland.spacing
    );
    this.addVillageGround(group, buildings, atlas(rubbleTextureSrc, false, true));
  }

  /**
   * The ground the village stands on: a ring of trees closing it in, bushes inside that, and
   * flowers, grass and rocks over the open ground. Straight out of the reference's own
   * scatters — same counts, same radii, same size ranges — because its buildings alone do not
   * make it look like that farm; this is what does.
   *
   * Everything is laid down in rings about the village's centre, keyed on the reference's own
   * seeds so the arrangement is fixed rather than reshuffling on every load, and kept off the
   * roads and the buildings by the same keep-clear list the island's scatter uses.
   */
  private addVillageGround(
    group: THREE.Group,
    buildings: { true: THREE.Material; false: THREE.Material },
    foliage: THREE.Material
  ): void {
    const centre = EXPANSION.at;
    const fenced = keepClear();
    const taken: Array<{ x: number; z: number; r: number }> = [];

    const ring = (
      cfg: { count: number; inner: number; outer: number; min: number; max: number; spacing: number; salt: number },
      sources: Array<{ src: string; material: THREE.Material; tall: boolean }>
    ) => {
      const spots: Array<{ x: number; z: number; size: number; yaw: number; pick: number }> = [];
      // Radii and sizes come down with the village they surround — see EXPANSION.scale.
      const vs = EXPANSION.scale;
      for (let i = 0; spots.length < cfg.count && i < cfg.count * 30; i++) {
        // Even area coverage of the annulus, not even radius: sqrt keeps the outer ring from
        // coming out thin.
        const angle = jitter(i, cfg.salt) * Math.PI * 2;
        const inner = cfg.inner * vs;
        const outer = cfg.outer * vs;
        const radius = Math.sqrt(inner * inner + jitter(i, cfg.salt + 1) * (outer * outer - inner * inner));
        const x = centre.x + Math.cos(angle) * radius;
        const z = centre.z + Math.sin(angle) * radius;
        if (Math.abs(x) > ISLAND_HALF - 1.2 || Math.abs(z) > ISLAND_HALF - 1.2) continue;

        const size = (cfg.min + jitter(i, cfg.salt + 2) * (cfg.max - cfg.min)) * vs;
        const foot = size * 0.35;
        if (fenced.some((lane) => distanceToLane(x, z, lane) < lane.r + foot)) continue;
        if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < Math.max(t.r + foot, cfg.spacing * vs))) continue;

        taken.push({ x, z, r: foot });
        spots.push({ x, z, size, yaw: jitter(i, cfg.salt + 3) * Math.PI * 2, pick: Math.floor(jitter(i, cfg.salt + 4) * sources.length) });
      }

      const loader = new GLTFLoader();
      sources.forEach((source, which) => {
        const mine = spots.filter((spot) => spot.pick === which);
        if (!mine.length) return;
        loader.load(
          source.src,
          (gltf: { scene: THREE.Group }) => {
            const model = gltf.scene;
            model.traverse((child: THREE.Object3D) => {
              if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = source.material;
            });
            this.shade(model, !source.tall);
            const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
            const measure = source.tall ? size.y : Math.max(size.x, size.y, size.z);

            mine.forEach((spot) => {
              const clone = model.clone(true);
              clone.scale.setScalar(spot.size / measure);
              const box = new THREE.Box3().setFromObject(clone);
              const middle = box.getCenter(new THREE.Vector3());
              clone.position.set(-middle.x, -box.min.y, -middle.z);

              const pivot = new THREE.Group();
              pivot.add(clone);
              pivot.position.set(spot.x, 0, spot.z);
              pivot.rotation.y = spot.yaw;
              group.add(pivot);
            });
          },
          undefined,
          (err: unknown) => console.error(`Village ground model failed (${source.src.slice(0, 30)}):`, err)
        );
      });
    };

    const leafy = (src: string) => ({ src, material: foliage, tall: false });
    // Trees are sized on HEIGHT, like the reference does for its perimeter ring; everything
    // else on its largest dimension.
    const g = EXPANSION.ground;
    ring(g.trees, [birchSrc, treeDenseSrc, treeSrc].map((src) => ({ src, material: foliage, tall: true })));
    ring(g.bushes, [bushDarkSrc, bushLightSrc].map(leafy));
    ring(g.flowers, [flowersSrc].map(leafy));
    ring(g.grass, [grassSmallSrc, grassMediumSrc, grassFancySrc].map((src) => ({ src, material: src === grassSmallSrc ? foliage : buildings.false, tall: false })));
    ring(g.flowerGrass, [flowerGrassSrc].map(leafy));
    ring(g.rocks, [rocksSrc].map((src) => ({ src, material: buildings.false, tall: false })));
  }

  /**
   * An engine ticking over: a fast, tiny rise and a slow rock, both far too small to
   * read as movement and just enough that the truck is not a rock. Runs for as long
   * as the scene does — it is only ever four numbers a frame.
   */
  private idle(pivot: THREE.Group): void {
    const { rise, rate, rock } = EXPANSION.idle;
    const baseY = pivot.position.y;
    const baseTilt = pivot.rotation.z;
    let elapsed = Math.abs(pivot.position.x); // so two trucks are never in phase
    this.effects.push((delta: number) => {
      elapsed += delta;
      pivot.position.y = baseY + Math.abs(Math.sin(elapsed * rate)) * rise;
      pivot.rotation.z = baseTilt + Math.sin(elapsed * rate * 0.5) * THREE.MathUtils.degToRad(rock);
      return true;
    });
  }

  /**
   * The pull-back. The shot opens out off the finished barn, the island turns out to
   * be half empty, and an arrow drops in over each thing still to build.
   */
  private expansionMoment(): void {
    this.say(SPEECH_LINES.expand, 5);
    this.moveCamera(
      new THREE.Vector3(EXPANSION.centre.x, CAMERA_FOLLOW.aimHeight, EXPANSION.centre.z),
      EXPANSION.frame,
      EXPANSION.ease,
      () => this.showArrows()
    );
  }

  /**
   * A down-arrow over each opportunity, arriving one after another and then bobbing
   * for as long as the playable is up. They are UI: depth testing off and a high
   * render order, so a roof can never swallow one.
   *
   * All four run off ONE effect. Four effects would do the same job, but this is the
   * last thing on screen and it never ends — so it is also the one that keeps
   * running while the endcard sits over it.
   */
  private showArrows(): void {
    const arrow = EXPANSION.arrow;
    const texture = new THREE.TextureLoader().load(arrowSrc);
    texture.colorSpace = THREE.SRGBColorSpace;

    const arrows = EXPANSION.arrows.map((offset, i) => {
      const spot = villageAt(offset.at);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      // The arrows hang over props that are now EXPANSION.scale of their configured size,
      // so both the sprite and how high it floats come down with them.
      const size = arrow.size * EXPANSION.scale;
      sprite.scale.setScalar(size);
      sprite.renderOrder = 995;
      // The art points DOWN with its tip at the bottom edge, so the sprite hangs
      // half its own height above whatever the tip should be touching.
      sprite.position.set(spot.x, offset.over * EXPANSION.scale + size / 2, spot.z);
      this.scene.add(sprite);
      return { sprite, material, baseY: sprite.position.y, delay: i * arrow.stagger };
    });

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      arrows.forEach((a, i) => {
        const live = elapsed - a.delay;
        if (live <= 0) return;
        a.material.opacity = Math.min(live / arrow.fade, 1);
        // Each one bobs a third of a cycle out of step with the last, so the four
        // of them do not pulse as one.
        a.sprite.position.y = a.baseY + Math.sin(live * arrow.rate + i * 2.1) * arrow.bob;
      });
      return true; // they stay up for good
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
    const field = farmField();
    const half = ((Math.max(FARM.cols, FARM.rows) - 1) / 2) * (FARM.plot + FARM.gap) + FARM.plot / 2;
    // The pair and all four corners of the ground they are about to plant.
    const { target, need } = this.frameOn(
      [
        ...this.pairSubjects(),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: field.x + sx * half, z: field.z + sz * half, height: 0.8 })))
      ],
      FARM.margin
    );
    this.moveCamera(
      target,
      need,
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
    const barn = barnAt();
    // The pair, the wreck, and its stand.
    const { target, need } = this.frameOn(
      [
        ...this.pairSubjects(),
        { x: barn.x, z: barn.z, height: BARN.height },
        ...barnSpots([...BARN.keepTrees, ...BARN.chopTrees]).map((spot) => ({
          x: spot.x,
          z: spot.z,
          height: BARN.treeHeight
        }))
      ],
      BARN.margin
    );
    this.moveCamera(
      target,
      need,
      BARN.ease,
      () => {
        this.wood = 0; // the bridge spent its own logs; this beat counts its own
        this.repairing = {
          grove: 'barn',
          target: new THREE.Vector3(barn.x, BARN.brokenHeight * 0.55, barn.z),
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
    let landed = false;
    this.effects.push((delta: number) => {
      elapsed += delta;
      const k = Math.min(elapsed / CHOP.fall, 1);
      // Accelerating, because a tree does not topple at a constant rate — it hinges slowly
      // off the stump and then goes over all at once.
      let angle = remaining * k * k;

      if (k >= 1) {
        // Down. It kicks back off the ground and the kick dies away — a damped bounce
        // rather than a hard stop.
        const since = elapsed - CHOP.fall;
        const decay = Math.max(0, 1 - since / CHOP.settle);
        angle -= THREE.MathUtils.degToRad(CHOP.bounce) * decay * decay * Math.sin((since / CHOP.settle) * Math.PI * 2);

        if (!landed) {
          landed = true;
          // Dust, thrown up along the length of the trunk where it hit.
          const along = tree.pivot.position
            .clone()
            .addScaledVector(
              new THREE.Vector3(-axis.z, 0, axis.x).normalize(), // the way it fell
              CHOP.dustAlong * (tree.grove === 'cow' ? COW_TREES.height : TREES.height)
            );
          this.smoke(along.clone().setY(0.12), CHOP.dust, CHOP.dustFor);
          // ...and the canopy sheds its leaves where it struck the ground.
          this.leaves(along.setY(0.35), this.trees.indexOf(tree));
        }
      }

      tilt.setFromAxisAngle(axis, angle);
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
   * Both barns, loaded together and stacked in the same spot: the abandoned one
   * showing, the whole one waiting inside it for the timber to arrive. Exactly how
   * addBridge holds its pair, and for the same reason — a tap has to answer
   * instantly, so nothing is fetched at the moment it is needed.
   */
  private addBarn(): void {
    // Buildings atlas, flipY TRUE — see the note at the imports: both of these came
    // out of the FBX converter, not the farm's own pipeline.
    const texture = new THREE.TextureLoader().load(boatTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });

    const at = barnAt();
    const place = (
      src: string,
      height: number,
      uprightDeg: number,
      yawDeg: number,
      onReady: (pivot: THREE.Group) => void
    ) => {
      new GLTFLoader().load(
        src,
        (gltf: { scene: THREE.Group }) => {
          const model = gltf.scene;
          model.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
          });
          this.shade(model);

          // Righted FIRST, before a single measurement: the height this is about to
          // be scaled by is read off the box, so measuring a model that is lying on
          // its back would scale it by its own length.
          model.rotation.x = THREE.MathUtils.degToRad(uprightDeg);

          // Each is scaled on its OWN height, not on a shared factor: the two are
          // authored in different units (5.4 units tall against 20.4), so a shared
          // factor would put one of them at a quarter of the size of the other.
          const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
          model.scale.setScalar(height / size.y);

          const box = new THREE.Box3().setFromObject(model);
          const centre = box.getCenter(new THREE.Vector3());
          model.position.set(-centre.x, -box.min.y - BARN.sink, -centre.z);

          const pivot = new THREE.Group();
          pivot.add(model);
          pivot.position.set(at.x, 0, at.z);
          pivot.rotation.y = THREE.MathUtils.degToRad(yawDeg);
          this.scene.add(pivot);
          onReady(pivot);
        },
        undefined,
        (err: unknown) => console.error('Barn model failed to load:', err)
      );
    };

    // Two loads, either of which may land first, so the pair is assembled as the
    // pieces arrive rather than assumed to be in order.
    const parts: { broken?: THREE.Group; repaired?: THREE.Group } = {};
    const ready = () => {
      if (!parts.broken || !parts.repaired) return;
      this.barn = { broken: parts.broken, repaired: parts.repaired };
    };

    place(barnBrokenSrc, BARN.brokenHeight, BARN.brokenUprightDeg, BARN.brokenYawDeg, (pivot) => {
      pivot.name = 'barnBroken';
      parts.broken = pivot;
      ready();
    });
    place(barnSrc, BARN.height, 0, BARN.yawDeg, (pivot) => {
      pivot.name = 'barn';
      pivot.visible = false; // sits inside the wreck, waiting its turn
      parts.repaired = pivot;
      ready();
    });
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
   * Leaves knocked out of a canopy: thrown up and out, then fluttering down while they
   * fade. Each one sways on its own phase so the dozen of them do not fall as a block.
   */
  private leaves(at: THREE.Vector3, seed: number): void {
    const cfg = CHOP.leaves;
    const flock = Array.from({ length: cfg.count }, (_, n) => {
      const i = n + seed * cfg.count;
      const material = new THREE.SpriteMaterial({
        map: this.puffTexture(),
        color: cfg.colour,
        transparent: true,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(cfg.size * (0.7 + jitter(i, 61) * 0.6));
      sprite.position.copy(at);
      sprite.renderOrder = 994;
      this.scene.add(sprite);

      const heading = jitter(i, 62) * Math.PI * 2;
      const out = cfg.burst * (0.4 + jitter(i, 63) * 0.9);
      return {
        sprite,
        material,
        velocity: new THREE.Vector3(
          Math.sin(heading) * out,
          cfg.lift * (0.5 + jitter(i, 64) * 0.8),
          Math.cos(heading) * out
        ),
        phase: jitter(i, 65) * Math.PI * 2,
        sway: cfg.sway * (0.6 + jitter(i, 66) * 0.8),
        life: cfg.life * (0.7 + jitter(i, 67) * 0.5)
      };
    });

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      let flying = false;

      flock.forEach((leaf) => {
        const k = elapsed / leaf.life;
        if (k >= 1) {
          leaf.sprite.visible = false;
          return;
        }
        flying = true;
        leaf.velocity.y -= cfg.gravity * delta;
        leaf.sprite.position.addScaledVector(leaf.velocity, delta);
        // Once it is falling it drifts, the way a leaf does instead of dropping.
        if (leaf.velocity.y < 0) {
          leaf.sprite.position.x += Math.sin(elapsed * leaf.sway + leaf.phase) * delta * 0.6;
          leaf.sprite.position.z += Math.cos(elapsed * leaf.sway + leaf.phase) * delta * 0.6;
        }
        if (leaf.sprite.position.y < 0.05) {
          leaf.sprite.position.y = 0.05;
          leaf.velocity.set(0, 0, 0);
        }
        leaf.material.opacity = Math.min(1, 2 - 2 * k); // holds, then goes in the last half
      });

      if (flying) return true;
      flock.forEach((leaf) => {
        leaf.sprite.removeFromParent();
        leaf.material.dispose();
      });
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

  /**
   * Trade one prop for another under a burst of smoke: the wreck goes, the whole
   * thing springs out in its place, and the change itself happens at full cover
   * where there is nothing to see. Both repairs in the scene are this — the bridge
   * and the barn — and both call it rather than owning a copy.
   */
  private swapUnderSmoke(
    broken: THREE.Object3D | undefined,
    restored: THREE.Object3D,
    centre: THREE.Vector3,
    poof: { puffs: number; size: number; spread: number; rise: number; swap: number; pop: number },
    seconds: number,
    stretch: number,
    settled: () => void
  ): void {
    this.smoke(centre, poof, seconds, stretch);

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

      if (elapsed < seconds + 0.15) return true;

      restored.scale.setScalar(1);
      if (broken) broken.removeFromParent();
      settled();
      return false;
    });
  }

  /** Enough wood: a poof of smoke swallows the wreck and leaves the new span. */
  private repairBridge(): void {
    const restored = this.bridgeRestored;
    if (!restored) return;

    this.swapUnderSmoke(
      this.bridgeBroken,
      restored,
      new THREE.Vector3(STREAM.x, 0.35, BRIDGE.z),
      BRIDGE.poof,
      BRIDGE.repair,
      1.15, // the ring is pulled along the span, so it covers a bridge not a ball
      () => {
        this.say(SPEECH_LINES.cross, 3.5); // this one is a payoff, so it times out
        // A beat to see what they built, then over they go.
        this.wait(CROSSING.delay, () => this.crossBridge());
      }
    );
  }

  /** Enough timber: the wreck of a barn goes up as a barn. */
  private repairBarn(): void {
    const barn = this.barn;
    if (!barn) return;

    this.swapUnderSmoke(
      barn.broken,
      barn.repaired,
      new THREE.Vector3(barn.repaired.position.x, BARN.height * 0.4, barn.repaired.position.z),
      BARN.poof,
      BARN.repair,
      1,
      () => {
        this.say(SPEECH_LINES.barnFixed, 4);
        // ...and then the shot pulls back off it, which is where the playable ends.
        this.wait(EXPANSION.delay, () => this.expansionMoment());
      }
    );
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

    // WHICH SIDE it hangs on. Two things decide it, in this order:
    //
    //  1. it must be ON SCREEN. The box is 1.15 units wide against a frame that can be as
    //     narrow as 4.2, so a box hung off the wrong side of a character standing near the
    //     edge runs straight out of frame — and the tail has to stay on the speaker, so
    //     sliding the box back in is not an option. Choosing the side IS the fix.
    //  2. failing a tie, away from the other character: the pair stand close and the speaker
    //     alternates, so a fixed side covered the other one on every other line.
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const boxHeight = (SPEECH.width * image.height * SPEECH.squash) / image.width;
    const other = this.actions.find((entry) => entry !== speaker);
    const away =
      other &&
      new THREE.Vector3().subVectors(speaker.pivot.position, other.pivot.position).dot(right) < 0
        ? -1
        : 1;

    // How far off the frame's edge each side would put the box, in world units along the
    // camera's right. The frustum is orthographic, so its half-width IS a world distance.
    const halfFrame = (this.camera.right - this.camera.left) / 2;
    const overflow = (candidate: number): number => {
      const tail = candidate < 0 ? 1 - SPEECH.tail.x : SPEECH.tail.x;
      const middle = new THREE.Vector3()
        .copy(speaker.pivot.position)
        .addScaledVector(right, SPEECH.faceGap * candidate + (0.5 - tail) * SPEECH.width);
      // where that middle sits across the frame, measured from the camera's own axis
      const across = middle.clone().sub(this.cameraTarget).dot(right);
      return Math.max(0, Math.abs(across) + SPEECH.width / 2 - halfFrame + SPEECH.margin);
    };
    const side = overflow(away) <= overflow(-away) ? away : -away;

    // Drawn at twice the art's size so the words stay crisp — the bubble is
    // only 197px wide but covers a good part of a phone screen.
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (side < 0) {
      // Flipped so the tail still points AT the speaker from the other side. Only the art is
      // flipped — the text is drawn after this, unmirrored.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

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
    const bodyX = side < 0 ? 1 - SPEECH.body.x - SPEECH.body.width : SPEECH.body.x;
    const midX = (bodyX + SPEECH.body.width / 2) * canvas.width;
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
    const height = boxHeight;
    sprite.scale.set(SPEECH.width, height, 1);
    this.scene.add(sprite);
    this.speech = sprite;

    // From the tail tip to the middle of the sprite. The tip goes on the speaker; this puts
    // everything else where it belongs relative to it. `right` and `up` come off the CAMERA's
    // matrix rather than the world's (see above, where side is worked out): a sprite always
    // faces the camera, and world up would slide the box off the speaker's head as it rose.
    //
    // The tail mirrors with the art, which is what swings the box to the other side.
    const tailX = side < 0 ? 1 - SPEECH.tail.x : SPEECH.tail.x;
    const fromTail = new THREE.Vector3()
      .addScaledVector(right, (0.5 - tailX) * SPEECH.width)
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
        .addScaledVector(right, SPEECH.faceGap * side)
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
   * Break the tapped rock: it shrinks away and throws a handful of chunks that arc out and
   * land. What they leave behind IS the way through — see shatterRock, where the debris is
   * left lying on the grass rather than being cleared for a path model.
   */
  private breakRubble(): void {
    if (!this.breakable || this.breakable.broken || !this.rubbleMaterial) return;

    const { index } = this.breakable;
    this.breakable.broken = true;
    this.renderer.domElement.style.cursor = '';
    this.hideTapHint();

    // Debris shares one clone of the rock material — cloned so nothing done to it can
    // touch the rocks still standing. It is NOT faded: the chunks stay on the grass.
    const material = this.rubbleMaterial.clone();

    // The tap takes its neighbours with it, so the opening is wide enough for
    // two to run through abreast — one rock leaves a 1.1u gap and the pair is
    // 1.5u across, which put a rock through each of them.
    for (let offset = -RUBBLE_BREAK.spread; offset <= RUBBLE_BREAK.spread; offset++) {
      const target = this.rocks[index + offset];
      if (target) this.shatterRock(target.pivot, target.rock, material, index + offset);
    }

    this.startRunning();
  }

  /**
   * One rock coming apart: it shrinks away and throws a handful of chunks that arc out,
   * bounce off the grass and settle into it.
   *
   * The two things that made the old version read as fake, both fixed here:
   *
   *  - it ran on a fixed 0.5s clock, but the flight alone took ~0.75s, so the effect was
   *    torn down with the chunks still in the air and they hung there for the rest of the
   *    playable. Now it lives until every chunk is actually down.
   *  - a chunk's mesh sits above its holder's origin, so "y = 0" rested them a fraction
   *    ABOVE the grass, and they stopped dead on one frame. Now each chunk is re-centred on
   *    its holder so tumbling cannot walk it off, it rests at its own radius (a little into
   *    the grass), and it gets there over a couple of decaying bounces.
   */
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

      // Hang the chunk off its own centre, so a tumbling chunk turns in place instead of
      // swinging its mesh through the grass — and so one radius above the ground is a
      // resting height that holds at any rotation.
      chunk.updateMatrixWorld(true);
      const ball = new THREE.Box3()
        .setFromObject(chunk)
        .getBoundingSphere(new THREE.Sphere());
      chunk.position.sub(ball.center);
      const rest = ball.radius * RUBBLE_BREAK.sit;

      // Thrown around the compass, each chunk's share of it nudged off true and its
      // speed varied, so the burst is not a ring leaving at one rate.
      const share = (Math.PI * 2) / RUBBLE_BREAK.debris;
      const heading = n * share + (jitter(i, 3) - 0.5) * share * RUBBLE_BREAK.debrisSpread;
      const speed = RUBBLE_BREAK.debrisSpeed * (0.6 + jitter(i, 4) * 0.8);
      const holder = new THREE.Group();
      holder.position.copy(pivot.position);
      holder.position.y += rockHeight * 0.45;
      holder.add(chunk);
      this.scene.add(holder);

      return {
        holder,
        rest,
        settled: false,
        velocity: new THREE.Vector3(
          Math.sin(heading) * speed,
          RUBBLE_BREAK.debrisLift * (0.7 + jitter(i, 5) * 0.6),
          Math.cos(heading) * speed
        ),
        spin: new THREE.Vector3(jitter(i, 6) - 0.5, jitter(i, 7) - 0.5, jitter(i, 8) - 0.5)
          .multiplyScalar(12)
      };
    });

    // A puff of dust at the break, at the height the chunks leave from: stone cracking
    // apart throws grit, and it covers the frame or two where the rock is half-shrunk.
    this.smoke(
      pivot.position.clone().setY(rockHeight * 0.45),
      RUBBLE_BREAK.dust,
      RUBBLE_BREAK.collapse * 2
    );

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;

      // The rock drops out from under the debris over the first part of it, and is gone
      // the moment it has shrunk to nothing.
      const shrink = Math.max(0, 1 - elapsed / RUBBLE_BREAK.collapse);
      if (shrink > 0) pivot.scale.setScalar(shrink);
      else if (pivot.parent) pivot.removeFromParent();

      let flying = false;
      chunks.forEach((chunk) => {
        const { holder, velocity, spin } = chunk;
        if (chunk.settled) return;
        flying = true;

        velocity.y -= RUBBLE_BREAK.gravity * delta;
        holder.position.addScaledVector(velocity, delta);
        // Spun by whatever it is still carrying, so the tumble slows with the chunk
        // rather than being switched off on the frame it touches down.
        holder.rotation.x += spin.x * delta;
        holder.rotation.y += spin.y * delta;
        holder.rotation.z += spin.z * delta;
        if (holder.position.y > chunk.rest) return;

        // Hit the grass. Most of the impact is lost to it, along with over half the
        // slide and the tumble; below a walking pace it is down for good.
        holder.position.y = chunk.rest;
        if (-velocity.y < RUBBLE_BREAK.rest) {
          chunk.settled = true;
          return;
        }
        velocity.y *= -RUBBLE_BREAK.bounce;
        velocity.x *= RUBBLE_BREAK.friction;
        velocity.z *= RUBBLE_BREAK.friction;
        spin.multiplyScalar(RUBBLE_BREAK.friction);
      });

      // Runs until the last chunk is actually down — the old fixed clock ended while they
      // were mid-air and left them hanging. The debris then STAYS: broken stone lying where
      // it fell is what shows the way is clear, so nothing is removed and nothing fades.
      return flying || shrink > 0;
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

  /**
   * Orthographic frustum that CONTAINS what the beat needs, whatever the screen.
   *
   * The old version fixed the half-width to a single number and let the height fall out of
   * the aspect, so a 375x667 phone got a frame five units across and nearly nine tall: the
   * zoom never answered to how much the beat actually needed, the spare height read as
   * being zoomed out, and anything wider than that fixed width — a character standing off
   * to one side — was simply cut off.
   *
   * Now both half-extents are asked for, and the frustum is grown until it holds both:
   * whichever of the two the screen makes binding decides the zoom. Nothing the beat asked
   * for can be cropped on any aspect, portrait or landscape.
   */
  private updateCamera(): void {
    const aspect = this.width / this.height;
    const halfW = Math.max(this.need.w, this.need.h * aspect);
    const halfH = halfW / aspect;
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

    this.water?.update(elapsed);
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
