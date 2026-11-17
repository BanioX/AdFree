// Tipps: findet den nächsten Schritt für die aktuelle Partie. Reine Logik – kein DOM.

import { bit, UNITS, PEERS, candidatesFromValues } from './board.js';
import { makeState, findStep, applyStep } from './human.js';

/**
 * @param {import('./game.js').Game} game
 * @returns {{type:'wrong', cell} | {type:'step', step, blockers} | {type:'reveal', cell, digit} | null}
 */
export function findHint(game) {
  if (game.isSolved()) return null;
  const wrong = game.wrongCells();
  if (wrong.length) return { type: 'wrong', cell: wrong[0] };
  const state = makeState(game.values, game.elims);
  // Schritte, deren Streichungen die Spielerin in ihren Notizen schon gemacht hat, überspringen
  for (let guard = 0; guard < 60; guard++) {
    const step = findStep(state, 4);
    if (!step) break;
    if (!step.place && step.elims.every(({ c, d }) => game.notes[c] && !(game.notes[c] & bit(d)))) {
      for (const { c, d } of step.elims) game.elims[c] |= bit(d);
      applyStep(state, step);
      continue;
    }
    return { type: 'step', step, blockers: step.place ? blockersFor(game.values, step) : [] };
  }
  // Notlösung: ein Feld aufdecken (Feld mit den wenigsten Möglichkeiten)
  const cands = candidatesFromValues(game.values);
  let best = -1, bestN = 10;
  for (let i = 0; i < 81; i++) {
    if (game.values[i]) continue;
    let n = 0;
    for (let m = cands[i]; m; m &= m - 1) n++;
    if (n < bestN) { bestN = n; best = i; }
  }
  return best < 0 ? null : { type: 'reveal', cell: best, digit: game.sol[best] };
}

/**
 * «Warum nur hier?» – Zellen mit der Ziffer, die die anderen freien Felder der Einheit blockieren.
 * Für versteckte Einer und letzte Felder.
 */
export function blockersFor(values, step) {
  const { place, units, tech } = step;
  if (!place) return [];
  const d = place.d;
  const out = new Set();
  if (tech === 'hiddenSingle') {
    const unit = UNITS[units[0]];
    for (const i of unit) {
      if (i === place.c || values[i]) continue;
      const b = PEERS[i].find((j) => values[j] === d);
      if (b != null) out.add(b);
    }
  } else if (tech === 'nakedSingle') {
    // je Ziffer eine sichtbare Zelle, die sie ausschliesst
    for (let x = 1; x <= 9; x++) {
      if (x === d) continue;
      const b = PEERS[place.c].find((j) => values[j] === x);
      if (b != null) out.add(b);
    }
  }
  return [...out];
}

export { bit };
