// Runs the story: mission givers on the map, dialogue, step objectives, rewards, pass and fail.

import { MISSIONS, CHARACTERS } from '../data/story.js';
import { Vehicle } from '../actors/vehicle.js';
import { Npc } from '../actors/npc.js';
import { createBeacon, createHoverArrow, createCheckpointRing } from '../fx/markers.js';
import { TRAFFIC } from '../core/config.js';

export class MissionSystem {
  constructor(world) {
    this.world = world;
    this.completed = new Set();
    this.called = new Set();   // jobs whose contact has already phoned
    this.active = null;
    this.step = null;
    this.stepIndex = 0;
    this.timer = 0;
    this.lines = [];
    this.lineTime = 0;
    this.giverBeacon = null;
    this.giverFor = null;
    this.cooldown = 2;
    this.entities = { car: null, thugs: [], points: [], markers: [] };
  }

  get next() { return MISSIONS.find((m) => !this.completed.has(m.id)) ?? null; }
  get progress() { return this.completed.size / MISSIONS.length; }

  placeOf(name) { return this.world.plan.places[name]; }

  /** What the minimap and HUD should point at right now. */
  get target() {
    if (!this.active) { const m = this.next; return m ? { ...this.placeOf(m.place), kind: 'giver', icon: CHARACTERS[m.giver].name[0] } : null; }
    const s = this.step, e = this.entities;
    if (!s) return null;
    if (s.type === 'getIn' && e.car) return { x: e.car.pos.x, z: e.car.pos.z, kind: 'car' };
    if (s.type === 'wreck' && e.car) return { x: e.car.pos.x, z: e.car.pos.z, kind: 'enemy' };
    if ((s.type === 'drive' || s.type === 'goto') && s.needCar && this.world.player.vehicle !== e.car && e.car && !e.car.dead) return { x: e.car.pos.x, z: e.car.pos.z, kind: 'car' };
    if (s.type === 'drive' || s.type === 'goto') return s.place ? { ...this.placeOf(s.place), kind: 'dest' } : { x: s.target[0], z: s.target[1], kind: 'dest' };
    if (s.type === 'collect') { const p = e.points.find((q) => !q.done); return p ? { x: p.x, z: p.z, kind: 'dest' } : null; }
    if (s.type === 'eliminate') { const t = e.thugs.find((q) => !q.dead); return t ? { x: t.pos.x, z: t.pos.z, kind: 'enemy' } : null; }
    return null;
  }

  get objective() {
    if (!this.active) return this.idleObjective();
    const m = this.active, nextStep = m.steps[this.stepIndex + 1];
    return {
      title: m.title,
      text: this.stepText(),
      timer: this.step?.time ? Math.max(0, this.step.time - this.timer) : null,
      number: MISSIONS.indexOf(m) + 1,
      total: MISSIONS.length,
      giver: CHARACTERS[m.giver].name,
      stage: Math.min(this.stepIndex + 1, m.steps.length),
      stages: m.steps.length,
      stepProgress: this.stepProgress(),
      next: nextStep ? nextStep.text.replace(/~/g, '') : 'Collect the payout',
    };
  }

  /** Between missions the card points at the next job: who, where and how far. */
  idleObjective() {
    const m = this.next;
    if (!m) return null;
    const p = this.placeOf(m.place), pl = this.world.player.pos;
    const dist = Math.hypot(p.x - pl.x, p.z - pl.z);
    return {
      idle: true, title: m.title, number: MISSIONS.indexOf(m) + 1, total: MISSIONS.length,
      giver: CHARACTERS[m.giver].name, stage: 0, stages: m.steps.length, stepProgress: 0,
      text: `Meet ~${CHARACTERS[m.giver].name}~ at ${p.label ?? 'the yellow marker'}.`,
      next: `${Math.round(dist)} m · pays $${Math.round(m.reward * (this.world.progress?.payoutBonus ?? 1) / 10) * 10}`,
      timer: null,
    };
  }

  /** 0..1 progress inside the current step, for the HUD's stage bar. */
  stepProgress() {
    const s = this.step, e = this.entities;
    if (!s) return 0;
    if (s.type === 'collect' && e.points.length) return e.points.filter((p) => p.done).length / e.points.length;
    if (s.type === 'eliminate' && e.thugs.length) return e.thugs.filter((t) => t.dead).length / e.thugs.length;
    if (s.type === 'wreck' && e.target) return 1 - Math.max(0, e.target.health) / (e.target.spec.health * 3.5);
    if (s.type === 'evade') return this.world.wanted.level === 0 ? 1 : Math.min(1, this.world.wanted.evade / this.world.wanted.evadeNeeded);
    return 0;
  }

  stepText() {
    const s = this.step;
    if (!s) return '';
    const e = this.entities;
    if (s.needCar && e.car && this.world.player.vehicle !== e.car && !e.car.dead && s.type !== 'getIn') return 'Get back in the ~vehicle~.';
    if (s.type === 'collect') return `${s.text} ${e.points.filter((p) => p.done).length}/${e.points.length}`;
    if (s.type === 'eliminate') return `${s.text} ${e.thugs.filter((t) => t.dead).length}/${e.thugs.length}`;
    return s.text;
  }

  say(lines) {
    this.lines.push(...lines);
    if (this.lineTime <= 0) this.lineTime = 0.01;
  }

  start(m) {
    const w = this.world;
    this.active = m;
    this.stepIndex = -1;
    this.clearGiver();
    w.hud.banner(m.title, 'mission');
    w.audio?.missionStart();
    this.say(m.intro);
    this.nextStep();
  }

  nextStep() {
    this.cleanupStepMarkers();
    this.stepIndex++;
    this.timer = 0;
    this.step = this.active.steps[this.stepIndex] ?? null;
    if (!this.step) { this.pass(); return; }
    const s = this.step, w = this.world, e = this.entities;
    if (s.say) this.say(s.say);
    if (s.type === 'getIn') {
      const sp = s.spawn;
      const v = new Vehicle(sp.model, sp.color, sp.x, sp.z, sp.heading);
      v.mission = true;
      w.traffic.addVehicle(v);
      e.car = v;
      e.arrow = createHoverArrow(w.scene, 0x5fd0ff);
    }
    if ((s.type === 'drive' || s.type === 'goto')) {
      const p = s.place ? this.placeOf(s.place) : { x: s.target[0], z: s.target[1] };
      e.markers.push(createBeacon(w.scene, 0xffd23f, s.radius > 12 ? 6 : 3.2));
      e.markers.at(-1).group.position.set(p.x, 0, p.z);
    }
    if (s.type === 'collect') {
      e.points = s.points.map(([x, z]) => {
        const mk = s.ring ? createCheckpointRing(w.scene) : createBeacon(w.scene, 0x5cff8a, 1.6);
        (mk.mesh ?? mk.group).position.x = x; (mk.mesh ?? mk.group).position.z = z;
        return { x, z, done: false, mk };
      });
    }
    if (s.type === 'eliminate') {
      e.thugs = s.spawn.map(([x, z], k) => {
        const n = new Npc(w.scene, 'thug', x, z);
        n.health = 90;
        if (s.boss && k === 0) {
          // Silas Crane: white suit, grey hair, tough
          n.health = 260;
          n.isBoss = true;
          n.model.torso.material = n.model.torso.material.clone();
          n.model.torso.material.color.setHex(0xf1efe8);
        }
        w.npcs.push(n);
        return n;
      });
    }
    if (s.type === 'wreck') {
      const sp = s.spawn, g = w.lanes;
      const v = w.traffic.spawnOnLane(sp.model, g.id(...sp.node), g.id(...sp.to), 0.2, 'ai');
      v.model.bodyMat.color.setHex(sp.color);
      v.mission = true;
      v.driver = 'thug';
      v.ai.cruise = TRAFFIC.cruiseSpeed * 1.9;
      v.health = v.spec.health * 3.5;
      e.target = v;
      e.car = e.car ?? null;
      e.targetArrow = createHoverArrow(w.scene, 0xff4040);
    }
    if (s.type === 'evade') {
      if (s.stars) { w.wanted.setLevel(s.stars); w.wanted.evade = 0; }
      if (s.skip) { this.nextStep(); return; }
    }
  }

  cleanupStepMarkers() {
    const e = this.entities;
    for (const m of e.markers) m.dispose();
    e.markers = [];
    for (const p of e.points) p.mk.dispose();
    e.points = [];
    e.arrow?.dispose(); e.arrow = null;
    e.targetArrow?.dispose(); e.targetArrow = null;
  }

  cleanupAll() {
    this.cleanupStepMarkers();
    const e = this.entities, w = this.world;
    for (const t of e.thugs) { t.remove(); const i = w.npcs.indexOf(t); if (i >= 0) w.npcs.splice(i, 1); }
    e.thugs = [];
    if (e.car) e.car.mission = false;
    if (e.target) { e.target.mission = false; if (e.target.driver === 'thug') e.target.driver = 'ai'; }
    e.car = null; e.target = null;
    this.step = null;
    this.active = null;
  }

  pass() {
    const w = this.world, m = this.active;
    this.completed.add(m.id);
    const pay = Math.round(m.reward * (w.progress?.payoutBonus ?? 1) / 10) * 10;
    w.state.money += pay;
    w.progress?.earn('mission', 1, m.reward / 8);
    if (m.unlock) w.combat.give(m.unlock[0], m.unlock[1]);
    w.hud.banner('MISSION PASSED', 'passed', `+$${pay.toLocaleString('en-US')}`);
    w.audio?.missionPassed();
    this.say(m.outro);
    this.cleanupAll();
    this.cooldown = 6;
    if (this.completed.size === MISSIONS.length) setTimeout(() => w.hud.banner('SUNVALE IS YOURS', 'passed', 'The story is complete. The city stays open.'), 6500);
    w.save?.();
  }

  fail(reason) {
    if (!this.active) return;
    const w = this.world;
    w.hud.banner('MISSION FAILED', 'failed', reason);
    w.audio?.missionFailed();
    this.cleanupAll();
    this.lines = [];
    this.cooldown = 5;
  }

  clearGiver() { this.giverBeacon?.dispose(); this.giverBeacon = null; this.giverFor = null; }

  update(dt) {
    const w = this.world, t = w.time, pl = w.player;
    this.updateDialogue(dt);
    this.cooldown -= dt;
    if (!this.active) {
      const m = this.next;
      if (!m) return;
      if (this.giverFor !== m) {
        // the contact phones in once when their job opens up
        if (m.call && !this.called.has(m.id)) { this.called.add(m.id); this.say([[m.giver, `📞 ${m.call}`]]); }
        this.clearGiver();
        const p = this.placeOf(m.place);
        this.giverBeacon = createBeacon(w.scene, 0xffd23f, 2.2);
        this.giverBeacon.group.position.set(p.x, 0, p.z);
        this.giverFor = m;
      }
      this.giverBeacon.update(t);
      const p = this.placeOf(m.place);
      const slow = !pl.inCar || Math.abs(pl.vehicle.speed) < 4;
      if (this.cooldown <= 0 && slow && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < 3.4 && w.wanted.level === 0) this.start(m);
      return;
    }
    const s = this.step, e = this.entities;
    if (!s) return;
    this.timer += dt;
    for (const m of e.markers) m.update(t);
    for (const p of e.points) p.mk.update?.(t);
    if (e.arrow && e.car) e.arrow.follow(e.car.pos.x, 4.2, e.car.pos.z, t);
    if (e.targetArrow && e.target) e.targetArrow.follow(e.target.pos.x, 4.6, e.target.pos.z, t);
    if (e.car && e.car.dead && (s.type === 'getIn' || s.needCar)) { this.fail('The vehicle was destroyed.'); return; }
    if (s.time && this.timer > s.time) { this.fail('Out of time.'); return; }

    switch (s.type) {
      case 'getIn':
        if (pl.vehicle === e.car) {
          if (s.wanted) w.wanted.setLevel(Math.max(w.wanted.level, s.wanted));
          this.nextStep();
        }
        break;
      case 'goto':
      case 'drive': {
        const p = s.place ? this.placeOf(s.place) : { x: s.target[0], z: s.target[1] };
        const okCar = !s.needCar || pl.vehicle === e.car;
        if (okCar && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < s.radius) this.nextStep();
        break;
      }
      case 'collect': {
        const reach = pl.inCar ? 7 : 2.6;
        const okCar = !s.needCar || pl.vehicle === e.car;
        const list = s.ring ? [e.points.find((q) => !q.done)].filter(Boolean) : e.points;
        for (const p of e.points) (p.mk.mesh ?? p.mk.group).visible = !p.done && (!s.ring || p === list[0]);
        for (const p of list) {
          if (okCar && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < reach) {
            p.done = true;
            w.audio?.pickup();
            if (!s.ring) w.state.money += 50;
          }
        }
        if (e.points.every((p) => p.done)) this.nextStep();
        break;
      }
      case 'eliminate': {
        for (const n of e.thugs) {
          if (n.dead) { n.animate(dt); continue; }
          const d = Math.hypot(n.pos.x - pl.pos.x, n.pos.z - pl.pos.z);
          if (d < 46) n.fight(dt, w, pl.pos, { range: 40, keep: n.isBoss ? 16 : 9, accuracy: 0.4, damage: n.isBoss ? 9 : 6 });
          else { n.aiming = false; n.speed = 0; }
          w.peds.checkCars(n);
          n.animate(dt);
        }
        if (e.thugs.every((n) => n.dead)) this.nextStep();
        break;
      }
      case 'wreck':
        if (e.target.dead) { this.nextStep(); break; }
        if (this.timer > 8 && Math.hypot(e.target.pos.x - pl.pos.x, e.target.pos.z - pl.pos.z) > 520) this.fail('Crane\'s convoy got away.');
        break;
      case 'evade':
        if (w.wanted.level === 0) this.nextStep();
        break;
    }
  }

  updateDialogue(dt) {
    if (this.lineTime <= 0) return;
    this.lineTime -= dt;
    if (this.lineTime <= 0 && this.lines.length) {
      const [who, text] = this.lines.shift();
      this.lineTime = 2.2 + text.length * 0.045;
      this.world.hud.say(who, text, this.lineTime, 'story');
    }
  }

  /** Thugs left over in eliminate steps count as Crane's men for crimes. */
  isMissionNpc(n) { return this.entities.thugs.includes(n); }
}
