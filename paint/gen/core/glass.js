// Buntglas: Lloyd-entspannte Voronoi-Zellen, geschnitten an den Formen einer einfachen Szene
// (Sonnenuntergang, Blume, Wellen, Herz, Rosette, Baum, Mondnacht). Jede Szenenfläche hat
// mehrere Glastöne; Nachbarzellen bekommen möglichst verschiedene Töne. Bleiruten als Linien.

import { makeRng, hashString } from '../../../shared/rng.js';
import { finalizePuzzle } from './util.js';
import { buildRegions, mergeSmall, mergeThin, relabel } from './regions.js';
import { vectorize, chainsPath } from './vectorize.js';

const LEAD = '#2b2724';

// ---------- Szenen ----------
// Jede Szene: { title, palette: [...], regions: [{ colors | bands }], region(x, y) -> id, density(x, y) -> 0.5..2 }
// Farbangaben in den Regionen sind Indizes in palette.

function sunsetScene(W, H, rng) {
  const palette = ['#2c2a6e', '#4b3a8f', '#7d3f94', '#b2428b', '#e0566e', '#f27c4c', '#f7a53c', '#fbd46b', '#fff1b3',
    '#1f4f45', '#2f6f52', '#4e8f4f', '#7fb35a', '#fde6a6'];
  const yH = H * rng.range(0.58, 0.66);
  const sx = W * rng.range(0.32, 0.68), sr = W * rng.range(0.15, 0.2);
  const nRays = rng.pick([14, 16, 18, 20]);
  const hills = [0, 1, 2].map((i) => ({
    base: yH + H * (0.06 + i * 0.1),
    amp: H * rng.range(0.03, 0.06),
    f: rng.range(1.2, 2.4) / W * Math.PI * 2,
    ph: rng.range(0, 6.28),
  }));
  const regions = [
    { bands: [[8, 7], [7, 6], [6, 5], [5, 4], [4, 3], [3, 2], [2, 1], [1, 0]], radial: [sx, yH, sr, Math.hypot(W, H) * 0.75] }, // 0 Strahl A
    { bands: [[7, 6], [6, 5], [5, 4], [4, 3], [3, 2], [2, 1], [1, 0], [0, 1]], radial: [sx, yH, sr, Math.hypot(W, H) * 0.75] }, // 1 Strahl B
    { colors: [8, 13] }, // 2 Sonne
    { colors: [12, 11] }, // 3 Hügel fern
    { colors: [11, 10] }, // 4 Hügel mitte
    { colors: [10, 9] }, // 5 Hügel nah
  ];
  const region = (x, y) => {
    for (let i = 2; i >= 0; i--) {
      const hl = hills[i];
      if (y > hl.base + Math.sin(x * hl.f + hl.ph) * hl.amp) return 5 - (2 - i);
    }
    if (y > yH) return 3;
    const dx = x - sx, dy = y - yH;
    if (dx * dx + dy * dy < sr * sr) return 2;
    const a = Math.atan2(dy, dx);
    const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * nRays + 0.5);
    return k % 2;
  };
  const density = (x, y) => (y > yH ? 0.9 : 1.15);
  return { title: 'Abendsonne', palette, regions, region, density };
}

function flowerScene(W, H, rng) {
  const palette = ['#e4f4f1', '#bfe6e2', '#8fd0cf', '#5fb3c4', '#f9c6d8', '#f28fb3', '#d94f8a', '#a8306e',
    '#ffe27a', '#f6b13b', '#8cc15a', '#4f9a45', '#2e6b3a', '#c9e6a6'];
  const cx = W / 2, cy = H * 0.4;
  const nP = rng.pick([6, 8, 10]);
  const pr = W * rng.range(0.2, 0.24), pw = pr * rng.range(0.42, 0.55);
  const cr = W * 0.085;
  const rot = rng.range(0, Math.PI);
  const leafA = { x: cx - W * 0.12, y: H * 0.78, a: -0.7, rx: W * 0.15, ry: W * 0.055 };
  const leafB = { x: cx + W * 0.12, y: H * 0.7, a: 0.7, rx: W * 0.15, ry: W * 0.055 };
  const inEll = (x, y, e) => {
    const dx = x - e.x, dy = y - e.y;
    const c = Math.cos(e.a), s = Math.sin(e.a);
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    return (u * u) / (e.rx * e.rx) + (v * v) / (e.ry * e.ry) < 1;
  };
  const regions = [
    { radialBands: [[0, 1], [1, 2], [2, 3]], radial: [cx, cy, W * 0.3, W * 0.75] }, // 0 Hintergrund
    { colors: [8, 9] }, // 1 Mitte
    { colors: [11, 10, 12] }, // 2 Stiel
    { colors: [10, 11, 13] }, // 3 Blatt A
    { colors: [10, 11, 13] }, // 4 Blatt B
    { colors: [13, 10] }, // 5 Wiese
  ];
  const petalBase = regions.length;
  for (let i = 0; i < nP; i++) regions.push({ colors: i % 2 ? [6, 7] : [4, 5] });
  const petals = [];
  for (let i = 0; i < nP; i++) {
    const a = rot + (i / nP) * Math.PI * 2;
    petals.push({ x: cx + Math.cos(a) * pr * 0.62, y: cy + Math.sin(a) * pr * 0.62, a, rx: pr * 0.62, ry: pw * 0.5 });
  }
  const region = (x, y) => {
    const dx = x - cx, dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < cr) return 1;
    // Blütenblätter: Ellipsen um die Mitte
    if (d < pr * 1.3) for (let i = 0; i < nP; i++) if (inEll(x, y, petals[i])) return petalBase + i;
    if (y > H * 0.9 + Math.sin(x / W * 6) * H * 0.02) return 5;
    if (inEll(x, y, leafA)) return 3;
    if (inEll(x, y, leafB)) return 4;
    if (y > cy && Math.abs(x - (cx + Math.sin((y - cy) / H * 3) * W * 0.02)) < W * 0.022) return 2;
    return 0;
  };
  const density = (x, y) => (Math.hypot(x - cx, y - cy) < pr * 1.3 ? 1.25 : 0.95);
  return { title: 'Glasblume', palette, regions, region, density };
}

function wavesScene(W, H, rng) {
  const palette = ['#fff4cf', '#ffd77a', '#f7a65a', '#e9e0f5', '#c8d8f2', '#9ec0ea', '#6fa0dc', '#3f78c4', '#285a9e', '#1b3f78',
    '#5fc4c0', '#2f9e9e', '#f4fbff', '#c94f4f'];
  const yH = H * rng.range(0.42, 0.5);
  const sx = W * rng.range(0.25, 0.75), sy = yH - H * rng.range(0.12, 0.2), sr = W * 0.1;
  const nW = 5;
  const waves = Array.from({ length: nW }, (_, i) => ({
    y: yH + ((H - yH) * (i + 0.6)) / (nW + 0.2),
    amp: H * (0.018 + i * 0.006),
    f: (rng.range(2, 3.5) / W) * Math.PI * 2,
    ph: rng.range(0, 6.28),
  }));
  const boat = rng.chance(0.6) ? { x: W * rng.range(0.2, 0.8), y: yH + (H - yH) * 0.3, s: W * 0.09 } : null;
  if (boat && Math.abs(boat.x - sx) < W * 0.15) boat.x = sx < W / 2 ? W * 0.75 : W * 0.25;
  const regions = [
    { bands: [[5, 6], [4, 5], [3, 4], [3, 0]], axis: [0, yH] }, // 0 Himmel
    { colors: [0, 1] }, // 1 Sonne
    { colors: [6, 10] }, // 2 Meer hinten
    { colors: [7, 11] },
    { colors: [8, 10] },
    { colors: [7, 9] },
    { colors: [9, 8] },
    { colors: [8, 11] }, // 7
    { colors: [12, 0] }, // 8 Segel
    { colors: [13] }, // 9 Rumpf
  ];
  const region = (x, y) => {
    if (boat) {
      const bx = x - boat.x, by = y - boat.y;
      if (by > 0 && by < boat.s * 0.35 && Math.abs(bx) < boat.s * (1 - by / (boat.s * 0.7))) return 9;
      if (by <= 0 && by > -boat.s * 1.6 && bx > -boat.s * 0.75 * (1 + by / (boat.s * 1.6)) && bx < boat.s * 0.04) return 8;
      if (by <= -boat.s * 0.1 && by > -boat.s * 1.3 && bx > boat.s * 0.1 && bx < boat.s * 0.65 * (1 + by / (boat.s * 1.3)) + boat.s * 0.1) return 8;
    }
    for (let i = nW - 1; i >= 0; i--) {
      const wv = waves[i];
      if (y > wv.y + Math.sin(x * wv.f + wv.ph) * wv.amp) return 3 + i;
    }
    if (y > yH) return 2;
    const dx = x - sx, dy = y - sy;
    if (dx * dx + dy * dy < sr * sr) return 1;
    return 0;
  };
  const density = (x, y) => (y > yH ? 1.1 : 0.9);
  return { title: 'Meeresglas', palette, regions, region, density };
}

function heartScene(W, H, rng) {
  const palette = ['#fff3d6', '#ffd98a', '#f6b94d', '#cfe8f3', '#9fcfe8', '#ffd0dc', '#ff9cb5', '#f2557a', '#d12d55', '#99173f',
    '#b9e3c6', '#7cc39a'];
  const cx = W / 2, cy = H * 0.5;
  const s = W * rng.range(0.3, 0.34);
  const nRays = rng.pick([16, 20, 24]);
  const heartF = (x, y, sc) => {
    const u = (x - cx) / sc, v = -(y - cy) / sc + 0.25;
    const a = u * u + v * v - 1;
    return a * a * a - u * u * v * v * v;
  };
  const regions = [
    { radialBands: [[0, 1], [1, 2], [2, 1]], radial: [cx, cy, s, W * 0.75] }, // 0 Strahl A
    { radialBands: [[3, 4], [4, 3], [10, 11]], radial: [cx, cy, s, W * 0.75] }, // 1 Strahl B
    { colors: [7, 8, 9] }, // 2 Herz aussen
    { colors: [5, 6, 7] }, // 3 Herz innen
  ];
  const region = (x, y) => {
    if (heartF(x, y, s * 0.55) < 0) return 3;
    if (heartF(x, y, s) < 0) return 2;
    const a = Math.atan2(y - cy, x - cx);
    return Math.floor(((a + Math.PI) / (Math.PI * 2)) * nRays) % 2;
  };
  const density = (x, y) => (heartF(x, y, s * 1.05) < 0 ? 1.2 : 0.95);
  return { title: 'Glasherz', palette, regions, region, density };
}

function rosetteScene(W, H, rng) {
  const palette = ['#fff4d1', '#ffd36b', '#f29a3a', '#d9483b', '#a4243b', '#5b2a86', '#2f4fa2', '#3e8ed0', '#7cc6e8',
    '#2f8f6a', '#7cc47f', '#f6c9e0'];
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.47;
  const nRing = rng.int(4, 5);
  const radii = [];
  for (let i = 1; i <= nRing; i++) radii.push(R * Math.pow(i / nRing, 0.85));
  const sectors = rng.pick([8, 12, 16]);
  // Farbpaare für Ringe (aussen -> innen) zufällig aus Juwelentönen
  const pairs = rng.shuffle([[6, 7], [3, 4], [9, 10], [5, 6], [1, 2], [7, 8], [3, 2], [4, 5]]);
  const regions = [{ colors: [0, 11, 8] }]; // 0 Ecken
  for (let i = 0; i < nRing; i++) {
    regions.push({ colors: pairs[i % pairs.length] });
    regions.push({ colors: pairs[(i + 3) % pairs.length] });
  }
  regions.push({ colors: [1, 0] }); // Mitte
  const center = regions.length - 1;
  const region = (x, y) => {
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= R) return 0;
    if (d < radii[0] * 0.5) return center;
    let ring = 0;
    while (ring < nRing - 1 && d > radii[ring]) ring++;
    const k = Math.floor((((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * sectors + ring * 0.5)) % 2;
    return 1 + (nRing - 1 - ring) * 2 + k;
  };
  const density = () => 1;
  return { title: 'Rosette', palette, regions, region, density };
}

function treeScene(W, H, rng) {
  const palette = ['#eaf6fb', '#c4e3f2', '#93c7e6', '#fff0b3', '#cde9a6', '#9fd17a', '#6fb35a', '#3f8f48', '#2a6b3c',
    '#b07a4a', '#7a4f2e', '#e8483f', '#f7a8a0', '#d9c27a'];
  const groundY = H * rng.range(0.78, 0.84);
  const cx = W * rng.range(0.44, 0.56), cy = H * 0.4;
  const blobs = [];
  const n = rng.int(4, 6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
    blobs.push({ x: cx + Math.cos(a) * W * 0.14, y: cy + Math.sin(a) * H * 0.1, r: W * rng.range(0.15, 0.19) });
  }
  blobs.push({ x: cx, y: cy, r: W * 0.2 });
  const apples = [];
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(0.15, 0.3) * W;
    apples.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.75, r: W * 0.025 });
  }
  const sun = { x: rng.chance(0.5) ? W * 0.15 : W * 0.85, y: H * 0.13, r: W * 0.07 };
  const regions = [
    { bands: [[2, 1], [1, 0], [0, 1]], axis: [0, groundY] }, // 0 Himmel
    { colors: [3, 13] }, // 1 Sonne
    { colors: [5, 6, 7, 8] }, // 2 Krone
    { colors: [9, 10] }, // 3 Stamm
    { colors: [4, 5, 6] }, // 4 Wiese
    { colors: [11, 12] }, // 5 Äpfel
  ];
  const region = (x, y) => {
    for (const a of apples) if ((x - a.x) ** 2 + (y - a.y) ** 2 < a.r * a.r) return 5;
    for (const b of blobs) if ((x - b.x) ** 2 + (y - b.y) ** 2 < b.r * b.r) return 2;
    const ty = y - cy;
    if (ty > 0 && y < groundY + H * 0.03) {
      const half = W * 0.035 + Math.max(0, (y - (groundY - H * 0.1)) / (H * 0.1)) * W * 0.035;
      if (Math.abs(x - cx) < half) return 3;
    }
    if (y > groundY + Math.sin(x / W * 5) * H * 0.015) return 4;
    if ((x - sun.x) ** 2 + (y - sun.y) ** 2 < sun.r * sun.r) return 1;
    return 0;
  };
  const density = (x, y) => (Math.hypot(x - cx, (y - cy) * 1.2) < W * 0.32 ? 1.2 : 0.95);
  return { title: 'Lebensbaum', palette, regions, region, density };
}

function moonScene(W, H, rng) {
  const palette = ['#0f1a3d', '#1b2b5e', '#2a4080', '#3d5aa3', '#6b84c4', '#fff6c9', '#ffe28a', '#e9eef8', '#b9c6e4',
    '#4a5f8f', '#2f3f6b', '#24345a', '#1a2547'];
  const mx = W * rng.range(0.25, 0.75), my = H * rng.range(0.18, 0.28), mr = W * 0.12;
  const off = mr * 0.45;
  const stars = [];
  for (let i = 0; i < 7; i++) {
    stars.push({ x: rng.range(0.06, 0.94) * W, y: rng.range(0.05, 0.45) * H, r: W * rng.range(0.018, 0.026) });
  }
  const yM = H * 0.6;
  const ridges = [0, 1].map((i) => {
    const peaks = Array.from({ length: 3 }, (_, k) => ({ x: ((k + rng.range(0.2, 0.8)) / 3) * W, y: H * (0.38 + i * 0.12 + rng.range(0, 0.08)) }));
    return (x) => Math.min(...peaks.map((p) => p.y + Math.abs(x - p.x) * (0.9 - i * 0.2)));
  });
  const regions = [
    { bands: [[0, 1], [1, 2], [2, 3], [3, 4]], axis: [0, yM] }, // 0 Himmel
    { colors: [5, 6] }, // 1 Mond
    { colors: [6, 5] }, // 2 Sterne
    { colors: [8, 9, 7] }, // 3 Berge fern
    { colors: [10, 11, 12] }, // 4 Berge nah
    { colors: [7, 8] }, // 5 Schnee
  ];
  const starF = (x, y, s) => {
    const dx = Math.abs(x - s.x), dy = Math.abs(y - s.y);
    return Math.pow(dx / s.r, 0.6) + Math.pow(dy / s.r, 0.6) < 1;
  };
  const region = (x, y) => {
    const r1 = ridges[1](x), r0 = ridges[0](x);
    if (y > r1) return 4;
    if (y > r0) return y < r0 + H * 0.05 ? 5 : 3;
    const d1 = Math.hypot(x - mx, y - my), d2 = Math.hypot(x - mx - off, y - my + off * 0.3);
    if (d1 < mr && d2 > mr * 0.85) return 1;
    for (const s of stars) if (starF(x, y, s)) return 2;
    return 0;
  };
  const density = (x, y) => (y > ridges[0](x) ? 1.1 : 0.95);
  return { title: 'Mondglas', palette, regions, region, density };
}

const SCENES = [sunsetScene, flowerScene, wavesScene, heartScene, rosetteScene, treeScene, moonScene];

// ---------- Generator ----------

export function makeGlass(seed) {
  let best = null;
  let sites = 210;
  for (let attempt = 0; attempt < 5; attempt++) {
    const p = buildGlass(seed, sites);
    const n = p.shapes.length;
    if (n >= 160 && n <= 340) return p;
    const score = n < 160 ? 160 - n : n - 340;
    if (!best || score < best.score) best = { p, score };
    sites = Math.round(sites * (n < 160 ? 1.18 : 0.85));
  }
  return best.p;
}

function buildGlass(seed, nSites) {
  const rng = makeRng(hashString('glas:' + seed));
  const si = Number.isInteger(seed) ? (((seed - 1) % SCENES.length) + SCENES.length) % SCENES.length : hashString('gs' + seed) % SCENES.length;
  const portrait = SCENES[si] === treeScene || SCENES[si] === flowerScene ? true : rng.chance(0.25);
  const W = portrait ? 800 : 1000, H = 1000;
  const scene = SCENES[si](W, H, rng);

  // Raster
  const RES = 2; // Einheiten pro Pixel
  const w = Math.round(W / RES), h = Math.round(H / RES);
  const rid = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rid[y * w + x] = scene.region((x + 0.5) * RES, (y + 0.5) * RES);

  // Startpunkte nach Dichte, dann Lloyd (gewichtet)
  const sites = [];
  let guard = 0;
  while (sites.length < nSites && guard++ < nSites * 60) {
    const x = rng.range(0, W), y = rng.range(0, H);
    if (rng.next() * 1.4 < scene.density(x, y)) sites.push([x, y]);
  }
  lloyd(sites, W, H, scene.density, 4);

  // Zellen-Raster: nächster Punkt
  const S = sites.length;
  const cellOf = nearestSiteRaster(sites, w, h, RES);
  const key = new Int32Array(w * h);
  for (let k = 0; k < w * h; k++) key[k] = rid[k] * S + cellOf[k];
  const R = buildRegions(key, w, h);
  const ridOfClass = (c) => Math.floor(c / S);
  const avgCell = (w * h) / S;
  const cost = (a, b) => (ridOfClass(R.cls[a]) === ridOfClass(R.cls[b]) ? 0 : 1000);
  mergeSmall(R, { minArea: Math.max(10, avgCell * 0.16), cost, unify: false });
  mergeThin(R, 2.2, cost);
  mergeSmall(R, { minArea: Math.max(10, avgCell * 0.16), cost, unify: false });
  const L = relabel(R);

  // Farben je Fläche
  const F = L.F;
  const cx = new Float64Array(F), cy = new Float64Array(F), cnt = new Float64Array(F);
  for (let k = 0; k < w * h; k++) {
    const f = L.labels[k];
    cx[f] += (k % w) + 0.5; cy[f] += Math.floor(k / w) + 0.5; cnt[f]++;
  }
  // Nachbarn je Fläche
  const nb = Array.from({ length: F }, () => new Set());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, a = L.labels[k];
    if (x < w - 1 && L.labels[k + 1] !== a) { nb[a].add(L.labels[k + 1]); nb[L.labels[k + 1]].add(a); }
    if (y < h - 1 && L.labels[k + w] !== a) { nb[a].add(L.labels[k + w]); nb[L.labels[k + w]].add(a); }
  }
  const color = new Int32Array(F).fill(-1);
  const crng = makeRng(hashString('glasfarbe:' + seed));
  const order = Array.from({ length: F }, (_, i) => i).sort((a, b) => cy[a] / cnt[a] - cy[b] / cnt[b] || cx[a] / cnt[a] - cx[b] / cnt[b]);
  for (const f of order) {
    const reg = scene.regions[ridOfClass(L.cls[f])];
    const px = (cx[f] / cnt[f]) * RES, py = (cy[f] / cnt[f]) * RES;
    let opts = reg.colors;
    if (reg.bands) {
      let t;
      if (reg.radial) {
        const [ox, oy, r0, r1] = reg.radial;
        t = (Math.hypot(px - ox, py - oy) - r0) / (r1 - r0);
      } else {
        const [y0, y1] = reg.axis;
        t = (py - y0) / (y1 - y0);
      }
      t = Math.max(0, Math.min(0.999, t + crng.range(-0.06, 0.06)));
      opts = reg.bands[Math.floor(t * reg.bands.length)];
    } else if (reg.radialBands) {
      const [ox, oy, r0, r1] = reg.radial;
      let t = (Math.hypot(px - ox, py - oy) - r0) / (r1 - r0);
      t = Math.max(0, Math.min(0.999, t + crng.range(-0.08, 0.08)));
      opts = reg.radialBands[Math.floor(t * reg.radialBands.length)];
    }
    const used = new Set();
    for (const g of nb[f]) if (color[g] >= 0) used.add(color[g]);
    const free = opts.filter((c) => !used.has(c));
    color[f] = free.length ? free[Math.floor(crng.next() * free.length)] : opts[Math.floor(crng.next() * opts.length)];
  }

  // Vektorisieren: Szenengrenzen glatt, Zellgrenzen gerade
  const V = vectorize(L.labels, w, h, F, {
    scale: RES,
    mode: (a, b) => (a < 0 || b < 0 ? 'straight' : ridOfClass(L.cls[a]) !== ridOfClass(L.cls[b]) ? 'smooth' : 'straight'),
    tol: 0.45,
    tolStraight: 0.85,
    passes: 2,
  });
  const shapes = [];
  for (let f = 0; f < F; f++) {
    const s = { d: V.paths[f], c: color[f] };
    if (V.ringCount[f] > 1) s.r = 'evenodd';
    shapes.push(s);
  }
  // Bleiruten: alle inneren Ketten (am besten mit runden Linienenden/-ecken gezeichnet)
  const lead = chainsPath(V.chains, (c) => c.a >= 0 && c.b >= 0);
  const lines = [
    { d: lead, w: 5, color: LEAD },
    { d: `M0 0H${W}V${H}H0Z`, w: 14, color: LEAD },
  ];
  return finalizePuzzle({
    id: 'gen-glas-' + seed,
    title: scene.title + ' ' + seed,
    category: 'Buntglas',
    width: W,
    height: H,
    palette: scene.palette.slice(),
    shapes,
    lines,
  });
}

/** Gewichtete Lloyd-Relaxation auf grobem Raster. */
function lloyd(sites, W, H, density, iters) {
  const g = 4; // Einheiten pro Probe
  const gw = Math.ceil(W / (g * 3)), gh = Math.ceil(H / (g * 3));
  const step = W / gw;
  const stepY = H / gh;
  for (let it = 0; it < iters; it++) {
    const ax = new Float64Array(sites.length), ay = new Float64Array(sites.length), aw = new Float64Array(sites.length);
    const owner = nearestSiteRaster(sites, gw, gh, step, stepY);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const px = (x + 0.5) * step, py = (y + 0.5) * stepY;
        const wgt = density(px, py);
        const s = owner[y * gw + x];
        ax[s] += px * wgt; ay[s] += py * wgt; aw[s] += wgt;
      }
    }
    for (let i = 0; i < sites.length; i++) {
      if (aw[i] > 0) { sites[i][0] = ax[i] / aw[i]; sites[i][1] = ay[i] / aw[i]; }
    }
  }
}

/** Nächster Punkt je Rasterzelle (Gitter-beschleunigt). */
function nearestSiteRaster(sites, w, h, res, resY = res) {
  const W = w * res, H = h * resY;
  const S = sites.length;
  const cs = Math.sqrt((W * H) / S) * 1.2;
  const gw = Math.ceil(W / cs) + 1, gh = Math.ceil(H / cs) + 1;
  const buckets = Array.from({ length: gw * gh }, () => []);
  sites.forEach(([x, y], i) => {
    const bx = Math.min(gw - 1, Math.max(0, Math.floor(x / cs))), by = Math.min(gh - 1, Math.max(0, Math.floor(y / cs)));
    buckets[by * gw + bx].push(i);
  });
  const out = new Int32Array(w * h);
  for (let y = 0; y < h; y++) {
    const py = (y + 0.5) * resY;
    const by = Math.floor(py / cs);
    for (let x = 0; x < w; x++) {
      const px = (x + 0.5) * res;
      const bx = Math.floor(px / cs);
      let best = -1, bd = Infinity;
      for (let rad = 1; rad <= Math.max(gw, gh); rad++) {
        for (let yy = by - rad; yy <= by + rad; yy++) {
          if (yy < 0 || yy >= gh) continue;
          for (let xx = bx - rad; xx <= bx + rad; xx++) {
            if (xx < 0 || xx >= gw) continue;
            if (rad > 1 && Math.abs(yy - by) < rad && Math.abs(xx - bx) < rad) continue;
            for (const i of buckets[yy * gw + xx]) {
              const dx = sites[i][0] - px, dy = sites[i][1] - py;
              const d = dx * dx + dy * dy;
              if (d < bd) { bd = d; best = i; }
            }
          }
        }
        // Der gefundene Punkt ist sicher der nächste, wenn er näher liegt als der Rand des
        // abgesuchten Blocks (mindestens rad * cs entfernt).
        if (best >= 0 && bd <= rad * cs * rad * cs) break;
      }
      out[y * w + x] = best;
    }
  }
  return out;
}
