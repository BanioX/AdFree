// Vorschaubilder für die Galerie: werden nacheinander gerendert (nur sichtbare), als PNG in
// IndexedDB (kv) zwischengespeichert – Schlüssel: id + Fortschritts-Hash.

import { kv } from '../../shared/idb.js';
import { hashString } from '../../shared/rng.js';
import { liteModel, renderThumb } from './render.js';
import { decodeBits } from './progress.js';

const THUMB_V = 3;
const SIZE = 440;
const memo = new Map(); // id -> { key, url }
const queue = [];
let running = false;
let loader = null; // (item) => Promise<Puzzle>

export function setThumbLoader(fn) { loader = fn; }

export function thumbKey(rec) {
  const h = rec && rec.h ? rec.h : '';
  if (!rec) return `${THUMB_V}:0`;
  if (rec.done) return `${THUMB_V}:done:${h}`;
  if (!(rec.n > 0)) return `${THUMB_V}:0`;
  return `${THUMB_V}:${hashString(rec.f || '').toString(36)}:${h}`;
}

/** Sofort verfügbare URL (Speicher-Cache), sonst null. */
export function cachedThumb(id, key) {
  const m = memo.get(id);
  return m && m.key === key ? m.url : null;
}

/**
 * Vorschaubild anfordern. job: { item, rec, key, onReady(url), isWanted() }
 */
export function requestThumb(job) {
  const url = cachedThumb(job.item.id, job.key);
  if (url) { job.onReady(url); return; }
  queue.push(job);
  pump();
}

export function forgetThumb(id) {
  const m = memo.get(id);
  if (m) URL.revokeObjectURL(m.url);
  memo.delete(id);
}

function setMemo(id, key, blob) {
  const old = memo.get(id);
  if (old) URL.revokeObjectURL(old.url);
  const url = URL.createObjectURL(blob);
  memo.set(id, { key, url });
  return url;
}

async function pump() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      if (job.isWanted && !job.isWanted()) { job.onSkip && job.onSkip(); continue; }
      const id = job.item.id;
      const hit = cachedThumb(id, job.key);
      if (hit) { job.onReady(hit); continue; }
      try {
        const stored = await kv.get('paint.thumb.' + id, null);
        if (stored && stored.k === job.key && stored.b) {
          job.onReady(setMemo(id, job.key, stored.b));
          continue;
        }
        const pz = await loader(job.item);
        const lite = liteModel(pz);
        const rec = job.rec;
        const filled = rec && !rec.done && rec.f ? decodeBits(rec.f, lite.n) : null;
        const cv = renderThumb(lite, filled, !!(rec && rec.done), SIZE);
        const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
        cv.width = 0;
        if (!blob) throw new Error('toBlob');
        kv.set('paint.thumb.' + id, { k: job.key, b: blob }).catch(() => {});
        job.onReady(setMemo(id, job.key, blob));
      } catch (err) {
        job.onError && job.onError(err);
      }
      // dem Browser Luft lassen
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    running = false;
  }
}
