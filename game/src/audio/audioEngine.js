// All sound is synthesised with WebAudio: engine, siren, guns, crashes, explosions, UI jingles.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  /** Must run from a user gesture (the title screen's buttons). */
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.45; this.music.connect(this.master);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // engine: two detuned oscillators through a lowpass
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600;
    this.engA = ctx.createOscillator(); this.engA.type = 'sawtooth';
    this.engB = ctx.createOscillator(); this.engB.type = 'square';
    this.engA.connect(this.engFilter); this.engB.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.sfx);
    this.engA.start(); this.engB.start();

    // siren
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.siren = ctx.createOscillator(); this.siren.type = 'triangle';
    this.siren.connect(this.sirenGain); this.sirenGain.connect(this.sfx);
    this.siren.start();

    // tyre squeal: band-passed noise loop
    this.skidSrc = ctx.createBufferSource(); this.skidSrc.buffer = this.noise; this.skidSrc.loop = true;
    this.skidFilter = ctx.createBiquadFilter(); this.skidFilter.type = 'bandpass'; this.skidFilter.frequency.value = 2400; this.skidFilter.Q.value = 6;
    this.skidGain = ctx.createGain(); this.skidGain.gain.value = 0;
    this.skidSrc.connect(this.skidFilter); this.skidFilter.connect(this.skidGain); this.skidGain.connect(this.sfx);
    this.skidSrc.start();
  }

  get t() { return this.ctx.currentTime; }

  burst({ dur = 0.2, freq = 1200, type = 'lowpass', gain = 0.6, q = 0.8, attack = 0.002 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  tone(freq, dur, { type = 'sine', gain = 0.25, when = 0, slide = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  gunshot(kind, distance = 0) {
    const att = Math.max(0.05, 1 - distance / 90);
    if (kind === 'shotgun') { this.burst({ dur: 0.45, freq: 900, gain: 0.9 * att }); this.tone(70, 0.25, { gain: 0.5 * att, slide: 0.5 }); }
    else if (kind === 'smg') this.burst({ dur: 0.09, freq: 2400, gain: 0.45 * att });
    else { this.burst({ dur: 0.18, freq: 1700, gain: 0.65 * att }); this.tone(110, 0.12, { gain: 0.3 * att, slide: 0.5 }); }
  }

  explosion(v = 1) {
    this.burst({ dur: 1.8, freq: 380, gain: 1.0 * v, q: 0.5 });
    this.tone(55, 1.2, { gain: 0.8 * v, slide: 0.4 });
  }

  crash(v) { this.burst({ dur: 0.35, freq: 700, gain: 0.7 * v }); this.tone(180, 0.3, { type: 'square', gain: 0.12 * v, slide: 0.6 }); }
  thud() { this.tone(90, 0.15, { gain: 0.4, slide: 0.5 }); this.burst({ dur: 0.08, freq: 500, gain: 0.3 }); }
  whoosh() { this.burst({ dur: 0.15, freq: 900, type: 'bandpass', gain: 0.25, q: 2 }); }
  click() { this.tone(1800, 0.03, { type: 'square', gain: 0.06 }); }
  radioBlip() { this.burst({ dur: 0.09, freq: 2400, type: 'bandpass', gain: 0.18, q: 3 }); this.tone(1250, 0.07, { type: 'square', gain: 0.05, when: 0.06 }); }
  door() { this.burst({ dur: 0.12, freq: 400, gain: 0.35 }); this.tone(140, 0.1, { gain: 0.2 }); }
  pickup() { this.tone(880, 0.12, { gain: 0.2 }); this.tone(1320, 0.2, { gain: 0.2, when: 0.08 }); }
  wantedUp() { this.tone(660, 0.1, { type: 'square', gain: 0.08 }); this.tone(520, 0.14, { type: 'square', gain: 0.08, when: 0.1 }); }

  jingle(notes, step = 0.12, type = 'triangle') {
    notes.forEach((n, i) => this.tone(440 * Math.pow(2, (n - 69) / 12), step * 2.2, { type, gain: 0.18, when: i * step }));
  }
  missionStart() { this.jingle([62, 66, 69, 74]); }
  missionPassed() { this.jingle([69, 73, 76, 81, 76, 81, 85], 0.11, 'square'); }
  missionFailed() { this.jingle([69, 65, 62, 57], 0.18, 'sawtooth'); }
  wasted() { this.tone(220, 2.2, { type: 'sawtooth', gain: 0.18, slide: 0.25 }); }

  /** Per-frame engine pitch from speed and throttle; null car silences it. */
  setEngine(car, throttle, skid) {
    if (!this.ctx) return;
    const t = this.t;
    if (!car || car.dead) { this.engGain.gain.setTargetAtTime(0, t, 0.1); this.skidGain.gain.setTargetAtTime(0, t, 0.05); return; }
    const sp = Math.abs(car.speed) / car.spec.maxSpeed;
    const gear = Math.min(4, Math.floor(sp * 5));
    const rpm = 0.25 + ((sp * 5 - gear) * 0.6) + Math.abs(throttle) * 0.15;
    const base = car.type === 'pelican' || car.type === 'ridgeback' ? 38 : car.type === 'brute' ? 34 : 46;
    this.engA.frequency.setTargetAtTime(base + rpm * base * 2.2, t, 0.05);
    this.engB.frequency.setTargetAtTime((base + rpm * base * 2.2) * 0.502, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(400 + rpm * 1600 + Math.abs(throttle) * 600, t, 0.05);
    this.engGain.gain.setTargetAtTime(0.06 + Math.abs(throttle) * 0.07, t, 0.08);
    this.skidGain.gain.setTargetAtTime(skid > 0.35 && Math.abs(car.speed) > 6 ? skid * 0.18 : 0, t, 0.05);
  }

  setSiren(distance) {
    if (!this.ctx) return;
    const t = this.t;
    const g = distance < 160 ? 0.09 * (1 - distance / 160) : 0;
    this.sirenGain.gain.setTargetAtTime(g, t, 0.1);
    this.siren.frequency.setValueAtTime(700 + Math.sin(t * 5) * 260 + (Math.sin(t * 0.7) > 0 ? 120 : 0), t);
  }
}
