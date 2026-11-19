// A person in the world (player, pedestrian, officer, Calloway goon or contact): movement, health, death and pose.
import * as THREE from 'three';
import { createHumanoid, animateHumanoid } from './humanoid.js';
import { damp, dampAngle, clamp } from '../core/mathUtil.js';

export class Character {
  constructor(game, { x, z, yaw = 0, look = {}, role = 'ped', health = 100, name = '' }) {
    this.game = game;
    this.role = role;
    this.name = name;
    this.h = createHumanoid(look);
    this.mesh = this.h.root;
    game.scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, game.statics.groundHeight(x, z), z);
    this.vel = new THREE.Vector3();
    this.yaw = yaw;
    this.radius = 0.36;
    this.health = this.maxHealth = health;
    this.armor = 0;
    this.alive = true;
    this.vehicle = null;
    this.brain = null;
    this.phase = 0;
    this.mode = 'idle';
    this.speed01 = 0;
    this.deadTime = 0;
    this.onGround = true;
    this.weapon = null;
    this.cooldown = 0;
    this.punchT = 1;
    this.knockback = new THREE.Vector3();
    this.lastAttacker = null;
    this.fallAngle = 0;
    this.time = 0;
  }

  get chestY() { return this.pos.y + 1.3; }

  // Steers toward a horizontal velocity; faceYaw (optional) overrides the facing direction.
  move(dirX, dirZ, speed, dt, faceYaw = null) {
    const tx = dirX * speed, tz = dirZ * speed;
    const a = this.onGround ? 14 : 3;
    this.vel.x = damp(this.vel.x, tx, a, dt);
    this.vel.z = damp(this.vel.z, tz, a, dt);
    if (faceYaw !== null) this.yaw = dampAngle(this.yaw, faceYaw, 16, dt);
    else if (speed > 0.2 && (dirX || dirZ)) this.yaw = dampAngle(this.yaw, Math.atan2(dirX, dirZ), 10, dt);
  }

  jump() { if (this.onGround && this.alive) { this.vel.y = 5.2; this.onGround = false; } }

  physics(dt) {
    if (this.vehicle) return;
    const g = this.game;
    this.vel.y -= 18 * dt;
    if (this.knockback.lengthSq() > 0.01) {
      this.pos.x += this.knockback.x * dt; this.pos.z += this.knockback.z * dt;
      this.knockback.multiplyScalar(Math.exp(-5 * dt));
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    g.statics.resolveCircle(this.pos, this.radius, this.pos.y, 1.8);
    g.statics.clampToWorld(this.pos);
    const gy = g.statics.groundHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= gy + 0.02 || (this.onGround && this.pos.y - gy < 0.5)) {
      this.pos.y = gy; if (this.vel.y < 0) this.vel.y = 0; this.onGround = true;
    } else this.onGround = false;
  }

  heal(n) { this.health = clamp(this.health + n, 0, this.maxHealth); }

  damage(amount, from = null, kind = 'bullet') {
    if (!this.alive || this.invulnerable) return;
    this.lastHurt = this.time;
    if (this.armor > 0 && kind !== 'fall') {
      const absorbed = Math.min(this.armor, amount * 0.7);
      this.armor -= absorbed; amount -= absorbed;
    }
    this.health -= amount;
    this.lastAttacker = from;
    this.game.events.emit('characterHurt', { victim: this, from, amount, kind });
    if (this.health <= 0) this.die(from, kind);
  }

  die(from, kind) {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.deadTime = 0;
    this.vel.set(0, 0, 0);
    this.game.events.emit('characterKilled', { victim: this, from, kind });
  }

  sync(dt) {
    this.time += dt;
    const m = this.mesh;
    m.visible = !this.vehicle;
    if (this.vehicle) return;
    m.position.copy(this.pos);
    m.rotation.y = this.yaw;
    if (!this.alive) {
      this.deadTime += dt;
      this.fallAngle = damp(this.fallAngle, -Math.PI / 2, 7, dt);
      m.rotation.x = this.fallAngle;
      m.position.y = this.pos.y + 0.14 * (this.fallAngle / (-Math.PI / 2));
      animateHumanoid(this.h, 0, 0, 'idle', 0);
      this.h.armL.pivot.rotation.z = 0.9; this.h.armR.pivot.rotation.z = -0.6;
      return;
    }
    m.rotation.x = 0;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.speed01 = clamp(sp / 7, 0, 1);
    this.phase += sp * dt * 1.9;
    this.punchT += dt * 3;
    const mode = this.punchT < 1 ? 'punch' : this.mode;
    animateHumanoid(this.h, this.phase, this.speed01, mode === 'idle' && sp > 0.4 ? (sp > 5 ? 'run' : 'walk') : mode, this.punchT < 1 ? this.punchT : this.time);
    this.h.gun.visible = !!this.weapon && !this.weapon.melee;
  }

  dispose() { this.game.scene.remove(this.mesh); }
}
