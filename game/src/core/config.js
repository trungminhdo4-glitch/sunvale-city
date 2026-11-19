// Sunvale: Heat Rises — tuning constants shared by every system.
// The city is a 9 x 9 grid of blocks between 10 road lines in each direction.

export const CITY = {
  cell: 64,            // distance between road centre lines (m)
  lines: 10,           // road lines per axis
  roadWidth: 14,       // asphalt width (m)
  laneOffset: 3.3,     // lane centre from road centre (drive on the right)
  sidewalk: 3,         // sidewalk ring width (m)
  curb: 0.18,          // sidewalk height (m)
  beachStart: 296,     // z where sand begins (south coast)
  waterZ: 342,         // z where the ocean begins
  harborEdgeX: 372,    // x where the harbour water begins (east coast)
  landMin: -340,       // west / north land edge
};

/** World coordinate of road line i (0..lines-1). */
export function lineCoord(i) {
  return -((CITY.lines - 1) * CITY.cell) / 2 + i * CITY.cell;
}

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 8.2,
  radius: 0.45,
  maxHealth: 100,
  maxArmor: 100,
  enterCarRange: 3.6,
};

export const TRAFFIC = {
  maxCars: 26,
  spawnMin: 70,
  spawnMax: 160,
  despawn: 200,
  cruiseSpeed: 12,
};

export const PEDS = {
  maxPeds: 38,
  spawnMin: 25,
  spawnMax: 110,
  despawn: 140,
};

export const POLICE = {
  carsPerLevel: [0, 1, 2, 3, 4, 5],
  footPerLevel: [0, 2, 3, 4, 5, 6],
  sightRange: 70,
  evadeBase: 9,
  evadePerStar: 3,
  arrestTime: 1.6,
};

export const COLORS = {
  sky: 0xffc894,
  fog: 0xf3c9a0,
  sun: 0xffd2a0,
  water: 0x2a8bb5,
  sand: 0xf0d9a4,
};
