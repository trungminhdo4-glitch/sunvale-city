// Weapon definitions and the player's arsenal (owned weapons, ammo, selection).

export const WEAPONS = {
  fists: { id: 'fists', name: 'Fists', slot: 1, melee: true, damage: 20, range: 1.9, rate: 0.42 },
  kestrel: { id: 'kestrel', name: 'Kestrel 9', slot: 2, damage: 28, range: 110, rate: 0.26, spread: 0.01, pellets: 1, sound: 'pistol', auto: false, maxAmmo: 180 },
  hornet: { id: 'hornet', name: 'Hornet SMG', slot: 3, damage: 15, range: 90, rate: 0.075, spread: 0.028, pellets: 1, sound: 'smg', auto: true, maxAmmo: 480 },
  breaker: { id: 'breaker', name: 'Breaker 12', slot: 4, damage: 13, range: 42, rate: 0.85, spread: 0.075, pellets: 8, sound: 'shotgun', auto: false, maxAmmo: 64 },
};
export const WEAPON_ORDER = ['fists', 'kestrel', 'hornet', 'breaker'];

export class Arsenal {
  constructor() { this.reset(); }
  reset() {
    this.ammo = { fists: Infinity };
    this.current = 'fists';
  }
  owns(id) { return id in this.ammo; }
  give(id, ammo) {
    const w = WEAPONS[id];
    const had = this.owns(id);
    this.ammo[id] = Math.min(w.maxAmmo ?? Infinity, (this.ammo[id] ?? 0) + ammo);
    if (!had) this.current = id;
    return !had;
  }
  get weapon() { return WEAPONS[this.current]; }
  get count() { return this.ammo[this.current]; }
  select(id) { if (this.owns(id) && (this.ammo[id] > 0)) this.current = id; }
  cycle(dir) {
    const owned = WEAPON_ORDER.filter((id) => this.owns(id) && this.ammo[id] > 0);
    const i = owned.indexOf(this.current);
    this.current = owned[(i + dir + owned.length) % owned.length];
  }
  consume() {
    if (this.current === 'fists') return true;
    if (this.ammo[this.current] <= 0) return false;
    this.ammo[this.current]--;
    if (this.ammo[this.current] <= 0) this.current = 'fists';
    return true;
  }
  toJSON() { const a = {}; for (const [k, v] of Object.entries(this.ammo)) if (k !== 'fists') a[k] = v; return { ammo: a, current: this.current }; }
  load(data) {
    this.reset();
    if (!data) return;
    for (const [k, v] of Object.entries(data.ammo ?? {})) if (WEAPONS[k]) this.ammo[k] = v;
    if (this.owns(data.current)) this.current = data.current;
  }
}
