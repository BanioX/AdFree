// Unit-Tests für die reine Sudoku-Logik:  node --test sudoku/tests/*.test.mjs
// Brett-Helfer, Löser, menschlicher Löser (jeder Schritt muss zur Lösung passen),
// Generator (eindeutig, richtige Stufe, deterministisch), Umformungen, Spielzustand, Tipps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../shared/rng.js';
import {
  UNITS, PEERS, CELL_UNITS, parse, stringify, candidatesFromValues, findConflicts, bit, ALL,
} from '../logic/board.js';
import { solve, countSolutions, randomSolution } from '../logic/solver.js';
import { grade, TECHNIQUES } from '../logic/human.js';
import { generate, transform, solutionOf } from '../logic/generator.js';
import { Game } from '../logic/game.js';
import { findHint } from '../logic/hints.js';
import { describeStep, techniqueTexts, hintTexts } from '../data/texts.js';
import { difficulties } from '../data/difficulties.js';
import { pool } from '../data/pool.js';

const isValidSolution = (v) => v.length === 81 && v.every((x) => x >= 1 && x <= 9)
  && UNITS.every((u) => new Set(u.map((i) => v[i])).size === 9);

/** Prüft jeden Schritt des menschlichen Lösers gegen die echte Lösung. */
function checkSteps(puzzle, sol) {
  const g = grade(parse(puzzle), 4, { keepSteps: true });
  assert.ok(g.solved, 'menschlich lösbar');
  for (const st of g.steps) {
    assert.ok(TECHNIQUES[st.tech], 'bekannte Technik ' + st.tech);
    if (st.place) assert.equal(st.place.d, sol[st.place.c], `${st.tech} setzt richtige Ziffer`);
    for (const { c, d } of st.elims || []) assert.notEqual(sol[c], d, `${st.tech} streicht nie die Lösung`);
  }
  assert.deepEqual(g.values, sol);
  return g;
}

/** Spielt eine Partie nur mit Tipps durch (so wie die App sie anwendet). */
function solveWithHints(game) {
  for (let n = 0; n < 400 && !game.done; n++) {
    const h = findHint(game);
    assert.ok(h, 'Tipp vorhanden');
    if (h.type === 'wrong') game.erase(h.cell);
    else if (h.type === 'reveal') game.setValue(h.cell, h.digit);
    else if (h.step.place) {
      const r = game.setValue(h.step.place.c, h.step.place.d);
      assert.ok(r && !r.wrong, 'Tipp setzt richtige Ziffer');
    } else {
      const r = game.applyEliminations(h.step.elims, h.step.cells);
      assert.ok(r && r.changed, 'Streich-Tipp ändert etwas');
    }
  }
  return game.done;
}

const SAMPLE = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

test('Brett: Einheiten, Nachbarn, Parsen', () => {
  assert.equal(UNITS.length, 27);
  assert.ok(UNITS.every((u) => u.length === 9));
  assert.ok(PEERS.every((p) => p.length === 20));
  assert.deepEqual(CELL_UNITS[80], [8, 17, 26]);
  assert.equal(stringify(parse(SAMPLE)), SAMPLE);
  assert.equal(stringify(parse(SAMPLE.replace(/0/g, '.'))), SAMPLE);
  assert.throws(() => parse('123'));
  const c = candidatesFromValues(parse(SAMPLE));
  assert.equal(c[2] & bit(5), 0, '5 steht in derselben Reihe');
  const bad = parse(SAMPLE); bad[2] = 5;
  assert.ok(findConflicts(bad).size > 0 || findConflicts(bad).length > 0);
});

test('Löser: eindeutige Lösung, Mehrdeutigkeit, Zufallslösung', () => {
  const r = solve(parse(SAMPLE));
  assert.equal(r.count, 1);
  assert.ok(isValidSolution(r.solution));
  assert.equal(countSolutions(new Array(81).fill(0), 2), 2);
  const a = randomSolution(makeRng('x')), b = randomSolution(makeRng('x'));
  assert.ok(isValidSolution(a));
  assert.deepEqual(a, b, 'deterministisch');
});

test('Menschlicher Löser: jeder Schritt ist korrekt (Stichprobe aus jedem Vorrat)', () => {
  const seen = new Set();
  for (const d of difficulties) {
    const arr = pool[d.id];
    for (let k = 0; k < arr.length; k += 9) {
      const sol = parse(solutionOf(arr[k]));
      const g = checkSteps(arr[k], sol);
      for (const t of Object.keys(g.counts)) seen.add(t);
    }
  }
  for (const t of ['fullHouse', 'hiddenSingle', 'nakedSingle', 'pointing', 'nakedPair', 'xWing', 'xyWing']) {
    assert.ok(seen.has(t), 'Technik kommt vor: ' + t);
  }
});

test('Vorrat: jedes Rätsel eindeutig, Stufe und Vorgaben passen, keine Doppelten', () => {
  assert.deepEqual(Object.keys(pool).sort(), difficulties.map((d) => d.id).sort());
  for (const spec of difficulties) {
    const arr = pool[spec.id];
    assert.ok(arr.length >= 50, `${spec.id}: genug Rätsel`);
    assert.equal(new Set(arr).size, arr.length, `${spec.id}: keine Doppelten`);
    for (const p of arr) {
      assert.match(p, /^[0-9]{81}$/);
      const v = parse(p);
      assert.equal(countSolutions(v, 2), 1, `${spec.id}: eindeutig ${p}`);
      const g = grade(v, 4);
      assert.ok(g.solved && g.tier >= spec.minTier && g.tier <= spec.maxTier, `${spec.id}: Stufe ${g.tier} für ${p}`);
      const givens = v.filter(Boolean).length;
      assert.ok(givens >= spec.minGivens && givens <= spec.maxGivens, `${spec.id}: ${givens} Vorgaben`);
    }
  }
});

test('Stufen werden schwieriger (mittlere Punktzahl steigt)', () => {
  let prev = -1;
  for (const spec of difficulties) {
    const arr = pool[spec.id];
    const scores = arr.filter((_, k) => k % 10 === 0).map((p) => grade(parse(p), 4).score).sort((a, b) => a - b);
    const med = scores[scores.length >> 1];
    assert.ok(med > prev, `${spec.id}: Median ${med} > ${prev}`);
    prev = med;
  }
});

test('Generator: eindeutig, richtige Stufe, deterministisch', () => {
  for (const spec of difficulties) {
    for (const seed of ['g1', 'g2']) {
      const r = generate(spec, `${spec.id}-${seed}`);
      assert.ok(r, 'Ergebnis');
      const v = parse(r.puzzle);
      assert.equal(countSolutions(v, 2), 1);
      assert.equal(solutionOf(r.puzzle), r.solution);
      assert.ok(r.tier >= spec.minTier && r.tier <= spec.maxTier, `${spec.id}: Stufe ${r.tier}`);
      assert.ok(r.givens >= spec.minGivens && r.givens <= spec.maxGivens);
      for (let i = 0; i < 81; i++) assert.equal(!!v[i], !!v[80 - i], 'punktsymmetrisch');
      checkSteps(r.puzzle, parse(r.solution));
    }
    assert.deepEqual(generate(spec, 'same'), generate(spec, 'same'));
  }
});

test('Umformung erhält Lösbarkeit und Schwierigkeit', () => {
  for (const spec of difficulties) {
    const p = pool[spec.id][7];
    const s = solutionOf(p);
    const g0 = grade(parse(p), 4);
    for (const seed of ['t1', 't2', 't3']) {
      const t = transform(p, s, makeRng(seed));
      assert.notEqual(t.puzzle, p);
      assert.equal(solutionOf(t.puzzle), t.solution);
      const g1 = grade(parse(t.puzzle), 4);
      assert.equal(g1.tier, g0.tier);
      for (let i = 0; i < 81; i++) {
        if (t.puzzle[i] !== '0') assert.equal(t.puzzle[i], t.solution[i]);
      }
    }
  }
});

test('Spielzustand: Setzen, Notizen-Aufräumen, Fehler, Rückgängig, Speichern', () => {
  const sol = solutionOf(SAMPLE);
  const g = Game.create(SAMPLE, sol, { diff: 'leicht' });
  const empty = [...SAMPLE].findIndex((ch) => ch === '0');
  const right = +sol[empty];
  const wrongD = right === 9 ? 1 : right + 1;
  const peer = PEERS[empty].find((j) => SAMPLE[j] === '0');
  g.toggleNote(peer, right);
  g.toggleNote(peer, wrongD);
  assert.equal(g.notes[peer], bit(right) | bit(wrongD));

  // falsche Zahl: Fehler, Notizen bleiben
  let r = g.setValue(empty, wrongD);
  assert.ok(r.wrong && r.mistake);
  assert.equal(g.mistakes, 1);
  assert.ok(g.wrongCells().includes(empty));
  // richtige Zahl: Notiz der Nachbarn wird entfernt
  r = g.setValue(empty, right);
  assert.ok(!r.wrong);
  assert.equal(g.notes[peer], bit(wrongD));
  assert.ok(r.cleared.includes(peer));
  // Rückgängig stellt Notiz und Wert wieder her
  g.undo();
  assert.equal(g.values[empty], wrongD);
  assert.equal(g.notes[peer], bit(right) | bit(wrongD));
  g.erase(empty);
  assert.equal(g.values[empty], 0);
  // Vorgaben sind gesperrt
  assert.equal(g.setValue(0, 1), null);
  // Alle Notizen = Kandidaten
  g.autoNotes();
  const c = candidatesFromValues(g.values);
  for (let i = 0; i < 81; i++) if (!g.values[i]) assert.equal(g.notes[i], c[i] & ALL);
  // Speichern und Laden
  const g2 = Game.fromJSON(JSON.parse(JSON.stringify(g.toJSON())));
  assert.deepEqual(g2.values, g.values);
  assert.deepEqual(g2.notes, g.notes);
  assert.equal(g2.mistakes, 1);
  assert.equal(Game.fromJSON({}), null);
  // Fertig lösen
  for (let i = 0; i < 81; i++) if (!g.values[i]) g.setValue(i, +sol[i]);
  assert.ok(g.done && g.isSolved());
  assert.equal(g.progress(), 1);
});

test('Konflikt-Modus zählt nur Regelverstösse', () => {
  const sol = solutionOf(SAMPLE);
  const g = Game.create(SAMPLE, sol);
  const i = 2; // Reihe 0 enthält 5, 3, 7
  const wrongNoConflict = [1, 2, 4, 6, 8, 9].find((d) => d !== +sol[i] && !PEERS[i].some((j) => g.values[j] === d));
  if (wrongNoConflict) {
    const r = g.setValue(i, wrongNoConflict, { mistakeMode: 'conflict' });
    assert.ok(r.wrong && !r.mistake);
  }
  const r2 = g.setValue(i, 5, { mistakeMode: 'conflict' });
  assert.ok(r2.mistake && r2.conflictWith.length);
});

test('Tipps: falsche Zahl wird erkannt, Tipps allein lösen jedes Rätsel', () => {
  const sol = solutionOf(SAMPLE);
  const g = Game.create(SAMPLE, sol);
  const i = [...SAMPLE].findIndex((ch) => ch === '0');
  g.setValue(i, +sol[i] === 9 ? 1 : +sol[i] + 1);
  const h = findHint(g);
  assert.equal(h.type, 'wrong');
  assert.equal(h.cell, i);
  for (const spec of difficulties) {
    for (const k of [0, 99, pool[spec.id].length - 1]) {
      const p = pool[spec.id][k];
      assert.ok(solveWithHints(Game.create(p, solutionOf(p))), `${spec.id} #${k} mit Tipps gelöst`);
    }
  }
});

test('Tipp-Texte: jede Technik erklärt, Schweizer Rechtschreibung', () => {
  for (const t of Object.keys(TECHNIQUES)) assert.ok(techniqueTexts[t], 'Text für ' + t);
  const all = [];
  for (const spec of difficulties) {
    for (let k = 0; k < pool[spec.id].length; k += 20) {
      const g = grade(parse(pool[spec.id][k]), 4, { keepSteps: true });
      for (const st of g.steps) {
        const { title, text } = describeStep(st);
        assert.ok(title && text && text.length > 10, 'Text für ' + st.tech);
        assert.ok(!/undefined|NaN|\[object/.test(title + text), `kaputter Text: ${title} ${text}`);
        all.push(title, text);
      }
    }
  }
  all.push(JSON.stringify(hintTexts), hintTexts.reveal(4).text);
  assert.ok(!all.join(' ').includes('ß'), 'kein ß');
});
