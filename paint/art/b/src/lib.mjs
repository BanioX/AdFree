// Gemeinsame Zeichen-Helfer für die Bilder von Team B.
// Pfade werden als Liste von Befehlen gehalten (M, L, C, Q, Z), damit sie sich
// verschieben, drehen, skalieren und spiegeln lassen. Ausgabe mit 1 Nachkommastelle.

import { writeFileSync } from 'node:fs';

export const K = 0.5522847498; // Kreis-Näherung mit kubischen Bézierkurven
export const rad = (deg) => (deg * Math.PI) / 180;
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpPt = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function fmt(n) {
  let v = Math.round(n * 10) / 10;
  if (Object.is(v, -0)) v = 0;
  return String(v);
}

/** Deterministischer Zufall (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

export class Path {
  constructor(cmds = []) {
    this.cmds = cmds;
  }
  static of(...parts) {
    const p = new Path();
    for (const q of parts.flat()) p.cmds.push(...q.cmds.map((c) => c.slice()));
    return p;
  }
  concat(...others) {
    return Path.of(this, ...others);
  }
  mapPts(fn) {
    return new Path(
      this.cmds.map((c) => {
        const out = [c[0]];
        for (let i = 1; i < c.length; i += 2) {
          const [x, y] = fn(c[i], c[i + 1]);
          out.push(x, y);
        }
        return out;
      }),
    );
  }
  translate(dx, dy) {
    return this.mapPts((x, y) => [x + dx, y + dy]);
  }
  scale(sx, sy = sx, cx = 0, cy = 0) {
    const p = this.mapPts((x, y) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
    return sx * sy < 0 ? p.reverse() : p;
  }
  rotate(deg, cx = 0, cy = 0) {
    const a = rad(deg);
    const c = Math.cos(a);
    const s = Math.sin(a);
    return this.mapPts((x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
  }
  /** Spiegeln an der senkrechten Achse x = cx (Umlaufsinn bleibt erhalten). */
  mirrorX(cx) {
    return this.mapPts((x, y) => [2 * cx - x, y]).reverse();
  }
  mirrorY(cy) {
    return this.mapPts((x, y) => [x, 2 * cy - y]).reverse();
  }
  /** Umlaufsinn umkehren (für Löcher mit nonzero). */
  reverse() {
    const subs = [];
    let cur = null;
    for (const c of this.cmds) {
      if (c[0] === 'M') {
        cur = { start: [c[1], c[2]], segs: [], closed: false };
        subs.push(cur);
      } else if (c[0] === 'Z') {
        cur.closed = true;
      } else {
        cur.segs.push(c);
      }
    }
    const out = [];
    for (const s of subs) {
      const segs = s.segs.slice();
      const last = segs.length ? segs[segs.length - 1] : null;
      const lastEnd = last ? [last[last.length - 2], last[last.length - 1]] : s.start;
      if (s.closed && (Math.abs(lastEnd[0] - s.start[0]) > 1e-6 || Math.abs(lastEnd[1] - s.start[1]) > 1e-6)) {
        segs.push(['L', s.start[0], s.start[1]]);
      }
      const ends = [s.start, ...segs.map((g) => [g[g.length - 2], g[g.length - 1]])];
      out.push(['M', ...ends[ends.length - 1]]);
      for (let i = segs.length - 1; i >= 0; i--) {
        const g = segs[i];
        const to = ends[i];
        if (g[0] === 'L') out.push(['L', ...to]);
        else if (g[0] === 'Q') out.push(['Q', g[1], g[2], ...to]);
        else if (g[0] === 'C') out.push(['C', g[3], g[4], g[1], g[2], ...to]);
      }
      if (s.closed) out.push(['Z']);
    }
    return new Path(out);
  }
  bbox() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.cmds) {
      for (let i = 1; i < c.length; i += 2) {
        x0 = Math.min(x0, c[i]); x1 = Math.max(x1, c[i]);
        y0 = Math.min(y0, c[i + 1]); y1 = Math.max(y1, c[i + 1]);
      }
    }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  toString() {
    return this.cmds.map((c) => c[0] + c.slice(1).map(fmt).join(' ')).join('');
  }
}

/* ---------- Grundformen ---------- */

export function poly(pts) {
  const cmds = [['M', pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) cmds.push(['L', pts[i][0], pts[i][1]]);
  cmds.push(['Z']);
  return new Path(cmds);
}

export function polyline(pts) {
  const cmds = [['M', pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) cmds.push(['L', pts[i][0], pts[i][1]]);
  return new Path(cmds);
}

export function rect(x, y, w, h, r = 0) {
  const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return r ? roundPoly(pts, r) : poly(pts);
}

export function ellipse(cx, cy, rx, ry, rot = 0) {
  const kx = rx * K;
  const ky = ry * K;
  const p = new Path([
    ['M', cx + rx, cy],
    ['C', cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry],
    ['C', cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy],
    ['C', cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry],
    ['C', cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy],
    ['Z'],
  ]);
  return rot ? p.rotate(rot, cx, cy) : p;
}

export const circle = (cx, cy, r) => ellipse(cx, cy, r, r);

/** Ring (Kreisring) – Loch per umgekehrtem Umlaufsinn, funktioniert mit nonzero. */
export function ring(cx, cy, rIn, rOut) {
  return circle(cx, cy, rOut).concat(circle(cx, cy, rIn).reverse());
}

/** Polygon mit abgerundeten Ecken. r: Zahl oder Array je Ecke. */
export function roundPoly(pts, r) {
  const n = pts.length;
  const cmds = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const ri = Array.isArray(r) ? r[i] : r;
    const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const rr = Math.min(ri, d1 / 2, d2 / 2);
    const a = lerpPt(p1, p0, rr / d1);
    const b = lerpPt(p1, p2, rr / d2);
    if (i === 0) cmds.push(['M', a[0], a[1]]);
    else cmds.push(['L', a[0], a[1]]);
    if (rr > 0.01) cmds.push(['Q', p1[0], p1[1], b[0], b[1]]);
  }
  cmds.push(['Z']);
  return new Path(cmds);
}

/**
 * Glatte Kurve durch Punkte (Catmull-Rom → kubische Bézier).
 * Ein Punkt [x, y, 1] ist eine Ecke (keine Tangente).
 */
export function smooth(pts, { closed = true, k = 1 } = {}) {
  const n = pts.length;
  const P = (i) => {
    if (closed) return pts[(i + n) % n];
    return pts[clamp(i, 0, n - 1)];
  };
  const cmds = [['M', pts[0][0], pts[0][1]]];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = p1[2] ? [p1[0], p1[1]] : [p1[0] + ((p2[0] - p0[0]) * k) / 6, p1[1] + ((p2[1] - p0[1]) * k) / 6];
    const c2 = p2[2] ? [p2[0], p2[1]] : [p2[0] - ((p3[0] - p1[0]) * k) / 6, p2[1] - ((p3[1] - p1[1]) * k) / 6];
    cmds.push(['C', c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]]);
  }
  if (closed) cmds.push(['Z']);
  return new Path(cmds);
}

export const smoothOpen = (pts, k = 1) => smooth(pts, { closed: false, k });

/** Punkte auf einem (Ellipsen-)Bogen. Winkel in Grad, 0 = rechts, 90 = unten. */
export function arcPts(cx, cy, rx, ry, a0, a1, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(lerp(a0, a1, i / n));
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

/** Glatter Bogen als Pfadsegmente (für Ringsegmente). */
function arcCmds(cx, cy, r, a0, a1, first) {
  const cmds = [];
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 45));
  const da = (a1 - a0) / steps;
  const t = (4 / 3) * Math.tan(rad(da) / 4);
  for (let i = 0; i < steps; i++) {
    const s = rad(a0 + da * i);
    const e = rad(a0 + da * (i + 1));
    const p0 = [cx + r * Math.cos(s), cy + r * Math.sin(s)];
    const p3 = [cx + r * Math.cos(e), cy + r * Math.sin(e)];
    const c1 = [p0[0] - t * r * Math.sin(s), p0[1] + t * r * Math.cos(s)];
    const c2 = [p3[0] + t * r * Math.sin(e), p3[1] - t * r * Math.cos(e)];
    if (i === 0) cmds.push([first, p0[0], p0[1]]);
    cmds.push(['C', c1[0], c1[1], c2[0], c2[1], p3[0], p3[1]]);
  }
  return cmds;
}

/** Tortenstück. */
export function wedge(cx, cy, r, a0, a1) {
  return new Path([['M', cx, cy], ...arcCmds(cx, cy, r, a0, a1, 'L'), ['Z']]);
}

/** Ringsegment zwischen Radien r0 < r1 und Winkeln a0..a1. */
export function annulusSeg(cx, cy, r0, r1, a0, a1) {
  const outer = arcCmds(cx, cy, r1, a0, a1, 'M');
  const inner = arcCmds(cx, cy, r0, a1, a0, 'L');
  return new Path([...outer, ...inner, ['Z']]);
}

/** Stern. */
export function star(cx, cy, ro, ri, n = 5, rot = -90, round = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rad(rot + (i * 180) / n);
    const r = i % 2 ? ri : ro;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return round ? roundPoly(pts, round) : poly(pts);
}

/**
 * Blütenblatt: Basis im Ursprung, Spitze bei (0, -len).
 * wid = halbe Breite, pos = Lage der breitesten Stelle (0..1), tip = Rundung der Spitze (0 = spitz).
 */
export function petal(len, wid, { pos = 0.55, tip = 0.35, base = 0 } = {}) {
  const y = -len * pos;
  const right = [
    ['M', base, 0],
    ['C', base + wid * 0.6, -len * 0.08, wid, y + len * 0.18, wid, y],
    ['C', wid, y - len * 0.25, wid * tip + 0.001, -len, 0, -len],
  ];
  const p = new Path([...right]);
  // linke Hälfte (gespiegelt, rückwärts)
  p.cmds.push(['C', -wid * tip - 0.001, -len, -wid, y - len * 0.25, -wid, y]);
  p.cmds.push(['C', -wid, y + len * 0.18, -base - wid * 0.6, -len * 0.08, -base, 0]);
  p.cmds.push(['Z']);
  return p;
}

/** Blatt: spitz an beiden Enden, von (0,0) nach (0,-len). bend verbiegt seitlich. */
export function leaf(len, wid, { pos = 0.5, bend = 0 } = {}) {
  const y = -len * pos;
  return new Path([
    ['M', 0, 0],
    ['C', wid * 0.55 + bend * 0.5, -len * 0.1, wid + bend, y + len * 0.2, wid + bend, y],
    ['C', wid + bend, y - len * 0.25, wid * 0.4 + bend * 0.7, -len * 0.85, bend * 0.6, -len],
    ['C', -wid * 0.3 + bend * 0.7, -len * 0.85, -wid + bend, y - len * 0.25, -wid + bend, y],
    ['C', -wid + bend, y + len * 0.2, -wid * 0.55 + bend * 0.5, -len * 0.1, 0, 0],
    ['Z'],
  ]);
}

/**
 * Kette von Punkten, jeweils durch nach aussen gewölbte Bögen verbunden (Wolken, Rüschen).
 * bulge: Wölbung relativ zur Sehnenlänge (0.66 ≈ Halbkreis). Array möglich (pro Segment).
 * Punkte im Uhrzeigersinn (Bildschirm) → Wölbung nach aussen.
 */
export function bumpy(pts, bulge = 0.66, { closed = true } = {}) {
  const n = pts.length;
  const cmds = [['M', pts[0][0], pts[0][1]]];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const b = Array.isArray(bulge) ? bulge[i] : bulge;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const nx = dy;
    const ny = -dx;
    if (!b) {
      cmds.push(['L', q[0], q[1]]);
      continue;
    }
    cmds.push(['C', p[0] + nx * b, p[1] + ny * b, q[0] + nx * b, q[1] + ny * b, q[0], q[1]]);
  }
  if (closed) cmds.push(['Z']);
  return new Path(cmds);
}

/**
 * Wolke: flache Unterkante von x0 bis x1 auf Höhe y, oben Bögen durch die Punkte tops.
 * tops: Liste von [x, y] von links nach rechts (Übergänge zwischen den Bögen).
 */
export function cloud(x0, x1, y, tops, bulge = 0.62, bottomBulge = -0.06) {
  const pts = [[x0, y], ...tops, [x1, y]];
  const bul = pts.map((_, i) => (i === pts.length - 1 ? bottomBulge : Array.isArray(bulge) ? bulge[i] : bulge));
  return bumpy(pts, bul);
}

/** Sinus-Wellenpunkte zwischen x0 und x1. */
export function wavePts(x0, x1, y, amp, wl, phase = 0, step = 8) {
  const out = [];
  const n = Math.max(2, Math.ceil(((x1 - x0) / wl) * step));
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    out.push([x, y + amp * Math.sin(((x - x0) / wl) * Math.PI * 2 + phase)]);
  }
  return out;
}

/** Fläche von einer Oberkante (Punkte links→rechts) bis zur Höhe bottom. */
export function band(topPts, bottom, { curve = true } = {}) {
  const top = curve ? smoothOpen(topPts) : polyline(topPts);
  const last = topPts[topPts.length - 1];
  const first = topPts[0];
  top.cmds.push(['L', last[0], bottom], ['L', first[0], bottom], ['Z']);
  return top;
}

/** Fläche zwischen zwei Kurven (beide links→rechts). */
export function between(topPts, botPts, { curve = true } = {}) {
  const top = curve ? smoothOpen(topPts) : polyline(topPts);
  const bot = (curve ? smoothOpen(botPts) : polyline(botPts)).reverse();
  bot.cmds[0][0] = 'L';
  return new Path([...top.cmds, ...bot.cmds, ['Z']]);
}

/** Bogenförmiges Band (z.B. Regenbogen / Torbogen-Laibung): Ringsegment mit Ellipse. */
export function archBand(cx, cy, rx0, ry0, rx1, ry1, a0 = 180, a1 = 360, n = 24) {
  const outer = arcPts(cx, cy, rx1, ry1, a0, a1, n);
  const inner = arcPts(cx, cy, rx0, ry0, a1, a0, n);
  return smoothCorners([...outer, ...inner], [0, n, n + 1, 2 * n + 1]);
}

/** Glatte geschlossene Kurve, bei der bestimmte Indizes Ecken sind. */
export function smoothCorners(pts, corners) {
  const set = new Set(corners);
  return smooth(pts.map((p, i) => (set.has(i) ? [p[0], p[1], 1] : p)));
}

/** Kreisförmige Wiederholung: fn(i, winkelGrad) → Path; liefert Liste. */
export function polar(n, fn, start = -90) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(fn(i, start + (360 * i) / n));
  return out;
}

/** Herz, Spitze unten, Mittelpunkt (cx, cy), Breite w. */
export function heart(cx, cy, w) {
  const s = w / 2;
  return new Path([
    ['M', cx, cy + s * 0.95],
    ['C', cx - s * 0.3, cy + s * 0.6, cx - s, cy + s * 0.2, cx - s, cy - s * 0.3],
    ['C', cx - s, cy - s * 0.8, cx - s * 0.35, cy - s * 0.95, cx, cy - s * 0.5],
    ['C', cx + s * 0.35, cy - s * 0.95, cx + s, cy - s * 0.8, cx + s, cy - s * 0.3],
    ['C', cx + s, cy + s * 0.2, cx + s * 0.3, cy + s * 0.6, cx, cy + s * 0.95],
    ['Z'],
  ]);
}

/** Tropfen / Flamme: Spitze oben bei (cx, cy - h), runder Bauch unten. */
export function drop(cx, cy, w, h, lean = 0) {
  const r = w / 2;
  return new Path([
    ['M', cx + lean, cy - h],
    ['C', cx + lean * 0.6 + r * 0.4, cy - h * 0.6, cx + r, cy - r * 1.3, cx + r, cy - r * 0.4],
    ['C', cx + r, cy + r * 0.3, cx + r * 0.55, cy + r * 0.8, cx, cy + r * 0.8],
    ['C', cx - r * 0.55, cy + r * 0.8, cx - r, cy + r * 0.3, cx - r, cy - r * 0.4],
    ['C', cx - r, cy - r * 1.3, cx + lean * 0.6 - r * 0.4, cy - h * 0.6, cx + lean, cy - h],
    ['Z'],
  ]);
}

/** Kapsel (Streusel) von p nach q mit Dicke w. */
export function capsule(p, q, w) {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const L = Math.hypot(dx, dy);
  const nx = (-dy / L) * (w / 2);
  const ny = (dx / L) * (w / 2);
  const ex = (dx / L) * (w / 2) * 1.33;
  const ey = (dy / L) * (w / 2) * 1.33;
  return new Path([
    ['M', p[0] + nx, p[1] + ny],
    ['L', q[0] + nx, q[1] + ny],
    ['C', q[0] + nx + ex, q[1] + ny + ey, q[0] - nx + ex, q[1] - ny + ey, q[0] - nx, q[1] - ny],
    ['L', p[0] - nx, p[1] - ny],
    ['C', p[0] - nx - ex, p[1] - ny - ey, p[0] + nx - ex, p[1] + ny - ey, p[0] + nx, p[1] + ny],
    ['Z'],
  ]);
}

/** Dicker Strich entlang einer Punktfolge (geglättet) als Fläche. */
export function stroke(pts, w, { w1 = w, caps = true } = {}) {
  const n = pts.length;
  const L = [];
  const R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const ww = lerp(w, w1, i / (n - 1)) / 2;
    L.push([pts[i][0] - (dy / len) * ww, pts[i][1] + (dx / len) * ww]);
    R.push([pts[i][0] + (dy / len) * ww, pts[i][1] - (dx / len) * ww]);
  }
  const left = smoothOpen(L);
  const right = smoothOpen(R.reverse());
  const cmds = [...left.cmds];
  const r0 = right.cmds[0];
  if (caps) {
    const e = L[n - 1];
    const f = R[0];
    const m = pts[n - 1];
    const dx = m[0] - pts[n - 2][0];
    const dy = m[1] - pts[n - 2][1];
    const len = Math.hypot(dx, dy) || 1;
    const ww = w1 * 0.66;
    cmds.push(['C', e[0] + (dx / len) * ww, e[1] + (dy / len) * ww, f[0] + (dx / len) * ww, f[1] + (dy / len) * ww, r0[1], r0[2]]);
  } else cmds.push(['L', r0[1], r0[2]]);
  cmds.push(...right.cmds.slice(1));
  if (caps) {
    const e = R[n - 1];
    const f = L[0];
    const m = pts[0];
    const dx = m[0] - pts[1][0];
    const dy = m[1] - pts[1][1];
    const len = Math.hypot(dx, dy) || 1;
    const ww = w * 0.66;
    cmds.push(['C', e[0] + (dx / len) * ww, e[1] + (dy / len) * ww, f[0] + (dx / len) * ww, f[1] + (dy / len) * ww, f[0], f[1]]);
  }
  cmds.push(['Z']);
  return new Path(cmds);
}

/* ---------- Bild-Bauer ---------- */

export class Pic {
  constructor(meta) {
    this.meta = { width: 1000, height: 1000, ...meta };
    this.shapes = [];
    this.lines = [];
  }
  get W() {
    return this.meta.width;
  }
  get H() {
    return this.meta.height;
  }
  /** Fläche hinzufügen. path: Path | string | Array<Path>; color: Palettenname. */
  add(path, color, rule) {
    if (!(color in this.meta.palette)) throw new Error(`${this.meta.id}: unbekannte Farbe «${color}»`);
    const d = Array.isArray(path) ? Path.of(...path).toString() : String(path);
    const s = { d, c: color };
    if (rule) s.r = rule;
    this.shapes.push(s);
    return this;
  }
  /** Mehrere Flächen gleicher Farbe (je ein eigener Bereich). */
  each(paths, color) {
    for (const p of paths) this.add(p, color);
    return this;
  }
  line(path, w, color = '#2b2420') {
    this.lines.push({ d: String(path), w, color });
    return this;
  }
  toPuzzle() {
    const pal = [];
    const idx = new Map();
    for (const s of this.shapes) {
      if (!idx.has(s.c)) {
        idx.set(s.c, pal.length);
        pal.push(this.meta.palette[s.c]);
      }
    }
    const { id, title, category, width, height, background } = this.meta;
    const out = { id, title, category, width, height, palette: pal };
    out.shapes = this.shapes.map((s) => (s.r ? { d: s.d, c: idx.get(s.c), r: s.r } : { d: s.d, c: idx.get(s.c) }));
    if (this.lines.length) out.lines = this.lines;
    if (background) out.background = background;
    return out;
  }
  save(file) {
    const pz = this.toPuzzle();
    const body = JSON.stringify(pz)
      .replace(/,"shapes":\[/, ',\n"shapes":[\n')
      .replace(/\},\{"d"/g, '},\n{"d"');
    writeFileSync(file, `// ${pz.title} – Team B (generiert aus src/, nicht von Hand ändern)\nexport default ${body};\n`);
    return pz;
  }
}

/** Gefalteter 3D-Stern: liefert 2·n Dreiecke, abwechselnd [hell, dunkel]. */
export function foldedStar(cx, cy, ro, ri, n = 5, rot = -90) {
  const facets = [];
  for (let i = 0; i < n; i++) {
    const a = rad(rot + (360 * i) / n);
    const b = rad(rot + (360 * i) / n + 180 / n);
    const c = rad(rot + (360 * i) / n - 180 / n);
    const O = [cx + ro * Math.cos(a), cy + ro * Math.sin(a)];
    const Ir = [cx + ri * Math.cos(b), cy + ri * Math.sin(b)];
    const Il = [cx + ri * Math.cos(c), cy + ri * Math.sin(c)];
    facets.push(poly([[cx, cy], Il, O]));
    facets.push(poly([[cx, cy], O, Ir]));
  }
  return facets;
}

/** Tannenzweig: gezacktes Blatt von (0,0) nach (0,-len), Nadeln zeigen zur Spitze. */
export function sprig(len, wid, teeth = 5, { round = 3 } = {}) {
  const prof = (t) => wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)), 0.8);
  const right = [];
  for (let i = 0; i < teeth; i++) {
    const t0 = 0.08 + (0.84 * i) / teeth;
    const t1 = 0.08 + (0.84 * (i + 0.85)) / teeth;
    right.push([prof(t0) * 0.5, -len * t0]);
    right.push([prof(t1), -len * t1]);
  }
  const pts = [[0, 0], ...right, [0, -len], ...right.slice().reverse().map(([x, y]) => [-x, y])];
  return roundPoly(pts, round);
}
