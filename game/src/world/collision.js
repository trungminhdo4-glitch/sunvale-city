// Static collision: axis-aligned boxes in a spatial hash, circle push-out, ray casts, ground height and world limits.
import { BOUNDS, PIER, BEACH_X, CITY } from '../core/config.js';
import { blockAt, isOnPier } from './cityLayout.js';
import { clamp } from '../core/mathUtil.js';

export class StaticWorld {
  constructor(cell = 24) {
    this.cell = cell;
    this.boxes = [];
    this.grid = new Map();
    this.stamp = 0;
    this.scratch = [];
  }
  key(ix, iz) { return (ix + 1000) * 4096 + (iz + 1000); }

  add(minX, minZ, maxX, maxZ, minY = 0, maxY = 10, tag = 'building') {
    const b = { minX, minZ, maxX, maxZ, minY, maxY, tag, mark: 0 };
    this.boxes.push(b);
    const c = this.cell;
    for (let ix = Math.floor(minX / c); ix <= Math.floor(maxX / c); ix++)
      for (let iz = Math.floor(minZ / c); iz <= Math.floor(maxZ / c); iz++) {
        const k = this.key(ix, iz);
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(b);
      }
    return b;
  }

  query(minX, minZ, maxX, maxZ, out = this.scratch) {
    out.length = 0;
    const s = ++this.stamp, c = this.cell;
    for (let ix = Math.floor(minX / c); ix <= Math.floor(maxX / c); ix++)
      for (let iz = Math.floor(minZ / c); iz <= Math.floor(maxZ / c); iz++) {
        const list = this.grid.get(this.key(ix, iz));
        if (!list) continue;
        for (const b of list) {
          if (b.mark === s) continue;
          b.mark = s;
          if (b.maxX >= minX && b.minX <= maxX && b.maxZ >= minZ && b.minZ <= maxZ) out.push(b);
        }
      }
    return out;
  }

  // Pushes a circle (p.x, p.z, radius r) out of every box overlapping its height band. Returns the summed normal or null.
  resolveCircle(p, r, y = 0, height = 1.8) {
    let nxSum = 0, nzSum = 0, hit = false;
    const list = this.query(p.x - r, p.z - r, p.x + r, p.z + r);
    for (const b of list) {
      if (y + 0.35 > b.maxY || y + height < b.minY) continue;
      const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let push, nx, nz;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; push = r - d;
      } else {
        const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) { nx = -1; nz = 0; push = l + r; } else if (m === rr) { nx = 1; nz = 0; push = rr + r; }
        else if (m === t) { nx = 0; nz = -1; push = t + r; } else { nx = 0; nz = 1; push = bt + r; }
      }
      p.x += nx * push; p.z += nz * push;
      nxSum += nx; nzSum += nz; hit = true;
    }
    if (!hit) return null;
    const l = Math.hypot(nxSum, nzSum) || 1;
    return { nx: nxSum / l, nz: nzSum / l };
  }

  // Ray against the boxes (slab test). Returns { t, x, y, z, nx, ny, nz, box } of the nearest hit within maxDist.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    const ex = ox + dx * maxDist, ez = oz + dz * maxDist;
    const list = this.query(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez));
    let best = null, bestT = maxDist;
    for (const b of list) {
      let tmin = 0, tmax = bestT, axis = -1, sign = 0;
      const slabs = [[ox, dx, b.minX, b.maxX], [oy, dy, b.minY, b.maxY], [oz, dz, b.minZ, b.maxZ]];
      let ok = true;
      for (let a = 0; a < 3; a++) {
        const [o, d, lo, hi] = slabs[a];
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
        let t1 = (lo - o) / d, t2 = (hi - o) / d, s = -1;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { ok = false; break; }
      }
      if (!ok || tmin >= bestT || axis < 0) continue;
      bestT = tmin;
      best = { t: tmin, box: b, nx: axis === 0 ? sign : 0, ny: axis === 1 ? sign : 0, nz: axis === 2 ? sign : 0 };
    }
    // the ground plane
    if (dy < -1e-6) {
      const tg = (this.groundHeight(ox, oz) - oy) / dy;
      if (tg > 0 && tg < bestT) { bestT = tg; best = { t: tg, box: null, nx: 0, ny: 1, nz: 0, ground: true }; }
    }
    if (best) { best.x = ox + dx * best.t; best.y = oy + dy * best.t; best.z = oz + dz * best.t; }
    return best;
  }

  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    const h = this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d);
    return !h || h.ground;
  }

  groundHeight(x, z) {
    if (isOnPier(x, z)) return PIER.y;
    if (x < BEACH_X) {
      if (x > -380) return 0;
      if (x > -392) return -0.2 * (-380 - x) / 12;
      if (x > -404) return -0.2 - 0.5 * (-392 - x) / 12;
      return -0.7 - 0.9 * clamp((-404 - x) / 16, 0, 1);
    }
    return blockAt(x, z) ? CITY.curbHeight : 0;
  }

  // Keeps a position on land or on the pier.
  clampToWorld(p) {
    if (isOnPier(p.x, p.z)) {
      p.x = Math.max(p.x, PIER.x0 + 0.6);
      p.z = clamp(p.z, PIER.z0 + 0.6, PIER.z1 - 0.6);
      return;
    }
    if (p.x < BOUNDS.minX && p.z > PIER.z0 && p.z < PIER.z1) return;
    p.x = clamp(p.x, BOUNDS.minX, BOUNDS.maxX);
    p.z = clamp(p.z, BOUNDS.minZ, BOUNDS.maxZ);
  }
}
