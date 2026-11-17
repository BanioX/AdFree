// Yukon – wie Klondike, aber jede offene Karte darf samt allem darüber bewegt werden.
import { runPatience } from '../lib/cards/patience.js';
import { suitSVG } from '../lib/cards/face.js';
import * as R from './logic/rules.js';
import { solveBF } from './logic/solver.js';
import { findDeal, fromSeed, hint, finish } from './logic/deals.js';
import { ACCENT, MODES, DAILY_MODE, CONFETTI } from './data/config.js';
import { tutorialSteps } from './tutorial.js';

runPatience({
  id: 'yukon',
  title: 'Yukon',
  tagline: 'Ganze Stapel ziehen, Farben ordnen',
  accent: ACCENT,
  confetti: CONFETTI,
  modes: MODES,
  dailyMode: DAILY_MODE,
  rows: [[0, 1, 2, 3, 4, 5, 6]],
  foundSlots: [3, 4, 5, 6],
  stockSlot: null,
  foundHTML: (i) => suitSVG(i),
  emptyHTML: () => '<span class="pslot-l">K</span>',
  tutorial: tutorialSteps,
  coachText: 'Tippe die leuchtende Karte an – sie wandert an ihren Platz.',
  texts: {
    noFit: (mode) => `Passt gerade nirgends – gesucht ist eine Karte eins höher in ${mode === 'russisch' ? 'der gleichen' : 'der anderen'} Farbe`,
    faceDown: 'Verdeckte Karten drehen sich um, sobald sie frei liegen',
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
    hint,
    finish,
    progress: (st) => R.foundCount(st) / 52 * 0.7 + (1 - R.faceDownCount(st) / 21) * 0.3,
    solve: (st) => { const r = solveBF(st, { maxNodes: 200000 }); return r.solved ? r.moves : null; },
  },
});
