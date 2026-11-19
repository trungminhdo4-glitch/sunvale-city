// Civilians walking the sidewalk corner graph, crossing at crosswalks, fleeing from gunfire
// and getting knocked over by cars.

import { PEDS } from '../core/config.js';
import { Npc } from '../actors/npc.js';
import { rng } from '../core/rng.js';

export class PedestrianSystem {
  constructor(world) {
    this.world = world;
    this.list = [];
  }

  spawnAtCorner(c) {
    const p = this.world.lanes.cornerPos(c.i, c.j, c.sx, c.sz);
    const npc = new Npc(this.world.scene, 'civ', p.x + rng.range(-1, 1), p.z + rng.range(-1, 1));
    npc.corner = c;
    this.pickNextCorner(npc);
    this.list.push(npc);
    this.world.npcs.push(npc);
    return npc;
  }

  spawnFleeing(x, z, from) {
    const npc = new Npc(this.world.scene, 'civ', x, z);
    const g = this.world.lanes, n = g.nearestNode(x, z);
    npc.corner = { i: n.i, j: n.j, sx: x > n.x ? 1 : -1, sz: z > n.z ? 1 : -1 };
    npc.target = g.cornerPos(npc.corner.i, npc.corner.j, npc.corner.sx, npc.corner.sz);
    npc.flee(from);
    this.list.push(npc);
    this.world.npcs.push(npc);
    return npc;
  }

  pickNextCorner(npc) {
    const opts = this.world.lanes.cornerNeighbours(npc.corner);
    const prev = npc.prevCorner;
    let choice = rng.pick(opts);
    if (prev && opts.length > 1 && choice.i === prev.i && choice.j === prev.j && choice.sx === prev.sx && choice.sz === prev.sz) choice = rng.pick(opts);
    npc.prevCorner = npc.corner;
    npc.corner = choice;
    const p = this.world.lanes.cornerPos(choice.i, choice.j, choice.sx, choice.sz);
    npc.target = { x: p.x + rng.range(-0.6, 0.6), z: p.z + rng.range(-0.6, 0.6) };
    npc.walkSpeed = rng.range(1.2, 1.8);
  }

  trySpawn() {
    const p = this.world.player.pos, g = this.world.lanes;
    const ang = rng.range(0, Math.PI * 2), r = rng.range(PEDS.spawnMin, PEDS.spawnMax);
    const n = g.nearestNode(p.x + Math.cos(ang) * r, p.z + Math.sin(ang) * r);
    const c = { i: n.i, j: n.j, sx: rng.chance(0.5) ? 1 : -1, sz: rng.chance(0.5) ? 1 : -1 };
    if (g.cornerNeighbours(c).length < 2) return;
    const cp = g.cornerPos(c.i, c.j, c.sx, c.sz);
    if (Math.hypot(cp.x - p.x, cp.z - p.z) < PEDS.spawnMin * 0.7) return;
    this.spawnAtCorner(c);
  }

  /** Everyone near a loud event runs. */
  panic(x, z, radius) {
    for (const n of this.list) if (!n.dead && Math.hypot(n.pos.x - x, n.pos.z - z) < radius) n.flee({ x, z });
  }

  remove(npc) {
    npc.remove();
    this.list.splice(this.list.indexOf(npc), 1);
    const all = this.world.npcs;
    const i = all.indexOf(npc);
    if (i >= 0) all.splice(i, 1);
  }

  update(dt) {
    const w = this.world, p = w.player.pos;
    const alive = this.list.filter((n) => !n.dead).length;
    if (alive < PEDS.maxPeds && !w.frozenTraffic) this.trySpawn();
    for (const n of [...this.list]) {
      const far = Math.hypot(n.pos.x - p.x, n.pos.z - p.z) > PEDS.despawn;
      if (far || (n.dead && n.deadTime > 25)) { this.remove(n); continue; }
      if (!n.dead) this.think(n, dt);
      this.checkCars(n);
      n.animate(dt);
    }
  }

  think(n, dt) {
    n.stateTime += dt;
    if (n.state === 'flee') {
      const dx = n.pos.x - n.fleeFrom.x, dz = n.pos.z - n.fleeFrom.z, d = Math.hypot(dx, dz) || 1;
      n.moveToward(n.pos.x + (dx / d) * 5, n.pos.z + (dz / d) * 5, 6.4, dt, this.world);
      if (n.stateTime > 7) { n.state = 'walk'; n.target = null; }
      return;
    }
    if (!n.target) {
      const g = this.world.lanes, nn = g.nearestNode(n.pos.x, n.pos.z);
      n.corner = { i: nn.i, j: nn.j, sx: n.pos.x > nn.x ? 1 : -1, sz: n.pos.z > nn.z ? 1 : -1 };
      this.pickNextCorner(n);
    }
    const d = n.moveToward(n.target.x, n.target.z, n.walkSpeed ?? 1.4, dt, this.world);
    if (d < 0.8) this.pickNextCorner(n);
  }

  /** Cars running people over. */
  checkCars(n) {
    if (n.dead) return;
    for (const v of this.world.vehicles) {
      const sp = Math.hypot(v.vx, v.vz);
      if (sp < 3.5) continue;
      const dx = n.pos.x - v.pos.x, dz = n.pos.z - v.pos.z;
      const lz = dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
      const lx = dx * Math.cos(v.heading) - dz * Math.sin(v.heading);
      if (Math.abs(lx) < v.spec.wid / 2 + 0.3 && Math.abs(lz) < v.spec.len / 2 + 0.3) {
        n.health = 0;
        n.die(this.world, v.driver === 'player' ? 'player-car' : 'car', { x: v.vx * 0.8, y: 4 + sp * 0.15, z: v.vz * 0.8 });
        this.world.audio?.thud();
        this.panic(n.pos.x, n.pos.z, 18);
        if (v.driver === 'player') v.damage(2, this.world);
        return;
      }
    }
  }
}
