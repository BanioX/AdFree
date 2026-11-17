import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, hint, solved } from '../logic.js';

test('Hochhäuser sind eindeutig', () => {
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    for (let s = 1; s <= 2; s++) {
      const p = generate(diff, s * 19);
      const clues = [...p.L, ...p.R, ...p.T, ...p.B].filter(Boolean).length;
      assert.ok(clues >= 4);
      while (!solved(p)) assert.equal(hint(p).ok, true);
      assert.equal(solved(p), true);
    }
  }
});
