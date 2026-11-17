// FreeCell-Löser: gierige Bestensuche mit Heuristik, sicheren Auto-Ablagen und
// Supermoves (Folgen, so lang wie freie Zellen/Spalten erlauben).
// Ergebnis: { solved: true|false|null, nodes, moves? } – moves als Aktionen der Regel-Engine.

import { suitOf, rankOf, LAYOUTS, newDeal, cloneState, canDrop, doMove } from './rules.js';
import { Heap } from './heap.js';

const RED = (c) => ((((c / 13) | 0) & 1) === 1);
const fits = (a, b) => rankOf(b) === rankOf(a) + 1 && RED(a) !== RED(b);

export function solveFreecellSeed(seed, opts = {}) {
  return solveFreecell(newDeal('freecell', seed), opts);
}

function safe(found, c) {
  const r = rankOf(c);
  if (r <= 2) return true;
  const red = RED(c);
  for (let s = 0; s < 4; s++) if (((s & 1) === 1) !== red && found[s] < r - 1) return false;
  return true;
}

function keyOf(s) {
  const parts = s.cols.map((a) => String.fromCharCode(...a.map((c) => c + 48)));
  parts.sort();
  const cells = s.cells.filter((c) => c >= 0).sort((x, y) => x - y);
  return parts.join('|') + '#' + String.fromCharCode(...cells.map((c) => c + 48));
}

function heuristic(s) {
  let h = 0;
  const fTotal = s.found[0] + s.found[1] + s.found[2] + s.found[3];
  h += (52 - fTotal) * 1.0;
  for (const a of s.cols) {
    // Karten über einer niedrigeren Karte blockieren diese
    let minR = 99;
    for (let k = 0; k < a.length; k++) {
      const r = rankOf(a[k]);
      if (r > minR) h += 1.5;
      if (r < minR) minR = r;
    }
    if (!a.length) h -= 1.2;
  }
  for (const c of s.cells) if (c >= 0) h += 0.6;
  return h;
}

/** Wendet sichere Ablagen an; liefert Liste [{from:'c'|'x', i}] */
function autoPlay(s, rec) {
  let again = true;
  while (again) {
    again = false;
    for (let i = 0; i < 8; i++) {
      const a = s.cols[i];
      if (!a.length) continue;
      const c = a[a.length - 1];
      if (s.found[suitOf(c)] === rankOf(c) - 1 && safe(s.found, c)) {
        a.pop(); s.found[suitOf(c)]++; rec.push({ k: 'cf', i }); again = true;
      }
    }
    for (let i = 0; i < 4; i++) {
      const c = s.cells[i];
      if (c < 0) continue;
      if (s.found[suitOf(c)] === rankOf(c) - 1 && safe(s.found, c)) {
        s.cells[i] = -1; s.found[suitOf(c)]++; rec.push({ k: 'xf', i }); again = true;
      }
    }
  }
}

function clone(s) {
  return { cols: s.cols.map((a) => a.slice()), cells: s.cells.slice(), found: s.found.slice() };
}

export function solveFreecell(st, { maxNodes = 60000, timeLimit = 0, wantMoves = false } = {}) {
  const L = LAYOUTS.freecell;
  const start = {
    cols: L.tab.map((p) => st.piles[p].map((id) => st.codes[id])),
    cells: L.cells.map((p) => (st.piles[p].length ? st.codes[st.piles[p][0]] : -1)),
    found: [0, 0, 0, 0],
  };
  for (const p of L.found) if (st.piles[p].length) start.found[suitOf(st.codes[st.piles[p][0]])] = st.piles[p].length;
  const t0 = Date.now();
  const rec0 = [];
  autoPlay(start, rec0);
  const root = { s: start, parent: null, moves: rec0, f: heuristic(start), g: 0 };
  const open = new Heap();
  const seen = new Set([keyOf(start)]);
  open.push(root);
  let nodes = 0;
  let goal = null;
  let aborted = false;
  let seq = 0;

  while (open.size) {
    const node = open.pop();
    const s = node.s;
    if (s.found[0] + s.found[1] + s.found[2] + s.found[3] === 52) { goal = node; break; }
    if (++nodes > maxNodes || (timeLimit && (nodes & 255) === 0 && Date.now() - t0 > timeLimit)) { aborted = true; break; }
    const freeCells = s.cells.filter((c) => c < 0).length;
    let emptyCols = 0;
    for (const a of s.cols) if (!a.length) emptyCols++;
    const children = [];
    const add = (mv, mutate) => {
      const c = clone(s);
      mutate(c);
      const rec = [mv];
      autoPlay(c, rec);
      const k = keyOf(c);
      if (seen.has(k)) return;
      seen.add(k);
      children.push({ s: c, parent: node, moves: rec, g: node.g + 1, f: 0 });
    };
    // Spalte/Zelle → Ablage
    for (let i = 0; i < 8; i++) {
      const a = s.cols[i];
      if (a.length) {
        const c = a[a.length - 1];
        if (s.found[suitOf(c)] === rankOf(c) - 1) add({ k: 'cf', i }, (x) => { x.cols[i].pop(); x.found[suitOf(c)]++; });
      }
    }
    for (let i = 0; i < 4; i++) {
      const c = s.cells[i];
      if (c >= 0 && s.found[suitOf(c)] === rankOf(c) - 1) add({ k: 'xf', i }, (x) => { x.cells[i] = -1; x.found[suitOf(c)]++; });
    }
    // Spalte → Spalte
    for (let i = 0; i < 8; i++) {
      const a = s.cols[i];
      if (!a.length) continue;
      let runStart = a.length - 1;
      while (runStart > 0 && fits(a[runStart], a[runStart - 1])) runStart--;
      let firstEmptyDone = false;
      for (let j = 0; j < 8; j++) {
        if (j === i) continue;
        const b = s.cols[j];
        if (b.length) {
          const t = b[b.length - 1];
          const need = rankOf(t) - 1;
          const k = a.length - (rankOf(a[a.length - 1]) <= need ? need - rankOf(a[a.length - 1]) + 1 : 0);
          if (k < runStart || k >= a.length) continue;
          if (!fits(a[k], t)) continue;
          const n = a.length - k;
          if (n > (freeCells + 1) * (1 << emptyCols)) continue;
          add({ k: 'cc', i, j, n }, (x) => { const m = x.cols[i].splice(k, n); x.cols[j].push(...m); });
        } else if (!firstEmptyDone) {
          firstEmptyDone = true;
          const maxN = (freeCells + 1) * (1 << Math.max(0, emptyCols - 1));
          let n = Math.min(a.length - runStart, maxN);
          if (n === a.length) n--; // ganze Spalte verschieben ist sinnlos
          if (n >= 1) add({ k: 'cc', i, j, n }, (x) => { const m = x.cols[i].splice(x.cols[i].length - n, n); x.cols[j].push(...m); });
          if (n > 1) add({ k: 'cc', i, j, n: 1 }, (x) => { x.cols[j].push(x.cols[i].pop()); });
        }
      }
    }
    // Zelle → Spalte
    for (let i = 0; i < 4; i++) {
      const c = s.cells[i];
      if (c < 0) continue;
      let emptyDone = false;
      for (let j = 0; j < 8; j++) {
        const b = s.cols[j];
        if (b.length ? fits(c, b[b.length - 1]) : !emptyDone) {
          if (!b.length) emptyDone = true;
          add({ k: 'xc', i, j }, (x) => { x.cells[i] = -1; x.cols[j].push(c); });
        }
      }
    }
    // Spalte → Zelle
    if (freeCells) {
      const ci = s.cells.indexOf(-1);
      for (let i = 0; i < 8; i++) {
        const a = s.cols[i];
        if (!a.length) continue;
        add({ k: 'cx', i, j: ci }, (x) => { x.cells[ci] = x.cols[i].pop(); });
      }
    }
    for (const ch of children) {
      ch.f = heuristic(ch.s) + ch.g * 0.02 + (seq++) * 1e-9;
      open.push(ch);
    }
  }
  const res = { solved: goal ? true : aborted ? null : false, nodes };
  if (goal && wantMoves) {
    const chain = [];
    for (let n = goal; n; n = n.parent) chain.push(n.moves);
    chain.reverse();
    res.moves = toActions(st, chain.flat());
  }
  return res;
}

function toActions(st0, list) {
  const st = cloneState(st0);
  const L = LAYOUTS.freecell;
  const out = [];
  const play = (from, index, to) => {
    if (!canDrop(st, from, index, to)) throw new Error('ungültiger Lösungszug');
    out.push({ t: 'move', from, index, to });
    doMove(st, from, index, to);
  };
  const toFound = (from) => {
    const i = st.piles[from].length - 1;
    for (const t of L.found) if (st.piles[t].length && canDrop(st, from, i, t)) return play(from, i, t);
    for (const t of L.found) if (canDrop(st, from, i, t)) return play(from, i, t);
    throw new Error('kein Ablageplatz');
  };
  for (const m of list) {
    switch (m.k) {
      case 'cf': toFound(L.tab[m.i]); break;
      case 'xf': toFound(L.cells[m.i]); break;
      case 'cc': play(L.tab[m.i], st.piles[L.tab[m.i]].length - m.n, L.tab[m.j]); break;
      case 'xc': play(L.cells[m.i], 0, L.tab[m.j]); break;
      case 'cx': play(L.tab[m.i], st.piles[L.tab[m.i]].length - 1, L.cells[m.j]); break;
    }
  }
  return out;
}
