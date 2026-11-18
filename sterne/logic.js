// Sternenhimmel: ein Stern pro Zeile, Spalte und Gebiet, keine zwei berühren sich.

import { makeRng } from '../shared/rng.js';
import { around } from '../lib/puzzle/grid.js';

const neigh4 = (w, h, i) => around(i, w, h, false);

const SPEC = { leicht: 5, mittel: 6, schwer: 8 };

export function generate(diff, seed) {
  const rng = makeRng(`sterne-${diff}-${seed}`);
  const sizes = [SPEC[diff] || 6];
  if (sizes[0] > 6) sizes.push(sizes[0] - 1, sizes[0] - 2);
  else if (sizes[0] > 5) sizes.push(sizes[0] - 1);
  for (const n of sizes) {
    const built = build(n, rng);
    if (!built) continue;
    return {
      n, w: n, h: n, diff, seed: String(seed),
      region: built.region, cols: built.cols,
      mark: Array(n * n).fill(0),
      won: false, hints: 0,
    };
  }
  throw new Error('Kein Sternenhimmel');
}

function build(n, rng) {
  for (let t = 0; t < 80; t++) {
    const cols = placeStars(n, rng);
    if (!cols) continue;
    const region = grow(n, cols, rng);
    if (!region) continue;
    const tight = tighten(n, cols, region, rng);
    if (tight) return { cols, region: tight };
  }
  return null;
}

function connected(owner, n, cols) {
  for (let s = 0; s < n; s++) {
    const start = s * n + cols[s];
    if (owner[start] !== s) return false;
    let need = 0;
    for (let i = 0; i < n * n; i++) if (owner[i] === s) need += 1;
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
      const i = q.pop();
      for (const j of neigh4(n, n, i)) {
        if (owner[j] === s && !seen.has(j)) { seen.add(j); q.push(j); }
      }
    }
    if (seen.size !== need) return false;
  }
  return true;
}

function tighten(n, cols, region, rng) {
  const cur = region.slice();
  if (count(cur, n) === 1) return cur;
  for (let step = 0; step < 70; step++) {
    const borders = [];
    for (let i = 0; i < n * n; i++) {
      const r = (i / n) | 0;
      const c = i % n;
      if (cols[r] === c) continue;
      const others = [...new Set(neigh4(n, n, i).map((j) => cur[j]).filter((v) => v !== cur[i]))];
      if (others.length) borders.push([i, others]);
    }
    if (!borders.length) break;
    const [i, others] = borders[rng.int(0, borders.length - 1)];
    const prev = cur[i];
    cur[i] = others[rng.int(0, others.length - 1)];
    if (!connected(cur, n, cols)) { cur[i] = prev; continue; }
    const k = count(cur, n);
    if (k === 1) return cur;
    if (k === 0 || rng.next() < 0.45) cur[i] = prev;
  }
  return count(cur, n) === 1 ? cur : null;
}

function placeStars(n, rng) {
  const col = Array(n).fill(-1);
  const used = Array(n).fill(false);
  const order = [...Array(n).keys()];
  function bt(r) {
    if (r === n) return true;
    rng.shuffle(order);
    for (const c of order) {
      if (used[c]) continue;
      if (r && Math.abs(c - col[r - 1]) <= 1) continue;
      used[c] = true;
      col[r] = c;
      if (bt(r + 1)) return true;
      used[c] = false;
    }
    return false;
  }
  return bt(0) ? col.slice() : null;
}

function grow(n, cols, rng) {
  const owner = Array(n * n).fill(-1);
  for (let r = 0; r < n; r++) owner[r * n + cols[r]] = r;
  let guard = 0;
  while (owner.includes(-1) && guard++ < n * n * 40) {
    const opts = [];
    for (let i = 0; i < owner.length; i++) {
      if (owner[i] >= 0) continue;
      const nb = [...new Set(neigh4(n, n, i).map((j) => owner[j]).filter((v) => v >= 0))];
      if (nb.length) opts.push([i, nb]);
    }
    if (!opts.length) return null;
    const [i, nb] = opts[rng.int(0, opts.length - 1)];
    owner[i] = nb[rng.int(0, nb.length - 1)];
  }
  return owner.includes(-1) ? null : owner;
}

function count(region, n) {
  let sols = 0;
  const usedC = Array(n).fill(false);
  const usedG = Array(n).fill(false);
  function bt(r, prev) {
    if (sols > 1) return;
    if (r === n) { sols += 1; return; }
    for (let c = 0; c < n; c++) {
      if (usedC[c]) continue;
      if (r && Math.abs(c - prev) <= 1) continue;
      const g = region[r * n + c];
      if (usedG[g]) continue;
      usedC[c] = true;
      usedG[g] = true;
      bt(r + 1, c);
      usedC[c] = false;
      usedG[g] = false;
      if (sols > 1) return;
    }
  }
  bt(0, -9);
  return sols;
}

function isSolutionStar(state, i) {
  const r = (i / state.n) | 0;
  return state.cols[r] === i % state.n;
}

export function solved(state) {
  const n = state.n;
  const stars = [];
  for (let i = 0; i < n * n; i++) if (state.mark[i] === 1) stars.push(i);
  if (stars.length !== n) return false;
  const row = new Set();
  const col = new Set();
  const reg = new Set();
  for (const i of stars) {
    const r = (i / n) | 0;
    const c = i % n;
    if (row.has(r) || col.has(c) || reg.has(state.region[i])) return false;
    row.add(r);
    col.add(c);
    reg.add(state.region[i]);
  }
  for (let a = 0; a < stars.length; a++) {
    for (let b = a + 1; b < stars.length; b++) {
      const r1 = (stars[a] / n) | 0;
      const c1 = stars[a] % n;
      const r2 = (stars[b] / n) | 0;
      const c2 = stars[b] % n;
      if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) return false;
    }
  }
  return true;
}

export function act(state, i) {
  state.mark[i] = (state.mark[i] + 1) % 3;
  return { ok: true, sound: state.mark[i] === 1 ? 'pop' : 'click', win: solved(state) };
}

export function hint(state) {
  for (let i = 0; i < state.mark.length; i++) {
    const want = isSolutionStar(state, i);
    if (state.mark[i] === 1 && !want) {
      state.mark[i] = 2;
      return { ok: true, toast: 'hint', win: solved(state) };
    }
  }
  for (let i = 0; i < state.mark.length; i++) {
    if (isSolutionStar(state, i) && state.mark[i] !== 1) {
      state.mark[i] = 1;
      return { ok: true, toast: 'hint', win: solved(state) };
    }
  }
  return { ok: false, toast: 'none' };
}

export function wrongs(state) {
  const out = [];
  for (let i = 0; i < state.mark.length; i++) {
    if (state.mark[i] === 1 && !isSolutionStar(state, i)) out.push(i);
  }
  return out;
}

export function paint(state, i) {
  const g = state.region[i] % 5;
  const m = state.mark[i];
  const star = m === 1 ? ' star' : m === 2 ? ' dot' : '';
  return { cls: `sky g${g}${star}`, text: m === 1 ? '★' : m === 2 ? '·' : '', aria: m === 1 ? 'star' : '' };
}

export function coach(state) {
  return state.cols[0];
}
