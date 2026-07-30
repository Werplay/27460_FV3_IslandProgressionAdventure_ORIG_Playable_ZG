// Converts a character .fbx into the .glb the playable ships.
//
//   node scripts_fbx2glb.mjs assets/models/Merry-Anim.fbx assets/models/Merry-Anim.glb
//   npx -y -p @gltf-transform/cli gltf-transform quantize <out.glb> <out.glb>
//
// Run BOTH steps. This one converts and drops what the scene never reads; the
// quantize pass is what actually makes the file small, and it needs a package
// that is deliberately not a dependency here (it is a one-off authoring tool,
// not something the build should pull in).
//
// Why not just ship the .fbx as base64, like the boat does? Because a base64
// FBX costs about twice what the quantized GLB does — 1749 KB of bundle for the
// two characters against 855 KB. Note the RAW files tell the opposite story
// (binary FBX zlib-compresses its arrays, a plain GLB does not), so compare the
// numbers that land in the build, not the numbers on disk.
//
// The conversion runs through three's own FBXLoader and GLTFExporter, i.e. the
// exact version the scene loads with, which is what keeps the round trip
// faithful. One consequence worth knowing: the exporter copies UVs across
// untouched, so these GLBs want texture.flipY = TRUE like their FBX did — not
// the flipY = false that the farm's GLBs (from a V-flipping pipeline) need.
import { readFileSync, writeFileSync, statSync } from 'fs';

// three's loaders and the exporter reach for browser globals. These are the
// only ones they touch for a model with no embedded textures.
globalThis.self = globalThis;
globalThis.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 };
globalThis.document = {
  createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, getContext: () => ({}) }),
  createElementNS: () => ({ style: {}, setAttribute() {}, addEventListener() {} })
};
// GLTFExporter assembles its binary through Blob + FileReader. Node has Blob;
// this is the missing half.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      if (this.onloadend) this.onloadend();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      if (this.onloadend) this.onloadend();
    });
  }
};

const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node scripts_fbx2glb.mjs <in.fbx> <out.glb>');
  process.exit(1);
}

const file = readFileSync(src);
const model = new FBXLoader().parse(
  file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
  ''
);
// Props have none; the characters have exactly one, holding every action.
const take = model.animations[0];

let verts = 0;
model.traverse((child) => {
  if (!child.isMesh) return;
  verts += child.geometry.attributes.position.count;

  // Morph targets are never driven — the take is 54 bone tracks with no morph
  // channels — and they are pure weight in the file.
  child.geometry.morphAttributes = {};
  child.morphTargetInfluences = undefined;
  child.morphTargetDictionary = undefined;

  // Same for vertex colours: the scene's material never sets vertexColors, so
  // they are ignored either way.
  if (child.geometry.attributes.color) child.geometry.deleteAttribute('color');

  // Textures are bound at runtime from the bundled atlases, so nothing here
  // should carry an image into the file.
  child.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
});

// A rig's bone translations and scales barely move — in these two takes 40 of
// the 54 tracks never change at all, and each one costs four bytes per sample
// per channel. Flatten those to a single keyframe; the pose still applies.
const CONSTANT = 1e-4;
let flattened = 0;
if (take) {
  take.tracks.forEach((track) => {
    const size = track.getValueSize();
    for (let i = 1; i < track.times.length; i++) {
      for (let k = 0; k < size; k++) {
        if (Math.abs(track.values[i * size + k] - track.values[k]) > CONSTANT) return;
      }
    }
    track.times = new Float32Array([track.times[0]]);
    track.values = track.values.slice(0, size);
    flattened++;
  });
}

const glb = await new Promise((resolve, reject) =>
  new GLTFExporter().parse(model, resolve, reject, {
    binary: true,
    animations: take ? [take] : [],
    onlyVisible: false
  })
);
writeFileSync(out, Buffer.from(glb));

const inSize = statSync(src).size;
const outSize = statSync(out).size;
console.log(`${out}  ${verts} verts, ${flattened} constant tracks flattened`);
console.log(`  ${(inSize / 1024).toFixed(0)} KB fbx -> ${(outSize / 1024).toFixed(0)} KB glb`);
console.log(`  now quantize it, or it stays about twice the size it needs to be:`);
console.log(`  npx -y -p @gltf-transform/cli gltf-transform quantize ${out} ${out}`);
