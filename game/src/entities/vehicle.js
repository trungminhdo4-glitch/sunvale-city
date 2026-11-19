// A drivable car: arcade physics with grip and handbrake drift, collisions, damage, smoke, fire and explosion.
import * as THREE from 'three';
import { VEHICLE_TYPES, buildVehicleMesh } from './vehicleModels.js';
import { clamp, damp, wrapAngle } from '../core/mathUtil.js';

let nextId = 1;

export class Vehicle {
  constructor(game, type, x, z, yaw = 0, color = null) {
    this.game = game;
    this.id = nextId++;
    this.type = type;
    this.spec = VEHICLE_TYPES[type];
    this.color = color ?? this.spec.colors[0];
    this.model = buildVehicleMesh(this.spec, this.color);
    this.mesh = this.model.root;
    game.scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, game.statics.groundHeight(x, z), z);
    this.yaw = yaw;
    this.vx = 0; this.vz = 0;
    this.throttle = 0; this.steer = 0; this.handbrake = false;
    this.steerAngle = 0;
    this.health = this.maxHealth = this.spec.health;
    this.wrecked = false;
    this.burnTime = 0;
    this.driver = null;
    this.controller = null;
    this.sirenOn = !!this.spec.police;
    this.persistent = false;
    this.radius = this.spec.wid * 0.5;
    this.halfLen = this.spec.len * 0.5 - this.radius;
    this.wheelSpin = 0;
    this.roll = 0; this.pitch = 0;
    this.lastVf = 0;
    this.blink = 0;
    this.smokeT = 0;
    this.impactCooldown = 0;
    this.drift = 0;
    this.tag = '';
  }

  get fx() { return Math.sin(this.yaw); }
  get fz() { return Math.cos(this.yaw); }
  get speed() { return this.vx * this.fx + this.vz * this.fz; }
  get absSpeed() { return Math.hypot(this.vx, this.vz); }
  get isPolice() { return !!this.spec.police; }

  // The two circles that approximate the body (rear, front).
  circles(out = [{}, {}]) {
    const f = this.halfLen;
    out[0].x = this.pos.x - this.fx * f; out[0].z = this.pos.z - this.fz * f;
    out[1].x = this.pos.x + this.fx * f; out[1].z = this.pos.z + this.fz * f;
    return out;
  }

  update(dt) {
    if (this.controller && !this.wrecked) this.controller.update(this, dt);
    else if (!this.driver) { this.throttle = 0; this.handbrake = true; this.steer = 0; }
    this.physics(dt);
    this.updateDamageState(dt);
  }

  physics(dt) {
    const s = this.spec;
    const fx = this.fx, fz = this.fz, rx = -fz, rz = fx;
    let vf = this.vx * fx + this.vz * fz;
    let vr = this.vx * rx + this.vz * rz;
    const thr = this.wrecked ? 0 : this.throttle;
    if (thr > 0) {
      if (vf < -0.5) vf += 26 * thr * dt;
      else vf += s.accel * thr * dt * Math.max(0.08, 1 - vf / s.maxSpeed);
    } else if (thr < 0) {
      if (vf > 0.5) vf += 26 * thr * dt;
      else if (vf > -s.maxSpeed * 0.32) vf += s.accel * 0.55 * thr * dt;
    } else {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), 3.2 * dt);
    }
    vf -= vf * 0.04 * dt;
    const grip = this.handbrake ? 1.4 : s.grip;
    vr *= Math.exp(-grip * dt);
    if (this.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);
    this.drift = Math.abs(vr);

    const maxSteer = 0.62 / (1 + Math.abs(vf) * 0.11);
    this.steerAngle = damp(this.steerAngle, this.steer * maxSteer, 9, dt);
    const wheelBase = s.len * 0.62;
    let yawRate = (vf / wheelBase) * Math.tan(this.steerAngle);
    if (this.handbrake && Math.abs(vf) > 4) yawRate *= 1.55;
    this.yaw = wrapAngle(this.yaw + yawRate * dt);

    this.vx = fx * vf + rx * vr;
    this.vz = fz * vf + rz * vr;
    const ax = (vf - this.lastVf) / dt;
    this.lastVf = vf;
    this.pitch = damp(this.pitch, clamp(-ax * 0.004, -0.05, 0.05), 6, dt);
    this.roll = damp(this.roll, clamp(yawRate * vf * 0.0035, -0.07, 0.07), 6, dt);
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    this.collideStatic();
    this.game.statics.clampToWorld(this.pos);
    const gy = this.game.statics.groundHeight(this.pos.x, this.pos.z);
    this.pos.y = damp(this.pos.y, gy, 18, dt);
    this.wheelSpin += vf * dt / s.wheelR;
    this.impactCooldown -= dt;
  }

  collideStatic() {
    const st = this.game.statics;
    const c = this.circles();
    for (let k = 0; k < 2; k++) {
      const p = { x: c[k].x, z: c[k].z };
      const n = st.resolveCircle(p, this.radius, this.pos.y, 1.4);
      if (!n) continue;
      const dx = p.x - c[k].x, dz = p.z - c[k].z;
      this.pos.x += dx; this.pos.z += dz;
      c[0].x += dx; c[0].z += dz; c[1].x += dx; c[1].z += dz;
      const vn = this.vx * n.nx + this.vz * n.nz;
      if (vn < 0) {
        this.vx -= 1.35 * vn * n.nx; this.vz -= 1.35 * vn * n.nz;
        this.vx *= 0.9; this.vz *= 0.9;
        this.onImpact(-vn, null);
      }
    }
  }

  onImpact(speed, other) {
    if (speed > 5 && this.impactCooldown <= 0) {
      this.impactCooldown = 0.25;
      this.damage((speed - 4) * 11 * (this.spec.armored ? 0.35 : 1), other?.driver ?? null, 'crash');
      this.game.audio?.impact(speed, this.pos);
      this.game.fx?.sparks(this.pos.x, this.pos.y + 0.6, this.pos.z, Math.min(18, speed));
      if (this.driver === this.game.player) this.game.camCtl?.shake(Math.min(0.6, speed * 0.025));
    }
  }

  damage(amount, from = null, kind = 'bullet') {
    if (this.wrecked) return;
    this.health -= amount;
    if (from) this.lastAttacker = from;
    this.game.events.emit('vehicleHurt', { vehicle: this, from, amount, kind });
    if (this.health <= 0 && this.burnTime === 0) this.burnTime = 0.0001;
  }

  updateDamageState(dt) {
    const h = this.health / this.maxHealth;
    this.smokeT -= dt;
    if (!this.wrecked && h < 0.45 && this.smokeT <= 0) {
      this.smokeT = h < 0.2 ? 0.05 : 0.12;
      this.game.fx?.engineSmoke(this, h);
    }
    if (this.burnTime > 0 && !this.wrecked) {
      this.burnTime += dt;
      if (this.burnTime > 4.5) this.explode();
    }
  }

  explode() {
    if (this.wrecked) return;
    this.wrecked = true;
    this.health = 0;
    const src = this.lastAttacker ?? null;
    this.game.combat?.explosion(this.pos.x, this.pos.y + 0.8, this.pos.z, 9, 160, src, this);
    this.model.root.traverse((o) => { if (o.isMesh) o.material = this.model.wreckMat ??= new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 1 }); });
    for (const sp of this.model.lights.sprites) sp.visible = false;
    this.vx *= 0.3; this.vz *= 0.3;
    this.sirenOn = false;
    this.game.events.emit('vehicleDestroyed', { vehicle: this, from: src });
    if (this.driver) this.game.ejectFromVehicle(this.driver, true);
  }

  sync(dt) {
    const m = this.mesh;
    m.position.copy(this.pos);
    m.rotation.set(0, this.yaw, 0);
    this.model.body.rotation.set(this.pitch, 0, this.roll);
    this.model.body.position.y = Math.sin(this.wheelSpin * 0.3) * 0.004 * Math.min(1, this.absSpeed);
    for (const w of this.model.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      w.pivot.rotation.y = w.front ? this.steerAngle : 0;
    }
    this.model.lights.brake.emissiveIntensity = this.throttle < -0.1 && this.speed > 0.5 ? 3 : 0.5;
    const L = this.model.lights;
    if (L.bar) {
      this.blink += dt;
      const on = this.sirenOn && !this.wrecked;
      const phase = Math.floor(this.blink * 6) % 2 === 0;
      L.bar.red.material.emissiveIntensity = on && phase ? 4 : 0.2;
      L.bar.blue.material.emissiveIntensity = on && !phase ? 4 : 0.2;
      L.sprites[0].visible = on && phase;
      L.sprites[1].visible = on && !phase;
    }
  }

  setColor(hex) { this.color = hex; this.model.paint.color.set(hex); }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.model.paint.dispose();
  }
}
