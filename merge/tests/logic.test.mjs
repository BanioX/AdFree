// node --test merge/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, move, slide, canMove, fromText, toText, isValidState, goalReached, legalMoves, boardSum, cloneState,
} from '../logic.js';
import { bestMove } from '../ai.js';

const row = (s, dir) => toText(slide(fromText(s), dir).state);

test('gleiche Kacheln verschmelzen nur einmal pro Zug', () => {
  assert.equal(row('2 2 2 2\n. . . .\n. . . .\n. . . .', 'left').split('\n')[0], '4 4 . .');
  assert.equal(row('2 2 4 .\n. . . .\n. . . .\n. . . .', 'left').split('\n')[0], '4 4 . .');
  assert.equal(row('4 4 8 .\n. . . .\n. . . .\n. . . .', 'right').split('\n')[0], '. . 8 8');
  assert.equal(row('2 . 2 2\n. . . .\n. . . .\n. . . .', 'right').split('\n')[0], '. . 2 4');
});

test('senkrecht schieben und Punkte', () => {
  const r = slide(fromText('2 . .\n2 . .\n4 . .'), 'down');
  assert.equal(toText(r.state), '. . .\n4 . .\n4 . .');
  assert.equal(r.gained, 4);
  assert.equal(r.merges.length, 1);
});

test('Steine und Löcher blockieren', () => {
  assert.equal(row('2 # 2 .\n. . . .\n. . . .\n. . . .', 'left').split('\n')[0], '2 # 2 .');
  assert.equal(row('. 2 # 2\n. . . .\n. . . .\n. . . .', 'left').split('\n')[0], '2 . # 2');
  assert.equal(row('_ 2 2 .\n. . . .\n. . . .\n. . . .', 'left').split('\n')[0], '_ 4 . .');
});

test('kein Zug, wenn sich nichts bewegt – sonst genau eine neue Kachel', () => {
  const s = fromText('2 . . .\n. . . .\n. . . .\n. . . .');
  const r0 = move(s, 'left');
  assert.equal(r0.moved, false);
  assert.equal(r0.state, s);
  const r1 = move(s, 'right');
  assert.equal(r1.moved, true);
  assert.equal(r1.state.cells.filter(Boolean).length, 2);
  assert.ok(r1.spawn);
  assert.equal(r1.state.moves, 1);
  assert.equal(s.moves, 0, 'Ausgangszustand bleibt unverändert');
});

test('neue Kacheln sind deterministisch (Seed + Zähler)', () => {
  const a = createGame({ size: 4, seed: 'abc' });
  const b = createGame({ size: 4, seed: 'abc' });
  assert.deepEqual(a.cells, b.cells);
  let x = a, y = b;
  for (const d of ['left', 'up', 'right', 'down', 'left', 'up']) { x = move(x, d).state; y = move(y, d).state; }
  assert.deepEqual(x, y);
  assert.ok(isValidState(JSON.parse(JSON.stringify(x))));
});

test('Spielende erkennen', () => {
  const s = fromText('2 4 2\n4 2 4\n2 4 2');
  assert.equal(canMove(s), false);
  assert.equal(s.over, true);
  assert.deepEqual(legalMoves(s), []);
  assert.equal(canMove(fromText('2 4 2\n4 2 4\n2 4 4')), true);
});

test('Ziel «Kachel» und Ziel «mehrmals bilden»', () => {
  let s = fromText('64 64 . .\n. . . .\n. . . .\n. . . .', { target: 7 });
  const r = move(s, 'left');
  assert.equal(r.won, true);
  assert.equal(r.state.won, true);
  assert.equal(move(r.state, 'right').won, false, 'Sieg wird nur einmal gemeldet');
  s = fromText('8 8 8 8\n. . . .\n. . . .\n. . . .', { goal: { type: 'count', e: 4, n: 2 } });
  const c = move(s, 'left');
  assert.equal(c.state.made, 2);
  assert.ok(goalReached(c.state));
});

test('Punkte = Summe aller verschmolzenen Werte; Summe auf dem Brett stimmt', () => {
  let s = createGame({ size: 4, seed: 'sum' });
  let spawned = boardSum(s);
  for (let i = 0; i < 200 && !s.over; i++) {
    const d = bestMove(s, { depth: 1 });
    const r = move(s, d);
    if (r.spawn) spawned += 2 ** r.spawn.e;
    s = r.state;
  }
  assert.equal(boardSum(s), spawned, 'Verschmelzen erhält die Summe');
  assert.ok(s.score > 0);
});

test('isValidState verwirft kaputte Spielstände', () => {
  const s = createGame({ size: 4, seed: 'v' });
  assert.ok(isValidState(s));
  assert.equal(isValidState(null), false);
  assert.equal(isValidState({ ...cloneState(s), cells: [] }), false);
  const bad = cloneState(s);
  bad.cells[0] = { id: 1, e: 1 }; bad.cells[1] = { id: 1, e: 1 };
  assert.equal(isValidState(bad), false);
  assert.equal(isValidState({ ...cloneState(s), v: 2 }), false);
});

test('Tipp-Geber findet in 4×4 meist 512', () => {
  let wins = 0;
  for (let k = 0; k < 3; k++) {
    let s = createGame({ size: 4, seed: 'bot' + k, target: 9 });
    for (let i = 0; i < 2000 && !s.won && !s.over; i++) s = move(s, bestMove(s)).state;
    if (s.won) wins++;
  }
  assert.ok(wins >= 2, `nur ${wins}/3`);
});
