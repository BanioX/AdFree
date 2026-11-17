// Bergsee mit Alpen und Chalet: Gipfel mit Schnee, Tannenwald, See mit Segelboot, Chalet mit Geranien.
import { Pic, rect, circle, smooth, poly, roundPoly, cloud, wavePts, band, between, heart, lerp, rng } from './lib.mjs';

export const meta = {
  id: 'b-bergsee',
  title: 'Bergsee mit Chalet',
  category: 'Landschaften',
  palette: {
    sky1: '#7db4e3',
    sky2: '#a9cfee',
    sky3: '#d6e8f6',
    white: '#ffffff',
    mtn1: '#aeb0dc',
    mtn2: '#8085bd',
    rock1: '#93a0b6',
    rock2: '#61708c',
    snowS: '#d9e2f1',
    lake1: '#4b8cc2',
    lake2: '#70b0dd',
    green1: '#a4cd63',
    green2: '#6ea94f',
    fir1: '#3f7f55',
    fir2: '#2a5b43',
    wood1: '#d0935a',
    wood2: '#9a5f38',
    red: '#d9534a',
  },
};

export default function build() {
  const p = new Pic(meta);
  const R = rng(5);

  // Himmel
  p.tag('himmel');
  p.add(rect(-10, -10, 1020, 1020), 'sky1');
  p.add(band(wavePts(-10, 1010, 140, 10, 520, 0.4), 1010), 'sky2');
  p.add(band(wavePts(-10, 1010, 270, 10, 460, 2.4), 1010), 'sky3');
  p.tag('wolken');
  const cl = (x, y, w) => {
    const h = w * 0.32;
    p.add(cloud(x, x + w, y, [[x + w * 0.16, y - h * 0.35], [x + w * 0.4, y - h * 0.62], [x + w * 0.66, y - h * 0.58], [x + w * 0.86, y - h * 0.28]], 0.5), 'sky3');
    p.add(cloud(x + w * 0.08, x + w * 0.9, y - h * 0.32, [[x + w * 0.22, y - h * 0.78], [x + w * 0.44, y - h * 1.15], [x + w * 0.66, y - h * 1.1], [x + w * 0.82, y - h * 0.66]]), 'white');
  };
  cl(40, 150, 230);
  cl(640, 110, 260);

  // hintere Bergkette
  p.tag('berge-hinten');
  const back = [[-10, 470], [90, 345], [190, 420], [300, 300], [400, 400], [520, 320], [640, 410], [760, 290], [870, 380], [1010, 330]];
  p.add(poly([...back, [1010, 620], [-10, 620]]), 'mtn1');
  for (let i = 1; i < back.length - 1; i += 2) {
    const [x, y] = back[i];
    const nx = back[i + 1];
    p.add(poly([[x, y], nx, [nx[0] - 20, 620], [x + 20, 620]]), 'mtn2');
    const k = 0.32;
    const L = [lerp(x, back[i - 1][0], k), lerp(y, back[i - 1][1], k)];
    const Rt = [lerp(x, nx[0], k), lerp(y, nx[1], k)];
    p.add(poly([[x, y], Rt, [lerp(x, Rt[0], 0.55), Rt[1] - 10], [x + 4, Rt[1] + 12], [lerp(x, L[0], 0.5), L[1] - 6], L]), 'white');
  }

  // vordere Gipfel mit Licht- und Schattenseite
  p.tag('gipfel');
  const peak = (top, left, right, ridgeX, snowY) => {
    const [tx, ty] = top;
    p.add(poly([top, [ridgeX, 640], left]), 'rock1');
    p.add(poly([top, right, [ridgeX, 640]]), 'rock2');
    // Schneekappe: Zacken links (Licht) und rechts (Schatten)
    const fl = (y) => lerp(tx, left[0], (y - ty) / (left[1] - ty));
    const fr = (y) => lerp(tx, right[0], (y - ty) / (right[1] - ty));
    const fm = (y) => lerp(tx, ridgeX, (y - ty) / (640 - ty));
    const s1 = snowY, s2 = snowY + 50;
    p.add(poly([top, [fm(s2), s2], [lerp(fm(s1), fl(s1), 0.35), s1], [lerp(fm(s2), fl(s2), 0.6), s2 - 6], [fl(s1 + 10), s1 + 10]]), 'white');
    p.add(poly([top, [fr(s1 - 6), s1 - 6], [lerp(fm(s1), fr(s1), 0.55), s1 + 26], [lerp(fm(s2), fr(s2), 0.3), s2 - 26], [fm(s2), s2]]), 'snowS');
  };
  peak([360, 160], [60, 640], [700, 640], 420, 300);
  peak([800, 250], [560, 640], [1060, 640], 840, 360);

  // Wald am Seeufer
  p.tag('wald');
  p.add(band(wavePts(-10, 1010, 590, 8, 300, 1.2), 1010), 'green2');
  const fir = (x, yb, h) => {
    const w = h * 0.36;
    const tiers = 3;
    const left = [];
    const right = [];
    for (let t = 0; t < tiers; t++) {
      const yTop = yb - h + (t * h) / tiers;
      const yBot = yb - h + ((t + 1) * h) / tiers;
      const ww = w * (0.45 + (0.55 * (t + 1)) / tiers);
      left.push([x - ww * 0.55, yTop + (yBot - yTop) * 0.35], [x - ww, yBot]);
      right.push([x + ww * 0.55, yTop + (yBot - yTop) * 0.35], [x + ww, yBot]);
    }
    p.filler(poly([[x, yb - h], ...left.slice(1), [x, yb]]), 'fir1', null, { minArea: 300 });
    p.filler(poly([[x, yb - h], [x, yb], ...right.slice(1).reverse()]), 'fir2', null, { minArea: 300 });
  };
  for (let x = 10; x < 1000; x += 58) fir(x + (R() - 0.5) * 16, 615 + (R() - 0.5) * 10, 90 + R() * 60);

  // See mit Spiegelungen
  p.tag('see');
  p.add(band(wavePts(-10, 1010, 612, 4, 400, 0.5), 1010), 'lake2');
  p.add(between(wavePts(-10, 1010, 650, 6, 320, 1.0), wavePts(-10, 1010, 676, 6, 320, 1.6)), 'lake1');
  p.add(between(wavePts(-10, 1010, 712, 6, 280, 2.0), wavePts(-10, 1010, 740, 6, 280, 2.8)), 'lake1');
  for (const [x, y, w] of [[90, 632, 120], [560, 630, 150], [330, 694, 130], [760, 700, 110]]) {
    p.add(smooth([[x, y, 1], [x + w * 0.5, y - 8], [x + w, y, 1], [x + w * 0.5, y + 8]]), 'sky3');
  }
  // Segelboot
  p.tag('boot');
  const bx = 260;
  const by = 700;
  p.add(poly([[bx - 30, by - 20], [bx + 2, by - 170], [bx + 2, by - 20]]), 'white');
  p.add(poly([[bx + 14, by - 26], [bx + 14, by - 150], [bx + 80, by - 26]]), 'red');
  p.add(smooth([[bx - 80, by - 18, 1], [bx + 100, by - 18, 1], [bx + 70, by + 16], [bx - 60, by + 16]]), 'wood2');

  // Wiese
  p.tag('wiese');
  p.add(band(wavePts(-10, 1010, 770, 14, 520, 3.4), 1010), 'green1');
  p.add(band(wavePts(-10, 1010, 900, 12, 380, 0.4), 1010), 'green2');
  p.tag('blumen');
  for (const [x, y, c] of [[70, 830, 'white'], [160, 870, 'red'], [250, 815, 'white'], [360, 860, 'red'], [450, 820, 'white'], [520, 940, 'white'], [120, 960, 'white'], [300, 970, 'red'], [940, 960, 'white'], [600, 880, 'red']]) {
    const r = 16;
    p.add(poly(Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.55 : r;
      return [x + rr * Math.cos(a), y + rr * Math.sin(a)];
    })), c);
  }

  // Chalet
  p.tag('chalet');
  p.add(rect(645, 655, 230, 200), 'wood1');
  p.add(poly([[655, 664], [760, 572], [865, 664]]), 'wood1');
  p.add(circle(760, 622, 30), 'white');
  p.add(circle(760, 622, 21), 'sky3');
  p.add(roundPoly([[596, 670], [760, 526], [924, 670], [924, 694], [760, 560], [596, 694]], 6), 'wood2');
  p.add(rect(820, 548, 28, 50), 'rock2');
  p.add(rect(624, 698, 272, 46, 4), 'wood2');
  for (let i = 0; i < 5; i++) p.add(heart(664 + i * 48, 714, 26), 'wood1');
  for (const x of [668, 802]) {
    p.add(rect(x - 16, 764, 16, 60), 'fir1');
    p.add(rect(x + 52, 764, 16, 60), 'fir1');
    p.add(rect(x, 762, 52, 62), 'white');
    p.add(rect(x + 6, 768, 18, 50), 'sky3');
    p.add(rect(x + 28, 768, 18, 50), 'sky3');
    p.add(cloud(x - 10, x + 62, 836, [[x + 6, 822], [x + 26, 816], [x + 46, 820]], 0.55), 'red');
    p.add(rect(x - 8, 832, 68, 16, 3), 'green2');
  }
  p.add(rect(738, 770, 44, 85, 6), 'wood2');
  p.add(rect(630, 852, 260, 24, 4), 'rock1');

  return p;
}
