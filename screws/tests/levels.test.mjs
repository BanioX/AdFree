// Schrauben & Muttern – Inhalte & Fairness: node --test screws/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelParams, zenParams, hardParams, dailyParams, baseColors, CHAPTERS, CHAPTER_SIZE } from '../data/levels.js';
import { NUTS } from '../data/colors.js';
import { generateLevel } from '../../lib/sorting/generator.js';
import { makeState, applyMove, isSolved, isComplete, validateState } from '../../lib/sorting/engine.js';

const RULES = { move: 'group', complete: 'lock' };

function build(p, seed) {
  return generateLevel({ seed, colors: p.colors, cap: p.cap, empties: p.empties, fill: p.fill, rules: RULES, minMoves: p.minMoves, maxMoves: p.maxMoves, maxTries: p.maxTries });
}

function check(lv, p) {
  const s = makeState(lv.stacks, lv.cap);
  assert.equal(validateState(s), '');
  assert.ok(!lv.stacks.some((c) => isComplete(c, lv.cap)), 'keine fertige Schraube am Anfang');
  for (const m of lv.solution) {
    const rec = applyMove(s, m.from, m.to, RULES);
    assert.ok(rec, 'Zug erlaubt');
    assert.equal(rec.count, m.count, 'Gruppenzug bewegt alle passenden Muttern');
  }
  assert.ok(isSolved(s, RULES), 'Lösung führt zum Ziel');
  if (p) assert.equal(lv.stacks.length, p.colors + p.empties + (p.fill === 'loose' ? 1 : 0), 'keine Notfall-Schraube nötig');
}

test('Parameter sind sinnvoll', () => {
  for (let n = 1; n <= 400; n++) {
    const p = levelParams(n);
    assert.ok(p.colors >= 3 && p.colors <= NUTS.length, `Level ${n}: Farben`);
    assert.ok(p.cap >= 3 && p.cap <= 5);
    assert.ok(p.empties >= 1 && p.empties <= 2);
  }
  assert.equal(baseColors(1), 3);
  assert.equal(baseColors(1000), 12);
  assert.ok(CHAPTERS.length >= 8 && CHAPTER_SIZE >= 10);
  assert.ok(levelParams(15).hidden, 'Level 15 hat verdeckte Muttern');
});

test('Level 1 ist kurz (Erfolgserlebnis)', () => {
  const l1 = build(levelParams(1), 'screws-L1');
  assert.ok(l1.par <= 6);
});

test('Die ersten 120 Level sind lösbar und deterministisch', () => {
  for (let n = 1; n <= 120; n++) check(build(levelParams(n), `screws-L${n}`), levelParams(n));
  assert.deepEqual(build(levelParams(44), 'screws-L44').stacks, build(levelParams(44), 'screws-L44').stacks);
});

test('Späte Level bleiben lösbar', () => {
  for (const n of [160, 271, 512, 1200]) check(build(levelParams(n), `screws-L${n}`), levelParams(n));
});

test('Entspannt, Knifflig und Tagesrätsel über viele Seeds lösbar', () => {
  for (let k = 1; k <= 40; k++) {
    check(build(zenParams(k), `screws-Z${k}`), zenParams(k));
    check(build(hardParams(k), `screws-H${k}`), hardParams(k));
  }
  const d = new Date(2026, 0, 1);
  for (let i = 0; i < 40; i++) {
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    check(build(dailyParams(day), `screws-D${day}`), dailyParams(day));
    d.setDate(d.getDate() + 1);
  }
});
