// Title screen and pause menu (map, story log, stats, controls, save) wired to DOM buttons.

import { MISSIONS, CHARACTERS } from '../data/story.js';
import { formatMoney } from '../core/mathUtil.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(handlers) {
    this.h = handlers;
    this.title = $('title-screen');
    this.pause = $('pause-menu');
    this.tab = 'map';
    $('btn-new').onclick = () => handlers.newGame();
    $('btn-continue').onclick = () => handlers.continueGame();
    $('btn-controls').onclick = () => $('title-controls').classList.toggle('on');
    $('btn-resume').onclick = () => handlers.resume();
    $('btn-save').onclick = () => handlers.save();
    $('btn-quit').onclick = () => handlers.quit();
    for (const b of document.querySelectorAll('#pause-tabs button')) b.onclick = () => this.showTab(b.dataset.tab);
  }

  showTitle(hasSave) {
    this.title.hidden = false;
    this.pause.hidden = true;
    $('btn-continue').disabled = !hasSave;
  }

  hideTitle() { this.title.hidden = true; }

  openPause(world) {
    this.world = world;
    this.pause.hidden = false;
    this.showTab(this.tab);
  }

  closePause() { this.pause.hidden = true; }
  get paused() { return !this.pause.hidden; }

  showTab(tab) {
    this.tab = tab;
    for (const b of document.querySelectorAll('#pause-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    for (const p of document.querySelectorAll('.pause-page')) p.hidden = p.id !== 'page-' + tab;
    const w = this.world;
    if (!w) return;
    if (tab === 'map') { w.minimap.drawFull($('full-map'), w); this.renderAside(w); }
    if (tab === 'story') this.renderStory(w);
    if (tab === 'stats') this.renderStats(w);
  }

  /** Progress card beside the map: story %, next contact, collectibles. */
  renderAside(w) {
    const next = w.missions.next;
    const pct = Math.round(w.missions.progress * 100);
    const steps = MISSIONS.map((m) => `<li class="${w.missions.completed.has(m.id) ? 'done' : m === next ? 'next' : ''}">${m.title}</li>`).join('');
    $('map-aside').innerHTML = `
      <div class="pct"><b>${pct}%</b><span>Story</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${next ? `<p class="next-up">Next: <b>${next.title}</b><br><span style="color:${CHARACTERS[next.giver].color}">${CHARACTERS[next.giver].name}</span> at ${w.plan.places[next.place].label}</p>` : ''}
      <ol>${steps}</ol>
      <p class="tokens">☀ Sun Tokens ${w.pickups.tokenCount}/${w.pickups.tokenTotal}</p>
      <p class="money">${formatMoney(w.state.money)}</p>`;
  }

  renderStory(w) {
    const list = $('story-list');
    list.innerHTML = '';
    for (const m of MISSIONS) {
      const li = document.createElement('li');
      const done = w.missions.completed.has(m.id), next = w.missions.next === m;
      li.className = done ? 'done' : next ? 'next' : 'locked';
      const giver = CHARACTERS[m.giver];
      li.innerHTML = `<b>${done ? '✔' : next ? '▶' : '·'} ${m.title}</b><span style="color:${giver.color}">${giver.name}</span><em>${done ? formatMoney(m.reward) : next ? 'Meet at ' + w.plan.places[m.place].label : 'Locked'}</em>`;
      list.appendChild(li);
    }
  }

  renderStats(w) {
    const s = w.state;
    const rows = [
      ['Story progress', `${Math.round(w.missions.progress * 100)}%`],
      ['Money', formatMoney(s.money)],
      ['Sun Tokens', `${w.pickups.tokenCount} / ${w.pickups.tokenTotal}`],
      ['Cars stolen', s.stats.carsStolen],
      ['Distance driven', `${(s.stats.driven / 1000).toFixed(1)} km`],
      ['Highest wanted level', '★'.repeat(s.stats.maxWanted) || '-'],
      ['Police escapes', s.stats.escapes],
      ['Weapons', Object.keys(w.combat.ammo).length + ' / 4'],
    ];
    $('stats-table').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  }
}
