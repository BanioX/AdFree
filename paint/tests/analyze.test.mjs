import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idColor, decodeId, isAuto, autoThresholds, fontFactor, digitsOf } from '../engine/analyze-core.js';

test('ID-Farben sind eindeutig und umkehrbar', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const hex = idColor(i);
    assert.match(hex, /^#[0-9a-f]{6}$/);
    assert.ok(!seen.has(hex));
    seen.add(hex);
    assert.equal(decodeId(parseInt(hex.slice(1), 16)), i);
  }
});

test('benachbarte IDs haben sehr verschiedene Farben', () => {
  const a = parseInt(idColor(10).slice(1), 16), b = parseInt(idColor(11).slice(1), 16);
  assert.ok(Math.abs((a >> 16) - (b >> 16)) + Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) > 20);
});

test('Auto-Füllung: winzig ja, normal nein', () => {
  const t = autoThresholds(1000);
  assert.ok(isAuto(0, 0, 0, 1000));
  assert.ok(isAuto(t.area * 0.5, 5, 0, 1000));
  assert.ok(isAuto(500, 0.5, 0, 1000)); // dünner Splitter
  assert.ok(!isAuto(400, 8, 0, 1000));
  assert.ok(!isAuto(30, 2, 3, 1000));
  // zweistellige Nummern brauchen etwas mehr Platz
  assert.ok(fontFactor(digitsOf(12)) < fontFactor(digitsOf(3)));
});
