// Juwelen – Level: die ersten 20 sind handgemacht (data/levels.js), alle weiteren werden
// deterministisch aus der Levelnummer erzeugt (endlos). Kein DOM – node-testbar.

import { levels as handmade } from './data/levels.js';
import { shapes } from './data/shapes.js';
import { worlds } from './data/worlds.js';
import { parseLevel, Rng } from './engine.js';
import { measure, starsFrom, scoreAfter } from './solver.js';
import { hashString } from '../shared/rng.js';

export const PER_WORLD = 15;
export const HANDMADE = handmade.length;
/** So viele Level zeigt die Karte mindestens (danach geht es endlos weiter). */
export const MIN_LEVELS = 150;

export function worldIndex(n) { return Math.floor((n - 1) / PER_WORLD); }

const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

export function worldInfo(k) {
  const t = worlds[k % worlds.length];
  const cycle = Math.floor(k / worlds.length) + 1;
  return { ...t, index: k, title: t.name + (ROMAN[cycle] ?? ` ${cycle}`), first: k * PER_WORLD + 1, last: (k + 1) * PER_WORLD };
}

// ---------------------------------------------------------------------------
// Prüfungen für Brettformen
// ---------------------------------------------------------------------------

/** Prüft, ob jede spielbare, steinfreie Zelle von oben (senkrecht oder schräg) befüllt werden kann. */
export function fillable(w, h, mask, stone) {
  const fed = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (!mask[i] || stone[i]) continue;
      let rr = r - 1;
      while (rr >= 0 && !mask[rr * w + c]) rr--;
      if (rr < 0) { fed[i] = 1; continue; }
      const j = rr * w + c;
      if (!stone[j] && fed[j]) { fed[i] = 1; continue; }
      for (const dc of [-1, 1]) {
        const cc = c + dc;
        if (r < 1 || cc < 0 || cc >= w) continue;
        const k = (r - 1) * w + cc;
        if (mask[k] && !stone[k] && fed[k]) { fed[i] = 1; break; }
      }
    }
  }
  for (let i = 0; i < w * h; i++) if (mask[i] && !stone[i] && !fed[i]) return false;
  return true;
}

/** Jede Zelle muss Teil einer möglichen Dreierreihe sein; das Brett muss zusammenhängen. */
export function shapeOk(w, h, mask) {
  const at = (r, c) => r >= 0 && r < h && c >= 0 && c < w && mask[r * w + c];
  let count = 0, first = -1;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!at(r, c)) continue;
      count++;
      if (first < 0) first = r * w + c;
      const hr = (at(r, c - 2) && at(r, c - 1)) || (at(r, c - 1) && at(r, c + 1)) || (at(r, c + 1) && at(r, c + 2));
      const vr = (at(r - 2, c) && at(r - 1, c)) || (at(r - 1, c) && at(r + 1, c)) || (at(r + 1, c) && at(r + 2, c));
      if (!hr && !vr) return false;
    }
  }
  if (count < 30) return false;
  const seen = new Uint8Array(w * h);
  const st = [first];
  seen[first] = 1;
  let n = 0;
  while (st.length) {
    const i = st.pop();
    n++;
    const r = (i / w) | 0, c = i % w;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (at(r + dr, c + dc) && !seen[(r + dr) * w + c + dc]) { seen[(r + dr) * w + c + dc] = 1; st.push((r + dr) * w + c + dc); }
    }
  }
  return n === count;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

function pickWeighted(rng, list) {
  let sum = 0;
  for (const x of list) sum += x.w;
  let t = rng.next() * sum;
  for (const x of list) { t -= x.w; if (t <= 0) return x; }
  return list[list.length - 1];
}

/** Muster für Eis (liefert Schichten 0..2 pro Zelle). */
const ICE_PATTERNS = {
  all: (r, c, g) => 1 + (g.thick && g.inner(r, c) ? 1 : 0),
  center: (r, c, g) => (Math.abs(r - g.cy) <= g.ry && Math.abs(c - g.cx) <= g.rx ? 1 + (g.thick && Math.abs(r - g.cy) <= g.ry - 1 && Math.abs(c - g.cx) <= g.rx - 1 ? 1 : 0) : 0),
  frame: (r, c, g) => (g.edge(r, c) ? 1 + (g.thick ? 1 : 0) : 0),
  stripes: (r, c, g) => ((r + g.off) % 3 === 0 ? 1 + (g.thick ? 1 : 0) : 0),
  columns: (r, c, g) => (Math.abs(c - g.cx) % 3 === 1 ? 1 + (g.thick ? 1 : 0) : 0),
  checker: (r, c) => ((r + c) % 2 === 0 ? 1 : 0),
  diamond: (r, c, g) => (Math.abs(r - g.cy) + Math.abs(c - g.cx) <= g.rr ? 1 + (g.thick && Math.abs(r - g.cy) + Math.abs(c - g.cx) <= g.rr - 2 ? 1 : 0) : 0),
  bottom: (r, c, g) => (r >= g.h - g.k ? 1 + (g.thick && r >= g.h - 1 ? 1 : 0) : 0),
  cross: (r, c, g) => (Math.abs(r - g.cy) <= 0.5 || Math.abs(c - g.cx) <= 0.5 ? 1 + (g.thick ? 1 : 0) : 0),
  corners: (r, c, g) => ((r < 3 || r >= g.h - 3) && (c < 3 || c >= g.w - 3) ? 1 + (g.thick ? 1 : 0) : 0),
  xshape: (r, c, g) => (Math.abs((r - g.cy) - (c - g.cx)) <= 0.5 || Math.abs((r - g.cy) + (c - g.cx)) <= 0.5 ? 1 + (g.thick ? 1 : 0) : 0),
  blobs: (r, c, g) => g.blob[r * g.w + Math.min(c, g.w - 1 - c)] || 0,
};

/** Muster für Steine (1 = Stein). */
const STONE_PATTERNS = {
  gate: (r, c, g) => (r === g.row && c % 3 !== 1 ? 1 : 0),
  pillars: (r, c, g) => ((c === 1 || c === g.w - 2) && r >= g.row - 1 && r <= g.row + 1 ? 1 : 0),
  scatter: (r, c, g) => g.blob[r * g.w + Math.min(c, g.w - 1 - c)] || 0,
  center: (r, c, g) => (Math.abs(r - g.cy) + Math.abs(c - g.cx) <= 1 ? 1 : 0),
  ring: (r, c, g) => { const d = Math.abs(r - g.cy) + Math.abs(c - g.cx); return d === 2 && (r + c) % 2 === 0 ? 1 : 0; },
  bottom: (r, c, g) => (r === g.h - 2 && c % 2 === 1 ? 1 : 0),
  corners: (r, c, g) => ((r === 1 || r === g.h - 2) && (c === 1 || c === g.w - 2) ? 1 : 0),
  diagonal: (r, c, g) => ((r - c === 1 || r + c === g.w - 1 + 1) && r > 1 && r < g.h - 1 && c % 2 === 0 ? 1 : 0),
};

/** Schwierigkeit 0..1 – steigt über die Welten, innerhalb einer Welt sägezahnartig. */
export function difficulty(n) {
  const w = worldIndex(n);
  const pos = (n - 1) % PER_WORLD;
  const cyc = Math.min(1, w / 9);
  let d = 0.12 + 0.48 * cyc + 0.3 * (pos / (PER_WORLD - 1));
  if (pos === 0 || pos === 7) d -= 0.18;              // Verschnaufpause
  if (pos === PER_WORLD - 1) d += 0.08;               // Abschluss der Welt
  return Math.max(0.05, Math.min(1, d));
}

/** Grundgerüst eines erzeugten Levels (ohne Zuglimit). */
function genStructure(n, variant = 0) {
  const rng = new Rng(hashString(`juwelen-gen-${n}-${variant}`));
  const diff = difficulty(n);
  const pos = (n - 1) % PER_WORLD;
  const breather = pos === 0 || pos === 7;

  // Form
  const pool = shapes.filter((s) => s.from <= n);
  const shape = pool[rng.int(pool.length)];
  let rows = shape.map.slice();
  if (rng.next() < 0.3) rows = rows.slice().reverse();
  const h = rows.length, w = rows[0].length;
  const mask = [];
  for (const row of rows) for (const ch of row) mask.push(ch === '-' ? 0 : 1);
  const cells = mask.reduce((a, b) => a + b, 0);

  // Ziele
  const types = [
    { t: 'score', w: 0.6 },
    { t: 'color', w: 2.2 },
    { t: 'ice', w: 2.6 },
    { t: 'item', w: 1.6 },
    { t: 'stone', w: 1.8 },
  ];
  const primary = pickWeighted(rng, types).t;
  const goalTypes = [primary];
  if (!breather && primary !== 'score' && rng.next() < 0.15 + 0.35 * Math.min(1, worldIndex(n) / 6)) {
    const rest = types.filter((x) => x.t !== primary && x.t !== 'score');
    goalTypes.push(pickWeighted(rng, rest).t);
  }

  const colors = !breather && diff > 0.45 && goalTypes.length === 1 && rng.next() < 0.35 ? 6 : 5;

  const ice = new Array(w * h).fill(0);
  const stone = new Array(w * h).fill(0);
  const items = [];
  const geo = {
    w, h, cx: (w - 1) / 2, cy: (h - 1) / 2,
    rx: 1 + rng.int(Math.max(1, Math.floor(w / 2) - 1)),
    ry: 1 + rng.int(Math.max(1, Math.floor(h / 2) - 1)),
    rr: 2 + rng.int(3),
    off: rng.int(3), k: 2 + rng.int(3),
    row: 2 + rng.int(Math.max(1, h - 5)),
    thick: rng.next() < diff * 0.9,
    inner: (r, c) => Math.abs(r - (h - 1) / 2) <= 1.5 && Math.abs(c - (w - 1) / 2) <= 1.5,
    edge: (r, c) => {
      const at = (rr, cc) => rr >= 0 && rr < h && cc >= 0 && cc < w && mask[rr * w + cc];
      return !at(r - 1, c) || !at(r + 1, c) || !at(r, c - 1) || !at(r, c + 1);
    },
    blob: null,
  };
  const half = () => {
    const b = new Array(w * h).fill(0);
    const k = 3 + rng.int(5);
    for (let q = 0; q < k; q++) {
      const r = rng.int(h), c = rng.int(Math.ceil(w / 2));
      b[r * w + c] = 1 + (geo.thick && rng.next() < 0.5 ? 1 : 0);
      if (rng.next() < 0.6 && r + 1 < h) b[(r + 1) * w + c] = 1;
    }
    return b;
  };

  const goals = [];
  for (const t of goalTypes) {
    if (t === 'ice') {
      let best = null;
      const names = Object.keys(ICE_PATTERNS);
      for (let attempt = 0; attempt < 12; attempt++) {
        const name = names[rng.int(names.length)];
        geo.blob = half();
        const lay = mask.map((m, i) => (m && !stone[i] ? Math.min(2, ICE_PATTERNS[name](Math.floor(i / w), i % w, geo)) : 0));
        const count = lay.filter((x) => x > 0).length;
        if (count >= 8 && count <= cells * 0.85) { best = lay; break; }
      }
      if (!best) best = mask.map((m, i) => (m && (i % w) % 2 === 0 ? 1 : 0));
      best.forEach((x, i) => { if (!stone[i]) ice[i] = x; });
      goals.push({ type: 'ice' });
    } else if (t === 'stone') {
      let ok = false;
      const names = Object.keys(STONE_PATTERNS);
      for (let attempt = 0; attempt < 30 && !ok; attempt++) {
        const a = names[rng.int(names.length)], b = names[rng.int(names.length)];
        geo.blob = half();
        geo.row = 2 + rng.int(Math.max(1, h - 5));
        const hard = rng.next() < 0.2 + diff * 0.7;
        const st = mask.map((m, i) => {
          const r = Math.floor(i / w), c = i % w;
          return m && (STONE_PATTERNS[a](r, c, geo) || (attempt < 20 && STONE_PATTERNS[b](r, c, geo))) ? (hard && rng.next() < 0.6 ? 2 : 1) : 0;
        });
        const count = st.filter((x) => x > 0).length;
        if (count < 7 || count > 20) continue;
        if (!fillable(w, h, mask, st)) continue;
        st.forEach((x, i) => { stone[i] = x; if (x) ice[i] = 0; });
        ok = true;
      }
      if (!ok) {
        const r = Math.floor(h / 2);
        for (const c of [1, 4, w - 2]) if (mask[r * w + c]) stone[r * w + c] = 1;
      }
      goals.push({ type: 'stone' });
    } else if (t === 'item') {
      const total = 2 + Math.round(diff * 3.5) + (rng.next() < 0.3 ? 1 : 0);
      const start = Math.min(2, total - 1);
      const cols = [];
      for (let c = 0; c < w; c++) if (mask[c] && !stone[c]) cols.push(c);
      rng.shuffle(cols);
      for (let k = 0; k < start && k < cols.length; k++) items.push(cols[k]);
      goals.push({ type: 'item', n: total });
    } else if (t === 'color') {
      const k = diff > 0.35 && rng.next() < 0.55 ? (diff > 0.7 && rng.next() < 0.35 ? 3 : 2) : 1;
      const pick = rng.shuffle([...Array(colors).keys()]).slice(0, k);
      for (const color of pick) goals.push({ type: 'color', color, n: Math.round((22 + diff * 30 + rng.int(10)) / 5) * 5 });
    } else if (t === 'score') {
      goals.push({ type: 'score', n: 0 });
    }
  }

  const map = [];
  for (let r = 0; r < h; r++) {
    let s = '';
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (!mask[i]) s += '-';
      else if (stone[i]) s += stone[i] === 2 ? 'S' : 's';
      else if (items.includes(i)) s += 'a';
      else if (ice[i]) s += ice[i] === 2 ? 'I' : 'i';
      else s += '.';
    }
    map.push(s);
  }
  const itemGoal = goals.find((g) => g.type === 'item');
  return {
    map, colors, goals, shape: shape.id, diff,
    itemsMax: itemGoal && itemGoal.n >= 5 ? 3 : 2,
    scoreMoves: 15 + rng.int(9),
  };
}

/** Zuschlag auf die Bot-Züge: leichte Level grosszügig, schwere knapper. */
export function slack(diff) { return 1.6 - 0.35 * diff; }

/** Erzeugtes Level inkl. Kalibrierung durch den Bot. */
function genLevel(n) {
  let def = null;
  for (let variant = 0; variant < 4; variant++) {
    def = genStructure(n, variant);
    const k = slack(def.diff);
    const L = parseLevel(def, n);
    if (def.goals[0].type === 'score') {
      const moves = def.scoreMoves;
      const target = scoreAfter(L, Math.max(6, Math.round(moves / k)));
      def.goals[0].n = Math.max(1000, Math.round(target / 250) * 250);
      def.moves = moves;
      const m = measure(parseLevel(def, n), { runs: 3, cap: moves * 2 });
      def.stars = starsFrom(m.games, moves);
      return def;
    }
    // Ziele so lange anpassen, bis der Bot zwischen ~7 und ~26 Zügen braucht.
    for (let round = 0; round < 4; round++) {
      const m = measure(parseLevel(def, n), { runs: 4, cap: 60 });
      if (m.fails >= 2 || m.need > 27) {
        if (!scaleGoals(def, 0.7)) break;
        continue;
      }
      if (m.need < 7 && round < 3 && scaleGoals(def, 1.45)) continue;
      def.moves = Math.max(12, Math.min(45, Math.round(m.need * k + 3)));
      def.stars = starsFrom(m.games, def.moves);
      return def;
    }
  }
  // Notfall (sollte praktisch nie vorkommen): grosszügig
  def.moves = 40;
  def.stars = [0, 6000, 9000];
  return def;
}

/** Skaliert zählbare Ziele. Liefert false, wenn nichts mehr anpassbar ist. */
function scaleGoals(def, f) {
  let changed = false;
  for (const g of def.goals) {
    if (g.type === 'color') {
      const v = Math.max(10, Math.min(90, Math.round((g.n * f) / 5) * 5));
      if (v !== g.n) { g.n = v; changed = true; }
    } else if (g.type === 'item') {
      const v = Math.max(1, Math.min(8, Math.round(g.n * f)));
      if (v !== g.n) { g.n = v; changed = true; }
    }
  }
  // Eis und Steine: dicker bzw. dünner machen
  const m2 = f < 1
    ? def.map.map((row) => row.replace(/I/g, 'i').replace(/S/g, 's'))
    : def.map.map((row, r) => [...row].map((ch, c) => (ch === 's' ? 'S' : ch === 'i' && (r + c) % 2 === 0 ? 'I' : ch)).join(''));
  if (m2.join() !== def.map.join()) { def.map = m2; changed = true; }
  return changed;
}

/** Rohbeschreibung eines Levels (gleiches Format wie data/levels.js). */
export function levelDef(n) {
  n = Math.max(1, Math.floor(n));
  if (n <= HANDMADE) return { ...handmade[n - 1] };
  return genLevel(n);
}

const cache = new Map();
let persist = null;
/** Optionaler Zwischenspeicher (z.B. localStorage), damit die Kalibrierung nur einmal läuft. */
export function setLevelStore(p) { persist = p; }
const VERSION = 8;

/** Spielbereites Level n (1, 2, 3, …). */
export function getLevel(n) {
  n = Math.max(1, Math.floor(n));
  if (cache.has(n)) return cache.get(n);
  let def = persist && persist.get(`${VERSION}:${n}`);
  if (!def || !Array.isArray(def.map)) {
    def = levelDef(n);
    if (!def.stars) {
      const m = measure(parseLevel(def, n), { runs: 4, cap: 60 });
      def.stars = starsFrom(m.games, def.moves);
    }
    if (persist) persist.set(`${VERSION}:${n}`, def);
  }
  const L = parseLevel(def, n);
  L.world = worldIndex(n);
  if (cache.size > 40) cache.clear();
  cache.set(n, L);
  return L;
}

/** Welche Elemente kommen in Level n vor? (für die «Neu»-Hinweise) */
export function features(L) {
  return {
    ice: L.ice.some((x) => x > 0),
    stone: L.stone.some((x) => x > 0),
    item: L.goals.some((g) => g.type === 'item'),
  };
}
