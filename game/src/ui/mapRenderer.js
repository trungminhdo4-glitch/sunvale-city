// Draws Sunvale's map (water, beach, districts, parks, building footprints, streets, labels) into a canvas once,
// shared by the minimap and the pause-menu map.
import { CITY, BEACH_X, SHORE_X, DOCK_Z, HARBOR_Z, PIER } from '../core/config.js';
import { roadCoord, blockRect, districtKey, specialBlock, DISTRICTS, ROAD_COUNT, HALF_ROAD } from '../world/cityLayout.js';

export const MAP = { x0: -520, z0: -400, size: 900, scale: 2 };

export function worldToMap(x, z) { return [(x - MAP.x0) * MAP.scale, (z - MAP.z0) * MAP.scale]; }

export function renderCityMap(statics) {
  const px = MAP.size * MAP.scale;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  const S = MAP.scale, X = (x) => (x - MAP.x0) * S, Z = (z) => (z - MAP.z0) * S;
  const rect = (x0, z0, x1, z1, col) => { g.fillStyle = col; g.fillRect(X(x0), Z(z0), (x1 - x0) * S, (z1 - z0) * S); };

  const sea = g.createLinearGradient(0, 0, X(SHORE_X), 0);
  sea.addColorStop(0, '#1d6fa5'); sea.addColorStop(1, '#3fb8c9');
  g.fillStyle = sea; g.fillRect(0, 0, px, px);
  rect(BEACH_X, -470, 520, DOCK_Z, '#b7c795');
  rect(SHORE_X, -470, BEACH_X, HARBOR_Z, '#f0d9a6');
  rect(BEACH_X, DOCK_Z, 520, HARBOR_Z, '#a9a39a');
  rect(PIER.x0, PIER.z0, PIER.x1, PIER.z1, '#b08a63');

  for (let bi = 0; bi < CITY.blocks; bi++) for (let bj = 0; bj < CITY.blocks; bj++) {
    const r = blockRect(bi, bj), sp = specialBlock(bi, bj);
    let col = DISTRICTS[districtKey(bi, bj)].map;
    if (sp?.kind === 'park') col = '#86b96d';
    if (sp?.kind === 'plaza') col = '#e9b48a';
    rect(r.x0, r.z0, r.x1, r.z1, col);
  }
  g.fillStyle = 'rgba(60,50,70,.28)';
  for (const b of statics.boxes) if (b.tag === 'building') g.fillRect(X(b.minX), Z(b.minZ), (b.maxX - b.minX) * S, (b.maxZ - b.minZ) * S);
  g.fillStyle = 'rgba(30,40,40,.35)';
  for (const b of statics.boxes) if (b.tag === 'container') g.fillRect(X(b.minX), Z(b.minZ), (b.maxX - b.minX) * S, (b.maxZ - b.minZ) * S);

  const lo = roadCoord(0) - HALF_ROAD, hi = roadCoord(ROAD_COUNT - 1) + HALF_ROAD;
  g.fillStyle = '#56585f';
  for (let i = 0; i < ROAD_COUNT; i++) {
    const c0 = roadCoord(i);
    g.fillRect(X(c0 - HALF_ROAD), Z(lo), CITY.road * S, (hi - lo) * S);
    g.fillRect(X(lo), Z(c0 - HALF_ROAD), (hi - lo) * S, CITY.road * S);
  }
  g.fillStyle = 'rgba(245,197,66,.6)';
  for (let i = 0; i < ROAD_COUNT; i++) {
    const c0 = roadCoord(i);
    g.fillRect(X(c0) - 0.6, Z(lo), 1.2, (hi - lo) * S);
    g.fillRect(X(lo), Z(c0) - 0.6, (hi - lo) * S, 1.2);
  }
  return c;
}

export function drawMapLabels(g, scale, offX, offY) {
  const L = [['CORAL STRIP', -290, -200], ['PALM HEIGHTS', -60, -250], ['DOWNTOWN', 0, 40], ['MANGO QUARTER', -150, 80], ['VISTA HILLS', 230, -150],
    ['HARBOR ROW', 120, 270], ['CORAL BEACH', -365, 140], ['CORAL BAY', -460, -260], ['SUNVALE PIER', -440, -18]];
  g.save();
  g.font = '900 15px "Arial Black", sans-serif'; g.textAlign = 'center';
  g.lineWidth = 4; g.strokeStyle = 'rgba(20,10,30,.75)'; g.fillStyle = '#fff7ec';
  for (const [t, x, z] of L) {
    const sx = (x - MAP.x0) * scale + offX, sy = (z - MAP.z0) * scale + offY;
    g.strokeText(t, sx, sy); g.fillText(t, sx, sy);
  }
  g.restore();
}
