import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, hint, solved } from '../logic.js';

test('Sternenhimmel ist eindeutig', () => {
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    for (let s = 1; s <= 2; s++) {
      const p = generate(diff, s * 9);
      assert.equal(new Set(p.region).size, p.n);
      while (!solved(p)) assert.equal(hint(p).ok, true);
      assert.equal(solved(p), true);
    }
  }
});
