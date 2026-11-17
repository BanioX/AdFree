import { makeRng } from '../shared/rng.js';

function latin(n, seed) {
  const rng = makeRng(seed);
  const grid = Array(n * n).fill(0);
  let steps = 0;
  function place(pos) {
    if (steps++ > 200000) return false;
    if (pos === n * n) return true;
    const r = Math.floor(pos / n);
    const c = pos % n;
    const nums = rng.shuffle(Array.from({ length: n }, (_, i) => i + 1));
    for (const v of nums) {
      let row = false;
      let col = false;
      for (let k = 0; k < c; k++) if (grid[r * n + k] === v) row = true;
      for (let k = 0; k < r; k++) if (grid[k * n + c] === v) col = true;
      if (row || col) continue;
      grid[pos] = v;
      if (place(pos + 1)) return true;
      grid[pos] = 0;
    }
    return false;
  }
  if (!place(0)) return null;
  return grid.slice();
}

export function newPuzzle(diff, seed = 1) {
  const n = diff === 'leicht' ? 4 : 5;
  let solution = null;
  for (let k = 0; k < 6 && !solution; k++) solution = latin(n, (seed + k * 13) >>> 0);
  const rng = makeRng(seed ^ 11);
  const pairs = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (c + 1 < n) pairs.push([i, i + 1]);
      if (r + 1 < n) pairs.push([i, i + n]);
    }
  }
  rng.shuffle(pairs);
  const want = diff === 'schwer' ? n : n + 2;
  const clues = pairs.slice(0, want).map(([a, b]) => ({ a, b, lt: solution[a] < solution[b] }));
  const fixed = Array(n * n).fill(null);
  const order = rng.shuffle(Array.from({ length: n * n }, (_, i) => i));
  const givens = diff === 'leicht' ? 3 : 2;
  for (let k = 0; k < givens; k++) fixed[order[k]] = solution[order[k]];
  return { n, solution, clues, fixed, grid: fixed.slice() };
}

export function put(state, i, v) {
  if (state.fixed[i] != null) return state;
  const grid = state.grid.slice();
  grid[i] = state.grid[i] === v ? null : v;
  return { ...state, grid };
}

export function solved(state) {
  const { n, grid, clues } = state;
  if (grid.some((v) => v == null)) return false;
  for (let r = 0; r < n; r++) {
    const seen = new Set();
    for (let c = 0; c < n; c++) seen.add(grid[r * n + c]);
    if (seen.size !== n) return false;
  }
  for (let c = 0; c < n; c++) {
    const seen = new Set();
    for (let r = 0; r < n; r++) seen.add(grid[r * n + c]);
    if (seen.size !== n) return false;
  }
  return clues.every((clue) => (clue.lt ? grid[clue.a] < grid[clue.b] : grid[clue.a] > grid[clue.b]));
}

export function hintCell(state) {
  return state.grid.findIndex((v, i) => v !== state.solution[i]);
}
