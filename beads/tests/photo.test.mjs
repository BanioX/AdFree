// node --test beads/tests/   – Farbreduktion für «Eigenes Foto» (ohne Browser)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quantize } from '../photo.js';

/** Abtastung wie sampleImage: N×N Zellen in OKLab, mask 1 = Perle. */
function sample(N, colorAt, maskAt = () => 1) {
  const lab = new Float32Array(N * N * 3);
  const mask = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      lab.set(colorAt(x, y), (y * N + x) * 3);
      mask[y * N + x] = maskAt(x, y);
    }
  }
  return { N, lab, mask };
}

const RED = [0.63, 0.22, 0.13];
const BLUE = [0.45, -0.03, -0.31];
const WHITE = [1, 0, 0];

test('durchsichtige Stellen werden keine Perlen', () => {
  const s = sample(16, (x) => (x < 8 ? RED : BLUE), (x, y) => (y < 4 ? 0 : 1));
  const p = quantize(s, 6, 't');
  for (let y = 0; y < 4; y++) assert.equal(p.rows[y], '.'.repeat(16));
  for (let y = 4; y < 16; y++) assert.ok(!p.rows[y].includes('.'));
  assert.equal(Object.keys(p.palette).length, 2);
});

test('ganz durchsichtiges Bild ergibt ein leeres Muster', () => {
  const p = quantize(sample(16, () => WHITE, () => 0), 8, 't');
  assert.ok(p.rows.every((r) => r === '.'.repeat(16)));
  assert.equal(Object.keys(p.palette).length, 0);
});

test('einfarbiges Bild ergibt genau eine Farbe (Bildschirm lehnt es ab)', () => {
  const p = quantize(sample(16, () => WHITE), 8, 't');
  assert.equal(Object.keys(p.palette).length, 1);
});
