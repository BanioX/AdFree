import assert from 'node:assert/strict';
import test from 'node:test';
import { hintCell, newPuzzle, press, solved } from '../logic.js';

test('Lichter aus ist lösbar und der Tipp drückt nicht selbst', () => {
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    let state = newPuzzle(diff, 8);
    assert.equal(solved(state), false, diff);
    let guard = 0;
    while (!solved(state) && guard < 30) {
      const i = hintCell(state);
      assert.ok(i >= 0);
      state = press(state, i);
      guard += 1;
    }
    assert.equal(solved(state), true, diff);
  }
});
