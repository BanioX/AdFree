// Skorpion – Regeln, Löser und Austeilungen:  node --test scorpion/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../logic/rules.js';
import { solve } from '../logic/solver.js';
import { findDeal, hint, fromSeed } from '../logic/deals.js';
import { MODES } from '../data/config.js';
import { cardCode as C } from '../../lib/cards/deck.js';

const replay = (st, moves) => {
  for (const m of moves) {
    assert.ok(R.isLegal(st, m), 'legal: ' + JSON.stringify(m));
    st = R.apply(st, m);
  }
  return st;
};
const empty = () => ({ cols: [[], [], [], [], [], [], []], down: [0, 0, 0, 0, 0, 0, 0], stock: [], done: [] });

test('Austeilen: 7 × 7, Reserve 3, verdeckt 3 in den ersten vier Spalten', () => {
  const st = R.dealSeed('t1');
  assert.deepEqual(st.cols.map((c) => c.length), [7, 7, 7, 7, 7, 7, 7]);
  assert.deepEqual(st.down, [3, 3, 3, 3, 0, 0, 0]);
  assert.equal(st.stock.length, 3);
  assert.equal(new Set([...st.cols.flat(), ...st.stock]).size, 52);
  assert.deepEqual(R.dealSeed('t1', true).down, [0, 0, 0, 0, 0, 0, 0], 'offen: alles sichtbar');
});

test('Bauen nur in gleicher Farbe, eins tiefer; jede offene Gruppe beweglich', () => {
  assert.ok(R.fits(C(1, 8), C(1, 9)));
  assert.ok(!R.fits(C(1, 8), C(3, 9)));
  assert.ok(!R.fits(C(1, 8), C(1, 10)));
  const st = empty();
  st.cols[0] = [C(2, 4), C(1, 8), C(0, 3), C(2, 11)];
  st.down[0] = 1;
  st.cols[1] = [C(1, 9)];
  // Herz 8 nimmt Pik 3 und Kreuz Bube mit, obwohl die nicht passen
  assert.ok(R.canMove(st, 0, 1, 1));
  const s2 = R.apply(st, { t: 'm', from: 0, idx: 1, to: 1 });
  assert.deepEqual(s2.cols[1], [C(1, 9), C(1, 8), C(0, 3), C(2, 11)]);
  assert.equal(s2.down[0], 0, 'Kreuz 4 aufgedeckt');
  assert.ok(!R.canMove(st, 0, 0, 1), 'verdeckte Karte nicht beweglich');
});

test('Leere Spalten nur für Könige', () => {
  const st = empty();
  st.cols[0] = [C(0, 5), C(3, 13), C(3, 12)];
  st.cols[1] = [C(1, 7)];
  assert.ok(R.canMove(st, 0, 1, 2));
  assert.ok(!R.canMove(st, 1, 0, 2));
});

test('Reserve: einmal austeilen, je eine Karte auf Spalte 1–3', () => {
  const st = R.dealSeed('res');
  const s2 = R.apply(st, { t: 'd' });
  assert.deepEqual(s2.cols.slice(0, 3).map((c) => c[c.length - 1]), st.stock);
  assert.equal(s2.stock.length, 0);
  assert.ok(!R.isLegal(s2, { t: 'd' }));
});

test('Vollständige Reihe König … Ass wird abgeräumt und deckt auf', () => {
  const st = empty();
  st.cols[0] = [C(2, 5), ...Array.from({ length: 12 }, (_, i) => C(1, 13 - i))]; // Herz K … 2
  st.down[0] = 1;
  st.cols[1] = [C(1, 1)];
  const s2 = R.apply(st, { t: 'm', from: 1, idx: 0, to: 0 });
  assert.deepEqual(s2.done, [1]);
  assert.deepEqual(s2.cols[0], [C(2, 5)]);
  assert.equal(s2.down[0], 0);
  assert.deepEqual(R.foundationPiles(s2)[0], Array.from({ length: 13 }, (_, r) => C(1, r + 1)));
  // Reihe mit falscher Farbe dazwischen bleibt liegen
  const st3 = empty();
  st3.cols[0] = Array.from({ length: 13 }, (_, i) => C(i === 6 ? 3 : 1, 13 - i));
  assert.equal(R.settle(st3).done.length, 0);
});

test('Gewonnen mit vier Reihen', () => {
  const st = { ...empty(), done: [0, 1, 2, 3] };
  assert.ok(R.isWon(st));
});

for (const mode of MODES) {
  const n = mode.open ? 40 : 15;
  test(`Austeilungen «${mode.label}»: ${n} Spiele, alle garantiert lösbar und deterministisch`, () => {
    let tries = 0;
    for (let i = 1; i <= n; i++) {
      const d = findDeal(`${mode.id}|${i}`, mode.id);
      assert.ok(d.solution, `Spiel ${i} lösbar`);
      assert.ok(R.isWon(replay(fromSeed(d.seed, mode.id), d.solution)));
      tries += d.tries;
    }
    assert.equal(findDeal(`${mode.id}|3`, mode.id).seed, findDeal(`${mode.id}|3`, mode.id).seed);
    console.log(`  ${mode.id}: Ø ${(tries / n).toFixed(1)} Versuche pro Austeilung`);
  });
}

test('Löser erkennt unlösbare Stellungen', () => {
  let proven = 0;
  for (let i = 0; i < 12; i++) if (solve(R.dealSeed('hard-' + i), { maxNodes: 30000 }).solved === false) proven++;
  assert.ok(proven >= 1);
});

test('Tipp führt auf dem Lösungsweg zum Sieg', () => {
  const d = findDeal('leicht|4', 'leicht');
  let st = d.st;
  for (let k = 0; k < 200 && !R.isWon(st); k++) {
    const h = hint(st);
    assert.ok(h.move && R.isLegal(st, h.move));
    assert.equal(h.solved, true);
    st = R.apply(st, h.move);
  }
  assert.ok(R.isWon(st));
});

test('Fortschritt steigt von 0 bis 1', () => {
  const d = findDeal('leicht|2', 'leicht');
  const p0 = R.progress(d.st);
  const end = replay(d.st, d.solution);
  assert.ok(p0 < 0.5);
  assert.equal(R.progress(end), 1);
});
