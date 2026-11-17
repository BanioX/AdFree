// Spider-Löser (volle Information): gierige Bestensuche mit Heuristik.
// Gut geeignet für 1 Farbe (fast alle Partien lösbar), bei 2/4 Farben nur mit Glück.
// Ergebnis: { solved: true|false|null, nodes, moves? } – moves als Aktionen der Regel-Engine.

import { suitOf, rankOf, LAYOUTS, newDeal, cloneState, canDrop, doMove, stockAction } from './rules.js';
import { Heap } from './heap.js';

export function solveSpiderSeed(seed, suits = 1, opts = {}) {
  return solveSpider(newDeal('spider' + suits, seed), opts);
}

const seqOK = (a, b) => suitOf(a) === suitOf(b) && rankOf(a) === rankOf(b) + 1; // b liegt auf a

function runStart(a, d) {
  let m = a.length - 1;
  while (m > d && seqOK(a[m - 1], a[m])) m--;
  return m;
}

function keyOf(s) {
  const parts = s.cols.map((a, i) => String.fromCharCode(48 + s.down[i], ...a.map((c) => c + 60)));
  parts.sort();
  return s.dealt + ':' + parts.join('|');
}

function heuristic(s) {
  let h = 0;
  let cards = 0;
  for (let i = 0; i < 10; i++) {
    const a = s.cols[i];
    cards += a.length;
    h += s.down[i] * 4;
    if (!a.length) { h -= 3; continue; }
    for (let k = s.down[i] + 1; k < a.length; k++) {
      if (!seqOK(a[k - 1], a[k])) h += rankOf(a[k - 1]) === rankOf(a[k]) + 1 ? 1 : 2.5;
    }
  }
  h += cards * 0.15;
  h += (5 - s.dealt) * 6;
  return h;
}

/** Vollständige Folgen entfernen + aufdecken. */
function settle(s, i, rec) {
  const a = s.cols[i];
  if (a.length - s.down[i] >= 13) {
    const b = a.length - 13;
    let ok = rankOf(a[b]) === 13;
    for (let k = b + 1; ok && k < a.length; k++) ok = seqOK(a[k - 1], a[k]);
    if (ok) { a.splice(b, 13); s.done++; rec.push({ k: 'run', i }); }
  }
  if (s.down[i] > 0 && a.length === s.down[i]) s.down[i]--;
}

function clone(s) {
  return { cols: s.cols.map((a) => a.slice()), down: s.down.slice(), dealt: s.dealt, done: s.done };
}

export function solveSpider(st, { maxNodes = 40000, timeLimit = 0, wantMoves = false } = {}) {
  const L = LAYOUTS.spider;
  const stockIds = st.piles[L.stock];
  const stock = stockIds.map((id) => st.codes[id]); // letzte = nächste Karte
  const start = {
    cols: L.tab.map((p) => st.piles[p].map((id) => st.codes[id])),
    down: L.tab.map((p) => { const a = st.piles[p]; let d = 0; while (d < a.length && !st.up[a[d]]) d++; return d; }),
    dealt: 0,
    done: L.found.filter((p) => st.piles[p].length === 13).length,
  };
  const totalDeals = stock.length / 10;
  const t0 = Date.now();
  const open = new Heap();
  const seen = new Set([keyOf(start)]);
  open.push({ s: start, parent: null, mv: null, g: 0, f: heuristic(start) });
  let nodes = 0, goal = null, aborted = false, seq = 0;

  while (open.size) {
    const node = open.pop();
    const s = node.s;
    if (s.done === 8) { goal = node; break; }
    if (++nodes > maxNodes || (timeLimit && (nodes & 255) === 0 && Date.now() - t0 > timeLimit)) { aborted = true; break; }
    const kids = [];
    const push = (c, mv) => {
      const k = keyOf(c);
      if (seen.has(k)) return;
      seen.add(k);
      kids.push({ s: c, parent: node, mv, g: node.g + 1, f: 0 });
    };
    let firstEmpty = -1;
    for (let j = 0; j < 10; j++) if (!s.cols[j].length) { firstEmpty = j; break; }
    for (let i = 0; i < 10; i++) {
      const a = s.cols[i];
      if (a.length <= s.down[i]) continue;
      const m = runStart(a, s.down[i]);
      const topR = rankOf(a[a.length - 1]);
      for (let j = 0; j < 10; j++) {
        if (j === i) continue;
        const b = s.cols[j];
        let k;
        if (b.length) {
          const t = b[b.length - 1];
          const need = rankOf(t) - 1;
          if (need < topR) continue;
          k = a.length - 1 - (need - topR);
          if (k < m) continue;
          // Nutzen prüfen
          if (k > s.down[i]) {
            const base = a[k - 1];
            if (rankOf(base) === rankOf(a[k]) + 1) {
              if (suitOf(base) === suitOf(a[k])) continue; // natürliche Folge nicht trennen
              if (suitOf(t) !== suitOf(a[k])) continue;     // nur seitwärts
            }
          }
        } else {
          if (j !== firstEmpty) continue;
          k = m;
          if (k === 0) continue; // ganze Spalte in leere Spalte: sinnlos
        }
        const n = a.length - k;
        const c = clone(s);
        const moved = c.cols[i].splice(k, n);
        c.cols[j].push(...moved);
        const rec = [];
        settle(c, i, rec);
        settle(c, j, rec);
        push(c, { k: 'mv', i, j, n, rec });
      }
    }
    // Geben
    if (s.dealt < totalDeals) {
      let cards = 0;
      for (const a of s.cols) cards += a.length;
      if (firstEmpty < 0 || cards < 10) {
        const c = clone(s);
        const base = stock.length - s.dealt * 10;
        for (let j = 0; j < 10; j++) c.cols[j].push(stock[base - 1 - j]);
        c.dealt++;
        const rec = [];
        for (let j = 0; j < 10; j++) settle(c, j, rec);
        push(c, { k: 'deal', rec });
      }
    }
    for (const ch of kids) {
      ch.f = heuristic(ch.s) + ch.g * 0.05 + (seq++) * 1e-9;
      open.push(ch);
    }
  }
  const res = { solved: goal ? true : aborted ? null : false, nodes };
  if (goal && wantMoves) {
    const chain = [];
    for (let n = goal; n && n.mv; n = n.parent) chain.push(n.mv);
    chain.reverse();
    res.moves = toActions(st, chain);
  }
  return res;
}

function toActions(st0, chain) {
  const st = cloneState(st0);
  const L = LAYOUTS.spider;
  const out = [];
  for (const m of chain) {
    if (m.k === 'deal') {
      const r = stockAction(st);
      if (r.error) throw new Error('Geben nicht möglich');
      out.push({ t: 'stock' });
    } else {
      const from = L.tab[m.i], to = L.tab[m.j];
      const index = st.piles[from].length - m.n;
      if (!canDrop(st, from, index, to)) throw new Error('ungültiger Lösungszug');
      out.push({ t: 'move', from, index, to });
      doMove(st, from, index, to);
    }
  }
  return out;
}
