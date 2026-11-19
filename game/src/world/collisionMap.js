// Spatial hash of solid boxes plus the coast line; pushes circles out of walls and casts rays.

import { CITY } from '../core/config.js';
import { rayBox } from '../core/mathUtil.js';

const CELL = 32;

export class CollisionMap {
  constructor() {
    this.cells = new Map();
    this.boxes = [];
  }

  key(cx, cz) { return cx * 4096 + cz; }

  add(box) {
    this.boxes.push(box);
    const x0 = Math.floor(box.minX / CELL), x1 = Math.floor(box.maxX / CELL);
    const z0 = Math.floor(box.minZ / CELL), z1 = Math.floor(box.maxZ / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = this.key(x, z);
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(box);
    }
  }

  near(x, z) {
    return this.cells.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
  }

  /** Is the point on the pier deck? */
  onPier(x, z) {
    return x > -104 && x < -88 && z > CITY.beachStart - 6 && z < 472;
  }

  isWater(x, z) {
    if (this.onPier(x, z)) return false;
    return z > CITY.waterZ || x > CITY.harborEdgeX;
  }

  /**
   * Pushes a circle (x, z, r) out of boxes and keeps it on land.
   * Returns the push normal {nx, nz, depth} of the deepest contact or null. Mutates pos.
   */
  resolve(pos, r, y = 0) {
    let hit = null;
    for (let pass = 0; pass < 2; pass++) {
      const list = this.near(pos.x, pos.z);
      for (const b of list) {
        if (y > b.h) continue;
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        let d = Math.sqrt(d2), nx, nz, depth;
        if (d < 1e-6) {
          // centre inside the box: leave by the nearest face
          const faces = [pos.x - b.minX, b.maxX - pos.x, pos.z - b.minZ, b.maxZ - pos.z];
          const m = Math.min(...faces);
          const i = faces.indexOf(m);
          nx = i === 0 ? -1 : i === 1 ? 1 : 0;
          nz = i === 2 ? -1 : i === 3 ? 1 : 0;
          depth = m + r;
        } else {
          nx = dx / d; nz = dz / d; depth = r - d;
        }
        pos.x += nx * depth;
        pos.z += nz * depth;
        if (!hit || depth > hit.depth) hit = { nx, nz, depth };
      }
    }
    // coast and map edge
    const edge = (nx, nz, depth) => {
      pos.x += nx * depth; pos.z += nz * depth;
      if (!hit || depth > hit.depth) hit = { nx, nz, depth };
    };
    if (!this.onPier(pos.x, pos.z)) {
      if (pos.z > CITY.waterZ - r) edge(0, -1, pos.z - (CITY.waterZ - r));
    } else {
      if (pos.x < -104 + r) edge(1, 0, -104 + r - pos.x);
      if (pos.x > -88 - r) edge(-1, 0, pos.x - (-88 - r));
      if (pos.z > 470 - r) edge(0, -1, pos.z - (470 - r));
    }
    if (pos.x > CITY.harborEdgeX - r) edge(-1, 0, pos.x - (CITY.harborEdgeX - r));
    if (pos.x < CITY.landMin + r) edge(1, 0, CITY.landMin + r - pos.x);
    if (pos.z < CITY.landMin + r) edge(0, 1, CITY.landMin + r - pos.z);
    return hit;
  }

  /** Nearest wall hit along a ray (normalised dir), up to maxDist. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = maxDist;
    const steps = Math.ceil(maxDist / CELL) + 1;
    const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(maxDist, s * CELL);
      const px = ox + dx * t, pz = oz + dz * t;
      for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
        const list = this.cells.get(this.key(Math.floor(px / CELL) + ix, Math.floor(pz / CELL) + iz));
        if (!list) continue;
        for (const b of list) {
          if (seen.has(b)) continue;
          seen.add(b);
          const h = rayBox(ox, oy, oz, dx, dy, dz, b);
          if (h < best) best = h;
        }
      }
      if (t >= best) break;
    }
    return best;
  }

  /** Clear line of sight between two points (eye height). */
  canSee(ax, az, bx, bz, y = 1.6) {
    const dx = bx - ax, dz = bz - az;
    const d = Math.hypot(dx, dz);
    if (d < 1) return true;
    return this.raycast(ax, y, az, dx / d, 0, dz / d, d) >= d - 0.5;
  }
}
