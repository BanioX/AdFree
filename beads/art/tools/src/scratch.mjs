import { Grid, sym, obj, background } from '../raster.mjs';
export default [
  {
    id: 'kaffeetasse', title: 'Kaffeetasse', category: 'Essen',
    palette: { k: '#4a2f2a', w: '#ffffff', c: '#d5dde9', n: '#7a4a2e', l: '#f0cf9c', r: '#f2385a', B: '#c9ebe4', T: '#efbd8f' },
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
  },
  {
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
  },
  {
    id: 'ananas', title: 'Ananas', category: 'Essen',
    palette: { k: '#4a3216', y: '#ffd23f', Y: '#fff0a0', o: '#f2a42a', g: '#5cc25a', G: '#2f8f4a', l: '#a8e27c', p: '#ff8fa8', B: '#cdf3f0' },
    build() {
      const g = new Grid(20, 24);
      obj(g, (l) => { l.poly([[1.6, 4.4], [9.4, 7.8], [7.4, 9.4]], 'G'); l.poly([[18.4, 4.4], [10.6, 7.8], [12.6, 9.4]], 'G'); });
      obj(g, (l) => { l.poly([[5.2, 0.8], [10.4, 7.4], [8, 8.8]], 'g'); l.poly([[14.8, 0.8], [9.6, 7.4], [12, 8.8]], 'g'); });
      obj(g, (l) => l.poly([[10, -0.6], [11.7, 8], [8.3, 8]], 'l'));
      obj(g, (l) => l.ellipse(10, 16, 7.2, 7.4, 'y'));
      g.paint((px, py, x, y) => (x + y) % 4 === 0 && x % 2 === 0, 'o', { on: 'y' });
      g.paint((px, py) => (px - 10) / 7.2 + (py - 16) / 7.4 < -0.95, 'Y', { on: 'y' });
      g.paint((px, py) => (px - 10) / 7.2 * 0.9 + (py - 16) / 7.4 * 0.5 > 0.62, 'o', { on: 'yY' });
      for (const [x, y, c] of [[7, 15, 'k'], [7, 16, 'k'], [12, 15, 'k'], [12, 16, 'k'], [6, 17, 'p'], [13, 17, 'p'], [9, 17, 'k'], [10, 17, 'k'], [6, 16, 'y'], [13, 16, 'y'], [8, 16, 'y'], [11, 16, 'y'], [8, 17, 'y'], [11, 17, 'y'], [9, 16, 'y'], [10, 16, 'y'], [9, 15, 'y'], [10, 15, 'y']]) g.set(x, y, c);
      background(g, 'B');
      return g;
    },
  },
  {
    id: 'pinguin', title: 'Pinguin', category: 'Tiere',
    palette: { k: '#1e2638', n: '#34405e', w: '#ffffff', o: '#ffa53a', r: '#e8433f', R: '#b52f2f', p: '#ff9db5', B: '#cfe8ff' },
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
  },
];
