// Palm trees and street lights as instanced meshes, scattered along the boulevards, parks and beach.

import * as THREE from 'three';
import { CITY, lineCoord } from '../core/config.js';
import { mergeColored, trs } from '../render/geometryMerge.js';
import { createRng } from '../core/rng.js';

function palmGeometry() {
  const parts = [];
  let x = 0, y = 0;
  for (let k = 0; k < 7; k++) {
    const nx = Math.sin(k * 0.22) * 0.5;
    parts.push({ geometry: new THREE.CylinderGeometry(0.26 - k * 0.015, 0.3 - k * 0.015, 1.7, 7), matrix: trs(x + nx, y + 0.85, 0, 0, 0, -0.04 * k), color: k % 2 ? 0x8b6a4a : 0x7a5b3e });
    x += nx * 0.2; y += 1.6;
  }
  for (let f = 0; f < 8; f++) {
    const a = (f / 8) * Math.PI * 2;
    const frond = new THREE.BoxGeometry(0.9, 0.08, 4.6);
    frond.translate(0, 0, 2.2);
    const m = trs(x + 0.4, y + 0.1, 0, 0.35 + (f % 2) * 0.25, a, 0);
    parts.push({ geometry: frond, matrix: m, color: f % 2 ? 0x3f8f3a : 0x5aa845 });
  }
  parts.push({ geometry: new THREE.SphereGeometry(0.55, 6, 5), matrix: trs(x + 0.4, y - 0.2, 0), color: 0x6b4f2a });
  return mergeColored(parts);
}

function lampGeometry() {
  return mergeColored([
    { geometry: new THREE.CylinderGeometry(0.1, 0.14, 7, 6), matrix: trs(0, 3.5, 0), color: 0x4a5058 },
    { geometry: new THREE.BoxGeometry(0.12, 0.12, 2.4), matrix: trs(0, 6.9, 1.1), color: 0x4a5058 },
  ]);
}

export function buildVegetation(scene, plan) {
  const rnd = createRng(42);
  const palms = [];
  const first = lineCoord(0), last = lineCoord(CITY.lines - 1);
  const o = CITY.roadWidth / 2 + 1.2;
  // boulevard palms along the beach road and the central avenue
  for (let x = first; x <= last; x += 26) {
    palms.push([x + rnd.range(-2, 2), last + o]);
    palms.push([x + rnd.range(-2, 2), CITY.beachStart + 4 + rnd.range(0, 3)]);
  }
  for (let z = first; z <= last; z += 18) palms.push([lineCoord(4) + o, z + 9], [lineCoord(4) - o, z]);
  for (const b of plan.blocks) {
    if (b.park || b.district === 'heights' || b.district === 'beach') {
      const n = b.park ? 12 : 5;
      for (let k = 0; k < n; k++) {
        const x = rnd.range(b.minX + 4, b.maxX - 4), z = rnd.range(b.minZ + 4, b.maxZ - 4);
        if (plan.buildings.some((f) => x > f.minX - 1.5 && x < f.maxX + 1.5 && z > f.minZ - 1.5 && z < f.maxZ + 1.5)) continue;
        palms.push([x, z]);
      }
    }
  }
  for (let k = 0; k < 40; k++) palms.push([rnd.range(-330, 280), rnd.range(CITY.beachStart + 6, CITY.beachStart + 26)]);

  const pMesh = new THREE.InstancedMesh(palmGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), palms.length);
  palms.forEach(([x, z], i) => {
    const s = rnd.range(0.85, 1.3);
    pMesh.setMatrixAt(i, trs(x, CITY.curb, z, 0, rnd.range(0, Math.PI * 2), 0, s, s, s));
  });
  pMesh.castShadow = true;
  scene.add(pMesh);

  // street lights at every intersection corner, arm pointing at the road
  const lamps = [];
  for (let i = 0; i < CITY.lines; i++) for (let j = 0; j < CITY.lines; j++) {
    const x = lineCoord(i), z = lineCoord(j);
    lamps.push([x + o, z + o, Math.PI], [x - o, z - o, 0]);
  }
  const lMesh = new THREE.InstancedMesh(lampGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), lamps.length);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2d0, emissive: 0xffc070, emissiveIntensity: 0 });
  const hMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.2, 0.9), headMat, lamps.length);
  lamps.forEach(([x, z, ry], i) => {
    lMesh.setMatrixAt(i, trs(x, CITY.curb, z, 0, ry));
    hMesh.setMatrixAt(i, trs(x + Math.sin(ry) * 2.1, CITY.curb + 6.8, z + Math.cos(ry) * 2.1, 0, ry));
  });
  lMesh.castShadow = true;
  scene.add(lMesh, hMesh);

  // trunk collision: palms and lamp posts are thin poles
  const poles = palms.map(([x, z]) => ({ x, z, r: 0.35 })).concat(lamps.map(([x, z]) => ({ x, z, r: 0.2 })));
  return {
    poles,
    setNight(n) { headMat.emissiveIntensity = n * 2.5; },
  };
}
