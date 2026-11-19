// The round minimap: the city turns with the camera, blips for police, objectives, contacts, services and tokens,
// and the rim flashes red and blue while the police are looking for Rio.
import { MAP } from './mapRenderer.js';

export class Minimap {
  constructor(canvas, mapImage) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.map = mapImage;
    this.zoom = 1.0;
    this.t = 0;
  }

  draw(game, dt) {
    const g = this.g, W = this.canvas.width, R = W / 2;
    this.t += dt;
    const p = game.player, focus = p.vehicle ? p.vehicle.pos : p.pos;
    const targetZoom = p.vehicle ? 0.62 + Math.max(0, 0.3 - p.vehicle.absSpeed * 0.008) : 1.0;
    this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * 2);
    const k = this.zoom * MAP.scale * 0.5;
    const yaw = game.camCtl.yaw;
    const rot = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const toScreen = (x, z) => {
      const dx = (x - focus.x) * k / MAP.scale * MAP.scale, dz = (z - focus.z) * k;
      return [R + dx * cos - dz * sin, R + dx * sin + dz * cos];
    };

    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#1d6fa5'; g.fillRect(0, 0, W, W);
    g.translate(R, R); g.rotate(rot);
    const s = k / MAP.scale;
    g.scale(s, s);
    g.drawImage(this.map, -(focus.x - MAP.x0) * MAP.scale, -(focus.z - MAP.z0) * MAP.scale);
    g.setTransform(1, 0, 0, 1, 0, 0);

    const blip = (x, z, color, size = 5, clampEdge = false, label = '') => {
      let [sx, sy] = toScreen(x, z);
      const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy);
      if (d > R - 8) { if (!clampEdge) return; sx = R + dx / d * (R - 9); sy = R + dy / d * (R - 9); }
      g.fillStyle = color; g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 2;
      g.beginPath(); g.arc(sx, sy, size, 0, Math.PI * 2); g.fill(); g.stroke();
      if (label) { g.fillStyle = '#111'; g.font = '900 9px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, sx, sy + 0.5); }
    };
    for (const b of game.mapBlips()) blip(b.x, b.z, b.color, b.size ?? 6, b.clamp ?? false, b.label ?? '');
    const flash = Math.floor(this.t * 5) % 2 === 0;
    for (const v of game.vehicles) if (v.isPolice && v.controller && !v.wrecked) blip(v.pos.x, v.pos.z, flash ? '#ff3b3b' : '#3b6bff', 4.5);
    for (const c of game.characters) if (c.alive && !c.vehicle && (c.role === 'cop' || c.role === 'thug')) blip(c.pos.x, c.pos.z, c.role === 'thug' ? '#ff6f61' : (flash ? '#ff3b3b' : '#3b6bff'), 3);
    for (const h of game.police.helis) if (!h.dead) blip(h.pos.x, h.pos.z, flash ? '#3b6bff' : '#ff3b3b', 6, false, 'H');

    // player arrow, pointing where Rio faces relative to the camera
    const facing = (p.vehicle ? p.vehicle.yaw : p.yaw) - yaw;
    g.translate(R, R); g.rotate(-facing);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#111'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6.5, 7); g.lineTo(0, 3.5); g.lineTo(-6.5, 7); g.closePath(); g.fill(); g.stroke();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.restore();

    // rim
    const stars = game.wanted.stars;
    g.lineWidth = 7;
    g.strokeStyle = stars ? (flash ? '#ff3b3b' : '#3b6bff') : 'rgba(255,247,236,.85)';
    g.beginPath(); g.arc(R, R, R - 3.5, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff7ec'; g.font = '900 13px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const [nx, ny] = toScreen(focus.x, focus.z - 1000);
    const nd = Math.hypot(nx - R, ny - R);
    const ex = R + (nx - R) / nd * (R - 14), ey = R + (ny - R) / nd * (R - 14);
    g.fillStyle = 'rgba(10,10,20,.8)'; g.beginPath(); g.arc(ex, ey, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd166'; g.fillText('N', ex, ey + 0.5);
  }
}
