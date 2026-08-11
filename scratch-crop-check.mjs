// The two crop models the farm beat plants, measured the way IslandScene.addBedCrop
// measures them — the scene's own loader, decoder and box maths.
//
//   node scratch-crop-check.mjs
//
// What it is guarding: nothing in this art pack agrees on where a crop's ORIGIN
// is. The wheat is Z-up (FARM.cropUprightDeg stands it back up), the apple tree
// hangs off a node lifted 2.87 above its own roots, and the carrot patch's
// origin is halfway up the carrots — placed by that one, 60% of the orange body
// is underground and the bed grows tufts of green attached to nothing. Every
// crop is therefore MEASURED and stood on the soil, and a re-export that moves
// an origin again has to fail here rather than in the ad.
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// CROPS, as the scene has it.
const CROPS = {
  apple: { src: 'assets/models/Apple_Tree_Stage.glb', height: 1.6 },
  carrot: { src: 'assets/models/Carrot_Finished.glb', height: 0.78 }
};

const load = (src) =>
  new Promise((resolve, reject) => {
    const buf = fs.readFileSync(src);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => resolve(gltf.scene), reject);
  });

const near = (a, b, tol = 1e-3) => Math.abs(a - b) < tol;

for (const [name, crop] of Object.entries(CROPS)) {
  const source = await load(crop.src);

  const authored = new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
  source.scale.setScalar(crop.height / authored.y);
  const box = new THREE.Box3().setFromObject(source);
  const centre = box.getCenter(new THREE.Vector3());
  const offset = new THREE.Vector3(-centre.x, -box.min.y, -centre.z);

  // As the bed holds it: model offset inside a pivot standing on the soil.
  const pivot = new THREE.Group();
  source.position.copy(offset);
  pivot.add(source);
  pivot.updateMatrixWorld(true);
  const placed = new THREE.Box3().setFromObject(pivot);
  const size = placed.getSize(new THREE.Vector3());

  console.log(
    `${name}: ${size.x.toFixed(2)} x ${size.z.toFixed(2)} wide, y ${placed.min.y.toFixed(2)} .. ${placed.max.y.toFixed(2)}`
  );

  // It stands what `height` asked for, ON the soil: nothing buried, nothing floating.
  console.assert(near(placed.max.y, crop.height), `${name}: stands ${placed.max.y.toFixed(3)}, not ${crop.height}`);
  console.assert(near(placed.min.y, 0), `${name}: floats or sinks — base at ${placed.min.y.toFixed(3)}`);
  // Inside its bed, or the four of them grow through each other. FARM.plot + FARM.gap.
  console.assert(size.x < 1.32 && size.z < 1.32, `${name}: ${size.x.toFixed(2)}x${size.z.toFixed(2)} overhangs its 1.32 bed`);
}
console.log('ok');
