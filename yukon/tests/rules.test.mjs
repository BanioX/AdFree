// Yukon – Regeln, Löser und Austeilungen:  node --test yukon/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../logic/rules.js';
import { solveBF, solve } from '../logic/solver.js';
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

test('Austeilen: 52 verschiedene Karten, Spalten 1, 6 … 11, verdeckt 0 … 6', () => {
  const st = R.dealSeed('t1');
  assert.deepEqual(st.cols.map((c) => c.length), [1, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(st.down, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(new Set(st.cols.flat()).size, 52);
  assert.deepEqual(R.dealSeed('t1'), st, 'deterministisch');
  assert.notDeepEqual(R.dealSeed('t2').cols, st.cols);
});

test('Passt: eins tiefer, andere Farbe (Russisch: gleiche Farbe)', () => {
  assert.ok(R.fits(C(1, 9), C(0, 10), false));   // Herz 9 auf Pik 10
  assert.ok(!R.fits(C(1, 9), C(3, 10), false));  // Herz 9 auf Karo 10
  assert.ok(!R.fits(C(1, 9), C(0, 11), false));
  assert.ok(R.fits(C(1, 9), C(1, 10), true));
  assert.ok(!R.fits(C(1, 9), C(0, 10), true));
});

test('Gruppen bewegen, Aufdecken, Könige auf leere Spalten', () => {
  const st = {
    cols: [[], [C(3, 2), C(1, 9), C(2, 4), C(0, 13)], [C(0, 10)], [C(2, 13), C(1, 12)], [], [], []],
    down: [0, 1, 0, 0, 0, 0, 0], found: [0, 0, 0, 0], suit: false,
  };
  // Herz 9 samt Kreuz 4 und Pik König auf Pik 10
  assert.ok(R.canMove(st, 1, 1, 2));
  const s2 = R.apply(st, { t: 'm', from: 1, idx: 1, to: 2 });
  assert.deepEqual(s2.cols[2], [C(0, 10), C(1, 9), C(2, 4), C(0, 13)]);
  assert.equal(s2.down[1], 0, 'Karo 2 wird aufgedeckt');
  // verdeckte Karte darf nicht bewegt werden
  assert.ok(!R.canMove(st, 1, 0, 0));
  // nur Könige auf leere Spalten
  assert.ok(R.canMove(st, 1, 3, 0));
  assert.ok(!R.canMove(st, 2, 0, 0));
  // König ganz unten auf eine andere leere Spalte ist kein sinnvoller Zug
  assert.ok(!R.legalMoves(st).some((m) => m.t === 'm' && m.from === 3 && m.idx === 0));
});

test('Ablage: nur in Folge Ass … König derselben Farbe', () => {
  const st = { cols: [[C(1, 1)], [C(1, 3)], [C(1, 2)], [], [], [], []], down: [0, 0, 0, 0, 0, 0, 0], found: [0, 0, 0, 0], suit: false };
  assert.ok(R.canFound(st, 0));
  assert.ok(!R.canFound(st, 1));
  const s2 = R.apply(st, { t: 'f', from: 0 });
  assert.equal(s2.found[1], 1);
  assert.ok(R.canFound(s2, 2));
  assert.deepEqual(R.foundationPiles(s2)[1], [C(1, 1)]);
});

test('Löser: gefundene Wege sind gültig und gewinnen', () => {
  let solved = 0;
  for (let i = 0; i < 20; i++) {
    const st = R.dealSeed('solve-' + i);
    const r = solveBF(st, { maxNodes: 6000 });
    if (!r.solved) continue;
    solved++;
    assert.ok(R.isWon(replay(st, r.moves)));
  }
  assert.ok(solved >= 10, `mindestens die Hälfte schnell lösbar (${solved}/20)`);
});

test('Tiefensuche beweist Unlösbarkeit (Russisch)', () => {
  let proven = 0;
  for (let i = 0; i < 10; i++) if (solve(R.dealSeed('ru-' + i, true), { maxNodes: 50000 }).solved === false) proven++;
  assert.ok(proven >= 3);
});

for (const mode of MODES) {
  const n = mode.suit ? 20 : 40;
  test(`Austeilungen «${mode.label}»: ${n} Spiele, alle garantiert lösbar und deterministisch`, () => {
    let tries = 0;
    for (let i = 1; i <= n; i++) {
      const d = findDeal(`${mode.id}|${i}`, mode.id);
      assert.ok(d.solution, `Spiel ${i} lösbar`);
      assert.ok(R.isWon(replay(fromSeed(d.seed, mode.id), d.solution)));
      assert.equal(d.st.suit, !!mode.suit);
      tries += d.tries;
    }
    assert.equal(findDeal(`${mode.id}|7`, mode.id).seed, findDeal(`${mode.id}|7`, mode.id).seed);
    console.log(`  ${mode.id}: Ø ${(tries / n).toFixed(1)} Versuche pro Austeilung`);
  });
}

test('Tagesspiel: gleicher Tag = gleiche Austeilung', () => {
  const a = findDeal('daily|2026-11-17', 'klassisch');
  const b = findDeal('daily|2026-11-17', 'klassisch');
  const c = findDeal('daily|2026-11-18', 'klassisch');
  assert.equal(a.seed, b.seed);
  assert.notDeepEqual(a.st.cols, c.st.cols);
});

test('Tipp liefert einen erlaubten Zug, der auf dem Lösungsweg bleibt', () => {
  const d = findDeal('klassisch|3', 'klassisch');
  let st = d.st;
  for (let k = 0; k < 25; k++) {
    const h = hint(st);
    assert.ok(h.move && R.isLegal(st, h.move));
    assert.equal(h.solved, true);
    st = R.apply(st, h.move);
  }
});

test('Automatisch beenden erst, wenn alle Karten offen sind', () => {
  const d = findDeal('klassisch|5', 'klassisch');
  assert.equal(finish(d.st), null);
  let st = d.st;
  for (const m of d.solution) {
    if (R.faceDownCount(st) === 0) break;
    st = R.apply(st, m);
  }
  const f = finish(st);
  assert.ok(f && f.length);
  assert.ok(R.isWon(replay(st, f)));
});

test('Zustand bleibt unverändert (unveränderliche Züge)', () => {
  const st = R.dealSeed('immut');
  const copy = JSON.stringify(st);
  for (const m of R.legalMoves(st)) R.apply(st, m);
  assert.equal(JSON.stringify(st), copy);
  assert.ok(R.legalMoves(st).every((m) => m.t !== 'm' || rankOf(st.cols[m.from][m.idx]) > 0));
});
