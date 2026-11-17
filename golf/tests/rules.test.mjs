// node --test golf/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../logic/rules.js';
import { clearPath, fairPlay } from '../logic/solver.js';
import { findHole, parOf } from '../logic/deals.js';
import { rankOf } from '../../lib/cards/deck.js';
import { MODES, DAILY_MODE } from '../data/config.js';

test('Austeilen: 7 × 5 + 1 + 16, deterministisch', () => {
  const d = R.dealFromSeed('g');
  assert.equal(d.cols.length, 7);
  d.cols.forEach((c) => assert.equal(c.length, 5));
  assert.equal(d.stock.length, 16);
  assert.equal(new Set([...d.cols.flat(), d.start, ...d.stock]).size, 52);
  assert.deepEqual(R.dealFromSeed('g'), d);
});

test('Nur die unterste Karte, eins höher oder tiefer, Umlauf nur im leichten Modus', () => {
  const d = R.dealFromSeed('adj');
  for (const wrap of [true, false]) {
    const st = R.newState(d, wrap);
    for (let c = 0; c < 7; c++) {
      const r = rankOf(R.bottom(st, c));
      const diff = Math.abs(r - rankOf(st.top));
      assert.equal(R.canPlay(st, c), diff === 1 || (wrap && diff === 12));
    }
    // nach dem Spielen wird die nächste Karte frei
    const c = R.playable(st)[0];
    if (c != null) {
      const n = R.apply(st, { t: 'play', c });
      assert.equal(n.h[c], 4);
      assert.equal(n.top, st.cols[c][4]);
      assert.equal(R.bottom(n, c), st.cols[c][3]);
      assert.equal(st.h[c], 5, 'Original unverändert');
    }
  }
});

test('Talon, Schläge und Lochende', () => {
  let st = R.newState(R.dealFromSeed('end'), false);
  for (let i = 0; i < 16; i++) st = R.apply(st, { t: 'draw' });
  assert.ok(!R.canDraw(st));
  assert.equal(R.holeScore(st), 35);
  assert.equal(R.isOver(st), R.playable(st).length === 0);
  assert.equal(R.scoreName(-1), 'Birdie');
  assert.equal(R.scoreName(0), 'Par');
  assert.equal(R.scoreName(2), 'Doppel-Bogey');
  assert.equal(R.fmtDiff(-3), '−3');
  assert.equal(R.fmtDiff(0), '±0');
});

test('Löser: gefundene Wege räumen wirklich ab, Abräumen zählt minus Talonkarten', () => {
  for (const m of MODES) {
    let ok = 0;
    for (let k = 0; k < 40; k++) {
      const st = R.newState(R.dealFromSeed('c' + m.id + k), m.wrap);
      const r = clearPath(st, { maxNodes: 30000 });
      if (r.cleared) {
        ok++;
        const end = R.replay(st, r.moves);
        assert.ok(R.isCleared(end));
        assert.equal(R.holeScore(end), -R.stockCount(end));
      }
    }
    assert.ok(ok >= 3, `${m.id}: ${ok}/40`);
  }
});

test('Fairer Spieler spielt nur gültige Züge und sein Ergebnis stimmt', () => {
  for (let k = 0; k < 60; k++) {
    const st = R.newState(R.dealFromSeed('f' + k), k % 2 === 0);
    const f = fairPlay(st);
    const end = R.replay(st, f.moves);
    assert.equal(R.holeScore(end), f.score);
    assert.ok(R.isOver(end), 'fairer Spieler spielt bis zum Ende');
    const p = parOf(st);
    assert.ok(p >= 1 && p >= f.score);
  }
});

test('Abräumbare Löcher: 2 Runden × 9 Löcher je Modus', () => {
  for (const m of MODES) {
    for (let round = 1; round <= 2; round++) {
      for (let hole = 1; hole <= 9; hole++) {
        const d = findHole({ key: m.id, round, hole, wrap: m.wrap, solvable: true });
        assert.ok(d.solution, `${m.id} R${round} L${hole}`);
        assert.ok(R.isCleared(R.replay(d.state, d.solution)));
        assert.ok(d.par >= 1);
        assert.equal(findHole({ key: m.id, round, hole, wrap: m.wrap, solvable: true }).seed, d.seed, 'deterministisch');
      }
    }
  }
});

test('Par ist fair: im Mittel nicht zu streng und nicht geschenkt', () => {
  for (const m of MODES) {
    let parSum = 0, fair = 0;
    const N = 40;
    for (let k = 1; k <= N; k++) {
      const d = findHole({ key: 'par-' + m.id, round: k, hole: 1, wrap: m.wrap, solvable: true });
      parSum += d.par;
      fair += fairPlay(d.state).score <= d.par ? 1 : 0;
    }
    assert.equal(fair, N, 'fairer Spieler schafft immer Par');
    assert.ok(parSum / N >= 1 && parSum / N <= 6, `${m.id}: Ø Par ${parSum / N}`);
  }
});

test('Loch des Tages: 30 Tage abräumbar und verschieden', () => {
  const wrap = MODES.find((m) => m.id === DAILY_MODE).wrap;
  const seen = new Set();
  const day = new Date(2026, 2, 1);
  for (let i = 0; i < 30; i++) {
    const key = 'daily-' + day.toISOString().slice(0, 10);
    const d = findHole({ key, wrap, solvable: true });
    assert.ok(d.solution, key);
    seen.add(d.seed);
    day.setDate(day.getDate() + 1);
  }
  assert.equal(seen.size, 30);
});
