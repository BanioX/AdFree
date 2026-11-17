import assert from 'node:assert/strict';
import test from 'node:test';
import { adjacent, done, extend, newBoard, score } from '../logic.js';

test('Das Feld enthält Wörter auf Deutsch und Englisch', () => {
  for (const which of ['de', 'en']) {
    const board = newBoard('mittel', which === 'de' ? 3 : 9, which);
    assert.equal(board.grid.length, 16);
    assert.ok(board.words.length >= 6, which + ' ' + board.words.length);
    const word = board.words[0];
    const path = board.paths[word];
    assert.equal(path.map((i) => board.grid[i]).join(''), word);
    const res = score({ ...board, found: [] }, path, which);
    assert.equal(res.kind, 'found');
  }
  assert.equal(adjacent(0, 1), true);
  assert.equal(adjacent(0, 5), true);
  assert.equal(adjacent(0, 2), false);
  assert.deepEqual(extend([0], 1), [0, 1]);
  assert.equal(done({ words: ['AA'], found: ['AA'] }), true);
});
