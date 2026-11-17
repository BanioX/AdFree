// Generische Tiefensuche für Patience-Löser (reine Logik, auch in Node nutzbar).
//
//   import { dfs } from '../lib/cards/search.js';
//   const r = dfs(start, {
//     key(st)  -> String   kanonischer Schlüssel (gleiche Stellung = gleicher Schlüssel)
//     won(st)  -> bool
//     moves(st) -> [m]     mögliche Züge, beste zuerst
//     apply(st, m) -> st'  neuer Zustand (unveränderlich)
//     auto(st) -> m|null   optional: sicherer Zug ohne Verzweigung (wird sofort gespielt)
//   }, { maxNodes: 100000, timeLimit: 0 });
//   r = { solved: true | false | null (Limit erreicht), nodes, moves: [m…] | null }
//
// moves enthält auch die automatisch gespielten Züge – genau in Spielreihenfolge.

export function dfs(start, ops, { maxNodes = 100000, timeLimit = 0 } = {}) {
  const { key, won, moves, apply, auto } = ops;
  const seen = new Set();
  const path = [];
  const t0 = timeLimit ? Date.now() : 0;
  let nodes = 0;
  let aborted = false;

  // Iterativ (eigener Stapel), damit lange Lösungen keinen Stack-Überlauf erzeugen.
  // Rahmen: { list, i, base }  base = Pfadlänge vor diesem Rahmen (inkl. eigener Auto-Züge)
  const stack = [];

  function enter(st, plen) {
    if (auto) {
      let m;
      let guard = 0;
      while ((m = auto(st)) && guard++ < 200) { st = apply(st, m); path.push(m); }
    }
    if (won(st)) return 'won';
    const k = key(st);
    if (seen.has(k)) { path.length = plen; return 'dead'; }
    seen.add(k);
    nodes++;
    if (nodes > maxNodes || (timeLimit && (nodes & 511) === 0 && Date.now() - t0 > timeLimit)) {
      aborted = true;
      return 'abort';
    }
    stack.push({ st, list: moves(st), i: 0, plen, base: path.length });
    return 'open';
  }

  let r = enter(start, 0);
  if (r === 'won') return { solved: true, nodes, moves: path.slice() };
  while (stack.length && !aborted) {
    const f = stack[stack.length - 1];
    if (f.i >= f.list.length) {
      stack.pop();
      path.length = f.plen;
      continue;
    }
    const m = f.list[f.i++];
    path.length = f.base;
    path.push(m);
    r = enter(apply(f.st, m), path.length - 1);
    if (r === 'won') return { solved: true, nodes, moves: path.slice() };
  }
  return { solved: aborted ? null : false, nodes, moves: null };
}

/** Kanonischer Schlüssel für Spalten (Reihenfolge der Spalten egal). */
export function colsKey(cols, down, extra = '') {
  const parts = new Array(cols.length);
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    let s = (down ? down[i] : 0) + ':';
    for (let j = 0; j < c.length; j++) s += String.fromCharCode(48 + c[j]);
    parts[i] = s;
  }
  parts.sort();
  return parts.join('|') + '#' + extra;
}

// ---------------------------------------------------------------- Bestensuche

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= x.f) break;
      a[i] = a[p]; i = p;
    }
    a[i] = x;
  }
  pop() {
    const a = this.a;
    const topEl = a[0];
    const last = a.pop();
    if (a.length) {
      let i = 0;
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        let mf = last.f;
        if (l < n && a[l].f < mf) { m = l; mf = a[l].f; }
        if (r < n && a[r].f < mf) m = r;
        if (m === i) break;
        a[i] = a[m]; i = m;
      }
      a[i] = last;
    }
    return topEl;
  }
}

/**
 * Gierige Bestensuche: erweitert immer die Stellung mit der besten Bewertung (score: kleiner = besser).
 * Findet Lösungen meist viel schneller als die Tiefensuche, beweist aber Unlösbarkeit nur,
 * wenn der ganze Suchraum innerhalb von maxNodes erschöpft wird.
 *   ops wie bei dfs, zusätzlich score(st, depth) -> Zahl
 */
export function bestFirst(start, ops, { maxNodes = 100000, timeLimit = 0 } = {}) {
  const { key, won, moves, apply, auto, score } = ops;
  const seen = new Set();
  const heap = new MinHeap();
  const t0 = timeLimit ? Date.now() : 0;
  let nodes = 0;
  let seq = 0;

  const settle = (st, node) => {
    if (!auto) return { st, node };
    let m;
    let guard = 0;
    while ((m = auto(st)) && guard++ < 200) { st = apply(st, m); node = { m, p: node }; }
    return { st, node };
  };
  const pathOf = (node) => {
    const out = [];
    for (let n = node; n && n.m; n = n.p) out.push(n.m);
    return out.reverse();
  };

  const s0 = settle(start, { m: null, p: null });
  if (won(s0.st)) return { solved: true, nodes, moves: pathOf(s0.node) };
  seen.add(key(s0.st));
  heap.push({ f: score(s0.st, 0), seq: seq++, st: s0.st, node: s0.node, d: 0 });
  while (heap.size) {
    const cur = heap.pop();
    nodes++;
    if (nodes > maxNodes || (timeLimit && (nodes & 255) === 0 && Date.now() - t0 > timeLimit)) {
      return { solved: null, nodes, moves: null };
    }
    for (const m of moves(cur.st)) {
      const r = settle(apply(cur.st, m), { m, p: cur.node });
      if (won(r.st)) return { solved: true, nodes, moves: pathOf(r.node) };
      const k = key(r.st);
      if (seen.has(k)) continue;
      seen.add(k);
      heap.push({ f: score(r.st, cur.d + 1) + (seq++) * 1e-9, st: r.st, node: r.node, d: cur.d + 1 });
    }
  }
  return { solved: false, nodes, moves: null };
}
