// The story of Sunvale: Heat Rises — its cast, and the six jobs with their briefings and wrap-ups.
import { LOCATIONS } from '../world/cityLayout.js';

export const CAST = {
  rio: { name: 'Rio', color: '#ffb347' },
  mari: { name: 'Mari', color: '#5ee0c7' },
  teo: { name: 'Teo', color: '#8fb8ff' },
  dex: { name: 'Dex Calloway', color: '#ff6b6b' },
  radio: { name: 'Coast 88.4', color: '#f5a3ff' },
  dispatch: { name: 'SVPD Dispatch', color: '#9fb8ff' },
};

export const MISSIONS = [
  {
    id: 'strip', title: 'Back on the Strip', giver: 'mari', start: LOCATIONS.mari, reward: 500,
    summary: 'Rio is back in Sunvale. Mari has a ride lined up at Brandt Motors.',
    intro: [
      ['mari', 'Rio Vance. Six years gone and you stroll up to my truck like it was last Tuesday.'],
      ['rio', 'Missed your tacos, Mari. Missed the sunsets. Mostly the tacos.'],
      ['mari', 'Teo needs a driver at Brandt Motors, down on Saltwater Street. Grab any car. This is Sunvale, half of them have the keys in.'],
    ],
    outro: [
      ['teo', 'Rio! Look at you. Still drive like the road owes you money.'],
      ['teo', 'Calloway Coastal is buying the whole shoreline. Mari and me, we are next. We need someone who can drive.'],
    ],
  },
  {
    id: 'vespera', title: 'The Vespera Job', giver: 'teo', start: LOCATIONS.teo, reward: 1500,
    summary: 'Lift Dex Calloway\'s red Vespera GT from the Marea Hotel and bring it to Teo.',
    intro: [
      ['teo', 'Dex Calloway parks his new Vespera GT outside the Marea Hotel every afternoon. Red. Loud. Fully insured.'],
      ['teo', 'The valets call the cops the second it moves. Lose them before you bring it home, I do not want sirens in my garage.'],
    ],
    outro: [
      ['teo', 'Beautiful. We strip the tracker, swap the plates, and Dex gets a very bad afternoon.'],
      ['mari', 'Rio, come by the truck. I have work that pays in more than tacos.'],
    ],
  },
  {
    id: 'tamales', title: 'Hot Tamales', giver: 'mari', start: LOCATIONS.mari, reward: 1800,
    summary: 'Collect Mari\'s cooler at the end of the pier and deliver to three vendors before the ice melts.',
    intro: [
      ['mari', 'Calloway\'s inspectors closed my supplier. My regulars still need their orders.'],
      ['mari', 'There is a cooler at the end of the pier. Three stops, two and a half minutes, before the ice is soup.'],
    ],
    outro: [
      ['mari', 'Every order on time. You are hired, permanently. Pay is terrible, benefits are tacos.'],
    ],
  },
  {
    id: 'collectors', title: 'Calloway\'s Collectors', giver: 'mari', start: LOCATIONS.mari, reward: 2500,
    summary: 'Calloway\'s goons are shaking down the vendors on Mango Plaza. Run them off.',
    intro: [
      ['mari', 'Four of Dex\'s collectors are on Mango Plaza right now, squeezing the stall owners for "redevelopment fees".'],
      ['rio', 'Then they are about to get redeveloped.'],
    ],
    outro: [
      ['mari', 'The vendors are throwing you a party. Also, one of them gave me this for you. It is an SMG. Please be careful with it.'],
    ],
    gift: { weapon: 'hornet', ammo: 240 },
  },
  {
    id: 'heat', title: 'Heat Check', giver: 'teo', start: LOCATIONS.teo, reward: 3000,
    summary: 'Two Calloway transporters carry the demolition permits for the beachfront. Wreck both.',
    intro: [
      ['teo', 'Two Calloway transporters are hauling the signed demolition permits for the whole Coral Strip.'],
      ['teo', 'No permits, no bulldozers. Ram them, shoot them, whatever. Then lose the heat, because there will be heat.'],
    ],
    outro: [
      ['teo', 'Permits are ash. Dex is calling everyone he owns at City Hall. He is scared, Rio.'],
    ],
  },
  {
    id: 'sunset', title: 'Sunset Over Sunvale', giver: 'mari', start: LOCATIONS.mari, reward: 10000,
    summary: 'Dex Calloway is running for his private jet in an armored Regent. End this.',
    intro: [
      ['mari', 'Dex cleared out the tower. He is heading for the airfield in that armored Regent of his.'],
      ['dex', 'You should have stayed gone, Vance. This coast was mine before you came back.'],
      ['rio', 'The coast was never yours, Dex. It belongs to the people who sell tacos on it.'],
    ],
    outro: [
      ['dex', 'All right! All right. Calloway Coastal is finished. Take your beach.'],
      ['mari', 'Look at that sky, Rio. First sunset in years that is ours.'],
      ['teo', 'Drinks are on Brandt Motors. Well, on Dex. We sold his Vespera.'],
    ],
  },
];

// Hidden Sun Tokens: twelve golden suns tucked around the city.
export const SUN_TOKENS = [
  { x: -484, z: 4.5 }, { x: -372, z: -250 }, { x: -112, z: 49 }, { x: 160, z: 340 },
  { x: 230, z: -264.5 }, { x: -264.5, z: 300 }, { x: 0, z: -96 }, { x: 290, z: 69 },
  { x: -224, z: -320 }, { x: 96, z: 200.5 }, { x: -32, z: 256 }, { x: 300, z: -320 },
];
