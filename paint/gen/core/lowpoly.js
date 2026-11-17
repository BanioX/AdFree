// Low-Poly-Landschaften: Punktmenge mit variabler Dichte + Merkmalspunkte (Grate, Ufer, Sonne,
// Bäume) -> Delaunay -> Dreiecke aus einer Szene einfärben (mit Facetten-Beleuchtung) ->
// k-means auf eine harmonische Palette -> gleichfarbige Nachbardreiecke zusammenfassen.

import { makeRng, hashString } from '../../../shared/rng.js';
import { hexToLab, labToHex } from './color.js';
import { fmt, finalizePuzzle, makeFbm1D, makeNoise2D } from './util.js';
import { delaunay, mergeTriangles } from './delaunay.js';
import { kmeans } from './kmeans.js';

// Stimmungen: Himmel (oben -> Horizont), Sonne/Mond, Bergketten (fern -> nah), Schnee, Wald, Wiese, Wasser.
const MOODS = {
  morgen: {
    sky: ['#8f92c9', '#c4a6d2', '#f0b4bf', '#fbd8c5', '#fde9d4'], sun: '#fff4e0', glow: '#fde0c8',
    mountains: ['#b3a3cf', '#8a7fb8', '#625c96', '#433f73'], snow: '#f8eef6', snowy: true,
    forest: '#3d4a5e', meadow: ['#a9b49c', '#8a9a86', '#6b7f70'], water: '#9a9fd0', light: [-0.6, -0.5, 0.65],
  },
  tag: {
    sky: ['#4f97d8', '#7db6e6', '#a9d0f0', '#d3e8f7', '#eef6fb'], sun: '#fffbe6', glow: '#f3f9fd',
    mountains: ['#a6bfd6', '#7f9dbb', '#5b7a9b', '#3f5b78'], snow: '#ffffff', snowy: true,
    forest: '#2c5a45', meadow: ['#a3cf6e', '#78b35a', '#4f8f47'], water: '#4c8cc2', light: [-0.6, -0.55, 0.6],
  },
  abend: {
    sky: ['#3e3a78', '#7e4b8e', '#d4607e', '#f69a6c', '#ffd27e'], sun: '#fff1b8', glow: '#ffc685',
    mountains: ['#c96f8a', '#9a5584', '#704273', '#4c3260'], snow: '#ffd9c7', snowy: false,
    forest: '#2a1f3d', meadow: ['#7a4f72', '#5f3d60', '#47304e'], water: '#9a5f8e', light: [0.65, -0.35, 0.6],
  },
  nacht: {
    sky: ['#18214d', '#233166', '#30437e', '#435d99', '#5a78b2'], sun: '#f7f2d6', glow: '#7f93c4',
    mountains: ['#6a80b5', '#52689c', '#3e5281', '#2c3d66'], snow: '#dbe5f6', snowy: true,
    forest: '#16234a', meadow: ['#3a5582', '#2e466f', '#22385c'], water: '#3a5a92', light: [-0.5, -0.6, 0.6], moon: true,
  },
  herbst: {
    sky: ['#6ea3c9', '#9cc3dc', '#cfe0e6', '#f4e3c3', '#fbeed7'], sun: '#fff6dc', glow: '#fbe9c6',
    mountains: ['#d0ab84', '#b3825c', '#8f6248', '#6c4a3a'], snow: '#fbf3ea', snowy: false,
    forest: '#7a2f24', meadow: ['#d7a442', '#c07a33', '#94532a'], water: '#5f8fb3', light: [-0.6, -0.5, 0.6], autumn: true,
  },
  winter: {
    sky: ['#7fa6d1', '#a7c4e2', '#cadcef', '#e6eff8', '#f5f9fc'], sun: '#ffffff', glow: '#eef4fa',
    mountains: ['#c3d2e4', '#9cb2cd', '#7590b4', '#526d94'], snow: '#ffffff', snowy: true,
    forest: '#284557', meadow: ['#f1f5fa', '#d8e3ef', '#b9cbe0'], water: '#7a9fc4', light: [-0.6, -0.5, 0.6],
  },
};

const TITLES = { morgen: 'Morgenrot', tag: 'Bergsee', abend: 'Abendglühen', nacht: 'Mondnacht', herbst: 'Herbsttal', winter: 'Wintertal' };

const lab = (hex) => hexToLab(hex);
const mixLab = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function gradientLab(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  return mixLab(stops[i], stops[i + 1], t * n - i);
}

export function makeLowPoly(seed) {
  // Punktdichte und Facettenwechsel anpassen, bis die Flächenzahl passt (deterministisch).
  let best = null;
  let dens = 1, tau = 4;
  for (let attempt = 0; attempt < 7; attempt++) {
    const p = buildLowPoly(seed, dens, tau);
    const n = p.shapes.length;
    if (n >= 170 && n <= 380) return p;
    const score = n < 170 ? 170 - n : n - 380;
    if (!best || score < best.score) best = { p, score };
    if (n < 170) { tau += 3; dens *= 0.94; } else { tau = Math.max(0, tau - 3); dens *= 1.1; }
  }
  return best.p;
}

function buildLowPoly(seed, dens, tau) {
  const rng = makeRng(hashString('lowpoly:' + seed));
  const moodNames = Object.keys(MOODS);
  const moodName = moodNames[Number.isInteger(seed) ? (((seed - 1) % moodNames.length) + moodNames.length) % moodNames.length : hashString('lpmood' + seed) % moodNames.length];
  const M = MOODS[moodName];
  const portrait = rng.chance(0.35);
  const W = portrait ? 800 : 1000, H = 1000;

  const skyStops = M.sky.map(lab);
  const mtn = M.mountains.map(lab);
  const snow = lab(M.snow);
  const sunL = lab(M.sun), glowL = lab(M.glow);
  const forestL = lab(M.forest);
  const meadow = M.meadow.map(lab);
  const waterL = lab(M.water);
  const light = (() => { const [a, b, c] = M.light; const l = Math.hypot(a, b, c); return [a / l, b / l, c / l]; })();

  // --- Komposition ---
  const hasLake = rng.chance(0.7);
  const waterY = hasLake ? rng.range(0.6, 0.7) * H : H + 1;
  const groundY = hasLake ? waterY : rng.range(0.66, 0.74) * H;
  const nRanges = rng.int(2, 3);
  const ranges = [];
  for (let i = 0; i < nRanges; i++) {
    const depth = i / Math.max(1, nRanges - 1); // 0 fern .. 1 nah
    const base = groundY + 2;
    const topMin = H * (0.18 + depth * 0.2 + rng.range(-0.03, 0.04));
    const nPeaks = rng.int(2, 4);
    const peaks = [];
    for (let k = 0; k < nPeaks; k++) {
      const x = ((k + rng.range(0.15, 0.85)) / nPeaks) * W * 1.1 - W * 0.05;
      const y = topMin + rng.range(0, 0.14) * H;
      const slope = rng.range(0.55, 1.05) * (1 - depth * 0.3);
      peaks.push({ x, y, slope, rough: rng.range(0.5, 1) });
    }
    const fbm = makeFbm1D(rng, 4);
    const amp = rng.range(10, 22);
    const ridge = (x) => {
      let y = Infinity;
      for (const p of peaks) y = Math.min(y, p.y + Math.abs(x - p.x) * p.slope);
      return Math.min(base - 6, y + fbm(x / 70) * amp);
    };
    const tone = mtn[Math.min(mtn.length - 1, Math.round(depth * (mtn.length - 1) + (nRanges === 2 ? 0.5 : 0)))];
    ranges.push({ depth, peaks, ridge, base, tone, snowy: M.snowy && depth < 0.75 && rng.chance(0.8) });
  }
  // Sonne / Mond
  const sun = {
    x: rng.range(0.2, 0.8) * W,
    y: rng.range(0.16, 0.32) * H,
    r: rng.range(0.055, 0.085) * W,
  };
  // Vordergrund-Hügel mit Bäumen
  const hasHill = rng.chance(0.75);
  const hillFbm = makeFbm1D(rng, 3);
  const hillBase = H * rng.range(0.82, 0.9);
  const hillSide = rng.chance(0.5) ? 1 : -1;
  const hill = (x) => hillBase - (hillSide > 0 ? x / W : 1 - x / W) * H * 0.1 + hillFbm(x / 120) * 18;
  const trees = [];
  const nTrees = hasHill ? rng.int(3, 7) : 0;
  for (let i = 0; i < nTrees; i++) {
    const x = (hillSide > 0 ? rng.range(0.55, 0.98) : rng.range(0.02, 0.45)) * W;
    const h = rng.range(0.11, 0.2) * H;
    const baseY = hill(x) + 8;
    trees.push({ x, baseY, h, w: h * rng.range(0.32, 0.42), tiers: rng.int(2, 3), autumn: M.autumn ? rng.pick(['#a8382a', '#d9692f', '#e8a83c', '#7a2f24']) : null });
  }
  trees.sort((a, b) => a.baseY - b.baseY);
  const n2 = makeNoise2D(rng, 64);

  // --- Szene: Ebene + Farbe an Punkt ---
  function inTree(t, x, y) {
    if (y > t.baseY || y < t.baseY - t.h) return false;
    // Stamm
    if (Math.abs(x - t.x) < t.w * 0.09 && y > t.baseY - t.h * 0.16) return true;
    const top = t.baseY - t.h;
    const body = t.h * 0.86;
    for (let k = 0; k < t.tiers; k++) {
      const ty = top + (body * k) / (t.tiers + 0.4);
      const by = top + (body * (k + 1.4)) / (t.tiers + 0.4);
      if (y < ty || y > by) continue;
      const half = ((y - ty) / (by - ty)) * t.w * (0.6 + 0.4 * ((k + 1) / t.tiers));
      if (Math.abs(x - t.x) <= half) return true;
    }
    return false;
  }

  function layerAt(x, y) {
    for (let i = trees.length - 1; i >= 0; i--) if (inTree(trees[i], x, y)) return { kind: 'tree', i };
    if (hasHill && y > hill(x)) return { kind: 'hill' };
    if (y > waterY) return { kind: 'water' };
    for (let i = ranges.length - 1; i >= 0; i--) if (y > ranges[i].ridge(x)) return { kind: 'mtn', i };
    const dx = x - sun.x, dy = y - sun.y;
    if (dx * dx + dy * dy < sun.r * sun.r) return { kind: 'sun' };
    return { kind: 'sky' };
  }

  function skyColor(x, y) {
    const t = y / Math.min(groundY, H * 0.75);
    let c = gradientLab(skyStops, t);
    const d = Math.hypot(x - sun.x, y - sun.y) / sun.r;
    if (d < 4.2) c = mixLab(c, glowL, Math.max(0, 1 - (d - 1) / 3.2) * 0.55);
    return c;
  }

  // Höhenfeld für Berge: Vereinigung von Kegeln um die Gipfel (für Facettenlicht)
  function mtnZ(r, x, y) {
    let z = -Infinity;
    for (const p of r.peaks) {
      const dx = x - p.x, dy = (y - p.y) * 0.75;
      z = Math.max(z, 260 - Math.sqrt(dx * dx + dy * dy) * (0.8 + 0.2 * p.rough));
    }
    return z + n2(x / 60, y / 60) * 14;
  }

  function baseColor(L, x, y) {
    switch (L.kind) {
      case 'sky': return skyColor(x, y);
      case 'sun': {
        const d = Math.hypot(x - sun.x, y - sun.y) / sun.r;
        return mixLab(sunL, glowL, d * d * 0.25);
      }
      case 'mtn': {
        const r = ranges[L.i];
        let c = r.tone;
        // Schnee in Gipfelnähe
        if (r.snowy) {
          for (const p of r.peaks) {
            const dy = y - (p.y + Math.abs(x - p.x) * p.slope * 0.2);
            if (dy < H * 0.075 * (0.7 + 0.5 * n2(x / 40, 3.3)) && Math.abs(x - p.x) < H * 0.22 && y < p.y + H * 0.13) { c = snow; break; }
          }
        }
        // Dunst: ferne Ketten heller/zum Himmel hin
        const haze = (1 - r.depth) * 0.28 + Math.max(0, (y - r.ridge(x)) / (r.base - r.ridge(x) + 1)) * 0.12 * (1 - r.depth);
        return mixLab(c, skyStops[skyStops.length - 1], haze);
      }
      case 'water': {
        const my = 2 * waterY - y;
        const above = layerAt(x, my);
        const refl = above.kind === 'water' || above.kind === 'hill' || above.kind === 'tree' ? waterL : baseColor(above, x, my);
        const depth = (y - waterY) / (H - waterY + 1);
        const m = mixLab(refl, waterL, 0.3 + depth * 0.3);
        return [m[0] - 5, m[1], m[2]];
      }
      case 'hill': {
        const t = Math.min(1, (y - hill(x)) / (H - hillBase + 60));
        return gradientLab(meadow, t * 0.9 + 0.05);
      }
      case 'tree': {
        const t = trees[L.i];
        const c = t.autumn ? lab(t.autumn) : forestL;
        if (Math.abs(x - t.x) < t.w * 0.09 && y > t.baseY - t.h * 0.16) return [Math.max(10, c[0] - 8), c[1] * 0.4 + 6, c[2] * 0.4 + 10];
        return x < t.x ? [c[0] + 7, c[1], c[2]] : c;
      }
    }
    return [50, 0, 0];
  }

  // --- Punkte ---
  const feat = [];
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    const step = 32 * dens;
    for (let x = 0; x <= W; x += step * rng.range(0.8, 1.2)) {
      const y = r.ridge(x);
      if (layerAt(x, y - 2).kind === 'sky' || layerAt(x, y - 2).kind === 'sun') feat.push([x, y, 14]);
    }
    for (const p of r.peaks) if (p.x > 0 && p.x < W) feat.push([p.x, r.ridge(p.x), 10]);
  }
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    const x = sun.x + Math.cos(a) * sun.r, y = sun.y + Math.sin(a) * sun.r;
    feat.push([x, y, 10]);
  }
  if (hasLake) for (let x = 0; x <= W; x += 48 * dens * rng.range(0.8, 1.2)) feat.push([x, waterY, 22]);
  if (hasHill) for (let x = 0; x <= W; x += 40 * dens * rng.range(0.8, 1.2)) feat.push([x, hill(x), 18]);
  for (const t of trees) {
    const top = t.baseY - t.h, body = t.h * 0.86;
    feat.push([t.x, top, 6]);
    for (let k = 0; k < t.tiers; k++) {
      const by = top + (body * (k + 1.4)) / (t.tiers + 0.4);
      const half = t.w * (0.6 + 0.4 * ((k + 1) / t.tiers));
      feat.push([t.x - half, by, 6], [t.x + half, by, 6]);
      if (k < t.tiers - 1) {
        const ty = top + (body * (k + 1)) / (t.tiers + 0.4);
        const hh = ((ty - (top + (body * k) / (t.tiers + 0.4))) / ((body * 1.4) / (t.tiers + 0.4))) * t.w * (0.6 + 0.4 * ((k + 1) / t.tiers));
        feat.push([t.x - hh, ty, 6], [t.x + hh, ty, 6]);
      }
    }
    feat.push([t.x - t.w * 0.09, t.baseY, 5], [t.x + t.w * 0.09, t.baseY, 5]);
  }
  // Rand
  const edgeStep = 85 * dens;
  for (let x = edgeStep; x < W - 10; x += edgeStep * rng.range(0.8, 1.2)) feat.push([x, 0, 20], [x, H, 20]);
  for (let y = edgeStep; y < H - 10; y += edgeStep * rng.range(0.8, 1.2)) feat.push([0, y, 20], [W, y, 20]);
  // Randpunkte genau an Grat-/Ufer-/Hügellinien
  for (const r of ranges) feat.push([0, r.ridge(0), 8], [W, r.ridge(W), 8]);
  if (hasLake) feat.push([0, waterY, 8], [W, waterY, 8]);
  if (hasHill) feat.push([0, hill(0), 8], [W, hill(W), 8]);

  // Poisson-Scheibe mit variabler Dichte
  const cell = 8;
  const gw = Math.ceil(W / cell) + 1, gh = Math.ceil(H / cell) + 1;
  const grid = new Map();
  const pts = [];
  const radiusAt = (x, y) => {
    const L = layerAt(x, y);
    const k = L.kind === 'sky' ? 96 : L.kind === 'sun' ? 46 : L.kind === 'mtn' ? 50 + ranges[L.i].depth * 8 : L.kind === 'water' ? 44 : L.kind === 'tree' ? 26 : 62;
    return k * dens;
  };
  const tooClose = (x, y, r, sx = 1) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    const s = Math.ceil((r * sx) / cell);
    for (let yy = gy - s; yy <= gy + s; yy++) {
      if (yy < 0 || yy >= gh) continue;
      for (let xx = gx - s; xx <= gx + s; xx++) {
        if (xx < 0 || xx >= gw) continue;
        const l = grid.get(yy * gw + xx);
        if (!l) continue;
        for (const [px, py] of l) if (((px - x) * (px - x)) / (sx * sx) + (py - y) * (py - y) < r * r) return true;
      }
    }
    return false;
  };
  const addPt = (x, y) => {
    const k = Math.floor(y / cell) * gw + Math.floor(x / cell);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push([x, y]);
    pts.push([x, y]);
  };
  for (const [x0, y0, r] of feat) {
    const x = Math.max(0, Math.min(W, x0)), y = Math.max(0, Math.min(H, y0));
    if (!tooClose(x, y, r * Math.min(1, dens))) addPt(x, y);
  }
  for (let i = 0; i < 9000; i++) {
    const x = rng.range(4, W - 4), y = rng.range(4, H - 4);
    const r = radiusAt(x, y) * rng.range(0.85, 1.1);
    const sx = hasLake && y > waterY + 4 && layerAt(x, y).kind === 'water' ? 2.2 : 1;
    if (!tooClose(x, y, r * 0.62, sx)) addPt(x, y);
  }

  // --- Triangulieren + einfärben ---
  const { points, triangles } = delaunay(pts, W, H);
  const nt = triangles.length / 3;
  const cols = new Float64Array(nt * 3);
  const area = new Float32Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = points[triangles[t * 3]], b = points[triangles[t * 3 + 1]], c = points[triangles[t * 3 + 2]];
    const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
    area[t] = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    // Mehrere Proben: Schwerpunkt + Richtung Ecken
    const samples = [[cx, cy], [(cx * 2 + a[0]) / 3, (cy * 2 + a[1]) / 3], [(cx * 2 + b[0]) / 3, (cy * 2 + b[1]) / 3], [(cx * 2 + c[0]) / 3, (cy * 2 + c[1]) / 3]];
    const Lc = layerAt(cx, cy);
    let acc = [0, 0, 0];
    for (const [sx, sy] of samples) {
      const col = baseColor(layerAt(sx, sy), sx, sy);
      acc[0] += col[0] / 4; acc[1] += col[1] / 4; acc[2] += col[2] / 4;
    }
    // Facettenlicht
    let shade = 0;
    if (Lc.kind === 'mtn' || (Lc.kind === 'water' && layerAt(cx, 2 * waterY - cy).kind === 'mtn')) {
      const r = ranges[Lc.kind === 'mtn' ? Lc.i : layerAt(cx, 2 * waterY - cy).i];
      const fy = (p) => (Lc.kind === 'water' ? 2 * waterY - p[1] : p[1]);
      const za = mtnZ(r, a[0], fy(a)), zb = mtnZ(r, b[0], fy(b)), zc = mtnZ(r, c[0], fy(c));
      const ux = b[0] - a[0], uy = fy(b) - fy(a), uz = zb - za;
      const vx = c[0] - a[0], vy = fy(c) - fy(a), vz = zc - za;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const nl = Math.hypot(nx, ny, nz) || 1;
      const lam = (nx * light[0] + ny * light[1] + nz * light[2]) / nl;
      const amp = Lc.kind === 'water' ? 18 : 40;
      shade = lam > 0.55 ? (lam - 0.55) * amp : (lam - 0.55) * amp * 0.7;
    } else if (Lc.kind === 'hill') {
      shade = n2(cx / 50 + 7, cy / 50) * 6 + rng.range(-3, 3);
    } else if (Lc.kind === 'sky') {
      shade = rng.range(-2.5, 2.5);
    } else if (Lc.kind === 'water') {
      shade = n2(cx / 40, cy / 10) * 4 + rng.range(-2, 2);
    }
    cols[t * 3] = Math.max(16, Math.min(99, acc[0] + shade));
    cols[t * 3 + 1] = acc[1];
    cols[t * 3 + 2] = acc[2];
  }

  // --- Palette per k-means ---
  const K = rng.int(13, 16);
  const km = kmeans(cols, area, K, makeRng(hashString('lpk' + seed)), { iters: 20 });
  // Nächste Palettenfarbe; liegt eine zweite fast gleich nah, wird sie genommen, wenn dadurch
  // benachbarte Facetten unterscheidbar bleiben (typischer Low-Poly-Look, weniger Riesenflächen).
  const group = new Int32Array(nt).fill(-1);
  const np = points.length;
  const edgeTri = new Map();
  for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) edgeTri.set(triangles[t * 3 + e] * np + triangles[t * 3 + ((e + 1) % 3)], t);
  for (let t = 0; t < nt; t++) {
    let c1 = -1, c2 = -1, d1 = Infinity, d2 = Infinity;
    for (let c = 0; c < km.k; c++) {
      const dx = cols[t * 3] - km.centers[c * 3], dy = cols[t * 3 + 1] - km.centers[c * 3 + 1], dz = cols[t * 3 + 2] - km.centers[c * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < d1) { c2 = c1; d2 = d1; c1 = c; d1 = d; } else if (d < d2) { c2 = c; d2 = d; }
    }
    let pick = c1;
    if (c2 >= 0 && d2 - d1 < tau) {
      let has1 = false, has2 = false;
      for (let e = 0; e < 3; e++) {
        const o = edgeTri.get(triangles[t * 3 + ((e + 1) % 3)] * np + triangles[t * 3 + e]);
        if (o === undefined || group[o] < 0) continue;
        if (group[o] === c1) has1 = true;
        if (group[o] === c2) has2 = true;
      }
      if (has1 && !has2) pick = c2;
    }
    group[t] = pick;
  }
  const palette = [];
  for (let c = 0; c < km.k; c++) palette.push(labToHex(km.centers[c * 3], km.centers[c * 3 + 1], km.centers[c * 3 + 2]));

  // --- Kleine Flächen dem Nachbarn mit der längsten gemeinsamen Kante zuschlagen ---
  absorbSmall(points, triangles, group, area, 70);

  // --- Zusammenfassen ---
  const regions = mergeTriangles(points, triangles, group);
  const shapes = [];
  for (const R of regions) {
    let d = '';
    for (const loop of R.loops) {
      const simp = dropCollinear(loop.map((i) => points[i]));
      if (simp.length < 3) continue;
      d += 'M' + simp.map(([x, y]) => fmt(x, 1) + ' ' + fmt(y, 1)).join('L') + 'Z';
    }
    if (!d) continue;
    const s = { d, c: R.group };
    if (R.loops.length > 1) s.r = 'evenodd';
    shapes.push(s);
  }
  // grosse Flächen zuerst (für die Engine egal, aber angenehm beim Debuggen)
  return finalizePuzzle({
    id: 'gen-polygon-' + seed,
    title: TITLES[moodName] + ' ' + seed,
    category: 'Low Poly',
    width: W,
    height: H,
    palette,
    shapes,
  });
}

function absorbSmall(points, tris, group, area, minArea) {
  const nt = tris.length / 3, np = points.length;
  const edgeTri = new Map();
  for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) edgeTri.set(tris[t * 3 + e] * np + tris[t * 3 + ((e + 1) % 3)], t);
  for (let round = 0; round < 3; round++) {
    const regions = mergeTriangles(points, tris, group);
    let changed = 0;
    for (const R of regions) {
      let a = 0;
      for (const t of R.tris) a += area[t];
      if (a >= minArea) continue;
      const score = new Map();
      for (const t of R.tris) {
        for (let e = 0; e < 3; e++) {
          const u = tris[t * 3 + e], v = tris[t * 3 + ((e + 1) % 3)];
          const o = edgeTri.get(v * np + u);
          if (o === undefined || group[o] === R.group) continue;
          const len = Math.hypot(points[u][0] - points[v][0], points[u][1] - points[v][1]);
          score.set(group[o], (score.get(group[o]) || 0) + len);
        }
      }
      let best = -1, bl = 0;
      for (const [g, l] of score) if (l > bl) { bl = l; best = g; }
      if (best >= 0) { for (const t of R.tris) group[t] = best; changed++; }
    }
    if (!changed) break;
  }
}

function dropCollinear(pts) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(cr) < 1e-6) continue;
    out.push(b);
  }
  return out;
}
