// Golf-Patience – Löcher erzeugen (rein, deterministisch).
//
// Loch h der Runde r eines Modus hat immer denselben Seed. Mit «nur abräumbare Löcher» wird der
// erste Kandidat genommen, für den der Löser innerhalb eines festen Knoten-Budgets einen Weg zum
// Abräumen findet. Das Par kommt vom «fairen Spieler» (ohne Blick in den Talon) plus 1.

import { dealFromSeed, newState } from './rules.js';
import { clearPath, fairPlay } from './solver.js';

export const CHECK_NODES = 30000;

export function parOf(state) {
  return Math.max(1, fairPlay(state).score + 1);
}

/** { key, round, hole, wrap, solvable } -> { seed, state, par, solution? } */
export function findHole({ key, round = 0, hole = 1, wrap = true, solvable = true, tries = 120 }) {
  let first = null;
  for (let k = 0; k < tries; k++) {
    const seed = `golf|${key}|${round}|${hole}|${k}`;
    const state = newState(dealFromSeed(seed), wrap);
    if (!first) first = { seed, state };
    if (!solvable) break;
    const r = clearPath(state, { maxNodes: CHECK_NODES });
    if (r.cleared) return { seed, state, par: parOf(state), solution: r.moves };
  }
  return { ...first, par: parOf(first.state) };
}
