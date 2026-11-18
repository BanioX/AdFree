import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step } from '../../lib/retro/sim.js';
import { bosses } from '../data/bosses.js';

test('Sanft: erster Riese verliert Leben, ohne dass der Spieler sofort stirbt', () => {
  const list = bosses('de');
  const w = createWorld({
    mode: 'shoot', diff: 'sanft', bosses: list, coach: false, rng: () => 0.3,
    labels: { core: 'KERN!', win: 'GLANZ!', phase: 'STUFE', praise: ['STARK!'], down: 'AUTSCH' },
  });
  w.intro = 0;
  w.aim = { x: 90, y: 280 };
  let minLives = w.lives;
  for (let i = 0; i < 180; i++) {
    if (w.boss.beams) {
      let hot = false;
      for (const b of w.boss.beams) {
        if (!b.live) continue;
        if (b.type === 'bar' && Math.abs(w.player.y - (b.y + b.h / 2)) < 18) hot = true;
      }
      if (hot) w.aim = { x: w.player.x, y: 200 };
      else w.aim = { x: 90, y: 290 };
    }
    step(w, 1 / 30);
    minLives = Math.min(minLives, w.lives);
    if (w.over) break;
  }
  assert.ok(w.boss.hp < list[0].hp, 'der Kern bekommt Schaden');
  assert.ok(minLives > 0);
});
