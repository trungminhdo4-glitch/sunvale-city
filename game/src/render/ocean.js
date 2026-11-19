// Animated ocean surface: wave normals, sky-coloured fresnel, sun glitter and a foam line on the beach.

import * as THREE from 'three';
import { CITY } from '../core/config.js';

export function createOcean() {
  const uniforms = {
    time: { value: 0 },
    deepColor: { value: new THREE.Color(0x1c6f9a) },
    shallowColor: { value: new THREE.Color(0x48c1cf) },
    skyColor: { value: new THREE.Color(0xffc48a) },
    sunColor: { value: new THREE.Color(0xffe0b0) },
    sunDir: { value: new THREE.Vector3(0.3, 0.2, 0.9).normalize() },
    fogColor: { value: new THREE.Color(0xf3c9a0) },
    fogNear: { value: 120 },
    fogFar: { value: 900 },
    shoreZ: { value: CITY.waterZ },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float time, fogNear, fogFar, shoreZ;
      uniform vec3 deepColor, shallowColor, skyColor, sunColor, sunDir, fogColor;
      varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xz;
        float t = time;
        vec2 g = vec2(
          cos(p.x * 0.11 + t * 1.1) * 0.5 + cos(p.x * 0.37 + p.y * 0.21 + t * 1.7) * 0.25 + cos(p.y * 0.9 + t * 2.3) * 0.08,
          cos(p.y * 0.13 + t * 0.9) * 0.5 + cos(p.y * 0.31 - p.x * 0.17 + t * 1.5) * 0.25 + cos(p.x * 0.8 - t * 2.1) * 0.08);
        vec3 n = normalize(vec3(g.x * 0.18, 1.0, g.y * 0.18));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        float shore = clamp(1.0 - (vWorld.z - shoreZ) / 40.0, 0.0, 1.0) * step(vWorld.x, ${CITY.harborEdgeX.toFixed(1)});
        vec3 col = mix(deepColor, shallowColor, shore * 0.8);
        col = mix(col, skyColor, fres * 0.75);
        vec3 h = normalize(normalize(sunDir) + v);
        float spec = pow(max(dot(n, h), 0.0), 220.0);
        col += sunColor * spec * 2.2;
        float foam = smoothstep(0.6, 1.0, shore) * (0.6 + 0.4 * sin(vWorld.x * 0.3 + t * 2.0));
        col = mix(col, vec3(1.0), foam * 0.55);
        float d = length(cameraPosition - vWorld);
        col = mix(col, fogColor, smoothstep(fogNear, fogFar, d));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(5000, 5000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -0.7, 0);
  return { mesh, uniforms };
}
