// Low-poly people: one rig for the hero, civilians, police and thugs, with walk, run, aim and fall poses.

import * as THREE from 'three';

const geo = {
  torso: new THREE.BoxGeometry(0.5, 0.62, 0.28),
  hips: new THREE.BoxGeometry(0.46, 0.2, 0.26),
  head: new THREE.BoxGeometry(0.26, 0.3, 0.28),
  hair: new THREE.BoxGeometry(0.28, 0.1, 0.3),
  cap: new THREE.BoxGeometry(0.3, 0.08, 0.36),
  limb: new THREE.BoxGeometry(0.15, 0.62, 0.16),
  leg: new THREE.BoxGeometry(0.19, 0.8, 0.2),
  shoe: new THREE.BoxGeometry(0.2, 0.1, 0.3),
  gun: new THREE.BoxGeometry(0.07, 0.12, 0.34),
};
geo.limb.translate(0, -0.29, 0);
geo.leg.translate(0, -0.4, 0);
geo.shoe.translate(0, -0.82, 0.05);

const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}

export const SKIN = [0xf1c8a0, 0xd9a47a, 0xb07a52, 0x8a5a3a, 0x6a4128, 0xf7d9bd];
export const CLOTH = [0xe85d75, 0x4aa3df, 0xf6c445, 0x55c595, 0xffffff, 0x2f3e57, 0xf08a4b, 0x9b6bd1, 0x3fb8af, 0xe5e1d8];

/**
 * look: { skin, shirt, pants, hair, cap?, badge? }
 */
export function createHumanoid(look) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const add = (g, color, x, y, z, parent = body) => {
    const m = new THREE.Mesh(g, mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const hips = add(geo.hips, look.pants, 0, 0.92, 0);
  const torso = add(geo.torso, look.shirt, 0, 1.34, 0);
  const head = add(geo.head, look.skin, 0, 1.83, 0);
  add(geo.hair, look.hair, 0, 0.16, -0.01, head);
  if (look.cap) add(geo.cap, look.cap, 0, 0.19, 0.04, head);
  if (look.badge) add(new THREE.BoxGeometry(0.1, 0.1, 0.02), look.badge, 0.13, 0.12, 0.15, torso);

  const pivot = (x, y) => { const g = new THREE.Group(); g.position.set(x, y, 0); body.add(g); return g; };
  const armL = pivot(0.33, 1.6), armR = pivot(-0.33, 1.6);
  add(geo.limb, look.shirt, 0, 0, 0, armL);
  add(geo.limb, look.shirt, 0, 0, 0, armR);
  add(new THREE.BoxGeometry(0.13, 0.14, 0.14), look.skin, 0, -0.62, 0, armL);
  add(new THREE.BoxGeometry(0.13, 0.14, 0.14), look.skin, 0, -0.62, 0, armR);
  const legL = pivot(0.12, 0.86), legR = pivot(-0.12, 0.86);
  add(geo.leg, look.pants, 0, 0, 0, legL);
  add(geo.leg, look.pants, 0, 0, 0, legR);
  add(geo.shoe, 0x2a2a2a, 0, 0, 0, legL);
  add(geo.shoe, 0x2a2a2a, 0, 0, 0, legR);
  const gun = add(geo.gun, 0x222222, 0, -0.62, 0.16, armR);
  gun.visible = false;

  let phase = 0;
  return {
    root, body, head, torso, gun,
    /** speed in m/s; aiming raises the right arm. */
    animate(dt, speed, aiming = false) {
      if (body.rotation.x !== 0) return;
      phase += dt * (2.2 + speed * 1.25);
      const amp = Math.min(1, speed / 6) * 0.9;
      const s = Math.sin(phase) * amp;
      legL.rotation.x = s;
      legR.rotation.x = -s;
      armL.rotation.x = -s * 0.8;
      armR.rotation.x = aiming ? -1.45 : s * 0.8;
      armR.rotation.z = 0;
      body.position.y = Math.abs(Math.cos(phase)) * amp * 0.08;
      torso.rotation.y = s * 0.12;
    },
    /** Arms-up idle used for hands up / dancing ped flavour. */
    cheer(t) {
      armL.rotation.x = armR.rotation.x = -2.8 + Math.sin(t * 8) * 0.25;
    },
    fall() {
      body.rotation.x = -Math.PI / 2;
      body.position.y = 0.18;
      legL.rotation.x = legR.rotation.x = 0;
      armL.rotation.x = -2.6; armR.rotation.x = -2.2;
    },
    stand() { body.rotation.x = 0; body.position.y = 0; },
  };
}
