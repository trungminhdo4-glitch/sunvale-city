// SVPD response: cruisers that chase and ram along the grid, officers who deploy, shoot and cuff, and the arrest meter.
import { POLICE_CARS, POLICE_HELIS } from '../core/config.js';
import { rng } from '../core/rng.js';
import { Character } from '../entities/character.js';
import { WEAPONS } from '../combat/weapons.js';
import { steerToward, LaneDriver } from './drivers.js';
import { chaseWaypoint } from './roadGraph.js';
import { PoliceHelicopter } from './policeHelicopter.js';
import * as THREE from 'three';

export const COP_LOOK = { skin: '#c68e64', shirt: '#1d3557', pants: '#1b263b', hair: '#111111', hat: '#0d1b2a', shoes: '#0b0b0b' };
const muzzle = new THREE.Vector3(), aim = new THREE.Vector3();

export class PoliceDriver {
  constructor() { this.mode = 'pursuit'; this.deployed = false; this.stuck = 0; this.reverseT = 0; this.lane = null; }
  update(v, dt) {
    const g = v.game, p = g.player;
    if (g.wanted.stars === 0) {
      if (this.mode !== 'leave') { this.mode = 'leave'; v.sirenOn = false; this.lane = new LaneDriver(v, 13); }
      this.lane.update(v, dt);
      return;
    }
    if (this.mode === 'leave') { this.mode = 'pursuit'; v.sirenOn = true; }
    if (this.reverseT > 0) { this.reverseT -= dt; v.throttle = -1; v.steer = this.revSteer; v.handbrake = false; return; }
    const tgt = p.vehicle ? p.vehicle.pos : p.pos;
    const d = Math.hypot(tgt.x - v.pos.x, tgt.z - v.pos.z);
    if (!p.vehicle && d < 17) {
      v.steer = 0; v.throttle = v.speed > 0.5 ? -1 : 0; v.handbrake = v.absSpeed < 1.5;
      if (!this.deployed && v.absSpeed < 2.5) { this.deployed = true; g.police.deployOfficers(v); }
      return;
    }
    let tx = tgt.x, tz = tgt.z;
    const los = d < 70 && g.statics.lineOfSight(v.pos.x, 1.2, v.pos.z, tgt.x, 1.2, tgt.z);
    if (los) {
      if (p.vehicle) { const lead = Math.min(1.2, d / 25); tx += p.vehicle.vx * lead; tz += p.vehicle.vz * lead; }
    } else {
      const w = chaseWaypoint(v.pos.x, v.pos.z, tgt.x, tgt.z); tx = w.x; tz = w.z;
    }
    const speed = p.vehicle && d < 14 ? v.spec.maxSpeed : Math.min(v.spec.maxSpeed * 0.92, 16 + d * 0.4);
    steerToward(v, tx, tz, speed);
    if (v.throttle > 0.3 && v.absSpeed < 1) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 1.4) { this.stuck = 0; this.reverseT = 1.1; this.revSteer = -Math.sign(v.steer || 1); }
  }
}

export class CopBrain {
  constructor() { this.shootT = rng.range(0.6, 1.6); this.losT = 0; this.hasLos = false; this.strafe = rng.sign(); }
  update(c, dt) {
    const g = c.game, p = g.player, stars = g.wanted.stars;
    if (stars === 0 || !p.alive) { c.mode = 'idle'; c.weapon = null; c.move(0, 0, 0, dt); return; }
    const tgt = p.vehicle ? p.vehicle.pos : p.pos;
    const dx = tgt.x - c.pos.x, dz = tgt.z - c.pos.z, d = Math.hypot(dx, dz) || 1;
    this.losT -= dt;
    if (this.losT <= 0) { this.losT = 0.3; this.hasLos = g.statics.lineOfSight(c.pos.x, c.pos.y + 1.5, c.pos.z, tgt.x, tgt.y + 1.2, tgt.z); }
    c.weapon = WEAPONS.kestrel;
    const yaw = Math.atan2(dx, dz);
    if (stars >= 2 && this.hasLos && d < 40 && d > 2.6) {
      c.mode = 'aim';
      c.move(-dz / d * this.strafe, dx / d * this.strafe, d > 20 ? 2.2 : 1.1, dt, yaw);
      if (rng.chance(dt * 0.3)) this.strafe *= -1;
      this.shootT -= dt;
      if (this.shootT <= 0) {
        this.shootT = rng.range(0.8, 1.5) / (1 + stars * 0.12);
        muzzle.set(c.pos.x + Math.sin(yaw) * 0.5, c.pos.y + 1.42, c.pos.z + Math.cos(yaw) * 0.5);
        aim.set(tgt.x - muzzle.x, tgt.y + 1.1 - muzzle.y, tgt.z - muzzle.z).normalize();
        g.combat.fire(c, muzzle, aim, WEAPONS.kestrel, { spreadMul: Math.max(1.2, 3.6 - stars * 0.4), damageMul: 0.9 });
      }
    } else {
      c.mode = 'idle';
      c.move(dx / d, dz / d, d > 1.4 ? 6.6 : 0, dt);
    }
  }
}

export class PoliceSystem {
  constructor(game) {
    this.game = game;
    this.helis = [];
    this.spawnT = 0;
    this.arrest = 0;
    this.searchlight = new THREE.SpotLight(0xfff4d6, 0, 140, 0.2, 0.55, 1.4);
    this.searchlightOwner = null;
    game.scene.add(this.searchlight, this.searchlight.target);
  }

  claimSearchlight(heli) {
    if (this.searchlightOwner) return null;
    this.searchlightOwner = heli;
    return this.searchlight;
  }
  releaseSearchlight(heli) {
    if (this.searchlightOwner !== heli) return;
    this.searchlightOwner = null;
    this.searchlight.intensity = 0;
  }

  get cruisers() { return this.game.vehicles.filter((v) => v.controller instanceof PoliceDriver && !v.wrecked); }
  get officers() { return this.game.characters.filter((c) => c.brain instanceof CopBrain && c.alive && !c.vehicle); }

  canSee(x, z, radius, requireLos = true) {
    const g = this.game, st = g.statics;
    for (const v of g.vehicles) {
      if (!(v.controller instanceof PoliceDriver) || v.wrecked) continue;
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d < radius && (!requireLos || d < 18 || st.lineOfSight(v.pos.x, 1.4, v.pos.z, x, 1.2, z))) return true;
    }
    for (const c of g.characters) {
      if (!(c.brain instanceof CopBrain) || !c.alive || c.vehicle) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < radius && (!requireLos || d < 10 || st.lineOfSight(c.pos.x, c.pos.y + 1.6, c.pos.z, x, 1.2, z))) return true;
    }
    for (const h of this.helis) if (!h.dead && Math.hypot(h.pos.x - x, h.pos.z - z) < 75) return true;
    return false;
  }

  makeCop(x, z, yaw) {
    const c = new Character(this.game, { x, z, yaw, look: COP_LOOK, role: 'cop', health: 100 });
    c.brain = new CopBrain();
    this.game.addCharacter(c);
    return c;
  }

  spawnCruiser() {
    const g = this.game, p = g.player, focus = p.vehicle ? p.vehicle.pos : p.pos;
    const v = g.traffic.spawnNear(focus.x, focus.z, 85, 150, 'cruiser');
    if (!v) return null;
    v.isTraffic = false;
    v.controller = new PoliceDriver();
    v.driver.role = 'cop';
    v.sirenOn = true;
    return v;
  }

  deployOfficers(v) {
    const g = this.game;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = -fz, rz = fx;
    const driver = v.driver;
    if (driver) {
      g.ejectFromVehicle(driver);
      driver.brain = new CopBrain(); driver.role = 'cop';
    }
    if (this.officers.length < 10) this.makeCop(v.pos.x - rx * 1.6 + fx * 0.5, v.pos.z - rz * 1.6 + fz * 0.5, v.yaw);
    v.controller = null;
  }

  update(dt) {
    const g = this.game, stars = g.wanted.stars;
    this.spawnT -= dt;
    if (stars > 0 && this.spawnT <= 0 && this.cruisers.length < POLICE_CARS[stars]) {
      this.spawnT = 2.5;
      this.spawnCruiser();
    }
    const liveHelis = this.helis.filter((h) => !h.dead && !h.leaving);
    if (stars > 0 && liveHelis.length < POLICE_HELIS[stars] && this.spawnT <= 1) this.helis.push(new PoliceHelicopter(g));
    if (stars === 0) for (const h of this.helis) h.leaving = true;
    for (const h of this.helis) h.update(dt);
    this.helis = this.helis.filter((h) => { if (h.gone) { h.dispose(); return false; } return true; });

    const p = g.player, focus = p.vehicle ? p.vehicle.pos : p.pos;
    for (const c of g.characters.slice()) {
      if (!(c.brain instanceof CopBrain)) continue;
      const d = Math.hypot(c.pos.x - focus.x, c.pos.z - focus.z);
      if ((stars === 0 && d > 60) || d > 200 || (!c.alive && c.deadTime > 30)) g.removeCharacter(c);
    }
    this.updateArrest(dt);
  }

  updateArrest(dt) {
    const g = this.game, p = g.player;
    let cuffing = false;
    if (g.wanted.stars > 0 && p.alive) {
      const v = p.vehicle;
      const slow = v ? v.absSpeed < 1.2 : Math.hypot(p.vel.x, p.vel.z) < 3.4;
      const reach = v ? 2.2 + v.radius : 1.7;
      const pos = v ? v.pos : p.pos;
      if (slow) for (const c of this.officers) if (Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < reach) { cuffing = true; break; }
    }
    this.arrest = cuffing ? this.arrest + dt : Math.max(0, this.arrest - dt * 2);
    if (this.arrest >= 1.9) { this.arrest = 0; g.arrestPlayer(); }
  }

  clearAll() {
    const g = this.game;
    for (const v of g.vehicles.slice()) if (v.controller instanceof PoliceDriver) g.removeVehicle(v);
    for (const c of g.characters.slice()) if (c.brain instanceof CopBrain) g.removeCharacter(c);
    for (const h of this.helis) h.dispose();
    this.helis = [];
    this.arrest = 0;
  }
}
