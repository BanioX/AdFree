// Wollknäuel – Level-Inhalte. Die Level werden aus dem Seed erzeugt und vom Löser geprüft
// (/lib/sorting/generator.js). Hier steht nur, wie schwer welches Level ist und wie die Kapitel heissen.
//
// Besonderheit: Eine volle, einfarbige Spule wird sofort verstrickt – das Strickstück wandert in den
// Strickkorb und die Spule ist wieder frei. Darum reicht meist eine leere Spule am Anfang.
//
// Parameter eines Levels: { colors, cap, empties, fill?, minMoves?, maxMoves?, maxTries?, tag? }
//   colors   Anzahl Farben (je cap Wollschlaufen)   cap      Schlaufen pro Spule
//   empties  leere Spulen am Anfang                 fill     'full' | 'loose' (ungleich bewickelt, eine Spule mehr)
//   minMoves/maxMoves  gewünschte Länge der Löser-Lösung       tag      Hinweis in der Kopfzeile

export const CHAPTER_SIZE = 15;

export const CHAPTERS = [
  { name: 'Wollkorb', emoji: '🧺', bg: ['#fff7f3', '#f8e3db'] },
  { name: 'Schafweide', emoji: '🐑', bg: ['#f6faf1', '#e1ecd3'] },
  { name: 'Strickstube', emoji: '🧶', bg: ['#fdf4f7', '#f3dbe5'] },
  { name: 'Teestunde', emoji: '🫖', bg: ['#fbf7ef', '#efe2c9'] },
  { name: 'Kaminfeuer', emoji: '🔥', bg: ['#fff5ee', '#f6dccb'] },
  { name: 'Winterfenster', emoji: '❄️', bg: ['#f4f8fc', '#dde7f2'] },
  { name: 'Herbstmarkt', emoji: '🍁', bg: ['#fdf6ee', '#f1dcc2'] },
  { name: 'Mondscheinsofa', emoji: '🌙', bg: ['#f4f3fb', '#dfdcf0'] },
  { name: 'Kirschblüte', emoji: '🌸', bg: ['#fff5f8', '#f8dde7'] },
  { name: 'Berghütte', emoji: '🏡', bg: ['#f8f5f0', '#e8dccb'] },
];

const MAX_COLORS = 12;

/** Grundschwierigkeit: Anzahl Farben für Level n. */
export function baseColors(n) {
  if (n <= 3) return 3;
  if (n <= 8) return 4;
  if (n <= 15) return 5;
  return Math.min(MAX_COLORS, 5 + Math.floor((n - 16) / 11) + (n % 5 === 0 ? 1 : 0));
}

export function levelParams(n) {
  const c = baseColors(n);
  if (n === 1) return { colors: 3, cap: 3, empties: 1, minMoves: 4, maxMoves: 6 };
  if (n <= 3) return { colors: 3, cap: 4, empties: 1, minMoves: 6, maxMoves: 10 };
  // Jedes 10. Level: dicke Spulen (5 Schlaufen)
  if (n % 10 === 0) return { colors: Math.max(4, c - 1), cap: 5, empties: 1, minMoves: c * 2, maxTries: 80, tag: 'Dicke Spulen' };
  // …5 ab Level 15: wild bewickelt, keine leere Spule
  if (n >= 15 && n % 10 === 5) return { colors: c, cap: 4, empties: 0, fill: 'loose', minMoves: c * 2, maxTries: 80, tag: 'Wirrwarr' };
  // ab und zu: zwei freie Spulen, dafür mehr Farben
  if (n > 6 && n % 7 === 3) return { colors: Math.min(MAX_COLORS, c + 2), cap: 4, empties: 2, minMoves: c * 2, tag: 'Grosser Korb' };
  return { colors: c, cap: 4, empties: 1, minMoves: Math.round(c * 2.2) };
}

/** Entspannt: endlos, zwei freie Spulen. */
export function zenParams(k) {
  return { colors: 5 + (k % 3), cap: 4, empties: 2, minMoves: 10 };
}

/** Knifflig: wild bewickelt, keine leere Spule. */
export function hardParams(k) {
  return { colors: Math.min(9, 6 + Math.floor((k - 1) / 5)), cap: 4, empties: 0, fill: 'loose', minMoves: 16, maxTries: 120 };
}

/** Tagesrätsel: für alle gleich; sonntags dicke Spulen. */
export function dailyParams(day) {
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  if (wd === 0) return { colors: 6, cap: 5, empties: 1, minMoves: 16, maxTries: 80, tag: 'Dicke Spulen' };
  return { colors: 8, cap: 4, empties: 1, minMoves: 16 };
}
