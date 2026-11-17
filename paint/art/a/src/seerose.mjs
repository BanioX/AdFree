// Seerose – a blooming water lily on its pad, more pads, a bud and a dragonfly on rippled water.
import { Pic, DEG, TAU, poly, smooth, tf, circle, ellipse, leafHalves, petalPts, polarPt, lerp } from './lib.mjs';

export const meta = { id: 'a-seerose', title: 'Seerose', category: 'Blumen' };

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    w1: '#d4ecee',
    w2: '#acd8de',
    w3: '#84c2cc',
    w4: '#5aa3b3',
    g1: '#c4df8f',
    g2: '#93c46a',
    g3: '#5f9e57',
    g4: '#3d7a4a',
    p1: '#fff0f4',
    p2: '#fbcfdd',
    p3: '#f4a6c0',
    p4: '#e57ea2',
    p5: '#c95885',
    y1: '#ffe59a',
    y2: '#f9c24e',
    y3: '#e8932f',
    v1: '#b9a8e6',
    v2: '#6f5aa8',
  });

  const F = [520, 470]; // flower centre

  // --- rippled water: wavy rings around the flower, each ring cut into sectors
  pic.add('M0 0H1000V1000H0Z', 'w4');
  const R = [300, 370, 450, 540, 640, 760, 900];
  const rad = (i, a) => R[i] + 12 * Math.sin(6 * a + i * 1.3);
  const ringCols = ['w1', 'w2', 'w1', 'w3', 'w2', 'w3'];
  for (let i = R.length - 2; i >= 0; i--) {
    const nSec = i < 2 ? 4 : 6;
    const off = (i * 23) * DEG;
    for (let s = 0; s < nSec; s++) {
      const a1 = off + (s / nSec) * TAU, a2 = off + ((s + 1) / nSec) * TAU;
      const pts = [];
      const n = 40;
      for (let k = 0; k <= n; k++) {
        const a = lerp(a1, a2, k / n);
        pts.push(polarPt(F[0], F[1], rad(i + 1, a), a));
      }
      for (let k = n; k >= 0; k--) {
        const a = lerp(a1, a2, k / n);
        pts.push(polarPt(F[0], F[1], rad(i, a), a));
      }
      pic.add(poly(pts), ringCols[i]);
    }
  }
  pic.add(circle(F[0], F[1], 302), 'w1');

  // --- lily pads: discs with a notch, cut into vein sectors
  const pad = (cx, cy, r, notch, light = 'g1', dark = 'g2', n = 6) => {
    const gap = 0.2;
    const a0 = notch + gap, a1 = notch + TAU - gap;
    const C = polarPt(cx, cy, r * 0.06, notch);
    for (let s = 0; s < n; s++) {
      const b0 = lerp(a0, a1, s / n), b1 = lerp(a0, a1, (s + 1) / n);
      const pts = [C];
      for (let k = 0; k <= 10; k++) {
        const a = lerp(b0, b1, k / 10);
        pts.push(polarPt(cx, cy, r * (1 + 0.025 * Math.sin(a * 5)), a));
      }
      pic.add(poly(pts), s % 2 ? dark : light);
    }
  };
  pad(160, 190, 150, 30 * DEG, 'g2', 'g3');
  pad(860, 210, 118, 150 * DEG, 'g1', 'g2', 5);
  pad(150, 800, 175, -40 * DEG, 'g1', 'g2');
  pad(850, 820, 150, -130 * DEG, 'g2', 'g3');
  pad(560, 900, 95, -100 * DEG, 'g3', 'g4', 5);
  pad(F[0] + 30, F[1] + 40, 300, 60 * DEG, 'g3', 'g4', 8);

  // small floating blossoms
  const blossom = (x, y, s, col, mid) => {
    for (let i = 0; i < 5; i++) pic.add(smooth(tf(petalPts(s, s * 0.8, { tip: 'round' }), { x, y, r: (i * 72 - 90) * DEG })), col);
    pic.add(circle(x, y, s * 0.3), mid);
  };
  blossom(330, 70, 44, 'p2', 'y2');
  blossom(70, 520, 40, 'p3', 'y1');
  blossom(960, 520, 40, 'p2', 'y1');

  // --- bud on the small pad (top right)
  {
    const bx = 850, by = 214;
    pic.add(smooth(tf(petalPts(150, 92, { tip: 'point', wAt: 0.4 }), { x: bx, y: by + 40, r: -90 * DEG })), 'p4');
    pic.add(smooth(tf(petalPts(140, 66, { tip: 'point', wAt: 0.45 }), { x: bx - 14, y: by + 40, r: -100 * DEG })), 'p2');
    pic.add(smooth(tf(petalPts(128, 58, { tip: 'point', wAt: 0.45 }), { x: bx + 16, y: by + 40, r: -78 * DEG })), 'p3');
    pic.add(smooth(tf(petalPts(84, 46, { tip: 'point', wAt: 0.4 }), { x: bx - 4, y: by + 48, r: -140 * DEG })), 'g4');
    pic.add(smooth(tf(petalPts(84, 46, { tip: 'point', wAt: 0.4 }), { x: bx + 4, y: by + 48, r: -40 * DEG })), 'g3');
  }

  // --- the water lily: three rings of two-tone pointed petals
  const rings = [
    { n: 10, len: 250, w: 112, off: -90, A: 'p1', B: 'p2' },
    { n: 9, len: 196, w: 98, off: -70, A: 'p2', B: 'p3' },
    { n: 7, len: 140, w: 84, off: -90, A: 'p3', B: 'p4' },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (ring.off + (i * 360) / ring.n) * DEG;
      const [A, B] = leafHalves(F[0], F[1], a, ring.len, ring.w, { wAt: 0.5, n: 4 });
      pic.add(A, ring.A);
      pic.add(B, ring.B);
    }
  }
  // heart: golden disc with stamens
  pic.add(circle(F[0], F[1], 64), 'y3');
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 + 15) * DEG;
    pic.add(smooth(tf(petalPts(62, 26, { tip: 'round', wAt: 0.6 }), { x: F[0], y: F[1], r: a })), i % 2 ? 'y1' : 'y2');
  }
  pic.add(circle(F[0], F[1], 28), 'p5');

  // --- dragonfly (top left, over the water)
  {
    const D = [560, 108], ang = 8 * DEG;
    const wing = (dx, dy, a, len, w, col) => {
      const p = tf([[dx, dy]], { r: ang })[0];
      pic.add(smooth(tf(petalPts(len, w, { tip: 'round', wAt: 0.6, baseW: 6 }), { x: D[0] + p[0], y: D[1] + p[1], r: ang + a })), col);
    };
    wing(-8, -8, -112 * DEG, 104, 40, 'v1');
    wing(-8, 8, 112 * DEG, 104, 40, 'v1');
    wing(14, -8, -68 * DEG, 112, 42, 'p1');
    wing(14, 8, 68 * DEG, 112, 42, 'p1');
    pic.add(smooth(tf([[-140, 0, 'c'], [-60, -10], [0, -12], [30, -14], [42, 0], [30, 14], [0, 12], [-60, 10]], { x: D[0], y: D[1], r: ang })), 'v2');
    const head = tf([[56, 0]], { x: D[0], y: D[1], r: ang })[0];
    pic.add(ellipse(head[0], head[1], 21, 21), 'p5');
  }

  return pic;
}
