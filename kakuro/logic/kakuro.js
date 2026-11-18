// Kakuro – reine Logik: Layout-Generator, Füllen, Löser (Lauf-Konsistenz), Rätsel-Erzeugung.
// Kein DOM. Deterministisch über den Seed.
//
// Rätsel: { rows, cols, max: 9, sol, across, down, groups, kind: 'kakuro' }
//   sol[i]    Lösung (0 = Block/Hinweisfeld)
//   across[i] Summe nach rechts (nur in Blockfeldern, 0 = keine)
//   down[i]   Summe nach unten  (nur in Blockfeldern, 0 = keine)
//   groups    Läufe: { cells, unique: true, kind: 'run', dir: 'a'|'d', sum, clue }

import { makeRng } from '../../shared/rng.js';
import { ALL9, popcount, runSupport, lowestDigit, combos } from '../../lib/numbers/combos.js';

// ---------- Layout ----------

function runsOf(white, R, C) {
  const runs = [];
  for (let r = 1; r < R; r++) {
    let c = 1;
    while (c < C) {
      if (!white[r * C + c]) { c++; continue; }
      const cells = [];
      while (c < C && white[r * C + c]) { cells.push(r * C + c); c++; }
      runs.push({ dir: 'a', cells, clue: cells[0] - 1 });
    }
  }
  for (let c = 1; c < C; c++) {
    let r = 1;
    while (r < R) {
      if (!white[r * C + c]) { r++; continue; }
      const cells = [];
      while (r < R && white[r * C + c]) { cells.push(r * C + c); r++; }
      runs.push({ dir: 'd', cells, clue: cells[0] - C });
    }
  }
  return runs;
}

function connected(white, R, C) {
  let start = -1, count = 0;
  for (let i = 0; i < R * C; i++) if (white[i]) { count++; if (start < 0) start = i; }
  if (start < 0) return false;
  const seen = new Uint8Array(R * C);
  const stack = [start];
  seen[start] = 1;
  let n = 0;
  while (stack.length) {
    const i = stack.pop();
    n++;
    const r = Math.floor(i / C), c = i % C;
    for (const j of [r > 0 ? i - C : -1, r < R - 1 ? i + C : -1, c > 0 ? i - 1 : -1, c < C - 1 ? i + 1 : -1]) {
      if (j >= 0 && white[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
  }
  return n === count;
}

/**
 * Erzeugt ein punktsymmetrisches Layout (Rand oben/links = Hinweisfelder).
 * opts: { density (Anteil zufälliger Blöcke), maxRun, minWhite (Anteil weisser Felder im Inneren) }
 */
export function makeLayout(R, C, rng, { density = 0.22, maxRun = 5, minWhite = 0.55 } = {}) {
  const mirror = (i) => { const r = Math.floor(i / C), c = i % C; return (R - r) * C + (C - c); };
  for (let attempt = 0; attempt < 400; attempt++) {
    const white = new Uint8Array(R * C);
    for (let r = 1; r < R; r++) for (let c = 1; c < C; c++) white[r * C + c] = 1;
    const setBlack = (i) => { white[i] = 0; white[mirror(i)] = 0; };
    for (let r = 1; r < R; r++) for (let c = 1; c < C; c++) {
      const i = r * C + c;
      if (i <= mirror(i) && rng.chance(density)) setBlack(i);
    }
    let ok = false;
    for (let it = 0; it < 60; it++) {
      let changed = false;
      const runs = runsOf(white, R, C);
      for (const run of runs) {
        if (run.cells.length === 1) {
          // Einzelfeld: Nachbar öffnen geht selten gut – einfach schliessen
          setBlack(run.cells[0]);
          changed = true;
        } else if (run.cells.length > maxRun) {
          const L = run.cells.length;
          const k = rng.int(2, L - 3);
          setBlack(run.cells[k]);
          changed = true;
        }
      }
      if (!changed) { ok = true; break; }
    }
    if (!ok) continue;
    let whites = 0;
    for (let i = 0; i < R * C; i++) whites += white[i];
    if (whites < minWhite * (R - 1) * (C - 1)) continue;
    if (!connected(white, R, C)) continue;
    // jede Zeile/Spalte des Inneren soll mindestens ein weisses Feld haben (kein leerer Rand)
    let emptyLine = false;
    for (let r = 1; r < R && !emptyLine; r++) { let any = 0; for (let c = 1; c < C; c++) any |= white[r * C + c]; if (!any) emptyLine = true; }
    for (let c = 1; c < C && !emptyLine; c++) { let any = 0; for (let r = 1; r < R; r++) any |= white[r * C + c]; if (!any) emptyLine = true; }
    if (emptyLine) continue;
    return white;
  }
  return null;
}

// ---------- Füllen ----------

/** Füllt die weissen Felder mit Ziffern, ohne Wiederholung in einem Lauf. */
export function fillLayout(white, R, C, rng, { bias = 0 } = {}) {
  const runs = runsOf(white, R, C);
  const runOf = { a: new Int16Array(R * C).fill(-1), d: new Int16Array(R * C).fill(-1) };
  runs.forEach((run, k) => { for (const i of run.cells) runOf[run.dir][i] = k; });
  const cells = [];
  for (let i = 0; i < R * C; i++) if (white[i]) cells.push(i);
  const used = new Int32Array(runs.length);
  const val = new Uint8Array(R * C);
  // Reihenfolge: Ziffern mit Neigung zu den Rändern (1, 2, 8, 9 machen Summen eindeutiger)
  const order = () => {
    const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const w = ds.map((d) => rng.next() * (1 + bias * Math.abs(d - 5) / 4));
    return ds.sort((a, b) => w[b - 1] - w[a - 1]);
  };
  let steps = 0;
  function rec(k) {
    if (k === cells.length) return true;
    if (++steps > 20000) return false;
    // MRV: Zelle mit den wenigsten freien Ziffern zuerst
    let best = k, bestC = 99;
    for (let q = k; q < cells.length; q++) {
      const i = cells[q];
      const free = ALL9 & ~(used[runOf.a[i]] | used[runOf.d[i]]);
      const c = popcount(free);
      if (c < bestC) { bestC = c; best = q; if (c <= 1) break; }
    }
    [cells[k], cells[best]] = [cells[best], cells[k]];
    const i = cells[k];
    const ra = runOf.a[i], rd = runOf.d[i];
    for (const d of order()) {
      const b = 1 << d;
      if ((used[ra] | used[rd]) & b) continue;
      used[ra] |= b; used[rd] |= b; val[i] = d;
      if (rec(k + 1)) return true;
      used[ra] &= ~b; used[rd] &= ~b; val[i] = 0;
    }
    [cells[k], cells[best]] = [cells[best], cells[k]];
    return false;
  }
  return rec(0) ? val : null;
}

// ---------- Rätsel aus Layout + Füllung ----------

export function buildPuzzle(white, val, R, C) {
  const runs = runsOf(white, R, C);
  const sol = new Array(R * C).fill(0);
  const across = new Array(R * C).fill(0);
  const down = new Array(R * C).fill(0);
  for (let i = 0; i < R * C; i++) if (white[i]) sol[i] = val[i];
  const groups = runs.map((run) => {
    const sum = run.cells.reduce((a, i) => a + val[i], 0);
    if (run.dir === 'a') across[run.clue] = sum; else down[run.clue] = sum;
    return { cells: run.cells, unique: true, kind: 'run', dir: run.dir, sum, clue: run.clue };
  });
  return { kind: 'kakuro', rows: R, cols: C, max: 9, sol, across, down, groups };
}

// ---------- Löser ----------

/**
 * Lauf-Konsistenz: verkleinert die Kandidaten aller Felder, bis sich nichts mehr ändert.
 * Gibt false bei Widerspruch zurück. doms wird verändert.
 */
export function propagate(p, doms, runsOfCell, queue = null) {
  const G = p.groups;
  const inQ = new Uint8Array(G.length);
  const q = queue ? [...queue] : G.map((_, k) => k);
  for (const k of q) inQ[k] = 1;
  let rounds = 0;
  while (q.length) {
    const k = q.shift();
    inQ[k] = 0;
    rounds++;
    const g = G[k];
    const ds = g.cells.map((i) => doms[i]);
    const { combos, cell } = runSupport(g.sum, ds);
    if (!combos.length) return false;
    for (let t = 0; t < g.cells.length; t++) {
      const i = g.cells[t];
      if (cell[t] !== doms[i]) {
        doms[i] = cell[t];
        if (!doms[i]) return false;
        for (const o of runsOfCell[i]) if (o !== k && !inQ[o]) { inQ[o] = 1; q.push(o); }
      }
    }
  }
  return rounds;
}

export function runsIndex(p) {
  const idx = Array.from({ length: p.sol.length }, () => []);
  p.groups.forEach((g, k) => { for (const i of g.cells) idx[i].push(k); });
  return idx;
}

/**
 * Zählt Lösungen (bis limit). Gibt { count, solution, guesses, logical } zurück.
 * logical = durch reine Lauf-Konsistenz lösbar (ohne Raten).
 */
export function solve(p, { limit = 2, nodeLimit = 200000 } = {}) {
  const idx = runsIndex(p);
  const doms = p.sol.map((v) => (v ? ALL9 : 0));
  if (p.givens) p.givens.forEach((g, i) => { if (g) doms[i] = 1 << g; });
  let count = 0, solution = null, guesses = 0, nodes = 0, aborted = false;
  const cells = [];
  for (let i = 0; i < p.sol.length; i++) if (p.sol[i]) cells.push(i);
  if (propagate(p, doms, idx) === false) return { count: 0, solution: null, guesses: 0, logical: false };
  const logical = cells.every((i) => popcount(doms[i]) === 1);
  function rec(d) {
    if (count >= limit || aborted) return;
    if (++nodes > nodeLimit) { aborted = true; return; }
    let best = -1, bc = 99;
    for (const i of cells) {
      const c = popcount(d[i]);
      if (c > 1 && c < bc) { bc = c; best = i; if (c === 2) break; }
    }
    if (best < 0) {
      count++;
      if (!solution) solution = cells.reduce((s, i) => { s[i] = lowestDigit(d[i]); return s; }, new Array(p.sol.length).fill(0));
      return;
    }
    guesses++;
    for (let v = 1; v <= 9; v++) {
      if (!(d[best] & (1 << v))) continue;
      const nd = d.slice();
      nd[best] = 1 << v;
      if (propagate(p, nd, idx, idx[best]) !== false) rec(nd);
      if (count >= limit) return;
    }
  }
  rec(doms);
  return { count: aborted ? -1 : count, solution, guesses, logical };
}

/** Kandidaten eines Feldes aus den Läufen (für Notizen/Helfer), berücksichtigt gesetzte Ziffern. */
export function runCandidates(p, vals, i, idx = runsIndex(p)) {
  let m = ALL9;
  for (const k of idx[i]) {
    const g = p.groups[k];
    const ds = g.cells.map((j) => (vals[j] ? 1 << vals[j] : ALL9));
    const t = g.cells.indexOf(i);
    const { cell } = runSupport(g.sum, ds);
    m &= cell[t] || 0;
  }
  return m;
}

// ---------- Erzeugung ----------

/**
 * Erzeugt ein eindeutig und ohne Raten lösbares Kakuro.
 * spec: { rows, cols, density, maxRun, minWhite, bias }
 */
export function generate(spec, seed) {
  const rng = makeRng(seed);
  const R = spec.rows, C = spec.cols;
  for (let attempt = 0; attempt < 200; attempt++) {
    const white = makeLayout(R, C, rng, spec);
    if (!white) continue;
    const val = fillLayout(white, R, C, rng, { bias: spec.bias ?? 0.6 });
    if (!val) continue;
    const p = refine(white, val, R, C, rng, spec.maxIter ?? 80);
    if (p) { p.seed = String(seed); return p; }
  }
  throw new Error('Kakuro: kein Rätsel gefunden');
}

/**
 * Verbessert eine Füllung schrittweise, bis das Rätsel ohne Raten (und damit eindeutig) lösbar ist:
 * ein noch offenes Feld bekommt eine andere Ziffer, die beide Summen möglichst eindeutig macht.
 */
function refine(white, val, R, C, rng, maxIter) {
  for (let it = 0; it < maxIter; it++) {
    const p = buildPuzzle(white, val, R, C);
    const idx = runsIndex(p);
    const doms = p.sol.map((v) => (v ? ALL9 : 0));
    if (propagate(p, doms, idx) === false) return null;
    const open = [];
    for (let i = 0; i < doms.length; i++) if (p.sol[i] && popcount(doms[i]) > 1) open.push(i);
    if (!open.length) return p;
    // ein offenes Feld wählen und umfärben
    rng.shuffle(open);
    let done = false;
    for (const i of open.slice(0, 4)) {
      const [ga, gb] = idx[i].map((k) => p.groups[k]);
      let used = 0;
      for (const g of [ga, gb]) for (const j of g.cells) if (j !== i) used |= 1 << val[j];
      const cand = [];
      for (let d = 1; d <= 9; d++) {
        if ((used & (1 << d)) || d === val[i]) continue;
        const delta = d - val[i];
        const score = combos(ga.sum + delta, ga.cells.length).length * combos(gb.sum + delta, gb.cells.length).length;
        cand.push({ d, score: score + rng.next() * 0.9 });
      }
      if (!cand.length) continue;
      cand.sort((a, b) => a.score - b.score);
      val[i] = (rng.chance(0.75) ? cand[0] : rng.pick(cand)).d;
      done = true;
      break;
    }
    if (!done) return null;
  }
  return null;
}

/** Prüft ein Rätsel: Summen stimmen, Läufe ohne Wiederholung, Läufe 2–9 lang. */
export function checkPuzzle(p) {
  for (const g of p.groups) {
    if (g.cells.length < 2 || g.cells.length > 9) return false;
    const seen = new Set();
    let s = 0;
    for (const i of g.cells) { const v = p.sol[i]; if (!v || seen.has(v)) return false; seen.add(v); s += v; }
    if (s !== g.sum) return false;
    if ((g.dir === 'a' ? p.across : p.down)[g.clue] !== s) return false;
  }
  return true;
}
