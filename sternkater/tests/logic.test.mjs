import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBoss, createWorld, step } from '../../lib/retro/sim.js';
import { bosses } from '../data/bosses.js';

test('Sternkater-Bosse sind gültig und der Sprung landet', () => {
  const list = bosses('de');
  for (const b of list) assert.deepEqual(validateBoss(b), []);
  const w = createWorld({
    mode: 'plat', diff: 'sanft', bosses: list, coach: false, rng: () => 0.4,
    labels: { praise: ['STARK!'], win: 'GLANZ!', phase: 'STUFE', core: 'KERN!', down: 'AUTSCH' },
  });
  w.intro = 0;
  w.wantJump = 0.2;
  const y0 = w.player.y;
  step(w, 0.5);
  assert.ok(w.player.y <= y0);
  assert.ok(w.player.onGround || w.player.y < y0);
  assert.ok(w.bullets.some((b) => b.team === 'ally') || w.score > 0);
});
