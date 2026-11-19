// Heat and stars: crimes with witnesses raise the wanted level; staying out of police sight long enough clears it.
import { HEAT_FOR_STARS, EVADE_SECONDS, SPOT_RADIUS } from '../core/config.js';

export const CRIMES = {
  gunfire: { heat: 0.4, min: 1, witness: true },
  assault: { heat: 0.5, min: 1, witness: true },
  murder: { heat: 1.6, min: 2, witness: true },
  carjack: { heat: 0.9, min: 1, witness: true },
  hitPedestrian: { heat: 0.6, min: 1, witness: true },
  copAssault: { heat: 1.4, min: 2 },
  copKill: { heat: 2.4, min: 3 },
  copCarTheft: { heat: 1.2, min: 2 },
  explosion: { heat: 1.2, min: 2, witness: true },
  heliDown: { heat: 4, min: 4 },
};

export class WantedSystem {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.stars = 0;
    this.evade = 0;
    this.seen = false;
    this.maxStars = 0;
    this.lastCrime = '';
    const ev = game.events;
    ev.on('gunfire', (e) => { if (e.shooter === game.player) this.report('gunfire', e.x, e.z); });
    ev.on('assault', (e) => { if (e.attacker === game.player) this.report('assault', e.x, e.z); });
    ev.on('carjack', (e) => { if (e.thief === game.player) this.report(e.vehicle.isPolice ? 'copCarTheft' : 'carjack', e.vehicle.pos.x, e.vehicle.pos.z); });
    ev.on('characterKilled', (e) => {
      if (e.from !== game.player && !(e.from && e.from === game.player.vehicle?.driver)) return;
      const v = e.victim;
      if (v.role === 'cop') this.report('copKill', v.pos.x, v.pos.z);
      else if (v.role !== 'thug') this.report('murder', v.pos.x, v.pos.z);
    });
    ev.on('characterHurt', (e) => {
      if (e.from !== game.player || !e.victim.alive) return;
      if (e.victim.role === 'cop') this.report('copAssault', e.victim.pos.x, e.victim.pos.z);
    });
    ev.on('pedestrianHit', (e) => { if (e.vehicle.driver === game.player && e.victim.role !== 'thug') this.report(e.victim.role === 'cop' ? 'copAssault' : 'hitPedestrian', e.victim.pos.x, e.victim.pos.z); });
    ev.on('vehicleDestroyed', (e) => { if (e.from === game.player) this.report('explosion', e.vehicle.pos.x, e.vehicle.pos.z); });
  }

  hasWitness(x, z) {
    for (const c of this.game.characters) {
      if (c === this.game.player || !c.alive || c.role === 'thug') continue;
      if (Math.abs(c.pos.x - x) < 40 && Math.abs(c.pos.z - z) < 40) return true;
    }
    return this.game.police.canSee(x, z, SPOT_RADIUS[Math.max(1, this.stars)]);
  }

  report(crime, x, z) {
    if (this.game.missions.suppressWanted) return;
    const c = CRIMES[crime];
    if (!c) return;
    if (c.witness && !this.hasWitness(x, z)) return;
    this.heat = Math.max(this.heat + c.heat, HEAT_FOR_STARS[c.min]);
    this.lastCrime = crime;
    this.recompute();
    this.evade = 0;
  }

  recompute() {
    let s = 0;
    for (let k = 1; k <= 5; k++) if (this.heat >= HEAT_FOR_STARS[k]) s = k;
    if (s > this.stars) this.game.audio?.ui('wanted');
    this.stars = s;
    this.maxStars = Math.max(this.maxStars, s);
    if (s > (this.game.stats.maxWanted ?? 0)) this.game.stats.maxWanted = s;
  }

  setStars(n) { this.heat = HEAT_FOR_STARS[n]; this.recompute(); this.evade = 0; }
  clear() { this.heat = 0; this.stars = 0; this.evade = 0; this.seen = false; }

  get evading() { return this.stars > 0 && !this.seen; }
  get evadeProgress() { return this.stars ? Math.min(1, this.evade / EVADE_SECONDS[this.stars]) : 0; }

  update(dt) {
    if (this.stars === 0) { this.seen = false; return; }
    const p = this.game.player;
    const pos = p.vehicle ? p.vehicle.pos : p.pos;
    this.seen = this.game.police.canSee(pos.x, pos.z, SPOT_RADIUS[this.stars], true);
    if (this.seen) this.evade = 0;
    else {
      this.evade += dt;
      if (this.evade > EVADE_SECONDS[this.stars]) {
        this.clear();
        this.game.notify('You slipped the heat. Wanted level cleared.');
        this.game.events.emit('wantedCleared', {});
      }
    }
  }
}
