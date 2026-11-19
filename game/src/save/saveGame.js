// Saves and loads progress in localStorage: story, money, weapons, tokens, stats, time of day and position.
import { SAVE_KEY } from '../core/config.js';

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function writeSave(game) {
  const p = game.player;
  const data = {
    version: 1,
    savedAt: Date.now(),
    money: Math.round(game.money),
    hour: game.day.hour,
    player: { x: p.vehicle ? p.vehicle.pos.x : p.pos.x, z: p.vehicle ? p.vehicle.pos.z : p.pos.z, health: Math.round(p.health), armor: Math.round(p.armor) },
    missions: game.missions.toJSON(),
    tokens: game.tokens.toJSON(),
    arsenal: game.arsenal.toJSON(),
    stats: game.stats,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.version === 1 ? d : null;
  } catch { return null; }
}
