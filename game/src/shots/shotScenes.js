// Deterministic screenshot scenes (?shot=chase|plaza|downtown|pause): each stages real game systems — a police chase,
// a street fight, a wrecked convoy, the pause map — simulates them with the fixed step and frames the camera.
import * as THREE from 'three';
import { SIM_DT } from '../core/config.js';
import { rng } from '../core/rng.js';
import { MISSIONS } from '../mission/story.js';
import { SCRIPTS } from '../mission/missionScripts.js';
import { PoliceDriver } from '../ai/police.js';
import { PoliceHelicopter } from '../ai/policeHelicopter.js';
import { WEAPONS } from '../combat/weapons.js';
import { LOCATIONS } from '../world/cityLayout.js';

// Holds a lane at full throttle (stands in for the player's hands on the wheel).
class StraightDriver {
  constructor(laneX, speed = 30) { this.laneX = laneX; this.speed = speed; }
  update(v) {
    const tx = this.laneX, tz = v.pos.z + Math.cos(v.yaw) * 30;
    const desired = Math.atan2(tx - v.pos.x, tz - v.pos.z);
    let diff = desired - v.yaw; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    v.steer = Math.max(-1, Math.min(1, diff * 2));
    v.throttle = v.speed < this.speed ? 1 : 0.2;
    v.handbrake = false;
  }
}

function startMission(game, id, stepIndex) {
  const m = game.missions;
  const mission = MISSIONS.find((x) => x.id === id);
  m.active = mission;
  m.steps = SCRIPTS[id](m);
  for (let k = 0; k <= stepIndex; k++) m.steps[k].setup?.();
  m.index = stepIndex;
  m.completed = MISSIONS.slice(0, MISSIONS.indexOf(mission)).map((x) => x.id);
  return m.steps;
}

function putPlayerIn(game, v) {
  game.enterVehicle(game.player, v);
  v.controller = null;
}

async function simulate(game, frames, each = null) {
  for (let i = 0; i < frames; i++) {
    if (each) each(i);
    game.step(SIM_DT);
    if (i === frames - 1) game.hud.money = game.money;
    game.render(SIM_DT, i === frames - 1);
  }
}

async function settle() { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }

function frameCamera(game, pos, look, fov = 60) {
  game.shotCamera = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look), fov };
}

const SCENES = {
  // Cover: a three-star chase down Coral Ave in Dex's stolen Vespera GT at golden hour.
  async chase(game) {
    game.day.setHour(17.75);
    game.money = 4870;
    const steps = startMission(game, 'vespera', 0);
    const car = game.vehicles.find((v) => v.tag === 'vespera');
    const z0 = 60;
    car.pos.set(-316.5, 0, z0); car.yaw = Math.PI; car.vx = 0; car.vz = -27;
    putPlayerIn(game, car);
    game.missions.advance(); game.missions.advance();
    game.wanted.setStars(3);
    void steps;
    car.controller = new StraightDriver(-316.5, 29);
    game.arsenal.give('kestrel', 42);
    const cops = [[-316.5, z0 + 9], [-322.6, z0 + 15], [-316.8, z0 + 26]].map(([x, z]) => {
      const v = game.traffic.spawnAt('cruiser', x, z, Math.PI);
      v.isTraffic = false; v.controller = new PoliceDriver(); v.driver.role = 'cop'; v.sirenOn = true; v.vz = -27;
      return v;
    });
    const heli = new PoliceHelicopter(game);
    heli.pos.set(-334, 30, z0 + 14); heli.orbit = 1.6;
    game.police.helis.push(heli);
    for (const [x, z, yaw] of [[-323.5, z0 - 60, 0], [-316.5, z0 - 120, Math.PI], [-323.5, z0 - 25, 0]]) game.traffic.spawnAt('marlin', x, z, yaw);
    game.radio.index = 0;
    await simulate(game, 50, () => { game.police.spawnT = 99; for (const c of cops) c.blink += 0; });
    const p = car.pos;
    heli.pos.set(p.x - 7, 15, p.z + 34); heli.vel.set(0, 0, -25); heli.yaw = Math.PI;
    frameCamera(game, [p.x - 5.6, 1.7, p.z - 10.5], [p.x + 1.6, 2.6, p.z + 12], 62);
    game.camCtl.yaw = Math.PI;
    await simulate(game, 1);
    await settle();
  },

  // On foot at Mango Plaza: Rio opens up on Calloway's collectors with the Hornet while vendors scatter.
  async plaza(game) {
    game.day.setHour(17.2);
    game.money = 6215;
    startMission(game, 'collectors', 1);
    game.arsenal.give('hornet', 180);
    game.arsenal.current = 'hornet';
    const c = LOCATIONS.mangoPlaza;
    game.placePlayer(c.x + 7, c.z + 23.5, Math.PI);
    for (let k = 0; k < 9; k++) game.peds.spawnAt(c.x - 20 + k * 5, c.z - 22 + (k % 3) * 20);
    const goons = game.characters.filter((x) => x.role === 'thug');
    goons[1].pos.set(c.x + 4.5, 0.15, c.z + 9);
    goons[0].pos.set(c.x - 5, 0.15, c.z + 5);
    goons[2].pos.set(c.x + 13, 0.15, c.z - 1);
    goons[3].damage(500, game.player, 'bullet');
    game.dialogue.play([['mari', 'Those are Calloway\'s collectors. Run them off my plaza, Rio!']]);
    const p = game.player;
    const target = goons[1];
    const fwd = Math.atan2(target.pos.x - p.pos.x, target.pos.z - p.pos.z);
    const sx = Math.sin(fwd), sz = Math.cos(fwd), rx = -sz, rz = sx;
    frameCamera(game, [p.pos.x - sx * 4.6 + rx * 1.25, p.pos.y + 2.25, p.pos.z - sz * 4.6 + rz * 1.25], [target.pos.x - rx * 2, 1.4, target.pos.z - rz * 2], 60);
    await simulate(game, 70, (i) => {
      const yaw = Math.atan2(target.pos.x - p.pos.x, target.pos.z - p.pos.z) - 0.04;
      p.yaw = yaw; p.mode = 'aim'; p.weapon = WEAPONS.hornet;
      game.camCtl.yaw = yaw + 0.05; game.camCtl.pitch = 0.08; game.camCtl.aiming = true;
      if ((69 - i) % 5 === 0 && i > 40) {
        const m = new THREE.Vector3(p.pos.x + Math.sin(yaw) * 0.55 - Math.cos(yaw) * 0.26, p.pos.y + 1.42, p.pos.z + Math.cos(yaw) * 0.55 + Math.sin(yaw) * 0.26);
        const d = new THREE.Vector3(target.pos.x - m.x, target.pos.y + 1.3 - m.y, target.pos.z - m.z).normalize();
        game.combat.fire(p, m, d, WEAPONS.hornet, { spreadMul: 0.6 });
      }
    });
    await settle();
  },

  // High chase cam over Sunvale Blvd: the first Calloway transporter goes up in flames, downtown glows ahead.
  async downtown(game) {
    game.day.setHour(18.3);
    game.money = 11340;
    startMission(game, 'heat', 0);
    const vans = game.vehicles.filter((v) => v.type === 'van');
    const car = game.spawnVehicle('pelican', 3.5, 175, Math.PI, '#c97b3d');
    car.vz = -20;
    putPlayerIn(game, car);
    car.controller = new StraightDriver(3.5, 21);
    vans[1].pos.set(3.5, 0, 128); vans[1].yaw = Math.PI; vans[1].vz = -8;
    vans[0].pos.set(-60.5, 0, -60.5);
    for (let k = 0; k < 7; k++) game.traffic.spawnNear(3, 90, 15, 120);
    game.wanted.setStars(2);
    game.arsenal.give('breaker', 16);
    const cop = game.traffic.spawnAt('cruiser', -3.5, 88, 0);
    cop.isTraffic = false; cop.controller = new PoliceDriver(); cop.driver.role = 'cop'; cop.sirenOn = true;
    let blown = false;
    await simulate(game, 80, (i) => {
      if (i === 62 && !blown) { blown = true; vans[1].lastAttacker = game.player; vans[1].explode(); }
    });
    const p = car.pos;
    frameCamera(game, [p.x - 2.5, 8.5, p.z + 15], [p.x - 2, 2.5, p.z - 45], 64);
    await simulate(game, 1);
    await settle();
  },

  // The pause menu: Sunvale's full map with contacts and services, the story so far, stats and Save.
  async pause(game) {
    game.day.setHour(18.9);
    game.money = 8450;
    game.missions.load({ completed: ['strip', 'vespera', 'tamales'] });
    game.tokens.load([0, 2, 3, 6, 9]);
    game.arsenal.give('kestrel', 60);
    Object.assign(game.stats, { playTime: 4330, carsStolen: 14, distance: 23400, kills: 9, maxWanted: 4, missions: 3 });
    game.placePlayer(-338, -20, -2.4);
    await simulate(game, 30);
    game.state = 'pause';
    game.menus.showPause(true);
    game.render(SIM_DT, true);
    await settle();
  },
};

export async function runShot(game, name) {
  const scene = SCENES[name];
  if (!scene) throw new Error(`unknown shot "${name}"`);
  rng.reseed(777);
  game.state = 'play';
  game.menus.showTitle(false);
  game.hud.setVisible(true);
  game.camCtl.shake = () => {};
  game.onResize();
  await scene(game);
}
