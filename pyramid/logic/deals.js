// Pyramide – Partien erzeugen (rein, deterministisch).
//
// Partie n eines Modus hat immer denselben Seed. Mit «nur lösbare Partien» wird der erste
// Seed-Kandidat genommen, den der Löser innerhalb eines festen Knoten-Budgets löst – das Ergebnis
// ist auf jedem Gerät gleich (kein Zeitlimit, sondern Knotenzahl).

import { dealFromSeed, newState } from './rules.js';
import { solve } from './solver.js';

export const CHECK_NODES = 25000;

/**
 * { key, n, maxRed, solvable } -> { seed, state, solution? }
 * key: z.B. 'normal' oder 'daily-2026-11-17'
 */
export function findDeal({ key, n = 0, maxRed = 1, solvable = true, tries = 80 }) {
  let first = null;
  for (let k = 0; k < tries; k++) {
    const seed = `pyramid|${key}|${n}|${k}`;
    const state = newState(dealFromSeed(seed), maxRed);
    if (!first) first = { seed, state };
    if (!solvable) return first;
    const r = solve(state, { maxNodes: CHECK_NODES });
    if (r.solved) return { seed, state, solution: r.moves };
  }
  return first;
}
