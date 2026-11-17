// Bäckerdutzend – geprüfte Austeilungen, Tipps und «Automatisch beenden» (reine Logik).
import { dealSeed, legalMoves, isSorted, finishMoves } from './rules.js';
import { solve, usefulMoves } from './solver.js';
import { MODES, GEN_NODES, GEN_TRIES } from '../data/config.js';

const isFree = (mode) => !!(MODES.find((m) => m.id === mode) || MODES[0]).free;

export const fromSeed = (seed, mode) => dealSeed(seed, isFree(mode));

/** Lösbare Austeilung (deterministisch): Seeds «bakers|<key>|0», «…|1», … bis der Löser gewinnt. */
export function findDeal(key, mode, { nodes = GEN_NODES, tries = GEN_TRIES } = {}) {
  let st = null;
  let seed = '';
  for (let k = 0; k < tries; k++) {
    seed = `bakers|${key}|${k}`;
    st = fromSeed(seed, mode);
    const r = solve(st, { maxNodes: nodes });
    if (r.solved) return { seed, st, solution: r.moves, tries: k + 1 };
  }
  return { seed, st, solution: null, tries };
}

export function hint(st, budget = 6000) {
  const r = solve(st, { maxNodes: budget });
  if (r.solved && r.moves.length) return { move: r.moves[0], solved: true };
  const ms = usefulMoves(st);
  return { move: ms[0] || legalMoves(st)[0] || null, solved: r.solved };
}

/** Alle Stapel absteigend geordnet? Dann geht der Rest von allein auf die Ablage. */
export function finish(st) {
  return isSorted(st) ? finishMoves(st) : null;
}
