// Appends boxes and quads into one BufferGeometry per material, so the whole city draws in a handful of calls.
import * as THREE from 'three';

const tmp = new THREE.Color();

export class GeometryBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  get empty() { return this.pos.length === 0; }

  // Corners in counter-clockwise order seen from the front: bottom-left, bottom-right, top-right, top-left.
  addQuad(p0, p1, p2, p3, uv = [0, 0, 1, 1], color = 0xffffff) {
    const base = this.pos.length / 3;
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
    const c = typeof color === 'object' && color.isColor ? color : tmp.set(color);
    for (const p of [p0, p1, p2, p3]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); this.col.push(c.r, c.g, c.b); }
    const [u0, v0, u1, v1] = uv;
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Horizontal rectangle facing up, UVs in world meters divided by `tile`.
  addFlat(x0, z0, x1, z1, y, tile = 4, color = 0xffffff) {
    this.addQuad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / tile, -z1 / tile, x1 / tile, -z0 / tile], color);
  }

  // Box standing on y0. Sides get UVs in units of (uvU, uvV) meters; the top goes to `top` (a builder, or null to skip).
  addBox({ cx, cz, y0 = 0, sx, sy, sz, rotY = 0, color = 0xffffff, uvU = 4, uvV = 4, uOffset = 0, top, topTile = 8, bottom = false, sides = true }) {
    const c = new THREE.Color(color);
    const cos = Math.cos(rotY), sin = Math.sin(rotY);
    const P = (lx, y, lz) => [cx + lx * cos + lz * sin, y, cz - lx * sin + lz * cos];
    const hx = sx / 2, hz = sz / 2, y1 = y0 + sy;
    if (sides) {
      const faces = [
        [[-hx, hz], [hx, hz], sx], // +z
        [[hx, hz], [hx, -hz], sz], // +x
        [[hx, -hz], [-hx, -hz], sx], // -z
        [[-hx, -hz], [-hx, hz], sz], // -x
      ];
      faces.forEach(([a, b, w], k) => {
        const u0 = uOffset + k * 0.37, u1 = u0 + w / uvU, v1 = sy / uvV;
        this.addQuad(P(a[0], y0, a[1]), P(b[0], y0, b[1]), P(b[0], y1, b[1]), P(a[0], y1, a[1]), [u0, 0, u1, v1], c);
      });
    }
    const topB = top === undefined ? this : top;
    if (topB) {
      topB.addQuad(P(-hx, y1, hz), P(hx, y1, hz), P(hx, y1, -hz), P(-hx, y1, -hz), [0, 0, sx / topTile, sz / topTile], c);
    }
    if (bottom) this.addQuad(P(-hx, y0, -hz), P(hx, y0, -hz), P(hx, y0, hz), P(-hx, y0, hz), [0, 0, 1, 1], c);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
