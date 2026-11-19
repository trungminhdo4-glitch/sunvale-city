// Third-person camera: orbit on foot, over-the-shoulder when aiming, chase cam with speed FOV in cars, wall avoidance, shake.
import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp } from '../core/mathUtil.js';

export class FollowCamera {
  constructor(camera, game) {
    this.camera = camera;
    this.game = game;
    this.yaw = 0;
    this.pitch = 0.22;
    this.dist = 4.6;
    this.idle = 0;
    this.shakeAmt = 0;
    this.fov = 68;
    this.aiming = false;
    this.lookBack = false;
    this.pivot = new THREE.Vector3();
    this.smoothPivot = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.override = null; // { pos, look } for title orbit and screenshot framing
  }

  shake(a) { this.shakeAmt = Math.min(1, this.shakeAmt + a); }

  snapBehind(yaw) { this.yaw = yaw; this.idle = 10; }

  update(dt, input) {
    const cam = this.camera;
    if (this.override) {
      cam.position.copy(this.override.pos);
      cam.lookAt(this.override.look);
      this.setFov(this.override.fov ?? 60, dt, 99);
      return;
    }
    const p = this.game.player;
    const v = p.vehicle;
    const m = input ? input.takeMouse() : { dx: 0, dy: 0 };
    if (m.dx || m.dy) this.idle = 0; else this.idle += dt;
    const sens = this.aiming ? 0.0013 : 0.0024;
    this.yaw -= m.dx * sens;
    this.pitch = clamp(this.pitch + m.dy * sens * 0.8, -0.45, 1.15);
    this.lookBack = input ? input.down('KeyC') : false;

    let dist, height, fov;
    if (v) {
      const sp = v.absSpeed;
      if (this.idle > 1.0 && sp > 2) {
        const moveYaw = v.speed >= 0 ? v.yaw : v.yaw + Math.PI;
        this.yaw = dampAngle(this.yaw, moveYaw, 2.8, dt);
        this.pitch = damp(this.pitch, 0.2, 1.5, dt);
      }
      dist = 5.2 + v.spec.len * 0.9 + Math.min(sp, 40) * 0.035;
      height = 1.2 + v.spec.hgt * 0.6;
      fov = 70 + Math.min(sp, 50) * 0.28;
      this.pivot.set(v.pos.x, v.pos.y + height, v.pos.z);
    } else {
      dist = this.aiming ? 2.3 : 4.4;
      height = this.aiming ? 1.62 : 1.55;
      fov = this.aiming ? 52 : 68;
      this.pivot.set(p.pos.x, p.pos.y + height, p.pos.z);
    }
    if (this.smoothPivot.lengthSq() === 0) this.smoothPivot.copy(this.pivot);
    this.smoothPivot.x = damp(this.smoothPivot.x, this.pivot.x, v ? 14 : 22, dt);
    this.smoothPivot.y = damp(this.smoothPivot.y, this.pivot.y, 10, dt);
    this.smoothPivot.z = damp(this.smoothPivot.z, this.pivot.z, v ? 14 : 22, dt);
    this.dist = damp(this.dist, dist, 6, dt);

    const yaw = this.yaw + (this.lookBack ? Math.PI : 0);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.forward.set(Math.sin(yaw) * cp, -sp, Math.cos(yaw) * cp);
    const piv = this.smoothPivot;
    const shoulder = this.aiming && !v ? 0.62 : 0;
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const ox = piv.x + rx * shoulder, oz = piv.z + rz * shoulder;
    let d = this.dist;
    const hit = this.game.statics.raycast(ox, piv.y, oz, -this.forward.x, -this.forward.y, -this.forward.z, d + 0.3);
    if (hit) d = Math.max(0.6, hit.t - 0.35);
    cam.position.set(ox - this.forward.x * d, piv.y - this.forward.y * d, oz - this.forward.z * d);
    const gy = this.game.statics.groundHeight(cam.position.x, cam.position.z) + 0.3;
    if (cam.position.y < gy) cam.position.y = gy;
    this.tmp.set(ox + this.forward.x * 10, piv.y + this.forward.y * 10 + (v ? 0.6 : 0), oz + this.forward.z * 10);
    cam.lookAt(this.tmp);
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt * 0.35;
      cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
      this.shakeAmt = damp(this.shakeAmt, 0, 5, dt);
    }
    this.setFov(fov, dt, 4);
  }

  setFov(f, dt, rate) {
    this.fov = lerp(this.fov, f, 1 - Math.exp(-rate * dt));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
  }

  // The aim ray through the screen centre.
  aimRay(origin, dir) {
    origin.copy(this.camera.position);
    this.camera.getWorldDirection(dir);
  }
}
