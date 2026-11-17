import assert from 'node:assert/strict';
import test from 'node:test';
import { pickMove } from '../../lib/board/ai.js';
import { newGame, moves, apply, undo, clone, aiOptions, sideOf } from '../logic.js';

const at = (r, c) => r * 8 + c;

function empty(turn = 1) {
  return { cells: new Array(64).fill(0), turn, quiet: 0, over: false, winner: 0, last: null, _u: [] };
}

test('Grundstellung: zwölf Steine und nur Vorwärtszüge', () => {
  const s = newGame();
  assert.equal(s.cells.filter((p) => p === 1).length, 12);
  assert.equal(s.cells.filter((p) => p === 2).length, 12);
  const list = moves(s);
  assert.equal(list.length, 7);
  assert.ok(list.every((m) => m.taken.length === 0 && ((m.to / 8) | 0) < ((m.from / 8) | 0)));
});

test('Schlagen ist Pflicht, auch rückwärts, und die längste Kette gilt', () => {
  const s = empty();
  s.cells[at(5, 0)] = 1;
  s.cells[at(4, 1)] = 2;
  s.cells[at(2, 3)] = 2;
  s.cells[at(6, 1)] = 2;
  const list = moves(s);
  assert.ok(list.length >= 1);
  assert.ok(list.every((m) => m.taken.length === 2));
  assert.ok(list.some((m) => m.taken.includes(at(4, 1)) && m.taken.includes(at(2, 3))));
  assert.ok(list.every((m) => !m.taken.includes(at(6, 1))));
});

test('Dame fliegt und schlägt aus der Distanz', () => {
  const s = empty();
  s.cells[at(6, 1)] = 3;
  s.cells[at(3, 4)] = 2;
  const list = moves(s);
  assert.ok(list.every((m) => m.taken.length === 1 && m.taken[0] === at(3, 4)));
  assert.ok(list.some((m) => m.to === at(2, 5)));
  assert.ok(list.some((m) => m.to === at(1, 6)));
  assert.ok(!list.some((m) => m.to === at(5, 2)));
});

test('Stein wird in der Kette sofort Dame und schlägt weiter', () => {
  const s = empty();
  s.cells[at(2, 1)] = 1;
  s.cells[at(1, 2)] = 2;
  s.cells[at(1, 4)] = 2;
  const list = moves(s);
  assert.ok(list.length >= 1);
  assert.ok(list.every((m) => m.piece === 3 && m.taken.length === 2));
  assert.ok(list.some((m) => m.to === at(4, 7)));
  const m = list.find((x) => x.to === at(2, 5));
  apply(s, m);
  assert.equal(s.cells[m.to], 3);
  assert.equal(s.cells[at(1, 2)], 0);
  assert.equal(s.turn, 2);
});

test('Rückgängig stellt die Stellung her', () => {
  const s = newGame();
  const before = s.cells.slice();
  apply(s, moves(s)[0]);
  undo(s);
  assert.deepEqual(s.cells, before);
  assert.equal(s.turn, 1);
});

test('KI schlägt einen freien Stein', () => {
  const s = empty(2);
  s.cells[at(4, 1)] = 2;
  s.cells[at(5, 2)] = 1;
  s.cells[at(7, 6)] = 2;
  s.diff = 'schwer';
  const m = pickMove({ ...aiOptions(s), random: () => 0 });
  assert.ok(m.taken.includes(at(5, 2)));
  const legal = moves(s).some((x) => x.from === m.from && x.to === m.to);
  assert.equal(legal, true);
});

test('clone bleibt vom Zug unberührt', () => {
  const s = newGame();
  const c = clone(s);
  apply(s, moves(s)[0]);
  assert.equal(c.turn, 1);
  assert.equal(c.cells.filter((p) => sideOf(p) === 1).length, 12);
});
