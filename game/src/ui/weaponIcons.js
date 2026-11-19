// Weapon silhouettes for the HUD's weapon bar, drawn as small inline SVGs (viewBox 64 x 32).

const svg = (body) => `<svg viewBox="0 0 64 32" width="50" height="25" aria-hidden="true"><g fill="currentColor">${body}</g></svg>`;

export const WEAPON_ICONS = {
  // a clenched fist
  fists: svg('<rect x="22" y="8" width="22" height="16" rx="5"/><rect x="18" y="12" width="8" height="10" rx="3"/><rect x="26" y="5" width="5" height="8" rx="2"/><rect x="32" y="4" width="5" height="8" rx="2"/><rect x="38" y="5" width="5" height="8" rx="2"/><rect x="30" y="22" width="12" height="7" rx="2"/>'),
  // compact pistol: slide, grip, trigger guard
  pistol: svg('<rect x="16" y="8" width="34" height="7" rx="1.5"/><rect x="48" y="9" width="4" height="3"/><path d="M20 15h12l-3 13h-8z"/><path d="M31 15h7v3c0 3-3 5-6 5h-1z" fill="none" stroke="currentColor" stroke-width="2"/>'),
  // SMG: long receiver, stubby barrel, magazine, folding stock
  smg: svg('<rect x="14" y="10" width="34" height="8" rx="1.5"/><rect x="48" y="12" width="10" height="3"/><rect x="28" y="18" width="5" height="12" rx="1"/><path d="M20 18h7l-2 9h-6z"/><path d="M14 11h-8v3h5v6h3z"/>'),
  // pump shotgun: long barrel over the tube, pump grip, wooden stock
  shotgun: svg('<rect x="22" y="9" width="38" height="4" rx="1"/><rect x="26" y="13" width="28" height="3"/><rect x="38" y="12" width="12" height="6" rx="2"/><path d="M8 12h16v6l-4 1-12 6z"/><path d="M24 15h6l-2 6h-4z"/>'),
};
