import assert from 'node:assert/strict';
import test from 'node:test';
import { fall, newWell, rotate, shift } from '../logic.js';

test('Blöcke drehen, rutschen und räumen eine volle Reihe', () => {
  let well = newWell('leicht', 2);
  const turned = rotate(well);
  assert.notEqual(turned.piece.rot, well.piece.rot);
  const moved = shift(well, -1);
  assert.equal(moved.piece.x, well.piece.x - 1);
  well.cells = Array(well.w * well.h).fill(0);
  well.piece = { k: 'I', rot: 0, x: 0, y: 12 };
  for (let c = 4; c < well.w; c++) well.cells[13 * well.w + c] = 'X';
  well = fall(well);
  assert.equal(well.lines, 1);
  assert.equal(well.cells[13 * well.w + 4], 0);
});
