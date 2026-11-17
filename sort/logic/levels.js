// Farbfluss – aus Levelnummer bzw. Datum wird ein fertiges, geprüftes Level (reine Logik).
//
//   levelParams(n)   → Schwierigkeit/Eigenschaften von Level n
//   buildLevel(n)    → { kind:'level', n, colors:[liquid-Index…], state, par, geheimnis, gross }
//   buildDaily(day)  → dasselbe für das Tagesrätsel 'JJJJ-MM-TT'
//   chapterOf(n)     → { index, name, emoji, bg, shelf, first, last }

import { makeRng } from '../../shared/rng.js';
import { liquids, PRIMARY_COUNT } from '../data/colors.js';
import { ramp, endless, minMovesFor, features, handmade } from '../data/levels.js';
import { chapters, CHAPTER_SIZE } from '../data/chapters.js';
import { dailyWeek } from '../data/daily.js';
import { PER_COLOR, validateState, revealComplete } from './rules.js';
import { generate } from './generator.js';
import { solveBest } from './solver.js';

const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

function hasFeature(f, n) {
  return !!f && n >= f.from && (n - f.from) % f.every === 0;
}

export function levelParams(n) {
  n = Math.max(1, Math.floor(n));
  if (handmade[n]) return { n, handmade: true, colors: handmade[n].colors.length };
  let colors;
  if (n >= endless.from) {
    colors = endless.colors[(n - endless.from) % endless.colors.length];
  } else {
    let step = ramp[0];
    for (const r of ramp) if (n >= r.from) step = r;
    colors = step.colors;
  }
  const geheimnis = hasFeature(features.geheimnis, n);
  const grossIdx = hasFeature(features.gross, n) ? (n - features.gross.from) / features.gross.every : -1;
  const gross = grossIdx >= 0 ? (grossIdx % 2 === 0 ? 'empty' : 'filled') : null;
  if (geheimnis) colors = Math.max(4, colors + (features.geheimnis.colorDelta || 0));
  colors = Math.min(colors, liquids.length);
  let minMoves = minMovesFor[colors] ?? colors * 3;
  if (n < endless.from) {
    let step = ramp[0];
    for (const r of ramp) if (n >= r.from) step = r;
    if (step.colors === colors && step.minMoves) minMoves = step.minMoves;
  }
  return { n, colors, geheimnis, gross, minMoves };
}

/** Wählt k Flüssigkeiten: bei wenigen Farben die gut unterscheidbaren Grundfarben. */
export function pickColors(k, rng) {
  const primary = rng.shuffle([...Array(Math.min(PRIMARY_COUNT, liquids.length)).keys()]);
  const extra = rng.shuffle([...Array(liquids.length).keys()].slice(PRIMARY_COUNT));
  return [...primary, ...extra].slice(0, k);
}

function fromHandmade(def) {
  const colors = def.colors.map((id) => {
    const i = liquids.findIndex((l) => l.id === id);
    if (i < 0) throw new Error('Unbekannte Farbe: ' + id);
    return i;
  });
  const tubes = def.tubes.map((s) => {
    let cap = PER_COLOR;
    const m = /^(\d+):(.*)$/.exec(s);
    if (m) { cap = +m[1]; s = m[2]; }
    const l = [...s].map((ch) => ch.charCodeAt(0) - 97);
    const t = { cap, l, h: def.hidden && l.length ? l.length - 1 : 0 };
    revealComplete(t, PER_COLOR); // schon fertige Gläser zeigen alles
    return t;
  });
  const state = { per: PER_COLOR, tubes };
  const err = validateState(state);
  if (err) throw new Error('Handgemachtes Level ungültig: ' + err);
  const r = solveBest(state, { budget: 100000 });
  if (!r || !r.moves) throw new Error('Handgemachtes Level nicht lösbar');
  return { colors, state, par: r.moves.length, solution: r.moves };
}

function build(params, seed) {
  const rng = makeRng(seed);
  const colors = pickColors(params.colors, rng);
  const g = generate({
    colors: params.colors,
    empties: 2,
    tall: params.gross || null,
    hidden: !!params.geheimnis,
    minMoves: params.minMoves,
    attempts: 30,
    budget: 60000,
  }, rng);
  if (!g) throw new Error('Level konnte nicht erzeugt werden: ' + seed);
  return { colors, state: g.state, par: g.par, optimal: g.optimal, solution: g.solution };
}

export function buildLevel(n) {
  const p = levelParams(n);
  if (p.handmade) {
    const def = handmade[p.n];
    const h = fromHandmade(def);
    return { kind: 'level', id: 'L' + p.n, n: p.n, ...h, geheimnis: !!def.hidden, gross: null, tutorial: !!def.tutorial };
  }
  const b = build(p, `sort-level-${p.n}`);
  return { kind: 'level', id: 'L' + p.n, n: p.n, ...b, geheimnis: p.geheimnis, gross: p.gross };
}

export function dailyParams(day) {
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  const c = dailyWeek[wd % dailyWeek.length];
  const colors = Math.min(c.colors, liquids.length);
  return {
    day, weekday: wd, name: c.name, colors,
    geheimnis: !!c.geheimnis, gross: c.gross || null,
    minMoves: minMovesFor[colors] ?? colors * 3,
  };
}

export function buildDaily(day) {
  const p = dailyParams(day);
  const b = build(p, `sort-daily-${day}`);
  return { kind: 'daily', id: 'D' + day, day, name: p.name, ...b, geheimnis: p.geheimnis, gross: p.gross };
}

export function chapterOf(n) {
  const index = Math.floor((Math.max(1, n) - 1) / CHAPTER_SIZE);
  const c = chapters[index % chapters.length];
  const cycle = Math.floor(index / chapters.length);
  return {
    index,
    name: c.name + (ROMAN[cycle] ?? ` ${cycle + 1}`),
    emoji: c.emoji,
    bg: c.bg,
    shelf: c.shelf,
    first: index * CHAPTER_SIZE + 1,
    last: (index + 1) * CHAPTER_SIZE,
  };
}

/** Sterne für eine Lösung: 3 = innerhalb des Ziels und ohne Extra-Glas. */
export function starsFor({ moves, par, extraUsed }) {
  const target = parTarget(par);
  let s = moves <= target ? 3 : moves <= target + Math.max(4, Math.ceil(par * 0.35)) ? 2 : 1;
  if (extraUsed) s = Math.min(s, 2);
  return s;
}

/** Zugziel für drei Sterne (etwas grosszügiger als die optimale Lösung). */
export function parTarget(par) {
  return par + Math.max(2, Math.ceil(par * 0.15));
}

