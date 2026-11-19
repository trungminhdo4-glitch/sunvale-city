// Runs the story: contact markers, starting a job, advancing its steps, timers, rewards, failure and cleanup.
import { MISSIONS, CAST } from './story.js';
import { SCRIPTS } from './missionScripts.js';
import { Marker } from './markers.js';
import { Character } from '../entities/character.js';
import { randomLook } from '../ai/pedestrians.js';
import { GOON_LOOK } from '../ai/hostiles.js';

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.completed = [];
    this.active = null;
    this.steps = [];
    this.index = 0;
    this.timer = null;
    this.cutscene = false;
    this.suppressWanted = false;
    this.spawned = { vehicles: [], characters: [] };
    this.contactMarker = new Marker(game.scene, 0xff5fa2);
    this.objectiveMarker = new Marker(game.scene, 0xffd166);
    this.cooldown = 0;
  }

  get next() { return MISSIONS.find((m) => !this.completed.includes(m.id)) ?? null; }
  get step() { return this.active ? this.steps[this.index] : null; }
  get allDone() { return this.completed.length >= MISSIONS.length; }

  objective() {
    const s = this.step;
    if (s) {
      const text = typeof s.text === 'function' ? s.text() : s.text;
      return { title: `${this.missionNumber(this.active)} · ${this.active.title}`, text, timer: this.timer };
    }
    const n = this.next;
    if (n) return { title: 'Next job', text: `Meet ${CAST[n.giver].name} at the pink marker`, timer: null };
    return null;
  }
  missionNumber(m) { return `Job ${MISSIONS.indexOf(m) + 1}/6`; }

  // Tracking helpers handed to mission scripts.
  spawnVehicle(type, x, z, yaw, color = null) {
    const v = this.game.spawnVehicle(type, x, z, yaw, color);
    v.persistent = true;
    this.spawned.vehicles.push(v);
    return v;
  }
  addDriver(v, role = 'driver') {
    const c = new Character(this.game, { x: v.pos.x, z: v.pos.z, look: role === 'thug' ? GOON_LOOK : randomLook(), role });
    this.game.addCharacter(c);
    c.vehicle = v; v.driver = c;
    this.spawned.characters.push(c);
    return c;
  }
  track(c) { this.spawned.characters.push(c); return c; }

  update(dt) {
    const g = this.game;
    this.contactMarker.update(dt);
    this.objectiveMarker.update(dt);
    this.cooldown -= dt;
    if (!this.active) {
      this.objectiveMarker.hide();
      const n = this.next;
      if (!n) { this.contactMarker.hide(); return; }
      this.contactMarker.show(n.start.x, g.statics.groundHeight(n.start.x, n.start.z), n.start.z);
      const p = g.player, f = p.vehicle ? p.vehicle.pos : p.pos;
      const d = Math.hypot(f.x - n.start.x, f.z - n.start.z);
      if (d < 3.6 && p.alive && this.cooldown <= 0) {
        if (g.wanted.stars > 0) { this.blocked = 'Lose the cops before you meet your contact'; return; }
        if (p.vehicle && p.vehicle.absSpeed > 3) return;
        this.start(n);
      }
      this.blocked = null;
      return;
    }
    this.contactMarker.hide();
    const s = this.step;
    if (this.timer != null) {
      this.timer -= dt;
      if (this.timer <= 0) { this.fail('Out of time'); return; }
    }
    if (s.fail && s.fail()) { this.fail(s.failReason ?? 'Job failed'); return; }
    const mp = s.marker ? s.marker() : null;
    if (mp) this.objectiveMarker.show(mp.x, g.statics.groundHeight(mp.x, mp.z), mp.z);
    else this.objectiveMarker.hide();
    if (s.check(dt)) this.advance();
  }

  start(m) {
    const g = this.game;
    this.active = m;
    this.index = 0;
    this.timer = null;
    this.steps = SCRIPTS[m.id](this);
    g.dialogue.play(m.intro);
    g.notify(`<b>${m.title}</b> — ${m.summary}`);
    g.audio.ui('objective');
    this.steps[0].setup?.();
    g.events.emit('missionStarted', { mission: m });
  }

  advance() {
    this.steps[this.index].cleanup?.();
    this.index++;
    if (this.index >= this.steps.length) { this.complete(); return; }
    this.steps[this.index].setup?.();
    this.game.audio.ui('objective');
  }

  complete() {
    const g = this.game, m = this.active;
    this.completed.push(m.id);
    g.addMoney(m.reward);
    g.hud.banner('JOB DONE', `${m.title}  ·  +$${m.reward.toLocaleString('en-US')}`);
    g.audio.ui('mission');
    g.dialogue.play(m.outro);
    if (m.gift) { g.arsenal.give(m.gift.weapon, m.gift.ammo); g.notify(`Received the <b>${m.gift.weapon === 'hornet' ? 'Hornet SMG' : m.gift.weapon}</b>`); }
    this.release();
    this.active = null; this.timer = null; this.cooldown = 4;
    g.stats.missions = this.completed.length;
    g.events.emit('missionComplete', { mission: m });
    if (this.allDone) setTimeout(() => g.hud.banner('SUNVALE IS YOURS', 'The story is complete — the coast is free to roam. Find every Sun Token!'), 9000);
    g.autosave();
  }

  fail(reason, silent = false) {
    const g = this.game;
    if (!this.active) return;
    if (!silent) { g.hud.banner('JOB FAILED', reason, 'bad'); g.audio.ui('fail'); }
    else g.notify(`Job failed: ${reason}`);
    this.cleanup();
    g.events.emit('missionFailed', { mission: this.active, reason });
    this.active = null; this.timer = null; this.cooldown = 6;
  }

  // After success the spawned cars stay in the world as ordinary traffic; after failure everything goes.
  release() {
    for (const v of this.spawned.vehicles) v.persistent = v === this.game.player.vehicle;
    this.spawned = { vehicles: [], characters: [] };
  }
  cleanup() {
    const g = this.game;
    for (const v of this.spawned.vehicles) if (v !== g.player.vehicle) g.removeVehicle(v);
    for (const c of this.spawned.characters) if (!c.vehicle || c.vehicle !== g.player.vehicle) g.removeCharacter(c);
    this.spawned = { vehicles: [], characters: [] };
  }

  blips() {
    const out = [];
    const g = this.game;
    if (!this.active) {
      const n = this.next;
      if (n) out.push({ x: n.start.x, z: n.start.z, color: '#ff5fa2', size: 8, clamp: true, label: CAST[n.giver].name[0] });
      return out;
    }
    const s = this.step;
    const mp = s.marker ? s.marker() : null;
    if (mp) out.push({ x: mp.x, z: mp.z, color: '#ffd166', size: 7, clamp: true });
    if (s.targets) for (const t of s.targets()) out.push({ x: t.x, z: t.z, color: '#ff4040', size: 6, clamp: true });
    return out;
  }

  toJSON() { return { completed: this.completed }; }
  load(d) { this.completed = (d?.completed ?? []).filter((id) => MISSIONS.some((m) => m.id === id)); }
}
