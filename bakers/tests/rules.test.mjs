// Bäckerdutzend – Regeln, Löser und Austeilungen:  node --test bakers/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../logic/rules.js';
import { solve } from '../logic/solver.js';
import { findDeal, hint, finish, fromSeed } from '../logic/deals.js';
import { MODES } from '../data/config.js';
import { cardCode as C, rankOf } from '../../lib/cards/deck.js';

const replay = (st, moves) => {
  for (const m of moves) {
    assert.ok(R.isLegal(st, m), 'legal: ' + JSON.stringify(m));
    st = R.apply(st, m);
  }
  return st;
};
const blank = (free = false) => ({ cols: Array.from({ length: 13 }, () => []), found: [0, 0, 0, 0], free });

test('Austeilen: 13 × 4, alle 52 Karten, Könige zuunterst', () => {
  const st = R.dealSeed('t1');
  assert.deepEqual(st.cols.map((c) => c.length), Array(13).fill(4));
  assert.equal(new Set(st.cols.flat()).size, 52);
  for (const col of st.cols) {
    const k = col.findIndex((x) => rankOf(x) !== 13);
    if (k >= 0) assert.ok(col.slice(k).every((x) => rankOf(x) !== 13), 'kein König über einer anderen Karte');
  }
  // Reihenfolge der übrigen Karten bleibt
  const deck = [C(1, 5), C(0, 13), C(2, 9), C(3, 13), ...Array.from({ length: 48 }, (_, i) => i).filter((x) => ![C(1, 5), C(0, 13), C(2, 9), C(3, 13)].includes(x))];
  assert.deepEqual(R.dealDeck(deck).cols[0], [C(0, 13), C(3, 13), C(1, 5), C(2, 9)]);
});

test('Bauen: eins tiefer, Farbe egal, nur oberste Karte', () => {
  const st = blank();
  st.cols[0] = [C(2, 9), C(1, 7)];
  st.cols[1] = [C(0, 8)];
  st.cols[2] = [C(3, 8)];
  assert.ok(R.canMove(st, 0, 1));
  assert.ok(R.canMove(st, 0, 2));
  assert.ok(!R.canMove(st, 1, 2));
  assert.ok(!R.isLegal(st, { t: 'm', from: 0, idx: 0, to: 1 }), 'untere Karte nicht');
  const s2 = R.apply(st, { t: 'm', from: 0, idx: 1, to: 1 });
  assert.deepEqual(s2.cols[1], [C(0, 8), C(1, 7)]);
});

test('Leere Stapel: klassisch gesperrt, leicht frei', () => {
  const st = blank(false);
  st.cols[0] = [C(2, 9), C(1, 7)];
  assert.ok(!R.canMove(st, 0, 5));
  assert.ok(R.canMove({ ...st, free: true }, 0, 5));
  // nur ein leerer Stapel wird als Ziel angeboten, und nicht für eine einzelne Karte
  const s3 = { ...st, free: true, cols: st.cols.map((c, i) => (i === 1 ? [C(0, 4)] : c)) };
  const toEmpty = R.legalMoves(s3).filter((m) => m.t === 'm' && !s3.cols[m.to].length);
  assert.equal(toEmpty.length, 1);
});

test('Ablage nach Farbe, Ass bis König', () => {
  const st = blank();
  st.cols[0] = [C(1, 2), C(1, 1)];
  assert.ok(R.canFound(st, 0));
  const s2 = R.apply(R.apply(st, { t: 'f', from: 0 }), { t: 'f', from: 0 });
  assert.equal(s2.found[1], 2);
  assert.deepEqual(R.foundationPiles(s2)[1], [C(1, 1), C(1, 2)]);
});

test('Geordnete Stapel lassen sich automatisch beenden', () => {
  const st = blank();
  for (let s = 0; s < 4; s++) for (let r = 13; r >= 1; r--) st.cols[s * 3].push(C(s, r));
  assert.ok(R.isSorted(st));
  const f = finish(st);
  assert.ok(f && f.length === 52);
  assert.ok(R.isWon(replay(st, f)));
  const st2 = { ...st, cols: st.cols.map((c, i) => (i === 0 ? [...c.slice(0, 12), C(1, 9)] : c)) };
  assert.equal(finish(st2), null);
});

for (const mode of MODES) {
  const n = 40;
  test(`Austeilungen «${mode.label}»: ${n} Spiele, alle garantiert lösbar und deterministisch`, () => {
    let tries = 0;
    for (let i = 1; i <= n; i++) {
      const d = findDeal(`${mode.id}|${i}`, mode.id);
      assert.ok(d.solution, `Spiel ${i} lösbar`);
      assert.ok(R.isWon(replay(fromSeed(d.seed, mode.id), d.solution)));
      assert.equal(d.st.free, !!mode.free);
      tries += d.tries;
    }
    assert.equal(findDeal(`${mode.id}|9`, mode.id).seed, findDeal(`${mode.id}|9`, mode.id).seed);
    console.log(`  ${mode.id}: Ø ${(tries / n).toFixed(1)} Versuche pro Austeilung`);
  });
}

test('Tipp führt auf dem Lösungsweg zum Sieg', () => {
  const d = findDeal('klassisch|2', 'klassisch');
  let st = d.st;
  for (let k = 0; k < 200 && !R.isWon(st); k++) {
    const h = hint(st);
    assert.ok(h.move && R.isLegal(st, h.move));
    st = R.apply(st, h.move);
  }
  assert.ok(R.isWon(st));
});

test('Löser: Wege sind gültig', () => {
  let ok = 0;
  for (let i = 0; i < 15; i++) {
    const st = R.dealSeed('x' + i);
    const r = solve(st);
    if (r.solved) { ok++; assert.ok(R.isWon(replay(st, r.moves))); }
  }
  assert.ok(ok >= 6, `${ok}/15`);
});
