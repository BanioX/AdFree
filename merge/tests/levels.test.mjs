// Lösbarkeit: Der Computer-Spieler schafft jede Etappe (Stichprobe über alle Kapitel und Runden).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel } from '../levelgen.js';
import { createGame } from '../logic.js';
import { autoplay } from '../ai.js';
import { modes } from '../data/modes.js';

function solvable(level, tries = 3) {
  for (let k = 0; k < tries; k++) {
    const s = autoplay(createGame({ size: level.size, walls: level.walls, seed: `solve-${level.n}-${k}`, goal: level.goal }), { maxMoves: 4000 });
    if (s.won) return true;
  }
  return false;
}

test('Kapitel-Runde 1 (Etappen 1–84) ist lösbar', () => {
  const fails = [];
  for (let n = 1; n <= 84; n++) if (!solvable(makeLevel(n))) fails.push(n);
  assert.deepEqual(fails, []);
});

test('spätere Runden (Stichprobe) sind lösbar', () => {
  const fails = [];
  for (const n of [85, 90, 96, 180, 252, 341, 348, 420, 600]) if (!solvable(makeLevel(n))) fails.push(n);
  assert.deepEqual(fails, []);
});

test('Knifflig 3×3: Ziel erreichbar', () => {
  const m = modes.find((x) => x.size === 3);
  let wins = 0;
  for (let k = 0; k < 6; k++) if (autoplay(createGame({ size: 3, seed: 'k' + k, target: m.target }), { maxMoves: 3000 }).won) wins++;
  assert.ok(wins >= 1, 'Knifflig nie geschafft');
});
