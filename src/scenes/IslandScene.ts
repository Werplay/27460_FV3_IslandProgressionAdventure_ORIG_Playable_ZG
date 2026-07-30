// Clean standalone island scene: just the grass island, sandy beach, and toon
// water, viewed through a true ORTHOGRAPHIC ISOMETRIC camera. Because the camera
// is orthographic, the water reads as an even border on every side of the island
// (no perspective horizon), which is the classic Hay Day / FarmVille map look.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createIslandWater } from '../three/IslandWater.js';
import grassTextureSrc from 'assets/images/Ground3.jpg';
// Webpack cannot inline a raw .fbx (no mimetype for it), and a playable has to
// build to one self-contained file — so the model ships as a base64 data URI,
// regenerated with `node scripts_fbx2base64.mjs assets/models/B_Boat.fbx`.
import boatSrc from 'assets/models/B_Boat.fbx.js';
import boatTextureSrc from 'assets/images/Buildings.jpg';
import merrySrc from 'assets/models/Merry-Anim.fbx.js';
import merryTextureSrc from 'assets/images/C_Merryweather_Classic.jpg';
import hipsterSrc from 'assets/models/Hipster-Anim.fbx.js';
import hipsterTextureSrc from 'assets/images/C_Hipster_Classic.jpg';
import rubbleSrc from 'assets/models/Rubble_Rock_gray.fbx.js';
// The rock's material is Vegetation_B, so it reads its colour off the vegetation
// atlas — one flat 0.02-wide patch of it, not a painted rock.
import rubbleTextureSrc from 'assets/images/Vegetation.png';
// A .glb webpack CAN inline, so this one needs no base64 step. It takes its
// colour from the buildings atlas, same as the boat.
import pathSrc from 'assets/models/Rubble_path.glb';
import pointerSrc from 'assets/images/PointerHand.png';

const ISLAND_SIZE = 25; // grass land width/depth
const ISLAND_HEIGHT = 2;
const ISLAND_HALF = ISLAND_SIZE / 2;
const FIT_RADIUS = 3; // world radius kept in frame (island + water margin)
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

// Tapping the rock at the PEAK of the arc breaks it open and leaves a path
// through the gap. That one rock is the only interactive thing in the scene —
// the other six are scenery.
const RUBBLE_BREAK = {
  // Which rock takes the tap: the one sitting at arcCentreDeg, i.e. the middle
  // of the run. An even count has no exact middle, so this rounds to the nearer.
  index: Math.round((RUBBLE.count - 1) / 2),
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
const RUN_FADE = 0.25; // seconds of crossfade from idle into the run

// The path left behind once the rock is gone.
const RUBBLE_PATH = {
  size: 1.6, // widest horizontal dimension, world units
  yawOffsetDeg: 0, // it lies square across the arc's radius; turn it from there
  delay: 0.12, // seconds after the tap before it starts to show
  grow: 0.35, // seconds to swell into place
  lift: 0.004 // held a hair above the grass so the two cannot z-fight
};

// The characters' midpoint, which the arc is built around.
const RUBBLE_CENTRE = {
  x: CHARACTERS.reduce((sum, c) => sum + c.x, 0) / CHARACTERS.length,
  z: CHARACTERS.reduce((sum, c) => sum + c.z, 0) / CHARACTERS.length
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
  private breakable?: {
    pivot: THREE.Group;
    rock: THREE.Object3D;
    centre: THREE.Vector3;
    radius: number;
    angle: number;
    broken: boolean;
  };
  private path?: THREE.Group; // loaded up front, hidden until the rock breaks
  // Both clips per character, so the break can hand over from one to the other.
  private actions: Array<{
    key: string;
    idle: THREE.AnimationAction;
    run: THREE.AnimationAction;
  }> = [];
  private tapHint?: THREE.Sprite;

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

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, CAM_NEAR, CAM_FAR);
    this.camera.position.copy(ISO_DIR).multiplyScalar(CAM_DISTANCE).add(PAN_VEC);
    this.camera.lookAt(PAN_VEC);
    this.updateCamera();

    this.addLights();
    this.addIsland();
    this.addBoat();
    this.addCharacters();
    this.addRubble();
    this.addPath();

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
      viewRadius: FIT_RADIUS
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

    const grass = new THREE.MeshStandardMaterial({ map: texture, color: GRASS_TINT, roughness: 1 });
    const side = new THREE.MeshStandardMaterial({ color: 0x3f9a2b, roughness: 1 }); // darker green cliff

    // BoxGeometry material order: [ +x, -x, +y(top), -y(bottom), +z, -z ].
    const geometry = new THREE.BoxGeometry(ISLAND_SIZE, ISLAND_HEIGHT, ISLAND_SIZE);
    const island = new THREE.Mesh(geometry, [side, side, grass, side, side, side]);
    island.position.y = -ISLAND_HEIGHT / 2; // grass top sits at y = 0
    this.scene.add(island);
  }

  /**
   * Boat moored on the shore. Loaded asynchronously, so it pops in a frame or
   * two after the scene — harmless here because the intro covers the start.
   */
  private addBoat(): void {
    // The FBX names an absolute Buildings.png from the authoring machine, which
    // cannot resolve in a bundle, so we bind the project's copy of that atlas
    // ourselves.
    //
    // Leave flipY at its default (true): this model's UVs use the FBX/OpenGL
    // bottom-left origin, and the atlas is mostly empty black space. Forcing
    // flipY = false (the convention the GLB path in LoadBase64Textures uses)
    // drops about a third of the hull's surface onto that black area and lands
    // the rest on the wrong tiles.
    const texture = new THREE.TextureLoader().load(boatTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // Without this the loader still fires a request for that absolute path and
    // eats a 404 before we get to swap the material — a playable must not hit
    // the network at all, so point it at the bundled atlas instead.
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url: string) =>
      /buildings\.(png|jpg)$/i.test(url) ? boatTextureSrc : url
    );

    new FBXLoader(manager).load(
      boatSrc,
      (model: THREE.Group) => {
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
        model.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
        });

        // FBX is authored in its own units (this one is ~396 long), so rather
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
    const loader = new FBXLoader();

    CHARACTERS.forEach((character) => {
      const texture = new THREE.TextureLoader().load(character.texture);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

      loader.load(
        character.model,
        (model: THREE.Group) => {
          // Same story as the boat: the FBX points at a texture path from the
          // authoring machine, so the bundled atlas is bound here instead. flipY
          // stays at its default for the same reason it does there.
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

          const take = model.animations[0];
          if (take) {
            const mixer = new THREE.AnimationMixer(model);
            const idle = mixer.clipAction(cutClip(take, `${character.key}-idle`, character.idle));
            const run = mixer.clipAction(cutClip(take, `${character.key}-run`, character.run));
            idle.play();
            this.mixers.push(mixer);
            this.actions.push({ key: character.key, idle, run });
          } else {
            console.warn(`${character.key}: FBX carries no baked animation take`);
          }

          const pivot = new THREE.Group();
          pivot.name = character.key;
          pivot.add(model);
          pivot.position.set(character.x, 0, character.z);
          pivot.rotation.y = THREE.MathUtils.degToRad(character.yawDeg);
          this.scene.add(pivot);
        },
        undefined,
        (err: unknown) => console.error(`${character.key} model failed to load:`, err)
      );
    });
  }

  /**
   * The semi-circle of rubble around the characters. One FBX is loaded and then
   * cloned per rock, so all seven share the geometry and the material and cost
   * little more than one.
   */
  private addRubble(): void {
    const texture = new THREE.TextureLoader().load(rubbleTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    new FBXLoader().load(
      rubbleSrc,
      (source: THREE.Group) => {
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
              pivot,
              rock,
              centre: hitBox.getCenter(new THREE.Vector3()),
              radius: (Math.max(hitSize.x, hitSize.y, hitSize.z) / 2) * RUBBLE_BREAK.hitPadding,
              angle,
              broken: false
            };
            this.renderer.domElement.style.cursor = 'pointer';
          }
        }

        this.scene.add(group);
        this.addTapHint(); // needs the breakable rock, which only exists now
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
  private addTapHint(): void {
    if (!this.breakable) return;

    const texture = new THREE.TextureLoader().load(pointerSrc);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthTest: false, // it is UI: nothing in the scene may cover it
        depthWrite: false
      })
    );
    sprite.scale.setScalar(TAP_HINT.size);
    sprite.renderOrder = 999;

    // Screen-right comes off the camera's own X axis, since world X points
    // diagonally at this yaw. The camera never moves, so this is read once —
    // but its world matrix is only refreshed by a render, and this runs off a
    // load callback that can beat the first frame.
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);

    // The hand points UP with its fingertip at the top edge of the image, so
    // the sprite hangs half its own height below wherever that tip should land
    // — offsetY is the tip's clearance over the rock, not the sprite's.
    const top = new THREE.Box3().setFromObject(this.breakable.pivot).max.y;
    const base = new THREE.Vector3(
      this.breakable.centre.x,
      top + TAP_HINT.offsetY - TAP_HINT.size / 2,
      this.breakable.centre.z
    ).addScaledVector(right, TAP_HINT.offsetX);
    sprite.position.copy(base);

    this.scene.add(sprite);
    this.tapHint = sprite;

    let elapsed = 0;
    this.effects.push((delta: number) => {
      elapsed += delta;
      if (elapsed < TAP_HINT.delay) return true;

      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity = Math.min((elapsed - TAP_HINT.delay) / TAP_HINT.fade, 1);

      // Two presses per cycle: one at the top of it, one TAP_HINT.gap later,
      // then the rest of the cycle is the rest between them.
      const beat = (elapsed - TAP_HINT.delay) % TAP_HINT.cycle;
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

  /** Hand both characters from their idle into the run, once the way is open. */
  private startRunning(): void {
    this.actions.forEach(({ run, idle }) => {
      run.reset();
      run.setLoop(THREE.LoopRepeat, Infinity);
      run.play();
      // The two poses are far apart (about 20 units of summed bone delta), so
      // this has to be a blend — cutting straight to the run snaps visibly.
      run.crossFadeFrom(idle, RUN_FADE, false);
    });
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

  /** A tap anywhere within the breakable rock's catchment sets it off. */
  private onPointerDown = (event: PointerEvent): void => {
    if (!this.running || !this.breakable || this.breakable.broken) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    // The camera is ORTHOGRAPHIC, so every ray runs parallel and the world has
    // one uniform scale on screen. That makes the ray's distance to the rock's
    // centre exactly the miss distance as the player sees it — a plain round
    // tap target, with no mesh intersection to snag on a gap between chunks.
    if (this.raycaster.ray.distanceToPoint(this.breakable.centre) > this.breakable.radius) return;

    this.breakRubble();
  };

  /**
   * Break the tapped rock: it shrinks away, throws a handful of chunks that
   * arc out and land, and the path swells up in the gap it leaves.
   */
  private breakRubble(): void {
    if (!this.breakable || this.breakable.broken || !this.rubbleMaterial) return;

    const { pivot, rock, angle } = this.breakable;
    this.breakable.broken = true;
    this.renderer.domElement.style.cursor = '';
    this.hideTapHint();
    this.startRunning();

    // Debris shares one clone of the rock material: cloned so fading it cannot
    // drag the six standing rocks down with it, shared so the fade is one write.
    const material = this.rubbleMaterial.clone();
    material.transparent = true;

    // Chunks leave from mid-rock rather than from the ground, so the burst
    // reads as the rock coming apart instead of erupting out of the grass.
    const rockHeight = new THREE.Box3().setFromObject(pivot).getSize(new THREE.Vector3()).y;

    const chunks = Array.from({ length: RUBBLE_BREAK.debris }, (_, i) => {
      const chunk = rock.clone(true);
      chunk.scale.multiplyScalar(RUBBLE_BREAK.debrisScale);
      chunk.position.multiplyScalar(RUBBLE_BREAK.debrisScale); // keep it centred as it shrinks
      chunk.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
      });

      // Thrown evenly around the compass, with the speeds varied per chunk so
      // they do not travel as one ring.
      const heading = (i / RUBBLE_BREAK.debris) * Math.PI * 2;
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

      // Fade only over the last stretch, so the chunks are solid while in flight.
      const fade = (elapsed - RUBBLE_BREAK.shatter * 0.6) / (RUBBLE_BREAK.shatter * 0.4);
      material.opacity = 1 - THREE.MathUtils.clamp(fade, 0, 1);

      if (elapsed < RUBBLE_BREAK.shatter) return true;

      chunks.forEach(({ holder }) => this.scene.remove(holder));
      material.dispose();
      pivot.removeFromParent();
      return false;
    });

    this.growPath(angle);
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

  /** Orthographic frustum that fits FIT_RADIUS on any aspect ratio. */
  private updateCamera(): void {
    const aspect = this.width / this.height;
    const halfH = FIT_RADIUS / Math.min(1, aspect);
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
    this.effects = this.effects.filter((effect) => effect(delta));
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
