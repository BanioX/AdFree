// Woher die Rätsel kommen:
//  1. Vorrat data/pool.js (sofort da, von sanft nach knifflig sortiert)
//  2. Frisch erzeugte Rätsel aus dem Worker (worker.js), wenn der Vorrat einmal durch ist
//  3. Jedes Rätsel wird zufällig umgeformt (Ziffern tauschen, spiegeln …) – gleiche Schwierigkeit, neues Aussehen.
// Tagesrätsel: deterministisch aus dem Datum, für alle gleich.
import { store } from '../shared/storage.js';
import { makeRng } from '../shared/rng.js';
import { pool } from './data/pool.js';
import { difficulties, difficultyById, DAILY_DIFFICULTY } from './data/difficulties.js';
import { transform, solutionOf, generate } from './logic/generator.js';
import { KEYS } from './progress.js';

const FRESH_TARGET = 2;

function salt() {
  let s = store.get(KEYS.salt, null);
  if (!s) {
    s = Math.random().toString(36).slice(2, 10);
    store.set(KEYS.salt, s);
  }
  return s;
}

function permutation(n, seed) {
  const rng = makeRng(seed);
  return rng.shuffle(Array.from({ length: n }, (_, i) => i));
}

/** Nummer des nächsten Rätsels einer Stufe (1-basiert), ohne es zu verbrauchen. */
export function nextNumber(diffId) {
  return (store.get(KEYS.seq, {})[diffId] || 0) + 1;
}

/** Nächstes Rätsel einer Stufe. @returns {{ puzzle, solution, number, src }} */
export function nextPuzzle(diffId) {
  const spec = difficultyById(diffId);
  const seq = store.get(KEYS.seq, {}) || {};
  const n = seq[spec.id] || 0;
  seq[spec.id] = n + 1;
  store.set(KEYS.seq, seq);

  const arr = pool[spec.id] || [];
  const fresh = store.get(KEYS.fresh, {}) || {};
  const freshList = Array.isArray(fresh[spec.id]) ? fresh[spec.id] : [];
  let base = null;
  const firstPass = n < arr.length;
  if (!firstPass && freshList.length && (n % 2 === 1 || !arr.length)) {
    base = freshList.shift();
    fresh[spec.id] = freshList;
    store.set(KEYS.fresh, fresh);
    base.src = 'fresh';
  } else if (arr.length) {
    const pass = Math.floor(n / arr.length);
    let idx = n % arr.length;
    if (pass > 0) idx = permutation(arr.length, `sudoku-pool-${spec.id}-${pass}`)[idx];
    base = { puzzle: arr[idx], solution: null, src: `pool:${idx}` };
  } else {
    const g = generate(spec, `${salt()}-${spec.id}-${n}`);
    base = { puzzle: g.puzzle, solution: g.solution, src: 'gen' };
  }
  const solution = base.solution || solutionOf(base.puzzle);
  const t = transform(base.puzzle, solution, makeRng(`${salt()}-${spec.id}-${n}`));
  return { puzzle: t.puzzle, solution: t.solution, number: n + 1, src: base.src };
}

/** Tagesrätsel (Stufe Mittel) – für alle gleich, jeden Tag neu. */
export function dailyPuzzle(day) {
  const arr = pool[DAILY_DIFFICULTY];
  const rng = makeRng('sudoku-daily-' + day);
  const idx = Math.floor(rng.next() * arr.length);
  const t = transform(arr[idx], solutionOf(arr[idx]), rng);
  return { puzzle: t.puzzle, solution: t.solution, src: `pool:${idx}` };
}

// ---------- Worker für frische Rätsel ----------

let worker = null;
let workerBroken = false;
let reqId = 0;
const pending = new Map();

function getWorker() {
  if (worker || workerBroken || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, result } = e.data || {};
      const p = pending.get(id);
      if (p) { pending.delete(id); p(result || null); }
    };
    worker.onerror = () => {
      workerBroken = true;
      for (const p of pending.values()) p(null);
      pending.clear();
      worker = null;
    };
  } catch {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

/** Erzeugt im Hintergrund ein frisches Rätsel. @returns {Promise<object|null>} */
export function generateFresh(diffId, seed = `${salt()}-fresh-${Date.now()}-${Math.random()}`) {
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = ++reqId;
    pending.set(id, resolve);
    w.postMessage({ id, diff: diffId, seed });
  });
}

let topping = false;
/** Füllt den Vorrat frischer Rätsel auf, sobald der feste Vorrat einer Stufe fast aufgebraucht ist. */
export async function topUpFresh() {
  if (topping) return;
  topping = true;
  try {
    for (const spec of difficulties) {
      const arr = pool[spec.id] || [];
      const n = (store.get(KEYS.seq, {}) || {})[spec.id] || 0;
      if (n < arr.length - 3) continue;
      for (let guard = 0; guard < FRESH_TARGET; guard++) {
        const fresh = store.get(KEYS.fresh, {}) || {};
        const list = Array.isArray(fresh[spec.id]) ? fresh[spec.id] : [];
        if (list.length >= FRESH_TARGET) break;
        const r = await generateFresh(spec.id);
        if (!r || !r.puzzle) return;
        const f2 = store.get(KEYS.fresh, {}) || {};
        f2[spec.id] = [...(Array.isArray(f2[spec.id]) ? f2[spec.id] : []), { puzzle: r.puzzle, solution: r.solution }];
        store.set(KEYS.fresh, f2);
      }
    }
  } finally {
    topping = false;
  }
}

// ---------- Erstes Rätsel ----------

/**
 * Macht ein Rätsel sanfter: deckt zusätzliche Zahlen aus der Lösung auf, bis nur noch `empty`
 * Felder frei sind. Bevorzugt Felder in Reihen/Spalten/Blöcken, die schon fast voll sind (ohne sie
 * selbst zu vervollständigen) – so gibt es früh die ersten «Reihe fertig!»-Momente. Deterministisch (gleiches Rätsel → gleiches Ergebnis).
 */
export function gentler(puzzle, solution, empty = 28) {
  const vals = puzzle.split('').map((ch) => (ch >= '1' && ch <= '9' ? +ch : 0));
  const rng = makeRng('sudoku-gentle-' + puzzle);
  let free = vals.filter((v) => !v).length;
  const units = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3;
    units.push(Array.from({ length: 9 }, (_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)));
  }
  while (free > empty) {
    // Feld mit den meisten schon gefüllten Nachbarn in seinen Einheiten (leichter Zufall gegen Muster)
    let best = -1, bestScore = -1;
    for (let i = 0; i < 81; i++) {
      if (vals[i]) continue;
      let score = rng.next() * 3;
      for (const u of units) {
        if (!u.includes(i)) continue;
        const f = u.filter((j) => vals[j]).length;
        // fast volle Einheiten auffüllen, aber nie selbst vervollständigen (das soll man selbst tun)
        score += f === 8 ? -40 : f;
      }
      if (score > bestScore) { bestScore = score; best = i; }
    }
    vals[best] = +solution[best];
    free--;
  }
  return vals.join('');
}
