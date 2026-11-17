// Kugelsortierung – Inhalte & Fairness: node --test ballsort/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelParams, zenParams, hardParams, dailyParams, baseColors, CHAPTERS, CHAPTER_SIZE } from '../data/levels.js';
import { BALLS } from '../data/colors.js';
import { generateLevel } from '../../lib/sorting/generator.js';
import { makeState, applyMove, isSolved, isComplete, validateState } from '../../lib/sorting/engine.js';

const RULES = { move: 'single', complete: 'lock' };

function build(p, seed) {
  return generateLevel({ seed, colors: p.colors, cap: p.cap, empties: p.empties, fill: p.fill, rules: RULES, minMoves: p.minMoves, maxMoves: p.maxMoves, maxTries: p.maxTries });
}

function check(lv, p) {
  const s = makeState(lv.stacks, lv.cap);
  assert.equal(validateState(s), '');
  assert.ok(!lv.stacks.some((c) => isComplete(c, lv.cap)), 'keine fertige Röhre am Anfang');
  for (const m of lv.solution) assert.ok(applyMove(s, m.from, m.to, RULES), 'Zug erlaubt');
  assert.ok(isSolved(s, RULES), 'Lösung führt zum Ziel');
  assert.equal(lv.par, lv.solution.length);
  if (p) assert.equal(lv.stacks.length, p.colors + p.empties + (p.fill === 'loose' ? 1 : 0), 'keine Notfall-Röhre nötig');
}

test('Parameter sind sinnvoll und steigen sanft', () => {
  let prev = 0;
  for (let n = 1; n <= 400; n++) {
    const p = levelParams(n);
    assert.ok(p.colors >= 3 && p.colors <= BALLS.length, `Level ${n}: Farben`);
    assert.ok(p.cap >= 4 && p.cap <= 5);
    assert.ok(p.empties >= 1 && p.empties <= 2);
    const b = baseColors(n);
    assert.ok(b >= prev - 1, 'Grundschwierigkeit fällt nicht stark');
    prev = Math.max(prev, b);
  }
  assert.equal(baseColors(1), 3);
  assert.equal(baseColors(500), 12);
  assert.ok(CHAPTERS.length >= 8 && CHAPTER_SIZE >= 10);
});

test('Level 1–2 sind kurz (Erfolgserlebnis)', () => {
  const l1 = build(levelParams(1), 'ballsort-L1');
  assert.ok(l1.par <= 10, 'Level 1 in höchstens 10 Zügen');
  const l2 = build(levelParams(2), 'ballsort-L2');
  assert.ok(l2.par <= 13);
});

test('Die ersten 120 Level sind lösbar, deterministisch und schnell erzeugt', () => {
  let slow = 0;
  for (let n = 1; n <= 120; n++) {
    const p = levelParams(n);
    const t0 = performance.now();
    const lv = build(p, `ballsort-L${n}`);
    const dt = performance.now() - t0;
    if (dt > 150) slow++;
    check(lv, p);
  }
  assert.ok(slow <= 3, `höchstens wenige langsame Level (${slow})`);
  const a = build(levelParams(37), 'ballsort-L37');
  const b = build(levelParams(37), 'ballsort-L37');
  assert.deepEqual(a.stacks, b.stacks);
});

test('Späte Level (bis 12 Farben) bleiben lösbar', () => {
  for (const n of [150, 233, 400, 999, 1500]) check(build(levelParams(n), `ballsort-L${n}`), levelParams(n));
});

test('Entspannt, Knifflig und Tagesrätsel über viele Seeds lösbar', () => {
  for (let k = 1; k <= 40; k++) {
    check(build(zenParams(k), `ballsort-Z${k}`), zenParams(k));
    check(build(hardParams(k), `ballsort-H${k}`), hardParams(k));
  }
  const d = new Date(2026, 0, 1);
  for (let i = 0; i < 40; i++) {
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    check(build(dailyParams(day), `ballsort-D${day}`), dailyParams(day));
    d.setDate(d.getDate() + 1);
  }
});
