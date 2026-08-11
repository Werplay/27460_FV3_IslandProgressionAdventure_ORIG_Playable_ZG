// Does the farm beat still work at whatever FARM.down / right / ahead currently
// say? Reads them straight out of IslandScene.ts, so it answers for the file as
// it stands rather than for numbers written in here.
//
//   node scratch-farm-place.mjs            what the source says
//   node scratch-farm-place.mjs 7.6 -0.65  try a pair without editing anything
//
// What it is for: `ahead` is the ONLY thing that pulls the apple trees off the
// characters. The pair stops `ahead` short of wherever the field is, so moving
// the field moves them with it and the gap never changes — the camera is
// orthographic, so a tree of height h standing d down-screen of them reaches
// h*cos(elev) - d*sin(elev) above their feet, and d comes from `ahead` alone.
import fs from 'node:fs';

const src = fs.readFileSync('src/scenes/IslandScene.ts', 'utf8');
const block = (name) => src.slice(src.indexOf(`const ${name} = {`));
const num = (text, key) => {
  const m = text.match(new RegExp(`^\\s*(?:const )?${key}\\s*[:=]\\s*(-?[\\d.]+)`, 'm'));
  if (!m) throw new Error(`no ${key} found`);
  return parseFloat(m[1]);
};

const yaw = num(src, 'VIEW_YAW_DEG');
const elev = num(src, 'VIEW_ELEV_DEG');
const farm = block('FARM');
const F = {
  down: parseFloat(process.argv[2] ?? num(farm, 'down')),
  right: parseFloat(process.argv[3] ?? num(farm, 'right')),
  ahead: parseFloat(process.argv[4] ?? num(farm, 'ahead')),
  plot: num(farm, 'plot'),
  gap: num(farm, 'gap'),
  cols: num(farm, 'cols'),
  rows: num(farm, 'rows')
};
const tree = num(block('CROPS').slice(block('CROPS').indexOf('apple:')), 'height');
const offset = block('COW').match(/offset:\s*\{\s*x:\s*(-?[\d.]+),\s*z:\s*(-?[\d.]+)\s*\}/);
const pit = { x: parseFloat(offset[1]), z: parseFloat(offset[2]) }; // the cow, and the pen is round her
const penRadius = num(block('COW_PEN'), 'radius');

const rad = (d) => (d * Math.PI) / 180;
const down = { x: Math.cos(rad(yaw)), z: Math.sin(rad(yaw)) };
const right = { x: Math.sin(rad(yaw)), z: -Math.cos(rad(yaw)) };

// The field, in COW_STOP's frame — farmField's own arithmetic.
const field = { x: down.x * F.down + right.x * F.right, z: down.z * F.down + right.z * F.right };
const length = Math.hypot(field.x, field.z);
const u = { x: field.x / length, z: field.z / length };

// Down-screen distance from the pair to the NEAREST bed. The beds are squared to
// the world, so the near one leads by half a diagonal, not half a side.
const step = F.plot + F.gap;
const nearBed = (Math.max(F.cols, F.rows) - 1) / 2 * step * (down.x + down.z);
const perUnit = u.x * down.x + u.z * down.z;
const d = F.ahead * perUnit - nearBed;
const clears = (tree * Math.cos(rad(elev))) / Math.sin(rad(elev));

console.log(`field   (${field.x.toFixed(2)}, ${field.z.toFixed(2)}) from COW_STOP   walk ${length.toFixed(2)} -> ${(length - F.ahead).toFixed(2)} units after ahead ${F.ahead}`);
console.log(`trees   ${d.toFixed(2)} down-screen of the pair; a ${tree} tree needs ${clears.toFixed(2)} to clear their feet`);
console.log(`        -> ahead ${((clears + nearBed) / perUnit).toFixed(2)} is the number that clears them`);

// The walk still has to miss the pen, and the soil still has to stay out of it.
const lane = Math.abs(pit.x * u.z - pit.z * u.x);
const half = ((Math.max(F.cols, F.rows) - 1) / 2) * step + F.plot / 2;
const toPen = Math.hypot(field.x - pit.x, field.z - pit.z);
console.log(`pen     walk passes ${lane.toFixed(2)}, soil sits ${toPen.toFixed(2)} away (radius ${penRadius})`);

console.assert(d >= clears, `the trees cover the pair: ${d.toFixed(2)} of ${clears.toFixed(2)}`);
console.assert(length - F.ahead > 0.5, `nothing left to walk: ${(length - F.ahead).toFixed(2)}`);
console.assert(lane > penRadius, `the walk goes through the pen (${lane.toFixed(2)})`);
console.assert(toPen > penRadius + half, `the soil overlaps the pen (${toPen.toFixed(2)})`);
