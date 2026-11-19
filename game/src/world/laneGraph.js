// The road network as a graph: intersections are nodes, road segments are edges.
// Traffic follows lane curves through it; police route over it; pedestrians use the corner graph.

import { CITY, lineCoord } from '../core/config.js';

export class LaneGraph {
  constructor() {
    const n = CITY.lines;
    this.n = n;
    this.nodes = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      this.nodes.push({ id: i * n + j, i, j, x: lineCoord(i), z: lineCoord(j), links: [] });
    }
    for (const node of this.nodes) {
      const { i, j } = node;
      if (i > 0) node.links.push(this.id(i - 1, j));
      if (i < n - 1) node.links.push(this.id(i + 1, j));
      if (j > 0) node.links.push(this.id(i, j - 1));
      if (j < n - 1) node.links.push(this.id(i, j + 1));
    }
  }

  id(i, j) { return i * this.n + j; }
  node(id) { return this.nodes[id]; }

  nearestNode(x, z) {
    const i = Math.max(0, Math.min(this.n - 1, Math.round((x - lineCoord(0)) / CITY.cell)));
    const j = Math.max(0, Math.min(this.n - 1, Math.round((z - lineCoord(0)) / CITY.cell)));
    return this.nodes[this.id(i, j)];
  }

  /** Neighbour of `from` one step closer to target node (grid is complete, so greedy is exact). */
  stepToward(from, target) {
    const a = this.node(from), b = this.node(target);
    const di = b.i - a.i, dj = b.j - a.j;
    if (di === 0 && dj === 0) return from;
    if (Math.abs(di) >= Math.abs(dj)) return this.id(a.i + Math.sign(di), a.j);
    return this.id(a.i, a.j + Math.sign(dj));
  }

  /** Unit direction and right-hand vector of edge a -> b. */
  edgeFrame(a, b) {
    const A = this.node(a), B = this.node(b);
    const dx = Math.sign(B.x - A.x), dz = Math.sign(B.z - A.z);
    return { dx, dz, rx: dz, rz: -dx }; // right of travel on the ground plane (y up, heading 0 = +z)
  }

  /** Straight lane piece of edge a -> b, from intersection exit to the next intersection entry. */
  laneStraight(a, b) {
    const A = this.node(a), B = this.node(b);
    const f = this.edgeFrame(a, b);
    const h = CITY.roadWidth / 2, L = CITY.laneOffset;
    // our lane is to the LEFT of the centre line in screen space when +x is east; pick the side
    // that puts oncoming cars on the other lane consistently: offset by -right.
    const ox = -f.rx * L, oz = -f.rz * L;
    const p0 = { x: A.x + f.dx * h + ox, z: A.z + f.dz * h + oz };
    const p2 = { x: B.x - f.dx * h + ox, z: B.z - f.dz * h + oz };
    return { p0, p1: { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 }, p2, len: Math.hypot(p2.x - p0.x, p2.z - p0.z) };
  }

  /** Curve through intersection b, from edge a->b onto edge b->c. */
  laneTurn(a, b, c) {
    const s1 = this.laneStraight(a, b), s2 = this.laneStraight(b, c);
    const f1 = this.edgeFrame(a, b), f2 = this.edgeFrame(b, c);
    const p0 = s1.p2, p2 = s2.p0;
    let p1;
    if (f1.dx * f2.dx + f1.dz * f2.dz > 0.5) {
      p1 = { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 };
    } else {
      // corner where the two lane lines cross
      p1 = f1.dx !== 0 ? { x: p2.x, z: p0.z } : { x: p0.x, z: p2.z };
    }
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z) + Math.hypot(p2.x - p1.x, p2.z - p1.z);
    return { p0, p1, p2, len: Math.max(len * 0.92, 0.5) };
  }

  /** Random next node from b, avoiding a U-turn back to a. */
  pickNext(a, b, rnd) {
    const opts = this.node(b).links.filter((id) => id !== a);
    return opts.length ? rnd.pick(opts) : a;
  }

  /** Sidewalk corner positions for pedestrians: corner (i, j, sx, sz). */
  cornerPos(i, j, sx, sz) {
    const o = CITY.roadWidth / 2 + 1.5;
    return { x: lineCoord(i) + sx * o, z: lineCoord(j) + sz * o };
  }

  cornerNeighbours(c) {
    const out = [
      { ...c, sx: -c.sx }, { ...c, sz: -c.sz },
      { i: c.i + c.sx, j: c.j, sx: -c.sx, sz: c.sz },
      { i: c.i, j: c.j + c.sz, sx: c.sx, sz: -c.sz },
    ];
    return out.filter((k) => k.i >= 0 && k.j >= 0 && k.i < this.n && k.j < this.n
      && !(k.sz > 0 && k.j === this.n - 1) && !(k.sx > 0 && k.i === this.n - 1));
  }
}
