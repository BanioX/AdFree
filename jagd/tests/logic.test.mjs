import assert from 'node:assert/strict';
import test from 'node:test';
import { guess, hint, lost, newRound, won } from '../logic.js';

test('Richtige Buchstaben öffnen das Wort, sieben daneben verlieren', () => {
  const de = newRound('mittel', 3, 'de');
  const en = newRound('mittel', 3, 'en');
  assert.equal([...de.word].length, 5);
  assert.equal([...en.word].length, 5);
  assert.notEqual(de.word, en.word);
  let s = de;
  for (const ch of new Set(de.word)) s = guess(s, ch);
  assert.equal(won(s), true);
  let bad = { ...de, guesses: [], wrong: 0 };
  for (const ch of 'QXZJVB') bad = guess(bad, ch);
  bad = guess(bad, 'Y');
  assert.equal(lost(bad) || bad.word.includes('Y'), true);
  const helped = hint({ ...de, guesses: [] });
  assert.equal(helped.guesses.length, 1);
});
