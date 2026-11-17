// node --test beads/tests/
// Inhalte: Muster-Bibliothek (Format/Qualität via art/tools/validate.mjs), Texte, Füllfolge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { patterns } from '../art/index.js';
import { tutorial, praise, hints } from '../data/texts.js';
import { parsePattern, fillSequence, bandGroup, chunkMax, chunkify, levelConfig, generateTray } from '../level.js';
import { makeRng } from '../../shared/rng.js';

const here = path.dirname(fileURLToPath(import.meta.url));

test('Muster-Bibliothek besteht den Validator (Format, Farben, Grössen, Reihenfolge)', () => {
  const r = spawnSync(process.execPath, [path.join(here, '../art/tools/validate.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('Bibliothek: rund 36 Muster, eindeutige ids, Schwierigkeit steigt', () => {
  assert.ok(patterns.length >= 36, `nur ${patterns.length} Muster`);
  assert.equal(new Set(patterns.map((p) => p.id)).size, patterns.length);
  const first = parsePattern(patterns[0]), last = parsePattern(patterns[patterns.length - 1]);
  assert.ok(last.total > first.total * 5);
});

test('Texte: Schweizer Rechtschreibung, Tutorial 3–4 Schritte, Lob für 1–3 Sterne', () => {
  assert.ok(tutorial.length >= 3 && tutorial.length <= 4);
  for (const t of tutorial) assert.ok(t.title && t.text && t.title.split(' ').length <= 4);
  for (const n of [1, 2, 3]) assert.ok(praise[n].length >= 1 && praise[n].every((s) => s.includes('{title}')));
  const all = JSON.stringify({ tutorial, praise, hints, titles: patterns.map((p) => p.title) });
  assert.ok(!/ß/.test(all), 'kein ß');
});

test('Füllfolge in Bändern: gleiche Steine, Bänder bleiben in Reihenfolge, längere Läufe', () => {
  const L = parsePattern(patterns.find((p) => p.id === 'herztorte') || patterns[patterns.length - 1]);
  const plain = fillSequence(L), grouped = fillSequence(L, 2);
  assert.deepEqual([...grouped].sort(), [...plain].sort());
  const cells = bandGroup(L, L.order, 2);
  for (let i = 1; i < cells.length; i++) assert.ok(Math.floor(L.rbOf[cells[i]] / 2) >= Math.floor(L.rbOf[cells[i - 1]] / 2));
  const runs = (s) => s.filter((k, i) => i === 0 || k !== s[i - 1]).length;
  assert.ok(runs(grouped) < runs(plain) * 0.6, `${runs(grouped)} vs ${runs(plain)}`);
});

test('Grosse Bilder: grössere Gruppen, vertretbare Anzahl Züge', () => {
  for (const p of patterns.slice(-6)) {
    const L = parsePattern(p);
    assert.ok(chunkMax(L) >= 8);
    const cfg = { ...levelConfig(L, 36), seed: 'zug:' + p.id };
    const chunks = chunkify(fillSequence(L, cfg.R), makeRng(1), cfg.maxChunk);
    assert.ok(chunks.length <= 190, `${p.id}: ${chunks.length} Züge`);
    assert.ok(generateTray(L, cfg).solvable, p.id);
  }
});
