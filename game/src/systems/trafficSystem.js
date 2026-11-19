// Civilian traffic: cars follow lane curves through the road graph, brake for what is ahead,
// park at the curb, and abandon their car when rammed or shot. Also resolves car-to-car hits.

import { TRAFFIC, CITY } from '../core/config.js';
import { Vehicle } from '../actors/vehicle.js';
import { CIVILIAN_TYPES, VEHICLE_TYPES } from '../actors/vehicleModels.js';
import { bezier2, damp } from '../core/mathUtil.js';
import { rng } from '../core/rng.js';

const pt = { x: 0, z: 0 }, pt2 = { x: 0, z: 0 };

export class TrafficSystem {
  constructor(world) {
    this.world = world;
  }

  addVehicle(v) {
    this.world.vehicles.push(v);
    this.world.scene.add(v.root);
    return v;
  }

  removeVehicle(v) {
    const list = this.world.vehicles;
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
    this.world.scene.remove(v.root);
  }

  /** Puts an AI car on edge a -> b at fraction t. */
  spawnOnLane(type, a, b, t = 0.3, driver = 'ai') {
    const g = this.world.lanes;
    const curve = g.laneStraight(a, b);
    bezier2(curve.p0, curve.p1, curve.p2, t, pt);
    const spec = VEHICLE_TYPES[type];
    const v = new Vehicle(type, rng.pick(spec.colors), pt.x, pt.z, Math.atan2(curve.p2.x - curve.p0.x, curve.p2.z - curve.p0.z));
    v.driver = driver;
    v.ai = { a, b, curve, s: t * curve.len, turning: false, next: null, cruise: TRAFFIC.cruiseSpeed * rng.range(0.8, 1.15) };
    v.speed = v.ai.cruise * 0.8;
    return this.addVehicle(v);
  }

  spawnParked(type, a, b, t) {
    const g = this.world.lanes;
    const f = g.edgeFrame(a, b);
    const A = g.node(a), B = g.node(b);
    const x = A.x + (B.x - A.x) * t - f.rx * 5.6, z = A.z + (B.z - A.z) * t - f.rz * 5.6;
    const v = new Vehicle(type, rng.pick(VEHICLE_TYPES[type].colors), x, z, Math.atan2(f.dx, f.dz));
    return this.addVehicle(v);
  }

  trySpawn() {
    const w = this.world, p = w.player.pos;
    const ang = rng.range(0, Math.PI * 2), r = rng.range(TRAFFIC.spawnMin, TRAFFIC.spawnMax);
    const node = w.lanes.nearestNode(p.x + Math.cos(ang) * r, p.z + Math.sin(ang) * r);
    const a = node.id, b = rng.pick(node.links);
    const t = rng.range(0.15, 0.85);
    const B = w.lanes.node(b);
    const mx = node.x + (B.x - node.x) * t, mz = node.z + (B.z - node.z) * t;
    if (Math.hypot(mx - p.x, mz - p.z) < TRAFFIC.spawnMin * 0.8) return;
    for (const v of w.vehicles) if (Math.hypot(v.pos.x - mx, v.pos.z - mz) < 14) return;
    const type = rng.pick(CIVILIAN_TYPES);
    if (rng.chance(0.25)) this.spawnParked(type, a, b, t);
    else this.spawnOnLane(type, a, b, t);
  }

  update(dt) {
    const w = this.world, p = w.player.pos;
    const civ = w.vehicles.filter((v) => v.driver !== 'player' && !v.mission && !v.police);
    if (civ.length < TRAFFIC.maxCars && !w.frozenTraffic) for (let k = 0; k < 2; k++) this.trySpawn();
    for (const v of civ) {
      if (Math.hypot(v.pos.x - p.x, v.pos.z - p.z) > TRAFFIC.despawn) { this.removeVehicle(v); continue; }
    }
    for (const v of w.vehicles) {
      if ((v.driver === 'ai' || v.driver === 'thug') && v.ai && !v.dead) this.followLane(v, dt);
      else if (v.driver === null || v.dead) v.drive(dt, { throttle: 0, steer: 0, handbrake: v.dead }, w);
    }
    this.collideVehicles();
    for (const v of w.vehicles) {
      v.sync(dt, w.stage.night);
      if (v.dead) {
        v.burnTime = (v.burnTime || 0) + dt;
        if (v.burnTime < 20 && rng.chance(dt * 12)) w.fx.smoke(v.pos.x, 1.4, v.pos.z, v.burnTime < 6);
      } else if (v.health < v.spec.health * 0.35 && rng.chance(dt * 6)) w.fx.smoke(v.pos.x + v.forwardX * 1.8, 1.0, v.pos.z + v.forwardZ * 1.8, false);
    }
  }

  /** Kinematic lane following with braking for whatever is in front. */
  followLane(v, dt) {
    const ai = v.ai, g = this.world.lanes;
    let target = ai.cruise;
    if (ai.turning) target *= 0.55;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const check = (x, z, len) => {
      const dx = x - v.pos.x, dz = z - v.pos.z;
      const ahead = dx * fx + dz * fz;
      if (ahead <= 0 || ahead > 16) return;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < 2.3) target = Math.min(target, Math.max(0, (ahead - len - 2.5) * 1.6));
    };
    for (const o of this.world.vehicles) {
      if (o === v) continue;
      if (Math.abs(o.pos.x - v.pos.x) > 18 || Math.abs(o.pos.z - v.pos.z) > 18) continue;
      const same = Math.sin(o.heading) * fx + Math.cos(o.heading) * fz;
      if (same > 0.6 || o.driver === 'player' || o.driver === null || o.dead) check(o.pos.x, o.pos.z, o.spec.len / 2 + v.spec.len / 2 - 2);
    }
    const pl = this.world.player;
    if (!pl.inCar) check(pl.pos.x, pl.pos.z, v.spec.len / 2 - 1);
    v.speed = damp(v.speed, target, target < v.speed ? 5 : 1.5, dt);
    v.braking = target < v.speed - 1;

    ai.s += v.speed * dt;
    while (ai.s >= ai.curve.len) {
      ai.s -= ai.curve.len;
      if (!ai.turning) {
        ai.next = g.pickNext(ai.a, ai.b, rng);
        ai.curve = g.laneTurn(ai.a, ai.b, ai.next);
        ai.turning = true;
      } else {
        ai.a = ai.b; ai.b = ai.next;
        ai.curve = g.laneStraight(ai.a, ai.b);
        ai.turning = false;
      }
    }
    const c = ai.curve, t = ai.s / c.len;
    bezier2(c.p0, c.p1, c.p2, t, pt);
    bezier2(c.p0, c.p1, c.p2, Math.min(1, t + 0.05), pt2);
    if (t > 0.95) { pt2.x = pt.x + (c.p2.x - c.p1.x); pt2.z = pt.z + (c.p2.z - c.p1.z); }
    const prevH = v.heading;
    v.heading = Math.atan2(pt2.x - pt.x, pt2.z - pt.z);
    v.steer = Math.max(-1, Math.min(1, -((v.heading - prevH + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 30));
    v.vx = (pt.x - v.pos.x) / Math.max(dt, 1e-4);
    v.vz = (pt.z - v.pos.z) / Math.max(dt, 1e-4);
    v.pos.x = pt.x; v.pos.z = pt.z;
  }

  /** Circle pairs along each body; separates cars and turns relative speed into damage. */
  collideVehicles() {
    const list = this.world.vehicles;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const reach = (a.spec.len + b.spec.len) / 2;
      if (dx * dx + dz * dz > reach * reach) continue;
      let best = null;
      for (const ka of [-1, 0, 1]) for (const kb of [-1, 0, 1]) {
        const ax = a.pos.x + a.forwardX * ka * (a.spec.len / 2 - a.radius), az = a.pos.z + a.forwardZ * ka * (a.spec.len / 2 - a.radius);
        const bx = b.pos.x + b.forwardX * kb * (b.spec.len / 2 - b.radius), bz = b.pos.z + b.forwardZ * kb * (b.spec.len / 2 - b.radius);
        const ex = bx - ax, ez = bz - az, d = Math.hypot(ex, ez), r = a.radius + b.radius;
        if (d < r && (!best || r - d > best.depth)) best = { nx: ex / (d || 1), nz: ez / (d || 1), depth: r - d };
      }
      if (!best) continue;
      const aKin = !!a.ai && !a.dead, bKin = !!b.ai && !b.dead;
      const wa = aKin ? 0 : bKin ? 1 : 0.5, wb = 1 - wa;
      a.pos.x -= best.nx * best.depth * wa; a.pos.z -= best.nz * best.depth * wa;
      b.pos.x += best.nx * best.depth * wb; b.pos.z += best.nz * best.depth * wb;
      const rel = (b.vx - a.vx) * best.nx + (b.vz - a.vz) * best.nz;
      if (rel < 0) {
        const imp = -rel;
        if (!aKin) { a.vx += best.nx * rel * 0.6 * (bKin ? 1.6 : 1); a.vz += best.nz * rel * 0.6 * (bKin ? 1.6 : 1); }
        if (!bKin) { b.vx -= best.nx * rel * 0.6 * (aKin ? 1.6 : 1); b.vz -= best.nz * rel * 0.6 * (aKin ? 1.6 : 1); }
        if (imp > 4) {
          a.impact(imp * 0.8, this.world); b.impact(imp * 0.8, this.world);
          for (const v of [a, b]) if (v.driver === 'ai' && v.ai && (a.driver === 'player' || b.driver === 'player' || imp > 9)) this.abandon(v);
          if (a.driver === 'player' || b.driver === 'player') this.world.onPlayerCrash?.(a.driver === 'player' ? b : a, imp);
        }
      }
    }
  }

  /** Driver bails out and runs; the car stays where it stopped. */
  abandon(v) {
    if (v.driver !== 'ai') return;
    v.ai = null;
    v.driver = null;
    v.vx *= 0.3; v.vz *= 0.3;
    this.world.peds?.spawnFleeing(v.pos.x - Math.cos(v.heading) * 2, v.pos.z + Math.sin(v.heading) * 2, v.pos);
  }
}

export { CITY };
