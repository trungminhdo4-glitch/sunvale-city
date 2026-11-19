// Turns the city plan into meshes: ground, roads, sidewalks, lots and buildings (merged per style).

import * as THREE from 'three';
import { CITY, lineCoord } from '../core/config.js';
import { mergeColored, trs } from '../render/geometryMerge.js';
import * as TX from '../render/textures.js';
import { createRng } from '../core/rng.js';

const STYLE_TILE = { glass: [4, 3.6], office: [7, 3.6], stucco: [7, 3.4], villa: [7, 3.2], hotel: [7, 3.2], industrial: [8, 6] };

function strip(cx, cz, w, len, alongX, vTile, y) {
  const g = new THREE.PlaneGeometry(w, len);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (len / vTile));
  g.rotateX(-Math.PI / 2);
  if (alongX) g.rotateY(Math.PI / 2);
  g.translate(cx, y, cz);
  return g;
}

function plate(minX, minZ, maxX, maxZ, y, tile) {
  const w = maxX - minX, d = maxZ - minZ;
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  g.rotateX(-Math.PI / 2);
  g.translate((minX + maxX) / 2, y, (minZ + maxZ) / 2);
  return g;
}

/** Box with uv scaled to facade tiles; roofs mapped to a blank corner of the texture. */
function facadeBox(b, tileW, tileH) {
  const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
  const g = new THREE.BoxGeometry(w, b.h, d);
  const uv = g.attributes.uv;
  for (let face = 0; face < 6; face++) {
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      if (face === 2 || face === 3) { uv.setXY(i, 0.02, 0.02); continue; }
      const width = face < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(width / tileW)), uv.getY(i) * Math.max(1, Math.round(b.h / tileH)));
    }
  }
  g.translate((b.minX + b.maxX) / 2, b.h / 2, (b.minZ + b.maxZ) / 2);
  return g.toNonIndexed();
}

function lambert(opts) {
  return new THREE.MeshLambertMaterial(opts);
}

export function buildCity(scene, plan) {
  const group = new THREE.Group();
  scene.add(group);
  const glowMats = [];
  const first = lineCoord(0), last = lineCoord(CITY.lines - 1);
  const half = CITY.roadWidth / 2;

  // --- ground: grass outskirts, sand beach, concrete harbour apron
  const grass = TX.grassTexture();
  const ground = new THREE.Mesh(plate(CITY.landMin - 400, CITY.landMin - 400, CITY.harborEdgeX, CITY.beachStart, 0, 16), lambert({ map: grass }));
  ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(plate(CITY.landMin - 400, CITY.beachStart, CITY.harborEdgeX, CITY.waterZ + 30, 0.0, 12), lambert({ map: TX.sandTexture() }));
  sand.position.y = -0.02;
  sand.geometry.attributes.position.array.forEach((v, i, arr) => {
    // slope the sand down into the water
    if (i % 3 === 1) { const z = arr[i + 1]; arr[i] = z > CITY.waterZ ? -1.2 : 0.01; }
  });
  sand.receiveShadow = true;
  group.add(sand);
  const apron = new THREE.Mesh(plate(last + half, first - half, CITY.harborEdgeX, CITY.beachStart, 0.02, 8), lambert({ map: TX.pavementTexture(), color: 0xb9b4ac }));
  apron.receiveShadow = true;
  group.add(apron);

  // --- roads
  const roadTex = TX.roadTexture();
  const len = last - first + CITY.roadWidth;
  const roadGeos = [];
  for (let i = 0; i < CITY.lines; i++) {
    roadGeos.push({ geometry: strip(lineCoord(i), (first + last) / 2, CITY.roadWidth, len, false, 14, 0.03) });
    // east-west roads continue onto the harbour apron
    const x0 = first - half, x1 = CITY.harborEdgeX - 4;
    roadGeos.push({ geometry: strip((x0 + x1) / 2, lineCoord(i), CITY.roadWidth, x1 - x0, true, 14, 0.035) });
  }
  const roads = new THREE.Mesh(mergeColored(roadGeos), lambert({ map: roadTex }));
  roads.receiveShadow = true;
  group.add(roads);
  const crossGeos = [];
  for (let i = 0; i < CITY.lines; i++) for (let j = 0; j < CITY.lines; j++) {
    crossGeos.push({ geometry: plate(lineCoord(i) - half, lineCoord(j) - half, lineCoord(i) + half, lineCoord(j) + half, 0.045, CITY.roadWidth) });
  }
  const cross = new THREE.Mesh(mergeColored(crossGeos), lambert({ map: TX.crossingTexture() }));
  cross.receiveShadow = true;
  group.add(cross);

  // --- sidewalks and lots
  const walkParts = [], lotGrass = [], lotConcrete = [], pools = [];
  for (const b of plan.blocks) {
    const g = new THREE.BoxGeometry(b.maxX - b.minX, CITY.curb, b.maxZ - b.minZ);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12, uv.getY(i) * 12);
    g.translate((b.minX + b.maxX) / 2, CITY.curb / 2, (b.minZ + b.maxZ) / 2);
    walkParts.push({ geometry: g });
    const s = CITY.sidewalk;
    const lot = plate(b.minX + s, b.minZ + s, b.maxX - s, b.maxZ - s, CITY.curb + 0.01, 10);
    if (b.park || b.district === 'heights' || b.district === 'beach') lotGrass.push({ geometry: lot, color: b.district === 'beach' ? 0xe9e2b0 : 0xffffff });
    else lotConcrete.push({ geometry: lot, color: b.district === 'yards' ? 0x9c968c : 0xc4bdb2 });
  }
  const walks = new THREE.Mesh(mergeColored(walkParts), lambert({ map: TX.pavementTexture() }));
  walks.receiveShadow = true;
  group.add(walks);
  const lg = new THREE.Mesh(mergeColored(lotGrass), lambert({ map: grass, vertexColors: true }));
  lg.receiveShadow = true;
  group.add(lg);
  const lc = new THREE.Mesh(mergeColored(lotConcrete), lambert({ map: TX.pavementTexture(), vertexColors: true }));
  lc.receiveShadow = true;
  group.add(lc);

  // --- buildings, one merged mesh per facade style
  const byStyle = {};
  const props = [];
  const rnd = createRng(21);
  for (const b of plan.buildings) {
    if (b.style === 'container') continue;
    const [tw, th] = STYLE_TILE[b.style];
    (byStyle[b.style] ||= []).push({ geometry: facadeBox(b, tw, th), color: b.color });
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    // roof trim and rooftop clutter
    props.push({ geometry: new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), matrix: trs(cx, b.h + 0.4, cz), color: 0xdedad2 });
    if (b.h > 20) {
      for (let k = 0; k < 3; k++) {
        props.push({ geometry: new THREE.BoxGeometry(3, 2, 3), matrix: trs(cx + rnd.range(-w / 3, w / 3), b.h + 1.6, cz + rnd.range(-d / 3, d / 3)), color: 0x9aa0a6 });
      }
    }
    if (b.h > 100) {
      props.push({ geometry: new THREE.CylinderGeometry(7, 7, 0.4, 24), matrix: trs(cx, b.h + 1, cz), color: 0x4a4f55 });
      props.push({ geometry: new THREE.CylinderGeometry(0.4, 0.6, 14, 8), matrix: trs(cx + w / 3, b.h + 7, cz + d / 3), color: 0xd7d7d7 });
    }
    if (b.style === 'stucco' && rnd.chance(0.35)) {
      props.push({ geometry: new THREE.CylinderGeometry(1.8, 1.8, 3, 10), matrix: trs(cx, b.h + 4, cz), color: 0x8c6a4f });
      props.push({ geometry: new THREE.ConeGeometry(2.1, 1.4, 10), matrix: trs(cx, b.h + 6.2, cz), color: 0x6d5340 });
    }
    if (b.style === 'villa') {
      pools.push({ geometry: plate(b.minX, b.maxZ + 2, b.minX + 8, b.maxZ + 6, CITY.curb + 0.05, 4), color: 0x47c6e0 });
      props.push({ geometry: new THREE.BoxGeometry(w + 1.5, 0.5, d + 1.5), matrix: trs(cx, b.h + 0.25, cz), color: 0xc76a44 });
    }
    if (b.style === 'hotel') {
      for (let y = 6; y < b.h - 2; y += 6.4) props.push({ geometry: new THREE.BoxGeometry(w + 1.6, 0.3, d + 1.6), matrix: trs(cx, y, cz), color: 0xffffff });
    }
    // shop awnings at street level for the old town
    if (b.style === 'stucco') {
      props.push({ geometry: new THREE.BoxGeometry(w * 0.8, 0.25, 2), matrix: trs(cx, 3.4, b.maxZ + 0.9, 0.25), color: rnd.pick([0xd9534f, 0x3f9b8f, 0xf0ad4e, 0x5b7fc7]) });
      props.push({ geometry: new THREE.BoxGeometry(w * 0.8, 0.25, 2), matrix: trs(cx, 3.4, b.minZ - 0.9, -0.25), color: rnd.pick([0xd9534f, 0x3f9b8f, 0xf0ad4e, 0x5b7fc7]) });
    }
  }
  let seed = 1;
  for (const [style, parts] of Object.entries(byStyle)) {
    const mat = lambert({ map: TX.facadeTexture(style), emissiveMap: TX.facadeGlowTexture(style, seed++), emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true });
    glowMats.push(mat);
    const m = new THREE.Mesh(mergeColored(parts), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  const propMesh = new THREE.Mesh(mergeColored(props), lambert({ vertexColors: true }));
  propMesh.castShadow = true;
  propMesh.receiveShadow = true;
  group.add(propMesh);
  if (pools.length) group.add(new THREE.Mesh(mergeColored(pools), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 120, specular: 0xffffff })));

  // --- shipping containers
  const cParts = plan.containers.map((c) => ({ geometry: new THREE.BoxGeometry(12, 2.6, 2.5), matrix: trs(c.x, c.y + 1.3, c.z), color: c.color }));
  const cont = new THREE.Mesh(mergeColored(cParts), lambert({ vertexColors: true, map: TX.facadeTexture('industrial') }));
  cont.castShadow = cont.receiveShadow = true;
  group.add(cont);

  return {
    group,
    /** Window glow rises as the sun sets. */
    setNight(n) { for (const m of glowMats) m.emissiveIntensity = n * 0.9; },
  };
}
