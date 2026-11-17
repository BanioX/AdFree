// Foto-Umwandlung (reine Logik aus gen/core/photo.js, läuft im Browser im Worker):
// gültig, lückenlos, Detailstufen, Farbanzahl, Abbruch.
//   node --test paint/tests/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { processImage } from '../gen/core/photo.js';
import { validatePuzzle, coverageHoles } from './helpers.mjs';

// Blumen/Wolken in verschiedenen Grössen, damit die Detailstufen etwas zu tun haben
const BLOBS = [];
{
  let t = 99;
  const rr = () => ((t = (t * 69069 + 1) >>> 0) / 4294967296);
  const cols = [[240, 90, 150], [255, 255, 255], [250, 200, 60], [150, 90, 200], [255, 140, 60]];
  for (let k = 0; k < 140; k++) {
    const sky = k < 20;
    BLOBS.push({ x: rr(), y: sky ? rr() * 0.4 : 0.6 + rr() * 0.4, r: sky ? 0.04 + rr() * 0.06 : 0.006 + rr() * 0.03, c: sky ? [245, 248, 252] : cols[k % cols.length] });
  }
}

/** Synthetisches «Foto»: Himmel mit Verlauf, Sonne, Hügel, Haus und Rauschen (wie Textur). */
function makeImage(w = 480, h = 360) {
  const data = new Uint8ClampedArray(w * h * 4);
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r, g, b;
      const hill = h * 0.62 + Math.sin(x / 40) * 18;
      if (y < hill) { r = 90 + y * 0.3; g = 160 + y * 0.2; b = 230; }
      else if (y < h * 0.85) { r = 70; g = 140 + Math.sin(x / 9) * 20; b = 50; }
      else { r = 50; g = 105; b = 40; }
      if ((x - w * 0.78) ** 2 + (y - h * 0.2) ** 2 < (h * 0.1) ** 2) { r = 255; g = 210; b = 70; }
      if (x > w * 0.25 && x < w * 0.45 && y > h * 0.5 && y < h * 0.75) { r = 205; g = 70; b = 55; }
      for (const f of BLOBS) {
        if ((x - f.x * w) ** 2 + (y - f.y * h) ** 2 < (f.r * h) ** 2) { [r, g, b] = f.c; }
      }
      const n = (rnd() - 0.5) * 26;
      const k = (y * w + x) * 4;
      data[k] = r + n; data[k + 1] = g + n; data[k + 2] = b + n; data[k + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

const img = makeImage();
const results = {};

for (const detail of ['grob', 'mittel', 'fein']) {
  test(`Foto ${detail}: gültiges, lückenloses Malbild`, async () => {
    let last = 0, calls = 0;
    const p = await processImage(img, { colors: 12, detail, onProgress: (v) => { assert.ok(v >= last); last = v; calls++; } });
    results[detail] = p;
    const probs = validatePuzzle(p, { minShapes: 8, maxShapes: 2500, requireAllColors: false });
    assert.deepEqual(probs, [], probs.slice(0, 4).join('; '));
    assert.ok(p.palette.length <= 12, 'zu viele Farben: ' + p.palette.length);
    assert.ok(Math.abs(p.width / p.height - 480 / 360) < 0.02, 'Seitenverhältnis');
    assert.ok(calls > 3 && last > 0.95, 'Fortschritt');
    const { holes, sample } = coverageHoles(p, 44);
    assert.equal(holes, 0, 'Loch bei ' + sample);
  });
}

test('Foto: feiner = mehr Flächen; deterministisch', async () => {
  const n = (d) => results[d].shapes.length;
  assert.ok(n('grob') < n('mittel') && n('mittel') < n('fein'), `${n('grob')} / ${n('mittel')} / ${n('fein')}`);
  const again = await processImage(img, { colors: 12, detail: 'grob' });
  assert.equal(JSON.stringify(again), JSON.stringify(results.grob));
});

test('Foto: Abbruch über AbortSignal', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  await assert.rejects(processImage(img, { colors: 12, detail: 'mittel', signal: ctrl.signal }));
});
