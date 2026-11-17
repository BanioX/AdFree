// Bilderrätsel – Inhalts-Verzeichnis (Pakete).
// Wie man neue Bilder oder ganze Pakete hinzufügt, steht in ../CONTENT.md.
//
// Ein Paket: { id, title, subtitle, emoji, puzzles: [Definition, ...] }
// Eine Definition: { id, title, category, palette: { zeichen: '#rrggbb' }, rows: [...], bg? }
//   '.' = leeres Feld. Jedes andere Zeichen = gefülltes Feld in seiner Palettenfarbe.
//   bg (optional) = Hintergrundfarbe des fertigen Bildes.

import mini from './mini.js';
import klein from './klein.js';
import mittel from './mittel.js';
import gross from './gross.js';

/** Themen (Kategorien) in Anzeige-Reihenfolge. Unbekannte Themen landen am Ende. */
export const themes = ['Tiere', 'Essen', 'Pflanzen', 'Natur', 'Dinge', 'Feste'];

/** Pakete in Menü-Reihenfolge. */
export const packs = [
  { id: 'mini', title: 'Mini', subtitle: '5 × 5 · zum Aufwärmen', emoji: '🌱', puzzles: mini },
  { id: 'klein', title: 'Klein', subtitle: '10 × 10 · gemütlich', emoji: '🌷', puzzles: klein },
  { id: 'mittel', title: 'Mittel', subtitle: '15 × 15 · mit Zoom', emoji: '🌻', puzzles: mittel },
  { id: 'gross', title: 'Gross', subtitle: '20 × 20 · für lange Abende', emoji: '🌳', puzzles: gross },
];
