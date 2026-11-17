// Zahlenpaare – Feld-Generator (rein, deterministisch über den Seed).
//
// Faire Felder: Die Zahlen werden als verschachtelte «Klammer-Paare» erzeugt
// (z.B. 3 [7 7] 7 … wobei jede Klammer ein passendes Paar ist). Dann lässt sich das
// ganze Feld allein mit Zügen in Lesereihenfolge abräumen – ohne «Zahlen hinzufügen».
// Andere Züge (senkrecht, diagonal) sind natürlich trotzdem erlaubt.

import { makeRng } from '../../shared/rng.js';
import { COLS, linearPlan } from './rules.js';

/** Zufällige verschachtelte Paarstruktur: gibt für jede Position den Partner zurück. */
function nestedPairs(rng, n, openBias) {
  const partner = new Array(n).fill(-1);
  const stack = [];
  for (let p = 0; p < n; p++) {
    const left = n - p;
    const mustClose = stack.length === left;
    const canClose = stack.length > 0;
    const close = mustClose || (canClose && rng.next() > openBias);
    if (close) {
      const a = stack.pop();
      partner[a] = p; partner[p] = a;
    } else stack.push(p);
  }
  return partner;
}

function pairDigits(rng) {
  const a = rng.int(1, 9);
  const b = a === 5 || rng.chance(0.5) ? a : 10 - a;
  return rng.chance(0.5) ? [a, b] : [b, a];
}

/**
 * Erzeugt ein Feld mit `count` Zahlen (gerade Anzahl) und `stars` Sternfeldern.
 * opts: { count, stars = 0, openBias = 0.52 }
 */
export function generateBoard(seed, { count, stars = 0, openBias = 0.52 } = {}) {
  const rng = makeRng(typeof seed === 'string' ? seed : String(seed));
  const n = count % 2 ? count + 1 : count;
  let best = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const partner = nestedPairs(rng, n, openBias);
    const v = new Array(n);
    for (let p = 0; p < n; p++) {
      if (partner[p] > p) {
        const [a, b] = pairDigits(rng);
        v[p] = a; v[partner[p]] = b;
      }
    }
    const q = quality(v);
    if (!best || q > best.q) best = { v, q };
    if (q >= 0.6) break;
  }
  const cells = best.v.map((d) => ({ v: d, x: false, s: false }));
  // Sterne verteilt auf verschiedene Reihen setzen
  if (stars > 0) {
    const rows = Math.ceil(n / COLS);
    const picks = [];
    const order = rng.shuffle([...Array(n).keys()]);
    for (const k of order) {
      if (picks.length >= stars) break;
      const r = Math.floor(k / COLS);
      const sameRow = picks.filter((p) => Math.floor(p / COLS) === r).length;
      if (sameRow < Math.ceil(stars / rows)) picks.push(k);
    }
    for (const k of order) { if (picks.length >= stars) break; if (!picks.includes(k)) picks.push(k); }
    for (const k of picks) cells[k].s = true;
  }
  return cells;
}

/**
 * Wie «natürlich» sieht das Feld aus? Wenige direkt sichtbare Paare nebeneinander und
 * keine langen Wiederholungen derselben Ziffer. 0..1, höher ist besser.
 */
function quality(v) {
  let adjacent = 0, repeats = 0;
  for (let i = 1; i < v.length; i++) {
    if (v[i] === v[i - 1]) repeats++;
    if (v[i] === v[i - 1] || v[i] + v[i - 1] === 10) adjacent++;
  }
  const counts = new Array(10).fill(0);
  v.forEach((d) => counts[d]++);
  const maxShare = Math.max(...counts) / v.length;
  const adjShare = adjacent / (v.length - 1);
  return 1 - Math.abs(adjShare - 0.28) * 1.6 - repeats / v.length - Math.max(0, maxShare - 0.2) * 2;
}

/** Prüft, ob ein Feld sicher (allein in Lesereihenfolge) abräumbar ist. */
export function isFair(cells) {
  return !!linearPlan(cells.filter((c) => !c.x).map((c) => c.v));
}
