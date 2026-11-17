import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeBits, decodeBits, encodeOrder, decodeOrder, countBits, percent } from '../engine/progress.js';

test('Bits hin und zurück', () => {
  for (const n of [0, 1, 7, 8, 9, 100, 1500]) {
    const a = new Uint8Array(n);
    for (let i = 0; i < n; i++) a[i] = (i * 7919) % 3 === 0 ? 1 : 0;
    const s = encodeBits(a);
    assert.equal(typeof s, 'string');
    assert.deepEqual([...decodeBits(s, n)], [...a]);
    assert.equal(countBits(decodeBits(s, n)), countBits(a));
  }
});

test('Bits: kompakt (1500 Formen < 260 Zeichen)', () => {
  const a = new Uint8Array(1500).fill(1);
  assert.ok(encodeBits(a).length <= 252);
});

test('Bits: kaputte Daten ergeben leeres Ergebnis', () => {
  assert.deepEqual([...decodeBits('%%%', 5)], [0, 0, 0, 0, 0]);
  assert.deepEqual([...decodeBits(undefined, 3)], [0, 0, 0]);
});

test('Reihenfolge (Varint) hin und zurück', () => {
  const list = [0, 1, 127, 128, 300, 16383, 16384, 65535, 70000, 5, 5];
  assert.deepEqual(decodeOrder(encodeOrder(list)), list);
  assert.deepEqual(decodeOrder(encodeOrder([])), []);
});

test('Prozent: 100 nur wenn fertig', () => {
  assert.equal(percent(0, 0), 0);
  assert.equal(percent(999, 1000), 99);
  assert.equal(percent(1000, 1000), 100);
  assert.equal(percent(1, 3), 33);
});
