globalThis.self = globalThis;
globalThis.window = { addEventListener(){}, removeEventListener(){}, devicePixelRatio: 1 };
globalThis.document = { createElement: () => ({ style:{}, setAttribute(){}, addEventListener(){}, getContext: () => ({}) }), createElementNS: () => ({ style:{}, setAttribute(){}, addEventListener(){} }) };
import { readFileSync } from 'fs';
import * as THREE from 'three';
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const build = (roll) => {
  const file = readFileSync('assets/models/props/axe.fbx');
  const source = new FBXLoader().parse(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength), '');
  let mesh; source.traverse(c => { if (c.isMesh) mesh = c; });
  const model = new THREE.Group(); model.add(source);
  const box = new THREE.Box3().setFromObject(model);
  const scale = 1.05/(box.max.y-box.min.y);
  model.scale.setScalar(scale); model.rotation.z = -Math.PI/2; model.rotation.x = Math.PI;
  model.position.x = -box.min.y*scale;
  model.rotation.y = roll;                       // <- what place() sets per blow
  const tool = new THREE.Group(); tool.add(model); tool.updateMatrixWorld(true);
  const p = mesh.geometry.attributes.position, v = new THREE.Vector3(), pts = [];
  for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld); pts.push([v.x,v.y]); }
  return pts;
};
const lowest = (pts, angle) => {
  const s=Math.sin(angle), c=Math.cos(angle);
  return pts.reduce((b,q)=> (q[0]*s+q[1]*c) < (b[0]*s+b[1]*c) ? q : b);
};
for (const [name, roll] of [['roll 0', 0], ['roll PI (side -1)', Math.PI]]) {
  const pts = build(roll);
  const xs=pts.map(q=>q[0]), ys=pts.map(q=>q[1]);
  console.log(`${name}: bounds x ${Math.min(...xs).toFixed(2)}..${Math.max(...xs).toFixed(2)}  y ${Math.min(...ys).toFixed(2)}..${Math.max(...ys).toFixed(2)}`);
  for (const a of [0, -35]) {
    const l = lowest(pts, THREE.MathUtils.degToRad(a));
    console.log(`   leads at ${a}deg: (${l[0].toFixed(2)}, ${l[1].toFixed(2)})`);
  }
}
