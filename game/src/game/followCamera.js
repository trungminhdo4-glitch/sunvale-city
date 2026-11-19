// Third-person camera: mouse orbit on foot, over-the-shoulder when aiming, chase cam in cars
// with speed FOV, wall avoidance, recoil kick and impact shake.

import * as THREE from 'three';
import { clamp, damp, wrapAngle } from '../core/mathUtil.js';

export class FollowCamera {
  constructor(camera, world) {
    this.cam = camera;
    this.world = world;
    this.yaw = 0;
    this.pitch = 0.22;
    this.dist = 6;
    this.idle = 0;
    this.shakeAmt = 0;
    this.kickAmt = 0;
    this.mode = 'play';
    this.look = new THREE.Vector3();
    this.fov = 62;
  }

  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
  kick(a) { this.kickAmt += a; }

  /** Puts the camera behind a heading instantly (respawn, enter car). */
  snapBehind(heading) { this.yaw = heading; this.idle = 10; }

  update(dt, input) {
    if (this.mode === 'cinematic') return;
    const w = this.world, pl = w.player, car = pl.vehicle;
    const sens = 0.0024;
    if (input.mouseDX || input.mouseDY) {
      this.yaw -= input.mouseDX * sens;
      this.pitch = clamp(this.pitch + input.mouseDY * sens, -0.35, 1.1);
      this.idle = 0;
    } else this.idle += dt;
    this.pitch -= this.kickAmt;
    this.kickAmt = damp(this.kickAmt, 0, 20, dt);

    let targetDist, height, fov = 62;
    const target = this.look;
    if (car) {
      const sp = Math.abs(car.speed);
      targetDist = 7.5 + car.spec.len * 0.5 + sp * 0.06;
      height = 1.7;
      fov = 62 + clamp(sp / car.spec.maxSpeed, 0, 1) * 16;
      if (this.idle > 1.2) {
        const behind = car.speed < -2 ? car.heading + Math.PI : car.heading;
        this.yaw += wrapAngle(behind - this.yaw) * (1 - Math.exp(-dt * 3));
        this.pitch = damp(this.pitch, 0.2, 2, dt);
      }
      target.set(car.pos.x, 1.5, car.pos.z);
    } else {
      targetDist = pl.aiming ? 2.6 : 5.2;
      height = 1.65;
      fov = pl.aiming ? 50 : 62;
      target.set(pl.pos.x, pl.pos.y + height, pl.pos.z);
      if (pl.aiming) {
        target.x += -Math.cos(this.yaw) * 0.75;
        target.z += Math.sin(this.yaw) * 0.75;
      }
    }
    this.dist = damp(this.dist, targetDist, 6, dt);
    this.fov = damp(this.fov, fov, 5, dt);
    this.cam.fov = this.fov;
    this.cam.updateProjectionMatrix();

    const cp = Math.cos(this.pitch);
    const bx = -Math.sin(this.yaw) * cp, by = Math.sin(this.pitch), bz = -Math.cos(this.yaw) * cp;
    let d = this.dist;
    const hit = w.collision.raycast(target.x, target.y, target.z, bx, by, bz, d);
    if (hit < d) d = Math.max(1.2, hit - 0.4);
    let x = target.x + bx * d, y = Math.max(0.4, target.y + by * d), z = target.z + bz * d;
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt * 0.35;
      x += (Math.random() - 0.5) * s; y += (Math.random() - 0.5) * s; z += (Math.random() - 0.5) * s;
      this.shakeAmt = damp(this.shakeAmt, 0, 5, dt);
    }
    this.cam.position.set(x, y, z);
    this.cam.lookAt(target.x, target.y + (car ? 0.6 : 0.1), target.z);
  }

  /** Fixed shot for screenshots and menus. */
  setCinematic(px, py, pz, tx, ty, tz, fov = 60) {
    this.mode = 'cinematic';
    this.cam.position.set(px, py, pz);
    this.cam.fov = fov;
    this.cam.updateProjectionMatrix();
    this.cam.lookAt(tx, ty, tz);
  }
}
