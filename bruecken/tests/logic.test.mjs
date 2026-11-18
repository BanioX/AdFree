import assert from 'node:assert/strict';
import test from 'node:test';
import { cycle, hintPair, newPuzzle, solved } from '../logic.js';

test('Brücken ergeben ein zusammenhängendes Rätsel', () => {
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    const puzzle = newPuzzle(diff, 4);
    assert.ok(puzzle.islands.length >= 4, diff);
    let state = { ...puzzle, built: {} };
    assert.equal(solved(state), false);
    for (const br of puzzle.solution) {
      for (let n = 0; n < br.n; n++) state = cycle(state, br.a, br.b);
    }
    assert.equal(solved(state), true, diff);
    assert.ok(hintPair({ ...puzzle, built: {} }));
  }
});
