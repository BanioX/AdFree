// Rose – a layered bloom with bud and leaves in an oval medallion on a sunburst.
import { union, smoothPoly, shapePath } from './geom.mjs';
import { Pic, DEG, TAU, smooth, tf, petalPts, capPts, wedge, circle, ellipse, leafHalves, polarPt, swirlPts, unionSmooth, ellipsePts } from './lib.mjs';

export const meta = { id: 'a-rose', title: 'Rose', category: 'Blumen' };

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    cream: '#fcefe2',
    peach: '#f6d6c1',
    sage: '#e1ead2',
    pale: '#fde0e4',
    p1: '#f9b6c3',
    p2: '#f397ac',
    p3: '#e9748f',
    p4: '#da577b',
    p5: '#c43e67',
    p6: '#a12852',
    g1: '#a5cf7a',
    g2: '#69a85a',
    g3: '#3e7a48',
  });

  const C0 = [500, 505];
  const RX = 420, RY = 452, BORDER = 30;

  // --- sunburst around the medallion
  const RAYS = 20;
  for (let i = 0; i < RAYS; i++) {
    const a1 = (i / RAYS) * TAU - Math.PI / 2, a2 = ((i + 1) / RAYS) * TAU - Math.PI / 2;
    pic.add(wedge(C0[0], C0[1], 1200, a1, a2), i % 2 ? 'peach' : 'cream');
  }
  // dots in the roomy corner rays
  for (let i = 0; i < RAYS; i++) {
    const a = ((i + 0.5) / RAYS) * TAU - Math.PI / 2;
    const p = polarPt(C0[0], C0[1], 590, a);
    const rr = 20;
    if (p[0] < rr + 12 || p[0] > 1000 - rr - 12 || p[1] < rr + 12 || p[1] > 1000 - rr - 12) continue;
    const nx = (p[0] - C0[0]) / (RX + 40), ny = (p[1] - C0[1]) / (RY + 40);
    if (nx * nx + ny * ny < 1) continue;
    pic.add(circle(p[0], p[1], rr), i % 2 ? 'cream' : 'pale');
  }
  // medallion: border ring + disc
  pic.add(ellipse(C0[0], C0[1], RX, RY), 'p1');
  pic.add(ellipse(C0[0], C0[1], RX - BORDER, RY - BORDER), 'sage');

  // --- leaves (under the stem), stem + branch + bud base as one shape
  const leaves = [
    [488, 694, -160 * DEG, 185, 92, 0.1],
    [490, 836, -158 * DEG, 200, 92, 0.1],
    [510, 836, -24 * DEG, 180, 88, -0.1],
  ];
  for (const [x, y, a, len, w, bend] of leaves) {
    const [A, B] = leafHalves(x, y, a, len, w, { bend, n: 4 });
    pic.add(A, 'g1');
    pic.add(B, 'g2');
  }
  pic.add(
    shapePath(
      union(
        smoothPoly([[486, 560], [474, 700], [486, 800], [488, 850], [512, 850], [514, 800], [504, 700], [516, 560]]),
        smoothPoly([[500, 626], [598, 638], [690, 618], [748, 592], [766, 616], [700, 646], [598, 668], [504, 664]]),
        smoothPoly(ellipsePts(762, 602, 20, 18, 8)),
      ),
    ),
    'g3',
  );

  // --- falling petals in the empty corners of the medallion
  for (const [x, y, a, col] of [[166, 430, -30, 'p2'], [840, 372, 200, 'p1'], [740, 872, -150, 'p2'], [232, 702, -118, 'p1']]) {
    pic.add(petal(x, y, a * DEG, 66, 48, { tip: 'notch', wAt: 0.6 }), col);
  }

  // --- ribbon bow on the stem
  {
    const K = [500, 842];
    pic.add(petal(K[0] - 9, K[1], 110 * DEG, 64, 32, { tip: 'notch', wAt: 0.7, baseW: 10 }), 'p3');
    pic.add(petal(K[0] + 9, K[1], 70 * DEG, 64, 32, { tip: 'notch', wAt: 0.7, baseW: 10 }), 'p3');
    pic.add(petal(K[0], K[1], -165 * DEG, 86, 62, { tip: 'round', wAt: 0.68 }), 'p2');
    pic.add(petal(K[0], K[1], -15 * DEG, 86, 62, { tip: 'round', wAt: 0.68 }), 'p2');
    pic.add(petal(K[0], K[1], -168 * DEG, 50, 28, { tip: 'round', wAt: 0.7 }), 'p5');
    pic.add(petal(K[0], K[1], -12 * DEG, 50, 28, { tip: 'round', wAt: 0.7 }), 'p5');
    pic.add(ellipse(K[0], K[1], 20, 18), 'p4');
  }

  // --- bud on the branch
  {
    const bx = 764, by = 594, a = -56 * DEG;
    pic.add(petal(bx, by, a, 124, 96, { tip: 'point', wAt: 0.42 }), 'p4');
    pic.add(petal(bx + 8, by - 2, a + 0.2, 106, 58, { tip: 'point', wAt: 0.5 }), 'p2');
    pic.add(petal(bx - 4, by + 6, a - 0.62, 74, 38, { tip: 'point', wAt: 0.4 }), 'g2');
    pic.add(petal(bx + 2, by + 6, a + 0.66, 70, 36, { tip: 'point', wAt: 0.4 }), 'g1');
  }

  // --- the bloom: rings of petals, outermost first
  const B = [500, 356];
  const rings = [
    { n: 6, len: 246, w: 248, off: -90, cols: ['p1', 'p2'], cap: 'pale', capDepth: 0.15, from: 0.76 },
    { n: 6, len: 185, w: 182, off: -60, cols: ['p3', 'p4'], cap: 'pale', capDepth: 0.2, from: 0.74 },
    { n: 6, len: 125, w: 140, off: -90, cols: ['p5', 'p6'], cap: null },
  ];
  for (const R of rings) {
    for (let i = 0; i < R.n; i++) {
      const a = (R.off + (i * 360) / R.n) * DEG;
      const pts = petalPts(R.len, R.w, { wAt: 0.62, tip: 'notch', shoulder: 0.82 });
      pic.add(smooth(tf(pts, { x: B[0], y: B[1], r: a })), R.cols[i % 2]);
      if (R.cap) {
        const cp = capPts(pts, R.len, { from: R.from ?? 0.66, depth: R.capDepth, squeeze: 0.12 });
        pic.add(smooth(tf(cp, { x: B[0], y: B[1], r: a })), R.cap);
      }
    }
  }
  // heart of the rose: a curled spiral
  pic.add(circle(B[0], B[1], 70), 'p3');
  pic.add(smooth(swirlPts(B[0], B[1], 70, 44, 30, 150 * DEG, 470 * DEG)), 'p6');
  pic.add(smooth(swirlPts(B[0] + 2, B[1] - 4, 42, 18, 22, 10 * DEG, 330 * DEG)), 'p5');
  pic.add(circle(B[0] + 4, B[1] - 5, 14), 'p6');

  return pic;
}

function petal(x, y, ang, len, w, opts) {
  return smooth(tf(petalPts(len, w, opts), { x, y, r: ang }));
}
