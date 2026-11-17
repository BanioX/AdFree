// Modul-Worker für die Foto-Umwandlung. Empfängt ImageData-artige Daten, meldet Fortschritt.
//   -> { type: 'run', id, image: { width, height, data }, opts: { colors, detail } }
//   <- { type: 'started' | 'progress' | 'done' | 'error', id, value?, puzzle?, message? }

import { processImage } from './core/photo.js';

self.onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type !== 'run') return;
  const { id, image, opts } = msg;
  self.postMessage({ type: 'started', id });
  try {
    let last = -1;
    const puzzle = await processImage(image, {
      ...opts,
      onProgress: (v) => {
        // Nachrichten sparsam halten
        if (v - last >= 0.01 || v === 1) { last = v; self.postMessage({ type: 'progress', id, value: v }); }
      },
    });
    self.postMessage({ type: 'done', id, puzzle });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String((err && err.message) || err) });
  }
};
