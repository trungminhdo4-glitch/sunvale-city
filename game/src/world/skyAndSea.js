// Gradient sky dome with a low golden sun, and an animated shader sea with glitter, shallows and shore foam.
import * as THREE from 'three';
import { SHORE_X, HARBOR_Z } from '../core/config.js';

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uCloud;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uBottom, clamp(-h * 3.0, 0.0, 1.0));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 1400.0) * 9.0 + pow(s, 60.0) * 0.55 + pow(s, 6.0) * 0.22);
  float band = smoothstep(0.03, 0.12, h) * (1.0 - smoothstep(0.22, 0.42, h));
  float c = sin(d.x * 7.0 + sin(d.z * 5.0) * 1.7) * sin(d.z * 9.0 + d.x * 2.5) * 0.5 + 0.5;
  c = smoothstep(0.45, 0.85, c);
  vec3 cloud = mix(uCloud, uSunColor, pow(s, 3.0) * 0.8);
  col = mix(col, cloud, c * band * 0.55);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SEA_VERT = /* glsl */`
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SEA_FRAG = /* glsl */`
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uDeep; uniform vec3 uShallow;
uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
uniform float uShoreX; uniform float uHarborZ;
varying vec3 vWorld;
float waves(vec2 p) {
  return sin(p.x * 0.11 + uTime * 0.9) * 0.5 + sin(p.y * 0.13 - uTime * 0.7) * 0.4
       + sin((p.x + p.y) * 0.31 + uTime * 1.7) * 0.18 + sin((p.x * 0.7 - p.y) * 0.53 - uTime * 2.1) * 0.1
       + sin((p.x * 1.3 + p.y * 0.4) * 1.1 + uTime * 2.9) * 0.05;
}
void main() {
  vec2 p = vWorld.xz;
  float e = 0.5;
  float hC = waves(p);
  vec3 n = normalize(vec3(waves(p - vec2(e, 0.0)) - waves(p + vec2(e, 0.0)), 2.2, waves(p - vec2(0.0, e)) - waves(p + vec2(0.0, e))));
  n = normalize(n + vec3(sin(p.x * 1.9 + uTime * 3.1) * 0.06, 0.0, cos(p.y * 2.3 - uTime * 2.7) * 0.06));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 r = reflect(-v, n);
  vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(r.y * 1.6, 0.0, 1.0));
  float dW = vWorld.x < uShoreX + 6.0 ? uShoreX - vWorld.x : 999.0;
  float dS = vWorld.z > uHarborZ - 6.0 ? vWorld.z - uHarborZ : 999.0;
  float d = min(dW, dS);
  vec3 water = mix(uShallow, uDeep, smoothstep(0.0, 70.0, d));
  vec3 col = mix(water, sky, clamp(fres * 0.85 + 0.08, 0.0, 1.0));
  float rs = max(dot(r, uSunDir), 0.0);
  col += uSunColor * (pow(rs, 300.0) * 4.0 + pow(rs, 24.0) * 0.3);
  float foam = (1.0 - smoothstep(0.0, 3.0 + hC * 1.5, d)) * (0.55 + 0.45 * sin(uTime * 1.8 + p.y * 0.25 + p.x * 0.1));
  col = mix(col, vec3(0.96, 0.97, 0.95), clamp(foam, 0.0, 1.0) * 0.75);
  float fogF = smoothstep(uFogNear, uFogFar, length(vWorld - cameraPosition));
  col = mix(col, uFogColor, fogF);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class SkyAndSea {
  constructor(scene) {
    this.skyUniforms = {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color('#1d5c7a') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uCloud: { value: new THREE.Color('#fff1e0') },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.seaUniforms = {
      uTime: { value: 0 }, uSunDir: this.skyUniforms.uSunDir, uSunColor: this.skyUniforms.uSunColor,
      uDeep: { value: new THREE.Color('#0d4f78') }, uShallow: { value: new THREE.Color('#2bc4c4') },
      uSkyTop: this.skyUniforms.uTop, uSkyHorizon: this.skyUniforms.uHorizon,
      uFogColor: { value: new THREE.Color() }, uFogNear: { value: 200 }, uFogFar: { value: 900 },
      uShoreX: { value: SHORE_X }, uHarborZ: { value: HARBOR_Z },
    };
    const seaGeo = new THREE.PlaneGeometry(5000, 5000, 1, 1);
    seaGeo.rotateX(-Math.PI / 2);
    this.sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({ uniforms: this.seaUniforms, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG }));
    this.sea.position.y = -0.45;
    this.sea.receiveShadow = false;
    scene.add(this.sea);
  }

  // Copies the day cycle's colours into the shaders.
  applyDay(day, fog) {
    this.skyUniforms.uTop.value.copy(day.skyTop);
    this.skyUniforms.uHorizon.value.copy(day.skyHorizon);
    this.skyUniforms.uSunColor.value.copy(day.sunColor);
    this.skyUniforms.uSunDir.value.copy(day.sunDir);
    this.seaUniforms.uFogColor.value.copy(fog.color);
    this.seaUniforms.uFogNear.value = fog.near;
    this.seaUniforms.uFogFar.value = fog.far;
  }

  update(dt, camera) {
    this.seaUniforms.uTime.value += dt;
    this.sky.position.copy(camera.position);
    this.sea.position.x = Math.round(camera.position.x / 50) * 50;
    this.sea.position.z = Math.round(camera.position.z / 50) * 50;
  }
}
