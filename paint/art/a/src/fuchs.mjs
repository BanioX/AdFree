// Fuchs im Herbstlaub – a faceted, sitting fox with a bushy tail in a flurry of autumn leaves.
import { intersect, smoothPoly, shapePath } from './geom.mjs';
import { Pic, DEG, poly, smooth, tf, circle, leafHalves, polarPt, rng, mirrorX, rrect } from './lib.mjs';

export const meta = { id: 'a-fuchs', title: 'Fuchs im Herbstlaub', category: 'Tiere' };

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    bg: '#fbf0de',
    bg2: '#f4e0c4',
    l1: '#f7c95e',
    l2: '#eea23e',
    l3: '#da6431',
    l4: '#b43c2c',
    lg1: '#b2bb63',
    lg2: '#7c8a40',
    o1: '#f7a457',
    o2: '#e77c2f',
    o3: '#c35b23',
    cr: '#fff7ec',
    cr2: '#efd9c2',
    brown: '#6d4330',
    dark: '#33231f',
  });

  // --- background with soft bokeh circles
  pic.add('M0 0H1000V1000H0Z', 'bg');
  for (const [x, y, r] of [[130, 140, 120], [860, 120, 140], [500, 60, 90], [80, 560, 110], [930, 520, 120], [700, 330, 70], [280, 380, 70]]) {
    pic.add(circle(x, y, r), 'bg2');
  }

  const maple = (cx, cy, s, rot, cols) => {
    for (let i = 0; i < 5; i++) {
      const a = rot + i * 72 * DEG;
      pic.add(
        poly([
          [cx, cy],
          polarPt(cx, cy, s * 0.42, a - 36 * DEG),
          polarPt(cx, cy, s * 0.78, a - 16 * DEG),
          polarPt(cx, cy, s * 0.66, a - 9 * DEG),
          polarPt(cx, cy, s, a),
          polarPt(cx, cy, s * 0.66, a + 9 * DEG),
          polarPt(cx, cy, s * 0.78, a + 16 * DEG),
          polarPt(cx, cy, s * 0.42, a + 36 * DEG),
        ]),
        cols[i % cols.length],
      );
    }
  };
  const oak = (x, y, a, len, w) => {
    const [A, B] = leafHalves(x, y, a, len, w, { n: 4 });
    pic.add(A, 'lg1');
    pic.add(B, 'lg2');
  };
  const sets = [['l1', 'l2'], ['l2', 'l3'], ['l3', 'l4'], ['l1', 'l3'], ['l2', 'l4']];
  const R = rng(7);
  const spots = [
    [110, 110], [330, 90], [560, 150], [790, 80], [950, 260], [210, 300], [800, 330], [60, 420], [930, 640],
    [70, 700], [250, 560], [760, 560], [400, 70],
  ];
  spots.forEach(([x, y], i) => {
    if (i % 4 === 3) oak(x, y, R() * 6.28, 130, 62);
    else maple(x, y, 78 + R() * 26, R() * 6.28, [...sets[i % sets.length], sets[i % sets.length][0], sets[i % sets.length][1], 'l3']);
  });

  // --- tail (behind the body, curling to the front)
  const tail = smoothPoly([
    [640, 760], [740, 640], [850, 580], [940, 630], [950, 760], [880, 880], [740, 940], [560, 960], [430, 945], [440, 900], [600, 880], [730, 840], [800, 770], [790, 700], [700, 790],
  ], 1, 12);
  pic.add(poly(tail), 'o2');
  pic.add(shapePath(intersect(tail, [[850, 0], [1000, 0], [1000, 1000], [850, 1000]])), 'o1');
  pic.add(shapePath(intersect(tail, [[700, 860], [600, 1000], [0, 1000], [0, 860]])), 'cr');

  // --- body
  const body = smoothPoly([[420, 430], [580, 430], [650, 560], [690, 720], [680, 860], [600, 905], [400, 905], [320, 860], [310, 720], [350, 560]], 1, 12);
  pic.add(poly(body), 'o2');
  pic.add(shapePath(intersect(body, [[0, 0], [395, 0], [345, 1000], [0, 1000]])), 'o3');
  pic.add(shapePath(intersect(body, [[605, 0], [1000, 0], [1000, 1000], [655, 1000]])), 'o1');
  pic.add(
    smooth([
      [430, 440], [570, 440], [600, 520], [578, 560, 'c'], [592, 604], [556, 632, 'c'], [562, 680], [526, 702, 'c'], [500, 770, 'c'], [474, 702, 'c'], [438, 680], [444, 632, 'c'], [408, 604], [422, 560, 'c'], [400, 520],
    ]),
    'cr',
  );
  // front legs with dark socks
  for (const x of [405, 533]) {
    pic.add(rrect(x, 650, 62, 255, 30), 'o3');
    pic.add(rrect(x - 3, 812, 68, 100, 32), 'brown');
  }

  // --- head: low-poly facets (left half, mirrored)
  const facetsL = [
    [[[348, 132], [482, 250], [372, 340]], 'o3'],
    [[[364, 182], [452, 258], [384, 306]], 'brown'],
    [[[400, 252], [500, 236], [452, 290]], 'o1'],
    [[[400, 252], [452, 290], [336, 332]], 'o2'],
    [[[336, 332], [452, 290], [420, 372]], 'o1'],
    [[[452, 290], [500, 372], [420, 372]], 'o2'],
    [[[336, 332], [420, 372], [440, 420], [300, 432]], 'cr'],
    [[[300, 432], [440, 420], [496, 494], [400, 470]], 'cr2'],
    [[[420, 372], [500, 372], [500, 452], [440, 420]], 'cr'],
    [[[440, 420], [500, 452], [500, 500], [496, 494]], 'cr2'],
  ];
  for (const [pts, col] of facetsL) {
    pic.add(poly(pts), col);
    pic.add(poly(mirrorX(pts, 500)), col);
  }
  pic.add(poly([[500, 236], [548, 290], [500, 372], [452, 290]]), 'o3');
  pic.add(smooth([[474, 436], [526, 436], [500, 470]], { k: 0.5 }), 'dark');
  for (const s of [-1, 1]) {
    const pts = tf([[-34, 0, 'c'], [-10, -14], [14, -12], [34, 2, 'c'], [12, 12], [-12, 10]], { x: 500 + s * 62, y: 352, r: s * 16 * DEG, sx: s });
    pic.add(smooth(pts), 'dark');
  }

  // --- leaves in front
  maple(170, 900, 110, 0.4, ['l3', 'l2', 'l3', 'l2', 'l4']);
  maple(330, 965, 80, 1.2, ['l1', 'l2', 'l1', 'l2', 'l3']);
  oak(60, 820, -0.6, 140, 66);
  maple(980, 940, 96, 0.9, ['l4', 'l3', 'l4', 'l3', 'l2']);
  maple(720, 985, 70, 2.1, ['l1', 'l3', 'l1', 'l3', 'l2']);

  return pic;
}
