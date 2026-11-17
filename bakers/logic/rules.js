// Bäckerdutzend – Regeln (reine Logik, ohne DOM).
//
// Zustand (unveränderlich behandelt):
//   { cols: number[13][]  Kartencodes von unten nach oben (alle offen),
//     found: number[4]     Anzahl Karten auf der Ablage je Farbe,
//     free: bool           Leicht: leere Stapel dürfen mit jeder Karte belegt werden }
//
// Züge:  { t: 'f', from }          oberste Karte auf die Ablage
//        { t: 'm', from, to }      oberste Karte auf einen anderen Stapel (idx = letzte Karte)
//
// Regeln: 13 Stapel à 4 Karten, Könige liegen beim Austeilen zuunterst. Abwärts bauen ohne
// Rücksicht auf die Farbe, immer nur eine Karte. Leere Stapel bleiben leer (klassisch).

import { shuffledDeck, suitOf, rankOf } from '../../lib/cards/deck.js';

export const COLS = 13;

/** Austeilen: 13 × 4, Könige wandern in ihrem Stapel nach unten (Reihenfolge sonst gleich). */
export function dealDeck(deck, free = false) {
  const cols = [];
  for (let c = 0; c < COLS; c++) {
    const pile = deck.slice(c * 4, c * 4 + 4);
    const kings = pile.filter((x) => rankOf(x) === 13);
    cols.push([...kings, ...pile.filter((x) => rankOf(x) !== 13)]);
  }
  return { cols, found: [0, 0, 0, 0], free: !!free };
}

export function dealSeed(seed, free = false) {
  return dealDeck(shuffledDeck(seed), free);
}

export const topOf = (st, c) => st.cols[c][st.cols[c].length - 1];

export function canFound(st, c) {
  const col = st.cols[c];
  if (!col.length) return false;
  const x = col[col.length - 1];
  return st.found[suitOf(x)] === rankOf(x) - 1;
}

export function canMove(st, from, to) {
  if (from === to || to < 0 || to >= COLS || from < 0 || from >= COLS) return false;
  const src = st.cols[from];
  if (!src.length) return false;
  const a = src[src.length - 1];
  const dst = st.cols[to];
  if (!dst.length) return st.free;
  return rankOf(dst[dst.length - 1]) === rankOf(a) + 1;
}

export function isLegal(st, m) {
  if (!m) return false;
  if (m.t === 'f') return m.from >= 0 && m.from < COLS && canFound(st, m.from);
  if (m.t === 'm') {
    if (m.idx != null && m.idx !== st.cols[m.from]?.length - 1) return false;
    return canMove(st, m.from, m.to);
  }
  return false;
}

export function step(st, m) {
  const cols = st.cols.slice();
  const src = cols[m.from].slice();
  const x = src.pop();
  cols[m.from] = src;
  if (m.t === 'f') {
    const found = st.found.slice();
    found[suitOf(x)]++;
    return { ...st, cols, found };
  }
  cols[m.to] = cols[m.to].concat([x]);
  return { ...st, cols };
}

export const settle = (st) => st;
export const apply = (st, m) => step(st, m);

export const isWon = (st) => st.found[0] + st.found[1] + st.found[2] + st.found[3] === 52;
export const foundCount = (st) => st.found[0] + st.found[1] + st.found[2] + st.found[3];

export function legalMoves(st) {
  const out = [];
  for (let c = 0; c < COLS; c++) if (canFound(st, c)) out.push({ t: 'f', from: c });
  let emptyUsed = false;
  for (let from = 0; from < COLS; from++) {
    const n = st.cols[from].length;
    if (!n) continue;
    for (let to = 0; to < COLS; to++) {
      if (!canMove(st, from, to)) continue;
      if (!st.cols[to].length) {
        if (n === 1 || emptyUsed) continue;
      }
      out.push({ t: 'm', from, idx: n - 1, to });
    }
  }
  return out;
}

export function foundationPiles(st) {
  return st.found.map((n, s) => Array.from({ length: n }, (_, i) => s * 13 + i));
}

/** Alle Stapel absteigend geordnet? Dann lässt sich der Rest einfach ablegen. */
export function isSorted(st) {
  for (const col of st.cols) {
    for (let i = 1; i < col.length; i++) if (rankOf(col[i]) > rankOf(col[i - 1])) return false;
  }
  return true;
}

/** Ablagezüge, die das Spiel bei sortierten Stapeln zu Ende spielen. */
export function finishMoves(st) {
  const out = [];
  let s = st;
  for (let guard = 0; guard < 60 && !isWon(s); guard++) {
    let best = -1;
    for (let c = 0; c < COLS; c++) {
      if (canFound(s, c) && (best < 0 || rankOf(topOf(s, c)) < rankOf(topOf(s, best)))) best = c;
    }
    if (best < 0) return null;
    const m = { t: 'f', from: best };
    out.push(m);
    s = apply(s, m);
  }
  return isWon(s) ? out : null;
}
