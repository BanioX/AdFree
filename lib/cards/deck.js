// Kartendeck (reine Logik, ohne DOM – auch in Node nutzbar).
//
// Kartencode 0..51:  Farbe = Math.floor(code / 13)  (0 Pik, 1 Herz, 2 Kreuz, 3 Karo)
//                    Wert  = code % 13 + 1           (1 Ass … 11 Bube, 12 Dame, 13 König)
//
//   import { shuffledDeck, rankOf, suitOf, adjacent } from '../lib/cards/deck.js';
//   const deck = shuffledDeck('pyramid|normal|12');   // gleicher Seed => gleiche Reihenfolge

import { makeRng } from '../../shared/rng.js';

export const SUIT_NAMES = ['Pik', 'Herz', 'Kreuz', 'Karo'];
export const RANK_NAMES = [null, 'Ass', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Bube', 'Dame', 'König'];

export const suitOf = (c) => Math.floor(c / 13);
export const rankOf = (c) => (c % 13) + 1;
export const isRed = (c) => { const s = suitOf(c); return s === 1 || s === 3; };
export const cardCode = (suit, rank) => suit * 13 + rank - 1;

/** Kurzer Wert für die Kartenecke: A, 2 … 10, B, D, K */
export function rankLabel(r) {
  if (r === 1) return 'A';
  if (r <= 10) return String(r);
  return ['B', 'D', 'K'][r - 11];
}

/** «Herz Dame» */
export function cardName(c) {
  return `${SUIT_NAMES[suitOf(c)]} ${RANK_NAMES[rankOf(c)]}`;
}

export function newDeck() {
  return Array.from({ length: 52 }, (_, i) => i);
}

/** Gemischtes Deck aus einem Seed (String oder Zahl). */
export function shuffledDeck(seed) {
  return makeRng(seed).shuffle(newDeck());
}

/** Liegen zwei Karten im Wert eins auseinander? wrap: König und Ass gelten als Nachbarn. */
export function adjacent(a, b, wrap = false) {
  const d = Math.abs(rankOf(a) - rankOf(b));
  return d === 1 || (wrap && d === 12);
}

/** Zählt gesetzte Bits (für Masken bis 32 Bit). */
export function popcount(x) {
  x >>>= 0;
  let n = 0;
  while (x) { x &= x - 1; n++; }
  return n;
}
