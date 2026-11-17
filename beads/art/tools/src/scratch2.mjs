import { Grid, sym, obj, background } from '../raster.mjs';
const P = (rows, odd) => Grid.parse(sym(rows, odd));
export default [
  {
    id: 'panda', title: 'Panda', category: 'Tiere',
    palette: { k: '#2a2a33', w: '#ffffff', c: '#dde2ec', p: '#ffa3b8', g: '#7ccf5a', G: '#3f9a40', B: '#eaf6dc' },
    build() {
      const g = P([
        'gBBBBBBBBBB',
        'gBBkkkBBBBB',
        'GBkkkkkBBBB',
        'gBkkkkkkkkk',
        'gBkkkkwwwww',
        'ggBkkwwwwww',
        'gBBkwwwwwww',
        'gBkwwwwwwww',
        'GBkwwwwwkkw',
        'gBkwwwwkkkk',
        'gBkwwwkkwkk',
        'gBkwwwkkkkw',
        'gBkwwwwkkww',
        'gBkwpwwwwwk',
        'gBBkwwwwkwk',
        'gBBBkkkkkkk',
        'GBBkkkkwwww',
        'gBkkkkkwwww',
        'gBkkkkwwwww',
        'gBkkkkwwwww',
        'GBkkkkwwwww',
        'gBkkkkkwwww',
      ]);
      g.rimShade('w', { lo: 'c', region: 'wpc', lx: -1, ly: 0, loDepth: 2 });
      g.set(14, 10, 'w'); g.set(16, 13, 'p');
      return g;
    },
  },
  {
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
  },
  {
    id: 'schneemann', title: 'Schneemann', category: 'Jahreszeiten',
    palette: { k: '#2a3550', w: '#ffffff', c: '#d3e2f4', o: '#ff8a3d', r: '#e8433f', g: '#4cbf6a', n: '#8b5a3c', p: '#ffa3b8', B: '#b9dcfb' },
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
  },
  {
    id: 'eule', title: 'Eule', category: 'Tiere',
    palette: { k: '#1c1830', o: '#d98e4f', O: '#a8622e', l: '#f6deb0', w: '#ffffff', y: '#ffd95e', n: '#6b4a2e', g: '#6cc05a', B: '#3a4a8c' },
    build() {
      const g = P([
        'BBBBBBBBBBBB',
        'BBkBBBBBBBBB',
        'BBkkBBBBBBBB',
        'BBkokBBBBBBB',
        'BBkookkkkkkk',
        'BBBkoooooooo',
        'BBBkooOOOOoo',
        'BBBkoOwwwwOo',
        'BBBkoOwkwwOo',
        'BBBkoOwkkwOy',
        'BBBkoOwwwwOy',
        'BBBkooOOOOoO',
        'BBBkOooooooo',
        'BBkOOooollll',
        'BBkOOolOllOl',
        'BBkOOollllll',
        'BBkOOollOlll',
        'BBBkOOolllll',
        'BBBkOOoollll',
        'BBBBkkkyykkk',
        'nnnnnnnnnnnn',
        'nnnnnnnnnnnn',
        'BBgnnBBBBBBB',
        'BBggBBBBBBBB',
      ]);
      g.set(8, 8, 'k'); g.set(7, 8, 'w');
      g.stamp(17, 1, ['.yyy.', 'yyy..', 'yy...', 'yyy..', '.yyy.']);
      for (const [x, y] of [[2, 1], [7, 2], [12, 1], [1, 8], [22, 9], [0, 14], [23, 15], [14, 3]]) g.set(x, y, 'y', { on: 'B' });
      return g;
    },
  },
  {
    id: 'fuchs', title: 'Fuchs', category: 'Tiere',
    palette: { k: '#3a2420', o: '#ff8a3d', O: '#d9612a', n: '#5a3326', w: '#ffffff', p: '#ffa3b8', B: '#dcefff', G: '#bfe6a0' },
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
  },
];
