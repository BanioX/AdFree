// Generatoren (Mandala, Buntglas, Low Poly): gültige, deterministische, lückenlose Malbilder.
//   node --test paint/tests/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { generators } from '../gen/index.js';
import { GENERATOR_SEEDS, DEFAULT_SEEDS } from '../data/catalog.js';
import { validatePuzzle, coverageHoles } from './helpers.mjs';

const RANGE = { mandala: [120, 420], glas: [140, 400], polygon: [140, 420] };

test('Generatoren: Liste mit id, Titel, Kategorie, make()', () => {
  assert.ok(generators.length >= 3);
  const ids = new Set();
  for (const g of generators) {
    assert.match(g.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(g.id), 'doppelte id ' + g.id);
    ids.add(g.id);
    assert.ok(g.title && g.category, g.id);
    assert.equal(typeof g.make, 'function');
  }
  for (const want of ['mandala', 'glas', 'polygon']) assert.ok(ids.has(want), want);
});

for (const g of generators) {
  const seeds = GENERATOR_SEEDS[g.id] || DEFAULT_SEEDS;
  const extra = [1234, 987654]; // wie «Neues erzeugen» (zufällige grosse Seeds)
  test(`${g.id}: alle Galerie-Seeds + zufällige Seeds sind gültige Malbilder`, () => {
    const [lo, hi] = RANGE[g.id] || [60, 800];
    for (const seed of [...seeds, ...extra]) {
      const p = g.make(seed);
      const probs = validatePuzzle(p, { minShapes: lo, maxShapes: hi });
      assert.deepEqual(probs, [], `${g.id} ${seed}: ${probs.slice(0, 4).join('; ')}`);
      assert.equal(p.category, g.category, `${g.id} ${seed}: Kategorie`);
      assert.ok(p.title && typeof p.title === 'string');
      assert.ok(p.palette.length >= 6, `${g.id} ${seed}: zu wenige Farben`);
    }
  });

  test(`${g.id}: deterministisch pro Seed, verschieden je Seed`, () => {
    const a = JSON.stringify(g.make(seeds[0]));
    const b = JSON.stringify(g.make(seeds[0]));
    assert.equal(a, b);
    assert.notEqual(a, JSON.stringify(g.make(seeds[1])));
  });

  test(`${g.id}: Bildfläche lückenlos bedeckt`, () => {
    for (const seed of seeds.slice(0, 3)) {
      const p = g.make(seed);
      const { holes, sample } = coverageHoles(p, 40);
      assert.equal(holes, 0, `${g.id} ${seed}: Loch bei ${sample}`);
    }
  });
}

test('Buntglas hat Bleilinien, Low Poly verschmilzt gleichfarbige Dreiecke', () => {
  const glas = generators.find((g) => g.id === 'glas').make(1);
  // dunkle Bleifarbe als eigene Malfarbe oder als Deko-Linie
  const darkest = Math.min(...glas.palette.map((c) => parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16)));
  assert.ok((glas.lines && glas.lines.length) || darkest < 200, 'keine Bleilinien');
  const poly = generators.find((g) => g.id === 'polygon').make(2);
  const nonTri = poly.shapes.filter((s) => (s.d.match(/[LlHhVv]/g) || []).length + 1 > 3 || /[Cc]/.test(s.d)).length;
  assert.ok(nonTri > poly.shapes.length * 0.15, `zu wenig verschmolzene Flächen (${nonTri})`);
});
