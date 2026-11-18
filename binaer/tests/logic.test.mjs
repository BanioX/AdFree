import assert from 'node:assert/strict';
import test from 'node:test';
import { newPuzzle, rulesOk, setCell, solved } from '../logic.js';

test('Binärrätsel ist gültig und lösbar', () => {
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    const puzzle = newPuzzle(diff, 5);
    assert.equal(rulesOk(puzzle.solution, puzzle.w), true, diff);
    let state = puzzle;
    for (let i = 0; i < state.grid.length; i++) {
      let guard = 0;
      while (state.grid[i] !== state.solution[i] && guard < 4) {
        state = setCell(state, i);
        guard += 1;
      }
    }
    assert.equal(solved(state), true, diff);
  }
});
