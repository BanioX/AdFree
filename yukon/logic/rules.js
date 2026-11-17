// Yukon – Regeln (reine Logik, ohne DOM).
//
// Zustand (unveränderlich behandelt):
//   { cols: number[7][]  Kartencodes von unten nach oben,
//     down: number[7]    Anzahl verdeckter Karten unten in jeder Spalte,
//     found: number[4]   Anzahl Karten auf der Ablage je Farbe (0 … 13),
//     suit: bool         Russisch: Bauen nur in gleicher Farbe }
//
// Züge:  { t: 'f', from }              oberste Karte der Spalte auf die Ablage
//        { t: 'm', from, idx, to }     Karte cols[from][idx] samt allem darüber auf Spalte to

import { shuffledDeck, suitOf, rankOf, isRed } from '../../lib/cards/deck.js';

export const COLS = 7;

/** Darf Karte a auf Karte b gelegt werden? */
export function fits(a, b, suit) {
  if (rankOf(b) !== rankOf(a) + 1) return false;
  return suit ? suitOf(a) === suitOf(b) : isRed(a) !== isRed(b);
}

/** Austeilen: Spalte 0 eine offene Karte, Spalte i: i verdeckte + 5 offene. */
export function dealDeck(deck, suit = false) {
  const cols = [];
  const down = [];
  let p = 0;
  for (let c = 0; c < COLS; c++) {
    const n = c === 0 ? 1 : c + 5;
    cols.push(deck.slice(p, p + n));
    down.push(c === 0 ? 0 : c);
    p += n;
  }
  return { cols, down, found: [0, 0, 0, 0], suit: !!suit };
}

export function dealSeed(seed, suit = false) {
  return dealDeck(shuffledDeck(seed), suit);
}

export const top = (st, c) => st.cols[c][st.cols[c].length - 1];

export function canFound(st, c) {
  const col = st.cols[c];
  if (!col.length || col.length <= st.down[c]) return false;
  const x = col[col.length - 1];
  return st.found[suitOf(x)] === rankOf(x) - 1;
}

export function canMove(st, from, idx, to) {
  if (from === to || to < 0 || to >= COLS) return false;
  const src = st.cols[from];
  if (idx < st.down[from] || idx >= src.length) return false;
  const a = src[idx];
  const dst = st.cols[to];
  if (!dst.length) return rankOf(a) === 13;
  return fits(a, dst[dst.length - 1], st.suit);
}

export function isLegal(st, m) {
  if (!m) return false;
  if (m.t === 'f') return m.from >= 0 && m.from < COLS && canFound(st, m.from);
  if (m.t === 'm') return canMove(st, m.from, m.idx, m.to);
  return false;
}

/** Zug ausführen, ohne aufzudecken. */
export function step(st, m) {
  const cols = st.cols.slice();
  const found = st.found;
  if (m.t === 'f') {
    const col = cols[m.from].slice();
    const x = col.pop();
    cols[m.from] = col;
    const f = found.slice();
    f[suitOf(x)]++;
    return { ...st, cols, found: f };
  }
  const src = cols[m.from];
  cols[m.to] = cols[m.to].concat(src.slice(m.idx));
  cols[m.from] = src.slice(0, m.idx);
  return { ...st, cols };
}

/** Verdeckte Karte aufdecken, wenn sie oben liegt. */
export function settle(st) {
  let down = null;
  for (let c = 0; c < COLS; c++) {
    if (st.down[c] > 0 && st.cols[c].length === st.down[c]) {
      if (!down) down = st.down.slice();
      down[c]--;
    }
  }
  return down ? { ...st, down } : st;
}

export const apply = (st, m) => settle(step(st, m));

export function isWon(st) {
  return st.found[0] + st.found[1] + st.found[2] + st.found[3] === 52;
}

export function faceDownCount(st) {
  return st.down.reduce((a, b) => a + b, 0);
}

export const foundCount = (st) => st.found.reduce((a, b) => a + b, 0);

/** Alle erlaubten Züge (auch wenig sinnvolle – für die Prüfung «keine Züge mehr»). */
export function legalMoves(st) {
  const out = [];
  for (let c = 0; c < COLS; c++) if (canFound(st, c)) out.push({ t: 'f', from: c });
  for (let from = 0; from < COLS; from++) {
    const col = st.cols[from];
    for (let idx = st.down[from]; idx < col.length; idx++) {
      for (let to = 0; to < COLS; to++) {
        if (!canMove(st, from, idx, to)) continue;
        // König ganz unten auf leere Spalte schieben ändert nichts
        if (!st.cols[to].length && idx === 0) continue;
        out.push({ t: 'm', from, idx, to });
      }
    }
  }
  return out;
}

/** Ablage-Stapel für die Anzeige: je Farbe die Karten Ass … oberste. */
export function foundationPiles(st) {
  return st.found.map((n, s) => Array.from({ length: n }, (_, i) => s * 13 + i));
}

export function solvedFraction(st) {
  return foundCount(st) / 52;
}
