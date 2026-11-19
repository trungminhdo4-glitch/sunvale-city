// Keyboard and mouse state with per-frame edges and pointer lock for mouse look.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.edges = new Set();
    this.buttons = new Set();
    this.buttonEdges = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.locked = false;
    this.onLockChange = null;

    addEventListener('keydown', (e) => {
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.edges.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.buttons.clear(); });
    canvas.addEventListener('mousedown', (e) => { this.buttons.add(e.button); this.buttonEdges.add(e.button); });
    addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    addEventListener('mousemove', (e) => {
      if (this.locked || this.buttons.size) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  requestLock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* pointer lock is optional: dragging also looks around */ }
  }
  releaseLock() { if (this.locked) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  pressed(code) { return this.edges.has(code); }
  mouseDown(b) { return this.buttons.has(b); }
  mousePressed(b) { return this.buttonEdges.has(b); }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
  takeMouse() { const m = { dx: this.dx, dy: this.dy }; this.dx = 0; this.dy = 0; return m; }
  endFrame() { this.edges.clear(); this.buttonEdges.clear(); this.wheel = 0; }
  clear() { this.keys.clear(); this.buttons.clear(); this.endFrame(); this.dx = this.dy = 0; }
}
