// Tische (Farbe des Spielfelds). Werden mit Sternen der Reise freigeschaltet.
// stars = benötigte Sterne insgesamt; c1/c2 = Verlauf oben/unten; dark = dunkler Tisch (helle Hinweise).
export const tables = [
  { id: 'sand', name: 'Sand', stars: 0, c1: '#f6eddd', c2: '#e9d8bc' },
  { id: 'jade', name: 'Jade', stars: 4, c1: '#e4f2e9', c2: '#bddccb' },
  { id: 'himmel', name: 'Himmel', stars: 12, c1: '#e8f0fb', c2: '#c3d5ee' },
  { id: 'rose', name: 'Rosé', stars: 24, c1: '#fcebec', c2: '#efc6cc' },
  { id: 'nacht', name: 'Nacht', stars: 40, c1: '#454b61', c2: '#2a2f40', dark: true },
];
