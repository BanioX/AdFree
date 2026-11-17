// Tests für die gemeinsame Sortier-Engine: node --test lib/sorting/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine.js';
import { solve, expandMoves } from '../solver.js';
import { generateLevel, adjacency } from '../generator.js';

const SINGLE = { move: 'single', complete: 'lock' };
const GROUP = { move: 'group', complete: 'lock' };
const CLEAR = { move: 'group', complete: 'clear' };

test('topRun und isComplete', () => {
  assert.deepEqual(E.topRun([0, 1, 1]), { color: 1, len: 2 });
  assert.deepEqual(E.topRun([]), { color: -1, len: 0 });
  assert.ok(E.isComplete([2, 2, 2], 3));
  assert.ok(!E.isComplete([2, 2], 3));
});

test('Einzelzug: nur auf gleiche Farbe oder leer', () => {
  const s = E.makeState([[0, 1], [1], [0], []], 3);
  assert.equal(E.moveCount(s, 0, 1, SINGLE), 1);
  assert.equal(E.moveCount(s, 0, 2, SINGLE), 0);
  assert.equal(E.moveCount(s, 0, 3, SINGLE), 1);
  assert.equal(E.moveCount(s, 3, 0, SINGLE), 0);
  assert.equal(E.moveCount(s, 0, 0, SINGLE), 0);
});

test('Gruppenzug nimmt so viele gleiche Teile, wie Platz haben', () => {
  const s = E.makeState([[0, 1, 1, 1], [2, 1], []], 4);
  assert.equal(E.moveCount(s, 0, 1, GROUP), 2);
  assert.equal(E.moveCount(s, 0, 2, GROUP), 3);
  const rec = E.applyMove(s, 0, 1, GROUP);
  assert.deepEqual(s.stacks, [[0, 1], [2, 1, 1, 1], []]);
  E.undoMove(s, rec);
  assert.deepEqual(s.stacks, [[0, 1, 1, 1], [2, 1], []]);
});

test('Gesperrte Stapel (lock) lassen sich nicht mehr anfassen', () => {
  const s = E.makeState([[1, 1, 1], [0, 1], []], 3);
  assert.equal(E.canPick(s, 0, SINGLE), false);
  assert.equal(E.moveCount(s, 0, 2, SINGLE), 0);
  assert.equal(E.canPick(s, 0, CLEAR), true);
});

test('Abräumen (clear) leert volle Stapel und Rückgängig stellt sie wieder her', () => {
  const s = E.makeState([[0, 1, 1], [1], [0, 0, 0]], 3);
  // Stapel 2 ist schon voll und einfarbig – im Spiel kommt das nicht vor, hier egal
  const rec = E.applyMove(s, 0, 1, CLEAR);
  assert.equal(rec.cleared, true);
  assert.deepEqual(s.stacks, [[0], [], [0, 0, 0]]);
  E.undoMove(s, rec);
  assert.deepEqual(s.stacks, [[0, 1, 1], [1], [0, 0, 0]]);
});

test('isSolved für lock und clear', () => {
  assert.ok(E.isSolved(E.makeState([[0, 0], [1, 1], []], 2), SINGLE));
  assert.ok(!E.isSolved(E.makeState([[0, 1], [1, 0], []], 2), SINGLE));
  assert.ok(!E.isSolved(E.makeState([[0, 0], []], 2), CLEAR));
  assert.ok(E.isSolved(E.makeState([[], []], 2), CLEAR));
});

test('legalMoves lässt sinnlose Umzüge weg', () => {
  const s = E.makeState([[0, 0], [1, 0], [], []], 3);
  const moves = E.legalMoves(s, GROUP);
  assert.ok(!moves.some((m) => m.from === 0 && s.stacks[m.to].length === 0));
  assert.ok(moves.some((m) => m.from === 1 && m.to === 0));
});

test('validateState erkennt kaputte Zustände', () => {
  assert.equal(E.validateState({ cap: 2, stacks: [[0, 0], [1, 1]] }), '');
  assert.notEqual(E.validateState({ cap: 2, stacks: [[0, 0, 0], []] }), '');
  assert.notEqual(E.validateState({ cap: 2, stacks: [[0], [1, 1]] }), '');
});

function replay(level, rules) {
  const s = E.makeState(level.stacks, level.cap);
  for (const m of level.solution) {
    const rec = E.applyMove(s, m.from, m.to, rules);
    assert.ok(rec, 'Zug erlaubt');
    if (rules.move === 'single') assert.equal(rec.count, 1);
    else assert.equal(rec.count, m.count);
  }
  return E.isSolved(s, rules);
}

test('Löser: Lösung ist gültig (alle Regelvarianten)', () => {
  for (const rules of [SINGLE, GROUP, CLEAR]) {
    for (let i = 0; i < 25; i++) {
      const lv = generateLevel({ seed: 'eng-' + i, colors: 6, cap: 4, empties: rules === CLEAR ? 1 : 2, rules });
      assert.ok(replay(lv, rules), `Lösung führt zum Ziel (${JSON.stringify(rules)} #${i})`);
    }
  }
});

test('Löser: unlösbarer Zustand liefert null', () => {
  // Kein freier Platz, keine erlaubten Züge
  const s = E.makeState([[0, 1], [1, 0]], 2);
  assert.equal(solve(s, SINGLE, { maxNodes: 1000 }), null);
});

test('expandMoves zerlegt Makro-Züge nur bei «single»', () => {
  const macro = [{ from: 0, to: 1, count: 3 }];
  assert.equal(expandMoves(macro, SINGLE).length, 3);
  assert.equal(expandMoves(macro, GROUP).length, 1);
});

test('Generator ist deterministisch und mischt gut', () => {
  const a = generateLevel({ seed: 'det', colors: 7, cap: 4, empties: 2, rules: SINGLE });
  const b = generateLevel({ seed: 'det', colors: 7, cap: 4, empties: 2, rules: SINGLE });
  assert.deepEqual(a.stacks, b.stacks);
  assert.equal(a.par, b.par);
  assert.ok(adjacency(a.stacks) <= Math.floor(7 * 4 / 6));
  assert.ok(!a.stacks.some((s) => E.isComplete(s, 4)), 'kein Stapel ist schon fertig');
  const counts = E.colorCounts(E.makeState(a.stacks, 4));
  for (const v of counts.values()) assert.equal(v, 4);
});

test('Generator: lose Füllung ergibt gültige Level', () => {
  for (let i = 0; i < 20; i++) {
    const lv = generateLevel({ seed: 'loose-' + i, colors: 6, cap: 4, empties: 1, fill: 'loose', rules: SINGLE });
    assert.equal(E.validateState(E.makeState(lv.stacks, 4)), '');
    assert.ok(replay(lv, SINGLE));
  }
});
