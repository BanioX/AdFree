// Pyramide – Löser (Tiefensuche mit Gedächtnis, rein, ohne DOM).
//
//   solve(state, { maxNodes }) -> { solved, moves, nodes, aborted }
//
// Kniffe: Könige werden sofort abgeräumt (nie schlechter); eine Pyramidenkarte, für die kein
// erreichbarer Partner mehr existiert (Partner nur noch in ihrem eigenen Kegel oder darüber),
// macht die Stellung unlösbar.

import { rankOf } from '../../lib/cards/deck.js';
import { PYR, STOCK, WASTE, FULL, COVER_MASK, CONE, ABOVE } from './rules.js';

export function solve(st, { maxNodes = 200000 } = {}) {
  const pr = st.pyr.map(rankOf);
  const sr = st.stock.map(rankOf);
  const maxRed = st.maxRed;
  const blocked = CONE.map((c, i) => c | ABOVE[i]);
  const byRank = Array.from({ length: 14 }, () => []);
  pr.forEach((r, i) => byRank[r].push(i));
  const seen = new Set();
  const path = [];
  let nodes = 0;
  let aborted = false;

  const top = (sm, ptr) => {
    for (let j = ptr - 1; j >= 0; j--) if (!(sm & (1 << j))) return j;
    return -1;
  };

  function dead(pm, sm) {
    for (let i = 0; i < PYR; i++) {
      if (pm & (1 << i)) continue;
      const r = pr[i];
      if (r === 13) continue;
      const need = 13 - r;
      let ok = false;
      for (const j of byRank[need]) {
        if (pm & (1 << j)) continue;
        if (blocked[i] & (1 << j)) continue;
        ok = true; break;
      }
      if (!ok) {
        for (let j = 0; j < STOCK; j++) if (sr[j] === need && !(sm & (1 << j))) { ok = true; break; }
      }
      if (!ok) return true;
    }
    return false;
  }

  function dfs(pm, sm, ptr, red) {
    if (pm === FULL) return true;
    if (aborted) return false;
    if (++nodes > maxNodes) { aborted = true; return false; }
    const key = pm + ':' + sm + ':' + ptr + ':' + red;
    if (seen.has(key)) return false;
    seen.add(key);

    // Freie Karten
    const free = [];
    for (let i = 0; i < PYR; i++) {
      if (pm & (1 << i)) continue;
      if ((pm & COVER_MASK[i]) === COVER_MASK[i]) free.push(i);
    }
    const w = top(sm, ptr);

    // Könige: sofort
    for (const i of free) {
      if (pr[i] === 13) {
        path.push({ t: 'rm', a: i });
        if (dfs(pm | (1 << i), sm, ptr, red)) return true;
        path.pop();
        return false;
      }
    }
    if (w >= 0 && sr[w] === 13) {
      path.push({ t: 'rm', a: WASTE });
      if (dfs(pm, sm | (1 << w), ptr, red)) return true;
      path.pop();
      return false;
    }

    if (dead(pm, sm)) return false;

    // Paare in der Pyramide (tiefere Reihen zuerst – sie geben mehr frei)
    for (let x = free.length - 1; x >= 0; x--) {
      const a = free[x];
      for (let y = x - 1; y >= 0; y--) {
        const b = free[y];
        if (pr[a] + pr[b] !== 13) continue;
        path.push({ t: 'rm', a: b, b: a });
        if (dfs(pm | (1 << a) | (1 << b), sm, ptr, red)) return true;
        path.pop();
        if (aborted) return false;
      }
    }
    // Ablage + Pyramide
    if (w >= 0) {
      for (let x = free.length - 1; x >= 0; x--) {
        const a = free[x];
        if (pr[a] + sr[w] !== 13) continue;
        path.push({ t: 'rm', a, b: WASTE });
        if (dfs(pm | (1 << a), sm | (1 << w), ptr, red)) return true;
        path.pop();
        if (aborted) return false;
      }
    }
    // Karte ziehen
    let j = ptr;
    while (j < STOCK && (sm & (1 << j))) j++;
    if (j < STOCK) {
      path.push({ t: 'draw' });
      if (dfs(pm, sm, j + 1, red)) return true;
      path.pop();
    } else if (red < maxRed && w >= 0) {
      path.push({ t: 'redeal' });
      if (dfs(pm, sm, 0, red + 1)) return true;
      path.pop();
    }
    return false;
  }

  const solved = dfs(st.pm, st.sm, st.ptr, st.red);
  return { solved, moves: solved ? path.slice() : [], nodes, aborted };
}
