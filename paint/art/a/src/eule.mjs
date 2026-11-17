// Eule bei Mondschein – a round owl on a leafy branch in front of a glowing full moon.
import { union, intersect, circlePoly, smoothPoly, ellipsePoly, shapePath } from './geom.mjs';
import { Pic, DEG, TAU, poly, smooth, tf, circle, ellipse, leafHalves, petalPts, mirrorX, arcBand, wavePts, fillBelow, sampleSmooth } from './lib.mjs';

export const meta = { id: 'a-eule', title: 'Eule bei Mondschein', category: 'Tiere' };

export function build() {
  const pic = new Pic({ ...meta, width: 1000, height: 1000 });
  pic.pal({
    sky3: '#26326a',
    sky1: '#38498a',
    sky2: '#4f63a6',
    halo: '#8494cc',
    moon: '#fbf1c6',
    moon2: '#eedd9e',
    ow1: '#f2d9b4',
    ow2: '#c4906a',
    ow3: '#97674a',
    ow4: '#694333',
    cream: '#fff7e8',
    yel: '#f7bd3e',
    orange: '#e5822a',
    dark: '#272033',
    leaf1: '#6aa592',
    leaf2: '#3e6f69',
    bark: '#8b6a56',
  });

  const M = [500, 400];
  // --- night sky, halo rings (in sectors), moon with craters, stars
  pic.add('M0 0H1000V1000H0Z', 'sky3');
  for (let s = 0; s < 10; s++) pic.add(arcBand(M[0], M[1], 400, 480, (s / 10) * TAU + 0.35, ((s + 1) / 10) * TAU + 0.35), s % 2 ? 'sky1' : 'sky2');
  for (let s = 0; s < 8; s++) pic.add(arcBand(M[0], M[1], 340, 400, (s / 8) * TAU + 0.3, ((s + 1) / 8) * TAU + 0.3), s % 2 ? 'sky2' : 'halo');
  pic.add(circle(M[0], M[1], 340), 'halo');
  pic.add(circle(M[0], M[1], 292), 'moon');
  for (const [x, y, r] of [[270, 330, 42], [735, 300, 36], [725, 520, 52], [300, 560, 34], [575, 150, 30], [400, 172, 28], [760, 410, 28]]) {
    pic.add(circle(x, y, r), 'moon2');
  }
  const sparkle = (x, y, r) =>
    pic.add(poly([[x, y - r], [x + r * 0.28, y - r * 0.28], [x + r, y], [x + r * 0.28, y + r * 0.28], [x, y + r], [x - r * 0.28, y + r * 0.28], [x - r, y], [x - r * 0.28, y - r * 0.28]]), 'moon');
  for (const [x, y, r] of [[70, 80, 34], [940, 70, 30], [150, 250, 20], [880, 230, 24], [60, 520, 22], [950, 560, 26], [40, 330, 22], [960, 380, 22]]) sparkle(x, y, r);

  // clouds drifting low and the hills
  const cloud = (x, y, w, col) => pic.add(smooth([[x, y, 'c'], [x + w * 0.1, y - w * 0.16], [x + w * 0.3, y - w * 0.2], [x + w * 0.45, y - w * 0.34], [x + w * 0.66, y - w * 0.28], [x + w * 0.82, y - w * 0.16], [x + w, y, 'c']]), col);
  cloud(-40, 760, 360, 'sky2');
  cloud(660, 720, 380, 'sky2');
  cloud(40, 820, 240, 'halo');
  cloud(760, 790, 250, 'halo');
  pic.add(fillBelow(wavePts(-20, 1020, 900, 22, 520, 0.8), 1000), 'leaf2');

  // --- owl: ear tufts, body, wings
  for (const pts of [[[300, 345], [300, 180, 'c'], [445, 275]], [[322, 318], [318, 222, 'c'], [400, 282]]]) {
    pic.add(poly(pts), pts[0][1] === 345 ? 'ow3' : 'ow4');
    pic.add(poly(mirrorX(pts, 500)), pts[0][1] === 345 ? 'ow3' : 'ow4');
  }
  const body = smoothPoly([[500, 240], [620, 262], [705, 350], [728, 520], [700, 690], [610, 800], [500, 830], [390, 800], [300, 690], [272, 520], [295, 350], [380, 262]], 1, 12);
  pic.add(poly(body), 'ow2');
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const pts = tf(petalPts(370 - k * 55, 120 - k * 6, { tip: 'round', wAt: 0.45 }), { x: 500 + side * (178 - k * 4), y: 430 + k * 45, r: (90 + side * (8 + k * 5)) * DEG });
      pic.add(smooth(pts), k % 2 ? 'ow3' : 'ow4');
    }
  }
  // belly with scalloped feathers
  const belly = ellipsePoly(500, 650, 168, 178, 72);
  pic.add(poly(belly), 'ow1');
  for (let row = 0; row < 6; row++) {
    const y = 545 + row * 48;
    const off = row % 2 ? 0 : 30;
    for (let x = 340 + off; x <= 660; x += 60) {
      const sc = intersect(belly, circlePoly(x, y, 32, 32));
      if (sc.length) pic.add(shapePath(sc), row % 2 ? 'cream' : 'ow1');
    }
  }
  // facial disc, eyes, beak
  pic.add(shapePath(union(circlePoly(412, 418, 122), circlePoly(588, 418, 122), smoothPoly([[440, 480], [560, 480], [500, 565]]))), 'cream');
  pic.add(poly([[500, 312], [432, 290], [380, 318], [430, 306]]), 'ow3');
  pic.add(poly(mirrorX([[500, 312], [432, 290], [380, 318], [430, 306]], 500)), 'ow3');
  for (const x of [412, 588]) {
    pic.add(circle(x, 420, 84), 'ow1');
    pic.add(circle(x, 420, 66), 'yel');
    pic.add(circle(x, 420, 46), 'orange');
    pic.add(circle(x, 420, 32), 'dark');
    pic.add(circle(x - 12, 408, 11), 'cream');
  }
  pic.add(smooth([[476, 470, 'c'], [524, 470, 'c'], [512, 512], [500, 545, 'c'], [488, 512]]), 'orange');

  // --- branch with leaves and claws
  const top = sampleSmooth([[-20, 840], [300, 812], [600, 800], [1020, 760]], { steps: 10 });
  const bot = sampleSmooth([[1020, 820], [600, 862], [300, 872], [-20, 905]], { steps: 10 });
  pic.add(poly([...top, ...bot]), 'bark');
  const bot2 = sampleSmooth([[1020, 800], [600, 842], [300, 852], [-20, 882]], { steps: 10 });
  pic.add(poly([...bot2, ...bot.slice().reverse()].reverse()), 'ow4');
  for (const [x, y, a, len, w] of [[120, 835, -150, 150, 66], [210, 850, 160, 130, 58], [60, 870, 120, 120, 54], [830, 790, -40, 150, 66], [900, 790, 30, 140, 60], [760, 810, 110, 120, 52], [960, 770, -80, 120, 54]]) {
    const [A, B] = leafHalves(x, y, a * DEG, len, w, { n: 4 });
    pic.add(A, 'leaf1');
    pic.add(B, 'leaf2');
  }
  for (const fx of [440, 560]) {
    for (const d of [-22, 0, 22]) pic.add(smooth(tf(petalPts(48, 24, { tip: 'round', wAt: 0.5 }), { x: fx + d, y: 790, r: (90 - d) * DEG })), 'yel');
  }

  return pic;
}
