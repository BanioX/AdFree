// Level-Generator für Dreierlei (ohne DOM, deterministisch per Seed).
//
// 1. Grundform (data/shapes.js) wählen und daraus Ebenen bauen
//    (versetzt um halbe Steine, nach innen geschrumpft, Türmchen …).
// 2. Auf die gewünschte Steinzahl (Vielfaches von 3) kürzen – symmetrisch, von oben.
// 3. Lösbarkeit per Konstruktion: zufällige Abräum-Reihenfolge erzeugen und die Bilder so
//    verteilen, dass diese Reihenfolge nie mehr als `cap` Steine in der Ablage braucht.
// 4. Die Reihenfolge wird mit den echten Regeln nachgespielt (Gewinn-Nachweis).

import { makeRng, hashString } from '../../shared/rng.js';
import { themes, themeById } from '../data/themes.js';
import { shapes, shapeById } from '../data/shapes.js';
import { coverGraph } from './board.js';
import { simulate } from './rules.js';

export const STYLES = ['pyramide', 'versatz', 'stufen', 'turm', 'wechsel'];

export const SIZES = {
  klein: { title: 'Klein', tiles: 36, layers: 3, kinds: 6, cap: 4 },
  mittel: { title: 'Mittel', tiles: 66, layers: 5, kinds: 9, cap: 5 },
  gross: { title: 'Gross', tiles: 105, layers: 6, kinds: 12, cap: 5 },
  riesig: { title: 'Riesig', tiles: 141, layers: 7, kinds: 15, cap: 6 },
};

const round3 = (v) => Math.max(9, Math.round(v / 3) * 3);

/** Parameter eines Levels der Level-Reihe (unendlich). */
export function levelParams(levelNo) {
  const L = Math.max(1, Math.floor(levelNo) || 1);
  const early = [
    null,
    { tiles: 24, layers: 2, kinds: 4, cap: 3 },
    { tiles: 30, layers: 3, kinds: 5, cap: 3 },
    { tiles: 36, layers: 3, kinds: 5, cap: 4 },
    { tiles: 42, layers: 4, kinds: 6, cap: 4 },
    { tiles: 39, layers: 3, kinds: 6, cap: 4, tag: 'pause' },
    { tiles: 48, layers: 4, kinds: 7, cap: 4 },
    { tiles: 54, layers: 4, kinds: 7, cap: 5 },
    { tiles: 60, layers: 5, kinds: 8, cap: 5 },
  ];
  if (L < early.length) return { ...early[L], tag: early[L].tag || null };
  let tiles = Math.min(126, 60 + (L - 8) * 3.5);
  let layers = L < 12 ? 5 : L < 20 ? 6 : 7;
  let kinds = Math.min(16, 8 + Math.floor((L - 8) / 3));
  let cap = L < 15 ? 5 : 6;
  let tag = null;
  if (L % 10 === 0) { tiles = Math.min(141, tiles * 1.15); layers += 1; tag = 'gross'; }
  else if (L % 5 === 0) { tiles *= 0.75; cap -= 1; tag = 'pause'; }
  tiles = round3(tiles);
  kinds = Math.max(4, Math.min(kinds, Math.floor(tiles / 6)));
  return { tiles, layers, kinds, cap, tag };
}

/** Thema eines Levels: erste Runde in fester Reihenfolge, danach gemischt pro Runde. */
export function themeForLevel(levelNo) {
  const T = themes.length;
  const i = Math.max(0, levelNo - 1);
  const cycle = Math.floor(i / T);
  if (cycle === 0) return themes[i % T];
  const perm = makeRng(`triple-themes-${cycle}`).shuffle(themes.slice());
  // Übergang zwischen zwei Runden: nicht zweimal dasselbe Thema hintereinander
  const prevLast = cycle === 1 ? themes[T - 1] : makeRng(`triple-themes-${cycle - 1}`).shuffle(themes.slice())[T - 1];
  if (perm[0] === prevLast) { const t = perm[0]; perm[0] = perm[1]; perm[1] = t; }
  return perm[i % T];
}

// ---------- Formen → Ebenen ----------

function parseMask(shape) {
  const rows = shape.rows;
  return rows.map((r) => Array.from(r, (ch) => ch === '#'));
}

function erode(mask) {
  const R = mask.length, C = mask[0].length;
  const at = (r, c) => r >= 0 && r < R && c >= 0 && c < C && mask[r][c];
  return mask.map((row, r) => row.map((v, c) => v && at(r - 1, c) && at(r + 1, c) && at(r, c - 1) && at(r, c + 1)));
}

function erodedList(mask, max) {
  const out = [mask];
  for (let i = 1; i <= max; i++) out.push(erode(out[i - 1]));
  return out;
}

function layerPositions(maskE, ox, oy, filter) {
  const R = maskE.length, C = maskE[0].length;
  const out = [];
  for (let r = 0; r + (oy ? 1 : 0) < R; r++) {
    for (let c = 0; c + (ox ? 1 : 0) < C; c++) {
      let ok = true;
      for (let dr = 0; dr <= (oy ? 1 : 0) && ok; dr++) {
        for (let dc = 0; dc <= (ox ? 1 : 0) && ok; dc++) if (!maskE[r + dr][c + dc]) ok = false;
      }
      if (!ok) continue;
      if (filter === 'checker' && (c + r) % 2 !== 0) continue;
      if (filter === 'alt' && (c + r) % 2 !== 1) continue;
      out.push({ x: c + (ox ? 0.5 : 0), y: r + (oy ? 0.5 : 0) });
    }
  }
  return out;
}

function styleOp(style, i, every) {
  const e = Math.floor(i / every);
  switch (style) {
    case 'versatz': return { ox: i % 2, oy: 0, e, filter: 'all' };
    case 'stufen': return { ox: 0, oy: i % 2, e, filter: 'all' };
    case 'turm': return { ox: 0, oy: 0, e: Math.floor(i / (every + 1)), filter: i % 2 ? 'checker' : (i % 4 === 2 ? 'alt' : 'all') };
    case 'wechsel': return i % 2
      ? { ox: 1, oy: 1, e: Math.floor(i / (every + 1)), filter: 'all' }
      : { ox: 0, oy: 0, e: Math.floor(i / (every + 1)), filter: (i / 2) % 2 ? 'checker' : 'alt' };
    case 'pyramide':
    default: return { ox: i % 2, oy: i % 2, e, filter: 'all' };
  }
}

/** Baut bis zu maxLayers Ebenen aus einer Form. → Array von Positionslisten */
export function buildLayers(shape, style, every, maxLayers) {
  const mask = parseMask(shape);
  const eroded = erodedList(mask, maxLayers);
  const layers = [layerPositions(mask, 0, 0, 'all')];
  for (let i = 1; i < maxLayers; i++) {
    const op = styleOp(style, i, every);
    let pos = layerPositions(eroded[Math.min(op.e, eroded.length - 1)], op.ox, op.oy, op.filter);
    if (pos.length < 3) {
      // Ausweichen: gleiche Schrumpfung, andere Lage – oder eine Stufe weniger geschrumpft
      const tries = [
        [op.e, 1, 1, 'all'], [op.e, 1, 0, 'all'], [op.e, 0, 1, 'all'], [op.e, 0, 0, 'checker'],
        [op.e - 1, 0, 0, 'checker'], [op.e - 1, 1, 0, 'all'], [op.e - 1, 0, 0, 'alt'],
      ];
      for (const [e, ox, oy, f] of tries) {
        if (e < 0) continue;
        const p = layerPositions(eroded[Math.min(e, eroded.length - 1)], ox, oy, f);
        if (p.length >= 3) { pos = p; break; }
      }
    }
    if (pos.length < 3) break;
    layers.push(pos);
  }
  return layers;
}

function cumulative(layers) {
  const out = [];
  let s = 0;
  for (const l of layers) { s += l.length; out.push(s); }
  return out;
}

/** Bewertet, wie gut eine Form/Stil-Kombination zur Zielgrösse passt (kleiner = besser). */
function fitScore(layers, target, wantLayers) {
  const cum = cumulative(layers);
  let k = cum.findIndex((c) => c >= target);
  if (k < 0) return { score: 2 + (target - cum[cum.length - 1]) / target * 3, k: layers.length };
  k += 1; // Anzahl Ebenen
  if (k === 1 && wantLayers > 1) {
    // eine einzige Ebene wäre langweilig: lieber zwei Ebenen und mehr kürzen
    if (layers.length >= 2) k = 2; else return { score: 9, k: 1 };
  }
  const trim = (cum[k - 1] - target) / target;
  const layerPenalty = Math.abs(k - wantLayers) * 0.12;
  return { score: trim + layerPenalty, k };
}

function trimLayers(layers, target, cols, rng) {
  const ls = layers.map((l) => l.slice());
  let total = ls.reduce((a, l) => a + l.length, 0);
  while (total > target && ls.length) {
    const top = ls[ls.length - 1];
    const excess = total - target;
    if (excess >= top.length && ls.length > 1) { total -= top.length; ls.pop(); continue; }
    // Spiegelpaare bilden (Symmetrie um die senkrechte Mittelachse)
    const groups = new Map();
    for (const p of top) {
      const key = Math.min(p.x, cols - 1 - p.x) + ',' + p.y;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const pairs = [], singles = [];
    for (const g of groups.values()) (g.length === 2 ? pairs : singles).push(g);
    rng.shuffle(pairs);
    rng.shuffle(singles);
    let need = Math.min(excess, top.length);
    const remove = new Set();
    for (const g of pairs) { if (need >= 2) { g.forEach((p) => remove.add(p)); need -= 2; } }
    for (const g of singles) { if (need >= 1) { remove.add(g[0]); need -= 1; } }
    if (need > 0) {
      // ungerade Zahl ohne Mittelstein: einen Stein eines Paares nehmen
      for (const p of top) { if (need > 0 && !remove.has(p)) { remove.add(p); need--; } }
    }
    const kept = top.filter((p) => !remove.has(p));
    total -= top.length - kept.length;
    ls[ls.length - 1] = kept;
    if (!kept.length) ls.pop();
  }
  return ls;
}

// ---------- Bilder verteilen (lösbar per Konstruktion) ----------

function randomOrder(n, above, below, rng) {
  const block = above.map((a) => a.length);
  const free = [];
  for (let i = 0; i < n; i++) if (block[i] === 0) free.push(i);
  const order = [];
  while (free.length) {
    const k = Math.floor(rng.next() * free.length);
    const id = free[k];
    free[k] = free[free.length - 1];
    free.pop();
    order.push(id);
    for (const j of below[id]) if (--block[j] === 0) free.push(j);
  }
  return order;
}

/**
 * Ordnet jedem Stein der Reihenfolge eine «Gruppe» (Drilling) zu, so dass beim Abräumen
 * in dieser Reihenfolge nie mehr als cap Steine gleichzeitig in der Ablage liegen.
 */
function assignGroups(order, cap, rng, wNew) {
  const n = order.length;
  const groupOf = new Array(n);
  const open = []; // { g, cnt }
  let G = 0;
  const created = []; // Reihenfolge der Gruppenerzeugung
  for (let idx = 0; idx < n; idx++) {
    const remaining = n - idx;
    let need = 0, occ = 0;
    for (const o of open) { need += 3 - o.cnt; occ += o.cnt; }
    const hasTwo = (list) => list.some((o) => o.cnt === 2);
    const options = [];
    // vervollständigen ist immer erlaubt
    for (const o of open) if (o.cnt === 2) options.push({ type: 'add', o, w: 1.0 });
    for (const o of open) {
      if (o.cnt !== 1) continue;
      if (occ + 1 > cap) continue;
      options.push({ type: 'add', o, w: 0.8 });
    }
    if (need + 3 <= remaining && occ + 1 <= cap) {
      // Neue Gruppe nur, wenn danach weiterhin ein Zug möglich bleibt
      const after = occ + 1;
      if (after < cap || hasTwo(open)) options.push({ type: 'new', w: wNew });
    }
    let pick;
    if (!options.length) {
      // sollte nicht vorkommen – zur Sicherheit die vollste Gruppe ergänzen
      const o = open.slice().sort((a, b) => b.cnt - a.cnt)[0];
      pick = { type: 'add', o };
    } else {
      let sum = 0;
      for (const o of options) sum += o.w;
      let r = rng.next() * sum;
      pick = options[options.length - 1];
      for (const o of options) { r -= o.w; if (r <= 0) { pick = o; break; } }
    }
    if (pick.type === 'new') {
      const o = { g: G++, cnt: 1 };
      open.push(o);
      created.push(o.g);
      groupOf[order[idx]] = o.g;
    } else {
      pick.o.cnt++;
      groupOf[order[idx]] = pick.o.g;
      if (pick.o.cnt === 3) open.splice(open.indexOf(pick.o), 1);
    }
  }
  return { groupOf, groups: G, created };
}

/** Gruppen → Bild-Sorten (jede Sorte etwa gleich oft, gleichzeitig offene Gruppen möglichst verschieden). */
function assignKinds(groupOf, order, groups, kinds, rng) {
  const bag = [];
  for (let g = 0; g < groups; g++) bag.push(g % kinds);
  rng.shuffle(bag);
  const kindOfGroup = new Array(groups).fill(-1);
  const openKinds = new Map(); // kind -> Anzahl offener Gruppen
  const cnt = new Array(groups).fill(0);
  for (const id of order) {
    const g = groupOf[id];
    if (kindOfGroup[g] === -1) {
      let k = bag.findIndex((kind) => !openKinds.get(kind));
      if (k < 0) k = 0;
      kindOfGroup[g] = bag[k];
      bag.splice(k, 1);
      openKinds.set(kindOfGroup[g], (openKinds.get(kindOfGroup[g]) || 0) + 1);
    }
    cnt[g]++;
    if (cnt[g] === 3) openKinds.set(kindOfGroup[g], openKinds.get(kindOfGroup[g]) - 1);
  }
  return kindOfGroup;
}

// ---------- Hauptfunktion ----------

/**
 * opts: { seed (string), tiles, layers, kinds, cap, theme (id), shape (id, optional),
 *         style (optional), shapeOrder (optional: bevorzugte Reihenfolge von Form-ids), levelNo, tag }
 */
export function generate(opts) {
  const seed = String(opts.seed);
  const rng = makeRng(hashString(seed));
  const theme = themeById(opts.theme) || themes[0];
  const target = round3(opts.tiles);
  const wantLayers = opts.layers || 3;
  const maxLayers = Math.min(10, Math.max(wantLayers + 3, 4));

  // --- Form und Stil wählen
  let shapeList = opts.shape && shapeById(opts.shape) ? [shapeById(opts.shape)]
    : (opts.shapeOrder ? opts.shapeOrder.map(shapeById).filter(Boolean) : rng.shuffle(shapes.slice()));
  if (opts.pickIndex != null && shapeList.length > 1) {
    // Reihum mit Schrittweite 7: aufeinanderfolgende Level beginnen die Suche weit auseinander
    const s = (opts.pickIndex * 7) % shapeList.length;
    shapeList = shapeList.slice(s).concat(shapeList.slice(0, s));
  }
  const styleList = opts.style ? [opts.style] : rng.shuffle(STYLES.slice());
  if (!opts.style && wantLayers <= 3) {
    // Am Anfang die schöne Pyramiden-Optik bevorzugen
    styleList.splice(styleList.indexOf('pyramide'), 1);
    styleList.unshift('pyramide');
  }
  // Erste Form (in der Reihenfolge), die mit einem Stil gut zur Zielgrösse passt
  let best = null;
  outer:
  for (const shape of shapeList) {
    for (const style of styleList) {
      for (const every of [2, 3, 4]) {
        const layers = buildLayers(shape, style, every, maxLayers);
        const fit = fitScore(layers, target, wantLayers);
        const cand = { shape, style, every, layers, fit };
        if (!best || fit.score < best.fit.score) best = cand;
        if (fit.score < 0.3) { best = cand; break outer; }
      }
    }
  }
  const { shape, style } = best;
  const cols = shape.rows[0].length;
  let layers = best.layers.slice(0, Math.max(1, best.fit.k));
  const available = layers.reduce((a, l) => a + l.length, 0);
  const total = Math.min(target, Math.floor(available / 3) * 3);
  layers = trimLayers(layers, total, cols, rng);

  // --- Steine
  const tiles = [];
  layers.forEach((l, z) => {
    const sorted = l.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    for (const p of sorted) tiles.push({ x: p.x, y: p.y, z, t: 0 });
  });
  const n = tiles.length;
  const { above, below } = coverGraph(tiles);

  // --- Bilder
  const kinds = Math.max(1, Math.min(opts.kinds || 6, n / 3, theme.emoji.length));
  const symbols = rng.shuffle(theme.emoji.slice()).slice(0, kinds);
  const cap = Math.max(2, Math.min(6, opts.cap || 4));
  const wNew = 0.25 + (cap - 2) * 0.22;
  const order = randomOrder(n, above, below, rng);
  const { groupOf, groups } = assignGroups(order, cap, rng, wNew);
  const kindOfGroup = assignKinds(groupOf, order, groups, kinds, rng);
  for (let i = 0; i < n; i++) tiles[i].t = kindOfGroup[groupOf[i]];

  const level = {
    seed,
    levelNo: opts.levelNo || null,
    tag: opts.tag || null,
    theme: theme.id,
    shape: shape.id,
    style,
    symbols,
    tiles,
    layers: layers.length,
    solution: order,
    params: { tiles: target, layers: wantLayers, kinds, cap },
  };
  // --- Nachweis: die Konstruktions-Reihenfolge gewinnt mit den echten Regeln
  const sim = simulate(level, order);
  level.verified = sim.won;
  return level;
}

/** Level n der Level-Reihe. */
export function generateLevel(levelNo) {
  const L = Math.max(1, Math.floor(levelNo) || 1);
  const p = levelParams(L);
  const theme = themeForLevel(L);
  // Formen reihum, damit aufeinanderfolgende Level verschieden aussehen
  const shapeOrder = makeRng('triple-shapes').shuffle(shapes.map((s) => s.id));
  return generate({ seed: `triple-L${L}`, ...p, theme: theme.id, shapeOrder, pickIndex: L - 1, levelNo: L });
}

/** Freies Spiel: Thema und Grösse frei wählbar, Seed zufällig (vom Aufrufer). */
export function generateFree(themeId, sizeId, seed) {
  const size = SIZES[sizeId] || SIZES.mittel;
  return generate({ seed: `triple-free-${themeId}-${sizeId}-${seed}`, ...size, theme: themeId });
}
