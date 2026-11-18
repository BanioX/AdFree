// Zelte und Bäume: neben jedem Baum genau ein Zelt, Zelte berühren sich nicht.

import { makeRng } from '../shared/rng.js';
import { around } from '../lib/puzzle/grid.js';

const neigh4 = (w, h, i) => around(i, w, h, false);
const neigh8 = (w, h, i) => around(i, w, h, true);
class SearchCap extends Error {
  constructor() { super('cap'); this.name = 'SearchCap'; }
}
function guard(nodes, cap) { if (nodes > cap) throw new SearchCap(); }

const SPEC = {
  leicht: { n: 6, tents: 5 },
  mittel: { n: 7, tents: 7 },
  schwer: { n: 8, tents: 9 },
};

export function generate(diff, seed) {
  const spec = SPEC[diff] || SPEC.mittel;
  const rng = makeRng(`zelte-${diff}-${seed}`);
  for (let t = 0; t < 80; t++) {
    const built = build(spec.n, spec.tents, rng);
    if (!built) continue;
    try {
      if (count(spec.n, built.trees, built.row, built.col) !== 1) continue;
    } catch (e) {
      if (e instanceof SearchCap) continue;
      throw e;
    }
    return {
      n: spec.n, w: spec.n + 1, h: spec.n + 1, diff, seed: String(seed),
      trees: built.trees, row: built.row, col: built.col, key: built.tents,
      mark: Array(spec.n * spec.n).fill(0),
      won: false, hints: 0,
    };
  }
  throw new Error('Keine Zelte');
}

function build(n, want, rng) {
  const cells = [...Array(n * n).keys()];
  rng.shuffle(cells);
  const tents = [];
  const blocked = new Set();
  for (const i of cells) {
    if (tents.length >= want) break;
    if (blocked.has(i)) continue;
    tents.push(i);
    blocked.add(i);
    for (const j of neigh8(n, n, i)) blocked.add(j);
  }
  if (tents.length < want) return null;
  const trees = matchTrees(n, tents, rng);
  if (!trees) return null;
  const row = Array(n).fill(0);
  const col = Array(n).fill(0);
  for (const i of tents) {
    row[(i / n) | 0] += 1;
    col[i % n] += 1;
  }
  return { tents, trees, row, col };
}

function matchTrees(n, tents, rng) {
  const tentSet = new Set(tents);
  const order = tents.slice();
  rng.shuffle(order);
  const used = new Set();
  const trees = [];
  function bt(k) {
    if (k === order.length) return true;
    const opts = neigh4(n, n, order[k]).filter((j) => !tentSet.has(j) && !used.has(j));
    rng.shuffle(opts);
    for (const j of opts) {
      used.add(j);
      trees.push(j);
      if (bt(k + 1)) return true;
      trees.pop();
      used.delete(j);
    }
    return false;
  }
  return bt(0) ? trees : null;
}

function count(n, trees, rowClue, colClue) {
  const treeSet = new Set(trees);
  const order = trees.slice().sort((a, b) => neigh4(n, n, a).length - neigh4(n, n, b).length);
  let sols = 0;
  let nodes = 0;
  const used = new Set();
  const row = Array(n).fill(0);
  const col = Array(n).fill(0);
  function bt(k) {
    if (sols > 1) return;
    guard(++nodes, 80000);
    if (k === order.length) { sols += 1; return; }
    for (const j of neigh4(n, n, order[k])) {
      if (treeSet.has(j) || used.has(j)) continue;
      const r = (j / n) | 0;
      const c = j % n;
      if (row[r] + 1 > rowClue[r] || col[c] + 1 > colClue[c]) continue;
      let touch = false;
      for (const u of neigh8(n, n, j)) if (used.has(u)) { touch = true; break; }
      if (touch) continue;
      used.add(j);
      row[r] += 1;
      col[c] += 1;
      bt(k + 1);
      used.delete(j);
      row[r] -= 1;
      col[c] -= 1;
      if (sols > 1) return;
    }
  }
  bt(0);
  return sols;
}

function inner(state, i) {
  const W = state.w;
  const R = (i / W) | 0;
  const C = i % W;
  if (R >= state.n || C >= state.n) return -1;
  return R * state.n + C;
}

export function solved(state) {
  const key = new Set(state.key);
  for (let i = 0; i < state.mark.length; i++) {
    if ((state.mark[i] === 1) !== key.has(i)) return false;
  }
  return true;
}

export function act(state, i) {
  const k = inner(state, i);
  if (k < 0) return { ok: false, silent: true };
  if (state.trees.includes(k)) return { ok: false, silent: true };
  state.mark[k] = (state.mark[k] + 1) % 3;
  return { ok: true, sound: state.mark[k] === 1 ? 'pop' : 'click', win: solved(state) };
}

export function hint(state) {
  const key = new Set(state.key);
  for (let i = 0; i < state.mark.length; i++) {
    const want = key.has(i) ? 1 : 0;
    if (state.trees.includes(i)) continue;
    if (state.mark[i] === 1 && !key.has(i)) {
      state.mark[i] = 2;
      return { ok: true, toast: 'hint', win: solved(state) };
    }
    if (state.mark[i] !== 1 && want === 1) {
      state.mark[i] = 1;
      return { ok: true, toast: 'hint', win: solved(state) };
    }
  }
  return { ok: false, toast: 'none' };
}

export function wrongs(state) {
  const key = new Set(state.key);
  const out = [];
  for (let i = 0; i < state.mark.length; i++) {
    if (state.mark[i] === 1 && !key.has(i)) {
      const r = (i / state.n) | 0;
      const c = i % state.n;
      out.push(r * state.w + c);
    }
  }
  return out;
}

export function paint(state, i) {
  const W = state.w;
  const R = (i / W) | 0;
  const C = i % W;
  if (R === state.n && C === state.n) return { cls: 'clue', text: '', aria: '' };
  if (R === state.n) return { cls: 'clue', text: String(state.col[C]), aria: String(state.col[C]) };
  if (C === state.n) return { cls: 'clue', text: String(state.row[R]), aria: String(state.row[R]) };
  const k = R * state.n + C;
  if (state.trees.includes(k)) return { cls: 'tree', text: '🌳', aria: 'tree' };
  if (state.mark[k] === 1) return { cls: 'tent', text: '⛺', aria: 'tent' };
  if (state.mark[k] === 2) return { cls: 'grass', text: '', aria: '' };
  return { cls: 'field', text: '', aria: '' };
}

export function coach(state) {
  const k = state.key[0];
  const r = (k / state.n) | 0;
  const c = k % state.n;
  return r * state.w + c;
}
