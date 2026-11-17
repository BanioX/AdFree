import assert from 'node:assert/strict';
import test from 'node:test';
import { pickMove } from '../../lib/board/ai.js';
import { newGame, moves, apply, undo, clone, flipsFor, counts, aiOptions } from '../logic.js';

test('Start hat vier Züge und der erste Zug dreht einen Stein', () => {
  const s = newGame();
  assert.deepEqual(moves(s), [19, 26, 37, 44]);
  apply(s, 19);
  assert.equal(s.cells[19], 1);
  assert.equal(s.cells[27], 1);
  assert.equal(s.turn, 2);
  assert.deepEqual(counts(s), [4, 1]);
});

test('Rückgängig stellt die Startstellung her', () => {
  const s = newGame();
  const before = clone(s).cells;
  apply(s, 26);
  undo(s);
  assert.deepEqual(s.cells, before);
  assert.equal(s.turn, 1);
  assert.equal(flipsFor(s.cells, 26, 1).length > 0, true);
});

test('KI antwortet mit einem erlaubten Zug', () => {
  const s = newGame();
  apply(s, 19);
  const m = pickMove({ ...aiOptions('mittel'), state: s });
  assert.ok(moves(s).includes(m));
});
