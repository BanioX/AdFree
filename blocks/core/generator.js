// Fairer Teile-Generator: liefert immer drei Teile.
//  - mit Wahrscheinlichkeit `fair` lassen sich alle drei Teile (in irgendeiner Reihenfolge) setzen
//  - sonst passt mindestens eines
//  - mit Wahrscheinlichkeit `assist` ist ein Teil dabei, das sofort eine Linie füllen kann
//  - ist das Brett voll, kommen kleinere Teile häufiger («Gnade»)
// Rein logisch, deterministisch mit Rng.

import { fullLines } from './board.js';

/** Gewichtung der Grössenstufen (tier 0..3) je nach Schwierigkeit d (0..1). */
export function tierBoost(d) {
  const x = Math.max(0, Math.min(1, d));
  const lerp = (a, b) => a + (b - a) * x;
  return [lerp(1.5, 0.8), 1, lerp(0.55, 1.15), lerp(0.3, 1.2)];
}

/** Teile-Pool mit Gewichten. allow: optionale Liste erlaubter Form-IDs. */
export function makePool(cat, d, allow = null) {
  const boost = tierBoost(d);
  const set = allow ? new Set(allow) : null;
  return cat.list
    .filter((v) => !set || set.has(v.shape))
    .map((v) => ({ v, w: v.weight * boost[v.tier] }));
}

/**
 * Lassen sich alle Teile nacheinander setzen (inkl. Abräumen dazwischen)?
 * Tiefensuche mit Knotenbudget; ist das Budget aufgebraucht, gilt die Antwort als «ja».
 */
export function canPlaceAll(rows, n, vars, budget = 5000) {
  const ctx = { budget };
  return dfs(Uint16Array.from(rows), n, vars, 0, vars.length, ctx);
}

function dfs(rows, n, vars, used, left, ctx) {
  if (left === 0) return true;
  const full = (1 << n) - 1;
  for (let k = 0; k < vars.length; k++) {
    if (used & (1 << k)) continue;
    const v = vars[k];
    // gleiche Variante nur einmal pro Ebene probieren
    let dup = false;
    for (let j = 0; j < k; j++) if (!(used & (1 << j)) && vars[j].key === v.key) { dup = true; break; }
    if (dup) continue;
    for (let r = 0; r + v.h <= n; r++) {
      for (let c = 0; c + v.w <= n; c++) {
        let ok = true;
        for (let i = 0; i < v.h; i++) if (rows[r + i] & (v.masks[i] << c)) { ok = false; break; }
        if (!ok) continue;
        if (--ctx.budget < 0) return true;
        if (left === 1) return true;
        const next = rows.slice();
        for (let i = 0; i < v.h; i++) next[r + i] |= v.masks[i] << c;
        let colMask = full;
        for (let i = 0; i < n; i++) colMask &= next[i];
        for (let i = 0; i < n; i++) next[i] = next[i] === full ? 0 : next[i] & ~colMask;
        if (dfs(next, n, vars, used | (1 << k), left - 1, ctx)) return true;
      }
    }
  }
  return false;
}

/** Kann v irgendwo so gesetzt werden, dass sofort eine Linie voll wird? */
export function canClearWith(board, v) {
  const n = board.n;
  for (let r = 0; r + v.h <= n; r++) {
    for (let c = 0; c + v.w <= n; c++) {
      if (!board.canPlace(v, r, c)) continue;
      const after = board.rows.slice();
      for (let i = 0; i < v.h; i++) after[r + i] |= v.masks[i] << c;
      const fl = fullLines(after, n);
      if (fl.rows.length || fl.cols.length) return true;
    }
  }
  return false;
}

function crowdedPool(pool, fill) {
  if (fill < 0.5) return pool;
  const k = Math.min(1, (fill - 0.5) / 0.25);
  return pool.map((p) => ({ v: p.v, w: p.w * (p.v.n <= 3 ? 1 + 1.5 * k : p.v.n >= 6 ? 1 - 0.6 * k : 1) }));
}

function pickTriple(rng, pool, first = null) {
  const out = first ? [first] : [];
  let guard = 0;
  while (out.length < 3 && guard++ < 40) {
    const v = rng.weighted(pool).v;
    // höchstens zweimal dieselbe Form in einer Runde
    if (out.filter((x) => x.shape === v.shape).length >= 2) continue;
    out.push(v);
  }
  while (out.length < 3) out.push(rng.weighted(pool).v);
  return out;
}

/**
 * Nächste drei Teile.
 * cfg: { d: Schwierigkeit 0..1, fair: 0..1, assist: 0..1, allow?: [shapeIds] }
 */
export function nextTriple(board, rng, cat, cfg = {}) {
  const d = cfg.d ?? 0.3;
  const n = board.n;
  const fill = board.filledCount / (n * n);
  const pool = crowdedPool(makePool(cat, d, cfg.allow), fill);
  const fair = fill > 0.55 ? 1 : (cfg.fair ?? 1);
  const wantAll = rng.next() < fair;
  const wantAssist = rng.next() < (cfg.assist ?? 0.25);

  let assistPool = null;
  if (wantAssist) {
    assistPool = pool.filter((p) => canClearWith(board, p.v));
    if (!assistPool.length) assistPool = null;
  }

  for (let attempt = 0; attempt < 14; attempt++) {
    const first = assistPool && attempt < 6 ? rng.weighted(assistPool).v : null;
    const triple = pickTriple(rng, pool, first);
    if (first) rng.shuffle(triple);
    const ok = wantAll ? canPlaceAll(board.rows, n, triple) : triple.some((v) => board.fits(v));
    if (ok) return triple;
  }
  // Rückfall: mindestens ein passendes Teil, die anderen möglichst klein
  const fitting = pool.filter((p) => board.fits(p.v));
  if (!fitting.length) return [cat.find('#'), cat.find('#'), cat.find('#')];
  const small = fitting.filter((p) => p.v.n <= 3);
  return [rng.weighted(fitting).v, rng.weighted(small.length ? small : fitting).v, rng.weighted(small.length ? small : fitting).v];
}

/** «Neue Teile»-Rettung: drei kleinere Teile, die sicher alle passen (wenn möglich mit Abräum-Chance). */
export function rescueTriple(board, rng, cat) {
  const n = board.n;
  const small = cat.list.filter((v) => v.n <= 4).map((v) => ({ v, w: v.n <= 2 ? 0.8 : 1.2 }));
  const clearers = small.filter((p) => canClearWith(board, p.v));
  for (let attempt = 0; attempt < 30; attempt++) {
    const first = clearers.length && attempt < 20 ? rng.weighted(clearers).v : null;
    const triple = pickTriple(rng, small, first);
    if (canPlaceAll(board.rows, n, triple, 20000)) return triple;
  }
  const dot = cat.find('#');
  return [dot, dot, dot];
}
