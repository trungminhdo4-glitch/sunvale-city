// The wanted level: crimes add heat, heat sets stars 1-5, and staying out of sight of
// every officer and the helicopter long enough clears them.

import { POLICE } from '../core/config.js';
import { rng } from '../core/rng.js';

const THRESHOLDS = [0, 1, 7, 16, 30, 48];
const CRIMES = {
  carjack: { heat: 2, witness: 0.55 },
  steal: { heat: 1, witness: 0.25 },
  shooting: { heat: 1.2, witness: 0.7 },
  assault: { heat: 1.5, witness: 0.6 },
  killCiv: { heat: 4, witness: 0.85 },
  hitCop: { heat: 3, witness: 1 },
  killCop: { heat: 9, witness: 1 },
  wreck: { heat: 2, witness: 0.5 },
  copCar: { heat: 6, witness: 1 },
};

export class WantedSystem {
  constructor(world) {
    this.world = world;
    this.heat = 0;
    this.level = 0;
    this.evade = 0;        // seconds unseen
    this.seen = false;
    this.lastSeen = { x: 0, z: 0 };
    this.flash = 0;
    this.locked = false;   // missions can hold a minimum level
    this.minLevel = 0;
  }

  get evadeNeeded() { return POLICE.evadeBase + POLICE.evadePerStar * this.level; }

  report(crime, x, z) {
    const c = CRIMES[crime];
    if (!c) return;
    const copNear = this.world.police.officerNear(x, z, 55);
    if (!copNear && this.level === 0 && !rng.chance(c.witness)) return;
    this.heat += c.heat;
    const before = this.level;
    this.setLevel(Math.max(this.level, this.levelFor(this.heat)));
    if (this.level > before) { this.world.hud?.flashStars(); this.world.audio?.wantedUp(); }
    this.evade = 0;
    this.lastSeen = { x, z };
  }

  levelFor(heat) {
    let l = 0;
    for (let k = 1; k < THRESHOLDS.length; k++) if (heat >= THRESHOLDS[k]) l = k;
    return l;
  }

  setLevel(l) {
    this.level = Math.max(this.minLevel, Math.min(5, l));
    if (this.heat < THRESHOLDS[this.level]) this.heat = THRESHOLDS[this.level];
    if (this.level === 0) this.heat = 0;
  }

  clear() { this.heat = 0; this.level = 0; this.evade = 0; this.minLevel = 0; }

  update(dt) {
    this.flash += dt;
    if (this.level === 0) { this.seen = false; return; }
    const p = this.world.player.pos;
    this.seen = this.world.police.canSeePlayer();
    if (this.seen) { this.evade = 0; this.lastSeen = { x: p.x, z: p.z }; }
    else {
      this.evade += dt;
      if (this.evade >= this.evadeNeeded && this.minLevel === 0) {
        this.clear();
        this.world.hud?.notify('You lost the police.');
        this.world.onWantedCleared?.();
      }
    }
  }

  /** Stars blink while the player is out of sight. */
  get blinking() { return this.level > 0 && !this.seen && Math.floor(this.flash * 3) % 2 === 0; }
}
