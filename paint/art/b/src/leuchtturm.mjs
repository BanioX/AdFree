// Leuchtturm auf den Klippen bei Sonnenuntergang, mit Segelboot und Möwen.
import { Pic, rect, circle, ellipse, smooth, poly, roundPoly, cloud, wavePts, band, between, annulusSeg, polyline, lerp } from './lib.mjs';

export const meta = {
  id: 'b-leuchtturm',
  title: 'Leuchtturm an der Küste',
  category: 'Landschaften',
  palette: {
    sky1: '#5e6db3',
    sky2: '#8e8ccd',
    sky3: '#d39bc1',
    sky4: '#f3b7a2',
    sky5: '#fbd7a6',
    sun: '#ffd47a',
    sea1: '#2e5c93',
    sea2: '#4379b0',
    sea3: '#6c9fcd',
    white: '#ffffff',
    shade: '#dcd7e6',
    rock: '#8d8fa5',
    rockDark: '#5d6079',
    grass: '#7fae68',
    grassDark: '#5a8f50',
    red: '#d8483f',
    redDark: '#a13233',
    dark: '#3c3e5b',
  },
};

export default function build() {
  const p = new Pic(meta);
  const H0 = 585; // Horizont

  // Himmel
  p.tag('himmel');
  p.add(rect(-10, -10, 1020, 1020), 'sky1');
  p.add(band(wavePts(-10, 1010, 150, 14, 520, 1.2), 1010), 'sky2');
  p.add(band(wavePts(-10, 1010, 300, 12, 460, 3.0), 1010), 'sky3');
  p.add(band(wavePts(-10, 1010, 420, 10, 500, 5.0), 1010), 'sky4');
  p.add(band(wavePts(-10, 1010, 510, 8, 480, 0.4), 1010), 'sky5');

  p.tag('sterne');
  for (const [x, y, r] of [[330, 42, 22], [520, 40, 20], [880, 60, 24], [40, 232, 21], [960, 230, 21], [250, 215, 20]]) {
    p.add(poly([[x, y - r], [x + r * 0.36, y - r * 0.36], [x + r, y], [x + r * 0.36, y + r * 0.36], [x, y + r], [x - r * 0.36, y + r * 0.36], [x - r, y], [x - r * 0.36, y - r * 0.36]]), 'sky5');
  }

  // Sonne mit Ringen
  p.tag('sonne');
  const S = [300, H0];
  p.add(circle(S[0], S[1], 150), 'sky3');
  p.add(circle(S[0], S[1], 118), 'sky5');
  p.add(circle(S[0], S[1], 86), 'sun');

  // Wolken
  p.tag('wolke');
  const cl = (x, y, w, c1, c2) => {
    const h = w * 0.3;
    p.add(cloud(x, x + w, y, [[x + w * 0.14, y - h * 0.32], [x + w * 0.38, y - h * 0.6], [x + w * 0.64, y - h * 0.62], [x + w * 0.86, y - h * 0.3]], 0.5), c2);
    p.add(cloud(x + w * 0.05, x + w * 0.93, y - h * 0.36, [[x + w * 0.18, y - h * 0.74], [x + w * 0.4, y - h * 1.2], [x + w * 0.64, y - h * 1.22], [x + w * 0.84, y - h * 0.7]]), c1);
  };
  cl(60, 120, 220, 'sky3', 'sky2');
  cl(300, 300, 190, 'sky5', 'sky4');
  cl(40, 400, 170, 'sky5', 'sky2');

  // Möwen
  p.tag('möwe');
  const gull = (x, y, s, flip = 1) => {
    const pts = [[-40, 0], [-22, -14], [-4, -6], [0, 2], [4, -6], [22, -14], [40, 0], [22, -6], [0, 10], [-22, -6]].map(([u, v]) => [x + u * s * flip, y + v * s]);
    pts[0].push(1);
    pts[6].push(1);
    p.add(smooth(pts), 'white');
  };
  gull(470, 120, 1.25);
  gull(600, 92, 0.95);
  gull(180, 260, 0.9);

  // Meer
  p.tag('meer');
  p.add(rect(-10, H0, 1020, 430), 'sea3');
  const seaBand = (y, amp, wl, ph, col) => p.add(band(wavePts(-10, 1010, y, amp, wl, ph), 1010), col);
  seaBand(640, 6, 260, 0.5, 'sea2');
  seaBand(720, 8, 300, 2.0, 'sea1');
  seaBand(820, 10, 340, 1.0, 'sea2');
  seaBand(910, 12, 360, 3.0, 'sea1');
  // Sonnenglitzern
  p.tag('glitzer');
  for (const [x, y, w] of [[300, 604, 150], [290, 628, 110], [312, 660, 140], [296, 690, 90], [305, 740, 120], [290, 785, 70]]) {
    p.add(roundPoly([[x - w / 2, y - 7], [x + w / 2, y - 7], [x + w / 2, y + 7], [x - w / 2, y + 7]], 7), 'sky5');
  }
  // Schaumkronen
  p.tag('schaum');
  const foam = (x, y, w) => {
    const top = wavePts(x, x + w, y, 4, w / 2, 0);
    const bot = wavePts(x + 10, x + w - 10, y + 12, 3, w / 2, 1);
    p.add(between(top, bot), 'white');
  };
  foam(40, 870, 160);
  foam(300, 905, 130);
  foam(70, 965, 120);
  foam(330, 680, 110);
  foam(20, 640, 90);

  // Segelboot
  p.tag('boot');
  const bx = 150, by = 760;
  p.add(poly([[bx - 4, by - 190], [bx - 4, by - 8], [bx - 96, by - 8]]), 'white');
  p.add(poly([[bx + 6, by - 168], [bx + 6, by - 8], [bx + 70, by - 8]]), 'shade');
  p.add(roundPoly([[bx - 4, by - 200], [bx + 6, by - 200], [bx + 6, by], [bx - 4, by]], 2), 'dark');
  p.add(smooth([[bx - 110, by - 4, 1], [bx + 92, by - 4, 1], [bx + 66, by + 30], [bx - 84, by + 30]]), 'red');
  p.add(smooth([[bx - 104, by + 8, 1], [bx + 86, by + 8, 1], [bx + 66, by + 30], [bx - 84, by + 30]]), 'redDark');

  // Klippen
  p.tag('fels');
  p.add(smooth([[470, 1010, 1], [500, 900], [540, 790], [590, 700], [660, 640], [760, 610], [880, 600], [1010, 590, 1], [1010, 1010, 1]]), 'rock');
  p.add(smooth([[560, 1010, 1], [600, 930], [660, 870], [720, 800], [800, 760], [900, 740], [1010, 735, 1], [1010, 1010, 1]]), 'rockDark');
  p.add(smooth([[530, 860, 1], [580, 790], [640, 740], [700, 760], [650, 830], [600, 880]]), 'rockDark');
  p.add(smooth([[760, 860], [840, 820], [930, 830], [960, 900], [880, 940], [790, 920]]), 'rock');
  p.add(smooth([[640, 1010, 1], [690, 960], [760, 930], [820, 960], [860, 1010, 1]]), 'rock');
  p.add(smooth([[880, 980], [930, 960], [990, 970], [1010, 1010, 1], [900, 1010, 1]]), 'rock');
  p.add(smooth([[700, 690], [780, 670], [860, 690], [800, 720], [730, 720]]), 'rockDark');
  p.add(smooth([[880, 690], [960, 676], [1010, 680, 1], [1010, 712, 1], [930, 714]]), 'rockDark');
  // Wellen an den Klippen
  p.tag('schaum');
  p.add(smooth([[430, 1010, 1], [455, 975], [490, 960], [520, 980], [548, 965], [575, 990], [600, 1010, 1]]), 'white');
  // Wiese oben
  p.tag('wiese');
  p.add(smooth([[575, 720, 1], [610, 670], [680, 628], [780, 600], [900, 592], [1010, 588, 1], [1010, 640, 1], [920, 650], [820, 662], [720, 690], [640, 720]]), 'grass');
  p.add(smooth([[600, 700, 1], [660, 662], [760, 640], [880, 632], [1010, 630, 1], [1010, 650, 1], [920, 662], [820, 676], [720, 702], [640, 728]]), 'grassDark');

  // Häuschen
  p.tag('haus');
  p.add(rect(860, 520, 120, 90), 'white');
  p.add(poly([[970, 520], [990, 520], [990, 610], [970, 610]]), 'shade');
  p.add(poly([[846, 524], [920, 462], [1004, 524]]), 'red');
  p.add(roundPoly([[880, 548], [912, 548], [912, 584], [880, 584]], 4), 'dark');
  p.add(roundPoly([[930, 560], [956, 560], [956, 610], [930, 610]], 4), 'redDark');

  // Leuchtturm
  p.tag('turm');
  const base = 640;
  const top = 300;
  const bw = 66;
  const tw = 44;
  const cx = 720;
  const xl = (y) => cx - lerp(bw, tw, (base - y) / (base - top));
  const xr = (y) => cx + lerp(bw, tw, (base - y) / (base - top));
  const cuts = [base, 572, 504, 436, 368, top];
  for (let i = 0; i < cuts.length - 1; i++) {
    const y0 = cuts[i];
    const y1 = cuts[i + 1];
    const lit = i % 2 ? 'white' : 'red';
    const dk = i % 2 ? 'shade' : 'redDark';
    const xm0 = cx + (xr(y0) - cx) * 0.35;
    const xm1 = cx + (xr(y1) - cx) * 0.35;
    p.add(poly([[xl(y0), y0], [xm0, y0], [xm1, y1], [xl(y1), y1]]), lit);
    p.add(poly([[xm0, y0], [xr(y0), y0], [xr(y1), y1], [xm1, y1]]), dk);
  }
  // Tür und Fenster
  p.add(smooth([[cx - 18, base, 1], [cx - 18, base - 44], [cx, base - 62], [cx + 18, base - 44], [cx + 18, base, 1]]), 'dark');
  p.add(smooth([[cx - 12, 470, 1], [cx - 12, 446], [cx, 434], [cx + 12, 446], [cx + 12, 470, 1]]), 'dark');
  p.add(smooth([[cx - 11, 372, 1], [cx - 11, 350], [cx, 339], [cx + 11, 350], [cx + 11, 372, 1]]), 'dark');
  // Galerie mit Geländer
  p.add(roundPoly([[cx - 74, top], [cx + 74, top], [cx + 66, top + 18], [cx - 66, top + 18]], 4), 'dark');
  p.add(rect(cx - 64, top - 40, 128, 40), 'shade');
  for (let i = 0; i < 4; i++) p.add(rect(cx - 52 + i * 28, top - 30, 20, 30), 'sky3');
  p.add(rect(cx - 70, top - 52, 140, 14), 'redDark');
  // Laterne
  p.add(rect(cx - 40, top - 120, 80, 70), 'dark');
  p.add(rect(cx - 30, top - 110, 24, 54), 'sun');
  p.add(rect(cx + 6, top - 110, 24, 54), 'sun');
  // Kuppel
  p.add(smooth([[cx - 52, top - 118, 1], [cx - 40, top - 150], [cx, top - 170], [cx + 40, top - 150], [cx + 52, top - 118, 1]]), 'red');
  p.add(circle(cx, top - 176, 12), 'dark');
  // Lichtstrahlen (bleiben innerhalb des oberen Himmels)
  p.tag('licht');
  p.add(smooth([[cx - 44, top - 102, 1], [cx - 190, top - 140], [cx - 208, top - 108], [cx - 192, top - 76], [cx - 44, top - 70, 1]]), 'sky5');
  p.add(smooth([[cx + 44, top - 102, 1], [cx + 190, top - 140], [cx + 208, top - 108], [cx + 192, top - 76], [cx + 44, top - 70, 1]]), 'sky5');

  return p;
}
