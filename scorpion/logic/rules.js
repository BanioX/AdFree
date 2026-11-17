// Skorpion – Regeln (reine Logik, ohne DOM).
//
// Zustand (unveränderlich behandelt):
//   { cols: number[7][]  Kartencodes von unten nach oben,
//     down: number[7]    Anzahl verdeckter Karten unten in jeder Spalte,
//     stock: number[]    Reserve (3 Karten, einmal austeilbar),
//     done: number[]     fertige Farbreihen (Farbe in der Reihenfolge des Abräumens) }
//
// Züge:  { t: 'm', from, idx, to }  offene Karte cols[from][idx] samt allem darüber auf Spalte to
//        { t: 'd' }                 Reserve austeilen: je eine Karte auf die Spalten 1–3
//
// Regeln: Bauen abwärts in derselben Farbe; jede offene Karte darf samt allem, was darauf liegt,
// bewegt werden. Leere Spalten nehmen nur Könige. Eine vollständige Reihe König … Ass derselben
// Farbe wird sofort abgeräumt.

import { shuffledDeck, suitOf, rankOf } from '../../lib/cards/deck.js';

export const COLS = 7;
export const RESERVE = 3;

export const fits = (a, b) => suitOf(a) === suitOf(b) && rankOf(b) === rankOf(a) + 1;

/** Austeilen: 7 × 7 Karten, in den Spalten 1–4 je 3 verdeckt (open: alle offen), 3 Karten Reserve. */
export function dealDeck(deck, open = false) {
  const cols = [];
  const down = [];
  for (let c = 0; c < COLS; c++) {
    cols.push(deck.slice(c * 7, c * 7 + 7));
    down.push(!open && c < 4 ? 3 : 0);
  }
  return { cols, down, stock: deck.slice(49), done: [] };
}

export function dealSeed(seed, open = false) {
  return dealDeck(shuffledDeck(seed), open);
}

export function canMove(st, from, idx, to) {
  if (from === to || to < 0 || to >= COLS || from < 0 || from >= COLS) return false;
  const src = st.cols[from];
  if (idx < st.down[from] || idx >= src.length) return false;
  const a = src[idx];
  const dst = st.cols[to];
  if (!dst.length) return rankOf(a) === 13;
  return fits(a, dst[dst.length - 1]);
}

export const canDeal = (st) => st.stock.length > 0;

export function isLegal(st, m) {
  if (!m) return false;
  if (m.t === 'm') return canMove(st, m.from, m.idx, m.to);
  if (m.t === 'd') return canDeal(st);
  return false;
}

export function step(st, m) {
  const cols = st.cols.slice();
  if (m.t === 'd') {
    st.stock.forEach((x, i) => { cols[i] = cols[i].concat([x]); });
    return { ...st, cols, stock: [] };
  }
  const src = cols[m.from];
  cols[m.to] = cols[m.to].concat(src.slice(m.idx));
  cols[m.from] = src.slice(0, m.idx);
  return { ...st, cols };
}

/** Liegt oben auf der Spalte eine vollständige offene Reihe König … Ass derselben Farbe? */
export function completeRun(st, c) {
  const col = st.cols[c];
  const n = col.length;
  if (n < 13 || n - 13 < st.down[c]) return false;
  const k = col[n - 13];
  if (rankOf(k) !== 13) return false;
  for (let i = n - 12; i < n; i++) if (!fits(col[i], col[i - 1])) return false;
  return true;
}

/** Fertige Reihen abräumen, dann verdeckte Karten aufdecken. */
export function settle(st) {
  let out = st;
  for (let c = 0; c < COLS; c++) {
    if (completeRun(out, c)) {
      const cols = out.cols.slice();
      const col = cols[c];
      const s = suitOf(col[col.length - 1]);
      cols[c] = col.slice(0, col.length - 13);
      out = { ...out, cols, done: out.done.concat([s]) };
    }
  }
  let down = null;
  for (let c = 0; c < COLS; c++) {
    if (out.down[c] > 0 && out.cols[c].length === out.down[c]) {
      if (!down) down = out.down.slice();
      down[c]--;
    }
  }
  return down ? { ...out, down } : out;
}

export const apply = (st, m) => settle(step(st, m));

export const isWon = (st) => st.done.length === 4;

export const faceDownCount = (st) => st.down.reduce((a, b) => a + b, 0);

export function legalMoves(st) {
  const out = [];
  for (let from = 0; from < COLS; from++) {
    const col = st.cols[from];
    for (let idx = st.down[from]; idx < col.length; idx++) {
      for (let to = 0; to < COLS; to++) {
        if (!canMove(st, from, idx, to)) continue;
        if (!st.cols[to].length && idx === 0) continue;
        out.push({ t: 'm', from, idx, to });
      }
    }
  }
  if (canDeal(st)) out.push({ t: 'd' });
  return out;
}

/** Abgeräumte Reihen für die Anzeige: Ass unten, König oben. */
export function foundationPiles(st) {
  const piles = [[], [], [], []];
  st.done.forEach((s, i) => { piles[i] = Array.from({ length: 13 }, (_, r) => s * 13 + r); });
  return piles;
}

/** Fortschritt 0..1: fertige Reihen zählen voll, Karten richtig auf ihrem Vorgänger (bzw. König
 *  zuunterst) zu 60 %. */
export function progress(st) {
  let n = 0;
  for (let c = 0; c < COLS; c++) {
    const col = st.cols[c];
    for (let i = st.down[c]; i < col.length; i++) {
      if ((i === 0 && rankOf(col[i]) === 13) || (i > st.down[c] && fits(col[i], col[i - 1]))) n++;
    }
  }
  return Math.min(1, (st.done.length * 13 + n * 0.6) / 52);
}
