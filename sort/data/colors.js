// Farbfluss – Flüssigkeiten.
//
// Jede Farbe: id (eindeutig), name (Deutsch), color (Hex), symbol (für die Farbsymbol-Hilfe).
// Verfügbare Symbole: circle, square, triangle, diamond, star, heart, drop, flower, cross,
// moon, ring, hexagon, bolt, leaf, bars, sun  (siehe view/glass.js → drawSymbol)
//
// Die ersten 8 Farben sind besonders gut unterscheidbar und werden in Leveln mit wenigen
// Farben bevorzugt. Neue Farben einfach hinten anhängen (max. 26).

export const liquids = [
  { id: 'rot', name: 'Erdbeere', color: '#f2474f', symbol: 'circle' },
  { id: 'blau', name: 'Ozean', color: '#3a7df0', symbol: 'square' },
  { id: 'gelb', name: 'Zitrone', color: '#ffd12e', symbol: 'triangle' },
  { id: 'gruen', name: 'Minze', color: '#38bf62', symbol: 'diamond' },
  { id: 'violett', name: 'Traube', color: '#9255e6', symbol: 'star' },
  { id: 'orange', name: 'Mandarine', color: '#ff8a2a', symbol: 'heart' },
  { id: 'tuerkis', name: 'Lagune', color: '#19c4c8', symbol: 'drop' },
  { id: 'pink', name: 'Himbeere', color: '#ff6db0', symbol: 'flower' },
  { id: 'kakao', name: 'Kakao', color: '#8b5838', symbol: 'cross' },
  { id: 'limette', name: 'Limette', color: '#b2df3f', symbol: 'moon' },
  { id: 'himmel', name: 'Himmel', color: '#86cffc', symbol: 'ring' },
  { id: 'lavendel', name: 'Lavendel', color: '#c8a9ff', symbol: 'hexagon' },
  { id: 'nacht', name: 'Nachtblau', color: '#2d3c95', symbol: 'bolt' },
  { id: 'beere', name: 'Brombeere', color: '#ad2160', symbol: 'leaf' },
  { id: 'silber', name: 'Silber', color: '#a6afba', symbol: 'bars' },
  { id: 'pfirsich', name: 'Pfirsich', color: '#ffbb8e', symbol: 'sun' },
];

/** Anzahl «Grundfarben», die für kleine Level bevorzugt werden. */
export const PRIMARY_COUNT = 8;

/** Aussehen verdeckter Schichten («Geheimnis»-Level). */
export const hiddenLiquid = { name: 'Verdeckt', color: '#5d6377' };
