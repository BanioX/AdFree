import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBoss, createWorld, step } from '../../lib/retro/sim.js';
import { bosses } from '../data/bosses.js';

test('Ausweichen-Bosse sind gültig und werden müde', () => {
  const list = bosses('de');
  for (const b of list) assert.deepEqual(validateBoss(b), []);
  assert.notEqual(bosses('en')[0].name, list[0].name);
  const w = createWorld({
    mode: 'dodge', diff: 'sanft', bosses: list, coach: false, rng: () => 0.2,
    labels: { praise: ['STARK!'], win: 'GLANZ!', phase: 'STUFE', core: 'NAH!', down: 'AUTSCH', tired: 'MUED' },
  });
  w.intro = 0;
  w.aim = { x: 30, y: 260 };
  step(w, 2);
  assert.ok(w.boss.fatigue > 0.05);
  assert.equal(w.bullets.filter((b) => b.team === 'ally').length, 0);
});
