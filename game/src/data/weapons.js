// The four weapons of Sunvale: fists and three guns, unlocked through the story.

export const WEAPONS = [
  { id: 'fists',   name: 'Fists',          damage: 14, rate: 0.45, range: 2.2,  spread: 0,     pellets: 1, mag: Infinity, icon: '✊' },
  { id: 'pistol',  name: 'Viper 9 Pistol', damage: 26, rate: 0.28, range: 70,   spread: 0.012, pellets: 1, mag: 14, icon: '⌐' },
  { id: 'smg',     name: 'Hornet SMG',     damage: 13, rate: 0.075, range: 55,  spread: 0.035, pellets: 1, mag: 32, icon: '≡' },
  { id: 'shotgun', name: 'Breaker 12',     damage: 11, rate: 0.85, range: 28,   spread: 0.09,  pellets: 8, mag: 6,  icon: '▬' },
];

export const weaponById = (id) => WEAPONS.find((w) => w.id === id);
