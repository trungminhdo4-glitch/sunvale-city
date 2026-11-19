// Sunvale's map as data: the street grid, districts, named blocks, landmarks and place lookups.
import { CITY, BEACH_X, SHORE_X, DOCK_Z, PIER } from '../core/config.js';
import { clamp } from '../core/mathUtil.js';

export const ROAD_COUNT = CITY.blocks + 1;
export const HALF_ROAD = CITY.road / 2;
export const roadCoord = (i) => CITY.origin + i * CITY.pitch;
export const CITY_MIN = roadCoord(0) - HALF_ROAD;
export const CITY_MAX = roadCoord(CITY.blocks) + HALF_ROAD;

// North-south avenues (constant x, west to east) and east-west streets (constant z, north to south).
export const NS_STREETS = ['Coral Ave', 'Tarpon Ave', 'Hibiscus Ave', 'Mango Ave', 'Lantana Ave', 'Sunvale Blvd',
  'Marina Ave', 'Seagrape Ave', 'Cypress Ave', 'Vista Ave', 'Ridge Ave'];
export const EW_STREETS = ['Breeze St', 'Sol St', 'Gull St', 'Palmetto St', 'Ocean Dr', 'Pelican St',
  'Saltwater St', 'Citrus St', 'Anchor St', 'Dockside St', 'Harbor St'];

export const DISTRICTS = {
  coral: { name: 'Coral Strip', map: '#f7c9a9', style: 'deco' },
  palm: { name: 'Palm Heights', map: '#ead9b8', style: 'stucco' },
  downtown: { name: 'Downtown Sunvale', map: '#c5cbd8', style: 'glass' },
  mango: { name: 'Mango Quarter', map: '#f4c77b', style: 'stucco' },
  vista: { name: 'Vista Hills', map: '#cfe3b3', style: 'villa' },
  harbor: { name: 'Harbor Row', map: '#b9b2a6', style: 'warehouse' },
};

export const SPECIAL_BLOCKS = {
  '3,5': { kind: 'plaza', name: 'Mango Plaza' },
  '1,5': { kind: 'park', name: 'Pelican Park' },
  '6,2': { kind: 'park', name: 'Lumen Park' },
  '8,2': { kind: 'park', name: 'Vista Green' },
  '0,3': { kind: 'landmark', id: 'marea', name: 'Marea Hotel' },
  '5,5': { kind: 'landmark', id: 'calloway', name: 'Calloway Coastal Tower' },
  '3,7': { kind: 'landmark', id: 'brandt', name: 'Brandt Motors' },
  '2,1': { kind: 'landmark', id: 'freshcoat', name: 'Fresh Coat Paint & Body' },
  '4,4': { kind: 'landmark', id: 'svpd', name: 'SVPD Central' },
  '7,1': { kind: 'landmark', id: 'general', name: 'Sunvale General' },
};

export function districtKey(bi, bj) {
  if (bj >= 8) return 'harbor';
  if (bi <= 1) return 'coral';
  if (bi >= 7 && bj >= 5) return 'harbor';
  if (bi >= 7) return 'vista';
  if (bi >= 4 && bi <= 6 && bj >= 3) return 'downtown';
  if (bi <= 3 && bj >= 3) return 'mango';
  return 'palm';
}
export const specialBlock = (bi, bj) => SPECIAL_BLOCKS[`${bi},${bj}`] ?? null;

export function blockRect(bi, bj) {
  return { x0: roadCoord(bi) + HALF_ROAD, x1: roadCoord(bi + 1) - HALF_ROAD, z0: roadCoord(bj) + HALF_ROAD, z1: roadCoord(bj + 1) - HALF_ROAD };
}
export function blockCenter(bi, bj) { return { x: roadCoord(bi) + CITY.pitch / 2, z: roadCoord(bj) + CITY.pitch / 2 }; }

export function blockAt(x, z) {
  const bi = Math.floor((x - CITY.origin) / CITY.pitch), bj = Math.floor((z - CITY.origin) / CITY.pitch);
  if (bi < 0 || bj < 0 || bi >= CITY.blocks || bj >= CITY.blocks) return null;
  const r = blockRect(bi, bj);
  if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) return null;
  return { bi, bj, rect: r };
}

export const isOnPier = (x, z) => x >= PIER.x0 && x <= PIER.x1 && z >= PIER.z0 && z <= PIER.z1;

export function placeName(x, z) {
  if (isOnPier(x, z) && x < SHORE_X + 12) return 'Sunvale Pier';
  if (x < SHORE_X) return 'Coral Bay';
  if (x < BEACH_X) return 'Coral Beach';
  if (z > DOCK_Z) return 'Harbor Docks';
  const bi = clamp(Math.floor((x - CITY.origin) / CITY.pitch), 0, CITY.blocks - 1);
  const bj = clamp(Math.floor((z - CITY.origin) / CITY.pitch), 0, CITY.blocks - 1);
  const sp = specialBlock(bi, bj);
  if (sp && sp.kind !== 'landmark') return sp.name;
  return DISTRICTS[districtKey(bi, bj)].name;
}

export function streetName(x, z) {
  if (x < BEACH_X - 6) return isOnPier(x, z) ? 'Boardwalk' : 'Shoreline';
  const i = clamp(Math.round((x - CITY.origin) / CITY.pitch), 0, CITY.blocks);
  const j = clamp(Math.round((z - CITY.origin) / CITY.pitch), 0, CITY.blocks);
  const dx = Math.abs(x - roadCoord(i)), dz = Math.abs(z - roadCoord(j));
  if (dx < 9 && dz < 9) return `${NS_STREETS[i]} & ${EW_STREETS[j]}`;
  if (dx < 12 && dx <= dz) return NS_STREETS[i];
  if (dz < 12) return EW_STREETS[j];
  return dx < dz ? `off ${NS_STREETS[i]}` : `off ${EW_STREETS[j]}`;
}

// Fixed points the story, services and screenshots use.
export const LOCATIONS = {
  tacoTruck: { x: -352, z: -30 },
  mari: { x: -346.5, z: -24.5 },
  brandt: { x: -96, z: 143 },
  teo: { x: -88, z: 147 },
  freshCoat: { x: -160, z: -206 },
  marea: { x: -305, z: -96 },
  pierEnd: { x: -478, z: 0 },
  mangoPlaza: { x: -96, z: 32 },
  callowayTower: { x: 32, z: 32 },
  harborYard: { x: 150, z: 338 },
};
