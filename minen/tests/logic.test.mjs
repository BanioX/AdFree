import assert from 'node:assert/strict';
import test from 'node:test';
import { hintCell, newField, reveal, toggleFlag, won } from '../logic.js';

test('Der erste Tipp ist sicher und öffnet Felder', () => {
  let field = newField('leicht', 3);
  field = reveal(field, 0);
  assert.equal(field.boom, false);
  assert.equal(field.open[0], true);
  assert.equal(field.mine[0], false);
  assert.equal(field.mine.filter(Boolean).length, field.mines);
  const flagged = toggleFlag(field, field.mine.findIndex(Boolean));
  assert.equal(flagged.flag[field.mine.findIndex(Boolean)], true);
  assert.ok(hintCell(field) >= 0);
  let guard = 0;
  while (!won(field) && guard < 40) {
    field = reveal(field, hintCell(field));
    guard += 1;
  }
  assert.equal(won(field), true);
});
