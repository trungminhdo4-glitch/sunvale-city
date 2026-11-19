// Sunvale's own cars: specs and low-poly models extruded from side profiles (sedan, hatch, sport, pickup, SUV, van).
import * as THREE from 'three';
import { getTexture, makeSignTexture } from '../world/textures.js';

export const VEHICLE_TYPES = {
  brisa: { name: 'Brisa Hatch', style: 'hatch', len: 3.9, wid: 1.76, hgt: 1.48, wheelR: 0.33, maxSpeed: 40, accel: 13, grip: 9, mass: 1000, health: 800, colors: ['#f2b134', '#59c3c3', '#f25f5c', '#ffffff', '#7a9e7e', '#c3a6ff'] },
  marlin: { name: 'Marlin Sedan', style: 'sedan', len: 4.6, wid: 1.86, hgt: 1.42, wheelR: 0.35, maxSpeed: 45, accel: 12, grip: 8.6, mass: 1300, health: 900, colors: ['#2e4057', '#d1d5db', '#8c2f39', '#3a6ea5', '#f4e9cd', '#1b998b'] },
  vespera: { name: 'Vespera GT', style: 'sport', len: 4.45, wid: 1.96, hgt: 1.16, wheelR: 0.36, maxSpeed: 64, accel: 21, grip: 10.5, mass: 1250, health: 900, colors: ['#e2231a', '#ffcc00', '#111111', '#ff7b00'] },
  pelican: { name: 'Pelican Pickup', style: 'pickup', len: 5.1, wid: 2.0, hgt: 1.82, wheelR: 0.42, maxSpeed: 40, accel: 11, grip: 7.6, mass: 1800, health: 1200, colors: ['#5b8c5a', '#c97b3d', '#e8e1d1', '#3d5a80', '#9c2c2c'] },
  cab: { name: 'Coastline Cab', style: 'sedan', len: 4.6, wid: 1.86, hgt: 1.44, wheelR: 0.35, maxSpeed: 45, accel: 12, grip: 8.6, mass: 1300, health: 900, colors: ['#ffd23f'], taxi: true },
  cruiser: { name: 'SVPD Cruiser', style: 'sedan', len: 4.85, wid: 1.92, hgt: 1.46, wheelR: 0.36, maxSpeed: 57, accel: 17, grip: 9.6, mass: 1500, health: 1100, colors: ['#f5f7fa'], police: true },
  regent: { name: 'Calloway Regent', style: 'suv', len: 5.2, wid: 2.1, hgt: 1.92, wheelR: 0.44, maxSpeed: 52, accel: 15, grip: 8.2, mass: 2600, health: 3400, colors: ['#1c1c22'], armored: true },
  van: { name: 'Calloway Transporter', style: 'van', len: 5.7, wid: 2.1, hgt: 2.45, wheelR: 0.4, maxSpeed: 38, accel: 9, grip: 7.2, mass: 2400, health: 1500, colors: ['#ece8dd'], livery: 'CALLOWAY COASTAL' },
};
export const CIVILIAN_TYPES = ['brisa', 'brisa', 'marlin', 'marlin', 'marlin', 'pelican', 'cab', 'vespera'];

// Side profiles as [z, y] points; z runs rear (-L/2) to front (+L/2).
function profiles(style, L, H) {
  const f = L / 2, r = -L / 2;
  switch (style) {
    case 'hatch': return {
      lower: [[r, 0.3], [f, 0.3], [f + 0.02, 0.62], [f - 0.15, 0.8], [f - 1.0, 0.9], [r + 0.15, 0.95], [r, 0.7]],
      cabin: [[f - 1.0, 0.9], [f - 1.65, H], [r + 0.4, H - 0.03], [r + 0.15, 0.95]], roof: [r + 0.45, f - 1.7] };
    case 'sport': return {
      lower: [[r, 0.28], [f, 0.28], [f + 0.04, 0.48], [f - 0.3, 0.64], [f - 1.65, 0.76], [r + 0.5, 0.8], [r, 0.74]],
      cabin: [[f - 1.65, 0.76], [f - 2.35, H], [r + 1.45, H], [r + 0.6, 0.8]], roof: [r + 1.5, f - 2.4] };
    case 'pickup': return {
      lower: [[r, 0.42], [f, 0.42], [f + 0.02, 0.86], [f - 0.2, 1.02], [f - 1.3, 1.07], [r, 1.07]],
      cabin: [[f - 1.3, 1.07], [f - 1.85, H], [f - 2.95, H], [f - 3.05, 1.07]], roof: [f - 2.9, f - 1.9] };
    case 'suv': return {
      lower: [[r, 0.44], [f, 0.44], [f + 0.02, 0.92], [f - 0.25, 1.1], [f - 1.2, 1.16], [r, 1.16]],
      cabin: [[f - 1.2, 1.16], [f - 1.75, H], [r + 0.2, H], [r + 0.05, 1.16]], roof: [r + 0.25, f - 1.8] };
    case 'van': return {
      lower: [[r, 0.42], [f, 0.42], [f + 0.02, 1.0], [f - 0.3, 1.16], [r, 1.16]],
      cabin: [[f - 0.3, 1.16], [f - 1.05, H - 0.08], [f - 1.35, H - 0.08], [f - 1.35, 1.16]], roof: [f - 1.3, f - 1.05],
      cargo: [[f - 1.35, 1.16], [f - 1.35, H], [r, H], [r, 1.16]] };
    default: return {
      lower: [[r, 0.3], [f, 0.3], [f + 0.02, 0.62], [f - 0.15, 0.8], [f - 1.15, 0.92], [r + 0.9, 0.96], [r + 0.05, 0.9], [r, 0.62]],
      cabin: [[f - 1.15, 0.92], [f - 1.9, H], [r + 1.2, H], [r + 0.75, 0.96]], roof: [r + 1.25, f - 1.95] };
  }
}

const geoCache = new Map();
function extrudeProfile(pts, width, bevel = 0.05) {
  const key = JSON.stringify(pts) + width;
  if (geoCache.has(key)) return geoCache.get(key);
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

const shared = {};
function sharedMaterials() {
  if (shared.glass) return shared;
  shared.glass = new THREE.MeshStandardMaterial({ color: 0x1a2632, roughness: 0.08, metalness: 0.7, envMapIntensity: 1.4 });
  shared.trim = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.6 });
  shared.chrome = new THREE.MeshStandardMaterial({ color: 0xd7dbe0, roughness: 0.2, metalness: 0.9 });
  shared.tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  shared.hub = new THREE.MeshStandardMaterial({ color: 0xbfc4ca, roughness: 0.3, metalness: 0.8 });
  shared.head = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff1c4, emissiveIntensity: 0.8 });
  shared.red = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 2 });
  shared.blue = new THREE.MeshStandardMaterial({ color: 0x2050ff, emissive: 0x0030ff, emissiveIntensity: 2 });
  shared.stripe = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.3 });
  shared.wreck = new THREE.MeshStandardMaterial({ color: 0x2a2522, roughness: 1 });
  return shared;
}
function addBox(parent, mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
function decal(parent, text, opts, w, h, x, y, z, rotY) {
  const mat = new THREE.MeshStandardMaterial({ map: makeSignTexture(text, { bg: 'transparent', ...opts }), transparent: true, roughness: 0.4, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = rotY; parent.add(m); return m;
}

export function buildVehicleMesh(spec, color) {
  const S = sharedMaterials();
  const L = spec.len, W = spec.wid, H = spec.hgt, R = spec.wheelR;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.45, envMapIntensity: 1.1 });
  const P = profiles(spec.style, L, H);
  const lower = new THREE.Mesh(extrudeProfile(P.lower, W), paint); lower.castShadow = true; lower.receiveShadow = true; body.add(lower);
  const cabin = new THREE.Mesh(extrudeProfile(P.cabin, W * 0.86, 0.03), S.glass); cabin.castShadow = true; body.add(cabin);
  addBox(body, paint, W * 0.86, 0.05, P.roof[1] - P.roof[0], 0, H + 0.0, (P.roof[0] + P.roof[1]) / 2);
  if (P.cargo) { const c = new THREE.Mesh(extrudeProfile(P.cargo, W), paint); c.castShadow = true; body.add(c); }

  const frontY = P.lower[2][1] - 0.12, rearY = P.lower[P.lower.length - 1][1] + 0.08;
  addBox(body, S.trim, W * 0.98, 0.16, 0.08, 0, 0.36, L / 2 + 0.03);
  addBox(body, S.trim, W * 0.98, 0.16, 0.08, 0, 0.36, -L / 2 - 0.03);
  for (const s of [-1, 1]) {
    addBox(body, S.head, 0.36, 0.13, 0.05, s * (W / 2 - 0.3), frontY, L / 2 + 0.04);
    addBox(body, S.trim, 0.06, 0.06, 0.28, s * (W / 2 + 0.03), 1.0 * (spec.style === 'van' || spec.style === 'suv' || spec.style === 'pickup' ? 1.2 : 0.95), L / 2 - 1.2);
  }
  const brake = new THREE.MeshStandardMaterial({ color: 0xc81d25, emissive: 0xff1010, emissiveIntensity: 0.5 });
  for (const s of [-1, 1]) addBox(body, brake, 0.34, 0.14, 0.05, s * (W / 2 - 0.28), rearY, -L / 2 - 0.04);
  addBox(body, S.chrome, W * 0.4, 0.14, 0.04, 0, frontY - 0.05, L / 2 + 0.06);

  const lights = { bar: null, sprites: [], brake };
  if (spec.style === 'sport') {
    addBox(body, S.trim, W * 0.9, 0.05, 0.34, 0, 0.98, -L / 2 + 0.25);
    for (const s of [-1, 1]) addBox(body, S.trim, 0.06, 0.18, 0.12, s * W * 0.32, 0.88, -L / 2 + 0.25);
  }
  if (spec.style === 'pickup') addBox(body, S.trim, W * 0.82, 0.05, L / 2 - 0.2, 0, 1.05, -L / 4 - 0.4);
  if (spec.police) {
    addBox(body, S.trim, 1.3, 0.1, 0.34, 0, H + 0.08, (P.roof[0] + P.roof[1]) / 2);
    const red = addBox(body, S.red.clone(), 0.56, 0.14, 0.3, -0.33, H + 0.2, (P.roof[0] + P.roof[1]) / 2);
    const blue = addBox(body, S.blue.clone(), 0.56, 0.14, 0.3, 0.33, H + 0.2, (P.roof[0] + P.roof[1]) / 2);
    for (const s of [-1, 1]) {
      addBox(body, S.stripe, 0.03, 0.16, L * 0.78, s * (W / 2 + 0.04), 0.62, -0.1);
      decal(body, 'SVPD', { fg: '#1d3557' }, 1.4, 0.35, s * (W / 2 + 0.06), 0.84, -0.25, s * Math.PI / 2);
    }
    addBox(body, S.trim, W * 0.98, 0.05, 1.0, 0, P.lower[3][1] + 0.0, L / 2 - 0.65);
    const glow = getTexture('glow');
    const mk = (c, x) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.position.set(x, H + 0.28, (P.roof[0] + P.roof[1]) / 2); sp.scale.set(2.6, 2.6, 1); body.add(sp); return sp;
    };
    lights.bar = { red, blue };
    lights.sprites = [mk(0xff2a2a, -0.35), mk(0x2a5cff, 0.35)];
  }
  if (spec.taxi) {
    const t = addBox(body, new THREE.MeshStandardMaterial({ map: makeSignTexture('CAB', { bg: '#ffffff', fg: '#222', w: 256, h: 64 }), emissive: 0xffffff, emissiveIntensity: 0.2 }), 0.9, 0.24, 0.3, 0, H + 0.14, (P.roof[0] + P.roof[1]) / 2);
    t.castShadow = false;
    for (const s of [-1, 1]) decal(body, 'COASTLINE CAB', { fg: '#222222' }, 2.0, 0.5, s * (W / 2 + 0.06), 0.65, 0, s * Math.PI / 2);
  }
  if (spec.livery) for (const s of [-1, 1]) decal(body, spec.livery, { fg: '#c2410c' }, 3.6, 0.9, s * (W / 2 + 0.07), 1.75, -0.6, s * Math.PI / 2);

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(R, R, 0.3, 14); wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(R * 0.6, R * 0.6, 0.32, 10); hubGeo.rotateZ(Math.PI / 2);
  const fz = L / 2 - (spec.style === 'sport' ? 0.95 : 0.85), rz = -L / 2 + 0.85;
  for (const [z, front] of [[fz, true], [rz, false]]) for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * (W / 2 - 0.16), R, z); root.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    const tire = new THREE.Mesh(wheelGeo, S.tire); tire.castShadow = true; spin.add(tire);
    spin.add(new THREE.Mesh(hubGeo, S.hub));
    wheels.push({ pivot, spin, front });
  }
  return { root, body, wheels, paint, lights };
}
