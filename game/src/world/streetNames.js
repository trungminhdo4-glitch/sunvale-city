// Street names for Sunvale's road grid: one name per road line in each direction, and a lookup
// for the street nearest any world position (used by the HUD and the police radio).

import { CITY, lineCoord } from '../core/config.js';

// Roads running east-west (constant z), north to south: the last one runs along the beach.
const EAST_WEST = [
  'Ridgeview Drive', 'Crestline Avenue', 'Canyon Street', 'Mercado Avenue', 'Civic Way',
  'Harbor Boulevard', 'Palmetto Street', 'Coral Avenue', 'Seabreeze Drive', 'Shoreline Boulevard',
];
// Roads running north-south (constant x), west to east: the last one runs along the docks.
const NORTH_SOUTH = [
  'Foundry Road', 'Railside Avenue', 'Westgate Street', 'Union Avenue', 'Sunvale Avenue',
  'Calle Esperanza', 'Mission Street', 'Alvarado Avenue', 'Gullwing Road', 'Dockside Drive',
];

const nearestLine = (v) => Math.max(0, Math.min(CITY.lines - 1, Math.round((v - lineCoord(0)) / CITY.cell)));

/** Name of the street closest to (x, z). */
export function streetAt(x, z) {
  if (z > CITY.beachStart + 6) return x > 200 ? 'Starlight Pier' : 'Coral Beach';
  if (x > CITY.harborEdgeX - 30 && z < 200) return 'Container Terminal';
  const i = nearestLine(x), j = nearestLine(z);
  const dx = Math.abs(x - lineCoord(i)), dz = Math.abs(z - lineCoord(j));
  return dz <= dx ? EAST_WEST[j] : NORTH_SOUTH[i];
}

/** Compass word for a heading (radians, 0 = +z = south in Sunvale's map). */
export function headingWord(heading) {
  const words = ['southbound', 'eastbound', 'northbound', 'westbound'];
  const k = Math.round(((heading % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 2)) % 4;
  return words[k];
}
