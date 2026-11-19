// Reusable objective steps: go somewhere, get in a car, lose the police, take out targets, wreck vehicles.

const focusOf = (g) => (g.player.vehicle ? g.player.vehicle.pos : g.player.pos);
const near = (g, pos, r) => { const f = focusOf(g); return Math.hypot(f.x - pos.x, f.z - pos.z) < r; };

export function goTo(g, pos, text, { radius = 5, vehicle = null, needVehicle = false, needClean = false, cleanText = null } = {}) {
  return {
    text: () => (needClean && g.wanted.stars > 0 ? cleanText ?? 'Lose the cops first' : text),
    marker: () => pos,
    check: () => {
      const p = g.player;
      if (needVehicle && !p.vehicle) return false;
      if (vehicle && p.vehicle !== vehicle()) return false;
      if (needClean && g.wanted.stars > 0) return false;
      return near(g, pos, radius);
    },
  };
}

export function enterAnyVehicle(g, text) {
  return { text, check: () => !!g.player.vehicle };
}

export function enterVehicle(g, getVehicle, text, onEnter = null) {
  return {
    text,
    marker: () => getVehicle()?.pos,
    check: () => { const ok = g.player.vehicle === getVehicle(); if (ok && onEnter) onEnter(); return ok; },
    fail: () => !getVehicle() || getVehicle().wrecked,
    failReason: 'The car was wrecked',
  };
}

export function loseWanted(g, text = 'Lose the cops') {
  return { text, check: () => g.wanted.stars === 0 };
}

export function eliminate(g, getTargets, label) {
  return {
    text: () => { const t = getTargets(); return `${label} (${t.filter((c) => c.alive).length} left)`; },
    targets: () => getTargets().filter((c) => c.alive).map((c) => c.pos),
    check: () => getTargets().length > 0 && getTargets().every((c) => !c.alive),
  };
}

export function wreckVehicles(g, getTargets, label, failIfFar = 0) {
  return {
    text: () => { const t = getTargets(); return `${label} (${t.filter((v) => !v.wrecked).length} left)`; },
    targets: () => getTargets().filter((v) => !v.wrecked).map((v) => v.pos),
    check: () => getTargets().length > 0 && getTargets().every((v) => v.wrecked),
    fail: () => failIfFar > 0 && getTargets().some((v) => !v.wrecked && Math.hypot(v.pos.x - focusOf(g).x, v.pos.z - focusOf(g).z) > failIfFar),
    failReason: 'Dex got away',
  };
}
