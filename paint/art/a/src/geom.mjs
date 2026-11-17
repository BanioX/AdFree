// Boolean operations on polygons via signed distance fields + marching squares.
// Shapes are arrays of closed polygons (each an array of [x, y]); nonzero winding.
// Results are clean outlines (no internal lines), which matters for the colouring view.

import { sampleSmooth, poly, ellipsePts } from './lib.mjs';

/** Signed distance from (px,py) to a multi-polygon shape (negative inside, nonzero rule). */
function sdShape(px, py, shape) {
  // cheap lower bound outside the bounding box (exact values are only needed near the contour)
  const bb = shape.bb || (shape.bb = bboxOf([shape]));
  const ox = Math.max(bb[0] - px, px - bb[2], 0), oy = Math.max(bb[1] - py, py - bb[3], 0);
  if (ox > 3 || oy > 3) return Math.hypot(ox, oy);
  let d2 = Infinity, wn = 0;
  for (const pg of shape) {
    const n = pg.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = pg[j][0], ay = pg[j][1], bx = pg[i][0], by = pg[i][1];
      const ex = bx - ax, ey = by - ay, wx = px - ax, wy = py - ay;
      const L = ex * ex + ey * ey;
      let t = L ? (wx * ex + wy * ey) / L : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = wx - ex * t, dy = wy - ey * t;
      const dd = dx * dx + dy * dy;
      if (dd < d2) d2 = dd;
      const cr = ex * wy - ey * wx;
      if (ay <= py) {
        if (by > py && cr > 0) wn++;
      } else if (by <= py && cr < 0) wn--;
    }
  }
  const d = Math.sqrt(d2);
  return wn !== 0 ? -d : d;
}

function bboxOf(shapes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) for (const pg of s) for (const [x, y] of pg) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/** Ramer–Douglas–Peucker for closed loops. */
function rdp(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  const rec = (a, b) => {
    let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const ex = bx - ax, ey = by - ay, L = Math.hypot(ex, ey) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(ex * (pts[i][1] - ay) - ey * (pts[i][0] - ax)) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi > 0) { keep[mi] = 1; rec(a, mi); rec(mi, b); }
  };
  // split loop at the point farthest from pts[0]
  let far = 0, fd = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > fd) { fd = d; far = i; }
  }
  keep[0] = keep[far] = 1;
  const ext = [...pts, pts[0]];
  const rec2 = (a, b) => {
    let md = 0, mi = -1;
    const [ax, ay] = ext[a], [bx, by] = ext[b];
    const ex = bx - ax, ey = by - ay, L = Math.hypot(ex, ey) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(ex * (ext[i][1] - ay) - ey * (ext[i][0] - ax)) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi > 0) { if (mi < pts.length) keep[mi] = 1; rec2(a, mi); rec2(mi, b); }
  };
  rec(0, far);
  rec2(far, pts.length);
  return pts.filter((_, i) => keep[i]);
}

/**
 * Trace the zero contour of sdf over bbox with grid step res.
 * Returns loops oriented so that the inside is on the right when walking (clockwise on screen).
 */
export function contour(sdf, [x0, y0, x1, y1], { res = 1, eps = 0.35 } = {}) {
  const m = 2 * res;
  x0 = Math.floor(x0 - m); y0 = Math.floor(y0 - m); x1 = Math.ceil(x1 + m); y1 = Math.ceil(y1 + m);
  const W = Math.ceil((x1 - x0) / res) + 1, H = Math.ceil((y1 - y0) / res) + 1;
  const v = new Float64Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let s = sdf(x0 + i * res, y0 + j * res);
    if (s === 0) s = 1e-9;
    v[j * W + i] = s;
  }
  // edges: key -> point; segments from marching squares (inside = negative)
  const segs = new Map(); // startKey -> {to: endKey}
  const pts = new Map();
  const ekey = (i, j, dir) => (j * W + i) * 2 + dir; // dir 0 = horizontal edge to (i+1,j), 1 = vertical to (i,j+1)
  const epoint = (i, j, dir) => {
    const k = ekey(i, j, dir);
    if (!pts.has(k)) {
      const a = v[j * W + i], b = dir ? v[(j + 1) * W + i] : v[j * W + i + 1];
      const t = a / (a - b);
      pts.set(k, dir ? [x0 + i * res, y0 + (j + t) * res] : [x0 + (i + t) * res, y0 + j * res]);
    }
    return k;
  };
  const add = (a, b) => segs.set(a, b);
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
    const tl = v[j * W + i] < 0, tr = v[j * W + i + 1] < 0, br = v[(j + 1) * W + i + 1] < 0, bl = v[(j + 1) * W + i] < 0;
    const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
    if (c === 0 || c === 15) continue;
    const T = () => epoint(i, j, 0), B = () => epoint(i, j + 1, 0), L = () => epoint(i, j, 1), R = () => epoint(i + 1, j, 1);
    // orientation: walk with inside on the right (screen coords, y down) => clockwise outer loops
    switch (c) {
      case 1: add(L(), B()); break;
      case 2: add(B(), R()); break;
      case 3: add(L(), R()); break;
      case 4: add(R(), T()); break;
      case 5: {
        const ctr = (v[j * W + i] + v[j * W + i + 1] + v[(j + 1) * W + i + 1] + v[(j + 1) * W + i]) / 4;
        if (ctr < 0) { add(L(), T()); add(R(), B()); } else { add(L(), B()); add(R(), T()); }
        break;
      }
      case 6: add(B(), T()); break;
      case 7: add(L(), T()); break;
      case 8: add(T(), L()); break;
      case 9: add(T(), B()); break;
      case 10: {
        const ctr = (v[j * W + i] + v[j * W + i + 1] + v[(j + 1) * W + i + 1] + v[(j + 1) * W + i]) / 4;
        if (ctr < 0) { add(T(), R()); add(B(), L()); } else { add(T(), L()); add(B(), R()); }
        break;
      }
      case 11: add(T(), R()); break;
      case 12: add(R(), L()); break;
      case 13: add(R(), B()); break;
      case 14: add(B(), L()); break;
    }
  }
  const loops = [];
  const used = new Set();
  for (const start of segs.keys()) {
    if (used.has(start)) continue;
    const loop = [];
    let k = start;
    while (k !== undefined && !used.has(k)) {
      used.add(k);
      loop.push(pts.get(k));
      k = segs.get(k);
    }
    if (loop.length > 2) loops.push(rdp(loop, eps));
  }
  return loops;
}

/* ------------------------------------------------------------------ public API */

const asShape = (s) => (Array.isArray(s[0][0]) ? s : [s]); // polygon -> [polygon]

/** Union of shapes/polygons. */
export function union(...shapes) {
  const S = shapes.map(asShape);
  return contour((x, y) => {
    let d = Infinity;
    for (const s of S) {
      d = Math.min(d, sdShape(x, y, s));
      if (d < -3) break;
    }
    return d;
  }, bboxOf(S));
}

/** Intersection of shapes. */
export function intersect(...shapes) {
  const S = shapes.map(asShape);
  const bbs = S.map((s) => bboxOf([s]));
  const bb = [Math.max(...bbs.map((b) => b[0])), Math.max(...bbs.map((b) => b[1])), Math.min(...bbs.map((b) => b[2])), Math.min(...bbs.map((b) => b[3]))];
  if (bb[0] >= bb[2] || bb[1] >= bb[3]) return [];
  return contour((x, y) => {
    let d = -Infinity;
    for (const s of S) {
      d = Math.max(d, sdShape(x, y, s));
      if (d > 3) break;
    }
    return d;
  }, bb);
}

/** a minus all of `cut` shapes. */
export function subtract(a, ...cut) {
  const A = asShape(a), C = cut.map(asShape);
  return contour((x, y) => {
    let d = sdShape(x, y, A);
    if (d > 3) return d;
    for (const c of C) {
      d = Math.max(d, -sdShape(x, y, c));
      if (d > 3) break;
    }
    return d;
  }, bboxOf([A]));
}

/** Grow (r > 0) or shrink (r < 0) a shape by r. */
export function offset(a, r) {
  const A = asShape(a);
  const bb = bboxOf([A]);
  return contour((x, y) => sdShape(x, y, A) - r, [bb[0] - Math.max(0, r), bb[1] - Math.max(0, r), bb[2] + Math.max(0, r), bb[3] + Math.max(0, r)]);
}

/** Polygon helpers. */
export const smoothPoly = (pts, k = 1, steps = 10) => sampleSmooth(pts, { closed: true, k, steps });
export const circlePoly = (cx, cy, r, n = 64) => ellipsePts(cx, cy, r, r, n);
export const ellipsePoly = (cx, cy, rx, ry, n = 64, rotA = 0) => ellipsePts(cx, cy, rx, ry, n, 0, rotA);

/** Path string for a list of loops (a shape). */
export const shapePath = (loops) => loops.map((l) => poly(l)).join('');

/** Keep only loops whose |area| exceeds minArea (drops crumbs). */
export function dropCrumbs(loops, minArea = 30) {
  return loops.filter((l) => {
    let a = 0;
    for (let i = 0; i < l.length; i++) {
      const p = l[i], q = l[(i + 1) % l.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a / 2) > minArea;
  });
}
