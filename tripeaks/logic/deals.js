// Gipfel – Runden erzeugen (rein, deterministisch).
//
// Runde n eines Modus hat immer denselben Seed. Mit «nur lösbare Partien» wird der erste
// Seed-Kandidat genommen, den der Löser innerhalb eines festen Knoten-Budgets löst – auf jedem
// Gerät dasselbe Ergebnis.

import { dealFromSeed, newState } from './rules.js';
import { solve } from './solver.js';

export const CHECK_NODES = 20000;

export function findDeal({ key, n = 0, wrap = true, solvable = true, tries = 80 }) {
  let first = null;
  for (let k = 0; k < tries; k++) {
    const seed = `tripeaks|${key}|${n}|${k}`;
    const state = newState(dealFromSeed(seed), wrap);
    if (!first) first = { seed, state };
    if (!solvable) return first;
    const r = solve(state, { maxNodes: CHECK_NODES });
    if (r.solved) return { seed, state, solution: r.moves };
  }
  return first;
}
