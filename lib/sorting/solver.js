// Stapel-Sortieren – Löser (reine Logik, kein DOM).
//
// Gewichtete A*-Suche über «Makro-Züge» (die oberste gleichfarbige Reihe wandert, so viel Platz hat).
// Bei Regel move:'single' wird jeder Makro-Zug danach in Einzelzüge zerlegt – jeder davon ist erlaubt,
// eine gefundene Lösung ist also immer auch eine echte Lösung im Spiel.
//
// Stapel sind austauschbar: für die Besucht-Liste wird die sortierte Liste der Stapel verwendet.
// Heuristik: Σ (Farbabschnitte − 1) pro Stapel + Σ (Stapel mit dieser Farbe ganz unten − 1) pro Farbe.
// Die Suche ist deterministisch (Knotenlimit statt Zeitlimit) – gleicher Zustand, gleiche Lösung.

const A = 97;

function encode(state) {
  return state.stacks.map((s) => s.map((c) => String.fromCharCode(A + c)).join(''));
}

function runLen(s) {
  const n = s.length;
  const c = s.charCodeAt(n - 1);
  let k = 1;
  while (k < n && s.charCodeAt(n - 1 - k) === c) k++;
  return k;
}

function mono(s) {
  const c = s.charCodeAt(0);
  for (let i = 1; i < s.length; i++) if (s.charCodeAt(i) !== c) return false;
  return true;
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

function isGoal(tubes, cap, clear) {
  for (const s of tubes) {
    if (!s.length) continue;
    if (clear) return false;
    if (s.length !== cap || !mono(s)) return false;
  }
  return true;
}

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (less(a[p], a[i])) break;
      [a[p], a[i]] = [a[i], a[p]];
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
        if (l < a.length && less(a[l], a[m])) m = l;
        if (r < a.length && less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}
// Kleinere f zuerst, bei Gleichstand das tiefere g (näher am Ziel), dann Einfügereihenfolge.
function less(x, y) {
  if (x.f !== y.f) return x.f < y.f;
  if (x.g !== y.g) return x.g > y.g;
  return x.id < y.id;
}

function search(start, cap, rules, weight, maxNodes) {
  const clear = rules.complete === 'clear';
  const lock = !clear;
  const seen = new Map();
  const heap = new Heap();
  let id = 0;
  const root = { t: start, g: 0, f: weight * heuristic(start), p: null, m: null, id: id++ };
  heap.push(root);
  seen.set(start.slice().sort().join('|'), 0);
  let expanded = 0;
  while (heap.size) {
    const node = heap.pop();
    const t = node.t;
    if (isGoal(t, cap, clear)) return { node, expanded };
    if (++expanded > maxNodes) return { node: null, expanded };
    const n = t.length;
    let firstEmpty = -1;
    for (let i = 0; i < n; i++) if (!t[i].length) { firstEmpty = i; break; }
    for (let f = 0; f < n; f++) {
      const s = t[f];
      if (!s.length) continue;
      if (lock && s.length === cap && mono(s)) continue;
      const run = runLen(s);
      const c = s.charCodeAt(s.length - 1);
      const whole = run === s.length;
      for (let d = 0; d < n; d++) {
        if (d === f) continue;
        const u = t[d];
        if (u.length >= cap) continue;
        if (!u.length) {
          if (whole || d !== firstEmpty) continue;
        } else if (u.charCodeAt(u.length - 1) !== c) continue;
        const count = Math.min(run, cap - u.length);
        const nt = t.slice();
        nt[f] = s.slice(0, s.length - count);
        let nu = u + s.slice(s.length - count);
        if (clear && nu.length === cap && mono(nu)) nu = '';
        nt[d] = nu;
        const key = nt.slice().sort().join('|');
        const g = node.g + 1;
        const old = seen.get(key);
        if (old !== undefined && old <= g) continue;
        seen.set(key, g);
        heap.push({ t: nt, g, f: g + weight * heuristic(nt), p: node, m: { from: f, to: d, count }, id: id++ });
      }
    }
  }
  return { node: null, expanded };
}

/** Zerlegt Makro-Züge in Einzelzüge (für move:'single'). */
export function expandMoves(moves, rules) {
  if (!rules || rules.move !== 'single') return moves.map((m) => ({ ...m }));
  const out = [];
  for (const m of moves) for (let k = 0; k < m.count; k++) out.push({ from: m.from, to: m.to, count: 1 });
  return out;
}

/**
 * Sucht eine Lösung. Gibt { moves, macro, nodes } oder null zurück.
 * moves = Spielzüge (bei 'single' zerlegt), macro = Anzahl Makro-Züge.
 */
export function solve(state, rules, { maxNodes = 60000, weights = [2, 6] } = {}) {
  const start = encode(state);
  let total = 0;
  for (const w of weights) {
    const { node, expanded } = search(start, state.cap, rules, w, maxNodes);
    total += expanded;
    if (node) {
      const macro = [];
      for (let x = node; x.p; x = x.p) macro.push(x.m);
      macro.reverse();
      return { moves: expandMoves(macro, rules), macro: macro.length, nodes: total };
    }
  }
  return null;
}

/** Nächster sinnvoller Zug (oder null, wenn von hier aus keine Lösung gefunden wird). */
export function hint(state, rules, opts) {
  const r = solve(state, rules, opts);
  if (!r) return null;
  return r.moves[0] || null;
}

export { heuristic as _heuristic };
