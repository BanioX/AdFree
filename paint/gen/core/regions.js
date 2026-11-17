// Flächen auf einem Pixelraster: Zusammenhangskomponenten (4er-Nachbarschaft),
// Nachbarschaftsgraph, Verschmelzen kleiner/schmaler Flächen, Abstandstransformation.
// Rein, ohne DOM – in Node und im Worker nutzbar.

/**
 * Zerlegt ein Klassenbild in 4-zusammenhängende Komponenten.
 * @param {Int32Array|Uint8Array|Uint16Array} cls  Klasse je Pixel
 * @returns {{ w, h, comp: Int32Array, n: number, cls: Int32Array, area: Float64Array, adj: Map<number, number>[] , alive: Uint8Array, parent: Int32Array }}
 */
export function buildRegions(cls, w, h) {
  const N = w * h;
  const comp = new Int32Array(N).fill(-1);
  const stack = new Int32Array(N);
  let n = 0;
  const clsOf = [];
  const areaOf = [];
  for (let s = 0; s < N; s++) {
    if (comp[s] >= 0) continue;
    const c = cls[s];
    let sp = 0, cnt = 0;
    stack[sp++] = s;
    comp[s] = n;
    while (sp) {
      const k = stack[--sp];
      cnt++;
      const x = k % w;
      if (x > 0 && comp[k - 1] < 0 && cls[k - 1] === c) { comp[k - 1] = n; stack[sp++] = k - 1; }
      if (x < w - 1 && comp[k + 1] < 0 && cls[k + 1] === c) { comp[k + 1] = n; stack[sp++] = k + 1; }
      if (k >= w && comp[k - w] < 0 && cls[k - w] === c) { comp[k - w] = n; stack[sp++] = k - w; }
      if (k < N - w && comp[k + w] < 0 && cls[k + w] === c) { comp[k + w] = n; stack[sp++] = k + w; }
    }
    clsOf.push(c);
    areaOf.push(cnt);
    n++;
  }
  const adj = Array.from({ length: n }, () => new Map());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const a = comp[k];
      if (x < w - 1) {
        const b = comp[k + 1];
        if (a !== b) { adj[a].set(b, (adj[a].get(b) || 0) + 1); adj[b].set(a, (adj[b].get(a) || 0) + 1); }
      }
      if (y < h - 1) {
        const b = comp[k + w];
        if (a !== b) { adj[a].set(b, (adj[a].get(b) || 0) + 1); adj[b].set(a, (adj[b].get(a) || 0) + 1); }
      }
    }
  }
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  return {
    w, h, comp, n,
    cls: Int32Array.from(clsOf),
    area: Float64Array.from(areaOf),
    adj,
    alive: new Uint8Array(n).fill(1),
    parent,
    count: n,
  };
}

export function findRoot(R, x) {
  const p = R.parent;
  while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; }
  return x;
}

/** Verschmilzt Fläche a in Fläche b (b behält seine Klasse). */
export function mergeInto(R, a, b) {
  if (a === b) return;
  const { adj, area } = R;
  const A = adj[a], B = adj[b];
  for (const [k, len] of A) {
    if (k === b) continue;
    B.set(k, (B.get(k) || 0) + len);
    const K = adj[k];
    K.delete(a);
    K.set(b, (K.get(b) || 0) + len);
  }
  B.delete(a);
  area[b] += area[a];
  R.parent[a] = b;
  R.alive[a] = 0;
  adj[a] = null;
  R.count--;
}

/** Kleiner binärer Min-Heap für [Schlüssel, Wert]. */
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p];
      i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const topV = v[0], topK = k[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0;
      const n = k.length;
      while (true) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c];
        i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return [topK, topV];
  }
}

/**
 * Verschmilzt die kleinsten Flächen mit ihrem ähnlichsten Nachbarn, bis alle Flächen
 * mindestens `minArea` gross sind und höchstens `maxCount` übrig bleiben.
 * cost(a, b) -> Zahl (kleiner = ähnlicher); Gleichstand -> längere gemeinsame Kante.
 * Mit `unify` werden danach gleichklassige Nachbarn vereinigt.
 */
export function mergeSmall(R, { minArea = 0, maxCount = Infinity, cost, unify = true, onTick } = {}) {
  const heap = new Heap();
  for (let i = 0; i < R.n; i++) if (R.alive[i]) heap.push(R.area[i], i);
  let ops = 0;
  while (heap.size) {
    const [a, r] = heap.pop();
    if (!R.alive[r] || a !== R.area[r]) continue;
    if (R.area[r] >= minArea && R.count <= maxCount) break;
    const nb = R.adj[r];
    if (!nb || nb.size === 0) continue;
    let best = -1, bc = Infinity, bl = -1;
    for (const [k, len] of nb) {
      const c = cost(r, k);
      if (c < bc - 1e-9 || (Math.abs(c - bc) <= 1e-9 && len > bl)) { bc = c; best = k; bl = len; }
    }
    mergeInto(R, r, best);
    if (unify) unifyAround(R, best, heap);
    heap.push(R.area[best], best);
    if (onTick && ++ops % 500 === 0) onTick();
  }
  if (unify) {
    for (let i = 0; i < R.n; i++) if (R.alive[i]) unifyAround(R, i, null);
  }
}

function unifyAround(R, b, heap) {
  let again = true;
  while (again) {
    again = false;
    for (const k of R.adj[b].keys()) {
      if (R.cls[k] === R.cls[b]) {
        // grössere behält die Id nicht zwingend – egal, Klasse ist gleich
        mergeInto(R, k, b);
        again = true;
        break;
      }
    }
  }
  if (heap) heap.push(R.area[b], b);
}

/**
 * Endgültige Beschriftung: jedes Pixel -> Flächenindex 0..F-1.
 * @returns {{ labels: Int32Array, F: number, cls: Int32Array, area: Float64Array, rootOf: Int32Array }}
 */
export function relabel(R) {
  const { w, h, comp } = R;
  const N = w * h;
  const idx = new Int32Array(R.n).fill(-1);
  const rootOf = [];
  let F = 0;
  for (let i = 0; i < R.n; i++) {
    const r = findRoot(R, i);
    if (idx[r] < 0) { idx[r] = F++; rootOf.push(r); }
    idx[i] = idx[r];
  }
  const labels = new Int32Array(N);
  for (let k = 0; k < N; k++) labels[k] = idx[comp[k]];
  const cls = new Int32Array(F), area = new Float64Array(F);
  rootOf.forEach((r, i) => { cls[i] = R.cls[r]; area[i] = R.area[r]; });
  return { labels, F, cls, area, rootOf: Int32Array.from(rootOf) };
}

/**
 * Grösster Innenabstand je Fläche (Chamfer-Abstand zum nächsten fremden Pixel; der Bildrand
 * zählt nicht als Grenze). Kleine Werte = schmale Fläche.
 */
export function innerRadius(labels, w, h, F) {
  const N = w * h;
  const d = new Float32Array(N);
  const BIG = 1e9;
  for (let k = 0; k < N; k++) {
    const l = labels[k], x = k % w;
    const b = (x > 0 && labels[k - 1] !== l) || (x < w - 1 && labels[k + 1] !== l) ||
      (k >= w && labels[k - w] !== l) || (k < N - w && labels[k + w] !== l);
    d[k] = b ? 1 : BIG;
  }
  const D = 1.4142;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (d[k] <= 1) continue;
      let v = d[k];
      if (x > 0) v = Math.min(v, d[k - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[k - w] + 1);
        if (x > 0) v = Math.min(v, d[k - w - 1] + D);
        if (x < w - 1) v = Math.min(v, d[k - w + 1] + D);
      }
      d[k] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const k = y * w + x;
      if (d[k] <= 1) continue;
      let v = d[k];
      if (x < w - 1) v = Math.min(v, d[k + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, d[k + w] + 1);
        if (x < w - 1) v = Math.min(v, d[k + w + 1] + D);
        if (x > 0) v = Math.min(v, d[k + w - 1] + D);
      }
      d[k] = v;
    }
  }
  const out = new Float32Array(F);
  for (let k = 0; k < N; k++) {
    const l = labels[k];
    const v = d[k] >= BIG ? Math.max(w, h) : d[k];
    if (v > out[l]) out[l] = v;
  }
  return out;
}

/**
 * Entfernt schmale Flächen (Innenradius < minRadius) durch Verschmelzen mit dem
 * ähnlichsten Nachbarn. Arbeitet auf R (Union-Find) und gibt die Anzahl Änderungen zurück.
 */
export function mergeThin(R, minRadius, cost) {
  const L = relabel(R);
  const rad = innerRadius(L.labels, R.w, R.h, L.F);
  let changed = 0;
  // schmalste zuerst
  const order = Array.from({ length: L.F }, (_, i) => i).filter((i) => rad[i] < minRadius).sort((a, b) => rad[a] - rad[b]);
  for (const i of order) {
    const r = findRoot(R, L.rootOf[i]);
    if (!R.alive[r]) continue;
    const nb = R.adj[r];
    if (!nb || !nb.size) continue;
    let best = -1, bc = Infinity, bl = -1;
    for (const [k, len] of nb) {
      const c = cost(r, k);
      if (c < bc - 1e-9 || (Math.abs(c - bc) <= 1e-9 && len > bl)) { bc = c; best = k; bl = len; }
    }
    mergeInto(R, r, best);
    unifyAround(R, best, null);
    changed++;
  }
  return changed;
}

/** 3×3-Mehrheitsfilter für ein Klassenbild (k Klassen). */
export function modeFilter(cls, w, h, k, iterations = 1) {
  let src = cls, dst = new Int32Array(cls.length);
  const cnt = new Int32Array(k);
  for (let it = 0; it < iterations; it++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k0 = y * w + x;
        const c0 = src[k0];
        let best = c0, bc = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            cnt[src[yy * w + xx]]++;
          }
        }
        bc = cnt[c0];
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const c = src[yy * w + xx];
            if (cnt[c] > bc) { bc = cnt[c]; best = c; }
          }
        }
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            cnt[src[yy * w + xx]] = 0;
          }
        }
        dst[k0] = best;
      }
    }
    const t = src === cls ? new Int32Array(cls.length) : src;
    src = dst;
    dst = t;
  }
  return src;
}
