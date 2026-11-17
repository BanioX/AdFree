import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edt, INF, poleOfMask } from '../engine/edt.js';

test('Distanztransformation entspricht Brute Force', () => {
  const w = 23, h = 17;
  const feats = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Float64Array(w * h).fill(INF);
  for (let k = 0; k < 9; k++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
    g[y * w + x] = 0;
    feats.push([x, y]);
  }
  edt(g, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = Infinity;
    for (const [fx, fy] of feats) best = Math.min(best, (fx - x) ** 2 + (fy - y) ** 2);
    assert.equal(g[y * w + x], best);
  }
});

test('Pol eines Rechtecks liegt in der Mitte', () => {
  const w = 40, h = 20;
  const m = new Uint8Array(w * h);
  for (let y = 2; y < 18; y++) for (let x = 2; x < 38; x++) m[y * w + x] = 1;
  const p = poleOfMask(m, w, h);
  assert.ok(Math.abs(p.y - 10) <= 1, 'y ' + p.y);
  assert.ok(p.x > 8 && p.x < 32);
  assert.ok(Math.abs(p.r - 7.5) <= 1, 'r ' + p.r);
});

test('Pol einer L-Form liegt im dicken Teil', () => {
  const w = 60, h = 60;
  const m = new Uint8Array(w * h);
  for (let y = 5; y < 55; y++) for (let x = 5; x < 12; x++) m[y * w + x] = 1; // dünner Balken
  for (let y = 30; y < 55; y++) for (let x = 5; x < 55; x++) m[y * w + x] = 1; // dicker Balken
  const p = poleOfMask(m, w, h);
  assert.ok(p.y > 35 && p.y < 50, 'y ' + p.y);
  assert.ok(p.r > 10);
});

test('leere Maske -> null', () => {
  assert.equal(poleOfMask(new Uint8Array(16), 4, 4), null);
});
