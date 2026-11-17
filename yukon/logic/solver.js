// Yukon-Löser (volle Information): beweist, dass eine Austeilung lösbar ist, und liefert Tipps.
// Tiefensuche mit Transpositionstabelle, sicheren Ablagezügen ohne Verzweigung und
// Zug-Reihenfolge nach Nutzen (aufdecken > Spalte leeren > Rest).

import { dfs, bestFirst, colsKey } from '../../lib/cards/search.js';
import { suitOf, rankOf, isRed } from '../../lib/cards/deck.js';
import { COLS, canFound, apply, isWon, fits } from './rules.js';

const key = (st) => colsKey(st.cols, st.down, st.found.join(','));

/** Sicher auf die Ablage: niemand braucht die Karte mehr als Unterlage. */
function safeFound(st, x) {
  const r = rankOf(x);
  if (r <= 2) return true;
  if (st.suit) return true; // Russisch: nur die gleiche Farbe r-1 passt darauf – die liegt schon auf der Ablage
  const red = isRed(x);
  for (let s = 0; s < 4; s++) {
    if ((s === 1 || s === 3) !== red && st.found[s] < r - 1) return false;
  }
  return true;
}

function auto(st) {
  for (let c = 0; c < COLS; c++) {
    if (canFound(st, c)) {
      const col = st.cols[c];
      if (safeFound(st, col[col.length - 1])) return { t: 'f', from: c };
    }
  }
  return null;
}

/** Züge, nach Nutzen sortiert. */
export function orderedMoves(st) {
  const pos = new Map();
  for (let c = 0; c < COLS; c++) {
    const col = st.cols[c];
    for (let i = st.down[c]; i < col.length; i++) pos.set(col[i], c * 64 + i);
  }
  const scored = [];
  const push = (m, s) => scored.push([s, m]);
  for (let c = 0; c < COLS; c++) {
    if (canFound(st, c)) {
      const col = st.cols[c];
      const flips = col.length - 1 === st.down[c] && st.down[c] > 0;
      push({ t: 'f', from: c }, flips ? 95 : 60 - rankOf(col[col.length - 1]));
    }
  }
  let firstEmpty = -1;
  for (let c = 0; c < COLS; c++) if (!st.cols[c].length) { firstEmpty = c; break; }
  for (let to = 0; to < COLS; to++) {
    const dst = st.cols[to];
    if (!dst.length) continue;
    const t = dst[dst.length - 1];
    const r = rankOf(t);
    if (r === 1) continue;
    const s = suitOf(t);
    const cands = st.suit ? [s * 13 + r - 2] : (isRed(t) ? [r - 2, 26 + r - 2] : [13 + r - 2, 39 + r - 2]);
    for (const a of cands) {
      const p = pos.get(a);
      if (p == null) continue;
      const from = (p / 64) | 0, idx = p % 64;
      if (from === to) continue;
      const col = st.cols[from];
      let sc = 10;
      if (idx === st.down[from] && st.down[from] > 0) sc = 80 + st.down[from];
      else if (idx === 0) sc = 40;
      else if (fits(a, col[idx - 1], st.suit)) sc = 2; // liegt schon passend – nur umhängen
      sc += Math.min(6, col.length - idx) * 0.1;
      push({ t: 'm', from, idx, to }, sc);
    }
  }
  if (firstEmpty >= 0) {
    for (let from = 0; from < COLS; from++) {
      const col = st.cols[from];
      for (let idx = Math.max(1, st.down[from]); idx < col.length; idx++) {
        if (rankOf(col[idx]) !== 13) continue;
        let sc = idx === st.down[from] && st.down[from] > 0 ? 70 + st.down[from] : 20;
        if (idx > st.down[from] && fits(col[idx], col[idx - 1], st.suit)) sc = 1;
        push({ t: 'm', from, idx, to: firstEmpty }, sc);
      }
    }
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map((x) => x[1]);
}

export const ops = { key, won: isWon, moves: orderedMoves, apply, auto };

export function solve(st, opts = {}) {
  return dfs(st, ops, { maxNodes: 60000, ...opts });
}

/** Bewertung für die Bestensuche (kleiner = besser). */
export function score(st, depth) {
  let s = 0;
  for (let c = 0; c < COLS; c++) {
    const col = st.cols[c];
    s += st.down[c] * 9 + (st.down[c] ? st.down[c] * st.down[c] * 0.5 : 0);
    for (let i = Math.max(1, st.down[c]); i < col.length; i++) {
      if (!fits(col[i], col[i - 1], st.suit)) s += 3;
    }
    if (!col.length) s -= 2;
  }
  s -= (st.found[0] + st.found[1] + st.found[2] + st.found[3]) * 4;
  return s + depth * 0.02;
}

export function solveBF(st, opts = {}) {
  return bestFirst(st, { ...ops, score }, { maxNodes: 30000, ...opts });
}
