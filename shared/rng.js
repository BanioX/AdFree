// Deterministischer Zufallsgenerator (mulberry32) + Helfer.
// Gleicher Seed => gleiche Folge. Ideal für reproduzierbare Level.
//
//   import { makeRng, hashString } from '../shared/rng.js';
//   const rng = makeRng(hashString('level-12'));
//   rng.next(); rng.int(0, 9); rng.pick(arr); rng.shuffle(arr);

export function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(typeof seed === 'string' ? hashString(seed) : seed);
  return {
    next,
    /** Gleitkommazahl in [a, b) */
    range(a, b) { return a + (b - a) * next(); },
    /** Ganzzahl in [a, b] (inklusive) */
    int(a, b) { return a + Math.floor(next() * (b - a + 1)); },
    chance(p) { return next() < p; },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    /** Mischt das Array an Ort und Stelle und gibt es zurück. */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },
  };
}
