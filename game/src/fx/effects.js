// Particles and flashes from one sprite pool: muzzle flash, tracers, sparks, blood, smoke,
// fire and explosions, plus skid marks on the asphalt.

import * as THREE from 'three';
import { softDotTexture } from '../render/textures.js';
import { rng } from '../core/rng.js';

const POOL = 360;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const tex = softDotTexture();
    this.add = [];
    this.norm = [];
    for (let k = 0; k < POOL; k++) {
      const additive = k < POOL / 2;
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
      const s = new THREE.Sprite(m);
      s.visible = false;
      scene.add(s);
      (additive ? this.add : this.norm).push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 0, g: 0 });
    }
    this.ai = 0; this.ni = 0;
    // tracers: short line segments
    this.tracers = [];
    for (let k = 0; k < 24; k++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true }));
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }
    this.ti = 0;
    // skid marks: a ring buffer of dark quads
    this.skidGeo = new THREE.PlaneGeometry(0.32, 1.2);
    this.skidGeo.rotateX(-Math.PI / 2);
    this.skidMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.skids = new THREE.InstancedMesh(this.skidGeo, this.skidMat, 600);
    this.skids.count = 0;
    this.skids.frustumCulled = false;
    this.skidIndex = 0;
    scene.add(this.skids);
    this.tmpM = new THREE.Matrix4();
    this.tmpQ = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  spawn(additive, x, y, z, { color = 0xffffff, size = 1, life = 0.5, vx = 0, vy = 0, vz = 0, grow = 0, g = 0, opacity = 1 }) {
    const list = additive ? this.add : this.norm;
    const p = additive ? list[this.ai++ % list.length] : list[this.ni++ % list.length];
    p.s.visible = true;
    p.s.position.set(x, y, z);
    p.s.scale.setScalar(size);
    p.s.material.color.setHex(color);
    p.s.material.opacity = opacity;
    p.base = opacity;
    p.life = life; p.max = life;
    p.vx = vx; p.vy = vy; p.vz = vz; p.grow = grow; p.g = g;
  }

  muzzle(x, y, z) {
    this.spawn(true, x, y, z, { color: 0xffc860, size: 0.9, life: 0.06 });
    this.spawn(true, x, y, z, { color: 0xffffff, size: 0.4, life: 0.05 });
  }

  tracer(ax, ay, az, bx, by, bz) {
    const t = this.tracers[this.ti++ % this.tracers.length];
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, ax, ay, az); pos.setXYZ(1, bx, by, bz);
    pos.needsUpdate = true;
    t.line.geometry.computeBoundingSphere();
    t.line.visible = true;
    t.life = 0.07;
  }

  sparks(x, y, z, n = 6) {
    for (let k = 0; k < n; k++) this.spawn(true, x, y, z, { color: 0xffd27a, size: 0.18, life: rng.range(0.2, 0.45), vx: rng.range(-5, 5), vy: rng.range(1, 6), vz: rng.range(-5, 5), g: 14 });
  }

  blood(x, y, z) {
    for (let k = 0; k < 6; k++) this.spawn(false, x, y, z, { color: 0x8a0f12, size: 0.25, life: rng.range(0.3, 0.6), vx: rng.range(-2, 2), vy: rng.range(0, 3), vz: rng.range(-2, 2), g: 10 });
  }

  puff(x, y, z) {
    this.spawn(false, x, y, z, { color: 0xd8d0c4, size: 0.6, life: 0.6, vy: 0.6, grow: 1.4, opacity: 0.5 });
  }

  smoke(x, y, z, fire) {
    if (fire) this.spawn(true, x + rng.range(-0.6, 0.6), y, z + rng.range(-0.6, 0.6), { color: rng.pick([0xff7a1a, 0xffb02e, 0xff4a10]), size: rng.range(1.0, 1.8), life: rng.range(0.3, 0.6), vy: 3, grow: -1 });
    this.spawn(false, x + rng.range(-0.5, 0.5), y + 0.6, z + rng.range(-0.5, 0.5), { color: fire ? 0x2a2622 : 0x5a5650, size: rng.range(1, 1.6), life: rng.range(1.6, 2.6), vx: rng.range(-0.4, 0.8), vy: rng.range(2, 3.2), vz: rng.range(-0.4, 0.4), grow: 1.6, opacity: 0.6 });
  }

  explosion(x, y, z) {
    for (let k = 0; k < 26; k++) this.spawn(true, x, y + 1, z, { color: rng.pick([0xffe08a, 0xff9a2e, 0xff5a1a]), size: rng.range(2, 4.5), life: rng.range(0.4, 0.9), vx: rng.range(-9, 9), vy: rng.range(2, 12), vz: rng.range(-9, 9), grow: 2, g: 6 });
    for (let k = 0; k < 18; k++) this.spawn(false, x, y + 1.5, z, { color: 0x302a26, size: rng.range(2.5, 4), life: rng.range(1.5, 3), vx: rng.range(-4, 4), vy: rng.range(2, 6), vz: rng.range(-4, 4), grow: 2.4, opacity: 0.7 });
    this.sparks(x, y + 1, z, 20);
  }

  /** Skid mark under a wheel. */
  skid(x, z, heading) {
    this.tmpQ.setFromAxisAngle(this.up, heading);
    this.tmpM.compose(new THREE.Vector3(x, 0.06, z), this.tmpQ, new THREE.Vector3(1, 1, 1));
    this.skids.setMatrixAt(this.skidIndex % 600, this.tmpM);
    this.skidIndex++;
    this.skids.count = Math.min(600, this.skidIndex);
    this.skids.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    for (const list of [this.add, this.norm]) for (const p of list) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.vy -= p.g * dt;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      if (p.s.position.y < 0.05) { p.s.position.y = 0.05; p.vy *= -0.3; }
      p.s.scale.multiplyScalar(1 + p.grow * dt);
      p.s.material.opacity = p.base * Math.min(1, (p.life / p.max) * 1.6);
    }
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.line.visible = false; }
  }
}
