// Einfacher Computer-Spieler: wählt gierig den besten nächsten Zug.
// Wird für Tipps im Spiel, zum Prüfen der Level (lösbar?) und für die Sterne-Grenzen benutzt.
// Rein logisch, deterministisch.

import { canPlaceAll } from './generator.js';

const REF = [
  { w: 3, h: 3, masks: [7, 7, 7], bonus: 26 },
  { w: 5, h: 1, masks: [31], bonus: 9 },
  { w: 1, h: 5, masks: [1, 1, 1, 1, 1], bonus: 9 },
  { w: 2, h: 2, masks: [3, 3], bonus: 6 },
];

function fitsMask(rows, n, ref) {
  for (let r = 0; r + ref.h <= n; r++) {
    for (let c = 0; c + ref.w <= n; c++) {
      let ok = true;
      for (let i = 0; i < ref.h; i++) if (rows[r + i] & (ref.masks[i] << c)) { ok = false; break; }
      if (ok) return true;
    }
  }
  return false;
}

/** Bewertet ein Brett (höher = besser). */
export function evaluateBoard(b, wantGems, wantCover) {
  const n = b.n;
  const rows = b.rows;
  let s = 0;
  let filled = 0;
  let trans = 0;
  let holes = 0;
  const filledAt = (r, c) => r < 0 || c < 0 || r >= n || c >= n || (rows[r] >> c) & 1;
  const rowFill = new Array(n).fill(0);
  const colFill = new Array(n).fill(0);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const f = (rows[r] >> c) & 1;
      if (f) { filled++; rowFill[r]++; colFill[c]++; }
      if (c + 1 < n && f !== ((rows[r] >> (c + 1)) & 1)) trans++;
      if (r + 1 < n && f !== ((rows[r + 1] >> c) & 1)) trans++;
      if (!f) {
        const k = filledAt(r - 1, c) + filledAt(r + 1, c) + filledAt(r, c - 1) + filledAt(r, c + 1);
        if (k === 4) holes += 1;
        else if (k === 3) s -= 3;
      }
    }
  }
  s -= filled * 1.1;
  s -= trans * 1.3;
  s -= holes * 16;
  for (const ref of REF) if (fitsMask(rows, n, ref)) s += ref.bonus;
  if (wantGems || wantCover) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        const f = Math.max(rowFill[r], colFill[c]) / n;
        if (wantGems && b.gems[i]) s += 14 * f * f;
        if (wantCover && b.cover[i]) s += 1.6 * f * f;
      }
    }
  }
  return s;
}

/** Bester Zug für den aktuellen Spielstand: { slot, r, c } oder null. */
export function bestMove(game) {
  const b = game.board;
  const n = b.n;
  const wantGems = !!(game.goals && game.goals.gems);
  const wantCover = !!(game.goals && game.goals.picture);
  const cands = [];
  const seen = new Set();
  for (let slot = 0; slot < 3; slot++) {
    const v = game.tray[slot];
    if (!v || seen.has(v.key)) continue;
    seen.add(v.key);
    for (let r = 0; r + v.h <= n; r++) {
      for (let c = 0; c + v.w <= n; c++) {
        if (!b.canPlace(v, r, c)) continue;
        const nb = b.clone();
        const res = nb.place(v, r, c);
        let s = res.lines * 40 + res.lines * res.lines * 14;
        for (const cl of res.cleared) {
          if (cl.gem) s += 160;
          if (cl.cover) s += 8;
        }
        if (res.lines && nb.isEmpty) s += 200;
        s += evaluateBoard(nb, wantGems, wantCover);
        cands.push({ slot, r, c, s, nb });
      }
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b2) => b2.s - a.s);
  // Die besten Kandidaten darauf prüfen, dass die übrigen Teile noch passen
  for (let k = 0; k < Math.min(cands.length, 8); k++) {
    const cd = cands[k];
    const others = game.tray.filter((v, i) => v && i !== cd.slot);
    if (!others.length || canPlaceAll(cd.nb.rows, n, others, 3000)) return { slot: cd.slot, r: cd.r, c: cd.c };
  }
  const cd = cands[0];
  return { slot: cd.slot, r: cd.r, c: cd.c };
}

/** Spielt ein Spiel mit dem Bot, bis gewonnen, verloren oder maxMoves erreicht. */
export function simulate(game, maxMoves = 200) {
  while (!game.won && !game.over && game.moves < maxMoves) {
    const m = bestMove(game);
    if (!m) break;
    game.place(m.slot, m.r, m.c);
  }
  return { won: game.won, moves: game.moves, score: game.score, over: game.over };
}
