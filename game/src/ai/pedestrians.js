// Sunvale's people: sidewalk walkers and beachgoers who wander, panic at gunfire, dodge cars and flee.
import { PEDS, CITY, BEACH_X } from '../core/config.js';
import { rng } from '../core/rng.js';
import { blockRect, blockAt } from '../world/cityLayout.js';
import { Character } from '../entities/character.js';

const SKINS = ['#f1c7a5', '#e0ac85', '#c68e64', '#a86f4c', '#8a5638', '#5e3a25'];
const SHIRTS = ['#ff6f61', '#2ec4b6', '#ffd166', '#ffffff', '#f78fb3', '#5aa9e6', '#7ed6a5', '#ff9f1c', '#c3a6ff', '#e9e1d2', '#3a86ff'];
const PANTS = ['#33415c', '#2b2d42', '#d6c7a1', '#5c4b3b', '#e9e1d2', '#1d3557', '#6b705c'];
const HAIR = ['#2b1d14', '#5a3a1f', '#d9b56c', '#111111', '#8a3b12', '#c8c8c8'];

export function randomLook(beach = false) {
  const skin = rng.pick(SKINS);
  return {
    skin, hair: rng.pick(HAIR), shirt: beach && rng.chance(0.5) ? skin : rng.pick(SHIRTS),
    pants: beach ? rng.pick(['#ff6f61', '#2ec4b6', '#ffd166', '#3a86ff', '#f78fb3']) : rng.pick(PANTS),
    hat: rng.chance(0.15) ? rng.pick(['#ffffff', '#e9c46a', '#264653']) : null, build: rng.range(0.92, 1.1),
  };
}

// Walks the ring of sidewalk around a block, or a line along the beach.
export class PedBrain {
  constructor(path) {
    this.path = path;
    this.s = rng.range(0, path.length);
    this.dir = rng.sign();
    this.speed = rng.range(1.15, 1.6);
    this.idle = 0;
    this.fear = 0;
    this.fleeX = 0; this.fleeZ = 0;
  }
  scare(x, z, seconds = 7) { this.fear = seconds; this.fleeX = x; this.fleeZ = z; }
  update(c, dt) {
    if (this.fear > 0) {
      this.fear -= dt;
      let dx = c.pos.x - this.fleeX, dz = c.pos.z - this.fleeZ;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d; dz /= d;
      c.mode = this.fear > 5.5 && d < 12 ? 'cower' : 'idle';
      c.move(dx, dz, c.mode === 'cower' ? 0 : 5.8, dt);
      if (this.fear <= 0) this.s = this.path.nearest(c.pos.x, c.pos.z);
      return;
    }
    c.mode = 'idle';
    if (this.idle > 0) { this.idle -= dt; c.move(0, 0, 0, dt); return; }
    if (rng.chance(dt * 0.03)) { this.idle = rng.range(1.5, 4); return; }
    this.s = (this.s + this.dir * this.speed * dt + this.path.length) % this.path.length;
    const t = this.path.at((this.s + this.dir * 1.5 + this.path.length) % this.path.length);
    let dx = t.x - c.pos.x, dz = t.z - c.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    c.move(dx / d, dz / d, d > 4 ? this.speed * 1.8 : this.speed, dt);
  }
}

// A walking path near (x, z) for someone who just lost their car: the nearest sidewalk ring, else a line.
export function pathNear(x, z) {
  const b = blockAt(x + 9, z) ?? blockAt(x - 9, z) ?? blockAt(x, z + 9) ?? blockAt(x, z - 9);
  if (!b) return new LinePath(x, z - 25, z + 25);
  const r = blockRect(b.bi, b.bj), m = CITY.sidewalk / 2;
  return new RingPath(r.x0 + m, r.z0 + m, r.x1 - m, r.z1 - m);
}

class RingPath {
  constructor(x0, z0, x1, z1) { this.x0 = x0; this.z0 = z0; this.x1 = x1; this.z1 = z1; this.w = x1 - x0; this.h = z1 - z0; this.length = 2 * (this.w + this.h); }
  at(s) {
    const { x0, z0, x1, z1, w, h } = this;
    if (s < w) return { x: x0 + s, z: z0 };
    if (s < w + h) return { x: x1, z: z0 + (s - w) };
    if (s < 2 * w + h) return { x: x1 - (s - w - h), z: z1 };
    return { x: x0, z: z1 - (s - 2 * w - h) };
  }
  nearest(x, z) {
    let best = 0, bd = Infinity;
    for (let s = 0; s < this.length; s += 2) { const p = this.at(s); const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
    return best;
  }
}
class LinePath {
  constructor(x, z0, z1) { this.x = x; this.z0 = z0; this.length = (z1 - z0) * 2; this.span = z1 - z0; }
  at(s) { const k = s < this.span ? s : this.length - s; return { x: this.x, z: this.z0 + k }; }
  nearest(x, z) { return Math.max(0, Math.min(this.span, z - this.z0)); }
}

export class PedestrianSystem {
  constructor(game) {
    this.game = game;
    this.timer = 0;
    this.target = PEDS.count;
    game.events.on('gunfire', (e) => this.panic(e.x, e.z, 38, e.shooter));
    game.events.on('explosion', (e) => this.panic(e.x, e.z, 45));
    game.events.on('characterKilled', (e) => this.panic(e.victim.pos.x, e.victim.pos.z, 20));
    game.events.on('characterHurt', (e) => { if (e.victim.brain instanceof PedBrain) e.victim.brain.scare(e.victim.pos.x - Math.sin(e.victim.yaw), e.victim.pos.z - Math.cos(e.victim.yaw), 9); });
  }

  get peds() { return this.game.characters.filter((c) => c.role === 'ped'); }

  panic(x, z, radius, except = null) {
    for (const c of this.game.characters) {
      if (c === except || !(c.brain instanceof PedBrain)) continue;
      if (Math.hypot(c.pos.x - x, c.pos.z - z) < radius) c.brain.scare(x, z, 6 + rng.next() * 4);
    }
  }

  update(dt) {
    const g = this.game, focus = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    for (const c of g.characters.slice()) {
      if (c.role !== 'ped') continue;
      const d = Math.hypot(c.pos.x - focus.x, c.pos.z - focus.z);
      if (d > PEDS.despawn || (!c.alive && c.deadTime > 25)) g.removeCharacter(c);
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.15;
    if (this.peds.length < this.target) this.spawnNear(focus.x, focus.z, PEDS.spawnMin, PEDS.spawnMax);
  }

  spawnNear(x, z, minD, maxD) {
    for (let k = 0; k < 10; k++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(minD, maxD);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const ped = this.spawnAt(px, pz);
      if (ped) return ped;
    }
    return null;
  }

  // Creates a pedestrian on the sidewalk ring or beach line nearest (px, pz), or null if there is none.
  spawnAt(px, pz) {
    let path = null, beach = false;
    if (px < BEACH_X && px > -392 && Math.abs(pz) < 330) { path = new LinePath(Math.round(px), pz - 30, pz + 30); beach = true; }
    else {
      const b = blockAt(px, pz);
      if (!b) return null;
      const r = blockRect(b.bi, b.bj), m = CITY.sidewalk / 2;
      path = new RingPath(r.x0 + m, r.z0 + m, r.x1 - m, r.z1 - m);
    }
    const s = path.nearest(px, pz), p = path.at(s);
    const c = new Character(this.game, { x: p.x, z: p.z, look: randomLook(beach), role: 'ped', health: 60 });
    c.brain = new PedBrain(path);
    c.brain.s = s;
    this.game.addCharacter(c);
    return c;
  }
}
