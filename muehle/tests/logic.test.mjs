import assert from 'node:assert/strict';
import test from 'node:test';
import { pickMove } from '../../lib/board/ai.js';
import { MILLS, NEI, newGame, moves, apply, undo, clone, aiOptions, count } from '../logic.js';

test('Brett hat 16 Mühlen und die Ecke zwei Nachbarn', () => {
  assert.equal(MILLS.length, 16);
  assert.equal(NEI[0].length, 2);
  assert.equal(NEI[1].length, 3);
  assert.ok(!NEI[0].includes(2));
});

test('Am Anfang gibt es 24 Setz-Züge', () => {
  const s = newGame();
  const list = moves(s);
  assert.equal(list.length, 24);
  assert.ok(list.every((m) => m.remove == null));
});

test('Eine neue Mühle darf einen Stein ausserhalb einer Mühle nehmen', () => {
  const s = newGame();
  s.cells[0] = 1;
  s.cells[1] = 1;
  s.cells[9] = 2;
  s.cells[10] = 2;
  s.cells[11] = 2;
  s.cells[23] = 2;
  s.left = [0, 1, 9];
  const list = moves(s).filter((m) => m.place === 2);
  assert.ok(list.length >= 1);
  assert.ok(list.every((m) => m.remove != null));
  assert.ok(list.every((m) => m.remove !== 9 && m.remove !== 10 && m.remove !== 11));
  apply(s, list[0]);
  assert.equal(s.cells[2], 1);
  assert.equal(s.cells[23], 0);
  assert.equal(count(s, 2), 3);
  assert.equal(s.turn, 2);
});

test('Stehen alle gegnerischen Steine in Mühlen, darf jeder weg', () => {
  const s = newGame();
  s.cells[0] = 1;
  s.cells[1] = 1;
  s.cells[9] = 2;
  s.cells[10] = 2;
  s.cells[11] = 2;
  s.left = [0, 1, 0];
  const list = moves(s).filter((m) => m.place === 2);
  assert.deepEqual(list.map((m) => m.remove).sort((a, b) => a - b), [9, 10, 11]);
});

test('Mit drei Steinen darf man fliegen, sonst nur zum Nachbarn', () => {
  const s = newGame();
  s.left = [0, 0, 0];
  s.cells[0] = 1;
  s.cells[3] = 1;
  s.cells[6] = 1;
  s.cells[2] = 2;
  s.cells[5] = 2;
  s.cells[8] = 2;
  s.cells[14] = 2;
  const fly = moves(s);
  assert.ok(fly.some((m) => m.from === 0 && m.to === 23));
  s.cells[15] = 1;
  const step = moves(s).filter((m) => m.from === 0);
  assert.deepEqual(step.map((m) => m.to).sort(), NEI[0].slice().sort());
});

test('Rückgängig und KI-Zug', () => {
  const s = newGame();
  const before = s.cells.slice();
  apply(s, moves(s)[0]);
  undo(s);
  assert.deepEqual(s.cells, before);
  assert.equal(s.left[1], 9);
  const c = clone(s);
  s.diff = 'leicht';
  const m = pickMove({ ...aiOptions(s), random: () => 0 });
  assert.equal(m.place >= 0, true);
  apply(c, m);
  assert.equal(count(c, 1), 1);
});
