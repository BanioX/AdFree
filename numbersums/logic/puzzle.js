// Zahlensummen – Rätsel, Löser und Generator (rein, ohne DOM).
//
// Ein Rätsel:
//   { n, digits: [n*n Ziffern 1–9], keep: [n*n bool] (Lösung: Ziffer bleibt),
//     rows: [n Zielsummen], cols: [n Zielsummen],
//     region: null | [n*n Bereichsnummer], regionSums: null | [k Zielsummen] }
// Gesucht: welche Ziffern bleiben, damit jede Reihe, Spalte (und jeder Farbbereich) ihre Summe ergibt.
// Jedes erzeugte Rätsel hat genau EINE Lösung.

import { makeRng } from '../../shared/rng.js';

const popSum = (digits, base, mask, n) => {
  let s = 0;
  for (let c = 0; c < n; c++) if (mask & (1 << c)) s += digits[base + c];
  return s;
};

/** Alle Linien (Reihen, Spalten, Bereiche) als { kind, idx, cells, target }. */
export function lines(p) {
  const out = [];
  const { n } = p;
  for (let r = 0; r < n; r++) out.push({ kind: 'row', idx: r, cells: [...Array(n)].map((_, c) => r * n + c), target: p.rows[r] });
  for (let c = 0; c < n; c++) out.push({ kind: 'col', idx: c, cells: [...Array(n)].map((_, r) => r * n + c), target: p.cols[c] });
  if (p.region) {
    const k = p.regionSums.length;
    for (let g = 0; g < k; g++) {
      const cells = [];
      p.region.forEach((x, i) => { if (x === g) cells.push(i); });
      out.push({ kind: 'region', idx: g, cells, target: p.regionSums[g] });
    }
  }
  return out;
}

/** Zählt Lösungen (bis limit). Gibt { count, sols: [keep-Arrays] } zurück. */
export function solve(p, limit = 2) {
  const { n, digits } = p;
  const rowOpts = [];
  for (let r = 0; r < n; r++) {
    const opts = [];
    for (let m = 1; m < (1 << n); m++) if (popSum(digits, r * n, m, n) === p.rows[r]) opts.push(m);
    if (!opts.length) return { count: 0, sols: [] };
    rowOpts.push(opts);
  }
  // Rest-Maxima pro Spalte / Bereich ab Reihe r
  const colRest = [];
  for (let r = 0; r <= n; r++) {
    const a = new Array(n).fill(0);
    for (let rr = r; rr < n; rr++) for (let c = 0; c < n; c++) a[c] += digits[rr * n + c];
    colRest.push(a);
  }
  const K = p.region ? p.regionSums.length : 0;
  const regRest = [];
  if (K) {
    for (let r = 0; r <= n; r++) {
      const a = new Array(K).fill(0);
      for (let i = r * n; i < n * n; i++) a[p.region[i]] += digits[i];
      regRest.push(a);
    }
  }
  const colAcc = new Array(n).fill(0);
  const regAcc = new Array(K).fill(0);
  const chosen = new Array(n);
  const sols = [];
  let count = 0;

  function rec(r) {
    if (count >= limit) return;
    if (r === n) {
      for (let c = 0; c < n; c++) if (colAcc[c] !== p.cols[c]) return;
      for (let g = 0; g < K; g++) if (regAcc[g] !== p.regionSums[g]) return;
      count++;
      const keep = new Array(n * n).fill(false);
      for (let rr = 0; rr < n; rr++) for (let c = 0; c < n; c++) keep[rr * n + c] = !!(chosen[rr] & (1 << c));
      sols.push(keep);
      return;
    }
    const base = r * n;
    for (const m of rowOpts[r]) {
      let ok = true;
      for (let c = 0; c < n; c++) {
        const add = m & (1 << c) ? digits[base + c] : 0;
        const acc = colAcc[c] + add;
        if (acc > p.cols[c] || acc + colRest[r + 1][c] < p.cols[c]) { ok = false; break; }
      }
      if (!ok) continue;
      if (K) {
        for (let c = 0; c < n; c++) if (m & (1 << c)) regAcc[p.region[base + c]] += digits[base + c];
        for (let g = 0; g < K && ok; g++) {
          if (regAcc[g] > p.regionSums[g] || regAcc[g] + regRest[r + 1][g] < p.regionSums[g]) ok = false;
        }
        if (!ok) {
          for (let c = 0; c < n; c++) if (m & (1 << c)) regAcc[p.region[base + c]] -= digits[base + c];
          continue;
        }
      }
      for (let c = 0; c < n; c++) if (m & (1 << c)) colAcc[c] += digits[base + c];
      chosen[r] = m;
      rec(r + 1);
      for (let c = 0; c < n; c++) if (m & (1 << c)) colAcc[c] -= digits[base + c];
      if (K) for (let c = 0; c < n; c++) if (m & (1 << c)) regAcc[p.region[base + c]] -= digits[base + c];
      if (count >= limit) return;
    }
  }
  rec(0);
  return { count, sols };
}

/** Teilt das Gitter in zusammenhängende Bereiche (Grösse etwa minS–maxS). */
export function makeRegions(rng, n, minS = 3, maxS = 6) {
  const region = new Array(n * n).fill(-1);
  const order = rng.shuffle([...Array(n * n).keys()]);
  const nb = (i) => {
    const r = Math.floor(i / n), c = i % n, out = [];
    if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1);
    return out;
  };
  let k = 0;
  for (const seed of order) {
    if (region[seed] >= 0) continue;
    const size = rng.int(minS, maxS);
    const cells = [seed];
    region[seed] = k;
    while (cells.length < size) {
      const front = [];
      for (const c of cells) for (const x of nb(c)) if (region[x] < 0) front.push(x);
      if (!front.length) break;
      const x = rng.pick(front);
      region[x] = k; cells.push(x);
    }
    k++;
  }
  // Einzelne Mini-Bereiche (1–2 Felder) einem Nachbarn anhängen
  const sizes = () => { const s = new Array(k).fill(0); region.forEach((g) => s[g]++); return s; };
  let s = sizes();
  for (let i = 0; i < n * n; i++) {
    const g = region[i];
    if (s[g] >= 2) continue;
    const others = nb(i).map((x) => region[x]).filter((x) => x !== g);
    if (others.length) { region[i] = others.reduce((a, b) => (s[a] <= s[b] ? a : b)); s = sizes(); }
  }
  // Nummern lückenlos machen
  const map = new Map();
  return region.map((g) => { if (!map.has(g)) map.set(g, map.size); return map.get(g); });
}

function computeSums(p) {
  const { n } = p;
  p.rows = []; p.cols = [];
  for (let r = 0; r < n; r++) { let s = 0; for (let c = 0; c < n; c++) if (p.keep[r * n + c]) s += p.digits[r * n + c]; p.rows.push(s); }
  for (let c = 0; c < n; c++) { let s = 0; for (let r = 0; r < n; r++) if (p.keep[r * n + c]) s += p.digits[r * n + c]; p.cols.push(s); }
  if (p.region) {
    const k = Math.max(...p.region) + 1;
    p.regionSums = new Array(k).fill(0);
    p.region.forEach((g, i) => { if (p.keep[i]) p.regionSums[g] += p.digits[i]; });
  }
}

function validKeep(p) {
  const { n, keep } = p;
  for (let r = 0; r < n; r++) { let k = 0; for (let c = 0; c < n; c++) k += keep[r * n + c] ? 1 : 0; if (k === 0) return false; }
  for (let c = 0; c < n; c++) { let k = 0; for (let r = 0; r < n; r++) k += keep[r * n + c] ? 1 : 0; if (k === 0) return false; }
  if (p.region) {
    const k = Math.max(...p.region) + 1;
    const cnt = new Array(k).fill(0);
    p.region.forEach((g, i) => { if (p.keep[i]) cnt[g]++; });
    if (cnt.some((x) => x === 0)) return false;
  }
  return true;
}

/**
 * Erzeugt ein eindeutig lösbares Rätsel.
 * opts: { n, keepRate = 0.5, regions = false }
 */
export function generate(seed, { n, keepRate = 0.5, regions = false } = {}) {
  const rng = makeRng(typeof seed === 'string' ? seed : String(seed));
  for (let attempt = 0; attempt < 200; attempt++) {
    const p = { n, digits: [], keep: [], region: null, regionSums: null };
    for (let i = 0; i < n * n; i++) {
      // keine drei gleichen Ziffern nebeneinander
      let d;
      do { d = rng.int(1, 9); } while (i % n >= 2 && p.digits[i - 1] === d && p.digits[i - 2] === d);
      p.digits.push(d);
      p.keep.push(rng.chance(keepRate));
    }
    if (regions) p.region = makeRegions(rng, n);
    if (!validKeep(p)) continue;
    for (let fix = 0; fix < 40; fix++) {
      computeSums(p);
      const res = solve(p, 2);
      if (res.count === 1) {
        const f = finish(p);
        if (logicSolve(f).solved) return f;   // fair: ohne Raten lösbar
        break;
      }
      if (res.count === 0) break; // sollte nicht vorkommen
      // Mehrdeutig: eine Ziffer ändern, in der sich zwei Lösungen unterscheiden
      const [a, b] = res.sols;
      const diff = [];
      for (let i = 0; i < n * n; i++) if (a[i] !== b[i]) diff.push(i);
      const i = rng.pick(diff);
      let d;
      do { d = rng.int(1, 9); } while (d === p.digits[i]);
      p.digits[i] = d;
    }
  }
  throw new Error('Kein eindeutiges Rätsel gefunden');
}

function finish(p) {
  return { n: p.n, digits: p.digits, keep: p.keep, rows: p.rows, cols: p.cols, region: p.region, regionSums: p.regionSums };
}

/** Prüft ein Rätsel: Summen stimmen mit der Lösung überein und die Lösung ist eindeutig. */
export function verify(p) {
  const copy = { ...p, keep: p.keep.slice() };
  computeSums(copy);
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  if (!same(copy.rows, p.rows) || !same(copy.cols, p.cols) || (p.region && !same(copy.regionSums, p.regionSums))) return false;
  return solve(p, 2).count === 1;
}

// ---------- Logisches Lösen (für Tipps und Fairness) ----------

/**
 * Ein Schritt Linien-Logik: Für eine Linie werden alle Teilmengen der offenen Felder geprüft,
 * die zur Restsumme passen. Felder in allen Teilmengen müssen bleiben, Felder in keiner müssen weg.
 * marks: Array (0 offen, 1 bleibt, 2 weg). Gibt { i, keep, line } zurück oder null.
 */
export function deduceOne(p, marks, allLines = lines(p)) {
  for (const L of allLines) {
    const open = [];
    let rest = L.target;
    for (const i of L.cells) {
      if (marks[i] === 1) rest -= p.digits[i];
      else if (marks[i] === 0) open.push(i);
    }
    if (!open.length) continue;
    const m = open.length;
    let all = (1 << m) - 1, any = 0, found = 0;
    for (let s = 0; s < (1 << m); s++) {
      let sum = 0;
      for (let k = 0; k < m; k++) if (s & (1 << k)) sum += p.digits[open[k]];
      if (sum !== rest) continue;
      found++;
      all &= s; any |= s;
    }
    if (!found) continue;
    for (let k = 0; k < m; k++) {
      if (all & (1 << k)) return { i: open[k], keep: true, line: L };
      if (!(any & (1 << k))) return { i: open[k], keep: false, line: L };
    }
  }
  return null;
}

/** Löst so weit wie möglich mit Linien-Logik. Gibt { solved, steps, marks } zurück. */
export function logicSolve(p, marks = new Array(p.n * p.n).fill(0)) {
  marks = marks.slice();
  const L = lines(p);
  let steps = 0;
  for (;;) {
    const d = deduceOne(p, marks, L);
    if (!d) break;
    marks[d.i] = d.keep ? 1 : 2;
    steps++;
  }
  return { solved: marks.every((x) => x !== 0), steps, marks };
}
