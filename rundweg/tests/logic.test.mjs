import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, hint, solved } from '../logic.js';

test('Rundweg ist eindeutig', () => {
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    const p = generate(diff, 6);
    assert.ok(p.clue.some((v) => v >= 0));
    while (!solved(p)) assert.equal(hint(p).ok, true);
    assert.equal(solved(p), true);
  }
});
