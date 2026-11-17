// Analyse-API: Ergebnis aus dem Cache (IndexedDB) oder neu berechnen – bevorzugt im Worker.
//
//   const a = await getAnalysis(puzzle, { onProgress });

import { kv } from '../../shared/idb.js';
import { hashString } from '../../shared/rng.js';
import { analyzePuzzle, ANALYSIS_VERSION } from './analyze-core.js';

export function contentHash(pz) {
  const parts = [pz.width, pz.height];
  for (const s of pz.shapes) parts.push(s.d, s.c, s.r || '');
  const str = parts.join('|');
  return hashString(str).toString(36) + '.' + str.length.toString(36);
}

let worker = null;
let workerBroken = false;
let readyPromise = null;
let reqId = 0;
const pending = new Map();

function getWorker() {
  if (workerBroken) return Promise.resolve(null);
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve) => {
    const fail = () => {
      workerBroken = true;
      try { worker && worker.terminate(); } catch { /* ignore */ }
      worker = null;
      for (const p of pending.values()) p.reject(new Error('worker'));
      pending.clear();
      resolve(null);
    };
    try {
      if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') { fail(); return; }
      worker = new Worker(new URL('./analyze-worker.js', import.meta.url), { type: 'module' });
    } catch {
      fail();
      return;
    }
    const timer = setTimeout(fail, 5000);
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === 'ready') {
        clearTimeout(timer);
        if (m.ok) resolve(worker); else fail();
        return;
      }
      const p = pending.get(m.id);
      if (!p) return;
      if (m.type === 'progress') p.onProgress && p.onProgress(m.p);
      else if (m.type === 'done') { pending.delete(m.id); p.resolve(m.res); }
      else if (m.type === 'error') { pending.delete(m.id); p.reject(new Error(m.message)); }
    };
    worker.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); clearTimeout(timer); fail(); };
  });
  return readyPromise;
}

async function inWorker(puzzle, onProgress) {
  const w = await getWorker();
  if (!w) return null;
  const id = ++reqId;
  const lite = {
    width: puzzle.width,
    height: puzzle.height,
    shapes: puzzle.shapes.map((s) => ({ d: s.d, c: s.c, r: s.r })),
  };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage({ id, puzzle: lite });
  });
}

function domCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

async function onMainThread(puzzle, onProgress) {
  let last = performance.now();
  return analyzePuzzle(puzzle, {
    createCanvas: domCanvas,
    onProgress,
    tick: () => {
      const now = performance.now();
      if (now - last < 12) return null;
      return new Promise((r) => setTimeout(() => { last = performance.now(); r(); }, 0));
    },
  });
}

/** Analyse liefern (Cache-Treffer nach id + Inhalts-Hash + Version). */
export async function getAnalysis(puzzle, { onProgress, noCache = false } = {}) {
  const h = contentHash(puzzle);
  const key = 'paint.an.' + puzzle.id;
  if (!noCache) {
    const cached = await kv.get(key, null);
    if (cached && cached.h === h && cached.v === ANALYSIS_VERSION && cached.n === puzzle.shapes.length) return cached;
  }
  let res = null;
  try { res = await inWorker(puzzle, onProgress); } catch { res = null; }
  if (!res) res = await onMainThread(puzzle, onProgress);
  res.h = h;
  res.v = ANALYSIS_VERSION;
  kv.set(key, res).catch(() => {});
  return res;
}

export function forgetAnalysis(id) {
  return kv.remove('paint.an.' + id);
}
