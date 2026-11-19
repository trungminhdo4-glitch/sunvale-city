// One car: arcade physics (grip, drift, collisions, damage) and its animated model.

import * as THREE from 'three';
import { VEHICLE_TYPES, createVehicleModel } from './vehicleModels.js';
import { clamp, damp } from '../core/mathUtil.js';

const tmp = { x: 0, z: 0 };

export class Vehicle {
  constructor(type, color, x, z, heading) {
    this.type = type;
    this.spec = VEHICLE_TYPES[type];
    this.model = createVehicleModel(type, color ?? this.spec.colors[0]);
    this.root = this.model.root;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.vx = 0; this.vz = 0;
    this.speed = 0;            // forward speed (m/s), signed
    this.steer = 0;
    this.health = this.spec.health;
    this.dead = false;
    this.driver = null;        // null | 'player' | 'ai' | 'cop' | 'thug'
    this.ai = null;
    this.siren = false;
    this.braking = false;
    this.skid = 0;             // 0..1 slide amount, read by effects and audio
    this.smoke = 0;
    this.radius = this.spec.wid / 2 + 0.15;
    this.lastImpact = 0;
    this.flash = 0;
    this.root.position.copy(this.pos);
    this.root.rotation.y = heading;
  }

  get forwardX() { return Math.sin(this.heading); }
  get forwardZ() { return Math.cos(this.heading); }

  /** Physics step. ctrl: { throttle -1..1, steer -1..1, handbrake } */
  drive(dt, ctrl, world) {
    if (this.dead) ctrl = { throttle: 0, steer: 0, handbrake: true };
    const s = this.spec;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading), rz = -Math.sin(this.heading);
    let vF = this.vx * fx + this.vz * fz;
    let vR = this.vx * rx + this.vz * rz;

    this.braking = false;
    if (ctrl.throttle > 0) {
      if (vF < -0.5) { vF += s.accel * 2 * dt; this.braking = true; }
      else vF += s.accel * ctrl.throttle * dt * (1 - Math.max(0, vF) / s.maxSpeed);
    } else if (ctrl.throttle < 0) {
      if (vF > 0.5) { vF -= s.accel * 2.2 * dt; this.braking = true; }
      else vF = Math.max(-s.maxSpeed * 0.3, vF - s.accel * 0.6 * dt);
    } else {
      vF = damp(vF, 0, 0.35, dt);
    }
    if (ctrl.handbrake) { vF = damp(vF, 0, 1.2, dt); this.braking = true; }
    vF *= 1 - 0.0009 * Math.abs(vF) * dt * 60 * 0.05;

    const grip = ctrl.handbrake ? s.grip * 0.18 : s.grip;
    vR = damp(vR, 0, grip, dt);
    this.skid = clamp(Math.abs(vR) / 6, 0, 1);

    this.steer = damp(this.steer, ctrl.steer, 8, dt);
    const speedFactor = clamp(vF / 7, -1, 1) * (1 - 0.45 * clamp(Math.abs(vF) / s.maxSpeed, 0, 1));
    const yaw = -this.steer * s.steer * speedFactor * (ctrl.handbrake ? 1.35 : 1);
    this.heading += yaw * dt;
    // keep some sideways slip when drifting
    if (ctrl.handbrake) vR += vF * yaw * dt * 0.6;

    const nfx = Math.sin(this.heading), nfz = Math.cos(this.heading);
    const nrx = Math.cos(this.heading), nrz = -Math.sin(this.heading);
    this.vx = nfx * vF + nrx * vR;
    this.vz = nfz * vF + nrz * vR;
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    this.speed = vF;
    this.collideWorld(world);
  }

  /** Two circles along the body against buildings and the coast. */
  collideWorld(world) {
    const half = this.spec.len / 2 - this.radius * 0.8;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    for (const k of [1, -1]) {
      tmp.x = this.pos.x + fx * half * k;
      tmp.z = this.pos.z + fz * half * k;
      const ox = tmp.x, oz = tmp.z;
      const hit = world.collision.resolve(tmp, this.radius, 0.5);
      if (!hit) continue;
      this.pos.x += tmp.x - ox;
      this.pos.z += tmp.z - oz;
      const vn = this.vx * hit.nx + this.vz * hit.nz;
      if (vn < 0) {
        this.vx -= hit.nx * vn * 1.35;
        this.vz -= hit.nz * vn * 1.35;
        this.vx *= 0.8; this.vz *= 0.8;
        if (-vn > 7) this.impact(-vn, world);
      }
    }
  }

  impact(strength, world) {
    const now = world.time;
    if (now - this.lastImpact < 0.25) return;
    this.lastImpact = now;
    this.damage(strength * 0.9, world);
    world.fx?.sparks(this.pos.x + this.forwardX * 2, 0.6, this.pos.z + this.forwardZ * 2, 10);
    world.audio?.crash(Math.min(1, strength / 25));
    if (this.driver === 'player') world.camera?.shake(Math.min(1, strength / 20));
  }

  damage(amount, world) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      world.onVehicleDestroyed?.(this);
    }
  }

  /** Updates the visual model from the physics state. */
  sync(dt, night) {
    const m = this.model;
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.root.rotation.y = this.heading;
    const spin = (this.speed * dt) / 0.36;
    for (const w of m.wheels) w.rotation.x += spin;
    for (const p of m.steerPivots) p.rotation.y = this.steer * 0.5;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const lateral = this.vx * Math.cos(this.heading) - this.vz * Math.sin(this.heading);
    m.body.rotation.z = damp(m.body.rotation.z, clamp(lateral * 0.025, -0.12, 0.12), 6, dt);
    m.body.rotation.x = damp(m.body.rotation.x, this.braking ? 0.035 : 0, 6, dt);
    m.tailMat.color.setHex(this.braking ? 0xff2020 : night > 0.3 ? 0xd01818 : 0x8a1010);
    if (m.lightbar) {
      this.flash += dt;
      const on = this.siren && Math.floor(this.flash * 6) % 2 === 0;
      m.lightbar.redMat.color.setHex(this.siren ? (on ? 0xff3030 : 0x401010) : 0x802020);
      m.lightbar.blueMat.color.setHex(this.siren ? (!on ? 0x3070ff : 0x101040) : 0x203080);
      m.lightbar.redGlow.visible = this.siren && on;
      m.lightbar.blueGlow.visible = this.siren && !on;
    }
    if (this.dead) m.bodyMat === this.burntMat || this.burn();
    void fx; void fz;
  }

  burn() {
    this.burntMat = new THREE.MeshLambertMaterial({ color: 0x1e1c1a });
    this.model.bodyMat = this.burntMat;
    this.root.traverse((o) => { if (o.isMesh && o.material.color && o.material !== this.burntMat && !o.material.isMeshBasicMaterial) o.material = this.burntMat; });
  }
}
