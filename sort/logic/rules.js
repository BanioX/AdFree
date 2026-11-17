// Farbfluss – Spielregeln (reine Logik, kein DOM).
//
// Ein Spielstand ist ein schlichtes, JSON-taugliches Objekt:
//   {
//     per: 4,                         // Schichten pro Farbe (immer 4)
//     tubes: [ { cap: 4, l: [0, 2, 1, 1], h: 0 }, … ]
//   }
// cap = Fassungsvermögen, l = Farbschichten von unten nach oben (Farbindex),
// h = Anzahl verdeckter Schichten von unten («Geheimnis»-Level). Die oberste Schicht
// ist immer sichtbar; sobald eine verdeckte Schicht oben liegt, wird sie aufgedeckt.

export const PER_COLOR = 4;

export function cloneState(s) {
  return { per: s.per, tubes: s.tubes.map((t) => ({ cap: t.cap, l: t.l.slice(), h: t.h | 0 })) };
}

export function topColor(t) {
  return t.l.length ? t.l[t.l.length - 1] : -1;
}

/** Anzahl gleichfarbiger Schichten oben am Stück. */
export function topRun(t) {
  const n = t.l.length;
  if (!n) return 0;
  const c = t.l[n - 1];
  let k = 1;
  while (k < n && t.l[n - 1 - k] === c) k++;
  return k;
}

export function isMono(t) {
  if (!t.l.length) return false;
  const c = t.l[0];
  for (let i = 1; i < t.l.length; i++) if (t.l[i] !== c) return false;
  return true;
}

/** Glas enthält alle Schichten einer Farbe – bekommt einen Korken und ist versiegelt. */
export function isComplete(t, per = PER_COLOR) {
  return t.l.length === per && isMono(t) && !(t.h > 0);
}

export function isSolved(s) {
  for (const t of s.tubes) {
    if (!t.l.length) continue;
    if (!isComplete(t, s.per)) return false;
  }
  return true;
}

/** Wie viele Schichten würden von s nach d fliessen? 0 = nicht erlaubt. */
export function pourAmount(s, from, to) {
  if (from === to) return 0;
  const a = s.tubes[from], b = s.tubes[to];
  if (!a || !b || !a.l.length) return 0;
  if (isComplete(a, s.per)) return 0;
  const room = b.cap - b.l.length;
  if (room <= 0) return 0;
  if (b.l.length && topColor(b) !== topColor(a)) return 0;
  return Math.min(topRun(a), room);
}

/** Grund, warum ein Giessen nicht geht (für freundliche Rückmeldungen). */
export function pourProblem(s, from, to) {
  const a = s.tubes[from], b = s.tubes[to];
  if (!a || !b || from === to) return 'same';
  if (!a.l.length) return 'empty';
  if (isComplete(a, s.per)) return 'sealed';
  if (b.l.length >= b.cap) return 'full';
  if (b.l.length && topColor(b) !== topColor(a)) return 'color';
  return null;
}

/**
 * Führt einen Zug aus (verändert s). Rückgabe: { from, to, n, color, revealed } oder null.
 * revealed: Index der neu aufgedeckten Schicht im Quellglas (oder -1).
 */
export function applyPour(s, from, to) {
  const n = pourAmount(s, from, to);
  if (!n) return null;
  const a = s.tubes[from], b = s.tubes[to];
  const color = topColor(a);
  for (let i = 0; i < n; i++) b.l.push(a.l.pop());
  // Ist das Zielglas damit vollständig (alle Schichten einer Farbe), werden seine
  // verdeckten Schichten aufgedeckt – sonst gäbe es keinen Korken, obwohl alles stimmt.
  const revealedDst = revealComplete(b, s.per);
  let revealed = -1;
  if (a.l.length && a.h > a.l.length - 1) {
    a.h = a.l.length - 1;
    revealed = a.l.length - 1;
  }
  if (!a.l.length) a.h = 0;
  return { from, to, n, color, revealed, revealedDst };
}

/**
 * Deckt verdeckte Schichten eines Glases auf, das vollständig einfarbig ist
 * (verändert t). Rückgabe: true, wenn etwas aufgedeckt wurde.
 */
export function revealComplete(t, per = PER_COLOR) {
  if (!(t.h > 0) || t.l.length !== per || !isMono(t)) return false;
  t.h = 0;
  return true;
}

/** Macht einen Zug rückgängig. Aufgedeckte Schichten bleiben aufgedeckt. */
export function undoPour(s, move) {
  const a = s.tubes[move.from], b = s.tubes[move.to];
  for (let i = 0; i < move.n; i++) a.l.push(b.l.pop());
}

export function legalMoves(s) {
  const out = [];
  for (let i = 0; i < s.tubes.length; i++) {
    for (let j = 0; j < s.tubes.length; j++) {
      const n = pourAmount(s, i, j);
      if (n) out.push({ from: i, to: j, n });
    }
  }
  return out;
}

/**
 * Bringt einen Zug etwas? Nicht sinnvoll sind:
 *  - ein einfarbiges Glas komplett in ein leeres Glas umfüllen (ändert nichts),
 *  - nur einen Teil der obersten Farbe umgiessen, weil das Ziel zu wenig Platz hat:
 *    Dann liegt oben im Quellglas dieselbe Farbe wie vorher, man schiebt sie nur hin
 *    und her. (Mit 4 Schichten pro Farbe öffnet so ein Teilzug nie einen neuen Weg,
 *    ausser er deckt eine verdeckte Schicht auf.)
 */
export function isProgressive(s, m) {
  const a = s.tubes[m.from], b = s.tubes[m.to];
  if (!b.l.length && isMono(a) && a.l.length === m.n && b.cap >= a.cap) return false;
  if (m.n < topRun(a)) {
    const left = a.l.length - m.n;
    return (a.h | 0) > left - 1; // deckt etwas auf
  }
  return true;
}

/** Gibt es noch einen sinnvollen Zug (siehe isProgressive)? */
export function hasUsefulMove(s) {
  for (const m of legalMoves(s)) if (isProgressive(s, m)) return true;
  return false;
}

/** Ist Glas i mit einer Farbe fertig, die noch verdeckte Schichten hat? */
export function isHidden(t, i) {
  return i < (t.h | 0);
}

/** Prüft einen Spielstand auf Plausibilität (für Tests und gespeicherte Stände). */
export function validateState(s) {
  if (!s || !Array.isArray(s.tubes) || !s.tubes.length) return 'keine Gläser';
  const per = s.per || PER_COLOR;
  const count = new Map();
  for (const t of s.tubes) {
    if (!(t.cap >= 1 && t.cap <= 8)) return 'Fassungsvermögen ungültig';
    if (!Array.isArray(t.l) || t.l.length > t.cap) return 'Glas überfüllt';
    if (t.h < 0 || (t.l.length && t.h > t.l.length - 1) || (!t.l.length && t.h)) return 'verdeckte Schichten ungültig';
    for (const c of t.l) {
      if (!Number.isInteger(c) || c < 0) return 'Farbe ungültig';
      count.set(c, (count.get(c) || 0) + 1);
    }
  }
  for (const [c, n] of count) if (n !== per) return `Farbe ${c} kommt ${n}× vor (erwartet ${per})`;
  return null;
}
