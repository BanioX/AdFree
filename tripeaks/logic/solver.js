// Gipfel – Löser (Tiefensuche mit Gedächtnis, rein, ohne DOM).
//
//   solve(state, { maxNodes }) -> { solved, moves, nodes, aborted, bestMoves, bestCleared }
//
// Findet einen Weg, alle Gipfel abzuräumen. Gelingt das nicht, liefert er den Weg mit den meisten
// abgeräumten Karten (für Tipps in verfahrenen Stellungen).

import { rankOf, popcount } from '../../lib/cards/deck.js';
import { TAB, STOCK, FULL, COVER_MASK, ROW } from './rules.js';

/** Karten, die i bedeckt (eine Reihe höher) */
const PARENTS = Array.from({ length: TAB }, (_, i) => {
  const out = [];
  for (let p = 0; p < TAB; p++) if (COVER_MASK[p] & (1 << i)) out.push(p);
  return out;
});

export function solve(st, { maxNodes = 150000 } = {}) {
  const tr = st.tab.map(rankOf);
  const sr = st.stock.map(rankOf);
  const wrap = st.wrap;
  const adj = (a, b) => { const d = a > b ? a - b : b - a; return d === 1 || (wrap && d === 12); };
  // Wie viele Karten unter (bedecken) i noch liegen – tiefer = wichtiger
  const seen = new Set();
  const path = [];
  let nodes = 0;
  let aborted = false;
  let bestCleared = -1;
  let bestMoves = [];

  function dfs(tm, ptr, top) {
    if (tm === FULL) return true;
    if (aborted) return false;
    if (++nodes > maxNodes) { aborted = true; return false; }
    const key = tm * 32 + ptr + ':' + top;
    if (seen.has(key)) return false;
    seen.add(key);
    const cleared = popcount(tm);
    if (cleared > bestCleared) { bestCleared = cleared; bestMoves = path.slice(); }

    // Spielbare Karten: höhere Reihen (Gipfel) zuerst, dann solche, die etwas freilegen
    const cand = [];
    for (let i = 0; i < TAB; i++) {
      if (tm & (1 << i)) continue;
      if ((tm & COVER_MASK[i]) !== COVER_MASK[i]) continue;
      if (adj(tr[i], top)) cand.push(i);
    }
    if (cand.length > 1) {
      // Karten, die eine weitere Karte freilegen, und solche mit Anschluss zuerst
      const score = (i) => {
        const tm2 = tm | (1 << i);
        let s = 0;
        for (const p of PARENTS[i]) if (!(tm2 & (1 << p)) && (tm2 & COVER_MASK[p]) === COVER_MASK[p]) s += 4;
        for (let j = 0; j < TAB; j++) {
          if (j === i || (tm2 & (1 << j)) || (tm2 & COVER_MASK[j]) !== COVER_MASK[j]) continue;
          if (adj(tr[j], tr[i])) s += 1;
        }
        return s - ROW[i] * 0.5;
      };
      const sc = new Map(cand.map((i) => [i, score(i)]));
      cand.sort((a, b) => sc.get(b) - sc.get(a));
    }
    for (const i of cand) {
      path.push({ t: 'play', i });
      if (dfs(tm | (1 << i), ptr, tr[i])) return true;
      path.pop();
      if (aborted) return false;
    }
    if (ptr < STOCK) {
      path.push({ t: 'draw' });
      if (dfs(tm, ptr + 1, sr[ptr])) return true;
      path.pop();
    }
    return false;
  }

  const solved = dfs(st.tm, st.ptr, rankOf(st.top));
  return { solved, moves: solved ? path.slice() : [], nodes, aborted, bestMoves, bestCleared };
}
