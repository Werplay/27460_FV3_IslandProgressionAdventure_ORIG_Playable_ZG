// Which farm buildings are (a) small in the bundle and (b) actually mapped for our
// Buildings atlas — sampled with the CORRECT convention: flipY=false means v=0 is the
// image's top row.
import './scratch-shim.mjs';
import { readFileSync, statSync } from 'fs';
const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const { existsSync } = await import('fs');

const names = [
  'B_Classic_Livinghouse_Filler', 'Bakery', 'Cow_Shed', 'Silo', 'B_Chicken_Coop', 'B_Tent',
  'B_Dairy_Factory', 'B_Jam_Station', 'B_Feed_Maker', 'B_Victorian_Barn_Lvl3', 'B_Mailbox',
  'Lamp', 'Wooden_Fence_White_Straight', 'B_County_Fair_Board_Crate_Apple', 'B_Sawmill', 'Milk_Jug'
];
const rows = [];
for (const n of names) {
  const f = `assets/models/${n}.glb`;
  if (!existsSync(f)) continue;
  const b = readFileSync(f);
  const g = await new Promise((res, rej) =>
    new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej)
  );
  g.scene.updateMatrixWorld(true);
  const s = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3());
  const us = [], vs = [];
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const uv = o.geometry.attributes.uv;
    if (!uv) return;
    const st = Math.max(1, Math.floor(uv.count / 250));
    for (let i = 0; i < uv.count; i += st) { us.push(uv.getX(i)); vs.push(uv.getY(i)); }
  });
  rows.push({ n, kb: statSync(f).size / 1024, size: s, us, vs });
}
const { writeFileSync } = await import('fs');
writeFileSync('/tmp/cands.json', JSON.stringify(rows.map((r) => ({ ...r, size: [r.size.x, r.size.y, r.size.z] }))));
rows.forEach((r) =>
  console.log(`${r.n.padEnd(32)} ${r.kb.toFixed(0).padStart(4)}KB  ${r.size.x.toFixed(1)} x ${r.size.y.toFixed(1)} x ${r.size.z.toFixed(1)}  footprint/height ${(Math.max(r.size.x, r.size.z) / r.size.y).toFixed(2)}`)
);
