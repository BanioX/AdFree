// Delaunay-Triangulation (Bowyer-Watson) innerhalb eines Rechtecks [0,W]×[0,H].
// Die vier Ecken werden automatisch ergänzt; Punkte auf dem Rand sind erlaubt.
// Ergebnis: Dreiecke mit positiver Orientierung (cross > 0 im Bildschirm-Koordinatensystem),
// die das Rechteck lückenlos und ohne Überlappung bedecken.

function orient(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/**
 * @param {number[][]} input  Punkte [x, y] (innerhalb oder auf dem Rand des Rechtecks)
 * @returns {{ points: number[][], triangles: Int32Array }}  triangles: je 3 Punktindizes
 */
export function delaunay(input, W, H) {
  // Doppelte Punkte entfernen, Ecken zuerst
  const pts = [[0, 0], [W, 0], [W, H], [0, H]];
  const seen = new Set(pts.map(([x, y]) => x + ',' + y));
  for (const [x0, y0] of input) {
    const x = Math.min(W, Math.max(0, x0)), y = Math.min(H, Math.max(0, y0));
    const k = x + ',' + y;
    if (seen.has(k)) continue;
    seen.add(k);
    pts.push([x, y]);
  }
  const n = pts.length;
  const X = new Float64Array(n), Y = new Float64Array(n);
  pts.forEach(([x, y], i) => { X[i] = x; Y[i] = y; });

  // Dreiecksspeicher
  let cap = 2 * n + 16;
  let A = new Int32Array(cap), B = new Int32Array(cap), C = new Int32Array(cap);
  let CXs = new Float64Array(cap), CYs = new Float64Array(cap), R2 = new Float64Array(cap);
  let live = new Uint8Array(cap);
  let count = 0;
  const grow = () => {
    cap *= 2;
    const g = (arr, T) => { const a = new T(cap); a.set(arr); return a; };
    A = g(A, Int32Array); B = g(B, Int32Array); C = g(C, Int32Array);
    CXs = g(CXs, Float64Array); CYs = g(CYs, Float64Array); R2 = g(R2, Float64Array);
    live = g(live, Uint8Array);
  };
  const addTri = (a, b, c) => {
    if (count >= cap) grow();
    const ax = X[a], ay = Y[a], bx = X[b], by = Y[b], cx = X[c], cy = Y[c];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    A[count] = a; B[count] = b; C[count] = c;
    CXs[count] = ux; CYs[count] = uy;
    R2[count] = (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy);
    live[count] = 1;
    count++;
  };
  // Startdreiecke: Rechteck in zwei positive Dreiecke
  // Punkte: 0 (0,0), 1 (W,0), 2 (W,H), 3 (0,H). orient(0,1,2) > 0 im y-unten-System.
  addTri(0, 1, 2);
  addTri(0, 2, 3);

  const liveList = [0, 1];
  const edgeMap = new Map();
  for (let p = 4; p < n; p++) {
    const px = X[p], py = Y[p];
    const bad = [];
    for (let k = 0; k < liveList.length; k++) {
      const t = liveList[k];
      const dx = px - CXs[t], dy = py - CYs[t];
      if (dx * dx + dy * dy < R2[t] * (1 + 1e-12)) bad.push(k);
    }
    // Rand der Höhle (Kanten, die nur einmal vorkommen)
    edgeMap.clear();
    for (const k of bad) {
      const t = liveList[k];
      const e = [[A[t], B[t]], [B[t], C[t]], [C[t], A[t]]];
      for (const [u, v] of e) {
        const key = u < v ? u * n + v : v * n + u;
        const ex = edgeMap.get(key);
        if (ex) ex.n++;
        else edgeMap.set(key, { u, v, n: 1 });
      }
      live[t] = 0;
    }
    // tote Dreiecke aus der Liste entfernen (rückwärts, swap-remove)
    bad.sort((a, b) => b - a);
    for (const k of bad) {
      liveList[k] = liveList[liveList.length - 1];
      liveList.pop();
    }
    for (const { u, v, n: c } of edgeMap.values()) {
      if (c !== 1) continue;
      const o = orient(X[u], Y[u], X[v], Y[v], px, py);
      if (o <= 1e-9) continue; // kollinear (Punkt auf einer Randkante) -> kein Dreieck
      liveList.push(count);
      addTri(u, v, p);
    }
  }
  const tris = new Int32Array(liveList.length * 3);
  liveList.sort((a, b) => a - b);
  liveList.forEach((t, i) => { tris[i * 3] = A[t]; tris[i * 3 + 1] = B[t]; tris[i * 3 + 2] = C[t]; });
  return { points: pts, triangles: tris };
}

/** Prüfhilfe: Summe der Dreiecksflächen. */
export function triangleAreaSum(points, tris) {
  let s = 0;
  for (let i = 0; i < tris.length; i += 3) {
    const a = points[tris[i]], b = points[tris[i + 1]], c = points[tris[i + 2]];
    s += orient(a[0], a[1], b[0], b[1], c[0], c[1]) / 2;
  }
  return s;
}

/**
 * Fasst kantenbenachbarte Dreiecke gleicher Gruppe zusammen und liefert je Gruppe die
 * Randschleifen (Arrays von Punktindizes). Schleifen sind so orientiert, dass die Fläche
 * links liegt; Löcher laufen dadurch automatisch entgegengesetzt (evenodd und nonzero passen).
 * @param {Int32Array} tris
 * @param {Int32Array|number[]} group  Gruppen-Id je Dreieck (z.B. Farbindex)
 * @returns {{ loops: number[][], group: number, tris: number[] }[]}
 */
export function mergeTriangles(points, tris, group) {
  const nt = tris.length / 3;
  const np = points.length;
  // Kante (u->v) -> Dreieck
  const edgeTri = new Map();
  for (let t = 0; t < nt; t++) {
    for (let e = 0; e < 3; e++) {
      const u = tris[t * 3 + e], v = tris[t * 3 + ((e + 1) % 3)];
      edgeTri.set(u * np + v, t);
    }
  }
  // Union-Find über gleiche Gruppe
  const parent = new Int32Array(nt);
  for (let i = 0; i < nt; i++) parent[i] = i;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < nt; t++) {
    for (let e = 0; e < 3; e++) {
      const u = tris[t * 3 + e], v = tris[t * 3 + ((e + 1) % 3)];
      const o = edgeTri.get(v * np + u);
      if (o !== undefined && group[o] === group[t]) {
        const a = find(t), b = find(o);
        if (a !== b) parent[a] = b;
      }
    }
  }
  const regions = new Map();
  for (let t = 0; t < nt; t++) {
    const r = find(t);
    if (!regions.has(r)) regions.set(r, { group: group[t], tris: [], edges: [] });
    const R = regions.get(r);
    R.tris.push(t);
    for (let e = 0; e < 3; e++) {
      const u = tris[t * 3 + e], v = tris[t * 3 + ((e + 1) % 3)];
      const o = edgeTri.get(v * np + u);
      if (o === undefined || find(o) !== r) R.edges.push([u, v]);
    }
  }
  const out = [];
  for (const R of regions.values()) {
    const next = new Map(); // u -> [v...]
    for (const [u, v] of R.edges) {
      if (!next.has(u)) next.set(u, []);
      next.get(u).push(v);
    }
    const loops = [];
    for (const [u0] of R.edges) {
      const list = next.get(u0);
      if (!list || !list.length) continue;
      const loop = [u0];
      let u = u0;
      let guard = 0;
      while (guard++ < 100000) {
        const l = next.get(u);
        const v = l.pop();
        if (v === u0) break;
        loop.push(v);
        u = v;
      }
      loops.push(loop);
    }
    out.push({ group: R.group, tris: R.tris, loops });
  }
  return out;
}
