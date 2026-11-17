// Pyramide – Spielregeln (rein, ohne DOM).
//
// 28 Karten liegen als Pyramide (7 Reihen), 24 Karten bilden den Talon.
// Frei ist eine Pyramidenkarte, wenn die beiden Karten darunter weg sind.
// Zwei freie Karten mit der Summe 13 werden abgeräumt (A=1 … B=11, D=12), ein König allein.
// Vom Talon wird je eine Karte auf den Ablagestapel gelegt; dessen oberste Karte ist frei.
// Ist der Talon leer, darf der Ablagestapel je nach Modus einige Male neu ausgelegt werden.
// Ziel: die ganze Pyramide abräumen.
//
// Zustand (JSON-tauglich):
//   { pyr:[28 Codes], stock:[24 Codes], pm (abgeräumte Pyramidenkarten, Bitmaske),
//     sm (abgeräumte Talonkarten, Bitmaske), ptr (nächste Talonposition), red (genutzte Neuauslagen),
//     maxRed }
// Karten-Referenzen: 0..27 = Pyramide, 28 = oberste Karte der Ablage.
// Züge: { t:'rm', a, b? }  (Paar oder König) · { t:'draw' } · { t:'redeal' }

import { shuffledDeck, rankOf, popcount } from '../../lib/cards/deck.js';

export const PYR = 28;
export const STOCK = 24;
export const WASTE = 28;
export const FULL = (1 << PYR) - 1;

export const rowOf = (i) => Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
export const idx = (r, c) => (r * (r + 1)) / 2 + c;
export const colOf = (i) => i - idx(rowOf(i), 0);

/** Karten, die i direkt bedecken (eine Reihe tiefer). */
export const COVER = Array.from({ length: PYR }, (_, i) => {
  const r = rowOf(i), c = colOf(i);
  return r < 6 ? [idx(r + 1, c), idx(r + 1, c + 1)] : [];
});
/** Bitmaske der direkt bedeckenden Karten */
export const COVER_MASK = COVER.map((a) => a.reduce((m, j) => m | (1 << j), 0));
/** Alle Karten, die i (auch indirekt) bedecken – «Kegel» darunter. */
export const CONE = Array.from({ length: PYR }, (_, i) => {
  let m = 0;
  const st = [...COVER[i]];
  while (st.length) { const j = st.pop(); if (!(m & (1 << j))) { m |= 1 << j; st.push(...COVER[j]); } }
  return m;
});
/** Alle Karten, die i (auch indirekt) bedeckt – darüber. */
export const ABOVE = Array.from({ length: PYR }, (_, i) => {
  let m = 0;
  for (let j = 0; j < PYR; j++) if (CONE[j] & (1 << i)) m |= 1 << j;
  return m;
});

/** Neue Partie aus einem Seed. */
export function dealFromSeed(seed) {
  const d = shuffledDeck(seed);
  return { pyr: d.slice(0, PYR), stock: d.slice(PYR) };
}

export function newState(deal, maxRed = 1) {
  return { pyr: deal.pyr.slice(), stock: deal.stock.slice(), pm: 0, sm: 0, ptr: 0, red: 0, maxRed };
}

export const isRemoved = (st, i) => (st.pm & (1 << i)) !== 0;
export const isFree = (st, i) => !isRemoved(st, i) && (st.pm & COVER_MASK[i]) === COVER_MASK[i];

/** Index (in stock) der obersten Ablagekarte oder -1 */
export function wasteTop(st) {
  for (let j = st.ptr - 1; j >= 0; j--) if (!(st.sm & (1 << j))) return j;
  return -1;
}
export function wasteCount(st) {
  let n = 0;
  for (let j = 0; j < st.ptr; j++) if (!(st.sm & (1 << j))) n++;
  return n;
}
export function stockCount(st) {
  let n = 0;
  for (let j = st.ptr; j < STOCK; j++) if (!(st.sm & (1 << j))) n++;
  return n;
}
export const removedCount = (st) => popcount(st.pm);
export const isWon = (st) => st.pm === FULL;

export function codeOf(st, ref) {
  if (ref === WASTE) { const j = wasteTop(st); return j < 0 ? -1 : st.stock[j]; }
  return st.pyr[ref];
}

/** Alle freien Karten-Referenzen */
export function available(st) {
  const out = [];
  for (let i = 0; i < PYR; i++) if (isFree(st, i)) out.push(i);
  if (wasteTop(st) >= 0) out.push(WASTE);
  return out;
}

export const isFreeRef = (st, ref) => (ref === WASTE ? wasteTop(st) >= 0 : ref >= 0 && ref < PYR && isFree(st, ref));

export function canRemove(st, a, b = null) {
  if (!isFreeRef(st, a)) return false;
  if (b == null) return rankOf(codeOf(st, a)) === 13;
  if (a === b || !isFreeRef(st, b)) return false;
  return rankOf(codeOf(st, a)) + rankOf(codeOf(st, b)) === 13;
}

export const canDraw = (st) => stockCount(st) > 0;
export const canRedeal = (st) => stockCount(st) === 0 && st.red < st.maxRed && wasteCount(st) > 0;

export function legalMoves(st) {
  const av = available(st);
  const out = [];
  for (let x = 0; x < av.length; x++) {
    const a = av[x];
    const ra = rankOf(codeOf(st, a));
    if (ra === 13) { out.push({ t: 'rm', a }); continue; }
    for (let y = x + 1; y < av.length; y++) {
      const b = av[y];
      if (ra + rankOf(codeOf(st, b)) === 13) out.push({ t: 'rm', a, b });
    }
  }
  if (canDraw(st)) out.push({ t: 'draw' });
  else if (canRedeal(st)) out.push({ t: 'redeal' });
  return out;
}

export function isLegal(st, m) {
  if (!m) return false;
  if (m.t === 'draw') return canDraw(st);
  if (m.t === 'redeal') return canRedeal(st);
  if (m.t === 'rm') return canRemove(st, m.a, m.b == null ? null : m.b);
  return false;
}

/** Wendet einen Zug an und gibt einen neuen Zustand zurück (das Original bleibt unverändert). */
export function apply(st, m) {
  if (!isLegal(st, m)) throw new Error('Ungültiger Zug: ' + JSON.stringify(m));
  const n = { ...st };
  if (m.t === 'draw') {
    let j = n.ptr;
    while (n.sm & (1 << j)) j++;
    n.ptr = j + 1;
  } else if (m.t === 'redeal') {
    n.ptr = 0;
    n.red++;
  } else {
    for (const r of m.b == null ? [m.a] : [m.a, m.b]) {
      if (r === WASTE) n.sm |= 1 << wasteTop(n);
      else n.pm |= 1 << r;
    }
  }
  return n;
}

/** Spielt eine Zugliste ab einem Startzustand nach. */
export function replay(start, moves) {
  let st = start;
  for (const m of moves) st = apply(st, m);
  return st;
}

/** Keine Züge mehr möglich (und nicht gewonnen)? */
export const isStuck = (st) => !isWon(st) && legalMoves(st).length === 0;
