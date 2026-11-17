// Heissluftballone über einer Hügellandschaft mit Feldern (Hochformat).
import { Pic, rect, circle, ellipse, smooth, smoothOpen, polyline, poly, roundPoly, cloud, wavePts, band, between, lerp } from './lib.mjs';

export const meta = {
  id: 'b-ballone',
  title: 'Heissluftballone',
  category: 'Landschaften',
  width: 800,
  height: 1000,
  palette: {
    sky1: '#8dcbea',
    sky2: '#acdaef',
    sky3: '#cdeaf1',
    cream: '#f7ecd8',
    peach: '#f8d2bb',
    white: '#ffffff',
    cloudShade: '#d9e7ef',
    yellow: '#f6c64c',
    red: '#e6544b',
    teal: '#3ea89f',
    purple: '#8d6fc8',
    pink: '#f29bb2',
    basket: '#b07a45',
    basketDark: '#7d522c',
    hillFar: '#a9cfbb',
    green: '#7cb87a',
    greenDark: '#4f9150',
    greenLight: '#b8d870',
  },
};

export default function build() {
  const p = new Pic(meta);
  const W = 800;

  // Himmel in Streifen (Teilung hinter Ballonen erledigt der Bauer)
  p.tag('himmel');
  p.add(rect(-10, -10, W + 20, 1020), 'sky1');
  p.add(band(wavePts(-10, W + 10, 170, 12, 420, 0.6), 1010), 'sky2');
  p.add(band(wavePts(-10, W + 10, 320, 12, 380, 2.2), 1010), 'sky3');
  p.add(band(wavePts(-10, W + 10, 450, 10, 440, 4.1), 1010), 'cream');
  p.add(band(wavePts(-10, W + 10, 548, 8, 400, 1.0), 1010), 'peach');
  p.add(circle(600, 572, 62), 'yellow');

  // Wolken (hinten)
  const cl = (x, y, w, s = 1) => {
    p.tag('wolke');
    const h = w * 0.36 * s;
    p.add(cloud(x, x + w, y, [[x + w * 0.14, y - h * 0.3], [x + w * 0.36, y - h * 0.62], [x + w * 0.62, y - h * 0.66], [x + w * 0.85, y - h * 0.32]], 0.5), 'cloudShade');
    p.add(cloud(x + w * 0.04, x + w * 0.94, y - h * 0.34, [[x + w * 0.16, y - h * 0.7], [x + w * 0.36, y - h * 1.18], [x + w * 0.6, y - h * 1.24], [x + w * 0.82, y - h * 0.72]]), 'white');
  };
  cl(30, 300, 200);
  cl(560, 90, 190);
  cl(470, 470, 170, 0.9);

  // Ballon: Hülle in Bahnen, oben und unten versetzt gefärbt, mit Gurt, Kappe, Korb
  const balloon = (cx, yT, H, Wd, cols, { gores = 7, belt = 'teal', neckCol = 'basketDark', cap = null } = {}) => {
    p.tag('ballon' + Math.round(cx));
    const half = (t) => {
      const w2 = Wd / 2;
      const neck = Wd * 0.12;
      if (t <= 0.48) return w2 * Math.sqrt(Math.max(0, 1 - Math.pow((0.48 - t) / 0.48, 2)));
      const q = (t - 0.48) / 0.52;
      return neck + (w2 - neck) * Math.pow(Math.cos((q * Math.PI) / 2), 1.15);
    };
    const yAt = (t) => yT + H * t;
    const fmax = Math.sin((72 * Math.PI) / 180);
    const us = [];
    for (let j = 0; j <= gores; j++) us.push(Math.sin(((-72 + (144 * j) / gores) * Math.PI) / 180) / fmax);
    const gore = (j, t0, t1) => {
      const pts = [];
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const t = lerp(t0, t1, i / n);
        pts.push([cx + us[j] * half(t), yAt(t)]);
      }
      for (let i = n; i >= 0; i--) {
        const t = lerp(t0, t1, i / n);
        pts.push([cx + us[j + 1] * half(t), yAt(t)]);
      }
      pts[0].push(1);
      pts[n].push(1);
      pts[n + 1].push(1);
      pts[2 * n + 1].push(1);
      return smooth(pts);
    };
    const tb0 = 0.5;
    const tb1 = 0.6;
    for (let j = 0; j < gores; j++) p.add(gore(j, 0.0, tb0 + 0.01), cols[j % 2]);
    for (let j = 0; j < gores; j++) p.add(gore(j, tb1 - 0.01, 0.94), cols[(j + 1) % 2]);
    // Gurt
    const top = [];
    const bot = [];
    for (let i = 0; i <= 12; i++) {
      const u = -1 + (2 * i) / 12;
      const tt = tb0 + 0.012 * (1 - u * u);
      top.push([cx + u * (half(tb0) + 3), yAt(tb0) + H * 0.012 * (1 - u * u)]);
      bot.push([cx + u * (half(tb1) + 3), yAt(tb1) + H * 0.02 * (1 - u * u)]);
      void tt;
    }
    p.add(between(top, bot), belt);
    // Kappe oben
    if (cap) p.add(ellipse(cx, yAt(0.04), Wd * 0.17, H * 0.065), cap);
    // Hals
    const nw = Math.max(half(0.94), 14);
    const ny1 = Math.max(yAt(1.0), yAt(0.93) + 18);
    p.add(roundPoly([[cx - nw - 2, yAt(0.93)], [cx + nw + 2, yAt(0.93)], [cx + nw * 0.8, ny1], [cx - nw * 0.8, ny1]], 3), neckCol);
    // Seile und Korb
    const bw = Math.max(34, Wd * 0.22);
    const by0 = yAt(1.0) + H * 0.1;
    const bh = Math.max(26, H * 0.13);
    p.line(polyline([[cx - nw * 0.8, ny1], [cx - bw / 2 + 3, by0]]), 2.5, '#6b4a2e');
    p.line(polyline([[cx + nw * 0.8, ny1], [cx + bw / 2 - 3, by0]]), 2.5, '#6b4a2e');
    p.add(roundPoly([[cx - bw / 2, by0 + bh * 0.25], [cx + bw / 2, by0 + bh * 0.25], [cx + bw * 0.42, by0 + bh], [cx - bw * 0.42, by0 + bh]], 4), 'basket');
    p.add(roundPoly([[cx - bw / 2 - 3, by0], [cx + bw / 2 + 3, by0], [cx + bw / 2 + 3, by0 + bh * 0.42], [cx - bw / 2 - 3, by0 + bh * 0.42]], 3), 'basketDark');
  };

  balloon(118, 330, 140, 110, ['pink', 'purple'], { gores: 5, belt: 'teal', cap: null });
  cl(30, 580, 160, 0.8);
  balloon(600, 130, 200, 170, ['purple', 'yellow'], { gores: 7, belt: 'pink', cap: 'pink' });
  balloon(330, 175, 320, 280, ['red', 'yellow'], { gores: 7, belt: 'teal', cap: 'teal' });

  // Hügel
  p.tag('hügel');
  p.add(band([[-10, 640], [120, 610], [260, 628], [420, 600], [560, 622], [700, 598], [810, 616]], 1010), 'hillFar');
  p.add(band([[-10, 690], [140, 660], [300, 684], [470, 650], [640, 676], [810, 652]], 1010), 'green');

  p.tag('haus');
  // Bauernhaus auf dem rechten Hügel
  const hx = 650, hy = 784;
  p.add(rect(hx - 50, hy - 40, 100, 52), 'cream');
  p.add(poly([[hx - 64, hy - 36], [hx, hy - 86], [hx + 64, hy - 36]]), 'red');
  p.add(rect(hx - 12, hy - 18, 24, 30), 'basketDark');

  // Felder auf den vorderen Hügeln: Streifen zwischen versetzten Kurven
  const hill = (crest, layers) => {
    p.tag('feld');
    let prev = crest;
    layers.forEach(([dy, col], i) => {
      const next = crest.map(([x, y]) => [x, y + dy]);
      if (i === layers.length - 1) p.add(band(prev, 1010), col);
      else p.add(between(prev, next), col);
      prev = next;
    });
  };
  // linker Hügel
  const left = [[-20, 760], [80, 735], [200, 722], [330, 735], [440, 770], [520, 815], [600, 880], [640, 1010]];
  hill(left, [[34, 'greenLight'], [72, 'yellow'], [118, 'greenDark'], [170, 'greenLight'], [1000, 'green']]);
  // rechter Hügel
  const right = [[260, 1010], [330, 900], [420, 836], [540, 800], [660, 790], [760, 800], [820, 815]];
  hill(right, [[40, 'purple'], [84, 'greenLight'], [134, 'yellow'], [1000, 'green']]);

  // Bäume
  const tree = (x, y, r) => {
    p.tag('baum');
    p.add(smooth([[x - r, y + r * 0.2], [x - r * 0.8, y - r * 0.7], [x, y - r * 1.15], [x + r * 0.8, y - r * 0.7], [x + r, y + r * 0.2], [x, y + r * 0.55]]), 'greenDark');
  };
  for (const [x, y, r] of [[60, 700, 26], [110, 712, 20], [690, 718, 24], [748, 714, 25], [380, 690, 20], [205, 704, 22]]) tree(x, y, r);

  return p;
}
