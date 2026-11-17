import { makeRng } from '../shared/rng.js';
import { around } from '../lib/puzzle/grid.js';

export function spec(diff) {
  if (diff === 'leicht') return { w: 6, h: 6, mines: 5 };
  if (diff === 'schwer') return { w: 9, h: 9, mines: 12 };
  return { w: 8, h: 8, mines: 10 };
}

export function newField(diff, seed = 1) {
  const { w, h, mines } = spec(diff);
  const n = w * h;
  return {
    w, h, mines, seed,
    mine: null,
    open: Array(n).fill(false),
    flag: Array(n).fill(false),
    boom: false,
  };
}

function forbidden(state, safe) {
  const ban = new Set([safe]);
  if (state.w <= 8) for (const j of around(safe, state.w, state.h, true)) ban.add(j);
  return ban;
}

export function ensureMines(state, safe) {
  if (state.mine) return state;
  const n = state.w * state.h;
  const ban = forbidden(state, safe);
  const pool = [];
  for (let i = 0; i < n; i++) if (!ban.has(i)) pool.push(i);
  const rng = makeRng((state.seed ^ (safe + 17)) >>> 0);
  rng.shuffle(pool);
  const mine = Array(n).fill(false);
  const count = Math.min(state.mines, pool.length);
  for (let k = 0; k < count; k++) mine[pool[k]] = true;
  return { ...state, mine, mines: count };
}

export function nearby(state, i) {
  let n = 0;
  for (const j of around(i, state.w, state.h, true)) if (state.mine[j]) n++;
  return n;
}

export function reveal(state, i) {
  if (state.boom || state.open[i] || state.flag[i]) return state;
  const next = ensureMines(state, i);
  const open = next.open.slice();
  if (next.mine[i]) {
    open[i] = true;
    return { ...next, open, boom: true };
  }
  const stack = [i];
  while (stack.length) {
    const cur = stack.pop();
    if (open[cur] || next.flag[cur]) continue;
    open[cur] = true;
    if (nearby(next, cur) === 0) {
      for (const j of around(cur, next.w, next.h, true)) if (!open[j] && !next.mine[j]) stack.push(j);
    }
  }
  return { ...next, open };
}

export function toggleFlag(state, i) {
  if (state.boom || state.open[i]) return state;
  const flag = state.flag.slice();
  flag[i] = !flag[i];
  return { ...state, flag };
}

export function won(state) {
  if (!state.mine || state.boom) return false;
  return state.mine.every((isMine, i) => isMine || state.open[i]);
}

export function hintCell(state) {
  if (!state.mine) return 0;
  for (let i = 0; i < state.mine.length; i++) {
    if (!state.mine[i] && !state.open[i] && !state.flag[i]) return i;
  }
  return -1;
}
