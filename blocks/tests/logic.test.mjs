// Blockpuzzle – Logik-Tests: node --test blocks/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCatalog, catalog, isConnected } from '../core/shapes.js';
import { Board, fullLines } from '../core/board.js';
import { nextTriple, rescueTriple, canPlaceAll } from '../core/generator.js';
import { scoreMove, praiseLevel, lineBase } from '../core/scoring.js';
import { Game } from '../core/game.js';
import { Rng } from '../core/rng.js';
import { simulate, bestMove } from '../core/bot.js';
import { shapes } from '../data/shapes.js';

const cat = catalog();

test('Formen: zusammenhängend, höchstens 5×5, gültige Farben, eindeutige IDs', () => {
  const ids = new Set();
  for (const s of shapes) {
    assert.ok(/^[a-z0-9ü-]+$/.test(s.id), `ID ${s.id}`);
    assert.ok(!ids.has(s.id), `doppelte ID ${s.id}`);
    ids.add(s.id);
    const w = s.rows[0].length;
    assert.ok(s.rows.every((r) => r.length === w && /^[#.]+$/.test(r)), `Zeilen ${s.id}`);
    assert.ok(s.rows.length <= 5 && w <= 5, `Grösse ${s.id}`);
    assert.ok(Number.isInteger(s.color) && s.color >= 0 && s.color <= 7, `Farbe ${s.id}`);
    assert.ok(s.tier >= 0 && s.tier <= 3 && s.weight > 0, `tier/weight ${s.id}`);
  }
  assert.ok(cat.list.length > shapes.length, 'Drehungen erzeugt');
  for (const v of cat.list) {
    assert.ok(isConnected(v.cells), `zusammenhängend ${v.key}`);
    assert.equal(v.masks.length, v.h);
    assert.equal(cat.get(v.key), v);
  }
  // Drehungen sind eindeutig
  const keys = new Set(cat.list.map((v) => v.cells.map((p) => p.join(',')).sort().join(';')));
  assert.equal(keys.size, cat.list.length);
  assert.ok(buildCatalog([{ id: 'x', rows: ['##', '#.'], weight: 1, tier: 0, rotate: true, color: 0 }]).list.length === 4);
});

test('Brett: Setzen, Zeilen und Spalten abräumen, Edelsteine und verdeckte Felder', () => {
  const b = Board.fromLayout(8, ['', '', '', '', '', '', '', 'r1111.11'], 'all');
  assert.equal(b.filledCount, 7);
  assert.deepEqual(b.countGems(), { r: 1 });
  assert.equal(b.countCover(), 64);
  const dot = cat.find('#');
  assert.ok(!b.canPlace(dot, 7, 0));
  assert.ok(b.canPlace(dot, 7, 5));
  const res = b.place(dot, 7, 5);
  assert.equal(res.lines, 1);
  assert.deepEqual(res.rows, [7]);
  assert.equal(res.cleared.length, 8);
  assert.equal(res.cleared.filter((c) => c.gem).length, 1);
  assert.equal(res.cleared.filter((c) => c.cover).length, 8);
  assert.ok(b.isEmpty);
  // Zeile + Spalte gleichzeitig (Kreuz)
  const k = new Board(8);
  for (let c = 0; c < 8; c++) if (c !== 3) k.place(dot, 4, c);
  for (let r = 0; r < 8; r++) if (r !== 4) k.place(dot, r, 3);
  const res2 = k.place(dot, 4, 3);
  assert.equal(res2.lines, 2);
  assert.equal(res2.cleared.length, 15);
  assert.ok(k.isEmpty);
  // Serialisieren
  const s = Board.fromLayout(10, ['1234', '.g..', '', '', '', '', '', '', '', '8888888888'], ['xx']);
  const t = Board.deserialize(s.serialize());
  assert.deepEqual(t.serialize(), s.serialize());
  assert.deepEqual(fullLines(t.rows, 10).rows, [9]);
});

test('Punkte: Kombos zählen mehr, Serie steigert den Multiplikator', () => {
  assert.ok(lineBase(2) > 2 * lineBase(1));
  assert.ok(lineBase(3) > lineBase(2) * 1.4);
  let st = { streak: 0, sinceClear: 0 };
  const a = scoreMove(st, 3, 1, false);
  assert.equal(a.streak, 1);
  const b = scoreMove(a, 3, 1, false);
  assert.ok(b.total > a.total, 'Serie gibt mehr Punkte');
  // Serie hält zwei leere Züge, beim dritten ist sie weg
  let c = scoreMove(b, 2, 0, false);
  c = scoreMove(c, 2, 0, false);
  assert.equal(c.streak, 2);
  c = scoreMove(c, 2, 0, false);
  assert.equal(c.streak, 0);
  assert.equal(scoreMove(st, 4, 1, true).bonus > 0, true);
  assert.equal(praiseLevel(1, false), null);
  assert.equal(praiseLevel(2, false), 2);
  assert.equal(praiseLevel(6, false), 4);
  assert.equal(praiseLevel(1, true), 'perfect');
});

/** Zufälliges, nicht volles Brett ohne volle Linien. */
function randomBoard(rng, n, fill) {
  const b = new Board(n);
  for (let i = 0; i < n * n; i++) if (rng.next() < fill) b.cells[i] = 1 + rng.int(0, 7);
  b.syncMasks();
  const fl = fullLines(b.rows, n);
  for (const r of fl.rows) { b.cells[r * n + rng.int(0, n - 1)] = 0; }
  b.syncMasks();
  const fl2 = fullLines(b.rows, n);
  for (const c of fl2.cols) { b.cells[rng.int(0, n - 1) * n + c] = 0; }
  b.syncMasks();
  return b;
}

test('Generator: fair – mit fair=1 lassen sich immer alle drei Teile setzen', () => {
  const rng = new Rng('fair-test');
  let checked = 0;
  for (let k = 0; k < 300; k++) {
    const n = k % 3 === 0 ? 10 : 8;
    const b = randomBoard(rng, n, 0.15 + rng.next() * 0.4);
    // Gibt es überhaupt ein Trio aus Punkten, das passt? (3 freie Felder)
    if (n * n - b.filledCount < 3) continue;
    const triple = nextTriple(b, rng, cat, { d: rng.next(), fair: 1, assist: 0.3 });
    assert.equal(triple.length, 3);
    assert.ok(triple.every(Boolean));
    assert.ok(canPlaceAll(b.rows, n, triple, 200000), `Brett ${k}: Trio nicht setzbar`);
    checked++;
  }
  assert.ok(checked > 250);
});

test('Generator: deterministisch, Rettung liefert setzbare Teile', () => {
  const b = randomBoard(new Rng('x'), 8, 0.45);
  const t1 = nextTriple(b, new Rng('seed'), cat, { d: 0.5 }).map((v) => v.key);
  const t2 = nextTriple(b, new Rng('seed'), cat, { d: 0.5 }).map((v) => v.key);
  assert.deepEqual(t1, t2);
  const rng = new Rng('rescue');
  for (let k = 0; k < 60; k++) {
    const rb = randomBoard(rng, 8, 0.55 + rng.next() * 0.2);
    if (64 - rb.filledCount < 3) continue;
    const t = rescueTriple(rb, rng, cat);
    assert.ok(t.every((v) => v.n <= 4));
    assert.ok(canPlaceAll(rb.rows, 8, t, 200000));
  }
});

test('Generator: Verteilung abwechslungsreich, leichter Start gibt kleinere Teile', () => {
  const b = new Board(8);
  const avg = (d) => {
    const rng = new Rng('dist-' + d);
    let sum = 0, cnt = 0;
    const shapesSeen = new Set();
    for (let i = 0; i < 400; i++) for (const v of nextTriple(b, rng, cat, { d, fair: 1, assist: 0 })) { sum += v.n; cnt++; shapesSeen.add(v.shape); }
    return { avg: sum / cnt, kinds: shapesSeen.size };
  };
  const easy = avg(0), hard = avg(1);
  assert.ok(easy.avg < hard.avg, `leicht ${easy.avg} < schwer ${hard.avg}`);
  assert.equal(hard.kinds, shapes.length, 'alle Formen kommen vor');
});

test('Spiel: Klassisch – Speichern/Laden setzt exakt fort (inkl. Zufall)', () => {
  const g = Game.classic(8, 1234);
  for (let i = 0; i < 25 && !g.over; i++) { const m = bestMove(g); g.place(m.slot, m.r, m.c); }
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const h = Game.deserialize(data);
  assert.deepEqual(h.serialize(), g.serialize());
  for (let i = 0; i < 30 && !g.over; i++) {
    const m = bestMove(g);
    const a = g.place(m.slot, m.r, m.c);
    const b = h.place(m.slot, m.r, m.c);
    assert.equal(!!a, !!b);
    assert.deepEqual(h.tray.map((v) => v && v.key), g.tray.map((v) => v && v.key));
  }
  assert.equal(h.score, g.score);
  assert.equal(Game.deserialize({ v: 999 }), null);
  assert.equal(Game.deserialize(null), null);
});

test('Spiel: Bot spielt lange Klassisch-Partien auf 8×8 und 10×10 ohne Fehler', () => {
  for (const [size, seed] of [[8, 1], [8, 2], [10, 3]]) {
    const g = Game.classic(size, seed);
    const r = simulate(g, 250);
    assert.ok(r.moves >= 40, `${size}/${seed}: nur ${r.moves} Züge`);
    assert.ok(g.score > 0 && g.lines > 0 && g.bestCombo >= 1);
    if (g.over) {
      assert.ok(!g.hasMoves());
      g.rescue();
      assert.equal(g.rescues, 1);
    }
  }
});

test('Spiel: ungültige Züge werden abgelehnt, Spielende erkannt', () => {
  const g = Game.classic(8, 7);
  assert.equal(g.place(0, 9, 9), null);
  assert.equal(g.place(5, 0, 0), null);
  // Brett fast voll machen: nur ein Feld frei, keine vollen Linien möglich durch Schachbrett-Lücke
  const rows = [];
  for (let r = 0; r < 8; r++) rows.push(r === 0 ? '.' + '1'.repeat(6) + '.' : '1111111.');
  g.board = Board.fromLayout(8, rows.map((x, r) => (r === 7 ? '11111111'.slice(0, 7) + '.' : x)));
  // Spalte 7 ist frei, also passen nur senkrechte Teile dort
  g.tray = [cat.find('##|##'), cat.find('##|##'), cat.find('##|##')];
  assert.equal(g.hasMoves(), false);
});
