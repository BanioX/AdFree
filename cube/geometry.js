// Oberflächen-Geometrie des Würfels.
//
// Der Würfel reicht von -1 bis +1 auf allen Achsen. Jede der 6 Seiten ist ein N×N-Raster.
// Eine Zelle ist (face, u, v) und wird als Index  face*N*N + v*N + u  gespeichert.
// Jede Seite hat eine Normale n und zwei Achsen U, V (U × V = n).
// Richtungen auf einer Seite: 0 = +U, 1 = +V, 2 = -U, 3 = -V.
//
// Nachbarn über Kanten werden NICHT per Tabelle festgelegt, sondern generisch aus den
// 3D-Positionen berechnet: Vom Zellmittelpunkt einen halben Schritt in Bewegungsrichtung
// bis zur Kante, dann einen halben Schritt «um die Kante herum» (gegen die alte Normale).
// Die neue Bewegungsrichtung ist dort die alte negierte Normale.

import { add, scale, dot, sub } from './math.js';

export const DU = [1, 0, -1, 0];
export const DV = [0, 1, 0, -1];

export const FACE_DEFS = [
  { name: '+X', n: [1, 0, 0], U: [0, 1, 0], V: [0, 0, 1] },
  { name: '-X', n: [-1, 0, 0], U: [0, 0, 1], V: [0, 1, 0] },
  { name: '+Y', n: [0, 1, 0], U: [0, 0, 1], V: [1, 0, 0] },
  { name: '-Y', n: [0, -1, 0], U: [1, 0, 0], V: [0, 0, 1] },
  { name: '+Z', n: [0, 0, 1], U: [1, 0, 0], V: [0, 1, 0] },
  { name: '-Z', n: [0, 0, -1], U: [0, 1, 0], V: [1, 0, 0] },
];

const sameVec = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-9;

function faceByNormal(n) {
  for (let f = 0; f < 6; f++) if (sameVec(FACE_DEFS[f].n, n)) return f;
  throw new Error('Keine Seite mit Normale ' + n);
}

/** 3D-Richtungsvektor der Richtung d auf Seite f. */
export function dirVec(f, d) {
  const F = FACE_DEFS[f];
  const v = d & 1 ? F.V : F.U;
  return d < 2 ? v.slice() : scale(v, -1);
}

function dirOf(f, vec) {
  for (let d = 0; d < 4; d++) if (sameVec(dirVec(f, d), vec)) return d;
  throw new Error('Richtung nicht auf Seite ' + f);
}

const cache = new Map();

/** Liefert (gecacht) die Geometrie für Seitenlänge N. */
export function makeCube(N) {
  if (cache.has(N)) return cache.get(N);
  const h = 2 / N;
  const NN = N * N;
  const count = 6 * NN;
  const faces = FACE_DEFS.map((F) => ({
    ...F,
    O: sub(sub(F.n, F.U), F.V), // Ecke (u=0, v=0)
  }));

  const centers = new Float64Array(count * 3);
  const centerOf = (f, u, v) => {
    const F = faces[f];
    return add(add(F.O, scale(F.U, (u + 0.5) * h)), scale(F.V, (v + 0.5) * h));
  };
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < N; v++) {
      for (let u = 0; u < N; u++) {
        const c = centerOf(f, u, v);
        const i = (f * NN + v * N + u) * 3;
        centers[i] = c[0]; centers[i + 1] = c[1]; centers[i + 2] = c[2];
      }
    }
  }

  const next = new Int32Array(count * 4);
  const nextDir = new Int8Array(count * 4);
  for (let c = 0; c < count; c++) {
    const f = (c / NN) | 0;
    const r = c - f * NN;
    const v = (r / N) | 0;
    const u = r - v * N;
    for (let d = 0; d < 4; d++) {
      const u2 = u + DU[d];
      const v2 = v + DV[d];
      if (u2 >= 0 && u2 < N && v2 >= 0 && v2 < N) {
        next[c * 4 + d] = f * NN + v2 * N + u2;
        nextDir[c * 4 + d] = d;
        continue;
      }
      // Über die Kante falten
      const D = dirVec(f, d);
      const n = faces[f].n;
      const p = [centers[c * 3], centers[c * 3 + 1], centers[c * 3 + 2]];
      const q = add(p, scale(sub(D, n), h / 2));
      const f2 = faceByNormal(D);
      const F2 = faces[f2];
      const rel = sub(q, F2.O);
      const uu = Math.round(dot(rel, F2.U) / h - 0.5);
      const vv = Math.round(dot(rel, F2.V) / h - 0.5);
      next[c * 4 + d] = f2 * NN + vv * N + uu;
      nextDir[c * 4 + d] = dirOf(f2, scale(n, -1));
    }
  }

  const geo = {
    N, h, NN, count, faces, centers, next, nextDir,
    faceOf: (c) => (c / NN) | 0,
    uOf: (c) => (c % NN) % N,
    vOf: (c) => ((c % NN) / N) | 0,
    cell: (f, u, v) => f * NN + v * N + u,
    center: (c) => [centers[c * 3], centers[c * 3 + 1], centers[c * 3 + 2]],
    /** Ein Schritt von Zelle c in Richtung d: { c, d } (d = Richtung auf der neuen Seite). */
    step: (c, d) => ({ c: next[c * 4 + d], d: nextDir[c * 4 + d] }),
    /** Zellen vom Kopf c in Richtung d bis zum Rand derselben Seite (ohne c selbst). */
    ray(c, d) {
      const f = (c / NN) | 0;
      const r = c - f * NN;
      let v = (r / N) | 0;
      let u = r - v * N;
      const out = [];
      for (;;) {
        u += DU[d]; v += DV[d];
        if (u < 0 || u >= N || v < 0 || v >= N) break;
        out.push(f * NN + v * N + u);
      }
      return out;
    },
    /** Richtung (0..3) von Zelle a zum Nachbarn b, oder -1. */
    dirBetween(a, b) {
      for (let d = 0; d < 4; d++) if (next[a * 4 + d] === b) return d;
      return -1;
    },
    dirVec,
  };
  cache.set(N, geo);
  return geo;
}
