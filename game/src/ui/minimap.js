// Radar minimap (rotates with the camera) and the full city map for the pause menu,
// both drawn from one pre-rendered top-down image of the plan.

import { CITY, lineCoord } from '../core/config.js';
import { DISTRICTS } from '../world/cityLayout.js';

const MAP_MIN_X = -340, MAP_MIN_Z = -340, MAP_W = 760, MAP_H = 840;

function renderPlan(plan) {
  const c = document.createElement('canvas');
  c.width = MAP_W; c.height = MAP_H;
  const g = c.getContext('2d');
  const X = (x) => x - MAP_MIN_X, Z = (z) => z - MAP_MIN_Z;
  g.fillStyle = '#3d8fb8';
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.fillStyle = '#b9b48f';
  g.fillRect(0, 0, X(CITY.harborEdgeX), Z(CITY.beachStart));
  g.fillStyle = '#f0d9a4';
  g.fillRect(0, Z(CITY.beachStart), X(CITY.harborEdgeX), CITY.waterZ - CITY.beachStart);
  g.fillStyle = '#b8b2a6';
  g.fillRect(X(lineCoord(CITY.lines - 1) + 7), Z(-295), CITY.harborEdgeX - lineCoord(CITY.lines - 1) - 7, 295 + CITY.beachStart);
  for (const b of plan.blocks) {
    g.fillStyle = b.park ? '#7fbf6a' : DISTRICTS[b.district].color;
    g.fillRect(X(b.minX), Z(b.minZ), b.maxX - b.minX, b.maxZ - b.minZ);
  }
  g.fillStyle = 'rgba(40,40,50,0.35)';
  for (const f of plan.buildings) g.fillRect(X(f.minX), Z(f.minZ), f.maxX - f.minX, f.maxZ - f.minZ);
  g.fillStyle = '#5b5e66';
  const first = lineCoord(0) - 7, last = lineCoord(CITY.lines - 1) + 7;
  for (let i = 0; i < CITY.lines; i++) {
    const p = lineCoord(i);
    g.fillRect(X(p - 7), Z(first), 14, last - first);
    g.fillRect(X(first), Z(p - 7), CITY.harborEdgeX - 4 - first, 14);
  }
  g.fillStyle = '#a77b52';
  g.fillRect(X(-104), Z(CITY.beachStart - 6), 16, 470 - CITY.beachStart + 6);
  return c;
}

export class Minimap {
  constructor(canvas, plan) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.plan = plan;
    this.image = renderPlan(plan);
    this.zoom = 1.4;
  }

  /** Blips: { x, z, color, size, shape: 'dot'|'square'|'tri', label } */
  draw(world) {
    const g = this.g, W = this.canvas.width, H = this.canvas.height, R = W / 2;
    const pl = world.player, yaw = world.camera.yaw;
    const speed = pl.inCar ? Math.abs(pl.vehicle.speed) : 0;
    this.zoom += ((pl.inCar ? 1.25 - Math.min(0.5, speed / 80) : 1.6) - this.zoom) * 0.05;
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#3d8fb8'; g.fillRect(0, 0, W, H);
    g.translate(R, R);
    g.rotate(Math.PI + yaw);
    g.scale(this.zoom, this.zoom);
    g.translate(-(pl.pos.x - MAP_MIN_X), -(pl.pos.z - MAP_MIN_Z));
    g.drawImage(this.image, 0, 0);
    g.restore();

    const toScreen = (x, z) => {
      const dx = (x - pl.pos.x) * this.zoom, dz = (z - pl.pos.z) * this.zoom;
      const a = Math.PI + yaw, c = Math.cos(a), s = Math.sin(a);
      return [R + dx * c - dz * s, R + dx * s + dz * c];
    };
    const blip = (b) => {
      let [sx, sy] = toScreen(b.x, b.z);
      const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy);
      const edge = R - 10;
      const clipped = d > edge;
      if (clipped) { if (!b.edge) return; sx = R + (dx / d) * edge; sy = R + (dy / d) * edge; }
      g.fillStyle = b.color;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.lineWidth = 2;
      g.beginPath();
      if (b.shape === 'square') g.rect(sx - b.size, sy - b.size, b.size * 2, b.size * 2);
      else g.arc(sx, sy, b.size, 0, Math.PI * 2);
      g.fill(); g.stroke();
      if (b.label) { g.fillStyle = '#111'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.label, sx, sy + 0.5); }
    };
    for (const b of world.blips()) blip(b);

    // player arrow
    g.save();
    g.translate(R, R);
    g.rotate(yaw - pl.heading);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#111';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 7); g.lineTo(0, 3); g.lineTo(-7, 7); g.closePath();
    g.fill(); g.stroke();
    g.restore();
    // north marker
    const [nx, ny] = toScreen(pl.pos.x, pl.pos.z - 1000);
    const nd = Math.hypot(nx - R, ny - R);
    g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', R + ((nx - R) / nd) * (R - 12), R + ((ny - R) / nd) * (R - 12));
    g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3; g.stroke();
  }

  /** Whole-city map for the pause screen. */
  drawFull(canvas, world) {
    const g = canvas.getContext('2d');
    const s = Math.min(canvas.width / MAP_W, canvas.height / MAP_H);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.save();
    g.translate((canvas.width - MAP_W * s) / 2, (canvas.height - MAP_H * s) / 2);
    g.scale(s, s);
    g.drawImage(this.image, 0, 0);
    g.font = 'bold 16px sans-serif';
    g.textAlign = 'center';
    const labels = { downtown: [0, -60], oldtown: [190, -170], heights: [-195, -190], yards: [-195, 60], marina: [250, 150], beach: [-110, 260] };
    for (const [k, [x, z]] of Object.entries(labels)) {
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(DISTRICTS[k].name, x - MAP_MIN_X + 1, z - MAP_MIN_Z + 1);
      g.fillStyle = '#fff'; g.fillText(DISTRICTS[k].name, x - MAP_MIN_X, z - MAP_MIN_Z);
    }
    for (const b of world.blips(true)) {
      g.fillStyle = b.color; g.strokeStyle = '#111'; g.lineWidth = 2;
      g.beginPath(); g.arc(b.x - MAP_MIN_X, b.z - MAP_MIN_Z, b.size * 1.6, 0, Math.PI * 2); g.fill(); g.stroke();
      if (b.label) { g.fillStyle = '#111'; g.font = 'bold 13px sans-serif'; g.textBaseline = 'middle'; g.fillText(b.label, b.x - MAP_MIN_X, b.z - MAP_MIN_Z + 1); }
    }
    const p = world.player.pos;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x - MAP_MIN_X, p.z - MAP_MIN_Z, 8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 3; g.stroke();
    g.restore();
  }
}
