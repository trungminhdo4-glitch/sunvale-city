// In-car radio: two generative stations composed live with WebAudio (synthwave and beach lo-fi).

const STATIONS = [
  { name: 'Sunvale FM 98.4', host: 'Retro-wave for the boulevard', bpm: 104, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], lead: [76, 74, 72, 69, 72, 74, 76, 79], wave: 'sawtooth' },
  { name: 'Palm Radio 101.7', host: 'Low-tide beats', bpm: 82, chords: [[62, 65, 69, 72], [60, 64, 67, 71], [57, 60, 64, 67], [55, 59, 62, 65]], lead: [74, 0, 72, 69, 0, 67, 69, 0], wave: 'triangle' },
];

const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Radio {
  constructor(audio) {
    this.audio = audio;
    this.station = 0;
    this.on = false;
    this.step = 0;
    this.nextTime = 0;
  }

  get name() { return this.station < STATIONS.length ? STATIONS[this.station].name : 'Radio Off'; }

  cycle() {
    this.station = (this.station + 1) % (STATIONS.length + 1);
    this.step = 0;
    return this.name;
  }

  setPlaying(on) { this.on = on; }

  note(freq, when, dur, type, gain) {
    const a = this.audio, ctx = a.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = type === 'sawtooth' ? 1800 : 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.015); g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(f); f.connect(g); g.connect(a.music);
    o.start(when); o.stop(when + dur + 0.05);
  }

  drum(when, kind) {
    const a = this.audio, ctx = a.ctx;
    if (kind === 'kick') {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, when); o.frequency.exponentialRampToValueAtTime(40, when + 0.15);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.5, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
      o.connect(g); g.connect(a.music); o.start(when); o.stop(when + 0.3);
    } else {
      const s = ctx.createBufferSource(); s.buffer = a.noise;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 'hat' ? 7000 : 1500;
      const g = ctx.createGain(); g.gain.setValueAtTime(kind === 'hat' ? 0.08 : 0.25, when); g.gain.exponentialRampToValueAtTime(0.001, when + (kind === 'hat' ? 0.05 : 0.18));
      s.connect(f); f.connect(g); g.connect(a.music); s.start(when, Math.random() * 0.5); s.stop(when + 0.2);
    }
  }

  /** Schedules eighth notes a little ahead of the audio clock. */
  update() {
    const a = this.audio;
    if (!a.ctx || !this.on || this.station >= STATIONS.length) return;
    const st = STATIONS[this.station];
    const eighth = 60 / st.bpm / 2;
    const now = a.ctx.currentTime;
    if (this.nextTime < now) this.nextTime = now + 0.05;
    while (this.nextTime < now + 0.25) {
      const s = this.step, t = this.nextTime;
      const bar = Math.floor(s / 8) % st.chords.length;
      const chord = st.chords[bar];
      if (s % 8 === 0) for (const n of chord) this.note(hz(n), t, eighth * 7.5, st.wave === 'sawtooth' ? 'sawtooth' : 'sine', 0.035);
      this.note(hz(chord[0] - 12), t, eighth * 0.9, 'square', s % 2 ? 0.04 : 0.06);
      const ln = st.lead[s % st.lead.length];
      if (ln && (s % 16) >= 8) this.note(hz(ln), t, eighth * 1.6, st.wave, 0.05);
      if (s % 4 === 0) this.drum(t, 'kick');
      if (s % 8 === 4) this.drum(t, 'snare');
      this.drum(t, 'hat');
      this.step++;
      this.nextTime += eighth;
    }
  }
}
