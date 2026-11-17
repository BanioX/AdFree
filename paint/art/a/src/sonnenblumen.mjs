// Sonnenblumen in Vase – three sunflowers in a painted jug on a lace doily, harlequin wallpaper behind.
import { intersect, smoothPoly, shapePath, ellipsePoly } from './geom.mjs';
import { Pic, DEG, TAU, poly, smooth, tf, circle, ellipse, leafHalves, petalPts, polarPt, lerp, sampleSmooth, rect } from './lib.mjs';

export const meta = { id: 'a-sonnenblumen', title: 'Sonnenblumen in Vase', category: 'Blumen' };

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    wall1: '#e4eef4',
    wall2: '#c8dbea',
    wood1: '#e3b688',
    wood2: '#c9925f',
    lace: '#fdf7ec',
    y1: '#ffe680',
    y2: '#fcc734',
    y3: '#f2a024',
    y4: '#d9771a',
    b1: '#a8642f',
    b2: '#76401f',
    b3: '#4a2816',
    g1: '#b0d374',
    g2: '#72a84f',
    g3: '#417c40',
    blue: '#5a86bf',
    navy: '#2f5189',
  });

  // --- harlequin wallpaper
  pic.add(rect(0, 0, 1000, 780), 'wall1');
  const HW = 100, HH = 130;
  for (let j = 0; j <= 6; j++) {
    for (let i = 0; i <= 5; i++) {
      const cx = i * 2 * HW, cy = j * 2 * HH - 40;
      pic.add(poly([[cx, cy - HH], [cx + HW, cy], [cx, cy + HH], [cx - HW, cy]]), 'wall2');
    }
  }

  // --- wooden table (planks)
  pic.add(rect(0, 760, 1000, 240), 'wood1');
  pic.add(rect(0, 760, 1000, 34), 'wood2');
  pic.add(rect(0, 875, 1000, 40), 'wood2');

  // lace doily under the vase (scalloped ellipse + inner ring)
  {
    const pts = [];
    const n = 22;
    for (let i = 0; i < n * 4; i++) {
      const a = (i / (n * 4)) * TAU;
      const sc = 1 + 0.05 * Math.abs(Math.sin((a * n) / 2));
      pts.push([500 + Math.cos(a) * 290 * sc, 905 + Math.sin(a) * 66 * sc]);
    }
    pic.add(poly(pts), 'lace');
    pic.add(ellipse(500, 905, 236, 46), 'wall2');
    pic.add(ellipse(500, 905, 210, 36), 'lace');
  }

  // fallen petals
  pic.add(smooth(tf(petalPts(80, 30, { tip: 'round' }), { x: 160, y: 900, r: -20 * DEG })), 'y2');
  pic.add(smooth(tf(petalPts(74, 28, { tip: 'round' }), { x: 840, y: 950, r: 200 * DEG })), 'y3');

  // --- stems
  const stem = (pts, w) => {
    const s = sampleSmooth(pts, { steps: 10 });
    const L = [], Rr = [];
    for (let i = 0; i < s.length; i++) {
      const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
      L.push([s[i][0] - (dy / m) * w, s[i][1] + (dx / m) * w]);
      Rr.push([s[i][0] + (dy / m) * w, s[i][1] - (dx / m) * w]);
    }
    pic.add(poly([...L, ...Rr.reverse()]), 'g3');
  };
  stem([[490, 700], [492, 520], [500, 340]], 11);

  // --- leaves
  for (const [x, y, a, len, w, bend] of [
    [470, 650, -165, 200, 92, 0.08],
    [530, 650, -15, 200, 92, -0.08],
    [420, 575, -140, 150, 70, 0.1],
    [590, 560, -38, 150, 70, -0.1],
  ]) {
    const [A, B] = leafHalves(x, y, a * DEG, len, w, { bend, n: 4 });
    pic.add(A, 'g1');
    pic.add(B, 'g2');
  }

  // --- the jug
  {
    const body = smoothPoly([
      [440, 636], [430, 690], [370, 760], [362, 830], [400, 892], [440, 908], [560, 908], [600, 892], [638, 830], [630, 760], [570, 690], [560, 636],
    ], 1, 12);
    pic.add(poly(body), 'blue');
    const band = (y0, y1, col) => pic.add(shapePath(intersect(body, [[300, y0], [700, y0], [700, y1], [300, y1]])), col);
    band(770, 840, 'lace');
    band(740, 770, 'navy');
    band(840, 864, 'navy');
    for (let i = 0; i < 5; i++) pic.add(circle(420 + i * 40, 805, 13), i % 2 ? 'y2' : 'blue');
    pic.add(smooth([[420, 640], [440, 616, 'c'], [560, 616, 'c'], [580, 640], [560, 656], [440, 656]]), 'navy');
  }

  // --- sunflowers
  const sunflower = (cx, cy, R, tilt, sq, nPet = 16) => {
    const T = (pts) => tf(pts, { x: cx, y: cy, r: tilt, sy: sq });
    const step = TAU / nPet;
    for (let i = 0; i < nPet; i++) {
      const a = (i + 0.5) * step;
      pic.add(smooth(T(tf(petalPts(R, R * 0.34, { tip: 'point', wAt: 0.5 }), { r: a }))), i % 2 ? 'y4' : 'y3');
    }
    for (let i = 0; i < nPet; i++) {
      const a = i * step;
      pic.add(smooth(T(tf(petalPts(R * 0.8, R * 0.32, { tip: 'point', wAt: 0.5 }), { r: a }))), i % 2 ? 'y1' : 'y2');
    }
    const r0 = R * 0.46, r1 = R * 0.31, nS = 10;
    pic.add(poly(T(ellipsePoly(0, 0, r0, r0, 48))), 'b3');
    for (let s = 0; s < nS; s += 1) {
      if (s % 2) continue;
      const a1 = (s / nS) * TAU, a2 = ((s + 1) / nS) * TAU;
      const pts = [];
      for (let k = 0; k <= 6; k++) pts.push(polarPt(0, 0, r0 - 2, lerp(a1, a2, k / 6)));
      for (let k = 6; k >= 0; k--) pts.push(polarPt(0, 0, r1, lerp(a1, a2, k / 6)));
      pic.add(poly(T(pts)), 'b2');
    }
    pic.add(poly(T(ellipsePoly(0, 0, r1, r1, 40))), 'b1');
    pic.add(poly(T(ellipsePoly(-R * 0.05, -R * 0.05, R * 0.15, R * 0.15, 32))), 'b2');
  };
  sunflower(290, 455, 140, -18 * DEG, 0.86);
  sunflower(725, 425, 140, 20 * DEG, 0.86);
  sunflower(500, 300, 175, 0, 1, 18);

  return pic;
}
