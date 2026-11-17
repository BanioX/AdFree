// Zahlenpaare – Spielzustand (rein, JSON-speicherbar).

import { pairInfo, findPairs, clearedRows, removeRows, appendOpen, openCount, POINTS } from './rules.js';
import { generateBoard } from './generator.js';
import { levelSpec, DAILY, endlessSpec, ENDLESS_MAX_ADDS } from '../data/levels.js';

const clone = (cells) => cells.map((c) => ({ v: c.v, x: c.x, s: c.s }));

export function seedFor(mode, { level, day, round, salt = '' } = {}) {
  if (mode === 'daily') return `numbermatch-daily-${day}`;
  if (mode === 'endless') return `numbermatch-endless-${salt}-${round}`;
  return `numbermatch-level-${level}`;
}

/** Neues Spiel. mode: 'level' | 'daily' | 'endless' */
export function newGame(mode, opts = {}) {
  let spec;
  if (mode === 'daily') spec = { ...DAILY };
  else if (mode === 'endless') spec = endlessSpec(1);
  else spec = levelSpec(opts.level || 1);
  const salt = mode === 'endless' ? (opts.salt || String(Date.now() % 1e9)) : '';
  const seed = seedFor(mode, { level: opts.level, day: opts.day, round: 1, salt });
  const starN = spec.goal.type === 'stars' ? spec.goal.n + 1 : 0;   // ein Stern Reserve
  const cells = generateBoard(seed, { count: spec.count, stars: starN });
  return {
    v: 1,
    mode,
    level: opts.level || 0,
    day: opts.day || null,
    salt,
    round: 1,
    goal: spec.goal,
    adds: spec.adds,
    addsLeft: spec.adds,
    start: clone(cells),
    cells,
    score: 0,
    starsGot: 0,
    rowsCleared: 0,
    pairs: 0,
    hints: 0,
    elapsed: 0,
    done: false,
    lost: false,
    created: Date.now(),
  };
}

/** Level/Tagesrätsel von vorn (gleiches Feld). */
export function restart(st) {
  st.cells = clone(st.start);
  st.addsLeft = st.adds;
  st.score = 0; st.starsGot = 0; st.rowsCleared = 0; st.pairs = 0;
  st.done = false; st.lost = false;
  st.round = 1;
  return st;
}

export function goalProgress(st) {
  const g = st.goal;
  if (g.type === 'stars') return { have: Math.min(st.starsGot, g.n), need: g.n };
  if (g.type === 'rows') return { have: Math.min(st.rowsCleared, g.n), need: g.n };
  if (g.type === 'clear') {
    const left = openCount(st.cells);
    return { have: st.pairs * 2, need: st.pairs * 2 + left, left };
  }
  return { have: st.score, need: 0 };
}

export function isWon(st) {
  const g = st.goal;
  if (g.type === 'stars') return st.starsGot >= g.n;
  if (g.type === 'rows') return st.rowsCleared >= g.n;
  if (g.type === 'clear') return openCount(st.cells) === 0;
  return false;
}

/**
 * Versucht, i und j zu streichen. Gibt ein Ergebnis zurück:
 * { ok, kind, gap, points, stars, rows: [entfernte Reihenindizes], won, roundClear }
 */
export function play(st, i, j) {
  if (st.done) return { ok: false };
  const info = pairInfo(st.cells, i, j);
  if (!info) return { ok: false };
  if (i > j) [i, j] = [j, i];
  const { kind, gap } = info;
  const stars = (st.cells[i].s ? 1 : 0) + (st.cells[j].s ? 1 : 0);
  st.cells[i].x = true; st.cells[j].x = true;
  st.pairs++;
  st.starsGot += stars;
  let points = gap > 0 ? POINTS.far : POINTS.pair;
  const rows = clearedRows(st.cells);
  if (rows.length) {
    st.cells = removeRows(st.cells, rows);
    st.rowsCleared += rows.length;
    points += POINTS.row * rows.length;
    if (st.mode === 'endless') st.addsLeft = Math.min(ENDLESS_MAX_ADDS, st.addsLeft + rows.length);
  }
  let roundClear = false;
  if (st.cells.length === 0 || openCount(st.cells) === 0) {
    points += POINTS.board;
    roundClear = true;
  }
  st.score += points;
  const won = isWon(st);
  if (won) st.done = true;
  if (roundClear && st.mode === 'endless') nextRound(st);
  if (!st.done && !won) st.lost = isStuck(st);
  return { ok: true, kind, gap, points, stars, rows, won, roundClear };
}

/** Endlos: neues Feld, Punkte bleiben. */
export function nextRound(st) {
  st.round++;
  const spec = endlessSpec(st.round);
  const cells = generateBoard(seedFor('endless', { round: st.round, salt: st.salt }), { count: spec.count });
  st.cells = cells;
  st.addsLeft = Math.min(ENDLESS_MAX_ADDS, st.addsLeft + 2);
}

export function canAdd(st) {
  return !st.done && st.addsLeft > 0 && openCount(st.cells) > 0;
}

/** «Zahlen hinzufügen»: offene Zahlen ans Ende kopieren. Gibt die Anzahl neuer Felder zurück. */
export function addNumbers(st) {
  if (!canAdd(st)) return 0;
  const before = st.cells.length;
  st.cells = appendOpen(st.cells);
  st.addsLeft--;
  st.lost = isStuck(st);
  return st.cells.length - before;
}

export function isStuck(st) {
  return !st.done && st.addsLeft <= 0 && findPairs(st.cells).length === 0;
}

export function validState(st) {
  return !!(st && st.v === 1 && Array.isArray(st.cells) && Array.isArray(st.start) && st.goal && typeof st.addsLeft === 'number');
}

/** Sterne (3) für das Ergebnis eines Levels. */
export function starsFor(st) {
  let s = 3;
  if (st.hints > 0) s--;
  if (st.addsLeft < st.adds - 2) s--;
  return Math.max(1, s);
}
