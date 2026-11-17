// Golf-Patience – Löser und «fairer Spieler» für das Par (rein, ohne DOM).
//
//   clearPath(state) -> { cleared, moves, nodes, aborted }  Weg zum Abräumen (kennt den Talon)
//   fairPlay(state)  -> { score, moves }                    guter Spieler ohne Blick in den Talon

import { rankOf } from '../../lib/cards/deck.js';
import { COLS, STOCK } from './rules.js';

/**
 * Sucht einen Weg, alle Reihen abzuräumen (Tiefensuche mit Gedächtnis, frühes Ende).
 * -> { cleared, moves, nodes, aborted }
 */
export function clearPath(st, { maxNodes = 40000 } = {}) {
  const ranks = st.cols.map((c) => c.map(rankOf));
  const sr = st.stock.map(rankOf);
  const wrap = st.wrap;
  const adj = (a, b) => { const d = a > b ? a - b : b - a; return d === 1 || (wrap && d === 12); };
  const seen = new Set();
  const path = [];
  const h = st.h.slice();
  let nodes = 0;
  let aborted = false;
  // Wie viele Karten jedes Werts liegen noch in den Reihen (für Sackgassen-Erkennung)
  const left = new Array(14).fill(0);
  for (let c = 0; c < COLS; c++) for (let k = 0; k < h[c]; k++) left[ranks[c][k]]++;
  const stockLeft = new Array(14).fill(0);
  for (let j = st.ptr; j < STOCK; j++) stockLeft[sr[j]]++;

  // Eine Karte, deren Nachbarwerte nirgends mehr vorkommen, kann nie mehr gespielt werden
  // – ausser direkt auf die aktuelle Ablagekarte.
  const nb = (r) => (r === 1 ? (wrap ? [13, 2] : [2]) : r === 13 ? (wrap ? [12, 1] : [12]) : [r - 1, r + 1]);

  function dfs(ptr, top) {
    let total = 0;
    for (let c = 0; c < COLS; c++) total += h[c];
    if (total === 0) return true;
    if (aborted) return false;
    if (++nodes > maxNodes) { aborted = true; return false; }
    let key = 0;
    for (let c = 0; c < COLS; c++) key = key * 6 + h[c];
    key = (key * 17 + ptr) * 14 + top;
    if (seen.has(key)) return false;
    seen.add(key);
    // Sackgasse: unterste Karte ohne erreichbare Nachbarn (auch keine im Talon)
    for (let c = 0; c < COLS; c++) {
      if (!h[c]) continue;
      for (let k = 0; k < h[c]; k++) {
        const r = ranks[c][k];
        if (adj(r, top)) continue;
        let ok = false;
        for (const x of nb(r)) if (left[x] > 0 || stockLeft[x] > 0) { ok = true; break; }
        if (!ok) return false;
      }
    }
    // Züge: Karten aus hohen Reihen zuerst
    const order = [];
    for (let c = 0; c < COLS; c++) if (h[c] && adj(ranks[c][h[c] - 1], top)) order.push(c);
    order.sort((a, b) => h[b] - h[a]);
    for (const c of order) {
      const r = ranks[c][h[c] - 1];
      h[c]--; left[r]--;
      path.push({ t: 'play', c });
      if (dfs(ptr, r)) return true;
      path.pop();
      h[c]++; left[r]++;
      if (aborted) return false;
    }
    if (ptr < STOCK) {
      const r = sr[ptr];
      stockLeft[r]--;
      path.push({ t: 'draw' });
      if (dfs(ptr + 1, r)) return true;
      path.pop();
      stockLeft[r]++;
    }
    return false;
  }

  const cleared = dfs(st.ptr, rankOf(st.top));
  return { cleared, moves: cleared ? path.slice() : [], nodes, aborted };
}

/**
 * Ein guter Spieler ohne Blick in den Talon: er sucht die längste Kette nur aus den sichtbaren
 * Karten und spielt deren ersten Zug (bei Gleichstand die höhere Reihe). Sonst zieht er.
 */
export function fairPlay(st) {
  const ranks = st.cols.map((c) => c.map(rankOf));
  const sr = st.stock.map(rankOf);
  const wrap = st.wrap;
  const adj = (a, b) => { const d = a > b ? a - b : b - a; return d === 1 || (wrap && d === 12); };
  const h = st.h.slice();
  let ptr = st.ptr, top = rankOf(st.top);
  const moves = [];

  // längste Kette ab top (Tiefe begrenzt), gibt [Länge, erster Zug]
  function chain(depth) {
    if (depth === 0) return 0;
    let bestLen = 0;
    for (let c = 0; c < COLS; c++) {
      if (!h[c]) continue;
      const r = ranks[c][h[c] - 1];
      if (!adj(r, top)) continue;
      const t0 = top;
      h[c]--; top = r;
      const len = 1 + chain(depth - 1);
      h[c]++; top = t0;
      if (len > bestLen) bestLen = len;
    }
    return bestLen;
  }

  for (let guard = 0; guard < 80; guard++) {
    if (!h.some((x) => x)) break;
    let bestC = -1, bestLen = -1, bestH = -1;
    for (let c = 0; c < COLS; c++) {
      if (!h[c]) continue;
      const r = ranks[c][h[c] - 1];
      if (!adj(r, top)) continue;
      const t0 = top;
      h[c]--; top = r;
      const len = 1 + chain(6);
      h[c]++; top = t0;
      if (len > bestLen || (len === bestLen && h[c] > bestH)) { bestLen = len; bestC = c; bestH = h[c]; }
    }
    if (bestC >= 0) {
      moves.push({ t: 'play', c: bestC });
      top = ranks[bestC][h[bestC] - 1];
      h[bestC]--;
    } else if (ptr < STOCK) {
      moves.push({ t: 'draw' });
      top = sr[ptr];
      ptr++;
    } else break;
  }
  const total = h.reduce((a, b) => a + b, 0);
  return { score: total === 0 ? -(STOCK - ptr) : total, moves };
}
