// node --test cube/tests
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCube, FACE_DEFS, dirVec, DU, DV } from '../geometry.js';
import { dot, cross, sub, len } from '../math.js';

const SIZES = [1, 2, 3, 4, 5, 7, 10, 11];

test('Seiten-Achsen sind rechtshändig und orthonormal', () => {
  for (const F of FACE_DEFS) {
    assert.deepEqual(cross(F.U, F.V), F.n);
    assert.equal(dot(F.U, F.n), 0);
    assert.equal(dot(F.V, F.n), 0);
  }
});

test('Zellmittelpunkte liegen auf der Würfeloberfläche und sind eindeutig', () => {
  for (const N of SIZES) {
    const g = makeCube(N);
    const seen = new Set();
    for (let c = 0; c < g.count; c++) {
      const p = g.center(c);
      const n = FACE_DEFS[g.faceOf(c)].n;
      assert.ok(Math.abs(dot(p, n) - 1) < 1e-9, 'auf der Seitenebene');
      for (const v of p) assert.ok(Math.abs(v) <= 1 + 1e-9);
      const key = p.map((v) => v.toFixed(6)).join(',');
      assert.ok(!seen.has(key));
      seen.add(key);
      assert.equal(g.cell(g.faceOf(c), g.uOf(c), g.vOf(c)), c);
    }
  }
});

test('Jeder Nachbar ist auf der Oberfläche genau einen Zellschritt entfernt', () => {
  for (const N of SIZES) {
    const g = makeCube(N);
    for (let c = 0; c < g.count; c++) {
      const nbs = new Set();
      for (let d = 0; d < 4; d++) {
        const { c: c2, d: d2 } = g.step(c, d);
        assert.ok(c2 >= 0 && c2 < g.count);
        assert.ok(d2 >= 0 && d2 < 4);
        nbs.add(c2);
        const f = g.faceOf(c), f2 = g.faceOf(c2);
        const p = g.center(c), q = g.center(c2);
        if (f === f2) {
          assert.ok(Math.abs(len(sub(q, p)) - g.h) < 1e-9);
          assert.equal(d2, d);
        } else {
          // Über die Kante: je h/2 bis zum gemeinsamen Kantenpunkt
          const e = p.map((v, i) => v + dirVec(f, d)[i] * g.h / 2);
          assert.ok(Math.abs(len(sub(e, p)) - g.h / 2) < 1e-9);
          assert.ok(Math.abs(len(sub(q, e)) - g.h / 2) < 1e-9);
          // Neue Laufrichtung = alte negierte Normale
          assert.deepEqual(dirVec(f2, d2).map((v) => v || 0), FACE_DEFS[f].n.map((v) => -v || 0));
          // Kantenpunkt liegt auf einer Würfelkante (zwei Koordinaten = ±1)
          assert.equal(e.filter((v) => Math.abs(Math.abs(v) - 1) < 1e-9).length, 2);
        }
      }
      if (N > 1) assert.equal(nbs.size, 4, 'vier verschiedene Nachbarn');
    }
  }
});

test('Schritt und Rückschritt heben sich auf (Involution, auch über Kanten)', () => {
  for (const N of SIZES) {
    const g = makeCube(N);
    for (let c = 0; c < g.count; c++) {
      for (let d = 0; d < 4; d++) {
        const s = g.step(c, d);
        const back = g.step(s.c, (s.d + 2) & 3);
        assert.equal(back.c, c);
        assert.equal(back.d, (d + 2) & 3);
      }
    }
  }
});

test('4N Schritte geradeaus führen einmal um den Würfel zurück zum Start', () => {
  for (const N of SIZES) {
    const g = makeCube(N);
    for (let c = 0; c < g.count; c++) {
      for (let d = 0; d < 4; d++) {
        let cur = c, dir = d;
        const faces = new Set();
        for (let i = 0; i < 4 * N; i++) {
          const s = g.step(cur, dir);
          cur = s.c; dir = s.d;
          faces.add(g.faceOf(cur));
          if (i < 4 * N - 1) assert.ok(cur !== c || N === 0, 'nicht vorzeitig zurück');
        }
        assert.equal(cur, c);
        assert.equal(dir, d);
        assert.equal(faces.size, 4, 'ein Ring über genau 4 Seiten');
      }
    }
  }
});

test('Strahl: Zellen bis zum Rand derselben Seite, in Reihenfolge', () => {
  for (const N of [3, 5, 8]) {
    const g = makeCube(N);
    for (let c = 0; c < g.count; c++) {
      const f = g.faceOf(c), u = g.uOf(c), v = g.vOf(c);
      for (let d = 0; d < 4; d++) {
        const ray = g.ray(c, d);
        const expectLen = d === 0 ? N - 1 - u : d === 1 ? N - 1 - v : d === 2 ? u : v;
        assert.equal(ray.length, expectLen);
        let prev = c;
        for (const r of ray) {
          assert.equal(g.faceOf(r), f);
          assert.equal(g.step(prev, d).c, r);
          prev = r;
        }
        // Nach dem letzten Strahl-Feld geht es über die Kante
        assert.notEqual(g.faceOf(g.step(prev, d).c), f);
      }
    }
  }
});

test('Richtungs-Tabellen passen zu den Achsen', () => {
  for (let f = 0; f < 6; f++) {
    for (let d = 0; d < 4; d++) {
      const F = FACE_DEFS[f];
      const v = dirVec(f, d);
      assert.deepEqual(v.map((x) => x || 0), F.U.map((x, i) => (x * DU[d] + F.V[i] * DV[d]) || 0));
    }
  }
});
