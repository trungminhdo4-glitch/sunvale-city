// Kai Navarro, the player: walking, sprinting, jumping, getting in and stealing cars, driving.

import * as THREE from 'three';
import { createHumanoid } from './humanoidModel.js';
import { PLAYER } from '../core/config.js';
import { approachAngle, clamp, damp } from '../core/mathUtil.js';

export class Player {
  constructor(scene) {
    this.model = createHumanoid({ skin: 0xc98e62, shirt: 0xf4f1ea, pants: 0x2e4a6b, hair: 0x1b1410 });
    // open teal shirt over the white tee: Kai's look
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.5, 0.3), new THREE.MeshLambertMaterial({ color: 0x1f9e9a }));
    jacket.position.set(0, -0.04, -0.01);
    jacket.scale.set(1, 1, 1.02);
    jacket.castShadow = true;
    this.model.torso.add(jacket);
    this.root = this.model.root;
    scene.add(this.root);
    this.pos = this.root.position;
    this.heading = 0;
    this.vy = 0;
    this.speed = 0;
    this.health = PLAYER.maxHealth;
    this.armor = 0;
    this.vehicle = null;
    this.aiming = false;
    this.dead = false;
    this.hurtFlash = 0;
  }

  get inCar() { return this.vehicle !== null; }

  placeAt(x, z, heading = 0) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.root.rotation.y = heading;
  }

  hurt(amount, world) {
    if (this.dead) return;
    const absorbed = Math.min(this.armor, amount * 0.7);
    this.armor -= absorbed;
    this.health -= amount - absorbed;
    this.hurtFlash = 1;
    if (this.health <= 0) { this.health = 0; this.dead = true; world.onPlayerDown?.('wasted'); }
  }

  /** On-foot movement relative to the camera yaw. */
  updateOnFoot(dt, input, camYaw, world) {
    const ax = input.axes();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const target = (run ? PLAYER.runSpeed : PLAYER.walkSpeed) * (ax.x !== 0 || ax.y !== 0 ? 1 : 0);
    this.speed = damp(this.speed, target, 10, dt);
    if (ax.x !== 0 || ax.y !== 0) {
      // camera looks along (sin yaw, cos yaw); right is (-cos yaw, sin yaw)
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const dx = fx * ax.y - fz * ax.x;
      const dz = fz * ax.y + fx * ax.x;
      const want = Math.atan2(dx, dz);
      this.heading = approachAngle(this.heading, want, dt * 12);
    }
    if (this.aiming) this.heading = approachAngle(this.heading, camYaw, dt * 20);
    const moveH = this.aiming && (ax.x || ax.y) ? Math.atan2(Math.sin(camYaw) * ax.y - Math.cos(camYaw) * ax.x, Math.cos(camYaw) * ax.y + Math.sin(camYaw) * ax.x) : this.heading;
    const sp = this.aiming ? Math.min(this.speed, PLAYER.walkSpeed * 0.8) : this.speed;
    this.pos.x += Math.sin(moveH) * sp * dt;
    this.pos.z += Math.cos(moveH) * sp * dt;

    if (input.hit('Space') && this.pos.y <= 0.001) this.vy = 5.2;
    this.vy -= 16 * dt;
    this.pos.y = Math.max(0, this.pos.y + this.vy * dt);
    if (this.pos.y === 0) this.vy = 0;

    world.collision.resolve(this.pos, PLAYER.radius, this.pos.y);
    for (const v of world.vehicles) {
      const dx = this.pos.x - v.pos.x, dz = this.pos.z - v.pos.z;
      const d = Math.hypot(dx, dz), r = v.spec.len / 2;
      if (d < r && d > 0.01) {
        // keep the hero outside the car's box (approximate with its local frame)
        const lx = dx * Math.cos(v.heading) - dz * Math.sin(v.heading);
        const lz = dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
        const hw = v.spec.wid / 2 + PLAYER.radius, hl = v.spec.len / 2 + PLAYER.radius;
        if (Math.abs(lx) < hw && Math.abs(lz) < hl) {
          const px = hw - Math.abs(lx), pz = hl - Math.abs(lz);
          let nlx = lx, nlz = lz;
          if (px < pz) nlx = Math.sign(lx) * hw; else nlz = Math.sign(lz) * hl;
          this.pos.x = v.pos.x + nlx * Math.cos(v.heading) + nlz * Math.sin(v.heading);
          this.pos.z = v.pos.z - nlx * Math.sin(v.heading) + nlz * Math.cos(v.heading);
        }
      }
    }
    this.root.rotation.y = this.heading;
    this.model.animate(dt, this.speed, this.aiming);
  }

  /** Nearest car within reach, or null. */
  findCar(vehicles) {
    let best = null, bd = PLAYER.enterCarRange + 1.5;
    for (const v of vehicles) {
      if (v.dead) continue;
      const d = Math.hypot(v.pos.x - this.pos.x, v.pos.z - this.pos.z) - v.spec.wid / 2;
      if (d < bd) { bd = d; best = v; }
    }
    return bd <= PLAYER.enterCarRange ? best : null;
  }

  enterCar(v, world) {
    const prev = v.driver;
    if (prev === 'ai' || prev === 'cop' || prev === 'thug') world.onCarjack?.(v, prev);
    v.driver = 'player';
    v.ai = null;
    this.vehicle = v;
    this.root.visible = false;
    this.model.gun.visible = false;
    world.audio?.door();
  }

  exitCar(world) {
    const v = this.vehicle;
    if (!v) return;
    const side = v.spec.wid / 2 + 0.9;
    const x = v.pos.x - Math.cos(v.heading) * side, z = v.pos.z + Math.sin(v.heading) * side;
    v.driver = null;
    this.vehicle = null;
    this.pos.set(x, 0, z);
    world.collision.resolve(this.pos, PLAYER.radius);
    this.heading = v.heading;
    this.root.visible = true;
    world.audio?.door();
  }

  updateDriving(dt, input, world) {
    const v = this.vehicle;
    const ax = input.axes();
    const ctrl = { throttle: ax.y, steer: ax.x, handbrake: input.down('Space') };
    v.drive(dt, ctrl, world);
    this.pos.set(v.pos.x, 0, v.pos.z);
    this.heading = v.heading;
    this.speed = Math.abs(v.speed);
    if (v.dead && v.burnTime > 1.5) this.exitCar(world);
    void clamp;
  }
}
