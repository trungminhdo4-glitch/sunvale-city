// The Game: builds Sunvale, owns every system, runs the frame loop and handles the big events
// (car theft, kills, explosions, wasted and busted, respawns).

import { Stage } from '../render/stage.js';
import { Input } from '../core/input.js';
import { buildCityPlan } from '../world/cityLayout.js';
import { buildCity } from '../world/cityBuilder.js';
import { buildLandmarks } from '../world/landmarks.js';
import { buildVegetation } from '../world/vegetation.js';
import { CollisionMap } from '../world/collisionMap.js';
import { LaneGraph } from '../world/laneGraph.js';
import { Player } from '../actors/player.js';
import { TrafficSystem } from '../systems/trafficSystem.js';
import { PedestrianSystem } from '../systems/pedestrianSystem.js';
import { WantedSystem } from '../systems/wantedSystem.js';
import { PoliceSystem } from '../systems/policeSystem.js';
import { CombatSystem } from '../systems/combatSystem.js';
import { MissionSystem } from '../systems/missionSystem.js';
import { PickupSystem } from '../systems/pickupSystem.js';
import { ProgressionSystem } from '../systems/progressionSystem.js';
import { DispatchRadio } from '../systems/dispatchRadio.js';
import { Effects } from '../fx/effects.js';
import { AudioEngine } from '../audio/audioEngine.js';
import { Radio } from '../audio/radio.js';
import { FollowCamera } from './followCamera.js';
import { Hud } from '../ui/hud.js';
import { Minimap } from '../ui/minimap.js';
import { writeSave } from './saveGame.js';
import { MISSIONS } from '../data/story.js';
import { rng } from '../core/rng.js';

export class Game {
  constructor(canvas) {
    this.stage = new Stage(canvas);
    this.scene = this.stage.scene;
    this.input = new Input(canvas);
    this.plan = buildCityPlan();
    this.collision = new CollisionMap();
    for (const b of this.plan.buildings) this.collision.add(b);
    this.lanes = new LaneGraph();
    this.city = buildCity(this.scene, this.plan);
    this.landmarks = buildLandmarks(this.scene);
    this.vegetation = buildVegetation(this.scene, this.plan);
    for (const p of this.vegetation.poles) this.collision.add({ minX: p.x - p.r, maxX: p.x + p.r, minZ: p.z - p.r, maxZ: p.z + p.r, h: 6 });

    this.vehicles = [];
    this.npcs = [];
    this.time = 0;
    this.state = { money: 500, stats: { carsStolen: 0, driven: 0, maxWanted: 0, escapes: 0 } };
    this.prompt = null;
    this.mode = 'title';      // title | play | paused | down
    this.downTimer = 0;

    this.fx = new Effects(this.scene);
    this.audio = new AudioEngine();
    this.radio = new Radio(this.audio);
    this.player = new Player(this.scene);
    this.camera = new FollowCamera(this.stage.camera, this);
    this.traffic = new TrafficSystem(this);
    this.peds = new PedestrianSystem(this);
    this.wanted = new WantedSystem(this);
    this.police = new PoliceSystem(this);
    this.combat = new CombatSystem(this);
    this.missions = new MissionSystem(this);
    this.pickups = new PickupSystem(this);
    this.progress = new ProgressionSystem(this);
    this.dispatch = new DispatchRadio(this);
    this.hud = new Hud();
    this.minimap = new Minimap(document.getElementById('minimap'), this.plan);

    const home = this.plan.places.safehouse;
    this.player.placeAt(home.x, home.z + 2.5, Math.PI);
    this.stage.setHour(17.3);
  }

  save() { return writeSave(this); }

  // ---------- events from the systems

  onCarjack(v, prev) {
    const p = this.player.pos;
    this.peds.spawnFleeing(p.x, p.z, v.pos);
    this.wanted.report(prev === 'cop' ? 'copCar' : 'carjack', p.x, p.z);
    this.state.stats.carsStolen++;
    this.progress.earn('carjack');
  }

  onNpcKilled(n, from) {
    const byPlayer = from === this.player.pos || from === 'player-car' || (from === 'blast' && this.time - this.combat.lastShot < 6);
    if (byPlayer) {
      if (n.role === 'cop') this.wanted.report('killCop', n.pos.x, n.pos.z);
      else if (n.role === 'civ') this.wanted.report('killCiv', n.pos.x, n.pos.z);
      if (n.role === 'thug' || n.role === 'cop') this.progress.earn(n.role);
    }
    if (n.role !== 'civ' || rng.chance(0.4)) this.pickups.dropCash(n.pos.x, n.pos.z, n.role === 'thug' ? rng.int(60, 180) : rng.int(10, 60));
  }

  onVehicleDestroyed(v) {
    this.combat.explode(v);
    if (Math.hypot(v.pos.x - this.player.pos.x, v.pos.z - this.player.pos.z) < 45) {
      this.wanted.report(v.police ? 'copCar' : 'wreck', v.pos.x, v.pos.z);
      if (v.police) this.progress.earn('wreck');
    }
  }

  onPlayerCrash(other, strength) {
    if (other.police && strength > 6) this.wanted.report('assault', other.pos.x, other.pos.z);
  }

  onWantedCleared(peak = 1) { this.state.stats.escapes++; this.progress.earn('escape', peak); }

  onPlayerDown(kind) {
    if (this.mode === 'down') return;
    this.mode = 'down';
    this.downTimer = 0;
    this.downKind = kind;
    this.hud.banner(kind === 'busted' ? 'BUSTED' : 'WASTED', kind, kind === 'busted' ? 'The SVPD takes $500 and your guns\' ammo.' : 'St. Coral Hospital bills you $300.');
    this.audio.wasted();
    this.missions.fail(kind === 'busted' ? 'You were arrested.' : 'You died.');
    if (this.player.inCar) this.player.vehicle.speed *= 0.5;
    if (!this.player.inCar) this.player.model.fall();
  }

  respawn() {
    const pl = this.player, kind = this.downKind;
    if (pl.inCar) pl.exitCar(this);
    const place = kind === 'busted' ? this.plan.places.police : this.plan.places.hospital;
    pl.placeAt(place.x, place.z, 0);
    pl.model.stand();
    pl.dead = false;
    pl.health = 100;
    pl.armor = 0;
    this.state.money = Math.max(0, this.state.money - (kind === 'busted' ? 500 : 300));
    if (kind === 'busted') for (const k of Object.keys(this.combat.ammo)) if (k !== 'fists') this.combat.ammo[k] = Math.min(this.combat.ammo[k], 14);
    this.wanted.clear();
    this.police.clearAll();
    this.camera.snapBehind(0);
    this.mode = 'play';
  }

  // ---------- per frame

  /** Blips for the minimap; full=true for the pause map. */
  blips(full = false) {
    const out = [], t = this.time;
    const P = this.plan.places;
    for (const k of ['hospital', 'police', 'safehouse']) out.push({ x: P[k].x, z: P[k].z, color: '#ffffff', size: 6, shape: 'square', label: P[k].icon, edge: false });
    const tgt = this.missions.target;
    if (tgt) {
      const color = tgt.kind === 'enemy' ? '#ff4040' : tgt.kind === 'car' ? '#5fd0ff' : '#ffd23f';
      out.push({ x: tgt.x, z: tgt.z, color, size: 7, label: tgt.kind === 'giver' ? tgt.icon : '', edge: true });
    }
    if (!full) {
      for (const n of this.missions.entities.thugs) if (!n.dead) out.push({ x: n.pos.x, z: n.pos.z, color: '#ff4040', size: 3.5, edge: false });
      for (const c of this.police.cars) if (!c.dead) out.push({ x: c.pos.x, z: c.pos.z, color: Math.floor(t * 5) % 2 ? '#ff3b3b' : '#3b7bff', size: 5, edge: this.wanted.level > 0 });
      for (const o of this.police.officers) if (!o.dead) out.push({ x: o.pos.x, z: o.pos.z, color: '#ff6b6b', size: 3, edge: false });
      if (this.police.heli.active) out.push({ x: this.police.heli.pos.x, z: this.police.heli.pos.z, color: '#7fb2ff', size: 6, shape: 'square', edge: true });
    }
    return out;
  }

  updatePrompt() {
    const pl = this.player;
    this.prompt = null;
    if (this.mode !== 'play') return;
    if (pl.inCar) return;
    const v = pl.findCar(this.vehicles);
    if (v) {
      const steal = v.driver && v.driver !== 'player';
      this.prompt = `<kbd>F</kbd> ${steal ? 'Steal' : 'Enter'} ${v.spec.name}`;
      return;
    }
    const m = this.missions.next;
    if (!this.missions.active && m) {
      const p = this.plan.places[m.place];
      if (Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < 14) this.prompt = this.wanted.level > 0 ? 'Lose the police before starting a mission' : `Step into the marker: <b>${m.title}</b>`;
    }
  }

  handleActions() {
    const inp = this.input, pl = this.player;
    if (inp.hit('KeyF') || inp.hit('Enter')) {
      if (pl.inCar) { if (Math.abs(pl.vehicle.speed) < 8) pl.exitCar(this); }
      else {
        const v = pl.findCar(this.vehicles);
        if (v) {
          if (!v.driver && !v.mission && !v.police) this.wanted.report('steal', pl.pos.x, pl.pos.z);
          if (!v.driver && !v.mission) { this.state.stats.carsStolen++; this.progress.earn('steal'); }
          pl.enterCar(v, this);
          this.camera.snapBehind(v.heading);
          this.hud.showRadio(this.radio.name);
        }
      }
    }
    if (inp.hit('KeyQ') && pl.inCar) this.hud.showRadio(this.radio.cycle());
    if (inp.hit('KeyH') && pl.inCar) this.audio.tone(330, 0.4, { type: 'square', gain: 0.12 });
  }

  update(dt) {
    this.time += dt;
    const pl = this.player, inp = this.input;
    if (this.mode === 'play') {
      this.handleActions();
      if (pl.inCar) {
        const before = pl.vehicle.pos.clone();
        pl.updateDriving(dt, inp, this);
        if (pl.inCar) this.state.stats.driven += before.distanceTo(pl.vehicle.pos);
      } else pl.updateOnFoot(dt, inp, this.camera.yaw, this);
      this.combat.update(dt, inp);
    } else if (this.mode === 'down') {
      this.downTimer += dt;
      if (pl.inCar) pl.updateDriving(dt, { axes: () => ({ x: 0, y: 0 }), down: () => true }, this);
      if (this.downTimer > 4) this.respawn();
    }
    this.police.update(dt);
    this.wanted.update(dt);
    this.state.stats.maxWanted = Math.max(this.state.stats.maxWanted, this.wanted.level);
    this.traffic.update(dt);
    if (pl.inCar) { pl.pos.set(pl.vehicle.pos.x, 0, pl.vehicle.pos.z); pl.heading = pl.vehicle.heading; }
    this.peds.update(dt);
    this.missions.update(dt);
    this.pickups.update(dt);
    this.progress.update(dt);
    this.dispatch.update(dt);
    this.landmarks.update(dt);

    const car = pl.vehicle;
    if (car && car.skid > 0.35 && Math.abs(car.speed) > 6) {
      for (const s of [-1, 1]) this.fx.skid(car.pos.x - car.forwardX * 1.4 + Math.cos(car.heading) * 0.8 * s, car.pos.z - car.forwardZ * 1.4 - Math.sin(car.heading) * 0.8 * s, car.heading);
      if (rng.chance(0.3)) this.fx.puff(car.pos.x - car.forwardX * 2, 0.3, car.pos.z - car.forwardZ * 2);
    }
    this.fx.update(dt);

    if (this.mode !== 'shot') {
      this.stage.setHour(this.stage.hour + dt / 60);
    }
    const n = this.stage.night;
    this.city.setNight(n); this.landmarks.setNight(n); this.vegetation.setNight(n);
    this.camera.update(dt, inp);
    this.stage.follow(pl.pos.x, pl.pos.z);

    const ax = inp.axes();
    this.audio.setEngine(car, car ? ax.y : 0, car?.skid ?? 0);
    this.radio.setPlaying(!!car && this.mode === 'play');
    this.radio.update();
    this.updatePrompt();
    this.hud.update(dt, this);
    this.minimap.draw(this);
  }

  render() { this.stage.render(this.time); }

  /** First-time hint so new players know where to go. */
  greet() {
    const m = this.missions.next;
    if (m) this.hud.notify(`${m === MISSIONS[0] ? 'Mama Lu is waiting at her diner in Old Mission.' : 'Your next contact is on the map.'} Follow the yellow blip.`);
  }
}
