// AI drivers: shared pure-pursuit steering, a lane-following civilian driver and a fleeing driver.
import { wrapAngle, clamp } from '../core/mathUtil.js';
import { routeFrom } from './roadGraph.js';
import { rng } from '../core/rng.js';

// Points the car at (tx, tz) and holds a target speed.
export function steerToward(v, tx, tz, targetSpeed) {
  const desired = Math.atan2(tx - v.pos.x, tz - v.pos.z);
  let diff = wrapAngle(desired - v.yaw);
  const reversing = v.speed < -0.5;
  v.steer = clamp(diff * 2.2 * (reversing ? -1 : 1), -1, 1);
  const sp = v.speed;
  const turnSlow = Math.abs(diff) > 1.2 ? 0.45 : 1;
  const goal = targetSpeed * turnSlow;
  v.throttle = clamp((goal - sp) * 0.35, -1, 1);
  v.handbrake = false;
  return diff;
}

// Brakes for cars and people in the lane ahead.
export function obstacleAhead(game, v, range = 13) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let nearest = range;
  const check = (x, z, r) => {
    const dx = x - v.pos.x, dz = z - v.pos.z;
    const ahead = dx * fx + dz * fz;
    if (ahead < 1 || ahead > range) return;
    const side = Math.abs(dx * -fz + dz * fx);
    if (side < 1.6 + r) nearest = Math.min(nearest, ahead);
  };
  for (const o of game.vehicles) if (o !== v) check(o.pos.x, o.pos.z, o.radius);
  const p = game.player;
  if (!p.vehicle && p.alive) check(p.pos.x, p.pos.z, 0.4);
  return nearest < range ? nearest : null;
}

// Stays in lane, turns at random intersections, yields to anything ahead and flees when shot at.
export class LaneDriver {
  constructor(v, cruise = 12) {
    this.route = routeFrom(rng, v.pos.x, v.pos.z, v.yaw);
    this.cruise = cruise;
    this.panic = 0;
    this.stuck = 0;
    this.reverseT = 0;
  }
  update(v, dt) {
    const g = v.game;
    let wp = this.route.peek(0);
    while (Math.hypot(wp.x - v.pos.x, wp.z - v.pos.z) < 5.5) { this.route.shift(); wp = this.route.peek(0); }
    const next = this.route.peek(1);
    const slow = wp.slow || (next.slow && Math.hypot(wp.x - v.pos.x, wp.z - v.pos.z) < 18);
    let speed = this.panic > 0 ? this.cruise * 1.8 : slow ? 7.5 : this.cruise;
    if (this.panic > 0) this.panic -= dt;
    const block = obstacleAhead(g, v);
    if (block !== null && this.panic <= 0) speed = block < 7 ? 0 : Math.min(speed, (block - 6) * 1.5);
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      v.throttle = -0.8; v.steer = -0.6; v.handbrake = false;
      return;
    }
    steerToward(v, wp.x, wp.z, speed);
    if (speed === 0) { v.throttle = v.speed > 0.3 ? -1 : 0; v.handbrake = v.speed < 0.5; }
    if (speed > 3 && v.absSpeed < 0.6) this.stuck += dt; else this.stuck = 0;
    if (this.stuck > 2.5 && block === null) { this.reverseT = 1.2; this.stuck = 0; }
  }
}

// Races through the grid away from the player (Dex Calloway's escape).
export class FleeDriver extends LaneDriver {
  constructor(v) { super(v, 30); this.panic = 1e9; }
}
