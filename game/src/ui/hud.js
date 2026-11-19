// The on-screen HUD: money, clock, wanted stars, weapon and ammo, health and armor, mission objective and timer,
// location, speedometer and radio, crosshair, hit marker, notifications and the big result banners.
import { formatMoney, formatClock } from '../core/mathUtil.js';
import { placeName, streetName } from '../world/cityLayout.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of ['hud', 'hud-clock', 'hud-money', 'wanted-stars', 'weapon-name', 'weapon-ammo', 'mission-panel', 'mission-title', 'mission-objective',
      'mission-timer', 'hud-hint', 'notify-stack', 'health-fill', 'armor-fill', 'district-name', 'street-name', 'vehicle-panel', 'vehicle-name',
      'speed-value', 'radio-name', 'crosshair', 'hit-marker', 'arrest-bar', 'arrest-fill', 'banner', 'banner-title', 'banner-sub', 'damage-vignette'])
      this.el[id] = $(id);
    this.el['wanted-stars'].innerHTML = '<span class="star">★</span>'.repeat(5);
    this.stars = [...this.el['wanted-stars'].children];
    this.cache = {};
    this.bannerT = 0;
    this.hitT = 0;
    this.hurtT = 0;
    this.radioT = 0;
    this.money = 0;
    game.events.on('playerHit', () => { this.hitT = 0.15; });
    game.events.on('characterHurt', (e) => { if (e.victim === game.player) this.hurtT = 0.5; });
    game.events.on('radioChanged', () => { this.radioT = 3.5; });
  }

  set(id, text, html = false) {
    if (this.cache[id] === text) return;
    this.cache[id] = text;
    if (html) this.el[id].innerHTML = text; else this.el[id].textContent = text;
  }
  show(id, on) { this.el[id].classList.toggle('hidden', !on); }

  setVisible(on) { this.show('hud', on); }

  notify(text) {
    const n = document.createElement('div');
    n.className = 'notify';
    n.innerHTML = text;
    this.el['notify-stack'].appendChild(n);
    setTimeout(() => n.remove(), 4200);
    while (this.el['notify-stack'].children.length > 4) this.el['notify-stack'].firstChild.remove();
  }

  banner(title, sub = '', kind = '') {
    this.set('banner-title', title); this.set('banner-sub', sub);
    this.el['banner-title'].className = kind;
    this.show('banner', false);
    void this.el.banner.offsetWidth;
    this.show('banner', true);
    this.bannerT = 4.2;
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.money += (g.money - this.money) * Math.min(1, dt * 6);
    if (Math.abs(g.money - this.money) < 1) this.money = g.money;
    this.set('hud-money', formatMoney(this.money));
    this.set('hud-clock', formatClock(g.day.hour));
    const stars = g.wanted.stars;
    this.stars.forEach((s, i) => s.classList.toggle('on', i < stars));
    this.el['wanted-stars'].classList.toggle('evading', g.wanted.evading);
    const w = g.arsenal.weapon;
    this.set('weapon-name', w.name);
    this.set('weapon-ammo', w.melee ? '' : String(g.arsenal.count));
    this.el['health-fill'].style.width = `${Math.max(0, p.health / p.maxHealth) * 100}%`;
    this.el['armor-fill'].style.width = `${Math.max(0, p.armor)}%`;

    const focus = p.vehicle ? p.vehicle.pos : p.pos;
    this.set('district-name', placeName(focus.x, focus.z));
    this.set('street-name', streetName(focus.x, focus.z));

    const v = p.vehicle;
    this.show('vehicle-panel', !!v);
    if (v) {
      this.set('vehicle-name', v.spec.name);
      this.set('speed-value', String(Math.round(Math.abs(v.speed) * 3.6)));
      this.radioT -= dt;
      this.set('radio-name', g.radio.station.off ? '' : `♪ ${g.radio.station.name}`);
    }

    const m = g.missions;
    const obj = m.objective();
    this.show('mission-panel', !!obj);
    if (obj) {
      this.set('mission-title', obj.title);
      this.set('mission-objective', obj.text);
      this.show('mission-timer', obj.timer != null);
      if (obj.timer != null) {
        const t = Math.max(0, obj.timer);
        this.set('mission-timer', `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
        this.el['mission-timer'].classList.toggle('low', t < 20);
      }
    }
    const hint = g.hint();
    this.show('hud-hint', !!hint);
    if (hint) this.set('hud-hint', hint, true);

    this.show('crosshair', g.camCtl.aiming && !p.vehicle);
    this.hitT -= dt;
    this.show('hit-marker', this.hitT > 0);
    const arrest = g.police.arrest;
    this.show('arrest-bar', arrest > 0.05);
    if (arrest > 0.05) this.el['arrest-fill'].style.width = `${Math.min(100, arrest / 1.9 * 100)}%`;
    this.hurtT -= dt;
    const low = p.alive && p.health < 35 ? 0.5 + Math.sin(performance.now() / 200) * 0.2 : 0;
    this.el['damage-vignette'].style.opacity = String(Math.max(low, this.hurtT > 0 ? this.hurtT * 1.4 : 0));
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.show('banner', false); }
  }
}
