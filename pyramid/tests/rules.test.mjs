// node --test pyramid/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../logic/rules.js';
import { solve } from '../logic/solver.js';
import { findDeal, CHECK_NODES } from '../logic/deals.js';
import { rankOf, cardCode } from '../../lib/cards/deck.js';
import { MODES, DAILY_MODE } from '../data/config.js';

test('Geometrie der Pyramide', () => {
  assert.equal(R.rowOf(0), 0);
  assert.equal(R.rowOf(27), 6);
  assert.deepEqual(R.COVER[0], [1, 2]);
  assert.deepEqual(R.COVER[R.idx(5, 2)], [R.idx(6, 2), R.idx(6, 3)]);
  for (let c = 0; c < 7; c++) assert.deepEqual(R.COVER[R.idx(6, c)], []);
  // Spitze wird von allen 27 anderen Karten (indirekt) bedeckt
  let n = 0;
  for (let i = 0; i < 28; i++) if (R.CONE[0] & (1 << i)) n++;
  assert.equal(n, 27);
  assert.equal(R.ABOVE[0], 0);
});

test('Austeilen ist deterministisch und vollständig', () => {
  const a = R.dealFromSeed('x'), b = R.dealFromSeed('x'), c = R.dealFromSeed('y');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.pyr.length, 28);
  assert.equal(a.stock.length, 24);
  assert.equal(new Set([...a.pyr, ...a.stock]).size, 52);
});

/** Pyramide mit bekannten Karten bauen */
function custom(pyrRanks, stockRanks, maxRed = 1) {
  const used = new Set();
  const pick = (r) => { for (let s = 0; s < 4; s++) { const c = cardCode(s, r); if (!used.has(c)) { used.add(c); return c; } } throw new Error('Rang aufgebraucht ' + r); };
  const pyr = pyrRanks.map(pick);
  const stock = stockRanks.map(pick);
  return R.newState({ pyr, stock }, maxRed);
}

test('Regeln: Summe 13, König allein, bedeckte Karten', () => {
  // unterste Reihe: 6 7 13 1 12 2 11
  const ranks = [5, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 9, 9, 9, 9, 10, 10, 10, 10, 6, 7, 13, 1, 12, 2, 11];
  const st = custom(ranks, [8, 8, 8, 8, 6, 6, 6, 7, 7, 7, 1, 1, 1, 12, 12, 12, 11, 11, 11, 13, 13, 13, 4, 5]);
  const b = (c) => R.idx(6, c);
  assert.ok(R.canRemove(st, b(0), b(1)), '6 + 7');
  assert.ok(!R.canRemove(st, b(0), b(2)), '6 + K');
  assert.ok(R.canRemove(st, b(2)), 'König allein');
  assert.ok(!R.canRemove(st, b(3)), 'Ass allein nicht');
  assert.ok(R.canRemove(st, b(3), b(4)), 'A + D');
  assert.ok(R.canRemove(st, b(5), b(6)), '2 + B');
  assert.ok(!R.isFree(st, R.idx(5, 0)), 'Reihe 5 ist bedeckt');
  assert.ok(!R.canRemove(st, R.idx(5, 0), b(0)), 'bedeckte Karte nicht');
  const s2 = R.apply(R.apply(st, { t: 'rm', a: b(0), b: b(1) }), { t: 'rm', a: b(2) });
  assert.ok(R.isFree(s2, R.idx(5, 0)), 'nach dem Abräumen frei');
  assert.ok(!R.isFree(s2, R.idx(5, 2)), 'nur halb frei');
  assert.equal(R.removedCount(s2), 3);
  assert.equal(R.removedCount(st), 0, 'Original unverändert');
});

test('Talon, Ablage und Neuauslegen', () => {
  const st0 = R.newState(R.dealFromSeed('talon'), 1);
  assert.equal(R.wasteTop(st0), -1);
  assert.ok(R.canDraw(st0));
  let st = st0;
  for (let i = 0; i < 24; i++) st = R.apply(st, { t: 'draw' });
  assert.equal(R.stockCount(st), 0);
  assert.equal(R.wasteCount(st), 24);
  assert.equal(R.wasteTop(st), 23);
  assert.ok(R.canRedeal(st));
  st = R.apply(st, { t: 'redeal' });
  assert.equal(R.stockCount(st), 24);
  for (let i = 0; i < 24; i++) st = R.apply(st, { t: 'draw' });
  assert.ok(!R.canRedeal(st), 'nur 1× neu auslegen');
  assert.throws(() => R.apply(st, { t: 'redeal' }));
});

test('Ablagekarte paart mit Pyramide und gibt die nächste frei', () => {
  for (let k = 0; k < 200; k++) {
    let st = R.newState(R.dealFromSeed('w' + k), 1);
    st = R.apply(R.apply(st, { t: 'draw' }), { t: 'draw' });
    const w = R.codeOf(st, R.WASTE);
    for (let c = 0; c < 7; c++) {
      const i = R.idx(6, c);
      if (rankOf(st.pyr[i]) + rankOf(w) === 13) {
        const s2 = R.apply(st, { t: 'rm', a: i, b: R.WASTE });
        assert.equal(R.wasteTop(s2), 0, 'darunterliegende Karte wird frei');
        assert.equal(R.codeOf(s2, R.WASTE), st.stock[0]);
        return;
      }
    }
  }
  assert.fail('kein Testfall gefunden');
});

test('Löser: Lösungen führen wirklich zum Ziel', () => {
  for (const m of MODES) {
    let solved = 0;
    for (let k = 0; k < 40; k++) {
      const st = R.newState(R.dealFromSeed('solve-' + m.id + k), m.redeals);
      const r = solve(st, { maxNodes: 40000 });
      if (r.solved) {
        solved++;
        assert.ok(R.isWon(R.replay(st, r.moves)), 'Lösung gültig');
      }
    }
    assert.ok(solved >= 10, `${m.id}: genug lösbare Partien (${solved}/40)`);
  }
});

test('Lösbare Partien: jede neue Partie ist garantiert zu schaffen (viele Seeds)', () => {
  for (const m of MODES) {
    for (let n = 1; n <= 60; n++) {
      const d = findDeal({ key: m.id, n, maxRed: m.redeals, solvable: true });
      assert.ok(d.solution, `${m.id} #${n} hat eine Lösung`);
      assert.ok(R.isWon(R.replay(d.state, d.solution)));
      // deterministisch
      assert.equal(findDeal({ key: m.id, n, maxRed: m.redeals, solvable: true }).seed, d.seed);
    }
  }
});

test('Tagesrätsel: 45 Tage lang lösbar und verschieden', () => {
  const maxRed = MODES.find((m) => m.id === DAILY_MODE).redeals;
  const seeds = new Set();
  const day = new Date(2026, 0, 1);
  for (let i = 0; i < 45; i++) {
    const key = 'daily-' + day.toISOString().slice(0, 10);
    const d = findDeal({ key, n: 0, maxRed, solvable: true });
    assert.ok(d.solution, key);
    seeds.add(d.seed);
    day.setDate(day.getDate() + 1);
  }
  assert.equal(seeds.size, 45);
});

test('Hinweis-Löser findet Züge auch mitten im Spiel', () => {
  const d = findDeal({ key: 'normal', n: 7, maxRed: 1, solvable: true });
  let st = d.state;
  for (const m of d.solution.slice(0, 10)) st = R.apply(st, m);
  const r = solve(st, { maxNodes: CHECK_NODES * 4 });
  assert.ok(r.solved);
  assert.ok(R.isWon(R.replay(st, r.moves)));
});

test('Steckengeblieben wird erkannt', () => {
  // Ohne Neuauslegen alles durchziehen, ohne zu paaren: am Ende keine Züge ausser Paaren
  let st = R.newState(R.dealFromSeed('stuck'), 0);
  for (let i = 0; i < 24; i++) st = R.apply(st, { t: 'draw' });
  const moves = R.legalMoves(st);
  assert.ok(moves.every((m) => m.t === 'rm'));
  assert.equal(R.isStuck(st), moves.length === 0);
});
