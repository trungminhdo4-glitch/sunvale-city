// A tiny publish/subscribe bus: systems announce gunfire, deaths and crimes without knowing who listens.

export class EventBus {
  constructor() { this.listeners = new Map(); }
  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) {
    const list = this.listeners.get(name);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  emit(name, data) {
    const list = this.listeners.get(name);
    if (list) for (const fn of [...list]) fn(data);
  }
}
