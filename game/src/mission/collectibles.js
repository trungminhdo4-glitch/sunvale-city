// Twelve hidden Sun Tokens: spinning golden suns that pay out and count toward 100% completion.
import * as THREE from 'three';
import { SUN_TOKENS } from './story.js';
import { getTexture } from '../world/textures.js';

function tokenMesh() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0xff9a00, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.25 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20), gold);
  disc.rotation.x = Math.PI / 2; g.add(disc);
  for (let k = 0; k < 10; k++) {
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 4), gold);
    const a = (k / 10) * Math.PI * 2;
    ray.position.set(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0); ray.rotation.z = a - Math.PI / 2;
    g.add(ray);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTexture('glow'), color: 0xffb000, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  glow.scale.set(3, 3, 1); g.add(glow);
  return g;
}

export class SunTokens {
  constructor(game) {
    this.game = game;
    this.collected = new Set();
    this.items = SUN_TOKENS.map((p, i) => {
      const m = tokenMesh();
      m.position.set(p.x, game.statics.groundHeight(p.x, p.z) + 1.2, p.z);
      game.scene.add(m);
      return { i, ...p, mesh: m };
    });
    this.t = 0;
  }
  get count() { return this.collected.size; }
  get total() { return this.items.length; }

  update(dt) {
    this.t += dt;
    const g = this.game, p = g.player, f = p.vehicle ? p.vehicle.pos : p.pos;
    for (const it of this.items) {
      if (this.collected.has(it.i)) { it.mesh.visible = false; continue; }
      it.mesh.visible = true;
      it.mesh.rotation.y = this.t * 2 + it.i;
      it.mesh.position.y = g.statics.groundHeight(it.x, it.z) + 1.2 + Math.sin(this.t * 2 + it.i) * 0.15;
      if (p.alive && Math.hypot(f.x - it.x, f.z - it.z) < (p.vehicle ? 3 : 1.6)) this.collect(it);
    }
  }
  collect(it) {
    const g = this.game;
    this.collected.add(it.i);
    g.fx.splashOfGold(it.x, it.mesh.position.y, it.z);
    g.audio.ui('token');
    const bonus = this.count === this.total ? 5000 : 250;
    g.addMoney(bonus);
    g.notify(`Sun Token <b>${this.count}/${this.total}</b> · +$${bonus}`);
    if (this.count === this.total) g.hud.banner('ALL SUN TOKENS', 'Every golden sun in Sunvale found · +$5,000');
    g.autosave();
  }
  blips() {
    const g = this.game, f = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    return this.items.filter((it) => !this.collected.has(it.i) && Math.hypot(f.x - it.x, f.z - it.z) < 70).map((it) => ({ x: it.x, z: it.z, color: '#ffc83a', size: 4 }));
  }
  toJSON() { return [...this.collected]; }
  load(list) { this.collected = new Set((list ?? []).filter((i) => i >= 0 && i < this.items.length)); }
}
