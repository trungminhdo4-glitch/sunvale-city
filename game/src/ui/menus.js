// Title screen, controls card and pause menu (city map with blips, story list, stats, save, quit).
import { MISSIONS } from '../mission/story.js';
import { MAP, drawMapLabels } from './mapRenderer.js';
import { hasSave } from '../save/saveGame.js';
import { formatMoney } from '../core/mathUtil.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(game) {
    this.game = game;
    this.title = $('title-screen');
    this.pause = $('pause-menu');
    this.controls = $('controls-card');
    this.mapCanvas = $('pause-map');
    const click = (id, fn) => $(id).addEventListener('click', () => { game.audio.init(); game.audio.ui('click'); fn(); });
    click('btn-new', () => game.newGame());
    click('btn-continue', () => game.continueGame());
    click('btn-controls', () => this.controls.classList.remove('hidden'));
    click('btn-controls-close', () => this.controls.classList.add('hidden'));
    click('btn-resume', () => game.resume());
    click('btn-save', () => { const ok = game.saveNow(); $('save-status').textContent = ok ? 'Game saved.' : 'Saving is blocked in this browser.'; });
    click('btn-quit', () => game.quitToTitle());
  }

  showTitle(on) {
    this.title.classList.toggle('hidden', !on);
    $('btn-continue').disabled = !hasSave();
  }

  showPause(on) {
    this.pause.classList.toggle('hidden', !on);
    if (on) { $('save-status').textContent = ''; this.renderPause(); }
  }

  renderPause() {
    const g = this.game;
    const list = $('pause-missions');
    list.innerHTML = '';
    const next = g.missions.next;
    for (const m of MISSIONS) {
      const li = document.createElement('li');
      const done = g.missions.completed.includes(m.id);
      li.className = done ? 'done' : m === next ? 'current' : 'locked';
      li.textContent = m.title;
      list.appendChild(li);
    }
    const s = g.stats;
    const mins = Math.floor(s.playTime / 60);
    const rows = [
      ['Money', formatMoney(g.money)], ['Story', `${g.missions.completed.length} / ${MISSIONS.length} jobs`],
      ['Sun Tokens', `${g.tokens.count} / ${g.tokens.total}`], ['Cars stolen', s.carsStolen], ['Distance driven', `${(s.distance / 1000).toFixed(1)} km`],
      ['Takedowns', s.kills], ['Highest heat', '★'.repeat(s.maxWanted) || '—'], ['Time on the coast', `${Math.floor(mins / 60)}h ${mins % 60}m`],
    ];
    $('pause-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    this.drawMap();
  }

  drawMap() {
    const g = this.game, c = this.mapCanvas, ctx = c.getContext('2d');
    const W = c.width, scale = W / MAP.size;
    ctx.clearRect(0, 0, W, W);
    ctx.drawImage(g.mapImage, 0, 0, W, W);
    drawMapLabels(ctx, scale, 0, 0);
    const P = (x, z) => [(x - MAP.x0) * scale, (z - MAP.z0) * scale];
    const dot = (x, z, col, r = 6, label = '') => {
      const [sx, sy] = P(x, z);
      ctx.fillStyle = col; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (label) { ctx.fillStyle = '#111'; ctx.font = '900 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, sx, sy + 0.5); }
    };
    for (const b of g.mapBlips(true)) dot(b.x, b.z, b.color, (b.size ?? 6) * 0.9, b.label ?? '');
    for (const v of g.vehicles) if (v.isPolice && v.controller) dot(v.pos.x, v.pos.z, '#3b6bff', 4);
    const p = g.player, f = p.vehicle ? p.vehicle.pos : p.pos;
    const [px, py] = P(f.x, f.z);
    const yaw = p.vehicle ? p.vehicle.yaw : p.yaw;
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(Math.cos(yaw), Math.sin(yaw)) + Math.PI / 2);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(10,8,20,.75)'; ctx.fillRect(10, W - 92, 196, 82);
    ctx.font = '700 13px Trebuchet MS'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    [['#ff5fa2', 'Contact'], ['#ffd166', 'Objective'], ['#2ec4b6', 'Fresh Coat'], ['#37d67a', 'Hospital']].forEach(([c2, t], i) => {
      ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(26, W - 78 + i * 18, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff7ec'; ctx.fillText(t, 38, W - 78 + i * 18);
    });
  }
}
