// Bäckerdutzend – 13 Stapel, abwärts bauen ohne Rücksicht auf die Farbe, Ablage nach Farben.
import { runPatience } from '../lib/cards/patience.js';
import { suitSVG } from '../lib/cards/face.js';
import * as R from './logic/rules.js';
import { solve } from './logic/solver.js';
import { findDeal, fromSeed, hint, finish } from './logic/deals.js';
import { ACCENT, MODES, DAILY_MODE, CONFETTI } from './data/config.js';
import { tutorialSteps } from './tutorial.js';

runPatience({
  id: 'bakers',
  title: 'Bäckerdutzend',
  tagline: '13 Stapel, geduldig ordnen',
  accent: ACCENT,
  confetti: CONFETTI,
  modes: MODES,
  dailyMode: DAILY_MODE,
  rows: [[0, 1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]],
  foundSlots: [3, 4, 5, 6],
  stockSlot: null,
  minFan: 3,
  foundHTML: (i) => suitSVG(i),
  emptyHTML: (c, st) => (st.free ? '<span class="pslot-l">frei</span>' : ''),
  tutorial: tutorialSteps,
  coachText: 'Tippe die leuchtende Karte an.',
  texts: {
    noPick: 'Nur die oberste Karte eines Stapels darf bewegt werden',
    noFit: (mode, st) => `Passt gerade nirgends – gesucht ist eine Karte eins höher (Farbe egal)${st.free ? ' oder ein leerer Stapel' : ''}`,
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
    downOf: () => 0,
    canPick: (st, c, i) => i === st.cols[c].length - 1,
    hint,
    finish,
    progress: (st) => R.foundCount(st) / 52,
    solve: (st) => { const r = solve(st, { maxNodes: 200000 }); return r.solved ? r.moves : null; },
  },
});
