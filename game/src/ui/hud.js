// The on-screen HUD: money, wanted stars, weapon, health and armour, objective, vehicle and
// radio readout, prompts, district names, dialogue subtitles and big mission banners.

import { formatMoney } from '../core/mathUtil.js';
import { districtAt, DISTRICTS } from '../world/cityLayout.js';

const $ = (id) => document.getElementById(id);
const highlight = (s) => s.replace(/~([^~]+)~/g, '<span class="hl">$1</span>');

export class Hud {
  constructor() {
    this.root = $('hud');
    this.el = {
      money: $('hud-money'), stars: [...document.querySelectorAll('#hud-stars i')], clock: $('hud-clock'),
      wIcon: $('weapon-icon'), wName: $('weapon-name'), wAmmo: $('weapon-ammo'),
      health: $('bar-health').firstElementChild, armor: $('bar-armor').firstElementChild,
      obj: $('hud-objective'), objTitle: document.querySelector('#hud-objective .obj-title'), objText: document.querySelector('#hud-objective .obj-text'), objTimer: document.querySelector('#hud-objective .obj-timer'),
      veh: $('hud-vehicle'), vehName: $('veh-name'), vehSpeed: $('veh-speed'), radio: $('radio-name'),
      prompt: $('hud-prompt'), notify: $('hud-notify'), district: $('hud-district'), sub: $('hud-subtitle'),
      banner: $('hud-banner'), cross: $('crosshair'), vignette: $('vignette'), status: $('status'),
    };
    this.shownMoney = 0;
    this.notifyTime = 0;
    this.bannerTime = 0;
    this.districtTime = 0;
    this.lastDistrict = null;
    this.starFlash = 0;
    this.radioTime = 0;
  }

  show(on) { this.root.hidden = !on; }

  notify(text) {
    this.el.notify.textContent = text;
    this.el.notify.classList.add('on');
    this.notifyTime = 3.5;
    this.el.status.textContent = text;
  }

  banner(title, kind, sub = '') {
    const b = this.el.banner;
    b.className = 'on ' + kind;
    b.querySelector('.title').textContent = title;
    b.querySelector('.sub').textContent = sub;
    this.bannerTime = kind === 'mission' ? 3 : 4.5;
    this.el.status.textContent = `${title} ${sub}`;
  }

  subtitle(name, color, text) {
    const s = this.el.sub;
    if (!name) { s.classList.remove('on'); return; }
    s.innerHTML = `<b style="color:${color}">${name}:</b> ${highlight(text)}`;
    s.classList.add('on');
  }

  flashStars() { this.starFlash = 1.2; }
  showRadio(name) { this.el.radio.textContent = '♪ ' + name; this.radioTime = 3; }

  update(dt, w) {
    const e = this.el, pl = w.player;
    this.shownMoney += (w.state.money - this.shownMoney) * Math.min(1, dt * 6);
    if (Math.abs(w.state.money - this.shownMoney) < 1) this.shownMoney = w.state.money;
    e.money.textContent = formatMoney(this.shownMoney);
    const h = Math.floor(w.stage.hour), m = Math.floor((w.stage.hour % 1) * 60);
    e.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const lvl = w.wanted.level, blink = w.wanted.blinking;
    this.starFlash = Math.max(0, this.starFlash - dt);
    e.stars.forEach((s, i) => {
      s.className = i < lvl ? (blink ? 'on dim' : 'on') : '';
      if (this.starFlash > 0 && i < lvl) s.classList.add('pulse');
    });

    const wp = w.combat.weapon;
    e.wIcon.textContent = wp.icon;
    e.wName.textContent = pl.inCar ? '' : wp.name;
    e.wAmmo.textContent = pl.inCar || wp.id === 'fists' ? '' : String(w.combat.ammo[wp.id]);
    e.health.style.width = `${Math.max(0, pl.health)}%`;
    e.armor.style.width = `${Math.max(0, pl.armor)}%`;
    e.health.parentElement.classList.toggle('low', pl.health < 30);

    const obj = w.missions.objective;
    e.obj.classList.toggle('on', !!obj);
    if (obj) {
      e.objTitle.textContent = obj.title;
      e.objText.innerHTML = highlight(obj.text);
      e.objTimer.textContent = obj.timer != null ? `${Math.floor(obj.timer / 60)}:${String(Math.floor(obj.timer % 60)).padStart(2, '0')}` : '';
    }

    e.veh.classList.toggle('on', pl.inCar);
    if (pl.inCar) {
      e.vehName.textContent = pl.vehicle.spec.name;
      e.vehSpeed.innerHTML = `<b>${Math.round(Math.abs(pl.vehicle.speed) * 3.6)}</b> km/h`;
    }
    this.radioTime -= dt;
    e.radio.style.opacity = this.radioTime > 0 ? 1 : 0.55;

    e.prompt.innerHTML = w.prompt ?? '';
    e.prompt.classList.toggle('on', !!w.prompt);
    e.cross.classList.toggle('on', !pl.inCar && (pl.aiming || w.combat.weapon.id !== 'fists'));
    e.cross.classList.toggle('aim', pl.aiming);
    pl.hurtFlash = Math.max(0, pl.hurtFlash - dt * 1.5);
    e.vignette.style.opacity = Math.max(pl.hurtFlash * 0.8, pl.health < 30 ? 0.35 + Math.sin(w.time * 5) * 0.1 : 0);

    // district name pops up when you cross into a new one
    const d = districtAt(pl.pos.x, pl.pos.z);
    if (d !== this.lastDistrict) {
      this.lastDistrict = d;
      e.district.textContent = DISTRICTS[d].name;
      e.district.classList.add('on');
      this.districtTime = 3.2;
    }
    if ((this.districtTime -= dt) <= 0) e.district.classList.remove('on');
    if ((this.notifyTime -= dt) <= 0) e.notify.classList.remove('on');
    if ((this.bannerTime -= dt) <= 0) e.banner.classList.remove('on');
  }
}
