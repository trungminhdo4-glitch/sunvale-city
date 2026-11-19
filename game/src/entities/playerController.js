// Turns keyboard and mouse into Rio's actions: walking, sprinting, jumping, aiming, shooting, punching,
// stealing and driving cars, honking and switching weapons or radio stations.
import * as THREE from 'three';
import { WEAPON_ORDER } from '../combat/weapons.js';

const aimO = new THREE.Vector3(), aimD = new THREE.Vector3(), muzzle = new THREE.Vector3(), shot = new THREE.Vector3();

export class PlayerController {
  constructor(game) {
    this.game = game;
    this.cooldown = 0;
    this.aimHold = 0;
    this.hint = '';
  }

  update(dt) {
    const g = this.game, p = g.player, inp = g.input;
    this.cooldown -= dt;
    this.hint = '';
    if (!p.alive || g.missions.cutscene) { if (p.vehicle) { p.vehicle.throttle = 0; p.vehicle.handbrake = true; } else p.move(0, 0, 0, dt); return; }
    if (inp.pressed('KeyF')) {
      if (p.vehicle) { if (p.vehicle.absSpeed < 9) g.exitVehicle(p); }
      else this.tryEnter();
    }
    this.switchWeapons(inp);
    if (p.vehicle) this.drive(dt); else this.onFoot(dt);
  }

  switchWeapons(inp) {
    const a = this.game.arsenal;
    WEAPON_ORDER.forEach((id, i) => { if (inp.pressed(`Digit${i + 1}`)) a.select(id); });
    if (inp.wheel) a.cycle(inp.wheel > 0 ? 1 : -1);
    if (inp.pressed('KeyQ')) a.cycle(1);
  }

  nearestVehicle(range = 3.4) {
    const p = this.game.player;
    let best = null, bd = range;
    for (const v of this.game.vehicles) {
      if (v.wrecked) continue;
      for (const c of v.circles()) {
        const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z) - v.radius;
        if (d < bd) { bd = d; best = v; }
      }
    }
    return best;
  }

  tryEnter() {
    const v = this.nearestVehicle();
    if (v) this.game.enterVehicle(this.game.player, v);
  }

  onFoot(dt) {
    const g = this.game, p = g.player, inp = g.input, cam = g.camCtl;
    const yaw = cam.yaw;
    const f = inp.axis('KeyS', 'KeyW'), s = inp.axis('KeyA', 'KeyD');
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    let dx = fx * f + rx * s, dz = fz * f + rz * s;
    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; }
    const w = g.arsenal.weapon;
    const aiming = inp.mouseDown(2);
    this.aimHold -= dt;
    const aimPose = (aiming || this.aimHold > 0) && !w.melee;
    cam.aiming = aiming;
    const sprint = (inp.down('ShiftLeft') || inp.down('ShiftRight')) && !aiming;
    const speed = len ? (aiming ? 2.6 : sprint ? 7.6 : 4.3) : 0;
    p.move(dx, dz, speed, dt, aiming || this.aimHold > 0 ? yaw : null);
    p.mode = aimPose ? 'aim' : 'idle';
    p.weapon = w;
    if (inp.pressed('Space')) p.jump();

    const near = this.nearestVehicle();
    if (near) this.hint = near.driver ? `Press <b>F</b> to pull the driver out of the ${near.spec.name}` : `Press <b>F</b> to get in the ${near.spec.name}`;

    const trigger = w.auto ? inp.mouseDown(0) : inp.mousePressed(0);
    if (!trigger || this.cooldown > 0) return;
    this.cooldown = w.rate;
    if (w.melee) {
      p.punchT = 0;
      p.yaw = yaw;
      g.combat.melee(p, w);
      return;
    }
    if (!g.arsenal.consume()) return;
    cam.aimRay(aimO, aimD);
    const hit = g.combat.trace(p, aimO, aimD, 260);
    shot.copy(aimO).addScaledVector(aimD, hit ? hit.t : 260);
    p.yaw = yaw;
    muzzle.set(p.pos.x + Math.sin(yaw) * 0.55 - Math.cos(yaw) * 0.26, p.pos.y + 1.42, p.pos.z + Math.cos(yaw) * 0.55 + Math.sin(yaw) * 0.26);
    const dir = shot.sub(muzzle).normalize();
    g.combat.fire(p, muzzle, dir, w, { spreadMul: aiming ? 0.5 : 1.5 });
    this.aimHold = 0.7;
    cam.shake(w.id === 'breaker' ? 0.18 : 0.04);
  }

  drive(dt) {
    const g = this.game, inp = g.input, v = g.player.vehicle;
    v.throttle = inp.axis('KeyS', 'KeyW');
    v.steer = inp.axis('KeyD', 'KeyA');
    v.handbrake = inp.down('Space');
    g.camCtl.aiming = false;
    g.audio.horn(inp.down('KeyH'));
    if (inp.pressed('KeyR')) g.radio.next();
    if (v.isPolice && inp.pressed('KeyE')) v.sirenOn = !v.sirenOn;
  }
}
