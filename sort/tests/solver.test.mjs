import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, solveBest, lowerBound, hint } from '../logic/solver.js';
import { applyPour, isSolved, cloneState } from '../logic/rules.js';

const S = (...tubes) => ({
  per: 4,
  tubes: tubes.map((t) => ({ cap: 4, l: [...t].map((c) => c.charCodeAt(0) - 97), h: 0 })),
});

function replay(state, moves) {
  const s = cloneState(state);
  for (const m of moves) {
    const r = applyPour(s, m.from, m.to);
    assert.ok(r, `Zug ${m.from}→${m.to} ist nicht erlaubt`);
    assert.equal(r.n, m.n, 'Löser und Regeln giessen gleich viel');
  }
  return s;
}

test('bereits gelöst: 0 Züge', () => {
  const r = solve(S('aaaa', 'bbbb', ''));
  assert.deepEqual(r.moves, []);
});

test('Tutorial-Level: 3 Züge optimal', () => {
  const st = S('aabb', 'bbaa', '');
  const r = solve(st);
  assert.equal(r.moves.length, 3);
  assert.ok(r.optimal);
  assert.ok(isSolved(replay(st, r.moves)));
});

test('untere Schranke ist nie grösser als die optimale Lösung', () => {
  const cases = [S('abca', 'bcab', 'cabc', '', ''), S('abab', 'baba', ''), S('abcd', 'dcba', 'badc', 'cdab', '', '')];
  for (const st of cases) {
    const r = solve(st, { maxNodes: 200000 });
    assert.ok(r.moves, 'lösbar');
    assert.ok(lowerBound(st) <= r.moves.length);
    assert.ok(isSolved(replay(st, r.moves)));
  }
});

test('unlösbar wird erkannt (Suchraum erschöpft)', () => {
  const r = solve(S('abab', 'baba'));
  assert.equal(r.moves, null);
  assert.equal(r.exhausted, true);
});

test('solveBest fällt auf schnellere Suche zurück und findet eine Lösung', () => {
  const st = S('abcd', 'efgh', 'aebf', 'cgdh', 'hgfe', 'dcba', 'hfdb', 'geca', '', '');
  const r = solveBest(st, { budget: 3000 });
  assert.ok(r.moves && r.moves.length > 0);
  assert.ok(isSolved(replay(st, r.moves)));
});

test('Tipp liefert einen erlaubten Zug Richtung Lösung', () => {
  const st = S('abca', 'bcab', 'cabc', '', '');
  const h = hint(st);
  assert.ok(h.move);
  const s = cloneState(st);
  assert.ok(applyPour(s, h.move.from, h.move.to));
  const sh = hint(S('abab', 'baba'));
  assert.equal(sh.move, null);
  assert.equal(sh.exhausted, true);
});

test('Gläser unterschiedlicher Grösse', () => {
  const st = {
    per: 4,
    tubes: [
      { cap: 6, l: [0, 1, 2, 0, 1, 2], h: 0 },
      { cap: 6, l: [2, 0, 1, 2, 0, 1], h: 0 },
      { cap: 4, l: [], h: 0 },
      { cap: 4, l: [], h: 0 },
    ],
  };
  const r = solve(st, { maxNodes: 200000 });
  assert.ok(r.moves);
  assert.ok(isSolved(replay(st, r.moves)));
});
