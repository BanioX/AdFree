import assert from 'node:assert/strict';
import test from 'node:test';
import { pickMove } from '../../lib/board/ai.js';
import { newGame, apply, undo, moves, aiOptions } from '../logic.js';

test('Säen und Extra-Zug in den eigenen Vorrat', () => {
  const s = newGame();
  apply(s, 2);
  assert.equal(s.p[2], 0);
  assert.equal(s.p[3], 5);
  assert.equal(s.p[6], 1);
  assert.equal(s.extra, true);
  assert.equal(s.turn, 1);
});

test('Leere eigene Mulde fängt die gegenüberliegenden Samen', () => {
  const s = newGame();
  s.p = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0];
  apply(s, 0);
  assert.equal(s.p[1], 0);
  assert.equal(s.p[11], 0);
  assert.equal(s.p[6], 6);
  assert.equal(s.turn, 2);
});

test('Leere Seite beendet die Partie', () => {
  const s = newGame();
  s.p = [0, 0, 0, 0, 0, 1, 4, 2, 0, 0, 0, 0, 0, 3];
  s.turn = 1;
  apply(s, 5);
  assert.equal(s.over, true);
  assert.equal(s.p[0] + s.p[1] + s.p[2] + s.p[3] + s.p[4] + s.p[5], 0);
  assert.ok(s.p[6] + s.p[13] > 4);
});

test('Rückgängig und KI-Zug', () => {
  const s = newGame();
  apply(s, 2);
  undo(s);
  assert.equal(s.p[2], 4);
  assert.equal(s.turn, 1);
  const m = pickMove({ ...aiOptions('leicht'), state: s, noise: { leicht: 0 } });
  assert.ok(moves(s).includes(m));
});

test('KI nimmt einen klaren Fang', () => {
  const s = newGame();
  s.p = [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0];
  s.turn = 1;
  const m = pickMove({ ...aiOptions('leicht'), state: s, noise: { leicht: 0 }, depth: { leicht: 2 } });
  assert.equal(m, 0);
});
