import assert from 'node:assert/strict';
import test from 'node:test';
import { newSnake, reached, step, turn } from '../logic.js';

test('Die Schlange wächst, dreht nicht um und hält an sich selbst an', () => {
  let snake = newSnake('leicht', 1);
  const before = snake.snake[0];
  snake = step(snake);
  assert.equal(snake.snake[0], before + 1);
  snake = turn(snake, -1, 0);
  assert.equal(snake.dir.c, 1);
  snake = turn(snake, 0, 1);
  assert.equal(snake.dir.r, 1);
  snake.food = snake.snake[0] + snake.w;
  const len = snake.snake.length;
  snake = step(snake);
  assert.equal(snake.snake.length, len + 1);
  snake.snake = [5, 4, 3];
  snake.dir = { c: -1, r: 0 };
  const blocked = step(snake);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.snake[0], 5);
  assert.equal(reached({ ...snake, goal: 3 }), true);
});
