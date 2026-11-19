// Dynamic contacts: cars bumping cars, cars hitting people, people pushed out of parked cars.

const ca = [{}, {}], cb = [{}, {}];

export function resolveVehicleContacts(game) {
  const vs = game.vehicles;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    for (let j = i + 1; j < vs.length; j++) {
      const b = vs[j];
      const dx0 = b.pos.x - a.pos.x, dz0 = b.pos.z - a.pos.z;
      if (dx0 * dx0 + dz0 * dz0 > 64) continue;
      a.circles(ca); b.circles(cb);
      for (const p of ca) for (const q of cb) {
        const dx = q.x - p.x, dz = q.z - p.z, r = a.radius + b.radius, d2 = dx * dx + dz * dz;
        if (d2 >= r * r || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = r - d;
        const ma = a.wrecked ? a.spec.mass * 2 : a.spec.mass, mb = b.wrecked ? b.spec.mass * 2 : b.spec.mass, inv = 1 / (ma + mb);
        a.pos.x -= nx * pen * mb * inv; a.pos.z -= nz * pen * mb * inv;
        b.pos.x += nx * pen * ma * inv; b.pos.z += nz * pen * ma * inv;
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel < 0) {
          const jImp = -1.3 * rel / (1 / ma + 1 / mb);
          a.vx -= (jImp / ma) * nx; a.vz -= (jImp / ma) * nz;
          b.vx += (jImp / mb) * nx; b.vz += (jImp / mb) * nz;
          a.onImpact(-rel * mb * inv * 1.6, b);
          b.onImpact(-rel * ma * inv * 1.6, a);
          game.events.emit('vehicleCollision', { a, b, speed: -rel });
        }
      }
    }
  }
}

export function resolveCharacterVehicleContacts(game) {
  for (const c of game.characters) {
    if (c.vehicle) continue;
    for (const v of game.vehicles) {
      const dx0 = c.pos.x - v.pos.x, dz0 = c.pos.z - v.pos.z;
      if (dx0 * dx0 + dz0 * dz0 > 25) continue;
      if (c.pos.y > v.pos.y + v.spec.hgt) continue;
      v.circles(ca);
      for (const p of ca) {
        const dx = c.pos.x - p.x, dz = c.pos.z - p.z, r = v.radius + c.radius, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        const d = Math.sqrt(d2) || 0.001, nx = dx / d, nz = dz / d;
        c.pos.x += nx * (r - d); c.pos.z += nz * (r - d);
        const sp = v.absSpeed;
        const closing = v.vx * nx + v.vz * nz;
        if (sp > 4 && closing > 2 && c.alive) {
          c.knockback.set(v.vx * 0.9 + nx * 3, 0, v.vz * 0.9 + nz * 3);
          c.vel.y = Math.min(6, sp * 0.25);
          c.onGround = false;
          c.damage(sp * (c === game.player ? 2.2 : 7), v.driver, 'vehicle');
          v.vx *= 0.93; v.vz *= 0.93;
          game.audio?.thud(c.pos);
          game.events.emit('pedestrianHit', { victim: c, vehicle: v, speed: sp });
        }
      }
    }
  }
}
