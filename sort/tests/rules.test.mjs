// node --test sort/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pourAmount, pourProblem, applyPour, undoPour, isSolved, isComplete, topRun, legalMoves,
  hasUsefulMove, validateState, cloneState,
} from '../logic/rules.js';

const S = (...tubes) => ({
  per: 4,
  tubes: tubes.map((t) => (typeof t === 'string' ? { cap: 4, l: [...t].map((c) => c.charCodeAt(0) - 97), h: 0 } : t)),
});

test('topRun zählt gleiche Farben oben', () => {
  assert.equal(topRun({ l: [] }), 0);
  assert.equal(topRun({ l: [0, 1, 1] }), 2);
  assert.equal(topRun({ l: [2, 2, 2, 2] }), 4);
});

test('giessen nur auf gleiche Farbe oder ins leere Glas', () => {
  const s = S('abba', 'baab', 'ab', '');
  assert.equal(pourAmount(s, 0, 3), 1); // ins leere Glas
  assert.equal(pourAmount(s, 0, 2), 0); // a auf b: nein
  assert.equal(pourProblem(s, 0, 2), 'color');
  assert.equal(pourAmount(s, 1, 2), 2); // bb auf b: 2 passen
  assert.equal(pourAmount(s, 2, 0), 0); // Ziel voll
  assert.equal(pourProblem(s, 2, 0), 'full');
  assert.equal(pourAmount(s, 3, 0), 0); // leere Quelle
  assert.equal(pourProblem(s, 3, 0), 'empty');
  assert.equal(pourAmount(s, 1, 1), 0);
});

test('es fliesst nur so viel, wie Platz hat', () => {
  const s = S('abbb', 'aab', '');
  assert.equal(pourAmount(s, 0, 1), 1);
  const m = applyPour(s, 0, 1);
  assert.deepEqual(m, { from: 0, to: 1, n: 1, color: 1, revealed: -1 });
  assert.deepEqual(s.tubes[0].l, [0, 1, 1]);
  assert.deepEqual(s.tubes[1].l, [0, 0, 1, 1]);
});

test('ganzer Farbabschnitt fliesst ins leere Glas', () => {
  const s = S('abbb', '');
  const m = applyPour(s, 0, 1);
  assert.equal(m.n, 3);
  assert.deepEqual(s.tubes[1].l, [1, 1, 1]);
});

test('rückgängig stellt den Zustand wieder her', () => {
  const s = S('abcc', 'dc', '', 'abdd');
  const before = JSON.stringify(s);
  const m = applyPour(s, 0, 1);
  assert.equal(m.n, 2);
  undoPour(s, m);
  assert.equal(JSON.stringify(s), before);
});

test('fertige Gläser sind versiegelt', () => {
  const s = S('aaaa', '', 'bbab');
  assert.ok(isComplete(s.tubes[0]));
  assert.equal(pourAmount(s, 0, 1), 0);
  assert.equal(pourProblem(s, 0, 1), 'sealed');
});

test('gelöst, wenn jedes Glas leer oder fertig ist', () => {
  assert.ok(isSolved(S('aaaa', '', 'bbbb')));
  assert.ok(!isSolved(S('aaaa', 'bb', 'bb')));
  assert.ok(!isSolved(S('aaab', 'bbba', '')));
  // grosses Glas mit 4 gleichen Schichten ist fertig
  assert.ok(isSolved({ per: 4, tubes: [{ cap: 6, l: [0, 0, 0, 0], h: 0 }, { cap: 4, l: [], h: 0 }] }));
});

test('verdeckte Schichten werden aufgedeckt, sobald sie oben liegen', () => {
  const s = { per: 4, tubes: [{ cap: 4, l: [0, 1, 2, 3], h: 3 }, { cap: 4, l: [], h: 0 }] };
  const m = applyPour(s, 0, 1);
  assert.equal(m.revealed, 2);
  assert.equal(s.tubes[0].h, 2);
  // Rückgängig deckt nicht wieder zu
  undoPour(s, m);
  assert.equal(s.tubes[0].h, 2);
  assert.equal(validateState({ per: 4, tubes: [...s.tubes, { cap: 4, l: [0, 0, 0, 1], h: 0 }, { cap: 4, l: [1, 1, 2, 2], h: 0 }, { cap: 4, l: [2, 3, 3, 3], h: 0 }] }), null);
});

test('Glas mit verdeckten Schichten ist nie fertig', () => {
  assert.ok(!isComplete({ cap: 4, l: [0, 0, 0, 0], h: 2 }));
});

test('legalMoves und hasUsefulMove', () => {
  const s = S('abab', 'baba', '');
  assert.equal(legalMoves(s).length, 2);
  assert.ok(hasUsefulMove(s));
  const stuck = S('abab', 'baba');
  assert.equal(legalMoves(stuck).length, 0);
  assert.ok(!hasUsefulMove(stuck));
  // nur «einfarbig ins leere Glas» zählt nicht als sinnvoll
  const s2 = S('aa', '', 'aabb', 'bb');
  assert.ok(hasUsefulMove(s2)); // bb auf bb geht
  const s3 = { per: 4, tubes: [{ cap: 4, l: [0, 0], h: 0 }, { cap: 4, l: [], h: 0 }, { cap: 2, l: [1, 0], h: 0 }, { cap: 2, l: [1, 1], h: 0 }] };
  // Zug 2→0 (a auf aa) ist sinnvoll
  assert.ok(hasUsefulMove(s3));
});

test('validateState erkennt Fehler', () => {
  assert.equal(validateState(S('aaaa', 'bbbb', '')), null);
  assert.match(validateState(S('aaab', 'bbbb', '')), /kommt/);
  assert.match(validateState({ per: 4, tubes: [{ cap: 2, l: [0, 0, 0, 0], h: 0 }] }), /überfüllt/);
  assert.match(validateState({ per: 4, tubes: [{ cap: 4, l: [0, 0, 0, 0], h: 4 }] }), /verdeckte/);
});

test('cloneState ist tief', () => {
  const s = S('ab', '');
  const c = cloneState(s);
  c.tubes[0].l.push(5);
  assert.deepEqual(s.tubes[0].l, [0, 1]);
});
