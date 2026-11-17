// Winterdorf in der Dämmerung: verschneite Häuser, Kirche, Tannen, Eisweiher, Schneemann und Mond.
import { Pic, Path, rect, circle, ellipse, smooth, poly, wavePts, band, rng } from './lib.mjs';

export const meta = {
  id: 'b-winterdorf',
  title: 'Winterdorf',
  category: 'Winter',
  palette: {
    sky1: '#38468a',
    sky2: '#5b67ad',
    sky3: '#9488cc',
    sky4: '#d8a8cc',
    moon: '#fdf2c4',
    snow: '#ffffff',
    snowS: '#d8e2f3',
    snowD: '#a9bbdf',
    red: '#d65a50',
    ochre: '#eab04f',
    blue: '#6d9ed6',
    green: '#7db38a',
    wood: '#8a5d45',
    win: '#ffd86b',
    fir1: '#3f7d63',
    fir2: '#2b5a4f',
    ice: '#bde2f0',
  },
};

function arch(x, y, w, h) {
  const r = w / 2;
  return new Path([['M', x, y + h], ['L', x, y + r], ['A', r, r, 0, 0, 1, x + w, y + r], ['L', x + w, y + h], ['Z']]);
}

export default function build() {
  const p = new Pic(meta);
  const R = rng(3);

  // Himmel, Mond, Sterne
  p.tag('himmel');
  p.add(rect(-10, -10, 1020, 1020), 'sky1');
  p.add(band(wavePts(-10, 1010, 190, 10, 500, 0.4), 1010), 'sky2');
  p.add(band(wavePts(-10, 1010, 330, 10, 460, 2.2), 1010), 'sky3');
  p.add(band(wavePts(-10, 1010, 450, 8, 420, 4.1), 1010), 'sky4');
  p.tag('mond');
  p.add(circle(810, 130, 92), 'sky2');
  p.add(circle(810, 130, 62), 'moon');
  p.tag('sterne');
  for (const [x, y, r] of [[90, 70, 26], [300, 120, 22], [520, 60, 26], [640, 200, 20], [180, 230, 20], [940, 280, 22], [400, 250, 18]]) {
    p.add(poly([[x, y - r], [x + r * 0.3, y - r * 0.3], [x + r, y], [x + r * 0.3, y + r * 0.3], [x, y + r], [x - r * 0.3, y + r * 0.3], [x - r, y], [x - r * 0.3, y - r * 0.3]]), 'moon');
  }

  // Hügel
  p.tag('huegel');
  p.add(band(wavePts(-10, 1010, 520, 26, 620, 0.2), 1010), 'snowD');
  p.add(band(wavePts(-10, 1010, 600, 20, 560, 2.6), 1010), 'snowS');

  // Tannen
  const fir = (x, yb, h, prune = false) => {
    const w = h * 0.42;
    const opt = prune ? { prune: { minArea: 300 } } : undefined;
    for (let t = 0; t < 3; t++) {
      const ty = yb - h + t * h * 0.27;
      const by = ty + h * 0.4;
      const ww = w * (0.55 + t * 0.22);
      p.add(smooth([[x, ty, 1], [x + ww, by, 1], [x + ww * 0.5, by + 8], [x, by + 2], [x - ww * 0.5, by + 8], [x - ww, by, 1]]), t % 2 ? 'fir2' : 'fir1', opt);
      p.add(smooth([[x, ty, 1], [x + ww * 0.42, ty + h * 0.16, 1], [x + ww * 0.18, ty + h * 0.2], [x, ty + h * 0.15], [x - ww * 0.2, ty + h * 0.21], [x - ww * 0.42, ty + h * 0.16, 1]]), 'snow', opt);
    }
    p.add(rect(x - 9, yb - 4, 18, 20), 'wood', opt);
  };

  // Häuser
  const house = (cx, yb, w, h, col, { chim = 0, smoke = false, big = false } = {}) => {
    const top = yb - h;
    const apex = top - w * 0.42;
    if (chim) {
      const x = cx + chim * w * 0.24;
      p.add(rect(x - 12, apex - 16, 24, 70), 'wood');
      p.add(rect(x - 17, apex - 30, 34, 18, 7), 'snow');
      if (smoke) [[2, -50, 13], [14, -84, 17], [-2, -124, 21]].forEach(([dx, dy, r]) => p.add(circle(x + dx, apex + dy, r), 'snowS'));
    }
    p.add(rect(cx - w / 2, top, w, h), col);
    p.add(poly([[cx - w / 2 - 18, top + 8], [cx, apex], [cx + w / 2 + 18, top + 8]]), 'snowS');
    p.add(smooth([[cx - w / 2 - 18, top - 6, 1], [cx, apex - 12, 1], [cx + w / 2 + 18, top - 6, 1], [cx + w * 0.3, top - 2], [cx + w * 0.1, top + 4], [cx - w * 0.15, top - 2], [cx - w * 0.36, top + 2]]), 'snow');
    if (big) {
      for (const dx of [-0.3, 0.3]) {
        const x = cx + dx * w - 19;
        p.add(rect(x, top + 22, 38, 36), 'win');
        p.add(rect(x - 4, top + 56, 46, 10, 4), 'snow');
      }
      p.add(arch(cx - 18, yb - 62, 36, 62), 'wood');
      p.add(circle(cx, apex + w * 0.24, 16), 'win');
    } else {
      p.add(rect(cx - w * 0.3 - 13, top + 18, 26, 26), 'win');
      p.add(arch(cx + w * 0.3 - 14, yb - 46, 28, 46), 'wood');
    }
  };

  p.tag('dorf-hinten');
  fir(40, 600, 130, true);
  house(140, 610, 120, 78, 'ochre', { chim: 1, smoke: true });
  house(305, 600, 110, 74, 'green', { chim: -1 });
  fir(400, 610, 110, true);
  house(700, 606, 120, 80, 'red', { chim: 1 });
  house(865, 616, 120, 78, 'blue', { chim: -1, smoke: true });
  fir(965, 620, 120, true);

  // Kirche
  p.tag('kirche');
  p.add(rect(478, 380, 52, 120), 'snowD');
  p.add(poly([[468, 386], [504, 262], [540, 386]]), 'red');
  p.add(poly([[468, 386], [504, 262], [504, 386]]), 'snow');
  p.add(circle(504, 420, 16), 'win');
  p.add(rect(440, 500, 130, 150), 'snowS');
  p.add(poly([[426, 506], [505, 440], [584, 506]]), 'snow');
  p.add(arch(486, 580, 38, 70), 'wood');
  p.add(arch(452, 530, 24, 40), 'win');
  p.add(arch(534, 530, 24, 40), 'win');

  // Vordergrund
  p.tag('schnee');
  p.add(band(wavePts(-10, 1010, 700, 18, 540, 1.3), 1010), 'snow');
  fir(600, 760, 170);
  fir(360, 750, 150);
  p.tag('dorf-vorne');
  house(200, 780, 170, 116, 'red', { chim: 1, smoke: true, big: true });
  house(760, 790, 180, 120, 'blue', { chim: -1, big: true });

  // Eisweiher und Schneewehen
  p.tag('weiher');
  p.add(smooth([[-10, 1010, 1], [-10, 860], [160, 830], [360, 850], [470, 900], [560, 1010, 1]]), 'snowS');
  p.add(ellipse(260, 905, 170, 50), 'ice');
  p.add(smooth([[160, 895, 1], [230, 885], [300, 895, 1], [230, 902]]), 'snow');
  p.add(smooth([[250, 920, 1], [310, 912], [360, 920, 1], [310, 927]]), 'snow');
  p.add(smooth([[620, 1010, 1], [700, 920], [860, 880], [1010, 900], [1010, 1010, 1]]), 'snowS');

  // Schneemann
  p.tag('schneemann');
  const sx = 870;
  p.add(circle(sx, 900, 64), 'snow');
  p.add(circle(sx, 808, 46), 'snow');
  p.add(circle(sx, 738, 36), 'snow');
  p.add(smooth([[sx - 44, 770], [sx, 782], [sx + 44, 770], [sx + 40, 790], [sx, 800], [sx - 40, 790]]), 'red');
  p.add(poly([[sx + 18, 790], [sx + 40, 788], [sx + 46, 850], [sx + 22, 846]]), 'red');
  p.add(rect(sx - 46, 696, 92, 14, 6), 'sky1');
  p.add(rect(sx - 28, 650, 56, 50, 6), 'sky1');
  p.add(poly([[sx - 4, 736], [sx + 4, 736], [sx + 36, 746], [sx - 2, 750]]), 'ochre');
  for (const [dx, dy] of [[-14, 724], [14, 724]]) p.add(circle(sx + dx, dy, 10.5), 'sky1');
  for (const y of [820, 860, 900]) p.add(circle(sx, y, 11), 'sky1');

  // Schneeflocken
  p.tag('flocken');
  for (let i = 0; i < 26; i++) {
    const x = 30 + R() * 940;
    const y = 20 + R() * 460;
    if (Math.hypot(x - 810, y - 130) < 110) continue;
    p.filler(circle(x, y, 10 + R() * 6), 'snow', null, { minArea: 300 });
  }
  return p;
}
