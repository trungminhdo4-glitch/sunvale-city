// The golden afternoon: 15:00 to 19:30 on a loop. Drives sun direction, light colours, sky and fog.
import * as THREE from 'three';
import { DAY } from '../core/config.js';
import { clamp } from '../core/mathUtil.js';

// Colour keys at 15:00, 17:30 and 19:30.
const KEYS = [
  { h: 15.0, el: 40, sun: '#fff0d2', si: 3.0, top: '#2f7fe0', hor: '#ffdcae', hemiS: '#cfe3ff', hemiG: '#b8916a', hi: 1.05, fog: '#e9d3b8', exp: 0.92 },
  { h: 17.5, el: 17, sun: '#ffbf70', si: 3.0, top: '#2e66c9', hor: '#ffb27a', hemiS: '#ffd6b0', hemiG: '#9a6a5e', hi: 0.95, fog: '#eab48e', exp: 0.95 },
  { h: 19.5, el: 2, sun: '#ff6a2a', si: 1.8, top: '#2f2c7a', hor: '#ff7a55', hemiS: '#e19a96', hemiG: '#523a55', hi: 0.7, fog: '#cf7e70', exp: 1.05 },
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
    this.fog = new THREE.Fog(0xffffff, 280, 1350);
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
