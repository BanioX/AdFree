// Wollknäuel – Inhalte & Fairness: node --test yarn/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelParams, zenParams, hardParams, dailyParams, baseColors, CHAPTERS, CHAPTER_SIZE } from '../data/levels.js';
import { YARNS } from '../data/colors.js';
import { ITEMS, itemFor } from '../data/items.js';
import { generateLevel } from '../../lib/sorting/generator.js';
import { makeState, applyMove, undoMove, isSolved, isComplete, validateState } from '../../lib/sorting/engine.js';

const RULES = { move: 'group', complete: 'clear' };

function build(p, seed) {
  return generateLevel({ seed, colors: p.colors, cap: p.cap, empties: p.empties, fill: p.fill, rules: RULES, minMoves: p.minMoves, maxMoves: p.maxMoves, maxTries: p.maxTries });
}

function check(lv, p) {
  const s = makeState(lv.stacks, lv.cap);
  assert.equal(validateState(s), '');
  assert.ok(!lv.stacks.some((c) => isComplete(c, lv.cap)), 'keine volle Spule am Anfang');
  let cleared = 0;
  for (const m of lv.solution) {
    const rec = applyMove(s, m.from, m.to, RULES);
    assert.ok(rec, 'Zug erlaubt');
    if (rec.cleared) cleared++;
  }
  assert.ok(isSolved(s, RULES), 'alles verstrickt');
  if (p) {
    assert.equal(cleared, p.colors, 'jede Farbe wird genau einmal verstrickt');
    assert.equal(lv.stacks.length, p.colors + p.empties + (p.fill === 'loose' ? 1 : 0), 'keine Notfall-Spule nötig');
  }
}

test('Parameter sind sinnvoll', () => {
  for (let n = 1; n <= 400; n++) {
    const p = levelParams(n);
    assert.ok(p.colors >= 3 && p.colors <= YARNS.length, `Level ${n}: Farben`);
    assert.ok(p.cap >= 3 && p.cap <= 5);
    assert.ok(p.empties >= 0 && p.empties <= 2);
    if (p.empties === 0) assert.equal(p.fill, 'loose', 'ohne leere Spule nur bei loser Füllung');
  }
  assert.equal(baseColors(1), 3);
  assert.equal(baseColors(2000), 12);
  assert.ok(CHAPTERS.length >= 8 && CHAPTER_SIZE >= 10);
});

test('Level 1 ist kurz', () => {
  assert.ok(build(levelParams(1), 'yarn-L1').par <= 6);
});

test('Die ersten 120 Level sind lösbar und deterministisch', () => {
  for (let n = 1; n <= 120; n++) check(build(levelParams(n), `yarn-L${n}`), levelParams(n));
  assert.deepEqual(build(levelParams(31), 'yarn-L31').stacks, build(levelParams(31), 'yarn-L31').stacks);
});

test('Späte Level bleiben lösbar', () => {
  for (const n of [150, 305, 777, 1500]) check(build(levelParams(n), `yarn-L${n}`), levelParams(n));
});

test('Entspannt, Knifflig und Tagesrätsel über viele Seeds lösbar', () => {
  for (let k = 1; k <= 40; k++) {
    check(build(zenParams(k), `yarn-Z${k}`), zenParams(k));
    check(build(hardParams(k), `yarn-H${k}`), hardParams(k));
  }
  const d = new Date(2026, 0, 1);
  for (let i = 0; i < 40; i++) {
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    check(build(dailyParams(day), `yarn-D${day}`), dailyParams(day));
    d.setDate(d.getDate() + 1);
  }
});

test('Rückgängig stellt eine verstrickte Spule wieder her', () => {
  const s = makeState([[1, 0, 0], [0], [1, 1]], 3);
  const rec = applyMove(s, 0, 1, RULES);
  assert.ok(rec.cleared);
  assert.deepEqual(s.stacks, [[1], [], [1, 1]]);
  undoMove(s, rec);
  assert.deepEqual(s.stacks, [[1, 0, 0], [0], [1, 1]]);
});

test('Strickstücke: eindeutig, aufsteigend freigeschaltet, reihum', () => {
  const ids = new Set(ITEMS.map((it) => it.id));
  assert.equal(ids.size, ITEMS.length);
  assert.equal(ITEMS[0].at, 0);
  for (let i = 1; i < ITEMS.length; i++) assert.ok(ITEMS[i].at > ITEMS[i - 1].at);
  for (const it of ITEMS) assert.ok(/^M[\d .,a-zA-Z-]+$/.test(it.body), `${it.id}: Pfad`);
  assert.equal(itemFor(0).id, 'topflappen');
  const seen = new Set();
  for (let n = 0; n < 200; n++) {
    const it = itemFor(n);
    assert.ok(it.at <= n, 'nur freigeschaltete Stücke');
    seen.add(it.id);
  }
  assert.equal(seen.size, ITEMS.length, 'alle Stücke kommen vor');
});
