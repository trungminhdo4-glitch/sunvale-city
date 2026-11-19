// SVPD dispatch chatter: the police radio calls out the chase as it happens (new stars, the
// suspect's car and street, the helicopter joining, lost visual, code 4). Story dialogue always
// has the floor; the radio only speaks between lines.

import { streetAt, headingWord } from '../world/streetNames.js';
import { DISTRICTS, districtAt } from '../world/cityLayout.js';

export class DispatchRadio {
  constructor(world) {
    this.world = world;
    this.level = 0;
    this.heli = false;
    this.seen = true;
    this.cooldown = 0;
    this.queue = [];
  }

  suspect() {
    const pl = this.world.player;
    const where = streetAt(pl.pos.x, pl.pos.z);
    if (pl.inCar) {
      const v = pl.vehicle;
      return `suspect in a ${v.spec.name}, ${Math.abs(v.speed) > 4 ? headingWord(v.heading) + ' on' : 'stopped on'} ${where}`;
    }
    return `suspect on foot near ${where}`;
  }

  lineForLevel(lvl) {
    const w = this.world, pl = w.player, d = DISTRICTS[districtAt(pl.pos.x, pl.pos.z)].name;
    const unit = w.police.cars.find((c) => !c.dead)?.callsign ?? 'All units';
    switch (lvl) {
      case 1: return `Units in ${d}, ${(w.wanted.charge || 'a disturbance').toLowerCase()} reported, ${this.suspect()}.`;
      case 2: return `${unit}, you are cleared to pursue. ${this.suspect()[0].toUpperCase()}${this.suspect().slice(1)}.`;
      case 3: return `All units, ${this.suspect()}. Gull One, get airborne.`;
      case 4: return `Suspect is armed and dangerous. Lethal force authorised. Roadblocks on ${streetAt(pl.pos.x, pl.pos.z)}.`;
      default: return `Every unit in Sunvale, converge on ${d}. Do not let this one reach the water.`;
    }
  }

  push(text) { this.queue.push(text); }

  update(dt) {
    const w = this.world, wanted = w.wanted;
    this.cooldown -= dt;
    if (wanted.level > this.level) this.push(this.lineForLevel(wanted.level));
    if (wanted.level === 0 && this.level > 0) { this.queue = []; this.push('Code 4. We lost the suspect. All units resume patrol.'); }
    this.level = wanted.level;
    const heli = w.police.heli.active && wanted.level >= 3;
    if (heli && !this.heli) this.push(`Gull One on scene, light is on the ${w.player.inCar ? 'vehicle' : 'suspect'}.`);
    this.heli = heli;
    if (wanted.level > 0 && this.seen && !wanted.seen && wanted.evade > 2) { this.push(`Lost visual near ${streetAt(wanted.lastSeen.x, wanted.lastSeen.z)}. Units, search the area.`); this.seen = false; }
    if (wanted.seen) this.seen = true;
    if (this.queue.length && this.cooldown <= 0 && w.hud.canSay('radio')) {
      const text = this.queue.shift();
      const time = 2.4 + text.length * 0.04;
      w.hud.say('dispatch', text, time, 'radio');
      w.audio?.radioBlip?.();
      this.cooldown = time + 0.6;
    }
  }
}
