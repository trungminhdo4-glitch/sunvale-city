// Particle effects on the GPU as point sprites: muzzle flashes, tracers, sparks, blood, smoke, fire, explosions.
import * as THREE from 'three';
import { getTexture } from '../world/textures.js';
import { rng } from '../core/rng.js';

const VERT = /* glsl */`
attribute float size; attribute vec4 rgba;
uniform float uScale;
varying vec4 vColor;
void main() {
  vColor = rgba;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
uniform sampler2D uMap;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  #include <colorspace_fragment>
}`;

class ParticlePool {
  constructor(scene, max, blending) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
    this.a0 = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr); g.setAttribute('rgba', this.colAttr); g.setAttribute('size', this.sizeAttr);
    g.setDrawRange(0, 0);
    this.uniforms = { uMap: { value: getTexture('glow') }, uScale: { value: 600 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = g;
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, a0, grav = 0, drag = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = 0; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.c0.set(c0, i * 3); this.c1.set(c1, i * 3); this.a0[i] = a0; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      const t = this.life[i] / this.maxLife[i];
      if (t >= 1) { this.kill(i); continue; }
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      for (let c = 0; c < 3; c++) this.col[i * 4 + c] = this.c0[i * 3 + c] + (this.c1[i * 3 + c] - this.c0[i * 3 + c]) * t;
      this.col[i * 4 + 3] = this.a0[i] * (1 - t) * Math.min(1, t * 12 + 0.2);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.posAttr.needsUpdate = this.colAttr.needsUpdate = this.sizeAttr.needsUpdate = true;
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    const copy = (arr, w) => { for (let c = 0; c < w; c++) arr[i * w + c] = arr[j * w + c]; };
    copy(this.pos, 3); copy(this.vel, 3); copy(this.col, 4); copy(this.c0, 3); copy(this.c1, 3);
    for (const a of [this.size, this.life, this.maxLife, this.s0, this.s1, this.a0, this.grav, this.drag]) a[i] = a[j];
  }
}

const C = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const FIRE0 = C('#fff2b0'), FIRE1 = C('#ff4a10'), SMOKE0 = C('#5a5552'), SMOKE1 = C('#2a2827'), WHITE = C('#ffffff');
const SPARK0 = C('#fff4c0'), SPARK1 = C('#ff9a30'), BLOOD = C('#8a0c0c'), DUST0 = C('#cbbba3'), DUST1 = C('#a89a86');
const GOLD0 = C('#fff7c2'), GOLD1 = C('#ffb000'), WATER = C('#dff8ff');

export class FxSystem {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.add = new ParticlePool(scene, 2500, THREE.AdditiveBlending);
    this.norm = new ParticlePool(scene, 2500, THREE.NormalBlending);
    this.tracers = [];
    const lineGeo = new THREE.BufferGeometry();
    this.tracerPos = new Float32Array(64 * 6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracerLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracerLines.frustumCulled = false;
    scene.add(this.tracerLines);
    this.flash = new THREE.PointLight(0xffa040, 0, 40, 1.6);
    scene.add(this.flash);
    this.flashT = 0;
    this.waves = [];
    const waveMat = new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), waveMat.clone());
      m.visible = false; scene.add(m); this.waves.push({ m, t: 1 });
    }
  }

  setScale(viewHeight, fovDeg) {
    const s = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    this.add.uniforms.uScale.value = s; this.norm.uniforms.uScale.value = s;
  }

  tracer(a, b) {
    this.tracers.push({ ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, t: 0.07 });
    if (this.tracers.length > 64) this.tracers.shift();
  }
  muzzleFlash(p) {
    this.add.spawn(p.x, p.y, p.z, 0, 0, 0, 0.06, 1.1, 0.4, FIRE0, FIRE1, 1);
    this.flashLight(p.x, p.y, p.z, 6, 0.05);
  }
  flashLight(x, y, z, intensity, time) {
    if (intensity < this.flash.intensity) return;
    this.flash.position.set(x, y, z); this.flash.intensity = intensity * 60; this.flashT = time;
  }
  sparks(x, y, z, n = 8) {
    for (let k = 0; k < n; k++) this.add.spawn(x, y, z, rng.range(-5, 5), rng.range(1, 6), rng.range(-5, 5), rng.range(0.2, 0.45), 0.25, 0.05, SPARK0, SPARK1, 1, 14, 1);
  }
  blood(x, y, z) {
    for (let k = 0; k < 8; k++) this.norm.spawn(x, y, z, rng.range(-1.5, 1.5), rng.range(0, 2), rng.range(-1.5, 1.5), rng.range(0.3, 0.6), 0.35, 0.15, BLOOD, BLOOD, 0.9, 9, 2);
  }
  impactDust(x, y, z, n = [0, 1, 0]) {
    for (let k = 0; k < 5; k++) this.norm.spawn(x, y, z, n[0] * 2 + rng.range(-1, 1), n[1] * 2 + rng.range(0, 1.5), n[2] * 2 + rng.range(-1, 1), rng.range(0.4, 0.8), 0.3, 1.0, DUST0, DUST1, 0.7, 1, 3);
    this.add.spawn(x, y, z, 0, 0, 0, 0.08, 0.5, 0.2, SPARK0, SPARK1, 0.8);
  }
  engineSmoke(v, h) {
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const x = v.pos.x + fx * v.spec.len * 0.38, z = v.pos.z + fz * v.spec.len * 0.38, y = v.pos.y + v.spec.hgt * 0.7;
    const dark = h < 0.2;
    this.norm.spawn(x, y, z, rng.range(-0.4, 0.4) - v.vx * 0.2, rng.range(1.5, 2.6), rng.range(-0.4, 0.4) - v.vz * 0.2, rng.range(1.4, 2.4), 0.8, 3.2,
      dark ? SMOKE0 : DUST0, dark ? SMOKE1 : DUST1, dark ? 0.75 : 0.45, -0.4, 0.6);
    if (v.burnTime > 0) for (let k = 0; k < 3; k++) this.add.spawn(x + rng.range(-0.5, 0.5), y, z + rng.range(-0.5, 0.5), rng.range(-0.3, 0.3), rng.range(1.5, 3.5), rng.range(-0.3, 0.3), rng.range(0.35, 0.7), 1.3, 0.4, FIRE0, FIRE1, 1, -1, 1);
  }
  explosion(x, y, z) {
    for (let k = 0; k < 95; k++) {
      const a = rng.range(0, Math.PI * 2), e = rng.range(-0.2, 1), s = rng.range(4, 16);
      this.add.spawn(x, y, z, Math.cos(a) * s * Math.cos(e), Math.sin(e) * s + 2, Math.sin(a) * s * Math.cos(e), rng.range(0.5, 1.1), rng.range(3.5, 6), 0.8, FIRE0, FIRE1, 1, 2, 2.5);
    }
    for (let k = 0; k < 40; k++) {
      const a = rng.range(0, Math.PI * 2), s = rng.range(1, 6);
      this.norm.spawn(x, y + 1, z, Math.cos(a) * s, rng.range(2, 7), Math.sin(a) * s, rng.range(2, 4), 2.5, 7, SMOKE0, SMOKE1, 0.8, -0.5, 0.9);
    }
    this.sparks(x, y, z, 30);
    this.flashLight(x, y + 2, z, 30, 0.35);
    const w = this.waves.find((q) => q.t >= 1) ?? this.waves[0];
    w.t = 0; w.m.position.set(x, y, z); w.m.visible = true;
  }
  splashOfGold(x, y, z) {
    for (let k = 0; k < 40; k++) this.add.spawn(x, y, z, rng.range(-3, 3), rng.range(2, 7), rng.range(-3, 3), rng.range(0.6, 1.2), 0.5, 0.1, GOLD0, GOLD1, 1, 6, 1);
  }
  fountainSpray(x, y, z) {
    this.norm.spawn(x + rng.range(-0.1, 0.1), y, z + rng.range(-0.1, 0.1), rng.range(-1.2, 1.2), rng.range(3.5, 4.5), rng.range(-1.2, 1.2), 0.9, 0.25, 0.4, WATER, WATER, 0.7, 9.8, 0);
  }
  skid(x, y, z) { this.norm.spawn(x, y + 0.2, z, rng.range(-0.3, 0.3), rng.range(0.3, 0.8), rng.range(-0.3, 0.3), 1.0, 0.7, 2.4, WHITE, DUST1, 0.35, -0.2, 1); }

  update(dt) {
    this.add.update(dt); this.norm.update(dt);
    const tp = this.tracerPos;
    tp.fill(0);
    this.tracers = this.tracers.filter((t) => (t.t -= dt) > 0);
    this.tracers.forEach((t, i) => { tp.set([t.ax, t.ay, t.az, t.bx, t.by, t.bz], i * 6); });
    this.tracerLines.geometry.attributes.position.needsUpdate = true;
    this.tracerLines.geometry.setDrawRange(0, this.tracers.length * 2);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.intensity = 0; } else this.flash.intensity *= 0.8;
    for (const w of this.waves) {
      if (w.t >= 1) continue;
      w.t += dt * 2.2;
      const s = 1 + w.t * 11;
      w.m.scale.set(s, s * 0.6, s);
      w.m.material.opacity = 0.55 * (1 - w.t);
      if (w.t >= 1) w.m.visible = false;
    }
    for (const v of this.game.vehicles) {
      if (!v.wrecked) continue;
      v.wreckAge = (v.wreckAge ?? 0) + dt;
      if (v.wreckAge < 25 && rng.chance(dt * 8)) {
        this.norm.spawn(v.pos.x + rng.range(-1, 1), v.pos.y + 1.2, v.pos.z + rng.range(-1, 1), rng.range(-0.3, 0.3), rng.range(1.5, 3), rng.range(-0.3, 0.3), 3, 1.2, 5, SMOKE0, SMOKE1, 0.6, -0.3, 0.5);
        if (v.wreckAge < 10) this.add.spawn(v.pos.x + rng.range(-1, 1), v.pos.y + 0.9, v.pos.z + rng.range(-1, 1), 0, rng.range(1, 3), 0, 0.6, 1.4, 0.4, FIRE0, FIRE1, 0.9, -1, 1);
      }
    }
  }
}
