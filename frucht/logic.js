import { makeRng } from '../shared/rng.js';

export const COLS = 5;
export const ROWS = 6;

export function goalFor(diff) {
  return diff === 'leicht' ? 4 : diff === 'schwer' ? 6 : 5;
}

function roll(rng, diff) {
  return rng.int(1, diff === 'schwer' ? 3 : 2);
}

export function newBowl(diff, seed = 1) {
  const rng = makeRng(seed);
  return {
    cols: COLS,
    rows: ROWS,
    grid: Array(COLS * ROWS).fill(0),
    current: roll(rng, diff),
    next: roll(rng, diff),
    goal: goalFor(diff),
    score: 0,
    seed,
    rng: seed,
    diff,
  };
}

function gravity(grid) {
  for (let c = 0; c < COLS; c++) {
    const stack = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      const v = grid[r * COLS + c];
      if (v) stack.push(v);
    }
    for (let r = ROWS - 1; r >= 0; r--) grid[r * COLS + c] = stack[ROWS - 1 - r] || 0;
  }
}

function mergeOnce(grid) {
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const v = grid[i];
      if (!v || v >= 7) continue;
      const neigh = [];
      if (c + 1 < COLS) neigh.push(i + 1);
      if (r > 0) neigh.push(i - COLS);
      for (const j of neigh) {
        if (grid[j] !== v) continue;
        grid[i] = v + 1;
        grid[j] = 0;
        return v + 1;
      }
    }
  }
  return 0;
}

export function settle(grid) {
  let best = 0;
  let gained = 0;
  for (let n = 0; n < 20; n++) {
    gravity(grid);
    const made = mergeOnce(grid);
    if (!made) break;
    best = Math.max(best, made);
    gained += made * 10;
  }
  gravity(grid);
  return { best, gained };
}

export function highest(grid) {
  return grid.reduce((m, v) => Math.max(m, v), 0);
}

export function drop(state, col) {
  if (col < 0 || col >= COLS) return state;
  let dest = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!state.grid[r * COLS + col]) { dest = r; break; }
  }
  if (dest < 0) return state;
  const grid = state.grid.slice();
  grid[dest * COLS + col] = state.current;
  const { gained } = settle(grid);
  const rng = makeRng((state.rng + 1 + col * 17) >>> 0);
  return {
    ...state,
    grid,
    current: state.next,
    next: roll(rng, state.diff),
    score: state.score + gained + 1,
    rng: (state.rng + 1 + col) >>> 0,
  };
}

export function full(state) {
  for (let c = 0; c < COLS; c++) if (!state.grid[c]) return false;
  return true;
}

export function won(state) {
  return highest(state.grid) >= state.goal;
}
