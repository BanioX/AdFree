// Spielmodi für das freie Spiel von «Verdoppeln».
//
//   id      eindeutig (wird für Spielstand und Rekord verwendet – nicht mehr ändern!)
//   size    Brettgrösse (3–6)
//   title   Name im Menü (title_en: auf Englisch)
//   sub     kleine Zusatzzeile
//   target  Ziel-Stufe: 11 = 2048, 12 = 4096, 8 = 256 (Wert = 2 hoch Stufe)
//   blurb   ein kurzer Satz für das Menü (blurb_en: auf Englisch)
//   walls   optional: Brett-Form wie in data/levels.js (Zeilen mit '.', 'o', 'x')

export const modes = [
  { id: 'klassisch', size: 4, title: 'Klassisch', title_en: 'Classic', sub: '4 × 4', target: 11, blurb: 'Das bewährte 4×4-Brett.', blurb_en: 'The tried-and-true 4×4 board.' },
  { id: 'entspannt5', size: 5, title: 'Entspannt', title_en: 'Relaxed', sub: '5 × 5', target: 11, blurb: 'Mehr Platz, mehr Ruhe.', blurb_en: 'More room, more calm.' },
  { id: 'entspannt6', size: 6, title: 'Entspannt', title_en: 'Relaxed', sub: '6 × 6', target: 12, blurb: 'Riesiges Brett für lange Runden.', blurb_en: 'A huge board for long games.' },
  { id: 'knifflig', size: 3, title: 'Knifflig', title_en: 'Tricky', sub: '3 × 3', target: 8, blurb: 'Wenig Platz – jeder Zug zählt.', blurb_en: 'Little room – every move counts.' },
];

export const DEFAULT_MODE = 'klassisch';

export function modeById(id) {
  return modes.find((m) => m.id === id) || modes[0];
}

/** Rückgängig-Regeln: Start-Vorrat, Höchstzahl, alle wie viele Züge es eins zurückgibt. */
export const undoRules = { start: 3, max: 3, refillEvery: 25, history: 12 };
