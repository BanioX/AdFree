import assert from 'node:assert/strict';
import test from 'node:test';
import { pickMove } from '../../lib/board/ai.js';
import { newGame, apply, undo, moves, N, aiOptions, winLine } from '../logic.js';

test('Fünf in einer Reihe gewinnen', () => {
  const s = newGame();
  for (let c = 0; c < 5; c++) {
    s.turn = 1;
    apply(s, c);
  }
  assert.equal(s.winner, 1);
  assert.ok(s.line.length >= 5);
  assert.ok(winLine(s.cells, 4, 1));
});

test('Rückgängig', () => {
  const s = newGame();
  apply(s, 80);
  undo(s);
  assert.equal(s.n, 0);
  assert.equal(s.turn, 1);
  assert.equal(s.cells[80], 0);
});

test('KI gewinnt und blockt unmittelbar', () => {
  const win = newGame();
  for (let c = 0; c < 4; c++) win.cells[c] = 2;
  win.turn = 2;
  const take = pickMove({ ...aiOptions('leicht'), state: win, noise: { leicht: 0 } });
  assert.ok(take === 4 || take === -1 || win.cells[take] === 0);
  assert.equal(take, 4);

  const block = newGame();
  for (let c = 0; c < 4; c++) block.cells[c] = 1;
  block.turn = 2;
  const stop = pickMove({ ...aiOptions('leicht'), state: block, noise: { leicht: 0 } });
  assert.equal(stop, 4);
});

test('Erster Zug ist die Mitte', () => {
  const s = newGame();
  assert.deepEqual(moves(s), [((N / 2) | 0) * N + ((N / 2) | 0)]);
});