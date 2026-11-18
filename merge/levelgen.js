// Verdoppeln – Etappen-Generator (rein, ohne DOM).
// Etappe n ist für alle immer gleich (Form, Ziel, Sterne-Grenzen); nur die neuen
// Kacheln sind bei jedem Versuch zufällig.

import { makeRng } from '../shared/rng.js';
import {
  chapters, shapes, chapterPlan, handmade, LEVELS_PER_CHAPTER,
  MAX_TARGET, MAX_BOSS_TARGET, MIN_TARGET, stars,
} from './data/levels.js';
import { FREE, STONE, HOLE, valueOf } from './logic.js';
import { t, loc } from './i18n.js';

export { LEVELS_PER_CHAPTER };

/** Wandelt eine Form (Zeilen aus '.', 'o', 'x') in { size, walls } um. */
export function parseShape(shape) {
  const size = shape.rows.length;
  const walls = [];
  for (const row of shape.rows) {
    for (const ch of row) walls.push(ch === 'o' ? STONE : ch === 'x' ? HOLE : FREE);
  }
  return { id: shape.id, size, walls, maxE: shape.maxE };
}

const SHAPES = new Map(shapes.map((s) => [s.id, s]));
export function shapeById(id) { return SHAPES.get(id) || null; }

/** Kapitel-Infos für Etappe n (1-basiert). */
export function chapterOf(n) {
  const gci = Math.floor((n - 1) / LEVELS_PER_CHAPTER); // fortlaufende Kapitelnummer (0-basiert)
  const index = gci % chapters.length;
  const round = Math.floor(gci / chapters.length);
  const pos = (n - 1) % LEVELS_PER_CHAPTER;
  return { gci, index, round, pos, chapter: chapters[index], first: gci * LEVELS_PER_CHAPTER + 1, last: (gci + 1) * LEVELS_PER_CHAPTER };
}

export function chapterTitle(gci) {
  const ch = chapters[gci % chapters.length];
  const round = Math.floor(gci / chapters.length);
  const name = loc(ch, 'title');
  return round > 0 ? t('round', { name, n: round + 1 }) : name;
}

export function goalSum(goal) {
  return goal.type === 'count' ? goal.n * valueOf(goal.e) : valueOf(goal.e);
}

function parFor(goal) {
  const sum = goalSum(goal);
  return {
    par: Math.ceil((sum * stars.parFactor) / 2.2) + stars.extraMoves,
    par2: Math.ceil((sum * stars.par2Factor) / 2.2) + stars.extraMoves,
  };
}

const log2 = (v) => Math.round(Math.log2(v));

/**
 * Erzeugt Etappe n. Rückgabe:
 * { n, gci, chapter, round, pos, boss, shape, size, walls, goal:{type,e,n?}, par, par2, tip, skin }
 */
export function makeLevel(n) {
  n = Math.max(1, Math.floor(n));
  const info = chapterOf(n);
  const plan = chapterPlan[info.pos % chapterPlan.length];
  const hm = handmade[n];
  let shapeDef, goal, tip = null;
  if (hm && SHAPES.has(hm.shape)) {
    shapeDef = SHAPES.get(hm.shape);
    goal = hm.goal.type === 'count'
      ? { type: 'count', e: log2(hm.goal.value), n: hm.goal.n || 2 }
      : { type: 'tile', e: log2(hm.goal.value) };
    tip = loc(hm, 'tip') || null;
  } else {
    const rng = makeRng('merge-level-' + n);
    const pool = plan.shapes ? plan.shapes.map((id) => SHAPES.get(id)).filter(Boolean)
      : shapes.filter((s) => s.rows.length === plan.size);
    shapeDef = pool.length ? rng.pick(pool) : shapes[0];
    let slack = plan.slack;
    if (info.gci === 0) slack += 1;           // erstes Kapitel: sanfter Einstieg
    if (info.round >= 1) slack -= 1;          // ab Runde 2 etwas anspruchsvoller
    if (info.round >= 3) slack -= 1;
    slack = Math.max(0, slack);
    const cap = plan.boss ? MAX_BOSS_TARGET : MAX_TARGET;
    const e = Math.max(MIN_TARGET, Math.min(cap, shapeDef.maxE - slack));
    if (plan.goal === 'count') {
      const ce = Math.max(4, e - 2);
      goal = { type: 'count', e: ce, n: rng.int(2, 4) };
    } else {
      goal = { type: 'tile', e };
    }
  }
  const shape = parseShape(shapeDef);
  return {
    n,
    gci: info.gci,
    chapter: info.chapter,
    round: info.round,
    pos: info.pos,
    boss: !!plan.boss && !hm,
    shape: shape.id,
    size: shape.size,
    walls: shape.walls,
    goal,
    ...parFor(goal),
    tip,
    skin: info.chapter.skin,
  };
}

/** Sterne (1–3) für eine geschaffte Etappe mit `moves` Zügen. */
export function starsFor(level, moves) {
  if (moves <= level.par) return 3;
  if (moves <= level.par2) return 2;
  return 1;
}
