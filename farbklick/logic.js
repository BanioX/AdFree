import { makeRng } from '../shared/rng.js';
import { around } from '../lib/puzzle/grid.js';

export function newFlood(diff, seed = 1) {
  const w = diff === 'schwer' ? 10 : 8;
  const colors = diff === 'leicht' ? 4 : 5;
  const rng = makeRng(seed);
  const grid = Array.from({ length: w * w }, () => rng.int(0, colors - 1));
  return { w, colors, grid, moves: 0 };
}

export function flood(state, color) {
  if (color === state.grid[0] || color < 0 || color >= state.colors) return state;
  const grid = state.grid.slice();
  const from = grid[0];
  const stack = [0];
  const seen = new Set([0]);
  while (stack.length) {
    const i = stack.pop();
    if (grid[i] !== from) continue;
    grid[i] = color;
    for (const j of around(i, state.w, state.w, false)) {
      if (!seen.has(j) && grid[j] === from) { seen.add(j); stack.push(j); }
    }
  }
  return { ...state, grid, moves: state.moves + 1 };
}

export function done(state) {
  return state.grid.every((c) => c === state.grid[0]);
}

export function bestColor(state) {
  const region = new Set();
  const stack = [0];
  const from = state.grid[0];
  while (stack.length) {
    const i = stack.pop();
    if (region.has(i) || state.grid[i] !== from) continue;
    region.add(i);
    for (const j of around(i, state.w, state.w, false)) stack.push(j);
  }
  const gain = Array(state.colors).fill(0);
  for (const i of region) {
    for (const j of around(i, state.w, state.w, false)) {
      if (!region.has(j) && state.grid[j] !== from) gain[state.grid[j]] += 1;
    }
  }
  let best = (from + 1) % state.colors;
  let most = -1;
  for (let color = 0; color < state.colors; color++) {
    if (color === from) continue;
    if (gain[color] > most) { most = gain[color]; best = color; }
  }
  return best;
}
