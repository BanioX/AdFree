import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitCamera, clampCam, rubber, unrubber, softScale, unsoftScale, softTranslate, unsoftTranslate,
  zoomAround, lerpCam, axisRange, isOutOfBounds,
} from '../engine/camera.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const vp0 = { W: 1000, H: 1000, VW: 390, VH: 600, pad: 14 };
const fit = fitCamera(vp0);
const vp = { ...vp0, minS: fit.s, maxS: fit.s * 12 };

test('Einpassen: zentriert mit Rand', () => {
  near(fit.s, (390 - 28) / 1000);
  near(fit.x, 14);
  near(fit.y, (600 - 362) / 2);
});

test('Grenzen: kleines Bild bleibt zentriert, grosses bleibt im Bild', () => {
  assert.deepEqual(axisRange(1000, 0.2, 390, 14), [95, 95]);
  const [lo, hi] = axisRange(1000, 1, 390, 14);
  near(lo, 390 - 14 - 1000); near(hi, 14);
  const c = clampCam({ s: 1, x: 500, y: -5000 }, vp);
  near(c.x, 14); near(c.y, 600 - 14 - 1000);
  assert.ok(!isOutOfBounds(c, vp));
  assert.ok(isOutOfBounds({ s: 1, x: 500, y: 0 }, vp));
});

test('Gummiband ist umkehrbar und begrenzt', () => {
  for (const o of [0, 1, 10, 100, 1000]) near(unrubber(rubber(o, 390), 390), o, 1e-6 * Math.max(1, o));
  assert.ok(rubber(1e9, 390) < 390);
  for (const s of [vp.minS * 0.5, vp.minS, vp.maxS, vp.maxS * 3]) near(unsoftScale(softScale(s, vp), vp), s, 1e-9);
  const t = softTranslate(300, 40, 1, vp);
  const u = unsoftTranslate(t.x, t.y, 1, vp);
  near(u.x, 300, 1e-6); near(u.y, 40, 1e-6);
});

test('Zoom um einen Punkt hält ihn fest', () => {
  const cam = { s: 0.5, x: 10, y: 20 };
  const z = zoomAround(cam, 200, 300, 2);
  const u0 = [(200 - cam.x) / cam.s, (300 - cam.y) / cam.s];
  const u1 = [(200 - z.x) / z.s, (300 - z.y) / z.s];
  near(u0[0], u1[0]); near(u0[1], u1[1]);
});

test('Interpolation trifft Start und Ziel', () => {
  const a = { s: 0.4, x: 10, y: 20 }, b = { s: 4, x: -900, y: -1200 };
  const c0 = lerpCam(a, b, 0, 390, 600), c1 = lerpCam(a, b, 1, 390, 600);
  near(c0.s, a.s); near(c0.x, a.x); near(c0.y, a.y);
  near(c1.s, b.s); near(c1.x, b.x, 1e-6); near(c1.y, b.y, 1e-6);
  const m = lerpCam(a, b, 0.5, 390, 600);
  near(m.s, Math.sqrt(a.s * b.s));
});
