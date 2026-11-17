// Deterministischer Zufall mit speicherbarem Zustand (mulberry32).
// Gleicher Seed => gleiche Folge; .state kann gespeichert und wiederhergestellt werden.

import { hashString } from '../../shared/rng.js';

export class Rng {
  constructor(seed = 1) {
    this.s = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  }

  get state() { return this.s; }
  set state(v) { this.s = v >>> 0; }

  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganzzahl in [a, b] */
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }

  /** Wählt ein Element nach Gewicht: items = [{ w, ... }] */
  weighted(items, key = 'w') {
    let sum = 0;
    for (const it of items) sum += it[key];
    let x = this.next() * sum;
    for (const it of items) {
      x -= it[key];
      if (x < 0) return it;
    }
    return items[items.length - 1];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
}
