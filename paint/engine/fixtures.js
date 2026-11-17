// Testbilder für die Engine (nur mit ?debug=1 in der Galerie sichtbar).
// Decken ab: Maler-Reihenfolge mit Überlappungen, Kurven (C/S/Q/T/A, relativ), evenodd-Löcher,
// winzige Splitter (Auto-Füllung), sehr viele Formen (Leistung), nicht-quadratische Leinwände.

import { makeRng } from '../../shared/rng.js';

const f1 = (v) => (Math.round(v * 10) / 10).toString();

const rect = (x, y, w, h) => `M${f1(x)} ${f1(y)}H${f1(x + w)}V${f1(y + h)}H${f1(x)}Z`;
const circle = (cx, cy, r) =>
  `M${f1(cx - r)} ${f1(cy)}A${f1(r)} ${f1(r)} 0 1 0 ${f1(cx + r)} ${f1(cy)}A${f1(r)} ${f1(r)} 0 1 0 ${f1(cx - r)} ${f1(cy)}Z`;
const ring = (cx, cy, r1, r2) => circle(cx, cy, r2) + circle(cx, cy, r1);
const poly = (pts) => 'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L') + 'Z';

/** Geschlossene, glatte Kurve durch Punkte (Catmull-Rom -> kubische Bezier). */
function smooth(pts) {
  const n = pts.length;
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + 'Z';
}

function star(cx, cy, r1, r2, k, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < k * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / k;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}

// ---------------------------------------------------------------- Mini (für den Abschluss-Test)

function mini() {
  return {
    id: 'fx-mini', title: 'Mini-Haus', category: 'Test', width: 1000, height: 1000,
    palette: ['#bfe3f5', '#8ccf7e', '#ffd54f', '#f28b82', '#a1764f'],
    shapes: [
      { d: rect(0, 0, 1000, 1000), c: 0 },
      { d: rect(0, 680, 1000, 320), c: 1 },
      { d: circle(760, 230, 120), c: 2 },
      { d: rect(220, 460, 360, 340), c: 3 },
      { d: poly([[190, 470], [400, 280], [610, 470]]), c: 4 },
      { d: rect(360, 610, 90, 190), c: 4 },
      { d: rect(470, 520, 80, 70) + rect(482, 532, 56, 46), c: 2, r: 'evenodd' },
    ],
  };
}

// ---------------------------------------------------------------- Kurven

function curves() {
  const shapes = [{ d: rect(0, 0, 1000, 1000), c: 0 }];
  // Wellen (T-Befehle, relativ)
  shapes.push({ d: 'M0 760q62.5 -60 125 0t125 0t125 0t125 0t125 0t125 0t125 0t125 0V1000H0Z', c: 1 });
  shapes.push({ d: 'M0 850Q62.5 800 125 850T250 850T375 850T500 850T625 850T750 850T875 850T1000 850V1000H0Z', c: 2 });
  // Blume: Blütenblätter mit Q
  const cx = 420, cy = 380;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const tip = [cx + Math.cos(a) * 230, cy + Math.sin(a) * 230];
    const l = [cx + Math.cos(a - 0.5) * 120, cy + Math.sin(a - 0.5) * 120];
    const r = [cx + Math.cos(a + 0.5) * 120, cy + Math.sin(a + 0.5) * 120];
    shapes.push({
      d: `M${f1(cx)} ${f1(cy)}Q${f1(l[0])} ${f1(l[1])} ${f1(tip[0])} ${f1(tip[1])}Q${f1(r[0])} ${f1(r[1])} ${f1(cx)} ${f1(cy)}Z`,
      c: k % 2 ? 3 : 4,
    });
  }
  shapes.push({ d: circle(cx, cy, 70), c: 5 });
  // Stiel und Blatt mit C und S
  shapes.push({ d: 'M410 600C400 700 430 800 415 900L440 900C455 800 425 700 435 600Z', c: 6 });
  shapes.push({ d: 'M430 760c40 -60 120 -80 180 -60s-60 110 -180 60Z', c: 6 });
  // Sonne mit relativen Bögen
  shapes.push({ d: 'M760 150a90 90 0 1 0 180 0a90 90 0 1 0 -180 0Z', c: 4 });
  // Wolke aus Bögen
  shapes.push({ d: 'M560 230A50 50 0 0 1 640 190A60 60 0 0 1 740 220A40 40 0 0 1 740 290H580A30 30 0 0 1 560 230Z', c: 7 });
  return {
    id: 'fx-curves', title: 'Kurven', category: 'Test', width: 1000, height: 1000,
    palette: ['#cfe8ff', '#5aa0d8', '#2f6fa8', '#ff9db5', '#ffd166', '#f4a259', '#5fae6b', '#ffffff'],
    shapes,
  };
}

// ---------------------------------------------------------------- Löcher

function holes() {
  const shapes = [{ d: rect(0, 0, 1000, 1000), c: 0 }];
  // Zielscheibe aus Ringen (evenodd)
  const cols = [1, 2, 1, 2, 1];
  for (let k = 0; k < 5; k++) shapes.push({ d: ring(330, 330, 250 - k * 50 - 25, 250 - k * 50), c: cols[k] });
  shapes.push({ d: circle(330, 330, 25), c: 3 });
  // Rahmen mit quadratischem Loch und Form im Loch
  shapes.push({ d: rect(560, 560, 380, 380) + rect(640, 640, 220, 220), c: 4, r: 'evenodd' });
  shapes.push({ d: circle(750, 750, 80), c: 3 });
  // Loch in Loch: Acht mit zwei Löchern
  shapes.push({ d: rect(600, 90, 330, 380) + circle(765, 190, 60) + circle(765, 370, 60), c: 5, r: 'evenodd' });
  shapes.push({ d: rect(60, 640, 400, 300) + star(260, 790, 130, 55, 5), c: 6, r: 'evenodd' });
  return {
    id: 'fx-holes', title: 'Löcher', category: 'Test', width: 1000, height: 1000,
    palette: ['#fff4e0', '#e85d75', '#ffffff', '#ffc145', '#4f9d69', '#7b6cf6', '#46b1c9'],
    shapes,
  };
}

// ---------------------------------------------------------------- Splitter

function slivers() {
  const shapes = [{ d: rect(0, 0, 1000, 1000), c: 0 }];
  // Streifen unterschiedlicher Breite
  [0.4, 1, 2, 3, 5, 9].forEach((w, k) => shapes.push({ d: rect(80 + k * 60, 80, w, 380), c: 1 }));
  // Punkte unterschiedlicher Grösse
  [0.5, 1, 1.5, 2.5, 4, 8].forEach((r, k) => shapes.push({ d: circle(120 + k * 70, 560, r), c: 2 }));
  // Form komplett verdeckt von späterer Form
  shapes.push({ d: rect(560, 100, 100, 100), c: 3 });
  shapes.push({ d: rect(540, 80, 140, 140), c: 4 });
  // Fläche null
  shapes.push({ d: 'M700 300L800 400Z', c: 3 });
  // Grosse Form, fast ganz verdeckt: nur ein dünner Rand bleibt (1.5 Einheiten)
  shapes.push({ d: rect(600, 600, 300, 300), c: 5 });
  shapes.push({ d: rect(601.5, 601.5, 297, 297), c: 6 });
  // Kleine, gerade noch antippbare Form
  shapes.push({ d: circle(300, 800, 14), c: 5 });
  shapes.push({ d: rect(80, 700, 120, 3), c: 3 });
  return {
    id: 'fx-slivers', title: 'Splitter', category: 'Test', width: 1000, height: 1000,
    palette: ['#f6f1e7', '#d1495b', '#00798c', '#edae49', '#66a182', '#8d6a9f', '#c5e6a6'],
    shapes,
  };
}

// ---------------------------------------------------------------- Voronoi (Leistung)

function clipHalf(polyPts, mx, my, nx, ny) {
  const out = [];
  const n = polyPts.length;
  for (let i = 0; i < n; i++) {
    const a = polyPts[i], b = polyPts[(i + 1) % n];
    const da = (a[0] - mx) * nx + (a[1] - my) * ny;
    const db = (b[0] - mx) * nx + (b[1] - my) * ny;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

const VORO_PAL = ['#264653', '#2a9d8f', '#8ab17d', '#e9c46a', '#f4a261', '#e76f51', '#d62828', '#f77f00',
  '#fcbf49', '#eae2b7', '#003049', '#669bbc', '#c1121f', '#780000', '#fdf0d5', '#a8dadc', '#457b9d', '#1d3557',
  '#b5838d', '#6d6875'];

function voronoi(id, title, G = 32, W = 1000, H = 1000) {
  const rng = makeRng(id);
  const cw = W / G, ch = H / G;
  const pts = [];
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    pts.push([(x + 0.5 + (rng.next() - 0.5) * 0.8) * cw, (y + 0.5 + (rng.next() - 0.5) * 0.8) * ch]);
  }
  const shapes = [];
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const p = pts[y * G + x];
    let cell = [[0, 0], [W, 0], [W, H], [0, H]];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= G || yy >= G) continue;
      const q = pts[yy * G + xx];
      cell = clipHalf(cell, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, q[0] - p[0], q[1] - p[1]);
      if (cell.length < 3) break;
    }
    if (cell.length < 3) continue;
    const v = (Math.sin(p[0] * 0.006) + Math.cos(p[1] * 0.0075) + Math.sin((p[0] + p[1]) * 0.004) + 3) / 6;
    const c = Math.min(VORO_PAL.length - 1, Math.floor(v * VORO_PAL.length * 0.999 + (rng.next() - 0.5) * 2.2));
    shapes.push({ d: poly(cell), c: Math.max(0, c) });
  }
  return { id, title, category: 'Test', width: W, height: H, palette: VORO_PAL, shapes };
}

// ---------------------------------------------------------------- Blasen (Leistung, Kurven, Überlappung)

function blobs() {
  const rng = makeRng('fx-blobs');
  const G = 38, cell = 1000 / G;
  const pal = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff',
    '#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#ff9f1c', '#2ec4b6', '#cbf3f0', '#ffbf69',
    '#606c38', '#283618', '#dda15e', '#bc6c25', '#8338ec', '#3a86ff', '#fb5607'];
  const shapes = [{ d: rect(0, 0, 1000, 1000), c: 9 }];
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const cx = (x + 0.5) * cell + (rng.next() - 0.5) * cell * 0.3;
    const cy = (y + 0.5) * cell + (rng.next() - 0.5) * cell * 0.3;
    const k = 6;
    const pts = [];
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + rng.next() * 0.4;
      const r = cell * (0.5 + rng.next() * 0.28);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    const band = Math.floor(((Math.sin(x * 0.35) + Math.cos(y * 0.28) + 2) / 4) * 8);
    const c = (band * 3 + Math.floor(rng.next() * 3)) % pal.length;
    shapes.push({ d: smooth(pts), c });
  }
  return { id: 'fx-blobs', title: 'Blasen 1400', category: 'Test', width: 1000, height: 1000, palette: pal, shapes };
}

// ---------------------------------------------------------------- Hochformat / Querformat

function tall() {
  const W = 700, H = 1000;
  const shapes = [
    { d: rect(0, 0, W, H), c: 0 },
    { d: circle(520, 210, 95), c: 1 },
    { d: smooth([[-50, 560], [120, 380], [260, 470], [420, 330], [600, 450], [760, 400], [760, 700], [-50, 700]]), c: 2 },
    { d: smooth([[-60, 640], [150, 520], [330, 600], [520, 500], [760, 600], [760, 760], [-60, 760]]), c: 3 },
    { d: rect(0, 700, W, 300), c: 4 },
    { d: 'M120 780C180 740 420 740 560 790C600 860 420 930 260 910C140 900 80 830 120 780Z' +
         'M300 820C330 800 400 805 410 830C400 860 330 865 300 850C290 840 292 828 300 820Z', c: 5, r: 'evenodd' },
  ];
  for (let k = 0; k < 5; k++) {
    const x = 40 + k * 34, y = 690 - (k % 2) * 30;
    shapes.push({ d: poly([[x, y], [x + 22, y - 90], [x + 44, y]]), c: 6 });
  }
  return {
    id: 'fx-tall', title: 'Hochformat', category: 'Test', width: W, height: H,
    palette: ['#ffe8d6', '#ffb703', '#8e9aaf', '#6b705c', '#a3b18a', '#90e0ef', '#344e41'],
    shapes,
  };
}

function wide() {
  const W = 1000, H = 560;
  const shapes = [{ d: rect(0, 0, W, H), c: 0 }];
  for (let k = 0; k < 7; k++) {
    const y = 120 + k * 60;
    shapes.push({ d: `M0 ${y}C250 ${y - 70} 450 ${y + 70} 700 ${y}S1000 ${y - 40} 1000 ${y}V${H}H0Z`, c: 1 + (k % 4) });
  }
  shapes.push({ d: circle(820, 100, 60), c: 5 });
  return {
    id: 'fx-wide', title: 'Querformat', category: 'Test', width: W, height: H,
    palette: ['#fef9ef', '#ffcb77', '#fe6d73', '#17c3b2', '#227c9d', '#ffd23f'],
    shapes,
  };
}

let cache = new Map();
const lazy = (id, title, fn) => ({
  id, title,
  make: () => {
    if (!cache.has(id)) cache.set(id, fn());
    return JSON.parse(JSON.stringify(cache.get(id)));
  },
});

export const fixtures = [
  lazy('fx-mini', 'Mini-Haus', mini),
  lazy('fx-curves', 'Kurven', curves),
  lazy('fx-holes', 'Löcher', holes),
  lazy('fx-slivers', 'Splitter', slivers),
  lazy('fx-tall', 'Hochformat', tall),
  lazy('fx-wide', 'Querformat', wide),
  lazy('fx-voronoi', 'Voronoi 1000', () => voronoi('fx-voronoi', 'Voronoi 1000')),
  lazy('fx-blobs', 'Blasen 1400', blobs),
];

export { mini, curves, holes, slivers, voronoi, blobs, tall, wide, circle, rect, ring, smooth };
