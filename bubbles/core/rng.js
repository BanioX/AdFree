// Serialisierbarer, deterministischer Zufallsgenerator (mulberry32).
// Anders als shared/rng.js lässt sich der Zustand speichern und wiederherstellen –
// so geht ein Spiel nach dem Neuladen exakt gleich weiter.

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

export class Rng {
  constructor(seed = 1) {
    this.s = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  }

  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganzzahl in [a, b] (inklusive) */
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  range(a, b) { return a + (b - a) * this.next(); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  /** Gewichtete Auswahl: weights[i] >= 0 */
  weighted(weights) {
    let sum = 0;
    for (const w of weights) sum += w;
    let x = this.next() * sum;
    for (let i = 0; i < weights.length; i++) {
      x -= weights[i];
      if (x < 0) return i;
    }
    return weights.length - 1;
  }

  get state() { return this.s; }
  static from(state) { const r = new Rng(0); r.s = state >>> 0; return r; }
  clone() { return Rng.from(this.s); }
}
