// Einfacher, gieriger Computer-Spieler. Wird für Tests (Lösbarkeit, Schusszahlen)
// und für den gratis «Tipp» im Spiel verwendet.

import { MIN_ANGLE } from './hex.js';
import { traceShot } from './trace.js';
import { isColor } from './board.js';

const angleCache = new Map();
export function candidateAngles(step = 1) {
  if (angleCache.has(step)) return angleCache.get(step);
  const out = [];
  for (let a = MIN_ANGLE; a <= 180 - MIN_ANGLE + 1e-9; a += step) out.push(+a.toFixed(3));
  angleCache.set(step, out);
  return out;
}

/** Gruppiert Winkel nach Ergebnis (Zielzelle bzw. getroffene Blasen beim Feuer). */
function groupAngles(board, angles, pierce) {
  const groups = new Map();
  const occ = board.occupied();
  for (const a of angles) {
    const tr = traceShot(board, a, { pierce, occ });
    const k = pierce
      ? tr.pierced.map((p) => p.r * 16 + p.c).sort((x, y) => x - y).join(',')
      : (tr.target ? tr.target.r * 16 + tr.target.c : -1);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ a, tr });
  }
  // Mittlerer Winkel der Gruppe = robust gegen kleine Zielfehler
  return [...groups.values()].map((list) => {
    const mid = list[Math.floor(list.length / 2)];
    return { angle: mid.a, trace: mid.tr, width: list.length };
  });
}

function evaluate(before, after, ev) {
  if (after.status === 'won') return 1e6 - after.shotsUsed * 10 + after.shotsLeft;
  if (after.status === 'lost' && after.lostReason === 'overflow') return -1e6;
  let v = 0;
  const drops = ev.removed.filter((o) => o.how === 'drop').length;
  const pops = ev.removed.length - drops;
  v += pops * 10 + drops * 14 + ev.freed.length * 80;
  if (before.goal === 'pets') {
    for (const o of ev.removed) v += Math.max(0, 8 - o.r) * 0.8;
  }
  if (!ev.removed.length && ev.target) {
    const b = after.board;
    const t = ev.target;
    const same = b.neighbors(t.r, t.c).filter(([r, c]) => {
      const v2 = b.get(r, c);
      return isColor(v2) && (v2 & 15) === ev.placedValue;
    }).length;
    v += same * 6 - t.r * 0.9;
  }
  if (ev.kind !== 'normal') v -= 30;
  if (after.status === 'lost') v -= 1e5;
  return v;
}

/**
 * Bester Zug für den aktuellen Zustand.
 * Rückgabe: { angle, swap, arm, value } – swap: vorher tauschen, arm: Spezialkugel-Index oder -1
 */
export function bestMove(game, { step = 1, useSpecials = true } = {}) {
  if (game.status !== 'play') return null;
  const angles = candidateAngles(step);
  const base = game.clone();
  base.armed = -1;
  base.simulate = true;
  const options = [{ swap: false, arm: -1 }];
  if (base.next !== base.current) options.push({ swap: true, arm: -1 });
  if (useSpecials) base.specials.forEach((s, i) => options.push({ swap: false, arm: i }));

  const normalGroups = groupAngles(base.board, angles, false);
  let fireGroups = null;
  let best = null;
  for (const opt of options) {
    const type = opt.arm >= 0 ? base.specials[opt.arm] : null;
    let groups = normalGroups;
    if (type === 'fire') groups = fireGroups || (fireGroups = groupAngles(base.board, angles, true));
    for (const g of groups) {
      const sim = base.clone();
      if (opt.swap) sim.swap();
      if (opt.arm >= 0) sim.arm(opt.arm);
      const ev = sim.shoot(g.angle, g.trace);
      if (!ev) continue;
      const value = evaluate(base, sim, ev) + Math.min(g.width, 6) * 0.05;
      if (!best || value > best.value) best = { angle: g.angle, swap: opt.swap, arm: opt.arm, value };
    }
  }
  return best;
}

/** Spielt ein Spiel mit dem Computer-Spieler zu Ende (für Tests). */
export function autoPlay(game, { maxShots = 400, step = 1, useSpecials = true, onShot } = {}) {
  let n = 0;
  while (game.status === 'play' && n < maxShots) {
    const m = bestMove(game, { step, useSpecials });
    if (!m) break;
    if (m.swap) game.swap();
    if (m.arm >= 0) game.arm(m.arm);
    const ev = game.shoot(m.angle);
    if (onShot) onShot(ev, game);
    n++;
  }
  return game;
}
