// Eight original Sunvale vehicles built from boxes: body, glass cabin, wheels, lights and extras.

import * as THREE from 'three';
import { softDotTexture } from '../render/textures.js';

export const VEHICLE_TYPES = {
  pico:     { name: 'Pico Hatch',      len: 3.7, wid: 1.75, hgt: 0.62, cab: [0.55, 1.9, -0.15], maxSpeed: 34, accel: 13, grip: 7.5, steer: 2.5, health: 70, colors: [0xf4d35e, 0x7bdff2, 0xf7aef8, 0xffffff] },
  cortessa: { name: 'Cortessa Sedan',  len: 4.6, wid: 1.85, hgt: 0.6, cab: [0.55, 2.2, -0.1], maxSpeed: 40, accel: 14, grip: 7, steer: 2.2, health: 90, colors: [0x2b4c7e, 0xb7b7b7, 0x7a1f2b, 0xf2efe9, 0x1f1f1f] },
  mirage:   { name: 'Mirage GT',       len: 4.5, wid: 1.95, hgt: 0.48, cab: [0.42, 1.7, -0.35], maxSpeed: 58, accel: 22, grip: 8.5, steer: 2.3, health: 85, colors: [0xff3d3d, 0xff8c1a, 0x16c2d5, 0xffd400], spoiler: true },
  brute:    { name: 'Brute 77',        len: 4.9, wid: 2.0, hgt: 0.62, cab: [0.5, 1.9, -0.45], maxSpeed: 50, accel: 18, grip: 6, steer: 2.0, health: 120, colors: [0x111111, 0x6a0dad, 0x0b6e4f, 0xc1121f], stripes: true },
  ridgeback:{ name: 'Ridgeback Pickup', len: 5.1, wid: 2.05, hgt: 0.85, cab: [0.7, 1.7, 0.6], maxSpeed: 38, accel: 13, grip: 6.5, steer: 2.0, health: 130, colors: [0x8c2f39, 0x3d5a80, 0xe0e0e0, 0x6b705c], bed: true },
  pelican:  { name: 'Pelican Van',     len: 5.2, wid: 2.1, hgt: 0.9, cab: [1.25, 4.0, -0.45], maxSpeed: 32, accel: 10, grip: 6, steer: 1.9, health: 140, colors: [0xffffff, 0xe9c46a, 0x90be6d] },
  sunnycab: { name: 'Sunny Cab',       len: 4.6, wid: 1.85, hgt: 0.6, cab: [0.55, 2.2, -0.1], maxSpeed: 40, accel: 14, grip: 7, steer: 2.2, health: 90, colors: [0xffc400], taxi: true },
  cruiser:  { name: 'SVPD Interceptor', len: 4.8, wid: 1.95, hgt: 0.6, cab: [0.55, 2.2, -0.15], maxSpeed: 52, accel: 19, grip: 8, steer: 2.3, health: 140, colors: [0xf5f5f5], police: true },
};

export const CIVILIAN_TYPES = ['pico', 'pico', 'cortessa', 'cortessa', 'cortessa', 'mirage', 'brute', 'ridgeback', 'pelican', 'sunnycab', 'sunnycab'];

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
wheelGeo.rotateZ(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
hubGeo.rotateZ(Math.PI / 2);
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x1b1b1b });
const hubMat = new THREE.MeshLambertMaterial({ color: 0xcfd3d6 });
const glassMat = new THREE.MeshPhongMaterial({ color: 0x14202c, specular: 0x8899aa, shininess: 40 });
const trimMat = new THREE.MeshLambertMaterial({ color: 0x232323 });
const chromeMat = new THREE.MeshPhongMaterial({ color: 0xd0d0d0, specular: 0xffffff, shininess: 60 });

let glowTex = null;
const glowTexture = () => (glowTex ??= softDotTexture());

const paintCache = new Map();
function paint(color) {
  if (!paintCache.has(color)) paintCache.set(color, new THREE.MeshPhongMaterial({ color, specular: 0x666666, shininess: 70 }));
  return paintCache.get(color);
}

/** Box whose top face is shrunk (sloped windscreen and rear window). */
function taperedBox(w, h, l, topZ, topX, shiftZ) {
  const g = new THREE.BoxGeometry(w, h, l);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) { p.setZ(i, p.getZ(i) * topZ + shiftZ); p.setX(i, p.getX(i) * topX); }
  }
  g.computeVertexNormals();
  return g;
}

function mesh(g, m, x, y, z, parent) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  parent.add(o);
  return o;
}

/** Builds a vehicle group facing +z. Returns the parts the Vehicle animates. */
export function createVehicleModel(type, color) {
  const t = VEHICLE_TYPES[type];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const L = t.len, W = t.wid, H = t.hgt;
  const base = 0.38;
  const bodyMat = paint(color);
  mesh(new THREE.BoxGeometry(W, H, L), bodyMat, 0, base + H / 2, 0, body);
  mesh(new THREE.BoxGeometry(W + 0.04, 0.16, L + 0.1), trimMat, 0, base + 0.08, 0, body);
  // cabin: glass box with a painted roof
  const [ch, cl, cz] = t.cab;
  if (t.cab) {
    const boxy = t.bed || type === 'pelican';
    const top = boxy ? 0.92 : t.spoiler || t.stripes ? 0.55 : 0.68;
    mesh(taperedBox(W * 0.88, ch, cl, top, 0.9, boxy ? 0 : -cl * 0.06), glassMat, 0, base + H + ch / 2, cz, body);
    mesh(new THREE.BoxGeometry(W * 0.8, 0.07, cl * top * 0.95), bodyMat, 0, base + H + ch + 0.02, cz - (boxy ? 0 : cl * 0.06), body);
    // pillars between the windows
    mesh(new THREE.BoxGeometry(W * 0.9, ch * 0.9, 0.12), bodyMat, 0, base + H + ch * 0.48, cz - (boxy ? 0 : cl * 0.06), body);
  }
  // wheel arches
  for (const sz of [1, -1]) mesh(new THREE.BoxGeometry(W + 0.06, 0.32, 1.05), trimMat, 0, base + 0.12, sz * (L / 2 - 0.85), body);
  if (t.bed) {
    mesh(new THREE.BoxGeometry(W, 0.4, L * 0.38), bodyMat, 0, base + H + 0.2, -L * 0.3, body).scale.set(1, 1, 1);
    mesh(new THREE.BoxGeometry(W * 0.84, 0.42, L * 0.34), trimMat, 0, base + H + 0.22, -L * 0.3, body);
  }
  if (t.spoiler) {
    mesh(new THREE.BoxGeometry(W * 0.9, 0.08, 0.4), trimMat, 0, base + H + 0.35, -L / 2 + 0.25, body);
    mesh(new THREE.BoxGeometry(0.08, 0.3, 0.2), trimMat, 0.6, base + H + 0.17, -L / 2 + 0.3, body);
    mesh(new THREE.BoxGeometry(0.08, 0.3, 0.2), trimMat, -0.6, base + H + 0.17, -L / 2 + 0.3, body);
  }
  if (t.stripes) {
    mesh(new THREE.BoxGeometry(0.35, 0.02, L + 0.02), paint(0xffffff), 0.25, base + H + 0.005, 0, body);
    mesh(new THREE.BoxGeometry(0.35, 0.02, L + 0.02), paint(0xffffff), -0.25, base + H + 0.005, 0, body);
  }
  if (t.taxi) {
    mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3), paint(0x222222), 0, base + H + ch + 0.17, cz, body);
    mesh(new THREE.BoxGeometry(W + 0.02, 0.12, L * 0.5), paint(0x111111), 0, base + H * 0.55, 0, body);
  }
  let lightbar = null;
  if (t.police) {
    mesh(new THREE.BoxGeometry(W + 0.02, H * 0.5, L * 0.55), paint(0x1a2a5a), 0, base + H * 0.45, 0, body);
    const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const blue = new THREE.MeshBasicMaterial({ color: 0x2a6bff });
    const y = base + H + ch + 0.14;
    const glow = (color, x) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.set(x, y + 0.1, cz);
      s.scale.setScalar(3.6);
      body.add(s);
      return s;
    };
    lightbar = {
      red: mesh(new THREE.BoxGeometry(0.55, 0.16, 0.26), red, 0.32, y, cz, body),
      blue: mesh(new THREE.BoxGeometry(0.55, 0.16, 0.26), blue, -0.32, y, cz, body),
      redMat: red, blueMat: blue,
      redGlow: glow(0xff2020, 0.45), blueGlow: glow(0x2050ff, -0.45),
    };
    mesh(new THREE.BoxGeometry(W * 0.7, 0.3, 0.12), chromeMat, 0, base + 0.3, L / 2 + 0.08, body);
  }
  // lights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x9a1010 });
  for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), headMat, s * (W / 2 - 0.3), base + H * 0.7, L / 2 + 0.01, body);
    mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), tailMat, s * (W / 2 - 0.3), base + H * 0.7, -L / 2 - 0.01, body);
  }
  mesh(new THREE.BoxGeometry(W * 0.5, 0.2, 0.05), chromeMat, 0, base + H * 0.4, L / 2 + 0.02, body);

  // wheels: front pivots steer
  const wheels = [], steerPivots = [];
  const wz = L / 2 - 0.85, wx = W / 2 - 0.12;
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * wx, 0.36, sz * wz);
    root.add(pivot);
    const w = mesh(wheelGeo, tyreMat, 0, 0, 0, pivot);
    mesh(hubGeo, hubMat, 0, 0, 0, w);
    wheels.push(w);
    if (sz > 0) steerPivots.push(pivot);
  }
  return { root, body, wheels, steerPivots, headMat, tailMat, lightbar, bodyMat };
}
