// Gemeinsame Helfer für alle Generatoren (rein, ohne DOM).

import { pleasantOrder } from './color.js';

/** Zahl kompakt formatieren (max. `dp` Nachkommastellen, ohne überflüssige Nullen). */
export function fmt(v, dp = 1) {
  const m = dp === 0 ? 1 : dp === 1 ? 10 : dp === 2 ? 100 : Math.pow(10, dp);
  let r = Math.round(v * m) / m;
  if (Object.is(r, -0)) r = 0;
  return String(r);
}

export const TAU = Math.PI * 2;

/** Polygon (Array von [x, y]) als geschlossener SVG-Teilpfad. */
export function polyPath(pts, dp = 1) {
  let s = 'M' + fmt(pts[0][0], dp) + ' ' + fmt(pts[0][1], dp);
  for (let i = 1; i < pts.length; i++) s += 'L' + fmt(pts[i][0], dp) + ' ' + fmt(pts[i][1], dp);
  return s + 'Z';
}

/** Vorzeichenbehaftete Fläche eines Polygons. */
export function polyArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length, j = n - 1; i < n; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return a / 2;
}

/**
 * Schliesst ein Puzzle ab: entfernt ungenutzte Palettenfarben, sortiert die Palette
 * angenehm (oder behält die Reihenfolge, wenn `keepOrder`) und passt die Indizes an.
 */
export function finalizePuzzle(p, { keepOrder = false } = {}) {
  const used = new Set(p.shapes.map((s) => s.c));
  let idx = p.palette.map((_, i) => i).filter((i) => used.has(i));
  // Doppelte Hex-Werte zusammenlegen
  const firstOf = new Map();
  const alias = new Map();
  for (const i of idx) {
    const hex = p.palette[i].toLowerCase();
    if (firstOf.has(hex)) alias.set(i, firstOf.get(hex));
    else firstOf.set(hex, i);
  }
  idx = idx.filter((i) => !alias.has(i));
  if (!keepOrder) {
    const order = pleasantOrder(idx.map((i) => p.palette[i]));
    idx = order.map((k) => idx[k]);
  }
  const remap = new Map(idx.map((old, k) => [old, k]));
  const palette = idx.map((i) => p.palette[i].toLowerCase());
  const shapes = p.shapes.map((s) => {
    const c = remap.has(s.c) ? remap.get(s.c) : remap.get(alias.get(s.c));
    const o = { d: s.d, c };
    if (s.r) o.r = s.r;
    return o;
  });
  const out = {
    id: p.id,
    title: p.title,
    category: p.category,
    width: p.width,
    height: p.height,
    palette,
    shapes,
  };
  if (p.lines && p.lines.length) out.lines = p.lines;
  if (p.background) out.background = p.background;
  return out;
}

/** Einfache Wertrauschen-Funktion 1D (glatt), deterministisch über rng-Tabelle. */
export function makeNoise1D(rng, size = 256) {
  const t = new Float64Array(size);
  for (let i = 0; i < size; i++) t[i] = rng.next() * 2 - 1;
  return (x) => {
    const xi = Math.floor(x);
    const f = x - xi;
    const a = t[((xi % size) + size) % size];
    const b = t[(((xi + 1) % size) + size) % size];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
}

/** Fraktales 1D-Rauschen (Summe mehrerer Oktaven), Ergebnis grob in [-1, 1]. */
export function makeFbm1D(rng, octaves = 4) {
  const n = makeNoise1D(rng);
  return (x) => {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      s += amp * n(x * f + o * 17.3);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return s / norm;
  };
}

/** Einfaches 2D-Wertrauschen. */
export function makeNoise2D(rng, size = 64) {
  const t = new Float64Array(size * size);
  for (let i = 0; i < t.length; i++) t[i] = rng.next() * 2 - 1;
  const g = (x, y) => t[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
