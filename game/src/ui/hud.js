// The on-screen HUD: mission card with stages, SVPD response panel, stars, money and rank,
// weapon bar, district and street, radar, health and armour, vehicle panel with radio,
// dialogue box with portraits, prompts and big mission banners.

import { formatMoney } from '../core/mathUtil.js';
import { districtAt, DISTRICTS } from '../world/cityLayout.js';
import { streetAt } from '../world/streetNames.js';
import { WEAPONS } from '../data/weapons.js';
import { CHARACTERS } from '../data/story.js';
import { PolicePanel } from './policePanel.js';
import { portraitFor } from './portraits.js';
import { WEAPON_ICONS } from './weaponIcons.js';

const $ = (id) => document.getElementById(id);
const highlight = (s) => s.replace(/~([^~]+)~/g, '<span class="hl">$1</span>');
const VEHICLE_CLASS = {
  pico: 'Compact · 2 door', cortessa: 'Sedan · 4 door', mirage: 'Sports · rear drive', brute: 'Muscle · V8',
  ridgeback: 'Pickup · 4x4', pelican: 'Van · cargo', sunnycab: 'Taxi · Sunny Cab Co.', cruiser: 'Police · Interceptor',
};

export class Hud {
  constructor() {
    this.root = $('hud');
    this.el = {
      money: $('hud-money'), stars: [...document.querySelectorAll('#hud-stars i')], clock: $('hud-clock'),
      rankName: $('rank-name'), rankRp: $('rank-rp'), rankBar: document.querySelector('#hud-rank > i b'), rp: $('hud-rp'),
      weapons: $('hud-weapons'),
      health: document.querySelector('#bar-health b'), healthNum: document.querySelector('#bar-health em'),
      armor: document.querySelector('#bar-armor b'), armorNum: document.querySelector('#bar-armor em'),
      mission: $('hud-mission'), misNum: $('mis-num'), misGiver: $('mis-giver'), misTitle: $('mis-title'),
      misStage: document.querySelector('#mis-stage b'), misSegs: document.querySelector('#mis-stage .segs'),
      misText: $('mis-text'), misNext: $('mis-next'), misTimer: $('mis-timer'),
      veh: $('hud-vehicle'), vehName: $('veh-name'), vehClass: $('veh-class'), vehSpeed: document.querySelector('#veh-speed b'),
      vehCond: $('veh-cond'), vehCondBar: document.querySelector('#veh-cond b'), vehCondNum: document.querySelector('#veh-cond em'), radio: $('radio-name'),
      placeDistrict: $('place-district'), placeStreet: $('place-street'),
      dialog: $('hud-dialog'), dlgFace: $('dlg-face'), dlgName: $('dlg-name'), dlgRole: $('dlg-role'), dlgText: $('dlg-text'),
      prompt: $('hud-prompt'), notify: $('hud-notify'), district: $('hud-district'),
      banner: $('hud-banner'), cross: $('crosshair'), vignette: $('vignette'), status: $('status'),
    };
    this.police = new PolicePanel($('hud-police'));
    this.buildWeaponBar();
    this.shownMoney = 0;
    this.notifyTime = 0;
    this.bannerTime = 0;
    this.districtTime = 0;
    this.lastDistrict = null;
    this.starFlash = 0;
    this.radioTime = 0;
    this.sayTime = 0;
    this.sayOwner = null;   // 'story' | 'radio' | null
    this.segKey = '';
  }

  show(on) { this.root.hidden = !on; }

  buildWeaponBar() {
    this.el.weapons.innerHTML = WEAPONS.map((wp, k) =>
      `<div class="slot" data-id="${wp.id}"><span class="k">${k + 1}</span><span class="ic">${WEAPON_ICONS[wp.id] ?? wp.icon}</span><span class="n">${wp.name.split(' ')[0]}</span><span class="a"></span></div>`).join('');
    this.slots = [...this.el.weapons.children];
  }

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

  /** May this speaker take the dialogue box? Story lines always win over the police radio. */
  canSay(owner) { return owner === 'story' || this.sayOwner !== 'story' || this.sayTime <= 0; }

  /** Show a line in the dialogue box: who (a CHARACTERS key), the text and how long. */
  say(who, text, time, owner = 'story') {
    if (!this.canSay(owner)) return false;
    const c = CHARACTERS[who], e = this.el;
    e.dlgFace.src = portraitFor(who);
    e.dlgName.textContent = c.name;
    e.dlgName.style.color = c.color;
    e.dlgRole.textContent = c.role;
    e.dlgText.innerHTML = highlight(text);
    e.dialog.classList.add('on');
    e.dialog.classList.toggle('radio', owner === 'radio');
    e.status.textContent = `${c.name}: ${text.replace(/~/g, '')}`;
    this.sayTime = time;
    this.sayOwner = owner;
    return true;
  }

  flashStars() { this.starFlash = 1.2; }
  showRadio() { this.radioTime = 3; }

  updateStatus(dt, w) {
    const e = this.el;
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
    const pr = w.progress;
    e.rankName.textContent = `R${pr.rank + 1} · ${pr.rankName}`;
    e.rankRp.textContent = pr.nextAt == null ? `${pr.rp.toLocaleString('en-US')} RP` : `${pr.rp.toLocaleString('en-US')}/${pr.nextAt.toLocaleString('en-US')} RP`;
    e.rankBar.style.width = `${Math.round(pr.rankProgress * 100)}%`;
    e.rp.classList.toggle('on', !!pr.popup);
    if (pr.popup) e.rp.textContent = pr.popup.text;
  }

  updateWeapons(w) {
    const c = w.combat, pl = w.player;
    this.el.weapons.classList.toggle('driving', pl.inCar);
    this.slots.forEach((s, k) => {
      const wp = WEAPONS[k], owned = c.owns(wp.id);
      s.classList.toggle('on', k === c.current);
      s.classList.toggle('locked', !owned);
      s.lastElementChild.textContent = !owned ? '—' : wp.id === 'fists' ? '∞' : String(c.ammo[wp.id]);
    });
    const pa = w.progress?.armorCap ?? 100;
    this.el.health.style.width = `${Math.max(0, pl.health)}%`;
    this.el.healthNum.textContent = Math.max(0, Math.round(pl.health));
    this.el.armor.style.width = `${Math.max(0, pl.armor) / pa * 100}%`;
    this.el.armorNum.textContent = Math.max(0, Math.round(pl.armor));
    this.el.health.parentElement.parentElement.classList.toggle('low', pl.health < 30);
  }

  updateMission(w) {
    const e = this.el, obj = w.missions.objective;
    e.mission.classList.toggle('on', !!obj);
    if (!obj) return false;
    e.misNum.textContent = `Mission ${obj.number}/${obj.total}`;
    e.misGiver.textContent = obj.giver;
    e.misTitle.textContent = obj.title;
    e.mission.classList.toggle('idle', !!obj.idle);
    e.misStage.textContent = obj.idle ? 'NEXT JOB' : `STAGE ${obj.stage}/${obj.stages}`;
    const key = `${obj.stage}/${obj.stages}`;
    if (key !== this.segKey) {
      this.segKey = key;
      e.misSegs.innerHTML = Array.from({ length: obj.stages }, () => '<i><b></b></i>').join('');
    }
    [...e.misSegs.children].forEach((seg, k) => {
      const f = k < obj.stage - 1 ? 1 : k === obj.stage - 1 ? obj.stepProgress : 0;
      seg.firstElementChild.style.width = `${Math.round(f * 100)}%`;
    });
    e.misText.innerHTML = highlight(obj.text);
    e.misNext.textContent = obj.next;
    e.misTimer.textContent = obj.timer != null ? `${Math.floor(obj.timer / 60)}:${String(Math.floor(obj.timer % 60)).padStart(2, '0')}` : '';
    return true;
  }

  updateVehicle(dt, w) {
    const e = this.el, pl = w.player;
    e.veh.classList.toggle('on', pl.inCar);
    if (!pl.inCar) return;
    const v = pl.vehicle, cond = Math.max(0, v.health / v.spec.health);
    e.vehName.textContent = v.spec.name;
    e.vehClass.textContent = VEHICLE_CLASS[v.type] ?? '';
    e.vehSpeed.textContent = Math.round(Math.abs(v.speed) * 3.6);
    e.vehCondBar.style.width = `${Math.round(cond * 100)}%`;
    e.vehCondNum.textContent = `${Math.round(cond * 100)}%`;
    e.vehCond.classList.toggle('bad', cond < 0.4);
    const r = w.radio;
    e.radio.innerHTML = r.track ? `♪ ${r.name}<small>${r.track}</small>` : '♪ Radio off';
    this.radioTime -= dt;
    e.radio.style.opacity = this.radioTime > 0 ? 1 : 0.8;
  }

  updatePlace(dt, pl) {
    const e = this.el, d = districtAt(pl.pos.x, pl.pos.z);
    e.placeDistrict.textContent = DISTRICTS[d].name;
    e.placeStreet.textContent = streetAt(pl.pos.x, pl.pos.z);
    // the big district name pops up when you cross into a new one
    if (d !== this.lastDistrict) {
      this.lastDistrict = d;
      e.district.textContent = DISTRICTS[d].name;
      e.district.classList.add('on');
      this.districtTime = 3.2;
    }
    if ((this.districtTime -= dt) <= 0) e.district.classList.remove('on');
  }

  update(dt, w) {
    const e = this.el, pl = w.player;
    this.updateStatus(dt, w);
    this.updateWeapons(w);
    const missionShown = this.updateMission(w);
    this.police.update(dt, w, missionShown);
    this.updateVehicle(dt, w);
    this.updatePlace(dt, pl);

    e.prompt.innerHTML = w.prompt ?? '';
    e.prompt.classList.toggle('on', !!w.prompt);
    e.cross.classList.toggle('on', !pl.inCar && (pl.aiming || w.combat.weapon.id !== 'fists'));
    e.cross.classList.toggle('aim', pl.aiming);
    pl.hurtFlash = Math.max(0, pl.hurtFlash - dt * 1.5);
    e.vignette.style.opacity = Math.max(pl.hurtFlash * 0.8, pl.health < 30 ? 0.35 + Math.sin(w.time * 5) * 0.1 : 0);

    if ((this.sayTime -= dt) <= 0 && this.sayOwner) { this.sayOwner = null; e.dialog.classList.remove('on'); }
    if ((this.notifyTime -= dt) <= 0) e.notify.classList.remove('on');
    if ((this.bannerTime -= dt) <= 0) e.banner.classList.remove('on');
  }
}
