import assert from 'node:assert/strict';
import test from 'node:test';
import { assign, hint, newPuzzle, solved } from '../logic.js';

test('Deutsch und Englisch lassen sich entschlüsseln', () => {
  for (const which of ['de', 'en']) {
    let state = newPuzzle('schwer', 4, which);
    assert.notEqual(state.text, '');
    const symbols = new Set(Object.values(state.code));
    assert.equal(symbols.size, Object.keys(state.code).length);
    for (const [plain, symbol] of Object.entries(state.code)) state = assign(state, symbol, plain);
    assert.equal(solved(state), true);
    const fresh = newPuzzle('leicht', 2, which);
    const helped = hint(fresh);
    assert.ok(Object.keys(helped.guess).length >= Object.keys(fresh.guess).length);
  }
});
