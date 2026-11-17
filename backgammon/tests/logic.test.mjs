import assert from 'node:assert/strict';
import test from 'node:test';
import { aiPlay, apply, canLand, clone, newGame, pipCount, plays, roll, steps } from '../logic.js';

test('Grundstellung hat 15 Steine und 167 Pips', () => {
  const s = newGame();
  const white = s.pts.reduce((n, v) => n + Math.max(v, 0), 0);
  const black = s.pts.reduce((n, v) => n + Math.max(-v, 0), 0);
  assert.equal(white, 15);
  assert.equal(black, 15);
  assert.equal(pipCount(s, 1), 167);
  assert.equal(pipCount(s, -1), 167);
  assert.equal(canLand(s.pts, 0, 1), false);
});

test('Schlagen, Einwurf und beide Würfel', () => {
  const s = newGame();
  s.pts = Array(24).fill(0);
  s.pts[10] = 1;
  s.pts[8] = -1;
  const hit = steps(s, 2, 1);
  assert.ok(hit.some((m) => m.to === 8));
  apply(s, hit.find((m) => m.to === 8));
  assert.equal(s.pts[8], 1);
  assert.equal(s.barB, 1);

  const blocked = newGame();
  blocked.pts = Array(24).fill(0);
  blocked.barW = 1;
  blocked.pts[23] = -2;
  assert.equal(steps(blocked, 1, 1).length, 0);
  blocked.pts[23] = -1;
  assert.equal(steps(blocked, 1, 1)[0].to, 23);

  const both = newGame();
  both.dice = [6, 1];
  const list = plays(both);
  assert.ok(list.every((p) => p.length === 2));
});

test('Abtragen nur mit genauer oder höherer Zahl', () => {
  const s = newGame();
  s.pts = Array(24).fill(0);
  s.pts[4] = 1;
  s.pts[1] = 1;
  assert.ok(steps(s, 2, 1).some((m) => m.from === 1 && m.to === 'off'));
  assert.equal(steps(s, 6, 1).some((m) => m.from === 1 && m.to === 'off'), false);
  assert.ok(steps(s, 6, 1).some((m) => m.from === 4 && m.to === 'off'));
  assert.ok(steps(s, 5, 1).some((m) => m.from === 4 && m.to === 'off'));
  s.pts[4] = 0;
  assert.ok(steps(s, 4, 1).some((m) => m.from === 1 && m.to === 'off'));
  const next = clone(s);
  apply(next, { from: 1, to: 'off', die: 4, side: 1 });
  assert.equal(next.offW, 1);
});

test('Ist nur ein Würfel möglich, zählt der höhere', () => {
  const s = newGame();
  s.pts = Array(24).fill(0);
  s.pts[0] = 1;
  const list = plays(s, [3, 5], 1);
  assert.ok(list.length);
  assert.ok(list.every((p) => p.length === 1 && p[0].die === 5));
});

test('KI spielt einen erlaubten Zug', () => {
  const s = newGame();
  roll(s, () => 0.1);
  const play = aiPlay(s, 'schwer', () => 0.4);
  assert.ok(play.length);
  const legal = plays(s);
  const id = play.map((m) => m.from + '>' + m.to).join();
  assert.ok(legal.some((p) => p.map((m) => m.from + '>' + m.to).join() === id));
});
