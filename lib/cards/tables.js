// Tisch-Hintergründe der Patience-Familie (angepasst aus /solitaire/data/tables.js).
// Jeder Eintrag: { id, name, base, light, dark, texture, ink } – texture: felt | linen | wood | none.

export const TABLES = [
  { id: 'salbei', name: 'Salbei', base: '#4f8d6d', light: '#6eab89', dark: '#356249', texture: 'felt', ink: 'light' },
  { id: 'klassisch', name: 'Spieltisch', base: '#277a48', light: '#3a9a5f', dark: '#17512e', texture: 'felt', ink: 'light' },
  { id: 'petrol', name: 'Petrol', base: '#1f6d74', light: '#2f8e93', dark: '#124a50', texture: 'felt', ink: 'light' },
  { id: 'nachtblau', name: 'Nachtblau', base: '#2a3964', light: '#3d5287', dark: '#18223f', texture: 'felt', ink: 'light' },
  { id: 'bordeaux', name: 'Bordeaux', base: '#7a2e3c', light: '#9b4554', dark: '#521d27', texture: 'felt', ink: 'light' },
  { id: 'lavendel', name: 'Lavendel', base: '#7c6cab', light: '#978ac4', dark: '#584b86', texture: 'felt', ink: 'light' },
  { id: 'rose', name: 'Altrosa', base: '#c48290', light: '#dba3ad', dark: '#9c5a68', texture: 'felt', ink: 'light' },
  { id: 'holz', name: 'Nussbaum', base: '#93633f', light: '#b07d55', dark: '#5e3d24', texture: 'wood', ink: 'light' },
  { id: 'schiefer', name: 'Schiefer', base: '#4a5561', light: '#64717f', dark: '#2f363e', texture: 'felt', ink: 'light' },
  { id: 'leinen', name: 'Leinen', base: '#e7dcc9', light: '#f6efe3', dark: '#cfc0a6', texture: 'linen', ink: 'dark' },
  { id: 'mint', name: 'Minze', base: '#9fd2bf', light: '#c4e7d9', dark: '#77b39d', texture: 'linen', ink: 'dark' },
  { id: 'pfirsich', name: 'Pfirsich', base: '#f0b79a', light: '#f8d2bf', dark: '#d9906f', texture: 'linen', ink: 'dark' },
];

export const DEFAULT_TABLE = 'salbei';

const svgURL = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const TEXTURES = {
  felt: svgURL('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/></filter><rect width="160" height="160" filter="url(#n)" opacity=".22"/></svg>'),
  linen: svgURL('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path d="M0 .5H8M0 4.5H8" stroke="#000" stroke-opacity=".05"/><path d="M.5 0V8M4.5 0V8" stroke="#fff" stroke-opacity=".18"/></svg>'),
  wood: svgURL('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><filter id="w"><feTurbulence type="fractalNoise" baseFrequency=".004 .09" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .1  0 0 0 0 .02  0 0 0 .9 -.25"/></filter><rect width="400" height="120" filter="url(#w)" opacity=".55"/></svg>'),
  none: 'none',
};

/** CSS-Hintergrund für einen Tisch */
export function tableBackground(t) {
  const tex = TEXTURES[t.texture] || 'none';
  const grad = `radial-gradient(120% 85% at 50% 18%, ${t.light} 0%, ${t.base} 48%, ${t.dark} 100%)`;
  return tex === 'none' ? grad : `${tex}, ${grad}`;
}
