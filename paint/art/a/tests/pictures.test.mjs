// Inhaltstests Team A: node --test paint/art/a/tests/
// Format, Abdeckung, sichtbare Flächen und: jede Bilddatei entspricht genau ihrem Generator.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pictures } from '../index.js';
import { autoSplit } from '../src/raster.mjs';
import { checkPicture } from './contentcheck.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CATS = ['Blumen', 'Tiere'];
const files = [...readFileSync(join(here, '../index.js'), 'utf8').matchAll(/import\('\.\/([a-z0-9-]+)\.js'\)/g)].map((m) => m[1]);

test('Bildliste: mindestens 9 Bilder, eindeutige ids, ladbar', () => {
  assert.ok(pictures.length >= 9, `${pictures.length} Bilder`);
  assert.equal(new Set(pictures.map((p) => p.id)).size, pictures.length);
  assert.equal(files.length, pictures.length);
  for (const p of pictures) assert.equal(typeof p.load, 'function');
});

pictures.forEach((meta, k) => {
  test(`${meta.id}: Format, Abdeckung, keine versteckten Formen`, async () => {
    await checkPicture(meta, { idPrefix: 'a-', categories: CATS });
  });
  test(`${meta.id}: Datei ist aktuell (Generator src/${files[k]}.mjs)`, async () => {
    const src = join(here, '../src', files[k] + '.mjs');
    assert.ok(existsSync(src), 'Generator fehlt');
    const mod = await import(pathToFileURL(src).href);
    assert.equal(mod.meta.id, meta.id);
    const fresh = autoSplit(mod.build().build(), { log: false });
    const saved = await meta.load();
    assert.deepEqual(fresh, JSON.parse(JSON.stringify(saved)), 'neu bauen: node paint/art/a/src/build.mjs');
  });
});
