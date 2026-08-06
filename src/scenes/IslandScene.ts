// Clean standalone island scene: just the grass island, sandy beach, and toon
// water, viewed through a true ORTHOGRAPHIC ISOMETRIC camera. Because the camera
// is orthographic, the water reads as an even border on every side of the island
// (no perspective horizon), which is the classic Hay Day / FarmVille map look.
import * as THREE from 'three';
import { sdk } from '@smoud/playable-sdk';
import { sfx } from '../audio/Sfx';
import type { IslandStage } from '../config/debugConfig';
import { GLTFLoader as GLTFLoaderBase } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createIslandWater } from '../three/IslandWater.js';
import grassTextureSrc from 'assets/images/Ground3.webp';
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
import boatTextureSrc from 'assets/images/Buildings.webp';
import merrySrc from 'assets/models/Merry-Anim.glb';
import merryTextureSrc from 'assets/images/C_Merryweather_Classic.webp';
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
import cowTextureSrc from 'assets/images/A_Cow_Shorthorn.webp';
// Farm plot, same convention as the tree and the cow: flipY FALSE. It carries
// BOTH halves of the farming beat in one file — a flat tilled bed on the
// buildings atlas, with the finished wheat as a child node on the crop atlas —
// so empty farmland is that child hidden and planting is it shown.
// (assets/models/PlotWheat (1).glb is a byte-identical duplicate of this and can
// be deleted.)
import plotSrc from 'assets/models/PlotWheat.glb';
import cropTextureSrc from 'assets/images/Crops_Texture.png';
import wheatSrc from 'assets/images/Wheat.webp';
import appleSrc from 'assets/images/Apple.webp';
import carrotSrc from 'assets/images/Carrot.webp';
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
// The homes. NOT expansion/SheepHome.fbx AS A PROP, which cannot be textured with anything in
// this project: its FBX points at a Buildings.png from the pack it came from, and its
// UV islands do not line up with our Buildings.jpg — whole wall faces span the atlas's
// empty black space, so it renders as a black slab under either flipY. Verified in the
// browser: forcing a plain colour onto the mesh lit it correctly, so the geometry and
// lighting are fine and only the mapping is wrong. Drop that Buildings.png into
// assets/images and SheepHome can come straight back.
import homeSrc from 'assets/models/B_Classic_Livinghouse_Filler.glb';
// ...and it DOES come back as the livestock button's icon, textured off that same atlas — see
// showUpgradeChoice. Both halves of the note above were checked rather than taken on trust, and
// neither held: every mesh in the file decodes to sound geometry (no out-of-range indices,
// median edge 0.08 against a 3.03 box diagonal, normals agreeing with their own triangles), and
// sampling Buildings.webp at its actual UVs gives tan walls over a green pasture, with less
// black than the cow shed already has. What was really wrong was the icon camera; see modelIcon.
// Whether it stands up as a full-size PROP in the village is a separate question — nobody has
// looked at it at that size — but as a 256px button it is fine.
import sheepHomeSrc from 'assets/models/SheepHome.glb';
import truckSrc from 'assets/models/Truck.glb';
import truckElectricSrc from 'assets/models/Truck_Electric.glb';
import coopSrc from 'assets/models/B_Chicken_Coop.glb';
// The town's street and the rest of its buildings, all from the farm's own set, so
// flipY FALSE for every one of them. The road is the only thing in the scene that
// reads off the roads atlas.
import roadSrc from 'assets/models/Road.glb';
import roadTextureSrc from 'assets/images/RoadsRocks.webp';
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
import pointerSrc from 'assets/images/PointerHand.webp';
import hammerSrc from 'assets/images/props/Hammer.webp';
import axeSrc from 'assets/images/props/Axe.webp';
import broomSrc from 'assets/images/props/broom.webp';
import woodSrc from 'assets/images/Wood.webp';
import logoSrc from 'assets/images/Logo.webp';
import fontSrc from 'assets/fonts/MasalaPro-Bold.otf';

/**
 * Every GLB above is quantized and entropy-coded with EXT_meshopt_compression, which
 * the spec marks REQUIRED — a loader without the decoder rejects the file outright
 * rather than degrading. Subclassing rather than calling setMeshoptDecoder at each of
 * the fourteen `new GLTFLoader()` sites means a fifteenth cannot forget it.
 */
class GLTFLoader extends GLTFLoaderBase {
  constructor(manager?: THREE.LoadingManager) {
    super(manager);
    this.setMeshoptDecoder(MeshoptDecoder);
  }
}

// Grass land width/depth. Big enough from the start to hold the whole playable: the beats
// run down the western half and the village sits in the east. It used to be 25 and was
// rebuilt bigger when the expansion beat opened, which meant the slabs, the beach and the
// sea all had to be thrown away and remade mid-playable to keep the foam ringing the right
// shoreline. One size, built once, is less code and nothing to get wrong.
const ISLAND_SIZE = 64;
const ISLAND_HEIGHT = 2;
const ISLAND_HALF = ISLAND_SIZE / 2;
// World half-width kept in frame at the opening. What sets it is the BOAT, the widest thing
// in the shot: measured off its geometry with the bob at full swing, its screen-left edge
// reaches 2.209 units from PAN, and portrait's half-width is ALWAYS this number (`h` never
// binds at any portrait aspect). At 2.3 that left 0.091 — under 4% of the half-width — and
// the hull read as shaved by the edge. 2.45 leaves 0.241.
const FIT_RADIUS = 2.45;

// How much a shot has to hold UP AND DOWN against how much it holds ACROSS.
//
// On a portrait phone the frame is far taller than it is wide, so the width is almost
// always what binds and the height comes free — 0.62 is what the old fixed-width framing
// worked out to on a 9:16 screen, which keeps every beat looking as it did while making the
// zoom answer to the content. On a landscape screen the height becomes the binding one,
// which is exactly what used to be cropped.
const FRAME_HEIGHT_RATIO = 0.62;

/**
 * How far UP the screen every content-measured shot sits, so the characters are not dead centre.
 *
 * In world units along the ground direction that projects to screen-DOWN, which at this camera's
 * elevation is 0.47 of a unit up the screen for every unit of it — so 0.3 here lifts the picture
 * about 0.14 world units. On a typical beat that is roughly 3% of the frame's height: a nudge,
 * which is what "slightly" asks for.
 *
 * It is NOT free. The zoom is solved with the subjects centred, so this spends margin: whatever
 * it lifts by comes off the air at the TOP of the frame and is added to the bottom. At 0.3 a
 * beat with a 0.5 margin still has about 0.19 left over the tallest thing in it once the
 * portrait tightening has taken its share too, so there is room, but not a lot of it. Raise this
 * much past 0.4 and the tall subjects — the trees, the barn's cupola — start touching the edge.
 *
 * This moves the beats that are framed on their own subjects, which is all of them except the
 * expansion's wide shot: that one is aimed at a hand-picked point, EXPANSION.centre.
 */
const FRAME_LIFT = 0.3;

// The tightest a shot may ever get, in half-width. It is the floor that stops a
// content-measured frame from closing in on the pair while the camera is merely following.
// Left where it was when they stood 1.5 apart rather than pulled in with them (they are now
// 0.75): it is a floor, and a shot that never reaches it costs nothing.
const FRAME_MIN_WIDTH = 2.1;

// How long the shot takes to tighten onto them once they set off — see travelFrame.
const TRAVEL_EASE = 0.9;

/**
 * The shot to hold while they are simply WALKING from one beat to the next — in PORTRAIT. The
 * caller hands landscape the frame it already had, so nothing about that orientation changes;
 * see walkToFarm for why it is done as a pair rather than as a branch.
 *
 * The camera follows the pair on every leg (followRunners), but the follow only moves what the
 * camera is POINTED AT — the zoom is left wherever the last beat set it. That is fine when a
 * beat was framed close, and it is not fine after the cow: her pen has to be held whole, and it
 * sits three and a half units from where they stand, so that shot is the widest in the ad. It
 * used to be carried all the way to the farmland, which is a two-and-a-half second walk spent
 * looking at the pair from the far side of a field.
 *
 * So a leg gets its own frame, and it is measured off the thing that is actually in it: the two
 * of them, and the cow trailing behind. She is the binding one — she keeps COW.joinGap off their
 * middle, plus the slack she is allowed before she bothers to close it, plus half her own length
 * to get her tail in, and the follow's own lag (roughly speed * ease) puts the pair a little
 * ahead of centre, which pushes her that much further back again.
 *
 * A function rather than a constant for the usual reason here: COW and CHARACTERS are both
 * declared further down the file and would still be in their dead zone at this point.
 */
function travelFrame(): { w: number; h: number } {
  const speed = Math.min(...CHARACTERS.map((character) => character.runSpeed));
  const behind =
    COW.joinGap + COW.settle + COW.length / 2 + speed * CAMERA_FOLLOW.ease;
  // ...and never tighter than the floor every other shot is held to.
  const w = Math.max(FRAME_MIN_WIDTH, behind + 0.35);
  return { w, h: w * FRAME_HEIGHT_RATIO };
}

/**
 * Motion blur on the EXPANSION PULL-BACK, and on nothing else.
 *
 * It is switched on by expansionMoment for that one move (see there) rather than applied to
 * every camera move: all of them travel far enough to blur, and blurring all of them made the
 * ad go soft every time the shot changed. The pull-back is the only one where the speed is the
 * point — the barn out to the whole island in 0.8s — instead of a way of getting to the next
 * beat. IslandScene.blurWithMotion measures how hard.
 *
 * A CSS filter on the canvas, not a render pass. That buys it for about twenty lines and no
 * bundle at all, where a real one wants a render target, a fullscreen shader, a colour-space
 * conversion done by hand and the UI sprites split onto their own layer so the speech does not
 * smear with the world. The catch is that CSS blurs evenly in every direction: this is a
 * defocus that ramps with speed, not a smear along the direction of travel.
 *
 * `scale` is blur pixels per pixel of picture travelled in a frame, and it is NOT the physical
 * figure. A real shutter smears by the whole distance travelled, which here would be 0.5 and
 * peaks this move at 20px — that is not a fast camera, it is a broken one. At 0.12 the pull-back
 * peaks at 4.8px about a third of the way in, then falls away as the shot eases to a stop,
 * which it does on its own because the strength is read from the camera rather than scheduled.
 */
const MOTION_BLUR = {
  enabled: true,
  scale: 0.12,
  max: 5, // pixels. Past this it stops reading as speed and starts reading as a fault
  // Below this the filter comes off rather than sitting at a fraction of a pixel. It is what
  // keeps the very start and the very end of the move — where the easing has the camera barely
  // crawling — from being softened for no visible gain.
  min: 0.5
};

// Portrait-only zoom knob, applied to EVERY beat's frustum (see updateCamera) rather than to
// one shot's numbers. 1 = hold exactly what the beat asked for; below 1 pulls in, above 1 backs
// off. Landscape is left alone — it is the orientation that already crops.
// Go much below ~0.85 and the margins the content-measured beats add start getting eaten.
const PORTRAIT_ZOOM = 0.92;

/**
 * The OPENING shot: the rubble beat, the run and the rocks breaking all sit on this one frame,
 * because nothing reframes until they pull up at the bridge.
 *
 * Per orientation, in the same terms every other shot here uses — `w` is how far the beat must
 * hold ACROSS the screen, `h` how far UP it, both world units, and updateCamera grows the
 * frustum until it holds both. Bigger numbers pull back.
 *
 * Portrait is FIT_RADIUS by FRAME_HEIGHT_RATIO: what the opening has always been.
 *
 * Landscape gets its own pair, and its HEIGHT is the number that matters. A wide frame shows
 * far less ground up-screen for the same zoom — portrait holds 4.1 units of height at this
 * width, landscape only 1.6 — so asking for a small `h` there does not tighten the shot, it
 * crops the rubble arc off the bottom of it. 2.6 is what holds the whole arc and the pair;
 * the frame comes out 4.6 across, which is wider than portrait's and shows more shore.
 *
 * What this will NOT stretch to is the boat: its masthead used to sit 2.93 units up-screen,
 * past this 2.6, and raising `h` to clear it pulled the whole landscape shot back about an
 * eighth. The boat was moved down-screen instead (see BOAT.x/z) — it is scenery, and moving
 * the subject is cheaper than zooming out for it.
 *
 * Neither `w` should go below about 0.9: the two of them stand 0.75 apart and one would start to
 * clip. (FRAME_MIN_WIDTH is the floor for content-measured shots, not for this one.)
 */
const OPENING_FRAME = {
  portrait: { w: FIT_RADIUS, h: FIT_RADIUS * FRAME_HEIGHT_RATIO },
  landscape: { w: 2.8, h: 2.78 }
};

// The push-in that rides the fog clearing. `from` widens OPENING_FRAME to start on, and the
// shot settles back onto it — so the zoom always lands on whatever the opening is set to
// rather than on a second copy of those numbers.
//
// `ease` is matched to the two things it runs against: camera_zoom_in is 0.9s long, and the
// fog is gone about 0.7s after this starts (OverlayScene fires it FOG.reveal into the clear).
// 1.2 lands the shot just after both, so the sound covers the move instead of finishing under
// a camera still travelling. The SOUND is what binds it now — the fog used to be the longer of
// the two and was cut to 750 (FOG.clear) — so shortening the fog again does not shorten this.
const INTRO_ZOOM = { from: 1.55, ease: 1.2 };

// Lighting, taken from the reference playable (its ThreeSceneManager.addLights).
const LIGHTS = {
  ambient: 1.2,
  sun: 2.7, // the one that casts
  fill: 1, // a second directional, straight down
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
  // Just past the sand, floating off the -X beach. x and z are moved TOGETHER because the
  // view is yawed 45: an equal step in both is straight down the screen and leaves the boat
  // exactly where it was left-to-right (see PAN's axis notes). It was (1.5, -3.5), which put
  // the masthead 2.93 units up-screen from PAN and cut its top off in landscape, where the
  // frame only holds 2.6; 0.65 down both axes brings the masthead to 2.50. That is 0.1 of
  // air, and the bob adds about 0.03 of it. The hull stops 0.24 short of the sand edge, so
  // there is no room to take another step this way — pull the frame instead.
  x: -(SAND_EDGE + 0.85),
  z: -2.85,
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
// yawDeg turns them on the spot, compass-style: heading h faces (sin h, cos h), the same
// convention the rubble arc and the run are laid out in. Both stand facing RUBBLE.arcCentreDeg
// (100) — the middle of the arc, where the rock they have to tap sits and where startRunning
// sends them — so they are already looking at the thing the player is asked to tap. It is
// hardcoded rather than read off RUBBLE, which is declared further down the file.
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
    x: -30.25,
    z: -1.62,
    yawDeg: 90, // RUBBLE.arcCentreDeg — they face the way they run, which is at the bridge
    height: 0.9
  },
  {
    key: 'hipster',
    model: hipsterSrc,
    texture: hipsterTextureSrc,
    idle: { startFrame: 0, endFrame: 298 },
    run: { startFrame: 299, endFrame: 315 },
    runSpeed: 1.23, // 0.694 units of foot slide over his 0.567s cycle
    x: -30.15,
    z: -0.92,
    yawDeg: 90, // ...and the same, so the pair face it together
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
  /**
   * ...and it is not only the ring's angle. It is the RUN's heading too — startRunning aims
   * them along it, RUN_STOP is measured along it, and RUBBLE_BREAK.index picks the rock sitting
   * on it, which is the one they smash and run through. Those three have to agree or they run
   * at an unbroken rock.
   *
   * 90 rather than 100, which is what puts the pair, the rock they break and the bridge on ONE
   * straight line. The stream runs down +X, so a heading of 90 is square to it: they stop with
   * the deck's centre line running exactly between them (0.000 off it, against 0.353 at 100),
   * looking straight down it, and the sideways shuffle onto the planks drops from about 0.35 to
   * 0.03. Squaring the run is the only way to get both — at any other heading the bridge can be
   * dead ahead of them or centred between them, but not both. See BRIDGE.z.
   *
   * Nothing in the OPENING moves for it: the pair, the boat and the camera are all where they
   * were, so that shot is untouched apart from the ring turning 10 degrees on its own centre and
   * the two of them facing 10 degrees further round (CHARACTERS.yawDeg, which follows this).
   */
  arcCentreDeg: 90,
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
  // the arc to about 3.2u of clear ground. The pair is only 0.75 wide now and would clear a
  // single rock's 1.1u gap, but the three-rock break is what the beat READS as — one rock
  // popping out of a seven-rock arc barely changes the picture.
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
  // Square, as a fraction of the frame's SHORTER side — the world "vmin", the same thing
  // the DOM parts of this ad size themselves in. It used to be a flat 0.95 world units,
  // which is a fixed size in the SCENE, not on the screen: landscape frames this ad twice
  // as wide as portrait, so the hand came out half the size the moment the phone turned.
  // 0.207 is what 0.95 worked out to on the portrait opening, so that view is unchanged.
  screenSize: 0.207,
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
  // ...and in LANDSCAPE, where 20vmin is a fifth of a short screen and the row landed on top
  // of the two characters. Smaller buttons and much less inset: the hand still needs about
  // 0.39 of a button beneath the row (it overlaps the button by handOverlay and hangs below by
  // the rest), which 9vmin covers.
  //
  // Applied as CSS custom properties with an orientation media query, not by measuring the
  // window in JS — the browser then re-lays the row out on a rotation with nothing to hook.
  landscape: { button: 'min(16vmin, 110px)', bottom: '9vmin', gap: '4vmin' },
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

/**
 * The brand mark, top right, up for the whole playable.
 *
 * Sized per orientation the way the tool row is — CSS variables behind an orientation media
 * query, so a rotation re-lays it out with nothing to hook. The widths come from the
 * reference's own brandLogo (350 design px portrait, 190 landscape, against its 1136x640
 * design), which work out to about 31% and 17% of the screen's width.
 */
/**
 * The ad's typeface, and what to fall back to for the frame or two before it arrives.
 *
 * Loaded through the FontFace API rather than an @font-face rule, because the speech bubbles
 * are drawn into a CANVAS: canvas text falls back silently if the face is not ready at the
 * moment it draws, with no way to tell after the fact. document.fonts.add() then makes it
 * available to CSS as well, so the DOM text uses the same one knob.
 */
const FONT = {
  family: 'MasalaPro',
  stack: '"MasalaPro", "Trebuchet MS", "Segoe UI", Arial, sans-serif',
  weight: '700'
};

const BRAND = {
  width: { portrait: '31vw', landscape: '17vw' },
  inset: { portrait: '2.5vmin', landscape: '2vmin' },
  fade: 0.4, // seconds, so it arrives with the world rather than being there before it
  // UNDER the Phaser overlay, which Game parks at z-index 10 — and that is what keeps the mark
  // off the intro video. The video is opaque and covers it; once it has played and the clouds
  // have receded, that same canvas is transparent and the logo shows through with the world. So
  // nothing has to tell it when to appear, and it cannot get stuck hidden if a transition hook
  // is missed. Above the 3D canvas (z auto), below the tool row (20), the dim (19) and the end
  // card (30) — the card carries its own logo, and this must never cover a button.
  zIndex: '9',
  // ...except under the expansion's CALL TO ACTION, where the dim goes over the whole screen
  // at 19 and took the mark down with it — the one moment in the ad where the brand should be
  // at its brightest is the one where it was greyed out. Lifted to the row's own level for
  // that beat only: they never overlap (mark top-right, buttons and title along the bottom),
  // and it goes back to 9 when the CTA does. It cannot be one static number, because 9 is what
  // keeps the mark off the opaque intro video on the Phaser layer at 10.
  ctaZIndex: '20'
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
  /**
   * How far short of the WATER'S EDGE they pull up — and what actually matters is how far short
   * of the PLANKS that leaves them, which is this minus the 0.45 of deck that sits on the bank
   * (BRIDGE.span 2.6 against a 1.7 channel, half the difference each side).
   *
   * 1.15 left a 0.70 gap, and 0.70 does not read as a gap at this camera. The view looks in at
   * 45 degrees, so standing BACK from the bridge along +X moves them up and to the LEFT on
   * screen rather than away from it — the pair came out floating off the bridge's shoulder
   * instead of squared up at its mouth, which is what "not standing at the centre of the
   * opening" was. They were already dead centre on the deck's axis; it was the distance that
   * read as an offset.
   *
   * 0.75 leaves 0.30 to the planks: close enough to be AT the bridge, far enough not to stand
   * on a wreck they are supposed to be stuck in front of.
   */
  bankMargin: 0.75,
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
  /**
   * On the pair's LINE OF SIGHT, so they pull up looking straight down the deck.
   *
   * It used to be RUN_STOP.z — "it meets them where they stop" — which put it level with them
   * but not in front of them. They run along RUBBLE.arcCentreDeg (100 degrees) while the stream
   * sits 2 units further along +X, so the bridge bore 90 degrees from where they stopped and
   * they finished the run facing 10 degrees off it.
   *
   * The channel fixes x, so the correction is all in z: step along the heading until x reaches
   * the stream, which is (STREAM.x - RUN_STOP.x) / tan(heading), or -0.35 here. Written as the
   * arithmetic rather than as -0.35 because all three of those move — retune the run's heading,
   * the bank margin or the stream's width and this stays on the sightline instead of quietly
   * going back to being 10 degrees out.
   *
   * It also straightens the crossing: the turn onto the deck was about 10 degrees each and is
   * now about 5.
   */
  z:
    RUN_STOP.z +
    (STREAM.x - RUN_STOP.x) / Math.tan(THREE.MathUtils.degToRad(RUBBLE.arcCentreDeg)) + 0.2,
  // Bank to bank, measured across the model's long axis. 2.6 puts the repaired
  // span's railings at 0.62x a character — chest height, where a railing belongs
  // — and leaves 0.45u of deck on each bank. The wreck reads taller than that
  // because of the broken post it throws up, which is the point of it.
  span: 2.6,
  /**
   * How far each model settles into the banks — and they need DIFFERENT numbers, which is why
   * this is two knobs and not one.
   *
   * The two meet the ground in completely different ways. The repaired span ramps down to it at
   * both ends (44 and 50 vertices on the grass), so a light bedding is all it wants: at 0.06 its
   * deck top lands at 0.096, which is what CROSSING.deckY's 0.08 was measured against — that is
   * the height the characters are lifted to as they walk on. Push it deeper and they walk on
   * air: at 0.26 the deck is at -0.104 and they cross 0.18 above the planks.
   *
   * The WRECK reaches the ground with one post and nothing else — every other piece of its
   * timber over the banks sits 0.21 to 0.32 up — so bedding it on that post hangs all of its
   * planks in mid-air, which is what "lifted off the ground" was. It wants 0.26, which puts that
   * timber down on the grass and buries the post, the right way round for a collapsed bridge.
   * The pieces reaching over the channel go to -0.26, still clear of the water at -0.4.
   *
   * (It was always like that. It only became visible when the pair pulled up 0.4 nearer — the
   * arrival shot is framed on the pair AND the bridge, so closing that gap zoomed the beat in.)
   */
  sink: 0.06,
  brokenSink: 0.26,
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
// stand. Verified against the arrival shot: each is at least 1.5u from a
// character and 1.6u from the next tree, and all three are in frame.
// (The note here used to claim 3.2u between trees. The three that shipped were 1.6 to 1.9
// apart, so that number was never true of them — worth knowing before it is used as a floor.)
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
  // Pulled in towards the bridge — 2.42, 3.69 and 3.81 from it, against 2.67, 4.11 and 4.09.
  //
  // Not much more is on offer, and the WATER is why: a tree may not stand past x +0.15 of
  // RUN_STOP or it is in the channel, and the bridge's middle is at +1.60. So no tree can ever
  // be nearer than about 1.45 in x, and the rest of the distance is whatever z it needs to keep
  // off the pair. Closing that last bit costs the clearance between a tree and a character,
  // which came down from 1.9 to 1.5 for this — still a comfortable body's width, and the rule
  // that actually protects the shot is the canopy one above, not this.
  offsets: [
    { x: 0.1, z: -1.9 },
    { x: -1.5, z: -2.0 },
    { x: 0.1, z: -3.5 }
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
  // How far onto the far bank they carry on. Nothing pulls up here — the forward leg is
  // CHAINED to this one — so this is simply the first part of the distance from the deck to
  // the cow, and it counts against the run exactly as FORWARD.distance does. 1.0 rather than
  // 1.3: it still puts them a clear stride past the planks (the deck's step-down blend is
  // CROSSING.edge, 0.35) and it is 0.3 of the 0.7 that came off the run.
  beyond: 1.0,
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
  // World units off the end of the bridge — and THE knob for how far the whole cow beat sits
  // from the crossing, since COW_STOP is measured from it and the cow, her trees and the shot
  // all hang off COW_STOP. Was 2, then 1.2; 0.8 pulls the beat in again so there is less run
  // between the crossing and the cow — with CROSSING.beyond down to 1.0 alongside it, they
  // cover 1.8 units past the deck rather than 2.5, about 0.6s less running at the slower of
  // the two characters' speeds (1.23 u/s).
  //
  // 1.8 is the FLOOR, and the thing that sets it is not this bank at all — it is the STREAM,
  // via the barn. The barn sits back TOWARDS the bridge from the farmland (BARN.down/right are
  // both negative), so pulling the cow beat in pushes the barn AT the water, and it has only
  // 0.28 of clearance to give. Below 1.8 the farmland has to move out to hold the barn off the
  // channel, and the walk it costs is more than the run it saves — 4.61 units of walking
  // against today's 3.97. See scratchpad/tighten.mjs, which solves the field and the barn
  // together against the water; FARM.down/right and BARN.right below are its answer for this
  // number, so the three move as a set.
  distance: 0.8,
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
  // From COW_STOP. Left at 3.5: bringing the pen in looks like the obvious way to tighten the
  // cow beat's shot, and it is not — at 2.6 the ring reaches into the lane they walk down to
  // the farmland, and a character passes through a rock. The framing is fixed in COW_SHOT
  // instead, which costs nothing on the ground.
  offset: { x: 3.5, z: -0.5 },
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
  // How close she comes before settling — measured straight to the pair's middle, so it IS the
  // distance she stands at, on whichever side she happened to walk in from. It used to be a gap
  // to an offset spot instead, and every offset compounds: one on her own side adds to the
  // distance, one on their far side has her cross between them, which is the "she walks past
  // them" this was. Under about 0.9 her head is inside the woman; much over 1.6 and the tighter
  // farm frame starts cutting her off at the edge.
  joinGap: 1.15,
  settle: 0.15, // ...and how much slack in that before she bothers to move again
  chase: 2.2, // how far behind she has to fall before breaking into the run
  cheer: 1.1, // seconds of celebrating before she comes over
  blend: 0.25 // crossfade between her gaits
};

/**
 * What pens the cow in: a ring of rubble around her, left OPEN on the side the pair arrives
 * from, with one fallen trunk lying across that opening. Chop the trunk and the way out is
 * clear — the rocks never move.
 *
 * This replaced a straight LINE of four trees she stood behind. The line read as trees she
 * happened to be behind rather than as a pen, and freeing her was four taps at one prop.
 * A ring says trapped on sight, and it says it in the scene's own vocabulary: the opening
 * beat is a semi-circle of the same rubble around the pair, broken open the same way.
 *
 * The gap is not a number here — it is worked out from where the pair actually stands (see
 * cowPen), so moving COW.offset or the crossing swings the opening round to face them instead
 * of leaving them looking at the closed back of it.
 */
const COW_PEN = {
  // Round the closed part of the ring — 11 across 285deg, a rock about every 28. Set by the
  // HOLES between them, not by how it looks from any one angle: at 9 the widest gap came out
  // at 0.53 world units, and a cow is about 0.6 across, so the pen had a place she read as
  // able to step through. At 11 nothing exceeds 0.25 and the stones overlap enough to read as
  // piled rather than placed.
  rocks: 11,
  radius: 1.75, // from the cow. She is COW.length (1.35) nose to tail, so this is not tight
  // How wide the way out is, in degrees of the ring — and it is set by the LOG, not by the cow.
  // She only needs about 0.6 of clearance, so almost any gap lets her out; what the gap cannot
  // be is wider than the trunk lying across it, or there is a hole at each end and the pen
  // reads as open. At radius 1.75 this is a 2.13-unit chord against the trunk's 2.47 (see
  // `log`), which is what lets both ends of it TUCK BEHIND the rocks at the lips rather than
  // stopping short in mid-air.
  // 110 was the first try: 3.11 of chord against 1.50 of trunk, blocking less than half of it.
  gapDeg: 75,
  size: 0.95, // a rock, before jitter. A shade under the opening arc's, so hers read as smaller
  // A ring of one rock repeated at one size on one radius reads as beads threaded on a drawn
  // circle — the opening arc carries a note about exactly this. Three things break it up, and
  // they are all deliberately small: at these values the ring is still plainly a ring.
  sizeJitter: 0.22, // ± this fraction of `size`, so no two are the same stone
  radiusJitter: 0.18, // ± world units in and out
  // ± this fraction of the angular step, so they are not evenly spaced either. The two rocks at
  // the LIPS of the gap are exempt and stay exactly on their angles: they frame the way out and
  // the trunk rests on them, so those two are the ones that have to be placed, not scattered.
  angleJitter: 0.25,
  // ± degrees of pitch and roll. Rocks sat perfectly flat on the grass look set down rather
  // than fallen; a few degrees each way is enough to lose that, and `sink` covers the edge it
  // lifts (a 0.95 rock tilted 5deg lifts about 0.04, which is under the 0.08 buried).
  tumbleDeg: 5,
  sink: 0.08, // fraction of its height buried — deeper than the opening arc's, to cover the tilt
  /**
   * The trunk across the opening. It is the ONE thing in the pen that can be chopped, so it is
   * the whole beat: one tool choice, one tree, the cow walks out.
   *
   * It starts part-way over rather than flat. Flat, there is nothing left for the chop to do
   * and the log simply vanishes when tapped; at `leanDeg` it reads as fallen and propped on the
   * rocks, and the axe puts it the rest of the way down — chopTree has always taken a tree that
   * is already part-way over (its `tilt`), it just never had one until now.
   */
  log: {
    // Its own length, not how tall it stands — it is never upright. A leaning trunk covers
    // height * sin(lean) of GROUND, which is the number that has to match the gap: 2.6 at 72
    // degrees is 2.47 across, against a 2.13 chord. Longer than anything else on the island
    // (the wood grove is 1.8) because it is the one tree here whose job is its length.
    height: 2.6,
    // How far over it already lies. Not flat: at 90 there is nothing left for the axe to do
    // and the trunk just vanishes on the tap. At 72 it is plainly down, its raised end at 0.80
    // — resting on the rock at the far lip rather than hanging over it — and the chop still
    // has 18 degrees to drop it through, which is what sells the log being cleared rather than
    // deleted.
    leanDeg: 72,
    // Where along the mouth of the gap its BASE sits, as a fraction from one lip to the other,
    // and it is NEGATIVE: the trunk is longer than the gap is wide, so it starts a little
    // BEHIND the first rock and finishes a little behind the far one. That overhang is the
    // whole point — 0.17 tucked under a rock at each end, so the log reads as having come to
    // rest ON the pen. At 0.03 its base sat inside the first rock and its far end stopped in
    // mid-air short of the second, which is the arrangement that looked unfinished.
    from: -0.08
  }
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

/**
 * The pen, solved rather than written down: the ring of rocks, the two edges of the way out,
 * and where the trunk lies across it. Everything comes back as offsets from COW_STOP, like
 * every other placement on this bank.
 *
 * The opening faces the PAIR. Their heading in is COW_STOP -> the cow, so the bearing back
 * from her to them is where the gap has to be, and the rocks take the rest of the ring. Worked
 * out from those two positions on purpose: the cow has been moved twice already (COW.offset)
 * and the crossing once, and a hand-written angle would have been left facing whichever way it
 * was when it was written — with the pair reaching her through solid rock.
 */
function cowPen(): {
  rocks: Array<{ x: number; z: number }>;
  log: { base: { x: number; z: number }; towards: { x: number; z: number } };
} {
  const { radius, rocks: count, gapDeg } = COW_PEN;
  // Compass bearing (0 = +Z, 90 = +X, clockwise from above) from the cow back to where the pair
  // pulls up. COW.offset IS the cow's position relative to COW_STOP, so the vector back to them
  // is just its negation.
  const toPair = Math.atan2(-COW.offset.x, -COW.offset.z);
  const gap = THREE.MathUtils.degToRad(gapDeg);
  const at = (angle: number) => ({
    x: COW.offset.x + Math.sin(angle) * radius,
    z: COW.offset.z + Math.cos(angle) * radius
  });

  // Round the closed part, from one lip of the gap to the other the long way about.
  const closed = Math.PI * 2 - gap;
  const rocks = Array.from({ length: count }, (_, i) => {
    const step = count === 1 ? 0.5 : i / (count - 1);
    const wobble = (jitter(i, 41) - 0.5) * 2 * COW_PEN.radiusJitter;
    // The first and last rock ARE the lips of the gap. They stay on their exact angles — the
    // trunk comes to rest on them and the way out is framed by them — and only the ones
    // between get shuffled round a little.
    const lip = i === 0 || i === count - 1;
    const swing = lip ? 0 : (jitter(i, 43) - 0.5) * 2 * COW_PEN.angleJitter * (closed / (count - 1));
    const angle = toPair + gap / 2 + closed * step + swing;
    return {
      x: COW.offset.x + Math.sin(angle) * (radius + wobble),
      z: COW.offset.z + Math.cos(angle) * (radius + wobble)
    };
  });

  // The trunk lies from one lip of the gap towards the other, so it is ACROSS the way out
  // rather than pointing along it. `towards` is what the planting turns it by — see addTrees,
  // where a tree is laid down along the bearing away from whatever it stands around.
  const lips = [toPair + gap / 2, toPair - gap / 2].map(at);
  const from = COW_PEN.log.from;
  const base = {
    x: lips[0].x + (lips[1].x - lips[0].x) * from,
    z: lips[0].z + (lips[1].z - lips[0].z) * from
  };
  return { rocks, log: { base, towards: lips[1] } };
}

// The shot for that beat, solved from the screen bounds of the pair, the trees
// and the cow — same method as ARRIVAL.
const COW_SHOT = {
  /**
   * Air around everything the beat frames — and on this beat it is what keeps the PAIR off
   * the edge of the screen, which is not something 0.5 was ever going to manage.
   *
   * The shot is centred on the middle of what it holds, so with the pen off to one side the
   * two characters sit at the far edge of the group and the frame is cut to them exactly. What
   * is left beside them then works out as
   *
   *     PORTRAIT_ZOOM * margin  -  (1 - PORTRAIT_ZOOM) * extent  -  half a character
   *
   * — the portrait tightening takes its 8% off the WHOLE frustum, margin included, and a
   * character is framed as a point with about 0.18 of body either side of it. At margin 0.5
   * that came to 0.08 world units of air: they were touching the left edge, which is exactly
   * how it looked. No amount of moving the pen fixes it either, because both terms shrink
   * together — the ceiling on air with a 0.5 margin is 0.28 however tight the group gets.
   *
   * 0.8 puts it at 0.39, and `framedRocks` is what pays for it.
   */
  margin: 0.8,
  /**
   * How many of the pen's rocks the shot is fitted to, nearest the pair first — NOT all of
   * them, which is what it used to be.
   *
   * The three of them are in direct tension and it is worth writing down: the pen stands 3.5
   * units from where they pull up, so a frame fitted to the whole ring is fitted to a group
   * five units wide, and the pair is at one end of it. Holding all 11 rocks AND giving the
   * pair its air comes out at 2.99 of half-width — noticeably further back than the 2.71 it
   * was. The 2.71 bought its tightness by cutting the characters off instead.
   *
   * Fitting to the near part of the ring breaks the tie. At 8 the frame is 2.70 — the same
   * zoom as before — with the pair 0.39 clear of the edge instead of 0.08. The three furthest
   * rocks then overhang by about half a rock, so the back of the pen runs off the side of the
   * frame, which is what a ring seen from outside does anyway. The cow, the trunk across the
   * gap and both rocks framing it are always in: they are the beat.
   *
   * Lower this for a tighter shot and more of the ring off-screen — 7 gives 2.63, 6 gives 2.48
   * and takes four rocks fully out of frame, which is where it starts to stop reading as a pen.
   */
  framedRocks: 8,
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
  // Both numbers are large because the field has to clear the cow's PEN (see COW_PEN), and a
  // ring is a bigger thing to step around than the line of trees that used to be there. The
  // trunk across its mouth is chopped and gone by the time this beat starts, but the rocks are
  // scenery and stay, so the whole ring is what the placement is solved against.
  // Solved to keep the WALK short. This used to be 6.8 / 4.5, which put the field 8.2 units
  // from where the cow was freed and left them running for four and a half seconds between
  // two beats; at 4.25 / -2 it is a 2.2-unit stroll and everything after the bridge sits
  // close together. Every constraint is still met — nobody stands in the soil, neither lane
  // crosses it on the way, and the walk misses the cow at her station — see
  // scratchpad/tighten.mjs, which solves this and the barn's offsets together.
  // Moved out from 4.25 / -2 to clear the STREAM. The barn hangs off this field (BARN.down
  // and .right are measured from it), the field hangs off COW_STOP, and COW_STOP came 0.8
  // closer to the water when FORWARD.distance was cut — which walked the barn's screen-left
  // corner into the channel. Raising both numbers TOGETHER is what answers that: down and
  // right are 45 apart, so an equal step along each is pure +X, straight away from the water,
  // with no sideways drift. Everything the barn was solved against is measured from the FIELD,
  // so moving them together leaves all of it intact.
  //
  // 5.25 / -1.0 is that same correction applied again, for FORWARD.distance 0.8 and
  // CROSSING.beyond 1.0 — the cow beat came another 0.7 closer to the bridge, so the field
  // comes 0.7 further out from it and the barn ends up where it already was, 0.31 off the
  // channel against the 0.28 it had. The walk from the cow grows 0.15 for it (2.84 against
  // 2.65) and the one to the barn falls to 0.73, so there is LESS walking after the bridge
  // than before, not more: 3.57 units against 3.97.
  down: 5.25,
  right: -1.0,
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
  // Solved with the farmland (scratchpad/tighten.mjs) for a short walk from the crop to the
  // barn — a couple of strides rather than the 4.2 it was. Negative `down` means it sits
  // UP-screen of the field, which is what keeps the walk off the beds they just planted.
  //
  // -2.7 / -3.05 is the re-solve for the tightened crossing (FORWARD.distance 0.8): the field
  // moved 0.7 further from the cow, and the barn has to come back the same amount towards it
  // or it ends up in the channel, which is the one thing on this bank there is no room for.
  // The walk to it is 0.73 units rather than 1.32 as a result — the shortest of the three
  // legs, and the one worth spending, because it is the only one where the beat has already
  // been set up by the beat before it.
  down: -2.7,
  right: -3.05,
  /**
   * How far short of the barn they pull up — and, since the walk to it is whatever is LEFT
   * after this is taken off, the thing that decides both where they end up standing and how
   * far they travel to get there. It is the only knob for either: the barn's own position is
   * pinned by the stream (see `down`/`right`).
   *
   * 2.0 rather than 2.8. At 2.8 they stopped 1.19 clear of the barn's footprint, which put
   * the last beat's characters a barn's width away from the barn, and left only 0.73 units of
   * walk to get there — half a second, barely a move. 2.0 stands them 0.39 off it, a fifth of
   * a unit once their own width is taken off, and doubles the walk to 1.53.
   *
   * The floor is 1.6, where the nearer character's centre crosses INTO the footprint. Below
   * about 1.8 they are touching the wall, so 2.0 is one notch off the wall rather than the
   * last value that technically fits. Both of them stay down-screen of the barn at this
   * distance, which is what keeps them in front of it rather than hidden behind it.
   */
  ahead: 2.0,
  // Height in world units — but it is the BOUNDING BOX that gets scaled to it, not the
  // building, and for this model those are very different things. Barn.glb carries a
  // weathervane needle 0.007 across that runs from 80.5% of its box to the very top, and
  // its roof ridge sits at only 65.0%; the wreck's box is solid to 100% of its own. So at
  // 2.1 the repaired barn's ridge landed at 1.37 against the wreck's 1.60 and its footprint
  // at 1.82 x 1.32 against 1.86 x 1.76 — the repair handed back something SHORTER and 27%
  // smaller than the thing it replaced, which is the beat backwards.
  // 2.8 of box puts the ridge at 1.82, the cupola at 2.25 and 1.76 x 2.42 on the ground:
  // 30% more footprint than the wreck and a silhouette that tops it by 0.65.
  // The ceiling is the STREAM, not the frame — at 2.8 the barn's screen-left corner stands
  // 0.31 off the channel's far edge (x -23.41), about the standoff the wreck has been sitting
  // at all along, so nothing comes nearer the water than what is already there. That 0.31 is
  // also what stops the cow beat being pulled any closer to the bridge than it now is: see
  // FORWARD.distance.
  height: 2.8,
  // ...and the wreck it replaces, kept LOWER on purpose. Half of it is down, so
  // it should not stand as tall as the barn it becomes — and the difference is
  // what makes the repair read as the building coming back up rather than as one
  // prop blinking into another. 1.6 rather than 1.8 because righting it (below) spreads it
  // to 1.86 x 1.76 on the ground, and at 1.8 the beat no longer fits the frame. Unlike the
  // barn's, this box is solid to the top: 1.6 here is 1.6 of actual wreck.
  brokenHeight: 1.6,
  // B_Barn_Abandoned is authored Z-UP inside a Y-up file, so it arrives lying on
  // its back — the same mistake the wheat and the cow's walk carry. Verified off
  // the geometry rather than guessed: 17% of its vertices sit on the LOW face of
  // its own z (a building's flat base), and its footprint narrows towards high z
  // (a roof), while its y widens. -90 about x turns that +Z into world up. Set it
  // to 0 if the FBX is ever re-exported the right way up; the barn it becomes is
  // already Y-up and takes 0.
  brokenUprightDeg: -90,
  // Widest horizontal against height, of the WIDER of the two, read against BARN.height.
  // That used to be the righted wreck (6.3 across on 5.4 of height, 1.86 at brokenHeight);
  // now that the barn stands at 2.8 it is the BARN, 17.6 across on 20.4 of box, which is
  // 2.42. Holding the wreck's ratio here would have reserved 2.43 of ground where 2.01 is
  // wanted and shoved the scatter off the barn's setting. The scenery scatter needs this
  // BEFORE either model has loaded — it settles every position up front — so it cannot be
  // measured at load time the way scale is.
  spread: 17.64 / 20.39,
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
/**
 * One prop in the village. `yawDeg` is a fixed facing, as the reference's own entries give it;
 * `align` instead points the model's LONGEST side along a heading and works out the yaw from
 * the geometry (see place), which is what the generated lots use.
 */
type VillageProp = {
  key: string;
  src: string;
  at: { x: number; z: number };
  size: number;
  yawDeg: number;
  align?: number;
};

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
  centre: { x: 1.34, z: -1.34 },
  // How far the reveal pulls back, PER ORIENTATION — a phone held the two ways wants
  // different things from this shot.
  //
  // Both are content boxes rather than zoom factors: `w` is how far the town reaches across
  // the screen and `h` how far up it, in world units, and updateCamera grows the frustum until
  // it holds BOTH. So whichever the screen makes binding decides the zoom, and nothing the
  // shot asked for can be cropped either way. Bigger numbers = further back.
  //
  // Portrait is the measured fit: 8.12 x 14.44 holds the whole village with the frame's
  // corners 28.9 units out, against the 32 where the grass ends. Landscape needs the same
  // width but nothing like the height, so its `h` is cut to what the town actually occupies
  // up-screen — leave it high and the shot pulls back for empty sky.
  //
  // Watch the corners when raising either: their reach is about 3.5x the half-width, and past
  // 31 the ocean comes into frame. scratchpad/village-extend.mjs re-measures and prints both
  // numbers after props move.
  frame: {
    portrait: { w: 6.12, h: 12.44 },
    landscape: { w: 8.12, h: 6.6 }
  },
  /**
   * How long the pull-back takes, in seconds — and it is set by the SOUND.
   *
   * camera_zoom_out.mp3 is 0.83s long and starts with the move (see expansionMoment), so 0.8
   * lands the shot just inside it: the whoosh covers the whole travel and finishes on the wide
   * frame rather than trailing off over a camera that stopped a second and a half ago.
   *
   * It was 2.4 — "slow: this is the reveal, not a cut" — and slow it was, three times the
   * length of the sound meant to be carrying it. Everything after this hangs off the move
   * COMPLETING (the line, then EXPANSION.cta.delay, then the buttons), so this takes 1.6s out
   * of the ending without changing the rhythm of anything that follows it.
   */
  ease: 0.8,
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
    // --- the extension's streets ---
    // Along the world axes, exactly as the four above are — which at yaw 45 is what reads
    // as a diagonal on screen. Each one is a grid line clipped to the band the frame can
    // hold, so a road that would run out of shot simply stops. See the buildings list.
    // These four were each a grid line clipped to the frame, and clipped INDEPENDENTLY — so
    // several of them stopped short of the street they were meant to meet and the town came out
    // in six disconnected pieces. Run out to their junctions by scratchpad/roads-connect.mjs,
    // which walks the network and stretches whatever falls short: #4 to reach #9, #5 to reach
    // #9, #9 down to #4, #10 up to #0. Nothing else moved.
    { src: roadSrc, at: { x: -14.63, z: -59.98 }, yawDeg: 90, length: 12.13, width: 1.15 },
    { src: roadSrc, at: { x: -14.04, z: -50.6 }, yawDeg: 90, length: 32.31, width: 1.15 },
    { src: roadSrc, at: { x: 29.3, z: -4.89 }, yawDeg: 90, length: 28, width: 1.15 },
    { src: roadSrc, at: { x: 41.05, z: 7.62 }, yawDeg: 90, length: 29.5, width: 1.15 },
    { src: roadSrc, at: { x: 46.55, z: 16.04 }, yawDeg: 90, length: 23.5, width: 1.15 },
    { src: roadSrc, at: { x: -9.14, z: -44.28 }, yawDeg: 180, length: 32.55, width: 1.15 },
    { src: roadSrc, at: { x: 1.54, z: -36.05 }, yawDeg: 180, length: 30.25, width: 1.15 },
    { src: roadSrc, at: { x: 25.21, z: -4.25 }, yawDeg: 180, length: 21.5, width: 1.15 },
    { src: roadSrc, at: { x: 33.45, z: 0 }, yawDeg: 180, length: 30, width: 1.15 },
    { src: roadSrc, at: { x: 55.62, z: 13 }, yawDeg: 180, length: 11, width: 1.15 },
    // The two spurs that put the ring roads on the network. A ring is a closed loop, so unless
    // a street actually runs into one it is a circle of road drawn in a field with no way onto
    // it — which is what both of these were. Each is the shortest line from the ring's edge to
    // the nearest street, squared off to the axis every other street here runs along.
    { src: roadSrc, at: { x: -15.38, z: -49.26 }, yawDeg: 180, length: 4.23, width: 1.15 },
    { src: roadSrc, at: { x: 3.11, z: -33.61 }, yawDeg: 270, length: 4.68, width: 1.15 },
    // Two ring roads. Every other street out here runs along world x or z, which is what
    // makes a grid read as systematic however its spacing is jittered; a curve carries every
    // heading at once. The road model is a straight strip, so a circle is a polygon of short
    // tangential segments overlapped 12% at the joins — and they are SHORT, which is how
    // scratchpad/village-fill.mjs tells its own segments from a street when it re-solves.
    { src: roadSrc, at: { x: -15.98, z: -40.69 }, yawDeg: 90, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -14.75, z: -40.91 }, yawDeg: 110, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -13.67, z: -41.54 }, yawDeg: 130, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -12.86, z: -42.5 }, yawDeg: 150, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -12.44, z: -43.67 }, yawDeg: 170, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -12.44, z: -44.92 }, yawDeg: 190, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -12.86, z: -46.1 }, yawDeg: 210, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -13.67, z: -47.06 }, yawDeg: 230, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -14.75, z: -47.68 }, yawDeg: 250, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -15.98, z: -47.9 }, yawDeg: 270, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -17.22, z: -47.68 }, yawDeg: 290, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -18.3, z: -47.06 }, yawDeg: 310, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -19.1, z: -46.1 }, yawDeg: 330, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -19.53, z: -44.92 }, yawDeg: 350, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -19.53, z: -43.67 }, yawDeg: 370, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -19.1, z: -42.5 }, yawDeg: 390, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -18.3, z: -41.54 }, yawDeg: 410, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: -17.22, z: -40.91 }, yawDeg: 430, length: 1.41, width: 1.15 },
    { src: roadSrc, at: { x: 7.35, z: -31.06 }, yawDeg: 90, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 8.25, z: -31.22 }, yawDeg: 110, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 9.04, z: -31.67 }, yawDeg: 130, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 9.63, z: -32.37 }, yawDeg: 150, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 9.95, z: -33.23 }, yawDeg: 170, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 9.95, z: -34.15 }, yawDeg: 190, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 9.63, z: -35.01 }, yawDeg: 210, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 9.04, z: -35.71 }, yawDeg: 230, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 8.25, z: -36.17 }, yawDeg: 250, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 7.35, z: -36.33 }, yawDeg: 270, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 6.45, z: -36.17 }, yawDeg: 290, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 5.66, z: -35.71 }, yawDeg: 310, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 5.07, z: -35.01 }, yawDeg: 330, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 4.76, z: -34.15 }, yawDeg: 350, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 4.76, z: -33.23 }, yawDeg: 370, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 5.07, z: -32.37 }, yawDeg: 390, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 5.66, z: -31.67 }, yawDeg: 410, length: 1.03, width: 1.15 },
    { src: roadSrc, at: { x: 6.45, z: -31.22 }, yawDeg: 430, length: 1.03, width: 1.15 },
  ],
  roadWidth: 1.15,
  lift: 0.01, // the roads are decals on the grass and need the same hair of clearance
  // the farm's beds do, or they z-fight
  buildings: [
    { key: 'bakery', src: bakerySrc, at: { x: 19, z: -19.5 }, size: 2.2, yawDeg: 0 },
    { key: 'cowShed', src: cowShedSrc, at: { x: 14.5, z: -24 }, size: 3.5, yawDeg: 180 },
    { key: 'silo', src: siloSrc, at: { x: 9.7, z: -23.8 }, size: 2.3, yawDeg: 200 },
    { key: 'chickenCoop', src: coopSrc, at: { x: 11, z: -18.5 }, size: 3.4, yawDeg: 0 },
    // The livestock upgrade, standing on the map so the button has something to point AT —
    // see EXPANSION.cta.spotlight. Placed by scratchpad/place2.mjs, which searched the town for
    // a spot that clears every building, prop and road AND stays inside the wide shot in both
    // orientations: it sits 0.86 clear of the windmill, 3.08 off the nearest road centreline,
    // and 5.4 from the livestock corner, which is close enough to belong to it.
    // { key: 'sheepHome', src: sheepHomeSrc, at: { x: 2.5, z: -18 }, size: 4, yawDeg: 0 },
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
    { key: 'victorianBarnLvl3', src: sheepHomeSrc, at: { x: 13, z: -29 }, size: 4, yawDeg: 0 },
    { key: 'wellLv1', src: wellSrc, at: { x: 11, z: -14.5 }, size: 2.5, yawDeg: 180 },
    { key: 'windmill', src: windmillSrc, at: { x: 25, z: -19 }, size: 3.5, yawDeg: 90 },
    { key: 'windChime', src: windChimeSrc, at: { x: 5.5, z: -23.5 }, size: 2, yawDeg: 0 },
    { key: 'flowerKangaroo', src: kangarooSrc, at: { x: 9.4, z: -19.4 }, size: 1.7, yawDeg: -20 },
    { key: 'campTent', src: tentSrc, at: { x: 0.4, z: -23 }, size: 2.3, yawDeg: 180 },
    { key: 'campBonfire', src: bonfireSrc, at: { x: 0.4, z: -21.5 }, size: 1.1, yawDeg: 15 },
    { key: 'rocksByWell', src: rocksSrc, at: { x: 12.4, z: -13.9 }, size: 0.9, yawDeg: 55 },
    { key: 'rocksByWell2', src: rocksSrc, at: { x: 12.9, z: -14.6 }, size: 1.5, yawDeg: -30 },
    { key: 'rocksBySawmill', src: rocksSrc, at: { x: 25.2, z: -20.8 }, size: 3.5, yawDeg: 110 },
    // --- the extension ---
    //
    // The core above is the reference's farm, and it is a 1.75:1 LANDSCAPE cluster: in a
    // portrait frame wide enough to hold it, it filled 27% of the height and the rest of the
    // reveal was empty grass. So the village keeps growing past it — but laid out the way the
    // core is, on the WORLD axes, which at yaw 45 read as diagonals on screen. (A first pass
    // ran one street along world (1,1), the screen vertical: it filled the frame and looked
    // nothing like the town it grew out of.)
    //
    // What climbs the screen is the grid itself: blocks stepping along the world diagonal,
    // each bounded by an x-road and a z-road, generated wide and then CLIPPED to a band as
    // narrow as the core. The clip is what matters — the frame's width is set by the core, so
    // anything wider would force the shot open and put ocean in its corners.
    //
    // Laid out by scratchpad/village-extend.mjs (re-run it through apply-extension.py, which
    // strips the old one first — the generator reads this file to find where the core ends).
    // Positions are in this list's own config space: 0.55 world units each, scaled and moved
    // onto the island by villageAt. Every model is one the scene already imports, so these
    // props cost nothing in bundle.
    //
    // `size` is the measure the rest of this list uses — the model's largest dimension — and
    // these run smaller than the core's, because the core is a farmYARD where a 3.5 is a barn
    // standing alone, and a whole town at those sizes outweighed the farm it grows from.
    // Which model lands on which lot is picked by hash, never repeating the last two and
    // never past a cap: walking the list in order stamped the same run of models over and
    // over, which reads as a pattern rather than as a town.
    { key: 'street0', src: stationSrc, at: { x: -20.41, z: -56.25 }, size: 2.74, yawDeg: 0, align: 90 },
    { key: 'street1', src: feedMakerSrc, at: { x: -15.26, z: -56.37 }, size: 1.68, yawDeg: 0, align: 90 },
    { key: 'street2', src: bakerySrc, at: { x: -25.87, z: -54.21 }, size: 2.06, yawDeg: 0, align: 90 },
    { key: 'kerb0', src: lampSrc, at: { x: -24.08, z: -52.6 }, size: 4.4, yawDeg: 0, align: 90 },
    { key: 'street3', src: stationSrc, at: { x: -15, z: -53.8 }, size: 2.58, yawDeg: 0, align: 90 },
    { key: 'street4', src: homeSrc, at: { x: -12.21, z: -55.57 }, size: 2.56, yawDeg: 0, align: 0 },
    { key: 'kerb1', src: mailboxSrc, at: { x: -11.14, z: -53.54 }, size: 1, yawDeg: 0, align: 0 },
    { key: 'street5', src: bakerySrc, at: { x: -4.05, z: -47.4 }, size: 2.25, yawDeg: 0, align: 90 },
    { key: 'kerb2', src: crateSrc, at: { x: -2.05, z: -48.6 }, size: 1, yawDeg: 0, align: 90 },
    { key: 'street6', src: siloSrc, at: { x: -3.82, z: -30.3 }, size: 2.27, yawDeg: 0, align: 90 },
    { key: 'street7', src: tentSrc, at: { x: -11.18, z: -38.24 }, size: 2, yawDeg: 0, align: 180 },
    { key: 'street8', src: treeSrc, at: { x: -6.46, z: -38.84 }, size: 2.94, yawDeg: 0, align: 0 },
    { key: 'street9', src: jamStationSrc, at: { x: -6.11, z: -33.1 }, size: 1.63, yawDeg: 0, align: 0 },
    { key: 'street10', src: coopSrc, at: { x: -1.77, z: -44.03 }, size: 2.56, yawDeg: 0, align: 0 },
    { key: 'street11', src: townBarnSrc, at: { x: -1.12, z: -38.62 }, size: 3.36, yawDeg: 0, align: 180 },
    { key: 'street12', src: feedMakerSrc, at: { x: -1.52, z: -32.76 }, size: 2.06, yawDeg: 0, align: 0 },
    { key: 'street13', src: farmhouseSrc, at: { x: 29.58, z: -14.04 }, size: 2.46, yawDeg: 0, align: 90 },
    { key: 'street14', src: homeSrc, at: { x: 29.5, z: -7.81 }, size: 2.59, yawDeg: 0, align: 90 },
    { key: 'street15', src: windmillSrc, at: { x: 28.28, z: -10.88 }, size: 3.36, yawDeg: 0, align: 0 },
    { key: 'street16', src: feedMakerSrc, at: { x: 29.07, z: -1.98 }, size: 1.9, yawDeg: 0, align: 90 },
    { key: 'kerb3', src: windChimeSrc, at: { x: 31.08, z: -2.89 }, size: 2, yawDeg: 0, align: 90 },
    { key: 'street17', src: siloSrc, at: { x: 29.53, z: 4.89 }, size: 1.96, yawDeg: 0, align: 90 },
    { key: 'street18', src: windmillSrc, at: { x: 28.08, z: 1.86 }, size: 2.81, yawDeg: 0, align: 0 },
    { key: 'street19', src: jamStationSrc, at: { x: 30.51, z: 1.13 }, size: 1.71, yawDeg: 0, align: 0 },
    { key: 'kerb4', src: scarecrowSrc, at: { x: 31.45, z: 3.12 }, size: 1.4, yawDeg: 0, align: 0 },
    { key: 'street20', src: homeSrc, at: { x: 38.96, z: -1.48 }, size: 2.01, yawDeg: 0, align: 90 },
    { key: 'kerb5', src: lampSrc, at: { x: 41.03, z: -2.89 }, size: 1.4, yawDeg: 0, align: 90 },
    { key: 'street21', src: windmillSrc, at: { x: 44.62, z: -1.86 }, size: 2.93, yawDeg: 0, align: 90 },
    { key: 'street22', src: townBarnSrc, at: { x: 39.61, z: 4.2 }, size: 3.2, yawDeg: 0, align: 90 },
    { key: 'street23', src: homeSrc, at: { x: 44.15, z: 4.64 }, size: 2.25, yawDeg: 0, align: 90 },
    { key: 'street24', src: bakerySrc, at: { x: 49.78, z: 4.87 }, size: 1.86, yawDeg: 0, align: 90 },
    { key: 'street25', src: coopSrc, at: { x: 36.97, z: 1.65 }, size: 2.75, yawDeg: 0, align: 0 },
    { key: 'street26', src: homeSrc, at: { x: 39.24, z: 11.15 }, size: 2.39, yawDeg: 0, align: 90 },
    { key: 'kerb6', src: mailboxSrc, at: { x: 41.03, z: 9.62 }, size: 1, yawDeg: 0, align: 90 },
    { key: 'street27', src: siloSrc, at: { x: 44.91, z: 10.69 }, size: 2.16, yawDeg: 0, align: 90 },
    { key: 'street28', src: farmhouseSrc, at: { x: 49.81, z: 10.99 }, size: 2.5, yawDeg: 0, align: 90 },
    { key: 'street29', src: homeSrc, at: { x: 36.11, z: 11.64 }, size: 2.03, yawDeg: 0, align: 0 },
    { key: 'kerb7', src: crateSrc, at: { x: 35.45, z: 13.58 }, size: 1, yawDeg: 0, align: 0 },
    { key: 'street30', src: siloSrc, at: { x: 52.26, z: 12.11 }, size: 2.16, yawDeg: 0, align: 0 },
    { key: 'parked1', src: vanSrc, at: { x: -24.6, z: -49.22 }, size: 2, yawDeg: 0, align: 90 },
    // The ring frontages, each lot turned to the TANGENT so the row curves with the street,
    // and filler in the emptiest gaps at any angle at all — breaking the alignment is a filler
    // prop's whole job. homeSrc and farmhouseSrc are deliberately absent: the first renders as
    // a planter rather than a cottage, the second comes through the FBX conversion mangled.
    { key: 'ring0Well', src: wellSrc, at: { x: -15.98, z: -44.3 }, size: 2.5, yawDeg: 0, align: 0 },
    { key: 'ring0Lot0', src: mailboxSrc, at: { x: -15.18, z: -38.61 }, size: 1.02, yawDeg: 0, align: 98 },
    { key: 'ring0Lot4', src: milkJugSrc, at: { x: -12.15, z: -48.7 }, size: 0.65, yawDeg: 0, align: 228.9 },
    { key: 'ring0Lot7', src: mailboxSrc, at: { x: -20.96, z: -47.52 }, size: 0.97, yawDeg: 0, align: 327.1 },
    { key: 'ring0Lot8', src: sawmillSrc, at: { x: -21.9, z: -44.32 }, size: 1.93, yawDeg: 0, align: 359.8 },
    { key: 'ring0Lot9', src: bakerySrc, at: { x: -21.05, z: -41.07 }, size: 1.77, yawDeg: 0, align: 392.5 },
    { key: 'ring0Lot10', src: dairySrc, at: { x: -18.46, z: -38.92 }, size: 1.37, yawDeg: 0, align: 425.3 },
    { key: 'ring1Well', src: wellSrc, at: { x: 7.35, z: -33.69 }, size: 2.5, yawDeg: 0, align: 0 },
    { key: 'ring1Lot0', src: mailboxSrc, at: { x: 8.02, z: -28.96 }, size: 1.02, yawDeg: 0, align: 98 },
    { key: 'ring1Lot2', src: bakerySrc, at: { x: 11.94, z: -32.33 }, size: 1.79, yawDeg: 0, align: 163.5 },
    { key: 'ring1Lot3', src: dairySrc, at: { x: 11.79, z: -34.98 }, size: 1.46, yawDeg: 0, align: 196.2 },
    { key: 'ring1Lot5', src: lampSrc, at: { x: 8.05, z: -38.44 }, size: 1.29, yawDeg: 0, align: 261.6 },
    { key: 'ring1Lot10', src: jamStationSrc, at: { x: 5.28, z: -29.19 }, size: 1.56, yawDeg: 0, align: 425.3 },
    { key: 'fill0', src: kangarooSrc, at: { x: 6.21, z: -38.8 }, size: 1.6, yawDeg: 0, align: 47.8 },
    { key: 'fill1', src: kangarooSrc, at: { x: -1.34, z: -25.94 }, size: 1.43, yawDeg: 0, align: 222 },
    { key: 'fill2', src: kangarooSrc, at: { x: 3.37, z: -39.21 }, size: 1.82, yawDeg: 0, align: 97.6 },
    { key: 'fill3', src: kangarooSrc, at: { x: 20.92, z: -0.33 }, size: 1.79, yawDeg: 0, align: 27.6 },
    { key: 'fill4', src: milkJugSrc, at: { x: 26.49, z: -14.61 }, size: 0.66, yawDeg: 0, align: 255.4 },
    { key: 'fill5', src: mailboxSrc, at: { x: -15.71, z: -46.71 }, size: 0.96, yawDeg: 0, align: 227.2 },
    { key: 'fill6', src: rocksSrc, at: { x: 25.78, z: -17.6 }, size: 1.3, yawDeg: 0, align: 88.2 },
    { key: 'fill7', src: rocksSrc, at: { x: -0.82, z: -35.62 }, size: 1.35, yawDeg: 0, align: 232.1 },
    { key: 'fill8', src: mailboxSrc, at: { x: 51.58, z: 5.9 }, size: 1.14, yawDeg: 0, align: 291.9 },
    { key: 'fill9', src: crateSrc, at: { x: -26.68, z: -48.35 }, size: 0.98, yawDeg: 0, align: 328.5 },
    { key: 'fill10', src: lampSrc, at: { x: -5.06, z: -27.44 }, size: 1.4, yawDeg: 0, align: 306.4 },
    { key: 'fill11', src: crateSrc, at: { x: 19.16, z: -26.4 }, size: 1.07, yawDeg: 0, align: 149.7 },
    { key: 'fill12', src: rocksSrc, at: { x: 44.85, z: 13.01 }, size: 1.26, yawDeg: 0, align: 242 },
    { key: 'fill13', src: milkJugSrc, at: { x: 31.77, z: -6.7 }, size: 0.54, yawDeg: 0, align: 9 },
    { key: 'fill14', src: lampSrc, at: { x: 21.13, z: -2.35 }, size: 1.3, yawDeg: 0, align: 330.6 },
    { key: 'fill15', src: lampSrc, at: { x: 42.56, z: 9.81 }, size: 1.26, yawDeg: 0, align: 25 },
    { key: 'fill16', src: kangarooSrc, at: { x: 1.65, z: -28.37 }, size: 1.36, yawDeg: 0, align: 254.4 },
    { key: 'fill17', src: crateSrc, at: { x: -3.84, z: -37.44 }, size: 0.89, yawDeg: 0, align: 328.3 },
    { key: 'fill18', src: scarecrowSrc, at: { x: 31.94, z: -12.28 }, size: 1.51, yawDeg: 0, align: 161.5 },
    { key: 'fill19', src: crateSrc, at: { x: 21.15, z: -21.44 }, size: 0.88, yawDeg: 0, align: 89.8 },
    { key: 'fill20', src: milkJugSrc, at: { x: -6.67, z: -48.82 }, size: 0.55, yawDeg: 0, align: 146.8 },
    { key: 'fill21', src: rocksSrc, at: { x: -7.61, z: -31.5 }, size: 1.32, yawDeg: 0, align: 228.6 },
    { key: 'fill22', src: milkJugSrc, at: { x: -23.3, z: -47.76 }, size: 0.52, yawDeg: 0, align: 89.8 },
    { key: 'fill23', src: scarecrowSrc, at: { x: -0.63, z: -46.02 }, size: 1.24, yawDeg: 0, align: 164 },
    { key: 'fill24', src: rocksSrc, at: { x: -6.19, z: -41.29 }, size: 1.33, yawDeg: 0, align: 207.2 },
    { key: 'fill25', src: windChimeSrc, at: { x: -11.3, z: -34.04 }, size: 1.75, yawDeg: 0, align: 218.8 },
    { key: 'fill26', src: windmillSrc, at: { x: 45.31, z: 1.12 }, size: 2.47, yawDeg: 0, align: 61.5 },
    { key: 'fill27', src: lampSrc, at: { x: 3.43, z: -22.84 }, size: 1.31, yawDeg: 0, align: 24.5 },
    { key: 'fill28', src: rocksSrc, at: { x: 39.72, z: -6.39 }, size: 1.21, yawDeg: 0, align: 153.6 },
    { key: 'fill29', src: bonfireSrc, at: { x: 10.2, z: -12.1 }, size: 1.15, yawDeg: 0, align: 244.2 },
  ] as VillageProp[],
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
    { at: { x: 9.35, z: -17.75 }, count: 2, spacing: 0.9, alongZ: true }
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
    { src: truckElectricSrc, at: { x: 14.5, z: -7 }, height: 1.5, yawDeg: 0 },
    // --- the extension's vehicles ---
    // Two more, out on its longest streets. Only these two models idle: they came through
    // scripts_fbx2glb.mjs and this path binds the atlas flipped for them, which is why the
    // extension's two vans are in the buildings list instead.
    { src: truckSrc, at: { x: 33.45, z: 8.4 }, height: 1.6, yawDeg: 0, align: 180 },
    { src: truckElectricSrc, at: { x: -9.14, z: -34.49 }, height: 1.5, yawDeg: 0, align: 180 },
  ] as Array<{ src: string; at: { x: number; z: number }; height: number; yawDeg: number; align?: number }>,
  idle: { rise: 0.012, rate: 9.5, rock: 0.5 }, // world units, rad/s, degrees
  // --- the call to action ---
  //
  // Three upgrades to choose from, each with a down arrow over it, and any of them ends the
  // ad. The icons are RENDERED off the models themselves (see modelIcon) rather than drawn,
  // so they cost nothing in bundle and cannot drift from the props they stand for.
  //
  // The sheep house is the one model in the project with no usable texture — its UVs do not
  // line up with our Buildings.jpg, see the note at its import — so it is rendered in flat
  // cream. At button size an untextured building still reads as a building; drop the pack's
  // own Buildings.png into assets/images and it can have its atlas back.
  cta: {
    // Seconds between the wide shot settling and the buttons arriving — and it is now the
    // window the LINE gets to itself, since that is said the moment the move lands (see
    // expansionMoment). 0.9 was enough when nothing was in it; five words need longer than
    // that, and the bubble spends 0.26 of it springing open. 1.6 leaves about 1.3 of it
    // readable, which is a comfortable pace for "So much more to build!".
    delay: 1.6,
    // What that line is given as its own hold, as a backstop only: showUpgradeChoice clears it
    // when the buttons land, so on the normal path this never runs out. It is here for the slow
    // one — the CTA's icons are rendered from models and awaited, and if that takes a while the
    // line should still have said its piece and gone rather than hanging over the village.
    hold: 2.6,
    icon: 256, // px each icon is rendered at
    tone: 0xf0e2c0, // what an untextured icon is painted
    // The down arrow over each button, as a fraction of the button
    arrow: { size: 0.52, gap: 0.06, bob: 0.16, rate: 1.15, stagger: 0.18, fade: 0.35 },
    // A warm halo, so the arrows and the buttons read as live against the grass.
    //
    // The arrow's is a filter on the ART, not a box on its element: the PNG is a shape on a
    // transparent square, and a box-shadow would outline the square. Two drop-shadows stack
    // into one soft falloff — a single wide one is faint at the edge of the glow.
    glow: {
      arrow:
        'drop-shadow(0 0 0.7vmin rgba(255,214,120,0.95)) drop-shadow(0 0 2vmin rgba(255,150,20,0.6))',
      // The button's own glow PULSES between these two, keeping its existing drop shadow so it
      // still sits on the grass rather than floating.
      button: {
        dim: '0 0.6vmin 1.4vmin rgba(0,0,0,0.25), 0 0 0.6vmin 0 rgba(255,205,90,0.3)',
        bright: '0 0.6vmin 1.4vmin rgba(0,0,0,0.25), 0 0 3.2vmin 0.9vmin rgba(255,205,90,0.95)'
      },
      pulse: 1.25 // seconds for one breath, in and out
    },
    // The screen goes dark behind the three buttons, so the choice is the only lit thing left.
    //
    // `enabled` is the shipped default and can be flipped at runtime with ?dim=0 / ?dim=1 —
    // that is there so the two versions can be demoed back to back without a rebuild. A query
    // string never reaches a real placement (the playable ships as one inlined HTML file), so
    // the override is harmless in release.
    // The line over the choice. Sits above the arrows, in the same CSS variables the row uses,
    // so it holds its place relative to the buttons at any size or orientation.
    title: {
      text: 'Upgrade to Lvl. 2',
      size: { portrait: '5.6vmin', landscape: '4.4vmin' },
      // How far above the row's bottom edge it sits, in BUTTON heights: one for the button
      // itself, about 0.58 for the arrow and its gap, and the rest is breathing room.
      lift: 1.8
    },
    // The line and the buttons POP in: from nothing up to full size, easing in and out. Only
    // the transform is animated — the fade stays on the element's own opacity transition, so
    // clearing the row still fades it out.
    //
    // All three arrive TOGETHER. The stagger below is for the loops that run afterwards (the
    // arrows' bob and the buttons' glow), where offsetting them stops the three beating like a
    // metronome; an entrance is one moment, and staggering that read as three separate events.
    pop: { scale: 0, seconds: 0.2, ease: 'ease-in-out' },
    dim: {
      enabled: true,
      colour: 'rgba(0, 0, 0, 0.55)',
      fade: 0.45 // seconds, matched to the arrows coming in over it
    },
    /**
     * One instance of each upgrade, left UNDIMMED on the map — so the buttons are not three
     * pictures of things, they are three places on the island the player can see.
     *
     * The dim is one flat layer over everything, so the way to lift something out of it is to
     * take the dim off that spot rather than to raise the thing: the shade is drawn as a canvas
     * and these are erased out of it (see paintShade). At full coverage everywhere else, a hole
     * reads as a spotlight.
     *
     * `at` is in VILLAGE space, in the same order the buttons are built, so each hole belongs to
     * the button above it and the whole set moves if the town does. They are real props — the
     * chicken coop and the truck were already standing there, and the sheep home was placed for
     * this (see EXPANSION.buildings).
     *
     * There WERE arrows planted over the village once, one per opportunity, and they were pulled
     * for competing with the arrows on the buttons. This is deliberately not that: it adds no
     * second thing to look at, it only stops darkening three that are already there.
     */
    spotlight: {
      /**
       * Each hole names the entry it lights, and carries its OWN `lift`, because the three are
       * not the same height and one shared number put every light above the thing it was for.
       *
       * The trap is that `place` scales a prop by its LONGEST axis, not its height, so the
       * `size`/`height` in the lists below is not what a prop stands at. Each lift here is that
       * prop's mid-height, measured off the model: maxDim (size x EXPANSION.scale) x the
       * model's own height/longest ratio, halved.
       *
       *   chickenCoop        3.4 x 0.55 x 0.5632 = 1.053 tall -> 0.53
       *   victorianBarnLvl3  4   x 0.55 x 0.6078 = 1.337      -> 0.67
       *   truck              1.6 x 0.55 x 0.5278 = 0.464      -> 0.23
       *
       * At a flat 1 the truck's hole sat 0.77 above its middle — 0.68 up the screen against a
       * hole barely that wide — which is the whole of "the light is not on the truck".
       *
       * The middle one is the sheep home keyed `victorianBarnLvl3`: it is the sheepHomeSrc
       * model, the same one the button's icon is rendered from, and it is the sheep home that
       * is actually STANDING — the entry keyed `sheepHome` at (2.5, -18) is commented out of
       * the buildings list, so the hole that used to sit there lit bare grass.
       */
      at: [
        { x: 11, z: -18.5, lift: 0.53 }, // chickenCoop
        { x: 13, z: -29, lift: 0.87 }, // victorianBarnLvl3 — the sheep home model
        { x: 5, z: -21.5, lift: 0.23 } // the truck idling on the kerb
      ],
      // World units of RADIUS, not pixels: the wide shot is framed in world units and holds a
      // different number of pixels per unit on every screen, so a pixel radius would be a
      // different-sized hole on each one.
      //
      // Set by the two CLOSEST of the three on screen: two holes merge into one long smear as
      // soon as their edges touch, so the ceiling is half that distance. That pair is the coop
      // and the truck at 1.80 apart, so the ceiling is 0.90 and this sits just under it.
      //
      // It was 0.95 against 2.01 while every hole shared a flat lift of 1. Giving each its own
      // mid-height moved them vertically and closed that gap, and at 0.95 those two ran
      // together into one blob — which reads as the truck's light being off its truck just as
      // much as the wrong lift did. (The note here used to name the sheep home and the truck as
      // the close pair; it was the coop and the truck even then.)
      //
      // A building is about 2 units across, so 0.85 still lights one and its footprint.
      // Re-measure whenever a lift, a position or the shot's framing moves.
      radius: 1.2,
      // How much of that radius is fully clear before it starts feathering back to the dim. A
      // hard edge reads as a cut-out circle laid over the ad; this reads as light falling.
      core: 0.6,
      // Fallback for an entry that does not carry its own `lift` — work a new one out the way
      // the note on `at` does rather than taking this number.
      lift: 1,
      /**
       * ...and they come up ONE AT A TIME, in the order the buttons are built above them, so
       * each light reads as belonging to the button that shares its place in the row. All three
       * at once is one event and says nothing about which is which; in sequence, the eye is
       * walked along the row and out onto the map three times.
       *
       * `delay` holds the first one until the dim itself has landed (it fades in over
       * dim.fade) — a hole opening in a shade that is still arriving is invisible.
       *
       * The growth eases OUT with no overshoot on purpose. `radius` is capped by how close the
       * two nearest holes sit (see above: half of 1.80 units), and an easeOutBack would push
       * past that at the top of the bounce and smear two of them together for a frame.
       */
      sequence: { delay: 0.35, stagger: 0.3, open: 0.28 }
    }
  },
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
    // ...and the detail on the open ground. These reach PAST the treeline, out to where the
    // extension's street ends (22 world units, i.e. 40 config), because the street was
    // running out into bare grass. Small stuff only — the treeline itself stays around the
    // core, where it screens the farm instead of hiding it.
    flowers: { count: 150, inner: 0, outer: 40, min: 0.5, max: 0.9, spacing: 0.5, salt: 42 },
    grass: { count: 110, inner: 0, outer: 40, min: 0.4, max: 0.8, spacing: 0.6, salt: 77 },
    flowerGrass: { count: 60, inner: 5, outer: 40, min: 0.4, max: 0.7, spacing: 0.7, salt: 412 },
    rocks: { count: 34, inner: 6.5, outer: 36, min: 0.4, max: 1.0, spacing: 0.9, salt: 311 }
  }
};

/**
 * Whether to darken the screen behind the call to action: the config's own setting, unless
 * ?dim=0 or ?dim=1 says otherwise. For demoing the two versions back to back.
 */
function dimWanted(fallback: boolean): boolean {
  try {
    const asked = new URLSearchParams(window.location.search).get('dim');
    if (asked === null) return fallback;
    return !(asked === '0' || asked.toLowerCase() === 'false' || asked.toLowerCase() === 'off');
  } catch {
    return fallback; // no location to read (a headless or embedded host)
  }
}

/** Is `node` somewhere under `root`? Used to keep one branch of a model and hide the rest. */
function isDescendant(node: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let at = node.parent; at; at = at.parent) if (at === root) return true;
  return false;
}

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
 * The middle of the field. A function rather than a constant for the same reason cowPen is
 * one: screenAxes reads VIEW_YAW_DEG, which is declared further down the file and would still
 * be in its dead zone up here.
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
// The box is pinned to the TOP of the screen rather than hung off the speaker: it used to
// follow them at a fixed world size, so every time the camera pulled back for a wider beat
// the words shrank with the scene and stopped being readable on a phone. Sized and placed
// off the frustum instead, it is the same size on screen at every zoom.
//
// The box itself is DRAWN — a rounded rect with the words baked into the same canvas, one
// texture and one draw. It replaced DialogueBox.png, whose tail pointed at a speaker the box
// no longer hangs off; cropping the tail out of the art left a seam in its drop shadow, and
// a rounded rect is four lines of canvas either way.
const SPEECH = {
  // Across, as a fraction of the frame's SHORTER side (see frameMin) — this is what keeps it
  // constant on screen. Against the width it would have been a 56%-wide banner in portrait
  // and the same 56% of a twice-as-wide landscape frame, i.e. a different box per rotation.
  screenWidth: 0.56,
  // ...but the same box on a LANDSCAPE frame is a different thing again: that frame is half
  // as tall as portrait's in world units, so a vmin-sized box eats a fifth of the screen's
  // height. Landscape gets its own, smaller one. It stays CENTRED — an off-centre box reads
  // as a mistake — and what keeps it off the boat behind it is that it does not linger: see
  // pop, and `hold` at every call site.
  landscapeWidth: 0.38,
  // Gap above it, as a fraction of the frame's half-height. Not flush to the top: "moved
  // down a bit" reads as deliberate placement rather than as something jammed into the edge.
  topGap: 0.22,
  // Seconds a line stays up when the caller does not say. It used to be "until something
  // replaces it", which on the instruction lines meant the box sat over the shot for as long
  // as the player took to tap. The pointing hand is still there asking, so the words can say
  // their piece and get out of the way.
  hold: 1.5,
  // Seconds to spring open, and to shrink away again. The box scales from nothing on an
  // easeOutBack, so it LANDS instead of merely appearing — and, more to the point, it is
  // visibly a thing that comes and goes rather than a panel bolted over the shot.
  pop: 0.26,
  // The box in canvas pixels. Only the RATIO reaches the screen — screenWidth decides how
  // big it actually lands — so these are set big enough that the text stays crisp.
  box: { width: 640, height: 200, radius: 46 },
  // Kept clear of text on every side, as a fraction of the box.
  padding: { x: 0.08, y: 0.12 },
  fill: '#fef9da', // the cream the old art was painted in
  shadow: { colour: 'rgba(87,35,48,0.28)', blur: 20, drop: 10 },
  colour: '#6b5636',
  // Starting size, in those same box pixels. The text is MEASURED and shrunk until it fits —
  // a fixed size is a guess that breaks the moment anyone edits a line.
  fontSize: 68,
  fontStack: FONT.stack,
  lineSpacing: 1.15
};

// Read in order. Short enough to take in at a glance —
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
    // The cow's clearing: where the pair stands, and the pen itself. One circle covers the
    // whole ring — it IS a circle, COW_PEN.radius about her, and the scatter has to stay off
    // the rocks and off the trunk across the mouth of it alike.
    spot(COW_STOP.x, COW_STOP.z, 2.6),
    spot(
      COW_STOP.x + COW.offset.x,
      COW_STOP.z + COW.offset.z,
      COW_PEN.radius + COW_PEN.size + 0.5
    ),
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
  private speech?: THREE.Sprite; // only ever one, pinned to the top of the frame
  private finishing = false; // the end card is a one-way door — see finishAd
  private ctaShade?: HTMLElement; // the dark layer behind the call to action
  // Seconds into the spotlights' staggered opening. Infinity means "not in the sequence" — a
  // resize repaint then draws every hole at full size instead of replaying it.
  private shadeElapsed = Infinity;
  private brand?: HTMLElement; // the logo in the corner
  private fontReady = false; // see loadFont: the bubbles cannot be drawn until it is
  private begun = false; // has the overlay handed over? see begin()
  private onBegin?: () => void; // the first beat, waiting for it to
  private ctaTitle?: HTMLElement; // the line over the choice
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
  private need = { ...OPENING_FRAME.portrait };
  // Set when a beat asks to be framed PER ORIENTATION. Kept, not just resolved and forgotten:
  // a rotation has to be able to pick the other box, which is what it could not do before —
  // the shot resolved once when the beat started, and updateCamera then re-derived the frustum
  // from a box belonging to the orientation the player had left.
  private needFor?: { portrait: { w: number; h: number }; landscape: { w: number; h: number } };

  /**
   * How the loading screen is told what is happening. Set by Game right after this is built —
   * which is soon enough, because nothing here can call back before the current task ends.
   */
  public onLoadProgress?: (fraction: number) => void;
  public onLoaded?: () => void;
  private loadedOnce = false;

  /** Where the camera was pointed last frame, and how wide it was — see blurWithMotion. */
  private lastAim = new THREE.Vector3();
  private lastHalfW = 0;
  private blurNow = '';
  /** Only the expansion pull-back turns this on — see expansionMoment. */
  private motionBlur = false;
  /** How many speech bubbles are still drawn, shrinking ones included — see showSpeech. */
  private speechDrawn = 0;

  constructor(width: number, height: number, stage: IslandStage = 'rubble') {
    this.width = width;
    this.height = height;
    this.watchLoading();
    // The opening is framed per orientation, through the same machinery as the expansion's
    // reveal: keep the pair and resolve it against the screen. A device rotated during the
    // rubble beat then re-frames on its own, and resize() needs no special case for it.
    this.needFor = OPENING_FRAME;
    this.need = { ...this.resolveNeed(OPENING_FRAME) };
    this.addBrandLogo();
    this.loadFont();

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
      left: '0',
      // HIDDEN until the overlay has the screen covered — see reveal().
      //
      // It keeps rendering behind that: the models go on loading and decoding and the first
      // frames get drawn, which is what makes the hand-over instant. What it must not do is be
      // SEEN while it does, and there is a window where it would be — Game starts this scene in
      // its constructor and Phaser's overlay only boots a few hundred milliseconds later, longer
      // on a phone. In that gap a device showed the island mid-load: black where its grass
      // texture had not decoded yet.
      visibility: 'hidden'
    } as CSSStyleDeclaration);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd6f2); // sky

    // Both UI sprites are authored in sRGB like every other texture here.
    this.pointerTexture.colorSpace = THREE.SRGBColorSpace;
    this.woodTexture.colorSpace = THREE.SRGBColorSpace;

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
        const flat = Math.max(size.x, size.z);

        const group = new THREE.Group();
        group.name = 'rubble';

        /**
         * One rock, stood on the grass at a world spot. Shared by the arc around the pair and
         * the ring around the cow, which is the only reason the two look like the same pile of
         * stone — they are the same model, the same material and the same sink.
         */
        const stand = (
          i: number,
          spot: { x: number; z: number },
          target: number,
          sizeJitter: number,
          sink: number,
          tumbleDeg = 0 // pitch and roll off flat. The opening arc takes none — see COW_PEN.
        ) => {
          const rock = source.clone(true);
          rock.scale.setScalar((target / flat) * (1 + (jitter(i, 1) - 0.5) * 2 * sizeJitter));

          // Centre the model on its pivot and drop it to the grass, then bury
          // the sink fraction of it. Measured after scaling, like the boat.
          const box = new THREE.Box3().setFromObject(rock);
          const centre = box.getCenter(new THREE.Vector3());
          const height = box.max.y - box.min.y;
          rock.position.set(-centre.x, -box.min.y - height * sink, -centre.z);

          const pivot = new THREE.Group();
          pivot.add(rock);
          pivot.position.set(spot.x, 0, spot.z);
          pivot.rotation.y = jitter(i, 3) * Math.PI * 2; // spun so no two show the same face
          // ...and tipped off flat. Set on the pivot AFTER the yaw and in YXZ order, so the
          // tilt is applied in the world's frame rather than about the rock's own spun axes —
          // otherwise how far a rock leans would depend on which way it happened to be turned.
          if (tumbleDeg) {
            pivot.rotation.order = 'YXZ';
            pivot.rotation.x = THREE.MathUtils.degToRad((jitter(i, 5) - 0.5) * 2 * tumbleDeg);
            pivot.rotation.z = THREE.MathUtils.degToRad((jitter(i, 7) - 0.5) * 2 * tumbleDeg);
          }
          return { pivot, rock };
        };

        for (let i = 0; i < RUBBLE.count; i++) {
          // Walk the arc from one end to the other, nudging each rock in or out
          // so the seven do not read as beads on a drawn circle.
          const step = RUBBLE.count === 1 ? 0.5 : i / (RUBBLE.count - 1);
          const angle = THREE.MathUtils.degToRad(
            RUBBLE.arcCentreDeg - RUBBLE.arcSpanDeg / 2 + RUBBLE.arcSpanDeg * step
          );
          // In or out, but MIRRORED about the rock they break — so the arc is keyed to how far
          // each rock is from the middle of the run rather than to its own index.
          //
          // Keyed to `i`, the two rocks flanking the gap drew different radii (1.946 and 2.028),
          // and a gap whose two edges stand at different distances is a gap that points slightly
          // off to one side: it read 2 degrees off the line the pair runs down to the bridge.
          // Mirroring costs nothing — there are still four different radii across the seven, so
          // they are no more beads on a drawn circle than they were — and it puts the opening
          // exactly on that line.
          const radius =
            RUBBLE.radius +
            (jitter(Math.abs(i - RUBBLE_BREAK.index), 2) - 0.5) * 2 * RUBBLE.radiusJitter;

          const { pivot, rock } = stand(
            i,
            {
              x: RUBBLE_CENTRE.x + Math.sin(angle) * radius,
              z: RUBBLE_CENTRE.z + Math.cos(angle) * radius
            },
            RUBBLE.size,
            RUBBLE.sizeJitter,
            RUBBLE.sink
          );
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

        // ...and the ring penning the cow in on the far bank, off the same model and the same
        // material, so the two piles of stone are recognisably the same stone. Scenery, all of
        // it: nothing here is breakable and nothing here is pushed onto this.rocks, which is
        // the list the SHATTER walks. The only way out of this ring is the trunk across its
        // mouth, and that is a tree — see addTrees.
        cowPen().rocks.forEach((offset, i) => {
          const { pivot } = stand(
            i + 50, // past the opening arc's seeds, so the two rings jitter differently
            { x: COW_STOP.x + offset.x, z: COW_STOP.z + offset.z },
            COW_PEN.size,
            COW_PEN.sizeJitter,
            COW_PEN.sink,
            COW_PEN.tumbleDeg
          );
          group.add(pivot);
        });

        this.scene.add(group);
        // Needs the breakable rock, which only exists now — and the player needs to SEE it
        // offered, so it waits for the overlay to hand over (see begin).
        if (this.breakable) {
          // Stone: the hammer breaks it, the broom is no use against rock.
          this.whenVisible(() => {
            this.showToolChoice([hammerSrc, broomSrc], () => this.breakRubble());
            this.say(SPEECH_LINES.tool);
          });
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
    const { row, button } = this.choiceRow();

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
      width: `calc(var(--choice-button) * ${TOOL_CHOICE.hand})`,
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
   * The intro overlay has handed over — the clouds have receded and the world is on screen — so
   * the first beat may start.
   *
   * It used to start itself, the moment the rubble model finished loading, which is several
   * seconds into the intro VIDEO: the tool row went up and the first line was said behind an
   * opaque video, so by the time the player could see anything the hand had been pointing at a
   * button for five seconds. The scene is still built and rendered early on purpose — that is
   * what makes the reveal instant — but nothing the player is meant to WATCH runs until here.
   */
  /**
   * The fog has covered the screen and is about to thin back out: widen the frustum and let it
   * settle onto the opening frame, so the world is revealed being pushed INTO rather than
   * sitting there waiting. Runs through moveCamera like every other reframe, with the target
   * left where it is — only the zoom moves.
   */
  public introZoom(): void {
    sfx.play('cameraZoom');
    this.need.w *= INTRO_ZOOM.from;
    this.need.h *= INTRO_ZOOM.from;
    this.updateCamera();
    this.moveCamera(this.cameraTarget.clone(), OPENING_FRAME, INTRO_ZOOM.ease);
  }

  /**
   * Show the canvas. Called when the overlay has the screen covered, so whatever state the scene
   * is in at that moment is hidden behind fog rather than on display. Idempotent: several things
   * may reasonably decide the world should be visible by now.
   */
  public reveal(): void {
    this.renderer.domElement.style.visibility = 'visible';
  }

  public begin(): void {
    if (this.begun) return;
    this.begun = true;
    const first = this.onBegin;
    this.onBegin = undefined;
    first?.();
  }

  /** Run this now if the world is already on screen, or the moment it is. */
  private whenVisible(start: () => void): void {
    if (this.begun) start();
    else this.onBegin = start;
  }

  /**
   * Bring the typeface in. Resolves `fontReady` either way — if the face fails to load, the
   * stack's fallbacks are perfectly readable and a playable that never draws its speech is not.
   */
  /**
   * Report how far the models and textures have got, for the loading screen to draw.
   *
   * Hooked onto THREE's DefaultLoadingManager rather than a manager of our own, and that is the
   * whole trick: every loader in this file is built without a manager argument, and THREE.Loader
   * falls back to the default one when it gets none. So all fourteen GLTFLoader sites and every
   * TextureLoader are already reporting to it — there is nothing to thread through and no
   * fifteenth site that can forget to.
   *
   * `onLoad` fires whenever the queue empties, which is NOT only at the end: the button icons
   * are rendered from models long afterwards and would empty it a second time. Only the first
   * one is the opening, so the rest are dropped.
   */
  private watchLoading(): void {
    const manager = THREE.DefaultLoadingManager;
    manager.onProgress = (_url: string, loaded: number, total: number) => {
      this.onLoadProgress?.(total > 0 ? loaded / total : 0);
    };
    manager.onLoad = () => {
      if (this.loadedOnce) return;
      this.loadedOnce = true;
      this.onLoaded?.();
    };
    // A file that fails is still a file that is not coming. Nothing here can be retried and the
    // ad must open regardless, so an error counts as done rather than leaving the queue one
    // short and the loading screen up for the timeout to rescue.
    manager.onError = (url: string) => console.error('Failed to load', url);
  }

  private loadFont(): void {
    if (typeof FontFace === 'undefined') {
      this.fontReady = true;
      return;
    }
    const face = new FontFace(FONT.family, `url(${fontSrc})`, { weight: FONT.weight });
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        this.fontReady = true;
      })
      .catch((err: unknown) => {
        console.error('Font failed to load, falling back:', err);
        this.fontReady = true;
      });
  }

  /** The brand mark in the top-right corner, for as long as the playable is up. */
  private addBrandLogo(): void {
    if (!document.getElementById('island-brand-css')) {
      const style = document.createElement('style');
      style.id = 'island-brand-css';
      style.textContent = `
        .island-brand {
          --brand-width: ${BRAND.width.portrait};
          --brand-inset: ${BRAND.inset.portrait};
        }
        @media (orientation: landscape) {
          .island-brand {
            --brand-width: ${BRAND.width.landscape};
            --brand-inset: ${BRAND.inset.landscape};
          }
        }`;
      document.head.appendChild(style);
    }

    const logo = document.createElement('img');
    logo.className = 'island-brand';
    logo.src = logoSrc;
    Object.assign(logo.style, {
      position: 'fixed',
      top: 'var(--brand-inset)',
      right: 'var(--brand-inset)',
      width: 'var(--brand-width)',
      height: 'auto',
      opacity: '0',
      transition: `opacity ${BRAND.fade}s`,
      pointerEvents: 'none', // never in the way of a tap
      zIndex: BRAND.zIndex
    } as CSSStyleDeclaration);
    document.body.appendChild(logo);
    requestAnimationFrame(() => (logo.style.opacity = '1'));
    this.brand = logo;
  }

  /**
   * Render one model to a PNG data URI, for use as a button icon.
   *
   * The alternative was three more images in the bundle, and icons that drift from the props
   * they stand for the moment anything is retuned. This borrows the model that is already
   * loaded for the world, shoots it from the SAME iso angle under the same light ratios, and
   * hands back a picture — so a button looks like the thing it builds, at no bundle cost.
   *
   * It runs on its OWN renderer, disposed immediately: the scene's is sized to the screen and
   * has no preserveDrawingBuffer, so toDataURL against it comes back blank. Three icons, one
   * at a time, at load — the extra context is alive for a few frames.
   */
  private async modelIcon(
    src: string,
    flip: boolean,
    tint?: number,
    // Keep ONLY these nodes out of the file, by name, with everything else hidden. SheepHome.glb
    // is four of them — the building, the pasture it stands on, grass and vegetation — and the
    // vegetation is the tallest thing in it, so fitting the frame to the whole file put a
    // foliage fan on the button with the building a speck beside it.
    //
    // A LIST rather than one name, because "the sheep home" is two of those nodes: the shed and
    // the pasture under it. It used to be one name plus a rule that threw out anything called
    // grass, vegetation or pasture — which is fine until the thing you want IS the pasture.
    // Naming what to keep says the same thing without a second rule to contradict it.
    only?: string | string[]
  ): Promise<string> {
    const size = EXPANSION.cta.icon;
    // BOTH awaited before anything is drawn. The first version rendered inside the GLTF
    // callback with a TextureLoader().load() still in flight, so every icon came out a black
    // silhouette — the material had a map with no image in it yet.
    const [gltf, texture] = await Promise.all([
      new GLTFLoader().loadAsync(src).catch((err: unknown) => {
        console.error(`Icon model failed to load (${src.slice(0, 40)}):`, err);
        return null;
      }),
      tint ? Promise.resolve(null) : new THREE.TextureLoader().loadAsync(boatTextureSrc)
    ]);
    if (!gltf) return '';

    const model = (gltf as { scene: THREE.Group }).scene;
    // Unwanted parts are HIDDEN, never pulled out of the file. These GLBs carry quantized
    // positions, and the scale that decodes them lives on the node's parents — so lifting one
    // node into a scene of its own drops that scale and the mesh renders as a crumpled sheet,
    // which is exactly what the sheep home did.
    if (only) {
      const names = Array.isArray(only) ? only : [only];
      const keep = names
        .map((name) => {
          const node = model.getObjectByName(name);
          if (!node) console.warn(`Icon: no node named ${name} in ${src.slice(0, 30)}`);
          return node;
        })
        .filter((node): node is THREE.Object3D => !!node);
      model.traverse((child: THREE.Object3D) => {
        if (!(child as THREE.Mesh).isMesh) return;
        child.visible = keep.some((node) => child === node || isDescendant(child, node));
      });
    }
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = flip;
      texture.needsUpdate = true;
    }
    const material = texture
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })
      : new THREE.MeshStandardMaterial({ color: tint, roughness: 1 });
    model.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) mesh.material = material;
    });

    // Centred on its own bounding box, over the VISIBLE meshes only — Box3.setFromObject
    // counts hidden ones too, which would frame the icon on foliage that is not being drawn.
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const corner = new THREE.Vector3();
    model.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
      mesh.geometry.computeBoundingBox();
      const local = mesh.geometry.boundingBox;
      if (!local) return;
      for (const x of [local.min.x, local.max.x])
        for (const y of [local.min.y, local.max.y])
          for (const z of [local.min.z, local.max.z])
            box.expandByPoint(corner.set(x, y, z).applyMatrix4(mesh.matrixWorld));
    });
    const middle = box.getCenter(new THREE.Vector3());
    model.position.sub(middle);
    box.translate(middle.clone().negate());

    const scene = new THREE.Scene();
    scene.add(model);
    scene.add(new THREE.AmbientLight(0xffffff, LIGHTS.ambient));
    const sun = new THREE.DirectionalLight(0xffffff, LIGHTS.sun);
    sun.position.copy(ISO_DIR).multiplyScalar(10);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, LIGHTS.fill * 0.6);
    fill.position.set(0, 10, 0);
    scene.add(fill);

    // Framed on what the camera actually SEES: the box's eight corners, projected onto the
    // camera's own right and up. Guessing from the box's width and height (or from a bounding
    // sphere) leaves a wide, shallow building swimming in empty pixels at button size, which
    // is most of why the first icons read as specks.
    // How far the model reaches from its own middle. It has just been moved onto the origin, so
    // this is the radius the camera has to stand outside of AND see all the way through.
    //
    // Both used to be constants — the camera 50 units out with a far plane at 200 — and that is
    // a bet on every icon model being a few units across. Three of them are (0.1 to 7). The
    // sheep home is 748, because its root node is the one without the 0.01 scale the others
    // carry, so the camera stood INSIDE the building and the far plane cut it off a third of the
    // way through: what came out was a cross-section, which is exactly the "crumpled sheet" this
    // file blamed on the mesh for three rounds. The geometry was always fine.
    //
    // Nothing is orthographic-safe about a fixed distance either way: the frustum is sized from
    // the box below, so moving the camera further out costs nothing and clips nothing.
    const reach = Math.max(box.min.length(), box.max.length()) || 1;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, reach * 0.01, reach * 4);
    camera.position.copy(ISO_DIR).multiplyScalar(reach * 2);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    let half = 0;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const corner = new THREE.Vector3(x, y, z);
          half = Math.max(half, Math.abs(corner.dot(right)), Math.abs(corner.dot(up)));
        }
    half *= 1.06; // a hair of margin, so nothing touches the edge of the icon
    camera.left = -half;
    camera.right = half;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();

    // Its own renderer, disposed straight away: the scene's is sized to the screen and has no
    // preserveDrawingBuffer, so toDataURL against it comes back blank.
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(size, size);
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    renderer.dispose();
    renderer.forceContextLoss();
    return url;
  }

  /**
   * The dim over the wide shot, with a hole burnt through it over each upgrade that is standing
   * on the map — see EXPANSION.cta.spotlight.
   *
   * Drawn rather than styled, and re-drawn on a resize: the holes are world positions projected
   * through the camera, so they belong to the shot rather than to the screen, and a rotation
   * moves every one of them.
   */
  private paintShade(canvas: HTMLCanvasElement): void {
    const { dim, spotlight } = EXPANSION.cta;
    // Half resolution. It is a flat colour with three soft gradients in it — there is nothing in
    // that worth a full-DPR buffer on a phone, and the CSS box stretches it back over the screen.
    const w = Math.max(1, Math.round(this.width / 2));
    const h = Math.max(1, Math.round(this.height / 2));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // no 2D context: the ad goes on without the dim rather than without a CTA

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = dim.colour;
    ctx.fillRect(0, 0, w, h);

    // Pixels per world unit, taken off the frustum itself so it is right at any zoom or screen.
    // The camera is orthographic and the canvas matches its aspect, so one number does both axes.
    const perUnit = w / 2 / ((this.camera.right - this.camera.left) / 2);
    const radius = spotlight.radius * perUnit;
    const point = new THREE.Vector3();

    // destination-out: the gradient's ALPHA says how much of the dim to take away, so a solid
    // middle is a clear hole and the falloff feathers it back into the shade.
    ctx.globalCompositeOperation = 'destination-out';
    const { delay, stagger, open } = spotlight.sequence;
    spotlight.at.forEach((at, i) => {
      // Where this one is in its own opening, 0 until its turn comes. shadeElapsed starts at
      // Infinity, so a repaint that is NOT part of the sequence — a resize, which re-projects
      // every hole — draws them all fully open rather than starting the show again.
      const k = Math.min((this.shadeElapsed - delay - i * stagger) / open, 1);
      if (k <= 0) return;
      const ease = k * (2 - k); // easeOutQuad: fast at the top, and never past 1

      const world = villageAt(at);
      point.set(world.x, at.lift ?? spotlight.lift, world.z).project(this.camera);
      const x = (point.x * 0.5 + 0.5) * w;
      const y = (-point.y * 0.5 + 0.5) * h;
      // Opens as light does: the hole widens as it clears, rather than a full-sized circle
      // fading up in place.
      const r = radius * (0.6 + 0.4 * ease);
      const fade = ctx.createRadialGradient(x, y, r * spotlight.core, x, y, r);
      fade.addColorStop(0, `rgba(0, 0, 0, ${ease})`);
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = fade;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * The expansion's call to action: three upgrades, a down arrow bobbing over each, and any
   * tap ends the ad.
   *
   * Every button is live — there is no wrong answer here, unlike the tool choices — so the
   * arrows do the pointing instead of the hand, which can only point at one.
   */
  private async showUpgradeChoice(): Promise<void> {
    const cta = EXPANSION.cta;
    const icons = await Promise.all([
      this.modelIcon(coopSrc, false),
      /**
       * The livestock house — the sheep home itself, which a cow shed stood in for while this
       * file blamed its geometry: "1674 verts that render as a crumpled sheet". The mesh was
       * never the problem. It was the icon CAMERA, which stood at a fixed 50 units with its far
       * plane at 200 — fine for the other three models, which are 0.1 to 7 units across, and
       * hopeless for this one at 748, where it left the camera inside the building rendering a
       * slice of it. See modelIcon, where both now come off the model's own size.
       *
       * The file was checked rather than argued about: every mesh decodes to sound geometry,
       * no out-of-range indices, median edge 0.08 of the box diagonal, normals unit-length and
       * agreeing with their triangles 100% of the time — and the same triangle count as the FBX
       * it came from.
       *
       * It takes the buildings atlas like everything else here, and the note about it being
       * untexturable — "whole wall faces span the atlas's empty black space, so it renders as a
       * black slab" — does not survive measuring either. Sampling the atlas at this model's own
       * UVs gives the walls a warm tan and the pasture a yellow-green, with 16% of the building's
       * samples landing on black against 25% for the cow shed's own second mesh and 9% for the
       * coop. It is unremarkable for this atlas. That reading was taken while the camera was
       * still cutting the model in half, which is the more likely explanation for whatever the
       * black slab actually was.
       *
       * flipY TRUE, which is the rule for anything out of scripts_fbx2glb.mjs and is also what
       * the atlas says: at TRUE the walls come out tan and the pasture green, at FALSE they come
       * out muddy brown and a quarter of the building goes black.
       *
       * `only` keeps the shed AND the pasture it stands on — the pasture is what makes it read
       * as livestock rather than as another shed, and it costs 4% of the building's size in
       * frame to include. It is also what stops the two being one flat colour, which is what
       * they were while this was tinted: the atlas puts a green field under a tan building.
       * The grass and the vegetation stay out: the vegetation is the tallest node in the file,
       * and framing the whole thing put a foliage fan on the button.
       */
      this.modelIcon(sheepHomeSrc, true, undefined, [
        'B_SpringSerenade_Sheep_Home',
        'B_SpringSerenade_Pasture_Sheep'
      ]),
      this.modelIcon(truckSrc, true)
    ]);
    // The icons are awaited, so the ad can be torn down while they render.
    if (!this.running) return;

    // Take the speech bubble down before anything is put over it. It is a SPRITE, drawn inside
    // the WebGL canvas, and everything below is DOM at zIndex 19 and 20 — so a line still up
    // when this lands does not compete with the buttons, it goes under the dim and sits there
    // greyed out until its hold runs out. "So much more to build!" is said as the pull-back
    // STARTS and holds 5s; the shot takes 2.4 and the CTA waits another 0.9, so it had 1.7s
    // underneath. Cleared here rather than by shortening that hold, because the hold is also
    // what covers the slow path: these icons are rendered from models and awaited, and on a
    // slow device the CTA can arrive well after 5s.
    this.hideSpeech();

    // Dark behind the buttons, under the row but over everything else — the row is at 20 and
    // the end card at 30, so 19 leaves both clear. It takes no pointer events at all: the
    // buttons sit above it and would still be tappable, but a dead layer cannot be the thing
    // that swallows a tap, and this row has been through that once already.
    if (dimWanted(EXPANSION.cta.dim.enabled)) {
      // A CANVAS, not a coloured div, because it has holes in it — one over each upgrade
      // standing on the map. CSS can mask a div with several radial gradients, but only through
      // mask-composite, which is spelt differently in WebKit and is exactly the kind of thing to
      // find out about from a device farm. Erasing out of a 2D canvas works the same everywhere.
      const shade = document.createElement('canvas');
      Object.assign(shade.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        opacity: '0',
        transition: `opacity ${EXPANSION.cta.dim.fade}s`,
        pointerEvents: 'none',
        zIndex: '19'
      } as CSSStyleDeclaration);
      // The holes are burnt in one at a time — see spotlight.sequence. Repainted per frame
      // only while that runs; once the last one is open the effect drops off and the canvas is
      // left alone until a resize asks for it.
      const { delay, stagger, open } = EXPANSION.cta.spotlight.sequence;
      const lit = delay + (EXPANSION.cta.spotlight.at.length - 1) * stagger + open;
      this.shadeElapsed = 0;
      this.paintShade(shade);
      this.effects.push((step: number) => {
        if (this.ctaShade !== shade) return false; // the CTA went away mid-sequence
        this.shadeElapsed += step;
        this.paintShade(shade);
        if (this.shadeElapsed < lit) return true;
        this.shadeElapsed = Infinity; // done: later repaints draw every hole open
        return false;
      });
      document.body.appendChild(shade);
      requestAnimationFrame(() => (shade.style.opacity = '1'));
      this.ctaShade = shade;
      // Out from under it — see BRAND.ctaZIndex. Only when the dim is actually up: with the
      // dim disabled there is nothing to climb over.
      if (this.brand) this.brand.style.zIndex = BRAND.ctaZIndex;
    }

    const title = document.createElement('div');
    title.className = 'island-choice'; // for the button/bottom variables it is placed against
    title.textContent = cta.title.text;
    Object.assign(title.style, {
      position: 'fixed',
      left: '0',
      right: '0',
      bottom: `calc(var(--choice-bottom) + var(--choice-button) * ${cta.title.lift})`,
      textAlign: 'center',
      font: `700 var(--title-size) ${SPEECH.fontStack}`,
      color: '#ffffff',
      textShadow: '0 0.3vmin 0.8vmin rgba(0,0,0,0.75)',
      opacity: '0',
      transition: `opacity ${cta.arrow.fade}s`,
      pointerEvents: 'none',
      zIndex: '20'
    } as CSSStyleDeclaration);
    title.style.setProperty('--title-size', cta.title.size.portrait);
    if (this.width > this.height) title.style.setProperty('--title-size', cta.title.size.landscape);
    document.body.appendChild(title);
    requestAnimationFrame(() => (title.style.opacity = '1'));
    title.animate([{ transform: `scale(${cta.pop.scale})` }, { transform: 'scale(1)' }], {
      duration: cta.pop.seconds * 1000,
      easing: cta.pop.ease
    });
    this.ctaTitle = title;

    const { row, button } = this.choiceRow();
    icons.forEach((icon, i) => {
      const el = button(icon, () => this.finishAd());

      // An arrow over the button, staggered in so the three arrive as a sequence rather than a
      // block. TWO elements: the outer one bobs, the inner one is turned over. arrow.png points
      // UP — measured off its alpha, the tip is its top row and the shaft its bottom — so it
      // needs the half turn to point AT the button, and keeping the turn off the animated
      // element means translateY still means screen-down rather than down-in-a-rotated-frame.
      const bob = document.createElement('span');
      Object.assign(bob.style, {
        position: 'absolute',
        display: 'block',
        bottom: `calc(100% + ${cta.arrow.gap * 100}%)`,
        left: `${50 - (cta.arrow.size * 100) / 2}%`,
        width: `${cta.arrow.size * 100}%`,
        opacity: '0',
        transition: `opacity ${cta.arrow.fade}s`,
        pointerEvents: 'none'
      } as CSSStyleDeclaration);
      const arrow = document.createElement('img');
      arrow.src = arrowSrc;
      Object.assign(arrow.style, {
        display: 'block',
        width: '100%',
        transform: 'rotate(180deg)',
        filter: cta.glow.arrow
      } as CSSStyleDeclaration);
      bob.appendChild(arrow);
      el.appendChild(bob);
      requestAnimationFrame(() => (bob.style.opacity = '1')); // with its button, not after it

      el.animate([{ transform: `scale(${cta.pop.scale})` }, { transform: 'scale(1)' }], {
        duration: cta.pop.seconds * 1000,
        easing: cta.pop.ease
      });

      // ...and the button breathes under it. Offset by the same stagger as its arrow, so the
      // three do not pulse in lockstep.
      el.animate(
        [
          { boxShadow: cta.glow.button.dim },
          { boxShadow: cta.glow.button.bright, offset: 0.5 },
          { boxShadow: cta.glow.button.dim }
        ],
        {
          duration: cta.glow.pulse * 1000,
          iterations: Infinity,
          delay: i * cta.arrow.stagger * 1000,
          easing: 'ease-in-out'
        }
      );

      bob.animate(
        [
          { transform: 'translateY(0)' },
          { transform: `translateY(${cta.arrow.bob * 100}%)`, offset: 0.5 },
          { transform: 'translateY(0)' }
        ],
        {
          duration: (1 / cta.arrow.rate) * 1000,
          iterations: Infinity,
          delay: i * cta.arrow.stagger * 1000,
          easing: 'ease-in-out'
        }
      );
    });

    document.body.appendChild(row);
    this.toolChoice = row; // so a resize or a destroy clears it like any other choice
    requestAnimationFrame(() => (row.style.opacity = '1'));
  }

  /**
   * Hand over to the end card. sdk.finish() is what does it — the network puts its own card
   * up on that event, and Game.finish tears the two layers down underneath it. Guarded
   * because all three buttons call it and a second finish would be a second handover.
   */
  private finishAd(): void {
    if (this.finishing) return;
    this.finishing = true;
    this.clearToolChoice();
    sdk.finish();
  }

  /**
   * The row of white buttons, and the factory for one. Shared by the tool choices and by the
   * expansion's call to action, so the z-index fix below lives in exactly one place.
   */
  private choiceRow(): {
    row: HTMLDivElement;
    button: (icon: string, onTap: (el: HTMLElement) => void) => HTMLElement;
  } {
    // The sizes live in CSS variables, swapped by an orientation media query, so a rotation
    // re-lays the row out without a resize handler. Injected once per page.
    if (!document.getElementById('island-choice-css')) {
      const style = document.createElement('style');
      style.id = 'island-choice-css';
      style.textContent = `
        .island-choice {
          --choice-button: ${TOOL_CHOICE.button};
          --choice-bottom: ${TOOL_CHOICE.bottom};
          --choice-gap: ${TOOL_CHOICE.gap};
        }
        @media (orientation: landscape) {
          .island-choice {
            --choice-button: ${TOOL_CHOICE.landscape.button};
            --choice-bottom: ${TOOL_CHOICE.landscape.bottom};
            --choice-gap: ${TOOL_CHOICE.landscape.gap};
          }
        }`;
      document.head.appendChild(style);
    }

    const row = document.createElement('div');
    row.className = 'island-choice';
    Object.assign(row.style, {
      position: 'absolute',
      left: '0',
      right: '0',
      bottom: 'var(--choice-bottom)',
      display: 'flex',
      justifyContent: 'center',
      gap: 'var(--choice-gap)',
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
        width: 'var(--choice-button)',
        height: 'var(--choice-button)',
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

    return { row, button };
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
    // The dark layer goes with the row it was put up for. Faded on the same timing, so the
    // world comes back as the buttons leave rather than snapping back behind them.
    const title = this.ctaTitle;
    if (title) {
      this.ctaTitle = undefined;
      title.style.opacity = '0';
      window.setTimeout(() => title.remove(), TOOL_CHOICE.fade);
    }

    const shade = this.ctaShade;
    if (shade) {
      this.ctaShade = undefined;
      if (this.brand) this.brand.style.zIndex = BRAND.zIndex; // back under the overlay layers
      shade.style.opacity = '0';
      window.setTimeout(() => shade.remove(), EXPANSION.cta.dim.fade * 1000);
    }

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
    sprite.renderOrder = 999;

    // Screen-right comes off the camera's own X axis, since world X points
    // diagonally at this yaw. Its world matrix is only refreshed by a render,
    // and this can run off a load callback that beats the first frame.
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);

    // The hand points UP with its fingertip at the top edge of the image, so the sprite hangs
    // half its own height below wherever that tip should land — offsetY is the tip's clearance
    // over the target, not the sprite's. The height is re-derived every frame (the hand is
    // sized off the frame, which moves), so this holds only the part that never changes.
    const base = new THREE.Vector3(centre.x, top + TAP_HINT.offsetY, centre.z).addScaledVector(
      right,
      TAP_HINT.offsetX
    );
    sprite.position.copy(base).setY(base.y - (this.frameMin() * TAP_HINT.screenSize) / 2);

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

      const size = this.frameMin() * TAP_HINT.screenSize;
      sprite.position.y = base.y - size / 2 - press * size * TAP_HINT.dip;
      sprite.scale.setScalar(size * (1 - press * 0.08));

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

    // Which of them is on which side, measured against THEIR OWN middle rather than against the
    // bridge's centre line. Those used to be the same point, so comparing with the bridge worked
    // — and it stopped working the moment the bridge moved onto their sightline (BRIDGE.z),
    // which slid it 0.35 along the channel and left the nearer of the two just 0.017 from the
    // line. A hair either way and both of them pick the same lane and walk through each other on
    // the deck. Their own midpoint cannot drift out from under them like that.
    const middleZ =
      this.actions.reduce((sum, entry) => sum + entry.pivot.position.z, 0) /
      Math.max(this.actions.length, 1);

    this.actions.forEach((entry) => {
      const from = entry.pivot.position;
      // One of them stands each side of that middle already, so this keeps
      // whichever side they are on.
      const side = Math.sign(from.z - middleZ) || 1;
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

  /** Whichever box this screen wants. A plain box is already the answer. */
  private resolveNeed(
    want:
      | { w: number; h: number }
      | { portrait: { w: number; h: number }; landscape: { w: number; h: number } }
  ): { w: number; h: number } {
    if (!('portrait' in want)) return want;
    return this.width > this.height ? want.landscape : want.portrait;
  }

  /**
   * Ease the shot to a new place and zoom, then hand back. Every beat that
   * reframes goes through here, so they all move the same way.
   *
   * `want` may be one box or a portrait/landscape pair. A pair is REMEMBERED, so a rotation —
   * during the move or long after it — re-resolves to the other box; a plain box clears that,
   * because a beat framed off its own subjects has nothing orientation-specific to hold on to.
   */
  private moveCamera(
    to: THREE.Vector3,
    want:
      | { w: number; h: number }
      | { portrait: { w: number; h: number }; landscape: { w: number; h: number } },
    ease: number,
    done?: () => void
  ): void {
    this.needFor = 'portrait' in want ? want : undefined;
    const from = this.cameraTarget.clone();
    const fromNeed = { ...this.need };

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      const k = THREE.MathUtils.smoothstep(elapsed, 0, ease);

      // Re-resolved every frame, not captured once: rotating the device mid-move has to bend
      // the move towards the other orientation's box rather than finish on the old one.
      const need = this.resolveNeed(want);
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
   * Ease the ZOOM and nothing else, leaving what the camera is pointed at alone.
   *
   * This exists because moveCamera cannot be used while they are running. It writes
   * cameraTarget every frame, and so does the follow — and effects are stepped AFTER
   * driveRunners, so the tween would land last and win, pinning the shot to a fixed point
   * while the pair walked out of it. Everything a travelling leg wants to change is the
   * frustum, which the follow never touches, so this changes only that.
   */
  private easeFrame(
    want:
      | { w: number; h: number }
      | { portrait: { w: number; h: number }; landscape: { w: number; h: number } },
    ease: number
  ): void {
    // A pair is REMEMBERED, exactly as moveCamera remembers one, so a device turned during the
    // move — or long after it — re-resolves to the other orientation's box instead of finishing
    // on the one it started in.
    this.needFor = 'portrait' in want ? want : undefined;
    const fromNeed = { ...this.need };

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      const k = THREE.MathUtils.smoothstep(elapsed, 0, ease);
      // Re-resolved every frame rather than captured once, for the same reason.
      const need = this.resolveNeed(want);
      this.need.w = THREE.MathUtils.lerp(fromNeed.w, need.w, k);
      this.need.h = THREE.MathUtils.lerp(fromNeed.h, need.h, k);
      this.updateCamera();
      return elapsed < ease;
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

    // Solve the zoom on the CENTRED target, then ride the aim down-screen — in that order, and
    // that is the whole trick. Shifting the target first does nothing: framing() measures its
    // extents about whatever it is given, so the frame simply grows on the other side and puts
    // everything back in the middle. Measuring first and moving after leaves the zoom alone and
    // slides the picture up the screen.
    const need = this.framing(subjects, margin, target);
    target.addScaledVector(new THREE.Vector3(down.x, 0, down.z), FRAME_LIFT);
    return { target, need };
  }

  /**
   * Both characters, as framing subjects — and the cow once she is with them.
   *
   * She is in here rather than in each caller because from the rescue on she is one of the
   * subjects, wherever they go: she holds her gap on whichever side she came in from, and a frame
   * drawn round the pair alone cut her in half against the right edge of the farm shot.
   */
  private pairSubjects(): Array<{ x: number; z: number; height: number }> {
    const subjects = this.actions.map(({ pivot, height }) => ({
      x: pivot.position.x,
      z: pivot.position.z,
      height
    }));
    if (this.cow) {
      const { position, rotation } = this.cow.pivot;
      // Where she is HEADING for, not where she is: a frame is worked out the moment a beat
      // starts, and she is often still coming — so her live position mid-walk would open the shot
      // out to hold a cow who is about to be standing next to them anyway. Past her gap she
      // counts as being at it, on the side she is coming from.
      const mid = subjects.reduce((t, s) => ({ x: t.x + s.x / subjects.length, z: t.z + s.z / subjects.length }), { x: 0, z: 0 });
      const out = new THREE.Vector2(position.x - mid.x, position.z - mid.z);
      // joinGap plus its slack, because that slack is where she actually comes to rest whenever
      // the pair were still moving as she closed — which is every time.
      out.setLength(Math.min(out.length(), COW.joinGap + COW.settle));
      // And both ENDS of her, not one point: the others are people, near enough a point on the
      // ground, while she is a cow's length long — framed as a point her rump hung over the edge
      // of the shot. Which way that length lies is wherever she last walked.
      const reach = COW.length / 2;
      [reach, -reach].forEach((along) =>
        subjects.push({
          x: mid.x + out.x + Math.sin(rotation.y) * along,
          z: mid.z + out.y + Math.cos(rotation.y) * along,
          height: COW.height
        })
      );
    }
    return subjects;
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
          // Each model beds to its OWN depth — see BRIDGE.sink. The wreck meets the ground with
          // one post while the repaired span ramps down to it at both ends, so a single number
          // cannot sit both: whatever beds the wreck buries the deck the pair walks on.
          const sink = src === bridgeBrokenSrc ? BRIDGE.brokenSink : BRIDGE.sink;
          model.position.set(-centre.x, -box.min.y - sink, -centre.z);

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
          fallFrom: { x: number; z: number }, // trees topple away from this
          // How far over it ALREADY is, in degrees. 0 for anything still standing. The cow's
          // log is planted at COW_PEN.log.leanDeg, and the only thing that has to be true is
          // that the lean here and the `tilt` recorded below are the same number — chopTree
          // takes it off the 90 it has to travel, so a mismatch either snaps the trunk upright
          // on the first frame of the chop or drives it through the ground.
          leanDeg = 0
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

            // Lay it part-way over before anyone sees it, about the same axis the chop will
            // finish it on. Composed onto the yaw rather than replacing the rotation, exactly
            // as the topple does — assigning here would throw away the turn given above.
            const lean = THREE.MathUtils.degToRad(leanDeg);
            if (lean) {
              pivot.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, lean));
            }

            // Tap target, sized off the trunk rather than the canopy: a padded
            // canopy on a tree this size would swallow a third of the screen.
            // Measured AFTER the lean, so a trunk lying across the ground is caught along its
            // length rather than by the little circle its stump would have had.
            const stood = new THREE.Box3().setFromObject(pivot);
            const spread = stood.getSize(new THREE.Vector3());
            this.trees.push({
              pivot,
              // Standing, the tap sits at 0.45 of the way up. Leant over, that height is not
              // where the trunk IS any more — the middle of what it actually occupies is, and
              // for anything upright that comes back to the same place.
              centre: lean
                ? stood.getCenter(new THREE.Vector3())
                : new THREE.Vector3(pivot.position.x, height * 0.45, pivot.position.z),
              radius: (Math.max(spread.x, spread.z) / 2) * CHOP.hitPadding,
              top: stood.max.y,
              chopped: false,
              grove,
              axis,
              tilt: lean
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
        // The one tree in the cow's pen: the trunk lying across the mouth of it. It is the
        // whole beat — one tool choice, one chop, and the way out is open — where the four
        // standing trees it replaced were four of the same tap in a row.
        //
        // `fallFrom` is the far lip of the gap MIRRORED through the trunk's own base, because
        // plant lays a tree down along the bearing AWAY from what it is given. Handing it the
        // cow would drop the trunk radially outwards, pointing out of the opening instead of
        // lying across it, and a log parallel to the way out blocks nothing.
        const pen = cowPen();
        const across = {
          x: 2 * pen.log.base.x - pen.log.towards.x,
          z: 2 * pen.log.base.z - pen.log.towards.z
        };
        plant(
          'cow',
          COW_PEN.log.height,
          COW_STOP,
          [pen.log.base],
          10,
          { x: COW_STOP.x + across.x, z: COW_STOP.z + across.z },
          COW_PEN.log.leanDeg
        );
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

  /** They pull up at the pen. The shot opens on it and the trunk across it goes live. */
  private meetCow(): void {
    const pen = cowPen();
    const { right } = screenAxes();
    // The rocks NEAREST the pair, across the screen, and only COW_SHOT.framedRocks of them.
    // Fitting the shot to all of them fitted it to a group five units wide with the pair at
    // one end, which is what put two characters hard against the left edge of a portrait
    // frame — see COW_SHOT.margin for the arithmetic and framedRocks for the trade.
    const nearest = [...pen.rocks]
      .sort((a, b) => a.x * right.x + a.z * right.z - (b.x * right.x + b.z * right.z))
      .slice(0, COW_SHOT.framedRocks);
    const { target, need } = this.frameOn(
      [
        ...this.pairSubjects(),
        // Both ends of her, since she is longer than she is tall — see COW.length.
        ...[-0.5, 0.5].map((end) => ({
          x: COW_STOP.x + COW.offset.x + Math.sin(THREE.MathUtils.degToRad(COW.yawDeg)) * COW.length * end,
          z: COW_STOP.z + COW.offset.z + Math.cos(THREE.MathUtils.degToRad(COW.yawDeg)) * COW.length * end,
          height: COW.height
        })),
        ...nearest.map((o) => ({
          x: COW_STOP.x + o.x,
          z: COW_STOP.z + o.z,
          height: COW_PEN.size * 0.7 // a rock is wider than it is tall
        })),
        // The trunk, at both ends: it is lying down, so one point at its base says nothing
        // about the span it actually covers.
        ...[pen.log.base, pen.log.towards].map((o) => ({
          x: COW_STOP.x + o.x,
          z: COW_STOP.z + o.z,
          height: COW_PEN.log.height * 0.5
        }))
      ],
      COW_SHOT.margin
    );
    this.moveCamera(
      target,
      need,
      COW_SHOT.ease,
      () => {
        // Timber again, so the axe again — and the hammer is the wrong tool twice over, which
        // is the small joke of the beat now that she is penned in by STONE: the rocks are the
        // one thing here a hammer would be right for, and they are not what is in her way.
        // One trunk, one chop, and the way out is open.
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

    // With the celebration, so the sound and the bob are the same beat.
    sfx.play('cow');
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
   * The cow, once she is free: she keeps a cow's length off the pair for the rest
   * of the scene, walking to close a small gap and running to close a big one. So
   * she comes over when they are standing about, and she follows them to the
   * farmland without being told to.
   *
   * She aims at the pair themselves and holds joinGap off them, rather than at a
   * spot offset from them: since she only ever closes a gap and never yields, an
   * offset on their far side has her walk between the two of them to reach it and
   * pull up beyond — which is what "she walks past them" was — and one on her own
   * side just adds itself to the distance and parks her out at the frame edge.
   * Where she ends up is therefore whichever side she came in from, and the gap is
   * the one number that decides how close that is.
   *
   * The target is recomputed every frame off wherever the pair currently is, which
   * is why one effect covers both the joining and the following, and why it never
   * needs to know which leg of the sequence is running.
   */
  private followPair(cue = true): void {
    const cow = this.cow;
    if (!cow) return;

    const middle = new THREE.Vector3();
    // A skip has already put the pair where the cue would have sent them, so it
    // starts as though she had long since arrived.
    let joined = !cue;

    this.effects.push((delta: number) => {
      // Where the two of them are, which is what she walks at — see the note above for why it is
      // not a spot offset from them.
      middle.set(0, 0, 0);
      this.actions.forEach(({ pivot }) => middle.add(pivot.position));
      middle.divideScalar(Math.max(this.actions.length, 1));

      const toward = middle.clone().sub(cow.pivot.position).setY(0);
      // What is left to close, not how far off she is: at the gap she keeps this is 0, and it is
      // what both the gait and the step below are measured against.
      const close = toward.length() - COW.joinGap;
      const gait = close > COW.chase ? 'run' : close > COW.settle ? 'walk' : 'idle';
      this.setCowGait(gait);

      if (gait !== 'idle') {
        const speed = gait === 'run' ? COW.runSpeed : COW.walkSpeed;
        toward.normalize();
        // Clamped to `close`, so a fast frame cannot carry her past the gap she is meant to keep.
        cow.pivot.position.addScaledVector(toward, Math.min(speed * delta, close));
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

        // Against their own middle, as the real crossing does — and here it was already wrong
        // before the bridge moved: a skip runs from wherever they are standing, which is their
        // opening positions, and BOTH of those are on the same side of the bridge's centre line.
        // Both took side +1 and the skip put them in the same lane, one inside the other.
        const middleZ =
          this.actions.reduce((sum, entry) => sum + entry.pivot.position.z, 0) /
          Math.max(this.actions.length, 1);
        this.actions.forEach(({ pivot }) => {
          const side = Math.sign(pivot.position.z - middleZ) || 1;
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
    /**
     * `align`, when given, replaces yawDeg: it turns the model so its LONGEST horizontal side
     * runs along that heading, whatever the model's own authored front happens to be.
     *
     * The extension's lots need that. The core's entries carry the reference's own rotations
     * and are left alone, but generated lots have nothing to copy, and the rule they used —
     * "the models front along +Z" — is simply not true: each of these was authored facing a
     * different way, so a third of the street came out square to its own plot. A building's
     * long side is its ridge, and a ridge parallel to the road is what reads as a street; the
     * measurement is already being taken here to scale the thing.
     */
    const place = (
      src: string,
      at: { x: number; z: number },
      maxDim: number,
      yawDeg: number,
      flip: boolean,
      onReady?: (pivot: THREE.Group) => void,
      align?: number
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
          // A model whose long side is its local X needs a further quarter turn to lay that
          // side along `align`; one whose long side is Z is already there.
          pivot.rotation.y = THREE.MathUtils.degToRad(
            align === undefined ? yawDeg : align + (size.x > size.z ? 90 : 0)
          );
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
      place(
        b.src,
        villageAt(b.at),
        b.size * EXPANSION.scale,
        b.yawDeg,
        // flipY, and it is a property of where the model CAME FROM: anything through
        // scripts_fbx2glb.mjs keeps its FBX's UV orientation, the farm's own GLBs do not.
        // The farmhouse and the sheep home are the two here from that pipeline.
        b.src === farmhouseSrc || b.src === sheepHomeSrc,
        undefined,
        b.align
      )
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
        (pivot) => this.idle(pivot),
        truck.align
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
    // On the move starting, so it runs under the pull-back rather than landing after it. The
    // two are matched now: the clip is 0.83s and EXPANSION.ease is 0.8, so it covers the travel
    // exactly instead of the move outlasting it by a second and a half.
    sfx.play('cameraPull');
    // The one move in the ad that gets motion blur. It is the fastest and by far the longest
    // travel — the barn out to the whole island in 0.8s — and it is the only one where the
    // speed is the point rather than a way of getting to the next beat. See MOTION_BLUR.
    this.motionBlur = true;
    this.moveCamera(
      new THREE.Vector3(EXPANSION.centre.x, CAMERA_FOLLOW.aimHeight, EXPANSION.centre.z),
      EXPANSION.frame,
      EXPANSION.ease,
      () => {
        // Off with the move. The blur has already faded to nothing on its own — it is read from
        // the camera, which is easing to a stop — so this is only making sure nothing is left
        // on the canvas afterwards.
        this.motionBlur = false;

        // The line lands on the SETTLED wide shot, not on the move — it is the caption for
        // what the pull-back just revealed, and said at the start of it the player was reading
        // words about a thing that had not finished sliding into view. Now: the island opens
        // out, then the line, then the buttons over the top of it.
        //
        // What it must not do is still be up when they arrive. It is a sprite in the WebGL
        // canvas and the CTA is DOM at zIndex 19 — see showUpgradeChoice, which takes it down.
        this.say(SPEECH_LINES.expand, EXPANSION.cta.hold);
        // The three upgrades to choose from. There were also arrows planted over the village
        // itself, one per opportunity; they are gone — the ones on the buttons are what the
        // player has to follow, and a second set in the world only competed with them.
        this.wait(EXPANSION.cta.delay, () => void this.showUpgradeChoice());
      }
    );
  }

  /** Off to the empty plots, down-screen and away from the felled stand. */
  private walkToFarm(): void {
    this.afterRun = () => this.chooseCrop();
    // Come out of the cow beat's frame as they set off. That shot is the widest in the ad —
    // it holds a pen standing three and a half units away — and the follow would otherwise
    // carry it the whole way to the farmland, which is the length of the walk spent looking
    // at two characters from across a field. See travelFrame.
    //
    // PORTRAIT ONLY. Landscape is handed the frame it already has, which is what makes this a
    // no-op there: the pair is the box for that orientation, so nothing eases and nothing
    // changes. It still goes through the pair rather than through an `if`, because that is
    // what survives the phone being turned mid-walk — needFor holds both boxes and resize
    // re-resolves, so a turn into landscape gives back the wide frame and a turn into portrait
    // takes it away again.
    this.easeFrame({ portrait: travelFrame(), landscape: { ...this.need } }, TRAVEL_EASE);
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
    // Once for the field, not once per plot: the sixteen beds come up FARM.stagger apart, and
    // sixteen copies of the same rustle would be a burst of noise rather than a crop growing.
    sfx.play('crop');
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
    // On the axe going in, not on the tree landing: the hit is what the player just did, and the
    // fall takes another second and a half to play out.
    sfx.play('chop');

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
          // The trunk hitting the grass. Fired HERE rather than off a timer set when the chop
          // started, so it stays with the impact whatever CHOP.fall is retuned to — and in the
          // same branch as the dust and the leaves, because all three are the one event.
          sfx.play('treeLand');
          // Dust, thrown up along the length of the trunk where it hit.
          const along = tree.pivot.position
            .clone()
            .addScaledVector(
              new THREE.Vector3(-axis.z, 0, axis.x).normalize(), // the way it fell
              CHOP.dustAlong * (tree.grove === 'cow' ? COW_PEN.log.height : TREES.height)
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

    // With the smoke, not in the callback below: that one fires once the smoke has CLEARED, a
    // second and a half after the span actually appears, which is too late to be the sound of it
    // being built.
    sfx.play('bridge');

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

    // With the smoke, for the same reason the bridge's is: the callback below fires once it has
    // cleared, which is after the barn is already standing.
    sfx.play('barn');

    this.swapUnderSmoke(
      barn.broken,
      barn.repaired,
      new THREE.Vector3(barn.repaired.position.x, BARN.height * 0.4, barn.repaired.position.z),
      BARN.poof,
      BARN.repair,
      1,
      () => {
        // Held until just before the shot pulls back, rather than for a flat 4s that ran on
        // over the whole reveal. Two things were wrong with that: the island opening out is the
        // one image the ad is selling and it had a caption sitting across the top of it, and
        // the caption is a sprite INSIDE the canvas, so the motion blur on that move blurred
        // the words along with the world. Measured off EXPANSION.delay so it stays ahead of the
        // move if that is retuned; the 0.45 is the bubble's own shrink (SPEECH.pop) and a beat.
        this.say(SPEECH_LINES.barnFixed, EXPANSION.delay - 0.45);
        // ...and then the shot pulls back off it, which is where the playable ends.
        this.wait(EXPANSION.delay, () => this.expansionMoment());
      }
    );
  }


  /**
   * Put a line across the top of the screen, telling the player what to do.
   *
   * @param hold seconds to stay up; 0 leaves it until the next line replaces it
   */
  private say(text: string, hold = SPEECH.hold): void {
    // The FONT has to be there before a bubble can be drawn: it is baked into a canvas,
    // which takes whatever font is loaded at that instant and cannot be re-flowed
    // afterwards. The first line goes up early enough for this to matter.
    if (!this.fontReady) {
      this.effects.push(() => {
        if (!this.fontReady) return true;
        this.showSpeech(text, hold);
        return false;
      });
      return;
    }

    this.showSpeech(text, hold);
  }

  /** Draw the line into the bubble and pin it across the top of the frame. */
  private showSpeech(text: string, hold: number): void {
    this.hideSpeech(); // one at a time

    // The box is placed along the CAMERA's axes rather than the world's: a sprite always
    // faces the camera, and the shot is isometric, so world up would slide it off the top
    // of the frame. The orientation never changes, so these are taken once.
    this.camera.updateMatrixWorld();
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);

    // The canvas is the box plus room for its shadow to spread, so the blur is not clipped
    // at the edges. The box is centred in it; the shadow is offset DOWN inside that margin.
    const { width: boxW, height: boxH, radius } = SPEECH.box;
    const bleed = SPEECH.shadow.blur + SPEECH.shadow.drop;
    const canvas = document.createElement('canvas');
    canvas.width = boxW + bleed * 2;
    canvas.height = boxH + bleed * 2;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = SPEECH.fill;
    ctx.shadowColor = SPEECH.shadow.colour;
    ctx.shadowBlur = SPEECH.shadow.blur;
    ctx.shadowOffsetY = SPEECH.shadow.drop;
    ctx.beginPath();
    ctx.roundRect(bleed, bleed, boxW, boxH, radius);
    ctx.fill();
    ctx.shadowColor = 'transparent'; // the words are flat on the box, not floating over it

    ctx.fillStyle = SPEECH.colour;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shrink until the longest line clears the padding. A size set by eye breaks the moment
    // anyone edits a line — every one of the lines below overran the box at the size that
    // looked right on paper.
    const lines = text.split('\n');
    const maxWidth = boxW * (1 - SPEECH.padding.x * 2);
    const maxHeight = boxH * (1 - SPEECH.padding.y * 2);
    let size = SPEECH.fontSize;
    while (size > 8) {
      ctx.font = `bold ${size}px ${SPEECH.fontStack}`;
      const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
      if (widest <= maxWidth && lines.length * size * SPEECH.lineSpacing <= maxHeight) break;
      size -= 1;
    }

    const step = size * SPEECH.lineSpacing;
    lines.forEach((line, i) => {
      ctx.fillText(
        line,
        canvas.width / 2,
        bleed + boxH / 2 + (i - (lines.length - 1) / 2) * step
      );
    });

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
    this.scene.add(sprite);
    this.speech = sprite;
    // Counted, not just referenced. `speech` is cleared the moment a line is REPLACED, while
    // the sprite it pointed at is still shrinking away for another SPEECH.pop — so it cannot
    // answer "is there a bubble on the screen", which is what the motion blur has to ask.
    this.speechDrawn++;

    let elapsed = 0;
    let open = 0; // how far the spring got before anything closed it
    let shut = 0; // seconds into the shrink, once something has closed it
    let closing = false;
    this.effects.push((delta: number) => {
      elapsed += delta;

      // Sized and placed off the FRUSTUM every frame, not once: the camera zooms and pans
      // between beats, and anything measured in world units at spawn shrinks and drifts with
      // it. The frustum is orthographic, so its half-extents ARE world distances, and
      // cameraTarget is what the camera looks at — that point is the centre of the screen.
      const halfH = (this.camera.top - this.camera.bottom) / 2;
      const wide = this.width > this.height;
      const width = this.frameMin() * (wide ? SPEECH.landscapeWidth : SPEECH.screenWidth);
      const height = (width * canvas.height) / canvas.width;

      if (this.speech !== sprite) closing = true; // a newer line took over
      if (hold > 0 && elapsed > hold) closing = true;

      // Springs open, then shrinks away. `pop` scales the sprite about its own centre, which
      // is why the position below is worked out from the full-size height: the box keeps its
      // place on screen while it grows into it, instead of sliding up as it does. The shrink
      // starts from whatever the spring had reached, so a line replaced before it finished
      // opening closes from there rather than snapping out to full size first.
      if (!closing) open = easeOutBack(Math.min(elapsed / SPEECH.pop, 1));
      else shut += delta;
      const pop = open * (closing ? 1 - Math.min(shut / SPEECH.pop, 1) : 1);

      // Fading with the same number, so the box cannot be caught half-drawn at full opacity.
      material.opacity = Math.min(pop, 1);
      sprite.scale.set(width * pop, height * pop, 1);
      sprite.position
        .copy(this.cameraTarget)
        .addScaledVector(up, halfH - height / 2 - halfH * SPEECH.topGap);

      if (pop > 0) return true;

      sprite.removeFromParent();
      material.dispose();
      texture.dispose();
      this.speechDrawn--;
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

    // Once for the break, not once per rock: three of them come apart together (see spread),
    // and three copies of the same crack a frame apart reads as a stutter rather than as stone.
    sfx.play('stones');

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
  /**
   * The frame's shorter side in world units — the world's own "vmin", and what anything
   * meant to hold its size ON SCREEN is measured in. The frustum is orthographic, so its
   * extents ARE world distances. Sizing off the WIDTH instead is the trap: this ad frames
   * landscape about twice as wide as portrait, so a width-relative thing doubles on a
   * rotation and a fixed world size halves.
   */
  private frameMin(): number {
    return Math.min(this.camera.right - this.camera.left, this.camera.top - this.camera.bottom);
  }

  private updateCamera(): void {
    const aspect = this.width / this.height;
    const halfW = Math.max(this.need.w, this.need.h * aspect) * (aspect < 1 ? PORTRAIT_ZOOM : 1);
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
    this.blurWithMotion(delta);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Blur the canvas by however fast the camera is moving — on the ONE move that asks for it.
   *
   * The strength is measured off the camera rather than written down, so the expansion move can
   * be retuned and its blur follows; what is not automatic is WHICH move gets it. Every reframe
   * in the ad travels far enough to blur, and blurring all of them made the whole thing soft
   * every time the shot changed. expansionMoment switches it on for the pull-back and off at
   * the end of it, and nothing else ever does.
   *
   * The two are one number by the time they reach the screen. A pan of `d` world units across a
   * frustum `W` wide shifts the picture d/W of a half-screen; a zoom from W to W' does the same
   * to whatever sits at the edge of it. Both are converted to PIXELS travelled this frame,
   * which is exactly the length of the smear a real camera would have recorded.
   *
   * What this is NOT is a per-pixel directional blur: CSS gives an even blur in all directions,
   * so this is a defocus scaled by speed rather than a smear along the path. Over 0.8s of a
   * shot travelling that far it reads as motion; it would not stand up on a slow pan, which is
   * one more reason it is on that move alone.
   */
  private blurWithMotion(delta: number): void {
    if (!MOTION_BLUR.enabled || delta <= 0) return;
    // Off unless the expansion pull-back asked for it — and never while there is UI in the
    // canvas. The speech bubble and the pointing hand are SPRITES in this scene, not DOM, so a
    // filter on the canvas blurs the words along with the world; a caption running over the
    // pull-back came out smeared. The line is now timed to clear before the move (see
    // repairBarn), and this is the backstop that stops it happening again to a bubble nobody
    // thought about.
    if (!this.motionBlur || this.speechDrawn > 0 || this.tapHint) {
      // Whatever the last frame of the move left on the canvas has to come off, and only once —
      // the guard is the empty string, so this costs one comparison for the rest of the ad.
      if (this.blurNow !== '') {
        this.blurNow = '';
        this.renderer.domElement.style.filter = '';
      }
      return;
    }

    const halfW = (this.camera.right - this.camera.left) / 2;
    const pixels = this.width / 2; // half the canvas, in the same terms as halfW
    // Nothing to compare against yet — the first frame, or the first after a resize, which
    // changes the frustum without the camera having moved at all. Take the reading and wait;
    // measuring against a zero would blur the opening frame as though it had flown in.
    if (this.lastHalfW === 0) {
      this.lastAim.copy(this.cameraTarget);
      this.lastHalfW = halfW;
      return;
    }
    const moved = this.cameraTarget.distanceTo(this.lastAim) / halfW;
    // Relative, so a zoom is measured by how much of the frame it swept rather than by world
    // units — the same 1-unit change is a big move on a tight shot and nothing on a wide one.
    const zoomed = Math.abs(halfW - this.lastHalfW) / halfW;
    this.lastAim.copy(this.cameraTarget);
    this.lastHalfW = halfW;

    // Per frame, then put on a per-second footing and back again at a fixed 60, so the blur is
    // the same on a phone dropping frames as on one holding 60 — otherwise a slow device, which
    // travels further per frame, would blur harder for being slow.
    const travelled = (moved + zoomed) * pixels * (1 / 60 / delta);
    const blur = Math.min(travelled * MOTION_BLUR.scale, MOTION_BLUR.max);
    const want = blur < MOTION_BLUR.min ? '' : `blur(${blur.toFixed(2)}px)`;
    // Only when it changes: assigning a style every frame is a layout invalidation the
    // compositor does not need, and the value is unchanged for most of the ad.
    if (want !== this.blurNow) {
      this.blurNow = want;
      this.renderer.domElement.style.filter = want;
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
    // A rotation changes WHICH box the beat wanted, not just how the frustum is derived from
    // it. Snapped rather than eased: the screen has just flipped, so there is nothing to ease
    // from. Beats framed off their own subjects have no pair and are unaffected.
    if (this.needFor) {
      const want = this.resolveNeed(this.needFor);
      this.need.w = want.w;
      this.need.h = want.h;
    }
    this.updateCamera();
    // The frustum has just changed size without the camera having gone anywhere. Drop the
    // motion-blur baseline so the next frame re-reads it instead of billing the rotation as a
    // zoom and blurring the first frame of the new orientation.
    this.lastHalfW = 0;
    // ...and the spotlights are projected world positions, so every one of them has just moved.
    if (this.ctaShade instanceof HTMLCanvasElement) this.paintShade(this.ctaShade);
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
    this.ctaShade?.remove();
    this.brand?.remove();
    this.ctaTitle?.remove();
    window.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
