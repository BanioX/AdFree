// Unit-Tests der Wortsuche: Inhalte, Generator, Auswahl, Wertung.
// Ausführen: node --test wordsearch/tests/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { themes, groups } from '../data/themes.js';
import { modes, DAILY_MODE } from '../data/modes.js';
import {
  validateTheme, themeEntries, generatePuzzle, verifyPuzzle, findOccurrences, wordCells, wordEnd,
  snapEnd, lineCells, matchSelection, starsFor, parTime, formatTime, dailyThemeIndex, pickHintWord,
  wordsConflict, DIRS,
} from '../logic.js';

const modeById = (id) => modes.find((m) => m.id === id);

test('Themen: mindestens 80, alle gültig, 20–30 Wörter, Schweizer Schreibweise', () => {
  assert.ok(themes.length >= 80, `nur ${themes.length} Themen`);
  const ids = new Set();
  const groupIds = new Set(groups.map((g) => g.id));
  for (const t of themes) {
    assert.deepEqual(validateTheme(t), [], `Thema ${t.id}`);
    assert.ok(!ids.has(t.id), `doppelte id ${t.id}`);
    ids.add(t.id);
    assert.ok(groupIds.has(t.group), `${t.id}: unbekannte Gruppe ${t.group}`);
    const raw = t.words.split(/\s+/).filter(Boolean);
    assert.ok(raw.length >= 20 && raw.length <= 30, `${t.id}: ${raw.length} Wörter`);
    assert.equal(themeEntries(t).length, raw.length, `${t.id}: ungültige oder doppelte Wörter`);
    for (const w of raw) {
      assert.ok(!/ß/.test(w), `${t.id}: «${w}» enthält ß`);
      assert.match(w, /^[A-Za-zÄÖÜäöü]+$/, `${t.id}: «${w}»`);
    }
  }
  for (const g of groups) assert.ok(themes.some((t) => t.group === g.id), `Gruppe ${g.id} leer`);
});

test('validateTheme erkennt Fehler', () => {
  const bad = { id: 'X y', title: '', emoji: '', group: '', words: 'Strasse Straße Ab Strasse 3D' };
  const p = validateTheme(bad);
  assert.ok(p.some((x) => x.includes('id')));
  assert.ok(p.some((x) => x.includes('ß')));
  assert.ok(p.some((x) => x.includes('doppelt')));
  assert.ok(p.some((x) => x.includes('mindestens')));
});

test('Stufen: Leicht 8×8/8 Wörter/→↓, Mittel 10×10/12/+Diagonalen, Schwer 12–14/16+/alle 8', () => {
  const l = modeById('leicht'), m = modeById('mittel'), s = modeById('schwer');
  assert.deepEqual(l.sizes, [8]); assert.deepEqual(l.words, [8]); assert.deepEqual([...l.dirs].sort(), ['E', 'S']);
  assert.deepEqual(m.sizes, [10]); assert.deepEqual(m.words, [12]);
  assert.ok(['SE', 'NE'].every((d) => m.dirs.includes(d)));
  assert.ok(s.sizes.every((n) => n >= 12 && n <= 14));
  assert.ok(s.words.every((n) => n >= 16));
  assert.equal(s.dirs.length, 8);
  assert.ok(modeById(DAILY_MODE));
});

test('Generator: jedes Thema × jede Stufe × mehrere Seeds ist lösbar und eindeutig', () => {
  let count = 0;
  for (const t of themes) {
    for (const mode of modes) {
      for (const seed of ['a', 7, '2026-11-17']) {
        const pz = generatePuzzle(t, mode, seed);
        count++;
        assert.deepEqual(verifyPuzzle(pz, mode), [], `${t.id}/${mode.id}/${seed}`);
        const si = mode.sizes.indexOf(pz.size);
        assert.ok(si >= 0, `${t.id}/${mode.id}: Grösse ${pz.size}`);
        assert.equal(pz.words.length, mode.words[si], `${t.id}/${mode.id}: Wortzahl`);
        const labels = new Set(themeEntries(t).map((e) => e.w));
        for (const p of pz.words) {
          assert.ok(labels.has(p.w), `${p.w} gehört nicht zum Thema`);
          assert.ok(mode.dirs.includes(p.d));
          // genau eine Fundstelle → keine zufälligen Doppel
          assert.equal(findOccurrences(pz.grid.map((r) => [...r]), p.w).length, 1);
        }
        for (let i = 0; i < pz.words.length; i++) {
          for (let j = i + 1; j < pz.words.length; j++) assert.ok(!wordsConflict(pz.words[i].w, pz.words[j].w));
        }
      }
    }
  }
  assert.ok(count >= 80 * 3 * 3);
});

test('Generator ist deterministisch und variiert mit dem Seed', () => {
  const t = themes[0], m = modeById('mittel');
  assert.deepEqual(generatePuzzle(t, m, 'x'), generatePuzzle(t, m, 'x'));
  assert.notDeepEqual(generatePuzzle(t, m, 'x').grid, generatePuzzle(t, m, 'y').grid);
});

test('Schwer nutzt rückwärts und diagonale Richtungen', () => {
  const seen = new Set();
  for (const t of themes.slice(0, 20)) for (const p of generatePuzzle(t, modeById('schwer'), 1).words) seen.add(p.d);
  assert.equal(seen.size, 8);
});

test('snapEnd rastet in alle 8 Richtungen ein und bleibt im Raster', () => {
  const start = { r: 5, c: 5 };
  for (const d of DIRS) {
    const px = 5.5 + d.dc * 2.2 + 0.3 * d.dr, py = 5.5 + d.dr * 2.2 - 0.3 * d.dc;
    assert.deepEqual(snapEnd(start, px, py, 12), { r: 5 + d.dr * 2, c: 5 + d.dc * 2 }, d.id);
  }
  assert.deepEqual(snapEnd(start, 5.6, 5.4, 12), start);
  assert.deepEqual(snapEnd({ r: 0, c: 0 }, 40, 0.5, 8), { r: 0, c: 7 });
  assert.deepEqual(snapEnd({ r: 0, c: 0 }, 30, 31, 8), { r: 7, c: 7 });
});

test('lineCells: nur gerade Linien', () => {
  assert.equal(lineCells({ r: 0, c: 0 }, { r: 1, c: 2 }), null);
  assert.equal(lineCells({ r: 2, c: 2 }, { r: 0, c: 0 }).length, 3);
});

test('matchSelection: vorwärts, rückwärts, bereits gefunden, falsch', () => {
  const pz = generatePuzzle(themes[3], modeById('schwer'), 'm');
  const p = pz.words[0], e = wordEnd(p);
  assert.deepEqual(matchSelection(pz, { r: p.r, c: p.c }, e), { index: 0, already: false });
  assert.equal(matchSelection(pz, e, { r: p.r, c: p.c }).index, 0);
  assert.equal(matchSelection(pz, { r: p.r, c: p.c }, e, new Set([0])).already, true);
  const cells = wordCells(p);
  assert.equal(matchSelection(pz, cells[0], cells[1]), null);
});

test('Wertung: Sterne, Zeit, Format', () => {
  const m = modeById('leicht');
  const par = parTime(m, 8);
  assert.equal(starsFor(m, 8, par * 0.5, 0), 3);
  assert.equal(starsFor(m, 8, par * 1.5, 0), 2);
  assert.equal(starsFor(m, 8, par * 3, 0), 1);
  assert.equal(starsFor(m, 8, par * 0.5, 1), 2);
  assert.equal(starsFor(m, 8, par * 9, 9), 1);
  assert.equal(formatTime(65_000), '1:05');
  assert.equal(formatTime(3_725_000), '1:02:05');
});

test('Tagesthema: deterministisch, gültig, keine Wiederholung innerhalb eines Zyklus', () => {
  const n = themes.length;
  assert.equal(dailyThemeIndex('2026-11-17', n), dailyThemeIndex('2026-11-17', n));
  const start = Date.UTC(2026, 0, 1) / 864e5;
  const cycleStart = Math.ceil(start / n) * n;
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const d = new Date((cycleStart + i) * 864e5);
    const key = d.toISOString().slice(0, 10);
    const idx = dailyThemeIndex(key, n);
    assert.ok(idx >= 0 && idx < n);
    seen.add(idx);
  }
  assert.equal(seen.size, n);
  const t = themes[dailyThemeIndex('2026-11-17', n)];
  const pz = generatePuzzle(t, modeById(DAILY_MODE), 'wordsearch-2026-11-17');
  assert.deepEqual(verifyPuzzle(pz, modeById(DAILY_MODE)), []);
});

test('pickHintWord wählt nur offene Wörter', () => {
  const pz = generatePuzzle(themes[5], modeById('leicht'), 1);
  const found = new Set(pz.words.map((_, i) => i).slice(1));
  assert.equal(pickHintWord(pz, found), 0);
  found.add(0);
  assert.equal(pickHintWord(pz, found), -1);
});
