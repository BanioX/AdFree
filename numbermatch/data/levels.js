// Zahlenpaare – Level-Plan. Felder werden aus dem Seed erzeugt (siehe logic/generator.js),
// hier steht nur, wie gross, mit welchem Ziel und wie vielen «Zahlen hinzufügen».
// Format siehe /numbermatch/CONTENT.md.

/** Handverlesene erste Level (sanfter Einstieg). */
export const INTRO = [
  { count: 18, adds: 5, goal: { type: 'clear' } },
  { count: 22, adds: 5, goal: { type: 'clear' } },
  { count: 26, adds: 5, goal: { type: 'stars', n: 3 } },
  { count: 26, adds: 5, goal: { type: 'rows', n: 2 } },
  { count: 28, adds: 5, goal: { type: 'clear' } },
  { count: 30, adds: 5, goal: { type: 'stars', n: 4 } },
];

/** Ab hier unendlich: Grösse wächst sanft, Ziele wechseln sich ab. */
export function levelSpec(n) {
  if (n >= 1 && n <= INTRO.length) return { ...INTRO[n - 1], level: n };
  const k = n - INTRO.length;                       // 1, 2, 3 …
  const count = Math.min(30 + 2 * Math.floor(k / 3), 46);
  const adds = n <= 15 ? 5 : n <= 40 ? 4 : 3;
  const rows = Math.ceil(count / 9);
  let goal;
  switch (n % 3) {
    case 0: goal = { type: 'stars', n: Math.min(4 + Math.floor(k / 12), 7) }; break;
    case 1: goal = { type: 'clear' }; break;
    default: goal = { type: 'rows', n: Math.min(2 + Math.floor(k / 10), rows - 1) };
  }
  return { count, adds, goal, level: n };
}

/** Tagesrätsel: ganzes Feld abräumen. */
export const DAILY = { count: 36, adds: 5, goal: { type: 'clear' } };

/** Endlos-Modus: jede Runde ein neues Feld. */
export function endlessSpec(round) {
  return { count: Math.min(28 + 4 * (round - 1), 46), adds: 5, goal: { type: 'score' } };
}
export const ENDLESS_MAX_ADDS = 6;

/** Kleine Namen für die Levelkarte (rein dekorativ). */
export const GOAL_TEXT = {
  clear: { short: 'Feld leeren', long: 'Räume alle Zahlen ab' },
  stars: { short: 'Sterne', long: (n) => `Sammle ${n} Sterne` },
  rows: { short: 'Reihen', long: (n) => `Räume ${n} Reihen ab` },
  score: { short: 'Endlos', long: 'Punkte sammeln' },
};
