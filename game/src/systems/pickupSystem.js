// Things to pick up: 24 hidden Sun Tokens (saved), health, armour, ammo and dropped cash.

import * as THREE from 'three';
import { createRng, rng } from '../core/rng.js';
import { CITY, lineCoord } from '../core/config.js';

const KINDS = {
  token:  { color: 0xffc928, emissive: 0xff9a00 },
  health: { color: 0xff4d5e, emissive: 0xaa0010 },
  armor:  { color: 0x4da3ff, emissive: 0x0040aa },
  ammo:   { color: 0x9bd15a, emissive: 0x2a6a00 },
  cash:   { color: 0x5cd65c, emissive: 0x106010 },
};

function tokenGeometry() {
  const g = new THREE.CylinderGeometry(0.6, 0.6, 0.14, 20);
  g.rotateX(Math.PI / 2);
  return g;
}

const geos = {
  token: tokenGeometry(),
  health: new THREE.BoxGeometry(0.7, 0.7, 0.7),
  armor: new THREE.OctahedronGeometry(0.55),
  ammo: new THREE.BoxGeometry(0.9, 0.5, 0.5),
  cash: new THREE.BoxGeometry(0.7, 0.35, 0.45),
};

export class PickupSystem {
  constructor(world) {
    this.world = world;
    this.items = [];
    this.collectedTokens = new Set();
    const r = createRng(1234);
    // tokens: hidden in alleys, parks, the pier and the harbour
    const spots = [];
    for (let k = 0; k < 18; k++) {
      const b = r.pick(world.plan.blocks);
      spots.push([r.range(b.minX + 2, b.maxX - 2), b.minZ + 1.5]);
    }
    spots.push([-96, 465], [-96, 360], [392, 270], [340, -60], [-300, 320], [150, 330]);
    spots.forEach(([x, z], i) => this.add('token', x, z, { id: i }));
    // fixed health and armour spots
    const P = world.plan.places;
    this.add('health', P.hospital.x - 2, P.hospital.z, { respawn: 40 });
    this.add('armor', P.police.x + 2, P.police.z, { respawn: 60 });
    this.add('health', P.safehouse.x + 3, P.safehouse.z, { respawn: 40 });
    this.add('armor', -96, 300, { respawn: 60 });
    for (let k = 0; k < 6; k++) this.add('ammo', lineCoord(r.int(0, CITY.lines - 1)) + 8.5, lineCoord(r.int(0, 8)) + 30, { respawn: 50 });
  }

  add(kind, x, z, opts = {}) {
    const k = KINDS[kind];
    const mesh = new THREE.Mesh(geos[kind], new THREE.MeshLambertMaterial({ color: k.color, emissive: k.emissive, emissiveIntensity: 0.6 }));
    mesh.position.set(x, 1, z);
    mesh.castShadow = true;
    this.world.scene.add(mesh);
    const item = { kind, x, z, mesh, active: true, respawn: opts.respawn ?? 0, wait: 0, id: opts.id, value: opts.value ?? 0 };
    this.items.push(item);
    return item;
  }

  dropCash(x, z, value) {
    this.add('cash', x + rng.range(-0.5, 0.5), z + rng.range(-0.5, 0.5), { value });
  }

  restoreTokens(ids) {
    this.collectedTokens = new Set(ids);
    for (const it of this.items) if (it.kind === 'token') { it.active = !this.collectedTokens.has(it.id); it.mesh.visible = it.active; }
  }

  get tokenCount() { return this.collectedTokens.size; }
  get tokenTotal() { return this.items.filter((i) => i.kind === 'token').length; }

  update(dt) {
    const w = this.world, p = w.player.pos, t = w.time;
    for (const it of [...this.items]) {
      if (!it.active) {
        if (it.respawn) { it.wait -= dt; if (it.wait <= 0) { it.active = true; it.mesh.visible = true; } }
        continue;
      }
      it.mesh.rotation.y = t * 2;
      it.mesh.position.y = 1 + Math.sin(t * 3 + it.x) * 0.15;
      const reach = w.player.inCar ? 3 : 1.4;
      if (Math.hypot(p.x - it.x, p.z - it.z) > reach) continue;
      if (!this.collect(it)) continue;
      it.active = false;
      it.mesh.visible = false;
      it.wait = it.respawn;
      if (it.kind === 'cash') { w.scene.remove(it.mesh); this.items.splice(this.items.indexOf(it), 1); }
    }
  }

  collect(it) {
    const w = this.world, pl = w.player;
    switch (it.kind) {
      case 'token':
        this.collectedTokens.add(it.id);
        w.state.money += 250;
        w.hud.notify(`Sun Token ${this.tokenCount}/${this.tokenTotal} found  +$250`);
        if (this.tokenCount === this.tokenTotal) { w.state.money += 10000; w.hud.banner('ALL SUN TOKENS', 'passed', '+$10,000'); }
        w.save?.();
        break;
      case 'health':
        if (pl.health >= 100) return false;
        pl.health = 100;
        w.hud.notify('Health restored');
        break;
      case 'armor':
        if (pl.armor >= 100) return false;
        pl.armor = 100;
        w.hud.notify('Body armour');
        break;
      case 'ammo': {
        const c = w.combat;
        c.give('pistol', 28);
        if (c.owns('smg')) c.give('smg', 60);
        if (c.owns('shotgun')) c.give('shotgun', 8);
        w.hud.notify('Ammo');
        break;
      }
      case 'cash':
        w.state.money += it.value;
        break;
    }
    w.audio?.pickup();
    return true;
  }
}
