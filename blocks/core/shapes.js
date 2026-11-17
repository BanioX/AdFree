// Formen → Varianten (alle Drehungen/Spiegelungen) mit Bitmasken für schnelle Prüfungen.
// Rein logisch, ohne DOM.

import { shapes as SHAPE_DEFS } from '../data/shapes.js';

/** '#.|##' oder ['#.', '##'] → [[r, c], …] */
export function parseRows(rows) {
  const list = Array.isArray(rows) ? rows : String(rows).split('|');
  const cells = [];
  list.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) if (line[c] === '#') cells.push([r, c]);
  });
  return cells;
}

export function normalize(cells) {
  let mr = Infinity, mc = Infinity;
  for (const [r, c] of cells) { if (r < mr) mr = r; if (c < mc) mc = c; }
  return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export const cellsKey = (cells) => normalize(cells).map(([r, c]) => r + ',' + c).join(';');

const rot = (cells) => cells.map(([r, c]) => [c, -r]);
const flip = (cells) => cells.map(([r, c]) => [r, -c]);

/** Alle unterschiedlichen Ausrichtungen einer Form-Definition. */
export function orientationsOf(def) {
  const base = normalize(parseRows(def.rows));
  const out = [];
  const seen = new Set();
  const add = (cells) => {
    const n = normalize(cells);
    const k = cellsKey(n);
    if (!seen.has(k)) { seen.add(k); out.push(n); }
  };
  const starts = def.mirror ? [base, flip(base)] : [base];
  for (const s of starts) {
    let cur = s;
    const turns = def.rotate ? 4 : 1;
    for (let i = 0; i < turns; i++) { add(cur); cur = rot(cur); }
  }
  return out;
}

export function isConnected(cells) {
  if (!cells.length) return false;
  const set = new Set(cells.map(([r, c]) => r + ',' + c));
  const stack = [cells[0]];
  const seen = new Set([cells[0][0] + ',' + cells[0][1]]);
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (r + dr) + ',' + (c + dc);
      if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([r + dr, c + dc]); }
    }
  }
  return seen.size === cells.length;
}

function makeVariant(def, cells, idx, count) {
  let h = 0, w = 0;
  for (const [r, c] of cells) { if (r + 1 > h) h = r + 1; if (c + 1 > w) w = c + 1; }
  const masks = new Array(h).fill(0);
  for (const [r, c] of cells) masks[r] |= 1 << c;
  return {
    key: `${def.id}:${idx}`,
    shape: def.id,
    cells,
    w, h,
    n: cells.length,
    masks,
    color: def.color | 0,
    tier: def.tier | 0,
    weight: (def.weight ?? 1) / count,
  };
}

/** Katalog aller Varianten: { list, byKey, find(rowsSpec) } */
export function buildCatalog(defs = SHAPE_DEFS) {
  const list = [];
  for (const def of defs) {
    const ors = orientationsOf(def);
    ors.forEach((cells, i) => list.push(makeVariant(def, cells, i, ors.length)));
  }
  const byKey = new Map(list.map((v) => [v.key, v]));
  const byCells = new Map(list.map((v) => [cellsKey(v.cells), v]));
  return {
    list,
    byKey,
    get: (key) => byKey.get(key) || null,
    /** Findet die Variante zu einer Zeichnung ('##|#.'), sonst null. */
    find: (rows) => byCells.get(cellsKey(parseRows(rows))) || null,
  };
}

let defaultCatalog = null;
export function catalog() {
  if (!defaultCatalog) defaultCatalog = buildCatalog();
  return defaultCatalog;
}
