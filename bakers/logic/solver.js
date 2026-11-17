// Bäckerdutzend-Löser (alle Karten offen): Bestensuche mit Transpositionstabelle und sicheren
// Ablagezügen ohne Verzweigung.

import { bestFirst, colsKey } from '../../lib/cards/search.js';
import { rankOf, suitOf } from '../../lib/cards/deck.js';
import { COLS, canFound, canMove, apply, isWon } from './rules.js';

const key = (st) => colsKey(st.cols, null, st.found.join(','));

/** Sicher: jede Karte, die darauf passen könnte (eins tiefer, beliebige Farbe), liegt schon ab. */
function auto(st) {
  const lo = Math.min(st.found[0], st.found[1], st.found[2], st.found[3]);
  for (let c = 0; c < COLS; c++) {
    if (!canFound(st, c)) continue;
    const r = rankOf(st.cols[c][st.cols[c].length - 1]);
    if (r <= 2 || lo >= r - 1) return { t: 'f', from: c };
  }
  return null;
}

export function orderedMoves(st) {
  const scored = [];
  for (let c = 0; c < COLS; c++) {
    if (canFound(st, c)) scored.push([60 - rankOf(st.cols[c][st.cols[c].length - 1]), { t: 'f', from: c }]);
  }
  let emptyTo = -1;
  for (let c = 0; c < COLS; c++) if (!st.cols[c].length) { emptyTo = c; break; }
  for (let from = 0; from < COLS; from++) {
    const src = st.cols[from];
    const n = src.length;
    if (!n) continue;
    const a = src[n - 1];
    // Karte, die darunter liegt – hilft das Freilegen der Ablage?
    const under = n > 1 ? src[n - 2] : -1;
    const freesFound = under >= 0 && st.found[suitOf(under)] === rankOf(under) - 1;
    const onParent = under >= 0 && rankOf(under) === rankOf(a) + 1;
    for (let to = 0; to < COLS; to++) {
      if (to === from) continue;
      if (!st.cols[to].length) {
        if (to !== emptyTo || n === 1 || !canMove(st, from, to)) continue;
        scored.push([freesFound ? 50 : 8, { t: 'm', from, idx: n - 1, to }]);
        continue;
      }
      if (!canMove(st, from, to)) continue;
      let sc = 10;
      if (freesFound) sc = 55;
      else if (onParent) sc = 1;
      if (n === 1) sc += 5;
      scored.push([sc, { t: 'm', from, idx: n - 1, to }]);
    }
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map((x) => x[1]);
}

/** Bewertung (kleiner = besser): höhere Karten über tieferen blockieren – je tiefer die
 *  blockierte Karte, desto schlimmer. Abgelegte Karten zählen positiv. */
export function score(st, depth) {
  let s = 0;
  for (const col of st.cols) {
    for (let i = 0; i < col.length; i++) {
      const r = rankOf(col[i]);
      let blk = 0;
      for (let j = i + 1; j < col.length; j++) if (rankOf(col[j]) > r) blk++;
      if (blk) s += blk * W[r];
    }
  }
  s -= (st.found[0] + st.found[1] + st.found[2] + st.found[3]) * 6;
  return s + depth * 0.05;
}
const W = Array.from({ length: 14 }, (_, r) => 0.5 * Math.pow(14 - r, 1.5));

/** Wie orderedMoves, ohne sinnloses Umhängen einer Karte, die schon auf passender Unterlage liegt
 *  (ausser die Unterlage kann danach weiter). */
export function usefulMoves(st) {
  return orderedMoves(st).filter((m) => {
    if (m.t !== 'm') return true;
    const src = st.cols[m.from];
    const n = src.length;
    if (n < 2) return true;
    const under = src[n - 2];
    const ru = rankOf(under);
    if (ru !== rankOf(src[n - 1]) + 1) return true;
    if (st.found[suitOf(under)] === ru - 1) return true;
    for (let c = 0; c < COLS; c++) {
      const d = st.cols[c];
      if (c !== m.from && d.length && rankOf(d[d.length - 1]) === ru + 1) return true;
    }
    return false;
  });
}

export const ops = { key, won: isWon, moves: usefulMoves, apply, auto, score };

export function solve(st, opts = {}) {
  return bestFirst(st, ops, { maxNodes: 5000, ...opts });
}
