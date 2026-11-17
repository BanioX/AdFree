// Golf-Patience – Spielregeln (rein, ohne DOM).
//
// 7 Reihen (Spalten) mit je 5 offenen Karten, eine Karte offen auf der Ablage, 16 im Talon.
// Die unterste Karte einer Reihe darf auf die Ablage, wenn sie eins höher oder tiefer ist
// (im leichten Modus auch König ↔ Ass). Nichts passt? Karte vom Talon.
// Ein Loch endet, wenn alle Reihen leer sind oder der Talon leer ist und nichts mehr passt.
// Schläge (Punkte) eines Lochs: Karten, die liegen bleiben – beim Abräumen minus übrige Talonkarten.
//
// Zustand: { cols:[7][5] Codes (Index 0 = oben), h:[7] Höhen, stock:[16], start, ptr, top, wrap }
// Züge: { t:'play', c } · { t:'draw' }

import { shuffledDeck, adjacent } from '../../lib/cards/deck.js';

export const COLS = 7;
export const DEPTH = 5;
export const STOCK = 16;

export function dealFromSeed(seed) {
  const d = shuffledDeck(seed);
  const cols = [];
  for (let c = 0; c < COLS; c++) cols.push(d.slice(c * DEPTH, c * DEPTH + DEPTH));
  return { cols, start: d[COLS * DEPTH], stock: d.slice(COLS * DEPTH + 1) };
}

export function newState(deal, wrap = true) {
  return {
    cols: deal.cols.map((c) => c.slice()), h: deal.cols.map((c) => c.length),
    stock: deal.stock.slice(), start: deal.start, ptr: 0, top: deal.start, wrap: !!wrap,
  };
}

export const bottom = (st, c) => (st.h[c] ? st.cols[c][st.h[c] - 1] : -1);
export const tableauCount = (st) => st.h.reduce((a, b) => a + b, 0);
export const stockCount = (st) => STOCK - st.ptr;
export const isCleared = (st) => tableauCount(st) === 0;

export const canPlay = (st, c) => c >= 0 && c < COLS && st.h[c] > 0 && adjacent(bottom(st, c), st.top, st.wrap);
export const canDraw = (st) => st.ptr < STOCK;

export function playable(st) {
  const out = [];
  for (let c = 0; c < COLS; c++) if (canPlay(st, c)) out.push(c);
  return out;
}

export function legalMoves(st) {
  if (isCleared(st)) return [];
  const out = playable(st).map((c) => ({ t: 'play', c }));
  if (canDraw(st)) out.push({ t: 'draw' });
  return out;
}

export function isLegal(st, m) {
  if (!m || isCleared(st)) return false;
  if (m.t === 'draw') return canDraw(st);
  if (m.t === 'play') return canPlay(st, m.c);
  return false;
}

export function apply(st, m) {
  if (!isLegal(st, m)) throw new Error('Ungültiger Zug: ' + JSON.stringify(m));
  const n = { ...st, h: st.h.slice() };
  if (m.t === 'draw') {
    n.top = n.stock[n.ptr];
    n.ptr++;
  } else {
    n.top = bottom(st, m.c);
    n.h[m.c]--;
  }
  return n;
}

export function replay(start, moves) {
  let st = start;
  for (const m of moves) st = apply(st, m);
  return st;
}

/** Loch zu Ende? (abgeräumt oder keine Züge mehr) */
export const isOver = (st) => isCleared(st) || legalMoves(st).length === 0;

/** Schläge: übrige Karten; beim Abräumen minus übrige Talonkarten. */
export const holeScore = (st) => (isCleared(st) ? -stockCount(st) : tableauCount(st));

/** Golf-Begriffe für Ergebnis relativ zum Par */
export function scoreName(diff) {
  if (diff <= -3) return 'Albatros';
  if (diff === -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Doppel-Bogey';
  return `+${diff}`;
}

export const fmtDiff = (d) => (d === 0 ? '±0' : d > 0 ? `+${d}` : `−${-d}`);
