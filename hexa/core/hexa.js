// Wabenstapel – reine Spiellogik (ohne DOM): Brett, Stapel, Zusammenrücken, Abräumen,
// Stapel-Erzeugung, Level-/Endlos-/Tages-Spiele und ein einfacher Bot (für Fairness-Tests und «Tipp»).

import { srng, hashString } from '../../lib/sorting/srng.js';
import { LAYOUTS, layoutById } from '../data/layouts.js';
import { levelParams, ENDLESS, DAILY } from '../data/levels.js';

export const CLEAR_AT = 10;
export const TRAY = 3;

// ---------- Brett ----------

/** Zerlegt eine Brettform in Felder { r, c, stone } und Nachbarlisten (versetzte Reihen, «odd-r»). */
export function parseLayout(layout) {
  const cells = [];
  const at = new Map();
  layout.rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '.' || ch === '#') {
        at.set(r + ',' + c, cells.length);
        cells.push({ r, c, stone: ch === '#' });
      }
    });
  });
  const adj = cells.map(({ r, c }) => {
    const odd = r & 1;
    const offs = odd
      ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
      : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
    const out = [];
    for (const [dr, dc] of offs) {
      const k = at.get((r + dr) + ',' + (c + dc));
      if (k != null && !cells[k].stone) out.push(k);
    }
    return out;
  });
  const rows = layout.rows.length;
  let cols = 0;
  for (const { r, c } of cells) cols = Math.max(cols, c + 1 + (r & 1) * 0.5);
  return { cells, adj, rows, cols, id: layout.id };
}

const geoCache = new Map();
export function geometry(layoutId) {
  if (!geoCache.has(layoutId)) geoCache.set(layoutId, parseLayout(layoutById(layoutId)));
  return geoCache.get(layoutId);
}

export const top = (st) => (st && st.length ? st[st.length - 1] : -1);
export function runLen(st) {
  if (!st || !st.length) return 0;
  const k = st[st.length - 1];
  let n = 0;
  for (let i = st.length - 1; i >= 0 && st[i] === k; i--) n++;
  return n;
}
export const isPure = (st) => st.length > 0 && runLen(st) === st.length;
export function countRuns(st) {
  let n = 0;
  for (let i = 0; i < st.length; i++) if (i === 0 || st[i] !== st[i - 1]) n++;
  return n;
}

/**
 * Lässt ab Feld `start` gleiche Farben zusammenrücken und räumt Läufe ab CLEAR_AT ab.
 * Verändert `stacks` (Array je Feld: Farbliste unten→oben, null = Stein). Gibt Ereignisse zurück:
 *   { t: 'move', from, to, color, n }   n Plättchen wandern von «from» nach «to»
 *   { t: 'clear', cell, color, n }      n Plättchen verschwinden
 * Jede Verschiebung vereinigt zwei Farbläufe – die Kaskade endet also sicher.
 */
export function resolve(stacks, adj, start, clearAt = CLEAR_AT) {
  const events = [];
  const queue = [start];
  let guard = 0;
  while (queue.length && guard++ < 2000) {
    const c = queue.shift();
    const st = stacks[c];
    if (!st || !st.length) continue;
    const k = top(st);
    const match = adj[c].filter((n) => stacks[n] && stacks[n].length && top(stacks[n]) === k);
    if (!match.length) continue;
    let target = c;
    let sources = match;
    // Ein reiner Stapel wandert lieber auf einen gemischten Nachbarn – das macht ein Feld frei.
    if (match.length === 1 && isPure(st) && !isPure(stacks[match[0]])) { target = match[0]; sources = [c]; }
    for (const s of sources) {
      const n = runLen(stacks[s]);
      const moved = stacks[s].splice(stacks[s].length - n, n);
      stacks[target].push(...moved);
      events.push({ t: 'move', from: s, to: target, color: k, n });
    }
    const rl = runLen(stacks[target]);
    if (rl >= clearAt) {
      stacks[target].splice(stacks[target].length - rl, rl);
      events.push({ t: 'clear', cell: target, color: k, n: rl });
    }
    for (const x of [target, ...sources]) if (!queue.includes(x)) queue.push(x);
  }
  return events;
}

export const emptyCells = (stacks) => {
  const out = [];
  stacks.forEach((st, i) => { if (st && st.length === 0) out.push(i); });
  return out;
};

// ---------- Stapel erzeugen ----------

/**
 * Neuer Stapel (unten→oben). opts: { colors, sizes: [w2..w6], runs: [w1, w2, w3], prefer: [farben], preferP }
 */
export function makeStack(rng, { colors, sizes = [3, 4, 4, 2, 1], runs = [4, 4, 2], prefer = [], preferP = 0.5 }) {
  const size = 2 + rng.weighted(sizes);
  const nRuns = Math.min(size, 1 + rng.weighted(runs));
  // Läufe aufteilen (jeder ≥ 1)
  const parts = new Array(nRuns).fill(1);
  for (let i = nRuns; i < size; i++) parts[rng.int(0, nRuns - 1)]++;
  // Farben von oben nach unten wählen, benachbarte verschieden
  const cols = [];
  let first = prefer.length && rng.chance(preferP) ? rng.pick(prefer) : rng.int(0, colors - 1);
  cols.push(first);
  for (let i = 1; i < nRuns; i++) {
    let k;
    do { k = rng.int(0, colors - 1); } while (k === cols[i - 1] && colors > 1);
    cols.push(k);
  }
  // cols[0] ist die oberste Farbe → von unten nach oben zusammensetzen
  const st = [];
  for (let i = nRuns - 1; i >= 0; i--) for (let j = 0; j < parts[i]; j++) st.push(cols[i]);
  return st;
}

function boardTops(stacks) {
  const s = new Set();
  for (const st of stacks) if (st && st.length) s.add(top(st));
  return [...s];
}

// ---------- Spiel ----------

/**
 * Neues Spiel. kind: 'level' | 'endless' | 'daily'
 * Rückgabe ist ein reines, JSON-fähiges Objekt.
 */
export function newGame(kind, arg) {
  let p;
  if (kind === 'level') p = levelParams(arg);
  else if (kind === 'daily') p = DAILY(arg);
  else p = ENDLESS(arg);
  if (kind === 'endless') return build(kind, arg, p, p.seed);
  // Level und Tagesbrett: erst nehmen, wenn der Bot das Ziel damit erreicht (fair). Sonst nächste Variante.
  let first = null;
  for (let v = 0; v < 8; v++) {
    const g = build(kind, arg, p, v ? p.seed + '-' + v : p.seed);
    if (!first) first = g;
    if (botPlay(clone(g)).won) { g.variant = v; return g; }
  }
  return first;
}

function build(kind, arg, p, seed) {
  const geo = geometry(p.layout);
  const rng = srng(typeof seed === 'string' ? hashString(seed) : seed);
  const stacks = geo.cells.map((c) => (c.stone ? null : []));
  // Vorbelegung ohne sofortige Treffer
  const free = emptyCells(stacks);
  rng.shuffle(free);
  let placed = 0;
  for (const i of free) {
    if (placed >= (p.prefill || 0)) break;
    const used = new Set(geo.adj[i].map((n) => top(stacks[n])).filter((k) => k >= 0));
    let st = null;
    for (let t = 0; t < 12; t++) {
      const cand = makeStack(rng, { colors: p.colors, sizes: [3, 3, 2, 0, 0], runs: [3, 4, 2] });
      if (!used.has(top(cand))) { st = cand; break; }
    }
    if (!st) continue;
    stacks[i] = st;
    placed++;
  }
  const g = {
    v: 1, kind, arg: arg ?? null, layout: p.layout, colors: p.colors, goal: p.goal || 0,
    special: !!p.special, name: p.name || '',
    stacks, tray: [], rng: rng.state, cleared: 0, score: 0, placed: 0, helpers: 0,
    combo: 0, bestCombo: 0, over: false, won: false,
    gen: { sizes: p.sizes, runs: p.runs, preferP: p.preferP },
  };
  refillTray(g);
  return g;
}

/** Farbanzahl im Endlos-Modus wächst mit dem Fortschritt (bis 7). */
export function colorsNow(g) {
  if (g.kind !== 'endless') return g.colors;
  return Math.min(7, g.colors + Math.floor(g.cleared / 120));
}
function preferNow(g) {
  if (g.kind !== 'endless') return g.gen.preferP;
  return Math.max(0.3, g.gen.preferP - g.cleared / 1200);
}

export function refillTray(g) {
  const rng = srng(0);
  rng.state = g.rng;
  const prefer = boardTops(g.stacks);
  g.tray = [];
  for (let i = 0; i < TRAY; i++) {
    g.tray.push(makeStack(rng, { colors: colorsNow(g), sizes: g.gen.sizes, runs: g.gen.runs, prefer, preferP: preferNow(g) }));
  }
  g.rng = rng.state;
}

export const clone = (g) => JSON.parse(JSON.stringify(g));

/**
 * Setzt Ablage-Stapel `ti` auf Feld `cell`. Verändert g, gibt Ereignisse zurück (oder null, wenn ungültig).
 * Danach: Ablage nachfüllen, Sieg/Ende prüfen.
 */
export function place(g, ti, cell) {
  const geo = geometry(g.layout);
  if (g.over || g.won) return null;
  const st = g.tray[ti];
  if (!st || !g.stacks[cell] || g.stacks[cell].length) return null;
  g.stacks[cell] = st.slice();
  g.tray[ti] = null;
  g.placed++;
  const events = resolve(g.stacks, geo.adj, cell);
  let gained = 0;
  let clears = 0;
  for (const e of events) if (e.t === 'clear') { gained += e.n; clears++; }
  g.cleared += gained;
  g.combo = clears ? g.combo + clears : 0;
  g.bestCombo = Math.max(g.bestCombo, g.combo);
  g.score += gained * (1 + Math.max(0, clears - 1) * 0.5) | 0;
  if (g.tray.every((t) => !t)) refillTray(g);
  if (g.goal && g.cleared >= g.goal) g.won = true;
  else if (!emptyCells(g.stacks).length) g.over = true;
  return { events, gained, clears };
}

// ---------- Bot ----------

function evalStacks(stacks, adj) {
  let v = 0;
  let empty = 0;
  for (let i = 0; i < stacks.length; i++) {
    const st = stacks[i];
    if (!st) continue;
    if (!st.length) { empty++; continue; }
    v -= countRuns(st) * 2;
    const rl = runLen(st);
    v += rl * 0.6;
    // Nachbarn mit Farben, die nach dem Abtragen passen könnten (leichter Bonus für «Paare»)
    for (const n of adj[i]) if (stacks[n] && stacks[n].length && top(stacks[n]) === top(st)) v += 1;
  }
  return v + empty * 5;
}

/** Bester Zug { ti, cell, value } für den aktuellen Stand (gierig, ein Zug voraus). */
export function bestMove(g) {
  const geo = geometry(g.layout);
  const empties = emptyCells(g.stacks);
  let best = null;
  for (let ti = 0; ti < g.tray.length; ti++) {
    const st = g.tray[ti];
    if (!st) continue;
    for (const cell of empties) {
      const stacks = g.stacks.map((s) => (s ? s.slice() : s));
      stacks[cell] = st.slice();
      const ev = resolve(stacks, geo.adj, cell);
      let gained = 0;
      for (const e of ev) if (e.t === 'clear') gained += e.n;
      const value = gained * 12 + ev.length * 1.5 + evalStacks(stacks, geo.adj);
      if (!best || value > best.value) best = { ti, cell, value };
    }
  }
  return best;
}

/** Bot spielt bis Sieg/Ende (oder maxMoves). Gibt das Spiel zurück. */
export function botPlay(g, maxMoves = 600) {
  let n = 0;
  while (!g.over && !g.won && n++ < maxMoves) {
    const m = bestMove(g);
    if (!m) break;
    place(g, m.ti, m.cell);
  }
  return g;
}

export { LAYOUTS };
