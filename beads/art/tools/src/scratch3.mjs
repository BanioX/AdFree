import { Grid, sym, obj, background, rles } from '../raster.mjs';
const H = (specs, half, odd) => Grid.parse(sym(rles(specs, half), odd));
export default [
  {
    id: 'fuchs', title: 'Fuchs', category: 'Tiere',
    palette: { k: '#3a2420', o: '#ff8a3d', O: '#d9612a', n: '#5a3326', w: '#ffffff', p: '#ffa3b8', B: '#dcefff', G: '#bfe6a0' },
    build() {
      const g = H([
        'B12', 'B2 k2 B8', 'B k O n k B7', 'B k O n2 k B6', 'B k O n3 k B5', 'B k O n3 o k5',
        'B k O2 n o7', 'B k O o9', 'k O o10', 'k o5 w k o4', 'k o5 k2 o4', 'k w2 o9', 'k w4 o7',
        'B k w5 o4 k', 'B2 k w9', 'B3 k w8', 'B4 k2 w6', 'B3 k2 o k w5', 'B2 k o4 w5',
        'B k o5 w5', 'B k o5 w5', 'k o6 w5', 'k o6 w5', 'k o6 w5',
      ], 12);
      g.set(4, 12, 'p'); g.set(19, 12, 'p');
      g.paint((px, py, x, y) => y >= 18, 'G', { on: 'B' });
      return g;
    },
  },
  {
    id: 'rakete', title: 'Rakete', category: 'Dinge',
    palette: { k: '#141a33', w: '#ffffff', c: '#c9d6ea', r: '#ff4d5e', b: '#5ab8ff', o: '#ff9a3c', y: '#ffd84d', p: '#c58cf0', B: '#2a3570' },
    build() {
      const g = H([
        'B12', 'B11 k', 'B10 k r', 'B9 k r2', 'B8 k r3', 'B8 k r3', 'B7 k r4', 'B7 k r4', 'B6 k6',
        'B6 k w5', 'B6 k w3 k2', 'B6 k w2 k b2', 'B6 k w2 k b2', 'B6 k w2 k b2', 'B6 k w3 k2', 'B6 k w5',
        'B5 k2 w5', 'B4 k r k w5', 'B3 k r2 k w5', 'B2 k r3 k w5', 'B k r4 k w5', 'B k r4 k r5', 'B k11',
        'B7 o y4', 'B7 o y4', 'B8 o y3', 'B8 o2 y2', 'B9 o2 y', 'B10 o2',
      ], 12);
      g.paint((px, py, x, y) => x >= 15 && x <= 16, 'c', { on: 'w' });
      g.set(10, 11, 'w');
      g.stamp(1, 2, ['.ppp.', 'ppppp', 'yyyyyyy', 'ppppp', '.ppp.'].map((r, i) => (i === 2 ? r : '.' + r)));
      for (const [x, y, c] of [[20, 2, 'y'], [16, 5, 'w'], [3, 10, 'w'], [21, 9, 'y'], [2, 17, 'y'], [20, 15, 'w'], [4, 23, 'w'], [19, 22, 'y'], [8, 1, 'w'], [22, 25, 'w']]) g.set(x, y, c, { on: 'B' });
      return g;
    },
  },
  {
    id: 'leuchtturm', title: 'Leuchtturm', category: 'Dinge',
    palette: { k: '#2a2430', r: '#e8433f', w: '#ffffff', y: '#ffd23f', Y: '#fff3b0', B: '#bfe3ff', g: '#7cc96a', n: '#9a8270', b: '#3f8ef0', W: '#9fd6ff' },
    build() {
      const g = H([
        'B12 k', 'B11 k r', 'Y2 B8 k r2', 'Y4 B5 k4', 'Y9 k y3', 'Y9 k y3', 'Y4 B4 k5', 'Y2 B8 k w2',
        'B10 k w2', 'B10 k r2', 'B9 k r3', 'B9 k r3', 'B9 k w3', 'B9 k w3', 'B8 k w4', 'B8 k r4',
        'B8 k r4', 'B7 k r5', 'B7 k w3 n2', 'B7 k w3 n2', 'B2 k g10', 'B k n11', 'b2 k n10', 'b13', 'b13', 'b13',
      ], 13);
      g.paint((px, py, x, y) => y >= 21 && (x + y * 3) % 7 === 0, 'W', { on: 'b' });
      g.paint((px, py, x, y) => y === 23 && x % 4 !== 0, 'W', { on: 'b' });
      return g;
    },
  },
  {
    id: 'kuh', title: 'Schweizer Kuh mit Glocke', category: 'Tiere',
    palette: { k: '#3a2a22', w: '#ffffff', n: '#b5562d', p: '#ffb3b0', y: '#ffc93c', Y: '#d99a1c', r: '#e8433f', s: '#cbe7ff', m: '#9fb6d8', g: '#7cc96a' },
    build() {
      const g = H([
        's14', 's14', 's4 k2 s8', 's4 k w k s7', 's5 k w k7', 's6 k2 w3 n3', 's6 k w4 n3',
        's k4 k w8', 'k p3 k2 w8', 'k w p2 k2 w8', 's k5 w2 k2 w4', 's5 k w2 k2 w4', 's5 k w8',
        's5 k w p7', 's4 k w p8', 's4 k p4 k p4', 's4 k p4 k p4', 's4 k p9', 's5 k p8', 's6 k8',
        's3 k w3 r7', 's2 k w8 k3', 's2 k w7 k y3', 's k w8 k y3', 's k w7 k y4', 'k w8 k y4', 'k w7 k Y5', 'k w8 k5',
      ], 14);
      // Augenglanz, Fleck um das linke Auge und am Körper
      g.set(8, 10, 'w'); g.set(9, 10, 'k'); g.set(18, 10, 'w');
      g.paint((px, py) => Math.hypot(px - 9, py - 10.5) < 3.2, 'n', { on: 'w' });
      g.paint((px, py) => Math.hypot(px - 4.5, py - 24.5) < 3, 'n', { on: 'w' });
      g.paint((px, py) => Math.hypot(px - 24, py - 22) < 2.6, 'n', { on: 'w' });
      g.paint((px, py) => Math.hypot(px - 20.5, py - 7.5) < 1.6, 'n', { on: 'w' });
      g.set(12, 23, 'w'); g.set(12, 24, 'w'); g.set(13, 27, 'k'); g.set(14, 27, 'k');
      // Hintergrund: Himmel, Berge mit Schnee, Wiese
      const peak = (x, y, px0, py0) => y >= py0 + Math.abs(x - px0) * 0.9;
      g.paint((px, py, x, y) => y >= 16, 'g', { on: 's' });
      g.paint((px, py, x, y) => peak(px, py, 3.5, 6) || peak(px, py, 24.5, 4) || peak(px, py, 14, 9), 'm', { on: 's' });
      g.paint((px, py, x, y) => (peak(px, py, 3.5, 6) && py < 8.5) || (peak(px, py, 24.5, 4) && py < 6.5), 'w', { on: 'm' });
      return g;
    },
  },
];
