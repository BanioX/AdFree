import assert from 'node:assert/strict';
import test from 'node:test';
import { cleared, newWall, stepBall } from '../logic.js';

test('Der Ball trifft einen Stein und kommt vom Schläger zurück', () => {
  let wall = newWall('leicht');
  wall.ball = { x: 0.08, y: 0.1, vx: 0, vy: 0.05 };
  wall = stepBall(wall, 40, 0.5);
  assert.equal(wall.bricks[0].on, false);
  wall.ball = { x: 0.5, y: 0.91, vx: 0, vy: 0.4 };
  wall = stepBall(wall, 40, 0.5);
  assert.ok(wall.ball.vy < 0);
  wall.bricks.forEach((b) => { b.on = false; });
  assert.equal(cleared(wall), true);
});
