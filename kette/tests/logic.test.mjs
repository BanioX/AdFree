import assert from 'node:assert/strict';
import test from 'node:test';
import { cleared, hintIndex, newChain, pop } from '../logic.js';

test('Die Kette ist leerbar', () => {
  for (const diff of ['leicht', 'mittel', 'schwer']) {
    let chain = newChain(diff, 3);
    assert.ok(chain.balls.length >= 9, diff);
    let guard = 0;
    while (!cleared(chain) && guard < 20) {
      const i = hintIndex(chain);
      assert.ok(i >= 0, diff);
      chain = pop(chain, i);
      guard += 1;
    }
    assert.equal(cleared(chain), true, diff);
  }
});
