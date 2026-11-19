// Merges many small non-indexed geometries (with a per-part colour) into one draw call.

import * as THREE from 'three';

/**
 * parts: [{ geometry, matrix?: Matrix4, color?: number }]
 * Every geometry needs position, normal and uv. Colours land in a 'color' attribute.
 */
export function mergeColored(parts) {
  let count = 0;
  const prepared = parts.map((p) => {
    const g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone();
    if (p.matrix) g.applyMatrix4(p.matrix);
    count += g.attributes.position.count;
    return { g, color: new THREE.Color(p.color ?? 0xffffff) };
  });
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const col = new Float32Array(count * 3);
  let o = 0;
  for (const { g, color } of prepared) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    for (let i = 0; i < n; i++) {
      col[(o + i) * 3] = color.r; col[(o + i) * 3 + 1] = color.g; col[(o + i) * 3 + 2] = color.b;
    }
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

const tmp = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();

/** Matrix from position, rotation (euler xyz) and scale. */
export function trs(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  q.setFromEuler(e.set(rx, ry, rz));
  return tmp.clone().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
}
