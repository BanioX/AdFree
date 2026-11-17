import assert from 'node:assert/strict';
import test from 'node:test';
import { drop, newBowl, settle, won } from '../logic.js';

test('Zwei gleiche Früchte verschmelzen und das Ziel ist erreichbar', () => {
  let bowl = newBowl('leicht', 2);
  bowl = { ...bowl, current: 1, next: 1 };
  bowl = drop(bowl, 0);
  bowl = { ...bowl, current: 1, next: 1 };
  bowl = drop(bowl, 0);
  assert.ok(bowl.grid.includes(2));
  const grid = Array(30).fill(0);
  grid[29] = 3;
  grid[28] = 3;
  const { best } = settle(grid);
  assert.equal(best, 4);
  assert.equal(won({ ...bowl, grid, goal: 4 }), true);
});
