// Zahlenschlange – Schwierigkeitsstufen. Rätsel werden aus dem Seed erzeugt
// (`hidato-<stufe>-<nummer>`), sind eindeutig lösbar. Format siehe /hidato/CONTENT.md.

export const difficulties = [
  { id: 'leicht', title: 'Leicht', w: 5, h: 5, holes: 0, givenRate: 0.44, maxGap: 4 },
  { id: 'mittel', title: 'Mittel', w: 6, h: 6, holes: 0, givenRate: 0.38, maxGap: 5 },
  { id: 'schwer', title: 'Schwer', w: 7, h: 7, holes: 3, givenRate: 0.33, maxGap: 6 },
  { id: 'meister', title: 'Meister', w: 8, h: 8, holes: 5, givenRate: 0.28, maxGap: 7 },
];

export const DAILY = { id: 'daily', title: 'Tagesrätsel', w: 6, h: 6, holes: 2, givenRate: 0.36, maxGap: 6 };

export const difficultyById = (id) => difficulties.find((d) => d.id === id) || (id === 'daily' ? DAILY : difficulties[0]);
