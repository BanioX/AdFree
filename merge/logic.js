// Verdoppeln – reine Spielregeln (kein DOM, in Node testbar).
//
// Begriffe
//   Stufe (e)   Kachelwert als Exponent: e=1 → 2, e=2 → 4, e=11 → 2048.
//   Wand-Feld   walls[i]: 0 frei, 1 Stein (Fels im Brett), 2 Loch (gehört nicht zum Brett).
//               Steine und Löcher blockieren beide: Kacheln rutschen nur bis davor.
//   Ziel        { type: 'tile', e }        – Kachel der Stufe e bilden
//               { type: 'count', e, n }    – n-mal eine Kachel der Stufe e bilden
//
// Der Zufall für neue Kacheln ist deterministisch: Kachel Nr. k eines Spiels entsteht aus
// dem Seed `${seed}#${k}`. So lässt sich jeder Spielstand exakt speichern und fortsetzen.

import { makeRng } from '../shared/rng.js';

export const DIRS = ['up', 'right', 'down', 'left'];
export const FREE = 0;
export const STONE = 1;
export const HOLE = 2;
/** Wahrscheinlichkeit, dass eine neue Kachel eine 4 (statt einer 2) ist. */
export const FOUR_CHANCE = 0.1;

export const valueOf = (e) => 2 ** e;

/** Neues Spiel. opts: { size, seed, walls?, goal?, target? (Stufe), startTiles? } */
export function createGame(opts = {}) {
  const size = opts.size || 4;
  const n = size * size;
  const walls = Array.isArray(opts.walls) && opts.walls.length === n ? opts.walls.map((w) => (w === 1 || w === 2 ? w : 0)) : new Array(n).fill(FREE);
  const goal = normalizeGoal(opts.goal || { type: 'tile', e: opts.target || 11 });
  const state = {
    v: 1,
    size,
    walls,
    cells: new Array(n).fill(null),
    nextId: 1,
    seed: String(opts.seed ?? 'seed'),
    spawns: 0,
    score: 0,
    moves: 0,
    maxE: 0,
    goal,
    made: 0,
    won: false,
    over: false,
  };
  const start = opts.startTiles ?? 2;
  for (let i = 0; i < start; i++) spawnInto(state);
  state.over = !canMove(state);
  return state;
}

function normalizeGoal(g) {
  if (g && g.type === 'count') return { type: 'count', e: Math.max(1, g.e | 0), n: Math.max(1, g.n | 0) };
  return { type: 'tile', e: Math.max(2, (g && g.e) | 0 || 11) };
}

export function cloneState(s) {
  return {
    ...s,
    walls: s.walls.slice(),
    cells: s.cells.map((c) => (c ? { id: c.id, e: c.e } : null)),
    goal: { ...s.goal },
  };
}

export function emptyCells(s) {
  const out = [];
  for (let i = 0; i < s.cells.length; i++) if (!s.cells[i] && s.walls[i] === FREE) out.push(i);
  return out;
}

export function freeCellCount(walls) {
  return walls.reduce((a, w) => a + (w === FREE ? 1 : 0), 0);
}

/** Setzt eine neue Kachel (deterministisch aus seed + Zähler). Gibt {id, e, at} oder null zurück. */
function spawnInto(s) {
  const empty = emptyCells(s);
  if (!empty.length) return null;
  const rng = makeRng(`${s.seed}#${s.spawns}`);
  s.spawns++;
  const at = empty[Math.floor(rng.next() * empty.length)];
  const e = rng.next() < FOUR_CHANCE ? 2 : 1;
  const tile = { id: s.nextId++, e };
  s.cells[at] = tile;
  if (e > s.maxE) s.maxE = e;
  return { id: tile.id, e, at };
}

/** Zellindizes einer Linie in Bewegungsrichtung: das erste Element ist die Seite, zu der alles rutscht. */
export function lines(size, dir) {
  const out = [];
  for (let a = 0; a < size; a++) {
    const line = [];
    for (let b = 0; b < size; b++) {
      let r, c;
      if (dir === 'left') { r = a; c = b; } else if (dir === 'right') { r = a; c = size - 1 - b; } else if (dir === 'up') { r = b; c = a; } else { r = size - 1 - b; c = a; }
      line.push(r * size + c);
    }
    out.push(line);
  }
  return out;
}

const LINE_CACHE = new Map();
function cachedLines(size, dir) {
  const k = size + dir;
  let v = LINE_CACHE.get(k);
  if (!v) { v = lines(size, dir); LINE_CACHE.set(k, v); }
  return v;
}

/**
 * Schiebt alle Kacheln in Richtung dir (ohne neue Kachel). Verändert den Zustand nicht.
 * Rückgabe: { state, moved, moves:[{id,from,to}], merges:[{id,e,at,from:[a,b]}], gained }
 */
export function slide(s0, dir) {
  const s = cloneState(s0);
  const size = s.size;
  const moves = [];
  const merges = [];
  let gained = 0;
  let moved = false;
  const next = new Array(s.cells.length).fill(null);
  for (const line of cachedLines(size, dir)) {
    // In Abschnitte zwischen Steinen/Löchern teilen
    let seg = [];
    const flush = () => {
      if (!seg.length) return;
      let k = 0; // nächster Zielplatz im Abschnitt
      let last = null; // {tile, at, merged}
      for (const idx of seg) {
        const t = s.cells[idx];
        if (!t) continue;
        if (last && !last.merged && last.tile.e === t.e) {
          // verschmelzen
          const e = t.e + 1;
          const id = s.nextId++;
          moves.push({ id: t.id, from: idx, to: last.at });
          const nt = { id, e };
          merges.push({ id, e, at: last.at, from: [last.tile.id, t.id] });
          next[last.at] = nt;
          gained += valueOf(e);
          last.merged = true;
          last.tile = nt;
          moved = true;
          if (e > s.maxE) s.maxE = e;
          if (s.goal.type === 'count' && e === s.goal.e) s.made++;
        } else {
          const to = seg[k++];
          moves.push({ id: t.id, from: idx, to });
          if (to !== idx) moved = true;
          next[to] = t;
          last = { tile: t, at: to, from: idx, merged: false };
        }
      }
      seg = [];
    };
    for (const idx of line) {
      if (s.walls[idx] !== FREE) flush();
      else seg.push(idx);
    }
    flush();
  }
  s.cells = next;
  s.score += gained;
  return { state: s, moved, moves, merges, gained };
}

/** Ist mindestens ein Zug möglich? */
export function canMove(s) {
  const n = s.size;
  for (let i = 0; i < s.cells.length; i++) {
    if (s.walls[i] !== FREE) continue;
    const t = s.cells[i];
    if (!t) return true;
    const c = i % n;
    if (c + 1 < n && s.walls[i + 1] === FREE) {
      const u = s.cells[i + 1];
      if (!u || u.e === t.e) return true;
    }
    if (i + n < s.cells.length && s.walls[i + n] === FREE) {
      const u = s.cells[i + n];
      if (!u || u.e === t.e) return true;
    }
  }
  return false;
}

export function goalReached(s) {
  if (s.goal.type === 'count') return s.made >= s.goal.n;
  return s.maxE >= s.goal.e;
}

/**
 * Ein vollständiger Zug: schieben, neue Kachel, Sieg/Ende prüfen.
 * Rückgabe: { state, moved, moves, merges, spawn, gained, won (gerade erreicht), newMax (neue höchste Stufe oder 0), over }
 * Wenn sich nichts bewegt, ist state === s0 und moved === false.
 */
export function move(s0, dir) {
  if (!DIRS.includes(dir)) throw new Error('Unbekannte Richtung: ' + dir);
  const r = slide(s0, dir);
  if (!r.moved) return { state: s0, moved: false, moves: [], merges: [], spawn: null, gained: 0, won: false, newMax: 0, over: s0.over };
  const s = r.state;
  s.moves++;
  const prevMax = s0.maxE;
  const spawn = spawnInto(s);
  let won = false;
  if (!s.won && goalReached(s)) { s.won = true; won = true; }
  s.over = !canMove(s);
  const newMax = s.maxE > prevMax ? s.maxE : 0;
  return { state: s, moved: true, moves: r.moves, merges: r.merges, spawn, gained: r.gained, won, newMax, over: s.over };
}

/** Welche Richtungen sind gerade möglich? */
export function legalMoves(s) {
  return DIRS.filter((d) => slide(s, d).moved);
}

/** Summe aller Kachelwerte. */
export function boardSum(s) {
  let sum = 0;
  for (const c of s.cells) if (c) sum += valueOf(c.e);
  return sum;
}

/** Prüft einen gespeicherten Zustand auf Plausibilität (z.B. nach dem Laden). */
export function isValidState(s) {
  if (!s || typeof s !== 'object' || s.v !== 1) return false;
  const n = s.size;
  if (!Number.isInteger(n) || n < 2 || n > 8) return false;
  if (!Array.isArray(s.cells) || s.cells.length !== n * n) return false;
  if (!Array.isArray(s.walls) || s.walls.length !== n * n) return false;
  if (!s.goal || (s.goal.type !== 'tile' && s.goal.type !== 'count')) return false;
  const ids = new Set();
  for (let i = 0; i < s.cells.length; i++) {
    const c = s.cells[i];
    if (c == null) continue;
    if (s.walls[i] !== FREE) return false;
    if (!Number.isInteger(c.id) || !Number.isInteger(c.e) || c.e < 1 || c.e > 30 || ids.has(c.id)) return false;
    if (c.id >= s.nextId) return false;
    ids.add(c.id);
  }
  return Number.isFinite(s.score) && Number.isInteger(s.moves) && Number.isInteger(s.spawns) && typeof s.seed === 'string';
}

/** Höchste Stufe auf dem Brett. */
export function maxTile(s) {
  let m = 0;
  for (const c of s.cells) if (c && c.e > m) m = c.e;
  return m;
}

/** Brett als Text (für Tests/Debug): Werte, '.' leer, '#' Stein, ' ' Loch. */
export function toText(s) {
  const rows = [];
  for (let r = 0; r < s.size; r++) {
    const row = [];
    for (let c = 0; c < s.size; c++) {
      const i = r * s.size + c;
      if (s.walls[i] === STONE) row.push('#');
      else if (s.walls[i] === HOLE) row.push('_');
      else row.push(s.cells[i] ? String(valueOf(s.cells[i].e)) : '.');
    }
    rows.push(row.join(' '));
  }
  return rows.join('\n');
}

/**
 * Baut einen Zustand aus Text (für Tests). Zeilen mit Leerzeichen getrennt:
 * Zahl = Kachelwert, '.' leer, '#' Stein, '_' Loch.
 */
export function fromText(text, opts = {}) {
  const rows = text.trim().split('\n').map((r) => r.trim().split(/\s+/));
  const size = rows.length;
  const s = createGame({ size, seed: opts.seed || 't', goal: opts.goal, target: opts.target, startTiles: 0 });
  rows.forEach((row, r) => row.forEach((tok, c) => {
    const i = r * size + c;
    if (tok === '#') s.walls[i] = STONE;
    else if (tok === '_') s.walls[i] = HOLE;
    else if (tok !== '.') {
      const e = Math.round(Math.log2(Number(tok)));
      s.cells[i] = { id: s.nextId++, e };
      if (e > s.maxE) s.maxE = e;
    }
  }));
  s.over = !canMove(s);
  return s;
}
