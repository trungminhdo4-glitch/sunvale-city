// "Heat Rises": Kai Navarro comes home to Sunvale and takes on Silas Crane, the harbour baron
// who bought the city's police and is pushing Mama Lu out of Old Mission. Every name is original.

export const CHARACTERS = {
  kai:   { name: 'Kai Navarro', color: '#3fd0c9' },
  lu:    { name: 'Mama Lu', color: '#ffb86b' },
  dex:   { name: 'Dex Ortega', color: '#ff7a7a' },
  rosa:  { name: 'Rosa Vance', color: '#8fb8ff' },
  juno:  { name: 'Juno Park', color: '#d59bff' },
  silas: { name: 'Silas Crane', color: '#c9c9c9' },
};

// Step types: goto, getIn, drive, collect, eliminate, wreck, evade. Coordinates are world x/z.
export const MISSIONS = [
  {
    id: 'homecoming', title: 'Back in Sunvale', giver: 'lu', place: 'diner', reward: 600,
    intro: [
      ['lu', 'Kai! Six years and not one postcard. Sit, eat. Then do me a favour.'],
      ['lu', 'My old Cortessa is out back. Run it to Dex Ortega in the Yards before Crane\'s men tow it.'],
      ['kai', 'Good to be home, Lu. Keys?'],
    ],
    steps: [
      { type: 'getIn', text: 'Get in Lu\'s ~Cortessa~.', spawn: { model: 'cortessa', color: 0xff8c6b, x: 165.5, z: -108, heading: Math.PI } },
      { type: 'drive', text: 'Drive to ~Ortega Bodyworks~.', place: 'bodyworks', radius: 7 },
    ],
    outro: [['dex', 'Lu\'s car! Kai Navarro, alive. Come back when you want real work.']],
  },
  {
    id: 'borrowed', title: 'Borrowed Wheels', giver: 'dex', place: 'bodyworks', reward: 1500, unlock: ['smg', 90],
    intro: [
      ['dex', 'There\'s a Mirage GT up in Palm Heights. Crane\'s nephew owns it. Not anymore.'],
      ['dex', 'Bring it here without a scratch and I\'ll set you up with something louder than that pistol.'],
    ],
    steps: [
      { type: 'getIn', text: 'Steal the ~Mirage GT~ in Palm Heights.', spawn: { model: 'mirage', color: 0xff3d3d, x: -250, z: -154.5, heading: Math.PI / 2 }, wanted: 1 },
      { type: 'drive', text: 'Bring the Mirage to ~Ortega Bodyworks~.', place: 'bodyworks', radius: 7, needCar: true },
    ],
    outro: [['dex', 'Beautiful. Take the Hornet. You\'ll need it with the heat you\'re about to bring.']],
  },
  {
    id: 'boardwalk', title: 'Boardwalk Payday', giver: 'lu', place: 'diner', reward: 1200,
    intro: [
      ['lu', 'Crane\'s collectors squeezed every shop on the boardwalk. They stash the cash in the beach huts.'],
      ['lu', 'Grab it back before the evening shift picks it up. Ninety seconds, mijo.'],
    ],
    steps: [
      { type: 'collect', text: 'Recover the ~cash bags~ on the beachfront.', points: [[-250, 318], [-20, 318], [70, 318], [180, 318]], time: 120 },
      { type: 'drive', text: 'Bring the money back to ~Lu\'s Diner~.', place: 'diner', radius: 7 },
    ],
    outro: [['lu', 'Every dollar back where it belongs. Crane will notice. Good.']],
  },
  {
    id: 'dockrats', title: 'Dock Rats', giver: 'rosa', place: 'marina', reward: 2500, unlock: ['shotgun', 24],
    intro: [
      ['rosa', 'You\'re the one who\'s been embarrassing Crane? I run this harbour. Or I did.'],
      ['rosa', 'His crew is unloading something at the container yard. Clear them out.'],
    ],
    steps: [
      { type: 'goto', text: 'Go to the ~container yard~.', target: [330, -150], radius: 30 },
      { type: 'eliminate', text: 'Take out ~Crane\'s crew~.', spawn: [[320, -170], [336, -132], [312, -116], [345, -180], [326, -98], [300, -150]] },
    ],
    outro: [['rosa', 'Rifles, in my harbour. Take the Breaker 12 from the crate. You earned it.']],
  },
  {
    id: 'hotcargo', title: 'Hot Cargo', giver: 'rosa', place: 'marina', reward: 3000,
    intro: [
      ['rosa', 'Those crates hold Crane\'s ledgers. The police are on his payroll and they\'re coming for them.'],
      ['rosa', 'Take the Pelican van, lose the cops, and park it at your flat on the beachfront.'],
    ],
    steps: [
      { type: 'getIn', text: 'Get in the ~Pelican van~.', spawn: { model: 'pelican', color: 0xffffff, x: 296, z: 60, heading: Math.PI }, wanted: 3 },
      { type: 'evade', text: '~Lose the cops~ in the van.', needCar: true },
      { type: 'drive', text: 'Deliver the van to ~Kai\'s Flat~.', place: 'safehouse', radius: 8, needCar: true },
    ],
    outro: [['kai', 'Payoffs to half of SVPD, signed by Silas Crane himself. Now we have leverage.']],
  },
  {
    id: 'streetrace', title: 'Coastline Sprint', giver: 'juno', place: 'raceStart', reward: 2000,
    intro: [
      ['juno', 'You\'re the new driver everyone\'s talking about? Prove it. Shoreline loop, every checkpoint.'],
    ],
    steps: [
      { type: 'getIn', text: 'Get in the ~Brute 77~.', spawn: { model: 'brute', color: 0x6a0dad, x: 52, z: 229.5, heading: -Math.PI / 2 } },
      { type: 'collect', text: 'Hit every ~checkpoint~.', points: [[-96, 224], [-96, 288], [-224, 288], [-288, 160], [-160, 96], [32, 96], [160, 160], [224, 288], [96, 288]], time: 95, needCar: true, ring: true },
    ],
    outro: [['juno', 'Okay, okay. You drive like the city owes you money.']],
  },
  {
    id: 'sunsetrun', title: 'Sunset Run', giver: 'dex', place: 'bodyworks', reward: 4000,
    intro: [
      ['dex', 'Crane\'s moving the rest of his money tonight in an armoured Brute along the coast.'],
      ['dex', 'Run it off the road. Wreck it, and he\'s broke.'],
    ],
    steps: [
      { type: 'getIn', text: 'Take Dex\'s ~Mirage GT~.', spawn: { model: 'mirage', color: 0xff8c1a, x: -224, z: 40, heading: 0 } },
      { type: 'wreck', text: 'Wreck ~Crane\'s armoured Brute~.', spawn: { model: 'brute', color: 0x111111, node: [6, 9], to: [5, 9] }, wanted: 2 },
    ],
    outro: [['dex', 'Burning money smells the same as burning anything else. Go finish this.']],
  },
  {
    id: 'heatrises', title: 'Heat Rises', giver: 'lu', place: 'diner', reward: 10000,
    intro: [
      ['lu', 'Crane is at his tower with whatever police he still owns. He knows it\'s you.'],
      ['kai', 'Then he knows I\'m coming. Rosa has a boat at the end of Starlight Pier.'],
    ],
    steps: [
      { type: 'goto', text: 'Go to ~Crane Tower~ downtown.', place: 'tower', radius: 18 },
      { type: 'eliminate', text: 'Take out ~Silas Crane~ and his guards.', spawn: [[-14, -111], [10, -112], [-22, -108], [20, -110], [-2, -114], [4, -99]], boss: true },
      { type: 'evade', text: 'The whole SVPD is coming. ~Escape~ to the pier.', stars: 4, skip: true },
      { type: 'goto', text: 'Reach the boat at ~Starlight Pier~.', place: 'pier', radius: 10 },
    ],
    outro: [
      ['rosa', 'Get in. The ledgers are already with the press.'],
      ['kai', 'Sunvale\'s going to be loud for a while. Good.'],
    ],
  },
];
