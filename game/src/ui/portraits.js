// Character portraits for the dialogue box, painted on a canvas from each character's look in
// data/story.js (skin, hair, style, shirt, one detail) and cached as data URLs.

import { CHARACTERS } from '../data/story.js';

const cache = new Map();
const SIZE = 96;

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function drawHairBack(g, look) {
  g.fillStyle = look.hair;
  if (look.style === 'long') { g.beginPath(); g.ellipse(48, 52, 27, 34, 0, 0, Math.PI * 2); g.fill(); }
  if (look.style === 'bob') { g.beginPath(); g.roundRect(21, 22, 54, 44, 14); g.fill(); }
  if (look.style === 'bun') { g.beginPath(); g.arc(48, 15, 10, 0, Math.PI * 2); g.fill(); }
}

function drawHairFront(g, look) {
  g.fillStyle = look.hair;
  g.beginPath();
  switch (look.style) {
    case 'short': g.ellipse(48, 30, 22, 13, 0, Math.PI, 0); g.fill(); g.fillRect(26, 28, 4, 10); g.fillRect(66, 28, 4, 10); break;
    case 'long': case 'bob': g.ellipse(48, 30, 23, 14, 0, Math.PI, 0); g.fill(); g.beginPath(); g.ellipse(40, 31, 14, 6, -0.4, 0, Math.PI * 2); g.fill(); break;
    case 'bun': g.ellipse(48, 30, 22, 12, 0, Math.PI, 0); g.fill(); break;
    case 'cap':
      g.fillStyle = '#1f2a44'; g.ellipse(48, 30, 23, 14, 0, Math.PI, 0); g.fill();
      g.fillRect(36, 26, 38, 6); g.fillStyle = '#f2c14e'; g.fillRect(44, 20, 8, 5); break;
    default: break;
  }
}

function drawExtra(g, look) {
  switch (look.extra) {
    case 'shades': g.fillStyle = '#101418'; g.beginPath(); g.roundRect(32, 40, 13, 7, 3); g.roundRect(51, 40, 13, 7, 3); g.fill(); g.fillRect(44, 42, 8, 2); break;
    case 'goatee': g.fillStyle = shade(look.hair, 1); g.beginPath(); g.ellipse(48, 64, 6, 5, 0, 0, Math.PI * 2); g.fill(); break;
    case 'stubble': g.fillStyle = 'rgba(30,20,15,0.28)'; g.beginPath(); g.ellipse(48, 59, 15, 9, 0, 0, Math.PI); g.fill(); break;
    case 'earrings': g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(26, 52, 2.6, 0, Math.PI * 2); g.arc(70, 52, 2.6, 0, Math.PI * 2); g.fill(); break;
    case 'tie': g.fillStyle = '#7a1022'; g.beginPath(); g.moveTo(45, 76); g.lineTo(51, 76); g.lineTo(53, 96); g.lineTo(43, 96); g.fill(); break;
    case 'headset':
      g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.arc(48, 40, 25, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.fillStyle = '#222'; g.fillRect(20, 40, 7, 13); g.fillRect(69, 40, 7, 13);
      g.beginPath(); g.moveTo(24, 52); g.quadraticCurveTo(28, 66, 42, 64); g.stroke(); break;
    default: break;
  }
}

function paint(key) {
  const c = CHARACTERS[key], look = c.look;
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const g = cv.getContext('2d');
  // backdrop in the character's colour
  const bg = g.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, shade(c.color, 0.95)); bg.addColorStop(1, shade(c.color, 0.45));
  g.fillStyle = bg; g.fillRect(0, 0, SIZE, SIZE);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(78, 16, 26, 0, Math.PI * 2); g.fill();
  drawHairBack(g, look);
  // shoulders and neck
  g.fillStyle = look.shirt; g.beginPath(); g.ellipse(48, 102, 40, 28, 0, Math.PI, 0); g.fill();
  g.fillStyle = shade(look.skin, 0.85); g.fillRect(41, 62, 14, 14);
  // head
  g.fillStyle = look.skin; g.beginPath(); g.ellipse(48, 44, 21, 25, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(27, 46, 4, 6, 0, 0, Math.PI * 2); g.ellipse(69, 46, 4, 6, 0, 0, Math.PI * 2); g.fill();
  // face: brows, eyes, nose, mouth
  g.fillStyle = '#1b1310';
  g.fillRect(34, 36, 10, 2.5); g.fillRect(52, 36, 10, 2.5);
  g.beginPath(); g.arc(39, 43, 2.4, 0, Math.PI * 2); g.arc(57, 43, 2.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = shade(look.skin, 0.78); g.beginPath(); g.moveTo(48, 45); g.lineTo(45, 53); g.lineTo(50, 53); g.fill();
  g.strokeStyle = '#7a3b32'; g.lineWidth = 2.2; g.beginPath(); g.arc(48, 55, 6, 0.25, Math.PI - 0.25); g.stroke();
  drawHairFront(g, look);
  drawExtra(g, look);
  return cv.toDataURL();
}

/** Data URL of a character's portrait (painted once). */
export function portraitFor(key) {
  if (!CHARACTERS[key]) return '';
  if (!cache.has(key)) cache.set(key, paint(key));
  return cache.get(key);
}
