// Stapel-Sortieren – Level-Generator (reine Logik, kein DOM).
//
// Mischt n Farben × cap Teile auf n volle Stapel (+ leere Stapel) und prüft mit dem Löser,
// dass das Level lösbar ist und nicht zu einfach. Gleicher Seed => gleiches Level, überall.
//
//   generateLevel({ seed: 'ballsort-12', colors: 5, cap: 4, empties: 2, rules, minMoves: 8 })
//   → { stacks, cap, par, solution, tries }

import { makeRng } from '../../shared/rng.js';
import { solve } from './solver.js';
import { isComplete } from './engine.js';

/** Wie «durchmischt» ein Stapelsatz ist: Anzahl gleichfarbiger Nachbarn (kleiner = gemischter). */
export function adjacency(stacks) {
  let k = 0;
  for (const s of stacks) for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1]) k++;
  return k;
}

function deal(rng, colors, cap, fill) {
  const pieces = [];
  for (let c = 0; c < colors; c++) for (let k = 0; k < cap; k++) pieces.push(c);
  rng.shuffle(pieces);
  const stacks = [];
  if (fill === 'full') {
    for (let i = 0; i < colors; i++) stacks.push(pieces.slice(i * cap, (i + 1) * cap));
    return stacks;
  }
  // 'loose': Teile auf colors+1 Stapel verteilt, nicht alle voll (abwechslungsreichere Form).
  const n = colors + 1;
  for (let i = 0; i < n; i++) stacks.push([]);
  let i = 0;
  for (const p of pieces) {
    let guard = 0;
    while (stacks[i % n].length >= cap && guard++ < n) i++;
    stacks[i % n].push(p);
    i += rng.int(1, 2);
  }
  return stacks;
}

/**
 * opts: { seed, colors, cap, empties, rules, minMoves = 0, maxAdj, fill = 'full', maxTries = 40, maxNodes }
 * Farben werden zusätzlich zufällig umbenannt (Farbnummern 0 … colors-1 bleiben).
 */
export function generateLevel(opts) {
  const { seed, colors, cap, empties, rules } = opts;
  const fill = opts.fill || 'full';
  const minMoves = opts.minMoves || 0;
  const maxAdj = opts.maxAdj != null ? opts.maxAdj : Math.max(1, Math.floor(colors * cap / 6));
  const maxTries = opts.maxTries || 40;
  const rng = makeRng(String(seed));
  let best = null;
  for (let tries = 1; tries <= maxTries; tries++) {
    const stacks = deal(rng, colors, cap, fill);
    if (stacks.some((s) => isComplete(s, cap))) continue;
    if (adjacency(stacks) > maxAdj) continue;
    for (let e = 0; e < empties; e++) stacks.push([]);
    const r = solve({ cap, stacks }, rules, { maxNodes: opts.maxNodes || 40000 });
    if (!r) continue;
    const cand = { stacks, cap, par: r.moves.length, solution: r.moves, tries };
    if (r.moves.length >= minMoves) return cand;
    if (!best || cand.par > best.par) best = cand;
  }
  if (best) return best;
  // Notfall (praktisch nie): eine Röhre mehr – dann ist fast alles lösbar.
  return generateLevel({ ...opts, seed: seed + '+', empties: empties + 1, maxTries: 60 });
}
