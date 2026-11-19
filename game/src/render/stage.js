// Renderer, scene, camera and the sun: lighting follows a day cycle tuned for golden hour.

import * as THREE from 'three';
import { createSkyDome } from './skyDome.js';
import { createOcean } from './ocean.js';
import { lerp } from '../core/mathUtil.js';

// hour -> [sky top, horizon, sun colour, sun intensity, ambient intensity, fog]
const KEYS = [
  [0, 0x0b1430, 0x2a2f55, 0x7f8fc0, 0.25, 0.35, 0x1d2240],
  [5.5, 0x1b2a55, 0xe08a6a, 0xffa070, 0.6, 0.5, 0x8a6a70],
  [8, 0x3f86cf, 0xbfdcef, 0xfff1dc, 2.6, 1.0, 0xcfe0ea],
  [15, 0x3a7fcc, 0xcfe3ef, 0xfff3e0, 2.8, 1.0, 0xd8e6ee],
  [17.5, 0x4a7bbf, 0xffbd85, 0xffc58a, 2.6, 0.85, 0xf2c39a],
  [19, 0x35477f, 0xff8a5c, 0xff8c55, 1.4, 0.65, 0xd98a72],
  [20.5, 0x141d40, 0x5a3a60, 0x9080c0, 0.35, 0.4, 0x3a3050],
  [24, 0x0b1430, 0x2a2f55, 0x7f8fc0, 0.25, 0.35, 0x1d2240],
];

const ca = new THREE.Color(), cb = new THREE.Color();
function lerpColor(a, b, t, out) { return out.copy(ca.setHex(a)).lerp(cb.setHex(b), t); }

export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xf3c9a0, 140, 760);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 2400);

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0xc9a27a, 1.0);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffd2a0, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 10; sc.far = 600;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);

    this.sky = createSkyDome();
    this.scene.add(this.sky.mesh);
    this.ocean = createOcean();
    this.scene.add(this.ocean.mesh);

    this.hour = 17.6;
    this.night = 0;            // 0 day .. 1 night, drives window glow and street lights
    this.sunDir = new THREE.Vector3();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Sets lighting for an hour of the day (0..24). */
  setHour(hour) {
    this.hour = ((hour % 24) + 24) % 24;
    let k = 0;
    while (k < KEYS.length - 2 && KEYS[k + 1][0] <= this.hour) k++;
    const A = KEYS[k], B = KEYS[k + 1];
    const t = (this.hour - A[0]) / (B[0] - A[0]);
    const u = this.sky.uniforms;
    lerpColor(A[1], B[1], t, u.topColor.value);
    lerpColor(A[2], B[2], t, u.horizonColor.value);
    lerpColor(A[3], B[3], t, this.sun.color);
    u.sunColor.value.copy(this.sun.color);
    u.groundColor.value.copy(u.horizonColor.value).multiplyScalar(0.8);
    this.sun.intensity = lerp(A[4], B[4], t);
    this.hemi.intensity = lerp(A[5], B[5], t);
    lerpColor(A[6], B[6], t, this.scene.fog.color);

    // the sun travels east to west over the ocean side so the coast glows at sunset
    const a = ((this.hour - 6) / 12) * Math.PI;
    const elev = Math.sin(a);
    this.sunDir.set(-Math.cos(a) * 0.8, Math.max(elev, -0.2) * 0.9 + 0.06, 0.55).normalize();
    u.sunDir.value.copy(this.sunDir);
    this.night = this.hour > 19.2 || this.hour < 6 ? 1 : this.hour > 18 ? (this.hour - 18) / 1.2 : this.hour < 7 ? 7 - this.hour : 0;

    const o = this.ocean.uniforms;
    o.sunDir.value.copy(this.sunDir);
    o.sunColor.value.copy(this.sun.color);
    o.skyColor.value.copy(u.horizonColor.value);
    o.fogColor.value.copy(this.scene.fog.color);
  }

  /** Keeps the shadow frustum centred on the player. */
  follow(x, z) {
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunDir.x * 300, this.sunDir.y * 300, z + this.sunDir.z * 300);
    this.sky.mesh.position.copy(this.camera.position);
  }

  render(time) {
    this.ocean.uniforms.time.value = time;
    this.renderer.render(this.scene, this.camera);
  }
}
