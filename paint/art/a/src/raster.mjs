// Node-side SVG path flattening + scanline rasterization, used to post-process pictures:
//  * autoSplit(pz): every shape whose visible part falls apart into several pieces is replaced
//    by one shape per piece (same colour), so every visible piece gets its own number.
//    Piece outlines follow the original path exactly where visible; the cut between pieces
//    runs through hidden area (nearest-piece partition), so it never shows.
//  * fully hidden shapes are dropped.

import { contour } from './geom.mjs';

/* ------------------------------------------------------------------ path parsing */

const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

/** Parse SVG path data into closed polygons (subpaths), curves flattened. */
export function flattenPath(d, tol = 0.25) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
  const polys = [];
  let cur = [], x = 0, y = 0, sx = 0, sy = 0, cmd = '', i = 0, lcx = 0, lcy = 0, lqx = 0, lqy = 0, prev = '';
  const num = () => parseFloat(tokens[i++]);
  const close = () => {
    if (cur.length > 2) polys.push(cur);
    cur = [];
  };
  const lineTo = (nx, ny) => {
    cur.push([nx, ny]);
    x = nx; y = ny;
  };
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
    const n = Math.max(2, Math.min(64, Math.ceil(Math.sqrt(len / tol) / 2)));
    const x0 = x, y0 = y;
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      cur.push([
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      ]);
    }
    x = x3; y = y3;
  };
  const arc = (rx, ry, phi, fa, fs, x2, y2) => {
    // SVG implementation notes F.6.5
    const x1 = x, y1 = y;
    if (rx === 0 || ry === 0) return lineTo(x2, y2);
    rx = Math.abs(rx); ry = Math.abs(ry);
    const p = (phi * Math.PI) / 180, cp = Math.cos(p), sp = Math.sin(p);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    let lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const num_ = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    let co = Math.sqrt(Math.max(0, num_ / den));
    if (fa === fs) co = -co;
    const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
    const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => {
      const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      return a;
    };
    const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dth > 0) dth -= 2 * Math.PI;
    if (fs && dth < 0) dth += 2 * Math.PI;
    const n = Math.max(4, Math.ceil((Math.abs(dth) * Math.max(rx, ry)) / 3));
    for (let k = 1; k <= n; k++) {
      const t = th1 + (dth * k) / n;
      const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
      cur.push([cx + cp * ex - sp * ey, cy + sp * ex + cp * ey]);
    }
    x = x2; y = y2;
  };
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) { cmd = t; i++; } else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (C) {
      case 'M': {
        close();
        x = num() + ox; y = num() + oy; sx = x; sy = y;
        cur.push([x, y]);
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': lineTo(num() + ox, num() + oy); break;
      case 'H': lineTo(num() + ox, y); break;
      case 'V': lineTo(x, num() + oy); break;
      case 'C': {
        const a = num() + ox, b = num() + oy, c = num() + ox, e = num() + oy, g = num() + ox, h = num() + oy;
        lcx = c; lcy = e;
        cubic(a, b, c, e, g, h);
        break;
      }
      case 'S': {
        const a = prev === 'C' || prev === 'S' ? 2 * x - lcx : x, b = prev === 'C' || prev === 'S' ? 2 * y - lcy : y;
        const c = num() + ox, e = num() + oy, g = num() + ox, h = num() + oy;
        lcx = c; lcy = e;
        cubic(a, b, c, e, g, h);
        break;
      }
      case 'Q': {
        const a = num() + ox, b = num() + oy, g = num() + ox, h = num() + oy;
        lqx = a; lqy = b;
        cubic(x + (2 / 3) * (a - x), y + (2 / 3) * (b - y), g + (2 / 3) * (a - g), h + (2 / 3) * (b - h), g, h);
        break;
      }
      case 'T': {
        const a = prev === 'Q' || prev === 'T' ? 2 * x - lqx : x, b = prev === 'Q' || prev === 'T' ? 2 * y - lqy : y;
        const g = num() + ox, h = num() + oy;
        lqx = a; lqy = b;
        cubic(x + (2 / 3) * (a - x), y + (2 / 3) * (b - y), g + (2 / 3) * (a - g), h + (2 / 3) * (b - h), g, h);
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), phi = num(), fa = num(), fs = num(), ex = num() + ox, ey = num() + oy;
        arc(rx, ry, phi, fa, fs, ex, ey);
        break;
      }
      case 'Z': {
        x = sx; y = sy;
        close();
        break;
      }
      default:
        i++;
    }
    prev = C;
  }
  close();
  return polys;
}

/* ------------------------------------------------------------------ rasterization */

/** Calls span(y, x0, x1) for each filled pixel span (pixel centres), nonzero or evenodd. */
export function scanFill(polys, W, H, evenodd, span) {
  const rows = new Map();
  for (const pg of polys) {
    const n = pg.length;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = pg[i], [bx, by] = pg[(i + 1) % n];
      if (ay === by) continue;
      const dir = by > ay ? 1 : -1;
      const y0 = Math.max(0, Math.ceil(Math.min(ay, by) - 0.5)), y1 = Math.min(H - 1, Math.floor(Math.max(ay, by) - 0.5 - 1e-9));
      for (let yy = y0; yy <= y1; yy++) {
        const yc = yy + 0.5;
        const t = (yc - ay) / (by - ay); // y-range already half-open [min, max)
        const xc = ax + (bx - ax) * t;
        let r = rows.get(yy);
        if (!r) rows.set(yy, (r = []));
        r.push(xc, dir);
      }
    }
  }
  for (const [yy, r] of rows) {
    const arr = [];
    for (let k = 0; k < r.length; k += 2) arr.push([r[k], r[k + 1]]);
    arr.sort((a, b) => a[0] - b[0]);
    let wn = 0;
    for (let k = 0; k < arr.length - 1; k++) {
      wn = evenodd ? wn ^ 1 : wn + arr[k][1];
      if (wn !== 0) {
        const x0 = Math.max(0, Math.ceil(arr[k][0] - 0.5)), x1 = Math.min(W - 1, Math.floor(arr[k + 1][0] - 0.5 - 1e-9));
        if (x1 >= x0) span(yy, x0, x1);
      }
    }
  }
}

/* ------------------------------------------------------------------ auto split */

function sdPolys(px, py, polys, evenodd) {
  let d2 = Infinity, wn = 0, cross = 0;
  for (const pg of polys) {
    const n = pg.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = pg[j][0], ay = pg[j][1], bx = pg[i][0], by = pg[i][1];
      const ex = bx - ax, ey = by - ay, wx = px - ax, wy = py - ay;
      const L = ex * ex + ey * ey;
      let t = L ? (wx * ex + wy * ey) / L : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = wx - ex * t, dy = wy - ey * t, dd = dx * dx + dy * dy;
      if (dd < d2) d2 = dd;
      const cr = ex * wy - ey * wx;
      if (ay <= py) { if (by > py && cr > 0) { wn++; cross++; } } else if (by <= py && cr < 0) { wn--; cross++; }
    }
  }
  const inside = evenodd ? cross % 2 === 1 : wn !== 0;
  const d = Math.sqrt(d2);
  return inside ? -d : d;
}

const fmt = (v) => {
  const s = Math.round(v * 10) / 10;
  return Object.is(s, -0) || s === 0 ? '0' : String(s);
};
const polyPath = (loops) => loops.map((l) => 'M' + l.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join('L') + 'Z').join('');

/**
 * Split shapes whose visible area is in several pieces. Mutates nothing; returns a new puzzle.
 * minPart: pieces smaller than this (px) are not given their own shape.
 * minVisible: shapes with less visible area than this (px) are dropped (crumbs under other shapes).
 */
export function autoSplit(pz, { minPart = 250, minVisible = 300, log = true } = {}) {
  const W = pz.width, H = pz.height, N = W * H;
  const flat = pz.shapes.map((s) => flattenPath(s.d));
  const ids = new Int32Array(N).fill(-1);
  flat.forEach((polys, i) => scanFill(polys, W, H, pz.shapes[i].r === 'evenodd', (y, x0, x1) => ids.fill(i, y * W + x0, y * W + x1 + 1)));

  // components per shape (4-connectivity)
  const comp = new Int32Array(N).fill(-1);
  const compShape = [], compSize = [];
  const stack = new Int32Array(N);
  for (let p = 0; p < N; p++) {
    if (ids[p] < 0 || comp[p] >= 0) continue;
    const c = compShape.length, v = ids[p];
    let sp = 0, size = 0;
    stack[sp++] = p;
    comp[p] = c;
    while (sp) {
      const q = stack[--sp];
      size++;
      const x = q % W;
      if (x > 0 && ids[q - 1] === v && comp[q - 1] < 0) { comp[q - 1] = c; stack[sp++] = q - 1; }
      if (x < W - 1 && ids[q + 1] === v && comp[q + 1] < 0) { comp[q + 1] = c; stack[sp++] = q + 1; }
      if (q >= W && ids[q - W] === v && comp[q - W] < 0) { comp[q - W] = c; stack[sp++] = q - W; }
      if (q < N - W && ids[q + W] === v && comp[q + W] < 0) { comp[q + W] = c; stack[sp++] = q + W; }
    }
    compShape.push(v);
    compSize.push(size);
  }
  const byShape = pz.shapes.map(() => []);
  compShape.forEach((v, c) => { if (compSize[c] >= minPart) byShape[v].push(c); });
  const visible = new Int32Array(pz.shapes.length);
  compShape.forEach((v, c) => { visible[v] += compSize[c]; });

  const out = [];
  pz.shapes.forEach((s, i) => {
    if (visible[i] < minVisible) {
      if (log) console.log(`  autoSplit ${pz.id}: dropped hidden shape #${i} (${visible[i]}px)`);
      return;
    }
    const comps = byShape[i];
    if (comps.length < 2) {
      out.push(s);
      return;
    }
    // full mask of the shape, then nearest-component labelling (multi-source BFS)
    const lab = new Int32Array(N).fill(-2); // -2 = outside shape, -1 = unassigned inside
    let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
    scanFill(flat[i], W, H, s.r === 'evenodd', (y, x0, x1) => {
      lab.fill(-1, y * W + x0, y * W + x1 + 1);
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
      if (x0 < bx0) bx0 = x0;
      if (x1 > bx1) bx1 = x1;
    });
    const queue = new Int32Array(N);
    let qh = 0, qt = 0;
    comps.forEach((c, k) => {
      for (let p = by0 * W; p <= by1 * W + W - 1; p++) if (comp[p] === c) { lab[p] = k; queue[qt++] = p; }
    });
    while (qh < qt) {
      const q = queue[qh++], k = lab[q], x = q % W;
      const nb = [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, q >= W ? q - W : -1, q < N - W ? q + W : -1];
      for (const r of nb) if (r >= 0 && lab[r] === -1) { lab[r] = k; queue[qt++] = r; }
    }
    const mx0 = bx0 - 4, my0 = by0 - 4, mw = bx1 - bx0 + 9, mh = by1 - by0 + 9;
    // distance (chamfer) from each inside pixel to the shape's outside: exact SDF only near the outline
    const dIn = new Float32Array(mw * mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const gx = x + mx0, gy = y + my0;
      const ins = gx >= 0 && gy >= 0 && gx < W && gy < H && lab[gy * W + gx] !== -2;
      dIn[y * mw + x] = ins ? 1e6 : 0;
    }
    for (let y = 1; y < mh; y++) for (let x = 1; x < mw - 1; x++) {
      const q = y * mw + x;
      if (dIn[q]) dIn[q] = Math.min(dIn[q], dIn[q - 1] + 1, dIn[q - mw] + 1, dIn[q - mw - 1] + 1.41, dIn[q - mw + 1] + 1.41);
    }
    for (let y = mh - 2; y >= 0; y--) for (let x = mw - 2; x > 0; x--) {
      const q = y * mw + x;
      if (dIn[q]) dIn[q] = Math.min(dIn[q], dIn[q + 1] + 1, dIn[q + mw] + 1, dIn[q + mw + 1] + 1.41, dIn[q + mw - 1] + 1.41);
    }
    const deepInside = (x, y) => {
      const ix = Math.floor(x - mx0 - 0.5), iy = Math.floor(y - my0 - 0.5);
      if (ix < 0 || iy < 0 || ix + 1 >= mw || iy + 1 >= mh) return false;
      return Math.min(dIn[iy * mw + ix], dIn[iy * mw + ix + 1], dIn[(iy + 1) * mw + ix], dIn[(iy + 1) * mw + ix + 1]) >= 5;
    };
    comps.forEach((c, k) => {
      // region k mask (nearest-piece cells), grown by 2px so it overshoots the true outline
      let m = new Uint8Array(mw * mh);
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (lab[y * W + x] === k) m[(y - my0) * mw + (x - mx0)] = 1;
      for (let it = 0; it < 2; it++) {
        const g = m.slice();
        for (let y = 1; y < mh - 1; y++) for (let x = 1; x < mw - 1; x++) {
          const q = y * mw + x;
          if (!m[q] && (m[q - 1] || m[q + 1] || m[q - mw] || m[q + mw])) g[q] = 1;
        }
        m = g;
      }
      const regionField = (x, y) => {
        const fx = x - mx0 - 0.5, fy = y - my0 - 0.5;
        const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        const g = (a, b) => (a < 0 || b < 0 || a >= mw || b >= mh ? 0 : m[b * mw + a]);
        const v = g(ix, iy) * (1 - tx) * (1 - ty) + g(ix + 1, iy) * tx * (1 - ty) + g(ix, iy + 1) * (1 - tx) * ty + g(ix + 1, iy + 1) * tx * ty;
        return (0.5 - v) * 2;
      };
      const field = (x, y) => {
        const r = regionField(x, y);
        if (r >= 1) return 1;
        if (deepInside(x, y)) return Math.max(-3, r);
        return Math.max(sdPolys(x, y, flat[i], s.r === 'evenodd'), r);
      };
      const piece = contour(field, [bx0 - 2, by0 - 2, bx1 + 3, by1 + 3], { res: 1, eps: 0.3 });
      if (piece.length) out.push({ d: polyPath(piece), c: s.c });
    });
    if (log) console.log(`  autoSplit ${pz.id}: shape #${i} -> ${comps.length} pieces (${comps.map((c) => compSize[c]).join('+')}px)`);
  });
  return { ...pz, shapes: out };
}
