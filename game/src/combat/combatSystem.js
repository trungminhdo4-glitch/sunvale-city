// Hitscan shooting against people, cars, helicopters and buildings; melee punches; explosions with falloff.
import * as THREE from 'three';
import { rng } from '../core/rng.js';

const tmpDir = new THREE.Vector3(), tmpEnd = new THREE.Vector3();

export class CombatSystem {
  constructor(game) { this.game = game; }

  // Fires one trigger pull of `weapon` from origin along dir. Returns the first hit of the last pellet.
  fire(shooter, origin, dir, weapon, { spreadMul = 1, damageMul = 1, silentTracer = false } = {}) {
    const g = this.game;
    let last = null;
    for (let p = 0; p < (weapon.pellets ?? 1); p++) {
      const s = (weapon.spread ?? 0) * spreadMul;
      tmpDir.set(dir.x + (rng.next() - 0.5) * 2 * s, dir.y + (rng.next() - 0.5) * 2 * s, dir.z + (rng.next() - 0.5) * 2 * s).normalize();
      const hit = this.trace(shooter, origin, tmpDir, weapon.range);
      tmpEnd.copy(origin).addScaledVector(tmpDir, hit ? hit.t : weapon.range);
      if (!silentTracer || p === 0) g.fx.tracer(origin, tmpEnd);
      if (hit) this.applyHit(hit, tmpEnd, tmpDir, shooter, weapon.damage * damageMul);
      last = hit;
    }
    g.fx.muzzleFlash(origin);
    g.audio.shot(weapon.sound, origin);
    g.events.emit('gunfire', { shooter, x: origin.x, z: origin.z });
    return last;
  }

  // Nearest thing along a ray: { t, kind: 'static'|'character'|'vehicle'|'heli', target }.
  trace(ignore, o, d, range) {
    const g = this.game;
    let best = null, bestT = range;
    const sh = g.statics.raycast(o.x, o.y, o.z, d.x, d.y, d.z, range);
    if (sh) { best = { t: sh.t, kind: 'static', normal: [sh.nx, sh.ny, sh.nz] }; bestT = sh.t; }
    const dxz2 = d.x * d.x + d.z * d.z;
    if (dxz2 > 1e-6) {
      for (const c of g.characters) {
        if (c === ignore || c.vehicle || !c.alive) continue;
        const cx = c.pos.x - o.x, cz = c.pos.z - o.z;
        const tc = (cx * d.x + cz * d.z) / dxz2;
        if (tc < 0 || tc > bestT + 1) continue;
        const px = d.x * tc - cx, pz = d.z * tc - cz, r2 = 0.42 * 0.42, dd = px * px + pz * pz;
        if (dd > r2) continue;
        const t = tc - Math.sqrt((r2 - dd) / dxz2);
        if (t < 0 || t >= bestT) continue;
        const y = o.y + d.y * t;
        if (y < c.pos.y + 0.05 || y > c.pos.y + 1.85) continue;
        best = { t, kind: 'character', target: c, y }; bestT = t;
      }
    }
    for (const v of g.vehicles) {
      if (ignore && v === ignore.vehicle) continue;
      const t = rayVehicle(o, d, v, bestT);
      if (t !== null) { best = { t, kind: 'vehicle', target: v }; bestT = t; }
    }
    for (const h of g.police.helis) {
      if (h.dead) continue;
      const ox = o.x - h.pos.x, oy = o.y - h.pos.y, oz = o.z - h.pos.z;
      const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - 9;
      const disc = b * b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < bestT) { best = { t, kind: 'heli', target: h }; bestT = t; }
    }
    return best;
  }

  applyHit(hit, point, dir, shooter, damage) {
    const g = this.game;
    if (hit.kind === 'character') {
      const c = hit.target;
      const head = hit.y > c.pos.y + 1.55;
      const scaled = shooter && shooter !== g.player && c !== g.player ? damage * 0.6 : (c === g.player ? damage * 0.42 : damage);
      c.damage(head ? scaled * 2.5 : scaled, shooter, 'bullet');
      c.knockback.x += dir.x * 2; c.knockback.z += dir.z * 2;
      g.fx.blood(point.x, point.y, point.z);
      if (shooter === g.player) g.events.emit('playerHit', { target: c, head, killed: !c.alive });
    } else if (hit.kind === 'vehicle') {
      hit.target.damage(damage * 0.55, shooter, 'bullet');
      g.fx.sparks(point.x, point.y, point.z, 5);
      if (shooter === g.player) g.events.emit('playerHit', { target: hit.target });
    } else if (hit.kind === 'heli') {
      hit.target.damage(damage * 0.6, shooter);
      g.fx.sparks(point.x, point.y, point.z, 6);
      if (shooter === g.player) g.events.emit('playerHit', { target: hit.target });
    } else {
      g.fx.impactDust(point.x, point.y, point.z, hit.normal);
    }
  }

  melee(attacker, weapon) {
    const g = this.game;
    const fx = Math.sin(attacker.yaw), fz = Math.cos(attacker.yaw);
    let hitAny = false;
    for (const c of g.characters) {
      if (c === attacker || !c.alive || c.vehicle) continue;
      const dx = c.pos.x - attacker.pos.x, dz = c.pos.z - attacker.pos.z, d = Math.hypot(dx, dz);
      if (d > weapon.range || d < 0.01 || (dx * fx + dz * fz) / d < 0.45) continue;
      c.damage(weapon.damage, attacker, 'melee');
      c.knockback.set(fx * 5, 0, fz * 5);
      hitAny = true;
      if (attacker === g.player) g.events.emit('playerHit', { target: c, killed: !c.alive });
    }
    g.audio.punch(hitAny);
    if (hitAny) g.events.emit('assault', { attacker, x: attacker.pos.x, z: attacker.pos.z });
    return hitAny;
  }

  explosion(x, y, z, radius, damage, source, ignoreVehicle = null) {
    const g = this.game;
    g.fx.explosion(x, y, z);
    g.audio.explosion({ x, y, z });
    const cd = g.camera.position.distanceTo(tmpEnd.set(x, y, z));
    g.camCtl.shake(Math.max(0, 1.2 - cd / 60));
    for (const c of g.characters) {
      if (c.vehicle) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d > radius) continue;
      const k = 1 - d / radius;
      c.damage(damage * k, source, 'explosion');
      const nx = (c.pos.x - x) / (d || 1), nz = (c.pos.z - z) / (d || 1);
      c.knockback.set(nx * 14 * k, 0, nz * 14 * k);
      c.vel.y = 6 * k; c.onGround = false;
    }
    for (const v of g.vehicles) {
      if (v === ignoreVehicle) continue;
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d > radius * 1.2) continue;
      const k = 1 - d / (radius * 1.2);
      v.damage(damage * 4 * k, source, 'explosion');
      v.vx += ((v.pos.x - x) / (d || 1)) * 8 * k; v.vz += ((v.pos.z - z) / (d || 1)) * 8 * k;
    }
    g.events.emit('explosion', { x, z, source });
  }
}

// Ray against a vehicle's oriented box. Returns the distance or null.
function rayVehicle(o, d, v, maxT) {
  const dx0 = v.pos.x - o.x, dz0 = v.pos.z - o.z;
  if (dx0 * dx0 + dz0 * dz0 > (maxT + 6) * (maxT + 6)) return null;
  const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
  const wx = o.x - v.pos.x, wz = o.z - v.pos.z;
  const lo = [wx * c - wz * s, o.y - v.pos.y, wx * s + wz * c];
  const ld = [d.x * c - d.z * s, d.y, d.x * s + d.z * c];
  const half = [v.spec.wid / 2, null, v.spec.len / 2];
  let tmin = 0, tmax = maxT;
  for (let a = 0; a < 3; a++) {
    const lo_ = a === 1 ? 0.25 : -half[a], hi_ = a === 1 ? v.spec.hgt : half[a];
    if (Math.abs(ld[a]) < 1e-9) { if (lo[a] < lo_ || lo[a] > hi_) return null; continue; }
    let t1 = (lo_ - lo[a]) / ld[a], t2 = (hi_ - lo[a]) / ld[a];
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin > 0 ? tmin : null;
}
