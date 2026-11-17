import { makeRng } from '../shared/rng.js';

function sizeOf(diff) {
  return diff === 'schwer' ? 8 : 6;
}

function fill(w, seed) {
  const rng = makeRng(seed);
  const grid = Array(w * w).fill(-1);
  let steps = 0;
  const rowKey = (r) => grid.slice(r * w, r * w + w).join('');
  function place(pos) {
    if (steps++ > 250000) return false;
    if (pos === w * w) return columnsOk();
    const r = Math.floor(pos / w);
    const c = pos % w;
    const order = rng.chance(0.5) ? [0, 1] : [1, 0];
    for (const v of order) {
      if (!fits(r, c, v)) continue;
      grid[pos] = v;
      if (c === w - 1) {
        const key = rowKey(r);
        let dup = false;
        for (let pr = 0; pr < r; pr++) if (rowKey(pr) === key) dup = true;
        if (dup) { grid[pos] = -1; continue; }
      }
      if (place(pos + 1)) return true;
      grid[pos] = -1;
    }
    return false;
  }
  function fits(r, c, v) {
    if (c >= 2 && grid[r * w + c - 1] === v && grid[r * w + c - 2] === v) return false;
    if (r >= 2 && grid[(r - 1) * w + c] === v && grid[(r - 2) * w + c] === v) return false;
    let row = 0;
    let col = 0;
    for (let k = 0; k < c; k++) if (grid[r * w + k] === v) row++;
    for (let k = 0; k < r; k++) if (grid[k * w + c] === v) col++;
    return row < w / 2 && col < w / 2;
  }
  function columnsOk() {
    const seen = new Set();
    for (let c = 0; c < w; c++) {
      let s = '';
      for (let r = 0; r < w; r++) s += grid[r * w + c];
      if (seen.has(s)) return false;
      seen.add(s);
    }
    return true;
  }
  if (!place(0)) return null;
  return grid.slice();
}

export function rulesOk(grid, w) {
  if (grid.some((v) => v !== 0 && v !== 1)) return false;
  const rows = new Set();
  const cols = new Set();
  for (let r = 0; r < w; r++) {
    let s = '';
    let zeros = 0;
    for (let c = 0; c < w; c++) {
      const v = grid[r * w + c];
      s += v;
      if (v === 0) zeros++;
      if (c >= 2 && v === grid[r * w + c - 1] && v === grid[r * w + c - 2]) return false;
    }
    if (zeros !== w / 2 || rows.has(s)) return false;
    rows.add(s);
  }
  for (let c = 0; c < w; c++) {
    let s = '';
    for (let r = 0; r < w; r++) {
      const v = grid[r * w + c];
      s += v;
      if (r >= 2 && v === grid[(r - 1) * w + c] && v === grid[(r - 2) * w + c]) return false;
    }
    if (cols.has(s)) return false;
    cols.add(s);
  }
  return true;
}

export function newPuzzle(diff, seed = 1) {
  const w = sizeOf(diff);
  let solution = null;
  for (let k = 0; k < 8 && !solution; k++) solution = fill(w, (seed + k * 97) >>> 0);
  if (!solution) solution = fill(6, 1);
  const width = Math.sqrt(solution.length) | 0;
  const keep = diff === 'leicht' ? 0.5 : diff === 'schwer' ? 0.28 : 0.38;
  const rng = makeRng(seed ^ 9);
  const fixed = solution.map((v) => (rng.next() < keep ? v : null));
  if (!fixed.some((v) => v != null)) fixed[0] = solution[0];
  return { w: width, solution, fixed, grid: fixed.slice() };
}

export function setCell(state, i) {
  if (state.fixed[i] != null) return state;
  const cur = state.grid[i];
  const next = cur == null ? 0 : cur === 0 ? 1 : null;
  const grid = state.grid.slice();
  grid[i] = next;
  return { ...state, grid };
}

export function solved(state) {
  return rulesOk(state.grid.map((v) => (v == null ? -1 : v)), state.w);
}

export function hintCell(state) {
  return state.grid.findIndex((v, i) => v !== state.solution[i]);
}
