import assert from 'node:assert/strict';
import test from 'node:test';
import { newPuzzle, put, solved } from '../logic.js';

test('Grösser-Kleiner hält die Zeichen ein', () => {
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    let state = newPuzzle(diff, 6);
    for (let i = 0; i < state.grid.length; i++) state = put(state, i, state.solution[i]);
    assert.equal(solved(state), true, diff);
    assert.ok(state.clues.length >= 4);
  }
});
