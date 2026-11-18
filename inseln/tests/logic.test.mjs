import test from 'node:test';
import assert from 'node:assert/strict';
import { enumShapes, generate, hint, solved } from '../logic.js';

test('Formen mit Samen werden einmal gezählt', () => {
  const cap = { nodes: 0, cap: 10000, stop: false };
  let n = 0;
  const blocked = new Set();
  enumShapes(3, 4, 3, blocked, cap, () => { n += 1; });
  assert.equal(n, 14);
});

test('Inseln sind eindeutig', () => {
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    const p = generate(diff, 4);
    assert.ok(p.num.some((v) => v > 0));
    let guard = 0;
    while (!solved(p)) {
      assert.equal(hint(p).ok, true);
      assert.ok(++guard < 80);
    }
  }
});
