// Sunvale's set pieces: Starlight Pier with its wheel, harbour cranes, the lighthouse,
// beach umbrellas and lifeguard huts, moored boats and the hills behind the city.

import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { mergeColored, trs } from '../render/geometryMerge.js';
import { createRng } from '../core/rng.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);

function pier(parts) {
  const x = -96, z0 = CITY.beachStart - 6, z1 = 470;
  const len = z1 - z0;
  parts.push({ geometry: box(16, 0.5, len), matrix: trs(x, 0.0, (z0 + z1) / 2), color: 0xa77b52 });
  for (let z = z0 + 6; z < z1; z += 9) {
    parts.push({ geometry: cyl(0.35, 0.35, 4), matrix: trs(x - 7.5, -1.8, z), color: 0x6b4c33 });
    parts.push({ geometry: cyl(0.35, 0.35, 4), matrix: trs(x + 7.5, -1.8, z), color: 0x6b4c33 });
    parts.push({ geometry: box(0.2, 1, 0.2), matrix: trs(x - 7.8, 0.75, z), color: 0xf5f0e6 });
    parts.push({ geometry: box(0.2, 1, 0.2), matrix: trs(x + 7.8, 0.75, z), color: 0xf5f0e6 });
  }
  parts.push({ geometry: box(0.15, 0.12, len), matrix: trs(x - 7.8, 1.25, (z0 + z1) / 2), color: 0xf5f0e6 });
  parts.push({ geometry: box(0.15, 0.12, len), matrix: trs(x + 7.8, 1.25, (z0 + z1) / 2), color: 0xf5f0e6 });
  // snack kiosks along the deck
  const cols = [0xf28b82, 0x7fd1c7, 0xfbd38d];
  for (let k = 0; k < 3; k++) {
    const z = 330 + k * 34;
    parts.push({ geometry: box(4, 3, 4), matrix: trs(x + 5, 1.7, z), color: 0xfff7ea });
    parts.push({ geometry: box(5, 0.4, 5), matrix: trs(x + 5, 3.4, z, 0, 0, 0.12), color: cols[k] });
  }
}

function ferrisWheel(group) {
  const wheel = new THREE.Group();
  wheel.position.set(-96, 22, 452);
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xff7ab0, emissiveIntensity: 0 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(18, 0.45, 8, 48), rimMat);
  wheel.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(12, 0.3, 6, 40), rimMat);
  wheel.add(rim2);
  for (let k = 0; k < 16; k++) {
    const s = new THREE.Mesh(box(0.25, 36, 0.25), rimMat);
    s.rotation.z = (k / 16) * Math.PI;
    wheel.add(s);
  }
  const cabins = [];
  const cabCols = [0xff6f91, 0xffc75f, 0x4ecdc4, 0x845ec2, 0xf9f871, 0x00c9a7];
  for (let k = 0; k < 12; k++) {
    const c = new THREE.Mesh(box(2.2, 2.2, 2.2), new THREE.MeshLambertMaterial({ color: cabCols[k % cabCols.length] }));
    c.castShadow = true;
    wheel.add(c);
    cabins.push(c);
  }
  // A-frame legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0xe9e4dc });
  for (const s of [-1, 1]) for (const zz of [-2.5, 2.5]) {
    const leg = new THREE.Mesh(box(0.8, 25, 0.8), legMat);
    leg.position.set(-96 + s * 7, 11, 452 + zz);
    leg.rotation.z = -s * 0.3;
    leg.castShadow = true;
    group.add(leg);
  }
  group.add(wheel);
  let angle = 0;
  return {
    rimMat,
    update(dt) {
      angle += dt * 0.08;
      wheel.rotation.z = angle;
      cabins.forEach((c, k) => {
        const a = (k / cabins.length) * Math.PI * 2;
        c.position.set(Math.cos(a) * 18, Math.sin(a) * 18 - 1.4, 0);
        c.rotation.z = -angle;
      });
    },
  };
}

function cranes(parts) {
  for (const z of [-210, -130, -50, 30]) {
    const x = 362;
    for (const dz of [-5, 5]) {
      parts.push({ geometry: box(1.2, 34, 1.2), matrix: trs(x - 6, 17, z + dz), color: 0xd9452b });
      parts.push({ geometry: box(1.2, 34, 1.2), matrix: trs(x + 6, 17, z + dz), color: 0xd9452b });
    }
    parts.push({ geometry: box(14, 1.6, 12), matrix: trs(x, 34, z), color: 0xd9452b });
    parts.push({ geometry: box(60, 1.6, 2.2), matrix: trs(x + 18, 36, z), color: 0xf2f2f2 });
    parts.push({ geometry: box(5, 4, 4), matrix: trs(x + 2, 31, z), color: 0xf2f2f2 });
    parts.push({ geometry: box(0.3, 18, 0.3), matrix: trs(x + 30, 27, z), color: 0x333333 });
  }
}

function lighthouse(parts) {
  const x = 392, z = 312;
  parts.push({ geometry: cyl(9, 11, 4, 16), matrix: trs(x, 0, z), color: 0x8a8580 });
  for (let k = 0; k < 6; k++) parts.push({ geometry: cyl(3.2 - k * 0.2, 3.4 - k * 0.2, 4, 14), matrix: trs(x, 4 + k * 4, z), color: k % 2 ? 0xffffff : 0xd8392b });
  parts.push({ geometry: cyl(2.2, 2.2, 3, 12), matrix: trs(x, 29.5, z), color: 0xfff4c2 });
  parts.push({ geometry: new THREE.ConeGeometry(2.8, 2.5, 12), matrix: trs(x, 32.2, z), color: 0x333333 });
  // breakwater
  parts.push({ geometry: box(10, 2.4, 80), matrix: trs(x, 0.2, z - 44), color: 0x8f8a84 });
}

function beachProps(parts, rnd) {
  const cols = [0xff6b6b, 0xfeca57, 0x48dbfb, 0xff9ff3, 0x1dd1a1, 0xffffff];
  for (let k = 0; k < 46; k++) {
    const x = rnd.range(-320, 280), z = rnd.range(CITY.beachStart + 10, CITY.waterZ - 8);
    if (Math.abs(x + 96) < 14) continue;
    parts.push({ geometry: cyl(0.06, 0.06, 2.6, 5), matrix: trs(x, 1.3, z), color: 0xeeeeee });
    parts.push({ geometry: new THREE.ConeGeometry(1.8, 0.7, 8), matrix: trs(x, 2.6, z), color: rnd.pick(cols) });
    parts.push({ geometry: box(1, 0.05, 2), matrix: trs(x + 1.4, 0.05, z + 0.6, 0, rnd.range(0, 3)), color: rnd.pick(cols) });
  }
  for (const x of [-250, -170, -20, 70, 180, 250]) {
    const z = CITY.beachStart + 22;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) parts.push({ geometry: box(0.2, 2.6, 0.2), matrix: trs(x + dx, 1.3, z + dz), color: 0xf3f0e8 });
    parts.push({ geometry: box(3, 2, 3), matrix: trs(x, 3.6, z), color: 0xff8a3d });
    parts.push({ geometry: box(3.6, 0.3, 3.6), matrix: trs(x, 4.75, z), color: 0xffffff });
    parts.push({ geometry: box(0.15, 2.4, 0.15), matrix: trs(x + 1.5, 6, z), color: 0xdddddd });
  }
}

function boats(parts, rnd) {
  for (let k = 0; k < 14; k++) {
    const x = k < 8 ? CITY.harborEdgeX + 12 + rnd.range(0, 50) : rnd.range(-300, 250);
    const z = k < 8 ? rnd.range(-260, 220) : CITY.waterZ + rnd.range(30, 140);
    const ry = k < 8 ? Math.PI / 2 : rnd.range(0, 6);
    const L = rnd.range(8, 14);
    parts.push({ geometry: box(2.8, 1.4, L), matrix: trs(x, -0.2, z, 0, ry), color: rnd.pick([0xffffff, 0xf4f1ea, 0x2d5d7b]) });
    parts.push({ geometry: box(2.2, 1.4, L * 0.35), matrix: trs(x, 1.0, z, 0, ry), color: 0xf8f8f8 });
    if (rnd.chance(0.6)) parts.push({ geometry: box(0.15, L * 1.1, 0.15), matrix: trs(x, L * 0.55, z, 0, ry), color: 0xdddddd });
  }
}

function hills(parts, rnd) {
  for (let k = 0; k < 26; k++) {
    const a = rnd.range(Math.PI * 0.9, Math.PI * 1.62); // north and west arc, away from the ocean
    const r = rnd.range(520, 760);
    const x = Math.cos(a) * r - 40, z = Math.sin(a) * r - 40;
    const rad = rnd.range(150, 260), flat = rnd.range(0.25, 0.5);
    parts.push({ geometry: new THREE.SphereGeometry(rad, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), matrix: trs(x, -6, z, 0, rnd.range(0, 3), 0, 1, flat, 1), color: rnd.pick([0x9aa66b, 0xa89a6e, 0x8c9a60, 0xb5a67a]) });
  }
}

export function buildLandmarks(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const rnd = createRng(99);
  const parts = [];
  pier(parts);
  cranes(parts);
  lighthouse(parts);
  beachProps(parts, rnd);
  boats(parts, rnd);
  const mesh = new THREE.Mesh(mergeColored(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  const hp = [];
  hills(hp, rnd);
  group.add(new THREE.Mesh(mergeColored(hp), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  const wheel = ferrisWheel(group);
  return {
    group,
    update(dt) { wheel.update(dt); },
    setNight(n) { wheel.rimMat.emissiveIntensity = n * 1.4; },
  };
}
