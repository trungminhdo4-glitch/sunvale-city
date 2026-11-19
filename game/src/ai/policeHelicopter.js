// The SVPD helicopter: circles the player at three stars and up, sweeps a searchlight, takes shots at four stars,
// and can be shot down.
import * as THREE from 'three';
import { rng } from '../core/rng.js';
import { WEAPONS } from '../combat/weapons.js';
import { getTexture, makeSignTexture } from '../world/textures.js';
import { damp, dampAngle } from '../core/mathUtil.js';

const muzzle = new THREE.Vector3(), aim = new THREE.Vector3();

function buildHeliMesh() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.4, metalness: 0.3 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.4, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2632, roughness: 0.1, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const body = add(new THREE.SphereGeometry(1.5, 14, 10), white, 0, 0, 0); body.scale.set(1, 0.9, 1.7);
  add(new THREE.SphereGeometry(1.25, 12, 8), glass, 0, 0.25, 1.15).scale.set(0.95, 0.75, 0.8);
  add(new THREE.BoxGeometry(3.05, 0.35, 2.4), navy, 0, -0.35, -0.2);
  add(new THREE.CylinderGeometry(0.22, 0.4, 5.4, 8), white, 0, 0.35, -3.9).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.12, 1.4, 0.9), navy, 0, 1.0, -6.4);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.12, 0.12, 3.6), dark, s * 1.1, -1.55, 0.1);
    add(new THREE.BoxGeometry(0.1, 0.7, 0.1), dark, s * 1.0, -1.2, 0.8);
    add(new THREE.BoxGeometry(0.1, 0.7, 0.1), dark, s * 1.0, -1.2, -0.7);
  }
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8), dark, 0, 1.45, 0);
  const rotor = new THREE.Group(); rotor.position.y = 1.72; g.add(rotor);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.5, transparent: true, opacity: 0.85 });
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 11), bladeMat); b.rotation.y = (k * Math.PI) / 4 * 2 / 2 + k * Math.PI / 4; rotor.add(b); }
  const tail = new THREE.Group(); tail.position.set(0.18, 1.0, -6.4); g.add(tail);
  tail.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.8, 0.16), bladeMat));
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: makeSignTexture('SVPD', { bg: 'transparent', fg: '#1d3557' }), transparent: true, side: THREE.DoubleSide }));
  label.position.set(1.52, 0.1, -0.6); label.rotation.y = Math.PI / 2; g.add(label);
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTexture('glow'), color: 0xff3030, blending: THREE.AdditiveBlending, depthWrite: false }));
  beacon.position.set(0, -1.3, 0.4); beacon.scale.set(1.6, 1.6, 1); g.add(beacon);
  return { g, rotor, tail, beacon };
}

export class PoliceHelicopter {
  constructor(game) {
    this.game = game;
    const m = buildHeliMesh();
    this.mesh = m.g; this.rotor = m.rotor; this.tail = m.tail; this.beacon = m.beacon;
    game.scene.add(this.mesh);
    const p = game.player.pos, a = rng.range(0, Math.PI * 2);
    this.pos = new THREE.Vector3(p.x + Math.cos(a) * 220, 60, p.z + Math.sin(a) * 220);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.orbit = rng.range(0, Math.PI * 2);
    this.health = 650;
    this.dead = false; this.gone = false; this.leaving = false;
    this.shootT = 2;
    this.fallT = 0;
    this.time = 0;
    // one shared searchlight lives in the police system so the light count (and every shader) never changes
    this.light = game.police.claimSearchlight(this);
    const coneGeo = new THREE.ConeGeometry(7, 1, 24, 1, true); coneGeo.translate(0, -0.5, 0);
    this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    game.scene.add(this.cone);
    this.spot = new THREE.Vector3(p.x, 0, p.z);
  }

  damage(n, from) {
    if (this.dead) return;
    this.health -= n;
    if (this.health <= 0) {
      this.dead = true;
      this.game.events.emit('heliDown', { heli: this, from });
      if (from === this.game.player) this.game.wanted.report('heliDown', this.pos.x, this.pos.z);
      this.game.fx.explosion(this.pos.x, this.pos.y, this.pos.z);
    }
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.time += dt;
    this.rotor.rotation.y += dt * 28;
    this.tail.rotation.x += dt * 40;
    this.beacon.visible = Math.floor(this.time * 2) % 2 === 0;
    if (this.dead) {
      this.fallT += dt;
      this.vel.y -= 14 * dt;
      this.pos.addScaledVector(this.vel, dt);
      this.yaw += dt * 5;
      this.cone.visible = false; if (this.light) this.light.intensity = 0;
      if (g.fx && Math.random() < 0.6) g.fx.engineSmoke({ pos: this.pos, yaw: this.yaw, spec: { len: 0, hgt: 0 }, vx: 0, vz: 0, burnTime: 1 }, 0.1);
      if (this.pos.y <= 1) {
        g.combat.explosion(this.pos.x, 1, this.pos.z, 12, 200, null);
        this.gone = true;
      }
      this.sync();
      return;
    }
    const target = p.vehicle ? p.vehicle.pos : p.pos;
    let goal;
    if (this.leaving) {
      goal = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * 100, 90, this.pos.z + Math.cos(this.yaw) * 100);
      if (Math.hypot(this.pos.x - target.x, this.pos.z - target.z) > 320) this.gone = true;
    } else {
      this.orbit += dt * 0.28;
      goal = new THREE.Vector3(target.x + Math.cos(this.orbit) * 30, 34, target.z + Math.sin(this.orbit) * 30);
    }
    const to = goal.sub(this.pos);
    const dist = to.length();
    const maxSp = this.leaving ? 30 : Math.min(42, 10 + dist * 0.5);
    to.normalize().multiplyScalar(maxSp);
    this.vel.x = damp(this.vel.x, to.x, 1.5, dt); this.vel.y = damp(this.vel.y, to.y, 1.5, dt); this.vel.z = damp(this.vel.z, to.z, 1.5, dt);
    this.pos.addScaledVector(this.vel, dt);
    const faceYaw = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    this.yaw = dampAngle(this.yaw, this.leaving ? Math.atan2(this.vel.x, this.vel.z) : faceYaw, 1.6, dt);
    this.spot.x = damp(this.spot.x, target.x, 3, dt); this.spot.z = damp(this.spot.z, target.z, 3, dt);
    this.spot.y = g.statics.groundHeight(this.spot.x, this.spot.z);
    if (!this.leaving && g.wanted.stars >= 4 && p.alive) {
      this.shootT -= dt;
      if (this.shootT <= 0) {
        this.shootT = rng.range(1.2, 2.2);
        muzzle.set(this.pos.x, this.pos.y - 1.6, this.pos.z);
        aim.set(target.x - muzzle.x, target.y + 1 - muzzle.y, target.z - muzzle.z).normalize();
        g.combat.fire(null, muzzle, aim, WEAPONS.hornet, { spreadMul: 1.6, damageMul: 0.8 });
      }
    }
    this.sync();
  }

  sync() {
    this.mesh.position.copy(this.pos);
    const bank = Math.max(-0.3, Math.min(0.3, -this.vel.x * Math.cos(this.yaw) * 0.01 + this.vel.z * Math.sin(this.yaw) * 0.01));
    this.mesh.rotation.set(0.12, this.yaw, bank);
    const lx = this.pos.x, ly = this.pos.y - 1.4, lz = this.pos.z;
    if (this.light) { this.light.position.set(lx, ly, lz); this.light.target.position.copy(this.spot); if (!this.dead) this.light.intensity = 3500; }
    const dx = this.spot.x - lx, dy = this.spot.y - ly, dz = this.spot.z - lz;
    const len = Math.hypot(dx, dy, dz);
    this.cone.position.set(lx, ly, lz);
    this.cone.scale.set(len * 0.2 / 7 * 1.0 + 0.2, len, len * 0.2 / 7 + 0.2);
    this.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  }

  dispose() {
    this.game.scene.remove(this.mesh, this.cone);
    this.game.police.releaseSearchlight(this);
  }
}
