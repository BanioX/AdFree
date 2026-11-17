// Cupcake mit Kirsche – auf Tortenständer, vor Sonnenstrahlen und Glitzer-Plakette.
import { Pic, rect, circle, ellipse, wedge, bumpy, arcPts, smooth, poly, capsule, stroke, leaf, star, heart, rng, lerp } from './lib.mjs';

export const meta = {
  id: 'b-cupcake',
  title: 'Cupcake mit Kirsche',
  category: 'Essen',
  palette: {
    cream: '#fdf1e4',
    blush: '#f8d2d8',
    mint: '#cdeee3',
    mintDark: '#92d3c2',
    table: '#b9a6e0',
    lilac: '#dcd0f3',
    teal: '#4fb3a9',
    tealDark: '#2e8d87',
    pink: '#f6a3ba',
    pinkDark: '#de6f93',
    pinkLight: '#fdd6e1',
    cherry: '#d62f4b',
    cherryDark: '#951a33',
    white: '#ffffff',
    green: '#6fb04f',
    yellow: '#ffcf5c',
    blue: '#79b4ec',
  },
};

export default function build() {
  const p = new Pic(meta);
  const C = [500, 520];

  // Hintergrund: Sonnenstrahlen (Keil 0 = Hintergrund-Rechteck)
  p.add(rect(-10, -10, 1020, 1020), 'cream');
  const n = 16;
  for (let i = 1; i < n; i++) {
    const a0 = -90 - 360 / n / 2 + (360 * i) / n;
    p.filler(wedge(C[0], C[1], 950, a0, a0 + 360 / n), i % 2 ? 'blush' : 'cream');
  }

  // Tisch
  p.add(rect(-10, 884, 510, 140), 'pink');
  p.add(rect(500, 884, 510, 140), 'pink');
  p.add(bumpy(arcPts(500, 968, 205, 40, 0, 360, 20).slice(0, 20), 0.28), 'white');

  // Konfetti-Punkte, je einer pro Strahl
  const dotCols = ['yellow', 'mintDark', 'white', 'yellow', 'mintDark', 'blue'];
  for (let i = 0; i < n; i++) {
    const a = ((-90 + (360 * i) / n) * Math.PI) / 180;
    const r = i % 2 ? 430 : 455;
    const x = C[0] + Math.cos(a) * r;
    const y = C[1] + Math.sin(a) * r;
    if (y > 860 || y < 20 || i === 0) continue;
    p.add(circle(x, y, 20), dotCols[i % dotCols.length]);
  }
  for (const [x, y, c] of [[70, 70, 'mintDark'], [930, 70, 'yellow'], [70, 840, 'yellow'], [930, 840, 'mintDark']]) p.add(circle(x, y, 22), c);

  // Plakette mit Wellenrand – links und rechts je ein eigener Bereich
  // (die Naht liegt unter Kirschenstiel und Cupcake)
  const R = 345;
  const BC = [500, 530];
  const SPLIT = 274.5;
  const halfRim = (a0, a1) => {
    const steps = 14;
    const pts = arcPts(BC[0], BC[1], R, R, a0, a1, steps);
    return bumpy([...pts, BC], [...Array(steps).fill(0.3), 0, 0]);
  };
  p.add(halfRim(90, SPLIT), 'mintDark');
  p.add(halfRim(SPLIT - 360, 90), 'mintDark');
  const halfDisk = (a0, a1) => smooth([BC.concat(1), ...arcPts(BC[0], BC[1], 313, 313, a0, a1, 16).map(([x, y], i, arr) => (i === 0 || i === arr.length - 1 ? [x, y, 1] : [x, y]))]);
  p.add(halfDisk(90, SPLIT), 'mint');
  p.add(halfDisk(SPLIT - 360, 90), 'mint');

  // kleine Sterne + Herzen auf der Plakette
  p.add(star(270, 330, 30, 13, 5, -90, 3), 'yellow');
  p.add(star(745, 395, 26, 11, 5, -80, 3), 'yellow');
  p.add(star(250, 640, 22, 10, 5, -100, 3), 'white');
  p.add(heart(735, 640, 46), 'pinkLight');
  p.add(heart(300, 470, 40), 'pinkLight');
  p.add(star(716, 262, 22, 10, 5, -90, 2), 'white');

  // Tortenständer
  p.add(ellipse(500, 954, 125, 26), 'table');
  p.add(poly([[462, 870], [538, 870], [526, 948], [474, 948]]), 'lilac');
  p.add(ellipse(500, 858, 290, 48), 'table');
  p.add(ellipse(500, 842, 290, 40), 'lilac');

  // Papierförmchen: 9 Falten auf einem Zylinder
  const top = 615;
  const bot = 822;
  const wTop = 168;
  const wBot = 130;
  const bx = (u) => 500 + u * wBot;
  const by = (u) => bot + 14 * (1 - u * u);
  const S75 = Math.sin((72 * Math.PI) / 180);
  for (let k = 0; k < 7; k++) {
    const u0 = Math.sin(((-72 + (144 / 7) * k) * Math.PI) / 180) / S75;
    const u1 = Math.sin(((-72 + (144 / 7) * (k + 1)) * Math.PI) / 180) / S75;
    const pts = [[500 + u0 * wTop, top], [500 + u1 * wTop, top]];
    for (let t = 0; t <= 4; t++) {
      const u = lerp(u1, u0, t / 4);
      pts.push([bx(u), by(u)]);
    }
    p.add(poly(pts), k % 2 ? 'tealDark' : 'teal');
  }

  // Sahnehaube: drei Wülste + Spitze, je dunkle Unterseite, Grundton, Glanz
  const rollPts = (cx, cy, rx, ry, waves, amp) => {
    const pts = [];
    const m = 26;
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2;
      const s = Math.sin(a);
      const wob = s > 0 ? amp * s * Math.cos(a * waves) : 0;
      pts.push([cx + rx * Math.cos(a), cy + ry * s + wob]);
    }
    return pts;
  };
  const roll = (cx, cy, rx, ry, waves, amp, hl) => {
    p.add(smooth(rollPts(cx, cy, rx, ry, waves, amp)), 'pinkDark');
    p.add(smooth(rollPts(cx - 3, cy - 20, rx - 2, ry - 4, waves, amp * 0.6)), 'pink');
    p.add(capsule(hl[0], hl[1], hl[2]), 'pinkLight');
  };
  roll(500, 585, 222, 70, 4, 10, [[340, 560], [420, 538], 26]);
  roll(500, 488, 172, 62, 3, 8, [[372, 470], [440, 452], 24]);
  roll(500, 400, 122, 54, 2, 6, [[410, 385], [462, 372], 22]);
  // Spitze
  p.add(smooth([[500, 278], [560, 316], [585, 358], [540, 382], [470, 384], [420, 364], [440, 318]]), 'pinkDark');
  p.add(smooth([[497, 282], [548, 315], [566, 348], [530, 366], [470, 368], [432, 352], [448, 316]]), 'pink');

  // Streusel
  const sp = [
    [338, 572, 20, 'yellow'], [400, 604, -30, 'blue'], [470, 612, 60, 'white'], [565, 610, -15, 'yellow'],
    [628, 582, 35, 'blue'], [690, 560, -60, 'white'], [520, 560, 10, 'blue'], [600, 545, -40, 'yellow'],
    [388, 490, -50, 'yellow'], [445, 512, 25, 'blue'], [560, 472, -20, 'white'], [630, 470, 50, 'yellow'],
    [530, 418, 70, 'blue'], [580, 395, -25, 'yellow'], [455, 425, -10, 'white'],
  ];
  for (const [x, y, a, c] of sp) {
    const dx = Math.cos((a * Math.PI) / 180) * 15;
    const dy = Math.sin((a * Math.PI) / 180) * 15;
    p.add(capsule([x - dx, y - dy], [x + dx, y + dy], 15), c);
  }

  // Kirsche mit Stiel und Blatt
  p.add(stroke([[510, 222], [516, 186], [528, 154], [544, 132]], 14), 'tealDark');
  p.add(leaf(84, 24, { bend: -5 }).rotate(-38).translate(540, 140), 'green');
  p.add(circle(503, 262, 58), 'cherryDark');
  p.add(circle(495, 254, 50), 'cherry');
  p.add(ellipse(476, 236, 17, 11, -35), 'white');

  return p;
}
