// Punkte-Regeln (rein logisch).
//
//  - Jeder gesetzte Stein: 1 Punkt pro Feld
//  - Linien (Zeilen + Spalten) auf einmal: 10 · n · (n + 1) / 2  → 1: 10, 2: 30, 3: 60, 4: 100 …
//  - Serie: Abräumen in aufeinanderfolgenden Zügen erhöht den Multiplikator (×1, ×1.5, ×2 … max ×5).
//    Die Serie hält, solange spätestens im dritten Zug wieder abgeräumt wird.
//  - Brett ganz leer: +300 («Blitzblank!»)

export const STREAK_GRACE = 3;
export const PERFECT_BONUS = 300;

export function lineBase(lines) {
  return 10 * lines * (lines + 1) / 2;
}

export function streakMultiplier(streak) {
  if (streak <= 1) return 1;
  return Math.min(5, 1 + 0.5 * (streak - 1));
}

/**
 * Berechnet Punkte und neue Serie für einen Zug.
 * state: { streak, sinceClear } → Rückgabe { place, lines, bonus, total, streak, sinceClear, mult }
 */
export function scoreMove(state, cells, lines, perfect) {
  let streak = state.streak | 0;
  let sinceClear = state.sinceClear | 0;
  if (lines > 0) {
    streak += 1;
    sinceClear = 0;
  } else {
    sinceClear += 1;
    if (sinceClear >= STREAK_GRACE) streak = 0;
  }
  const mult = lines > 0 ? streakMultiplier(streak) : 1;
  const linePts = lines > 0 ? Math.round(lineBase(lines) * mult) : 0;
  const bonus = perfect ? PERFECT_BONUS : 0;
  return { place: cells, lines: linePts, bonus, total: cells + linePts + bonus, streak, sinceClear, mult };
}

/** Lob-Stufe: null | 2 | 3 | 4 | 'perfect' */
export function praiseLevel(lines, perfect) {
  if (perfect) return 'perfect';
  if (lines >= 4) return 4;
  if (lines >= 2) return lines;
  return null;
}
