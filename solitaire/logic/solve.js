// Einheitlicher Einstieg für alle Löser.
import { MODES, newDeal } from './rules.js';
import { solveKlondike } from './solve-klondike.js';
import { solveFreecell } from './solve-freecell.js';
import { solveSpider } from './solve-spider.js';

/** Löst einen Zustand. opts: { maxNodes, timeLimit (ms), wantMoves } */
export function solveState(st, opts = {}) {
  if (st.game === 'klondike') return solveKlondike(st, opts);
  if (st.game === 'freecell') return solveFreecell(st, opts);
  return solveSpider(st, opts);
}

/** Standard-Knotenlimits je Modus (für Prüfung beim Geben). */
export const NODE_LIMITS = {
  klondike1: 150000, klondike3: 150000, freecell: 60000, spider1: 40000, spider2: 40000, spider4: 200000,
};

export function solveSeed(modeId, seed, opts = {}) {
  if (!MODES[modeId]) throw new Error('Modus?');
  return solveState(newDeal(modeId, seed), { maxNodes: NODE_LIMITS[modeId], ...opts });
}
