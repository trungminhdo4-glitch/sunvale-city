// Pure data: the plan of Sunvale. Districts, blocks, building footprints and named places.
// Nothing here touches three.js; the builders and the systems read this plan.

import { CITY, lineCoord } from '../core/config.js';
import { createRng } from '../core/rng.js';

export const DISTRICTS = {
  downtown: { name: 'Downtown Sunvale', color: '#8fa7bd', palette: [0x9fc4d6, 0xd9e4ea, 0xc7b9a6, 0x7fa7c2, 0xe8dccb, 0x5f87a6] },
  oldtown:  { name: 'Old Mission', color: '#d9a27a', palette: [0xf2a7a0, 0xf6d38b, 0x9fd3c7, 0xf4efe6, 0xe9a46b, 0xb7c9e8] },
  heights:  { name: 'Palm Heights', color: '#9dc98a', palette: [0xfaf3e8, 0xf2e2c8, 0xe9d6d0, 0xf7e6d2] },
  yards:    { name: 'Westside Yards', color: '#b08a6e', palette: [0xb5513e, 0x8a8f96, 0xc9b18f, 0x6f7b70, 0xa8664a] },
  marina:   { name: 'Gull Marina', color: '#7fb0c9', palette: [0xdfe7ea, 0x8fb0c4, 0xc6ccd1, 0xe3d3b8] },
  beach:    { name: 'Coral Beachfront', color: '#f0c48a', palette: [0xffd6c4, 0xc8f0e6, 0xfff1c9, 0xf7c6e0, 0xbfe3f5] },
};

const PARKS = new Set(['4,5', '1,1', '7,1']);
const BLOCKS_PER_AXIS = CITY.lines - 1;

export function districtOf(bx, bz) {
  if (bz >= 7 && bx <= 5) return 'beach';
  if (bx >= 6 && bz >= 4) return 'marina';
  if (bx <= 2 && bz <= 3) return 'heights';
  if (bx <= 2) return 'yards';
  if (bx >= 6) return 'oldtown';
  return 'downtown';
}

/** District name for any world position (harbour and sand included). */
export function districtAt(x, z) {
  if (z > CITY.beachStart - 4) return 'beach';
  if (x > lineCoord(CITY.lines - 1)) return 'marina';
  const bx = Math.max(0, Math.min(BLOCKS_PER_AXIS - 1, Math.floor((x - lineCoord(0)) / CITY.cell)));
  const bz = Math.max(0, Math.min(BLOCKS_PER_AXIS - 1, Math.floor((z - lineCoord(0)) / CITY.cell)));
  return districtOf(bx, bz);
}

function blockBounds(bx, bz) {
  const half = CITY.roadWidth / 2;
  return {
    minX: lineCoord(bx) + half, maxX: lineCoord(bx + 1) - half,
    minZ: lineCoord(bz) + half, maxZ: lineCoord(bz + 1) - half,
  };
}

function addBox(list, minX, minZ, w, d, h, color, style) {
  list.push({ minX, minZ, maxX: minX + w, maxZ: minZ + d, h, color, style });
}

/** Footprints for one block, by district. */
function planBuildings(block, rnd) {
  const out = [];
  const s = CITY.sidewalk;
  const x0 = block.minX + s, z0 = block.minZ + s;
  const size = block.maxX - block.minX - s * 2; // 44 m lot
  const pal = DISTRICTS[block.district].palette;
  const col = () => rnd.pick(pal);
  const cx = (block.minX + block.maxX) / 2, cz = (block.minZ + block.maxZ) / 2;

  switch (block.district) {
    case 'downtown': {
      const core = Math.max(0, 1 - Math.hypot(cx, cz + 60) / 260);
      const half = (size - 3) / 2;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        if (rnd.chance(0.15)) continue;
        const h = 26 + core * 90 * rnd.range(0.6, 1.2) + rnd.range(0, 16);
        const inset = rnd.range(0, 3);
        addBox(out, x0 + i * (half + 3) + inset, z0 + j * (half + 3) + inset, half - inset * 2, half - inset * 2, h, col(), rnd.chance(0.6) ? 'glass' : 'office');
      }
      if (out.length === 0) addBox(out, x0 + 6, z0 + 6, size - 12, size - 12, 40, col(), 'glass');
      break;
    }
    case 'oldtown': {
      const n = 3, w = (size - 4) / n;
      for (let i = 0; i < n; i++) {
        addBox(out, x0 + i * (w + 2), z0, w, 16, rnd.range(9, 22), col(), 'stucco');
        addBox(out, x0 + i * (w + 2), z0 + size - 16, w, 16, rnd.range(9, 22), col(), 'stucco');
      }
      break;
    }
    case 'heights': {
      const spots = [[3, 3], [24, 3], [3, 24], [24, 24]];
      for (const [ox, oz] of spots) {
        if (rnd.chance(0.25)) continue;
        addBox(out, x0 + ox, z0 + oz, rnd.range(12, 16), rnd.range(10, 14), rnd.range(5, 9), col(), 'villa');
      }
      break;
    }
    case 'yards': {
      addBox(out, x0 + 1, z0 + 2, size - 2, 18, rnd.range(8, 13), col(), 'industrial');
      if (rnd.chance(0.7)) addBox(out, x0 + 4, z0 + 25, size - 14, 15, rnd.range(6, 10), col(), 'industrial');
      break;
    }
    case 'marina': {
      addBox(out, x0 + 2, z0 + 2, 18, size - 4, rnd.range(10, 18), col(), 'office');
      addBox(out, x0 + 24, z0 + 4, 18, 18, rnd.range(8, 14), col(), 'stucco');
      break;
    }
    case 'beach': {
      const tall = rnd.range(18, 46);
      addBox(out, x0 + 4, z0 + 3, 16, size - 10, tall, col(), 'hotel');
      addBox(out, x0 + 25, z0 + 3, 15, 20, rnd.range(10, 24), col(), 'hotel');
      break;
    }
  }
  return out;
}

/** Named places the story and the HUD use. Each is a sidewalk spot next to a road. */
function planPlaces() {
  const edgeOf = (bx, bz, side) => {
    const b = blockBounds(bx, bz);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    if (side === 's') return { x: cx, z: b.maxZ - 1.5 };
    if (side === 'n') return { x: cx, z: b.minZ + 1.5 };
    if (side === 'e') return { x: b.maxX - 1.5, z: cz };
    return { x: b.minX + 1.5, z: cz };
  };
  return {
    safehouse: { label: 'Kai\'s Flat', icon: 'H', ...edgeOf(2, 7, 'n') },
    diner:     { label: 'Lu\'s Sunrise Diner', icon: 'L', ...edgeOf(7, 2, 'w') },
    bodyworks: { label: 'Ortega Bodyworks', icon: 'D', ...edgeOf(1, 5, 'e') },
    marina:    { label: 'Harbour Office', icon: 'R', x: 318, z: 70 },
    tower:     { label: 'Crane Tower', icon: 'C', ...edgeOf(4, 2, 's') },
    hospital:  { label: 'St. Coral Hospital', icon: '+', ...edgeOf(3, 3, 'e') },
    police:    { label: 'SVPD Precinct', icon: 'P', ...edgeOf(5, 1, 'w') },
    raceStart: { label: 'Juno\'s Street Race', icon: 'J', ...edgeOf(5, 8, 'n') },
    pier:      { label: 'Starlight Pier', icon: '*', x: -96, z: 440 },
  };
}

/** Builds the full plan once. Seeded so every player gets the same city. */
export function buildCityPlan(seed = 7) {
  const rnd = createRng(seed);
  const blocks = [];
  const buildings = [];
  for (let bx = 0; bx < BLOCKS_PER_AXIS; bx++) {
    for (let bz = 0; bz < BLOCKS_PER_AXIS; bz++) {
      const b = blockBounds(bx, bz);
      const block = { bx, bz, ...b, district: districtOf(bx, bz), park: PARKS.has(`${bx},${bz}`) };
      blocks.push(block);
      if (!block.park) for (const f of planBuildings(block, rnd)) buildings.push(f);
    }
  }
  // Crane Tower: the tallest building, the villain's headquarters.
  const t = blocks.find((b) => b.bx === 4 && b.bz === 2);
  for (let i = buildings.length - 1; i >= 0; i--) {
    const f = buildings[i];
    if (f.minX >= t.minX && f.maxX <= t.maxX && f.minZ >= t.minZ && f.maxZ <= t.maxZ) buildings.splice(i, 1);
  }
  addBox(buildings, t.minX + 9, t.minZ + 9, 32, 26, 150, 0x6d8fa8, 'glass');

  // Harbour: containers stacked on the quay.
  const containers = [];
  const ccol = [0xd2553b, 0x2f7fb5, 0xe2b13c, 0x3c9a6b, 0xe07b39, 0x8a4fa0];
  for (let row = 0; row < 7; row++) {
    for (let k = 0; k < 5; k++) {
      if (rnd.chance(0.25)) continue;
      const x = 304 + k * 13, z = -250 + row * 34;
      const stack = rnd.int(1, 3);
      for (let s = 0; s < stack; s++) containers.push({ x, z, y: s * 2.6, color: rnd.pick(ccol) });
      buildings.push({ minX: x - 6, maxX: x + 6, minZ: z - 1.25, maxZ: z + 1.25, h: stack * 2.6, color: 0, style: 'container' });
    }
  }
  return { blocks, buildings, containers, places: planPlaces() };
}
