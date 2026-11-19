// Every sound is synthesized with WebAudio: engines, gunshots, sirens, horns, impacts, explosions and UI cues.

export class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.listener = { x: 0, y: 0, z: 0 };
    this.hornOn = false;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.comp);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.38; this.music.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.buildEngine();
    this.buildSiren();
    this.buildHorn();
    this.buildRotor();
  }
  get ready() { return !!this.ctx; }

  volumeAt(pos, ref = 18) {
    if (!pos) return 1;
    const l = this.listener;
    const d = Math.hypot(pos.x - l.x, (pos.y ?? 0) - l.y, pos.z - l.z);
    return 1 / (1 + d / ref);
  }

  noiseBurst({ dur = 0.2, freq = 1200, q = 0.7, type = 'lowpass', gain = 0.5, pos = null, attack = 0.002, sweep = null, dest = null }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain();
    const v = gain * this.volumeAt(pos);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest ?? this.sfx);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  tone({ freq = 440, end = null, type = 'sine', dur = 0.2, gain = 0.3, pos = null, delay = 0, dest = null }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (end) o.frequency.exponentialRampToValueAtTime(end, t + dur);
    const g = ctx.createGain();
    const v = gain * this.volumeAt(pos);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  shot(kind, pos) {
    if (kind === 'shotgun') {
      this.noiseBurst({ dur: 0.35, freq: 1500, sweep: 300, gain: 0.9, pos });
      this.tone({ freq: 110, end: 40, type: 'triangle', dur: 0.25, gain: 0.6, pos });
    } else if (kind === 'smg') {
      this.noiseBurst({ dur: 0.08, freq: 3000, sweep: 800, gain: 0.45, pos });
      this.tone({ freq: 180, end: 70, type: 'square', dur: 0.05, gain: 0.12, pos });
    } else {
      this.noiseBurst({ dur: 0.16, freq: 2600, sweep: 500, gain: 0.65, pos });
      this.tone({ freq: 150, end: 55, type: 'triangle', dur: 0.12, gain: 0.4, pos });
    }
  }
  explosion(pos) {
    this.noiseBurst({ dur: 1.8, freq: 900, sweep: 80, gain: 1.4, pos, attack: 0.01 });
    this.tone({ freq: 70, end: 25, type: 'sine', dur: 1.2, gain: 0.9, pos });
  }
  impact(speed, pos) { this.noiseBurst({ dur: 0.22, freq: 700, sweep: 150, gain: Math.min(0.9, speed / 25), pos }); this.tone({ freq: 90, end: 50, dur: 0.15, gain: Math.min(0.5, speed / 40), pos }); }
  thud(pos) { this.tone({ freq: 120, end: 45, type: 'sine', dur: 0.18, gain: 0.5, pos }); this.noiseBurst({ dur: 0.1, freq: 500, gain: 0.3, pos }); }
  punch(hit) { this.noiseBurst({ dur: 0.09, freq: hit ? 900 : 2000, sweep: hit ? 200 : 900, gain: hit ? 0.5 : 0.15, type: hit ? 'lowpass' : 'bandpass' }); }

  ui(kind) {
    const T = (f, d, g = 0.18, type = 'triangle', delay = 0) => this.tone({ freq: f, dur: d, gain: g, type, delay });
    switch (kind) {
      case 'click': T(880, 0.06, 0.08); break;
      case 'pickup': T(660, 0.08); T(990, 0.12, 0.18, 'triangle', 0.07); break;
      case 'token': [784, 988, 1175, 1568].forEach((f, i) => T(f, 0.18, 0.16, 'sine', i * 0.07)); break;
      case 'money': T(1200, 0.05, 0.1, 'square'); T(1600, 0.08, 0.1, 'square', 0.05); break;
      case 'wanted': T(520, 0.12, 0.14, 'square'); T(390, 0.2, 0.14, 'square', 0.12); break;
      case 'mission': [523, 659, 784, 1047].forEach((f, i) => T(f, 0.35, 0.2, 'triangle', i * 0.12)); break;
      case 'fail': [392, 330, 262].forEach((f, i) => T(f, 0.4, 0.2, 'sawtooth', i * 0.18)); break;
      case 'objective': T(740, 0.1, 0.14); T(988, 0.16, 0.14, 'triangle', 0.09); break;
      case 'cuffed': T(300, 0.3, 0.2, 'square'); T(200, 0.5, 0.2, 'square', 0.25); break;
      default: T(600, 0.1);
    }
  }

  buildEngine() {
    const ctx = this.ctx;
    this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth';
    this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square';
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilter); this.engOsc2.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.sfx);
    this.engOsc.start(); this.engOsc2.start();
  }
  buildSiren() {
    const ctx = this.ctx;
    this.sirOsc = ctx.createOscillator(); this.sirOsc.type = 'square';
    this.sirFilter = ctx.createBiquadFilter(); this.sirFilter.type = 'bandpass'; this.sirFilter.frequency.value = 1100; this.sirFilter.Q.value = 1.2;
    this.sirGain = ctx.createGain(); this.sirGain.gain.value = 0;
    this.sirOsc.connect(this.sirFilter); this.sirFilter.connect(this.sirGain); this.sirGain.connect(this.sfx);
    this.sirOsc.start();
    this.sirPhase = 0;
  }
  buildHorn() {
    const ctx = this.ctx;
    this.hornGain = ctx.createGain(); this.hornGain.gain.value = 0; this.hornGain.connect(this.sfx);
    for (const f of [392, 494]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; const fl = ctx.createBiquadFilter(); fl.frequency.value = 1400; o.connect(fl); fl.connect(this.hornGain); o.start(); }
  }
  buildRotor() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    this.rotorGain = ctx.createGain(); this.rotorGain.gain.value = 0;
    this.rotorLfo = ctx.createGain(); this.rotorLfo.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 11; lfo.connect(this.rotorLfo); this.rotorLfo.connect(this.rotorGain.gain);
    src.connect(f); f.connect(this.rotorGain); this.rotorGain.connect(this.sfx);
    src.start(); lfo.start();
  }

  horn(on) {
    if (!this.ctx || on === this.hornOn) return;
    this.hornOn = on;
    this.hornGain.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.02);
    if (on) this.game.events.emit('horn', {});
  }

  update(dt, camera) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, g = this.game;
    this.listener.x = camera.position.x; this.listener.y = camera.position.y; this.listener.z = camera.position.z;
    const v = g.player?.vehicle;
    if (v && g.state === 'play') {
      const rpm = Math.min(1, Math.abs(v.speed) / v.spec.maxSpeed);
      const gearRpm = (rpm * 4) % 1;
      const f = 45 + rpm * 90 + gearRpm * 55 + Math.abs(v.throttle) * 18;
      this.engOsc.frequency.setTargetAtTime(f, t, 0.05);
      this.engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      this.engFilter.frequency.setTargetAtTime(400 + rpm * 1400 + Math.abs(v.throttle) * 600, t, 0.08);
      this.engGain.gain.setTargetAtTime(v.wrecked ? 0 : 0.07 + Math.abs(v.throttle) * 0.06, t, 0.1);
    } else this.engGain.gain.setTargetAtTime(0, t, 0.1);

    let sirenVol = 0;
    if (g.state === 'play') for (const c of g.vehicles) if (c.sirenOn && !c.wrecked) sirenVol = Math.max(sirenVol, this.volumeAt(c.pos, 25));
    this.sirPhase += dt;
    const wail = 900 + Math.sin(this.sirPhase * 2.2) * 350;
    this.sirOsc.frequency.setTargetAtTime(wail, t, 0.03);
    this.sirGain.gain.setTargetAtTime(sirenVol * 0.09, t, 0.1);

    let rotor = 0;
    if (g.state === 'play') for (const h of g.police.helis) if (!h.dead) rotor = Math.max(rotor, this.volumeAt(h.pos, 30));
    this.rotorGain.gain.setTargetAtTime(rotor * 0.35, t, 0.2);
    this.rotorLfo.gain.setTargetAtTime(rotor * 0.3, t, 0.2);
  }

  setMusicLevel(v) { if (this.ctx) this.music.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4); }
}
