// Subtitled dialogue: queues lines with a speaker colour and plays them over gameplay.
import { CAST } from '../mission/story.js';

export class Dialogue {
  constructor() {
    this.box = document.getElementById('subtitle');
    this.speaker = document.getElementById('subtitle-speaker');
    this.text = document.getElementById('subtitle-text');
    this.queue = [];
    this.t = 0;
    this.current = null;
  }
  get busy() { return !!this.current || this.queue.length > 0; }
  play(lines, onDone = null) {
    for (const [who, text] of lines) this.queue.push({ who, text });
    if (onDone) this.queue.push({ done: onDone });
  }
  clear() { this.queue = []; this.current = null; this.box.classList.add('hidden'); }
  show(who, text) {
    const c = CAST[who] ?? { name: who, color: '#ffffff' };
    this.speaker.textContent = c.name + ':';
    this.speaker.style.color = c.color;
    this.text.textContent = text;
    this.box.classList.remove('hidden');
  }
  update(dt) {
    if (this.current) {
      this.t -= dt;
      if (this.t > 0) return;
      this.current = null;
    }
    while (this.queue.length) {
      const next = this.queue.shift();
      if (next.done) { next.done(); continue; }
      this.current = next;
      this.t = 1.6 + next.text.length * 0.055;
      this.show(next.who, next.text);
      return;
    }
    this.box.classList.add('hidden');
  }
}
