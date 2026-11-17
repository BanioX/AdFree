// Farbenzauber – Art Team A: geometry + puzzle helpers for hand-built vector pictures.
// Every picture script builds a Pic, adds shapes in painter's order (later = on top)
// and saves it as an ES module `export default { ...Puzzle }`.

import { writeFileSync } from 'node:fs';

/* ------------------------------------------------------------------ numbers */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const r1 = (v) => Math.round(v * 10) / 10;
const f = (v) => {
  const s = r1(v);
  return Object.is(s, -0) || s === 0 ? '0' : String(s);
};
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Small deterministic PRNG (mulberry32). */
export function rng(seed = 1) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

/* ------------------------------------------------------------------ points */

export const P = (x, y) => [x, y];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const mid = (a, b, t = 0.5) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const polarPt = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];

/** Rotate point p around center c by angle a (radians). Keeps extra flags. */
export function rot(p, a, c = [0, 0]) {
  const s = Math.sin(a), k = Math.cos(a);
  const x = p[0] - c[0], y = p[1] - c[1];
  const out = [c[0] + x * k - y * s, c[1] + x * s + y * k];
  if (p.length > 2) out.push(...p.slice(2));
  return out;
}

/**
 * Transform a list of points: scale (sx, sy), then rotate (r), then translate (x, y).
 * Flags (3rd element, e.g. 'c' for corner) are preserved.
 */
export function tf(pts, { x = 0, y = 0, r = 0, s = 1, sx = s, sy = s } = {}) {
  const sn = Math.sin(r), cs = Math.cos(r);
  return pts.map((p) => {
    const px = p[0] * sx, py = p[1] * sy;
    const out = [x + px * cs - py * sn, y + px * sn + py * cs];
    if (p.length > 2) out.push(...p.slice(2));
    return out;
  });
}

/** Mirror points horizontally around x = cx (reverses order so winding stays sane). */
export const mirrorX = (pts, cx) => pts.map((p) => [2 * cx - p[0], p[1], ...p.slice(2)]).reverse();
export const mirrorY = (pts, cy) => pts.map((p) => [p[0], 2 * cy - p[1], ...p.slice(2)]).reverse();

/* ------------------------------------------------------------------ paths */

/** Straight polygon. */
export function poly(pts, closed = true) {
  return 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + (closed ? 'Z' : '');
}

/**
 * Catmull-Rom spline through points, emitted as cubic Béziers.
 * A point with a 3rd element 'c' is a sharp corner. `k` scales the tangents (1 = standard).
 */
export function smooth(pts, { closed = true, k = 1 } = {}) {
  const n = pts.length;
  if (n < 2) return '';
  const get = (i) => {
    if (closed) return pts[(i + n) % n];
    return pts[clamp(i, 0, n - 1)];
  };
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const k1 = p1[2] === 'c' ? 0 : (p1[3] ?? k);
    const k2 = p2[2] === 'c' ? 0 : (p2[3] ?? k);
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * k1, p1[1] + ((p2[1] - p0[1]) / 6) * k1];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * k2, p2[1] - ((p3[1] - p1[1]) / 6) * k2];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}

/** Sample a Catmull-Rom spline into a dense polyline (useful for building bands/offsets). */
export function sampleSmooth(pts, { closed = false, k = 1, steps = 12 } = {}) {
  const n = pts.length;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const out = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const k1 = p1[2] === 'c' ? 0 : k, k2 = p2[2] === 'c' ? 0 : k;
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * k1, p1[1] + ((p2[1] - p0[1]) / 6) * k1];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * k2, p2[1] - ((p3[1] - p1[1]) / 6) * k2];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, u = 1 - t;
      out.push([
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1].slice(0, 2));
  return out;
}

/** Join several path strings into one (compound path). */
export const join = (...ds) => ds.flat().join('');

/** Signed area (shoelace); > 0 means clockwise on screen (y down). */
export function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
/** Return points oriented clockwise (cw=true) or counter-clockwise. */
export function orient(pts, cw = true) {
  return (signedArea(pts) > 0) === cw ? pts : [...pts].reverse();
}
/** Union of several smooth outlines (same winding, nonzero rule). */
export function unionSmooth(...lists) {
  return lists.map((pts) => smooth(orient(pts))).join('');
}

/** Circle as two arcs. `ccw` flips the winding (for holes with nonzero rule). */
export function circle(cx, cy, r, ccw = false) {
  const sw = ccw ? 0 : 1;
  return `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 ${sw} ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 ${sw} ${f(cx - r)} ${f(cy)}Z`;
}

/** Ellipse points (for smooth()). */
export function ellipsePts(cx, cy, rx, ry, n = 8, a0 = 0, rotA = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    out.push(rot([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry], rotA, [cx, cy]));
  }
  return out;
}

export function ellipse(cx, cy, rx, ry, rotA = 0) {
  if (!rotA) {
    return `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 1 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 1 ${f(cx - rx)} ${f(cy)}Z`;
  }
  const deg = rotA / DEG;
  const a = rot([cx - rx, cy], rotA, [cx, cy]), b = rot([cx + rx, cy], rotA, [cx, cy]);
  return `M${f(a[0])} ${f(a[1])}A${f(rx)} ${f(ry)} ${f(deg)} 1 1 ${f(b[0])} ${f(b[1])}A${f(rx)} ${f(ry)} ${f(deg)} 1 1 ${f(a[0])} ${f(a[1])}Z`;
}

/** Annulus (works with nonzero: inner circle wound the other way). */
export const ring = (cx, cy, r1_, r2_) => circle(cx, cy, Math.max(r1_, r2_)) + circle(cx, cy, Math.min(r1_, r2_), true);

export const rect = (x, y, w, h) => `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;

export function rrect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

/** Annular sector from angle a1 to a2 (radians, clockwise in screen space). */
export function arcBand(cx, cy, rIn, rOut, a1, a2) {
  const large = Math.abs(a2 - a1) > Math.PI ? 1 : 0;
  const o1 = polarPt(cx, cy, rOut, a1), o2 = polarPt(cx, cy, rOut, a2);
  if (rIn <= 0) {
    return `M${f(cx)} ${f(cy)}L${f(o1[0])} ${f(o1[1])}A${f(rOut)} ${f(rOut)} 0 ${large} 1 ${f(o2[0])} ${f(o2[1])}Z`;
  }
  const i2 = polarPt(cx, cy, rIn, a2), i1 = polarPt(cx, cy, rIn, a1);
  return `M${f(o1[0])} ${f(o1[1])}A${f(rOut)} ${f(rOut)} 0 ${large} 1 ${f(o2[0])} ${f(o2[1])}L${f(i2[0])} ${f(i2[1])}A${f(rIn)} ${f(rIn)} 0 ${large} 0 ${f(i1[0])} ${f(i1[1])}Z`;
}

/** Straight ray/wedge from center (polygon), r large enough to leave the canvas. */
export function wedge(cx, cy, r, a1, a2) {
  const pts = [[cx, cy]];
  const steps = Math.max(2, Math.ceil(Math.abs(a2 - a1) / (10 * DEG)));
  for (let i = 0; i <= steps; i++) pts.push(polarPt(cx, cy, r, lerp(a1, a2, i / steps)));
  return poly(pts);
}

/* ------------------------------------------------------------------ organic shapes */

/**
 * Petal outline in local coords: base at (0,0), tip at (len, 0) along +x.
 * opts.wAt: position (0..1) of max width; opts.tip: 'round' | 'point' | 'notch' | 'flat';
 * opts.baseW: half-width at the base (0 = pointed base).
 */
export function petalPts(len, w, { wAt = 0.55, tip = 'round', baseW = 0, shoulder = 0.75 } = {}) {
  const h = w / 2;
  const right = [];
  if (baseW > 0) right.push([0, baseW, 'c']);
  right.push([len * wAt * 0.45, h * 0.8]);
  right.push([len * wAt, h]);
  right.push([len * (wAt + (1 - wAt) * 0.6), h * shoulder]);
  let tipPts;
  if (tip === 'point') tipPts = [[len, 0, 'c']];
  else if (tip === 'notch') tipPts = [[len * 0.985, h * 0.35], [len * 0.9, 0, 'c'], [len * 0.985, -h * 0.35]];
  else if (tip === 'flat') tipPts = [[len * 0.97, h * 0.45], [len, 0], [len * 0.97, -h * 0.45]];
  else tipPts = [[len * 0.95, h * 0.38], [len, 0], [len * 0.95, -h * 0.38]];
  const left = right.map((p) => [p[0], -p[1], ...p.slice(2)]).reverse();
  const base = baseW > 0 ? [] : [[0, 0, 'c']];
  return [...base, ...right, ...tipPts, ...left];
}

export function petal(x, y, ang, len, w, opts = {}) {
  return smooth(tf(petalPts(len, w, opts), { x, y, r: ang }), { k: opts.k ?? 1 });
}

/**
 * "Turned-over edge" band along the tip of a local outline (base at origin, pointing +x):
 * the part of the outline with x >= from*len, closed by an inner curve pushed back by depth*len.
 * Returns local points ready for tf()/smooth().
 */
export function capPts(localPts, len, { from = 0.62, depth = 0.16, every = 3, squeeze = 0.06, pow = 0.8 } = {}) {
  const s = sampleSmooth(localPts, { closed: true, steps: 12 });
  const x0 = from * len;
  const inside = s.map((p) => p[0] >= x0);
  // rotate so we start right after an "outside" point
  let start = inside.findIndex((v, i) => v && !inside[(i - 1 + s.length) % s.length]);
  if (start < 0) start = 0;
  const run = [];
  for (let i = 0; i < s.length; i++) {
    const j = (start + i) % s.length;
    if (!inside[j]) break;
    run.push(s[j]);
  }
  const outer = run.filter((_, i) => i % every === 0 || i === run.length - 1);
  const xmax = Math.max(...outer.map((p) => p[0]));
  const prof = (x) => Math.pow(clamp((x - x0) / (xmax - x0), 0, 1), pow);
  const inner = outer.slice(1, -1).map(([x, y]) => [x - depth * len * prof(x), y * (1 - squeeze * prof(x))]).reverse();
  const o = outer.map((p, i) => (i === 0 || i === outer.length - 1 ? [p[0], p[1], 'c'] : p));
  return [...o, ...inner];
}

/**
 * Leaf: base at (0,0), tip at (len,0); `bend` curves the midrib (fraction of len, + = toward +y).
 * Returns points of the outline (pointed base + pointed tip).
 */
export function leafPts(len, w, { bend = 0, wAt = 0.45, n = 3, tipK = 0 } = {}) {
  const h = w / 2;
  const mb = (t) => bend * len * 4 * t * (1 - t); // midrib offset
  const prof = (t) => Math.sin(Math.PI * Math.pow(t, Math.log(0.5) / Math.log(wAt))); // width profile
  const right = [], left = [];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    right.push([t * len, mb(t) + h * prof(t)]);
    left.push([t * len, mb(t) - h * prof(t)]);
  }
  return [[0, 0, 'c'], ...right, [len, 0, tipK ? undefined : 'c'].filter((v) => v !== undefined), ...left.reverse()];
}

export function leaf(x, y, ang, len, w, opts = {}) {
  return smooth(tf(leafPts(len, w, opts), { x, y, r: ang }));
}

/** Leaf split along its (curved) midrib into two halves: returns [halfA(+y side), halfB(-y side)]. */
export function leafHalves(x, y, ang, len, w, opts = {}) {
  const { bend = 0, wAt = 0.45, n = 3 } = opts;
  const h = w / 2;
  const mb = (t) => bend * len * 4 * t * (1 - t);
  const prof = (t) => Math.sin(Math.PI * Math.pow(t, Math.log(0.5) / Math.log(wAt)));
  const side = [], other = [], rib = [];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    side.push([t * len, mb(t) + h * prof(t)]);
    other.push([t * len, mb(t) - h * prof(t)]);
  }
  for (let i = 1; i <= 7; i++) {
    const t = i / 8;
    rib.push([t * len, mb(t)]);
  }
  const ribS = sampleSmooth([[0, 0], ...rib, [len, 0]], { steps: 4 });
  const outA = sampleSmooth([[0, 0, 'c'], ...side, [len, 0, 'c']], { steps: 8 });
  const outB = sampleSmooth([[0, 0, 'c'], ...other, [len, 0, 'c']], { steps: 8 });
  const A = [...outA, ...ribS.slice(1, -1).reverse()];
  const B = [...outB, ...ribS.slice(1, -1).reverse()];
  return [poly(tf(A, { x, y, r: ang })), poly(tf(B, { x, y, r: ang }))];
}

/** Organic blob: n radial points with seeded jitter. */
export function blobPts(cx, cy, r, { n = 8, amp = 0.15, seed = 1, sx = 1, sy = 1, a0 = 0 } = {}) {
  const R = rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const rr = r * (1 + (R() * 2 - 1) * amp);
    out.push([cx + Math.cos(a) * rr * sx, cy + Math.sin(a) * rr * sy]);
  }
  return out;
}
export const blob = (cx, cy, r, opts) => smooth(blobPts(cx, cy, r, opts));

/** Star polygon (optionally rounded with `round` 0..1). */
export function starPts(cx, cy, ro, ri, n = 5, a0 = -Math.PI / 2) {
  const out = [];
  for (let i = 0; i < n * 2; i++) {
    const a = a0 + (i / (n * 2)) * TAU;
    const r = i % 2 ? ri : ro;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, i % 2 ? undefined : 'c'].filter((v) => v !== undefined));
  }
  return out;
}
export const star = (cx, cy, ro, ri, n, a0, smoothIt = false) =>
  smoothIt ? smooth(starPts(cx, cy, ro, ri, n, a0), { k: 0.6 }) : poly(starPts(cx, cy, ro, ri, n, a0));

/** Points of a wave line from x0 to x1 at height y. */
export function wavePts(x0, x1, y, amp, period, phase = 0, step = null) {
  const out = [];
  const n = Math.max(2, Math.round((x1 - x0) / (step ?? period / 4)));
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    out.push([x, y + Math.sin(((x - x0) / period) * TAU + phase) * amp]);
  }
  return out;
}

/** Closed region between a top polyline (left→right) and a bottom polyline (left→right), both smoothed. */
export function band(top, bottom, { k = 1 } = {}) {
  const t = sampleSmooth(top, { k, steps: 8 });
  const b = sampleSmooth(bottom, { k, steps: 8 }).reverse();
  return poly([...t, ...b]);
}

/** Dense polygon points of the region between a top and a bottom polyline (both left→right). */
export function bandPts(top, bottom, { k = 1, steps = 6 } = {}) {
  const t = sampleSmooth(top, { k, steps });
  const b = sampleSmooth(bottom, { k, steps }).reverse();
  return [...t, ...b];
}

/**
 * Sutherland–Hodgman clip of polygon `pts` against the half-plane on the RIGHT of the directed
 * line a→b (screen coords, y down: for a line pointing up, right = larger x). keepLeft flips it.
 */
export function clipHalf(pts, a, b, keepLeft = false) {
  const side = (p) => {
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    return keepLeft ? -c : c;
  };
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const sp = side(p), sq = side(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** Polygon area (absolute). */
export const polyArea = (pts) => Math.abs(signedArea(pts));

/**
 * Split a polygon into pieces by roughly vertical cut lines (each [bottomPoint, topPoint]),
 * sorted left→right by their x at the polygon. Returns pieces with area > minArea.
 */
export function splitByLines(pts, lines, minArea = 50) {
  const pieces = [];
  for (let i = 0; i <= lines.length; i++) {
    let p = pts;
    if (i > 0) p = clipHalf(p, lines[i - 1][0], lines[i - 1][1]);
    if (i < lines.length && p.length) p = clipHalf(p, lines[i][0], lines[i][1], true);
    if (p.length >= 3 && polyArea(p) > minArea) pieces.push(p);
  }
  return pieces;
}

/** Region from a smooth top edge down to a straight y (e.g. hills, waves to the bottom). */
export function fillBelow(top, yBottom, { k = 1 } = {}) {
  const t = sampleSmooth(top, { k, steps: 8 });
  return poly([...t, [t[t.length - 1][0], yBottom], [t[0][0], yBottom]]);
}
export function fillAbove(bottom, yTop, { k = 1 } = {}) {
  const t = sampleSmooth(bottom, { k, steps: 8 });
  return poly([...t, [t[t.length - 1][0], yTop], [t[0][0], yTop]]);
}

/** Crescent: circle (cx,cy,r) minus circle offset by (dx,dy) with radius r2, as one polygon. */
export function crescentPts(cx, cy, r, dx, dy, r2 = r, n = 64) {
  // sample outer circle points not inside the cutting circle, then inner arc points inside the outer
  const ox = cx + dx, oy = cy + dy;
  const outer = [], inner = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    if (Math.hypot(p[0] - ox, p[1] - oy) >= r2) outer.push([a, p]);
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const p = [ox + Math.cos(a) * r2, oy + Math.sin(a) * r2];
    if (Math.hypot(p[0] - cx, p[1] - cy) <= r) inner.push([a, p]);
  }
  // order: outer arc contiguous, then inner arc reversed
  const contiguous = (arr) => {
    if (!arr.length) return arr;
    let cut = 0;
    for (let i = 1; i < arr.length; i++) if (arr[i][0] - arr[i - 1][0] > (TAU / n) * 1.5) cut = i;
    return [...arr.slice(cut), ...arr.slice(0, cut)].map((e) => e[1]);
  };
  return [...contiguous(outer), ...contiguous(inner).reverse()];
}
export const crescent = (...a) => poly(crescentPts(...a));

/**
 * Tapered spiral band around (cx,cy): outer edge radius goes r0 -> r1 while the angle goes a1 -> a2,
 * thickness swells to `thick` in the middle and tapers to 0 at both ends (like a curled petal).
 */
export function swirlPts(cx, cy, r0, r1, thick, a1, a2, { n = 14, pow = 0.75, endThick = 0 } = {}) {
  const outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = lerp(a1, a2, t), r = lerp(r0, r1, t);
    outer.push(polarPt(cx, cy, r, a));
    const th = Math.max(endThick * t, thick * Math.pow(Math.sin(Math.PI * t), pow));
    inner.push(polarPt(cx, cy, r - th, a));
  }
  outer[0].push('c');
  outer[n].push('c');
  return [...outer, ...inner.slice(1, -1).reverse()];
}

/** Heart outline centered at (cx,cy) with size s. */
export function heartPts(cx, cy, s) {
  return tf(
    [[0, 0.35, 'c'], [0.25, 0.05], [0.5, -0.25], [0.48, -0.55], [0.25, -0.68], [0, -0.48, 'c'], [-0.25, -0.68], [-0.48, -0.55], [-0.5, -0.25], [-0.25, 0.05]],
    { x: cx, y: cy, s },
  );
}

/* ------------------------------------------------------------------ puzzle builder */

export class Pic {
  constructor({ id, title, category, width = 1000, height = 1000 }) {
    Object.assign(this, { id, title, category, width, height });
    this.colors = new Map(); // name -> hex
    this.shapes = [];
    this.lines = [];
  }
  /** Define palette entries: pal({ sky: '#...', ... }) – order = number order (before pruning). */
  pal(obj) {
    for (const [k, v] of Object.entries(obj)) this.colors.set(k, v);
    return this;
  }
  /** Add a colorable shape. color = palette name. */
  add(d, color, { evenodd = false } = {}) {
    if (!this.colors.has(color)) throw new Error(`${this.id}: unknown color "${color}"`);
    if (!d) throw new Error(`${this.id}: empty path for ${color}`);
    this.shapes.push({ d, color, evenodd });
    return this;
  }
  /** Decorative non-colorable line (use sparingly). */
  line(d, w = 3, color = '#2b2420') {
    this.lines.push({ d, w, color });
    return this;
  }
  build() {
    const used = [...this.colors.keys()].filter((k) => this.shapes.some((s) => s.color === k));
    const idx = new Map(used.map((k, i) => [k, i]));
    const out = {
      id: this.id,
      title: this.title,
      category: this.category,
      width: this.width,
      height: this.height,
      palette: used.map((k) => this.colors.get(k)),
      shapes: this.shapes.map((s) => (s.evenodd ? { d: s.d, c: idx.get(s.color), r: 'evenodd' } : { d: s.d, c: idx.get(s.color) })),
    };
    if (this.lines.length) out.lines = this.lines;
    return out;
  }
}

/** Serialize a puzzle as a compact ES module (one shape per line). */
export function toModule(pz) {
  const head = { ...pz };
  delete head.shapes;
  delete head.lines;
  const lines = [];
  lines.push('// Farbenzauber – Art Team A. Generated by src/build.mjs – edit the generator, not this file.');
  lines.push('export default {');
  for (const [k, v] of Object.entries(head)) lines.push(`  ${k}: ${JSON.stringify(v)},`);
  lines.push('  shapes: [');
  for (const s of pz.shapes) lines.push(`    ${JSON.stringify(s)},`);
  lines.push('  ],');
  if (pz.lines) {
    lines.push('  lines: [');
    for (const l of pz.lines) lines.push(`    ${JSON.stringify(l)},`);
    lines.push('  ],');
  }
  lines.push('};');
  return lines.join('\n') + '\n';
}

export function save(pz, file) {
  writeFileSync(file, toModule(pz));
}
