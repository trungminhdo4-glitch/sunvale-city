// Save and load the run in localStorage: story progress, money, weapons, tokens and position.

const KEY = 'sunvale-heat-rises-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function writeSave(world) {
  const data = {
    version: 1,
    money: world.state.money,
    stats: world.state.stats,
    completed: [...world.missions.completed],
    tokens: [...world.pickups.collectedTokens],
    ammo: Object.fromEntries(Object.entries(world.combat.ammo).filter(([k]) => k !== 'fists')),
    health: world.player.health,
    armor: world.player.armor,
    pos: [world.player.pos.x, world.player.pos.z],
    hour: world.stage.hour,
    progress: world.progress.save(),
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function readSave() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

export function applySave(world, data) {
  if (!data) return;
  world.state.money = data.money ?? 0;
  Object.assign(world.state.stats, data.stats ?? {});
  world.missions.completed = new Set(data.completed ?? []);
  world.pickups.restoreTokens(data.tokens ?? []);
  world.combat.ammo = { fists: Infinity, ...(data.ammo ?? { pistol: 60 }) };
  world.player.health = data.health ?? 100;
  world.player.armor = data.armor ?? 0;
  if (data.pos) world.player.placeAt(data.pos[0], data.pos[1]);
  if (data.hour != null) world.stage.setHour(data.hour);
  world.progress.load(data.progress);
}
