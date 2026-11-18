import assert from 'node:assert/strict';
import test from 'node:test';
import { cellsOf, filled, newPuzzle, wordCells } from '../logic.js';

test('Die Minirätsel sind gefüllt und kreuzen sich', () => {
  for (const which of ['de', 'en']) {
    const puzzle = newPuzzle('mittel', 1, which);
    assert.equal(puzzle.mask.length, 7);
    assert.ok(puzzle.mask.every((row) => [...row].length === 7));
    for (const clue of puzzle.clues) {
      const cells = wordCells(puzzle.mask, clue);
      assert.ok(cells.length >= 3, clue.text);
      assert.equal(cells[0].r, clue.r);
    }
    const all = cellsOf(puzzle.mask);
    const fill = {};
    for (const cell of all) fill[cell.r + ',' + cell.c] = cell.ch;
    assert.equal(filled({ ...puzzle, fill }), true);
  }
});
