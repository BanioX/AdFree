// Stufe 2 (Level 7–18): mittel, 12–20 Perlen, 4–8 Farben.
import { Grid, sym, obj } from '../raster.mjs';

export default [
  {
    id: 'marienkaefer', title: 'Marienkäfer', category: 'Tiere',
    palette: { k: '#2b2238', r: '#ec3b3b', h: '#ff9a8f', w: '#ffffff' },
    build() {
      const g = Grid.parse(sym([
        '...k...',
        '....k..',
        '....kkk',
        '...kwkk',
        '..krrrk',
        '.krrrrk',
        'krkkrrk',
        'krkkrrk',
        'krrrrrk',
        'krrrrkk',
        '.krkrrk',
        '..krrrk',
        '...kkkk',
      ], true));
      g.set(3, 4, 'h'); g.set(2, 5, 'h'); g.set(1, 6, 'h');
      return g;
    },
  },
  {
    id: 'eis', title: 'Eis am Stiel', category: 'Essen',
    palette: { k: '#3d2420', c: '#9a5631', C: '#c98552', p: '#ff8fb1', P: '#ffc8d8', y: '#ffd84d', b: '#58b8ff', t: '#e9b97a' },
    build() {
      const g = Grid.parse(sym([
        '..kkkk',
        '.kcccc',
        'kccccc',
        'kccccc',
        'kccccc',
        'kppppp',
        'kppppp',
        'kppppp',
        'kppppp',
        'kppppp',
        'kppppp',
        'kppppp',
        '.kkkkk',
        '....kt',
        '....kt',
        '....kt',
        '.....k',
      ]));
      // Schokoladen-Tropfen
      for (const [x, y] of [[1, 5], [2, 5], [2, 6], [5, 5], [6, 5], [6, 6], [6, 7], [9, 5], [10, 5], [9, 6]]) g.set(x, y, 'c');
      // Streusel
      for (const [x, y, c] of [[3, 2, 'y'], [7, 1, 'b'], [5, 3, 'P'], [9, 3, 'y'], [2, 4, 'b'], [8, 4, 'P'], [6, 2, 'y'], [1, 2, 'C'], [1, 3, 'C'], [2, 1, 'C']]) g.set(x, y, c);
      // Glanz
      for (let y = 8; y <= 11; y++) g.set(1, y, 'P');
      g.set(2, 9, 'P');
      // Biss oben rechts
      g.paint((px, py) => Math.hypot(px - 11.3, py - 0.9) < 2.3, '.');
      g.innerOutline('k', { of: 'cCpPybt', against: '.', edge: false });
      return g;
    },
  },
  {
    id: 'wassermelone', title: 'Wassermelone', category: 'Essen',
    palette: { k: '#263826', r: '#f2445a', w: '#eaf7d6', g: '#7fd36a', G: '#2f8a4a', p: '#ff8a9a' },
    build() {
      const g = new Grid(19, 10);
      const cx = 9.5, cy = 0.5;
      const d = (x, y) => Math.hypot(x - cx, y - cy);
      g.paint((x, y) => d(x, y) <= 9.6, 'k');
      g.paint((x, y) => d(x, y) <= 8.7, 'G');
      g.paint((x, y) => d(x, y) <= 7.8, 'g');
      g.paint((x, y) => d(x, y) <= 6.9, 'w');
      g.paint((x, y) => d(x, y) <= 6.0, 'r');
      g.paint((x, y) => y < 1, 'p', { on: 'r' });
      for (const [x, y] of [[6, 2], [9, 3], [12, 2], [7, 5], [11, 5], [9, 6]]) g.set(x, y, 'k');
      return g;
    },
  },
  {
    id: 'tulpe', title: 'Tulpe', category: 'Natur',
    palette: { k: '#4a1f3a', R: '#c8285a', r: '#f2507a', l: '#ffa3bf', g: '#62c45a', G: '#2f8f4a' },
    rows: [
      '...k..k..k...',
      '..kRkklkkRk..',
      '.kRRRklkRRRk.',
      '.kRRRrlrRRRk.',
      '.kRRrrlrrRRk.',
      '.kRRrrrrrRRk.',
      '..kRrrrrrRk..',
      '...kkrrrkk...',
      '.....kkk.....',
      '.k....G......',
      'kgk...G......',
      'kggk..G...kk.',
      '.kggk.G..kggk',
      '.kgggkG.kggk.',
      '..kgggGkggk..',
      '...kggGggk...',
      '....kkkkk....',
    ],
  },
  {
    id: 'fisch', title: 'Fisch', category: 'Tiere',
    palette: { k: '#24385e', y: '#ffcf3f', l: '#fff2a8', o: '#ff8a3d', w: '#ffffff' },
    rows: [
      '.....kkkk........',
      '....kooook.....kk',
      '..kkkoooookk..kok',
      '.kyyyyyyyyyk.kook',
      'kllywkyyoyyykoook',
      'klyykkyyoyyyykok.',
      'kyyyyyyyoyyyyook.',
      'kkyyyyyyoyyyykok.',
      'kyyyyyyyoyyykoook',
      '.kyyyyyyoyyykkook',
      '..kyyyyyoyykk.kok',
      '...kkooookk....kk',
      '.....kkkk........',
    ],
  },
  {
    id: 'liebesbrief', title: 'Liebesbrief', category: 'Liebe',
    palette: { k: '#6a2f4a', e: '#ffdce8', f: '#ffa8c2', h: '#f2385a', w: '#ffffff' },
    build() {
      const g = new Grid(16, 15);
      g.stamp(2, 0, ['.k.k.', 'khkhk', 'khhhk', '.khk.', '..k..']);
      g.stamp(10, 1, ['.k.k.', 'kfkfk', '.kfk.', '..k..']);
      obj(g, (l) => l.rect(1, 6, 14, 8, 'e'));
      g.line(1, 6, 7, 10, 'f'); g.line(14, 6, 8, 10, 'f');
      g.line(1, 13, 5, 10, 'f'); g.line(14, 13, 10, 10, 'f');
      g.stamp(5, 8, ['.hh.hh.', 'hwhhhhh', 'hhhhhhh', '.hhhhh.', '..hhh..', '...h...']);
      return g;
    },
  },
  {
    id: 'biene', title: 'Biene', category: 'Tiere',
    palette: { k: '#3a2a1a', y: '#ffd23f', Y: '#f2a42a', w: '#eaf6ff', W: '#9ccfee', p: '#ff9db5' },
    build() {
      const g = Grid.parse(sym([
        '.....k...',
        '.WWW..k..',
        'WwwwW.kkk',
        'Wwwwwkyyy',
        'Wwwwkyyyy',
        '.WWkyykyy',
        '..kyyykyy',
        '.kyypyyky',
        '.kyyyyyyk',
        '.kkkkkkkk',
        '.kyyyyyyy',
        '..kkkkkkk',
        '..kyyyyyy',
        '...kkkkkk',
        '........k',
      ], true));
      for (const [x, y] of [[13, 8], [14, 8], [12, 10], [13, 10], [14, 10], [11, 12], [12, 12], [13, 12]]) g.set(x, y, 'Y');
      return g;
    },
  },
  {
    id: 'schmetterling', title: 'Schmetterling', category: 'Tiere',
    palette: { k: '#3b2a4a', v: '#8f6cf0', p: '#ff7ab0', y: '#ffd84d', w: '#ffffff' },
    rows: [
      '.kkk..k...k..kkk.',
      'kvvvkk.k.k.kkvvvk',
      'kvpppvvkkkvvpppvk',
      'kvpyyppvkvppyypvk',
      'kvpyyppvkvppyypvk',
      'kvpppppvkvpppppvk',
      '.kvpwppvkvppwpvk.',
      '.kvvvvvvkvvvvvvk.',
      '..kkkkkvkvkkkkk..',
      '.kvvvpvvkvvpvvvk.',
      'kvppppvvkvvppppvk',
      'kvpyppvkkkvppypvk',
      '.kvppvvkkkvvppvk.',
      '..kvvvk...kvvvk..',
      '...kkk.....kkk...',
    ],
  },
  {
    id: 'katze', title: 'Katze', category: 'Tiere',
    palette: { k: '#4a2f2a', o: '#ffa64d', O: '#e07a2a', c: '#ffe2bd', p: '#ff9db5', w: '#ffffff' },
    rows: [
      '..kk.........kk..',
      '.kpok.......kopk.',
      '.kppokkkkkkkoppk.',
      '.kpoooOoOoOooopk.',
      '.koooooOoOoooook.',
      '.koooooooooooook.',
      'koooooooooooooook',
      'kooowkooooowkoook',
      'koookkoooookkoook',
      'koppocccpcccoppok',
      'kooooccckcccooook',
      '.koooockckcoooo k.'.replace(' ', ''),
      '..koooocccooook..',
      '...koooooooook...',
      '....kkkkkkkkk....',
    ],
  },
  {
    id: 'regenbogen', title: 'Regenbogen mit Wolke', category: 'Natur',
    palette: { r: '#ff4d5e', o: '#ff9a3c', y: '#ffd84d', g: '#5ccf6a', b: '#4aa8ff', v: '#9a6cf0', w: '#ffffff', c: '#b9c9ea' },
    build() {
      const g = new Grid(20, 13);
      const bands = ['r', 'o', 'y', 'g', 'b', 'v'];
      const cx = 10, cy = 9.5;
      g.paint((px, py) => py <= cy + 0.1, (x, y) => {
        const d = Math.round(Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
        const i = 9 - d;
        return i >= 0 && i < bands.length ? bands[i] : '.';
      });
      const cloud = ['...ccc...', '.cccwwcc.', 'cwwwwwwwc', 'cwwwwwwwc', '.ccccccc.'];
      g.stamp(0, 8, cloud);
      g.stamp(11, 8, cloud.map((r) => [...r].reverse().join('')));
      return g;
    },
  },
  {
    id: 'kaktus', title: 'Kaktus', category: 'Natur',
    palette: { k: '#2c4a32', g: '#6fcf6a', G: '#3fa257', w: '#fff3c4', f: '#ff6fa3', t: '#d8643a', T: '#fbb48c' },
    rows: [
      '.......kk.......',
      '......kffk......',
      '.....kfwwfk.....',
      '.....kkffkk.....',
      '.....kgGgGk..kk.',
      '.kk..kgGwGk.kgGk',
      'kgGk.kwGgGk.kwGk',
      'kgGk.kgGgGk.kgGk',
      'kwGk.kgGgGkkkgGk',
      'kgGk.kgGgwgggggk',
      'kgggggGgGGkkkkk.',
      '.kkkkkgGgGk.....',
      '.....kwGgGk.....',
      '.kkkkkkkkkkkkkk.',
      'kTTTTTTTTTTTTTTk',
      '..kTtttttttttk..',
      '...kttttttttk...',
      '....kkkkkkkk....',
    ],
  },
  {
    id: 'haus', title: 'Haus', category: 'Dinge',
    palette: { k: '#3a2a2a', r: '#e84a3f', R: '#b8322f', w: '#fff1d6', d: '#a0623a', b: '#8fd3ff', g: '#5cbf5a', y: '#ffd84d' },
    rows: [
      '........kk........',
      '.......krrk.kkkk..',
      '......krrrrkkRRk..',
      '.....krrkkrrkRRk..',
      '....krrkbbkrrkRk..',
      '...krrrkbbkrrrkk..',
      '..krrrrrkkrrrrrk..',
      '.krrrrrrrrrrrrrrk.',
      'kRRRRRRRRRRRRRRRRk',
      '.kkkkkkkkkkkkkkkk.',
      '.kwwwwwwddwwwwwwk.',
      '.kwbbbwddddwbbbwk.',
      '.kwbbbwddddwbbbwk.',
      '.kwgygwddydwgygwk.',
      '.kwwwwwddddwwwwwk.',
      '.kwwwwwddddwwwwwk.',
      'gggggggggggggggggg',
      'gygggggggggggggygg',
    ],
  },
];
