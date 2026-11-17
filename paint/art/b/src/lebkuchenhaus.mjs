// Lebkuchenhaus im Schnee mit Zuckerguss, Pfefferminz-Bonbons, Lolli und Zuckerstange.
import { Pic, rect, circle, ellipse, smooth, poly, roundPoly, bumpy, wavePts, band, arcPts, capsule, star, Path, lerp } from './lib.mjs';

export const meta = {
  id: 'b-lebkuchenhaus',
  title: 'Lebkuchenhaus',
  category: 'Winter',
  palette: {
    sky1: '#34437d',
    sky2: '#52619e',
    sky3: '#8582c0',
    sky4: '#c7a1c7',
    white: '#ffffff',
    snowShade: '#cddbee',
    ginger: '#c47d45',
    gingerDark: '#93552f',
    choco: '#5d3320',
    red: '#d7363f',
    pink: '#f39ac0',
    mint: '#7ccfb6',
    yellow: '#ffd36b',
    green: '#3f8f5a',
    greenDark: '#2a6a45',
    purple: '#9a70d0',
    orange: '#f59d45',
  },
};

/** Bonbon mit gedrehten Keilen. */
function swirl(p, cx, cy, r, n, cols, twist = 50) {
  for (let i = 0; i < n; i++) {
    const a0 = (360 / n) * i;
    const a1 = (360 / n) * (i + 1);
    const pts = [[cx, cy, 1]];
    for (let t = 1; t <= 4; t++) {
      const a = ((a0 + twist * (t / 4)) * Math.PI) / 180;
      pts.push([cx + Math.cos(a) * r * (t / 4), cy + Math.sin(a) * r * (t / 4)]);
    }
    pts[pts.length - 1].push(1);
    for (const [x, y] of arcPts(cx, cy, r, r, a0 + twist, a1 + twist, 4).slice(1, -1)) pts.push([x, y]);
    for (let t = 4; t >= 1; t--) {
      const a = ((a1 + twist * (t / 4)) * Math.PI) / 180;
      const q = [cx + Math.cos(a) * r * (t / 4), cy + Math.sin(a) * r * (t / 4)];
      if (t === 4) q.push(1);
      pts.push(q);
    }
    p.add(smooth(pts), cols[i % cols.length]);
  }
}

/** Gestreifte Stange entlang einer Mittellinie (Punkte), Streifen schräg. */
function stripedCane(p, pts, w, stripe, cols, slant = 0.6) {
  // gleichmässig nach Bogenlänge abtasten
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(L);
    total += L;
  }
  const at = (s) => {
    s = Math.max(0, Math.min(total, s));
    let i = 0;
    while (i < seg.length - 1 && s > seg[i]) {
      s -= seg[i];
      i++;
    }
    const t = seg[i] ? s / seg[i] : 0;
    const a = pts[i];
    const b = pts[i + 1];
    const dx = (b[0] - a[0]) / seg[i];
    const dy = (b[1] - a[1]) / seg[i];
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, nx: -dy, ny: dx };
  };
  const side = (s, k) => {
    const q = at(s);
    return [q.x + q.nx * (w / 2) * k, q.y + q.ny * (w / 2) * k];
  };
  const n = Math.ceil(total / stripe);
  for (let i = 0; i < n; i++) {
    const s0 = (i * total) / n;
    const s1 = ((i + 1) * total) / n;
    const d = stripe * slant;
    const out = [];
    const steps = 3;
    for (let k = 0; k <= steps; k++) out.push(side(lerp(s0 + d, s1 + d, k / steps), 1));
    for (let k = steps; k >= 0; k--) out.push(side(lerp(s0 - d, s1 - d, k / steps), -1));
    // Enden abrunden
    if (i === 0 || i === n - 1) {
      p.add(poly(out), cols[i % cols.length]);
    } else p.add(poly(out), cols[i % cols.length]);
  }
}

export default function build() {
  const p = new Pic(meta);

  // Himmel
  p.tag('himmel');
  p.add(rect(-10, -10, 1020, 1020), 'sky1');
  p.add(band(wavePts(-10, 1010, 230, 12, 500, 0.4), 1010), 'sky2');
  p.add(band(wavePts(-10, 1010, 420, 12, 460, 2.4), 1010), 'sky3');
  p.add(band(wavePts(-10, 1010, 590, 10, 520, 4.0), 1010), 'sky4');

  // Mond
  p.tag('mond');
  const mo = [855, 135];
  const outer = arcPts(mo[0], mo[1], 66, 66, -125, 125, 10);
  const inner = arcPts(mo[0] - 34, mo[1] - 8, 58, 58, 108, -108, 10);
  p.add(smooth([...outer.map((q, i) => (i === 0 || i === outer.length - 1 ? [...q, 1] : q)), ...inner.slice(1, -1)]), 'yellow');

  // Sterne und Schneeflocken
  p.tag('sterne');
  for (const [x, y, r] of [[90, 70, 22], [330, 60, 18], [610, 110, 20], [720, 40, 16], [470, 200, 16], [960, 300, 18], [40, 330, 18]]) {
    p.add(star(x, y, r, r * 0.42, 4, -90, 2), 'yellow');
  }
  p.tag('flocken');
  const flakes = [
    [200, 150], [420, 120], [560, 240], [760, 230], [930, 470], [60, 480], [250, 300], [690, 350],
    [130, 250], [380, 330], [880, 600], [30, 640], [640, 30], [980, 60], [260, 470], [760, 480],
  ];
  flakes.forEach(([x, y], i) => p.filler(circle(x, y, 11 + (i % 3) * 3), 'white'));

  // Tannen im Hintergrund
  p.tag('tanne');
  const fir = (x, yb, h, w) => {
    for (let k = 0; k < 3; k++) {
      const ty = yb - h + k * h * 0.27;
      const by = ty + h * 0.42;
      const ww = w * (0.55 + k * 0.22);
      p.add(smooth([[x, ty, 1], [x + ww * 0.55, by - h * 0.12], [x + ww, by, 1], [x + ww * 0.5, by + 8], [x, by + 2], [x - ww * 0.5, by + 8], [x - ww, by, 1], [x - ww * 0.55, by - h * 0.12]]), k % 2 ? 'greenDark' : 'green');
      p.add(smooth([[x, ty, 1], [x + ww * 0.36, ty + h * 0.15], [x + ww * 0.2, ty + h * 0.2], [x, ty + h * 0.16], [x - ww * 0.2, ty + h * 0.21], [x - ww * 0.38, ty + h * 0.15]]), 'white');
    }
  };
  fir(80, 800, 330, 90);
  fir(930, 800, 360, 95);
  fir(250, 720, 200, 60);

  // Schornstein
  p.tag('haus');
  p.add(rect(612, 300, 62, 130), 'gingerDark');
  p.add(roundPoly([[602, 288], [684, 288], [684, 312], [602, 312]], 6), 'choco');
  p.add(smooth([[598, 292], [610, 270], [640, 262], [672, 268], [688, 290], [668, 296], [640, 292], [616, 298]]), 'white');

  // Fassade
  p.add(poly([[290, 820], [290, 540], [500, 352], [710, 540], [710, 820]]), 'ginger');
  // Dach (umgekehrtes V) mit Schnee und Zuckerguss
  const roof = roundPoly([[500, 282], [776, 556], [742, 590], [500, 360], [258, 590], [224, 556]], 8);
  p.add(roof, 'choco');
  // Bonbons auf dem Dach
  const cols = ['pink', 'mint', 'yellow', 'purple'];
  let ci = 0;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const t = 0.2 + k * 0.17;
      const x = 500 + side * (t * 262);
      const y = 322 + t * 250;
      p.add(circle(x, y, 15), cols[ci++ % cols.length]);
    }
  }
  // Schnee oben auf dem Dach
  const snowTop = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    snowTop.push([lerp(214, 500, t), lerp(552, 272, t)]);
  }
  for (let k = 1; k <= 10; k++) {
    const t = k / 10;
    snowTop.push([lerp(500, 786, t), lerp(272, 552, t)]);
  }
  const snowBottom = snowTop
    .slice()
    .reverse()
    .map(([x, y], i) => [x + (x < 500 ? 8 : -8) * 0 , y + 22 + (i % 2 ? 10 : 0)]);
  p.add(smooth([...snowTop.map((q, i) => (i === 0 || i === snowTop.length - 1 ? [...q, 1] : q)), ...snowBottom.slice(1, -1)]), 'white');
  // Zuckerguss-Bogen an der Dachunterkante
  const eaveL = [];
  for (let k = 0; k <= 7; k++) eaveL.push([lerp(262, 500, k / 7), lerp(588, 362, k / 7)]);
  const eaveR = eaveL.map(([x, y]) => [1000 - x, y]).reverse();
  const icingPts = [...eaveL, ...eaveR.slice(1)];
  const icing = [];
  icingPts.forEach((q) => icing.push(q));
  const icingBack = icingPts.slice().reverse().map(([x, y]) => [x, y - 16]);
  p.add(bumpy([...icingBack, ...icing].reverse(), [...Array(icingBack.length).fill(0), ...Array(icing.length - 1).fill(0.42), 0].reverse()), 'white');

  // rundes Giebelfenster
  p.add(circle(500, 462, 50), 'white');
  for (const [a0, a1] of [[0, 90], [90, 180], [180, 270], [270, 360]]) {
    const pts = [[500 + Math.cos(((a0 + 45) * Math.PI) / 180) * 7 * 1.41, 462 + Math.sin(((a0 + 45) * Math.PI) / 180) * 7 * 1.41, 1]];
    const arc = arcPts(500, 462, 38, 38, a0 + 9, a1 - 9, 4);
    arc.forEach((q, i) => pts.push(i === 0 || i === arc.length - 1 ? [...q, 1] : q));
    p.add(smooth(pts), 'yellow');
  }

  // Fenster
  const win = (x, y) => {
    p.add(roundPoly([[x, y], [x + 100, y], [x + 100, y + 100], [x, y + 100]], 10), 'white');
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x0 = x + 11 + dx * 42;
      const y0 = y + 11 + dy * 42;
      p.add(roundPoly([[x0, y0], [x0 + 36, y0], [x0 + 36, y0 + 36], [x0, y0 + 36]], 4), 'yellow');
    }
    p.add(capsule([x - 8, y + 114], [x + 108, y + 114], 20), 'pink');
  };
  win(318, 572);
  win(582, 572);

  // Tür
  p.add(smooth([[436, 830, 1], [436, 700], [500, 640], [564, 700], [564, 830, 1]]), 'white');
  p.add(smooth([[450, 830, 1], [450, 706], [500, 656], [550, 706], [550, 830, 1]]), 'red');
  p.add(circle(534, 752, 10), 'yellow');

  // Pfefferminz-Bonbons an der Fassade
  swirl(p, 360, 760, 36, 8, ['red', 'white'], 40);
  swirl(p, 640, 760, 36, 8, ['red', 'white'], 40);
  // Herz im Giebel
  p.tag('deko');

  // Lolli links
  p.tag('lolli');
  p.add(capsule([168, 600], [168, 860], 18), 'white');
  p.add(circle(168, 520, 86), 'purple');
  swirl(p, 168, 520, 72, 6, ['pink', 'white', 'mint'], 70);

  // Zuckerstange rechts
  p.tag('zuckerstange');
  const cane = [];
  for (let y = 880; y >= 560; y -= 20) cane.push([842, y]);
  for (const [x, y] of arcPts(800, 560, 42, 42, 0, -180, 10).slice(1)) cane.push([x, y]);
  cane.push([758, 596]);
  stripedCane(p, cane, 36, 34, ['red', 'white'], 0.5);

  // Schnee am Boden
  p.tag('schnee');
  p.add(band([[-10, 800], [120, 780], [260, 800], [400, 812], [520, 806], [660, 812], [800, 790], [1010, 800]], 1010), 'snowShade');
  p.add(band([[-10, 840], [140, 818], [300, 838], [500, 852], [700, 836], [860, 820], [1010, 832]], 1010), 'white');
  p.add(smooth([[-10, 930, 1], [120, 900], [280, 916], [380, 950], [300, 1010, 1], [-10, 1010, 1]]), 'snowShade');
  p.add(smooth([[620, 1010, 1], [700, 950], [840, 920], [1010, 930, 1], [1010, 1010, 1]]), 'snowShade');

  // Weg aus Bonbon-Steinen
  p.tag('weg');
  const stones = [[500, 868, 34, 12, 'pink'], [488, 905, 44, 15, 'mint'], [512, 948, 54, 18, 'yellow'], [494, 996, 64, 22, 'pink']];
  for (const [x, y, rx, ry, c] of stones) p.add(ellipse(x, y, rx, ry), c);

  // Gummibonbons
  p.tag('gummi');
  const gum = (x, y, r, c) => p.add(smooth([[x - r, y, 1], [x - r * 0.9, y - r * 0.8], [x, y - r * 1.2], [x + r * 0.9, y - r * 0.8], [x + r, y, 1], [x, y + r * 0.18]]), c);
  gum(330, 860, 30, 'orange');
  gum(392, 880, 26, 'purple');
  gum(612, 878, 28, 'mint');
  gum(672, 858, 30, 'red');

  // Lebkuchenmann
  p.tag('lebkuchenmann');
  const gx = 880, gy = 900;
  const man = smooth([
    [gx, gy - 140], [gx + 34, gy - 128], [gx + 38, gy - 96], [gx + 22, gy - 78], [gx + 64, gy - 70], [gx + 70, gy - 48],
    [gx + 34, gy - 44], [gx + 36, gy - 16], [gx + 56, gy + 30], [gx + 40, gy + 46], [gx + 6, gy + 6], [gx - 6, gy + 6],
    [gx - 40, gy + 46], [gx - 56, gy + 30], [gx - 36, gy - 16], [gx - 34, gy - 44], [gx - 70, gy - 48], [gx - 64, gy - 70],
    [gx - 22, gy - 78], [gx - 38, gy - 96], [gx - 34, gy - 128],
  ]);
  p.add(man, 'ginger');
  for (const [dy, c] of [[-56, 'red'], [-30, 'mint'], [-4, 'red']]) p.add(circle(gx, gy + dy, 9), c);
  p.line(new Path([['M', gx - 14, gy - 100], ['Q', gx, gy - 88, gx + 14, gy - 100]]), 3, '#5d3320');
  p.line(new Path([['M', gx - 12, gy - 118], ['L', gx - 11, gy - 117]]), 7, '#5d3320');
  p.line(new Path([['M', gx + 12, gy - 118], ['L', gx + 13, gy - 117]]), 7, '#5d3320');

  return p;
}
