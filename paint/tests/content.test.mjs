// Inhalte prüfen: alle Bibliotheksbilder (art/a + art/b über art/index.js) und die Daten in data/.
//   node --test paint/tests/*.test.mjs
// (Darstellung/Analyse im Browser prüft zusätzlich: node paint/tests/art.mjs)

import test from 'node:test';
import assert from 'node:assert/strict';
import { pictures } from '../art/index.js';
import { generators } from '../gen/index.js';
import { CATEGORY_ORDER, GENERATOR_SEEDS, DEFAULT_SEEDS, PHOTO_DEFAULTS } from '../data/catalog.js';
import { HOWTO, TIPS } from '../data/howto.js';
import { sanitizePuzzle } from '../engine/model.js';
import { validatePuzzle, coverageHoles } from './helpers.mjs';

const swiss = (s) => !/ß/.test(s);

test('Bibliothek: Liste mit eindeutigen ids, Titeln und Kategorien', () => {
  assert.ok(pictures.length > 0, 'keine Bilder gefunden');
  const ids = new Set();
  for (const p of pictures) {
    assert.match(p.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(p.id), 'doppelte id ' + p.id);
    ids.add(p.id);
    assert.ok(p.title && swiss(p.title), p.id + ': Titel');
    assert.ok(p.category && swiss(p.category), p.id + ': Kategorie');
    assert.equal(typeof p.load, 'function');
  }
  // generierte und eigene Bilder benutzen eigene Präfixe
  for (const id of ids) assert.ok(!/^(g-|foto-|fx-)/.test(id), id + ': reserviertes Präfix');
});

test('Bibliothek: jedes Bild lädt und ist gültig, lückenlos und robust bereinigt', async () => {
  for (const item of pictures) {
    const raw = await item.load();
    const probs = validatePuzzle(raw, { minShapes: 10, maxShapes: 3000, requireAllColors: false });
    assert.deepEqual(probs, [], `${item.id}: ${probs.slice(0, 4).join('; ')}`);
    const clean = sanitizePuzzle(raw, item.id);
    assert.equal(clean.shapes.length, raw.shapes.length, item.id + ': Formen verworfen');
    const { holes, sample } = coverageHoles(raw, 36);
    assert.equal(holes, 0, `${item.id}: unbedeckt bei ${sample}`);
    if (raw.lines) for (const l of raw.lines) assert.ok(typeof l.d === 'string', item.id + ': Linie ohne Pfad');
  }
});

test('Katalog: Seeds passen zu den Generatoren', () => {
  const ids = new Set(generators.map((g) => g.id));
  for (const [gen, seeds] of Object.entries(GENERATOR_SEEDS)) {
    assert.ok(ids.has(gen), 'unbekannter Generator ' + gen);
    assert.ok(seeds.length >= 3);
    assert.equal(new Set(seeds).size, seeds.length, gen + ': doppelte Seeds');
    for (const s of seeds) assert.ok(Number.isInteger(s) && s > 0 && s < 1000, `${gen}: Seed ${s} (1–999; ab 1000 = «Neues erzeugen»)`);
  }
  assert.ok(DEFAULT_SEEDS.length > 0);
  assert.equal(new Set(CATEGORY_ORDER).size, CATEGORY_ORDER.length);
  for (const g of generators) assert.ok(CATEGORY_ORDER.includes(g.category), 'Kategorie fehlt in CATEGORY_ORDER: ' + g.category);
  assert.ok(PHOTO_DEFAULTS.minColors >= 6 && PHOTO_DEFAULTS.maxColors <= 30 && PHOTO_DEFAULTS.minColors < PHOTO_DEFAULTS.maxColors);
  assert.ok(PHOTO_DEFAULTS.colors >= PHOTO_DEFAULTS.minColors && PHOTO_DEFAULTS.colors <= PHOTO_DEFAULTS.maxColors);
  assert.ok(['grob', 'mittel', 'fein'].includes(PHOTO_DEFAULTS.detail));
});

test('So geht\'s: 3–4 kurze Schritte mit bekannter Demo, Tipps eindeutig', () => {
  assert.ok(HOWTO.length >= 3 && HOWTO.length <= 4);
  for (const s of HOWTO) {
    assert.ok(['tap', 'goal', 'brush', 'hint'].includes(s.demo), 'Demo ' + s.demo);
    assert.ok(s.title.split(/\s+/).length <= 4, 'Titel zu lang: ' + s.title);
    assert.ok(s.text.length <= 110, 'Text zu lang: ' + s.text);
    assert.ok(swiss(s.title + s.text));
  }
  const ids = TIPS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TIPS) assert.ok(t.after > 0 && swiss(t.text));
});
