// Zahlenschlange – Spielzustand (rein, JSON-speicherbar).
// vals[i]: eingetragene Zahl (0 = leer, -1 = Loch). Gegebene Zahlen stehen von Anfang an drin.

import { generate, touching } from './puzzle.js';
import { difficultyById, DAILY } from '../data/difficulties.js';

export const seedFor = (diff, number, day) => (day ? `hidato-daily-${day}` : `hidato-${diff}-${number}`);
const UNDO_MAX = 60;

export function newGame({ diff = 'leicht', number = 1, day = null } = {}) {
  const spec = day ? DAILY : difficultyById(diff);
  const puzzle = generate(seedFor(spec.id, number, day), spec);
  return {
    v: 1, diff: spec.id, number, day, puzzle,
    vals: puzzle.sol.map((v, i) => (v === 0 ? -1 : puzzle.given[i] ? v : 0)),
    notes: {},
    undo: [],
    hints: 0,
    elapsed: 0,
    done: false,
    created: Date.now(),
  };
}

export function validState(st) {
  return !!(st && st.v === 1 && st.puzzle && Array.isArray(st.vals) && st.vals.length === st.puzzle.sol.length);
}

export const isGiven = (st, i) => !!st.puzzle.given[i];
export const isHole = (st, i) => st.puzzle.sol[i] === 0;

/** Zahl → Feld (−1 wenn nicht gesetzt). */
export function positions(st) {
  const pos = new Array(st.puzzle.N + 2).fill(-1);
  st.vals.forEach((v, i) => { if (v > 0) pos[v] = i; });
  return pos;
}

export function snapshot(st) {
  st.undo.push(st.vals.slice());
  if (st.undo.length > UNDO_MAX) st.undo.shift();
}

export function undo(st) {
  if (!st.undo.length || st.done) return false;
  st.vals = st.undo.pop();
  return true;
}

/** Setzt k auf Feld i (eine eigene k anderswo wird dabei verschoben). */
export function place(st, i, k) {
  const { N } = st.puzzle;
  if (st.done || k < 1 || k > N || st.vals[i] !== 0) return false;
  const pos = positions(st);
  if (pos[k] >= 0) {
    if (isGiven(st, pos[k])) return false;
    st.vals[pos[k]] = 0;
  }
  st.vals[i] = k;
  delete st.notes[i];
  checkDone(st);
  return true;
}

export function clearCell(st, i) {
  if (st.done || isGiven(st, i) || st.vals[i] <= 0) return false;
  st.vals[i] = 0;
  return true;
}

export function toggleNote(st, i, k) {
  if (st.vals[i] !== 0) return;
  const list = new Set(st.notes[i] || []);
  if (list.has(k)) list.delete(k); else list.add(k);
  if (list.size) st.notes[i] = [...list].sort((a, b) => a - b); else delete st.notes[i];
}

/** Fehlende Zahlen, die neben Feld i passen würden (ein Nachbar hat k−1 oder k+1). */
export function candidates(st, i) {
  const { w, N } = st.puzzle;
  if (st.vals[i] !== 0) return [];
  const pos = positions(st);
  const out = [];
  for (let k = 1; k <= N; k++) {
    if (pos[k] >= 0) continue;
    const a = pos[k - 1] ?? -1, b = pos[k + 1] ?? -1;
    if ((k > 1 && a >= 0 && touching(w, a, i)) || (k < N && b >= 0 && touching(w, b, i))) out.push(k);
  }
  return out;
}

/** Felder mit Widerspruch: k und k±1 gesetzt, berühren sich aber nicht. */
export function conflicts(st) {
  const { w, N } = st.puzzle;
  const pos = positions(st);
  const bad = new Set();
  for (let k = 1; k < N; k++) {
    if (pos[k] >= 0 && pos[k + 1] >= 0 && !touching(w, pos[k], pos[k + 1])) {
      if (!isGiven(st, pos[k])) bad.add(pos[k]);
      if (!isGiven(st, pos[k + 1])) bad.add(pos[k + 1]);
    }
  }
  return bad;
}

/** Verbundene Paare (k, k+1) für die Linienzeichnung. */
export function links(st) {
  const { w, N } = st.puzzle;
  const pos = positions(st);
  const out = [];
  for (let k = 1; k < N; k++) if (pos[k] >= 0 && pos[k + 1] >= 0 && touching(w, pos[k], pos[k + 1])) out.push([pos[k], pos[k + 1], k]);
  return out;
}

/**
 * Abschnitte zwischen zwei aufeinanderfolgenden gegebenen Zahlen, deren Lücke vollständig
 * verbunden ist (für Lob/Leuchten). Nur echte Lücken (mindestens eine fehlende Zahl).
 * Ergebnis: [{ key: 'a-b', a, b, cells: [Feld von a, …, Feld von b] }]
 */
export function closedSegments(st) {
  const { w, sol, given } = st.puzzle;
  const pos = positions(st);
  const gv = [];
  sol.forEach((v, i) => { if (v > 0 && given[i]) gv.push(v); });
  gv.sort((x, y) => x - y);
  const out = [];
  for (let g = 0; g + 1 < gv.length; g++) {
    const a = gv[g], b = gv[g + 1];
    if (b - a < 2) continue;
    let ok = true;
    for (let k = a; k < b && ok; k++) ok = pos[k] >= 0 && pos[k + 1] >= 0 && touching(w, pos[k], pos[k + 1]);
    if (!ok) continue;
    const cells = [];
    for (let k = a; k <= b; k++) cells.push(pos[k]);
    out.push({ key: `${a}-${b}`, a, b, cells });
  }
  return out;
}

export function checkDone(st) {
  const { w, N } = st.puzzle;
  const pos = positions(st);
  for (let k = 1; k <= N; k++) if (pos[k] < 0) return false;
  for (let k = 1; k < N; k++) if (!touching(w, pos[k], pos[k + 1])) return false;
  st.done = true;
  return true;
}

/** Anteil der fehlenden Zahlen, die schon eingetragen sind (0…1). */
export function progress(st) {
  const g = st.puzzle.given.filter(Boolean).length;
  const missing = st.puzzle.N - g;
  if (!missing) return 1;
  const own = st.vals.filter((v, i) => v > 0 && !st.puzzle.given[i]).length;
  return Math.min(1, own / missing);
}

/**
 * Ziehen: drag = { cells: [Startfeld, …], placed: [Felder, die in diesem Zug gesetzt wurden] }.
 * Gibt 'place' | 'advance' | 'back' | null zurück.
 */
export function dragStep(st, drag, cell) {
  const { w, N } = st.puzzle;
  const path = drag.cells;
  const head = path[path.length - 1];
  if (cell === head || st.done) return null;
  if (path.length >= 2 && cell === path[path.length - 2]) {
    const pi = drag.placed.indexOf(head);
    if (pi >= 0) { st.vals[head] = 0; drag.placed.splice(pi, 1); }
    path.pop();
    return 'back';
  }
  if (!touching(w, head, cell)) return null;
  const k = st.vals[head];
  if (k <= 0 || k >= N) return null;
  const nk = k + 1;
  if (st.vals[cell] === nk) { path.push(cell); return 'advance'; }
  if (st.vals[cell] !== 0) return null;
  const pos = positions(st);
  if (pos[nk] >= 0 && isGiven(st, pos[nk])) return null;
  place(st, cell, nk);
  path.push(cell);
  drag.placed.push(cell);
  return 'place';
}

/** Tipp: zuerst eine falsche eigene Zahl, sonst die nächste fehlende Zahl an einer Kette. */
export function findHint(st) {
  const { sol, N } = st.puzzle;
  for (let i = 0; i < sol.length; i++) {
    if (st.vals[i] > 0 && !isGiven(st, i) && st.vals[i] !== sol[i]) return { type: 'wrong', cell: i, k: st.vals[i] };
  }
  const pos = positions(st);
  const solPos = new Array(N + 1).fill(-1);
  sol.forEach((v, i) => { if (v > 0) solPos[v] = i; });
  // kleinste Zahl, deren Vorgänger schon steht
  for (let k = 2; k <= N; k++) if (pos[k] < 0 && pos[k - 1] >= 0) return { type: 'place', cell: solPos[k], k };
  for (let k = 1; k < N; k++) if (pos[k] < 0 && pos[k + 1] >= 0) return { type: 'place', cell: solPos[k], k };
  for (let k = 1; k <= N; k++) if (pos[k] < 0) return { type: 'place', cell: solPos[k], k };
  return null;
}

export function applyHint(st) {
  const h = findHint(st);
  if (!h) return null;
  snapshot(st);
  st.hints++;
  if (h.type === 'wrong') st.vals[h.cell] = 0;
  else {
    if (st.vals[h.cell] > 0) st.vals[h.cell] = 0;     // falsche Zahl dort weg
    place(st, h.cell, h.k);
  }
  return h;
}

export function restart(st) {
  st.vals = st.puzzle.sol.map((v, i) => (v === 0 ? -1 : st.puzzle.given[i] ? v : 0));
  st.notes = {};
  st.undo = [];
  st.done = false;
  return st;
}

export function starsFor(st) {
  return Math.max(1, 3 - Math.min(2, st.hints));
}
