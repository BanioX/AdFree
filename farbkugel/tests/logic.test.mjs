import assert from 'node:assert/strict';
import test from 'node:test';
import { move, newBoard, route, won } from '../logic.js';

test('Fünf Kugeln in einer Reihe verschwinden, der Weg geht um andere herum', () => {
  let board = newBoard('leicht', 1);
  board.balls = Array(49).fill(-1);
  for (let c = 0; c < 4; c++) board.balls[c] = 1;
  board.balls[10] = 1;
  board.balls[8] = 2;
  assert.ok(route(board.balls, 10, 4));
  assert.equal(route(board.balls, 10, 8), null);
  board = move(board, 10, 4);
  assert.equal(board.lines, 1);
  assert.ok(board.balls.slice(0, 5).every((v) => v < 0));
  assert.equal(won(board), true);
});
