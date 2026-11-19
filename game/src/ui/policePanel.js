// The SVPD response panel: every unit on the player (callsign, what it is doing, distance),
// the charge, and whether the police can see the player or are searching.

const ICONS = { car: '▲', foot: '●', air: '✈' };
const HOT = new Set(['RAMMING', 'ARRESTING', 'MARKSMAN', 'ENGAGING']);
const WARM = new Set(['PURSUIT', 'SPOTLIGHT', 'CLOSING IN']);
const MAX_ROWS = 5;

export class PolicePanel {
  constructor(root) {
    this.root = root;
    this.count = root.querySelector('#pol-count');
    this.charge = root.querySelector('#pol-charge');
    this.list = root.querySelector('#pol-units');
    this.sight = root.querySelector('#pol-sight');
    this.sightLabel = this.sight.querySelector('span');
    this.sightBar = this.sight.querySelector('b');
    this.refresh = 0;
  }

  update(dt, w, missionShown) {
    const lvl = w.wanted.level;
    this.root.classList.toggle('on', lvl > 0);
    this.root.classList.toggle('top', !missionShown);
    if (lvl === 0) return;
    // the unit list is rebuilt a few times a second, the sight bar every frame
    if ((this.refresh -= dt) <= 0) {
      this.refresh = 0.25;
      const units = w.police.unitReport();
      this.count.textContent = `${units.length} unit${units.length === 1 ? '' : 's'}`;
      this.charge.textContent = w.wanted.charge || 'Wanted';
      const rows = units.slice(0, MAX_ROWS).map((u) => {
        const cls = HOT.has(u.status) ? 'hot' : WARM.has(u.status) ? 'warm' : '';
        return `<li><span class="ic">${ICONS[u.kind]}</span><span>${u.callsign}</span><span class="st ${cls}">${u.status}</span><span class="d">${Math.round(u.dist)} m</span></li>`;
      });
      if (units.length > MAX_ROWS) rows.push(`<li class="more">+${units.length - MAX_ROWS} more units</li>`);
      if (!units.length) rows.push('<li class="more">Units dispatched…</li>');
      this.list.innerHTML = rows.join('');
    }
    const seen = w.wanted.seen;
    this.sight.classList.toggle('lost', !seen);
    this.sightLabel.textContent = seen ? 'IN SIGHT' : 'SEARCHING';
    this.sightBar.style.width = seen ? '100%' : `${Math.round(Math.min(1, w.wanted.evade / w.wanted.evadeNeeded) * 100)}%`;
  }
}
