// Gipfel (TriPeaks) – Spielregeln (rein, ohne DOM).
//
// 28 Karten bilden drei Gipfel (Reihen mit 3, 6, 9 und 10 Karten), eine Karte liegt offen auf
// der Ablage, 23 Karten im Talon. Eine freie Karte (beide Karten darunter weg) darf auf die
// Ablage, wenn sie im Wert eins höher oder tiefer ist (mit Umlauf auch König ↔ Ass).
// Kein Zug? Neue Karte vom Talon. Ziel: alle drei Gipfel abräumen.
//
// Punkte: jede Karte bringt step × Serie (Serie = Karten seit dem letzten Talon-Zug),
// Gipfel-Boni, beim Abräumen ein Bonus für jede übrige Talonkarte.
//
// Zustand (JSON-tauglich):
//   { tab:[28], stock:[23], start (erste Ablagekarte), tm (abgeräumte Maske), ptr (gezogene
//     Talonkarten), top (Code oben auf der Ablage), streak, best (längste Serie), score, peaks, wrap }
// Züge: { t:'play', i } · { t:'draw' }

import { shuffledDeck, adjacent, popcount } from '../../lib/cards/deck.js';

export const TAB = 28;
export const STOCK = 23;
export const FULL = (1 << TAB) - 1;

export const SCORE = { card: 10, peak: [150, 150, 300], stockBonus: 25 };

/** Reihe und horizontale Lage (in Kartenbreiten) jeder Tableau-Karte */
export const ROW = [];
export const XPOS = [];
for (let p = 0; p < 3; p++) { ROW.push(0); XPOS.push(3 * p + 1.5); }
for (let p = 0; p < 3; p++) for (let k = 0; k < 2; k++) { ROW.push(1); XPOS.push(3 * p + k + 1); }
for (let j = 0; j < 9; j++) { ROW.push(2); XPOS.push(j + 0.5); }
for (let i = 0; i < 10; i++) { ROW.push(3); XPOS.push(i); }

/** Karten, die i direkt bedecken */
export const COVER = Array.from({ length: TAB }, (_, i) => {
  if (i < 3) return [3 + 2 * i, 4 + 2 * i];
  if (i < 9) { const p = Math.floor((i - 3) / 2), k = (i - 3) % 2; return [9 + 3 * p + k, 10 + 3 * p + k]; }
  if (i < 18) { const j = i - 9; return [18 + j, 19 + j]; }
  return [];
});
export const COVER_MASK = COVER.map((a) => a.reduce((m, j) => m | (1 << j), 0));

export function dealFromSeed(seed) {
  const d = shuffledDeck(seed);
  return { tab: d.slice(0, TAB), start: d[TAB], stock: d.slice(TAB + 1) };
}

export function newState(deal, wrap = true) {
  return { tab: deal.tab.slice(), stock: deal.stock.slice(), start: deal.start, tm: 0, ptr: 0, top: deal.start, streak: 0, best: 0, score: 0, peaks: 0, wrap: !!wrap };
}

export const isRemoved = (st, i) => (st.tm & (1 << i)) !== 0;
export const isFree = (st, i) => !isRemoved(st, i) && (st.tm & COVER_MASK[i]) === COVER_MASK[i];
export const stockCount = (st) => STOCK - st.ptr;
export const removedCount = (st) => popcount(st.tm);
export const isWon = (st) => st.tm === FULL;

export const canPlay = (st, i) => i >= 0 && i < TAB && isFree(st, i) && adjacent(st.tab[i], st.top, st.wrap);
export const canDraw = (st) => st.ptr < STOCK;

export function playable(st) {
  const out = [];
  for (let i = 0; i < TAB; i++) if (canPlay(st, i)) out.push(i);
  return out;
}

export function legalMoves(st) {
  const out = playable(st).map((i) => ({ t: 'play', i }));
  if (canDraw(st)) out.push({ t: 'draw' });
  return out;
}

export function isLegal(st, m) {
  if (!m) return false;
  if (m.t === 'draw') return canDraw(st);
  if (m.t === 'play') return canPlay(st, m.i);
  return false;
}

/** Punkte, die ein Zug bringen würde (für Anzeige «+30»). */
export function gain(st, m) {
  if (m.t !== 'play') return 0;
  const n = apply(st, m);
  return n.score - st.score;
}

export function apply(st, m) {
  if (!isLegal(st, m)) throw new Error('Ungültiger Zug: ' + JSON.stringify(m));
  const n = { ...st };
  if (m.t === 'draw') {
    n.top = n.stock[n.ptr];
    n.ptr++;
    n.streak = 0;
    return n;
  }
  n.tm |= 1 << m.i;
  n.top = n.tab[m.i];
  n.streak++;
  n.best = Math.max(n.best, n.streak);
  n.score += SCORE.card * n.streak;
  if (m.i < 3) {
    n.score += SCORE.peak[n.peaks] || 0;
    n.peaks++;
  }
  if (n.tm === FULL) n.score += SCORE.stockBonus * (STOCK - n.ptr);
  return n;
}

export function replay(start, moves) {
  let st = start;
  for (const m of moves) st = apply(st, m);
  return st;
}

export const isStuck = (st) => !isWon(st) && legalMoves(st).length === 0;
