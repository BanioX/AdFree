// Schneller Backtracking-Löser mit Bitmasken (für Eindeutigkeit und Lösungen).
// Reine Logik – kein DOM.

import { ALL, bit, CELL_UNITS, singleDigit, popcount } from './board.js';

/**
 * Zählt Lösungen (bis `limit`) und liefert die erste gefundene Lösung.
 * @param {ArrayLike<number>} values 81 Zahlen (0 = leer)
 * @returns {{ count: number, solution: number[] | null }}
 */
export function solve(values, limit = 2) {
  const grid = new Int8Array(81);
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    const v = values[i] | 0;
    if (!v) continue;
    const [r, c, b9] = CELL_UNITS[i];
    const b = b9 - 18, cc = c - 9;
    const m = bit(v);
    if ((rows[r] | cols[cc] | boxes[b]) & m) return { count: 0, solution: null };
    rows[r] |= m; cols[cc] |= m; boxes[b] |= m;
    grid[i] = v;
  }
  const empties = [];
  for (let i = 0; i < 81; i++) if (!grid[i]) empties.push(i);
  const R = new Uint8Array(81), C = new Uint8Array(81), B = new Uint8Array(81);
  for (let i = 0; i < 81; i++) { R[i] = CELL_UNITS[i][0]; C[i] = CELL_UNITS[i][1] - 9; B[i] = CELL_UNITS[i][2] - 18; }

  let count = 0;
  let first = null;
  const n = empties.length;

  function rec(k) {
    if (k === n) {
      count++;
      if (!first) first = Array.from(grid);
      return count >= limit;
    }
    // MRV: Zelle mit den wenigsten Möglichkeiten nach vorne holen
    let best = k, bestCount = 10, bestMask = 0;
    for (let t = k; t < n; t++) {
      const i = empties[t];
      const m = ALL & ~(rows[R[i]] | cols[C[i]] | boxes[B[i]]);
      const pc = popcount(m);
      if (pc < bestCount) {
        best = t; bestCount = pc; bestMask = m;
        if (pc <= 1) break;
      }
    }
    if (bestCount === 0) return false;
    const tmp = empties[k]; empties[k] = empties[best]; empties[best] = tmp;
    const i = empties[k];
    let m = bestMask;
    while (m) {
      const low = m & -m;
      m ^= low;
      rows[R[i]] |= low; cols[C[i]] |= low; boxes[B[i]] |= low;
      grid[i] = singleDigit(low);
      if (rec(k + 1)) return true;
      rows[R[i]] ^= low; cols[C[i]] ^= low; boxes[B[i]] ^= low;
      grid[i] = 0;
    }
    empties[best] = empties[k]; empties[k] = tmp;
    return false;
  }

  rec(0);
  return { count, solution: first };
}

/** Anzahl Lösungen, höchstens `limit`. */
export function countSolutions(values, limit = 2) {
  return solve(values, limit).count;
}

/** true, wenn das Rätsel genau eine Lösung hat. */
export function hasUniqueSolution(values) {
  return countSolutions(values, 2) === 1;
}

/** Zufällige, vollständig gefüllte gültige Lösung (deterministisch über rng). */
export function randomSolution(rng) {
  const grid = new Int8Array(81);
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  const order = [];
  for (let i = 0; i < 81; i++) order.push(i);
  const digitOrders = Array.from({ length: 81 }, () => rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  const R = (i) => (i / 9) | 0, C = (i) => i % 9, B = (i) => (((i / 27) | 0) * 3) + (((i % 9) / 3) | 0);

  function rec(k) {
    if (k === 81) return true;
    let best = k, bestCount = 10;
    for (let t = k; t < 81; t++) {
      const i = order[t];
      const m = ALL & ~(rows[R(i)] | cols[C(i)] | boxes[B(i)]);
      const pc = popcount(m);
      if (pc < bestCount) { best = t; bestCount = pc; if (pc <= 1) break; }
    }
    if (bestCount === 0) return false;
    const tmp = order[k]; order[k] = order[best]; order[best] = tmp;
    const i = order[k];
    const m = ALL & ~(rows[R(i)] | cols[C(i)] | boxes[B(i)]);
    for (const d of digitOrders[i]) {
      const b = bit(d);
      if (!(m & b)) continue;
      rows[R(i)] |= b; cols[C(i)] |= b; boxes[B(i)] |= b; grid[i] = d;
      if (rec(k + 1)) return true;
      rows[R(i)] ^= b; cols[C(i)] ^= b; boxes[B(i)] ^= b; grid[i] = 0;
    }
    order[best] = order[k]; order[k] = tmp;
    return false;
  }
  rec(0);
  return Array.from(grid);
}
