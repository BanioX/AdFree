// Sterne, Goldrätsel, freischaltbare Farben und das sanfte erste Rätsel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { themes, themeUnlocked, nextLockedTheme, newlyUnlocked } from '../data/themes.js';
import { baseStars, isGoldNumber } from '../progress.js';
import { gentler } from '../puzzles.js';
import { pool } from '../data/pool.js';
import { solutionOf } from '../logic/generator.js';
import { UNITS } from '../logic/board.js';
import { hasUniqueSolution } from '../logic/solver.js';

test('Sterne: 3 ohne Fehler/Tipps, je einer weniger, mindestens 1', () => {
  assert.equal(baseStars({ mistakes: 0, hints: 0 }), 3);
  assert.equal(baseStars({ mistakes: 2, hints: 0 }), 2);
  assert.equal(baseStars({ mistakes: 0, hints: 4 }), 2);
  assert.equal(baseStars({ mistakes: 1, hints: 1 }), 1);
});

test('Goldrätsel: jedes fünfte', () => {
  assert.deepEqual([1, 4, 5, 9, 10, 15].map(isGoldNumber), [false, false, true, false, true, true]);
  assert.equal(isGoldNumber(0), false);
  assert.equal(isGoldNumber(undefined), false);
});

test('Farben: IDs eindeutig, Freischalt-Stufen aufsteigend, erste Farbe nach einem Rätsel erreichbar', () => {
  assert.equal(new Set(themes.map((t) => t.id)).size, themes.length);
  const locks = themes.filter((t) => t.unlock).map((t) => t.unlock);
  assert.deepEqual(locks, [...locks].sort((a, b) => a - b));
  assert.ok(locks[0] <= 3, 'erste Farbe mit einem perfekten Rätsel');
  assert.ok(themes.filter((t) => !t.unlock).length >= 6, 'die bisherigen Farben bleiben frei');
  for (const t of themes) {
    for (const k of ['accent', 'ink', 'sel', 'same', 'peer', 'line', 'thick', 'wave']) assert.match(t[k], /^#[0-9a-f]{6}$/i, `${t.id}.${k}`);
    assert.ok(t.title.length <= 8, `Name «${t.title}» passt unter den Farbpunkt`);
  }
});

test('Farben: freischalten und nächste Stufe', () => {
  const first = themes.find((t) => t.unlock);
  assert.equal(themeUnlocked(first, first.unlock - 1), false);
  assert.equal(themeUnlocked(first, first.unlock), true);
  assert.equal(nextLockedTheme(0).id, first.id);
  assert.equal(nextLockedTheme(10000), null);
  assert.deepEqual(newlyUnlocked(0, first.unlock).map((t) => t.id), [first.id]);
  assert.deepEqual(newlyUnlocked(first.unlock, first.unlock + 1), []);
});

test('Erstes Rätsel: sanfter, eindeutig lösbar, keine Einheit schon fertig', () => {
  for (const p of pool.leicht.slice(0, 5)) {
    const sol = solutionOf(p);
    const g = gentler(p, sol);
    const v = g.split('').map(Number);
    assert.equal(v.filter((x) => !x).length, 28);
    assert.ok(v.every((x, i) => !x || x === +sol[i]), 'nur Zahlen aus der Lösung');
    assert.ok(p.split('').every((ch, i) => ch === '0' || ch === '.' || +ch === v[i]), 'Vorgaben bleiben');
    assert.equal(UNITS.filter((u) => u.every((i) => v[i])).length, 0);
    assert.ok(UNITS.filter((u) => u.filter((i) => !v[i]).length === 1).length >= 5, 'viele fast fertige Einheiten');
    assert.equal(gentler(p, sol), g, 'deterministisch');
    assert.ok(hasUniqueSolution(v), 'eindeutig lösbar');
  }
});
