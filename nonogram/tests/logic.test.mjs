// Bilderrätsel – Unit-Tests der reinen Logik und der Inhalte.
//   node --test nonogram/tests/

import test from 'node:test';
import assert from 'node:assert/strict';
import { runsOf, cluesFor, solveLine, lineSolve, checkUnique, findHint, FILLED, EMPTY, UNKNOWN } from '../core/solver.js';
import { parsePuzzle, validateDef, isGoodPuzzle, mirrorDef } from '../core/puzzle.js';
import { Game, OPEN, FILL, CROSS, lineStatus, strokeLine, strokeAction, actionValue } from '../core/game.js';
import { makeEndless } from '../core/generator.js';
import { packs, themes, dailyDef, lookup, loadPuzzle, loadBeadsPack, libraryCount, ENDLESS_SIZES } from '../core/library.js';

// ---------- Löser ----------

test('runsOf und cluesFor', () => {
  assert.deepEqual(runsOf([0, 1, 1, 0, 1]), [2, 1]);
  assert.deepEqual(runsOf([0, 0, 0]), []);
  const mask = Uint8Array.from([1, 1, 0, 0, 1, 1]); // 3×2
  const { rows, cols } = cluesFor(mask, 3, 2);
  assert.deepEqual(rows, [[2], [2]]);
  assert.deepEqual(cols, [[1], [2], [1]]);
});

test('solveLine: Überlappung, Leerzeile, Widerspruch', () => {
  const u = (n) => new Uint8Array(n);
  assert.deepEqual([...solveLine([3], u(5))], [UNKNOWN, UNKNOWN, FILLED, UNKNOWN, UNKNOWN]);
  assert.deepEqual([...solveLine([2, 2], u(5))], [FILLED, FILLED, EMPTY, FILLED, FILLED]);
  assert.deepEqual([...solveLine([], u(3))], [EMPTY, EMPTY, EMPTY]);
  assert.equal(solveLine([4], Uint8Array.from([0, 0, EMPTY, 0, 0])), null);
  // gefülltes Feld am Rand zieht den Block
  assert.deepEqual([...solveLine([2], Uint8Array.from([FILLED, 0, 0, 0]))], [FILLED, FILLED, EMPTY, EMPTY]);
});

test('lineSolve löst ein kleines Herz eindeutig', () => {
  const def = { id: 't', title: 'T', palette: { a: '#ff0000' }, rows: ['.a.a.', 'aaaaa', 'aaaaa', '.aaa.', '..a..'] };
  const p = parsePuzzle(def);
  const res = lineSolve(p.rowClues, p.colClues);
  assert.equal(res.solved, true);
  for (let i = 0; i < p.mask.length; i++) assert.equal(res.grid[i] === FILLED, p.mask[i] === 1);
});

test('checkUnique erkennt mehrdeutige Rätsel', () => {
  const mask = Uint8Array.from([1, 0, 0, 1]); // Diagonale 2×2 – zwei Lösungen
  assert.equal(checkUnique(mask, 2, 2).ok, false);
  assert.equal(isGoodPuzzle({ id: 'x', title: 'X', palette: { a: '#000000' }, rows: ['a.', '.a'] }), false);
});

test('validateDef meldet Formatfehler', () => {
  assert.ok(validateDef({ id: 'Gross', title: 'x', palette: {}, rows: ['.'] }).length > 0);
  assert.ok(validateDef({ id: 'a', title: 'x', palette: { a: '#fff' }, rows: ['a'] }).length > 0);
  assert.ok(validateDef({ id: 'a', title: 'x', palette: { a: '#ffffff' }, rows: ['ab', 'aa'] }).length > 0);
  assert.ok(validateDef({ id: 'a', title: 'x', palette: { a: '#ffffff' }, rows: ['aa', 'a'] }).length > 0);
  assert.deepEqual(validateDef({ id: 'a', title: 'x', palette: { a: '#ffffff' }, rows: ['a.', '.a'] }), []);
});

// ---------- Inhalte ----------

test('Bibliothek: mindestens 100 gültige, eindeutige Bilder in 5/10/15/20', () => {
  const ids = new Set();
  let total = 0;
  const bySize = {};
  for (const pack of packs) {
    assert.ok(pack.id && pack.title && pack.emoji, `Paket ${pack.id} unvollständig`);
    for (const def of pack.puzzles) {
      assert.deepEqual(validateDef(def), [], def.id);
      assert.ok(!ids.has(def.id), `doppelte id ${def.id}`);
      ids.add(def.id);
      const w = def.rows[0].length, h = def.rows.length;
      assert.ok([5, 10, 15, 20].includes(w) && w === h, `${def.id}: Grösse ${w}×${h}`);
      bySize[w] = (bySize[w] || 0) + 1;
      assert.ok(themes.includes(def.category), `${def.id}: unbekanntes Thema ${def.category}`);
      const used = new Set(def.rows.join('').replace(/\./g, ''));
      for (const k of Object.keys(def.palette)) assert.ok(used.has(k), `${def.id}: Farbe ${k} unbenutzt`);
      if (def.bg) assert.match(def.bg, /^#[0-9a-f]{6}$/i);
      const p = parsePuzzle(def);
      assert.ok(checkUnique(p.mask, p.w, p.h).ok, `${def.id} nicht eindeutig per Zeilenlogik lösbar`);
      total++;
    }
  }
  assert.ok(total >= 100, `nur ${total} Bilder`);
  for (const s of [5, 10, 15, 20]) assert.ok(bySize[s] >= 10, `zu wenige ${s}×${s}`);
  assert.equal(libraryCount(), total);
});

test('Spiegeln erhält die Eindeutigkeit', () => {
  for (const pack of packs) for (const def of pack.puzzles.slice(0, 5)) assert.ok(isGoodPuzzle(mirrorDef(def)), def.id);
});

test('Tagesrätsel: deterministisch, täglich anders, immer lösbar', () => {
  const a = dailyDef('2026-11-17');
  const b = dailyDef('2026-11-17');
  assert.deepEqual(a, b);
  assert.equal(a.id, 'daily-2026-11-17');
  let same = 0;
  let prev = null;
  const start = Date.UTC(2026, 0, 1);
  for (let d = 0; d < 400; d++) {
    const key = new Date(start + d * 864e5).toISOString().slice(0, 10);
    const def = dailyDef(key);
    assert.ok(isGoodPuzzle({ ...def, id: 'x' }), key);
    const wd = new Date(start + d * 864e5).getUTCDay();
    assert.equal(def.rows.length, wd === 0 || wd === 6 ? 15 : 10, key);
    if (prev && prev.rows.join() === def.rows.join()) same++;
    prev = def;
  }
  assert.ok(same < 5, `zu oft dasselbe Bild an Folgetagen (${same})`);
  const hit = lookup('daily-2026-11-17');
  assert.equal(hit.kind, 'daily');
  assert.equal(hit.day, '2026-11-17');
});

test('Endlos-Bilder: deterministisch und eindeutig lösbar', () => {
  for (const size of ENDLESS_SIZES) {
    for (let n = 1; n <= 6; n++) {
      const def = makeEndless(size, n);
      assert.equal(def.rows.length, size);
      assert.deepEqual(validateDef(def), [], def.id);
      assert.ok(isGoodPuzzle(def), def.id);
      assert.deepEqual(makeEndless(size, n), def);
    }
  }
  assert.equal(lookup('e10-3').kind, 'endless');
  assert.equal(lookup('e7-3'), null);
  assert.equal(lookup('nichts'), null);
});

test('Perlenbild-Paket: nur eindeutig lösbare Muster', async () => {
  const pack = await loadBeadsPack(() => import('../../beads/art/index.js'));
  if (!pack) return; // Perlenbild nicht vorhanden – optional
  assert.ok(pack.puzzles.length > 0);
  for (const def of pack.puzzles) {
    assert.ok(isGoodPuzzle(def), def.id);
    assert.ok(loadPuzzle(def.id), def.id);
  }
});

// ---------- Spielzustand ----------

function heart() {
  return parsePuzzle({ id: 'h', title: 'Herz', palette: { a: '#ff0000' }, rows: ['.a.a.', 'aaaaa', 'aaaaa', '.aaa.', '..a..'] });
}

test('Game: setzen, rückgängig, gelöst, speichern/laden', () => {
  const p = heart();
  const g = new Game(p);
  assert.equal(g.isEmpty(), true);
  g.apply([[0, CROSS], [1, FILL]]);
  assert.equal(g.cells[1], FILL);
  assert.equal(g.canUndo(), true);
  g.undo();
  assert.equal(g.cells[1], OPEN);
  assert.equal(g.cells[0], OPEN);
  const all = [];
  for (let i = 0; i < p.mask.length; i++) if (p.mask[i]) all.push([i, FILL]);
  g.apply(all);
  assert.equal(g.solved, true);
  g.elapsed = 12345;
  g.hints = 2;
  const s = g.serialize();
  const g2 = new Game(p, JSON.parse(JSON.stringify(s)));
  assert.equal(g2.solved, true);
  assert.equal(g2.hints, 2);
  assert.equal(g2.elapsed, 12345);
  assert.deepEqual([...g2.cells], [...g.cells]);
  // kaputte Spielstände werden ignoriert
  const g3 = new Game(p, { c: 'xyz' });
  assert.equal(g3.isEmpty(), true);
});

test('lineStatus: erledigt, abgehakt, zu viel', () => {
  assert.deepEqual(lineStatus([2, 1], [FILL, FILL, CROSS, FILL, OPEN]).done, true);
  const st = lineStatus([2, 1], [FILL, FILL, CROSS, OPEN, OPEN]);
  assert.equal(st.done, false);
  assert.deepEqual(st.marks, [true, false]);
  assert.equal(lineStatus([2], [FILL, FILL, FILL, OPEN]).over, true);
  assert.equal(lineStatus([], [OPEN, OPEN]).over, false);
});

test('Auto-Kreuze füllen fertige Linien', () => {
  const g = new Game(heart());
  g.apply([[1, FILL], [3, FILL]]); // Zeile 0: .a.a.
  const ch = g.autoCrossChanges([[0, 0]]);
  assert.deepEqual(ch.map((x) => x[0]).sort(), [0, 2, 4]);
  g.applyToLast(ch);
  assert.equal(g.undoStack.length, 1);
  g.undo();
  assert.equal(g.isEmpty(), true);
});

test('Striche: gerade Linien und Aktionen', () => {
  assert.deepEqual(strokeLine(2, 2, 2, 5).cells, [[2, 2], [2, 3], [2, 4], [2, 5]]);
  assert.deepEqual(strokeLine(2, 2, 4, 3).cells, [[2, 2], [3, 2], [4, 2]]);
  assert.deepEqual(strokeLine(1, 1, 3, 3, 0).cells, [[1, 1], [1, 2], [1, 3]]);
  assert.equal(strokeAction('fill', OPEN), 'fill');
  assert.equal(strokeAction('fill', FILL), 'erase');
  assert.equal(strokeAction('cross', OPEN), 'cross');
  assert.equal(actionValue('fill', OPEN, CROSS), null, 'Kreuze werden beim Füllen nicht überschrieben');
  assert.equal(actionValue('erase', FILL, FILL), OPEN);
  assert.equal(actionValue('erase', FILL, CROSS), null);
});

test('Tipps führen immer zur Lösung und korrigieren Fehler', () => {
  const samples = [packs[0].puzzles[3], packs[1].puzzles[5], packs[2].puzzles[2], packs[3].puzzles[1]];
  for (const def of samples) {
    const p = parsePuzzle(def);
    const g = new Game(p);
    // absichtlicher Fehler
    const wrong = p.mask.indexOf(0);
    if (wrong >= 0) g.apply([[wrong, FILL]]);
    let guard = p.w * p.h * 2 + 5;
    while (!g.solved && guard-- > 0) {
      const hnt = findHint(p, g.cells);
      assert.ok(hnt, `${def.id}: kein Tipp`);
      if (hnt.type === 'mistake') { assert.equal(hnt.index, wrong); g.apply([[hnt.index, OPEN]]); continue; }
      assert.equal(hnt.value === FILLED, p.mask[hnt.index] === 1, `${def.id}: falscher Tipp`);
      g.apply([[hnt.index, hnt.value === FILLED ? FILL : CROSS]]);
    }
    assert.equal(g.solved, true, def.id);
    void EMPTY;
  }
});
