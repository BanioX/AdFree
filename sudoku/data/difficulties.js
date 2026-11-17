// Schwierigkeitsstufen von Sudoku.
// Die Einstufung macht der «menschliche Löser» (logic/human.js) – er löst nur mit Techniken,
// die man auch von Hand anwendet. Stufen (tier) der Techniken:
//   1 = Einer: letztes freies Feld, «nur hier möglich» (versteckter Einer), «einzige Zahl» (nackter Einer)
//   2 = Zeiger, Block-Linie, nackte und versteckte Paare
//   3 = Drillinge (nackt/versteckt), X-Wing
//   4 = XY-Wing, XYZ-Wing, Schwertfisch, Vierlinge
//
// Felder:
//   id         interner Name (auch Schlüssel in data/pool.js)
//   title      Anzeigename
//   blurb      kurzer Satz im Menü
//   minTier    mindestens nötige Technik-Stufe
//   maxTier    höchstens erlaubte Technik-Stufe
//   minGivens  so viele vorgegebene Zahlen bleiben mindestens stehen
//   maxGivens  höchstens so viele vorgegebene Zahlen
//   minScore   optional: Mindest-Punktzahl (Summe der Technik-Gewichte)

export const difficulties = [
  { id: 'leicht', title: 'Leicht', blurb: 'Gemütlich zum Aufwärmen', minTier: 1, maxTier: 1, minGivens: 36, maxGivens: 40 },
  { id: 'mittel', title: 'Mittel', blurb: 'Ein bisschen knobeln', minTier: 1, maxTier: 1, minGivens: 27, maxGivens: 31 },
  { id: 'schwer', title: 'Schwer', blurb: 'Mit Notizen, Paaren und Zeigern', minTier: 2, maxTier: 2, minGivens: 22, maxGivens: 32 },
  { id: 'experte', title: 'Experte', blurb: 'X-Wing, Drillinge & Co.', minTier: 3, maxTier: 4, minGivens: 20, maxGivens: 32 },
];

export const difficultyById = (id) => difficulties.find((d) => d.id === id) || difficulties[0];

/** Das Tagesrätsel hat immer diese Stufe. */
export const DAILY_DIFFICULTY = 'mittel';
