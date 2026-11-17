// Unterwasserwelt: Meeresschildkröte, gestreifte Fische, Korallen, Seetang und Lichtstrahlen.
import { Pic, Path, rect, circle, ellipse, smooth, poly, star, petal, wavePts, band, stroke, wedge, annulusSeg, lerp } from './lib.mjs';

export const meta = {
  id: 'b-unterwasser',
  title: 'Unterwasserwelt',
  category: 'Landschaften',
  palette: {
    w1: '#c4ecf1',
    w2: '#93d6e4',
    w3: '#62b9d2',
    w4: '#3b8fb6',
    sand1: '#f7e4b7',
    sand2: '#e9c98b',
    kelp1: '#82c784',
    kelp2: '#4c9b6d',
    pink: '#f59db3',
    coral: '#f27a5f',
    purple: '#a982d2',
    yellow: '#ffd35e',
    orange: '#f59a3c',
    turt1: '#b3cf72',
    turt2: '#6c8c48',
    shell: '#c99a5b',
    white: '#ffffff',
    dark: '#2b3949',
  },
};

export default function build() {
  const p = new Pic(meta);

  // Wasser und Lichtstrahlen
  p.tag('wasser');
  p.add(rect(-10, -10, 1020, 1020), 'w1');
  p.add(band(wavePts(-10, 1010, 230, 12, 520, 0.3), 1010), 'w2');
  p.add(band(wavePts(-10, 1010, 470, 12, 460, 2.1), 1010), 'w3');
  p.add(band(wavePts(-10, 1010, 690, 10, 420, 4.0), 1010), 'w4');
  p.tag('stroemung');
  for (const [x, y, w] of [[60, 120, 200], [620, 90, 240], [380, 330, 220], [60, 400, 160], [700, 420, 220], [420, 600, 200], [40, 760, 160]]) {
    p.filler(smooth([[x, y, 1], [x + w * 0.3, y - 14], [x + w * 0.7, y + 4], [x + w, y - 6, 1], [x + w * 0.7, y + 18], [x + w * 0.3, y + 6]]), y < 230 ? 'w2' : y < 470 ? 'w1' : y < 690 ? 'w2' : 'w3');
  }

  // Seetang
  p.tag('tang');
  const kelp = (x, h, ph, col) => {
    const pts = [];
    for (let y = 1010; y >= 1010 - h; y -= 40) pts.push([x + Math.sin((y / 140) + ph) * 26, y]);
    p.add(stroke(pts, 40, { w1: 16 }), col);
  };
  kelp(50, 640, 0, 'kelp2');
  kelp(115, 520, 1.6, 'kelp1');
  kelp(890, 600, 2.4, 'kelp1');
  kelp(955, 700, 0.8, 'kelp2');

  // Meeresboden
  p.tag('boden');
  p.add(band(wavePts(-10, 1010, 830, 16, 480, 0.8), 1010), 'sand1');
  p.add(band(wavePts(-10, 1010, 925, 12, 360, 2.6), 1010), 'sand2');

  // Fächerkoralle
  p.tag('korallen');
  const fan = (cx, cy, r, n) => {
    for (let i = 0; i < n; i++) {
      const a0 = lerp(-160, -20, i / n);
      const a1 = lerp(-160, -20, (i + 1) / n);
      p.add(wedge(cx, cy, r * (i % 2 ? 0.92 : 1), a0, a1), i % 2 ? 'pink' : 'coral');
    }
    p.add(annulusSeg(cx, cy, 0, r * 0.32, -175, -5), 'purple');
  };
  fan(200, 880, 190, 7);
  // Hirnkoralle: Kuppel mit welligen Windungen
  {
    const cx = 830, cy = 1010, rx = 150, ry = 140;
    const dome = (x) => cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
    const wy = [0, 905, 945, 980, 1020];
    for (let i = 0; i < wy.length - 1; i++) {
      const top = [];
      const bot = [];
      for (let k = 0; k <= 60; k++) {
        const x = cx - rx + (2 * rx * k) / 60;
        const wv = (y0) => (y0 ? y0 + 9 * Math.sin(x / 22 + i) : 0);
        top.push([x, Math.max(wv(wy[i]), dome(x))]);
        bot.push([x, Math.max(wv(wy[i + 1]), dome(x))]);
      }
      p.add(poly([...top, ...bot.reverse()]), i % 2 ? 'yellow' : 'orange');
    }
  }
  // Röhrenkorallen
  for (const [x, h, w] of [[420, 120, 34], [462, 160, 36], [506, 100, 32]]) {
    p.add(rect(x - w / 2, 960 - h, w, h + 60, w / 2), 'purple');
    p.add(ellipse(x, 960 - h + 6, w / 2 - 4, 9), 'pink');
  }
  // Seestern und Muschel
  p.tag('sand');
  p.add(star(590, 960, 54, 24, 5, -80, 8), 'orange');
  p.add(circle(590, 960, 14), 'yellow');
  for (let i = 0; i < 6; i++) p.add(wedge(345, 985, 56, -170 + i * 26.6, -170 + (i + 1) * 26.6), i % 2 ? 'sand2' : 'pink');

  // Schildkröte
  p.tag('schildkroete');
  const T = (path) => path.rotate(-28).translate(560, 380);
  const fl = (x, y, ang, len, wid) => T(petal(len, wid, { pos: 0.45, tip: 0.5 }).rotate(ang).translate(x, y));
  p.add(fl(-80, 110, -150, 90, 30), 'turt1');
  p.add(fl(80, 110, 150, 90, 30), 'turt1');
  p.add(fl(-92, -60, -110, 190, 46), 'turt1');
  p.add(fl(92, -60, 110, 190, 46), 'turt1');
  p.add(T(smooth([[-16, 140], [0, 196, 1], [16, 140]])), 'turt2');
  p.add(T(ellipse(0, -182, 44, 54)), 'turt1');
  p.add(T(circle(-22, -196, 10)), 'dark');
  p.add(T(circle(22, -196, 10)), 'dark');
  p.add(T(ellipse(0, 0, 124, 154)), 'turt2');
  p.add(T(ellipse(0, 0, 100, 128)), 'shell');
  const ex = (y) => 100 * Math.sqrt(Math.max(0, 1 - (y / 128) ** 2));
  const ys = [-128, -40, 40, 128];
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) {
      const pts = [[s * 34, ys[i] + (i === 0 ? 30 : 0)]];
      for (let k = 0; k <= 8; k++) {
        const y = lerp(ys[i] + (i === 0 ? 30 : 0), ys[i + 1] - (i === 2 ? 30 : 0), k / 8);
        pts.push([s * ex(y), y]);
      }
      pts.push([s * 34, ys[i + 1] - (i === 2 ? 30 : 0)]);
      p.add(T(poly(s > 0 ? pts : pts.reverse())), i === 1 ? 'shell' : 'sand2');
    }
  }
  for (const y of [-80, 0, 80]) {
    p.add(T(poly([[-34, y - 40], [34, y - 40], [44, y], [34, y + 40], [-34, y + 40], [-44, y]])), y ? 'orange' : 'yellow');
  }

  // Fische
  p.tag('fische');
  const fish = (cx, cy, L, H, dir, cuts, cols, fin, eye = true) => {
    const M = (pts) => pts.map(([x, y]) => [cx + dir * x, cy + y]);
    const h = (x) => (H / 2) * Math.pow(Math.max(0, 1 - ((2 * x) / L) ** 2), 0.62);
    p.add(smooth(M([[-L / 2 + 8, 0], [-L / 2 - L * 0.32, -H * 0.5, 1], [-L / 2 - L * 0.2, 0, 1], [-L / 2 - L * 0.32, H * 0.5, 1]])), fin);
    if (L > 120) p.add(smooth(M([[-L * 0.22, -h(-L * 0.22) + 6], [-L * 0.02, -H * 0.82], [L * 0.16, -h(L * 0.16) + 4]])), fin);
    const xs = [-L / 2, ...cuts.map((c) => c * L), L / 2];
    for (let i = 0; i < xs.length - 1; i++) {
      const top = [];
      const bot = [];
      for (let k = 0; k <= 8; k++) {
        const x = lerp(xs[i], xs[i + 1], k / 8);
        top.push([x, -h(x)]);
        bot.push([x, h(x)]);
      }
      p.add(poly(M([...top, ...bot.reverse()])), cols[i % cols.length]);
    }
    if (eye) p.add(circle(cx + dir * L * 0.3, cy - H * 0.1, Math.max(11, H * 0.11)), 'dark');
  };
  fish(250, 200, 190, 104, 1, [-0.22, -0.08, 0.12, 0.24], ['orange', 'white', 'orange', 'white', 'orange'], 'coral');
  fish(800, 560, 170, 96, -1, [-0.2, 0.0, 0.2], ['yellow', 'w4', 'yellow', 'w4'], 'yellow');
  fish(250, 560, 100, 50, 1, [0.05], ['purple', 'pink'], 'pink');
  fish(330, 620, 90, 44, 1, [0.05], ['purple', 'pink'], 'pink');
  fish(220, 650, 90, 44, 1, [0.05], ['purple', 'pink'], 'pink');

  // Luftblasen
  p.tag('blasen');
  for (const [x, y, r] of [[420, 110, 22], [455, 60, 15], [400, 40, 12], [700, 250, 18], [735, 205, 13], [620, 520, 16], [960, 330, 18], [930, 280, 13]]) {
    p.add(circle(x, y, r), 'white');
  }
  return p;
}
