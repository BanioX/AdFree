// Farbfluss – Löser (reine Logik, kein DOM).
//
// A*-Suche mit Zustands-Hashing. Gläser mit gleichem Fassungsvermögen sind austauschbar,
// darum wird für das Hashing die sortierte Liste der Gläser verwendet.
//
// Heuristik (zulässig, d.h. unterschätzt nie):
//   Σ über Gläser (Farbabschnitte − 1)  +  Σ über Farben (Gläser mit dieser Farbe ganz unten − 1)
// Jeder Zug kann diese Summe um höchstens 1 senken. Mit weight = 1 ist die gefundene
// Lösung daher optimal (kürzestmöglich); mit weight > 1 schneller, aber evtl. länger.

const A = 97; // 'a'

function encode(state) {
  return state.tubes.map((t) => t.l.map((c) => String.fromCharCode(A + c)).join(''));
}

function topRunStr(s) {
  const n = s.length;
  const c = s.charCodeAt(n - 1);
  let k = 1;
  while (k < n && s.charCodeAt(n - 1 - k) === c) k++;
  return k;
}

function heuristic(tubes) {
  let h = 0;
  const bottoms = new Map();
  for (const s of tubes) {
    const n = s.length;
    if (!n) continue;
    let seg = 1;
    for (let i = 1; i < n; i++) if (s.charCodeAt(i) !== s.charCodeAt(i - 1)) seg++;
    h += seg - 1;
    const b = s.charCodeAt(0);
    bottoms.set(b, (bottoms.get(b) || 0) + 1);
  }
  for (const v of bottoms.values()) h += v - 1;
  return h;
}

function keyOf(tubes, caps, uniformCaps) {
  if (uniformCaps) return tubes.slice().sort().join('|');
  const parts = new Array(tubes.length);
  for (let i = 0; i < tubes.length; i++) parts[i] = caps[i] + ':' + tubes[i];
  return parts.sort().join('|');
}

function isGoal(tubes, per) {
  for (const s of tubes) {
    if (!s.length) continue;
    if (s.length !== per) return false;
    const c = s.charCodeAt(0);
    for (let i = 1; i < s.length; i++) if (s.charCodeAt(i) !== c) return false;
  }
  return true;
}

function isMonoStr(s) {
  const c = s.charCodeAt(0);
  for (let i = 1; i < s.length; i++) if (s.charCodeAt(i) !== c) return false;
  return true;
}

/** Erzeugt alle sinnvollen Züge für einen kodierten Zustand. */
function expand(tubes, caps, per, out) {
  out.length = 0;
  const n = tubes.length;
  for (let i = 0; i < n; i++) {
    const s = tubes[i];
    const len = s.length;
    if (!len) continue;
    const mono = isMonoStr(s);
    if (mono && len === per) continue; // fertig, versiegelt
    const run = mono ? len : topRunStr(s);
    const c = s.charCodeAt(len - 1);
    let emptyCapsTried = 0; // Bitmaske über Fassungsvermögen
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = tubes[j];
      const room = caps[j] - d.length;
      if (room <= 0) continue;
      if (d.length) {
        if (d.charCodeAt(d.length - 1) !== c) continue;
      } else {
        if (mono && caps[j] >= caps[i]) continue; // einfarbig ins leere Glas: bringt nichts
        const bit = 1 << caps[j];
        if (emptyCapsTried & bit) continue; // leere Gläser gleicher Grösse sind gleichwertig
        emptyCapsTried |= bit;
      }
      out.push(i, j, Math.min(run, room));
    }
  }
  return out;
}

// Kleiner Binär-Heap über Knotenindizes, sortiert nach (f, -g).
class Heap {
  constructor() { this.a = []; this.f = []; this.g = []; }
  get size() { return this.a.length; }
  less(i, j) {
    const f = this.f, g = this.g, a = this.a;
    if (f[a[i]] !== f[a[j]]) return f[a[i]] < f[a[j]];
    if (g[a[i]] !== g[a[j]]) return g[a[i]] > g[a[j]];
    return a[i] < a[j];
  }
  push(node) {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.less(l, m)) m = l;
        if (r < a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Sucht eine Lösung.
 * opts: { maxNodes = 150000, weight = 1 }
 * Rückgabe: { moves: [{from, to, n}], optimal, nodes } oder { moves: null, exhausted, nodes }
 *   exhausted = true: Suchraum vollständig durchsucht → garantiert unlösbar.
 */
export function solve(state, opts = {}) {
  const maxNodes = opts.maxNodes ?? 150000;
  const weight = opts.weight ?? 1;
  const per = state.per || 4;
  const caps = state.tubes.map((t) => t.cap);
  const uniformCaps = caps.every((c) => c === caps[0]);
  const start = encode(state);

  if (isGoal(start, per)) return { moves: [], optimal: true, nodes: 0 };

  const states = [start];
  const parent = [-1];
  const moveFrom = [-1], moveTo = [-1], moveN = [0];
  const heap = new Heap();
  const h0 = heuristic(start);
  heap.f[0] = weight * h0;
  heap.g[0] = 0;
  heap.push(0);
  const best = new Map([[keyOf(start, caps, uniformCaps), 0]]);
  const buf = [];
  let expanded = 0;

  while (heap.size) {
    const node = heap.pop();
    const g = heap.g[node];
    const tubes = states[node];
    const k = keyOf(tubes, caps, uniformCaps);
    if (best.get(k) < g) continue;
    if (isGoal(tubes, per)) {
      const moves = [];
      for (let x = node; parent[x] !== -1; x = parent[x]) moves.push({ from: moveFrom[x], to: moveTo[x], n: moveN[x] });
      moves.reverse();
      return { moves, optimal: weight === 1, nodes: expanded };
    }
    if (++expanded > maxNodes) return { moves: null, exhausted: false, nodes: expanded };
    expand(tubes, caps, per, buf);
    for (let m = 0; m < buf.length; m += 3) {
      const i = buf[m], j = buf[m + 1], n = buf[m + 2];
      const next = tubes.slice();
      const src = tubes[i];
      next[i] = src.slice(0, src.length - n);
      next[j] = tubes[j] + src.slice(src.length - n);
      const nk = keyOf(next, caps, uniformCaps);
      const ng = g + 1;
      const old = best.get(nk);
      if (old !== undefined && old <= ng) continue;
      best.set(nk, ng);
      const id = states.length;
      states.push(next);
      parent.push(node);
      moveFrom.push(i); moveTo.push(j); moveN.push(n);
      heap.g[id] = ng;
      heap.f[id] = ng + weight * heuristic(next);
      heap.push(id);
    }
  }
  return { moves: null, exhausted: true, nodes: expanded };
}

/**
 * Löst möglichst optimal, fällt bei grossen Rätseln auf schnellere (gewichtete) Suche zurück.
 * Rückgabe wie solve(); zusätzlich weight.
 */
export function solveBest(state, { budget = 60000, weights = [1, 1.6, 3, 6] } = {}) {
  let last = null;
  for (const w of weights) {
    const r = solve(state, { maxNodes: budget, weight: w });
    r.weight = w;
    if (r.moves || r.exhausted) return r;
    last = r;
  }
  return last;
}

/** Untere Schranke für die Zahl der Züge (die Heuristik selbst). */
export function lowerBound(state) {
  return heuristic(encode(state));
}

/** Nächster Zug Richtung Lösung (für den Tipp-Knopf). null = keine Lösung gefunden. */
export function hint(state, opts = {}) {
  const r = solveBest(state, { budget: opts.budget ?? 40000, weights: [1.6, 3, 8] });
  if (!r || !r.moves) return { move: null, exhausted: !!(r && r.exhausted), solved: false };
  if (!r.moves.length) return { move: null, solved: true };
  return { move: r.moves[0], remaining: r.moves.length, solved: false };
}
