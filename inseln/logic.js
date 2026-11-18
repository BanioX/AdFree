// Inseln (Nurikabe): Zahlen sind Inseln dieser Grösse, das Wasser ist zusammenhängend, kein 2×2-Teich.

import { makeRng } from '../shared/rng.js';
import { around } from '../lib/puzzle/grid.js';

const neigh4 = (w, h, i) => around(i, w, h, false);
class SearchCap extends Error {
  constructor() { super('cap'); this.name = 'SearchCap'; }
}
function guard(nodes, cap) { if (nodes > cap) throw new SearchCap(); }

const BASE = { n: 5, islands: 3, land: 10, max: 5, tries: 50, clues: 18 };
const SPEC = {
  leicht: BASE,
  mittel: { n: 5, islands: 3, land: 11, max: 5, tries: 16, clues: 10 },
  schwer: { n: 6, islands: 3, land: 14, max: 5, tries: 10, clues: 6 },
};

export function generate(diff, seed) {
  const spec = SPEC[diff] || SPEC.mittel;
  const ladder = [spec];
  if (spec !== BASE) ladder.push(BASE);
  for (const use of ladder) {
  const rng = makeRng(`inseln-${diff}-${use.n}-${seed}`);
  for (let t = 0; t < use.tries; t++) {
    const built = build(use.n, use.islands, use.land, use.max, rng);
    if (!built) continue;
    for (const placed of placements(built, rng, use.clues)) {
      const cap = { nodes: 0, cap: 25000, stop: false };
      let found;
      try {
        found = countIslands(use.n, placed.seeds, placed.sizes, cap);
      } catch (e) {
        if (e instanceof SearchCap) continue;
        throw e;
      }
      if (found.sols !== 1 || !sameLand(built.owner, found.only)) continue;
      return {
        n: use.n, w: use.n, h: use.n, diff, seed: String(seed),
        num: placed.num, key: built.owner,
        mark: placed.num.map((v) => (v ? 1 : 0)),
        won: false, hints: 0,
      };
    }
  }
  }
  throw new Error('Keine Inseln');
}

function build(n, k, land, maxSize, rng) {
  const total = n * n;
  const sea = growSea(n, total - land, rng);
  if (!sea) return null;
  const raw = landParts(n, sea);
  const groups = new Map();
  raw.forEach((id, cell) => {
    if (!id) return;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(cell);
  });
  if (groups.size < Math.max(2, k - 1) || groups.size > k + 1) return null;
  const seeds = [];
  const sizes = [];
  const owner = Array(total).fill(0);
  let id = 0;
  for (const cells of groups.values()) {
    if (cells.length > maxSize) return null;
    id += 1;
    sizes.push(cells.length);
    seeds.push(cells[rng.int(0, cells.length - 1)]);
    for (const cell of cells) owner[cell] = id;
  }
  if (!sizes.some((s) => s >= 3)) return null;
  if (!seaOk(owner, n)) return null;
  const num = Array(total).fill(0);
  seeds.forEach((cell, i) => { num[cell] = sizes[i]; });
  return { owner, seeds, sizes, num };
}

function placements(built, rng, limit) {
  const groups = [];
  const by = new Map();
  built.owner.forEach((id, cell) => {
    if (!id) return;
    if (!by.has(id)) by.set(id, groups.length), groups.push([]);
    groups[by.get(id)].push(cell);
  });
  for (const cells of groups) rng.shuffle(cells);
  const out = [];
  const num = Array(built.owner.length).fill(0);
  const seeds = [];
  const sizes = [];
  function rec(i) {
    if (out.length >= limit) return;
    if (i === groups.length) {
      out.push({ seeds: seeds.slice(), sizes: sizes.slice(), num: num.slice() });
      return;
    }
    for (const seed of groups[i]) {
      num[seed] = groups[i].length;
      seeds.push(seed);
      sizes.push(groups[i].length);
      rec(i + 1);
      seeds.pop();
      sizes.pop();
      num[seed] = 0;
      if (out.length >= limit) return;
    }
  }
  rec(0);
  return out;
}

function sameLand(owner, cells) {
  if (!cells || cells.length !== owner.filter(Boolean).length) return false;
  const got = new Set(cells);
  for (let i = 0; i < owner.length; i++) {
    if (Boolean(owner[i]) !== got.has(i)) return false;
  }
  return true;
}

function completesPool(sea, n, cell) {
  const r = (cell / n) | 0;
  const c = cell % n;
  for (const dr of [0, -1]) {
    for (const dc of [0, -1]) {
      const r0 = r + dr;
      const c0 = c + dc;
      if (r0 < 0 || c0 < 0 || r0 + 1 >= n || c0 + 1 >= n) continue;
      const block = [r0 * n + c0, r0 * n + c0 + 1, (r0 + 1) * n + c0, (r0 + 1) * n + c0 + 1];
      if (block.every((i) => i === cell || sea.has(i))) return true;
    }
  }
  return false;
}

function growSea(n, target, rng) {
  const total = n * n;
  if (target < 1 || target >= total) return null;
  const sea = new Set([rng.int(0, total - 1)]);
  let spins = 0;
  while (sea.size < target && spins < total * 6) {
    spins += 1;
    const opts = [];
    for (const cell of sea) {
      for (const nb of neigh4(n, n, cell)) {
        if (sea.has(nb) || opts.includes(nb) || completesPool(sea, n, nb)) continue;
        opts.push(nb);
      }
    }
    if (!opts.length) return null;
    sea.add(opts[rng.int(0, opts.length - 1)]);
  }
  return sea.size === target ? sea : null;
}

function landParts(n, sea) {
  const owner = Array(n * n).fill(0);
  let id = 0;
  for (let i = 0; i < n * n; i++) {
    if (sea.has(i) || owner[i]) continue;
    id += 1;
    const q = [i];
    owner[i] = id;
    while (q.length) {
      const cell = q.pop();
      for (const nb of neigh4(n, n, cell)) {
        if (sea.has(nb) || owner[nb]) continue;
        owner[nb] = id;
        q.push(nb);
      }
    }
  }
  return owner;
}

function seaOk(owner, n) {
  const sea = [];
  for (let i = 0; i < n * n; i++) if (!owner[i]) sea.push(i);
  if (!sea.length) return false;
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const cells = [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
      if (cells.every((i) => !owner[i])) return false;
    }
  }
  const seen = new Set([sea[0]]);
  const q = [sea[0]];
  while (q.length) {
    const i = q.pop();
    for (const nb of neigh4(n, n, i)) {
      if (!owner[nb] && !seen.has(nb)) { seen.add(nb); q.push(nb); }
    }
  }
  return seen.size === sea.length;
}

function countIslands(n, seeds, sizes, cap) {
  let sols = 0;
  let only = null;
  const occupied = new Set(seeds);
  const order = seeds.map((s, i) => i).sort((a, b) => sizes[b] - sizes[a]);
  function place(k) {
    if (cap.stop || sols > 1) return;
    guard(++cap.nodes, cap.cap);
    if (k === order.length) {
      if (seaFrom(occupied, n)) {
        sols += 1;
        if (sols === 1) only = [...occupied];
        if (sols > 1) cap.stop = true;
      }
      return;
    }
    const id = order[k];
    const blocked = new Set(occupied);
    for (const cell of occupied) {
      if (seeds.includes(cell)) continue;
      for (const nb of neigh4(n, n, cell)) blocked.add(nb);
    }
    // Samen der anderen Inseln sind blockiert, der eigene nicht.
    for (let s = 0; s < seeds.length; s++) if (s !== id) blocked.add(seeds[s]);
    blocked.delete(seeds[id]);
    enumShapes(n, seeds[id], sizes[id], blocked, cap, (cells) => {
      if (sols > 1) return;
      const added = [];
      let bad = false;
      for (const c of cells) {
        if (c === seeds[id]) continue;
        if (occupied.has(c)) { bad = true; break; }
        for (const nb of neigh4(n, n, c)) {
          if (seeds.includes(nb) && nb !== seeds[id]) { bad = true; break; }
        }
        if (bad) break;
      }
      if (bad) return;
      for (const c of cells) if (!occupied.has(c)) { occupied.add(c); added.push(c); }
      place(k + 1);
      for (const c of added) occupied.delete(c);
    });
  }
  place(0);
  return { sols, only };
}

function seaFrom(occupied, n) {
  const owner = Array(n * n).fill(0);
  for (const i of occupied) owner[i] = 1;
  return seaOk(owner, n);
}

/** Jede zusammenhängende Form mit dem Samen genau einmal. */
export function enumShapes(n, seed, size, blocked, cap, visit) {
  const cur = [seed];
  const used = new Set([seed]);
  const banned = new Set();
  function rec() {
    if (cap.stop) return;
    guard(++cap.nodes, cap.cap);
    if (cur.length === size) { visit(cur.slice()); return; }
    const options = [];
    const seen = new Set();
    for (const cell of cur) {
      for (const nb of neigh4(n, n, cell)) {
        if (used.has(nb) || banned.has(nb) || blocked.has(nb) || seen.has(nb)) continue;
        seen.add(nb);
        options.push(nb);
      }
    }
    options.sort((a, b) => a - b);
    for (let i = 0; i < options.length; i++) {
      const cell = options[i];
      const banNow = options.slice(0, i);
      used.add(cell);
      cur.push(cell);
      for (const b of banNow) banned.add(b);
      rec();
      for (const b of banNow) banned.delete(b);
      cur.pop();
      used.delete(cell);
      if (cap.stop) return;
    }
  }
  rec();
}

export function solved(state) {
  for (let i = 0; i < state.key.length; i++) {
    const sea = state.key[i] === 0;
    if (sea && state.mark[i] !== 2) return false;
    if (!sea && state.mark[i] !== 1) return false;
  }
  return true;
}

export function act(state, i) {
  if (state.num[i]) return { ok: false, silent: true };
  state.mark[i] = state.mark[i] === 0 ? 2 : state.mark[i] === 2 ? 1 : 0;
  return { ok: true, sound: 'place', win: solved(state) };
}

export function hint(state) {
  for (let i = 0; i < state.key.length; i++) {
    if (state.num[i]) continue;
    const want = state.key[i] === 0 ? 2 : 1;
    if (state.mark[i] !== want) {
      state.mark[i] = want;
      return { ok: true, toast: 'hint', win: solved(state) };
    }
  }
  return { ok: false, toast: 'none' };
}

export function wrongs(state) {
  const out = [];
  for (let i = 0; i < state.key.length; i++) {
    if (!state.mark[i] || state.num[i]) continue;
    const want = state.key[i] === 0 ? 2 : 1;
    if (state.mark[i] !== want) out.push(i);
  }
  return out;
}

export function paint(state, i) {
  if (state.num[i]) return { cls: 'seed', text: String(state.num[i]), aria: String(state.num[i]) };
  if (state.mark[i] === 2) return { cls: 'sea', text: '', aria: 'sea' };
  if (state.mark[i] === 1) return { cls: 'land', text: '', aria: 'land' };
  return { cls: 'unk', text: '', aria: '' };
}

export function coach(state) {
  return state.num.findIndex((v) => !v);
}
