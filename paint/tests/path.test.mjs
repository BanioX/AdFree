import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePath, pathBBox, arcToCubics, flattenPath, polygonArea } from '../engine/path.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const bboxNear = (bb, exp, eps = 1e-6) => exp.forEach((v, i) => near(bb[i], v, eps));

test('Linien, H/V, Z und implizite Linien nach M', () => {
  const s = parsePath('M10 20 30 40H50V60Z');
  assert.deepEqual(s.map((x) => x.t), ['M', 'L', 'L', 'L', 'Z']);
  bboxNear(pathBBox('M10 20 30 40H50V60Z'), [10, 20, 50, 60]);
});

test('relative Befehle', () => {
  bboxNear(pathBBox('m10 10 l20 0 v20 h-20 z m100 100 h5 v5z'), [10, 10, 115, 115]);
  // nach z beginnt der relative Punkt am Teilpfad-Start
  const s = parsePath('M10 10h10z l5 5');
  const last = s[s.length - 1];
  near(last.x, 15); near(last.y, 15);
});

test('kubische Kurven: Extrema statt Kontrollpunkte', () => {
  const bb = pathBBox('M0 0C0 100 100 100 100 0');
  bboxNear(bb, [0, 0, 100, 75]);
});

test('quadratische Kurven und T-Spiegelung', () => {
  bboxNear(pathBBox('M0 0Q50 100 100 0'), [0, 0, 100, 50]);
  const bb = pathBBox('M0 0Q25 -50 50 0T100 0');
  bboxNear(bb, [0, -25, 100, 25]);
});

test('S spiegelt den letzten Kontrollpunkt', () => {
  const bb = pathBBox('M0 0C0 -50 50 -50 50 0S100 50 100 0');
  near(bb[1], -37.5); near(bb[3], 37.5);
});

test('Bögen: Kreis aus zwei Halbbögen hat korrekten Rahmen', () => {
  const bb = pathBBox('M400 500A100 100 0 1 0 600 500A100 100 0 1 0 400 500Z');
  bboxNear(bb, [400, 400, 600, 600], 0.05);
});

test('Bögen mit kompakten Flags und relativ', () => {
  const s = parsePath('M0 0a50 50 0 1150 0');
  assert.equal(s[s.length - 1].x, 50);
  const bb = pathBBox('M760 150a90 90 0 1 0 180 0a90 90 0 1 0 -180 0Z');
  bboxNear(bb, [760, 60, 940, 240], 0.05);
});

test('Bogen mit zu kleinem Radius wird hochskaliert', () => {
  const c = arcToCubics(0, 0, 1, 1, 0, 0, 1, 100, 0);
  const last = c[c.length - 1];
  near(last[4], 100); near(last[5], 0);
});

test('Zahlenformate: Exponent, Punkte ohne Trenner, Vorzeichen', () => {
  const s = parsePath('M1e2.5L-3.5.5');
  near(s[0].x, 100); near(s[0].y, 0.5); // "1e2" und ".5" sind getrennte Zahlen
  near(s[1].x, -3.5); near(s[1].y, 0.5);
});

test('Syntaxfehler: bis zur Fehlerstelle auswerten', () => {
  const s = parsePath('M0 0L10 10L20 x30 30');
  assert.equal(s.length, 2);
  assert.deepEqual(parsePath(''), []);
  assert.deepEqual(parsePath(null), []);
});

test('Flatten + Fläche eines Quadrats', () => {
  const polys = flattenPath('M0 0H10V10H0Z');
  near(Math.abs(polygonArea(polys[0])), 100);
});
