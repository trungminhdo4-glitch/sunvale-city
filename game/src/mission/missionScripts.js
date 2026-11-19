// The six jobs as step lists. Each script gets the mission manager's spawn helpers so it can clean up after itself.
import { LOCATIONS } from '../world/cityLayout.js';
import { goTo, enterAnyVehicle, enterVehicle, loseWanted, eliminate, wreckVehicles } from './missionSteps.js';
import { spawnGoon } from '../ai/hostiles.js';
import { LaneDriver, FleeDriver } from '../ai/drivers.js';

export const DELIVERIES = [{ x: -184.5, z: -64 }, { x: 64, z: 120.5 }, { x: -256, z: 199 }];

export const SCRIPTS = {
  strip(m) {
    const g = m.game;
    return [
      enterAnyVehicle(g, 'Get yourself a car — press F next to one'),
      goTo(g, LOCATIONS.brandt, 'Drive to Brandt Motors on Saltwater St', { radius: 7, needVehicle: true }),
    ];
  },

  vespera(m) {
    const g = m.game;
    let car = null;
    return [
      { ...goTo(g, LOCATIONS.marea, 'Go to the Marea Hotel on Coral Ave', { radius: 30 }),
        setup: () => { car = m.spawnVehicle('vespera', LOCATIONS.marea.x, LOCATIONS.marea.z, Math.PI, '#e2231a'); car.tag = 'vespera'; } },
      enterVehicle(g, () => car, 'Steal Dex\'s red Vespera GT', () => g.wanted.setStars(2)),
      { ...loseWanted(g, 'Lose the cops in the Vespera'), fail: () => car.wrecked, failReason: 'The Vespera was wrecked' },
      { ...goTo(g, LOCATIONS.brandt, 'Bring the Vespera to Brandt Motors', { radius: 7, vehicle: () => car, needClean: true, cleanText: 'Lose the heat before you pull into the garage' }),
        fail: () => car.wrecked, failReason: 'The Vespera was wrecked' },
    ];
  },

  tamales(m) {
    const g = m.game;
    const steps = [{ ...goTo(g, LOCATIONS.pierEnd, 'Pick up the cooler at the end of Sunvale Pier', { radius: 4.5 }) }];
    DELIVERIES.forEach((d, k) => {
      steps.push({
        ...goTo(g, d, `Deliver order ${k + 1} of 3 before the ice melts`, { radius: 6 }),
        setup: k === 0 ? () => { m.timer = 150; g.notify('Cooler loaded. <b>2:30</b> on the clock!'); } : null,
      });
    });
    return steps;
  },

  collectors(m) {
    const g = m.game;
    const goons = [];
    return [
      goTo(g, LOCATIONS.mangoPlaza, 'Head to Mango Plaza', { radius: 34 }),
      { ...eliminate(g, () => goons, 'Run off Calloway\'s collectors'),
        setup: () => {
          const c = LOCATIONS.mangoPlaza;
          for (const [dx, dz, w] of [[-14, -10, 'kestrel'], [13, -8, 'kestrel'], [-9, 15, 'hornet'], [15, 14, 'kestrel']]) goons.push(m.track(spawnGoon(g, c.x + dx, c.z + dz, w)));
        } },
    ];
  },

  heat(m) {
    const g = m.game;
    const vans = [];
    return [
      { ...wreckVehicles(g, () => vans, 'Wreck the Calloway transporters'),
        setup: () => {
          for (const [x, z, yaw] of [[-200, -60.5, Math.PI / 2], [-3.5, 150, 0]]) {
            const v = m.spawnVehicle('van', x, z, yaw);
            v.controller = new LaneDriver(v, 11);
            m.addDriver(v);
            vans.push(v);
          }
        },
        cleanup: () => g.wanted.setStars(3) },
      loseWanted(g, 'Permits destroyed — now lose the cops'),
    ];
  },

  sunset(m) {
    const g = m.game;
    let regent = null;
    return [
      { ...wreckVehicles(g, () => (regent ? [regent] : []), 'Take down Dex Calloway\'s armored Regent', 420),
        setup: () => {
          regent = m.spawnVehicle('regent', -250, -60.5, Math.PI / 2);
          regent.controller = new FleeDriver(regent);
          m.addDriver(regent, 'thug');
          regent.tag = 'regent';
        } },
    ];
  },
};
