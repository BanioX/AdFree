// Stufe 3 (Level 19–30): grössere Bilder mit Hintergrund, 20–28 Perlen, 6–10 Farben.
import { Grid, sym, obj, background, rles } from '../raster.mjs';
const P = (rows, odd) => Grid.parse(sym(rows, odd));
const H = (specs, half, odd) => Grid.parse(sym(rles(specs, half), odd));

export default [
  {
    id: 'kaffeetasse', title: 'Kaffeetasse', category: 'Essen',
    palette: { k: '#4a2f2a', w: '#ffffff', c: '#b8c4d6', n: '#7a4a2e', l: '#f0cf9c', r: '#f2385a', B: '#c9ebe4', T: '#d4925f' },
    rows: [
      'BBBBBBBwBBwBBBBBBBBB',
      'BBBBBBwBBwBBBBBBBBBB',
      'BBBBBBwBBwBBBBBBBBBB',
      'BBBBBBBwBBwBBBBBBBBB',
      'BBBBBBBBwBBwBBBBBBBB',
      'BBBBkkkkkkkkkBBBBBBB',
      'BBBkwnnlnlnnwkBBBBBB',
      'BBkwwnnnlnnnwwkBBBBB',
      'BBkwwwwwwwwwwwkkkBBB',
      'BBkwwwrrwrrwwckwwkBB',
      'BBkwwrrrrrrrwckkBwkB',
      'BBkwwwrrrrrwwckkBwkB',
      'BBkwwwwrrrwwwckwwkBB',
      'BBkwwwwwrwwwwckkkBBB',
      'BBBkwwwwwwwwckBBBBBB',
      'BBkkkkkkkkkkkkkBBBBB',
      'BkwwwwwwwwwwwwwkTTTT',
      'kcccccccccccccccckTT',
      'TkkkkkkkkkkkkkkkTTTT',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
  },  {
    id: 'cupcake', title: 'Cupcake', category: 'Essen',
    palette: { k: '#5a2a3a', r: '#e5233f', f: '#ff8fc0', F: '#e0609a', l: '#ffd0e6', u: '#ffd23f', U: '#f2a42a', b: '#4aa8ff', w: '#ffffff', B: '#d4f3e4' },
    build() {
      const g = new Grid(20, 22);
      obj(g, (l) => l.poly([[2.6, 13.4], [17.4, 13.4], [15.4, 21.4], [4.6, 21.4]], 'u'));
      g.paint((px, py, x) => Math.floor(x / 2) % 2 === 1, 'U', { on: 'u' });
      const tiers = [[10, 12.6, 8.6, 2.2], [10, 10.0, 7.0, 2.1], [10, 7.6, 5.3, 1.9], [10, 5.6, 3.2, 1.4]];
      for (const [cx, cy, rx, ry] of tiers) {
        obj(g, (l) => l.ellipse(cx, cy, rx, ry, 'f'), 'F');
        g.paint((px, py) => ((px - cx) / rx) * 0.8 + (py - cy) / ry < -0.95 && ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1, 'l', { on: 'f' });
      }
      g.innerOutline('k', { of: 'F', against: '.' });
      g.outline('k', { of: 'fl' });
      obj(g, (l) => l.circle(10.5, 2.6, 1.9, 'r'));
      g.set(9, 2, 'w');
      g.set(11, 0, 'k'); g.set(12, 0, 'k');
      for (const [x, y, c] of [[7, 7, 'b'], [12, 6, 'u'], [10, 9, 'w'], [5, 10, 'u'], [14, 9, 'b'], [8, 12, 'b'], [12, 12, 'u'], [16, 12, 'w'], [3, 12, 'w']]) g.set(x, y, c);
      background(g, (x, y) => ((x % 4 === 1 && y % 4 === 1) || (x % 4 === 3 && y % 4 === 3) ? 'w' : 'B'));
      return g;
    },
  },  {
    id: 'pinguin', title: 'Pinguin', category: 'Tiere',
    palette: { k: '#1e2638', n: '#405a8c', w: '#ffffff', o: '#ffa53a', r: '#e8433f', R: '#b52f2f', p: '#ff9db5', B: '#cfe8ff' },
    build() {
      const g = new Grid(22, 22);
      obj(g, (l) => { l.ellipse(7.8, 20.3, 2.3, 1.1, 'o'); l.ellipse(14.2, 20.3, 2.3, 1.1, 'o'); });
      obj(g, (l) => { l.poly([[5.5, 11.5], [1.2, 16.8], [2.6, 17.4], [6.5, 15]], 'n'); l.poly([[16.5, 11.5], [20.8, 16.8], [19.4, 17.4], [15.5, 15]], 'n'); });
      obj(g, (l) => l.ellipse(11, 11.9, 7, 8.2, 'n'));
      g.ellipse(11, 15.4, 4.7, 4.4, 'w', { on: 'n' });
      g.circle(8.7, 8.3, 2.5, 'w', { on: 'n' });
      g.circle(13.3, 8.3, 2.5, 'w', { on: 'n' });
      g.paint((px, py, x, y) => y === 11, 'r', { on: 'nw' });
      g.paint((px, py, x, y) => y === 12, 'R', { on: 'nw' });
      g.stamp(14, 13, ['rR', 'rR', 'kk']);
      for (const [x, y, c] of [[8, 8, 'k'], [8, 9, 'k'], [13, 8, 'k'], [13, 9, 'k'], [10, 10, 'o'], [11, 10, 'o'], [7, 10, 'p'], [14, 10, 'p']]) g.set(x, y, c);
      background(g, (x, y) => (y >= 20 || (y === 19 && (x < 4 || x > 17)) ? 'w' : 'B'));
      for (const [x, y] of [[2, 2], [18, 1], [15, 4], [4, 7], [19, 9], [1, 12], [6, 1]]) g.set(x, y, 'w', { on: 'B' });
      return g;
    },
  },  {
    id: 'tannenbaum', title: 'Tannenbaum', category: 'Jahreszeiten',
    palette: { k: '#1f3a2e', g: '#3fae4f', G: '#2a8040', y: '#ffd23f', r: '#ff4d5e', b: '#4aa8ff', n: '#8b5a3c', B: '#d7ecff', w: '#ffffff' },
    build() {
      const g = P([
        'BBBBBBBBBBk',
        'BBBBBBBBBky',
        'BBBBBBkkkyy',
        'BBBBBBBkyyy',
        'BBBBBBkyykk',
        'BBBBBBBBBkg',
        'BBBBBBBBkgg',
        'BBBBBBBkggg',
        'BBBBBBkgggg',
        'BBBBBkkkggg',
        'BBBBBBkgggg',
        'BBBBBkggggg',
        'BBBBkgggggg',
        'BBBkggggggg',
        'BBkkkgggggg',
        'BBBBkgggggg',
        'BBBkggggggg',
        'BBkgggggggg',
        'Bkggggggggg',
        'Bkkkkkkkkkk',
        'BBBBBBBBknn',
        'wwwwwwwwknn',
        'wwwwwwwwknn',
        'wwwwwwwwwnn',
      ]);
      g.paint((px, py, x) => x >= 11, 'G', { on: 'g' });
      g.stamp(1, 20, ['kkkkk', 'kryrk', 'kyyyk', 'kryrk']);
      g.stamp(16, 20, ['kkkkk', 'kbybk', 'kyyyk', 'kbybk']);
      for (const [x, y, c] of [[10, 7, 'r'], [12, 9, 'b'], [8, 11, 'y'], [13, 12, 'r'], [6, 14, 'b'], [15, 13, 'y'], [10, 16, 'y'], [14, 17, 'b'], [4, 18, 'r'], [17, 18, 'r'], [8, 18, 'b'], [11, 13, 'b'], [7, 16, 'r']]) g.set(x, y, c);
      for (const [x, y] of [[2, 2], [19, 3], [4, 7], [17, 6], [1, 12], [20, 11], [2, 16], [19, 16]]) g.set(x, y, 'w', { on: 'B' });
      return g;
    },
  },  {
    id: 'schneemann', title: 'Schneemann', category: 'Jahreszeiten',
    palette: { k: '#2a3550', w: '#ffffff', c: '#d3e2f4', o: '#ff8a3d', r: '#e8433f', g: '#4cbf6a', n: '#8b5a3c', p: '#ffa3b8', B: '#93c8f5' },
    build() {
      const g = P([
        'BBBBBBBBBBkk',
        'BBBBBBBBBkww',
        'BBBBBBBkkkkk',
        'BBBBBBBkrrrr',
        'BBBBBBkrrrrr',
        'BBBBBkgggggg',
        'BBBBBBkwwwww',
        'BBBBBkwwwwww',
        'BBBBBkwwkwww',
        'BBBBBkwwkwww',
        'BBBBBkwpwwwo',
        'BBBBBkwwwkww',
        'BBBBBBkwwwkk',
        'BBBBBBBkwwww',
        'BBBBBBkggggg',
        'BBBBBBkggggg',
        'BBBBBkkwwwww',
        'BBBBkwwwwwww',
        'BBBkwwwwwwwk',
        'BBBkwwwwwwww',
        'BBkwwwwwwwww',
        'BBkwwwwwwwwk',
        'BBBkwwwwwwww',
        'BBBBkkkkkkkk',
      ], true);
      g.set(12, 10, 'o'); g.set(13, 10, 'o');
      g.paint((px, py, x, y) => (y >= 6 && y <= 13 && x >= 14) || (y >= 16 && x >= 15), 'c', { on: 'w' });
      g.set(15, 10, 'p');
      g.stamp(14, 15, ['kggk', 'kggk', 'kggk', '.kk.']);
      for (const [x, y] of [[3, 17], [2, 16], [1, 15], [0, 14], [1, 14], [19, 17], [20, 16], [21, 15], [22, 14], [21, 14]]) g.set(x, y, 'n');
      background(g, (x, y) => (y >= 21 ? 'w' : 'B'));
      g.paint((px, py, x, y) => y >= 21, 'c', { on: 'w', not: '' });
      g.paint((px, py, x, y) => y >= 21 && (x < 2 || x > 20 || y === 21), 'w', { on: 'c' });
      for (const [x, y] of [[2, 2], [20, 1], [4, 7], [19, 6], [16, 3], [2, 11], [21, 11], [6, 0]]) g.set(x, y, 'w', { on: 'B' });
      return g;
    },
  },  {
    id: 'fuchs', title: 'Fuchs', category: 'Tiere',
    palette: { k: '#3a2420', o: '#ff8a3d', O: '#d9612a', n: '#7d4630', w: '#ffffff', p: '#ffa3b8', B: '#c4e2fb' },
    build() {
      const g = P([
        'BBBBBBBBBBBB',
        'BBkkBBBBBBBB',
        'BkOnkBBBBBBB',
        'BkOnnkBBBBBB',
        'BkOnnokkkkkk',
        'BkOoooooooooo'.slice(0, 12),
        'Bkoooooooooo',
        'Bkoooooooooo',
        'Bkooooookooo',
        'kwwooooOkooo',
        'Bkwwwwwooooo',
        'BBkwwwwwwwok',
        'BBBkwwwwwwww',
        'BBBBkkwwwwww',
        'BBBBBkoowwww',
        'BBBBkoooowww',
        'BBBBkoooowww',
        'BBBkooooowww',
        'BBBkooooowww',
        'BBBkoooookww',
        'BBBkoooknnkw',
        'BBBkoooknnkw',
        'BBBBkkkkkkkk',
        'BBBBBBBBBBBB',
      ]);
      g.set(7, 8, 'k'); g.set(16, 8, 'k'); g.set(6, 8, 'o');
      g.set(5, 11, 'p'); g.set(18, 11, 'p');
      // Schwanz rechts
      g.stamp(17, 12, [
        '...kkk.',
        '..kooOk',
        '.koooOk',
        'kooooOk',
        'koooOOk',
        'koooOk.',
        'kwwwk..',
        'kwwk...',
        'kkk....',
      ]);
      background(g, (x, y) => (y >= 18 ? 'G' : 'B'));
      return g;
    },
  },  {
    id: 'leuchtturm', title: 'Leuchtturm', category: 'Dinge',
    palette: { k: '#2a2430', r: '#e8433f', w: '#ffffff', y: '#ffd23f', Y: '#fff3b0', B: '#bfe3ff', g: '#7cc96a', n: '#9a8270', b: '#3f8ef0' },
    build() {
      const g = H([
        'B12 k', 'B11 k r', 'Y2 B8 k r2', 'Y4 B5 k4', 'Y9 k y3', 'Y9 k y3', 'Y4 B4 k5', 'Y2 B8 k w2',
        'B10 k w2', 'B10 k r2', 'B9 k r3', 'B9 k r3', 'B9 k w3', 'B9 k w3', 'B8 k w4', 'B8 k r4',
        'B8 k r4', 'B7 k r5', 'B7 k w3 n2', 'B7 k w3 n2', 'B2 k g10', 'B k n11', 'b2 k n10', 'b13', 'b13', 'b13',
      ], 13);
      g.paint((px, py, x, y) => y >= 21 && (x + y * 3) % 7 === 0, 'w', { on: 'b' });
      g.paint((px, py, x, y) => y === 23 && x % 4 !== 0, 'w', { on: 'b' });
      return g;
    },
  },];
