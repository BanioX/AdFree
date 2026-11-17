// Rätsel-Generator: eindeutige Lösung, Einstufung mit dem menschlichen Löser.
// Deterministisch: gleicher Seed => gleiches Rätsel. Reine Logik – kein DOM.

import { makeRng } from '../../shared/rng.js';
import { stringify, parse, countGivens } from './board.js';
import { solve, countSolutions, randomSolution } from './solver.js';
import { grade } from './human.js';

/**
 * Erzeugt ein Rätsel passend zu `spec` (siehe data/difficulties.js).
 * Entfernt Ziffern punktsymmetrisch, solange das Rätsel eindeutig bleibt und
 * mit Techniken bis spec.maxTier lösbar ist.
 * @returns {{ puzzle: string, solution: string, tier: number, score: number, givens: number, attempts: number }}
 */
export function generate(spec, seed, { maxAttempts = 400 } = {}) {
  const rng = makeRng(seed);
  let fallback = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const sol = randomSolution(rng);
    const p = sol.slice();
    const target = rng.int(spec.minGivens, Math.max(spec.minGivens, spec.minTier >= 2 ? spec.minGivens : spec.maxGivens));
    const order = [];
    for (let i = 0; i <= 40; i++) order.push(i);
    rng.shuffle(order);
    let givens = 81;
    for (const i of order) {
      const j = 80 - i;
      const n = i === j ? 1 : 2;
      if (givens - n < target) continue;
      const a = p[i], b = p[j];
      p[i] = 0; p[j] = 0;
      if (countSolutions(p, 2) !== 1 || !grade(p, spec.maxTier, { exclude: spec.forbid }).solved) {
        p[i] = a; p[j] = b;
        continue;
      }
      givens -= n;
    }
    const g = grade(p, spec.maxTier);
    const ok = fitsSpec(g, givens, spec);
    const result = { puzzle: stringify(p), solution: stringify(sol), tier: g.tier, score: g.score, givens, attempts: attempt };
    if (ok) return result;
    if (g.solved && (!fallback || g.tier > fallback.tier)) fallback = result;
  }
  return fallback;
}

/**
 * Passt ein eingestuftes Rätsel (g = grade(…)) zur Stufe spec?
 * Prüft Technik-Stufe, Vorgaben, Punktzahl sowie `require` (Technik muss mindestens n-mal nötig sein)
 * und `forbid` (Technik darf nie nötig sein). Der Löser nimmt immer die einfachste Technik zuerst –
 * ein «nackter Einer» zählt also nur, wenn es in dem Moment keinen versteckten Einer gab.
 */
export function fitsSpec(g, givens, spec) {
  if (!g || !g.solved || g.tier < spec.minTier || g.tier > spec.maxTier) return false;
  if (givens < spec.minGivens || givens > spec.maxGivens) return false;
  if (spec.minScore && g.score < spec.minScore) return false;
  for (const [tech, n] of Object.entries(spec.require || {})) if ((g.counts[tech] || 0) < n) return false;
  for (const tech of spec.forbid || []) if (g.counts[tech]) return false;
  return true;
}

/** Lösung eines Rätsel-Strings (oder null, wenn nicht eindeutig lösbar). */
export function solutionOf(puzzle) {
  const r = solve(parse(puzzle), 2);
  return r.count === 1 ? stringify(r.solution) : null;
}

// ---------- Symmetrie-Transformationen ----------
// Ein Rätsel lässt sich umformen, ohne dass sich Lösbarkeit oder Schwierigkeit ändern:
// Ziffern umbenennen, spiegeln/drehen, Bänder 1↔3 tauschen, Reihen gespiegelt tauschen.
// Alle Umformungen hier erhalten auch die Punktsymmetrie der Vorgaben.

const MIRROR_PERMS = [[0, 1, 2], [2, 1, 0]]; // Reihenfolge innerhalb eines äusseren Bandes
const OUTER_PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

function lineMap(rng) {
  // Neue Reihenfolge der 9 Linien, punktsymmetrie-erhaltend
  const swapBands = rng.chance(0.5);
  const outer = rng.pick(OUTER_PERMS); // Reihen im oberen Band
  const mid = rng.pick(MIRROR_PERMS);
  const map = new Array(9);
  const top = outer.map((x) => x);
  const bottom = outer.map((x) => 8 - x); // gespiegelt: Reihe r <-> 8-r
  const middle = mid.map((x) => 3 + x);
  const bands = swapBands ? [bottom.slice().reverse(), middle, top.slice().reverse()] : [top, middle, bottom.slice().reverse()];
  // bands[k][t] = alte Linie, die an Position 3k+t landet
  for (let k = 0; k < 3; k++) for (let t = 0; t < 3; t++) map[3 * k + t] = bands[k][t];
  return map;
}

/**
 * Formt ein Rätsel (und optional seine Lösung) zufällig um.
 * @param {string} puzzle 81 Zeichen
 * @param {string|null} solution 81 Zeichen
 * @param {{next:Function}} rng aus makeRng
 */
export function transform(puzzle, solution, rng) {
  const digits = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const rows = lineMap(rng);
  const cols = lineMap(rng);
  const transpose = rng.chance(0.5);
  const conv = (str) => {
    if (!str) return str;
    const src = parse(str);
    const out = new Array(81);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        let sr = rows[r], sc = cols[c];
        if (transpose) { const t = sr; sr = sc; sc = t; }
        const v = src[sr * 9 + sc];
        out[r * 9 + c] = v ? digits[v - 1] : 0;
      }
    }
    return stringify(out);
  };
  return { puzzle: conv(puzzle), solution: conv(solution) };
}

export { countGivens };
