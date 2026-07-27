// Clean standalone island scene: just the grass island, sandy beach, and toon
// water, viewed through a true ORTHOGRAPHIC ISOMETRIC camera. Because the camera
// is orthographic, the water reads as an even border on every side of the island
// (no perspective horizon), which is the classic Hay Day / FarmVille map look.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { createIslandWater } from '../three/IslandWater.js';
import grassTextureSrc from 'assets/images/Ground3.jpg';
// Webpack cannot inline a raw .fbx (no mimetype for it), and a playable has to
// build to one self-contained file — so the model ships as a base64 data URI,
// regenerated with `node scripts_fbx2base64.mjs assets/models/B_Boat.fbx`.
import boatSrc from 'assets/models/B_Boat.fbx.js';
import boatTextureSrc from 'assets/images/Buildings.jpg';

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

// Measured from B_Boat.fbx: its vertices run Y -96.8 .. +184.7, but everything
// above roughly +20 is mast and cabin — the wide hull is only the bottom ~41%.
// The waterline has to be computed against the hull alone, or the boat sinks to
// its gunwales.
const BOAT_HULL_FRACTION = 0.41;

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

    // Beach skirt + toon water, centered on the island. viewRadius tells the
    // water how much world is on screen so its blobs and foam scale with the
    // zoom — without it a tight FIT_RADIUS frames less than a single feature.
    this.water = createIslandWater({
      islandHalf: ISLAND_HALF,
      viewRadius: FIT_RADIUS
    });
    this.scene.add(this.water.group);

    this.startMs = performance.now();
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
    // ourselves. flipY/sRGB match how the rest of the farm models are textured.
    const texture = new THREE.TextureLoader().load(boatTextureSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;

    new FBXLoader().load(
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

        const pivot = new THREE.Group();
        pivot.name = 'boat';
        pivot.add(model);
        pivot.position.set(BOAT.x, WATER_Y, BOAT.z);
        pivot.rotation.y = THREE.MathUtils.degToRad(BOAT.yawDeg);
        this.scene.add(pivot);
      },
      undefined,
      (err: unknown) => console.error('Boat model failed to load:', err)
    );
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
    this.water.update((performance.now() - this.startMs) / 1000);
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
    this.rafId = requestAnimationFrame(this.animate);
  }

  public destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
