// Browser-Teil der Foto-Umwandlung: Bild dekodieren (EXIF-Ausrichtung, grosse iPhone-Fotos
// zuerst verkleinern), dann die eigentliche Arbeit in einem Modul-Worker erledigen.
// Fallback: gleiche Pipeline auf dem Hauptthread, in Häppchen mit await.

import { processImage, DETAIL, AbortErr } from './core/photo.js';

function abortError() {
  try { return new DOMException('Abgebrochen', 'AbortError'); } catch { return new AbortErr(); }
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try { return new OffscreenCanvas(w, h); } catch { /* weiter unten */ }
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function loadImgElement(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
    img.src = url;
  });
}

/** Dekodiert die Quelle und liefert ImageData mit langer Seite <= maxSide. */
export async function decodeImage(source, maxSide) {
  let src = null, w = 0, h = 0;
  let toClose = null;
  if (typeof ImageData !== 'undefined' && source instanceof ImageData) {
    const c = makeCanvas(source.width, source.height);
    c.getContext('2d').putImageData(source, 0, 0);
    src = c; w = source.width; h = source.height;
  } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
    const attempts = [];
    if (typeof createImageBitmap === 'function') {
      // Grosse Dateien möglichst schon beim Dekodieren verkleinern (spart Speicher auf dem iPhone)
      if (source.size > 1.5e6) attempts.push(() => createImageBitmap(source, { imageOrientation: 'from-image', resizeWidth: maxSide * 4, resizeQuality: 'high' }));
      attempts.push(() => createImageBitmap(source, { imageOrientation: 'from-image' }));
      attempts.push(() => createImageBitmap(source));
    }
    attempts.push(() => loadImgElement(source));
    let lastErr = null;
    for (const a of attempts) {
      try {
        const r = await a();
        src = r;
        if (typeof ImageBitmap !== 'undefined' && r instanceof ImageBitmap) toClose = r;
        break;
      } catch (e) { lastErr = e; }
    }
    if (!src) throw lastErr || new Error('Bild konnte nicht gelesen werden');
  } else if (source && typeof source === 'object') {
    src = source;
    if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement && !source.complete) {
      await source.decode();
    }
  } else {
    throw new Error('Keine Bildquelle');
  }
  if (!w) {
    w = src.naturalWidth || src.videoWidth || src.width;
    h = src.naturalHeight || src.videoHeight || src.height;
  }
  if (!w || !h) throw new Error('Bild ist leer');
  const s = Math.min(1, maxSide / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
  // Schrittweise halbieren, damit das Verkleinern sauber (ohne Flimmern) bleibt
  let cur = src, cw = w, ch = h;
  while (cw / 2 >= tw * 1.6 && ch / 2 >= th * 1.6) {
    const nw = Math.round(cw / 2), nh = Math.round(ch / 2);
    const c = makeCanvas(nw, nh);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, nw, nh);
    if (cur !== src && cur.width) { cur.width = 0; cur.height = 0; }
    cur = c; cw = nw; ch = nh;
  }
  const out = makeCanvas(tw, th);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tw, th);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, tw, th);
  const data = ctx.getImageData(0, 0, tw, th);
  if (toClose && toClose.close) toClose.close();
  return data;
}

let jobId = 0;

function runInWorker(image, opts, onProgress, signal) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./photo-worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      reject(Object.assign(new Error('kein Worker'), { fallback: true }));
      return;
    }
    const id = ++jobId;
    let started = false;
    let done = false;
    const finish = () => { done = true; worker.terminate(); if (signal) signal.removeEventListener('abort', onAbort); clearTimeout(timer); };
    const onAbort = () => { if (done) return; finish(); reject(abortError()); };
    if (signal) signal.addEventListener('abort', onAbort);
    // Startet der Worker gar nicht (z.B. keine Modul-Worker), auf den Hauptthread ausweichen.
    const timer = setTimeout(() => {
      if (!started && !done) { finish(); reject(Object.assign(new Error('Worker antwortet nicht'), { fallback: true })); }
    }, 8000);
    worker.onerror = (ev) => {
      if (done) return;
      if (ev && ev.preventDefault) ev.preventDefault();
      finish();
      reject(Object.assign(new Error('Worker-Fehler'), { fallback: !started }));
    };
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.id !== id || done) return;
      if (m.type === 'started') started = true;
      else if (m.type === 'progress') onProgress(m.value);
      else if (m.type === 'done') { finish(); resolve(m.puzzle); }
      else if (m.type === 'error') { finish(); reject(new Error(m.message)); }
    };
    const payload = { width: image.width, height: image.height, data: image.data };
    worker.postMessage({ type: 'run', id, image: payload, opts }, [image.data.buffer]);
  });
}

/**
 * Wandelt ein Foto in ein Malen-nach-Zahlen-Puzzle um.
 * @param {File|Blob|ImageBitmap|HTMLImageElement|HTMLCanvasElement|ImageData} source
 * @param {{ colors?: number, detail?: 'grob'|'mittel'|'fein', onProgress?: (v:number)=>void, signal?: AbortSignal }} options
 */
export async function photoToPuzzle(source, { colors = 16, detail = 'mittel', onProgress, signal } = {}) {
  const det = DETAIL[detail] ? detail : 'mittel';
  const nColors = Math.max(6, Math.min(30, Math.round(+colors || 16)));
  let last = 0;
  const report = (v) => {
    const x = Math.max(0, Math.min(1, v));
    if (x > last || (x === 1 && last !== 1)) { last = x; if (onProgress) { try { onProgress(x); } catch { /* Aufrufer-Fehler ignorieren */ } } }
  };
  if (signal && signal.aborted) throw abortError();
  report(0.01);
  const image = await decodeImage(source, DETAIL[det].size);
  if (signal && signal.aborted) throw abortError();
  report(0.05);
  const map = (v) => report(0.05 + v * 0.95);
  const opts = { colors: nColors, detail: det };
  let puzzle;
  if (typeof Worker !== 'undefined') {
    // Kopie behalten, falls wir auf den Hauptthread ausweichen müssen (Transfer leert den Puffer)
    const backup = new Uint8ClampedArray(image.data);
    try {
      puzzle = await runInWorker(image, opts, map, signal);
    } catch (e) {
      if (!e || !e.fallback) throw e;
      puzzle = await processImage({ width: image.width, height: image.height, data: backup }, {
        ...opts, onProgress: map, signal, tick: () => new Promise((r) => setTimeout(r, 0)),
      });
    }
  } else {
    puzzle = await processImage(image, { ...opts, onProgress: map, signal, tick: () => new Promise((r) => setTimeout(r, 0)) });
  }
  report(1);
  return puzzle;
}
