// Skorpion-Löser (volle Information): Bestensuche mit Transpositionstabelle.
// Pro Spalten-Oberkarte gibt es höchstens einen passenden Zug (gleiche Farbe, eins tiefer),
// dazu Könige auf leere Spalten und das Austeilen der Reserve – der Suchraum bleibt klein.

import { bestFirst, colsKey } from '../../lib/cards/search.js';
import { rankOf } from '../../lib/cards/deck.js';
import { COLS, apply, isWon, fits } from './rules.js';

const key = (st) => colsKey(st.cols, st.down, st.stock.length + '/' + st.done.length);

export function orderedMoves(st) {
  const pos = new Map();
  for (let c = 0; c < COLS; c++) {
    const col = st.cols[c];
    for (let i = st.down[c]; i < col.length; i++) pos.set(col[i], c * 64 + i);
  }
  const scored = [];
  for (let to = 0; to < COLS; to++) {
    const dst = st.cols[to];
    if (!dst.length) continue;
    const t = dst[dst.length - 1];
    if (rankOf(t) === 1) continue;
    const a = t - 1; // gleiche Farbe, eins tiefer
    const p = pos.get(a);
    if (p == null) continue;
    const from = (p / 64) | 0, idx = p % 64;
    if (from === to) continue;
    let sc = 10;
    if (idx === st.down[from] && st.down[from] > 0) sc = 80 + st.down[from];
    else if (idx === 0) sc = 30;
    else if (fits(a, st.cols[from][idx - 1])) sc = 1;
    scored.push([sc, { t: 'm', from, idx, to }]);
  }
  let empty = -1;
  for (let c = 0; c < COLS; c++) if (!st.cols[c].length) { empty = c; break; }
  if (empty >= 0) {
    for (let from = 0; from < COLS; from++) {
      const col = st.cols[from];
      for (let idx = Math.max(1, st.down[from]); idx < col.length; idx++) {
        if (rankOf(col[idx]) !== 13) continue;
        const sc = idx === st.down[from] && st.down[from] > 0 ? 70 : (fits(col[idx], col[idx - 1]) ? 1 : 20);
        scored.push([sc, { t: 'm', from, idx, to: empty }]);
      }
    }
  }
  if (st.stock.length) scored.push([5, { t: 'd' }]);
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map((x) => x[1]);
}

export function score(st, depth) {
  let s = 0;
  for (let c = 0; c < COLS; c++) {
    const col = st.cols[c];
    s += st.down[c] * 10;
    for (let i = Math.max(1, st.down[c]); i < col.length; i++) if (!fits(col[i], col[i - 1])) s += 4;
    if (st.down[c] === 0 && col.length && rankOf(col[0]) !== 13) s += 2;
    if (!col.length) s -= 3;
  }
  s += st.stock.length * 2;
  s -= st.done.length * 30;
  return s + depth * 0.02;
}

export const ops = { key, won: isWon, moves: orderedMoves, apply, score };

export function solve(st, opts = {}) {
  return bestFirst(st, ops, { maxNodes: 20000, ...opts });
}
