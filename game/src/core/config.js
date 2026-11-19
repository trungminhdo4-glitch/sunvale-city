// Tunable constants shared by every system of Sunvale: Heat Rises.
// World axes: +x is east, +z is south, +y is up. A yaw of 0 faces south (+z).

export const CITY = { blocks: 10, pitch: 64, road: 14, sidewalk: 3.2, origin: -320, curbHeight: 0.15 };
export const BEACH_X = -327;          // sand starts west of the beachfront avenue
export const SHORE_X = -401;          // waterline of Coral Bay
export const DOCK_Z = 327;            // harbor docks start south of the last street
export const HARBOR_Z = 352;          // waterline of the harbor
export const BOUNDS = { minX: -399, maxX: 352, minZ: -352, maxZ: 350 };
export const PIER = { x0: -488, x1: -386, z0: -7, z1: 7, y: 0.45 };

export const SIM_DT = 1 / 60;
export const DAY = { start: 15, end: 19.5, hoursPerSecond: 4.5 / 1500 };

export const POLICE_CARS = [0, 1, 2, 3, 4, 5];
export const POLICE_HELIS = [0, 0, 0, 1, 1, 2];
export const SPOT_RADIUS = [0, 60, 75, 95, 115, 140];
export const EVADE_SECONDS = [0, 7, 9, 12, 15, 18];
export const HEAT_FOR_STARS = [0, 1, 3, 6, 10, 15];

export const TRAFFIC = { count: 24, spawnMin: 70, spawnMax: 170, despawn: 235 };
export const PEDS = { count: 42, spawnMin: 22, spawnMax: 105, despawn: 150 };

export const SAVE_KEY = 'sunvale-heat-rises-v1';
export const START = { x: -344, z: -16, yaw: -2.2 };
export const RESPAWN = {
  hospital: { x: 160, z: -200.6, yaw: 0, name: 'Sunvale General' },
  station: { x: -32, z: -8.8, yaw: 0, name: 'SVPD Central' },
};
export const COSTS = { hospital: 150, arrest: 300, paint: 200 };
