// Canvas-2D-Renderer für den Pfeilwürfel (eigene 3D-Mathematik, kein WebGL).
//
// - Rotation als Quaternion, milde Perspektive.
// - Der Würfel ist konvex: nur Seiten, deren Normale zur Kamera zeigt, werden gezeichnet
//   (sichtbare Seiten überlappen sich nie → kein Z-Buffer nötig).
// - Pfeile liegen als vorberechnete 3D-Polylinien vor; pro Bild werden nur Punkte projiziert.
//   Statische Pfeile werden pro Seite gebündelt gezeichnet (wenige stroke()-Aufrufe).

import { qToMat, clamp, smoothstep, madd, cross } from './math.js';
import { FACE_DEFS, dirVec } from './geometry.js';

export const CAM_DIST = 9.5;
const BEVEL = 0.05; // Einzug der Seitenflächen von der Kante (Würfel-Einheiten)
const LIGHT = (() => { const l = [-0.42, 0.78, 0.46]; const n = Math.hypot(...l); return l.map((v) => v / n); })();

const BASE = {
  ink: '#4a3418',
  inkShadow: 'rgba(84, 52, 18, 0.20)',
  faceLight: [255, 251, 243],
  faceDark: [233, 214, 182],
  bevel: '#e2cfae',
  bevelEdge: 'rgba(120, 84, 40, 0.18)',
  dot: 'rgba(150, 112, 62, 0.20)',
  trace: 'rgba(255, 255, 255, 0.42)',
  blue: '#2f7de1',
  red: '#e5484d',
};

export function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const v = m ? parseInt(m[1], 16) : 0xffffff;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

let floorCanvas = null;
function floorSprite() {
  if (floorCanvas) return floorCanvas;
  const W = 256, H = 54;
  floorCanvas = document.createElement('canvas');
  floorCanvas.width = W; floorCanvas.height = H;
  const g = floorCanvas.getContext('2d');
  g.translate(W / 2, H / 2);
  g.scale(1, H / W);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, W / 2);
  gr.addColorStop(0, 'rgba(110, 72, 30, 0.26)');
  gr.addColorStop(0.55, 'rgba(110, 72, 30, 0.12)');
  gr.addColorStop(1, 'rgba(110, 72, 30, 0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, W / 2, 0, Math.PI * 2);
  g.fill();
  return floorCanvas;
}

const mix = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

/** Polylinie eines Pfeils (Schwanz → Kopf), optional verlängert um Strahl + Abflug ins All. */
export function buildPath(geo, arrow, withExit = false) {
  const { h } = geo;
  const pts = [];
  const arcs = [];
  const seg = []; // seg[k] = Seite des Segments pts[k] → pts[k+1] (-1 = ausserhalb des Würfels)
  const cells = arrow.cells;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const p = geo.center(c);
    if (i > 0) {
      const prev = cells[i - 1];
      const fp = geo.faceOf(prev);
      const fc = geo.faceOf(c);
      if (fp !== fc) {
        const d = geo.dirBetween(prev, c);
        pts.push(madd(geo.center(prev), dirVec(fp, d), h / 2));
        arcs.push(i - 0.5);
        seg.push(fp);
      }
      seg.push(fc);
    }
    pts.push(p);
    arcs.push(i);
  }
  const head = cells[cells.length - 1];
  const hf = geo.faceOf(head);
  const D = dirVec(hf, arrow.dir);
  const n = FACE_DEFS[hf].n;
  const len = cells.length - 1;
  const out = { pts, arcs, seg, len, headFace: hf, D, n, rayLen: 0, edgeArc: 0, total: len };
  if (withExit) {
    const ray = geo.ray(head, arrow.dir);
    const hc = geo.center(head);
    ray.forEach((c, j) => { seg.push(hf); pts.push(geo.center(c)); arcs.push(len + j + 1); });
    const edge = madd(hc, D, h * (ray.length + 0.5));
    seg.push(hf); pts.push(edge); arcs.push(len + ray.length + 0.5);
    const extra = len + 4;
    for (let t = 1; t <= extra; t++) {
      seg.push(-1);
      pts.push(madd(edge, D, h * t));
      arcs.push(len + ray.length + 0.5 + t);
    }
    out.rayLen = ray.length;
    out.edgeArc = len + ray.length + 0.5;
    out.edge = edge;
    out.total = arcs[arcs.length - 1];
  }
  return out;
}

/** Punkt + Segmentindex auf der Polylinie bei Bogenlänge s. */
function pointAt(path, s) {
  const { pts, arcs } = path;
  const n = pts.length;
  if (s <= arcs[0]) return { p: pts[0], k: 0 };
  let k = 0;
  while (k < n - 2 && arcs[k + 1] < s) k++;
  const a = arcs[k], b = arcs[k + 1];
  const t = clamp((s - a) / (b - a), 0, 1);
  const p0 = pts[k], p1 = pts[k + 1];
  return { p: [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t], k };
}

/** Ausschnitt [a, b] der Polylinie: { pts, seg, tan, nrm } (tan/nrm am Ende b, für die Pfeilspitze). */
function subPath(path, a, b) {
  const { pts, arcs, seg } = path;
  const n = pts.length;
  const A = pointAt(path, a);
  const B = pointAt(path, b);
  const outP = [A.p];
  const outS = [];
  for (let k = A.k + 1; k <= B.k; k++) {
    outS.push(seg[k - 1]);
    outP.push(pts[k]);
  }
  outS.push(seg[B.k]);
  outP.push(B.p);
  const k = Math.min(B.k, n - 2);
  const p0 = pts[k], p1 = pts[k + 1];
  let tan = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const l = Math.hypot(...tan) || 1;
  tan = [tan[0] / l, tan[1] / l, tan[2] / l];
  const f = seg[k];
  const nrm = f >= 0 ? FACE_DEFS[f].n : path.n;
  return { pts: outP, seg: outS, tan, nrm, headSeg: f };
}

function hullOf(points) {
  // Monotone-Chain (points: [[x,y],...])
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const crossZ = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

function roundedPoly(ctx, pts, r) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const m = mid(p, q);
    ctx.arcTo(p[0], p[1], m[0], m[1], r);
  }
  ctx.closePath();
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + dx * t - px, y = ay + dy * t - py;
  return Math.sqrt(x * x + y * y);
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export class CubeRenderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mini = !!opts.mini;
    this.w = 1; this.h = 1; this.dpr = 1;
    this.baseScale = 100;
    this.M = new Float64Array(9);
    this.geo = null;
    this.arrows = [];
    this.paths = [];
    this.proj = [];
    this.vis = new Uint8Array(6);
    this.facing = new Float64Array(6);
    this.facePolys = [];
    this.extCache = new Map();
    this.hull = [];
    this.ready = false;
    this.C = { ...BASE };
  }

  /** Papier-Thema setzen: { light, dark, edge, ink, hint } als #rrggbb (fehlende Werte = Standard). */
  setTheme(t) {
    const C = { ...BASE };
    if (t) {
      if (t.light) C.faceLight = hexRgb(t.light);
      if (t.dark) C.faceDark = hexRgb(t.dark);
      if (t.edge) C.bevel = t.edge;
      if (t.ink) {
        const [r, g, b] = hexRgb(t.ink);
        C.ink = t.ink;
        C.inkShadow = `rgba(${r}, ${g}, ${b}, 0.20)`;
        C.dot = `rgba(${r}, ${g}, ${b}, 0.13)`;
        C.bevelEdge = `rgba(${r}, ${g}, ${b}, 0.16)`;
      }
      if (t.hint) C.blue = t.hint;
    }
    this.C = C;
  }

  resize(w, h, dpr) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = dpr;
    const cw = Math.round(this.w * dpr), ch = Math.round(this.h * dpr);
    if (this.canvas.width !== cw) this.canvas.width = cw;
    if (this.canvas.height !== ch) this.canvas.height = ch;
    // Würfel (inkl. Schatten) passend einpassen
    this.baseScale = this.mini
      ? Math.min(this.w / 3.3, this.h / 3.55)
      : Math.min(this.w / 3.3, this.h / 3.95);
  }

  setLevel(geo, arrows) {
    this.geo = geo;
    this.arrows = arrows;
    this.paths = arrows.map((a) => {
      const p = buildPath(geo, a, false);
      p.flat = new Float64Array(p.pts.length * 3);
      p.pts.forEach((q, i) => { p.flat[i * 3] = q[0]; p.flat[i * 3 + 1] = q[1]; p.flat[i * 3 + 2] = q[2]; });
      // Pfeilspitze (in der Ebene der Kopf-Seite)
      const hc = geo.center(a.cells[a.cells.length - 1]);
      p.hc = hc;
      return p;
    });
    this.proj = this.paths.map((p) => new Float64Array(p.pts.length * 2));
    this.headProj = this.paths.map(() => new Float64Array(8));
    this.extCache.clear();
    this.ready = true;
  }

  /** Verlängerte Bahn (Strahl + Abflug) für Animationen, gecacht. */
  exitPath(id) {
    let p = this.extCache.get(id);
    if (!p) { p = buildPath(this.geo, this.arrows[id], true); this.extCache.set(id, p); }
    return p;
  }

  /** Projektions-Setup für das aktuelle Bild. */
  _setup(view) {
    const M = qToMat(view.q, this.M);
    const S = this.baseScale * view.zoom;
    this.S = S;
    this.F = S * CAM_DIST;
    this.cx = this.w / 2 + (view.panX || 0) + (view.shakeX || 0);
    this.cy = this.h / 2 + (view.panY || 0) + (this.mini ? -this.h * 0.015 : -this.h * 0.02);
    this.cellPx = this.geo ? this.geo.h * S : 30;
    for (let f = 0; f < 6; f++) {
      const n = FACE_DEFS[f].n;
      const nx = M[0] * n[0] + M[1] * n[1] + M[2] * n[2];
      const ny = M[3] * n[0] + M[4] * n[1] + M[5] * n[2];
      const nz = M[6] * n[0] + M[7] * n[1] + M[8] * n[2];
      // Kamera bei (0,0,CAM_DIST), Seitenmitte bei n
      const vx = -nx, vy = -ny, vz = CAM_DIST - nz;
      const vl = Math.hypot(vx, vy, vz);
      const fac = (nx * vx + ny * vy + nz * vz) / vl;
      this.facing[f] = fac;
      this.vis[f] = fac > 0.0005 ? 1 : 0;
    }
  }

  project(x, y, z, out, o) {
    const M = this.M;
    const X = M[0] * x + M[1] * y + M[2] * z;
    const Y = M[3] * x + M[4] * y + M[5] * z;
    const Z = M[6] * x + M[7] * y + M[8] * z;
    const s = this.F / (CAM_DIST - Z);
    out[o] = this.cx + X * s;
    out[o + 1] = this.cy - Y * s;
  }

  p2(v) {
    const o = [0, 0];
    this.project(v[0], v[1], v[2], o, 0);
    return o;
  }

  strokeWidth() {
    const c = this.cellPx;
    return Math.max(2, Math.min(c * 0.3, 6.5 + c * 0.15));
  }

  headScale() { return Math.min(1, 66 / Math.max(1, this.cellPx)); }

  /** 3D-Dreieck der Pfeilspitze bei Punkt hc mit Richtung D in der Ebene mit Normale n. */
  headTri(hc, D, n, hs) {
    const h = this.geo.h * hs;
    const B = cross(n, D);
    const tip = madd(hc, D, 0.43 * h);
    const bc = madd(hc, D, -0.1 * h);
    return [tip, madd(bc, B, 0.37 * h), madd(bc, B, -0.37 * h)];
  }

  /**
   * Zeichnet ein Bild.
   * view:  { q, zoom, panX, panY, shakeX }
   * scene: { removed, hidden:Set(ids, die animiert werden), anims:[{id,a,b,alpha,color,pass}],
   *          highlights: Map(id → {color:'blue'|'red', k:0..1}), particles:[], traces:bool }
   */
  draw(view, scene = {}) {
    const ctx = this.ctx;
    const W = this.w, H = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!this.geo) return;
    this._setup(view);
    const S = this.S;
    const vis = this.vis, facing = this.facing;
    const geo = this.geo;
    const removed = scene.removed;
    const hidden = scene.hidden;
    const wpx = this.strokeWidth();
    const hs = this.headScale();
    const fadeIn = scene.fade == null ? 1 : scene.fade;
    const shadowK = scene.shadowK == null ? 1 : scene.shadowK;

    const dbo = this.debugOpts || {};
    // --- Schatten am Boden (vorgerendertes Sprite, günstig zu zeichnen) ---
    if (!dbo.noFloor) {
      const R = Math.sqrt(3) * S;
      const sw = R * 1.9, sh = sw * 0.21;
      ctx.drawImage(floorSprite(), this.cx - sw / 2, this.cy + R * 1.04 - sh / 2, sw, sh);
    }

    // --- Ecken und Silhouette ---
    const corners = [];
    for (let i = 0; i < 8; i++) {
      corners.push(this.p2([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]));
    }
    const hull = hullOf(corners);
    this.hull = hull;

    // Hinter dem Würfel: Abflug-Teile von Pfeilen, deren Kopf-Seite abgewandt ist
    if (scene.anims) for (const an of scene.anims) if (an.pass === 'back') this._drawAnim(an, wpx, hs, 'off');

    // Grundkörper (Fase) mit runden Ecken
    ctx.beginPath();
    hull.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, BEVEL * S * 1.2);
    ctx.strokeStyle = this.C.bevel;
    ctx.fillStyle = this.C.bevel;
    ctx.fill();
    ctx.stroke();

    // --- Seitenflächen ---
    this.facePolys = [];
    const faceInner = [];
    for (let f = 0; f < 6; f++) {
      this.facePolys[f] = null;
      if (!vis[f]) continue;
      const F = FACE_DEFS[f];
      const O = [F.n[0] - F.U[0] - F.V[0], F.n[1] - F.U[1] - F.V[1], F.n[2] - F.U[2] - F.V[2]];
      const full = [
        O, madd(O, F.U, 2), madd(madd(O, F.U, 2), F.V, 2), madd(O, F.V, 2),
      ].map((p) => this.p2(p));
      this.facePolys[f] = full;
      const b = BEVEL, e = 2 - BEVEL;
      const inner = [
        madd(madd(O, F.U, b), F.V, b), madd(madd(O, F.U, e), F.V, b),
        madd(madd(O, F.U, e), F.V, e), madd(madd(O, F.U, b), F.V, e),
      ].map((p) => this.p2(p));
      faceInner[f] = inner;
      const nc = [
        this.M[0] * F.n[0] + this.M[1] * F.n[1] + this.M[2] * F.n[2],
        this.M[3] * F.n[0] + this.M[4] * F.n[1] + this.M[5] * F.n[2],
        this.M[6] * F.n[0] + this.M[7] * F.n[1] + this.M[8] * F.n[2],
      ];
      const lam = Math.max(0, nc[0] * LIGHT[0] + nc[1] * LIGHT[1] + nc[2] * LIGHT[2]);
      const t = 0.18 + 0.82 * lam;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of inner) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, mix(this.C.faceDark, this.C.faceLight, Math.min(1, t + 0.07)));
      g.addColorStop(1, mix(this.C.faceDark, this.C.faceLight, Math.max(0, t - 0.07)));
      ctx.beginPath();
      roundedPoly(ctx, inner, Math.max(2, Math.min(10, BEVEL * S * 1.6)));
      ctx.fillStyle = g;
      ctx.fill();
      // feine Lichtkante oben/links
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.4 * lam})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Kein Clip nötig: Pfeil-Teilstücke enden mit geraden Enden genau an der Silhouette,
    // runde Enden (Scheiben) gibt es nur im Innern. Das spart viel Rasterzeit.

    // --- Projektion aller Pfeil-Punkte ---
    const paths = this.paths;
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      const pr = this.proj[i];
      const fl = p.flat;
      for (let k = 0, m = p.pts.length; k < m; k++) this.project(fl[k * 3], fl[k * 3 + 1], fl[k * 3 + 2], pr, k * 2);
    }

    // --- Spuren entfernter Pfeile (zeigen den Fortschritt) ---
    if (removed && scene.traces !== false) {
      const tr = [], tc = [];
      for (let f = 0; f < 6; f++) { tr[f] = vis[f] ? new Path2D() : null; tc[f] = vis[f] ? new Path2D() : null; }
      let any = false;
      for (let i = 0; i < paths.length; i++) {
        if (!removed[i] || (hidden && hidden.has(i))) continue;
        any = true;
        this._addRuns(tr, i, tc, wpx * 0.85);
      }
      if (any) {
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
        ctx.lineWidth = wpx * 1.7;
        ctx.strokeStyle = this.C.trace;
        ctx.fillStyle = this.C.trace;
        for (let f = 0; f < 6; f++) {
          if (!tr[f]) continue;
          ctx.globalAlpha = smoothstep(0.02, 0.25, facing[f]);
          // Strich und Kappen als eine Fläche (keine Überlappung bei Transparenz)
          const u = new Path2D();
          u.addPath(tr[f]);
          ctx.stroke(u);
        }
        ctx.globalAlpha = 1;
      }
    }

    // --- Rasterpunkte ---
    if (!dbo.noDots) {
      const N = geo.N;
      const r = Math.max(0.8, Math.min(2.6, this.cellPx * 0.055));
      ctx.fillStyle = this.C.dot;
      const tmp = [0, 0];
      for (let f = 0; f < 6; f++) {
        if (!vis[f] || facing[f] < 0.06) continue;
        ctx.globalAlpha = smoothstep(0.06, 0.3, facing[f]);
        ctx.beginPath();
        const base = f * N * N;
        for (let c = base; c < base + N * N; c++) {
          this.project(geo.centers[c * 3], geo.centers[c * 3 + 1], geo.centers[c * 3 + 2], tmp, 0);
          ctx.moveTo(tmp[0] + r, tmp[1]);
          ctx.arc(tmp[0], tmp[1], r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // --- Statische Pfeile, gebündelt pro Seite ---
    if (dbo.noArrows) return;
    const strokes = [], heads = [], caps = [];
    for (let f = 0; f < 6; f++) {
      strokes[f] = vis[f] ? new Path2D() : null;
      heads[f] = vis[f] ? new Path2D() : null;
      caps[f] = vis[f] ? new Path2D() : null;
    }
    const hl = scene.highlights;
    for (let i = 0; i < paths.length; i++) {
      if (removed && removed[i]) continue;
      if (hidden && hidden.has(i)) continue;
      if (hl && hl.has(i)) continue;
      this._addRuns(strokes, i, caps, wpx / 2);
      this._addHead(heads, i, hs);
    }
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    const shOff = Math.max(1, wpx * 0.22);
    for (let f = 0; f < 6; f++) {
      if (!vis[f]) continue;
      const alpha = smoothstep(0.015, 0.22, facing[f]) * fadeIn;
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      // weicher Schatten (leicht nach unten versetzt) – während der Bewegung ausgeblendet
      if (!dbo.noInkShadow && shadowK > 0.01) {
      ctx.save();
      ctx.globalAlpha = alpha * shadowK;
      ctx.translate(0, shOff);
      ctx.strokeStyle = this.C.inkShadow;
      ctx.fillStyle = this.C.inkShadow;
      ctx.lineWidth = wpx * 1.12;
      ctx.stroke(strokes[f]);
      ctx.fill(caps[f]);
      ctx.lineWidth = wpx * 0.5;
      ctx.fill(heads[f]);
      ctx.stroke(heads[f]);
      ctx.restore();
      ctx.globalAlpha = alpha;
      }
      // Tinte
      ctx.strokeStyle = this.C.ink;
      ctx.fillStyle = this.C.ink;
      ctx.lineWidth = wpx;
      ctx.stroke(strokes[f]);
      ctx.fill(caps[f]);
      ctx.lineWidth = wpx * 0.42;
      ctx.fill(heads[f]);
      ctx.stroke(heads[f]);
    }
    ctx.globalAlpha = 1;

    // --- Hervorgehobene Pfeile (Tipp = blau, Hindernis = rot) ---
    if (hl && hl.size) {
      for (const [i, st] of hl) {
        if (removed && removed[i]) continue;
        if (hidden && hidden.has(i)) continue;
        this._drawHighlighted(i, st, wpx, hs);
      }
    }

    // --- Animierte Pfeile (Abflug, Anstossen) ---
    if (scene.anims) for (const an of scene.anims) this._drawAnim(an, wpx, hs, an.pass === 'back' ? 'on' : 'all');

    // --- Partikel ---
    if (scene.particles && scene.particles.length) {
      const tmp = [0, 0];
      for (const pt of scene.particles) {
        const age = pt.age;
        if (age < 0 || age > 1) continue;
        this.project(pt.p[0], pt.p[1], pt.p[2], tmp, 0);
        const rad = Math.max(0.6, pt.size * this.cellPx * (1 - age * 0.7));
        ctx.globalAlpha = (1 - age) * (1 - age) * 0.9;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(tmp[0], tmp[1], rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Fügt die sichtbaren Teilstücke von Pfeil i in die Pfade pro Seite ein (gerade Enden).
   * caps (optional): Scheiben mit Radius capR für runde Enden – nur am Schwanz und an Kanten
   * zwischen zwei sichtbaren Seiten. An der Silhouette endet der Strich gerade.
   */
  _addRuns(target, i, caps = null, capR = 0) {
    const p = this.paths[i];
    const pr = this.proj[i];
    const seg = p.seg;
    let pen = -1;
    for (let k = 0; k < seg.length; k++) {
      const f = seg[k];
      if (!this.vis[f]) { pen = -1; continue; }
      const path = target[f];
      if (pen !== f) {
        const x = pr[k * 2], y = pr[k * 2 + 1];
        path.moveTo(x, y);
        if (caps && (k === 0 || pen !== -1)) {
          caps[f].moveTo(x + capR, y);
          caps[f].arc(x, y, capR, 0, Math.PI * 2);
        }
      }
      path.lineTo(pr[k * 2 + 2], pr[k * 2 + 3]);
      pen = f;
    }
  }

  _addHead(target, i, hs) {
    const p = this.paths[i];
    const f = p.headFace;
    if (!this.vis[f]) return;
    const tri = this.headTri(p.hc, p.D, p.n, hs);
    const hp = this.headProj[i];
    for (let j = 0; j < 3; j++) this.project(tri[j][0], tri[j][1], tri[j][2], hp, j * 2);
    const path = target[f];
    path.moveTo(hp[0], hp[1]);
    path.lineTo(hp[2], hp[3]);
    path.lineTo(hp[4], hp[5]);
    path.closePath();
  }

  _drawHighlighted(i, st, wpx, hs) {
    const ctx = this.ctx;
    const strokes = [], heads = [], caps = [];
    for (let f = 0; f < 6; f++) {
      strokes[f] = this.vis[f] ? new Path2D() : null;
      heads[f] = this.vis[f] ? new Path2D() : null;
      caps[f] = this.vis[f] ? new Path2D() : null;
    }
    this._addRuns(strokes, i, caps, wpx / 2);
    this._addHead(heads, i, hs);
    // Heiligenschein als EIN Strich über alles (keine dunkleren Überlappungen)
    const union = new Path2D();
    for (let f = 0; f < 6; f++) if (strokes[f]) { union.addPath(strokes[f]); union.addPath(heads[f]); union.addPath(caps[f]); }
    const red = st.color === 'red';
    const mixK = st.mix == null ? 1 : st.mix;
    const k = clamp(st.k == null ? 1 : st.k, 0, 1);
    const col = red ? this.C.red : this.C.blue;
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    ctx.globalAlpha = (0.2 + 0.2 * k) * Math.max(0.35, mixK);
    ctx.strokeStyle = red ? this.C.red : this.C.blue;
    ctx.lineWidth = wpx * (2.5 + 0.7 * k);
    ctx.stroke(union);
    for (let f = 0; f < 6; f++) {
      if (!this.vis[f]) continue;
      const alpha = smoothstep(0.015, 0.22, this.facing[f]);
      if (alpha <= 0.01) continue;
      if (mixK < 1) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.C.ink; ctx.fillStyle = this.C.ink;
        ctx.lineWidth = wpx;
        ctx.stroke(strokes[f]); ctx.fill(caps[f]);
        ctx.lineWidth = wpx * 0.42;
        ctx.fill(heads[f]); ctx.stroke(heads[f]);
      }
      ctx.globalAlpha = alpha * mixK;
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.lineWidth = wpx;
      ctx.stroke(strokes[f]); ctx.fill(caps[f]);
      ctx.lineWidth = wpx * 0.42;
      ctx.fill(heads[f]); ctx.stroke(heads[f]);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Zeichnet einen animierten Pfeil auf der verlängerten Bahn, Ausschnitt [an.a, an.b].
   * which: 'all' | 'on' (nur Teile auf dem Würfel) | 'off' (nur Teile im All)
   */
  _drawAnim(an, wpx, hs, which) {
    const ctx = this.ctx;
    const path = this.exitPath(an.id);
    const sp = subPath(path, an.a, an.b);
    const n = sp.pts.length;
    const pr = new Float64Array(n * 2);
    for (let k = 0; k < n; k++) this.project(sp.pts[k][0], sp.pts[k][1], sp.pts[k][2], pr, k * 2);
    const headVis = this.vis[path.headFace];
    const segOk = (f) => {
      if (f === -1) return which === 'off' ? true : which === 'all';
      if (which === 'off') return false;
      return !!this.vis[f];
    };
    const stroke = new Path2D();
    let pen = false;
    for (let k = 0; k < n - 1; k++) {
      const f = sp.seg[k];
      if (!segOk(f)) { pen = false; continue; }
      if (!pen) stroke.moveTo(pr[k * 2], pr[k * 2 + 1]);
      stroke.lineTo(pr[k * 2 + 2], pr[k * 2 + 3]);
      pen = true;
    }
    const headOk = segOk(sp.headSeg) && (sp.headSeg !== -1 || which === 'off' || headVis);
    const headPath = new Path2D();
    if (headOk) {
      const tri = this.headTri(sp.pts[n - 1], sp.tan, sp.nrm, hs);
      const t = tri.map((p) => this.p2(p));
      headPath.moveTo(t[0][0], t[0][1]);
      headPath.lineTo(t[1][0], t[1][1]);
      headPath.lineTo(t[2][0], t[2][1]);
      headPath.closePath();
    }
    const col = an.color === 'red' ? this.C.red : an.color === 'blue' ? this.C.blue : this.C.ink;
    const alpha = an.alpha == null ? 1 : an.alpha;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (an.glow) {
      const union = new Path2D();
      union.addPath(stroke); union.addPath(headPath);
      ctx.globalAlpha = alpha * an.glow * 0.32;
      ctx.strokeStyle = this.C.blue;
      ctx.lineWidth = wpx * 2.6;
      ctx.stroke(union);
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = wpx;
    ctx.stroke(stroke);
    ctx.lineWidth = wpx * 0.42;
    ctx.fill(headPath); ctx.stroke(headPath);
    ctx.restore();
  }

  /** Welche Seite liegt unter dem Bildschirmpunkt? (-1 = keine) */
  faceAt(x, y) {
    for (let f = 0; f < 6; f++) if (this.vis[f] && this.facePolys[f] && pointInPoly(x, y, this.facePolys[f])) return f;
    return -1;
  }

  /**
   * Nächstgelegener Pfeil zum Tipp-Punkt (CSS-px relativ zur Canvas), oder -1.
   * skip(id) → true, um Pfeile auszulassen (entfernt/animiert).
   */
  hitTest(x, y, skip) {
    if (!this.ready || !this.facePolys) return -1;
    const tapped = this.faceAt(x, y);
    let best = -1, bestD = Infinity;
    for (let i = 0; i < this.paths.length; i++) {
      if (skip && skip(i)) continue;
      const d = this.arrowDist(i, x, y, tapped);
      if (d < bestD) { bestD = d; best = i; }
    }
    const thr = Math.max(22, Math.min(40, this.cellPx * 0.55));
    return bestD <= thr ? best : -1;
  }

  arrowDist(i, x, y, tapped = -2) {
    const p = this.paths[i];
    const pr = this.proj[i];
    let best = Infinity;
    for (let k = 0; k < p.seg.length; k++) {
      const f = p.seg[k];
      if (!this.vis[f] || this.facing[f] < 0.1) continue;
      let d = distToSeg(x, y, pr[k * 2], pr[k * 2 + 1], pr[k * 2 + 2], pr[k * 2 + 3]);
      if (tapped >= 0 && f !== tapped) d += 7;
      if (d < best) best = d;
    }
    const hf = p.headFace;
    if (this.vis[hf] && this.facing[hf] >= 0.1) {
      const tip = this.p2(madd(p.hc, p.D, 0.43 * this.geo.h * this.headScale()));
      const n = p.pts.length - 1;
      let d = distToSeg(x, y, pr[n * 2], pr[n * 2 + 1], tip[0], tip[1]);
      if (tapped >= 0 && hf !== tapped) d += 7;
      if (d < best) best = d;
    }
    return best;
  }

  /** Wie gut ist Pfeil i gerade sichtbar? 0..1 (Anteil sichtbarer Länge × Ausrichtung) */
  visibility(i) {
    const p = this.paths[i];
    if (!p) return 0;
    let tot = 0, v = 0;
    for (let k = 0; k < p.seg.length; k++) {
      const l = p.arcs[k + 1] - p.arcs[k];
      tot += l;
      const f = p.seg[k];
      if (this.vis[f]) v += l * clamp(this.facing[f] * 1.6, 0, 1);
    }
    const head = this.vis[p.headFace] ? clamp(this.facing[p.headFace] * 1.6, 0, 1) : 0;
    return tot > 0 ? 0.5 * (v / tot) + 0.5 * head : head;
  }

  /** Ein Bildschirmpunkt (CSS-px), an dem ein Tipp Pfeil i trifft – oder null. */
  tapPointFor(i, skip) {
    const p = this.paths[i];
    const pr = this.proj[i];
    const cands = [];
    for (let k = 0; k < p.seg.length; k++) {
      const f = p.seg[k];
      if (!this.vis[f] || this.facing[f] < 0.25) continue;
      for (const t of [0.5, 0.25, 0.75, 0]) {
        cands.push([pr[k * 2] + (pr[k * 2 + 2] - pr[k * 2]) * t, pr[k * 2 + 1] + (pr[k * 2 + 3] - pr[k * 2 + 1]) * t]);
      }
    }
    const n = p.pts.length - 1;
    if (this.vis[p.headFace] && this.facing[p.headFace] >= 0.25) cands.unshift([pr[n * 2], pr[n * 2 + 1]]);
    for (const c of cands) {
      if (c[0] < 4 || c[1] < 4 || c[0] > this.w - 4 || c[1] > this.h - 4) continue;
      if (this.hitTest(c[0], c[1], skip) === i) return { x: c[0], y: c[1] };
    }
    return null;
  }

  /** Bildschirmposition (CSS-px) eines 3D-Punkts mit dem letzten Projektions-Setup. */
  screenOf(v) { return this.p2(v); }
}

