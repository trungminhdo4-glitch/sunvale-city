// A person in the city other than the hero: civilian, police officer or Crane gang member.
// Holds movement, fleeing, ragdoll-lite falls and the shooting behaviour shared by cops and thugs.

import { createHumanoid, SKIN, CLOTH } from './humanoidModel.js';
import { approachAngle, damp } from '../core/mathUtil.js';
import { rng } from '../core/rng.js';

const HAIR = [0x1b1410, 0x3b2a1a, 0x7a5a32, 0xd8b26a, 0x8a8a8a, 0x111111];

export function lookFor(role) {
  if (role === 'cop') return { skin: rng.pick(SKIN), shirt: 0x2c4a7c, pants: 0x1c2638, hair: rng.pick(HAIR), cap: 0x1c2638, badge: 0xf2c94c };
  if (role === 'thug') return { skin: rng.pick(SKIN), shirt: rng.pick([0x222222, 0x5b1a1a, 0x3a3a3a]), pants: 0x2a2a2a, hair: 0x111111, cap: rng.chance(0.5) ? 0xb3261e : undefined };
  return { skin: rng.pick(SKIN), shirt: rng.pick(CLOTH), pants: rng.pick([0x2f3e57, 0x6b5b4b, 0xe5e1d8, 0x3d3d3d, 0x7d9cb8, 0xc0765a]), hair: rng.pick(HAIR), cap: rng.chance(0.15) ? rng.pick(CLOTH) : undefined };
}

export class Npc {
  constructor(scene, role, x, z) {
    this.role = role;
    this.model = createHumanoid(lookFor(role));
    this.root = this.model.root;
    this.pos = this.root.position;
    this.pos.set(x, 0, z);
    this.heading = rng.range(-Math.PI, Math.PI);
    this.speed = 0;
    this.health = role === 'civ' ? 40 : role === 'cop' ? 70 : 60;
    this.dead = false;
    this.deadTime = 0;
    this.state = 'walk';
    this.stateTime = 0;
    this.target = null;       // { x, z } walking goal
    this.corner = null;       // sidewalk corner (pedestrians)
    this.fleeFrom = null;
    this.fireCooldown = rng.range(0.5, 1.5);
    this.flyVel = null;
    this.armed = role !== 'civ';
    this.model.gun.visible = this.armed;
    scene.add(this.root);
    this.scene = scene;
  }

  remove() { this.scene.remove(this.root); this.removed = true; }

  /** Walks toward (x, z) at speed; returns remaining distance. */
  moveToward(x, z, speed, dt, world) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      this.heading = approachAngle(this.heading, Math.atan2(dx, dz), dt * 8);
      const step = Math.min(d, speed * dt);
      this.pos.x += Math.sin(this.heading) * step;
      this.pos.z += Math.cos(this.heading) * step;
    }
    this.speed = damp(this.speed, d > 0.3 ? speed : 0, 8, dt);
    world.collision.resolve(this.pos, 0.4);
    return d;
  }

  face(x, z, dt) {
    this.heading = approachAngle(this.heading, Math.atan2(x - this.pos.x, z - this.pos.z), dt * 10);
  }

  hurt(amount, world, from) {
    if (this.dead) return;
    this.health -= amount;
    world.fx?.blood(this.pos.x, 1.3, this.pos.z);
    if (this.health <= 0) this.die(world, from);
    else if (this.role === 'civ') this.flee(from ?? world.player.pos);
  }

  die(world, from, fly = null) {
    if (this.dead) return;
    this.dead = true;
    this.deadTime = 0;
    this.speed = 0;
    this.model.fall();
    this.model.gun.visible = false;
    if (fly) this.flyVel = fly;
    world.onNpcKilled?.(this, from);
  }

  flee(from) {
    if (this.role !== 'civ' || this.dead) return;
    this.state = 'flee';
    this.stateTime = 0;
    this.fleeFrom = { x: from.x, z: from.z };
  }

  /** Cop and thug fighting: keep distance, face the target, shoot when in sight. */
  fight(dt, world, target, { range = 32, keep = 11, accuracy = 0.45, damage = 7 } = {}) {
    const d = Math.hypot(target.x - this.pos.x, target.z - this.pos.z);
    const sees = d < range && world.collision.canSee(this.pos.x, this.pos.z, target.x, target.z);
    if (!sees || d > keep + 4) this.moveToward(target.x, target.z, 6.2, dt, world);
    else { this.speed = damp(this.speed, 0, 8, dt); this.face(target.x, target.z, dt); }
    this.fireCooldown -= dt;
    this.aiming = sees;
    if (sees && this.fireCooldown <= 0) {
      this.fireCooldown = rng.range(0.7, 1.4);
      world.combat.npcFire(this, target, accuracy * (1 - d / (range * 1.6)), damage);
    }
  }

  animate(dt) {
    if (this.dead) {
      this.deadTime += dt;
      if (this.flyVel) {
        this.pos.x += this.flyVel.x * dt; this.pos.z += this.flyVel.z * dt;
        this.flyVel.y -= 20 * dt;
        this.pos.y = Math.max(0, this.pos.y + this.flyVel.y * dt);
        this.flyVel.x *= 0.96; this.flyVel.z *= 0.96;
        if (this.pos.y === 0 && this.flyVel.y < 0) this.flyVel = null;
      }
    } else {
      this.model.animate(dt, this.speed, this.aiming);
    }
    this.root.rotation.y = this.heading;
  }
}
