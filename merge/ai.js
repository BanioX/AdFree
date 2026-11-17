// Verdoppeln – Tipp-Geber und Test-Bot (Expectimax-Suche), rein, ohne DOM.
//
// Das Brett wird hier kompakt als Int8Array von Stufen gerechnet (0 = leer).
// Steine/Löcher kommen in den «Abschnitten» (segs) einfach nicht vor.

import { DIRS, FREE, lines, move as logicMove, canMove } from './logic.js';

const MODEL_CACHE = new Map();

/** Vorberechnete Abschnitte pro Richtung für Brettgrösse + Wände. */
export function boardModel(size, walls) {
  const key = size + ':' + walls.join('');
  let m = MODEL_CACHE.get(key);
  if (m) return m;
  const segs = {};
  for (const dir of DIRS) {
    const out = [];
    for (const line of lines(size, dir)) {
      let seg = [];
      for (const idx of line) {
        if (walls[idx] !== FREE) { if (seg.length) out.push(seg); seg = []; } else seg.push(idx);
      }
      if (seg.length) out.push(seg);
    }
    segs[dir] = out;
  }
  const free = [];
  for (let i = 0; i < walls.length; i++) if (walls[i] === FREE) free.push(i);
  m = { size, n: size * size, segs, free };
  if (MODEL_CACHE.size > 64) MODEL_CACHE.clear();
  MODEL_CACHE.set(key, m);
  return m;
}

export function stateToGrid(s) {
  const g = new Int8Array(s.size * s.size);
  s.cells.forEach((c, i) => { if (c) g[i] = c.e; });
  return g;
}

/** Schnelles Schieben auf dem kompakten Brett. Gibt null zurück, wenn sich nichts bewegt. */
export function slideGrid(model, grid, dir) {
  const out = new Int8Array(grid.length);
  let moved = false;
  let score = 0;
  for (const seg of model.segs[dir]) {
    let k = 0;
    let last = 0;
    let lastMerged = false;
    for (let j = 0; j < seg.length; j++) {
      const v = grid[seg[j]];
      if (!v) continue;
      if (last && !lastMerged && last === v) {
        out[seg[k - 1]] = v + 1;
        score += 2 ** (v + 1);
        lastMerged = true;
        last = v + 1;
        moved = true;
      } else {
        const to = seg[k++];
        out[to] = v;
        if (to !== seg[j]) moved = true;
        last = v;
        lastMerged = false;
      }
    }
  }
  return moved ? { grid: out, score } : null;
}

// Heuristik (bewährte Linien-Bewertung: leere Felder, Nachbarn gleich, Monotonie, Summe)
const LOST = 200000;
const W_EMPTY = 270;
const W_MERGES = 700;
const W_MONO = 47;
const W_SUM = 11;
const P_SUM = new Float64Array(32).map((_, i) => i ** 3.5);
const P_MONO = new Float64Array(32).map((_, i) => i ** 4);

function lineScore(grid, seg) {
  let sum = 0, empty = 0, merges = 0, prev = 0, counter = 0;
  for (let j = 0; j < seg.length; j++) {
    const v = grid[seg[j]];
    sum += P_SUM[v];
    if (v === 0) empty++;
    else {
      if (prev === v) counter++;
      else if (counter > 0) { merges += 1 + counter; counter = 0; }
      prev = v;
    }
  }
  if (counter > 0) merges += 1 + counter;
  let monoL = 0, monoR = 0;
  for (let j = 1; j < seg.length; j++) {
    const a = grid[seg[j - 1]], b = grid[seg[j]];
    if (a > b) monoL += P_MONO[a] - P_MONO[b];
    else monoR += P_MONO[b] - P_MONO[a];
  }
  return LOST + W_EMPTY * empty + W_MERGES * merges - W_MONO * Math.min(monoL, monoR) - W_SUM * sum;
}

export function evaluate(model, grid) {
  let s = 0;
  for (const seg of model.segs.left) s += lineScore(grid, seg);
  for (const seg of model.segs.up) s += lineScore(grid, seg);
  return s;
}

const MAX_CHANCE = 8;

function chance(model, grid, depth, prob) {
  if (depth <= 0 || prob < 0.0002) return evaluate(model, grid);
  let empties = [];
  for (const i of model.free) if (!grid[i]) empties.push(i);
  if (!empties.length) return evaluate(model, grid);
  // Bei sehr vielen leeren Feldern nur eine gleichmässige Auswahl prüfen (spart viel Zeit).
  if (empties.length > MAX_CHANCE) {
    const step = empties.length / MAX_CHANCE;
    const pick = [];
    for (let k = 0; k < MAX_CHANCE; k++) pick.push(empties[Math.floor(k * step)]);
    empties = pick;
  }
  const p = prob / empties.length;
  const withFour = p * 0.1 > 0.004;
  let total = 0;
  for (const i of empties) {
    grid[i] = 1;
    if (withFour) {
      total += 0.9 * maxNode(model, grid, depth, p * 0.9);
      grid[i] = 2;
      total += 0.1 * maxNode(model, grid, depth, p * 0.1);
    } else {
      total += maxNode(model, grid, depth, p);
    }
    grid[i] = 0;
  }
  return total / empties.length;
}

function maxNode(model, grid, depth, prob) {
  let best = 0;
  for (const dir of DIRS) {
    const r = slideGrid(model, grid, dir);
    if (!r) continue;
    const v = chance(model, r.grid, depth - 1, prob);
    if (v > best) best = v;
  }
  return best;
}

/** Empfohlene Suchtiefe nach Anzahl freier Felder (wenig Platz → tiefer suchen). */
export function autoDepth(model, grid) {
  let empty = 0;
  for (const i of model.free) if (!grid[i]) empty++;
  return empty > 5 ? 2 : 3;
}

/**
 * Bester Zug für einen Spielstand. opts.depth: Anzahl Züge, die vorausgedacht werden (1–3).
 * Gibt 'up'|'right'|'down'|'left' oder null (kein Zug möglich) zurück.
 */
export function bestMove(state, opts = {}) {
  const model = boardModel(state.size, state.walls);
  const grid = stateToGrid(state);
  const depth = opts.depth ?? autoDepth(model, grid);
  let best = null;
  let bestVal = -Infinity;
  for (const dir of DIRS) {
    const r = slideGrid(model, grid, dir);
    if (!r) continue;
    const v = chance(model, r.grid, depth - 1, 1);
    if (v > bestVal) { bestVal = v; best = dir; }
  }
  return best;
}

/**
 * Lässt den Bot spielen, bis das Ziel erreicht ist (stopOnWin), kein Zug mehr geht oder maxMoves.
 * Für Tests und zum Abstimmen der Etappen. Gibt den Endzustand zurück.
 */
export function autoplay(state, opts = {}) {
  const maxMoves = opts.maxMoves ?? 100000;
  const stopOnWin = opts.stopOnWin ?? true;
  let s = state;
  for (let i = 0; i < maxMoves; i++) {
    if (stopOnWin && s.won) break;
    if (!canMove(s)) break;
    const dir = bestMove(s, { depth: opts.depth });
    if (!dir) break;
    s = logicMove(s, dir).state;
  }
  return s;
}
