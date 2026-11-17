// Spielmodi für das freie Spiel von «Verdoppeln».
//
//   id      eindeutig (wird für Spielstand und Rekord verwendet – nicht mehr ändern!)
//   size    Brettgrösse (3–6)
//   title   Name im Menü
//   sub     kleine Zusatzzeile
//   target  Ziel-Stufe: 11 = 2048, 12 = 4096, 8 = 256 (Wert = 2 hoch Stufe)
//   blurb   ein kurzer Satz für das Menü
//   walls   optional: Brett-Form wie in data/levels.js (Zeilen mit '.', 'o', 'x')

export const modes = [
  { id: 'klassisch', size: 4, title: 'Klassisch', sub: '4 × 4', target: 11, blurb: 'Das bewährte 4×4-Brett.' },
  { id: 'entspannt5', size: 5, title: 'Entspannt', sub: '5 × 5', target: 11, blurb: 'Mehr Platz, mehr Ruhe.' },
  { id: 'entspannt6', size: 6, title: 'Entspannt', sub: '6 × 6', target: 12, blurb: 'Riesiges Brett für lange Runden.' },
  { id: 'knifflig', size: 3, title: 'Knifflig', sub: '3 × 3', target: 8, blurb: 'Wenig Platz – jeder Zug zählt.' },
];

export const DEFAULT_MODE = 'klassisch';

export function modeById(id) {
  return modes.find((m) => m.id === id) || modes[0];
}

/** Rückgängig-Regeln: Start-Vorrat, Höchstzahl, alle wie viele Züge es eins zurückgibt. */
export const undoRules = { start: 3, max: 3, refillEvery: 25, history: 12 };
