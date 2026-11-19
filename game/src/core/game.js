// The game itself: owns the renderer, the world and every system, runs the fixed-step loop and the game states
// (title, play, pause), and handles entering cars, dying, getting cuffed, respawning and saving.
import * as THREE from 'three';
import { SIM_DT, START, RESPAWN, COSTS } from './config.js';
import { EventBus } from './events.js';
import { Input } from './input.js';
import { rng } from './rng.js';
import { StaticWorld } from '../world/collision.js';
import { buildCity } from '../world/cityBuilder.js';
import { buildProps } from '../world/props.js';
import { SkyAndSea } from '../world/skyAndSea.js';
import { DayCycle } from '../world/dayCycle.js';
import { resolveVehicleContacts, resolveCharacterVehicleContacts } from '../world/contacts.js';
import { LOCATIONS } from '../world/cityLayout.js';
import { Character } from '../entities/character.js';
import { Vehicle } from '../entities/vehicle.js';
import { PlayerController } from '../entities/playerController.js';
import { FollowCamera } from '../camera/followCamera.js';
import { Arsenal } from '../combat/weapons.js';
import { CombatSystem } from '../combat/combatSystem.js';
import { FxSystem } from '../fx/particles.js';
import { TrafficSystem } from '../ai/traffic.js';
import { PedestrianSystem, PedBrain, pathNear } from '../ai/pedestrians.js';
import { WantedSystem } from '../ai/wantedLevel.js';
import { PoliceSystem, CopBrain } from '../ai/police.js';
import { LaneDriver } from '../ai/drivers.js';
import { MissionManager } from '../mission/missionManager.js';
import { SunTokens } from '../mission/collectibles.js';
import { Pickups } from '../mission/pickups.js';
import { Services } from '../mission/services.js';
import { AudioEngine } from '../audio/audioEngine.js';
import { Radio } from '../audio/radio.js';
import { Hud } from '../ui/hud.js';
import { Dialogue } from '../ui/dialogue.js';
import { Minimap } from '../ui/minimap.js';
import { Menus } from '../ui/menus.js';
import { renderCityMap } from '../ui/mapRenderer.js';
import { writeSave, readSave } from '../save/saveGame.js';

export const RIO_LOOK = { skin: '#b9825a', shirt: '#ff6f61', pants: '#2b2d42', hair: '#1a120c', shoes: '#f2f2f2', build: 1.04 };
const MARI_LOOK = { skin: '#7a4a2e', shirt: '#2ec4b6', pants: '#ffd166', hair: '#1a0f0a', shoes: '#ffffff' };
const TEO_LOOK = { skin: '#e0ac85', shirt: '#3d5a80', pants: '#3d5a80', hair: '#8a3b12', hat: '#ffd166', shoes: '#5c4632', build: 1.12 };
const PARKED = [
  ['marlin', -314.1, -150, 0], ['brisa', -314.1, -40, Math.PI], ['pelican', -314.1, 60, 0], ['vespera', -325.9, -10, Math.PI],
  ['marlin', -250.1, -100, Math.PI], ['cab', -197.9, 40, 0], ['brisa', -122.1, -20, Math.PI], ['marlin', 5.9, 100, 0],
  ['pelican', 133.9, 250, Math.PI], ['brisa', 69.9, -180, 0], ['vespera', 197.9, -60, Math.PI], ['marlin', -58.1, 200, 0],
];

export class Game {
  constructor(canvas, { shot = null } = {}) {
    this.canvas = canvas;
    this.shotMode = shot;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!shot, powerPreference: 'high-performance' });
    r.setPixelRatio(shot ? 1 : Math.min(window.devicePixelRatio, 1.75));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.3, 2600);
    this.events = new EventBus();
    this.input = new Input(canvas);
    this.statics = new StaticWorld();
    this.day = new DayCycle(this.scene, r);
    this.skySea = new SkyAndSea(this.scene);
    const city = buildCity(this.scene, this.statics);
    buildProps(this.scene, this.statics, city.spots);
    this.vehicles = [];
    this.characters = [];
    this.money = 0;
    this.stats = this.freshStats();
    this.arsenal = new Arsenal();
    this.state = 'title';
    this.acc = 0;
    this.downT = 0;
    this.downKind = null;
    this.time = 0;

    this.audio = new AudioEngine(this);
    this.radio = new Radio(this.audio);
    this.fx = new FxSystem(this);
    this.combat = new CombatSystem(this);
    this.camCtl = new FollowCamera(this.camera, this);
    this.police = new PoliceSystem(this);
    this.wanted = new WantedSystem(this);
    this.traffic = new TrafficSystem(this);
    this.peds = new PedestrianSystem(this);
    this.missions = new MissionManager(this);
    this.tokens = new SunTokens(this);
    this.pickups = new Pickups(this);
    this.services = new Services(this);
    this.controller = new PlayerController(this);
    this.hud = new Hud(this);
    this.dialogue = new Dialogue();
    this.mapImage = renderCityMap(this.statics);
    this.minimap = new Minimap(document.getElementById('minimap'), this.mapImage);
    this.menus = new Menus(this);

    this.player = new Character(this, { x: START.x, z: START.z, yaw: START.yaw, look: RIO_LOOK, role: 'player', name: 'Rio' });
    this.addCharacter(this.player);
    this.spawnContacts();
    this.spawnParkedCars(city.spots.parkedCars);
    this.fountains = city.spots.fountains;
    this.wireEvents();
    this.envHour = -1;
    this.refreshEnvironment();
    this.onResize();
    addEventListener('resize', () => this.onResize());
    this.input.onLockChange = (locked) => { if (!locked && this.state === 'play' && !this.shotMode) this.pause(); };
    addEventListener('keydown', (e) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.state === 'pause') this.resume();
      else if (e.code === 'KeyP' && this.state === 'play') this.pause();
    });
    this.canvas.addEventListener('click', () => { if (this.state === 'play') this.input.requestLock(); });
  }

  freshStats() { return { playTime: 0, carsStolen: 0, distance: 0, kills: 0, maxWanted: 0, missions: 0 }; }

  // ---------- world population ----------
  addCharacter(c) { this.characters.push(c); return c; }
  removeCharacter(c) {
    if (c === this.player) return;
    if (c.vehicle && c.vehicle.driver === c) c.vehicle.driver = null;
    const i = this.characters.indexOf(c);
    if (i >= 0) this.characters.splice(i, 1);
    c.dispose();
  }
  spawnVehicle(type, x, z, yaw, color = null) {
    const v = new Vehicle(this, type, x, z, yaw, color);
    this.vehicles.push(v);
    return v;
  }
  removeVehicle(v) {
    if (v === this.player.vehicle) return;
    if (v.driver) this.removeCharacter(v.driver);
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
    v.dispose();
  }

  spawnContacts() {
    const mari = new Character(this, { x: LOCATIONS.mari.x, z: LOCATIONS.mari.z, yaw: Math.PI / 2, look: MARI_LOOK, role: 'contact', name: 'Mari' });
    const teo = new Character(this, { x: LOCATIONS.teo.x, z: LOCATIONS.teo.z, yaw: Math.PI, look: TEO_LOOK, role: 'contact', name: 'Teo' });
    for (const c of [mari, teo]) { c.invulnerable = true; this.addCharacter(c); }
    this.contacts = { mari, teo };
  }

  spawnParkedCars(fromCity) {
    for (const p of fromCity) { const v = this.spawnVehicle(p.type, p.x, p.z, p.yaw); v.persistent = true; v.parked = true; }
    for (const [type, x, z, yaw] of PARKED) {
      const v = this.spawnVehicle(type, x, z, yaw);
      v.setColor(rng.pick(v.spec.colors));
      v.persistent = true; v.parked = true;
    }
  }

  wireEvents() {
    const ev = this.events;
    ev.on('characterKilled', (e) => {
      const v = e.victim;
      if (v === this.player) { this.playerDown('death'); return; }
      if (e.from === this.player) {
        this.stats.kills++;
        const cash = v.role === 'thug' ? rng.int(40, 120) : v.role === 'cop' ? rng.int(20, 60) : rng.int(5, 30);
        this.pickups.dropCash(v.pos.x, v.pos.z, cash);
      }
    });
    ev.on('vehicleHurt', (e) => {
      const v = e.vehicle;
      if (e.from !== this.player || !(v.controller instanceof LaneDriver)) return;
      v.controller.panic = 8;
      if (v.driver && v.absSpeed < 3 && rng.chance(0.25) && !v.persistent) this.bailOut(v);
    });
    ev.on('carjack', () => { this.stats.carsStolen++; });
  }

  // ---------- cars ----------
  enterVehicle(c, v) {
    if (v.wrecked || c.vehicle) return;
    if (v.driver && v.driver !== c) {
      const victim = v.driver;
      this.ejectFromVehicle(victim);
      if (victim.role === 'cop') victim.brain = new CopBrain();
      else { victim.role = 'ped'; victim.brain = new PedBrain(pathNear(victim.pos.x, victim.pos.z)); victim.brain.scare(c.pos.x, c.pos.z, 9); }
      victim.knockback.set(victim.pos.x - v.pos.x, 0, victim.pos.z - v.pos.z).setLength(4);
      this.audio.punch(true);
      this.events.emit('carjack', { vehicle: v, thief: c, victim });
    } else if (c === this.player && v.isPolice && !v.playerOwned) {
      this.events.emit('carjack', { vehicle: v, thief: c, victim: null });
    } else if (c === this.player && !v.playerOwned) this.stats.carsStolen++;
    v.controller = null;
    v.driver = c;
    v.isTraffic = false;
    v.parked = false;
    c.vehicle = v;
    c.vel.set(0, 0, 0);
    if (c === this.player) {
      v.persistent = true; v.playerOwned = true;
      this.camCtl.snapBehind(v.yaw);
      this.radio.start();
      this.audio.setMusicLevel(0.38);
      this.events.emit('playerEnteredVehicle', { vehicle: v });
    }
  }

  ejectFromVehicle(c, flung = false) {
    const v = c.vehicle;
    if (!v) return;
    const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw);
    const d = v.radius + 0.75;
    c.pos.set(v.pos.x + lx * d, this.statics.groundHeight(v.pos.x, v.pos.z), v.pos.z + lz * d);
    this.statics.resolveCircle(c.pos, c.radius, 0, 1.8);
    this.statics.clampToWorld(c.pos);
    c.yaw = v.yaw;
    c.vehicle = null;
    if (v.driver === c) v.driver = null;
    if (flung) { c.knockback.set(lx * 6, 0, lz * 6); c.vel.y = 4; c.onGround = false; }
    if (c === this.player) {
      v.persistent = false;
      v.throttle = 0; v.handbrake = true;
      this.radio.stop();
      this.audio.horn(false);
      this.camCtl.snapBehind(v.yaw);
    }
  }
  exitVehicle(c) { this.ejectFromVehicle(c); }

  bailOut(v) {
    const d = v.driver;
    this.ejectFromVehicle(d);
    d.role = 'ped';
    d.brain = new PedBrain(pathNear(d.pos.x, d.pos.z));
    d.brain.scare(this.player.pos.x, this.player.pos.z, 10);
  }

  // ---------- money, messages ----------
  addMoney(n) { this.money = Math.max(0, this.money + n); }
  notify(text) { if (!this.shotMode || this.shotNotify) this.hud.notify(text); }
  hint() { return this.controller.hint || this.services.hintText || this.missions.blocked || ''; }
  fade(sec = 0.5) {
    const f = document.getElementById('fade');
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), sec * 1000);
  }
  mapBlips(full = false) {
    const out = this.missions.blips();
    if (!full) out.push(...this.tokens.blips());
    out.push({ x: LOCATIONS.freshCoat.x, z: LOCATIONS.freshCoat.z, color: '#2ec4b6', size: 6, label: 'P' });
    out.push({ x: RESPAWN.hospital.x, z: RESPAWN.hospital.z, color: '#37d67a', size: 6, label: '+' });
    return out;
  }

  // ---------- death, arrest, respawn ----------
  playerDown(kind) {
    if (this.downT > 0) return;
    this.downKind = kind;
    this.downT = 4.5;
    const p = this.player;
    if (kind === 'arrest') {
      if (p.vehicle) this.ejectFromVehicle(p);
      p.mode = 'cower';
      this.hud.banner('CUFFED', `SVPD booked Rio · -$${COSTS.arrest}`, 'cuffed');
      this.audio.ui('cuffed');
    } else {
      this.hud.banner('FLATLINED', `Sunvale General patched Rio up · -$${COSTS.hospital}`, 'bad');
      this.audio.ui('fail');
    }
    if (this.missions.active) this.missions.fail(kind === 'arrest' ? 'Rio got cuffed' : 'Rio went down', true);
  }
  arrestPlayer() { this.playerDown('arrest'); }

  respawn() {
    const kind = this.downKind;
    const spot = kind === 'arrest' ? RESPAWN.station : RESPAWN.hospital;
    const p = this.player;
    if (p.vehicle) this.ejectFromVehicle(p);
    this.police.clearAll();
    this.wanted.clear();
    this.addMoney(-(kind === 'arrest' ? COSTS.arrest : COSTS.hospital));
    p.alive = true; p.health = p.maxHealth; p.armor = 0; p.fallAngle = 0; p.mode = 'idle';
    p.pos.set(spot.x, this.statics.groundHeight(spot.x, spot.z), spot.z);
    p.vel.set(0, 0, 0); p.knockback.set(0, 0, 0);
    p.yaw = spot.yaw;
    this.camCtl.snapBehind(spot.yaw);
    if (kind === 'arrest') { for (const id of ['hornet', 'breaker']) delete this.arsenal.ammo[id]; this.arsenal.current = 'fists'; }
    this.downKind = null;
    this.fade(0.7);
    this.notify(kind === 'arrest' ? 'Released from SVPD Central. They kept the heavy hardware.' : 'Discharged from Sunvale General.');
  }

  // ---------- states ----------
  newGame() {
    this.resetWorldState();
    this.money = 250;
    this.arsenal.reset();
    this.arsenal.give('kestrel', 36);
    this.arsenal.current = 'fists';
    this.missions.load({ completed: [] });
    this.tokens.load([]);
    this.stats = this.freshStats();
    this.day.setHour(15.6);
    this.placePlayer(START.x, START.z, START.yaw);
    this.enterPlay();
    this.notify('Welcome back to Sunvale. Meet <b>Mari</b> at the pink marker by her taco truck.');
  }

  continueGame() {
    const d = readSave();
    if (!d) return this.newGame();
    this.resetWorldState();
    this.money = d.money ?? 0;
    this.arsenal.load(d.arsenal);
    this.missions.load(d.missions);
    this.tokens.load(d.tokens);
    this.stats = { ...this.freshStats(), ...(d.stats ?? {}) };
    this.day.setHour(d.hour ?? 16);
    this.placePlayer(d.player?.x ?? START.x, d.player?.z ?? START.z, 0);
    this.player.health = d.player?.health ?? 100;
    this.player.armor = d.player?.armor ?? 0;
    this.enterPlay();
    this.notify('Progress loaded.');
  }

  resetWorldState() {
    const p = this.player;
    if (p.vehicle) this.ejectFromVehicle(p);
    if (this.missions.active) this.missions.fail('', true);
    this.police.clearAll();
    this.wanted.clear();
    this.dialogue.clear();
    p.alive = true; p.health = p.maxHealth; p.armor = 0; p.fallAngle = 0;
    this.downT = 0; this.downKind = null;
  }

  placePlayer(x, z, yaw) {
    const p = this.player;
    p.pos.set(x, this.statics.groundHeight(x, z), z);
    p.vel.set(0, 0, 0);
    p.yaw = yaw;
    this.statics.resolveCircle(p.pos, p.radius, 0, 1.8);
    this.camCtl.override = null;
    this.camCtl.snapBehind(yaw);
    this.camCtl.smoothPivot.set(0, 0, 0);
  }

  enterPlay() {
    this.state = 'play';
    this.menus.showTitle(false);
    this.menus.showPause(false);
    this.hud.setVisible(true);
    this.audio.init();
    this.audio.setMusicLevel(0.0);
    this.input.clear();
    this.input.requestLock();
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.menus.showPause(true);
    this.input.releaseLock();
    this.audio.horn(false);
  }
  resume() {
    if (this.state !== 'pause') return;
    this.menus.showPause(false);
    this.state = 'play';
    this.input.clear();
    this.input.requestLock();
  }
  quitToTitle() {
    this.menus.showPause(false);
    this.hud.setVisible(false);
    this.state = 'title';
    this.radio.stop();
    this.menus.showTitle(true);
  }
  saveNow() { return writeSave(this); }
  autosave() { if (!this.shotMode && this.state === 'play') writeSave(this); }

  // ---------- loop ----------
  start() {
    this.menus.showTitle(true);
    this.hud.setVisible(false);
    this.last = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
    };
    requestAnimationFrame(frame);
  }

  tick(dt) {
    if (this.state !== 'pause') {
      this.acc += dt;
      let n = 0;
      while (this.acc >= SIM_DT && n < 5) { this.step(SIM_DT); this.acc -= SIM_DT; n++; if (n === 1) this.input.endFrame(); }
      if (n === 5) this.acc = 0;
    }
    this.render(dt);
  }

  step(dt) {
    const playing = this.state === 'play';
    this.time += dt;
    this.day.advance(dt);
    if (playing) {
      this.stats.playTime += dt;
      if (!this.shotMode) this.controller.update(dt);
    }
    for (const c of this.characters) if (c.brain && c.alive && !c.vehicle && c !== this.player) c.brain.update(c, dt);
    for (const c of this.characters) c.physics(dt);
    for (const v of this.vehicles) v.update(dt);
    resolveVehicleContacts(this);
    resolveCharacterVehicleContacts(this);
    this.traffic.update(dt);
    this.peds.update(dt);
    if (playing) {
      this.police.update(dt);
      this.wanted.update(dt);
      this.missions.update(dt);
      this.tokens.update(dt);
      this.pickups.update(dt);
      this.services.update(dt);
    }
    const p = this.player;
    if (p.vehicle) this.stats.distance += p.vehicle.absSpeed * dt;
    if (p.alive && p.health < 50 && this.time - (p.lastHurt ?? -99) > 7) p.heal(3 * dt);
    if (this.downT > 0) { this.downT -= dt; if (this.downT <= 0) this.respawn(); }
    if (this.fountains.length && rng.chance(0.6)) for (const f of this.fountains) this.fx.fountainSpray(f.x, 2.9, f.z + 0);
    if (p.vehicle && p.vehicle.drift > 5 && p.vehicle.absSpeed > 8 && rng.chance(0.5)) {
      const v = p.vehicle;
      this.fx.skid(v.pos.x - Math.sin(v.yaw) * v.spec.len * 0.4, v.pos.y, v.pos.z - Math.cos(v.yaw) * v.spec.len * 0.4);
    }
  }

  render(dt, draw = true) {
    if (this.state === 'title') this.titleCamera(dt);
    else this.camCtl.override = this.shotCamera ?? null;
    this.camCtl.update(dt, this.state === 'play' ? this.input : null);
    for (const v of this.vehicles) v.sync(dt);
    for (const c of this.characters) c.sync(dt);
    this.fx.update(dt);
    if (Math.abs(this.day.hour - this.envHour) > 0.2) this.refreshEnvironment();
    this.day.apply();
    this.skySea.applyDay(this.day.state, this.day.fog);
    this.skySea.update(dt, this.camera);
    const p = this.player, focus = p.vehicle ? p.vehicle.pos : p.pos;
    this.day.follow(this.state === 'title' ? this.camera.position : focus);
    this.audio.update(dt, this.camera);
    this.radio.update();
    this.dialogue.update(dt);
    if (this.state !== 'title') { this.hud.update(dt); this.minimap.draw(this, dt); }
    if (draw) this.renderer.render(this.scene, this.camera);
  }

  titleCamera(dt) {
    const t = this.time * 0.05;
    const cx = -300, cz = -40;
    this.titleOverride ??= { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 55 };
    this.titleOverride.pos.set(cx - 70 + Math.cos(t) * 30, 26 + Math.sin(t * 0.7) * 4, cz + Math.sin(t) * 90);
    this.titleOverride.look.set(cx + 40, 8, cz + Math.sin(t) * 60);
    this.camCtl.override = this.titleOverride;
    this.player.mesh.visible = false;
  }

  // Builds an environment map from the sky so paint and glass reflect the golden hour.
  refreshEnvironment() {
    this.envHour = this.day.hour;
    this.day.apply();
    this.skySea.applyDay(this.day.state, this.day.fog);
    if (!this.envScene) {
      this.envScene = new THREE.Scene();
      this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.skySea.sky.material));
      this.pmrem = new THREE.PMREMGenerator(this.renderer);
    }
    const old = this.scene.environment;
    this.scene.environment = this.pmrem.fromScene(this.envScene, 0.02).texture;
    if (old) old.dispose();
  }

  onResize() {
    const w = this.shotMode ? 1280 : window.innerWidth, h = this.shotMode ? 720 : window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h * Math.min(window.devicePixelRatio, 1.75), 70);
  }
}
