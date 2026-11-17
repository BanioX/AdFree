// Zahlensummen – Logik-Tests: node --test numbersums/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, solve, verify, logicSolve, lines, makeRegions } from '../logic/puzzle.js';
import { newGame, act, applyHint, findHint, restart, refill, doneLines, colorRegions, starsFor } from '../logic/game.js';
import { difficulties, DAILY } from '../data/difficulties.js';
import { makeRng } from '../../shared/rng.js';

const tiny = {
  n: 2, digits: [3, 4, 4, 3], keep: [true, false, false, true], rows: [3, 3], cols: [3, 3], region: null, regionSums: null,
};

test('Löser zählt Lösungen', () => {
  assert.equal(solve(tiny, 5).count, 1);
  const amb = { n: 2, digits: [3, 3, 3, 3], keep: [true, false, false, true], rows: [3, 3], cols: [3, 3], region: null, regionSums: null };
  assert.equal(solve(amb, 5).count, 2);
  assert.equal(verify(amb), false);
  assert.equal(verify(tiny), true);
});

test('Bereiche: zusammenhängend, lückenlos nummeriert, keine Einzelfelder', () => {
  for (let s = 0; s < 60; s++) {
    const n = 5 + (s % 4);
    const reg = makeRegions(makeRng('r' + s), n);
    const k = Math.max(...reg) + 1;
    for (let g = 0; g < k; g++) {
      const cells = reg.map((x, i) => (x === g ? i : -1)).filter((i) => i >= 0);
      assert.ok(cells.length >= 2, 'Bereich zu klein');
      // Zusammenhang per Flutfüllung
      const seen = new Set([cells[0]]);
      const st = [cells[0]];
      while (st.length) {
        const i = st.pop();
        for (const j of [i - n, i + n, i % n ? i - 1 : -1, i % n < n - 1 ? i + 1 : -1]) {
          if (j >= 0 && j < n * n && reg[j] === g && !seen.has(j)) { seen.add(j); st.push(j); }
        }
      }
      assert.equal(seen.size, cells.length, 'Bereich zerrissen');
    }
  }
});

test('Alle Stufen: eindeutig, korrekt summiert und ohne Raten lösbar (viele Seeds)', () => {
  for (const d of [...difficulties, DAILY]) {
    for (let k = 1; k <= 40; k++) {
      const p = generate(`numbersums-${d.id}-${k}`, d);
      assert.equal(p.n, d.n);
      assert.ok(p.digits.every((x) => x >= 1 && x <= 9));
      assert.ok(verify(p), `${d.id} ${k} nicht eindeutig`);
      assert.equal(!!p.region, d.regions);
      const ls = logicSolve(p);
      assert.ok(ls.solved, `${d.id} ${k} braucht Raten`);
      assert.deepEqual(ls.marks.map((m) => m === 1), p.keep);
      // jede Linie hat mindestens eine bleibende Zahl
      for (const L of lines(p)) assert.ok(L.target > 0);
    }
  }
});

test('Generator ist deterministisch', () => {
  assert.deepEqual(generate('x', { n: 6, regions: true }), generate('x', { n: 6, regions: true }));
});

test('Spielzug: richtig, falsch (Leben), automatische Ergänzung', () => {
  const st = newGame({ diff: 'leicht', number: 3 });
  const p = st.puzzle;
  const wrongI = p.keep.findIndex((k) => k);
  const r = act(st, wrongI, 'erase');
  assert.ok(!r.ok && r.wrong);
  assert.equal(st.lives, 2);
  assert.equal(st.marks[wrongI], 0);
  // Reihe 0: alle falschen radieren → Rest wird eingekreist
  const row0 = [...Array(p.n).keys()];
  let last;
  for (const i of row0) if (!p.keep[i]) last = act(st, i, 'erase');
  assert.ok(row0.every((i) => st.marks[i] !== 0), 'Reihe vollständig');
  assert.ok(doneLines(st).has('row-0'));
  if (last) assert.ok(last.lines.includes('row-0'));
});

test('Tipps lösen jedes Rätsel vollständig und fehlerfrei', () => {
  for (const d of difficulties) {
    for (let k = 1; k <= 10; k++) {
      const st = newGame({ diff: d.id, number: k });
      let guard = 0;
      while (!st.done && guard++ < 200) {
        const h = findHint(st);
        assert.ok(h && h.line, 'logischer Tipp vorhanden');
        assert.equal(h.keep, st.puzzle.keep[h.i]);
        applyHint(st);
      }
      assert.ok(st.done);
      assert.equal(st.mistakes, 0);
      assert.deepEqual(st.marks.map((m) => m === 1), st.puzzle.keep);
    }
  }
});

test('Drei Fehler, freundlich weiter, Neustart', () => {
  const st = newGame({ diff: 'mittel', number: 1 });
  const k = st.puzzle.keep.findIndex((x) => x);
  act(st, k, 'erase'); act(st, k, 'erase');
  const r = act(st, k, 'erase');
  assert.ok(r.out);
  assert.equal(act(st, k, 'keep').ok, false, 'ohne Leben kein Zug');
  refill(st);
  assert.equal(st.lives, 3);
  assert.ok(act(st, k, 'keep').ok);
  assert.equal(starsFor(st), 1);
  restart(st);
  assert.ok(st.marks.every((m) => m === 0));
});

test('Tagesrätsel: gleich für alle, Bereiche gefärbt ohne gleiche Nachbarn', () => {
  const a = newGame({ day: '2026-11-17' });
  const b = newGame({ day: '2026-11-17' });
  assert.deepEqual(a.puzzle, b.puzzle);
  const col = colorRegions(a.puzzle);
  const { n, region } = a.puzzle;
  for (let i = 0; i < n * n; i++) {
    if (i % n < n - 1 && region[i] !== region[i + 1]) assert.notEqual(col[region[i]], col[region[i + 1]]);
    if (i + n < n * n && region[i] !== region[i + n]) assert.notEqual(col[region[i]], col[region[i + n]]);
  }
});

test('Zustand ist JSON-speicherbar', () => {
  const st = newGame({ diff: 'schwer', number: 2 });
  applyHint(st);
  const back = JSON.parse(JSON.stringify(st));
  assert.deepEqual(back.marks, st.marks);
  assert.ok(!('_lines' in back.puzzle));
});
