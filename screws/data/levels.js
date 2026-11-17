// Schrauben & Muttern – Level-Inhalte. Die Level werden aus dem Seed erzeugt und vom Löser geprüft
// (/lib/sorting/generator.js). Hier steht nur, wie schwer welches Level ist und wie die Kapitel heissen.
//
// Parameter eines Levels: { colors, cap, empties, fill?, hidden?, minMoves?, maxMoves?, maxTries?, tag? }
//   colors   Anzahl Farben (je cap Muttern)        cap      Muttern pro Schraube
//   empties  leere Schrauben am Anfang             fill     'full' | 'loose' (ungleich bestückt)
//   hidden   true = Muttern unter der obersten sind verdeckt («?»), bis sie oben liegen
//   minMoves/maxMoves  gewünschte Länge der Löser-Lösung (Züge)     tag  Hinweis in der Kopfzeile
//   maxTries Versuche, bis ein passendes Level gefunden ist

export const CHAPTER_SIZE = 15;

export const CHAPTERS = [
  { name: 'Werkbank', emoji: '🔧', bg: ['#f6f4f0', '#e4ddd2'] },
  { name: 'Bastelkeller', emoji: '🧰', bg: ['#f3f5f7', '#dde3ea'] },
  { name: 'Uhrmacherei', emoji: '⏱️', bg: ['#fbf6ec', '#efe1c6'] },
  { name: 'Velowerkstatt', emoji: '🚲', bg: ['#f2f7f3', '#d9e8dc'] },
  { name: 'Schiffswerft', emoji: '⚓', bg: ['#f1f5fa', '#d6e2f0'] },
  { name: 'Windmühle', emoji: '🌾', bg: ['#fbf8ee', '#efe6c8'] },
  { name: 'Lokdepot', emoji: '🚂', bg: ['#f6f3f3', '#e6dcdc'] },
  { name: 'Sternwarte', emoji: '🔭', bg: ['#f2f2f9', '#dcdcef'] },
  { name: 'Spielzeugfabrik', emoji: '🧸', bg: ['#fdf4f0', '#f4dcd0'] },
  { name: 'Erfinderstube', emoji: '💡', bg: ['#fbf9ea', '#f1eabd'] },
];

const MAX_COLORS = 12;

/** Grundschwierigkeit: Anzahl Farben für Level n. */
export function baseColors(n) {
  if (n <= 3) return 3;
  if (n <= 8) return 4;
  if (n <= 15) return 5;
  return Math.min(MAX_COLORS, 5 + Math.floor((n - 16) / 11) + (n % 4 === 0 ? 1 : 0));
}

export function levelParams(n) {
  const c = baseColors(n);
  if (n === 1) return { colors: 3, cap: 3, empties: 2, minMoves: 4, maxMoves: 6 };
  if (n <= 3) return { colors: 3, cap: 3, empties: 1, minMoves: 5, maxMoves: 9, maxTries: 80 };
  // Jedes 10. Level: lange Schrauben (5 Muttern)
  if (n % 10 === 0) return { colors: Math.max(4, c - 1), cap: 5, empties: 2, minMoves: c * 2, tag: 'Lange Schrauben' };
  // …5 ab Level 15: verdeckte Muttern
  if (n >= 15 && n % 10 === 5) return { colors: Math.max(4, c - 1), cap: 4, empties: 2, hidden: true, minMoves: c * 2, tag: 'Verdeckt' };
  // ab und zu: kurze Schrauben, nur eine freie
  if (n > 6 && n % 7 === 3) return { colors: Math.min(8, c + 1), cap: 3, empties: 1, minMoves: c * 2, maxTries: 120, tag: 'Kurze Schrauben' };
  if (n > 20 && n % 9 === 4) return { colors: c, cap: 4, empties: 1, fill: 'loose', minMoves: c * 2, maxTries: 80, tag: 'Durcheinander' };
  return { colors: c, cap: 4, empties: 2, minMoves: Math.round(c * 1.8) };
}

/** Entspannt: endlos, mittlere Grösse. */
export function zenParams(k) {
  return { colors: 5 + (k % 3), cap: 4, empties: 2, minMoves: 9 };
}

/** Knifflig: nur eine freie Schraube, ab und zu verdeckt. */
export function hardParams(k) {
  return { colors: k <= 4 ? 5 : 6, cap: 4, empties: 1, hidden: k % 3 === 0, minMoves: 14, maxTries: 120 };
}

/** Tagesrätsel: für alle gleich; samstags mit verdeckten Muttern. */
export function dailyParams(day) {
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  if (wd === 6) return { colors: 7, cap: 4, empties: 2, hidden: true, minMoves: 14, tag: 'Verdeckt' };
  if (wd === 0) return { colors: 6, cap: 5, empties: 2, minMoves: 14, tag: 'Lange Schrauben' };
  return { colors: 8, cap: 4, empties: 2, minMoves: 15 };
}
