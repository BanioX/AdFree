// Serialisierbarer Zufallsgenerator (mulberry32) für Spiele, deren Spielstand den
// Zufallszustand mitspeichern muss (Wabenstapel, Kuchen-Sortierung, …). Reine Logik, ohne DOM.
//
//   const r = srng(1234);  r.next(); r.int(1, 6); r.pick(arr);
//   const saved = r.state;  …  r.state = saved;   // Zustand sichern / wiederherstellen

import { hashString } from '../../shared/rng.js';

export function srng(seed) {
  let a = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  const r = {
    get state() { return a; },
    set state(v) { a = v >>> 0; },
    next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Ganzzahl in [lo, hi] (inklusive) */
    int(lo, hi) { return lo + Math.floor(r.next() * (hi - lo + 1)); },
    chance(p) { return r.next() < p; },
    pick(arr) { return arr[Math.floor(r.next() * arr.length)]; },
    /** Wählt nach Gewichten (Array von Zahlen), gibt den Index zurück. */
    weighted(weights) {
      let sum = 0;
      for (const w of weights) sum += w;
      let x = r.next() * sum;
      for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
      return weights.length - 1;
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(r.next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },
  };
  return r;
}

export { hashString };
