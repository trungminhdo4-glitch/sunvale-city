// Keeps civilian traffic flowing around the player: spawns cars in lanes out of sight and removes far ones.
import { TRAFFIC } from '../core/config.js';
import { rng } from '../core/rng.js';
import { DIRS, LANE, nodePos, validNode, yawOfDir } from './roadGraph.js';
import { ROAD_COUNT } from '../world/cityLayout.js';
import { CIVILIAN_TYPES, VEHICLE_TYPES } from '../entities/vehicleModels.js';
import { LaneDriver } from './drivers.js';
import { Character } from '../entities/character.js';
import { randomLook } from './pedestrians.js';

export class TrafficSystem {
  constructor(game) { this.game = game; this.timer = 0; this.target = TRAFFIC.count; }

  get cars() { return this.game.vehicles.filter((v) => v.isTraffic); }

  update(dt) {
    const g = this.game;
    this.timer -= dt;
    const focus = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    for (const v of g.vehicles.slice()) {
      if (v.persistent || v === g.player.vehicle) continue;
      const d = Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z);
      if (d > TRAFFIC.despawn || (v.wrecked && d > 90)) g.removeVehicle(v);
    }
    if (this.timer > 0) return;
    this.timer = 0.25;
    if (this.cars.length < this.target) this.spawnNear(focus.x, focus.z, TRAFFIC.spawnMin, TRAFFIC.spawnMax);
  }

  // Places one car in a lane between minD and maxD from (x, z).
  spawnNear(x, z, minD, maxD, type = null) {
    const g = this.game;
    for (let attempt = 0; attempt < 12; attempt++) {
      const i = rng.int(0, ROAD_COUNT - 1), j = rng.int(0, ROAD_COUNT - 1), d = rng.int(0, 3);
      const [fx, fz] = DIRS[d];
      if (!validNode(i - fx, j - fz)) continue;
      const a = nodePos(i - fx, j - fz);
      const t = rng.range(14, 50);
      const px = a.x + fx * t - fz * LANE, pz = a.z + fz * t + fx * LANE;
      const dist = Math.hypot(px - x, pz - z);
      if (dist < minD || dist > maxD) continue;
      if (g.vehicles.some((o) => Math.hypot(o.pos.x - px, o.pos.z - pz) < 9)) continue;
      return this.spawnAt(type ?? rng.pick(CIVILIAN_TYPES), px, pz, yawOfDir(d));
    }
    return null;
  }

  spawnAt(type, x, z, yaw) {
    const g = this.game;
    const spec = VEHICLE_TYPES[type];
    const v = g.spawnVehicle(type, x, z, yaw, rng.pick(spec.colors));
    v.isTraffic = true;
    v.controller = new LaneDriver(v, rng.range(10, 14.5));
    const driver = new Character(g, { x, z, look: randomLook(), role: 'driver' });
    g.addCharacter(driver);
    driver.vehicle = v;
    v.driver = driver;
    const initial = v.controller.cruise * 0.7;
    v.vx = Math.sin(yaw) * initial; v.vz = Math.cos(yaw) * initial;
    return v;
  }
}
