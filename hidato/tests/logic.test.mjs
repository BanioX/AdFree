// Zahlenschlange – Logik-Tests: node --test hidato/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, solve, verify, randomPath, touching, neighbors } from '../logic/puzzle.js';
import {
  newGame, place, clearCell, candidates, conflicts, links, dragStep, findHint, applyHint, undo, snapshot, restart, positions, checkDone,
} from '../logic/game.js';
import { difficulties, DAILY } from '../data/difficulties.js';
import { makeRng } from '../../shared/rng.js';

test('Nachbarn inkl. Diagonalen', () => {
  const nb = neighbors(3, 3);
  assert.equal(nb[4].length, 8);
  assert.equal(nb[0].length, 3);
  assert.ok(touching(3, 0, 4) && !touching(3, 0, 2) && !touching(3, 2, 3));
});

test('Zufallsweg besucht jedes Feld genau einmal', () => {
  for (let s = 0; s < 50; s++) {
    const w = 4 + (s % 5);
    const p = randomPath(makeRng('p' + s), w, w);
    assert.equal(new Set(p).size, w * w);
    for (let k = 1; k < p.length; k++) assert.ok(touching(w, p[k - 1], p[k]));
  }
});

test('Löser findet eindeutige und mehrdeutige Fälle', () => {
  // 2×2: 1 2 / 4 3 – nur 1 und 4 gegeben → zwei Wege (2 und 3 tauschbar über die Diagonale)
  const amb = { w: 2, h: 2, N: 4, sol: [1, 2, 4, 3], given: [true, false, true, false] };
  assert.equal(solve(amb, 5).count, 2);
  assert.equal(verify(amb), false);
  amb.given = [true, true, true, false];
  const r = solve(amb, 5);
  assert.equal(r.count, 1);
  assert.deepEqual(r.first, [1, 2, 4, 3]);
  // Loch (0) wird übersprungen
  const strip = { w: 4, h: 1, N: 3, sol: [1, 2, 3, 0], given: [true, false, true, false] };
  assert.equal(solve(strip, 5).count, 1);
});

test('Alle Stufen: gültiger Weg, 1 und Ende gegeben, eindeutig (viele Seeds)', () => {
  for (const d of [...difficulties, DAILY]) {
    const count = d.w >= 8 ? 12 : 25;
    for (let k = 1; k <= count; k++) {
      const p = generate(`hidato-${d.id}-${k}`, d);
      assert.equal(p.N, d.w * d.h - d.holes);
      assert.equal(p.sol.filter((v) => v === 0).length, d.holes);
      assert.ok(verify(p), `${d.id} ${k} nicht eindeutig`);
      const g = p.given.filter(Boolean).length / p.N;
      assert.ok(g >= d.givenRate - 0.02 && g < 0.75, `${d.id} ${k}: Anteil gegeben ${g}`);
      // Lücken zwischen gegebenen Zahlen begrenzt
      const pos = []; p.sol.forEach((v, i) => { pos[v] = i; });
      let last = 1;
      for (let v = 2; v <= p.N; v++) if (p.given[pos[v]]) { assert.ok(v - last - 1 <= d.maxGap, `${d.id} ${k}: Lücke`); last = v; }
    }
  }
});

test('Generator ist deterministisch', () => {
  assert.deepEqual(generate('x', difficulties[1]), generate('x', difficulties[1]));
});

test('Setzen, Verschieben, Löschen, Widersprüche', () => {
  const st = newGame({ diff: 'leicht', number: 1 });
  const { sol, w } = st.puzzle;
  const free = st.vals.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  const k = sol[free[0]];
  assert.ok(place(st, free[0], k));
  assert.equal(st.vals[free[0]], k);
  // dieselbe Zahl woanders → wird verschoben
  assert.ok(place(st, free[1], k));
  assert.equal(st.vals[free[0]], 0);
  assert.equal(st.vals[free[1]], k);
  // gegebene Zahl kann nicht doppelt gesetzt werden
  const givenVal = st.vals.find((v, i) => st.puzzle.given[i] && v > 1);
  assert.equal(place(st, free[2], givenVal), false);
  assert.ok(clearCell(st, free[1]));
  assert.equal(clearCell(st, st.puzzle.given.indexOf(true)), false);
  // Widerspruch: k neben falscher Stelle
  const pos = positions(st);
  const far = free.find((i) => pos[2] >= 0 && !touching(w, i, pos[1]));
  if (far != null && pos[2] < 0) { place(st, far, 2); assert.ok(conflicts(st).has(far)); }
});

test('Kandidaten passen zu Nachbarn', () => {
  const st = newGame({ diff: 'mittel', number: 2 });
  const { w } = st.puzzle;
  const pos = positions(st);
  st.vals.forEach((v, i) => {
    if (v !== 0) return;
    for (const k of candidates(st, i)) {
      assert.equal(pos[k], -1);
      assert.ok((pos[k - 1] >= 0 && touching(w, pos[k - 1], i)) || (pos[k + 1] >= 0 && touching(w, pos[k + 1], i)));
    }
  });
  // Die richtige Zahl ist immer Kandidat, wenn ein Nachbar in der Lösung schon steht
  st.vals.forEach((v, i) => {
    if (v !== 0) return;
    const k = st.puzzle.sol[i];
    const nb = (pos[k - 1] >= 0) || (pos[k + 1] >= 0);
    if (nb) assert.ok(candidates(st, i).includes(k));
  });
});

test('Ziehen: Weg zeichnen, zurückgehen, an gegebene Zahl anschliessen', () => {
  const st = newGame({ diff: 'leicht', number: 4 });
  const { sol, N } = st.puzzle;
  const solPos = []; sol.forEach((v, i) => { solPos[v] = i; });
  const drag = { cells: [solPos[1]], placed: [] };
  let k = 1;
  let backDone = false;
  while (k < N && !st.done) {
    const r = dragStep(st, drag, solPos[k + 1]);
    assert.ok(r === 'place' || r === 'advance', `Schritt ${k + 1}: ${r}`);
    k++;
    if (!backDone && r === 'place' && k > 2) {
      assert.equal(dragStep(st, drag, solPos[k - 1]), 'back');
      assert.equal(st.vals[solPos[k]], 0);
      k--;
      backDone = true;
    }
  }
  assert.ok(st.done, 'gelöst durch einen Zug');
  assert.ok(links(st).length === N - 1);
});

test('Ziehen in ein nicht benachbartes oder besetztes Feld macht nichts', () => {
  const st = newGame({ diff: 'mittel', number: 1 });
  const { w } = st.puzzle;
  const pos = positions(st);
  const drag = { cells: [pos[1]], placed: [] };
  const far = st.vals.findIndex((v, i) => v === 0 && !touching(w, i, pos[1]));
  assert.equal(dragStep(st, drag, far), null);
});

test('Tipps lösen jedes Rätsel, entfernen falsche Zahlen', () => {
  for (const d of difficulties) {
    for (let n = 1; n <= 6; n++) {
      const st = newGame({ diff: d.id, number: n });
      // eine falsche Zahl setzen
      const free = st.vals.findIndex((v) => v === 0);
      const wrongK = st.puzzle.sol[free] === 2 ? 3 : 2;
      if (positions(st)[wrongK] < 0) place(st, free, wrongK);
      let guard = 0;
      while (!st.done && guard++ < 200) assert.ok(applyHint(st));
      assert.ok(st.done && checkDone(st));
      assert.deepEqual(st.vals.map((v) => Math.max(0, v)), st.puzzle.sol);
    }
  }
});

test('Rückgängig und Neustart', () => {
  const st = newGame({ diff: 'leicht', number: 2 });
  const before = st.vals.slice();
  snapshot(st);
  const free = st.vals.findIndex((v) => v === 0);
  place(st, free, st.puzzle.sol[free]);
  assert.ok(undo(st));
  assert.deepEqual(st.vals, before);
  place(st, free, st.puzzle.sol[free]);
  restart(st);
  assert.deepEqual(st.vals, before);
  assert.equal(findHint(st).type, 'place');
});

test('Tagesrätsel ist für alle gleich und JSON-speicherbar', () => {
  const a = newGame({ day: '2026-11-17' }), b = newGame({ day: '2026-11-17' });
  assert.deepEqual(a.puzzle, b.puzzle);
  assert.deepEqual(JSON.parse(JSON.stringify(a)).vals, a.vals);
});
