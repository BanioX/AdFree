import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, hint, solved } from '../logic.js';

test('Zelte sind eindeutig', () => {
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    for (let s = 1; s <= 2; s++) {
      const p = generate(diff, s * 11);
      assert.equal(p.trees.length, p.key.length);
      while (!solved(p)) assert.equal(hint(p).ok, true);
      assert.equal(solved(p), true);
    }
  }
});
