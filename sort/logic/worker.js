// Farbfluss – Hintergrund-Rechner (Web Worker). Erzeugt Level und Tipps,
// ohne die Animationen im Hauptthread zu stören.

import { buildLevel, buildDaily } from './levels.js';
import { hint } from './solver.js';

self.onmessage = (e) => {
  const { id, type, arg } = e.data || {};
  try {
    let result = null;
    if (type === 'level') result = buildLevel(arg);
    else if (type === 'daily') result = buildDaily(arg);
    else if (type === 'hint') result = hint(arg);
    else if (type === 'ping') result = 'pong';
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
