// Procedural canvas textures: facades, roads, sand, grass, signs. Nothing is loaded from disk.
import * as THREE from 'three';
import { Rng } from '../core/rng.js';

const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTexture(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function speckle(g, w, h, rng, n, light, dark, size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rng.chance(0.5) ? light : dark;
    g.fillRect(rng.next() * w, rng.next() * h, size, size);
  }
}
function glassGradient(g, x, y, w, h, top, bottom) {
  const gr = g.createLinearGradient(x, y, x, y + h);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
}

// One facade tile covers 4 bays x 4 floors = 16 m x 14 m.
const BUILDERS = {
  stucco() {
    const rng = new Rng(11); const [c, g] = makeCanvas(512, 512);
    g.fillStyle = '#f4efe6'; g.fillRect(0, 0, 512, 512);
    speckle(g, 512, 512, rng, 3000, 'rgba(255,255,255,.25)', 'rgba(120,100,80,.08)');
    for (let f = 0; f < 4; f++) for (let b = 0; b < 4; b++) {
      const x = b * 128, y = f * 128, wx = x + 30, wy = y + 30, ww = 68, wh = 66;
      g.fillStyle = '#ddd4c6'; g.fillRect(wx - 7, wy - 7, ww + 14, wh + 16);
      glassGradient(g, wx, wy, ww, wh, '#5f7f99', '#b9d3e2');
      if (rng.chance(0.35)) { g.fillStyle = '#efe3c6'; g.fillRect(wx, wy, ww, wh * rng.range(0.3, 0.8)); }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(wx + 6, wy + 4, 10, wh - 8);
      g.fillStyle = '#d3c8b8'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      g.fillStyle = '#c4b9a8'; g.fillRect(wx - 10, wy + wh + 5, ww + 20, 7);
      if (rng.chance(0.15)) { g.fillStyle = '#9aa0a6'; g.fillRect(wx + 8, wy + wh - 18, 26, 16); }
      g.fillStyle = 'rgba(150,130,110,.18)'; g.fillRect(x, y + 124, 128, 4);
    }
    return toTexture(c);
  },
  deco() {
    const rng = new Rng(12); const [c, g] = makeCanvas(512, 512);
    g.fillStyle = '#f7f2ea'; g.fillRect(0, 0, 512, 512);
    speckle(g, 512, 512, rng, 2500, 'rgba(255,255,255,.3)', 'rgba(120,100,80,.07)');
    for (let f = 0; f < 4; f++) {
      const y = f * 128;
      glassGradient(g, 0, y + 36, 512, 58, '#3f7088', '#a6dbe6');
      for (let b = 0; b < 8; b++) { g.fillStyle = '#e6ddd0'; g.fillRect(b * 64 - 3, y + 36, 6, 58); }
      g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, y + 40, 512, 8);
      g.fillStyle = '#e9e0d2'; g.fillRect(0, y + 96, 512, 10);
      g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(0, y + 110, 512, 4);
    }
    for (let b = 0; b < 4; b++) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(b * 128 + 58, 0, 12, 512); }
    return toTexture(c);
  },
  glass() {
    const rng = new Rng(13); const [c, g] = makeCanvas(512, 512);
    for (let f = 0; f < 4; f++) {
      const y = f * 128;
      for (let b = 0; b < 8; b++) {
        const k = rng.range(-12, 12);
        glassGradient(g, b * 64, y, 64, 128, `rgb(${170 + k},${205 + k},${225 + k})`, `rgb(${50 + k},${92 + k},${122 + k})`);
        if (rng.chance(0.12)) { g.fillStyle = 'rgba(255,230,190,.35)'; g.fillRect(b * 64, y + 20, 64, 90); }
      }
      g.fillStyle = '#d3dde4'; g.fillRect(0, y + 118, 512, 10);
    }
    g.fillStyle = 'rgba(25,40,52,.9)';
    for (let b = 0; b <= 8; b++) g.fillRect(b * 64 - 2, 0, 4, 512);
    g.fillStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 6; i++) { g.save(); g.translate(rng.range(0, 512), 0); g.rotate(0.5); g.fillRect(0, -100, 30, 900); g.restore(); }
    return toTexture(c);
  },
  warehouse() {
    const rng = new Rng(14); const [c, g] = makeCanvas(512, 512);
    g.fillStyle = '#e2ddd3'; g.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 8) { g.fillStyle = x % 16 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.18)'; g.fillRect(x, 0, 4, 512); }
    speckle(g, 512, 512, rng, 1500, 'rgba(255,255,255,.2)', 'rgba(90,70,50,.12)');
    for (let b = 0; b < 4; b++) {
      glassGradient(g, b * 128 + 20, 150, 88, 34, '#4d6577', '#9cb6c6');
      g.fillStyle = '#5b5f66'; g.fillRect(b * 128 + 18, 404, 92, 108);
      for (let y = 408; y < 512; y += 9) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(b * 128 + 18, y, 92, 3); }
    }
    g.fillStyle = 'rgba(80,60,40,.25)'; g.fillRect(0, 392, 512, 6);
    return toTexture(c);
  },
  villa() {
    const rng = new Rng(15); const [c, g] = makeCanvas(512, 512);
    g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, 512, 512);
    speckle(g, 512, 512, rng, 1500, 'rgba(255,255,255,.3)', 'rgba(110,90,70,.06)');
    for (let f = 0; f < 4; f++) for (let b = 0; b < 2; b++) {
      const x = b * 256 + 34, y = f * 128 + 22;
      g.fillStyle = '#6b4a33'; g.fillRect(x - 5, y - 5, 188, 98);
      glassGradient(g, x, y, 178, 88, '#5e8aa3', '#cfe6ef');
      g.fillStyle = '#6b4a33'; for (let k = 1; k < 4; k++) g.fillRect(x + k * 44, y, 4, 88);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 8, y + 6, 14, 76);
    }
    return toTexture(c);
  },
  shop() {
    const rng = new Rng(16); const [c, g] = makeCanvas(512, 128);
    const awnings = ['#ff6f61', '#2ec4b6', '#ffb347', '#7ed6a5', '#f78fb3', '#5aa9e6'];
    g.fillStyle = '#efe7da'; g.fillRect(0, 0, 512, 128);
    for (let s = 0; s < 4; s++) {
      const x = s * 128;
      glassGradient(g, x + 10, 46, 108, 82, '#2b3d4a', '#7c97a6');
      g.fillStyle = 'rgba(255,240,210,.35)'; g.fillRect(x + 14, 70, 60, 50);
      g.fillStyle = '#3a2f2a'; g.fillRect(x + 84, 58, 26, 70);
      const a = awnings[(s + Math.floor(rng.next() * 6)) % 6];
      for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? a : '#fff6ea'; g.fillRect(x + 6 + k * 14.5, 22, 14.5, 22); }
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 6, 44, 116, 4);
      g.fillStyle = '#2d2a32'; g.fillRect(x + 8, 2, 112, 18);
      g.fillStyle = a; g.font = 'bold 13px Trebuchet MS'; g.textAlign = 'center';
      g.fillText(rng.pick(['CAFE', 'SURF', 'TACOS', 'BODEGA', 'JUICE', 'TATTOO', 'PHARMACY', 'BOUTIQUE', 'RECORDS', 'BAKERY']), x + 64, 16);
    }
    return toTexture(c);
  },
  roof() {
    const rng = new Rng(17); const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#a19c93'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, rng, 4000, 'rgba(255,255,255,.15)', 'rgba(0,0,0,.12)');
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; g.strokeRect(1, 1, 254, 254);
    return toTexture(c);
  },
  road() {
    const rng = new Rng(18); const [c, g] = makeCanvas(256, 512);
    g.fillStyle = '#45464b'; g.fillRect(0, 0, 256, 512);
    speckle(g, 256, 512, rng, 9000, 'rgba(255,255,255,.07)', 'rgba(0,0,0,.18)');
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(25,25,28,.25)'; g.fillRect(rng.range(10, 200), rng.range(0, 480), rng.range(20, 60), rng.range(10, 40)); }
    g.fillStyle = 'rgba(40,30,20,.25)'; g.fillRect(52, 0, 34, 512); g.fillRect(170, 0, 34, 512);
    g.fillStyle = '#f2f2ee'; g.fillRect(9, 0, 5, 512); g.fillRect(242, 0, 5, 512);
    g.fillStyle = '#f5c542'; g.fillRect(121, 0, 4, 512); g.fillRect(131, 0, 4, 512);
    return toTexture(c);
  },
  crossing() {
    const rng = new Rng(19); const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#45464b'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, rng, 5000, 'rgba(255,255,255,.07)', 'rgba(0,0,0,.18)');
    g.fillStyle = '#f2f2ee';
    for (let k = 0; k < 9; k++) {
      const p = 22 + k * 24;
      g.fillRect(p, 2, 12, 30); g.fillRect(p, 224, 12, 30); g.fillRect(2, p, 30, 12); g.fillRect(224, p, 30, 12);
    }
    return toTexture(c);
  },
  sidewalk() {
    const rng = new Rng(20); const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#d6cfc2'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, rng, 3000, 'rgba(255,255,255,.2)', 'rgba(0,0,0,.08)');
    g.fillStyle = 'rgba(90,80,70,.22)';
    for (let k = 0; k < 256; k += 64) { g.fillRect(k, 0, 2, 256); g.fillRect(0, k, 256, 2); }
    return toTexture(c);
  },
  sand() {
    const rng = new Rng(21); const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#ecd6a6'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, rng, 9000, 'rgba(255,250,235,.35)', 'rgba(150,110,60,.15)');
    g.strokeStyle = 'rgba(170,130,80,.12)'; g.lineWidth = 3;
    for (let y = 10; y < 256; y += 22) { g.beginPath(); for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 4); g.stroke(); }
    return toTexture(c);
  },
  grass() {
    const rng = new Rng(22); const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#6f9e4c'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${rng.int(70, 120)},${rng.int(130, 170)},${rng.int(50, 80)},.35)`; g.beginPath(); g.arc(rng.next() * 256, rng.next() * 256, rng.range(8, 30), 0, 7); g.fill(); }
    speckle(g, 256, 256, rng, 6000, 'rgba(190,230,140,.25)', 'rgba(30,60,20,.2)');
    return toTexture(c);
  },
  plaza() {
    const rng = new Rng(23); const [c, g] = makeCanvas(256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#e7c9a3' : '#c9744f';
      if ((x === 3 || x === 4) && (y === 3 || y === 4)) g.fillStyle = '#f1e3c8';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
    speckle(g, 256, 256, rng, 3000, 'rgba(255,255,255,.12)', 'rgba(0,0,0,.08)');
    g.strokeStyle = 'rgba(60,40,30,.25)'; g.lineWidth = 2;
    for (let k = 0; k <= 256; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
    return toTexture(c);
  },
  wood() {
    const rng = new Rng(24); const [c, g] = makeCanvas(256, 256);
    for (let k = 0; k < 8; k++) { g.fillStyle = `rgb(${150 + rng.int(-14, 14)},${112 + rng.int(-10, 10)},${76 + rng.int(-8, 8)})`; g.fillRect(0, k * 32, 256, 30); }
    g.fillStyle = 'rgba(50,30,15,.5)'; for (let k = 0; k < 8; k++) g.fillRect(0, k * 32 + 30, 256, 2);
    speckle(g, 256, 256, rng, 2000, 'rgba(255,230,200,.12)', 'rgba(60,40,20,.15)');
    return toTexture(c);
  },
  concrete() {
    const rng = new Rng(25); const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#b3aca0'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, rng, 6000, 'rgba(255,255,255,.12)', 'rgba(0,0,0,.12)');
    g.fillStyle = 'rgba(60,50,40,.25)'; g.fillRect(0, 126, 256, 3); g.fillRect(126, 0, 3, 256);
    return toTexture(c);
  },
  container() {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 8) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 3, 128); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 128, 5); g.fillRect(0, 123, 128, 5);
    return toTexture(c);
  },
  glow() {
    const [c, g] = makeCanvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return toTexture(c, false);
  },
};

export function getTexture(name) {
  if (!cache.has(name)) cache.set(name, BUILDERS[name]());
  return cache.get(name);
}

// A sign face with text, used for rooftop billboards, storefronts and vehicle liveries.
export function makeSignTexture(text, { bg = '#ffffff', fg = '#222222', accent = null, w = 512, h = 128, font = 'Arial Black', sub = '' } = {}) {
  const key = `sign:${text}:${bg}:${fg}:${accent}:${w}:${h}:${sub}`;
  if (cache.has(key)) return cache.get(key);
  const [c, g] = makeCanvas(w, h);
  if (bg === 'transparent') g.clearRect(0, 0, w, h); else { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  if (accent) { g.fillStyle = accent; g.fillRect(0, h - h * 0.12, w, h * 0.12); g.fillRect(0, 0, w, h * 0.06); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = h * (sub ? 0.5 : 0.62);
  g.font = `900 ${size}px ${font}, Impact, sans-serif`;
  while (g.measureText(text).width > w * 0.92 && size > 10) { size -= 2; g.font = `900 ${size}px ${font}, Impact, sans-serif`; }
  g.fillText(text, w / 2, sub ? h * 0.4 : h * 0.52);
  if (sub) { g.font = `700 ${h * 0.2}px Trebuchet MS, sans-serif`; g.fillText(sub, w / 2, h * 0.78); }
  const t = toTexture(c, false);
  cache.set(key, t);
  return t;
}
