// Bilderrätsel – Endlos-Bilder: deterministisch erzeugte Pixelbilder (ohne DOM).
//   makeEndless(size, n) => Definition { id, title, title_en, category, palette, rows, bg }
// Zwei Sorten: «Pixelwesen» (spiegelsymmetrische Fantasiewesen mit Augen) und «Mosaik»
// (vierfach symmetrische Muster). Jedes Ergebnis ist eindeutig per Zeilenlogik lösbar.

import { makeRng } from '../../shared/rng.js';
import { checkUnique } from './solver.js';
import { fixRows } from './puzzle.js';

// Harmonische Farbsets: [Körper, Kontur, Akzent, Wange]
const CREATURE_COLORS = [
  ['#7cc36a', '#3f8a3a', '#ffd23f', '#ff9db5'],
  ['#ff9ec4', '#c9558a', '#ffffff', '#ff6f91'],
  ['#7fc8ff', '#3d6fb6', '#ffd23f', '#ff9db5'],
  ['#b48cff', '#6a4ab0', '#ffe08a', '#ff9ec4'],
  ['#ffb347', '#c46a1a', '#fff3a6', '#ff7f7f'],
  ['#5fd3c4', '#2a8a80', '#fff3a6', '#ff9db5'],
  ['#ff8a7a', '#b8483a', '#fff3e0', '#ffd23f'],
  ['#ffd23f', '#c99a12', '#ffffff', '#ff8a7a'],
];
const MOSAIC_COLORS = [
  ['#e5484d', '#ffb199', '#ffd23f', '#7a1e2a'],
  ['#3f8ef0', '#a9d4ff', '#ffffff', '#1f4e8a'],
  ['#45b85a', '#b7e889', '#fff3a6', '#1f6a3a'],
  ['#9b6bff', '#d9c6ff', '#ff9ec4', '#4a2a8a'],
  ['#ff8a1f', '#ffd28a', '#fff8e8', '#9a4a12'],
  ['#2bb3c0', '#a8ecf0', '#ffe08a', '#14666e'],
  ['#e0699a', '#ffc2da', '#ffffff', '#8a2a5a'],
];
const BGS = ['#fffaf3', '#eef7ff', '#f3fff0', '#fff4f8', '#f6f1ff', '#fffbe6'];

const SYL_A = ['Bo', 'Mi', 'Lu', 'Fi', 'Pu', 'Ki', 'No', 'Ri', 'Wu', 'Tu', 'Sa', 'Zi', 'Mo', 'Pi', 'Gu', 'Ela', 'Olli', 'Fla'];
const SYL_B = ['mel', 'li', 'po', 'zi', 'bu', 'ni', 'wa', 'ko', 'fi', 'ra', 'tsch', 'ffel', 'sel', 'nchen', 'mo', 'pf'];

/** Grundform (0/1-Raster) mit Glättung; sym: 'mirror' | 'quad' */
function blob(size, rng, { sym, density }) {
  const w = size, h = size;
  let g = new Uint8Array(w * h);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const dx = Math.abs(c - cx) / (w / 2), dy = Math.abs(r - cy) / (h / 2);
    const fall = sym === 'quad' ? Math.max(dx, dy) * 0.25 : dx * 0.45 + Math.max(0, dy - 0.55) * 0.9;
    g[r * w + c] = rng.next() < density - fall ? 1 : 0;
  }
  const symm = (src) => {
    const out = Uint8Array.from(src);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const mc = c < w / 2 ? c : w - 1 - c;
      const mr = sym === 'quad' ? (r < h / 2 ? r : h - 1 - r) : r;
      out[r * w + c] = src[mr * w + mc];
    }
    return out;
  };
  g = symm(g);
  const iters = size <= 5 ? 0 : 2;
  for (let it = 0; it < iters; it++) {
    const n = new Uint8Array(w * h);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      let k = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < h && cc < w) k += g[rr * w + cc];
      }
      n[r * w + c] = k >= 5 || (g[r * w + c] && k >= 4) ? 1 : 0;
    }
    g = symm(n);
  }
  return g;
}

function largestComponent(g, w, h) {
  const seen = new Int32Array(w * h).fill(-1);
  let best = -1, bestSize = 0, id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!g[i] || seen[i] >= 0) continue;
    const stack = [i];
    seen[i] = id;
    let size = 0;
    while (stack.length) {
      const j = stack.pop();
      size++;
      const r = Math.floor(j / w), c = j % w;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
        const k = rr * w + cc;
        if (g[k] && seen[k] < 0) { seen[k] = id; stack.push(k); }
      }
    }
    if (size > bestSize) { bestSize = size; best = id; }
    id++;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = seen[i] === best ? 1 : 0;
  return { g: out, size: bestSize };
}

function creature(size, rng) {
  const w = size, h = size;
  const density = size <= 5 ? 0.78 : 0.66;
  const { g, size: filled } = largestComponent(blob(size, rng, { sym: 'mirror', density }), w, h);
  if (filled < w * h * 0.32 || filled > w * h * 0.82) return null;
  let top = h, bottom = -1;
  for (let i = 0; i < w * h; i++) if (g[i]) { const r = Math.floor(i / w); top = Math.min(top, r); bottom = Math.max(bottom, r); }
  if (bottom - top + 1 < h * 0.6) return null;
  const rows = [];
  const at = (r, c) => (r >= 0 && c >= 0 && r < h && c < w ? g[r * w + c] : 0);
  for (let r = 0; r < h; r++) {
    let s = '';
    for (let c = 0; c < w; c++) {
      if (!at(r, c)) { s += '.'; continue; }
      const edge = size >= 10 && (!at(r - 1, c) || !at(r + 1, c) || !at(r, c - 1) || !at(r, c + 1));
      s += edge ? 'k' : 'b';
    }
    rows.push(s);
  }
  // Augen: in der oberen Hälfte eine Zeile suchen, wo der Körper breit ist
  const mid = Math.floor((w - 1) / 2);
  const set = (r, c, ch) => { rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); };
  const inner = (r, c) => at(r, c) && at(r - 1, c) && at(r + 1, c) && at(r, c - 1) && at(r, c + 1);
  for (let r = top + 1; r < top + (bottom - top) * 0.6; r++) {
    if (!at(r, mid)) continue;
    let L = mid;
    while (L - 1 >= 0 && at(r, L - 1)) L--;
    const cl = Math.max(L + 1, mid - Math.max(1, Math.round((mid - L) / 2)));
    const cr = w - 1 - cl;
    if (cl >= mid || cl < 1 || cr <= cl + 1) continue;
    const ok = size < 10 ? at(r, cl) && at(r, cr)
      : size < 15 ? inner(r, cl) && inner(r, cr)
        : inner(r, cl) && inner(r, cr) && inner(r + 1, cl) && inner(r + 1, cr);
    if (ok) {
      if (size >= 15) {
        set(r, cl, 'w'); set(r, cr, 'w'); set(r + 1, cl, 'e'); set(r + 1, cr, 'e');
        if (inner(r + 2, cl - 1) && inner(r + 2, cr + 1)) { set(r + 2, cl - 1, 'p'); set(r + 2, cr + 1, 'p'); }
      } else {
        set(r, cl, 'e'); set(r, cr, 'e');
        if (size >= 10 && inner(r + 1, cl - 1) && inner(r + 1, cr + 1)) { set(r + 1, cl - 1, 'p'); set(r + 1, cr + 1, 'p'); }
      }
      break;
    }
  }
  // Ein paar Tupfen auf dem Bauch
  if (size >= 10) {
    for (let r = Math.floor(top + (bottom - top) * 0.6); r < bottom; r += 2) {
      if (inner(r, mid) && rows[r][mid] === 'b' && rng.chance(0.6)) { set(r, mid, 'a'); set(r, w - 1 - mid, 'a'); }
    }
  }
  const col = rng.pick(CREATURE_COLORS);
  const name = rng.pick(SYL_A) + rng.pick(SYL_B);
  return {
    title: name,
    category: 'Pixelwesen',
    palette: { b: col[0], k: col[1], a: col[2], p: col[3], e: '#2b2420', w: '#ffffff' },
    rows,
  };
}

function mosaic(size, rng) {
  const w = size, h = size;
  const g = blob(size, rng, { sym: 'quad', density: size <= 5 ? 0.62 : 0.58 });
  let filled = 0;
  for (let i = 0; i < w * h; i++) filled += g[i];
  if (filled < w * h * 0.3 || filled > w * h * 0.8) return null;
  const col = rng.pick(MOSAIC_COLORS);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const ringW = Math.max(1, Math.round(size / 6));
  const rows = [];
  for (let r = 0; r < h; r++) {
    let s = '';
    for (let c = 0; c < w; c++) {
      if (!g[r * w + c]) { s += '.'; continue; }
      const d = Math.round(Math.max(Math.abs(r - cy), Math.abs(c - cx)) + Math.min(Math.abs(r - cy), Math.abs(c - cx)) * 0.5);
      s += 'abcd'[Math.floor(d / ringW) % 4];
    }
    rows.push(s);
  }
  return {
    title: 'Mosaik',
    category: 'Mosaik',
    palette: { a: col[3], b: col[0], c: col[1], d: col[2] },
    rows,
  };
}

function cleanPalette(def) {
  const used = new Set(def.rows.join(''));
  const palette = {};
  for (const [k, v] of Object.entries(def.palette)) if (used.has(k)) palette[k] = v;
  return { ...def, palette };
}

/**
 * Erzeugt Endlos-Bild Nr. n (ab 1) der Grösse size (5, 10, 15, 20). Deterministisch.
 */
export function makeEndless(size, n) {
  const rng = makeRng(`nonogram-endless-${size}-${n}`);
  const kind = rng.chance(0.62) ? 'creature' : 'mosaic';
  for (let attempt = 0; attempt < 80; attempt++) {
    const def = kind === 'creature' || attempt % 3 === 2 ? creature(size, rng) : mosaic(size, rng);
    if (!def) continue;
    const w = size, h = size;
    const mask = new Uint8Array(w * h);
    def.rows.forEach((row, r) => { for (let c = 0; c < w; c++) mask[r * w + c] = row[c] === '.' ? 0 : 1; });
    let res = checkUnique(mask, w, h);
    if (!res.ok && res.unknown <= 10) {
      const f = fixRows(def.rows, 4);
      if (f.ok) { def.rows = f.rows; res = { ok: true }; }
    }
    if (!res.ok) continue;
    const mosaicT = def.category === 'Mosaik';
    return cleanPalette({
      id: `e${size}-${n}`,
      title: mosaicT ? `Mosaik Nr. ${n}` : def.title,
      title_en: mosaicT ? `Mosaic No. ${n}` : def.title,
      category: def.category,
      palette: def.palette,
      rows: def.rows,
      bg: BGS[(n * 7 + size) % BGS.length],
    });
  }
  // Sicherheitsnetz (praktisch nie erreicht): ein einfacher Rahmen ist immer eindeutig
  const rows = [];
  for (let r = 0; r < size; r++) {
    let s = '';
    for (let c = 0; c < size; c++) s += r === 0 || c === 0 || r === size - 1 || c === size - 1 ? 'a' : '.';
    rows.push(s);
  }
  return { id: `e${size}-${n}`, title: `Rahmen Nr. ${n}`, title_en: `Frame No. ${n}`, category: 'Mosaik', palette: { a: '#e0699a' }, rows };
}
