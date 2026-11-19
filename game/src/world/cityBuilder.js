// Builds Sunvale's streets, blocks, buildings, landmarks, beach and docks as merged meshes plus static colliders.
import * as THREE from 'three';
import { GeometryBuilder } from './geometryBuilder.js';
import { getTexture, makeSignTexture } from './textures.js';
import { CITY, BEACH_X, DOCK_Z, HARBOR_Z } from '../core/config.js';
import { roadCoord, blockRect, districtKey, specialBlock, ROAD_COUNT, HALF_ROAD } from './cityLayout.js';
import { Rng } from '../core/rng.js';

const TINTS = {
  coral: ['#ffc9c9', '#c4f1df', '#fff0b3', '#e4d4ff', '#ffd9b3', '#c9e9ff', '#ffffff', '#ffd1e8'],
  palm: ['#f1e3c9', '#f6cfb2', '#ffffff', '#e1ead2', '#f3dcc2'],
  downtown: ['#ffffff', '#e2f0ff', '#eafff8', '#fff2e3', '#dfe6f2'],
  mango: ['#ffb36b', '#ff917c', '#ffd36b', '#a3e3cc', '#94d2ff', '#f4abd9', '#c7b3ff'],
  vista: ['#ffffff', '#f8f0e3', '#f1f6f9'],
  harbor: ['#d9d5ce', '#c8d4dc', '#e2cfb9', '#bccab4', '#d8c3c3'],
};
// Sunvale's own brands for rooftop billboards: text, background, text colour, accent, tagline.
export const BRANDS = [
  ['SOL COLA', '#e63946', '#ffffff', '#ffd166', 'ICE COLD SINCE 1974'],
  ['CORAL BANK', '#ffffff', '#ff6f61', '#2ec4b6', ''],
  ['RADIO COAST 88.4', '#3b1f4f', '#ffd166', '#ff6f61', ''],
  ['VESPERA GT', '#111111', '#ff3b30', null, 'FEEL THE HEAT'],
  ['SOL Y SAL', '#ffd166', '#7a2e00', '#ff6f61', 'BEACH TACOS'],
  ['PELICAN AIR', '#2ec4b6', '#ffffff', '#ffffff', 'FLY THE COAST'],
  ['MANGO MOBILE', '#ff9f1c', '#2b2d42', null, ''],
  ['SUNBLOCK 50', '#ffffff', '#ff9f1c', '#5aa9e6', 'STAY GOLDEN'],
];
const ROOF = '#d8d4cc';

export function buildCity(scene, statics) {
  const rng = new Rng(4242);
  const B = {};
  for (const k of ['stucco', 'deco', 'glass', 'warehouse', 'villa', 'shop', 'roof', 'road', 'crossing', 'sidewalk', 'grass', 'plaza', 'concrete', 'sand', 'dark', 'trim', 'pool'])
    B[k] = new GeometryBuilder();
  const spots = { palms: [], trees: [], lamps: [], containers: [], benches: [], stalls: [], cranes: [], fountains: [], parkedCars: [] };
  const signs = [];
  const ctx = { B, statics, spots, signs, rng };

  buildRoads(ctx);
  for (let bi = 0; bi < CITY.blocks; bi++) for (let bj = 0; bj < CITY.blocks; bj++) buildBlock(ctx, bi, bj);
  buildGroundAndBeach(ctx);
  buildDocks(ctx);
  createMeshes(scene, B);
  createSigns(scene, signs);
  return { spots };
}

// ---------- streets ----------
function buildRoads({ B, spots }) {
  const y = 0.02, H = HALF_ROAD;
  for (let i = 0; i < ROAD_COUNT; i++) {
    const c = roadCoord(i);
    for (let j = 0; j < CITY.blocks; j++) {
      const a = roadCoord(j) + H, b = roadCoord(j + 1) - H, len = (b - a) / 28;
      B.road.addQuad([c - H, y, b], [c + H, y, b], [c + H, y, a], [c - H, y, a], [0, 0, 1, len]);
      B.road.addQuad([a, y, c - H], [a, y, c + H], [b, y, c + H], [b, y, c - H], [0, 0, 1, len]);
    }
    for (let j = 0; j < ROAD_COUNT; j++) {
      const cz = roadCoord(j);
      B.crossing.addQuad([c - H, y, cz + H], [c + H, y, cz + H], [c + H, y, cz - H], [c - H, y, cz - H], [0, 0, 1, 1]);
      const k = (i + j) % 2 ? 1 : -1;
      spots.lamps.push({ x: c + 9.4 * k, z: cz + 9.4, tx: c, tz: cz }, { x: c - 9.4 * k, z: cz - 9.4, tx: c, tz: cz });
    }
  }
}

// ---------- blocks ----------
function inset(r, d) { return { x0: r.x0 + d, z0: r.z0 + d, x1: r.x1 - d, z1: r.z1 - d }; }
function splitLots(r, nx, nz, gap) {
  const out = [], w = (r.x1 - r.x0 - gap * (nx - 1)) / nx, d = (r.z1 - r.z0 - gap * (nz - 1)) / nz;
  for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
    const x0 = r.x0 + a * (w + gap), z0 = r.z0 + b * (d + gap);
    out.push({ x0, z0, x1: x0 + w, z1: z0 + d });
  }
  return out;
}

function building({ B, statics }, o) {
  const { x0, z0, x1, z1, h, style, tint = '#ffffff', shop = false, base = CITY.curbHeight, collide = true, uOff = 0 } = o;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = x1 - x0, sz = z1 - z0;
  let y0 = base;
  if (shop && h - base > 7) {
    B.shop.addBox({ cx, cz, y0, sx, sz, sy: 3.6, uvU: 16, uvV: 3.6, uOffset: uOff, top: null });
    y0 += 3.6;
  }
  B[style].addBox({ cx, cz, y0, sx: shop ? sx - 0.3 : sx, sz: shop ? sz - 0.3 : sz, sy: h - y0, color: tint, uvU: 16, uvV: 14, uOffset: uOff, top: null });
  B.roof.addFlat(x0, z0, x1, z1, h, 8, ROOF);
  // parapet
  const p = 0.35, ph = 0.7;
  B.roof.addBox({ cx, cz: z0 + p / 2, y0: h, sx, sz: p, sy: ph, color: tint, uvU: 4, uvV: 4 });
  B.roof.addBox({ cx, cz: z1 - p / 2, y0: h, sx, sz: p, sy: ph, color: tint, uvU: 4, uvV: 4 });
  B.roof.addBox({ cx: x0 + p / 2, cz, y0: h, sx: p, sz, sy: ph, color: tint, uvU: 4, uvV: 4 });
  B.roof.addBox({ cx: x1 - p / 2, cz, y0: h, sx: p, sz, sy: ph, color: tint, uvU: 4, uvV: 4 });
  if (collide) statics.add(x0, z0, x1, z1, 0, h, 'building');
  return { x0, z0, x1, z1, h };
}

function roofClutter({ B, rng }, b) {
  const n = rng.int(0, 3);
  for (let k = 0; k < n; k++) {
    const w = rng.range(1.5, 3.5), d = rng.range(1.5, 3);
    const x = rng.range(b.x0 + w, b.x1 - w), z = rng.range(b.z0 + d, b.z1 - d);
    B.roof.addBox({ cx: x, cz: z, y0: b.h, sx: w, sz: d, sy: rng.range(0.8, 2.2), color: '#c9c5bd', uvU: 2, uvV: 2 });
  }
}

function rooftopSign({ B, signs }, b, brand, facing) {
  const [text, bg, fg, accent, sub] = brand;
  const south = facing === 'south';
  const span = south ? b.x1 - b.x0 : b.z1 - b.z0;
  const w = Math.min(17, span * 0.85), hh = w / 4;
  const y = b.h + 0.8 + hh / 2;
  const x = south ? (b.x0 + b.x1) / 2 : b.x0 + 1.2;
  const z = south ? b.z1 - 1.2 : (b.z0 + b.z1) / 2;
  signs.push({ text, bg, fg, accent, sub, x, y, z, w, h: hh, rotY: south ? 0 : -Math.PI / 2 });
  for (const s of [-0.38, 0.38]) {
    const px = south ? x + s * w : x + 0.35, pz = south ? z - 0.35 : z + s * w;
    B.trim.addBox({ cx: px, cz: pz, y0: b.h, sx: 0.25, sz: 0.25, sy: 0.8 + hh * 0.5, color: '#55575e' });
  }
}

function buildBlock(ctx, bi, bj) {
  const { B, rng } = ctx;
  const r = blockRect(bi, bj);
  const dk = districtKey(bi, bj), sp = specialBlock(bi, bj);
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  B.sidewalk.addBox({ cx, cz, y0: 0, sx: r.x1 - r.x0, sz: r.z1 - r.z0, sy: CITY.curbHeight, uvU: 4, uvV: 1, topTile: 4 });
  const inner = inset(r, CITY.sidewalk + 0.6);
  if (sp?.kind === 'park') return buildPark(ctx, r, inner);
  if (sp?.kind === 'plaza') return buildPlaza(ctx, r, inner);
  if (sp?.kind === 'landmark') return LANDMARKS[sp.id](ctx, r, inner);

  const tints = TINTS[dk];
  const signFacing = bi % 2 ? 'south' : 'west';
  const maybeSign = (b, p) => { if (rng.chance(p)) rooftopSign(ctx, b, rng.pick(BRANDS), signFacing); };

  if (dk === 'downtown') {
    if (rng.chance(0.5)) {
      const pod = building(ctx, { ...inner, h: rng.range(7.5, 9.5), style: 'glass', tint: '#dbe4ee', shop: true, uOff: rng.next() });
      const t = inset(inner, rng.range(5, 8));
      const tw = building(ctx, { ...t, h: rng.range(48, 112), base: pod.h, style: 'glass', tint: rng.pick(tints), collide: false, uOff: rng.next() });
      if (rng.chance(0.6)) {
        const t2 = building(ctx, { ...inset(t, rng.range(3, 6)), h: tw.h + rng.range(8, 22), base: tw.h, style: 'glass', tint: rng.pick(tints), collide: false });
        roofClutter(ctx, t2);
      } else { roofClutter(ctx, tw); maybeSign(tw, 0.35); }
    } else {
      for (const lot of splitLots(inner, 2, 1, 4)) {
        const b = building(ctx, { ...lot, h: rng.range(26, 78), style: rng.chance(0.75) ? 'glass' : 'stucco', tint: rng.pick(tints), shop: true, uOff: rng.next() });
        roofClutter(ctx, b); maybeSign(b, 0.3);
      }
    }
  } else if (dk === 'coral') {
    const lots = rng.chance(0.5) ? splitLots(inner, 2, 2, 4) : splitLots(inner, 1, 2, 4);
    for (const lot of lots) {
      const b = building(ctx, { ...lot, h: rng.range(11, 30), style: 'deco', tint: rng.pick(tints), shop: rng.chance(0.6), uOff: rng.next() });
      roofClutter(ctx, b); maybeSign(b, 0.25);
    }
    ctx.spots.palms.push({ x: r.x0 + 1.6, z: cz - 12 }, { x: r.x0 + 1.6, z: cz + 12 });
  } else if (dk === 'palm') {
    for (const lot of splitLots(inner, 2, 2, 5)) {
      const b = building(ctx, { ...lot, h: rng.range(7.5, 22), style: 'stucco', tint: rng.pick(tints), shop: rng.chance(0.35), uOff: rng.next() });
      roofClutter(ctx, b); maybeSign(b, 0.12);
    }
    ctx.spots.trees.push({ x: r.x0 + 1.6, z: cz }, { x: r.x1 - 1.6, z: cz });
  } else if (dk === 'mango') {
    for (const lot of splitLots(inner, 3, 2, 2.5)) {
      const b = building(ctx, { ...lot, h: rng.range(8, 18), style: 'stucco', tint: rng.pick(tints), shop: rng.chance(0.85), uOff: rng.next() });
      roofClutter(ctx, b); maybeSign(b, 0.12);
    }
  } else if (dk === 'vista') {
    B.grass.addFlat(inner.x0 - 0.6, inner.z0 - 0.6, inner.x1 + 0.6, inner.z1 + 0.6, CITY.curbHeight + 0.01, 6);
    for (const lot of splitLots(inner, 2, 2, 3)) {
      const v = inset(lot, rng.range(3, 4.5));
      const vx1 = v.x0 + (v.x1 - v.x0) * 0.72;
      const b = building(ctx, { x0: v.x0, z0: v.z0, x1: vx1, z1: v.z1, h: rng.range(5.5, 7.5), style: 'villa', tint: rng.pick(tints) });
      building(ctx, { x0: v.x0 + 1.5, z0: v.z0 + 1.5, x1: vx1 - 4, z1: v.z1 - 3, h: b.h + 3.2, base: b.h, style: 'villa', tint: '#ffffff', collide: false });
      B.pool.addFlat(vx1 + 1, v.z0 + 1, v.x1 - 0.5, v.z1 - 4, CITY.curbHeight + 0.03, 4);
      ctx.spots.trees.push({ x: lot.x0 + 1.2, z: lot.z1 - 1.2 }, { x: lot.x1 - 1.2, z: lot.z1 - 1.2 });
      ctx.spots.palms.push({ x: v.x1 - 0.5, z: v.z1 - 1.5 });
    }
  } else {
    // harbor warehouses with a yard of containers
    const lots = rng.chance(0.5) ? splitLots(inner, 1, 2, 8) : splitLots(inner, 2, 1, 8);
    lots.forEach((lot, k) => {
      if (k === 1 && rng.chance(0.35)) {
        for (let n = 0; n < 3; n++) ctx.spots.containers.push({ x: (lot.x0 + lot.x1) / 2, z: lot.z0 + 4 + n * 4, y: CITY.curbHeight, rotY: 0, color: rng.pick(CONTAINER_COLORS), stack: rng.int(1, 2) });
        return;
      }
      const b = building(ctx, { ...inset(lot, 1.5), h: rng.range(8, 13), style: 'warehouse', tint: rng.pick(tints), uOff: rng.next() });
      roofClutter(ctx, b); maybeSign(b, 0.15);
    });
  }
}

const CONTAINER_COLORS = ['#c0392b', '#2e86de', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#7f8c8d', '#e84393'];

function buildPark({ B, spots, rng }, r, inner) {
  const y = CITY.curbHeight + 0.01;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  B.grass.addFlat(r.x0 + CITY.sidewalk, r.z0 + CITY.sidewalk, r.x1 - CITY.sidewalk, r.z1 - CITY.sidewalk, y, 6);
  B.sidewalk.addFlat(cx - 1.6, r.z0 + 3, cx + 1.6, r.z1 - 3, y + 0.01, 4);
  B.sidewalk.addFlat(r.x0 + 3, cz - 1.6, r.x1 - 3, cz + 1.6, y + 0.01, 4);
  B.pool.addFlat(cx + 6, cz + 6, cx + 16, cz + 16, y + 0.02, 4);
  for (let k = 0; k < 12; k++) {
    let x = rng.range(inner.x0 + 2, inner.x1 - 2), z = rng.range(inner.z0 + 2, inner.z1 - 2);
    if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4 || (x > cx + 4 && z > cz + 4 && x < cx + 18 && z < cz + 18)) continue;
    (k % 3 ? spots.trees : spots.palms).push({ x, z });
  }
  spots.benches.push({ x: cx - 3, z: cz - 10, rotY: Math.PI / 2 }, { x: cx + 3, z: cz + 10, rotY: -Math.PI / 2 },
    { x: cx - 10, z: cz - 3, rotY: 0 }, { x: cx + 10, z: cz + 3, rotY: Math.PI });
}

function buildPlaza(ctx, r, inner) {
  const { B, spots } = ctx;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  B.plaza.addFlat(r.x0 + CITY.sidewalk, r.z0 + CITY.sidewalk, r.x1 - CITY.sidewalk, r.z1 - CITY.sidewalk, CITY.curbHeight + 0.01, 4);
  const arcade = building(ctx, { x0: inner.x0, z0: inner.z0, x1: inner.x1, z1: inner.z0 + 8, h: 10.5, style: 'stucco', tint: '#ffb36b', shop: true });
  rooftopSign(ctx, arcade, BRANDS[6], 'south');
  spots.fountains.push({ x: cx, z: cz + 3 });
  const stallColors = ['#ff6f61', '#2ec4b6', '#ffd166', '#f78fb3', '#7ed6a5', '#5aa9e6'];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    spots.stalls.push({ x: cx + Math.cos(a) * 13, z: cz + 3 + Math.sin(a) * 11, rotY: -a + Math.PI / 2, color: stallColors[k] });
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    spots.palms.push({ x: cx + Math.cos(a) * 20, z: cz + 5 + Math.sin(a) * 15 });
  }
  spots.benches.push({ x: cx - 6, z: cz + 3, rotY: Math.PI / 2 }, { x: cx + 6, z: cz + 3, rotY: -Math.PI / 2 });
}

// ---------- landmarks ----------
function forecourt(B, x0, z0, x1, z1) { B.concrete.addFlat(x0, z0, x1, z1, CITY.curbHeight + 0.01, 4); }
function doorway(B, cx, cz, w, h, rotY) {
  const cos = Math.cos(rotY), sin = Math.sin(rotY), y0 = CITY.curbHeight + 0.02;
  const P = (lx, y) => [cx + lx * cos, y, cz - lx * sin];
  B.dark.addQuad(P(-w / 2, y0), P(w / 2, y0), P(w / 2, y0 + h), P(-w / 2, y0 + h));
}
function sign(signs, text, bg, fg, accent, sub, x, y, z, w, rotY) { signs.push({ text, bg, fg, accent, sub, x, y, z, w, h: w / 4, rotY }); }

const LANDMARKS = {
  marea(ctx, r) {
    const { B, spots, signs } = ctx;
    forecourt(B, r.x0 + 3.2, r.z0 + 3.2, r.x0 + 16, r.z1 - 3.2);
    const t = building(ctx, { x0: r.x0 + 16, z0: r.z0 + 5, x1: r.x1 - 3.4, z1: r.z1 - 5, h: 44, style: 'deco', tint: '#ffb8c6', shop: true });
    const top = building(ctx, { x0: t.x0 + 5, z0: t.z0 + 7, x1: t.x1 - 5, z1: t.z1 - 7, h: 55, base: 44, style: 'deco', tint: '#ffd0da', collide: false });
    sign(signs, 'MAREA HOTEL', '#ffffff', '#e0457b', '#2ec4b6', '', top.x0 - 0.2, 58.4, (t.z0 + t.z1) / 2, 19, -Math.PI / 2);
    for (let k = 0; k < 4; k++) spots.palms.push({ x: r.x0 + 5, z: r.z0 + 8 + k * 11 });
  },
  calloway(ctx, r, inner) {
    const { B, signs } = ctx;
    const pod = building(ctx, { ...inner, h: 9, style: 'glass', tint: '#d4dde8', shop: true });
    const t = building(ctx, { ...inset(inner, 8), h: 124, base: pod.h, style: 'glass', tint: '#8ea6c4', collide: false });
    const crown = building(ctx, { ...inset(inner, 12.5), h: 136, base: t.h, style: 'glass', tint: '#a9bad2', collide: false });
    B.trim.addBox({ cx: (crown.x0 + crown.x1) / 2, cz: (crown.z0 + crown.z1) / 2, y0: crown.h, sx: 0.5, sz: 0.5, sy: 14, color: '#e8e8e8' });
    sign(signs, 'CALLOWAY COASTAL', '#101820', '#ffd166', '#ff6f61', '', (t.x0 + t.x1) / 2, 116, t.z1 + 0.25, 22, 0);
    sign(signs, 'CALLOWAY COASTAL', '#101820', '#ffd166', '#ff6f61', '', t.x0 - 0.25, 116, (t.z0 + t.z1) / 2, 22, -Math.PI / 2);
  },
  brandt(ctx, r) {
    const { B, signs, spots } = ctx;
    forecourt(B, r.x0 + 3.2, r.z0 + 3.2, r.x1 - 3.2, r.z0 + 16);
    building(ctx, { x0: r.x0 + 3.4, z0: r.z0 + 16, x1: r.x1 - 3.4, z1: r.z1 - 3.4, h: 9, style: 'warehouse', tint: '#ecd9bd' });
    doorway(B, -96, r.z0 + 15.95, 20, 5.6, Math.PI);
    sign(signs, 'BRANDT MOTORS', '#1d3557', '#ffd166', '#ff6f61', 'REPAIRS · CUSTOM · NO QUESTIONS', -96, 7.4, r.z0 + 15.9, 15, Math.PI);
    spots.parkedCars.push({ type: 'pelican', x: r.x0 + 8, z: r.z0 + 9, yaw: 0.3 });
  },
  freshcoat(ctx, r) {
    const { B, signs } = ctx;
    forecourt(B, r.x0 + 3.2, r.z1 - 16, r.x1 - 3.2, r.z1 - 3.2);
    building(ctx, { x0: r.x0 + 4, z0: r.z0 + 3.4, x1: r.x1 - 4, z1: r.z1 - 16, h: 7.5, style: 'stucco', tint: '#ffd166' });
    doorway(B, (r.x0 + r.x1) / 2, r.z1 - 15.95, 14, 5, 0);
    sign(signs, 'FRESH COAT', '#2ec4b6', '#ffffff', '#ff6f61', 'PAINT & BODY · HEAT GONE IN 60s', (r.x0 + r.x1) / 2, 9.6, r.z1 - 15.8, 16, 0);
  },
  svpd(ctx, r) {
    const { B, signs, spots } = ctx;
    forecourt(B, r.x0 + 3.2, r.z1 - 15, r.x1 - 3.2, r.z1 - 3.2);
    const b = building(ctx, { x0: r.x0 + 5, z0: r.z0 + 5, x1: r.x1 - 5, z1: r.z1 - 15, h: 12, style: 'stucco', tint: '#e7efff' });
    sign(signs, 'SVPD', '#1d3557', '#ffffff', '#e63946', 'SUNVALE POLICE DEPARTMENT', (b.x0 + b.x1) / 2, 14.6, b.z1 - 0.8, 12, 0);
    spots.parkedCars.push({ type: 'cruiser', x: r.x0 + 12, z: r.z1 - 9, yaw: Math.PI / 2 }, { type: 'cruiser', x: r.x1 - 12, z: r.z1 - 9, yaw: -Math.PI / 2 });
  },
  general(ctx, r) {
    const { B, signs } = ctx;
    forecourt(B, r.x0 + 3.2, r.z1 - 13, r.x1 - 3.2, r.z1 - 3.2);
    const b = building(ctx, { x0: r.x0 + 4, z0: r.z0 + 4, x1: r.x1 - 4, z1: r.z1 - 13, h: 22, style: 'stucco', tint: '#f4fbff' });
    const t = building(ctx, { x0: b.x0 + 6, z0: b.z0 + 4, x1: b.x1 - 6, z1: b.z1 - 4, h: 30, base: 22, style: 'stucco', tint: '#e6f6f6', collide: false });
    sign(signs, 'SUNVALE GENERAL', '#ffffff', '#0f8b8d', '#0f8b8d', 'HOSPITAL', (t.x0 + t.x1) / 2, 32.4, t.z1 - 0.8, 16, 0);
  },
};

// ---------- ground, beach, docks ----------
function buildGroundAndBeach({ B }) {
  B.grass.addFlat(BEACH_X, -470, 520, DOCK_Z, -0.02, 8);
  const xs = [BEACH_X, -380, -392, -404, -420, -520], ys = [0, 0, -0.2, -0.7, -1.6, -4];
  for (let z = -470; z < HARBOR_Z; z += 41) {
    const z1 = Math.min(z + 41, HARBOR_Z);
    for (let k = 0; k < xs.length - 1; k++) {
      const xa = xs[k], xb = xs[k + 1], ya = ys[k], yb = ys[k + 1];
      B.sand.addQuad([xb, yb, z1], [xa, ya, z1], [xa, ya, z], [xb, yb, z], [xb / 6, -z1 / 6, xa / 6, -z / 6]);
    }
  }
}

function buildDocks({ B, statics, spots, rng }) {
  B.concrete.addFlat(BEACH_X, DOCK_Z, 520, HARBOR_Z, 0.01, 6);
  B.concrete.addQuad([BEACH_X, -3, HARBOR_Z], [520, -3, HARBOR_Z], [520, 0.01, HARBOR_Z], [BEACH_X, 0.01, HARBOR_Z], [0, 0, 100, 0.5]);
  for (let x = -300; x < 330; x += 15) {
    if (rng.chance(0.3)) continue;
    spots.containers.push({ x, z: 336.5, y: 0.01, rotY: 0, color: rng.pick(CONTAINER_COLORS), stack: rng.int(1, 3) });
    if (rng.chance(0.5)) spots.containers.push({ x: x + 2, z: 343.5, y: 0.01, rotY: 0, color: rng.pick(CONTAINER_COLORS), stack: rng.int(1, 2) });
  }
  for (const x of [-150, 60, 250]) spots.cranes.push({ x, z: 346 });
  for (let x = -320; x < 340; x += 9) B.trim.addBox({ cx: x, cz: HARBOR_Z - 0.6, y0: 0, sx: 0.45, sz: 0.45, sy: 0.6, color: '#2d2d33' });
  statics.add(-600, HARBOR_Z - 0.2, 600, HARBOR_Z + 2, -5, 0.8, 'dock-edge');
}

// ---------- meshes ----------
function createMeshes(scene, B) {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  const t = getTexture;
  const M = {
    stucco: std({ map: t('stucco'), vertexColors: true, roughness: 0.85 }),
    deco: std({ map: t('deco'), vertexColors: true, roughness: 0.65 }),
    glass: std({ map: t('glass'), vertexColors: true, roughness: 0.18, metalness: 0.45, envMapIntensity: 1.2 }),
    warehouse: std({ map: t('warehouse'), vertexColors: true }),
    villa: std({ map: t('villa'), vertexColors: true, roughness: 0.8 }),
    shop: std({ map: t('shop'), roughness: 0.55 }),
    roof: std({ map: t('roof'), vertexColors: true }),
    road: std({ map: t('road'), roughness: 0.92 }),
    crossing: std({ map: t('crossing'), roughness: 0.92 }),
    sidewalk: std({ map: t('sidewalk') }),
    grass: std({ map: t('grass') }),
    plaza: std({ map: t('plaza'), roughness: 0.8 }),
    concrete: std({ map: t('concrete') }),
    sand: std({ map: t('sand'), roughness: 1 }),
    dark: std({ color: 0x15161b, roughness: 0.6 }),
    trim: std({ vertexColors: true, roughness: 0.6, metalness: 0.2 }),
    pool: std({ color: 0x3fc6e0, roughness: 0.05, metalness: 0.2, emissive: 0x0b4652 }),
  };
  const casters = new Set(['stucco', 'deco', 'glass', 'warehouse', 'villa', 'shop', 'roof', 'trim']);
  for (const [k, b] of Object.entries(B)) {
    if (b.empty) continue;
    const m = new THREE.Mesh(b.build(), M[k]);
    m.receiveShadow = true;
    m.castShadow = casters.has(k);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    m.name = `city-${k}`;
    scene.add(m);
  }
}

function createSigns(scene, signs) {
  const back = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.8 });
  for (const s of signs) {
    const map = makeSignTexture(s.text, { bg: s.bg, fg: s.fg, accent: s.accent, sub: s.sub });
    const mat = new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.28, roughness: 0.5 });
    const geo = new THREE.PlaneGeometry(s.w, s.h);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(s.x, s.y, s.z);
    m.rotation.y = s.rotY;
    const b = new THREE.Mesh(geo, back);
    b.rotation.y = Math.PI; b.position.z = -0.06;
    m.add(b);
    scene.add(m);
  }
}
