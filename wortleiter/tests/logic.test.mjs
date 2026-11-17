import assert from 'node:assert/strict';
import test from 'node:test';
import { choices, hintStep, newLadder, play, solved } from '../logic.js';

test('Leitern gibt es auf Deutsch und Englisch', () => {
  for (const which of ['de', 'en']) {
    const state = newLadder('leicht', 2, which);
    assert.notEqual(state.start, state.goal);
    assert.equal([...state.start].length, 4);
    let guard = 0;
    let s = state;
    while (!solved(s) && guard++ < 8) s = hintStep(s, which);
    assert.equal(solved(s), true);
    const opts = choices(state, 0, which);
    if (opts.length) {
      const moved = play(state, 0, opts[0], which);
      assert.equal(moved.chain.length, 2);
    }
  }
});
