// Respect: every job, theft, escape and fight earns respect points (RP). Ranks unlock a bigger cut
// of every mission payout and tougher body armour, and a rank-up is announced on the HUD.

export const RANKS = [
  { name: 'Nobody',          rp: 0 },
  { name: 'Hustler',         rp: 400 },
  { name: 'Wheelman',        rp: 1100 },
  { name: 'Enforcer',        rp: 2200 },
  { name: 'Shot Caller',     rp: 3800 },
  { name: 'Kingpin',         rp: 6000 },
  { name: 'Legend of Sunvale', rp: 9000 },
];

// Respect for each kind of deed.
const DEEDS = {
  carjack:   { rp: 15, label: 'Carjacking' },
  steal:     { rp: 10, label: 'Car stolen' },
  thug:      { rp: 25, label: 'Crane\'s crew down' },
  cop:       { rp: 12, label: 'Officer down' },
  escape:    { rp: 35, label: 'Lost the heat', perStar: true },
  token:     { rp: 50, label: 'Sun Token' },
  wreck:     { rp: 20, label: 'Cruiser wrecked' },
  mission:   { rp: 0,  label: 'Mission passed' },
};

export class ProgressionSystem {
  constructor(world) {
    this.world = world;
    this.rp = 0;
    this.popup = null;     // { text, time } for the HUD's +RP flyout
    this.rankUpIn = 0;
  }

  get rank() {
    let k = 0;
    for (let i = 0; i < RANKS.length; i++) if (this.rp >= RANKS[i].rp) k = i;
    return k;
  }
  get rankName() { return RANKS[this.rank].name; }
  /** RP needed for the next rank, or null at the top. */
  get nextAt() { return RANKS[this.rank + 1]?.rp ?? null; }
  /** 0..1 progress through the current rank. */
  get rankProgress() {
    const lo = RANKS[this.rank].rp, hi = this.nextAt;
    return hi == null ? 1 : (this.rp - lo) / (hi - lo);
  }
  /** Mission payout multiplier: +6% per rank. */
  get payoutBonus() { return 1 + this.rank * 0.06; }
  /** Armour cap grows with rank (100 at Nobody, 150 at Legend). */
  get armorCap() { return 100 + Math.min(50, this.rank * 9); }

  /** Award respect for a deed; extra multiplies per-star deeds (the escape's star count). */
  earn(deed, extra = 1, amount = null) {
    const d = DEEDS[deed];
    if (!d) return 0;
    const rp = Math.round(amount ?? (d.perStar ? d.rp * Math.max(1, extra) : d.rp));
    if (rp <= 0) return 0;
    const before = this.rank;
    this.rp += rp;
    this.popup = { text: `+${rp} RP  ${d.label}`, time: 2.6 };
    if (this.rank > before) this.onRankUp();
    return rp;
  }

  /** The rank-up banner waits a moment so it never covers a MISSION PASSED banner. */
  onRankUp() { this.rankUpIn = 3.6; }

  update(dt) {
    if (this.popup && (this.popup.time -= dt) <= 0) this.popup = null;
    if (this.rankUpIn > 0 && (this.rankUpIn -= dt) <= 0) {
      const w = this.world;
      w.hud?.banner(`RANK UP: ${this.rankName.toUpperCase()}`, 'passed', `Mission cut +${Math.round((this.payoutBonus - 1) * 100)}% · armour up to ${this.armorCap}`);
      w.audio?.missionPassed();
    }
  }

  save() { return { rp: this.rp }; }
  load(data) { this.rp = data?.rp ?? 0; }
}
