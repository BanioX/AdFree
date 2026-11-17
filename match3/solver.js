// Juwelen – Test-Spieler («Bot») und Level-Kalibrierung. Reine Logik, kein DOM.
//
// Der Bot probiert jeden möglichen Zug auf einer Kopie aus und nimmt den, der die Ziele am
// meisten voranbringt. Damit misst der Level-Generator, wie viele Züge ein Level ungefähr braucht,
// und legt Zuglimit und Sterne-Punkte fest (deterministisch, gleiche Levelnummer = gleiches Level).

import { Game, Rng } from './engine.js';
import { hashString } from '../shared/rng.js';

function stoneHp(g) { let n = 0; for (const p of g.cells) if (p && p.t === 's') n += p.hp; return n; }

/** Fortschritt 0..(Anzahl Ziele) – plus kleiner Bonus für tief liegende Eicheln. */
export function progress(g, start) {
  let s = 0;
  for (const goal of g.goals) {
    switch (goal.type) {
      case 'score': s += Math.min(1, g.score / goal.n); break;
      case 'color': s += Math.min(1, g.collected[goal.color] / goal.n); break;
      case 'item': s += Math.min(1, g.itemsCollected / goal.n); break;
      case 'ice': s += start.ice ? 1 - g.iceLayers() / start.ice : 1; break;
      case 'stone': s += start.stone ? 1 - stoneHp(g) / start.stone : 1; break;
      default: break;
    }
  }
  if (g.itemsTotal) {
    for (let i = 0; i < g.size; i++) { const p = g.cells[i]; if (p && p.t === 'i') s += 0.015 * ((i / g.w) | 0); }
  }
  return s;
}

export function startInfo(g) { return { ice: g.iceLayers(), stone: stoneHp(g) }; }

/** Bester Zug nach einfacher Vorausschau (ein Zug inkl. Kettenreaktion). */
export function chooseMove(g, rng, start = startInfo(g)) {
  const moves = g.findMoves();
  if (!moves.length) return null;
  const base = progress(g, start);
  let best = null, bestV = -Infinity;
  for (const m of moves) {
    const c = g.clone();
    c.swap(m.a, m.b);
    const v = (progress(c, start) - base) * 1000 + (c.score - g.score) * 0.004 + rng.next() * 0.5;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}

/**
 * Wo würde eine vernünftige Spielerin den Hammer einsetzen? Wenn eine Eichel feststeckt
 * oder nur noch wenig Eis/Steine übrig sind und sich länger nichts tut.
 * stuck = Anzahl Züge ohne Fortschritt.
 */
export function hammerTarget(g, stuck) {
  if (g.status !== 'play' || g.hammers <= 0 || stuck < 3) return null;
  const { w, h } = g;
  let best = null, bestLeft = 99;
  for (let i = 0; i < g.size; i++) {
    const p = g.cells[i];
    if (!p || p.t !== 'i') continue;
    const r = (i / w) | 0, c = i % w;
    let rr = r + 1;
    while (rr < h && !g.mask[rr * w + c]) rr++;
    if (rr >= h) continue;
    const q = g.cells[rr * w + c];
    if (!q || (q.t !== 'g' && q.t !== 's')) continue;
    let left = 0;
    for (let k = rr; k < h; k++) if (g.mask[k * w + c]) left++;
    if (left < bestLeft) { bestLeft = left; best = rr * w + c; }
  }
  if (best != null && (bestLeft <= 2 || stuck >= 6)) return best;
  if (stuck >= 4) {
    if (g.goals.some((x) => x.type === 'ice') && g.iceCount() > 0 && g.iceCount() <= 3) {
      for (let i = 0; i < g.size; i++) if (g.ice[i] > 0 && g.cells[i] && g.cells[i].t === 'g') return i;
    }
    if (g.goals.some((x) => x.type === 'stone') && g.stoneCount() > 0 && g.stoneCount() <= 3) {
      for (let i = 0; i < g.size; i++) if (g.cells[i] && g.cells[i].t === 's') return i;
    }
  }
  return null;
}

/** Spielt ein Spiel bis zum Ende (oder maxMoves). Nutzt den Hammer wie ein Mensch (sparsam). */
export function autoplay(g, { seed = 1, maxMoves = 300, hammer = true } = {}) {
  const rng = new Rng(seed);
  const rec = g.record;
  g.record = false;
  const start = startInfo(g);
  let n = 0, stuck = 0, last = progress(g, start);
  while (g.status === 'play' && n < maxMoves) {
    const t = hammer ? hammerTarget(g, stuck) : null;
    if (t != null) { g.hammer(t); stuck = 0; last = progress(g, start); continue; }
    const m = chooseMove(g, rng, start);
    if (!m) break;
    g.swap(m.a, m.b);
    n++;
    const p = progress(g, start);
    stuck = p > last + 0.004 ? 0 : stuck + 1;
    last = p;
  }
  g.record = rec;
  return g.status === 'won';
}

/**
 * Misst ein Level: Wie viele Züge braucht der Bot (Median über mehrere Läufe)?
 * Liefert { need, needs, fails, games } – games = die gewonnenen Partien (für starsFrom).
 */
export function measure(L, { runs = 4, cap = 70, key = 'm' } = {}) {
  const needs = [];
  const games = [];
  let fails = 0;
  for (let k = 0; k < runs; k++) {
    const g = new Game({ ...L, moves: cap, seed: hashString(`cal-${key}-${L.n}-${k}`) });
    g.record = false;
    const won = autoplay(g, { seed: 11 + k, maxMoves: cap });
    if (won) { needs.push(g.movesUsed); games.push(g); } else { needs.push(cap * 2); fails++; }
  }
  const sorted = needs.slice().sort((a, b) => a - b);
  // Oberes Quartil statt Median: robuster gegen Glück und Pech beim Nachfüllen.
  return { need: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))], needs, fails, games };
}

/**
 * Punkte für 2 und 3 Sterne bei `moves` Zügen, abgeleitet aus den gewonnenen Bot-Partien.
 * Ein Mensch braucht meist etwas mehr Züge als der Bot – entsprechend weniger bleiben fürs Finale.
 */
export function starsFrom(games, moves) {
  if (!games.length) return [0, moves * 150, moves * 230];
  const s2 = [], s3 = [];
  for (const g of games) {
    for (const [f, add, mult, list] of [[1.9, 5, 1.3, s2], [1.35, 3, 1.12, s3]]) {
      const c = g.clone();
      c.movesLeft = Math.max(0, Math.round(moves - g.movesUsed * f - add));
      c.score = Math.round(c.score * mult);
      c.finale();
      list.push(c.score);
    }
  }
  s2.sort((a, b) => a - b);
  s3.sort((a, b) => a - b);
  const a = Math.max(500, Math.round(s2[(s2.length - 1) >> 1] / 100) * 100);
  const b = Math.max(Math.round((a * 1.25) / 100) * 100, Math.round(s3[(s3.length - 1) >> 1] / 100) * 100);
  return [0, a, b];
}

/** Medianer Punktestand des Bots nach `k` Zügen (für Punkte-Ziele). */
export function scoreAfter(L, k, { runs = 3, key = 's' } = {}) {
  const out = [];
  for (let q = 0; q < runs; q++) {
    const g = new Game({ ...L, goals: [{ type: 'score', n: 1e9 }], moves: k, seed: hashString(`cal-${key}-${L.n}-${q}`) });
    autoplay(g, { seed: 5 + q, maxMoves: k });
    out.push(g.score);
  }
  out.sort((a, b) => a - b);
  return out[(out.length - 1) >> 1];
}
