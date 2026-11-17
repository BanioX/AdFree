// Zahlensummen – Schwierigkeitsstufen. Rätsel werden aus dem Seed erzeugt
// (`numbersums-<stufe>-<nummer>`), sind eindeutig und ohne Raten lösbar.
// Format siehe /numbersums/CONTENT.md.

export const difficulties = [
  { id: 'leicht', title: 'Leicht', n: 5, regions: false, keepRate: 0.55, blurb: '5×5 · Reihen und Spalten' },
  { id: 'mittel', title: 'Mittel', n: 6, regions: false, keepRate: 0.5, blurb: '6×6 · Reihen und Spalten' },
  { id: 'schwer', title: 'Schwer', n: 7, regions: true, keepRate: 0.5, blurb: '7×7 · mit Farbbereichen' },
  { id: 'meister', title: 'Meister', n: 8, regions: true, keepRate: 0.45, blurb: '8×8 · mit Farbbereichen' },
];

export const DAILY = { id: 'daily', title: 'Tagesrätsel', n: 6, regions: true, keepRate: 0.5, blurb: '6×6 · mit Farbbereichen' };

export const difficultyById = (id) => difficulties.find((d) => d.id === id) || (id === 'daily' ? DAILY : difficulties[0]);

/** Sanfte Pastellfarben für die Bereiche (Hintergrund, Rand/Beschriftung). */
export const REGION_COLORS = [
  ['#fde0c2', '#c47a22'],   // Pfirsich
  ['#d3eed4', '#3f8f46'],   // Minze
  ['#d2e6f8', '#2f74b5'],   // Himmel
  ['#f9d4de', '#c04866'],   // Rose
  ['#f6edb6', '#968214'],   // Zitrone
  ['#e4d8f6', '#7650b8'],   // Flieder
  ['#c9ede7', '#22897a'],   // Aqua
  ['#eadfd2', '#8a6a4a'],   // Sand
];

export const LIVES = 3;
