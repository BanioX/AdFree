// Kugelsortierung – Level-Inhalte. Die Level selbst werden aus dem Seed erzeugt und vom Löser geprüft
// (/lib/sorting/generator.js). Hier steht nur, WIE schwer welches Level ist und wie die Kapitel heissen.
//
// Parameter eines Levels: { colors, cap, empties, fill?, minMoves?, maxMoves?, maxTries?, tag? }
//   colors   Anzahl Farben (je cap Kugeln)        cap      Kugeln pro Röhre
//   empties  leere Röhren am Anfang                fill     'full' (Standard) | 'loose' (ungleich gefüllt)
//   minMoves/maxMoves  gewünschte Länge der Löser-Lösung (Züge)   tag  Anzeige für besondere Level
//   maxTries Versuche, bis ein passendes Level gefunden ist (für knappe Level mit nur einer leeren Röhre)

export const CHAPTER_SIZE = 15;

export const CHAPTERS = [
  { name: 'Morgenwiese', emoji: '🌼', bg: ['#fffaf0', '#fdebd3'] },
  { name: 'Murmelbach', emoji: '🫧', bg: ['#f0faf8', '#d8efec'] },
  { name: 'Kirschgarten', emoji: '🍒', bg: ['#fff4f3', '#fadcdc'] },
  { name: 'Sonnenhang', emoji: '☀️', bg: ['#fffaea', '#fbe6b8'] },
  { name: 'Lavendelfeld', emoji: '💜', bg: ['#f8f3fd', '#e6daf6'] },
  { name: 'Bergsee', emoji: '🏔️', bg: ['#f1f7fd', '#d9e7f6'] },
  { name: 'Herbstwald', emoji: '🍂', bg: ['#fdf5ec', '#f0dabf'] },
  { name: 'Sternennacht', emoji: '✨', bg: ['#f1f1fb', '#dadcf2'] },
  { name: 'Schneekugel', emoji: '❄️', bg: ['#f5f9fc', '#e0eaf3'] },
  { name: 'Jahrmarkt', emoji: '🎠', bg: ['#fff3f8', '#f9d9e8'] },
];

const MAX_COLORS = 12;

/** Grundschwierigkeit: Anzahl Farben für Level n (sanft steigend, ab Level ~90 am Maximum). */
export function baseColors(n) {
  if (n <= 2) return 3;
  if (n <= 6) return 4;
  if (n <= 10) return 5;
  if (n <= 15) return 6;
  return Math.min(MAX_COLORS, 6 + Math.floor((n - 16) / 12) + (n % 3 === 0 ? 1 : 0));
}

export function levelParams(n) {
  const c = baseColors(n);
  // Jedes 10. Level: hohe Röhren (5 Kugeln)
  if (n % 10 === 0) return { colors: Math.max(4, c - 1), cap: 5, empties: 2, minMoves: c * 3, tag: 'Hohe Röhren' };
  // Ab Level 15 jedes 10. Level (…5): knapp – nur eine leere Röhre, dafür weniger Farben
  if (n >= 15 && n % 10 === 5) return { colors: Math.min(6, Math.max(4, c - 2)), cap: 4, empties: 1, minMoves: c * 2, maxTries: 120, tag: 'Knapp' };
  // Ab und zu ungleich gefüllte Röhren
  if (n > 8 && n % 7 === 3) return { colors: c, cap: 4, empties: 1, fill: 'loose', minMoves: Math.round(c * 2.5), tag: 'Durcheinander' };
  if (n === 1) return { colors: 3, cap: 4, empties: 2, minMoves: 6, maxMoves: 10 };
  if (n === 2) return { colors: 3, cap: 4, empties: 2, minMoves: 8, maxMoves: 13 };
  return { colors: c, cap: 4, empties: 2, minMoves: Math.round(c * 2.5) };
}

/** Entspannt: endlos, mittlere Grösse, zwei freie Röhren. */
export function zenParams(k) {
  return { colors: 5 + (k % 3), cap: 4, empties: 2, minMoves: 12 };
}

/** Knifflig: nur eine freie Röhre. */
export function hardParams(k) {
  return { colors: k <= 4 ? 5 : 6, cap: 4, empties: 1, minMoves: 20, maxTries: 120 };
}

/** Tagesrätsel: für alle gleich, sonntags mit hohen Röhren. */
export function dailyParams(day) {
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  if (wd === 0) return { colors: 7, cap: 5, empties: 2, minMoves: 24, tag: 'Hohe Röhren' };
  return { colors: 8, cap: 4, empties: 2, minMoves: 22 };
}
