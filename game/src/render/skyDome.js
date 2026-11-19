// Gradient sky dome with a sun disc and haze, drawn behind everything.

import * as THREE from 'three';

export function createSkyDome() {
  const uniforms = {
    topColor: { value: new THREE.Color(0x3d7fc4) },
    horizonColor: { value: new THREE.Color(0xffc48a) },
    groundColor: { value: new THREE.Color(0xe8b48a) },
    sunColor: { value: new THREE.Color(0xfff0d0) },
    sunDir: { value: new THREE.Vector3(0.3, 0.2, 0.9).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 topColor, horizonColor, groundColor, sunColor, sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizonColor, groundColor, clamp(-h * 4.0, 0.0, 1.0));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.55 + pow(s, 6.0) * 0.18);
        // thin streaky clouds
        float c = sin(d.x * 9.0 + d.z * 3.0) * sin(d.z * 14.0 - d.x * 2.0) * 0.5 + 0.5;
        float band = smoothstep(0.04, 0.12, h) * (1.0 - smoothstep(0.18, 0.35, h));
        col = mix(col, horizonColor * 1.15 + sunColor * 0.15, band * smoothstep(0.55, 0.95, c) * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, uniforms };
}
