import assert from 'node:assert/strict';
import test from 'node:test';
import { built, land, newTower, slide } from '../logic.js';

test('Blöcke landen mit Überstand und ein Fehlwurf endet sanft', () => {
  let tower = newTower('leicht');
  tower = slide(tower, 400);
  assert.ok(tower.x > 0);
  tower.x = 0.25;
  tower = land(tower);
  assert.equal(tower.stack.length, 2);
  assert.equal(tower.perfect, 1);
  tower.x = 0.95;
  tower.width = 0.2;
  tower = land(tower);
  assert.equal(tower.over, true);
  assert.equal(built({ ...newTower('leicht'), stack: Array(6).fill({ x: 0, w: 0.2 }) }), true);
});
