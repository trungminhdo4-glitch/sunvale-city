// The golden afternoon: 15:00 to 19:30 on a loop. Drives sun direction, light colours, sky and fog.
import * as THREE from 'three';
import { DAY } from '../core/config.js';
import { clamp } from '../core/mathUtil.js';

// Colour keys at 15:00, 17:30 and 19:30.
const KEYS = [
  { h: 15.0, el: 40, sun: '#fff0d2', si: 3.1, top: '#3c8ee6', hor: '#ffe2b5', hemiS: '#cfe3ff', hemiG: '#c7a07a', hi: 1.15, fog: '#f3d6b4', exp: 0.95 },
  { h: 17.5, el: 17, sun: '#ffc27a', si: 2.9, top: '#4a7fd1', hor: '#ffb98a', hemiS: '#ffd9b8', hemiG: '#a8746a', hi: 1.0, fog: '#f1b98f', exp: 1.0 },
  { h: 19.5, el: 2, sun: '#ff7a3d', si: 1.7, top: '#3d3a8a', hor: '#ff8a6b', hemiS: '#e9a7a0', hemiG: '#5b3f5a', hi: 0.75, fog: '#d9897a', exp: 1.08 },
];

export class DayCycle {
  constructor(scene, renderer) {
    this.renderer = renderer;
    this.hour = 16.5;
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = -95; cam.right = 95; cam.top = 95; cam.bottom = -95; cam.near = 5; cam.far = 600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.5;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1);
    scene.add(this.hemi);
    this.fog = new THREE.Fog(0xffffff, 180, 900);
    scene.fog = this.fog;
    this.state = { sunDir: new THREE.Vector3(), sunColor: new THREE.Color(), skyTop: new THREE.Color(), skyHorizon: new THREE.Color() };
    this.c1 = new THREE.Color(); this.c2 = new THREE.Color();
    this.apply();
  }

  advance(dt) {
    this.hour += dt * DAY.hoursPerSecond;
    if (this.hour > DAY.end) this.hour = DAY.start;
  }
  setHour(h) { this.hour = clamp(h, DAY.start, DAY.end); this.apply(); }

  mixKey(field, t, a, b, out) { return out.copy(this.c1.set(a[field])).lerp(this.c2.set(b[field]), t); }

  apply() {
    const h = this.hour;
    const k = h < KEYS[1].h ? 0 : 1;
    const a = KEYS[k], b = KEYS[k + 1];
    const t = clamp((h - a.h) / (b.h - a.h), 0, 1);
    const el = THREE.MathUtils.degToRad(a.el + (b.el - a.el) * t);
    const s = this.state;
    s.sunDir.set(-Math.cos(el) * 0.9, Math.sin(el), Math.cos(el) * 0.42).normalize();
    this.mixKey('sun', t, a, b, s.sunColor);
    this.mixKey('top', t, a, b, s.skyTop);
    this.mixKey('hor', t, a, b, s.skyHorizon);
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = a.si + (b.si - a.si) * t;
    this.mixKey('hemiS', t, a, b, this.hemi.color);
    this.mixKey('hemiG', t, a, b, this.hemi.groundColor);
    this.hemi.intensity = a.hi + (b.hi - a.hi) * t;
    this.mixKey('fog', t, a, b, this.fog.color);
    this.renderer.toneMappingExposure = a.exp + (b.exp - a.exp) * t;
  }

  // Keeps the shadow camera centred on what the player sees, snapped to shadow texels to avoid shimmer.
  follow(target) {
    const step = 190 / 2048;
    const x = Math.round(target.x / step) * step, z = Math.round(target.z / step) * step;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.state.sunDir.x * 300, this.state.sunDir.y * 300, z + this.state.sunDir.z * 300);
  }
}
