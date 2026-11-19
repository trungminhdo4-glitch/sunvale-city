// Seeded random numbers (mulberry32) so the city, traffic and screenshot scenes replay identically.

export class Rng {
  constructor(seed = 1) { this.reseed(seed); }
  reseed(seed) { this.state = (seed >>> 0) || 1; }
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(list) { return list[Math.floor(this.next() * list.length)]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
}

// The shared stream for gameplay; the city builder uses its own seeded stream.
export const rng = new Rng(20261119);
