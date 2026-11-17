// Zahlenschlange – Rätsel, Löser und Generator (rein, ohne DOM).
//
// Ein Rätsel: { w, h, sol: [Zahl je Feld, 0 = Loch], given: [bool je Feld], N }
// Ziel: Zahlen 1…N so eintragen, dass jede Zahl die nächste berührt (auch schräg).
// Jedes erzeugte Rätsel hat genau EINE Lösung.

import { makeRng } from '../../shared/rng.js';

const cache = new Map();
/** Nachbarn (8 Richtungen) je Feld. */
export function neighbors(w, h) {
  const key = w + 'x' + h;
  if (cache.has(key)) return cache.get(key);
  const out = [];
  for (let i = 0; i < w * h; i++) {
    const r = Math.floor(i / w), c = i % w, list = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < h && cc >= 0 && cc < w) list.push(rr * w + cc);
    }
    out.push(list);
  }
  cache.set(key, out);
  return out;
}

export const touching = (w, a, b) => a !== b && Math.abs(Math.floor(a / w) - Math.floor(b / w)) <= 1 && Math.abs((a % w) - (b % w)) <= 1;
const dist = (w, a, b) => Math.max(Math.abs(Math.floor(a / w) - Math.floor(b / w)), Math.abs((a % w) - (b % w)));

/** Zufälliger Weg durch alle Felder (Warnsdorff-Regel mit Zufall, notfalls neu). */
export function randomPath(rng, w, h) {
  const nb = neighbors(w, h);
  const n = w * h;
  for (let tries = 0; tries < 200; tries++) {
    const used = new Uint8Array(n);
    const path = [rng.int(0, n - 1)];
    used[path[0]] = 1;
    while (path.length < n) {
      const cur = path[path.length - 1];
      const opts = nb[cur].filter((x) => !used[x]);
      if (!opts.length) break;
      // Warnsdorff: zuerst Felder mit wenig freien Nachbarn; etwas Zufall gegen Schlangenlinien
      let best = null, bestScore = Infinity;
      for (const x of opts) {
        const deg = nb[x].filter((y) => !used[y]).length;
        const score = deg + rng.next() * 0.9;
        if (score < bestScore) { bestScore = score; best = x; }
      }
      used[best] = 1;
      path.push(best);
    }
    if (path.length === n) return path;
  }
  throw new Error('Kein Weg gefunden');
}

/**
 * Zählt Lösungen (bis limit) – Constraint-Suche: Es wird immer die fehlende Zahl mit den
 * wenigsten möglichen Feldern gesetzt. Mögliche Felder für k liegen nah genug an der nächst-
 * kleineren und nächstgrösseren gesetzten Zahl (Abstand ≤ Zahlenabstand). Jedes freie Feld muss
 * für mindestens eine fehlende Zahl in Frage kommen.
 * p: { w, h, N, sol (0 = Loch), given }. Gibt { count, first } zurück.
 */
export function solve(p, limit = 2, budget = Infinity) {
  const { w, h, N } = p;
  const n = w * h;
  const pos = new Int16Array(N + 2).fill(-1);
  const cell = new Int16Array(n);           // Zahl je Feld (0 frei, -1 Loch)
  for (let i = 0; i < n; i++) {
    if (p.sol[i] === 0) cell[i] = -1;
    else if (p.given[i]) { cell[i] = p.sol[i]; pos[p.sol[i]] = i; }
  }
  const R = new Int8Array(n), C = new Int8Array(n);
  for (let i = 0; i < n; i++) { R[i] = Math.floor(i / w); C[i] = i % w; }
  const d = (a, b) => Math.max(Math.abs(R[a] - R[b]), Math.abs(C[a] - C[b]));
  let count = 0;
  let first = null;
  let nodes = 0;
  const cover = new Uint8Array(n);    // für wie viele fehlende Zahlen kommt das Feld in Frage
  const only = new Int16Array(n);     // … und für welche (falls genau eine)

  function rec() {
    if (count >= limit) return;
    if (++nodes > budget) { count = limit; first = null; return; }   // zu aufwendig: als mehrdeutig werten
    let bestK = -1, bestList = null;
    cover.fill(0);
    let lo = 0;
    let missing = 0;
    for (let k = 1; k <= N; k++) {
      if (pos[k] >= 0) { lo = k; continue; }
      missing++;
      let hi = k + 1;
      while (hi <= N && pos[hi] < 0) hi++;
      const list = [];
      const pl = lo ? pos[lo] : -1, ph = hi <= N ? pos[hi] : -1;
      for (let c = 0; c < n; c++) {
        if (cell[c] !== 0) continue;
        if (pl >= 0 && d(c, pl) > k - lo) continue;
        if (ph >= 0 && d(c, ph) > hi - k) continue;
        list.push(c);
        if (cover[c] < 2) { cover[c]++; only[c] = k; }
      }
      if (!list.length) return;
      if (!bestList || list.length < bestList.length) { bestK = k; bestList = list; }
    }
    if (!missing) {
      // alle gesetzt: Nachbarschaft prüfen
      for (let k = 1; k < N; k++) if (d(pos[k], pos[k + 1]) !== 1) return;
      count++;
      if (!first) first = Array.from(cell);
      return;
    }
    // Jedes freie Feld muss belegt werden können; passt nur eine Zahl, ist sie erzwungen.
    for (let c = 0; c < n; c++) {
      if (cell[c] !== 0) continue;
      if (!cover[c]) return;
      if (cover[c] === 1 && bestList.length > 1) { bestK = only[c]; bestList = [c]; }
    }
    for (const c of bestList) {
      cell[c] = bestK; pos[bestK] = c;
      rec();
      cell[c] = 0; pos[bestK] = -1;
      if (count >= limit) return;
    }
  }
  if (N > 0) rec();
  return { count, first };
}

/**
 * Erzeugt ein eindeutiges Rätsel.
 * opts: { w, h, holes = 0 (Felder am Wegende abschneiden), givenRate = 0.35 }
 */
export function generate(seed, { w, h, holes = 0, givenRate = 0.35, maxGap = 6, budget = 4000 } = {}) {
  const rng = makeRng(typeof seed === 'string' ? seed : String(seed));
  const n = w * h;
  const path = randomPath(rng, w, h);
  const N = n - holes;
  const sol = new Array(n).fill(0);
  path.slice(0, N).forEach((cellIdx, k) => { sol[cellIdx] = k + 1; });
  const given = sol.map((v) => v > 0);
  const p = { w, h, N, sol, given };
  const target = Math.max(2, Math.round(N * givenRate));
  let count = N;
  // Zahlen in zufälliger Reihenfolge wegnehmen, solange es eindeutig bleibt
  const order = rng.shuffle(path.slice(0, N).filter((i) => sol[i] !== 1 && sol[i] !== N));
  for (const i of order) {
    if (count <= target) break;
    // Lücken zwischen gegebenen Zahlen begrenzen (fair und schnell lösbar)
    const v = sol[i];
    let a = v - 1, b = v + 1;
    while (a > 1 && !given[path[a - 1]]) a--;
    while (b < N && !given[path[b - 1]]) b++;
    if (b - a - 1 > maxGap) continue;
    given[i] = false;
    if (solve(p, 2, budget).count !== 1) given[i] = true;
    else count--;
  }
  return { w, h, N, sol, given };
}

/** Prüft: Weg gültig (1…N, Nachbarn) und eindeutig lösbar. */
export function verify(p) {
  const { w, sol, N } = p;
  const pos = new Array(N + 1).fill(-1);
  sol.forEach((v, i) => { if (v > 0) pos[v] = i; });
  for (let k = 1; k <= N; k++) if (pos[k] < 0) return false;
  for (let k = 1; k < N; k++) if (!touching(w, pos[k], pos[k + 1])) return false;
  if (!p.given[pos[1]] || !p.given[pos[N]]) return false;
  return solve(p, 2).count === 1;
}
