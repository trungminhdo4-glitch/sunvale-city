// SVPD response: cruisers that route over the road graph and ram, officers who leave their
// cars to arrest or shoot, and the helicopter with its searchlight from three stars up.

import * as THREE from 'three';
import { POLICE } from '../core/config.js';
import { Vehicle } from '../actors/vehicle.js';
import { Npc } from '../actors/npc.js';
import { clamp, wrapAngle } from '../core/mathUtil.js';
import { rng } from '../core/rng.js';
import { softDotTexture } from '../render/textures.js';

function createHelicopter(scene) {
  const g = new THREE.Group();
  const body = new THREE.MeshPhongMaterial({ color: 0x1a2a5a, shininess: 60 });
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x1d2a36, shininess: 90 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(2.2, 2, 4.2), body, 0, 0, 0);
  add(new THREE.BoxGeometry(2.0, 1.4, 1.6), glass, 0, 0.1, 2.4);
  add(new THREE.BoxGeometry(0.5, 0.5, 5.5), white, 0, 0.3, -4.6);
  add(new THREE.BoxGeometry(0.15, 1.6, 0.9), body, 0, 0.9, -7.1);
  add(new THREE.BoxGeometry(0.15, 0.3, 4), white, 1.0, -1.3, 0.2);
  add(new THREE.BoxGeometry(0.15, 0.3, 4), white, -1.0, -1.3, 0.2);
  const rotor = add(new THREE.BoxGeometry(11, 0.08, 0.4), white, 0, 1.25, 0);
  const rotor2 = add(new THREE.BoxGeometry(0.4, 0.08, 11), white, 0, 1.25, 0);
  const tail = add(new THREE.BoxGeometry(0.08, 1.8, 0.2), white, 0.25, 0.9, -7.1);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(6, 40, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.set(0, -20, 1);
  g.add(beam);
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 24),
    new THREE.MeshBasicMaterial({ map: softDotTexture(), color: 0xfff1c0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  spot.rotation.x = -Math.PI / 2;
  scene.add(spot);
  g.visible = false; spot.visible = false;
  scene.add(g);
  return { group: g, rotor, rotor2, tail, beam, spot, pos: new THREE.Vector3(0, 40, 0), active: false, fire: 1 };
}

export class PoliceSystem {
  constructor(world) {
    this.world = world;
    this.cars = [];
    this.officers = [];
    this.heli = createHelicopter(world.scene);
    this.arrest = 0;
  }

  officerNear(x, z, r) {
    for (const o of this.officers) if (!o.dead && Math.hypot(o.pos.x - x, o.pos.z - z) < r) return true;
    for (const c of this.cars) if (!c.dead && Math.hypot(c.pos.x - x, c.pos.z - z) < r) return true;
    return false;
  }

  canSeePlayer() {
    const p = this.world.player.pos, col = this.world.collision;
    if (this.heli.active && Math.hypot(this.heli.pos.x - p.x, this.heli.pos.z - p.z) < 70) return true;
    for (const o of this.officers) if (!o.dead && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < POLICE.sightRange && col.canSee(o.pos.x, o.pos.z, p.x, p.z)) return true;
    for (const c of this.cars) if (!c.dead && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < POLICE.sightRange && col.canSee(c.pos.x, c.pos.z, p.x, p.z, 1.2)) return true;
    return false;
  }

  /** Cruiser on the road graph, out of view of the player. */
  spawnCar(near = null) {
    const w = this.world, p = near ?? w.player.pos;
    const g = w.lanes;
    let node = null;
    for (let tries = 0; tries < 12 && !node; tries++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(90, 140);
      const n = g.nearestNode(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
      if (Math.hypot(n.x - p.x, n.z - p.z) > 70) node = n;
    }
    if (!node) return null;
    return this.addCar(node.x + 3, node.z + 3, Math.atan2(p.x - node.x, p.z - node.z));
  }

  addCar(x, z, heading) {
    const v = new Vehicle('cruiser', 0xf5f5f5, x, z, heading);
    v.driver = 'cop';
    v.police = true;
    v.siren = true;
    v.crew = 2;
    v.chase = { node: null, stuck: 0, reverse: 0 };
    this.world.traffic.addVehicle(v);
    this.cars.push(v);
    return v;
  }

  addOfficer(x, z) {
    const o = new Npc(this.world.scene, 'cop', x, z);
    this.officers.push(o);
    this.world.npcs.push(o);
    return o;
  }

  removeOfficer(o) {
    o.remove();
    this.officers.splice(this.officers.indexOf(o), 1);
    const i = this.world.npcs.indexOf(o);
    if (i >= 0) this.world.npcs.splice(i, 1);
  }

  update(dt) {
    const w = this.world, lvl = w.wanted.level, p = w.player.pos;
    // keep the response matched to the stars
    const liveCars = this.cars.filter((c) => !c.dead && c.driver === 'cop');
    if (lvl > 0 && liveCars.length < POLICE.carsPerLevel[lvl] && rng.chance(dt * 0.8)) this.spawnCar();
    for (const c of [...this.cars]) {
      const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
      if ((lvl === 0 && d > 120) || d > 260 || (c.dead && d > 90)) {
        this.cars.splice(this.cars.indexOf(c), 1);
        if (w.vehicles.includes(c)) w.traffic.removeVehicle(c);
        continue;
      }
      c.siren = lvl > 0 && c.driver === 'cop';
      if (c.driver === 'cop' && !c.dead) this.driveChase(c, dt, lvl);
    }
    for (const o of [...this.officers]) {
      const d = Math.hypot(o.pos.x - p.x, o.pos.z - p.z);
      if ((o.dead && o.deadTime > 20) || d > 150 || (lvl === 0 && d > 70)) { this.removeOfficer(o); continue; }
      if (!o.dead) this.thinkOfficer(o, dt, lvl);
      w.peds.checkCars(o);
      o.animate(dt);
    }
    this.updateArrest(dt, lvl);
    this.updateHeli(dt, lvl);
    // nearest siren for the audio
    let nearest = Infinity;
    for (const c of this.cars) if (c.siren) nearest = Math.min(nearest, Math.hypot(c.pos.x - p.x, c.pos.z - p.z));
    w.audio?.setSiren(nearest);
  }

  /** Physics driving toward the player through the road grid, with unstick reversing. */
  driveChase(c, dt, lvl) {
    const w = this.world, p = w.player.pos, g = w.lanes;
    const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
    if (lvl === 0) { c.drive(dt, { throttle: 0.35, steer: 0, handbrake: false }, w); return; }
    const playerCar = w.player.vehicle;
    let tx, tz;
    if (d < 48 && w.collision.canSee(c.pos.x, c.pos.z, p.x, p.z, 1)) {
      const lead = playerCar ? 0.5 : 0;
      tx = p.x + (playerCar?.vx ?? 0) * lead; tz = p.z + (playerCar?.vz ?? 0) * lead;
      c.chase.node = null;
    } else {
      const here = g.nearestNode(c.pos.x, c.pos.z), goal = g.nearestNode(p.x, p.z);
      if (!c.chase.node || Math.hypot(g.node(c.chase.node).x - c.pos.x, g.node(c.chase.node).z - c.pos.z) < 9) {
        c.chase.node = here.id === goal.id ? goal.id : g.stepToward(here.id, goal.id);
        if (Math.hypot(g.node(c.chase.node).x - c.pos.x, g.node(c.chase.node).z - c.pos.z) < 9) c.chase.node = g.stepToward(c.chase.node, goal.id);
      }
      const n = g.node(c.chase.node);
      tx = n.x; tz = n.z;
    }
    const want = Math.atan2(tx - c.pos.x, tz - c.pos.z);
    const diff = wrapAngle(want - c.heading);
    let throttle = Math.abs(diff) > 1.2 ? 0.5 : 1;
    let steer = clamp(-diff * 2.2, -1, 1);
    const onFootStop = !playerCar && d < 16;
    if (onFootStop || (playerCar && Math.abs(playerCar.speed) < 3 && d < 14)) throttle = c.speed > 1 ? -1 : 0;
    if (c.chase.reverse > 0) { c.chase.reverse -= dt; throttle = -1; steer = -steer; }
    else if (throttle > 0 && Math.abs(c.speed) < 1.2) {
      c.chase.stuck += dt;
      if (c.chase.stuck > 1.4) { c.chase.reverse = 1.1; c.chase.stuck = 0; }
    } else c.chase.stuck = 0;
    c.drive(dt, { throttle, steer, handbrake: Math.abs(diff) > 1.7 && c.speed > 14 }, w);
    // stopped near the player: officers get out
    if (d < 22 && Math.abs(c.speed) < 2 && c.crew > 0) {
      const alive = this.officers.filter((o) => !o.dead).length;
      if (alive < POLICE.footPerLevel[lvl]) {
        c.crew--;
        const side = c.crew % 2 ? 1 : -1;
        this.addOfficer(c.pos.x + Math.cos(c.heading) * 1.8 * side, c.pos.z - Math.sin(c.heading) * 1.8 * side);
      }
    }
  }

  thinkOfficer(o, dt, lvl) {
    const w = this.world, p = w.player.pos;
    if (lvl === 0) { o.aiming = false; o.moveToward(o.pos.x + Math.sin(o.heading) * 3, o.pos.z + Math.cos(o.heading) * 3, 1.5, dt, w); return; }
    if (lvl === 1 && !w.player.inCar) { o.aiming = false; o.moveToward(p.x, p.z, 6.8, dt, w); return; }
    o.fight(dt, w, p, { range: 34, keep: 10, accuracy: 0.32 + lvl * 0.05, damage: 5 + lvl });
  }

  updateArrest(dt, lvl) {
    const w = this.world, pl = w.player;
    let close = false;
    if (lvl > 0 && !pl.inCar) for (const o of this.officers) if (!o.dead && Math.hypot(o.pos.x - pl.pos.x, o.pos.z - pl.pos.z) < 2.0) close = true;
    if (lvl > 0 && pl.inCar && Math.abs(pl.vehicle.speed) < 0.6) {
      for (const o of this.officers) if (!o.dead && Math.hypot(o.pos.x - pl.pos.x, o.pos.z - pl.pos.z) < 3.2) close = true;
    }
    this.arrest = close ? this.arrest + dt : Math.max(0, this.arrest - dt * 2);
    if (this.arrest > POLICE.arrestTime) { this.arrest = 0; w.onPlayerDown?.('busted'); }
  }

  updateHeli(dt, lvl) {
    const h = this.heli, w = this.world, p = w.player.pos;
    const want = lvl >= 3;
    if (want && !h.active) { h.active = true; h.pos.set(p.x - 120, 45, p.z - 120); }
    if (!want && h.active) { h.pos.y += dt * 10; if (h.pos.y > 120) h.active = false; }
    h.group.visible = h.spot.visible = h.active;
    if (!h.active) return;
    const t = w.time;
    const tx = p.x + Math.sin(t * 0.3) * 14, tz = p.z + Math.cos(t * 0.3) * 14 - 8;
    const k = 1 - Math.exp(-dt * 0.9);
    const ox = h.pos.x, oz = h.pos.z;
    h.pos.x += (tx - h.pos.x) * k; h.pos.z += (tz - h.pos.z) * k;
    if (want) h.pos.y += (32 - h.pos.y) * k;
    const vx = (h.pos.x - ox) / dt, vz = (h.pos.z - oz) / dt;
    h.group.position.copy(h.pos);
    h.group.rotation.y = Math.atan2(p.x - h.pos.x, p.z - h.pos.z);
    h.group.rotation.x = clamp(Math.hypot(vx, vz) * 0.01, 0, 0.25);
    h.rotor.rotation.y += dt * 40; h.rotor2.rotation.y += dt * 40; h.tail.rotation.x += dt * 50;
    // the searchlight swings onto the player
    const lx = p.x - h.pos.x, lz = p.z - h.pos.z;
    h.beam.position.set(0, -h.pos.y / 2, 0);
    h.beam.scale.set(1, h.pos.y / 40, 1);
    h.spot.position.set(p.x + Math.sin(t * 1.3) * 1.5, 0.25, p.z + Math.cos(t * 1.1) * 1.5);
    void lx; void lz;
    if (lvl >= 4) {
      h.fire -= dt;
      if (h.fire <= 0) { h.fire = rng.range(0.25, 0.5); w.combat.heliFire(h.pos, p, 0.25, 4); }
    }
  }

  clearAll() {
    for (const o of [...this.officers]) this.removeOfficer(o);
    for (const c of this.cars) if (this.world.vehicles.includes(c)) this.world.traffic.removeVehicle(c);
    this.cars = [];
    this.heli.active = false;
    this.heli.group.visible = this.heli.spot.visible = false;
  }
}
