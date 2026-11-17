// Tipps, "Keine Züge mehr"-Erkennung und automatisches Beenden (reine Logik).
//
// findHint(st, hist)  → { kind:'move', from, index, to } | { kind:'stock' } | null
//                       (hist = Zugliste der Sitzung; Züge zurück in eine eben gesehene Stellung entfallen)
// isStuck(st)         → true, wenn kein sinnvoller Zug und auch der Talon nichts mehr bringt
// finishActions(st)   → Aktionsliste zum automatischen Beenden (oder null, wenn nicht trivial)

import {
  LAYOUTS, suitOf, rankOf, canPick, canDrop, cloneState, doMove, stockAction, canStock, isWon,
  hiddenCount, foundCounts, isSafeToFound, top, revertOps,
} from './rules.js';

// ---------------------------------------------------------------- Kandidaten

function foundMoves(st) {
  const L = LAYOUTS[st.game];
  const out = [];
  const srcs = [...L.tab, ...L.cells];
  if (L.waste >= 0) srcs.unshift(L.waste);
  for (const p of srcs) {
    const a = st.piles[p];
    if (!a.length || !st.up[a[a.length - 1]]) continue;
    const i = a.length - 1;
    const t = L.found.find((q) => st.piles[q].length && canDrop(st, p, i, q)) ?? L.found.find((q) => canDrop(st, p, i, q));
    if (t != null) {
      // Wert: deckt eine Karte auf?
      const reveals = L.kinds[p] === 'tab' && i > 0 && !st.up[a[i - 1]];
      out.push({ kind: 'move', from: p, index: i, to: t, score: 100 + (reveals ? 20 : 0) - rankOf(st.codes[a[i]]) * 0.1 });
    }
  }
  return out;
}

function firstUp(st, p) {
  const a = st.piles[p];
  let u = 0;
  while (u < a.length && !st.up[a[u]]) u++;
  return u;
}

/** Sinnvolle Spalten-Züge (keine reinen Hin-und-her-Züge). */
function tableauMoves(st) {
  const L = LAYOUTS[st.game];
  const out = [];
  const kingsWaiting = () => {
    // Gibt es einen König, der von einer leeren Spalte profitieren würde?
    if (st.game !== 'klondike') return true;
    const w = top(st, L.waste);
    if (w >= 0 && rankOf(st.codes[w]) === 13) return true;
    for (const p of L.tab) {
      const u = firstUp(st, p);
      if (u > 0 && u < st.piles[p].length && rankOf(st.codes[st.piles[p][u]]) === 13) return true;
    }
    return false;
  };
  for (const p of L.tab) {
    const a = st.piles[p];
    if (!a.length) continue;
    const u = firstUp(st, p);
    for (let i = u; i < a.length; i++) {
      if (!canPick(st, p, i)) continue;
      const below = i > 0 ? a[i - 1] : -1;
      const belowUp = below >= 0 && st.up[below];
      const code = st.codes[a[i]];
      for (const t of L.tab) {
        if (t === p || !canDrop(st, p, i, t)) continue;
        const destEmpty = st.piles[t].length === 0;
        let score = 0;
        if (below >= 0 && !belowUp) score = 80 + (i - 0) * 2;           // deckt auf
        else if (below < 0) {                                          // leert die Spalte
          if (destEmpty) continue;
          score = kingsWaiting() ? 45 : (st.game === 'klondike' ? 0 : 35);
        } else {
          const bc = st.codes[below];
          const natural = st.game === 'spider'
            ? suitOf(bc) === suitOf(code) && rankOf(bc) === rankOf(code) + 1
            : rankOf(bc) === rankOf(code) + 1 && ((suitOf(bc) & 1) !== (suitOf(code) & 1));
          if (st.game === 'spider') {
            const tc = destEmpty ? -1 : st.codes[top(st, t)];
            const improves = tc >= 0 && suitOf(tc) === suitOf(code);
            if (natural) continue;
            if (rankOf(bc) === rankOf(code) + 1 && !improves) continue; // seitwärts
            score = improves ? 60 : 30;
            if (destEmpty) score = 20;
          } else {
            if (natural && !canFoundSoon(st, below)) continue;
            score = natural ? 50 : 30;
            if (destEmpty) score = 15;
          }
        }
        if (score <= 0) continue;
        if (st.game === 'spider' && !destEmpty && suitOf(st.codes[top(st, t)]) === suitOf(code)) score += 8;
        if (destEmpty) score -= 5;
        out.push({ kind: 'move', from: p, index: i, to: t, score });
      }
    }
  }
  return out;
}

function canFoundSoon(st, id) {
  const L = LAYOUTS[st.game];
  const code = st.codes[id];
  const fc = foundCounts(st);
  return fc[suitOf(code)] === rankOf(code) - 1 && L.found.length > 0;
}

function wasteMoves(st) {
  const L = LAYOUTS[st.game];
  const out = [];
  if (L.waste < 0) return out;
  const a = st.piles[L.waste];
  if (!a.length) return out;
  const i = a.length - 1;
  for (const t of L.tab) if (canDrop(st, L.waste, i, t)) out.push({ kind: 'move', from: L.waste, index: i, to: t, score: 55 });
  return out;
}

function cellMoves(st) {
  const L = LAYOUTS[st.game];
  const out = [];
  for (const p of L.cells) {
    if (!st.piles[p].length) continue;
    for (const t of L.tab) if (canDrop(st, p, 0, t)) out.push({ kind: 'move', from: p, index: 0, to: t, score: st.piles[t].length ? 58 : 12 });
  }
  // Spalte → Zelle als letzte Möglichkeit
  const free = L.cells.find((q) => !st.piles[q].length);
  if (free != null) {
    for (const p of L.tab) {
      const a = st.piles[p];
      if (a.length > 1) out.push({ kind: 'move', from: p, index: a.length - 1, to: free, score: 5 });
    }
  }
  return out;
}

/** Klondike: würde der Talon (ein ganzer Durchgang) eine spielbare Karte liefern? */
function stockUseful(st) {
  const L = LAYOUTS[st.game];
  if (st.game === 'klondike') {
    const sim = cloneState(st);
    const total = sim.piles[L.stock].length + sim.piles[L.waste].length;
    if (!total) return false;
    // bis zu zwei volle Durchgänge simulieren
    let steps = 0;
    const maxSteps = Math.ceil(total / sim.draw) * 2 + 4;
    while (steps++ < maxSteps) {
      const r = stockAction(sim);
      if (r.error) return false;
      const w = top(sim, L.waste);
      if (w < 0) continue;
      const i = sim.piles[L.waste].length - 1;
      for (let t = 0; t < L.count; t++) if (canDrop(sim, L.waste, i, t)) return true;
    }
    return false;
  }
  if (st.game === 'spider') return st.piles[L.stock].length > 0;
  return false;
}

export function candidates(st) {
  const all = [...foundMoves(st), ...tableauMoves(st), ...wasteMoves(st)];
  if (st.game === 'freecell') all.push(...cellMoves(st));
  all.sort((a, b) => b.score - a.score);
  return all;
}

const posKey = (st) => st.piles.map((a) => a.join(',')).join('|');

/** Stellungen der letzten Züge (ohne die aktuelle). */
function recentPositions(st, hist, depth = 12) {
  const keys = new Set();
  if (!hist || !hist.length) return keys;
  const sim = cloneState(st);
  for (let k = hist.length - 1; k >= 0 && k >= hist.length - depth; k--) {
    if (!hist[k] || !hist[k].ops) break;
    revertOps(sim, hist[k].ops);
    keys.add(posKey(sim));
  }
  return keys;
}

/** Entfernt Züge, die genau in eine eben gesehene Stellung zurückführen (Hin-und-her-Tipps). */
function withoutRepeats(st, list, hist) {
  const seen = recentPositions(st, hist);
  if (!seen.size) return list;
  return list.filter((m) => {
    const sim = cloneState(st);
    doMove(sim, m.from, m.index, m.to);
    return !seen.has(posKey(sim));
  });
}

/** Spider: legale Züge der obersten Karte in eine leere Spalte (beste zuerst). */
function gapFills(st) {
  const L = LAYOUTS[st.game];
  const gap = L.tab.find((p) => !st.piles[p].length);
  const out = [];
  if (gap == null) return out;
  for (const p of L.tab) {
    const a = st.piles[p];
    if (a.length < 2) continue;
    const i = a.length - 1;
    if (!canPick(st, p, i) || !canDrop(st, p, i, gap)) continue;
    // lieber eine Karte, die nicht auf ihrer Folge-Karte liegt
    const natural = st.up[a[i - 1]] && suitOf(st.codes[a[i - 1]]) === suitOf(st.codes[a[i]])
      && rankOf(st.codes[a[i - 1]]) === rankOf(st.codes[a[i]]) + 1;
    out.push({ kind: 'move', from: p, index: i, to: gap, score: (natural ? 0 : 10) - rankOf(st.codes[a[i]]) * 0.1 });
  }
  return out.sort((x, y) => y.score - x.score);
}

export function findHint(st, hist = null) {
  const c = withoutRepeats(st, candidates(st), hist);
  const L = LAYOUTS[st.game];
  if (st.game === 'spider') {
    // Geben ist besser als ein reiner Notzug – aber nur, wenn Geben überhaupt erlaubt ist
    if (c.length && c[0].score >= 20) return c[0];
    if (canStock(st)) return { kind: 'stock' };
    if (st.piles[L.stock].length) {
      // Leere Spalte muss zuerst gefüllt werden
      const fill = c.find((m) => !st.piles[m.to].length);
      if (fill) return fill;
      if (c.length) return c[0];
      const fills = gapFills(st);
      return withoutRepeats(st, fills, hist)[0] || fills[0] || null;
    }
    return c[0] || null;
  }
  if (c.length) return c[0];
  if (st.game === 'klondike' && stockUseful(st)) return { kind: 'stock' };
  return null;
}

export function isStuck(st) {
  if (isWon(st)) return false;
  const L = LAYOUTS[st.game];
  if (st.game === 'freecell') {
    for (const p of [...L.tab, ...L.cells]) {
      const a = st.piles[p];
      for (let i = 0; i < a.length; i++) {
        if (!canPick(st, p, i)) continue;
        for (let t = 0; t < L.count; t++) if (canDrop(st, p, i, t)) return false;
      }
    }
    return true;
  }
  if (candidates(st).length) return false;
  if (st.game === 'spider') return !st.piles[L.stock].length;
  return !stockUseful(st);
}

// ---------------------------------------------------------------- Automatisch beenden

/** Ist die Partie "entschieden", sodass man sie automatisch beenden kann? */
export function canAutoFinish(st) {
  if (isWon(st)) return false;
  const L = LAYOUTS[st.game];
  if (st.game === 'klondike') return hiddenCount(st) === 0 && finishActions(st) != null;
  if (st.game === 'freecell') {
    for (const p of L.tab) {
      const a = st.piles[p];
      for (let k = 1; k < a.length; k++) if (rankOf(st.codes[a[k]]) >= rankOf(st.codes[a[k - 1]])) return false;
    }
    return true;
  }
  return false; // Spider: über den Löser (Worker)
}

/** Gierig alles ablegen (Klondike: mit Talon). Liefert Aktionen oder null. */
export function finishActions(st0) {
  const st = cloneState(st0);
  const L = LAYOUTS[st.game];
  const out = [];
  let guard = 0;
  let idle = 0;
  while (!isWon(st)) {
    if (++guard > 3000) return null;
    let moved = false;
    const srcs = [...L.tab, ...L.cells];
    if (L.waste >= 0) srcs.push(L.waste);
    // kleinste Karte zuerst, damit es hübsch der Reihe nach geht
    let best = null;
    for (const p of srcs) {
      const a = st.piles[p];
      if (!a.length) continue;
      const i = a.length - 1;
      const t = L.found.find((q) => st.piles[q].length && canDrop(st, p, i, q)) ?? L.found.find((q) => canDrop(st, p, i, q));
      if (t == null) continue;
      const r = rankOf(st.codes[a[i]]);
      if (!best || r < best.r) best = { p, i, t, r };
    }
    if (best) {
      out.push({ t: 'move', from: best.p, index: best.i, to: best.t });
      doMove(st, best.p, best.i, best.t);
      moved = true;
      idle = 0;
    }
    if (moved) continue;
    if (L.stock < 0) return null;
    const total = st.piles[L.stock].length + (L.waste >= 0 ? st.piles[L.waste].length : 0);
    if (++idle > total + 3) return null;
    const r = stockAction(st);
    if (r.error) return null;
    out.push({ t: 'stock' });
  }
  return out;
}

export { isSafeToFound };
