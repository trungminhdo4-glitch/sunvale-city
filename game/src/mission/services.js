// City services: the Fresh Coat paint shop wipes the wanted level for a fee and gives the car a new colour.
import { LOCATIONS } from '../world/cityLayout.js';
import { COSTS } from '../core/config.js';
import { rng } from '../core/rng.js';

const PAINTS = ['#e2231a', '#2ec4b6', '#ffd166', '#5aa9e6', '#f78fb3', '#1b998b', '#ffffff', '#111111', '#ff9f1c', '#8338ec'];

export class Services {
  constructor(game) { this.game = game; this.cooldown = 0; this.hintText = ''; }

  update(dt) {
    const g = this.game, p = g.player, v = p.vehicle;
    this.cooldown -= dt;
    this.hintText = '';
    const s = LOCATIONS.freshCoat;
    const f = v ? v.pos : p.pos;
    const d = Math.hypot(f.x - s.x, f.z - s.z);
    if (d > 9) return;
    if (!v) { this.hintText = 'Fresh Coat Paint & Body: drive in with a car to respray it and lose the heat'; return; }
    if (g.wanted.stars === 0) { this.hintText = 'Fresh Coat: come back when the cops are after you'; return; }
    if (g.money < COSTS.paint) { this.hintText = `Fresh Coat: a respray costs $${COSTS.paint}`; return; }
    if (this.cooldown > 0 || v.absSpeed > 4) { this.hintText = 'Fresh Coat: slow down and roll in'; return; }
    this.cooldown = 8;
    g.addMoney(-COSTS.paint);
    v.setColor(rng.pick(PAINTS.filter((c) => c !== v.color)));
    g.wanted.clear();
    g.police.helis.forEach((h) => { h.leaving = true; });
    g.audio.ui('money');
    g.fade(0.6);
    g.notify(`Fresh Coat resprayed your ${v.spec.name}. Heat gone. -$${COSTS.paint}`);
  }
}
