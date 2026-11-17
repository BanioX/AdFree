import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel, levelParams, solve, freeArrowIds, FRONT_FACES } from '../generator.js';
import { makeCube } from '../geometry.js';

const LEVELS = Array.from({ length: 200 }, (_, i) => i + 1);

function check(level) {
  const lv = generateLevel(level);
  const geo = makeCube(lv.N);
  const p = levelParams(level);
  assert.equal(lv.N, p.N);
  assert.ok(lv.arrows.length >= 2, `L${level}: genug Pfeile`);
  const owner = new Int32Array(geo.count).fill(-1);
  lv.arrows.forEach((a, id) => {
    assert.ok(a.cells.length >= 2 && a.cells.length <= 10, `L${level}: Länge 2..10`);
    assert.ok(a.dir >= 0 && a.dir < 4);
    for (const c of a.cells) {
      assert.equal(owner[c], -1, `L${level}: Zellen überlappen nicht`);
      owner[c] = id;
    }
    // Pfad: orthogonal benachbart (auch über Kanten)
    for (let i = 1; i < a.cells.length; i++) {
      assert.ok(geo.dirBetween(a.cells[i - 1], a.cells[i]) >= 0, `L${level}: Pfad zusammenhängend`);
    }
    // Kopfrichtung = Fortsetzung des letzten Schritts
    const n = a.cells.length;
    const d = geo.dirBetween(a.cells[n - 2], a.cells[n - 1]);
    assert.equal(geo.step(a.cells[n - 2], d).d, a.dir, `L${level}: Kopf zeigt in Laufrichtung`);
    // Eigener Strahl kreuzt den eigenen Körper nicht
    const ray = geo.ray(a.cells[n - 1], a.dir);
    for (const c of ray) assert.ok(!a.cells.includes(c), `L${level}: Strahl kreuzt Körper nicht`);
  });
  return { lv, geo, p };
}

test('Level sind deterministisch', () => {
  for (const L of [1, 2, 7, 10, 20, 33, 45, 60, 99, 150]) {
    const a = JSON.stringify(generateLevel(L));
    // Cache umgehen: erneut über eine frische Instanz des Moduls wäre aufwendig –
    // stattdessen viele andere Level erzeugen (verdrängt den Cache) und vergleichen.
    for (let k = 300; k < 320; k++) generateLevel(k);
    assert.equal(JSON.stringify(generateLevel(L)), a, `Level ${L}`);
  }
});

test('Level 1..200: gültig, lösbar, mit freien Pfeilen zu Beginn', () => {
  for (const L of LEVELS) {
    const { lv, geo, p } = check(L);
    assert.ok(solve(geo, lv.arrows), `Level ${L} ist lösbar`);
    // Umgekehrte Platzierungsreihenfolge ist eine gültige Lösung
    const removed = new Uint8Array(lv.arrows.length);
    for (let i = lv.arrows.length - 1; i >= 0; i--) {
      assert.ok(freeArrowIds(geo, lv.arrows, removed).includes(i), `L${L}: Pfeil ${i} frei, wenn an der Reihe`);
      removed[i] = 1;
    }
    const free = freeArrowIds(geo, lv.arrows);
    assert.ok(free.length >= 1, `L${L}: mindestens ein freier Pfeil`);
    if (lv.N >= 6) assert.ok(free.length <= p.maxFree + 3, `L${L}: nicht zu viele freie Pfeile (${free.length})`);
    const occ = lv.arrows.reduce((s, a) => s + a.cells.length, 0) / geo.count;
    if (L > 2) assert.ok(occ >= 0.55 && occ <= 0.95, `L${L}: Dichte ${occ.toFixed(2)}`);
    assert.ok(lv.hearts >= 2 && lv.hearts <= 5);
  }
});

test('Grösse wächst sanft von 3 bis 10', () => {
  assert.equal(generateLevel(1).N, 3);
  assert.equal(generateLevel(2).N, 3);
  let prevMax = 3;
  for (let L = 1; L <= 120; L++) {
    const N = levelParams(L).N;
    assert.ok(N >= 3 && N <= 10);
    assert.ok(N <= prevMax + 1, `kein Sprung bei Level ${L}`);
    prevMax = Math.max(prevMax, N);
  }
  assert.ok(levelParams(80).N >= 8);
});

test('Tutorial-Level: wenige Pfeile, freie Pfeile auf den sichtbaren Seiten', () => {
  for (const L of [1, 2]) {
    const lv = generateLevel(L);
    const geo = makeCube(lv.N);
    assert.ok(lv.arrows.length <= 14);
    const vis = freeArrowIds(geo, lv.arrows).filter((i) => FRONT_FACES.includes(geo.faceOf(lv.arrows[i].cells.at(-1))));
    assert.ok(vis.length >= 2, `Level ${L}: ${vis.length} sichtbare freie Pfeile`);
  }
});

test('Spezial-Level alle 10 Level', () => {
  for (let L = 10; L <= 200; L += 10) {
    const lv = generateLevel(L);
    assert.ok(lv.special === 'edges' || lv.special === 'big');
    if (lv.special === 'edges') {
      const geo = makeCube(lv.N);
      for (const a of lv.arrows) {
        assert.ok(new Set(a.cells.map((c) => geo.faceOf(c))).size >= 2, `L${L}: jeder Pfeil läuft über eine Kante`);
      }
    }
  }
  assert.equal(generateLevel(11).special, null);
  assert.equal(generateLevel(10).special, 'edges');
  assert.equal(generateLevel(20).special, 'big');
});

test('Viele Pfeile laufen über Kanten (3D macht es interessant)', () => {
  for (const L of [5, 15, 25, 45, 75]) {
    const lv = generateLevel(L);
    const geo = makeCube(lv.N);
    const crossing = lv.arrows.filter((a) => new Set(a.cells.map((c) => geo.faceOf(c))).size > 1).length;
    assert.ok(crossing / lv.arrows.length > 0.3, `L${L}: ${crossing}/${lv.arrows.length}`);
  }
});

test('Erzeugung ist schnell genug fürs iPhone', () => {
  const t0 = performance.now();
  for (let L = 400; L < 420; L++) generateLevel(L);
  const per = (performance.now() - t0) / 20;
  assert.ok(per < 120, `${per.toFixed(1)} ms pro Level`);
});
