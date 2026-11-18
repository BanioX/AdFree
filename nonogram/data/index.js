// Bilderrätsel – Inhalts-Verzeichnis (Pakete).
// Wie man neue Bilder oder ganze Pakete hinzufügt, steht in ../CONTENT.md.
//
// Ein Paket: { id, title, title_en, subtitle, subtitle_en, emoji, puzzles: [Definition, ...] }
// Eine Definition: { id, title, title_en, category, palette: { zeichen: '#rrggbb' }, rows: [...], bg? }
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
  { id: 'mini', title: 'Mini', subtitle: '5 × 5 · zum Aufwärmen', title_en: 'Mini', subtitle_en: '5 × 5 · to warm up', emoji: '🌱', puzzles: mini },
  { id: 'klein', title: 'Klein', subtitle: '10 × 10 · gemütlich', title_en: 'Small', subtitle_en: '10 × 10 · nice and cozy', emoji: '🌷', puzzles: klein },
  { id: 'mittel', title: 'Mittel', subtitle: '15 × 15 · mit Zoom', title_en: 'Medium', subtitle_en: '15 × 15 · with zoom', emoji: '🌻', puzzles: mittel },
  { id: 'gross', title: 'Gross', subtitle: '20 × 20 · für lange Abende', title_en: 'Large', subtitle_en: '20 × 20 · for long evenings', emoji: '🌳', puzzles: gross },
];
