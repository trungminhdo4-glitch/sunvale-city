// Car radio with three procedurally sequenced stations of original music, scheduled ahead on the WebAudio clock.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const STATIONS = [
  { name: 'Coast 88.4 · Golden Hour Synth', bpm: 100, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], style: 'synth' },
  { name: 'Sol FM 101.7 · Ritmo del Mar', bpm: 94, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], style: 'dembow' },
  { name: 'KBAY 96.1 · Harbor Funk', bpm: 108, chords: [[52, 55, 59, 62], [57, 60, 64, 67], [52, 55, 59, 62], [59, 62, 66, 69]], style: 'funk' },
  { name: 'Radio off', off: true },
];

export class Radio {
  constructor(audio) {
    this.audio = audio;
    this.index = 0;
    this.playing = false;
    this.step = 0;
    this.nextTime = 0;
  }
  get station() { return STATIONS[this.index]; }
  start() {
    const a = this.audio;
    if (!a.ready || this.playing) return;
    this.playing = true;
    this.nextTime = a.ctx.currentTime + 0.1;
  }
  stop() { this.playing = false; }
  next() {
    this.index = (this.index + 1) % STATIONS.length;
    this.step = 0;
    this.audio.ui('click');
    this.audio.game.events.emit('radioChanged', { station: this.station });
  }

  update() {
    const a = this.audio;
    if (!this.playing || !a.ready || this.station.off) { if (a.ready) this.nextTime = a.ctx.currentTime + 0.05; return; }
    const st = this.station, stepDur = 60 / st.bpm / 4;
    while (this.nextTime < a.ctx.currentTime + 0.25) {
      this.schedule(st, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  voice(t, freq, dur, type, gain, cutoff = 2400, detune = 0) {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.audio.music);
    o.start(t); o.stop(t + dur + 0.05);
  }
  drum(t, kind) {
    const a = this.audio, ctx = a.ctx;
    if (kind === 'kick') {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g); g.connect(a.music); o.start(t); o.stop(t + 0.3);
      return;
    }
    const src = ctx.createBufferSource(); src.buffer = a.noise;
    const f = ctx.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = ctx.createGain(); const dur = kind === 'hat' ? 0.05 : 0.18;
    g.gain.setValueAtTime(kind === 'hat' ? 0.18 : 0.45, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(a.music); src.start(t, (t * 7.3) % 1.5); src.stop(t + dur + 0.02);
  }

  schedule(st, step, t, sd) {
    const bar = Math.floor(step / 16), s = step % 16;
    const chord = st.chords[bar % st.chords.length];
    const root = chord[0];
    if (st.style === 'synth') {
      if (s === 0) for (const n of chord) { this.voice(t, midi(n), sd * 16, 'sawtooth', 0.05, 1400, -8); this.voice(t, midi(n), sd * 16, 'sawtooth', 0.05, 1400, 8); }
      if ([0, 3, 6, 8, 11, 14].includes(s)) this.voice(t, midi(root - 12), sd * 2, 'square', 0.12, 600);
      if (s % 2 === 0) this.voice(t, midi(chord[(s / 2) % chord.length] + 12), sd * 1.6, 'triangle', 0.07, 3000);
      if (s % 4 === 0) this.drum(t, 'kick');
      if (s === 4 || s === 12) this.drum(t, 'snare');
      if (s % 2 === 1) this.drum(t, 'hat');
    } else if (st.style === 'dembow') {
      if (s === 0 || s === 8) this.drum(t, 'kick');
      if ([3, 6, 11, 14].includes(s)) this.drum(t, 'snare');
      if (s % 2 === 0) this.drum(t, 'hat');
      if ([0, 3, 8, 11].includes(s)) this.voice(t, midi(root - 12), sd * 2.5, 'sine', 0.22, 800);
      const scale = [0, 3, 5, 7, 10, 12];
      if ([0, 2, 5, 7, 10, 13].includes(s)) this.voice(t, midi(root + 12 + scale[(s + bar * 3) % scale.length]), sd * 1.5, 'sine', 0.09, 5000);
      if (s === 0) for (const n of chord) this.voice(t, midi(n + 12), sd * 6, 'triangle', 0.035, 2000);
    } else {
      if ([0, 7, 10].includes(s)) this.drum(t, 'kick');
      if (s === 4 || s === 12) this.drum(t, 'snare');
      this.drum(t, 'hat');
      if ([0, 2, 3, 6, 8, 10, 11, 14].includes(s)) this.voice(t, midi(root - 12 + (s === 3 || s === 11 ? 12 : 0)), sd * 0.9, 'square', 0.1, 900);
      if ([2, 6, 10, 14].includes(s)) for (const n of chord) this.voice(t, midi(n + 12), sd * 0.6, 'square', 0.025, 2600);
      if (s === 0 && bar % 2 === 1) this.voice(t, midi(chord[3] + 12), sd * 6, 'sawtooth', 0.05, 1800);
    }
  }
}
