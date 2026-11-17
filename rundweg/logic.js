// Rundweg (Slitherlink): eine einzige Schlaufe, die Zahlen zählen die Kanten rund ums Feld.

import { makeRng } from '../shared/rng.js';

class SearchCap extends Error {
  constructor() { super('cap'); this.name = 'SearchCap'; }
}
function guard(nodes, cap) { if (nodes > cap) throw new SearchCap(); }
function provenUnique(fn) {
  try { return fn() === 1; } catch (e) {
    if (e instanceof SearchCap) return false;
    throw e;
  }
}
function thinOut(items, rng, maxRemove, drop, restore, unique) {
  const order = items.slice();
  rng.shuffle(order);
  let removed = 0;
  for (const item of order) {
    if (removed >= maxRemove) break;
    drop(item);
    if (unique()) removed += 1;
    else restore(item);
  }
  return removed;
}

const SPEC = {
  leicht: { n: 5, drop: 6 },
  mittel: { n: 5, drop: 12 },
  schwer: { n: 6, drop: 10 },
};

export function generate(diff, seed) {
  const spec = SPEC[diff] || SPEC.mittel;
  const rng = makeRng(`rundweg-${diff}-${seed}`);
  for (let t = 0; t < 20; t++) {
    const loop = makeLoop(spec.n, rng);
    const full = cluesOf(spec.n, loop);
    const clue = full.slice();
    const items = clue.map((_, i) => i);
    if (!provenUnique(() => countLoops(spec.n, clue))) continue;
    thinOut(items, rng, spec.drop,
      (i) => { clue[i] = -1; },
      (i) => { clue[i] = full[i]; },
      () => provenUnique(() => countLoops(spec.n, clue)));
    if (!provenUnique(() => countLoops(spec.n, clue))) continue;
    const N = spec.n;
    return {
      n: N, w: N * 2 + 1, h: N * 2 + 1, diff, seed: String(seed),
      clue, on: Array(edgeCount(N)).fill(0), key: loop,
      won: false, hints: 0,
    };
  }
  throw new Error('Kein Rundweg');
}

function edgeCount(n) {
  return (n + 1) * n + n * (n + 1);
}
function hId(n, r, c) { return r * n + c; }
function vId(n, r, c) { return (n + 1) * n + r * (n + 1) + c; }

function makeLoop(n, rng) {
  const on = Array(edgeCount(n)).fill(0);
  const inside = Array.from({ length: n }, () => Array(n).fill(false));
  const setCell = (r, c, v) => {
    const flip = (id) => { on[id] = on[id] ? 0 : 1; };
    if (v) {
      inside[r][c] = true;
      flip(hId(n, r, c));
      flip(hId(n, r + 1, c));
      flip(vId(n, r, c));
      flip(vId(n, r, c + 1));
    }
  };
  setCell(0, 0, true);
  const target = Math.max(4, Math.floor(n * n * 0.55));
  let guardN = 0;
  while (inside.flat().filter(Boolean).length < target && guardN++ < n * n * 12) {
    const cand = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (inside[r][c]) continue;
        let touch = 0;
        if (r && inside[r - 1][c]) touch += 1;
        if (r + 1 < n && inside[r + 1][c]) touch += 1;
        if (c && inside[r][c - 1]) touch += 1;
        if (c + 1 < n && inside[r][c + 1]) touch += 1;
        if (touch === 1) cand.push([r, c]);
      }
    }
    if (!cand.length) break;
    const [r, c] = cand[rng.int(0, cand.length - 1)];
    setCell(r, c, true);
  }
  return on;
}

function cluesOf(n, on) {
  const clue = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const es = [hId(n, r, c), hId(n, r + 1, c), vId(n, r, c), vId(n, r, c + 1)];
      clue.push(es.reduce((s, e) => s + (on[e] ? 1 : 0), 0));
    }
  }
  return clue;
}

function countLoops(n, clue) {
  const E = edgeCount(n);
  const st = Array(E).fill(0);
  let sols = 0;
  let nodes = 0;
  const hN = (n + 1) * n;
  const cellEdges = (r, c) => [hId(n, r, c), hId(n, r + 1, c), vId(n, r, c), vId(n, r, c + 1)];
  const vertEdges = (r, c) => {
    const out = [];
    if (r > 0) out.push(vId(n, r - 1, c));
    if (r < n) out.push(vId(n, r, c));
    if (c > 0) out.push(hId(n, r, c - 1));
    if (c < n) out.push(hId(n, r, c));
    return out;
  };
  function prop() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const need = clue[r * n + c];
          if (need < 0) continue;
          const es = cellEdges(r, c);
          let on = 0;
          const unk = [];
          for (const e of es) {
            if (st[e] === 1) on += 1;
            else if (st[e] === 0) unk.push(e);
          }
          if (on > need || on + unk.length < need) return false;
          if (unk.length && on === need) { unk.forEach((e) => { st[e] = 2; }); changed = true; }
          else if (unk.length && on + unk.length === need) { unk.forEach((e) => { st[e] = 1; }); changed = true; }
        }
      }
      for (let r = 0; r <= n; r++) {
        for (let c = 0; c <= n; c++) {
          const es = vertEdges(r, c);
          let on = 0;
          const unk = [];
          for (const e of es) {
            if (st[e] === 1) on += 1;
            else if (st[e] === 0) unk.push(e);
          }
          if (on > 2) return false;
          if (on === 2 && unk.length) { unk.forEach((e) => { st[e] = 2; }); changed = true; }
          else if (on === 1 && unk.length === 1) { st[unk[0]] = 1; changed = true; }
          else if (on === 0 && unk.length === 1) { st[unk[0]] = 2; changed = true; }
          else if (on === 1 && unk.length === 0) return false;
        }
      }
    }
    return true;
  }
  function oneLoop() {
    const onEdges = [];
    for (let i = 0; i < E; i++) if (st[i] === 1) onEdges.push(i);
    if (onEdges.length < 4) return false;
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c <= n; c++) {
        let on = 0;
        for (const e of vertEdges(r, c)) if (st[e] === 1) on += 1;
        if (on !== 0 && on !== 2) return false;
      }
    }
    const adj = Array.from({ length: E }, () => []);
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c <= n; c++) {
        const es = vertEdges(r, c).filter((e) => st[e] === 1);
        if (es.length === 2) {
          adj[es[0]].push(es[1]);
          adj[es[1]].push(es[0]);
        }
      }
    }
    const seen = new Set([onEdges[0]]);
    const q = [onEdges[0]];
    while (q.length) {
      const e = q.pop();
      for (const nb of adj[e]) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
    }
    return seen.size === onEdges.length;
  }
  function bt() {
    if (sols > 1) return;
    guard(++nodes, 70000);
    if (!prop()) return;
    const ei = st.findIndex((v) => v === 0);
    if (ei < 0) {
      if (oneLoop()) sols += 1;
      return;
    }
    const snap = st.slice();
    for (const v of [1, 2]) {
      for (let i = 0; i < E; i++) st[i] = snap[i];
      st[ei] = v;
      bt();
      if (sols > 1) return;
    }
    for (let i = 0; i < E; i++) st[i] = snap[i];
  }
  bt();
  return sols;
  void hN;
}

function edgeAt(state, i) {
  const W = state.w;
  const R = (i / W) | 0;
  const C = i % W;
  const n = state.n;
  if ((R % 2) === 0 && (C % 2) === 1) return hId(n, R / 2, (C - 1) / 2);
  if ((R % 2) === 1 && (C % 2) === 0) return vId(n, (R - 1) / 2, C / 2);
  return -1;
}

export function solved(state) {
  if (state.on.some((v, i) => v !== state.key[i])) return false;
  return true;
}

export function act(state, i) {
  const e = edgeAt(state, i);
  if (e < 0) return { ok: false, silent: true };
  state.on[e] = state.on[e] ? 0 : 1;
  return { ok: true, sound: 'click', win: solved(state) };
}

export function hint(state) {
  const e = state.on.findIndex((v, i) => v !== state.key[i]);
  if (e < 0) return { ok: false, toast: 'none' };
  state.on[e] = state.key[e];
  return { ok: true, toast: 'hint', win: solved(state) };
}

export function paint(state, i) {
  const W = state.w;
  const R = (i / W) | 0;
  const C = i % W;
  const n = state.n;
  if ((R % 2) === 0 && (C % 2) === 0) return { cls: 'dot', text: '', aria: '' };
  if ((R % 2) === 1 && (C % 2) === 1) {
    const v = state.clue[((R - 1) / 2) * n + (C - 1) / 2];
    return { cls: 'clue', text: v >= 0 ? String(v) : '', aria: v >= 0 ? String(v) : '' };
  }
  const e = edgeAt(state, i);
  const horiz = (R % 2) === 0;
  const on = state.on[e] ? ' on' : '';
  return { cls: `edge${horiz ? ' h' : ' v'}${on}`, text: '', aria: state.on[e] ? 'on' : '' };
}

export function coach(state) {
  const e = state.key.findIndex((v) => v);
  const n = state.n;
  const hN = (n + 1) * n;
  if (e < hN) {
    const r = (e / n) | 0;
    const c = e % n;
    return (r * 2) * state.w + (c * 2 + 1);
  }
  const k = e - hN;
  const r = (k / (n + 1)) | 0;
  const c = k % (n + 1);
  return (r * 2 + 1) * state.w + (c * 2);
}
