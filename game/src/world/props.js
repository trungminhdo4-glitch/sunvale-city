// Street furniture and scenery as instanced meshes: palms, trees, lamps, beach umbrellas, lifeguard towers,
// containers, cranes, market stalls, the fountain, Sunvale Pier, the Sol y Sal taco truck and the backdrop hills.
import * as THREE from 'three';
import { GeometryBuilder } from './geometryBuilder.js';
import { getTexture, makeSignTexture } from './textures.js';
import { CITY, PIER } from '../core/config.js';
import { roadCoord, LOCATIONS } from './cityLayout.js';
import { Rng } from '../core/rng.js';

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), eu = new THREE.Euler(), col = new THREE.Color();

function place(x, y, z, rotY = 0, s = 1, tiltX = 0, sy = s) {
  return m4.compose(pv.set(x, y, z), q.setFromEuler(eu.set(tiltX, rotY, 0)), sc.set(s, sy, s));
}
function instanced(scene, geo, mat, items, placeFn, colorFn = null, shadow = true) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  items.forEach((it, i) => {
    mesh.setMatrixAt(i, placeFn(it, i));
    if (colorFn) mesh.setColorAt(i, col.set(colorFn(it, i)));
  });
  mesh.count = items.length;
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}
const nearCrossing = (v) => Math.abs(v - roadCoord(Math.round((v - CITY.origin) / CITY.pitch))) < 10.5;
const groundY = (x, z, statics) => statics.groundHeight(x, z);

// ---------- geometries ----------
function palmTrunkGeometry() {
  const g = new THREE.CylinderGeometry(0.15, 0.3, 9, 7, 6);
  g.translate(0, 4.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.012 * y * y); }
  g.computeVertexNormals();
  return g;
}
function palmCrownGeometry() {
  const gb = new GeometryBuilder();
  const top = [0.97, 9, 0], L = 3.8, seg = 5;
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + (k % 2) * 0.2, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const lift = k % 3 === 0 ? 0.6 : 0.2;
    const pt = (s, side) => {
      const w = (0.62 * Math.sin(Math.PI * Math.min(1, s * 1.05)) + 0.05) * side;
      const y = top[1] + lift * s - 2.2 * s * s;
      return [top[0] + dx * L * s + px * w, y - Math.abs(w) * 0.25, top[2] + dz * L * s + pz * w];
    };
    for (let i = 0; i < seg; i++) {
      const s0 = i / seg, s1 = (i + 1) / seg;
      const shade = 0.75 + 0.25 * (i / seg);
      gb.addQuad(pt(s0, -1), pt(s0, 1), pt(s1, 1), pt(s1, -1), [0, 0, 1, 1], new THREE.Color(0.22 * shade, 0.5 * shade, 0.2 * shade));
    }
  }
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1;
    gb.addBox({ cx: top[0] + Math.cos(a) * 0.25, cz: Math.sin(a) * 0.25, y0: top[1] - 0.55, sx: 0.32, sy: 0.32, sz: 0.32, color: '#5a3d1f' });
  }
  return gb.build();
}
function lampGeometry() {
  const gb = new GeometryBuilder();
  gb.addBox({ cx: 0, cz: 0, y0: 0, sx: 0.18, sz: 0.18, sy: 7, color: '#4a4d55' });
  gb.addBox({ cx: 0.85, cz: 0, y0: 6.9, sx: 1.7, sz: 0.12, sy: 0.12, color: '#4a4d55' });
  gb.addBox({ cx: 1.6, cz: 0, y0: 6.7, sx: 0.7, sz: 0.36, sy: 0.22, color: '#3a3c42' });
  gb.addBox({ cx: 1.6, cz: 0, y0: 6.66, sx: 0.5, sz: 0.26, sy: 0.04, color: '#fff2c4' });
  return gb.build();
}
function treeGeometries() {
  const canopy = new THREE.IcosahedronGeometry(2.5, 1);
  canopy.scale(1, 0.85, 1); canopy.translate(0, 5.4, 0);
  const trunk = new THREE.CylinderGeometry(0.2, 0.32, 4.2, 6); trunk.translate(0, 2.1, 0);
  return { canopy, trunk };
}

// ---------- main entry ----------
export function buildProps(scene, statics, spots) {
  const rng = new Rng(9001);
  addStreetPalms(spots, rng);
  const beach = beachItems(rng);

  // palms
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b4c, roughness: 0.95 });
  const crownMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const palms = spots.palms.concat(beach.palms);
  const palmPlace = (p, i) => place(p.x, groundY(p.x, p.z, statics), p.z, (i * 2.399) % 6.283, 0.85 + ((i * 7) % 10) / 22);
  instanced(scene, palmTrunkGeometry(), trunkMat, palms, palmPlace);
  instanced(scene, palmCrownGeometry(), crownMat, palms, palmPlace);
  for (const p of palms) statics.add(p.x - 0.35, p.z - 0.35, p.x + 0.35, p.z + 0.35, 0, 8, 'palm');

  // round trees
  const { canopy, trunk } = treeGeometries();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
  const treePlace = (t, i) => place(t.x, groundY(t.x, t.z, statics), t.z, i, 0.8 + ((i * 13) % 10) / 20);
  instanced(scene, canopy, leafMat, spots.trees, treePlace, (t, i) => ['#4f8a3c', '#5f9e45', '#3f7a35', '#6aa84f'][i % 4]);
  instanced(scene, trunk, trunkMat, spots.trees, treePlace);
  for (const t of spots.trees) statics.add(t.x - 0.4, t.z - 0.4, t.x + 0.4, t.z + 0.4, 0, 6, 'tree');

  // street lamps reaching over the road
  const lampMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5, emissive: 0x222018 });
  instanced(scene, lampGeometry(), lampMat, spots.lamps, (l) => place(l.x, CITY.curbHeight, l.z, Math.atan2(-(l.tz - l.z), l.tx - l.x) + 0.0));
  for (const l of spots.lamps) statics.add(l.x - 0.2, l.z - 0.2, l.x + 0.2, l.z + 0.2, 0, 7, 'lamp');

  buildBeachProps(scene, statics, beach);
  buildContainers(scene, statics, spots.containers);
  buildDockCranes(scene, statics, spots.cranes);
  buildPlazaProps(scene, statics, spots);
  buildPier(scene, statics);
  buildTacoTruck(scene, statics);
  buildBackdrop(scene, rng);
}

function addStreetPalms(spots, rng) {
  const P = spots.palms;
  for (let z = -335; z <= 335; z += 15) if (Math.abs(z) > 10) P.push({ x: -331.5 - rng.range(0, 2.5), z });
  for (let z = -310; z <= 310; z += 17) if (!nearCrossing(z)) P.push({ x: roadCoord(0) + 8.7, z });
  for (let x = -300; x <= 315; x += 19) if (!nearCrossing(x)) P.push({ x, z: roadCoord(4) - 8.7 }, { x, z: roadCoord(4) + 8.7 });
  for (let z = -300; z <= 315; z += 19) if (!nearCrossing(z)) P.push({ x: roadCoord(5) - 8.7, z }, { x: roadCoord(5) + 8.7, z });
}

function beachItems(rng) {
  const out = { palms: [], umbrellas: [], towels: [] };
  const clear = (z) => Math.abs(z) > 14 && Math.abs(z - LOCATIONS.tacoTruck.z) > 16;
  for (let k = 0; k < 34; k++) { const z = rng.range(-340, 340); if (clear(z)) out.palms.push({ x: rng.range(-376, -340), z }); }
  for (let k = 0; k < 46; k++) {
    const z = rng.range(-330, 330); if (!clear(z)) continue;
    const x = rng.range(-392, -358);
    out.umbrellas.push({ x, z, c: rng.pick(['#ff6f61', '#2ec4b6', '#ffd166', '#ffffff', '#f78fb3', '#5aa9e6']) });
    if (rng.chance(0.8)) out.towels.push({ x: x + rng.range(1.2, 2.2), z: z + rng.range(-1, 1), r: rng.range(-0.4, 0.4), c: rng.pick(['#ff9f1c', '#2ec4b6', '#e63946', '#ffffff', '#8338ec', '#06d6a0']) });
  }
  return out;
}

function buildBeachProps(scene, statics, beach) {
  const canopy = new THREE.ConeGeometry(1.6, 0.6, 10, 1, true); canopy.translate(0, 2.45, 0);
  const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 5); pole.translate(0, 1.25, 0);
  const cloth = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  const up = (u, i) => place(u.x, groundY(u.x, u.z, statics), u.z, i, 1, 0.08 * ((i % 3) - 1));
  instanced(scene, canopy, cloth, beach.umbrellas, up, (u) => u.c);
  instanced(scene, pole, white, beach.umbrellas, up);
  const towel = new THREE.BoxGeometry(1.0, 0.04, 1.9);
  instanced(scene, towel, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), beach.towels,
    (t) => place(t.x, groundY(t.x, t.z, statics) + 0.02, t.z, t.r), (t) => t.c, false);

  // lifeguard towers on stilts
  const gb = new GeometryBuilder();
  const hut = ['#2ec4b6', '#ff6f61', '#ffd166', '#f78fb3'];
  [-250, -130, 120, 245].forEach((z, k) => {
    const x = -378, y0 = groundY(x, z, statics);
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) gb.addBox({ cx: x + dx, cz: z + dz, y0, sx: 0.2, sz: 0.2, sy: 2.6, color: '#f4f1ea' });
    gb.addBox({ cx: x, cz: z, y0: y0 + 2.6, sx: 3.4, sz: 3.4, sy: 0.2, color: '#f4f1ea' });
    gb.addBox({ cx: x, cz: z, y0: y0 + 2.8, sx: 2.6, sz: 2.6, sy: 1.9, color: hut[k] });
    gb.addBox({ cx: x, cz: z, y0: y0 + 4.7, sx: 3.2, sz: 3.2, sy: 0.25, color: '#ffffff' });
    gb.addBox({ cx: x - 1.31, cz: z, y0: y0 + 3.4, sx: 0.05, sz: 1.8, sy: 0.8, color: '#22303a' });
    gb.addBox({ cx: x + 2.4, cz: z, y0, sx: 2.4, sz: 0.9, sy: 0.15, color: '#e9e1d2', rotY: 0 });
    statics.add(x - 1.4, z - 1.4, x + 1.4, z + 1.4, 0, 5, 'tower');
  });
  const mesh = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildContainers(scene, statics, list) {
  const items = [];
  for (const c of list) {
    for (let s = 0; s < (c.stack ?? 1); s++) items.push({ ...c, y: c.y + s * 2.6, color: s ? shift(c.color, s) : c.color });
    statics.add(c.x - 6.1, c.z - 1.22, c.x + 6.1, c.z + 1.22, 0, (c.stack ?? 1) * 2.6, 'container');
  }
  const geo = new THREE.BoxGeometry(12.2, 2.6, 2.44); geo.translate(0, 1.3, 0);
  const mat = new THREE.MeshStandardMaterial({ map: getTexture('container'), roughness: 0.7, metalness: 0.3 });
  instanced(scene, geo, mat, items, (c) => place(c.x, c.y, c.z, c.rotY), (c) => c.color);
}
const SHIFT = ['#2e86de', '#f39c12', '#27ae60', '#c0392b', '#16a085'];
const shift = (c, s) => SHIFT[(c.length + s) % SHIFT.length];

function buildDockCranes(scene, statics, cranes) {
  const gb = new GeometryBuilder();
  for (const { x, z } of cranes) {
    for (const [dx, dz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
      gb.addBox({ cx: x + dx, cz: z + dz, y0: 0, sx: 0.9, sz: 0.9, sy: 30, color: '#e8702a' });
      statics.add(x + dx - 0.5, z + dz - 0.5, x + dx + 0.5, z + dz + 0.5, 0, 30, 'crane');
    }
    gb.addBox({ cx: x, cz: z - 4, y0: 29, sx: 11, sz: 1, sy: 1.4, color: '#e8702a' });
    gb.addBox({ cx: x, cz: z + 4, y0: 29, sx: 11, sz: 1, sy: 1.4, color: '#e8702a' });
    gb.addBox({ cx: x, cz: z + 12, y0: 30.4, sx: 2.2, sz: 44, sy: 1.6, color: '#f2b134' });
    gb.addBox({ cx: x, cz: z - 6, y0: 32, sx: 3, sz: 3, sy: 2.6, color: '#d9d4c7' });
    gb.addBox({ cx: x, cz: z + 22, y0: 24, sx: 0.08, sz: 0.08, sy: 6.4, color: '#222222' });
  }
  const mesh = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }));
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildPlazaProps(scene, statics, spots) {
  const gb = new GeometryBuilder();
  const y = CITY.curbHeight;
  for (const s of spots.stalls) {
    const c = Math.cos(s.rotY), si = Math.sin(s.rotY);
    gb.addBox({ cx: s.x, cz: s.z, y0: y, sx: 2.8, sz: 1.4, sy: 1.0, rotY: s.rotY, color: '#8d6e52' });
    for (const [lx, lz] of [[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.6], [1.3, 0.6]])
      gb.addBox({ cx: s.x + lx * c + lz * si, cz: s.z - lx * si + lz * c, y0: y, sx: 0.1, sz: 0.1, sy: 2.4, rotY: s.rotY, color: '#e8e2d6' });
    gb.addBox({ cx: s.x, cz: s.z, y0: y + 2.4, sx: 3.2, sz: 1.9, sy: 0.18, rotY: s.rotY, color: s.color });
    gb.addBox({ cx: s.x, cz: s.z, y0: y + 1.0, sx: 2.4, sz: 1.0, sy: 0.25, rotY: s.rotY, color: ['#ffb347', '#7ed6a5', '#ff6f61'][Math.abs(Math.round(s.x)) % 3] });
    statics.add(s.x - 1.4, s.z - 1.4, s.x + 1.4, s.z + 1.4, 0, 1.2, 'stall');
  }
  for (const b of spots.benches) {
    gb.addBox({ cx: b.x, cz: b.z, y0: y, sx: 1.9, sz: 0.6, sy: 0.45, rotY: b.rotY, color: '#9c6b43' });
    gb.addBox({ cx: b.x - Math.sin(b.rotY) * 0.28, cz: b.z - Math.cos(b.rotY) * 0.28, y0: y + 0.45, sx: 1.9, sz: 0.1, sy: 0.5, rotY: b.rotY, color: '#9c6b43' });
  }
  const mesh = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);

  const stone = new THREE.MeshStandardMaterial({ color: 0xe9dcc6, roughness: 0.8 });
  const water = new THREE.MeshStandardMaterial({ color: 0x5fd3e6, roughness: 0.05, metalness: 0.1, emissive: 0x0e5866, transparent: true, opacity: 0.9 });
  for (const f of spots.fountains) {
    const g = new THREE.Group(); g.position.set(f.x, y, f.z);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.7, 28), stone); ring.position.y = 0.35;
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.1, 28), water); pool.position.y = 0.62;
    const col1 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 2.4, 12), stone); col1.position.y = 1.2;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.6, 0.5, 18), stone); bowl.position.y = 2.5;
    const bowlW = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.06, 18), water); bowlW.position.y = 2.74;
    for (const m of [ring, pool, col1, bowl, bowlW]) { m.castShadow = m.receiveShadow = true; g.add(m); }
    scene.add(g);
    statics.add(f.x - 3.6, f.z - 3.6, f.x + 3.6, f.z + 3.6, 0, 0.8, 'fountain');
  }
}

function buildPier(scene, statics) {
  const wood = new GeometryBuilder(), trim = new GeometryBuilder();
  const len = PIER.x1 - PIER.x0, cx = (PIER.x0 + PIER.x1) / 2;
  wood.addBox({ cx, cz: 0, y0: PIER.y - 0.35, sx: len, sz: PIER.z1 - PIER.z0, sy: 0.35, uvU: 4, uvV: 1, topTile: 3 });
  for (let x = PIER.x0 + 1; x < PIER.x1 - 8; x += 6) {
    for (const z of [PIER.z0 + 0.6, PIER.z1 - 0.6]) {
      trim.addBox({ cx: x, cz: z, y0: -4, sx: 0.5, sz: 0.5, sy: 4.1, color: '#5c4632' });
      trim.addBox({ cx: x, cz: z, y0: PIER.y, sx: 0.18, sz: 0.18, sy: 1.1, color: '#f2ede4' });
    }
  }
  for (const z of [PIER.z0 + 0.6, PIER.z1 - 0.6]) {
    trim.addBox({ cx: (PIER.x0 + PIER.x1 - 8) / 2, cz: z, y0: PIER.y + 1.0, sx: len - 8, sz: 0.12, sy: 0.12, color: '#f2ede4' });
    statics.add(PIER.x0, z - 0.25, PIER.x1 - 9, z + 0.25, 0, 2, 'rail');
  }
  trim.addBox({ cx: PIER.x0 + 0.3, cz: 0, y0: PIER.y, sx: 0.2, sz: PIER.z1 - PIER.z0 - 1, sy: 1.1, color: '#f2ede4' });
  // the bait shack at the end and the entrance arch
  trim.addBox({ cx: PIER.x0 + 9, cz: 3.2, y0: PIER.y, sx: 7, sz: 4.4, sy: 3, color: '#2ec4b6' });
  trim.addBox({ cx: PIER.x0 + 9, cz: 3.2, y0: PIER.y + 3, sx: 7.8, sz: 5.2, sy: 0.3, color: '#ffffff' });
  statics.add(PIER.x0 + 5.5, 1, PIER.x0 + 12.5, 5.4, 0, 3.5, 'shack');
  for (const z of [-6.2, 6.2]) trim.addBox({ cx: PIER.x1 - 4, cz: z, y0: PIER.y, sx: 0.6, sz: 0.6, sy: 6.2, color: '#ff6f61' });
  const woodMesh = new THREE.Mesh(wood.build(), new THREE.MeshStandardMaterial({ map: getTexture('wood'), roughness: 0.9 }));
  const trimMesh = new THREE.Mesh(trim.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  for (const m of [woodMesh, trimMesh]) { m.castShadow = m.receiveShadow = true; scene.add(m); }
  const arch = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.25), new THREE.MeshStandardMaterial({
    map: makeSignTexture('SUNVALE PIER', { bg: '#ff6f61', fg: '#ffffff', accent: '#ffd166', sub: 'EST. 1958 · FISHING · SUNSETS' }), side: THREE.DoubleSide, roughness: 0.6 }));
  arch.position.set(PIER.x1 - 4, PIER.y + 7.6, 0); arch.rotation.y = Math.PI / 2;
  scene.add(arch);
}

function buildTacoTruck(scene, statics) {
  const { x, z } = LOCATIONS.tacoTruck;
  const gb = new GeometryBuilder();
  gb.addBox({ cx: x, cz: z, y0: 0.5, sx: 2.5, sz: 6, sy: 2.7, color: '#ffd166' });
  gb.addBox({ cx: x, cz: z + 3.3, y0: 0.5, sx: 2.4, sz: 1.2, sy: 1.8, color: '#ffd166' });
  gb.addBox({ cx: x, cz: z + 3.92, y0: 1.5, sx: 2.1, sz: 0.05, sy: 0.75, color: '#22303a' });
  gb.addBox({ cx: x + 1.27, cz: z - 0.4, y0: 1.5, sx: 0.04, sz: 3.6, sy: 1.1, color: '#2b1d14' });
  gb.addBox({ cx: x + 1.9, cz: z - 0.4, y0: 2.75, sx: 1.4, sz: 4.2, sy: 0.12, color: '#ff6f61' });
  gb.addBox({ cx: x + 1.4, cz: z - 0.4, y0: 1.4, sx: 0.5, sz: 3.8, sy: 0.1, color: '#e9e1d2' });
  for (const dz of [-2, 2.4]) for (const dx of [-1.15, 1.15]) gb.addBox({ cx: x + dx, cz: z + dz, y0: 0, sx: 0.3, sz: 0.9, sy: 0.75, color: '#1c1c1c' });
  for (const t of [[5, 2], [6.5, -3]]) {
    gb.addBox({ cx: x + t[0], cz: z + t[1], y0: 0, sx: 1.6, sz: 1.6, sy: 0.75, color: '#2ec4b6' });
    gb.addBox({ cx: x + t[0], cz: z + t[1], y0: 0, sx: 0.12, sz: 0.12, sy: 2.6, color: '#ffffff' });
  }
  const mesh = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  const signMat = new THREE.MeshStandardMaterial({ map: makeSignTexture('SOL Y SAL', { bg: '#ff6f61', fg: '#fff7ec', accent: '#2ec4b6', sub: 'TACOS · AGUAS FRESCAS' }), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.15 });
  signMat.emissiveMap = signMat.map;
  const s = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), signMat);
  s.position.set(x + 1.28, 3.55, z); s.rotation.y = Math.PI / 2;
  scene.add(s);
  statics.add(x - 1.3, z - 3, x + 1.3, z + 4, 0, 3.2, 'truck');
}

function buildBackdrop(scene, rng) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x7b8f55, roughness: 1, flatShading: true });
  const far = new THREE.MeshStandardMaterial({ color: 0x8d8aa8, roughness: 1, flatShading: true });
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const hills = [];
  for (let k = 0; k < 14; k++) hills.push({ x: 420 + rng.range(0, 160), z: -460 + k * 70, s: rng.range(50, 95), h: rng.range(18, 45), m: 0 });
  for (let k = 0; k < 10; k++) hills.push({ x: -300 + k * 80, z: -440 - rng.range(0, 90), s: rng.range(50, 90), h: rng.range(16, 40), m: 0 });
  for (let k = 0; k < 8; k++) hills.push({ x: 800 + rng.range(0, 200), z: -700 + k * 220, s: rng.range(160, 240), h: rng.range(80, 140), m: 1 });
  for (let k = 0; k < 3; k++) hills.push({ x: -820 - k * 150, z: -250 + k * 260, s: rng.range(60, 110), h: rng.range(14, 30), m: 0 });
  for (const h of hills) {
    const m = new THREE.Mesh(geo, h.m ? far : mat);
    m.position.set(h.x, -h.h * 0.25, h.z); m.scale.set(h.s, h.h, h.s * 0.8); m.rotation.y = h.x;
    m.receiveShadow = true;
    scene.add(m);
  }
}
