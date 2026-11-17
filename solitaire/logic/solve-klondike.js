// Klondike-Löser (volle Information, "Thoughtful"): beweist, dass eine Partie gewinnbar ist.
//
// Tiefensuche mit
//  - Talon-Makrozügen: jede erreichbare Talon-Karte direkt spielbar (Ziehen/Umdrehen implizit),
//  - automatischem Ablegen "sicherer" Karten (ohne Verzweigung),
//  - Zug-Reihenfolge nach Nutzen und Transpositionstabelle (Hash der kanonischen Stellung).
//
// Ergebnis: { solved: true|false|null, nodes, moves? }  (null = Limit erreicht, unbekannt)
// moves (wenn wantMoves) = Aktionen für die Regel-Engine: {t:'stock'} | {t:'move', from, index, to}

import { suitOf, rankOf, LAYOUTS, newDeal, cloneState, canDrop, stockAction, doMove, top } from './rules.js';

const RED = (c) => ((((c / 13) | 0) & 1) === 1);
const fitsTab = (a, b) => rankOf(b) === rankOf(a) + 1 && RED(a) !== RED(b);

export function solveKlondikeSeed(seed, draw = 1, opts = {}) {
  return solveKlondike(newDeal(draw === 3 ? 'klondike3' : 'klondike1', seed), opts);
}

export function solveKlondike(st, { maxNodes = 150000, timeLimit = 0, wantMoves = false } = {}) {
  const L = LAYOUTS.klondike;
  const draw = st.draw || 1;
  const found = [0, 0, 0, 0];
  for (const p of L.found) {
    const a = st.piles[p];
    if (a.length) found[suitOf(st.codes[a[0]])] = a.length;
  }
  const cols = [], down = [];
  for (const p of L.tab) {
    const a = st.piles[p];
    cols.push(a.map((id) => st.codes[id]));
    let d = 0;
    while (d < a.length && !st.up[a[d]]) d++;
    down.push(d);
  }
  const waste = st.piles[L.waste].map((id) => st.codes[id]);
  const stock = st.piles[L.stock].map((id) => st.codes[id]);
  const T = [...waste, ...stock.reverse()];
  let pos = waste.length;

  const seen = new Set();
  const path = [];
  let nodes = 0;
  let aborted = false;
  const t0 = Date.now();

  const canFound = (c) => found[suitOf(c)] === rankOf(c) - 1;
  const safe = (c) => {
    const r = rankOf(c);
    if (r <= 2) return true;
    const red = RED(c);
    for (let s = 0; s < 4; s++) if (((s & 1) === 1) !== red && found[s] < r - 1) return false;
    return true;
  };

  function fixFlip(c) {
    if (down[c] > 0 && cols[c].length === down[c]) { down[c]--; return true; }
    return false;
  }

  // ---- Talon-Erreichbarkeit
  function reachable() {
    const n = T.length;
    const out = [];
    if (!n) return out;
    if (draw === 1) {
      if (pos > 0) out.push(pos - 1);
      for (let j = pos; j < n; j++) out.push(j);
      for (let j = 0; j < pos - 1; j++) out.push(j);
      return out;
    }
    const mark = new Uint8Array(n);
    const add = (j) => { if (j >= 0 && !mark[j]) { mark[j] = 1; out.push(j); } };
    if (pos > 0) add(pos - 1);
    for (let k = pos + 3; ; k += 3) { add(Math.min(k, n) - 1); if (k >= n) break; }
    for (let k = 3; ; k += 3) { add(Math.min(k, n) - 1); if (k >= n) break; }
    return out;
  }

  // ---- Hash der kanonischen Stellung (Spalten sortiert)
  const colH = new Array(7);
  function key() {
    for (let c = 0; c < 7; c++) {
      let h = (0x811c9dc5 ^ (down[c] * 131)) >>> 0;
      const a = cols[c];
      for (let k = 0; k < a.length; k++) h = Math.imul(h ^ (a[k] + 1), 0x01000193);
      colH[c] = h >>> 0;
    }
    const hs = colH.slice().sort((x, y) => x - y);
    let h1 = 0x12345678 ^ pos, h2 = 0x9e3779b9 ^ (pos * 7919);
    for (let c = 0; c < 7; c++) {
      h1 = Math.imul(h1 ^ hs[c], 0x85ebca6b); h1 ^= h1 >>> 13;
      h2 = Math.imul(h2 + hs[c], 0xc2b2ae35); h2 ^= h2 >>> 16;
    }
    for (let k = 0; k < T.length; k++) {
      h1 = Math.imul(h1 ^ (T[k] + 77), 0x27d4eb2d); h1 ^= h1 >>> 15;
      h2 = Math.imul(h2 + T[k] * 31 + 5, 0x165667b1); h2 ^= h2 >>> 13;
    }
    return (h1 >>> 0) * 2097152 + ((h2 >>> 0) & 0x1fffff);
  }

  // ---- Automatisches Ablegen sicherer Karten; liefert Undo-Liste
  function autoPlay() {
    const rec = [];
    let again = true;
    while (again) {
      again = false;
      for (let c = 0; c < 7; c++) {
        const a = cols[c];
        if (a.length > down[c]) {
          const card = a[a.length - 1];
          if (canFound(card) && safe(card)) {
            a.pop(); found[suitOf(card)]++;
            rec.push({ c, card, fl: fixFlip(c) });
            again = true;
          }
        }
      }
      if (pos > 0) {
        const card = T[pos - 1];
        if (canFound(card) && safe(card)) {
          T.splice(pos - 1, 1); pos--; found[suitOf(card)]++;
          rec.push({ c: -1, card, j: pos, oldPos: pos + 1 });
          again = true;
        }
      }
    }
    return rec;
  }
  function undoAuto(rec) {
    for (let k = rec.length - 1; k >= 0; k--) {
      const r = rec[k];
      found[suitOf(r.card)]--;
      if (r.c >= 0) { if (r.fl) down[r.c]++; cols[r.c].push(r.card); }
      else { T.splice(r.j, 0, r.card); pos = r.oldPos; }
    }
  }

  // ---- Züge
  // m = { k:'tf'|'wf'|'tt'|'wt'|'ft', ... }
  function apply(m) {
    switch (m.k) {
      case 'tf': { const card = cols[m.c].pop(); found[suitOf(card)]++; m.fl = fixFlip(m.c); m.card = card; break; }
      case 'wf': { const card = T[m.j]; T.splice(m.j, 1); m.oldPos = pos; pos = m.j; found[suitOf(card)]++; m.card = card; break; }
      case 'tt': {
        const a = cols[m.from];
        const moved = a.splice(m.start, a.length - m.start);
        for (const x of moved) cols[m.to].push(x);
        m.n = moved.length; m.fl = fixFlip(m.from);
        break;
      }
      case 'wt': { const card = T[m.j]; T.splice(m.j, 1); m.oldPos = pos; pos = m.j; cols[m.to].push(card); m.card = card; break; }
      case 'ft': { found[m.s]--; cols[m.to].push(m.s * 13 + found[m.s]); break; }
    }
    m.auto = autoPlay();
  }
  function undo(m) {
    undoAuto(m.auto);
    switch (m.k) {
      case 'tf': { if (m.fl) down[m.c]++; found[suitOf(m.card)]--; cols[m.c].push(m.card); break; }
      case 'wf': { found[suitOf(m.card)]--; T.splice(m.j, 0, m.card); pos = m.oldPos; break; }
      case 'tt': {
        if (m.fl) down[m.from]++;
        const a = cols[m.to];
        const moved = a.splice(a.length - m.n, m.n);
        for (const x of moved) cols[m.from].push(x);
        break;
      }
      case 'wt': { cols[m.to].pop(); T.splice(m.j, 0, m.card); pos = m.oldPos; break; }
      case 'ft': { cols[m.to].pop(); found[m.s]++; break; }
    }
  }

  function genMoves() {
    const out = [];
    const reach = reachable();
    let firstEmpty = -1;
    for (let c = 0; c < 7; c++) if (!cols[c].length) { firstEmpty = c; break; }
    // 1) Spalte → Ablage
    for (let c = 0; c < 7; c++) {
      const a = cols[c];
      if (a.length > down[c] && canFound(a[a.length - 1])) out.push({ k: 'tf', c, pr: 100 + down[c] });
    }
    // 2) Talon → Ablage
    for (const j of reach) if (canFound(T[j])) out.push({ k: 'wf', j, pr: 90 });
    // 3) Spalte → Spalte (ganze offene Folge: deckt auf oder leert)
    for (let c = 0; c < 7; c++) {
      const a = cols[c];
      if (a.length <= down[c]) continue;
      const u = down[c];
      const card = a[u];
      const isKing = rankOf(card) === 13;
      for (let t = 0; t < 7; t++) {
        if (t === c) continue;
        const b = cols[t];
        if (!b.length) {
          if (isKing && u > 0 && t === firstEmpty) out.push({ k: 'tt', from: c, start: u, to: t, pr: 60 + down[c] });
        } else if (fitsTab(card, b[b.length - 1])) {
          out.push({ k: 'tt', from: c, start: u, to: t, pr: u > 0 ? 70 + down[c] : 40 });
        }
      }
      // Teilfolgen: nur wenn die freigelegte Karte dann abgelegt werden kann
      for (let s = u + 1; s < a.length; s++) {
        if (!canFound(a[s - 1])) continue;
        for (let t = 0; t < 7; t++) {
          if (t === c) continue;
          const b = cols[t];
          if (b.length ? fitsTab(a[s], b[b.length - 1]) : (rankOf(a[s]) === 13 && t === firstEmpty)) {
            out.push({ k: 'tt', from: c, start: s, to: t, pr: 30 });
          }
        }
      }
    }
    // 4) Talon → Spalte
    for (const j of reach) {
      const card = T[j];
      const isKing = rankOf(card) === 13;
      for (let t = 0; t < 7; t++) {
        const b = cols[t];
        if (!b.length) { if (isKing && t === firstEmpty) out.push({ k: 'wt', j, to: t, pr: 50 }); }
        else if (fitsTab(card, b[b.length - 1])) out.push({ k: 'wt', j, to: t, pr: 55 });
      }
    }
    // 5) Ablage → Spalte (selten nötig)
    for (let s = 0; s < 4; s++) {
      if (found[s] < 3) continue;
      const card = s * 13 + found[s] - 1;
      if (safe(card)) continue;
      for (let t = 0; t < 7; t++) {
        const b = cols[t];
        if (b.length && b.length > down[t] && fitsTab(card, b[b.length - 1])) out.push({ k: 'ft', s, to: t, pr: 5 });
      }
    }
    out.sort((x, y) => y.pr - x.pr);
    return out;
  }

  function won() { return found[0] + found[1] + found[2] + found[3] === 52; }
  function trivial() {
    for (let c = 0; c < 7; c++) if (down[c] > 0) return false;
    return T.length === 0 || draw === 1;
  }

  function dfs() {
    if (aborted) return false;
    nodes++;
    if (nodes > maxNodes || (timeLimit && (nodes & 511) === 0 && Date.now() - t0 > timeLimit)) { aborted = true; return false; }
    if (won() || trivial()) return true;
    const k = key();
    if (seen.has(k)) return false;
    seen.add(k);
    const moves = genMoves();
    for (const m of moves) {
      apply(m);
      path.push(m);
      if (dfs()) return true;
      path.pop();
      undo(m);
      if (aborted) return false;
    }
    return false;
  }

  const startAuto = autoPlay();
  const ok = dfs();
  const res = { solved: ok ? true : aborted ? null : false, nodes };
  if (ok && wantMoves) res.moves = toActions(st, startAuto, path);
  return res;
}

/**
 * Übersetzt die Löser-Züge in Aktionen der Regel-Engine (durch Nachspielen auf einer Kopie).
 * Am Ende werden alle restlichen Karten gierig abgelegt.
 */
function toActions(st0, startAuto, path) {
  const st = cloneState(st0);
  const L = LAYOUTS.klondike;
  const out = [];
  const idOf = (code) => st.codes.indexOf(code); // Klondike: id === code
  const play = (from, index, to) => {
    if (!canDrop(st, from, index, to)) throw new Error('ungültiger Lösungszug');
    out.push({ t: 'move', from, index, to });
    doMove(st, from, index, to);
  };
  const toFound = (from) => {
    const a = st.piles[from];
    const i = a.length - 1;
    for (const t of L.found) if (st.piles[t].length && canDrop(st, from, i, t)) return play(from, i, t);
    for (const t of L.found) if (canDrop(st, from, i, t)) return play(from, i, t);
    throw new Error('kein Ablageplatz');
  };
  const bringToWaste = (code) => {
    const id = idOf(code);
    let guard = 0;
    while (top(st, L.waste) !== id) {
      if (++guard > 200) throw new Error('Talonkarte nicht erreichbar');
      const r = stockAction(st);
      if (r.error) throw new Error('Talon leer');
      out.push({ t: 'stock' });
    }
  };
  const tabOfCode = (code) => L.tab.find((p) => st.piles[p].includes(idOf(code)));
  const autoSeq = (rec) => {
    for (const r of rec) {
      if (r.c >= 0) toFound(tabOfCode(r.card));
      else { bringToWaste(r.card); toFound(L.waste); }
    }
  };
  // Spalten im Löser haben dieselbe Reihenfolge wie L.tab
  autoSeq(startAuto);
  for (const m of path) {
    switch (m.k) {
      case 'tf': toFound(L.tab[m.c]); break;
      case 'wf': bringToWaste(m.card); toFound(L.waste); break;
      case 'tt': play(L.tab[m.from], m.start, L.tab[m.to]); break;
      case 'wt': bringToWaste(m.card); play(L.waste, st.piles[L.waste].length - 1, L.tab[m.to]); break;
      case 'ft': {
        const p = L.found.find((q) => st.piles[q].length && suitOf(st.codes[st.piles[q][0]]) === m.s);
        play(p, st.piles[p].length - 1, L.tab[m.to]);
        break;
      }
    }
    autoSeq(m.auto);
  }
  // Rest gierig ablegen (alle Spaltenkarten offen)
  let guard = 0;
  while (L.found.some((p) => st.piles[p].length < 13)) {
    if (++guard > 6000) throw new Error('Abschluss fehlgeschlagen');
    let moved = false;
    for (const p of [...L.tab, L.waste]) {
      const a = st.piles[p];
      if (!a.length) continue;
      const i = a.length - 1;
      if (L.found.some((t) => canDrop(st, p, i, t))) { toFound(p); moved = true; break; }
    }
    if (moved) continue;
    const r = stockAction(st);
    if (r.error) throw new Error('festgefahren');
    out.push({ t: 'stock' });
  }
  return out;
}
