import assert from 'node:assert/strict';
import test from 'node:test';
import { pickMove } from '../../lib/board/ai.js';
import { newGame, apply, undo, moves, clone, winningLine, aiOptions, outcome } from '../logic.js';

function colFill(state, col, who, n) {
  for (let i = 0; i < n; i++) {
    state.turn = who;
    apply(state, col);
  }
}

test('Stein stapelt sich und die Reihe wird voll', () => {
  const s = newGame();
  for (let i = 0; i < 6; i++) {
    s.turn = 1;
    apply(s, 0);
  }
  assert.equal(s.h[0], 6);
  assert.ok(!moves(s).includes(0));
  assert.equal(s.cells[5 * 7], 1);
});

test('Vier waagrecht, senkrecht und diagonal', () => {
  const h = newGame();
  for (let c = 0; c < 4; c++) { h.turn = 1; apply(h, c); }
  assert.equal(h.winner, 1);
  assert.ok(h.line.length >= 4);

  const v = newGame();
  for (let i = 0; i < 4; i++) { v.turn = 1; apply(v, 2); }
  assert.equal(v.winner, 1);

  const d = newGame();
  // Diagonale von (0,0) nach (3,3): jeweils vorher die Spalte für den Gegner füllen.
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < i; k++) { d.turn = 2; apply(d, i); }
    d.turn = 1;
    apply(d, i);
  }
  assert.equal(d.winner, 1);
  assert.ok(winningLine(d, 3, 3));
});

test('Rückgängig stellt die Stellung wieder her', () => {
  const s = newGame();
  apply(s, 3);
  apply(s, 3);
  const before = clone(s);
  apply(s, 4);
  undo(s);
  assert.deepEqual(s.cells, before.cells);
  assert.deepEqual(s.h, before.h);
  assert.equal(s.turn, before.turn);
  assert.equal(s.n, before.n);
});

test('KI nimmt den direkten Gewinn und blockt', () => {
  const win = newGame();
  colFill(win, 0, 2, 3);
  win.turn = 2;
  const take = pickMove({ ...aiOptions('leicht'), state: win, noise: { leicht: 0 } });
  assert.equal(take, 0);

  const block = newGame();
  colFill(block, 0, 1, 3);
  block.turn = 2;
  const stop = pickMove({ ...aiOptions('leicht'), state: block, noise: { leicht: 0 } });
  assert.equal(stop, 0);
});

test('Eröffnung liefert einen gültigen Zug', () => {
  const s = newGame();
  const m = pickMove({ ...aiOptions('mittel'), state: s });
  assert.ok(moves(s).includes(m));
  assert.equal(outcome(s), null);
});
