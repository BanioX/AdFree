import assert from 'node:assert/strict';
import test from 'node:test';
import { newGame, roll, move, legal, aiPick, clone } from '../logic.js';

test('Ohne 6 bleibt die Figur im Haus', () => {
  const s = newGame();
  assert.equal(roll(s, 4), 'pass');
  assert.equal(s.turn, 1);
  assert.equal(s.p[0][0], -1);
});

test('Eine 6 setzt aufs Startfeld und gibt einen neuen Wurf', () => {
  const s = newGame();
  assert.equal(roll(s, 6), 'move');
  assert.ok(legal(s).includes(0));
  assert.equal(move(s, 0), true);
  assert.equal(s.p[0][0], 0);
  assert.equal(s.phase, 'roll');
  assert.equal(s.turn, 0);
  assert.equal(s.sixes, 1);
});

function trackIndexOf(player, steps) {
  return (player * 10 + steps) % 40;
}
function stepsOf(player, track) {
  return (track - player * 10 + 40) % 40;
}

test('Schlagen, sicheres Startfeld und kein Stapeln', () => {
  const safe = newGame();
  safe.p[0][0] = 5;
  safe.p[1][0] = 0;
  safe.phase = 'move';
  safe.dice = 5;
  assert.equal(legal(safe).includes(0), false);

  const hit = newGame();
  hit.p[0][0] = 2;
  hit.p[1][0] = stepsOf(1, trackIndexOf(0, 5));
  hit.phase = 'move';
  hit.dice = 3;
  assert.ok(legal(hit).includes(0));
  move(hit, 0);
  assert.equal(hit.p[1][0], -1);
  assert.equal(hit.p[0][0], 5);

  const blocked = newGame();
  blocked.p[0][0] = 2;
  blocked.p[0][1] = 4;
  blocked.phase = 'move';
  blocked.dice = 2;
  assert.equal(legal(blocked).includes(0), false);
});

test('Ins Haus nur mit genauer Zahl', () => {
  const s = newGame();
  s.p[0][0] = 38;
  s.phase = 'move';
  s.dice = 6;
  assert.equal(legal(s).includes(0), false);
  s.dice = 2;
  assert.ok(legal(s).includes(0));
  move(s, 0);
  assert.equal(s.p[0][0], 40);
});

test('Beide Figuren im Haus gewinnen', () => {
  const s = newGame();
  s.p[0][0] = 43;
  s.p[0][1] = 39;
  s.phase = 'move';
  s.dice = 1;
  move(s, 1);
  assert.equal(s.over, true);
  assert.equal(s.winner, 0);
});

test('Der dritte Sechser beendet den Zug', () => {
  const s = newGame();
  s.p[0][0] = 1;
  s.sixes = 2;
  s.phase = 'move';
  s.dice = 6;
  move(s, 0);
  assert.equal(s.p[0][0], 7);
  assert.equal(s.turn, 1);
});

test('KI wählt einen erlaubten Zug und schlägt lieber', () => {
  const s = newGame();
  s.p[2][0] = 3;
  s.p[2][1] = 0;
  s.p[0][0] = stepsOf(0, trackIndexOf(2, 6));
  s.turn = 2;
  s.phase = 'move';
  s.dice = 3;
  const list = legal(s);
  assert.ok(list.includes(0));
  const pick = aiPick(s, 'schwer', () => 0);
  assert.ok(list.includes(pick));
  assert.equal(pick, 0);
  const c = clone(s);
  move(s, pick);
  assert.equal(c.p[2][0], 3);
});
