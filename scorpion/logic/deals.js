// Skorpion – geprüfte Austeilungen und Tipps (reine Logik).
import { dealSeed, legalMoves } from './rules.js';
import { solve, orderedMoves } from './solver.js';
import { MODES, GEN_NODES, GEN_TRIES } from '../data/config.js';

const isOpen = (mode) => !!(MODES.find((m) => m.id === mode) || MODES[0]).open;

export const fromSeed = (seed, mode) => dealSeed(seed, isOpen(mode));

/** Lösbare Austeilung (deterministisch): Seeds «scorpion|<key>|0», «…|1», … bis der Löser gewinnt. */
export function findDeal(key, mode, { nodes = GEN_NODES, tries = GEN_TRIES } = {}) {
  let st = null;
  let seed = '';
  for (let k = 0; k < tries; k++) {
    seed = `scorpion|${key}|${k}`;
    st = fromSeed(seed, mode);
    const r = solve(st, { maxNodes: nodes });
    if (r.solved) return { seed, st, solution: r.moves, tries: k + 1 };
  }
  return { seed, st, solution: null, tries };
}

export function hint(st, budget = 6000) {
  const r = solve(st, { maxNodes: budget });
  if (r.solved && r.moves.length) return { move: r.moves[0], solved: true };
  const ms = orderedMoves(st);
  return { move: ms[0] || legalMoves(st)[0] || null, solved: r.solved };
}
