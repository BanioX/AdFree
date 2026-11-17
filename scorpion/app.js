// Skorpion – Farbreihen von König bis Ass bauen; ganze offene Gruppen bewegen.
import { runPatience } from '../lib/cards/patience.js';
import * as R from './logic/rules.js';
import { solve } from './logic/solver.js';
import { findDeal, fromSeed, hint } from './logic/deals.js';
import { ACCENT, MODES, DAILY_MODE, CONFETTI } from './data/config.js';
import { tutorialSteps, CROWN } from './tutorial.js';

runPatience({
  id: 'scorpion',
  title: 'Skorpion',
  tagline: 'Farbreihen von König bis Ass bauen',
  accent: ACCENT,
  confetti: CONFETTI,
  modes: MODES,
  dailyMode: DAILY_MODE,
  rows: [[0, 1, 2, 3, 4, 5, 6]],
  foundSlots: [3, 4, 5, 6],
  stockSlot: 0,
  stockHTML: '<span class="pslot-l">Reserve</span>',
  foundHTML: () => CROWN,
  emptyHTML: () => '<span class="pslot-l">K</span>',
  tutorial: tutorialSteps,
  coachText: 'Tippe die leuchtende Karte an – sie wandert auf ihre Farbe.',
  texts: {
    noFit: 'Passt gerade nirgends – gesucht ist die Karte eins höher in derselben Farbe',
    faceDown: 'Verdeckte Karten drehen sich um, sobald sie frei liegen',
  },
  events: {
    /** Fertige Reihe: die Karten fliegen von oben (Ass) bis König auf die Ablage. */
    onSettle(game, mid, after) {
      if (after.done.length <= mid.done.length) return 0;
      const s = after.done[after.done.length - 1];
      return Array.from({ length: 13 }, (_, r) => s * 13 + r);
    },
  },
  game: {
    newGame: (key, mode) => findDeal(key, mode),
    fromSeed,
    isLegal: R.isLegal,
    step: R.step,
    settle: R.settle,
    legalMoves: R.legalMoves,
    isWon: R.isWon,
    foundationPiles: R.foundationPiles,
    downOf: (st, c) => st.down[c],
    canPick: (st, c, i) => i >= st.down[c] && i < st.cols[c].length,
    stock: (st) => st.stock,
    hint,
    progress: R.progress,
    solve: (st) => { const r = solve(st, { maxNodes: 200000 }); return r.solved ? r.moves : null; },
  },
});
