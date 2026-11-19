// Procedural canvas textures: facades with windows, roads with markings, sand, soft glow sprites.

import * as THREE from 'three';
import { createRng } from '../core/rng.js';

function canvasTexture(w, h, draw, { repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Facade tile: one tile = 4 m wide x 3.5 m tall storey. style picks window shape. */
export function facadeTexture(style) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    if (style === 'glass') {
      g.fillStyle = '#6f8fa6';
      g.fillRect(4, 10, w - 8, h - 22);
      const grd = g.createLinearGradient(0, 10, w, h);
      grd.addColorStop(0, 'rgba(255,240,220,0.55)');
      grd.addColorStop(0.5, 'rgba(120,160,190,0.1)');
      grd.addColorStop(1, 'rgba(255,200,160,0.35)');
      g.fillStyle = grd;
      g.fillRect(4, 10, w - 8, h - 22);
      g.fillStyle = '#e8eef2';
      g.fillRect(62, 10, 4, h - 22);
    } else if (style === 'industrial') {
      g.fillStyle = '#d8d8d8';
      for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 2, h);
      g.fillStyle = '#4b5a66';
      g.fillRect(20, 30, 88, 26);
    } else {
      // stucco / villa / hotel / office: two windows per tile
      g.fillStyle = '#41586b';
      g.fillRect(16, 34, 36, 54);
      g.fillRect(76, 34, 36, 54);
      g.fillStyle = 'rgba(255,230,200,0.35)';
      g.fillRect(16, 34, 36, 18);
      g.fillRect(76, 34, 36, 18);
      g.fillStyle = '#e6e0d8';
      g.fillRect(12, 88, 44, 6);
      g.fillRect(72, 88, 44, 6);
    }
  });
}

/** Night glow: random lit windows, used as emissive map. */
export function facadeGlowTexture(style, seed) {
  const r = createRng(seed);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const ox = tx * 128, oy = ty * 128;
      const lit = () => r.chance(0.45);
      g.fillStyle = r.chance(0.5) ? '#ffcf8a' : '#ffe9c2';
      if (style === 'glass') { if (lit()) g.fillRect(ox + 4, oy + 10, 120, 106); }
      else if (style === 'industrial') { if (lit()) g.fillRect(ox + 20, oy + 30, 88, 26); }
      else {
        if (lit()) g.fillRect(ox + 16, oy + 34, 36, 54);
        if (lit()) g.fillRect(ox + 76, oy + 34, 36, 54);
      }
    }
  });
}

/** Road strip: v runs along the road. Dashed centre line, solid edge lines. */
export function roadTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#4a4d52';
    g.fillRect(0, 0, w, h);
    const r = createRng(3);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${r.chance(0.5) ? '255,255,255' : '0,0,0'},${r.range(0.03, 0.08)})`;
      g.fillRect(r.range(0, w), r.range(0, h), 2, 2);
    }
    g.fillStyle = '#e9e4d8';
    g.fillRect(6, 0, 3, h);
    g.fillRect(w - 9, 0, 3, h);
    g.fillStyle = '#f1c232';
    g.fillRect(w / 2 - 4, 0, 3, h * 0.55);
    g.fillRect(w / 2 + 1, 0, 3, h * 0.55);
  });
}

export function crossingTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#4a4d52';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ece8de';
    for (let x = 10; x < w - 10; x += 14) { g.fillRect(x, 2, 8, 14); g.fillRect(x, h - 16, 8, 14); }
    for (let y = 22; y < h - 22; y += 14) { g.fillRect(2, y, 14, 8); g.fillRect(w - 16, y, 14, 8); }
  });
}

export function sandTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#efd8a3';
    g.fillRect(0, 0, w, h);
    const r = createRng(11);
    for (let i = 0; i < 4000; i++) {
      const v = r.range(-30, 25);
      g.fillStyle = `rgba(${200 + v},${170 + v},${110 + v},0.25)`;
      g.fillRect(r.range(0, w), r.range(0, h), 2, 2);
    }
  });
}

export function grassTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#7fb05a';
    g.fillRect(0, 0, w, h);
    const r = createRng(5);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = r.chance(0.5) ? 'rgba(60,110,40,0.25)' : 'rgba(170,200,100,0.22)';
      g.fillRect(r.range(0, w), r.range(0, h), 2, 3);
    }
  });
}

export function pavementTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#cfc7ba';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,80,70,0.25)';
    g.lineWidth = 2;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}

/** Radial soft dot for glows, smoke and sparks. */
export function softDotTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, { repeat: false });
}
