// Tulpenfeld – low view through tall tulips onto striped tulip rows, a windmill, sun and clouds.
import { Pic, DEG, smooth, tf, poly, circle, rect, sampleSmooth, bandPts, splitByLines, wavePts, leafHalves, mirrorX, clipHalf } from './lib.mjs';
import { union, intersect, smoothPoly, circlePoly, shapePath } from './geom.mjs';

export const meta = { id: 'a-tulpenfeld', title: 'Tulpenfeld', category: 'Blumen' };

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    sky1: '#8ccaee',
    sky2: '#addcf4',
    sky3: '#d3edf9',
    white: '#ffffff',
    sunHalo: '#fff0b8',
    yellow: '#ffd23f',
    orange: '#ff9136',
    hillFar: '#b2d7a4',
    hill: '#7fba6c',
    grass: '#b9da72',
    leafMid: '#5a9f4c',
    leafDark: '#2f7341',
    brick: '#c46a4c',
    roof: '#5b4740',
    red: '#e8434f',
    redDark: '#b02a3e',
    pink: '#f68cba',
    pinkDark: '#d9578f',
  });

  // tall foreground tulips (stem bottom x, head x, head base y, size, colours)
  const tulips = [
    { bx: 168, hx: 186, hy: 552, s: 178, rotA: -5, front: 'red', side: 'redDark', cup: 'roof' },
    { bx: 404, hx: 396, hy: 610, s: 150, rotA: 4, front: 'sunHalo', side: 'yellow', cup: 'orange' },
    { bx: 846, hx: 822, hy: 572, s: 186, rotA: 6, front: 'pink', side: 'pinkDark', cup: 'redDark' },
  ];
  const mill = { x: 598, y: 404 };
  // cutters: vertical-ish lines hidden under stems / tower; a band is cut if it lies fully below `top`
  const cutters = [
    ...tulips.map((t) => ({ line: [[t.bx, 1010], [t.hx, t.hy - t.s * 0.6]], x: t.hx, top: t.hy - t.s * 1.06 })),
    { line: [[mill.x, 560], [mill.x, mill.y + 10]], x: mill.x, top: mill.y - 70, maxY: 476 },
  ];
  const addBand = (pts, color) => {
    const lines = [];
    for (const c of cutters) {
      // band's top edge near the cutter
      const near = pts.filter((p) => Math.abs(p[0] - c.x) < 30);
      if (!near.length) continue;
      const topY = Math.min(...near.map((p) => p[1]));
      if (topY >= c.top && (c.maxY === undefined || topY <= c.maxY)) lines.push(c.line);
    }
    lines.sort((a, b) => a[0][0] - b[0][0]);
    const pieces = lines.length ? splitByLines(pts, lines, 150) : [pts];
    for (const p of pieces) pic.add(poly(p), color);
  };

  // --- sky in three soft bands
  pic.add(rect(0, 0, 1000, 600), 'sky1');
  addBand(bandPts(wavePts(-10, 1010, 128, 14, 560, 0.6), [[-10, 600], [1010, 600]]), 'sky2');
  addBand(bandPts(wavePts(-10, 1010, 330, 12, 470, 2.4), [[-10, 600], [1010, 600]]), 'sky3');

  // --- sun with a soft halo
  pic.add(circle(822, 150, 108), 'sunHalo');
  pic.add(circle(822, 150, 72), 'yellow');

  // --- clouds
  cloud(pic, 236, 150, 0.95);
  cloud(pic, 560, 248, 0.66);

  // --- hills
  addBand(bandPts([[-10, 478], [160, 458], [330, 474], [520, 446], [720, 466], [880, 444], [1010, 458]], [[-10, 600], [1010, 600]]), 'hillFar');
  addBand(bandPts([[-10, 530], [140, 512], [330, 520], [500, 500], [640, 488], [800, 506], [1010, 520]], [[-10, 600], [1010, 600]]), 'hill');

  // --- windmill on the hill
  windmill(pic, mill.x, mill.y);

  // --- tulip rows (perspective: thinner far away)
  const tops = [566, 588, 614, 646, 686, 734, 788, 846];
  const rowCols = ['orange', 'hill', 'red', 'hill', 'pink', 'hill', 'yellow', 'grass'];
  for (let i = 0; i < tops.length; i++) {
    const y = tops[i], h = (tops[i + 1] ?? 1000) - y;
    const curve = [[-10, y + 3], [250, y - 2], [500, y], [750, y - 3], [1010, y + 2]];
    let top = curve;
    if (!['hill', 'grass'].includes(rowCols[i])) {
      // scalloped top edge: a row of tulip heads
      const n = Math.round(1020 / (h * 1.5));
      const w = 1020 / n, bump = h * 0.42;
      const base = sampleSmooth(curve, { steps: 10 });
      const yAt = (x) => base.reduce((b, p) => (Math.abs(p[0] - x) < Math.abs(b[0] - x) ? p : b))[1];
      top = [];
      for (let j = 0; j < n; j++) {
        const xa = -10 + j * w;
        top.push([xa, yAt(xa), 'c'], [xa + w * 0.18, yAt(xa) - bump * 0.75], [xa + w * 0.5, yAt(xa) - bump], [xa + w * 0.82, yAt(xa) - bump * 0.75]);
      }
      top.push([1010, yAt(1010), 'c']);
    }
    addBand(bandPts(top, [[-10, 1010], [1010, 1010]], { steps: 5 }), rowCols[i]);
  }

  // --- daisies in the grass
  for (const [x, y, r] of [[285, 912, 31], [560, 940, 34], [664, 884, 30], [958, 932, 30], [42, 948, 30]]) daisy(pic, x, y, r);

  // --- tall tulips
  for (const t of tulips) bigTulip(pic, t);

  // --- two birds (decorative lines)
  pic.line('M404 92q14 -12 26 0q12 -12 26 0', 3.5, '#5b6b78');
  pic.line('M462 128q10 -9 19 0q9 -9 19 0', 3, '#5b6b78');

  return pic;
}

function daisy(pic, x, y, r) {
  const petals = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    petals.push(smoothPoly(tf([[0, -r * 0.2], [r * 0.6, -r * 0.34], [r, 0], [r * 0.6, r * 0.34], [0, r * 0.2]], { x, y, r: a }), 1, 6));
  }
  pic.add(shapePath(union(...petals, circlePoly(x, y, r * 0.45, 24))), 'white');
  pic.add(circle(x, y, r * 0.36), 'yellow');
}

function cloud(pic, cx, cy, s) {
  const puffs = [[-118, 12, 50], [-60, -18, 64], [10, -36, 76], [82, -12, 60], [132, 16, 44]];
  const shade = union(
    ...puffs.map(([dx, dy, r]) => circlePoly(cx + dx * s, cy + dy * s, r * s, 48)),
    smoothPoly([[cx - 150 * s, cy + 14 * s], [cx - 132 * s, cy + 42 * s], [cx + 150 * s, cy + 42 * s], [cx + 166 * s, cy + 18 * s]], 0.5),
  );
  pic.add(shapePath(shade), 'sky3');
  const white = intersect(
    union(...puffs.map(([dx, dy, r]) => circlePoly(cx + dx * s, cy + (dy - 10) * s, r * s * 0.94, 48))),
    [[cx - 400, cy - 400], [cx + 400, cy - 400], [cx + 400, cy + 16 * s], [cx - 400, cy + 16 * s]],
  );
  pic.add(shapePath(white), 'white');
}

function windmill(pic, hx, hy) {
  const s = 0.82;
  const T = (pts) => tf(pts, { x: hx, y: hy, s });
  // sails first (behind tower and cap), X-shaped
  for (let k = 0; k < 4; k++) {
    const a = (45 + k * 90) * DEG;
    pic.add(poly(tf([[0, -10], [106, -10], [106, 24], [0, 24]], { x: hx, y: hy, r: a, s })), 'white');
  }
  pic.add(smooth(T([[-30, 6, 'c'], [30, 6, 'c'], [52, 150, 'c'], [-52, 150, 'c']])), 'brick');
  pic.add(smooth(T([[-16, 152, 'c'], [-16, 118], [0, 102], [16, 118], [16, 152, 'c']])), 'roof');
  pic.add(circle(hx, hy + 62 * s, 13 * s), 'white');
  pic.add(smooth(T([[-42, 16, 'c'], [-32, -16], [0, -34], [32, -16], [42, 16, 'c']])), 'roof');
  pic.add(circle(hx, hy - 2 * s, 14 * s), 'brick');
}

function bigTulip(pic, { bx, hx, hy, s, rotA, front, side, cup }) {
  // leaves rising from the bottom edge, staying inside the grass row
  const lh = 128;
  const L = leafHalves(bx - 8, 1010, (-90 - 31) * DEG, lh * 1.22, s * 0.42, { bend: 0.14, n: 4 });
  pic.add(L[0], 'leafMid');
  pic.add(L[1], 'hill');
  const R = leafHalves(bx + 8, 1010, (-90 + 33) * DEG, lh * 1.14, s * 0.4, { bend: -0.14, n: 4 });
  pic.add(R[0], 'hill');
  pic.add(R[1], 'leafMid');
  // stem (reaches into the head so it covers the cut line)
  const sw = s * 0.075;
  const mx = (bx + hx) / 2 + (hx - bx) * 0.15, my = (1012 + hy) / 2;
  pic.add(smooth([[bx - sw, 1014, 'c'], [mx - sw, my], [hx - sw, hy - s * 0.3], [hx + sw, hy - s * 0.3], [mx + sw, my], [bx + sw, 1014, 'c']]), 'leafDark');
  // head (local: base at 0,0 pointing up; height 1)
  const T = (pts) => smooth(tf(pts, { x: hx, y: hy, s, r: rotA * DEG }));
  // the dark inside shows in two V-gaps: one region each
  const cupPts = sampleSmooth([[0, 0.02], [-0.3, -0.3], [-0.38, -0.74], [-0.24, -0.97], [0, -0.92], [0.24, -0.97], [0.38, -0.74], [0.3, -0.3]], { closed: true, steps: 8 });
  for (const keepLeft of [true, false]) {
    const half = clipHalf(cupPts, [0, 1], [0, -2], keepLeft);
    pic.add(poly(tf(half, { x: hx, y: hy, s, r: rotA * DEG })), cup);
  }
  const sideP = [[-0.02, 0.06, 'c'], [-0.34, -0.06], [-0.5, -0.46], [-0.44, -0.86], [-0.32, -1.04, 'c'], [-0.26, -0.84], [-0.16, -0.56], [-0.04, -0.34]];
  pic.add(T(sideP), side);
  pic.add(T(mirrorX(sideP, 0)), side);
  const frontP = [[0, 0.1, 'c'], [-0.28, 0], [-0.3, -0.4], [-0.18, -0.78], [0, -1.0, 'c'], [0.18, -0.78], [0.3, -0.4], [0.28, 0]];
  pic.add(T(frontP), front);
}
