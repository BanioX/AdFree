import { makeRng } from '../shared/rng.js';
import { around } from '../lib/puzzle/grid.js';

export function newPuzzle(diff, seed = 1) {
  const w = diff === 'leicht' ? 4 : 5;
  const n = w * w;
  const presses = diff === 'schwer' ? 9 : diff === 'leicht' ? 4 : 6;
  const rng = makeRng(seed);
  const on = Array(n).fill(false);
  const need = Array(n).fill(false);
  const order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  for (let k = 0; k < presses; k++) flip(on, need, order[k], w);
  return { w, h: w, on, need };
}

function flip(on, need, i, w) {
  const h = on.length / w;
  on[i] = !on[i];
  need[i] = !need[i];
  for (const j of around(i, w, h, false)) on[j] = !on[j];
}

export function press(state, i) {
  const on = state.on.slice();
  const need = state.need.slice();
  flip(on, need, i, state.w);
  return { ...state, on, need };
}

export function solved(state) {
  return state.on.every((v) => !v);
}

export function hintCell(state) {
  return state.need.findIndex(Boolean);
}
