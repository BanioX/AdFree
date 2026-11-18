import assert from 'node:assert/strict';
import test from 'node:test';
import { current, hint, lengthFor, newRound, solved, take } from '../logic.js';

test('Emoji-Rätsel hat eigene Listen und einen Buchstabenkorb', () => {
  for (const which of ['de', 'en']) {
    for (const diff of ['leicht', 'mittel', 'schwer']) {
      const round = newRound(diff, which === 'de' ? 4 : 9, which);
      assert.equal([...round.word].length, lengthFor(diff));
      assert.ok(round.emoji);
      for (const ch of round.word) assert.ok(round.bank.includes(ch));
      assert.ok(round.bank.length === [...round.word].length + 2);
    }
  }
  let state = newRound('leicht', 2, 'de');
  for (const ch of state.word) {
    const index = state.bank.findIndex((letter, i) => letter === ch && !state.picks.includes(i));
    state = take(state, index);
  }
  assert.equal(current(state), state.word);
  assert.equal(solved(state), true);
  const fresh = newRound('mittel', 5, 'en');
  const stepped = hint(fresh);
  assert.equal(current(stepped), fresh.word[0]);
});
