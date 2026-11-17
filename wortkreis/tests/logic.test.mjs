import assert from 'node:assert/strict';
import test from 'node:test';
import { makeRng } from '../../shared/rng.js';
import { makeWheel } from '../../lib/words/spell.js';
import { done, hint, newPuzzle, submit, typeLetter } from '../logic.js';

test('Deutsch und Englisch liefern ein Rad', () => {
  for (const which of ['de', 'en']) {
    const w = makeWheel(makeRng(4).next, { which, size: 6, min: 3, need: 6 });
    assert.ok(w.words.length >= 6, which + ' ' + w.words.length);
    assert.equal(w.letters.length, 6);
  }
});

test('Ein gelegtes Wort zählt, Unsinn nicht', () => {
  const state = newPuzzle('mittel', 4, 'de');
  const word = state.words.find((w) => [...w].every((ch, i) => [...w].indexOf(ch) === i)) || state.words[0];
  let s = { ...state, entry: '' };
  for (const ch of word) s = typeLetter(s, ch);
  const res = submit(s, 'de');
  assert.equal(res.kind, 'found');
  assert.equal(done(res.state), state.words.length === 1);
  const bad = submit({ ...state, entry: 'QQQ' }, 'de');
  assert.equal(bad.kind, 'no');
  const hinted = hint({ ...state, found: [] });
  assert.equal(hinted.found.length, 1);
});
