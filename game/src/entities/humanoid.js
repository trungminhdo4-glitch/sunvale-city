// Low-poly people built from boxes with pivoting limbs, plus their walk, run, aim and fall poses.
import * as THREE from 'three';

const boxCache = new Map();
const matCache = new Map();
function box(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!boxCache.has(k)) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, -h / 2, 0); boxCache.set(k, g); }
  return boxCache.get(k);
}
export function flatMaterial(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  return matCache.get(color);
}
function part(parent, geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, flatMaterial(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function createHumanoid(look) {
  const { skin = '#c68e64', shirt = '#2ec4b6', pants = '#33415c', hair = '#2b1d14', shoes = '#1d1d1f', hat = null, build = 1 } = look;
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  part(torso, box(0.46 * build, 0.62, 0.27), shirt, 0, 0.62, 0);
  part(torso, box(0.47 * build, 0.08, 0.28), pants, 0, 0.04, 0);
  const head = new THREE.Group(); head.position.y = 0.66; torso.add(head);
  part(head, box(0.13, 0.08, 0.13), skin, 0, 0.08, 0);
  part(head, box(0.25, 0.28, 0.26), skin, 0, 0.36, 0);
  part(head, box(0.27, 0.09, 0.28), hair, 0, 0.38, -0.01);
  part(head, box(0.27, 0.2, 0.08), hair, 0, 0.33, -0.11);
  if (hat) part(head, box(0.32, 0.08, 0.36), hat, 0, 0.42, 0.03);
  part(head, box(0.05, 0.035, 0.02), '#111111', -0.06, 0.24, 0.13);
  part(head, box(0.05, 0.035, 0.02), '#111111', 0.06, 0.24, 0.13);

  const limb = (x, y, upper, lower, w, lenU, lenL, parent) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); parent.add(pivot);
    part(pivot, box(w, lenU, w + 0.02), upper, 0, 0, 0);
    const knee = new THREE.Group(); knee.position.y = -lenU; pivot.add(knee);
    part(knee, box(w * 0.92, lenL, w * 0.95), lower, 0, 0, 0);
    return { pivot, knee };
  };
  const armL = limb(-0.29 * build, 0.6, shirt, skin, 0.12, 0.3, 0.3, torso);
  const armR = limb(0.29 * build, 0.6, shirt, skin, 0.12, 0.3, 0.3, torso);
  const legL = limb(-0.12, 0, pants, pants, 0.17, 0.47, 0.44, hips);
  const legR = limb(0.12, 0, pants, pants, 0.17, 0.47, 0.44, hips);
  part(legL.knee, box(0.18, 0.08, 0.3), shoes, 0, -0.42, 0.05);
  part(legR.knee, box(0.18, 0.08, 0.3), shoes, 0, -0.42, 0.05);
  const gun = part(armR.knee, box(0.07, 0.12, 0.3), '#1a1a1a', 0, -0.3, 0.1);
  gun.visible = false;
  return { root, hips, torso, head, armL, armR, legL, legR, gun };
}

// mode: idle | walk | run | aim | punch | dead | cower
export function animateHumanoid(h, phase, speed01, mode, t = 0) {
  const swing = Math.sin(phase) * (0.12 + 0.85 * speed01);
  const lift = Math.max(0, Math.sin(phase + 1.2)) * 0.9 * speed01;
  const lift2 = Math.max(0, Math.sin(phase + 1.2 + Math.PI)) * 0.9 * speed01;
  h.legL.pivot.rotation.x = swing; h.legR.pivot.rotation.x = -swing;
  h.legL.knee.rotation.x = lift; h.legR.knee.rotation.x = lift2;
  h.hips.position.y = 0.95 + Math.abs(Math.sin(phase)) * 0.06 * speed01;
  h.torso.rotation.x = mode === 'run' ? 0.18 : 0.03 * speed01;
  h.torso.rotation.y = 0;
  if (mode === 'aim') {
    h.armR.pivot.rotation.set(-Math.PI / 2 + 0.05, 0, 0); h.armR.knee.rotation.x = 0;
    h.armL.pivot.rotation.set(-Math.PI / 2 + 0.25, 0, -0.55); h.armL.knee.rotation.x = -0.2;
    h.torso.rotation.y = 0.15;
  } else if (mode === 'punch') {
    const p = Math.sin(Math.min(1, t) * Math.PI);
    h.armR.pivot.rotation.set(-1.3 - p * 0.3, 0, 0); h.armR.knee.rotation.x = -1.2 + p * 1.1;
    h.armL.pivot.rotation.set(-1.1, 0, -0.3); h.armL.knee.rotation.x = -1.6;
  } else if (mode === 'cower') {
    h.armL.pivot.rotation.set(-2.5, 0, 0.4); h.armR.pivot.rotation.set(-2.5, 0, -0.4);
    h.armL.knee.rotation.x = -1.4; h.armR.knee.rotation.x = -1.4;
  } else {
    h.armL.pivot.rotation.set(-swing * 0.9, 0, 0.06); h.armR.pivot.rotation.set(swing * 0.9, 0, -0.06);
    h.armL.knee.rotation.x = -0.25 - 0.6 * speed01; h.armR.knee.rotation.x = -0.25 - 0.6 * speed01;
  }
  if (mode === 'idle') h.torso.rotation.x = Math.sin(t * 1.3) * 0.015;
}
