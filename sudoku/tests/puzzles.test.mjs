// Rätsel-Auswahl (puzzles.js) mit nachgebautem localStorage:  node --test sudoku/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
};

const { nextPuzzle, nextNumber, dailyPuzzle } = await import('../puzzles.js');
const { parse } = await import('../logic/board.js');
const { grade } = await import('../logic/human.js');
const { countSolutions } = await import('../logic/solver.js');
const { difficultyById, DAILY_DIFFICULTY } = await import('../data/difficulties.js');

test('Tagesrätsel: für alle gleich, jeden Tag anders, Stufe Mittel', () => {
  const a = dailyPuzzle('2026-11-17'), b = dailyPuzzle('2026-11-17'), c = dailyPuzzle('2026-11-18');
  assert.deepEqual(a, b);
  assert.notEqual(a.puzzle, c.puzzle);
  assert.equal(DAILY_DIFFICULTY, 'mittel');
  const spec = difficultyById('mittel');
  for (const day of ['2026-11-17', '2026-12-24', '2027-02-29']) {
    const d = dailyPuzzle(day);
    assert.equal(countSolutions(parse(d.puzzle), 2), 1);
    const g = grade(parse(d.puzzle), 4);
    assert.ok(g.solved && g.tier >= spec.minTier && g.tier <= spec.maxTier);
    assert.equal(g.values.join(''), d.solution);
  }
});

test('Nächstes Rätsel: zählt hoch, liefert gültige, verschiedene Rätsel', () => {
  for (const id of ['leicht', 'experte']) {
    assert.equal(nextNumber(id), 1);
    const seen = new Set();
    for (let k = 1; k <= 5; k++) {
      const p = nextPuzzle(id);
      assert.equal(p.number, k);
      assert.match(p.puzzle, /^[0-9]{81}$/);
      assert.equal(countSolutions(parse(p.puzzle), 2), 1);
      for (let i = 0; i < 81; i++) if (p.puzzle[i] !== '0') assert.equal(p.puzzle[i], p.solution[i]);
      seen.add(p.puzzle);
    }
    assert.equal(seen.size, 5);
    assert.equal(nextNumber(id), 6);
  }
});
