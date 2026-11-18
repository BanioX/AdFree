// Hochhäuser: lateinisches Quadrat, Randzahlen sagen, wie viele Häuser man sieht.

import { makeRng } from '../shared/rng.js';
import { countLatin, randomLatin, sees, provenUnique, thinOut } from './latin.js';

const SPEC = {
  leicht: { n: 4, drop: 4 },
  mittel: { n: 5, drop: 8 },
  schwer: { n: 5, drop: 12 },
};

export function generate(diff, seed) {
  const spec = SPEC[diff] || SPEC.mittel;
  const rng = makeRng(`hochhaus-${diff}-${seed}`);
  const n = spec.n;
  for (let t = 0; t < 40; t++) {
    const key = randomLatin(n, rng);
    if (!key) continue;
    const L = [];
    const R = [];
    const T = [];
    const B = [];
    for (let i = 0; i < n; i++) {
      L.push(sees(key[i]));
      R.push(sees([...key[i]].reverse()));
      const col = key.map((row) => row[i]);
      T.push(sees(col));
      B.push(sees([...col].reverse()));
    }
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push(['L', i], ['R', i], ['T', i], ['B', i]);
    }
    const bag = { L: L.slice(), R: R.slice(), T: T.slice(), B: B.slice() };
    const full = { L: L.slice(), R: R.slice(), T: T.slice(), B: B.slice() };
    if (!provenUnique(() => solutions(n, bag))) continue;
    thinOut(items, rng, spec.drop,
      ([side, i]) => { bag[side][i] = 0; },
      ([side, i]) => { bag[side][i] = full[side][i]; },
      () => provenUnique(() => solutions(n, bag)));
    if (!provenUnique(() => solutions(n, bag))) continue;
    return {
      n, w: n + 2, h: n + 2, diff, seed: String(seed),
      L: bag.L, R: bag.R, T: bag.T, B: bag.B,
      grid: Array.from({ length: n }, () => Array(n).fill(0)),
      key, won: false, hints: 0,
    };
  }
  throw new Error('Keine Hochhäuser');
}

function solutions(n, bag) {
  const given = Array.from({ length: n }, () => Array(n).fill(0));
  return countLatin(n, given, {
    cell(grid, r, c) {
      return leftPartial(grid[r], bag.L[r], n) && topPartial(grid, c, bag.T[c], n);
    },
    row(grid, r) {
      if (bag.L[r] && sees(grid[r]) !== bag.L[r]) return false;
      if (bag.R[r] && sees([...grid[r]].reverse()) !== bag.R[r]) return false;
      return true;
    },
    done(grid) {
      for (let c = 0; c < n; c++) {
        const col = grid.map((row) => row[c]);
        if (bag.T[c] && sees(col) !== bag.T[c]) return false;
        if (bag.B[c] && sees([...col].reverse()) !== bag.B[c]) return false;
      }
      return true;
    },
  }, 2, 60000);
}

function leftPartial(row, clue, n) {
  if (!clue) return true;
  let max = 0;
  let k = 0;
  let filled = 0;
  for (const v of row) {
    if (!v) break;
    filled += 1;
    if (v > max) { max = v; k += 1; }
  }
  if (k > clue) return false;
  if (filled === n) return k === clue;
  if (k + (n - filled) < clue) return false;
  return true;
}

function topPartial(grid, c, clue, n) {
  if (!clue) return true;
  let max = 0;
  let k = 0;
  let filled = 0;
  for (let r = 0; r < n; r++) {
    const v = grid[r][c];
    if (!v) break;
    filled += 1;
    if (v > max) { max = v; k += 1; }
  }
  if (k > clue) return false;
  if (filled === n) return k === clue;
  if (k + (n - filled) < clue) return false;
  return true;
}

function pos(state, i) {
  const W = state.w;
  const R = (i / W) | 0;
  const C = i % W;
  if (R === 0 || C === 0 || R > state.n || C > state.n) return null;
  return [R - 1, C - 1];
}

export function solved(state) {
  const n = state.n;
  for (let r = 0; r < n; r++) {
    const seen = new Set();
    for (let c = 0; c < n; c++) {
      const v = state.grid[r][c];
      if (!v || seen.has(v)) return false;
      seen.add(v);
    }
    if (state.L[r] && sees(state.grid[r]) !== state.L[r]) return false;
    if (state.R[r] && sees([...state.grid[r]].reverse()) !== state.R[r]) return false;
  }
  for (let c = 0; c < n; c++) {
    const col = state.grid.map((row) => row[c]);
    if (new Set(col).size !== n) return false;
    if (state.T[c] && sees(col) !== state.T[c]) return false;
    if (state.B[c] && sees([...col].reverse()) !== state.B[c]) return false;
  }
  return true;
}

export function act(state, i, mode) {
  const p = pos(state, i);
  if (!p) return { ok: false, silent: true };
  const [r, c] = p;
  const d = mode && mode.digit ? mode.digit : 0;
  if (state.grid[r][c] === d) return { ok: false, silent: true };
  state.grid[r][c] = d;
  return { ok: true, sound: 'place', win: solved(state) };
}

export function hint(state) {
  const n = state.n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state.grid[r][c] !== state.key[r][c]) {
        state.grid[r][c] = state.key[r][c];
        return { ok: true, toast: 'hint', win: solved(state) };
      }
    }
  }
  return { ok: false, toast: 'none' };
}

export function wrongs(state) {
  const out = [];
  const n = state.n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = state.grid[r][c];
      if (v && v !== state.key[r][c]) out.push((r + 1) * state.w + (c + 1));
    }
  }
  return out;
}

export function paint(state, i) {
  const W = state.w;
  const R = (i / W) | 0;
  const C = i % W;
  const n = state.n;
  const clue = (v) => ({ cls: 'clue', text: v ? String(v) : '', aria: v ? String(v) : '' });
  if (R === 0 && C > 0 && C <= n) return clue(state.T[C - 1]);
  if (R === n + 1 && C > 0 && C <= n) return clue(state.B[C - 1]);
  if (C === 0 && R > 0 && R <= n) return clue(state.L[R - 1]);
  if (C === n + 1 && R > 0 && R <= n) return clue(state.R[R - 1]);
  if (R === 0 || C === 0 || R > n || C > n) return { cls: 'corner', text: '', aria: '' };
  const v = state.grid[R - 1][C - 1];
  return { cls: 'house', text: v ? String(v) : '', aria: v ? String(v) : '' };
}

export function coach(state) {
  return state.w + 1;
}
