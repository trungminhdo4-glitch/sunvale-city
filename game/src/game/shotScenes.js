// Staged, seeded moments of real gameplay for the screenshots (?shot=chase|shootout|race|map).
// Each scene sets the state through the game's own systems, simulates a few frames, then holds.

import { reseed } from '../core/rng.js';
import { MISSIONS } from '../data/story.js';
import { Vehicle } from '../actors/vehicle.js';

const DT = 1 / 30;

/** Starts a mission at a step; the step's own call-in line plays unless the radio should talk. */
function startMission(game, id, stepIndex, stepLine = true) {
  const m = MISSIONS.find((q) => q.id === id);
  const ms = game.missions;
  for (const q of MISSIONS.slice(0, MISSIONS.indexOf(m))) ms.completed.add(q.id);
  ms.start(m);
  while (ms.stepIndex < stepIndex) ms.nextStep();
  ms.lines = [];
  if (stepLine && ms.step?.say) ms.say(ms.step.say);
  return ms;
}

/** Earned respect for a scene set later in the story. */
function setRespect(game, rp) { game.progress.rp = rp; game.progress.popup = null; game.progress.rankUpIn = 0; }

function simulate(game, frames, each) {
  for (let k = 0; k < frames; k++) {
    each?.(k);
    game.update(DT);
  }
}

function placeCar(game, type, color, x, z, heading, speed = 0) {
  const v = new Vehicle(type, color, x, z, heading);
  v.vx = Math.sin(heading) * speed; v.vz = Math.cos(heading) * speed; v.speed = speed;
  game.traffic.addVehicle(v);
  return v;
}

/** First start x whose camera line of sight has no palm trunk close in front of the lens. */
function clearStart(game, from, to, camFor) {
  for (let x = from; x <= to; x += 2) {
    const [cx, cz, lx, lz] = camFor(x);
    const dx = lx - cx, dz = lz - cz, dl = Math.hypot(dx, dz);
    const blocked = game.vegetation.poles.some((p) => {
      const px = p.x - cx, pz = p.z - cz, d = Math.hypot(px, pz);
      if (d > 34 || d < 0.5) return false;
      return (px * dx + pz * dz) / (d * dl) > Math.cos(0.62);
    });
    if (!blocked) return x;
  }
  return from;
}

function playerDrives(game, car) {
  game.player.enterCar(car, game);
  car.driver = 'player';
}

const SCENES = {
  /** Cover: sunset chase on Shoreline Boulevard, four stars, helicopter, mission target ahead. */
  chase(game) {
    game.stage.setHour(17.75);
    const ms = startMission(game, 'sunsetrun', 1, false);
    setRespect(game, 4280);
    game.player.armor = 55; game.player.health = 86;
    const tgt = ms.entities.target;
    const g = game.lanes;
    tgt.ai.a = g.id(4, 9); tgt.ai.b = g.id(5, 9); tgt.ai.curve = g.laneStraight(tgt.ai.a, tgt.ai.b); tgt.ai.s = 20; tgt.ai.turning = false;
    ms.entities.car.mission = false;
    game.traffic.removeVehicle(ms.entities.car);
    ms.entities.car = null;
    const x0 = clearStart(game, -110, 60, (x) => [x + 36, 292.8, x + 5, 284]);
    const car = placeCar(game, 'mirage', 0xff3d3d, x0, 287, Math.PI / 2, 30);
    playerDrives(game, car);
    game.combat.give('smg', 90);
    game.wanted.setLevel(4);
    game.state.money = 18450;
    const cops = [[x0 - 7, 291.3], [x0 - 13, 285.0], [x0 - 20, 291.0]];
    for (const [x, z] of cops) {
      const c = game.police.addCar(x, z, Math.PI / 2 + (z < 288 ? 0.05 : 0));
      c.vx = 31; c.speed = 31; c.crew = 0;
    }
    game.police.heli.active = true;
    game.police.heli.pos.set(-86, 26, 300);
    game.camera.snapBehind(car.heading);
    simulate(game, 24, () => car.drive(DT, { throttle: 1, steer: 0.02, handbrake: false }, game));
    const p = car.pos;
    game.police.heli.pos.set(p.x - 26, 15, p.z - 9);
    game.police.updateHeli(0.0001, 4);
    game.camera.setCinematic(p.x + 11.5, 3.7, 292.2, p.x - 20, 1.6, p.z - 0.8, 56);
  },

  /** On foot in the harbour container yard: "Dock Rats" shootout with Crane's crew. */
  shootout(game) {
    game.stage.setHour(16.9);
    const ms = startMission(game, 'dockrats', 1);
    setRespect(game, 1620);
    const pl = game.player;
    pl.placeAt(296, -138, 2.03);
    game.combat.give('smg', 120);
    game.combat.select(2);
    game.state.money = 9640;
    pl.armor = 60;
    const thugs = ms.entities.thugs;
    for (const k of [2, 5]) { thugs[k].health = 0; thugs[k].die(game, 'x'); }
    // the four still standing are spread across the lane ahead (d metres out, s to the side)
    const fx0 = Math.sin(2.03), fz0 = Math.cos(2.03), at = (d, s) => [pl.pos.x + fx0 * d - fz0 * s, pl.pos.z + fz0 * d + fx0 * s];
    [[15, 3], [23, 9], [30, 2], [27, 15]].forEach(([d, s], i) => { const n = thugs[[0, 1, 3, 4][i]]; const [x, z] = at(d, s); n.pos.set(x, 0, z); });
    const [cx, cz] = at(11, 1.5);
    const wreck = placeCar(game, 'ridgeback', 0x3d5a80, cx, cz, 2.03 + 1.3);
    wreck.health = wreck.spec.health * 0.18;
    game.wanted.setLevel(1);
    game.wanted.report('shooting', pl.pos.x, pl.pos.z);
    game.camera.yaw = 2.03; game.camera.pitch = 0.05; game.camera.idle = 0;
    simulate(game, 36, () => { pl.aiming = true; pl.heading = game.camera.yaw; pl.model.gun.visible = true; });
    pl.aiming = true;
    pl.health = 74;
    pl.hurtFlash = 0;
    game.combat.cooldown = 0;
    game.combat.fire(game.combat.weapon);
    thugs[1].fireCooldown = 0;
    game.update(DT * 0.3);
    // over the right shoulder, looking down the line of containers at the crew
    const fx = Math.sin(2.03), fz = Math.cos(2.03);
    game.camera.setCinematic(pl.pos.x - fx * 6 - fz * 1.6, 2.9, pl.pos.z - fz * 6 + fx * 1.6, pl.pos.x + fx * 40, 3.2, pl.pos.z + fz * 40, 62);
  },

  /** Coastline Sprint: racing the Brute 77 toward the pier and its wheel. */
  race(game) {
    game.stage.setHour(17.55);
    const ms = startMission(game, 'streetrace', 1);
    setRespect(game, 2930);
    game.combat.give('smg', 120); game.combat.give('shotgun', 18); game.combat.select(1);
    game.player.armor = 80;
    ms.entities.points[0].done = true;
    const car = ms.entities.car;
    car.pos.set(-99.3, 0, 226); car.heading = 0.02; car.vz = 34; car.speed = 34;
    playerDrives(game, car);
    game.radio.station = 0;
    game.hud.showRadio(game.radio.name);
    game.state.money = 7300;
    ms.timer = 31;
    game.camera.snapBehind(car.heading);
    game.camera.pitch = 0.14;
    simulate(game, 40, () => car.drive(DT, { throttle: 1, steer: 0, handbrake: false }, game));
  },

  /** Old Mission at rush hour: pedestrians, traffic, and Kai about to steal a Sunny Cab. */
  street(game) {
    game.stage.setHour(17.1);
    for (const id of ['homecoming', 'borrowed']) game.missions.completed.add(id);
    setRespect(game, 760);
    game.combat.give('smg', 70);
    game.state.money = 4380;
    const pl = game.player;
    pl.placeAt(166, -190, 0);
    // a busy evening: people on the corners ahead and along both sidewalks
    for (const [i, j] of [[7, 1], [6, 1], [8, 1]]) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) game.peds.spawnAtCorner({ i, j, sx, sz });
    }
    for (let k = 0; k < 10; k++) {
      const n = game.peds.spawnAtCorner({ i: 7, j: 2, sx: k % 2 ? 1 : -1, sz: -1 });
      n.pos.z = -214 + k * 4.5;
    }
    const g = game.lanes;
    const cab = game.traffic.spawnOnLane('sunnycab', g.id(7, 1), g.id(7, 2), 0.42);
    cab.ai.cruise = 0; cab.speed = 0;
    simulate(game, 50, () => { cab.ai.cruise = 0; });
    const side = cab.spec.wid / 2 + 0.75;
    pl.placeAt(cab.pos.x + Math.cos(cab.heading) * side, cab.pos.z - Math.sin(cab.heading) * side, cab.heading - Math.PI / 2);
    pl.model.animate(0.2, 1.5);
    game.mode = 'play';
    game.update(DT * 0.1);
    game.mode = 'shot';
    game.camera.setCinematic(pl.pos.x + 9, 3.4, pl.pos.z + 10, pl.pos.x - 6, 2.2, pl.pos.z - 8, 58);
    game.hud.el.district.textContent = 'Old Mission';
    game.keepDistrict = true;
  },

  /** Pause menu: the city map with story progress. */
  map(game, menus) {
    game.stage.setHour(18.1);
    for (const id of ['homecoming', 'borrowed', 'boardwalk', 'dockrats']) game.missions.completed.add(id);
    game.pickups.restoreTokens([0, 3, 5, 8, 11, 19, 22]);
    game.combat.give('smg', 80); game.combat.give('shotgun', 12);
    game.state.money = 12900;
    Object.assign(game.state.stats, { carsStolen: 23, driven: 41800, maxWanted: 4, escapes: 6 });
    game.player.placeAt(250, -40, 0);
    simulate(game, 20);
    game.camera.setCinematic(330, 60, 60, 200, 10, -60, 55);
    game.mode = 'play';
    menus.openPause(game);
    game.mode = 'paused';
  },
};

export function runShotScene(game, menus, name, seed) {
  reseed(seed);
  menus.hideTitle();
  game.hud.show(true);
  game.mode = 'shot';
  game.input.enabled = false;
  const scene = SCENES[name] ?? SCENES.chase;
  // let the world populate first: traffic and pedestrians fill in around the player
  scene(game, menus);
  game.hud.el.district.style.transition = 'none';
  game.hud.el.district.classList.toggle('on', !!game.keepDistrict);
  if (name !== 'map') { game.hud.el.banner.style.transition = 'none'; game.hud.el.banner.classList.remove('on'); game.hud.bannerTime = 0; }
  // keep presenting the held frame (a resize clears the canvas)
  const hold = () => { game.render(); requestAnimationFrame(hold); };
  hold();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
