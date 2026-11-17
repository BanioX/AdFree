// Yukon – geprüfte Austeilungen, Tipps und «Automatisch beenden» (reine Logik).
import { dealSeed, faceDownCount, legalMoves } from './rules.js';
import { solveBF, orderedMoves } from './solver.js';
import { MODES, GEN_NODES, GEN_TRIES } from '../data/config.js';

const suitOf = (mode) => !!(MODES.find((m) => m.id === mode) || MODES[0]).suit;

export const fromSeed = (seed, mode) => dealSeed(seed, suitOf(mode));

/**
 * Lösbare Austeilung für einen Schlüssel (z.B. «klassisch|12» oder «daily|2026-11-17»).
 * Probiert «yukon|<key>|0», «…|1», … bis der Löser einen Weg findet – deterministisch.
 */
export function findDeal(key, mode, { nodes = GEN_NODES, tries = GEN_TRIES } = {}) {
  let st = null;
  let seed = '';
  for (let k = 0; k < tries; k++) {
    seed = `yukon|${key}|${k}`;
    st = fromSeed(seed, mode);
    const r = solveBF(st, { maxNodes: nodes });
    if (r.solved) return { seed, st, solution: r.moves, tries: k + 1 };
  }
  return { seed, st, solution: null, tries };
}

/** Tipp: erster Zug eines gefundenen Lösungswegs, sonst der beste Zug nach Faustregel. */
export function hint(st, budget = 6000) {
  const r = solveBF(st, { maxNodes: budget });
  if (r.solved && r.moves.length) return { move: r.moves[0], solved: true };
  const ms = orderedMoves(st);
  return { move: ms[0] || legalMoves(st)[0] || null, solved: r.solved };
}

/** Alle Karten offen? Dann Lösungsweg zum automatischen Beenden (oder null). */
export function finish(st) {
  if (faceDownCount(st) > 0) return null;
  const r = solveBF(st, { maxNodes: 4000 });
  return r.solved ? r.moves : null;
}
