// Mandala-Generator: radialsymmetrische Ringe aus Blättern, Bögen, Kacheln, Wellen, Sternen,
// Zacken und Perlen. Formen in Maler-Reihenfolge (spätere liegen oben). Jede Ebene ist so
// gebaut, dass der sichtbare Teil jeder Form zusammenhängend bleibt (eine Zahl pro Fläche).

import { makeRng, hashString } from '../../../shared/rng.js';
import { MANDALA_PALETTES } from './palettes.js';
import { hexToLab, deltaE } from './color.js';
import { fmt, finalizePuzzle, TAU } from './util.js';

const CX = 500, CY = 500;
const F = (v) => fmt(v, 1);
const pol = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
const pt = (p) => F(p[0]) + ' ' + F(p[1]);

function circlePath(x, y, r) {
  return `M${F(x - r)} ${F(y)}A${F(r)} ${F(r)} 0 1 0 ${F(x + r)} ${F(y)}A${F(r)} ${F(r)} 0 1 0 ${F(x - r)} ${F(y)}Z`;
}
function circlePoly(x, y, r, n = 28) {
  const out = [];
  for (let i = 0; i < n; i++) out.push([x + r * Math.cos((i / n) * TAU), y + r * Math.sin((i / n) * TAU)]);
  return out;
}
function piePath(r, a1, a2) {
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M${CX} ${CY}L${pt(pol(r, a1))}A${F(r)} ${F(r)} 0 ${large} 1 ${pt(pol(r, a2))}Z`;
}
function polyD(pts) {
  return 'M' + pts.map(pt).join('L') + 'Z';
}

// ---------- Geometrie-Helfer ----------

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return Math.sqrt(qx * qx + qy * qy);
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Abstand eines Punktes zum nächsten Rand der Polygone (negativ, wenn darin). */
function clearance(x, y, polys) {
  let best = Infinity;
  for (const poly of polys) {
    let d = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      d = Math.min(d, segDist(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
    }
    if (pointInPoly(x, y, poly)) d = -d;
    best = Math.min(best, d);
  }
  return best;
}

function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function cubicPts(p0, p1, p2, p3, n = 10) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

// ---------- Blätter ----------

// Rechte Hälfte eines Blattes in normierten Koordinaten (x: 0 = Basis, 1 = Spitze; y: Anteil der Halbbreite).
const PETALS = {
  mandel: { start: 0, segs: [[[0.22, 1.25], [0.62, 1.25], [1, 0]]] },
  blatt: { start: 0, segs: [[[0.04, 0.95], [0.5, 1.5], [1, 0]]] },
  tropfen: { start: 0, segs: [[[0.12, 0.2], [0.34, 1.0], [0.66, 1.0]], [[0.9, 1.0], [1.0, 0.56], [1.0, 0]]] },
  bogen: { start: 0.92, segs: [[[0.5, 1.02], [0.82, 0.74], [1, 0]]] },
  flamme: { start: 0, segs: [[[0.3, 1.3], [0.5, 0.2], [1, 0]]] },
  knospe: { start: 0.55, segs: [[[0.35, 1.25], [0.85, 0.95], [1, 0]]] },
};

/**
 * Baut ein Blatt entlang des Strahls mit Winkel `a`, von Radius r0 (Basis) bis r1 (Spitze),
 * Halbbreite W. Liefert { d, poly }.
 */
function petalShape(style, r0, r1, a, W, CX = 500, CY = 500) {
  const st = PETALS[style];
  const L = r1 - r0;
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const P = (x, y) => [CX + ux * (r0 + x * L) + vx * y * W, CY + uy * (r0 + x * L) + vy * y * W];
  const right = [];
  let cur = [0, st.start];
  const rightSegs = [];
  for (const seg of st.segs) {
    const p0 = P(cur[0], cur[1]);
    const c1 = P(seg[0][0], seg[0][1]), c2 = P(seg[1][0], seg[1][1]), p3 = P(seg[2][0], seg[2][1]);
    rightSegs.push([c1, c2, p3]);
    right.push(...cubicPts(p0, c1, c2, p3));
    cur = seg[2];
  }
  // linke Hälfte = gespiegelt, rückwärts
  const leftSegs = [];
  const segsRev = st.segs.slice().reverse();
  for (let i = 0; i < segsRev.length; i++) {
    const seg = segsRev[i];
    const startPt = i + 1 < segsRev.length ? segsRev[i + 1][2] : [0, st.start];
    leftSegs.push([P(seg[1][0], -seg[1][1]), P(seg[0][0], -seg[0][1]), P(startPt[0], -startPt[1])]);
  }
  const start = P(0, st.start);
  let d = 'M' + pt(start);
  for (const [c1, c2, p] of rightSegs) d += 'C' + pt(c1) + ' ' + pt(c2) + ' ' + pt(p);
  for (const [c1, c2, p] of leftSegs) d += 'C' + pt(c1) + ' ' + pt(c2) + ' ' + pt(p);
  d += 'Z';
  const poly = [start, ...right];
  // linke Hälfte als gespiegelte Punkte
  const leftPoly = right.slice(0, -1).reverse().map(([x, y]) => {
    // Spiegeln an der Achse: Punkt in lokale Koordinaten, y negieren
    const dx = x - CX, dy = y - CY;
    const s = dx * ux + dy * uy, t = dx * vx + dy * vy;
    return [CX + ux * s - vx * t, CY + uy * s - vy * t];
  });
  poly.push(...leftPoly);
  if (st.start > 0) {
    poly.push(P(0, -st.start));
  }
  return { d, poly };
}

/**
 * Grösste Halbbreite, bei der das Blatt im Winkelbereich ±half bleibt
 * (mit mindestens `gap` Einheiten Abstand zur Bereichsgrenze).
 */
function fitPetalWidth(style, r0, r1, a, half, maxW, gap = 2.5, cx = CX, cy = CY, rHide = 0) {
  let lo = 0, hi = maxW;
  for (let it = 0; it < 18; it++) {
    const W = (lo + hi) / 2;
    const { poly } = petalShape(style, r0, r1, a, W, cx, cy);
    let ok = true;
    for (const [x, y] of poly) {
      const r = Math.hypot(x - cx, y - cy);
      if (r < 1e-6 || r < rHide) continue;
      const lim = half - Math.min(half * 0.9, gap / r);
      if (Math.abs(angDiff(Math.atan2(y - cy, x - cx), a)) > lim) { ok = false; break; }
    }
    if (ok) lo = W; else hi = W;
  }
  return lo;
}

// ---------- Farbwahl ----------

class ColorPicker {
  constructor(rng, colors) {
    this.rng = rng;
    this.colors = colors;
    this.labs = colors.map(hexToLab);
    this.use = colors.map(() => 0);
  }
  dist(i, j) { return deltaE(this.labs[i], this.labs[j]); }
  /** Wählt eine Farbe mit Mindestabstand zu allen in `avoid`. */
  pick(avoid = [], minD = 24) {
    const av = avoid.filter((x) => x != null);
    for (let d = minD; d >= 0; d -= 4) {
      const cand = [];
      for (let i = 0; i < this.colors.length; i++) {
        if (av.includes(i)) continue;
        if (av.every((j) => this.dist(i, j) >= d)) cand.push(i);
      }
      if (cand.length) {
        const w = cand.map((i) => 1 / Math.pow(1 + this.use[i], 1.6));
        let s = w.reduce((a, b) => a + b, 0) * this.rng.next();
        for (let k = 0; k < cand.length; k++) {
          s -= w[k];
          if (s <= 0) { this.use[cand[k]]++; return cand[k]; }
        }
        this.use[cand[cand.length - 1]]++;
        return cand[cand.length - 1];
      }
    }
    return 0;
  }
}

// ---------- Generator ----------

export function makeMandala(seed) {
  // Einige Versuche, bis die Flächenzahl gut passt (deterministisch).
  let best = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const p = buildMandala(seed, attempt);
    const n = p.shapes.length;
    if (n >= 140 && n <= 330) return p;
    const score = n < 140 ? 140 - n : n - 330;
    if (!best || score < best.score) best = { p, score };
  }
  return best.p;
}

function buildMandala(seed, attempt) {
  const rng = makeRng(hashString('mandala:' + seed + (attempt ? ':' + attempt : '')));
  const palDef = MANDALA_PALETTES[(hashString('mpal' + seed) % MANDALA_PALETTES.length)];
  const cp = new ColorPicker(rng, palDef.colors);
  const shapes = [];
  const add = (d, c, poly) => { shapes.push({ d, c }); return poly; };

  const N0 = rng.pick([8, 10, 12, 12, 12, 16]);
  const R0 = rng.range(452, 474);
  const silhouette = rng.pick(['kreis', 'bogen', 'bogen', 'spitz']);

  // --- Hintergrund: vier Viertel + Eckornamente ---
  const bg = cp.pick([], 0);
  for (const [x, y] of [[0, 0], [500, 0], [500, 500], [0, 500]]) {
    add(`M${x} ${y}H${x + 500}V${y + 500}H${x}Z`, bg);
  }
  drawCorners(rng, cp, add, bg, R0);

  // --- Planung der Ringe ---
  const rCenter = rng.range(30, 46);
  const centerW = rng.range(48, 70);
  const sDepth = silhouette === 'kreis' ? 0 : rng.range(16, 26);
  const outerR = R0 - sDepth;
  const avail = outerR - (rCenter + centerW);
  const MAJORS = ['blaetter', 'boegen', 'kacheln', 'wellen', 'stern', 'zacken', 'blaetter'];
  const WIDTH = { blaetter: [80, 120], boegen: [60, 85], kacheln: [42, 62], wellen: [52, 78], stern: [62, 96], zacken: [40, 58], perlen: [20, 28], ring: [8, 13] };
  const plan = [];
  let sum = 0;
  let lastMajor = null;
  const firstMajor = rng.pick(['blaetter', 'boegen', 'blaetter', 'wellen', 'zacken']);
  while (sum < avail * 0.95) {
    let type = plan.length === 0 ? firstMajor : rng.pick(MAJORS);
    let guard = 0;
    while (type === lastMajor && guard++ < 10) type = rng.pick(MAJORS);
    lastMajor = type;
    const w = rng.range(WIDTH[type][0], WIDTH[type][1]);
    plan.push({ type, w });
    sum += w;
    if (sum >= avail * 0.95) break;
    const sep = rng.next();
    if (sep < 0.42) { const ww = rng.range(...WIDTH.perlen); plan.push({ type: 'perlen', w: ww }); sum += ww; }
    else if (sep < 0.8) { const ww = rng.range(...WIDTH.ring); plan.push({ type: 'ring', w: ww }); sum += ww; }
  }
  // Letzter Ring sollte kein Trenner sein
  while (plan.length && (plan[plan.length - 1].type === 'ring' || plan[plan.length - 1].type === 'perlen')) {
    sum -= plan.pop().w;
  }
  const scale = avail / sum;
  for (const b of plan) b.w *= scale;
  plan.push({ type: 'blaetter', w: centerW, center: true });

  // --- Ringe zeichnen (aussen nach innen) ---
  let r = outerR;
  let outerAvoid = [bg];
  let rotFlip = rng.chance(0.5);
  for (let bi = 0; bi < plan.length; bi++) {
    const band = plan[bi];
    const rOut = r, rIn = r - band.w;
    const mid = (rIn + rOut) / 2;
    let N = N0;
    const per = (TAU * mid) / N0;
    if (band.type === 'perlen' || band.type === 'zacken' || band.type === 'kacheln') {
      if (per > 120) N = N0 * 2;
    } else if (band.type === 'blaetter' && !band.center) {
      if (per > 230) N = N0 * 2;
    } else if (band.type === 'wellen' || band.type === 'boegen' || band.type === 'stern') {
      if (per > 170) N = N0 * 2;
    }
    if (band.center && N0 >= 12 && rng.chance(0.5)) N = N0 / 2;
    if ((TAU * mid) / N < 34 && N % 2 === 0 && N > 8) N = N / 2;
    rotFlip = !rotFlip;
    const rot = -Math.PI / 2 + (rotFlip ? Math.PI / N : 0);
    const ctx = { rng, cp, add, rIn, rOut, N, rot, avoid: outerAvoid };
    if (bi === 0 && silhouette !== 'kreis') ctx.silhouette = { type: silhouette, R0, N: N0 * (rng.chance(0.5) ? 2 : 1) };
    outerAvoid = BANDS[band.type](ctx);
    r = rIn;
  }
  // Mitte
  const c1 = cp.pick(outerAvoid, 26);
  add(circlePath(CX, CY, r), c1);
  const c2 = cp.pick([c1], 30);
  add(circlePath(CX, CY, r * rng.range(0.38, 0.5)), c2);

  const puzzle = {
    id: 'gen-mandala-' + seed,
    title: 'Mandala ' + seed,
    category: 'Mandalas',
    width: 1000,
    height: 1000,
    palette: palDef.colors.slice(),
    shapes,
  };
  return finalizePuzzle(puzzle);
}

// ---------- Silhouette (äusserster Rand, ersetzt die Basisscheibe des ersten Rings) ----------

function baseDisc(ctx, c) {
  if (ctx.silhouette) {
    const s = ctx.silhouette;
    ctx.add(wavePath(s.type, s.R0, s.R0 - ctx.rOut, s.N, -Math.PI / 2).d, c);
  } else {
    ctx.add(circlePath(CX, CY, ctx.rOut), c);
  }
}

// ---------- Ringtypen. Jeder liefert die Farben, die den inneren Rand berühren. ----------

const BANDS = {
  ring(ctx) {
    const c = ctx.cp.pick(ctx.avoid, 26);
    baseDisc(ctx, c);
    return [c];
  },

  perlen(ctx) {
    const { rng, cp, rIn, rOut, N, rot } = ctx;
    const base = cp.pick(ctx.avoid, 26);
    baseDisc(ctx, base);
    const w = rOut - rIn, rm = (rIn + rOut) / 2;
    const rho = w * rng.range(0.27, 0.33);
    let M = N;
    while ((TAU * rm) / (M * 2) >= rho * 3.4) M *= 2;
    if ((TAU * rm) / M < rho * 3.2 && M > N) M /= 2;
    const dot = cp.pick([base], 30);
    for (let k = 0; k < M; k++) {
      const p = pol(rm, rot + (k * TAU) / M);
      ctx.add(circlePath(p[0], p[1], rho), dot);
    }
    return [base];
  },

  blaetter(ctx) {
    const { rng, cp, rIn, rOut, N, rot } = ctx;
    const w = rOut - rIn;
    const base = cp.pick(ctx.avoid, 22);
    baseDisc(ctx, base);
    const style = rng.pick(['mandel', 'blatt', 'tropfen', 'bogen', 'mandel', 'flamme', 'knospe']);
    const alt = rng.chance(0.35);
    const r0 = Math.max(rIn - 3, rIn * 0.85);
    const L = w * rng.range(0.82, 0.92);
    const r1 = rIn + L;
    const petalC = cp.pick([base], 28);
    const petalC2 = alt ? cp.pick([base, petalC], 22) : petalC;
    const halfA = alt ? (Math.PI / N) * 0.6 : (Math.PI / N) * 0.9;
    const W = fitPetalWidth(style, r0, r1, rot, halfA, L * 0.55, 2.5, CX, CY, rIn + 0.5);
    const polys = [];
    const inner = rng.chance(0.62);
    const innerC = cp.pick([petalC, petalC2], 26);
    const innerStyle = rng.chance(0.7) ? style : 'mandel';
    for (let k = 0; k < N && W >= 5; k++) {
      const a = rot + (k * TAU) / N;
      const p = petalShape(style, r0, r1, a, W);
      ctx.add(p.d, petalC);
      polys.push(p.poly);
    }
    let shortPolys = [];
    if (alt && W >= 6) {
      const r1s = rIn + L * rng.range(0.5, 0.66);
      const Ws = fitPetalWidth(style, r0, r1s, rot + Math.PI / N, (Math.PI / N) * 0.34, L * 0.4, 2.5, CX, CY, rIn + 0.5);
      for (let k = 0; k < N && Ws >= 5; k++) {
        const a = rot + Math.PI / N + (k * TAU) / N;
        const p = petalShape(style, r0, r1s, a, Ws);
        ctx.add(p.d, petalC2);
        shortPolys.push(p.poly);
      }
    }
    // Innenblätter
    if (inner && W > 9) {
      const s0 = rIn + L * 0.14;
      const s1 = rIn + L * rng.range(0.62, 0.74);
      const Wi = fitPetalWidth(innerStyle, s0, s1, rot, (Math.PI / N) * 0.9, W * 0.48, 2.5, CX, CY, rIn + 0.5);
      // Sicherstellen, dass das Innenblatt im Blatt liegt (Rand bleibt sichtbar)
      const test = petalShape(innerStyle, s0, s1, rot, Wi);
      const outer = petalShape(style, r0, r1, rot, W);
      const fits = Wi >= 4 && test.poly.every(([x, y]) => clearance(x, y, [outer.poly]) < -2.5);
      if (fits) {
        for (let k = 0; k < N; k++) {
          const a = rot + (k * TAU) / N;
          ctx.add(petalShape(innerStyle, s0, s1, a, Wi).d, innerC);
        }
      }
    } else if (W > 14 && rng.chance(0.6)) {
      // Punkt im Blatt
      const outer = petalShape(style, r0, r1, rot, W);
      const rr = rIn + L * 0.5;
      const pc = pol(rr, rot);
      const cl = -clearance(pc[0], pc[1], [outer.poly]);
      if (cl > 8) {
        const rho = Math.min(cl * 0.5, 18);
        for (let k = 0; k < N; k++) {
          const p = pol(rr, rot + (k * TAU) / N);
          ctx.add(circlePath(p[0], p[1], rho), innerC);
        }
      }
    }
    // Punkte zwischen den Blättern
    if (!alt && rng.chance(0.65)) {
      const a = rot + Math.PI / N;
      let best = null;
      for (let f = 0.55; f <= 0.9; f += 0.05) {
        const rr = rIn + w * f;
        const p = pol(rr, a);
        const cl = clearance(p[0], p[1], polys);
        const rho = Math.min(cl * 0.62, rOut - rr - 4, w * 0.16);
        if (!best || rho > best.rho) best = { rr, rho };
      }
      if (best && best.rho >= 5) {
        const dc = cp.pick([base, petalC], 26);
        for (let k = 0; k < N; k++) {
          const p = pol(best.rr, a + (k * TAU) / N);
          ctx.add(circlePath(p[0], p[1], best.rho), dc);
        }
      }
    }
    return alt ? [base, petalC, petalC2] : [base, petalC];
  },

  boegen(ctx) {
    const { rng, cp, rIn, rOut, N, rot } = ctx;
    const w = rOut - rIn;
    const s1 = Math.sin(Math.PI / N), c1 = Math.cos(Math.PI / N), s2 = Math.sin((2 * Math.PI) / N);
    const margin = w * rng.range(0.1, 0.16);
    // Suche Mittelpunktradius rc, so dass sich Nachbarkreise schneiden, übernächste nicht,
    // und der innere Schnittpunkt unter rIn liegt.
    let best = null;
    for (let rc = rIn; rc < rOut; rc += 0.5) {
      const rho = rOut - margin - rc;
      if (rho <= rc * s1 * 1.06) continue;
      if (rho >= rc * s2 * 0.94) continue;
      const disc = rho * rho - rc * rc * s1 * s1;
      const tIn = rc * c1 - Math.sqrt(disc);
      const tOut = rc * c1 + Math.sqrt(disc);
      if (tIn > rIn - 5) continue;
      if (tOut < rIn + 0.3 * w) continue;
      if (!best || rc < best.rc) best = { rc, rho };
    }
    if (!best) return BANDS.wellen(ctx);
    const { rc, rho } = best;
    const base = cp.pick(ctx.avoid, 22);
    baseDisc(ctx, base);
    const circC = cp.pick([base], 28);
    const circC2 = N % 2 === 0 && rng.chance(0.4) ? cp.pick([base, circC], 22) : circC;
    const lensC = cp.pick([base, circC, circC2], 24);
    const centers = [];
    for (let k = 0; k < N; k++) {
      const o = pol(rc, rot + (k * TAU) / N);
      centers.push(o);
      ctx.add(circlePath(o[0], o[1], rho), k % 2 ? circC2 : circC);
    }
    const lensPolys = [];
    for (let k = 0; k < N; k++) {
      const o1 = centers[k], o2 = centers[(k + 1) % N];
      const am = rot + ((k + 0.5) * TAU) / N;
      const disc = rho * rho - rc * rc * s1 * s1;
      const pOut = pol(rc * c1 + Math.sqrt(disc), am);
      const pIn = pol(rc * c1 - Math.sqrt(disc), am);
      // Bogen von pOut nach pIn auf Kreis 1 (Seite zu o2 hin), zurück auf Kreis 2
      const sweep1 = arcSweep(o1, pOut, pIn, o2);
      const sweep2 = arcSweep(o2, pIn, pOut, o1);
      ctx.add(`M${pt(pOut)}A${F(rho)} ${F(rho)} 0 0 ${sweep1} ${pt(pIn)}A${F(rho)} ${F(rho)} 0 0 ${sweep2} ${pt(pOut)}Z`, lensC);
      lensPolys.push(lensPoly(o1, o2, rho, pOut, pIn));
    }
    // Punkte in den Kreisen
    if (rng.chance(0.55)) {
      const a = rot;
      const blockers = [lensPolys[0], lensPolys[N - 1], circlePoly(CX, CY, rIn, 72)];
      let bestD = null;
      for (let f = 0; f <= 0.8; f += 0.1) {
        const rr = rc + rho * f * 0.6;
        const p = pol(rr, a);
        const cl = Math.min(clearance(p[0], p[1], blockers.slice(0, 2)), Math.hypot(p[0] - CX, p[1] - CY) - rIn, rc + rho - rr);
        const rad = cl * 0.5;
        if (!bestD || rad > bestD.rad) bestD = { rr, rad };
      }
      if (bestD && bestD.rad >= 5) {
        const dc = cp.pick([circC, circC2], 26);
        const rad = Math.min(bestD.rad, 20);
        for (let k = 0; k < N; k++) {
          const p = pol(bestD.rr, a + (k * TAU) / N);
          ctx.add(circlePath(p[0], p[1], rad), dc);
        }
      }
    }
    // Punkte zwischen den Bögen (aussen)
    if (rng.chance(0.5)) {
      const am = rot + Math.PI / N;
      const circs = [circlePoly(centers[0][0], centers[0][1], rho, 40), circlePoly(centers[1][0], centers[1][1], rho, 40)];
      const disc = rho * rho - rc * rc * s1 * s1;
      const rTop = rc * c1 + Math.sqrt(disc);
      let bestD = null;
      for (let rr = rTop + 4; rr < rOut - 4; rr += 1) {
        const p = pol(rr, am);
        const cl = Math.min(clearance(p[0], p[1], circs), rOut - rr);
        if (!bestD || cl > bestD.cl) bestD = { rr, cl };
      }
      if (bestD && bestD.cl * 0.6 >= 5) {
        const dc = cp.pick([base], 28);
        const rad = Math.min(bestD.cl * 0.6, 16);
        for (let k = 0; k < N; k++) {
          const p = pol(bestD.rr, am + (k * TAU) / N);
          ctx.add(circlePath(p[0], p[1], rad), dc);
        }
      }
    }
    return [circC, circC2, lensC];
  },

  kacheln(ctx) {
    const { rng, cp, rIn, rOut, N, rot } = ctx;
    const w = rOut - rIn;
    const a = cp.pick(ctx.avoid, 22);
    const b = cp.pick([...ctx.avoid, a], 22);
    if (ctx.silhouette) baseDisc(ctx, a);
    const M = N;
    const step = TAU / M;
    for (let k = 0; k < M; k++) {
      ctx.add(piePath(rOut, rot + k * step, rot + (k + 1) * step), k % 2 ? b : a);
    }
    // Motiv in jeder Kachel
    const motif = rng.pick(['punkt', 'raute', 'raute', 'none']);
    const rm = rIn + w * 0.5;
    const half = rm * Math.sin(step / 2);
    if (motif === 'punkt') {
      const rho = Math.min(w * 0.3, half * 0.55);
      if (rho >= 5) {
        const ca = cp.pick([a, b], 26), cb = rng.chance(0.5) ? ca : cp.pick([a, b, ca], 20);
        for (let k = 0; k < M; k++) {
          const p = pol(rm, rot + (k + 0.5) * step);
          ctx.add(circlePath(p[0], p[1], rho), k % 2 ? cb : ca);
        }
      }
    } else if (motif === 'raute') {
      const hr = w * 0.36, ha = Math.min(half * 0.5, w * 0.3);
      if (ha >= 6) {
        const ca = cp.pick([a, b], 26);
        for (let k = 0; k < M; k++) {
          const am = rot + (k + 0.5) * step;
          const pts = [pol(rm - hr, am), null, pol(rm + hr, am), null];
          const c = pol(rm, am);
          const vx = -Math.sin(am), vy = Math.cos(am);
          pts[1] = [c[0] + vx * ha, c[1] + vy * ha];
          pts[3] = [c[0] - vx * ha, c[1] - vy * ha];
          ctx.add(polyD(pts), ca);
        }
      }
    }
    return [a, b];
  },

  wellen(ctx) {
    const { rng, cp, rIn, rOut, N, rot } = ctx;
    const w = rOut - rIn;
    const base = cp.pick(ctx.avoid, 22);
    baseDisc(ctx, base);
    const waveC = cp.pick([base], 28);
    const rv = rIn + w * rng.range(0.2, 0.3);
    const rp = rIn + w * rng.range(0.72, 0.84);
    const pointed = rng.chance(0.4);
    const rotPath = wavePath(pointed ? 'spitz' : 'bogen', rp, rp - rv, N, rot);
    ctx.add(rotPath.d, waveC);
    const polyW = rotPath.poly;
    // Punkte in den Wellen
    if (rng.chance(0.7)) {
      const rr = (rv + rp) / 2 + (rp - rv) * 0.05;
      const p = pol(rr, rot);
      const cl = Math.min(-clearance(p[0], p[1], [polyW]), rr - rIn);
      const rho = Math.min(cl * 0.55, 16);
      if (rho >= 5) {
        const dc = cp.pick([waveC], 28);
        for (let k = 0; k < N; k++) {
          const q = pol(rr, rot + (k * TAU) / N);
          ctx.add(circlePath(q[0], q[1], rho), dc);
        }
      }
    }
    // Punkte zwischen den Wellen (aussen)
    if (rng.chance(0.6)) {
      const am = rot + Math.PI / N;
      let bestD = null;
      for (let rr = rv + 4; rr < rOut - 4; rr += 1) {
        const p = pol(rr, am);
        const cl = Math.min(clearance(p[0], p[1], [polyW]), rOut - rr);
        if (!bestD || cl > bestD.cl) bestD = { rr, cl };
      }
      if (bestD && bestD.cl * 0.6 >= 5) {
        const dc = cp.pick([base, waveC], 26);
        const rad = Math.min(bestD.cl * 0.6, 16);
        for (let k = 0; k < N; k++) {
          const p = pol(bestD.rr, am + (k * TAU) / N);
          ctx.add(circlePath(p[0], p[1], rad), dc);
        }
      }
    }
    return [waveC];
  },

  stern(ctx) {
    const { rng, cp, rIn, rOut, N, rot } = ctx;
    const w = rOut - rIn;
    const base = cp.pick(ctx.avoid, 22);
    baseDisc(ctx, base);
    const starC = cp.pick([base], 28);
    const rInner = rIn + w * rng.range(0.18, 0.26);
    const rTip = rIn + w * rng.range(0.84, 0.92);
    const concave = rng.chance(0.5);
    const step = TAU / N;
    let d = '';
    const poly = [];
    for (let k = 0; k < N; k++) {
      const at = rot + k * step;
      const tip = pol(rTip, at);
      const v = pol(rInner, at + step / 2);
      if (k === 0) d = 'M' + pt(tip);
      if (concave) {
        const cc = pol(rInner + (rTip - rInner) * 0.18, at + step * 0.18);
        d += 'Q' + pt(cc) + ' ' + pt(v);
        const t2 = pol(rTip, at + step);
        const cc2 = pol(rInner + (rTip - rInner) * 0.18, at + step * 0.82);
        d += 'Q' + pt(cc2) + ' ' + pt(t2);
      } else {
        d += 'L' + pt(v) + 'L' + pt(pol(rTip, at + step));
      }
      poly.push(tip, v);
    }
    ctx.add(d + 'Z', starC);
    // Rauten in den Zacken
    if (rng.chance(0.6)) {
      const r0 = rInner + (rTip - rInner) * 0.12, r1 = rInner + (rTip - rInner) * 0.62;
      const rm = (r0 + r1) / 2;
      // Halbbreite des Zackens bei rm (linear)
      const frac = (rm - rInner) / (rTip - rInner);
      const halfAt = (1 - frac) * rInner * Math.sin(step / 2) * (concave ? 0.6 : 1);
      const ha = halfAt * 0.42;
      if (ha >= 4.5) {
        const kc = cp.pick([starC], 28);
        for (let k = 0; k < N; k++) {
          const at = rot + k * step;
          const c = pol(rm, at);
          const vx = -Math.sin(at), vy = Math.cos(at);
          ctx.add(polyD([pol(r0, at), [c[0] + vx * ha, c[1] + vy * ha], pol(r1, at), [c[0] - vx * ha, c[1] - vy * ha]]), kc);
        }
      }
    }
    // Punkte zwischen den Zacken
    if (rng.chance(0.7)) {
      const am = rot + step / 2;
      let bestD = null;
      for (let rr = rInner + 4; rr < rOut - 4; rr += 1) {
        const p = pol(rr, am);
        const cl = Math.min(clearance(p[0], p[1], [poly]), rOut - rr);
        if (!bestD || cl > bestD.cl) bestD = { rr, cl };
      }
      if (bestD && bestD.cl * 0.6 >= 5) {
        const dc = cp.pick([base, starC], 26);
        const rad = Math.min(bestD.cl * 0.6, 16);
        for (let k = 0; k < N; k++) {
          const p = pol(bestD.rr, am + k * step);
          ctx.add(circlePath(p[0], p[1], rad), dc);
        }
      }
    }
    return [starC];
  },

  zacken(ctx) {
    const { rng, cp, rIn, rOut, N, rot } = ctx;
    const w = rOut - rIn;
    const base = cp.pick(ctx.avoid, 22);
    baseDisc(ctx, base);
    const ca = cp.pick([base], 28);
    const cb = rng.chance(0.5) ? ca : cp.pick([base, ca], 22);
    const step = TAU / N;
    const r0 = rIn - 3;
    const rTip = rIn + w * rng.range(0.78, 0.88);
    const curved = rng.chance(0.55);
    const polys = [];
    for (let k = 0; k < N; k++) {
      const at = rot + k * step;
      const l = pol(r0, at - step / 2 + 0.002), rr = pol(r0, at + step / 2 - 0.002), tip = pol(rTip, at);
      let d;
      if (curved) {
        const cl = pol(rIn + w * 0.45, at - step * 0.32), cr = pol(rIn + w * 0.45, at + step * 0.32);
        d = `M${pt(l)}Q${pt(cl)} ${pt(tip)}Q${pt(cr)} ${pt(rr)}Z`;
      } else {
        d = `M${pt(l)}L${pt(tip)}L${pt(rr)}Z`;
      }
      ctx.add(d, k % 2 ? cb : ca);
      polys.push([l, tip, rr]);
    }
    // Punkte über den Lücken
    if (rng.chance(0.6)) {
      const am = rot + step / 2;
      const ps = [polys[0], polys[1]];
      let bestD = null;
      for (let rr = rIn + w * 0.3; rr < rOut - 4; rr += 1) {
        const p = pol(rr, am);
        const cl = Math.min(clearance(p[0], p[1], ps), rOut - rr);
        if (!bestD || cl > bestD.cl) bestD = { rr, cl };
      }
      if (bestD && bestD.cl * 0.6 >= 5) {
        const dc = cp.pick([base, ca], 26);
        const rad = Math.min(bestD.cl * 0.6, 14);
        for (let k = 0; k < N; k++) {
          const p = pol(bestD.rr, am + k * step);
          ctx.add(circlePath(p[0], p[1], rad), dc);
        }
      }
    }
    return [base, ca, cb];
  },
};

/** Gewellte Scheibe: Täler auf R0-depth, Wellenberge (rund oder spitz) bei rot + k*2π/N auf R0. */
function wavePath(type, R0, depth, N, rot) {
  const rv = R0 - depth;
  const step = TAU / N;
  const a0 = rot - step / 2;
  let d = 'M' + pt(pol(rv, a0));
  const poly = [];
  for (let k = 0; k < N; k++) {
    const a1 = a0 + k * step, a2 = a1 + step, am = a1 + step / 2;
    if (type === 'bogen') {
      const c = rv * Math.sin(step / 2);
      const sag = R0 - rv * Math.cos(step / 2);
      const rho = (c * c + sag * sag) / (2 * sag);
      d += `A${F(rho)} ${F(rho)} 0 ${sag > c ? 1 : 0} 1 ${pt(pol(rv, a2))}`;
      // Prüfpolygon: echter Kreisbogen
      const dirx = Math.cos(am), diry = Math.sin(am);
      const peak = pol(R0, am);
      const oc = [peak[0] - dirx * rho, peak[1] - diry * rho];
      const p1 = pol(rv, a1), p2 = pol(rv, a2);
      const b1 = Math.atan2(p1[1] - oc[1], p1[0] - oc[0]);
      let b2 = Math.atan2(p2[1] - oc[1], p2[0] - oc[0]);
      while (b2 < b1) b2 += TAU;
      for (let i = 0; i < 10; i++) {
        const b = b1 + ((b2 - b1) * i) / 10;
        poly.push([oc[0] + rho * Math.cos(b), oc[1] + rho * Math.sin(b)]);
      }
    } else {
      const pk = pol(R0, am);
      const p1 = pol(rv, a1), p2 = pol(rv, a2);
      const c1 = pol(rv + (R0 - rv) * 0.62, a1 + step * 0.06);
      const c2 = pol(R0 - (R0 - rv) * 0.25, am - step * 0.16);
      const c3 = pol(R0 - (R0 - rv) * 0.25, am + step * 0.16);
      const c4 = pol(rv + (R0 - rv) * 0.62, a2 - step * 0.06);
      d += 'C' + pt(c1) + ' ' + pt(c2) + ' ' + pt(pk) + 'C' + pt(c3) + ' ' + pt(c4) + ' ' + pt(p2);
      poly.push(p1, ...cubicPts(p1, c1, c2, pk, 6), ...cubicPts(pk, c3, c4, p2, 6));
    }
  }
  return { d: d + 'Z', poly };
}

function arcSweep(o, from, to, towards) {
  // Wählt sweep-flag so, dass der kleine Bogen von `from` nach `to` auf dem Kreis um `o`
  // durch die Seite verläuft, die `towards` zugewandt ist.
  const ang = (p) => Math.atan2(p[1] - o[1], p[0] - o[0]);
  const aF = ang(from), aT = ang(to);
  const aM = Math.atan2(towards[1] - o[1], towards[0] - o[0]);
  const norm = (x) => ((x % TAU) + TAU) % TAU;
  // sweep=1: Winkel wachsend (im Bildschirm im Uhrzeigersinn)
  const passCW = norm(aM - aF) < norm(aT - aF);
  return passCW ? 1 : 0;
}

function lensPoly(o1, o2, rho, pOut, pIn) {
  const pts = [];
  const arc = (o, from, to, towards) => {
    const aF = Math.atan2(from[1] - o[1], from[0] - o[0]);
    const aT = Math.atan2(to[1] - o[1], to[0] - o[0]);
    const sw = arcSweep(o, from, to, towards);
    let delta = ((aT - aF) % TAU + TAU) % TAU;
    if (!sw) delta = delta - TAU;
    for (let i = 0; i < 8; i++) {
      const a = aF + (delta * i) / 8;
      pts.push([o[0] + rho * Math.cos(a), o[1] + rho * Math.sin(a)]);
    }
  };
  arc(o1, pOut, pIn, o2);
  arc(o2, pIn, pOut, o1);
  return pts;
}

// ---------- Ecken ----------

function drawCorners(rng, cp, add, bg, R0) {
  const style = rng.pick(['faecher', 'bogen', 'blume']);
  const Rq = rng.range(150, Math.min(185, 707 - R0 - 60));
  const qa = cp.pick([bg], 30);
  const qb = cp.pick([qa], 28);
  const qc = cp.pick([qa, qb], 26);
  const corners = [[0, 0, 0], [1000, 0, Math.PI / 2], [1000, 1000, Math.PI], [0, 1000, -Math.PI / 2]];
  const nScallop = rng.int(3, 4);
  const nPetal = rng.int(3, 5);
  const petalStyle = rng.pick(['mandel', 'blatt', 'tropfen']);
  const rs = rng.range(48, 62);
  for (const [x, y, rot] of corners) {
    // lokales Koordinatensystem: Winkel 0..90° zeigt ins Bild
    const P = (r, a) => [x + r * Math.cos(rot + a), y + r * Math.sin(rot + a)];
    // Viertelkreis mit gewelltem Rand
    let d = `M${x} ${y}L${pt(P(Rq, 0))}`;
    const stepA = Math.PI / 2 / nScallop;
    const rv = Rq, rp = Rq + 18;
    for (let k = 0; k < nScallop; k++) {
      const a1 = k * stepA, a2 = (k + 1) * stepA;
      if (style === 'bogen' || style === 'blume') {
        const c = rv * Math.sin(stepA / 2);
        const sag = rp - rv * Math.cos(stepA / 2);
        const rho = (c * c + sag * sag) / (2 * sag);
        d += `A${F(rho)} ${F(rho)} 0 ${sag > c ? 1 : 0} 1 ${pt(P(rv, a2))}`;
      } else {
        d += `A${F(rv)} ${F(rv)} 0 0 1 ${pt(P(rv, a2))}`;
      }
      void a1;
    }
    d += 'Z';
    add(d, qa);
    // Fächer aus Blättern
    const stepP = Math.PI / 2 / nPetal;
    const Lp = Rq - 16;
    for (let k = 0; k < nPetal; k++) {
      const a = (k + 0.5) * stepP;
      const ax = rot + a;
      const W = fitPetalWidth(petalStyle, 20, Lp, ax, stepP / 2, 40, 3, x, y, rs + 1);
      add(petalShape(petalStyle, 20, Lp, ax, W, x, y).d, qb);
    }
    // Viertelscheibe in der Ecke
    add(`M${x} ${y}L${pt(P(rs, 0))}A${F(rs)} ${F(rs)} 0 0 1 ${pt(P(rs, Math.PI / 2))}Z`, qc);
  }
  // Halbkreise an den Kantenmitten
  const gap = 500 - R0;
  if (gap > 22) {
    const rr = gap - 10;
    const hc = qb;
    add(`M${F(500 - rr)} 0A${F(rr)} ${F(rr)} 0 0 0 ${F(500 + rr)} 0Z`, hc);
    add(`M1000 ${F(500 - rr)}A${F(rr)} ${F(rr)} 0 0 0 1000 ${F(500 + rr)}Z`, hc);
    add(`M${F(500 + rr)} 1000A${F(rr)} ${F(rr)} 0 0 0 ${F(500 - rr)} 1000Z`, hc);
    add(`M0 ${F(500 + rr)}A${F(rr)} ${F(rr)} 0 0 0 0 ${F(500 - rr)}Z`, hc);
  }
}
