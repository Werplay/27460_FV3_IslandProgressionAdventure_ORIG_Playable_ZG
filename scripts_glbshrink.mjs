/**
 * Shrink the GLB models in place.
 *
 *   node scripts_glbshrink.mjs [--write] [file.glb ...]
 *
 * Without --write it is a dry run: it transforms in memory, verifies, and prints
 * the table. With --write it overwrites the sources — assets/ is committed, so
 * `git checkout -- assets/models` is the undo.
 *
 * Three passes, all of them non-destructive to the triangle count:
 *   1. dedup + prune + resample   lossless. Drops duplicate accessors and
 *      redundant keyframes. Clip DURATIONS are untouched, which matters because
 *      IslandScene reads sub-clips as times off a single baked take.
 *   2. quantize                   16-bit positions and skin weights, 12-bit
 *      normals, 14-bit UVs. Deliberately conservative: the default 14-bit
 *      positions and 8-bit weights visibly move the three skinned characters.
 *   3. EXT_meshopt_compression    lossless entropy coding over pass 2. This is
 *      where two thirds of the saving comes from, and it costs no precision.
 *
 * NO mesh simplification. Vertex and triangle counts are asserted identical.
 *
 * Requires `npm i -D @gltf-transform/cli` (pulls in core/functions/extensions).
 * The decoder side lives in IslandScene.ts and utils/LoadBase64FBX.js — meshopt
 * is a REQUIRED extension, so a loader without it rejects these files outright.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder as ThreeMeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MODELS = path.join(ROOT, 'assets', 'models');

// PlotWheat is measured RAW by IslandScene: it reads the bed's mesh.geometry
// bounding box with no node matrix applied, so the node scale that quantization
// leaves behind would resize every farm plot in the field. Safe passes only.
// (and its byte-identical 'PlotWheat (1).glb' twin, hence the prefix test)
const noQuantize = (name) => name.startsWith('PlotWheat');

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const loader = new GLTFLoader().setMeshoptDecoder(ThreeMeshoptDecoder);

/**
 * Structural + geometric fingerprint, taken through three's own loader so it
 * sees exactly what the game sees. Skinned meshes are sampled through the real
 * bone transform at five points across the take, so a loss of joint-index or
 * skin-weight precision shows up as drift rather than passing silently.
 */
async function fingerprint(bytes) {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));

  const meshList = [];
  let verts = 0, tris = 0, skins = 0, bones = 0;
  const names = [], materials = new Set(), attrs = new Set();
  gltf.scene.traverse((o) => {
    if (o.name) names.push(o.name);
    if (o.isSkinnedMesh) { skins++; bones += o.skeleton.bones.length; }
    if (!o.isMesh) return;
    meshList.push(o);
    verts += o.geometry.attributes.position.count;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    for (const k of Object.keys(o.geometry.attributes)) attrs.add(k);
    if (o.material) materials.add(o.material.name);
  });

  const dur = gltf.animations.length ? gltf.animations[0].duration : 0;
  let mixer = null;
  if (dur > 0) {
    mixer = new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations[0]).play();
  }
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const t of dur > 0 ? [0, 0.2, 0.4, 0.6, 0.8].map((f) => f * dur) : [0]) {
    if (mixer) mixer.setTime(t);
    gltf.scene.updateMatrixWorld(true);
    for (const o of meshList) {
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        if (o.isSkinnedMesh) o.applyBoneTransform(i, v);
        box.expandByPoint(v.applyMatrix4(o.matrixWorld));
      }
    }
  }
  const size = box.getSize(new THREE.Vector3());
  return {
    meshes: meshList.length, verts, tris, skins, bones,
    anims: gltf.animations.length,
    names: names.sort(), materials: [...materials].sort(), attrs: [...attrs].sort(),
    clips: gltf.animations.map((a) => `${a.name}@${a.duration.toFixed(3)}`),
    tracks: gltf.animations.map((a) => a.tracks.length),
    size: size.toArray(), min: box.min.toArray()
  };
}

/** @returns {string[]} human-readable reasons the rewrite is not equivalent. */
function compare(a, b) {
  const bad = [];
  for (const k of ['meshes', 'verts', 'tris', 'skins', 'bones', 'anims'])
    if (a[k] !== b[k]) bad.push(`${k} ${a[k]} -> ${b[k]}`);
  for (const k of ['materials', 'attrs', 'clips', 'tracks'])
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) bad.push(`${k} changed`);
  // Quantization parks the decode scale on a fresh wrapper node when the original
  // node carried both a mesh and children, so the tree may GAIN a node. Losing a
  // name is the failure that matters — the app looks nodes up by name.
  const kept = new Set(b.names);
  const lost = a.names.filter((n) => !kept.has(n));
  if (lost.length) bad.push(`names lost: ${lost.join(', ')}`);
  // Quantization moves vertices a little; more than 1% of the model's own
  // longest side is not rounding, it is a mapping that came out wrong.
  const span = Math.max(...a.size) || 1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(b.size[i] - a.size[i]) / span > 0.01) bad.push(`size[${i}] drifted`);
    if (Math.abs(b.min[i] - a.min[i]) / span > 0.01) bad.push(`min[${i}] drifted`);
  }
  return bad;
}

const args = process.argv.slice(2);
const write = args.includes('--write');
const files = args.filter((a) => !a.startsWith('--'));
const targets = (files.length ? files.map((f) => path.resolve(f)) : fs.readdirSync(MODELS)
  .filter((f) => f.endsWith('.glb')).sort().map((f) => path.join(MODELS, f)));

let before = 0, after = 0, failed = 0;
for (const file of targets) {
  const name = path.basename(file);
  const src = fs.readFileSync(file);
  const doc = await io.readBinary(new Uint8Array(src));

  const passes = [
    // keepUniqueNames: PlotWheat carries two atlases and the app picks between
    // them by MATERIAL NAME, which the default dedup would collapse into one.
    dedup({ keepUniqueNames: true }),
    prune({ keepAttributes: true, keepLeaves: true, keepSolidTextures: true }),
    resample() // default 1e-4; 1e-3 saves another 36 KB and visibly drifts the cow
  ];
  if (!noQuantize(name)) {
    passes.push(
      quantize({
        quantizePosition: 16,
        quantizeNormal: 12,
        quantizeTexcoord: 14,
        quantizeColor: 8,
        quantizeWeight: 16,
        quantizeGeneric: 16
      }),
      meshopt({ encoder: MeshoptEncoder, level: 'high' })
    );
  }
  await doc.transform(...passes);
  const out = Buffer.from(await io.writeBinary(doc));

  const bad = compare(await fingerprint(src), await fingerprint(out));
  // A handful of the grass tufts are so small that the meshopt header costs more
  // than the encoding saves. Keep whichever is smaller; both load the same way.
  const kept = bad.length || out.length >= src.length ? src : out;
  before += src.length;
  after += kept.length;
  if (bad.length) failed++;
  else if (write && kept !== src) fs.writeFileSync(file, out);

  const pct = ((1 - kept.length / src.length) * 100).toFixed(0);
  console.log(
    `${bad.length ? 'FAIL' : ' ok '}  ${name.padEnd(34)}` +
    `${String(src.length).padStart(7)} -> ${String(kept.length).padStart(7)} (${pct.padStart(3)}%)` +
    (bad.length ? `  ${bad.join('; ')}` : '')
  );
}
console.log(
  `\n${targets.length} models  ${before} -> ${after}  saved ${before - after} ` +
  `(${((1 - after / before) * 100).toFixed(1)}%)  failures: ${failed}` +
  (write ? '' : '  [dry run, pass --write to apply]')
);
process.exit(failed ? 1 : 0);
