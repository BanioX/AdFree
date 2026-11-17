// Werkzeug (kein Laufzeit-Code): misst mit dem Computer-Spieler, welche Ziel-Stufe
// auf welcher Brett-Form gut erreichbar ist, und wie viele Züge dafür nötig sind.
//   node merge/tests/calibrate.mjs [anzahlSpiele] [formId]
import { shapes } from '../data/levels.js';
import { parseShape } from '../levelgen.js';
import { createGame } from '../logic.js';
import { autoplay } from '../ai.js';

const N = Number(process.argv[2] || 16);
const only = process.argv[3];
for (const sh of shapes) {
  if (only && sh.id !== only) continue;
  const { size, walls } = parseShape(sh);
  const out = [];
  for (let e = 6; e <= 11; e++) {
    let ok = 0; const mv = []; const lefts = [];
    const t0 = Date.now();
    for (let k = 0; k < N; k++) {
      const s = autoplay(createGame({ size, walls, seed: `cal-${sh.id}-${e}-${k}`, goal: { type: 'tile', e } }), { maxMoves: 6000 });
      if (s.won) { ok++; mv.push(s.moves); }
    }
    mv.sort((a, b) => a - b);
    const med = mv.length ? mv[Math.floor(mv.length / 2)] : 0;
    out.push(`${2 ** e}:${Math.round(100 * ok / N)}%${med ? ` med ${med} (${(med * 2.2 / 2 ** e).toFixed(2)})` : ''} ${Date.now() - t0}ms`);
    if (ok / N < 0.6) break;
  }
  console.log(sh.id.padEnd(14), 'maxE', sh.maxE, '|', out.join(' | '));
}
