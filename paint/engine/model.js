// Laufzeit-Modell eines Bildes: Pfade (einmal erzeugt), Rahmen, Nummern, Farbgruppen.
import { liteModel } from './render.js';
import { digitsOf, fontFactor } from './analyze-core.js';

/** Puzzle-Daten prüfen und bereinigen (fremde Module sollen nichts kaputt machen). */
export function sanitizePuzzle(pz, fallbackId) {
  if (!pz || typeof pz !== 'object') throw new Error('Kein Bild');
  const palette = Array.isArray(pz.palette) && pz.palette.length
    ? pz.palette.slice(0, 30).map((c) => (typeof c === 'string' ? c : '#cccccc'))
    : ['#cccccc'];
  const shapes = (Array.isArray(pz.shapes) ? pz.shapes : [])
    .filter((s) => s && typeof s.d === 'string' && s.d.length > 0)
    .map((s) => {
      const out = { d: s.d, c: Math.min(palette.length - 1, Math.max(0, (s.c | 0))) };
      if (s.r === 'evenodd') out.r = 'evenodd';
      return out;
    });
  if (!shapes.length) throw new Error('Bild ohne Formen');
  const width = +pz.width > 0 ? +pz.width : 1000;
  const height = +pz.height > 0 ? +pz.height : 1000;
  return {
    ...pz,
    id: pz.id || fallbackId,
    width, height, palette, shapes,
    lines: Array.isArray(pz.lines) ? pz.lines : [],
    background: typeof pz.background === 'string' ? pz.background : '#ffffff',
  };
}

export function buildModel(pz, an) {
  const M = liteModel(pz);
  const n = M.n;
  M.title = pz.title || '';
  M.category = pz.category || '';
  M.bbox = an.bbox;
  M.auto = an.auto;
  M.num = M.palette.map((_, c) => String(c + 1));
  const labels = [];
  const mainLabel = new Int32Array(n).fill(-1);
  let minFont = Infinity;
  for (let i = 0; i < n; i++) {
    if (an.auto[i] || !(an.lr[i] > 0)) continue;
    const fu = an.lr[i] * fontFactor(digitsOf(M.col[i]));
    mainLabel[i] = labels.length;
    labels.push(i, an.lx[i], an.ly[i], fu);
    if (fu < minFont) minFont = fu;
  }
  const ex = an.extra || [];
  for (let k = 0; k < ex.length; k += 4) {
    const i = ex[k];
    if (an.auto[i]) continue;
    labels.push(i, ex[k + 1], ex[k + 2], ex[k + 3] * fontFactor(digitsOf(M.col[i])));
  }
  M.labels = new Float32Array(labels);
  M.mainLabel = mainLabel;
  M.minFont = Number.isFinite(minFont) ? minFont : Math.max(M.W, M.H) / 40;
  const colorShapes = M.palette.map(() => []);
  for (let i = 0; i < n; i++) if (!an.auto[i]) colorShapes[M.col[i]].push(i);
  M.colorShapes = colorShapes;
  // typische Grösse einer Fläche (Median der Wurzel der sichtbaren Fläche) – für Umrissbreite
  const sizes = [];
  for (let i = 0; i < n; i++) if (!an.auto[i]) sizes.push(Math.sqrt(Math.max(0, an.area[i])));
  sizes.sort((a, b) => a - b);
  M.typSize = sizes.length ? sizes[Math.floor(sizes.length * 0.4)] : Math.max(M.W, M.H) / 10;
  M.total = colorShapes.reduce((a, l) => a + l.length, 0);
  // Nummern-Position einer Form (Hauptnummer) – für Tipps/Tests
  M.labelOf = (i) => {
    const k = mainLabel[i];
    if (k >= 0) return { x: M.labels[k + 1], y: M.labels[k + 2], f: M.labels[k + 3] };
    const b = i * 4;
    return { x: (M.bbox[b] + M.bbox[b + 2]) / 2, y: (M.bbox[b + 1] + M.bbox[b + 3]) / 2, f: 0 };
  };
  return M;
}
