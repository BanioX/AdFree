// Inhaltstests Team B: node --test paint/art/b/tests/
// Format (DEV.md), Abdeckung, sichtbare Flächen, Generator vorhanden.
// (Die reine Raster-Prüfung teilt sich Team B mit Team A: ../../a/tests/contentcheck.mjs)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pictures } from '../index.js';
import { checkPicture } from '../../a/tests/contentcheck.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CATS = ['Landschaften', 'Essen', 'Fantasie', 'Winter'];
const files = [...readFileSync(join(here, '../index.js'), 'utf8').matchAll(/import\('\.\/([a-z0-9-]+)\.js'\)/g)].map((m) => m[1]);

test('Bildliste: mindestens 9 Bilder, eindeutige ids, Generatoren vorhanden', () => {
  assert.ok(pictures.length >= 9, `${pictures.length} Bilder`);
  assert.equal(new Set(pictures.map((p) => p.id)).size, pictures.length);
  assert.equal(files.length, pictures.length);
  for (const f of files) assert.ok(existsSync(join(here, '../src', f + '.mjs')), `src/${f}.mjs fehlt`);
});

for (const meta of pictures) {
  test(`${meta.id}: Format, Abdeckung, keine versteckten Formen`, async () => {
    await checkPicture(meta, { idPrefix: 'b-', categories: CATS });
  });
}

test('alle Bilder beider Teams: ids über die ganze Bibliothek eindeutig', async () => {
  const { pictures: all } = await import('../../index.js');
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  const ours = all.filter((p) => /^[ab]-/.test(p.id));
  assert.ok(ours.length >= 18, `${ours.length} handgezeichnete Bilder`);
});
