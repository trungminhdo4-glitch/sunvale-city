// Health, armor, weapon and cash pickups around the city; fixed ones respawn, dropped cash fades away.
import * as THREE from 'three';
import { getTexture } from '../world/textures.js';
import { WEAPONS } from '../combat/weapons.js';
import { rng } from '../core/rng.js';

const SPOTS = [
  { kind: 'health', x: 160, z: -201 }, { kind: 'health', x: -340, z: 30 }, { kind: 'health', x: -128, z: 104 },
  { kind: 'armor', x: -32, z: -10.5 }, { kind: 'armor', x: 200.5, z: 30 }, { kind: 'armor', x: -150, z: 330 },
  { kind: 'kestrel', x: -340, z: -60 }, { kind: 'hornet', x: 48, z: 136.5 }, { kind: 'breaker', x: 250, z: 334 },
  { kind: 'breaker', x: -264.5, z: -150 }, { kind: 'kestrel', x: 136, z: -120 },
];
const COLORS = { health: 0x37d67a, armor: 0x3b8fe0, kestrel: 0xffd166, hornet: 0xff9f1c, breaker: 0xff6f61, cash: 0x7ef59a };
const AMMO = { kestrel: 48, hornet: 120, breaker: 16 };

export class Pickups {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.geo = { health: new THREE.BoxGeometry(0.6, 0.6, 0.6), armor: new THREE.BoxGeometry(0.7, 0.8, 0.25), weapon: new THREE.BoxGeometry(0.9, 0.3, 0.3), cash: new THREE.BoxGeometry(0.4, 0.06, 0.2) };
    for (const s of SPOTS) this.add(s.kind, s.x, s.z, true);
    this.t = 0;
  }

  add(kind, x, z, fixed = false, amount = 0) {
    const g = this.game;
    const geo = kind in AMMO ? this.geo.weapon : this.geo[kind];
    const mat = new THREE.MeshStandardMaterial({ color: COLORS[kind], emissive: COLORS[kind], emissiveIntensity: 0.6, roughness: 0.4 });
    const m = new THREE.Mesh(geo, mat);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTexture('glow'), color: COLORS[kind], blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
    glow.scale.set(2, 2, 1); m.add(glow);
    m.position.set(x, g.statics.groundHeight(x, z) + 0.8, z);
    g.scene.add(m);
    const it = { kind, x, z, fixed, amount, mesh: m, respawn: 0, age: 0 };
    this.items.push(it);
    return it;
  }

  dropCash(x, z, amount) { this.add('cash', x + rng.range(-0.5, 0.5), z + rng.range(-0.5, 0.5), false, amount); }

  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;
    for (const it of this.items) {
      it.age += dt;
      if (it.respawn > 0) { it.respawn -= dt; it.mesh.visible = it.respawn <= 0; continue; }
      it.mesh.rotation.y = this.t * 1.8;
      it.mesh.position.y = g.statics.groundHeight(it.x, it.z) + (it.kind === 'cash' ? 0.25 : 0.8) + Math.sin(this.t * 3 + it.x) * 0.1;
      if (!p.alive) continue;
      const f = p.vehicle ? p.vehicle.pos : p.pos;
      const reach = p.vehicle ? (it.kind === 'health' || it.kind === 'cash' ? 2.6 : 0) : 1.4;
      if (Math.hypot(f.x - it.x, f.z - it.z) < reach) this.take(it);
    }
    this.items = this.items.filter((it) => {
      const expired = !it.fixed && (it.taken || it.age > 40);
      if (expired) g.scene.remove(it.mesh);
      return !expired;
    });
  }

  take(it) {
    const g = this.game, p = g.player;
    if (it.kind === 'health') { if (p.health >= p.maxHealth) return; p.heal(50); g.notify('Health +50'); }
    else if (it.kind === 'armor') { if (p.armor >= 100) return; p.armor = 100; g.notify('Body armor'); }
    else if (it.kind === 'cash') { g.addMoney(it.amount); g.audio.ui('money'); it.taken = true; it.mesh.visible = false; return; }
    else { const isNew = g.arsenal.give(it.kind, AMMO[it.kind]); g.notify(isNew ? `Picked up the <b>${WEAPONS[it.kind].name}</b>` : `${WEAPONS[it.kind].name} ammo +${AMMO[it.kind]}`); }
    g.audio.ui('pickup');
    if (it.fixed) { it.respawn = 60; it.mesh.visible = false; } else it.taken = true;
  }
}
