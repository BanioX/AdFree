// Igel mit Pilzen – a hedgehog with layered spines, toadstools and autumn leaves on a meadow.
import { petalPts } from './lib.mjs';
import { Pic, DEG, TAU, wedge, crescent, poly, smooth, tf, circle, ellipse, leafHalves, polarPt, lerp, wavePts, fillBelow, rect } from './lib.mjs';

export const meta = { id: 'a-igel', title: 'Igel mit Pilzen', category: 'Tiere' };

const leafPts2 = (x, y, a, len, w) => tf([[0, 0, 'c'], [len * 0.3, w * 0.5], [len * 0.7, w * 0.4], [len, 0, 'c'], [len * 0.7, -w * 0.4], [len * 0.3, -w * 0.5]], { x, y, r: a * DEG });

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    sky: '#fdf2df',
    hill1: '#e2e6bd',
    hill2: '#c3d69c',
    grass1: '#98bf72',
    grass2: '#6f9d56',
    or1: '#f8bf74',
    or2: '#ec9142',
    red: '#d6503c',
    redD: '#a73a2e',
    br1: '#cfa57e',
    br2: '#a67853',
    br3: '#7b5338',
    br4: '#543726',
    be1: '#f4ddc1',
    be2: '#e2bf97',
    pink: '#f1a59c',
    dark: '#3b2a22',
    white: '#fffaf1',
  });

  // --- sky, sun and hills
  pic.add(rect(0, 0, 1000, 1000), 'sky');
  for (let i = 0; i < 20; i += 2) pic.add(wedge(500, 190, 1400, (i / 20) * TAU, ((i + 1) / 20) * TAU), 'be1');
  pic.add(circle(500, 190, 150), 'hill1');
  pic.add(circle(500, 190, 100), 'or1');
  pic.add(fillBelow(wavePts(-20, 1020, 470, 26, 700, 0.6), 1000), 'hill1');
  // trees on the far hill
  const tree = (x, y, s, c1, c2, c3) => {
    pic.add(rect(x - 14 * s, y - 20, 28 * s, 170 * s), 'br2');
    pic.add(smooth([[x - 110 * s, y - 40 * s], [x - 70 * s, y - 150 * s], [x, y - 190 * s], [x + 80 * s, y - 150 * s], [x + 115 * s, y - 50 * s], [x + 60 * s, y + 10 * s], [x - 60 * s, y + 10 * s]]), c1);
    pic.add(smooth([[x - 80 * s, y - 60 * s], [x - 40 * s, y - 140 * s], [x + 20 * s, y - 150 * s], [x + 10 * s, y - 70 * s], [x - 30 * s, y - 20 * s]]), c2);
    pic.add(circle(x + 60 * s, y - 70 * s, 34 * s), c3);
    pic.add(circle(x + 30 * s, y - 135 * s, 26 * s), c3);
    pic.add(circle(x - 70 * s, y - 10 * s, 24 * s), c3);
    pic.add(circle(x + 40 * s, y - 10 * s, 22 * s), c2);
  };
  tree(150, 400, 1, 'or2', 'or1', 'red');
  tree(860, 390, 1.1, 'red', 'or2', 'or1');
  pic.add(fillBelow(wavePts(-20, 1020, 530, 18, 640, 1.7), 1000), 'hill2');
  pic.add(fillBelow(wavePts(-20, 1020, 600, 22, 560, 2.2), 1000), 'hill1');
  pic.add(fillBelow(wavePts(-20, 1020, 780, 14, 420, 1.0), 1000), 'grass1');

  // falling leaves in the air
  for (const [x, y, a, c1, c2] of [[300, 120, 30, 'or1', 'or2'], [700, 90, 150, 'or2', 'red'], [640, 330, 70, 'or1', 'or2']]) {
    const [A, B] = leafHalves(x, y, a * DEG, 70, 38, { n: 3 });
    pic.add(A, c1);
    pic.add(B, c2);
  }

  // --- hedgehog
  const H = [390, 720];
  const spineCols = ['br4', 'br3', 'br2', 'br1'];
  for (let L = 0; L < 4; L++) {
    const rx = 280 - 52 * L, ry = 240 - 46 * L;
    const cx = H[0] + 26 * L, cy = H[1] + 10 * L;
    const n = 30 - 5 * L;
    const a0 = 178 * DEG, a1 = 352 * DEG;
    const seg = L === 3 ? 2 : 3;
    for (let s = 0; s < seg; s++) {
      const pts = [[cx, cy + 30]];
      const k0 = Math.round((s * n) / seg), k1 = Math.round(((s + 1) * n) / seg);
      for (let k = k0; k <= k1; k++) {
        const a = lerp(a0, a1, k / n);
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 'c']);
        if (k < k1) {
          const am = lerp(a0, a1, (k + 0.5) / n);
          pts.push([cx + Math.cos(am) * rx * 0.86, cy + Math.sin(am) * ry * 0.86, 'c']);
        }
      }
      pic.add(poly(pts), (s + L) % 2 ? spineCols[L] : spineCols[L]);
    }
  }
  // belly and feet
  pic.add(ellipse(H[0] + 40, H[1] + 40, 230, 54), 'be2');
  pic.add(ellipse(H[0] - 70, H[1] + 82, 44, 22), 'br3');
  pic.add(ellipse(H[0] + 150, H[1] + 82, 44, 22), 'br3');
  // head
  pic.add(smooth([[560, 560], [640, 586], [720, 640], [784, 696], [796, 724], [770, 744], [690, 768], [600, 778], [540, 750], [522, 650]]), 'be1');
  pic.add(smooth([[560, 760], [640, 752], [720, 744], [780, 736], [760, 756], [690, 780], [610, 790]]), 'be2');
  pic.add(circle(592, 596, 30), 'be2');
  pic.add(circle(592, 598, 16), 'pink');
  pic.add(ellipse(676, 650, 14, 17), 'dark');
  pic.add(ellipse(698, 706, 26, 15), 'pink');
  pic.add(circle(796, 718, 18), 'dark');
  // apple and leaf carried on the spines
  pic.add(smooth(leafPts2(318, 470, -60, 90, 44)), 'grass1');
  pic.add(circle(360, 520, 56), 'red');
  pic.add(crescent(360, 520, 56, -18, -14, 52), 'redD');
  pic.add(smooth([[356, 470, 'c'], [352, 448], [362, 430, 'c'], [370, 434, 'c'], [364, 450], [368, 470, 'c']]), 'br3');

  // --- toadstools
  const toad = (x, y, w, h, stemH, cap, dots) => {
    pic.add(smooth([[x - w * 0.16, y + stemH, 'c'], [x - w * 0.12, y + stemH * 0.5], [x - w * 0.1, y, 'c'], [x + w * 0.1, y, 'c'], [x + w * 0.12, y + stemH * 0.5], [x + w * 0.16, y + stemH, 'c']]), 'white');
    pic.add(ellipse(x, y + 4, w * 0.48, Math.max(14, h * 0.14)), 'be1');
    pic.add(smooth([[x - w / 2, y, 'c'], [x - w * 0.4, y - h * 0.62], [x, y - h], [x + w * 0.4, y - h * 0.62], [x + w / 2, y, 'c'], [x, y + h * 0.1]]), cap);
    for (const [dx, dy, r] of dots) pic.add(circle(x + dx * w, y - dy * h, r), 'white');
  };
  toad(890, 690, 210, 130, 160, 'red', [[-0.28, 0.32, 15], [0, 0.66, 17], [0.26, 0.36, 14], [-0.06, 0.26, 12], [0.36, 0.12, 10], [-0.38, 0.1, 10]]);
  toad(940, 880, 110, 70, 80, 'redD', [[-0.2, 0.35, 10], [0.15, 0.55, 10]]);
  // boletus (left)
  {
    const x = 120, y = 830;
    pic.add(smooth([[x - 44, y + 120, 'c'], [x - 52, y + 50], [x - 30, y, 'c'], [x + 30, y, 'c'], [x + 52, y + 50], [x + 44, y + 120, 'c']]), 'white');
    pic.add(smooth([[x - 100, y + 6, 'c'], [x - 80, y - 60], [x, y - 86], [x + 80, y - 60], [x + 100, y + 6, 'c'], [x, y + 20]]), 'br2');
    pic.add(smooth([[x - 70, y - 40], [x - 30, y - 70], [x + 20, y - 72], [x - 10, y - 52]]), 'br1');
  }

  // --- foreground grass and fallen leaves
  const daisy = (x, y, r) => {
    for (let i = 0; i < 5; i++) pic.add(smooth(tf(petalPts(r, r * 0.7, { tip: 'round' }), { x, y, r: (i * 72 - 90) * DEG })), 'white');
    pic.add(circle(x, y, r * 0.36), 'or1');
  };
  daisy(250, 850, 46);
  daisy(610, 850, 44);
  daisy(770, 810, 40);
  pic.add(fillBelow(wavePts(-20, 1020, 905, 16, 300, 0.3), 1000), 'grass2');
  const tuft = (x, y, h) => {
    for (const [dx, a] of [[-14, -18], [0, 0], [14, 20]]) pic.add(smooth(tf([[-15, 0, 'c'], [-6, -h * 0.6], [0, -h, 'c'], [6, -h * 0.6], [15, 0, 'c']], { x: x + dx, y, r: a * DEG })), 'grass1');
  };
  tuft(40, 950, 90);
  tuft(560, 1000, 80);
  tuft(975, 975, 80);
  for (const [x, y, a, c1, c2] of [[480, 930, -20, 'or1', 'or2'], [700, 880, 200, 'red', 'redD'], [300, 960, 160, 'or2', 'red'], [850, 960, -40, 'or1', 'or2']]) {
    const [A, B] = leafHalves(x, y, a * DEG, 90, 46, { n: 3 });
    pic.add(A, c1);
    pic.add(B, c2);
  }

  return pic;
}
