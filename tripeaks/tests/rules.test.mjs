// node --test tripeaks/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../logic/rules.js';
import { solve } from '../logic/solver.js';
import { findDeal } from '../logic/deals.js';
import { cardCode, rankOf } from '../../lib/cards/deck.js';
import { MODES, DAILY_MODE } from '../data/config.js';

test('Geometrie: drei Gipfel, jede Karte liegt auf zwei Nachbarn der Reihe darunter', () => {
  assert.equal(R.ROW.filter((r) => r === 0).length, 3);
  assert.equal(R.ROW.filter((r) => r === 1).length, 6);
  assert.equal(R.ROW.filter((r) => r === 2).length, 9);
  assert.equal(R.ROW.filter((r) => r === 3).length, 10);
  for (let i = 0; i < R.TAB; i++) {
    if (R.ROW[i] === 3) { assert.deepEqual(R.COVER[i], []); continue; }
    const [a, b] = R.COVER[i];
    assert.equal(R.ROW[a], R.ROW[i] + 1);
    assert.equal(R.ROW[b], R.ROW[i] + 1);
    assert.equal(R.XPOS[a], R.XPOS[i] - 0.5);
    assert.equal(R.XPOS[b], R.XPOS[i] + 0.5);
  }
});

test('Austeilen: 28 + 1 + 23, deterministisch', () => {
  const d = R.dealFromSeed('a');
  assert.equal(d.tab.length, 28);
  assert.equal(d.stock.length, 23);
  assert.equal(new Set([...d.tab, d.start, ...d.stock]).size, 52);
  assert.deepEqual(R.dealFromSeed('a'), d);
});

function withTop(st, rank) {
  return { ...st, top: cardCode(0, rank) };
}

test('Eins höher oder tiefer, Umlauf nur im leichten Modus', () => {
  const d = R.dealFromSeed('adj');
  for (const wrap of [true, false]) {
    const st = R.newState(d, wrap);
    for (let i = 18; i < 28; i++) {
      const r = rankOf(st.tab[i]);
      const up = withTop(st, r === 13 ? 12 : r + 1);
      assert.ok(R.canPlay(up, i), 'Nachbar passt');
      const far = withTop(st, ((r + 5) % 13) + 1);
      if (Math.abs(rankOf(far.top) - r) !== 1 && Math.abs(rankOf(far.top) - r) !== 12) assert.ok(!R.canPlay(far, i));
      if (r === 13) assert.equal(R.canPlay(withTop(st, 1), i), wrap, 'König ↔ Ass');
      if (r === 1) assert.equal(R.canPlay(withTop(st, 13), i), wrap, 'Ass ↔ König');
    }
    for (let i = 0; i < 18; i++) assert.ok(!R.isFree(st, i), 'obere Reihen sind bedeckt');
  }
});

test('Serie, Punkte, Gipfel-Bonus, Talon-Bonus', () => {
  // Zug für Zug mit einer gefundenen Lösung prüfen
  const d = findDeal({ key: 'score', n: 1, wrap: true, solvable: true });
  let st = d.state;
  let streak = 0, score = 0, peaks = 0;
  for (const m of d.solution) {
    const n = R.apply(st, m);
    if (m.t === 'draw') {
      streak = 0;
      assert.equal(n.streak, 0);
      assert.equal(n.top, st.stock[st.ptr]);
    } else {
      streak++;
      score += R.SCORE.card * streak;
      if (m.i < 3) score += R.SCORE.peak[peaks++];
      if (n.tm === R.FULL) score += R.SCORE.stockBonus * (R.STOCK - n.ptr);
      assert.equal(n.streak, streak);
      assert.equal(n.top, st.tab[m.i]);
    }
    assert.equal(n.score, score);
    st = n;
  }
  assert.ok(R.isWon(st));
  assert.equal(st.peaks, 3);
  assert.ok(st.best >= 1);
});

test('Talon leer und nichts passt → steckengeblieben', () => {
  let st = R.newState(R.dealFromSeed('stuck'), false);
  for (let i = 0; i < R.STOCK; i++) st = R.apply(st, { t: 'draw' });
  assert.ok(!R.canDraw(st));
  assert.throws(() => R.apply(st, { t: 'draw' }));
  assert.equal(R.isStuck(st), R.playable(st).length === 0);
});

test('Löser: Lösungen sind gültig (beide Modi)', () => {
  for (const m of MODES) {
    let ok = 0;
    for (let k = 0; k < 40; k++) {
      const st = R.newState(R.dealFromSeed('s' + m.id + k), m.wrap);
      const r = solve(st, { maxNodes: 40000 });
      if (r.solved) { ok++; assert.ok(R.isWon(R.replay(st, r.moves))); }
      else {
        // bester Teilweg ist gültig spielbar
        const part = R.replay(st, r.bestMoves);
        assert.equal(R.removedCount(part), r.bestCleared);
      }
    }
    assert.ok(ok >= 12, `${m.id}: ${ok}/40 gelöst`);
  }
});

test('Lösbare Runden: 60 Runden je Modus garantiert abräumbar', () => {
  for (const m of MODES) {
    for (let n = 1; n <= 60; n++) {
      const d = findDeal({ key: m.id, n, wrap: m.wrap, solvable: true });
      assert.ok(d.solution, `${m.id} #${n}`);
      assert.ok(R.isWon(R.replay(d.state, d.solution)));
    }
  }
});

test('Tagesrätsel: 45 Tage lösbar, alle verschieden', () => {
  const wrap = MODES.find((m) => m.id === DAILY_MODE).wrap;
  const seen = new Set();
  const day = new Date(2026, 5, 1);
  for (let i = 0; i < 45; i++) {
    const key = 'daily-' + day.toISOString().slice(0, 10);
    const d = findDeal({ key, wrap, solvable: true });
    assert.ok(d.solution, key);
    seen.add(d.state.tab.join());
    day.setDate(day.getDate() + 1);
  }
  assert.equal(seen.size, 45);
});
