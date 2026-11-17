// Kalibrierung: Wie viele Züge braucht der Test-Spieler pro Level? (Werkzeug, kein Test)
//   node match3/tests/calibrate.mjs [von] [bis] [läufe]
import { getLevel, levelDef } from '../levels.js';
import { Game } from '../engine.js';
import { playLevel } from './bot.js';
import { hashString } from '../../shared/rng.js';

const from = +(process.argv[2] || 1), to = +(process.argv[3] || 40), runs = +(process.argv[4] || 4);
let sumRatio = 0, cnt = 0, wins = 0, total = 0;
const starHist = [0, 0, 0, 0];
const t0 = Date.now();
for (let n = from; n <= to; n++) {
  const base = getLevel(n);
  const need = [];
  const scores = [];
  let w = 0;
  for (let k = 0; k < runs; k++) {
    // a) mit unbegrenzten Zügen: wie viele braucht es?
    const L = { ...base, moves: 300, seed: hashString(`cal-${n}-${k}`) };
    const g = new Game(L);
    const r = playLevel(g, { seed: k + 1 });
    need.push(r.won ? r.movesUsed : 300);
    // b) mit dem echten Zuglimit
    const g2 = new Game({ ...base, seed: hashString(`cal2-${n}-${k}`) });
    const r2 = playLevel(g2, { seed: k + 7 });
    if (r2.won) { w++; scores.push(r2.score); } starHist[r2.stars]++;
  }
  need.sort((a, b) => a - b);
  const med = need[need.length >> 1];
  sumRatio += base.moves / med; cnt++;
  wins += w; total += runs;
  const def = levelDef(n);
  const goals = base.goals.map((g) => g.type + (g.n ? g.n : '') + (g.color != null ? '/c' + g.color : '')).join('+');
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  console.log(`L${String(n).padStart(3)} ${String(def.shape || "hand").padEnd(13)} col${base.colors} moves ${String(base.moves).padStart(2)} need ${need.join(',').padEnd(16)} med ${String(med).padStart(3)} ratio ${(base.moves / med).toFixed(2)} wins ${w}/${runs} score ${avgScore} stars ${base.stars.slice(1).join('/')} ${goals}`);
}
console.log('Sterne-Verteilung (0..3):', starHist.join(' / '));
console.log(`avg ratio ${(sumRatio / cnt).toFixed(2)}, win ${(100 * wins / total).toFixed(0)}%  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
