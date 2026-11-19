// The street grid as a graph for drivers: lane waypoints through intersections and greedy routes toward a target.
import { CITY } from '../core/config.js';
import { roadCoord, ROAD_COUNT } from '../world/cityLayout.js';
import { clamp } from '../core/mathUtil.js';

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const LANE = 3.5;
export const validNode = (i, j) => i >= 0 && j >= 0 && i < ROAD_COUNT && j < ROAD_COUNT;
export const nodePos = (i, j) => ({ x: roadCoord(i), z: roadCoord(j) });
export const nearestIndex = (v) => clamp(Math.round((v - CITY.origin) / CITY.pitch), 0, ROAD_COUNT - 1);
export const yawOfDir = (d) => Math.atan2(DIRS[d][0], DIRS[d][1]);

// Lane-following route: queue of waypoints { x, z, slow } produced one intersection at a time.
export class LaneRoute {
  constructor(rng, i, j, d) { this.rng = rng; this.i = i; this.j = j; this.d = d; this.queue = []; }

  extend() {
    const [fx, fz] = DIRS[this.d];
    const p = nodePos(this.i, this.j);
    const rx = -fz, rz = fx;
    const options = [];
    for (const d2 of [this.d, (this.d + 1) % 4, (this.d + 3) % 4]) {
      const [gx, gz] = DIRS[d2];
      if (validNode(this.i + gx, this.j + gz)) options.push(d2);
    }
    if (!options.length) options.push((this.d + 2) % 4);
    let d2 = options[0];
    if (options.length > 1) d2 = this.rng.chance(0.45) && options.includes(this.d) ? this.d : this.rng.pick(options);
    const [gx, gz] = DIRS[d2];
    const sx = -gz, sz = gx;
    const turning = d2 !== this.d;
    const entry = { x: p.x - fx * 10 + rx * LANE, z: p.z - fz * 10 + rz * LANE, slow: turning };
    const exit = { x: p.x + gx * 10 + sx * LANE, z: p.z + gz * 10 + sz * LANE, slow: false };
    this.queue.push(entry);
    if (turning) {
      const qx = p.x + rx * LANE + sx * LANE, qz = p.z + rz * LANE + sz * LANE;
      const uturn = d2 === (this.d + 2) % 4;
      if (!uturn) this.queue.push({ x: 0.25 * entry.x + 0.5 * qx + 0.25 * exit.x, z: 0.25 * entry.z + 0.5 * qz + 0.25 * exit.z, slow: true });
    }
    this.queue.push(exit);
    this.i += gx; this.j += gz; this.d = d2;
  }

  peek(k = 0) { while (this.queue.length <= k + 1) this.extend(); return this.queue[k]; }
  shift() { this.queue.shift(); }
}

// Picks a lane route starting near (x, z) heading roughly along yaw.
export function routeFrom(rng, x, z, yaw) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  let d = 0, best = -2;
  DIRS.forEach(([dx, dz], k) => { const dot = dx * fx + dz * fz; if (dot > best) { best = dot; d = k; } });
  const [dx, dz] = DIRS[d];
  let i = nearestIndex(x), j = nearestIndex(z);
  // next node ahead along the travel direction
  if (dx) i = clamp(Math.floor((x - CITY.origin) / CITY.pitch) + (dx > 0 ? 1 : 0), 0, ROAD_COUNT - 1);
  if (dz) j = clamp(Math.floor((z - CITY.origin) / CITY.pitch) + (dz > 0 ? 1 : 0), 0, ROAD_COUNT - 1);
  if (!validNode(i, j)) { i = nearestIndex(x); j = nearestIndex(z); }
  return new LaneRoute(rng, i, j, d);
}

// Next point to drive at when chasing (tx, tz) along the grid: drive down the current road to the cross street, then turn.
export function chaseWaypoint(x, z, tx, tz) {
  const i = nearestIndex(x), j = nearestIndex(z);
  const onNS = Math.abs(x - roadCoord(i)) < 9, onEW = Math.abs(z - roadCoord(j)) < 9;
  const ti = nearestIndex(tx), tj = nearestIndex(tz);
  if (onNS && onEW) {
    if (Math.abs(tx - x) > Math.abs(tz - z)) return { x: roadCoord(clamp(i + Math.sign(tx - x), 0, ROAD_COUNT - 1)), z: roadCoord(j) };
    return { x: roadCoord(i), z: roadCoord(clamp(j + Math.sign(tz - z), 0, ROAD_COUNT - 1)) };
  }
  if (onNS) return ti === i ? { x: roadCoord(i), z: tz } : { x: roadCoord(i), z: roadCoord(tj) };
  if (onEW) return tj === j ? { x: tx, z: roadCoord(j) } : { x: roadCoord(ti), z: roadCoord(j) };
  return { x: roadCoord(i), z: roadCoord(j) };
}
