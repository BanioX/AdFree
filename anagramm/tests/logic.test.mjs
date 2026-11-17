import assert from 'node:assert/strict';
import test from 'node:test';
import { current, newRound, solved, take } from '../logic.js';

test('Deutsch und Englisch lassen sich legen', () => {
  for (const which of ['de', 'en']) {
    const state = newRound('mittel', 5, which);
    assert.equal(state.tiles.length, [...state.word].length);
    assert.equal([...state.tiles].sort().join(''), [...state.word].sort().join(''));
    let s = state;
    for (const ch of state.word) {
      const i = s.tiles.findIndex((c, n) => c === ch && !s.picked.includes(n));
      s = take(s, i);
    }
    assert.equal(current(s), state.word);
    assert.equal(solved(s), true);
  }
});
