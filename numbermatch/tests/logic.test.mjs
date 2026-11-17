// Zahlenpaare – Logik-Tests: node --test numbermatch/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, fits, pairKind, findPairs, clearedRows, removeRows, appendOpen, linearPlan, hintPair, openCount } from '../logic/rules.js';
import { generateBoard, isFair } from '../logic/generator.js';
import { newGame, play, addNumbers, restart, isWon, isStuck, nextRound, undo, canUndo, packCells, unpackCells } from '../logic/game.js';
import { levelSpec, INTRO } from '../data/levels.js';

const mk = (digits, crossed = '') => digits.split('').map((d, k) => ({ v: +d, x: crossed[k] === 'x', s: false }));

test('Passende Zahlen: gleich oder Summe 10', () => {
  assert.ok(fits(3, 3) && fits(3, 7) && fits(5, 5) && fits(1, 9));
  assert.ok(!fits(3, 4) && !fits(5, 6) && !fits(2, 9));
});

test('Nachbarn waagrecht, senkrecht, diagonal und über den Zeilenumbruch', () => {
  //          Reihe 0     Reihe 1
  const c = mk('123456789' + '912345678');
  assert.equal(pairKind(c, 0, 1), null);           // 1+2 passt nicht
  assert.equal(pairKind(c, 0, 9), 'down');          // 1 über 9: senkrecht, Summe 10
  assert.equal(pairKind(c, 8, 9), 'line');          // 9 am Zeilenende, 9 am nächsten Anfang
  assert.equal(pairKind(c, 0, 10), 'diag');         // 1 und 1 diagonal ↘
  assert.equal(pairKind(c, 1, 2), null);            // 2 und 3 passen nicht
});

test('Diagonal ↘ und ↙ sowie keine Umbrüche bei Diagonalen', () => {
  const c = mk('100000000' + '010000000' + '000000000');
  assert.equal(pairKind(c, 0, 10), 'diag');
  const d = mk('000000001' + '000000090' + '000000000');
  assert.equal(pairKind(d, 8, 16), 'diag');         // 1 und 9 ↙
  const e = mk('000000001' + '100000000');
  // 8 → 9 ist Lesereihenfolge (Umbruch), aber Ziffern 1/1 passen → 'line'
  assert.equal(pairKind(e, 8, 9), 'line');
  // ↘ von Spalte 8 darf nicht in Spalte 0 der übernächsten Reihe springen
  const f = mk('000000003' + '000000000' + '700000000');
  f.forEach((x, k) => { if (k !== 8 && k !== 18) x.x = true; });
  assert.equal(pairKind(f, 8, 18), 'line');         // nur über Lesereihenfolge (alles dazwischen gestrichen)
  f[10].x = false; f[10].v = 4;
  assert.equal(pairKind(f, 8, 18), null);
});

test('Nur gestrichene Felder dazwischen erlaubt', () => {
  const c = mk('3456' + '7', '.xx..');
  assert.equal(pairKind(c, 0, 3), null);            // 3 und 6 passen nicht
  // 3 … 7 über gestrichene 4, 5, aber offene 6 → nicht erlaubt
  assert.equal(pairKind(c, 0, 4), null);
  c[3].x = true;
  assert.equal(pairKind(c, 0, 4), 'line');
});

test('findPairs findet jedes erlaubte Paar genau einmal', () => {
  const c = mk('19' + '0000000' + '91');
  c.forEach((x) => { if (x.v === 0) x.x = true; });
  const pairs = findPairs(c);
  const keys = pairs.map(([a, b]) => a + '-' + b).sort();
  assert.deepEqual(keys, ['0-1', '0-10', '0-9', '1-10', '1-9', '9-10'].sort());
});

test('Volle Reihen verschwinden, Lesereihenfolge bleibt', () => {
  const c = mk('123456789' + '111111111' + '22', '.........' + 'xxxxxxxxx' + '..');
  assert.deepEqual(clearedRows(c), [1]);
  const r = removeRows(c, [1]);
  assert.equal(r.length, 11);
  assert.equal(r[9].v, 2);
});

test('Zahlen hinzufügen kopiert nur offene Zahlen, ohne Sterne', () => {
  const c = mk('1234', '.x..');
  c[0].s = true;
  const r = appendOpen(c);
  assert.deepEqual(r.slice(4).map((x) => x.v), [1, 3, 4]);
  assert.ok(r.slice(4).every((x) => !x.x && !x.s));
});

test('linearPlan erkennt verschachtelte Paare', () => {
  assert.deepEqual(linearPlan([3, 7]), [[0, 1]]);
  assert.ok(linearPlan([1, 2, 8, 9]));     // 1[2 8]9
  assert.equal(linearPlan([1, 2, 9, 8]), null);
  assert.equal(linearPlan([1, 2, 3]), null);
});

test('Generator: jedes Feld ist fair (sicher abräumbar) – viele Seeds', () => {
  for (let s = 0; s < 400; s++) {
    const count = 18 + (s % 15) * 2;
    const cells = generateBoard('t' + s, { count, stars: s % 4 });
    assert.equal(cells.length, count);
    assert.ok(cells.every((c) => c.v >= 1 && c.v <= 9 && !c.x));
    assert.equal(cells.filter((c) => c.s).length, s % 4);
    assert.ok(isFair(cells), 'Seed ' + s);
  }
});

test('Generator ist deterministisch', () => {
  const a = generateBoard('gleich', { count: 30, stars: 3 });
  const b = generateBoard('gleich', { count: 30, stars: 3 });
  assert.deepEqual(a, b);
});

/** Spielt mit Tipps (sicherer Weg) bis zum Ende. */
function autoplay(st, maxSteps = 500) {
  for (let k = 0; k < maxSteps && !st.done && !st.lost; k++) {
    const h = hintPair(st.cells);
    if (!h) { if (!addNumbers(st)) break; continue; }
    const r = play(st, h[0], h[1]);
    assert.ok(r.ok, 'Tipp-Zug muss erlaubt sein');
  }
  return st;
}

test('Alle Level 1–120 sind mit Tipps ohne «Hinzufügen» gewinnbar', () => {
  for (let n = 1; n <= 120; n++) {
    const st = newGame('level', { level: n });
    const before = st.addsLeft;
    autoplay(st);
    assert.ok(st.done && isWon(st), `Level ${n} nicht gewonnen`);
    assert.equal(st.addsLeft, before, `Level ${n} brauchte «Hinzufügen»`);
  }
});

test('Tagesrätsel für 60 Tage gewinnbar', () => {
  for (let d = 1; d <= 60; d++) {
    const day = `2026-${String(1 + (d % 12)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}`;
    const st = autoplay(newGame('daily', { day }));
    assert.ok(st.done, day);
    assert.equal(openCount(st.cells), 0);
  }
});

test('Level-Plan: Einstieg und unendliche Fortsetzung', () => {
  assert.equal(levelSpec(1).count, INTRO[0].count);
  for (let n = 1; n < 500; n++) {
    const s = levelSpec(n);
    assert.ok(s.count % 2 === 0 && s.count >= 18 && s.count <= 46);
    assert.ok(s.adds >= 3 && s.adds <= 5);
    if (s.goal.type === 'rows') assert.ok(s.goal.n >= 1 && s.goal.n < Math.ceil(s.count / COLS));
  }
});

test('Endlos: neue Runde nach leerem Feld, Punkte bleiben', () => {
  const st = newGame('endless', { salt: 'x' });
  const r1 = st.round;
  autoplay(st, 60);
  assert.ok(st.round > r1 || st.score > 0);
  const score = st.score;
  nextRound(st);
  assert.equal(st.score, score);
  assert.ok(st.cells.length > 0 && isFair(st.cells));
});

test('Steckenbleiben, Hinzufügen und Neustart', () => {
  const st = newGame('level', { level: 1 });
  // Nur unpassende Zahlen: kein Paar
  st.cells = mk('12');
  st.addsLeft = 1;
  assert.ok(!isStuck(st));
  assert.equal(addNumbers(st), 2);
  assert.equal(st.cells.length, 4);
  // 1 2 1 2 → 1 und 1? nicht benachbart (2 dazwischen) – senkrecht auch nicht → stecken
  assert.ok(isStuck(st));
  restart(st);
  assert.equal(st.addsLeft, st.adds);
  assert.deepEqual(st.cells, st.start);
});

test('Punkte: weiter Zug zählt doppelt, Reihe gibt Bonus', () => {
  const st = newGame('level', { level: 1 });
  st.cells = mk('37' + '5' + '000000' + '5', '..' + '.' + 'xxxxxx' + '.');
  st.goal = { type: 'rows', n: 5 };
  let r = play(st, 0, 1);
  assert.ok(r.ok && r.points === 10);
  assert.equal(play(st, 2, 2).ok, false);
  r = play(st, 2, 9);       // 5 … 5 über gestrichene Felder und den Umbruch
  assert.ok(r.ok);
  assert.equal(r.gap, 6);
  assert.deepEqual(r.rows, [0, 1]);
  assert.equal(r.points, 20 + 2 * 50 + 150);
});

test('Rückgängig: Paar, Reihe und Hinzufügen zurücknehmen; kompakter Verlauf', () => {
  const cells = [{ v: 9, x: true, s: true }, { v: 1, x: false, s: false }, { v: 5, x: true, s: false }, { v: 7, x: false, s: true }];
  assert.deepEqual(unpackCells(packCells(cells)), cells);
  const st = newGame('level', { level: 1 });
  assert.ok(!canUndo(st));
  const start = JSON.stringify(st.cells);
  // ein ganzes Level mit Tipps spielen und alles wieder zurücknehmen
  const scores = [];
  while (!st.done) {
    const p = hintPair(st.cells);
    if (!p) { assert.ok(addNumbers(st) > 0); scores.push(st.score); continue; }
    assert.ok(play(st, p[0], p[1]).ok);
    scores.push(st.score);
  }
  assert.ok(!canUndo(st), 'gewonnenes Level bleibt gewonnen');
  st.done = false;
  let n = 0;
  while (canUndo(st)) { undo(st); n++; }
  assert.ok(n > 0 && n <= 40);
  if (n === scores.length) { assert.equal(JSON.stringify(st.cells), start); assert.equal(st.score, 0); assert.equal(st.pairs, 0); }
  // Steckenbleiben lässt sich mit «Zurück» verlassen
  const s2 = newGame('level', { level: 1 });
  s2.cells = mk('12'); s2.addsLeft = 1;
  addNumbers(s2);
  assert.ok(isStuck(s2));
  s2.lost = true;
  assert.ok(undo(s2));
  assert.equal(s2.lost, false);
  assert.equal(s2.addsLeft, 1);
  assert.equal(s2.cells.length, 2);
  restart(s2);
  assert.ok(!canUndo(s2));
});
