// Rose – a big layered bloom on a sunburst, with stem, leaves and a bud.
import { Pic, DEG, TAU, smooth, tf, petalPts, capPts, wedge, circle, leafHalves, polarPt, swirlPts, unionSmooth, ellipsePts, sampleSmooth, poly } from './lib.mjs';

export const meta = { id: 'a-rose', title: 'Rose', category: 'Blumen' };

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    cream: '#fcefe2',
    peach: '#f6d6c1',
    sage: '#dfe8cf',
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

  const C = [500, 408];

  // --- sunburst background (each ray its own region)
  const RAYS = 18;
  for (let i = 0; i < RAYS; i++) {
    const a1 = (i / RAYS) * TAU - Math.PI / 2, a2 = ((i + 1) / RAYS) * TAU - Math.PI / 2;
    pic.add(wedge(C[0], C[1], 1200, a1, a2), i % 2 ? 'peach' : 'cream');
  }
  // halo
  pic.add(circle(C[0], C[1], 372), 'sage');
  // dots on the rays (only where fully inside and not behind the leaves)
  for (let i = 0; i < RAYS; i++) {
    const a = ((i + 0.5) / RAYS) * TAU - Math.PI / 2;
    const r = i % 2 ? 428 : 452;
    const p = polarPt(C[0], C[1], r, a);
    const rr = 17;
    if (p[0] < rr + 8 || p[0] > 1000 - rr - 8 || p[1] < rr + 8 || p[1] > 700) continue;
    pic.add(circle(p[0], p[1], rr), i % 2 ? 'cream' : 'pale');
  }

  // --- stem + branch (the branch comes out from behind the bloom)
  const branchMid = [[505, 690], [600, 700], [700, 676], [790, 630]];
  const HALO = 372;
  // halo piece enclosed by stem, branch and halo edge gets its own region
  {
    const arc = [];
    const aEnd = Math.atan2(630 - C[1], 790 - C[0]);
    for (let i = 0; i <= 12; i++) arc.push(polarPt(C[0], C[1], HALO, Math.PI / 2 + (aEnd - Math.PI / 2) * (i / 12)));
    const br = sampleSmooth(branchMid, { steps: 6 }).reverse();
    pic.add(poly([[500, 690], ...arc, ...br]), 'sage');
  }
  const leaves = [
    [490, 778, -164 * DEG, 205, 102, 0.1],
    [484, 935, -204 * DEG, 175, 94, 0.12],
    [508, 900, -26 * DEG, 132, 76, -0.1],
    [690, 680, 46 * DEG, 130, 72, -0.1],
  ];
  for (const [x, y, a, len, w, bend] of leaves) {
    const [A, B] = leafHalves(x, y, a, len, w, { bend, n: 4 });
    pic.add(A, 'g1');
    pic.add(B, 'g2');
  }
  pic.add(
    unionSmooth(
      [[486, 640], [470, 760], [482, 880], [482, 1010], [518, 1010], [514, 880], [504, 760], [516, 640]],
      [[505, 676], [600, 686], [700, 660], [774, 618], [796, 644], [704, 694], [600, 716], [505, 706]],
      ellipsePts(794, 636, 22, 20, 8),
    ),
    'g3',
  );

  // --- bud on the branch
  {
    const bx = 794, by = 624, a = -62 * DEG;
    pic.add(petal(bx, by, a, 130, 100, { tip: 'point', wAt: 0.42 }), 'p4');
    pic.add(petal(bx + 8, by - 2, a + 0.2, 112, 60, { tip: 'point', wAt: 0.5 }), 'p2');
    pic.add(petal(bx - 4, by + 6, a - 0.62, 78, 40, { tip: 'point', wAt: 0.4 }), 'g2');
    pic.add(petal(bx + 2, by + 6, a + 0.66, 72, 38, { tip: 'point', wAt: 0.4 }), 'g1');
  }

  // --- the bloom: rings of petals, outermost first
  const rings = [
    { n: 6, len: 300, w: 300, off: -90, cols: ['p1', 'p2'], cap: 'pale', capDepth: 0.15, from: 0.76 },
    { n: 6, len: 222, w: 218, off: -60, cols: ['p3', 'p4'], cap: 'pale', capDepth: 0.2, from: 0.74 },
    { n: 6, len: 150, w: 168, off: -90, cols: ['p5', 'p6'], cap: null },
  ];
  for (const R of rings) {
    for (let i = 0; i < R.n; i++) {
      const a = (R.off + (i * 360) / R.n) * DEG;
      const pts = petalPts(R.len, R.w, { wAt: 0.62, tip: 'notch', shoulder: 0.82 });
      pic.add(smooth(tf(pts, { x: C[0], y: C[1], r: a })), R.cols[i % 2]);
      if (R.cap) {
        const cp = capPts(pts, R.len, { from: R.from ?? 0.66, depth: R.capDepth, squeeze: 0.12 });
        pic.add(smooth(tf(cp, { x: C[0], y: C[1], r: a })), R.cap);
      }
    }
  }
  // heart of the rose: a curled spiral
  pic.add(circle(C[0], C[1], 82), 'p3');
  pic.add(smooth(swirlPts(C[0], C[1], 82, 52, 34, 150 * DEG, 470 * DEG)), 'p6');
  pic.add(smooth(swirlPts(C[0] + 2, C[1] - 4, 50, 22, 26, 10 * DEG, 330 * DEG)), 'p5');
  pic.add(circle(C[0] + 4, C[1] - 6, 16), 'p6');

  return pic;
}

function petal(x, y, ang, len, w, opts) {
  return smooth(tf(petalPts(len, w, opts), { x, y, r: ang }));
}
