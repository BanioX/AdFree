import assert from 'node:assert/strict';
import test from 'node:test';
import { bestColor, done, flood, newFlood } from '../logic.js';

test('Farbklicker fliesst von der Ecke und kann fertig werden', () => {
  let board = newFlood('leicht', 4);
  assert.equal(board.grid.length, 64);
  let guard = 0;
  while (!done(board) && guard < 80) {
    board = flood(board, bestColor(board));
    guard += 1;
  }
  assert.equal(done(board), true);
});
