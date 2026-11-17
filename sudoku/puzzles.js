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
