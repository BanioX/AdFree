// Stufe 2 (Level 7–18): mittel, 12–20 Perlen, 4–8 Farben.
import { Grid, sym, obj } from '../raster.mjs';

export default [
  {
    id: 'marienkaefer', title: 'Marienkäfer', category: 'Tiere',
    palette: { k: '#2b2238', r: '#ec3b3b', h: '#ff9a8f', w: '#ffffff' },
    rows: [
      '...k.....k...',
      '....k...k....',
      '....kkkkk....',
      '...kkwkwkk...',
      '..kkkkkkkkk..',
      '.khrrrkrrrrk.',
      'khrkkrkrkkrrk',
      'krrkkrkrkkrrk',
      'krrrrrkrrrrrk',
      'krkkrrkrrkkrk',
      '.krkrrkrrkrk.',
      '..krrrkrrrk..',
      '...kkkkkkk...',
    ],
  },
  {
    id: 'eis', title: 'Eis am Stiel', category: 'Essen',
    palette: { k: '#4a2a22', c: '#7b4327', p: '#ff8fb1', P: '#ffc8d8', y: '#ffd84d', b: '#58b8ff', w: '#ffffff', t: '#e9b97a' },
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
      for (const [x, y, c] of [[3, 2, 'y'], [7, 1, 'b'], [5, 3, 'w'], [9, 3, 'y'], [2, 4, 'b'], [8, 4, 'w'], [4, 1, 'w']]) g.set(x, y, c);
      // Glanz
      for (let y = 8; y <= 11; y++) g.set(1, y, 'P');
      g.set(2, 9, 'P');
      return g;
    },
  },
  {
    id: 'tulpe', title: 'Tulpe', category: 'Natur',
    palette: { k: '#4a1f3a', R: '#c8285a', r: '#f2507a', l: '#ffa3bf', g: '#62c45a', G: '#2f8f4a' },
    rows: [
      '..k...k...k..',
      '.kRk.klk.krk.',
      '.kRRkllrkrrk.',
      '.kRRRllrrrrk.',
      '.kRRRlrrrrrk.',
      '.kRRRrrrrrrk.',
      '..kRRrrrrrk..',
      '...kkkkkkk...',
      '......G......',
      '.k....G....k.',
      '.kgk..G..kgk.',
      '..kgk.G.kgk..',
      '..kggkGkggk..',
      '...kggGggk...',
      '....kgGgk....',
      '.....kGk.....',
      '......k......',
    ],
  },
  {
    id: 'fisch', title: 'Fisch', category: 'Tiere',
    palette: { k: '#24385e', y: '#ffcf3f', l: '#fff2a8', o: '#ff8a3d', w: '#ffffff', b: '#8fd8ff' },
    build() {
      const g = new Grid(16, 12);
      obj(g, (l) => l.poly([[10.5, 6], [15.6, 1.2], [14.2, 6], [15.6, 10.8]], 'o'));
      obj(g, (l) => l.poly([[5, 1.6], [8.5, 0.2], [10, 2.4]], 'o'));
      obj(g, (l) => l.ellipse(6.6, 6.2, 6.1, 4.5, 'y'));
      g.set(3, 4, 'w'); g.set(3, 5, 'k'); g.set(4, 4, 'k'); g.set(4, 5, 'k');
      return g;
    },
  },
];
