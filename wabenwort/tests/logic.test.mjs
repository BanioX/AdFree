import assert from 'node:assert/strict';
import test from 'node:test';
import { done, newPuzzle, submit, typeLetter } from '../logic.js';

test('Mitte ist Pflicht, Wiederholung ist erlaubt', () => {
  for (const which of ['de', 'en']) {
    const state = newPuzzle('mittel', which === 'de' ? 8 : 11, which);
    assert.equal(state.letters.length, 7);
    assert.ok(state.words.length >= 6, which);
    assert.ok(state.words.every((w) => w.includes(state.center) && [...w].length >= 4));
  }
  const state = newPuzzle('mittel', 8, 'de');
  const word = state.words[0];
  let s = { ...state, entry: '' };
  for (const ch of word) s = typeLetter(s, ch);
  assert.equal(submit(s, 'de').kind, 'found');
  const missing = submit({ ...state, entry: 'XXXX' }, 'de');
  assert.equal(missing.kind === 'center' || missing.kind === 'no' || missing.kind === 'short', true);
  assert.equal(done({ ...state, found: state.words.slice() }), true);
});
