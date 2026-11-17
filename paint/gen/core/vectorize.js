// Lückenloses Vektorisieren eines Flächen-Rasters.
//
// Die Grenzen zwischen Flächen verlaufen auf den Pixelkanten («Rissen»). Sie werden in Ketten
// zwischen Knotenpunkten zerlegt (Punkte, an denen 3+ Flächen oder Flächen und Bildrand
// zusammentreffen). Jede Kette wird genau EINMAL vereinfacht (Douglas-Peucker) und geglättet
// (quadratischer B-Spline mit festen Endpunkten). Beide angrenzenden Flächen benutzen dieselbe
// Kette (einmal vorwärts, einmal rückwärts) – dadurch entstehen weder Lücken noch Überlappungen.

import { fmt } from './util.js';

/** Douglas-Peucker auf einem offenen Polygonzug; liefert die behaltenen Indizes. */
export function douglasPeucker(pts, tol) {
  const n = pts.length;
  if (n <= 2) return pts.map((_, i) => i);
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    let best = -1, bd = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (L2 < 1e-12) d = (px - ax) * (px - ax) + (py - ay) * (py - ay);
      else {
        const cr = (px - ax) * dy - (py - ay) * dx;
        d = (cr * cr) / L2;
        // ausserhalb der Strecke: Abstand zu Endpunkten
        const t = ((px - ax) * dx + (py - ay) * dy) / L2;
        if (t < 0) d = (px - ax) * (px - ax) + (py - ay) * (py - ay);
        else if (t > 1) d = (px - bx) * (px - bx) + (py - by) * (py - by);
      }
      if (d > bd) { bd = d; best = i; }
    }
    if (bd > t2) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

/** Glättet innere Punkte (Binomialfilter), Endpunkte bleiben fest. closed: zyklisch. */
export function presmooth(pts, passes, closed) {
  let p = pts.map((q) => [q[0], q[1]]);
  const n = p.length;
  if (n < 3) return p;
  for (let it = 0; it < passes; it++) {
    const q = p.map((v) => [v[0], v[1]]);
    if (closed) {
      // pts[0] == pts[n-1] (geschlossen): zyklisch über n-1 Punkte
      const m = n - 1;
      for (let i = 0; i < m; i++) {
        const a = p[(i - 1 + m) % m], b = p[i], c = p[(i + 1) % m];
        q[i][0] = 0.25 * a[0] + 0.5 * b[0] + 0.25 * c[0];
        q[i][1] = 0.25 * a[1] + 0.5 * b[1] + 0.25 * c[1];
      }
      q[n - 1] = [q[0][0], q[0][1]];
    } else {
      for (let i = 1; i < n - 1; i++) {
        q[i][0] = 0.25 * p[i - 1][0] + 0.5 * p[i][0] + 0.25 * p[i + 1][0];
        q[i][1] = 0.25 * p[i - 1][1] + 0.5 * p[i][1] + 0.25 * p[i + 1][1];
      }
    }
    p = q;
  }
  return p;
}

/** Vereinfacht eine Kette (offen, Endpunkte fest; oder geschlossen). */
export function simplifyChain(pts, { tol = 0.6, passes = 2, closed = false, smooth = true } = {}) {
  let p = smooth ? presmooth(pts, passes, closed) : pts.map((q) => [q[0], q[1]]);
  if (p.length <= 2) return p;
  const first = p[0], last = p[p.length - 1];
  const isLoop = closed || (first[0] === last[0] && first[1] === last[1]);
  if (isLoop) {
    // am weitesten entfernten Punkt teilen, beide Hälften getrennt vereinfachen
    let far = 1, fd = -1;
    for (let i = 1; i < p.length - 1; i++) {
      const d = (p[i][0] - first[0]) ** 2 + (p[i][1] - first[1]) ** 2;
      if (d > fd) { fd = d; far = i; }
    }
    const a = p.slice(0, far + 1), b = p.slice(far);
    const ia = douglasPeucker(a, tol), ib = douglasPeucker(b, tol);
    const out = ia.map((i) => a[i]);
    for (let k = 1; k < ib.length; k++) out.push(b[ib[k]]);
    return out;
  }
  return douglasPeucker(p, tol).map((i) => p[i]);
}

/**
 * Vektorisiert ein Flächenraster.
 * @param {Int32Array} labels  Flächenindex je Pixel (0..F-1)
 * @param {number} w
 * @param {number} h
 * @param {number} F
 * @param {object} o
 *   scale: Faktor Pixel -> Ausgabekoordinaten
 *   mode(a, b): 'smooth' | 'straight' für die Kette zwischen Fläche a und b (b = -1: Bildrand)
 *   tol, tolStraight, passes, dp
 * @returns {{ paths: string[], ringCount: Int32Array, chains: { pts: number[][], a: number, b: number, mode: string }[] }}
 */
export function vectorize(labels, w, h, F, o = {}) {
  const scale = o.scale ?? 1;
  const dp = o.dp ?? 1;
  const modeOf = o.mode || (() => 'smooth');
  const W1 = w + 1;
  const L = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : labels[y * w + x]);
  // Kanten existieren?
  const hasH = (x, y) => x >= 0 && x < w && y >= 0 && y <= h && L(x, y - 1) !== L(x, y);
  const hasV = (x, y) => y >= 0 && y < h && x >= 0 && x <= w && L(x - 1, y) !== L(x, y);
  const visH = new Uint8Array(w * (h + 1));
  const visV = new Uint8Array((w + 1) * h);
  const degree = (x, y) => (hasH(x - 1, y) ? 1 : 0) + (hasH(x, y) ? 1 : 0) + (hasV(x, y - 1) ? 1 : 0) + (hasV(x, y) ? 1 : 0);
  const isCorner = (x, y) => (x === 0 || x === w) && (y === 0 || y === h);
  const isNode = (x, y) => {
    const d = degree(x, y);
    return d >= 3 || (d >= 2 && isCorner(x, y));
  };

  const chains = [];
  // Schritt entlang einer Kante: dir 0=rechts,1=unten,2=links,3=oben
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  const edgeFree = (x, y, d) => {
    switch (d) {
      case 0: return hasH(x, y) && !visH[y * w + x];
      case 2: return hasH(x - 1, y) && !visH[y * w + x - 1];
      case 1: return hasV(x, y) && !visV[y * W1 + x];
      case 3: return hasV(x, y - 1) && !visV[(y - 1) * W1 + x];
    }
    return false;
  };
  const markEdge = (x, y, d) => {
    switch (d) {
      case 0: visH[y * w + x] = 1; break;
      case 2: visH[y * w + x - 1] = 1; break;
      case 1: visV[y * W1 + x] = 1; break;
      case 3: visV[(y - 1) * W1 + x] = 1; break;
    }
  };
  // linke/rechte Fläche beim Gehen in Richtung d ab (x, y)
  const sides = (x, y, d) => {
    switch (d) {
      case 0: return [L(x, y - 1), L(x, y)];
      case 2: return [L(x - 1, y), L(x - 1, y - 1)];
      case 1: return [L(x, y), L(x - 1, y)];
      case 3: return [L(x - 1, y - 1), L(x, y - 1)];
    }
    return [-1, -1];
  };
  const trace = (x0, y0, d0) => {
    const pts = [[x0, y0]];
    const [a, b] = sides(x0, y0, d0);
    let x = x0, y = y0, d = d0;
    for (let guard = 0; guard < 4 * (w + 1) * (h + 1); guard++) {
      markEdge(x, y, d);
      x += DX[d]; y += DY[d];
      pts.push([x, y]);
      if ((x === x0 && y === y0) || isNode(x, y)) break;
      // nächste Kante: die einzige freie ausser zurück
      let nd = -1;
      for (const c of [d, (d + 1) % 4, (d + 3) % 4]) {
        if (edgeFree(x, y, c)) { nd = c; break; }
      }
      if (nd < 0) break;
      d = nd;
    }
    return { pts, a, b };
  };
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x <= w; x++) {
      if (!isNode(x, y)) continue;
      for (let d = 0; d < 4; d++) {
        if (edgeFree(x, y, d)) chains.push(trace(x, y, d));
      }
    }
  }
  // übrige geschlossene Schleifen (ohne Knoten)
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x < w; x++) {
      if (hasH(x, y) && !visH[y * w + x]) chains.push(Object.assign(trace(x, y, 0), { loop: true }));
    }
  }

  // Ketten vereinfachen + als Pfadstücke vorbereiten
  const tol = o.tol ?? 0.6, tolS = o.tolStraight ?? 0.9, passes = o.passes ?? 2;
  const P = (p) => fmt(p[0] * scale, dp) + ' ' + fmt(p[1] * scale, dp);
  const out = [];
  for (const c of chains) {
    const mode = modeOf(c.a, c.b);
    const closed = !!c.loop;
    let q;
    if (mode === 'straight') q = simplifyChain(c.pts, { tol: tolS, passes: 3, closed });
    else q = simplifyChain(c.pts, { tol, passes, closed });
    // Punkte runden (einmal, gemeinsam für beide Seiten)
    const r = q.map((p) => [Math.round(p[0] * scale * 10 ** dp) / 10 ** dp, Math.round(p[1] * scale * 10 ** dp) / 10 ** dp]);
    out.push({ pts: r, a: c.a, b: c.b, mode, closed, start: c.pts[0], end: c.pts[c.pts.length - 1] });
  }

  const seg = (c, reverse) => {
    const p = reverse ? c.pts.slice().reverse() : c.pts;
    const S = (v) => fmt(v[0], dp) + ' ' + fmt(v[1], dp);
    const mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
    if (c.closed) {
      // zyklischer B-Spline über p[0..m-1] (p[m] == p[0])
      const m = p.length - 1;
      if (m < 3 || c.mode === 'straight') return 'M' + p.slice(0, m).map(S).join('L') + 'Z';
      let s = 'M' + S(mid(p[m - 1], p[0]));
      for (let i = 0; i < m; i++) s += 'Q' + S(p[i]) + ' ' + S(mid(p[i], p[(i + 1) % m]));
      return s + 'Z';
    }
    const m = p.length - 1;
    if (m === 1 || c.mode === 'straight') return p.slice(1).map((v) => 'L' + S(v)).join('');
    let s = 'L' + S(mid(p[0], p[1]));
    for (let i = 1; i < m; i++) s += 'Q' + S(p[i]) + ' ' + S(mid(p[i], p[i + 1]));
    return s + 'L' + S(p[m]);
  };

  // Ringe je Fläche zusammensetzen (Fläche links der orientierten Kette)
  const byFace = Array.from({ length: F }, () => []);
  out.forEach((c, i) => {
    if (c.a >= 0) byFace[c.a].push({ i, rev: false });
    if (c.b >= 0) byFace[c.b].push({ i, rev: true });
  });
  const key = (p) => p[1] * W1 + p[0];
  const paths = new Array(F);
  const ringCount = new Int32Array(F);
  for (let f = 0; f < F; f++) {
    const list = byFace[f];
    const startMap = new Map();
    for (const e of list) {
      const c = out[e.i];
      if (c.closed) continue;
      const s = key(e.rev ? c.end : c.start);
      if (!startMap.has(s)) startMap.set(s, []);
      startMap.get(s).push(e);
    }
    let d = '';
    let rings = 0;
    for (const e of list) {
      const c = out[e.i];
      if (c.closed) {
        d += seg(c, e.rev);
        rings++;
        continue;
      }
      if (e.used) continue;
      const startKey = key(e.rev ? c.end : c.start);
      const first = e.rev ? c.pts[c.pts.length - 1] : c.pts[0];
      let s = 'M' + fmt(first[0], dp) + ' ' + fmt(first[1], dp);
      let cur = e;
      let guard = 0;
      while (cur && guard++ < 100000) {
        cur.used = true;
        const cc = out[cur.i];
        s += seg(cc, cur.rev);
        const endKey = key(cur.rev ? cc.start : cc.end);
        if (endKey === startKey) break;
        const cand = startMap.get(endKey) || [];
        cur = cand.find((x) => !x.used) || null;
      }
      d += s + 'Z';
      rings++;
    }
    paths[f] = d;
    ringCount[f] = rings;
  }
  return { paths, ringCount, chains: out };
}

/** Pfad aller Ketten (für Bleilinien u.ä.), optional gefiltert. */
export function chainsPath(chains, filter = () => true, dp = 1) {
  const S = (v) => fmt(v[0], dp) + ' ' + fmt(v[1], dp);
  const mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
  let d = '';
  for (const c of chains) {
    if (!filter(c)) continue;
    const p = c.pts;
    const m = p.length - 1;
    if (c.closed) {
      if (m < 3 || c.mode === 'straight') { d += 'M' + p.slice(0, m).map(S).join('L') + 'Z'; continue; }
      d += 'M' + S(mid(p[m - 1], p[0]));
      for (let i = 0; i < m; i++) d += 'Q' + S(p[i]) + ' ' + S(mid(p[i], p[(i + 1) % m]));
      d += 'Z';
      continue;
    }
    d += 'M' + S(p[0]);
    if (m === 1 || c.mode === 'straight') { d += p.slice(1).map((v) => 'L' + S(v)).join(''); continue; }
    d += 'L' + S(mid(p[0], p[1]));
    for (let i = 1; i < m; i++) d += 'Q' + S(p[i]) + ' ' + S(mid(p[i], p[i + 1]));
    d += 'L' + S(p[m]);
  }
  return d;
}
