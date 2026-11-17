// Worker für die Bild-Analyse (OffscreenCanvas). Fällt der Worker aus, rechnet analyze.js im Hauptthread.
import { analyzePuzzle } from './analyze-core.js';

function supported() {
  try {
    if (typeof OffscreenCanvas === 'undefined' || typeof Path2D === 'undefined') return false;
    const c = new OffscreenCanvas(4, 4);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx || typeof ctx.fill !== 'function') return false;
    ctx.fillStyle = '#123456';
    ctx.fill(new Path2D('M0 0H4V4H0Z'));
    const d = ctx.getImageData(1, 1, 1, 1).data;
    return d[0] === 0x12 && d[1] === 0x34 && d[2] === 0x56;
  } catch {
    return false;
  }
}

const ok = supported();

self.onmessage = async (e) => {
  const { id, puzzle } = e.data || {};
  if (!ok) { self.postMessage({ id, type: 'error', message: 'unsupported' }); return; }
  try {
    let last = 0;
    const res = await analyzePuzzle(puzzle, {
      createCanvas: (w, h) => new OffscreenCanvas(w, h),
      onProgress: (p) => {
        const now = Date.now();
        if (p >= 1 || now - last > 60) { last = now; self.postMessage({ id, type: 'progress', p }); }
      },
    });
    self.postMessage({ id, type: 'done', res },
      [res.bbox.buffer, res.area.buffer, res.lx.buffer, res.ly.buffer, res.lr.buffer, res.auto.buffer, res.extra.buffer]);
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
};

self.postMessage({ type: 'ready', ok });
