// Calloway's collectors: armed goons who take cover behind their spot, strafe and shoot at Rio on sight.
import * as THREE from 'three';
import { rng } from '../core/rng.js';
import { WEAPONS } from '../combat/weapons.js';
import { Character } from '../entities/character.js';

export const GOON_LOOK = { skin: '#b07850', shirt: '#1f1f24', pants: '#3b2f2f', hair: '#111111', hat: '#ff6f61', shoes: '#111111', build: 1.12 };
const muzzle = new THREE.Vector3(), aim = new THREE.Vector3();

export class GoonBrain {
  constructor(homeX, homeZ, weapon = 'kestrel') {
    this.homeX = homeX; this.homeZ = homeZ;
    this.weapon = WEAPONS[weapon];
    this.shootT = rng.range(0.8, 2);
    this.losT = 0; this.hasLos = false;
    this.alerted = false;
    this.strafe = rng.sign();
  }
  update(c, dt) {
    const g = c.game, p = g.player;
    if (!p.alive) { c.mode = 'idle'; c.move(0, 0, 0, dt); return; }
    const tgt = p.vehicle ? p.vehicle.pos : p.pos;
    const dx = tgt.x - c.pos.x, dz = tgt.z - c.pos.z, d = Math.hypot(dx, dz) || 1;
    this.losT -= dt;
    if (this.losT <= 0) { this.losT = 0.25; this.hasLos = d < 55 && g.statics.lineOfSight(c.pos.x, c.pos.y + 1.5, c.pos.z, tgt.x, tgt.y + 1.2, tgt.z); }
    if (!this.alerted && (d < 30 || c.health < c.maxHealth)) this.alerted = true;
    c.weapon = this.weapon;
    if (!this.alerted) {
      c.mode = 'idle';
      c.move(0, 0, 0, dt, Math.atan2(dx, dz));
      return;
    }
    const yaw = Math.atan2(dx, dz);
    if (this.hasLos && d < 45) {
      c.mode = 'aim';
      const hx = this.homeX - c.pos.x, hz = this.homeZ - c.pos.z, hd = Math.hypot(hx, hz);
      const back = hd > 7 ? 1 : 0;
      c.move(-dz / d * this.strafe + (back ? hx / hd : 0), dx / d * this.strafe + (back ? hz / hd : 0), 2.0, dt, yaw);
      if (rng.chance(dt * 0.4)) this.strafe *= -1;
      this.shootT -= dt;
      if (this.shootT <= 0) {
        this.shootT = this.weapon.auto ? rng.range(0.25, 0.5) : rng.range(0.9, 1.6);
        muzzle.set(c.pos.x + Math.sin(yaw) * 0.5, c.pos.y + 1.42, c.pos.z + Math.cos(yaw) * 0.5);
        aim.set(tgt.x - muzzle.x, tgt.y + 1.1 - muzzle.y, tgt.z - muzzle.z).normalize();
        g.combat.fire(c, muzzle, aim, this.weapon, { spreadMul: 3.2, damageMul: 0.8 });
      }
    } else {
      c.mode = 'idle';
      c.move(dx / d, dz / d, d > 6 ? 5.2 : 0, dt);
    }
  }
}

export function spawnGoon(game, x, z, weapon = 'kestrel') {
  const c = new Character(game, { x, z, yaw: rng.range(0, 6.28), look: GOON_LOOK, role: 'thug', health: 120, name: 'Calloway collector' });
  c.brain = new GoonBrain(x, z, weapon);
  game.addCharacter(c);
  return c;
}
