// The tool swings, checked against the real models. Four things here are invisible in code
// review and glaring on screen, which is the worst combination:
//
//   1. WHICH PART LANDS. A hammer's head is a flat face one side and a claw the other, an
//      axe's is a bit and a poll, and the butt of the handle is below the hand on both. Hung
//      head-down a tool lands on its crown; tipped past about 22 degrees off flat it lands on
//      the BUTT. Only a near-horizontal handle, rolled the right way up, puts the face in.
//   2. WHERE THE HAND IS. The grip is worked back from the landing spot, so it is easy to move
//      the head between stations while the tool itself pivots on one point.
//   3. WHAT THE TRAVEL DOES between stations: with two poses either side of a target, a flat
//      carry drags the head straight through it.
//   4. WHETHER IT IS IN FRAME. The stone sits 1.82 right of the opening shot's centre and the
//      portrait half-width is 2.45 — there is 0.63 of room that side and no more.
//
//   node scratch-tool-swing.mjs
import assert from 'assert';
import * as THREE from 'three';
import { readFileSync } from 'fs';

// three's FBXLoader reaches for browser globals; these are the only ones it touches for a
// model with no embedded textures. (The same shims scripts_fbx2glb.mjs uses.)
globalThis.self = globalThis;
globalThis.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 };
globalThis.document = {
  createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, getContext: () => ({}) }),
  createElementNS: () => ({ style: {}, setAttribute() {}, addEventListener() {} })
};
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

// --- TOOLS / TOOL_SWING, as IslandScene has them ---------------------------
const RAISE = THREE.MathUtils.degToRad(75);
const QUICK_RAISE = 0.55; // how far back the second hit of each pair snaps
const CARRY = 0.35;
const DROP = 0.06;

const BEATS = [
  {
    what: 'hammer on the stone',
    model: 'assets/models/props/hammer.fbx',
    length: 0.85,
    plane: 'screen', // it comes down the frame onto a rock lying on the ground
    // One target, hit twice either side of its top.
    stations: [
      { handleDeg: -35, across: 0.26, drop: 0, side: 1 },
      { handleDeg: -5, across: -0.26, drop: DROP, side: -1 }
    ],
    // The stone is the tight one for framing: it sits well right of centre in the opening shot.
    onScreen: 1.82,
    sameTarget: true // both stations work the one rock, so they can foul each other
  },
  {
    what: 'axe on the stand',
    model: 'assets/models/props/axe.fbx',
    length: 1.05,
    // Swung in the GROUND plane, which is the only pose where the handle is square to a
    // standing trunk AND the edge goes into its side. handleDeg is a heading here, not a tilt.
    plane: 'ground',
    // One station per tree, alternating sides. Three trees in the wood grove.
    stations: [0, 1, 2].map((i) => ({
      handleDeg: 0,
      across: 0,
      drop: 0,
      side: i % 2 ? -1 : 1
    })),
    // The stand is framed by the arrival pull-back, which is wider and centred on it.
    onScreen: 0.6,
    sameTarget: false // a station per TREE, metres apart — they cannot foul each other
  },
  {
    what: 'axe on the fallen log',
    model: 'assets/models/props/axe.fbx',
    length: 1.05,
    // The log across the mouth of the cow's pen is already down, at 72 degrees. A level sweep
    // would come in ALONG it, so this one is chopped the way the stone is: down the frame.
    plane: 'screen',
    stations: [{ handleDeg: -35, across: 0, drop: 0, side: 1 }],
    onScreen: 0.6,
    sameTarget: false // there is only one: the log IS the beat
  }
];

// How far the butt of the handle has to hang above whatever the tool lands on. "The face is
// the lowest point" is not enough on its own: laid flat the face wins by 0.09 of a unit, the
// tool sits level across the target and it reads as dropped on its end rather than swung.
const BUTT_CLEAR = 0.25;
const HALF_WIDTH = 2.45; // portrait, world units either side of the shot's centre

// --- the camera every swing is laid out on ---------------------------------
const camera = new THREE.OrthographicCamera(-HALF_WIDTH, HALF_WIDTH, 4.35, -4.35, 0.1, 600);
camera.position.set(10, 12, 10); // the ad's isometric view
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);
const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
const toCamera = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);

for (const beat of BEATS) {
  // The plane the swing is laid out on, exactly as swingTool builds it: `right` is where the
  // handle points at angle 0, `up` is the way the head is raised, and the swing turns about
  // their normal.
  const ground = beat.plane === 'ground';
  const right = ground ? screenRight.clone().setY(0).normalize() : screenRight.clone();
  const up = ground
    ? new THREE.Vector3(0, -1, 0).cross(right).normalize()
    : new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  // --- the model, and which end of its head is which ------------------------
  // Measured, not assumed — and measured on the right thing. Looking for a FORK gets a claw
  // hammer backwards: the claw's tip is solid across its width, so it reads as "not forked"
  // and the rig then lays the claw downward, which is what shipped once. What separates the
  // ends is THICKNESS. A claw or a bit tapers to a blade a unit or two thick; the face and the
  // poll behind it are blocks many times that.
  const file = readFileSync(beat.model);
  const source = new FBXLoader().parse(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    ''
  );
  let mesh;
  source.traverse((child) => {
    if (child.isMesh) mesh = child;
  });
  const position = mesh.geometry.attributes.position;

  const bounds = new THREE.Box3().setFromObject(source);
  const HEAD_FROM = bounds.min.y + (bounds.max.y - bounds.min.y) * 0.7; // where the head starts
  const tipThickness = (sign) => {
    const head = [];
    for (let i = 0; i < position.count; i++) {
      const [x, y] = [position.getX(i), position.getY(i)];
      if (y > HEAD_FROM && Math.sign(x) === sign) head.push([x, y]);
    }
    const reach = Math.max(...head.map((v) => Math.abs(v[0])));
    const tip = head.filter((v) => Math.abs(v[0]) > reach - 6).map((v) => v[1]);
    return Math.max(...tip) - Math.min(...tip);
  };
  // The end that goes IN is the thin one: a hammer's face is broad, but what the swing has to
  // land is whichever end the tool cuts or strikes with, and on both of these models that is
  // the end opposite the thick one. (Hammer: face broad, claw thin. Axe: bit thin, poll broad.)
  const BLUNT = tipThickness(1) > tipThickness(-1) ? 1 : -1;
  const WORKING = beat.what.startsWith('hammer') ? BLUNT : -BLUNT;

  // --- addTool: laid flat, rolled over, grip on the pivot -------------------
  const model = new THREE.Group();
  model.add(source);
  const box = new THREE.Box3().setFromObject(model);
  const scale = beat.length / (box.max.y - box.min.y);
  model.scale.setScalar(scale);
  model.rotation.z = -Math.PI / 2;
  model.rotation.x = Math.PI; // ...and turned over, or the claw/poll is what points at the target
  model.position.x = -box.min.y * scale;

  const tool = new THREE.Group();
  tool.add(model);
  tool.updateMatrixWorld(true);

  // Every vertex in the pivot's frame, keeping the ORIGINAL coordinates alongside so a leading
  // point can be traced back to the part of the tool it belongs to.
  const points = [];
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    points.push({ x: vertex.x, y: vertex.y, from: { x: position.getX(i), y: position.getY(i) } });
  }

  /**
   * The part that leads at `angle`. `turn` is the roll about the vertical, as its cosine: 1 is
   * the tool held as rigged, -1 is it turned over for a blow from the other side, and anything
   * between is mid-roll, where the handle points at the camera and the whole thing foreshortens
   * — the pivot's z IS the view axis, so the screen reach is simply x * cos(roll).
   */
  const leading = (angle, turn = 1) => {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const height = (p) => turn * p.x * sin + p.y * cos;
    const low = points.reduce((best, p) => (height(p) < height(best) ? p : best));
    return { x: turn * low.x, y: low.y, from: low.from };
  };

  /** What part of the tool that is, in words. */
  const partOf = (lead) =>
    lead.from.y <= HEAD_FROM
      ? 'the butt of the handle'
      : Math.sign(lead.from.x) === WORKING
      ? 'the working end'
      : 'the wrong end of the head';

  /** How high the butt of the handle rides above the leading point, at a given angle. */
  const buttClearance = (angle, turn = 1) => {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const height = (x, y) => x * sin + y * cos;
    const butt = points
      .filter((p) => p.from.y < 0)
      .reduce((low, p) => (height(turn * p.x, p.y) < height(turn * low.x, low.y) ? p : low));
    const lead = leading(angle, turn);
    return height(turn * butt.x, butt.y) - height(lead.x, lead.y);
  };

  /** Where the leading point ends up, in world space, for a pose. */
  const landing = (angle, grip, turn) => {
    const lead = leading(angle, turn);
    return grip
      .clone()
      .addScaledVector(right, lead.x * Math.cos(angle) - lead.y * Math.sin(angle))
      .addScaledVector(up, lead.x * Math.sin(angle) + lead.y * Math.cos(angle));
  };

  // --- swingTool -----------------------------------------------------------
  const target = new THREE.Vector3(0, 1, 0); // whatever it is working on
  const blows = beat.stations.map((spec) => {
    const handle = THREE.MathUtils.degToRad(spec.handleDeg);
    const at = target
      .clone()
      .addScaledVector(right, spec.across)
      .addScaledVector(up, -spec.drop);
    const angle = spec.side * handle;
    const lead = leading(angle, spec.side);
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const grip = at
      .clone()
      .addScaledVector(right, -(lead.x * cos - lead.y * sin))
      .addScaledVector(up, -(lead.x * sin + lead.y * cos));
    return { angle, raised: angle + spec.side * RAISE, at, grip, lead, side: spec.side };
  });

  blows.forEach((blow, i) => {
    // 1. It lands WORKING END first. Not the claw or the poll, not the crown, not the handle.
    assert.strictEqual(
      partOf(blow.lead),
      'the working end',
      `${beat.what}: blow ${i} lands on ${partOf(blow.lead)}`
    );

    // ...and convincingly. Laid flat the right end leads by a hair while the butt hangs level
    // with it over the target, which on screen is a tool dropped on its end. A SCREEN-plane
    // rule only: a swing laid on the ground is level by construction, and its butt is off to
    // one side of the target rather than anywhere above it.
    if (!ground) {
      const clear = buttClearance(blow.angle, blow.side);
      assert.ok(
        clear > BUTT_CLEAR,
        `${beat.what}: blow ${i} lies too flat — the butt is only ${clear.toFixed(2)}u off`
      );
    }

    // 2. It lands where it was aimed. The whole placement works backwards from this.
    const missed = landing(blow.angle, blow.grip, blow.side).distanceTo(blow.at);
    assert.ok(missed < 1e-6, `${beat.what}: blow ${i} missed its spot by ${missed.toFixed(3)}u`);

    // 3. Cocked ABOVE where it lands — full cock and the shorter snap the second of the pair
    // falls from — or the swing has nothing to come down from.
    const snap = blow.angle + (blow.raised - blow.angle) * QUICK_RAISE;
    [blow.raised, snap].forEach((angle) => {
      const cocked = landing(angle, blow.grip, blow.side);
      assert.ok(cocked.dot(up) > blow.at.dot(up), `${beat.what}: blow ${i} must cock above it`);
    });

    // 4. And the hand stays in frame, cocked and carried both.
    const lift = ground ? new THREE.Vector3(0, 1, 0) : up;
    [blow.grip, blow.grip.clone().addScaledVector(lift, CARRY)].forEach((hand) => {
      const out = beat.onScreen + hand.clone().sub(target).dot(screenRight);
      assert.ok(out < HALF_WIDTH, `${beat.what}: blow ${i} puts the hand ${out.toFixed(2)} out`);
    });

    // 5. A ground-plane swing is one that goes into the SIDE of a standing trunk, so the tool
    // has to be square to that trunk: the handle level, the edge level, neither of them
    // reaching down onto it from above. This is the whole reason the plane exists.
    if (ground) {
      const normal = new THREE.Vector3().crossVectors(right, up);
      const handle = right.clone().applyAxisAngle(normal, blow.angle);
      assert.ok(Math.abs(handle.y) < 1e-9, `${beat.what}: the handle must be level`);
      assert.ok(Math.abs(up.y) < 1e-9, `${beat.what}: the edge must go in level`);
      assert.ok(
        up.clone().negate().dot(toCamera) < 0,
        `${beat.what}: the edge should go in away from the camera, not back out of the screen`
      );
      // ...and the handle has to READ. Level is not enough on its own: swung round to point at
      // the camera it is level, square to the trunk and foreshortened to a stub, and the axe
      // lands looking like a blob on a stick.
      assert.ok(
        Math.abs(handle.dot(toCamera)) < 0.6,
        `${beat.what}: blow ${i} points the handle at the camera`
      );
    }
  });

  // The last two questions only arise where stations share a target and can therefore foul
  // each other. The axe's are a tree apart: it cannot pivot on one spot between them and its
  // travel has nothing in the way, so asking would only be asking of a model of the beat that
  // is not the beat.
  if (!beat.sameTarget) {
    console.log(`${beat.what}: ${blows.length} station(s), working end first, square to it`);
    continue;
  }
  const moved = blows[0].grip.distanceTo(blows[1].grip);

  // 6. The TOOL moves between stations, not just its head: work the grip back from the landing
  // spot carelessly and the head crosses the target while the hand pivots on one point.
  assert.ok(
    moved > beat.length * 0.6,
    `${beat.what}: the tool must move between stations, moved ${moved.toFixed(2)}u`
  );

  // 7. The travel between them keeps the head clear of the target the whole way. With the two
  // poses on OPPOSITE sides of it, without the carry lift this drags straight through.
  for (let i = 0; i + 1 < blows.length; i++) {
    const [was, now] = [blows[i], blows[i + 1]];
    const floor = Math.max(was.at.dot(up), now.at.dot(up));
    for (let step = 0; step <= 60; step++) {
      const k = 1 - Math.pow(1 - step / 60, 3);
      const angle = was.angle + (now.raised - was.angle) * k;
      const grip = was.grip
        .clone()
        .lerp(now.grip, k)
        // The hand lifts it, which is always actually UP — in the ground plane that is out of
        // the swing plane entirely, so it buys no clearance there and the arc has to.
        .addScaledVector(ground ? new THREE.Vector3(0, 1, 0) : up, Math.sin(Math.PI * k) * CARRY);
      const roll = Math.acos(was.side) + (Math.acos(now.side) - Math.acos(was.side)) * k;
      const clearance = landing(angle, grip, Math.cos(roll)).dot(up) - floor;
      assert.ok(
        clearance > -0.02,
        `${beat.what}: travel ${i} dips into the target (${clearance.toFixed(3)}u)`
      );
    }
  }

  console.log(
    `${beat.what}: ${blows.length} stations, working end first, hand moves ${moved.toFixed(2)}u,` +
      ` travel clears`
  );
}
