// Weapons in the hero's hands, hitscan shooting from the crosshair, melee, enemy fire and explosions.

import * as THREE from 'three';
import { WEAPONS } from '../data/weapons.js';
import { raySphere } from '../core/mathUtil.js';
import { rng } from '../core/rng.js';

const dir = new THREE.Vector3();

export class CombatSystem {
  constructor(world) {
    this.world = world;
    this.ammo = { fists: Infinity, pistol: 60 };
    this.current = 1;
    this.cooldown = 0;
    this.lastShot = -10;
  }

  get weapon() { return WEAPONS[this.current]; }
  owns(id) { return id in this.ammo; }

  give(id, amount) {
    const had = this.owns(id);
    this.ammo[id] = (this.ammo[id] ?? 0) + amount;
    if (!had) this.current = WEAPONS.findIndex((w) => w.id === id);
  }

  select(index) {
    if (index < 0 || index >= WEAPONS.length) return;
    if (!this.owns(WEAPONS[index].id)) return;
    this.current = index;
    this.world.audio?.click();
  }

  cycle(step) {
    for (let k = 1; k <= WEAPONS.length; k++) {
      const i = (this.current + step * k + WEAPONS.length * 4) % WEAPONS.length;
      if (this.owns(WEAPONS[i].id)) { this.current = i; this.world.audio?.click(); return; }
    }
  }

  update(dt, input) {
    const w = this.world, pl = w.player;
    this.cooldown -= dt;
    if (pl.inCar || pl.dead) { pl.aiming = false; pl.model.gun.visible = false; return; }
    for (let k = 0; k < 4; k++) if (input.hit('Digit' + (k + 1))) this.select(k);
    if (input.wheel) this.cycle(input.wheel > 0 ? 1 : -1);
    const wp = this.weapon;
    pl.aiming = input.mouseDown(2) && wp.id !== 'fists';
    pl.model.gun.visible = wp.id !== 'fists';
    const wantsFire = wp.id === 'smg' ? input.mouseDown(0) : input.mouseHit(0);
    if (wantsFire && this.cooldown <= 0 && w.camera.mode !== 'cinematic') this.fire(wp);
  }

  fire(wp) {
    const w = this.world, pl = w.player;
    this.cooldown = wp.rate;
    if (wp.id === 'fists') { this.punch(wp); return; }
    if (this.ammo[wp.id] <= 0) { w.audio?.click(); this.cycle(-1); return; }
    this.ammo[wp.id]--;
    this.lastShot = w.time;
    const cam = w.stage.camera;
    pl.heading = w.camera.yaw;
    const hx = pl.pos.x + Math.sin(pl.heading) * 0.5 - Math.cos(pl.heading) * 0.3, hy = pl.pos.y + 1.45, hz = pl.pos.z + Math.cos(pl.heading) * 0.5 + Math.sin(pl.heading) * 0.3;
    w.fx.muzzle(hx + Math.sin(pl.heading) * 0.3, hy, hz + Math.cos(pl.heading) * 0.3);
    w.audio?.gunshot(wp.id, 0);
    w.camera.kick(wp.id === 'shotgun' ? 0.05 : 0.015);
    for (let k = 0; k < wp.pellets; k++) {
      cam.getWorldDirection(dir);
      dir.x += rng.range(-wp.spread, wp.spread); dir.y += rng.range(-wp.spread, wp.spread); dir.z += rng.range(-wp.spread, wp.spread);
      dir.normalize();
      const hit = this.raycast(cam.position, dir, wp.range + 8, pl);
      w.fx.tracer(hx, hy, hz, hit.x, hit.y, hit.z);
      this.applyHit(hit, wp.damage, 'player');
    }
    w.peds.panic(pl.pos.x, pl.pos.z, 40);
    w.wanted.report('shooting', pl.pos.x, pl.pos.z);
  }

  punch(wp) {
    const w = this.world, pl = w.player;
    let best = null, bd = wp.range;
    for (const n of w.npcs) {
      if (n.dead) continue;
      const dx = n.pos.x - pl.pos.x, dz = n.pos.z - pl.pos.z, d = Math.hypot(dx, dz);
      const facing = (dx * Math.sin(pl.heading) + dz * Math.cos(pl.heading)) / (d || 1);
      if (d < bd && facing > 0.4) { bd = d; best = n; }
    }
    pl.model.animate(0.1, 6);
    w.audio?.whoosh();
    if (!best) return;
    best.hurt(wp.damage, w, pl.pos);
    best.pos.x += Math.sin(pl.heading) * 0.6; best.pos.z += Math.cos(pl.heading) * 0.6;
    w.audio?.thud();
    w.wanted.report(best.role === 'cop' ? 'hitCop' : 'assault', pl.pos.x, pl.pos.z);
  }

  /** Nearest thing along a ray: person, car or wall. */
  raycast(origin, d, maxDist, ignore) {
    const w = this.world;
    const camToPlayer = ignore ? origin.distanceTo(ignore.pos) : 0;
    let best = { t: w.collision.raycast(origin.x, origin.y, origin.z, d.x, d.y, d.z, maxDist), kind: 'wall', target: null };
    for (const n of w.npcs) {
      if (n.dead) continue;
      const t1 = raySphere(origin.x, origin.y, origin.z, d.x, d.y, d.z, n.pos.x, n.pos.y + 1.15, n.pos.z, 0.55);
      const t2 = raySphere(origin.x, origin.y, origin.z, d.x, d.y, d.z, n.pos.x, n.pos.y + 1.82, n.pos.z, 0.26);
      const t = Math.min(t1, t2);
      if (t < best.t && t > camToPlayer - 0.5) best = { t, kind: 'npc', target: n, head: t2 < t1 };
    }
    for (const v of w.vehicles) {
      if (v.driver === 'player') continue;
      const t = raySphere(origin.x, origin.y, origin.z, d.x, d.y, d.z, v.pos.x, 0.9, v.pos.z, v.spec.wid * 0.75);
      if (t < best.t && t > camToPlayer - 0.5) best = { t, kind: 'car', target: v };
    }
    const h = w.police.heli;
    if (h.active) {
      const t = raySphere(origin.x, origin.y, origin.z, d.x, d.y, d.z, h.pos.x, h.pos.y, h.pos.z, 3);
      if (t < best.t) best = { t, kind: 'heli', target: h };
    }
    if (best.t === Infinity || best.t > maxDist) best.t = maxDist;
    best.x = origin.x + d.x * best.t; best.y = origin.y + d.y * best.t; best.z = origin.z + d.z * best.t;
    return best;
  }

  applyHit(hit, damage, from) {
    const w = this.world;
    if (hit.kind === 'npc') {
      const n = hit.target;
      n.hurt(damage * (hit.head ? 2.5 : 1), w, w.player.pos);
      if (n.role === 'cop' && from === 'player' && !n.dead) w.wanted.report('hitCop', n.pos.x, n.pos.z);
    } else if (hit.kind === 'car') {
      const v = hit.target;
      w.fx.sparks(hit.x, hit.y, hit.z, 4);
      v.damage(damage * 0.35, w);
      if (v.driver === 'ai') w.traffic.abandon(v);
    } else if (hit.kind === 'heli') {
      w.fx.sparks(hit.x, hit.y, hit.z, 5);
      hit.target.hp = (hit.target.hp ?? 300) - damage;
      if (hit.target.hp <= 0) {
        w.fx.explosion(hit.target.pos.x, hit.target.pos.y - 1, hit.target.pos.z);
        w.audio?.explosion(0.8);
        hit.target.active = false;
        hit.target.hp = 300;
        w.hud?.notify('Police helicopter down!');
        w.wanted.report('copCar', hit.x, hit.z);
      }
    } else if (hit.t < 200) {
      w.fx.puff(hit.x, hit.y, hit.z);
      w.fx.sparks(hit.x, hit.y, hit.z, 2);
    }
  }

  /** An enemy (cop or thug) shoots at a target position. */
  npcFire(npc, target, accuracy, damage) {
    const w = this.world;
    const hx = npc.pos.x + Math.sin(npc.heading) * 0.6, hy = 1.45, hz = npc.pos.z + Math.cos(npc.heading) * 0.6;
    const hit = rng.chance(Math.max(0.05, accuracy));
    const miss = hit ? 0 : rng.range(1.2, 3);
    const tx = target.x + rng.range(-1, 1) * miss, tz = target.z + rng.range(-1, 1) * miss, ty = 1.1 + rng.range(-0.5, 0.8) * (miss ? 1 : 0.2);
    w.fx.muzzle(hx, hy, hz);
    w.fx.tracer(hx, hy, hz, tx, ty, tz);
    const d = Math.hypot(npc.pos.x - w.player.pos.x, npc.pos.z - w.player.pos.z);
    w.audio?.gunshot('pistol', d);
    w.peds.panic(npc.pos.x, npc.pos.z, 30);
    if (!hit) { w.fx.puff(tx, ty, tz); return; }
    if (w.player.inCar) { w.player.vehicle.damage(damage * 0.5, w); w.fx.sparks(tx, ty, tz, 3); }
    else w.player.hurt(damage, w);
  }

  heliFire(from, target, accuracy, damage) {
    const w = this.world;
    const hit = rng.chance(accuracy);
    const tx = target.x + (hit ? 0 : rng.range(-3, 3)), tz = target.z + (hit ? 0 : rng.range(-3, 3));
    w.fx.tracer(from.x, from.y - 1.5, from.z, tx, 1, tz);
    w.audio?.gunshot('smg', 25);
    if (!hit) { w.fx.puff(tx, 0.3, tz); return; }
    if (w.player.inCar) w.player.vehicle.damage(damage, w); else w.player.hurt(damage, w);
  }

  /** A car blows up: fire, blast damage to people and cars around it. */
  explode(v) {
    const w = this.world;
    w.fx.explosion(v.pos.x, 0, v.pos.z);
    const dp = Math.hypot(v.pos.x - w.player.pos.x, v.pos.z - w.player.pos.z);
    w.audio?.explosion(Math.max(0.2, 1 - dp / 120));
    w.camera.shake(Math.max(0, 1 - dp / 40));
    v.vx *= 0.2; v.vz *= 0.2;
    v.pos.y = 0;
    for (const n of w.npcs) {
      const d = Math.hypot(n.pos.x - v.pos.x, n.pos.z - v.pos.z);
      if (d < 7 && !n.dead) {
        n.health = 0;
        n.die(w, 'blast', { x: (n.pos.x - v.pos.x) * 2, y: 7, z: (n.pos.z - v.pos.z) * 2 });
      }
    }
    if (dp < 6) {
      if (w.player.vehicle === v) w.player.exitCar(w);
      w.player.hurt(45 * (1 - dp / 7), w);
    }
    for (const o of w.vehicles) {
      if (o === v || o.dead) continue;
      const d = Math.hypot(o.pos.x - v.pos.x, o.pos.z - v.pos.z);
      if (d < 8) o.damage(60 * (1 - d / 8), w);
    }
  }
}
