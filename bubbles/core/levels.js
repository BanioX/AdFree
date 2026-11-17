// Level-Definitionen: Level 1–20 handgezeichnet (data/levels.js), alle weiteren werden
// aus der Levelnummer deterministisch erzeugt (Formen aus data/patterns.js, den Umrissen der
// handgezeichneten Level und Formeln). Es gibt also beliebig viele Level.
//
// getLevel(n) liefert:
//   { n, name, world, worldName, sky, goal, colors, rows, shift, pets, shots, stars, seed, handmade }

import { LEVELS } from '../data/levels.js';
import { PATTERNS } from '../data/patterns.js';
import { LEVELS_PER_WORLD, worldInfo } from '../data/worlds.js';
import { COLOR_BY_KEY } from '../data/colors.js';
import { Board, STONE, isColor, petOf } from './board.js';
import { Rng } from './rng.js';
import { COLS, ROW_H } from './hex.js';
import { Game } from './game.js';
import { autoPlay } from './solver.js';

export const HANDMADE_COUNT = LEVELS.length;
export { LEVELS_PER_WORLD };

const rowLen = (r) => (r & 1 ? COLS - 1 : COLS);
const cellX = (r, c) => 1 + 2 * c + (r & 1);
const cellY = (r) => 1 + r * ROW_H;

// ---------- Text-Format lesen ----------

/** Zerlegt eine Textzeile in Zellen-Tokens und prüft die Länge. */
export function tokens(line, r) {
  const t = String(line).trim().split(/\s+/).filter(Boolean);
  if (t.length !== rowLen(r)) throw new Error(`Zeile ${r + 1}: ${t.length} statt ${rowLen(r)} Zellen`);
  return t;
}

/** Handgezeichnete Zeilen → Zellwerte. Tierchen werden der Reihe nach nummeriert. */
export function parseRows(rows, petCount = 1) {
  let pets = 0;
  return rows.map((line, r) => tokens(line, r).map((t) => {
    if (t === '.') return 0;
    if (t === '#') return STONE;
    const id = COLOR_BY_KEY[t.toLowerCase()];
    if (!id) throw new Error(`Unbekanntes Zeichen «${t}» in Zeile ${r + 1}`);
    if (t !== t.toLowerCase()) {
      const pet = 1 + (pets++ % Math.max(1, petCount));
      return id | (pet << 4);
    }
    return id;
  }));
}

/** Masken-Zeilen (x / .) → boolesches Raster. Auch farbige Zeilen werden als Umriss gelesen. */
export function parseMask(rows) {
  return rows.map((line, r) => tokens(line, r).map((t) => t !== '.'));
}

// ---------- Hilfen ----------

function emptyMask(h) {
  return Array.from({ length: h }, (_, r) => new Array(rowLen(r)).fill(false));
}

function maskFrom(h, fn) {
  return Array.from({ length: h }, (_, r) =>
    Array.from({ length: rowLen(r) }, (_, c) => !!fn(cellX(r, c), cellY(r), r, c)));
}

function mirrorMask(mask) {
  return mask.map((row) => row.slice().reverse());
}

/** Entfernt alles, was nicht mit Zeile 0 verbunden ist. */
function connectMask(mask) {
  const b = new Board(mask.map((row) => row.map((v) => (v ? 1 : 0))));
  for (const [r, c] of b.floating()) mask[r][c] = false;
  return mask;
}

function maskCount(mask) {
  let n = 0;
  for (const row of mask) for (const v of row) if (v) n++;
  return n;
}

// ---------- Formen ----------

const SHAPES = {
  block: (rng, h) => maskFrom(h, () => true),
  vee: (rng, h) => maskFrom(h, (x, y, r) => Math.abs(x - 11) <= 11 - (r / h) * 9),
  diamondish: (rng, h) => {
    const mid = (h - 1) / 2;
    return maskFrom(h, (x, y, r) => Math.abs(x - 11) <= 3 + 8 * (1 - Math.abs(r - mid) / (mid + 1)));
  },
  waves: (rng, h) => {
    const ph = rng.range(0, Math.PI * 2), f = rng.range(0.35, 0.75), amp = rng.range(1.2, 2.6);
    return maskFrom(h, (x, y, r) => r <= (h - 1) - amp + amp * Math.sin(x * f + ph));
  },
  towers: (rng, h) => {
    const depth = [];
    for (let i = 0; i < 6; i++) depth.push(rng.int(Math.max(2, h - 5), h - 1));
    return maskFrom(h, (x, y, r) => r <= depth[Math.min(5, Math.floor(x / 3.7))]);
  },
  tunnel: (rng, h) => {
    const w = rng.range(2.5, 4.5), top = rng.int(2, Math.max(2, h - 4));
    return maskFrom(h, (x, y, r) => r < top || Math.abs(x - 11) > w + (r - top) * 0.6);
  },
  stairs: (rng, h) => {
    const left = rng.chance(0.5);
    return maskFrom(h, (x, y, r) => r <= 1 || (left ? x : 22 - x) <= 22 - (r - 1) * (20 / h));
  },
  holes: (rng, h) => maskFrom(h, (x, y, r) => r <= 1 || !rng.chance(0.14)),
  oval: (rng, h) => {
    const ry = (h * ROW_H) / 2 + 0.6;
    return maskFrom(h, (x, y) => ((x - 11) / 10.6) ** 2 + ((y - ry) / ry) ** 2 <= 1.02);
  },
  zigzag: (rng, h) => {
    const p = rng.range(4.5, 7);
    return maskFrom(h, (x, y, r) => r <= (h - 1) - Math.abs(((x / p) % 2) - 1) * Math.min(4, h - 2));
  },
  pillars: (rng, h) => {
    const gap = rng.int(0, 1);
    return maskFrom(h, (x, y, r) => r <= 2 || Math.floor((x + gap * 2) / 4.4) % 2 === 0);
  },
};
const SHAPE_NAMES = Object.keys(SHAPES);

/** Umrisse aller Vorlagen: Muster + handgezeichnete Bilder */
const TEMPLATE_MASKS = [
  ...PATTERNS.map((p) => p.rows),
  ...LEVELS.map((l) => l.rows),
];

function pickShape(rng, n, h) {
  const roll = rng.next();
  let mask;
  if (roll < 0.42) {
    mask = parseMask(rng.pick(TEMPLATE_MASKS));
  } else {
    const name = rng.pick(SHAPE_NAMES);
    mask = SHAPES[name](rng, h);
  }
  if (rng.chance(0.5)) mask = mirrorMask(mask);
  connectMask(mask);
  if (maskCount(mask) < 26) mask = SHAPES.block(rng, Math.max(4, Math.min(h, 6)));
  return mask;
}

// ---------- Farben verteilen ----------

function cellsOf(mask) {
  const out = [];
  mask.forEach((row, r) => row.forEach((v, c) => { if (v) out.push([r, c]); }));
  return out;
}

const STRATEGIES = {
  clusters(rng, mask, colors, n) {
    const out = mask.map((row) => row.map(() => 0));
    const b = new Board(out);
    const cells = rng.shuffle(cellsOf(mask));
    const maxSize = n < 60 ? 6 : n < 140 ? 5 : 4;
    for (const [r, c] of cells) {
      if (out[r][c]) continue;
      const nb = b.neighbors(r, c).map(([rr, cc]) => out[rr]?.[cc]).filter(Boolean);
      let col = rng.pick(colors);
      for (let k = 0; k < 3 && nb.includes(col); k++) col = rng.pick(colors);
      const size = rng.int(2, maxSize);
      const queue = [[r, c]];
      out[r][c] = col;
      let placed = 1;
      for (let i = 0; i < queue.length && placed < size; i++) {
        const opts = rng.shuffle(b.neighbors(queue[i][0], queue[i][1]));
        for (const [rr, cc] of opts) {
          if (placed >= size) break;
          if (mask[rr]?.[cc] && !out[rr][cc]) {
            out[rr][cc] = col;
            queue.push([rr, cc]);
            placed++;
          }
        }
      }
    }
    return out;
  },
  stripes(rng, mask, colors) {
    const w = rng.range(2.6, 4.6), k = rng.range(-0.8, 0.8), off = rng.int(0, colors.length - 1);
    return mask.map((row, r) => row.map((v, c) => v
      ? colors[(Math.floor((cellX(r, c) + k * cellY(r) + 40) / w) + off) % colors.length] : 0));
  },
  rings(rng, mask, colors) {
    const cx = rng.range(4, 18), cy = rng.range(0, 10), w = rng.range(2.2, 3.4), off = rng.int(0, 7);
    return mask.map((row, r) => row.map((v, c) => v
      ? colors[(Math.floor(Math.hypot(cellX(r, c) - cx, cellY(r) - cy) / w) + off) % colors.length] : 0));
  },
  patches(rng, mask, colors) {
    const bw = rng.range(3.5, 5.5), bh = rng.int(1, 2);
    const map = new Map();
    return mask.map((row, r) => row.map((v, c) => {
      if (!v) return 0;
      const k = Math.floor(cellX(r, c) / bw) * 100 + Math.floor(r / bh);
      if (!map.has(k)) map.set(k, rng.pick(colors));
      return map.get(k);
    }));
  },
  mirror(rng, mask, colors, n) {
    const base = STRATEGIES.clusters(rng, mask, colors, n);
    return base.map((row, r) => row.map((v, c) => {
      if (!mask[r][c]) return 0;
      const mc = row.length - 1 - c;
      if (c > mc && mask[r][mc]) return row[mc];
      return v;
    }));
  },
};
const STRATEGY_NAMES = Object.keys(STRATEGIES);

/**
 * Teilt zu grosse gleichfarbige Gruppen auf (sonst räumt ein einziger Schuss das halbe Feld ab).
 * Einzelne Zellen der Gruppe bekommen eine Farbe, die zu keinem Nachbarn passt.
 */
export function limitGroups(rng, cells, colors, maxGroup) {
  const b = new Board(cells);
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    const seen = new Set();
    for (const o of b.occupied()) {
      const k = o.r * 16 + o.c;
      if (seen.has(k) || !isColor(o.v)) continue;
      const grp = b.group(o.r, o.c);
      for (const [r, c] of grp) seen.add(r * 16 + c);
      if (grp.length <= maxGroup) continue;
      const cand = rng.shuffle(grp.slice());
      const cuts = Math.max(1, Math.floor(grp.length / (maxGroup + 1)));
      for (const [r, c] of cand.slice(0, cuts)) {
        const v = b.get(r, c);
        const nb = new Set(b.neighbors(r, c).map(([rr, cc]) => b.get(rr, cc) & 15));
        const opts = colors.filter((col) => !nb.has(col) && col !== (v & 15));
        const alt = opts.length ? rng.pick(opts) : rng.pick(colors.filter((col) => col !== (v & 15)));
        if (alt) { b.rows[r][c] = alt | (v & ~15); changed = true; }
      }
    }
    if (!changed) break;
  }
  return b.rows;
}

function addNoise(rng, cells, colors, p) {
  for (const row of cells) {
    for (let c = 0; c < row.length; c++) if (row[c] && rng.chance(p)) row[c] = rng.pick(colors);
  }
}

// ---------- Schüsse & Sterne ----------

/**
 * Schussbudget: Der Computer-Spieler (core/solver.js) spielt das Level einmal durch.
 * Seine Schusszahl («par») ist die Grundlage; Menschen bekommen deutlich mehr Spielraum,
 * am Anfang besonders viel. 3 Sterne gibt es, wenn man nicht viel mehr als «par» braucht.
 */
export function shotBudget(par, n) {
  const f = n <= 20 ? 2.1 : n <= 60 ? 1.9 : n <= 150 ? 1.75 : 1.6;
  const a = n <= 20 ? 6 : n <= 60 ? 5 : 4;
  return Math.max(12, Math.round(par * f + a));
}

/** Mindestens so viele Schüsse übrig für 2 bzw. 3 Sterne. */
export function starThresholds(shots, par) {
  const s3 = Math.max(2, shots - Math.round(par * 1.3 + 2));
  const s2 = Math.max(1, Math.min(s3 - 1, Math.round(s3 / 2)));
  return [s2, s3];
}

/** Höchstens so viele Schüsse soll der Computer-Spieler brauchen (sonst wird das Level gekürzt). */
export function parCap(n) {
  return n <= 20 ? 30 : Math.min(42, 18 + Math.floor(n / 12));
}

/** Schusszahl des Computer-Spielers (mit gleichen Farben wie im echten Spiel). */
export function computePar(def) {
  const g = Game.newLevel({ ...def, shots: 999, stars: [1, 2] });
  autoPlay(g, { step: 1, maxShots: 150 });
  return g.status === 'won' ? g.shotsUsed : 60;
}

function finish(def) {
  const b = new Board(def.rows);
  b.trim();
  def.rows = b.rows;
  const present = b.colorsPresent();
  def.colors = present.length ? present : def.colors;
  def.par = computePar(def);
  // Zu lange Level werden unten gekürzt (bleibt deterministisch).
  for (let k = 0; k < 4 && !def.handmade && def.par > parCap(def.n) && b.rows.length > 4; k++) {
    b.rows.length -= 2;
    for (const [r, c] of b.floating()) b.rows[r][c] = 0;
    b.trim();
    def.rows = b.rows;
    def.par = computePar(def);
  }
  if (def.goal === 'pets' && !b.petCount()) def.goal = 'clear';
  if (!def.shots) def.shots = shotBudget(def.par, def.n);
  def.stars = starThresholds(def.shots, Math.min(def.par, def.shots));
  return def;
}

function handmade(n, world) {
  const src = LEVELS[n - 1];
  const pets = src.pets && src.pets.length ? src.pets.slice() : world.pets.slice();
  const def = {
    n,
    name: src.name,
    world: world.index,
    worldName: world.name,
    sky: world.sky,
    goal: src.goal === 'pets' ? 'pets' : 'clear',
    colors: [],
    rows: parseRows(src.rows, pets.length),
    shift: 0,
    pets,
    shots: src.shots || 0,
    seed: 0,
    handmade: true,
  };
  return finish(def);
}

function generated(n, world) {
  const rng = new Rng(`bubbles-level-${n}`);
  const i = (n - 1) % LEVELS_PER_WORLD;
  const breather = i % 10 === 9 && i !== 19; // kleine Verschnaufpause
  let numColors = n < 45 ? 4 : n < 120 ? 5 : 6;
  if (breather) numColors--;
  if (i === 19) numColors = Math.min(6, numColors + 1); // Abschluss-Level der Welt
  const pool = world.colors.slice(0, Math.max(numColors + 1, 6));
  const colors = rng.shuffle(pool.slice()).slice(0, numColors);

  const hBase = Math.min(10, 6 + Math.floor(n / 30));
  const h = Math.max(5, Math.min(12, hBase + rng.int(-1, 1) + (i === 19 ? 1 : 0)));
  const mask = pickShape(rng, n, h);
  const strategy = rng.pick(STRATEGY_NAMES);
  const cells = STRATEGIES[strategy](rng, mask, colors, n);
  addNoise(rng, cells, colors, Math.min(0.22, 0.04 + n / 1200));
  const maxGroup = n < 60 ? 7 : 6;
  const limited = limitGroups(rng, cells, colors, maxGroup);
  for (let r = 0; r < cells.length; r++) cells[r] = limited[r];

  // Tierchen befreien: 6 von 20 Leveln je Welt
  const goal = i % 3 === 2 && i !== 19 ? 'pets' : 'clear';
  const pets = world.pets.slice();
  const petCells = new Set();
  if (goal === 'pets') {
    const want = Math.min(6, 3 + rng.int(0, 1) + (n > 80 ? 1 : 0) + (n > 160 ? 1 : 0));
    const cand = [];
    cells.forEach((row, r) => row.forEach((v, c) => { if (v && r <= 2) cand.push([r, c]); }));
    rng.shuffle(cand);
    // über die Breite verteilen
    cand.sort((p, q) => Math.floor(cellX(p[0], p[1]) / 4.4) - Math.floor(cellX(q[0], q[1]) / 4.4));
    const used = new Set();
    let k = 0;
    for (const [r, c] of cand) {
      if (k >= want) break;
      const bin = Math.floor(cellX(r, c) / (22 / want));
      if (used.has(bin)) continue;
      used.add(bin);
      cells[r][c] = cells[r][c] | ((1 + (k % pets.length)) << 4);
      petCells.add(r * 16 + c);
      k++;
    }
    for (const [r, c] of cand) {
      if (k >= Math.min(want, 3)) break;
      if (petCells.has(r * 16 + c)) continue;
      cells[r][c] = cells[r][c] | ((1 + (k % pets.length)) << 4);
      petCells.add(r * 16 + c);
      k++;
    }
  }

  // Steine ab Level 26
  if (n >= 26 && rng.chance(Math.min(0.6, 0.3 + n / 400))) {
    const count = Math.min(9, rng.int(2, 3 + Math.floor(n / 50)));
    const cand = [];
    cells.forEach((row, r) => row.forEach((v, c) => { if (v && r >= 1 && !petCells.has(r * 16 + c)) cand.push([r, c]); }));
    rng.shuffle(cand);
    for (const [r, c] of cand.slice(0, count)) cells[r][c] = STONE;
  }

  const def = {
    n,
    name: `${world.name} ${i + 1}`,
    world: world.index,
    worldName: world.name,
    sky: world.sky,
    goal,
    colors,
    rows: cells,
    shift: 0,
    pets,
    shots: 0,
    seed: rng.int(1, 1e9),
    handmade: false,
    shape: strategy,
  };
  // Sicherheit: ein «Befreien»-Level ohne Tierchen wird zum «Abräumen»-Level
  if (goal === 'pets' && !new Board(cells).petCount()) def.goal = 'clear';
  return finish(def);
}

const cache = new Map();

/** Level n (1-basiert). Deterministisch – gleiches n ergibt immer dasselbe Level. */
export function getLevel(n) {
  n = Math.max(1, Math.floor(Number(n) || 1));
  if (cache.has(n)) return structuredCloneDef(cache.get(n));
  const world = worldInfo(Math.floor((n - 1) / LEVELS_PER_WORLD));
  const def = n <= LEVELS.length ? handmade(n, world) : generated(n, world);
  cache.set(n, def);
  if (cache.size > 64) cache.delete(cache.keys().next().value);
  return structuredCloneDef(def);
}

function structuredCloneDef(def) {
  return { ...def, rows: def.rows.map((r) => r.slice()), colors: def.colors.slice(), pets: def.pets.slice(), stars: def.stars.slice() };
}

export function worldOfLevel(n) {
  return worldInfo(Math.floor((n - 1) / LEVELS_PER_WORLD));
}

export { isColor, petOf };
