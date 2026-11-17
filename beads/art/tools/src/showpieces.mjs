// Stufe 4 (Level 31–36): Schaustücke, 28–32 Perlen, 8–12 Farben, ganze Szenen.
import { Grid, obj, background } from '../raster.mjs';
import { heart } from './large.mjs';

const hyp = Math.hypot;

const list = [
  {
    id: 'sonnenblume', title: 'Sonnenblume', category: 'Natur',
    palette: { y: '#ffd23f', o: '#f29a1f', n: '#9a6230', N: '#5a3618', g: '#62c25a', G: '#2f7f3a', B: '#bfe3ff', w: '#ffffff' },
    build() {
      const g = new Grid(28, 30);
      const cx = 14, cy = 10.6;
      obj(g, (l) => {
        l.rect(12.6, 18, 2.8, 13, 'G');
        l.poly([[13, 23.4], [9.6, 20.2], [4.4, 19.8], [6.6, 23.2], [10.6, 24.8]], 'g');
        l.poly([[15, 25.6], [18.4, 22.4], [23.6, 22], [21.4, 25.4], [17.4, 27]], 'g');
      }, 'N');
      g.line(12, 23, 7, 21, 'G', { on: 'g' });
      g.line(15, 25, 21, 23, 'G', { on: 'g' });
      obj(g, (l) => {
        l.paint((px, py) => {
          const r = hyp(px - cx, py - cy), a = Math.atan2(py - cy, px - cx);
          return r <= 4.6 + 4.2 * Math.abs(Math.sin(5 * a)) ** 1.2;
        }, 'o');
        l.paint((px, py) => {
          const r = hyp(px - cx, py - cy), a = Math.atan2(py - cy, px - cx);
          return r <= 4.6 + 5.4 * Math.abs(Math.cos(5 * a)) ** 1.2;
        }, 'y');
        l.circle(cx, cy, 4.6, 'N');
        l.circle(cx, cy, 3.7, (x, y) => ((x + y) % 2 ? 'n' : 'N'));
        l.circle(cx - 1.2, cy - 1.2, 1.2, 'n');
      }, 'N');
      background(g, (x, y) => (y >= 28 ? 'g' : 'B'));
      g.paint((px, py, x, y) => y === 27 && x % 3 === 1, 'g', { on: 'B' });
      g.paint((px, py, x, y) => y === 29 && x % 4 === 2, 'G', { on: 'g' });
      for (const [ex, ey, rx, ry] of [[3.5, 3, 3, 1.2], [24.5, 22.4, 2.6, 1.1], [24, 1.6, 2.4, 1]]) g.ellipse(ex, ey, rx, ry, 'w', { on: 'B' });
      return g;
    },
  },
  {
    id: 'herztorte', title: 'Herztorte', category: 'Liebe',
    palette: { k: '#5a2a3a', p: '#ff9dc0', P: '#e0609a', w: '#ffffff', r: '#e5233f', c: '#b9c4dc', y: '#ffd23f', B: '#d4f3e4' },
    build() {
      const g = new Grid(28, 30);
      obj(g, (l) => l.ellipse(14, 28.2, 13.4, 1.7, 'c'));
      const tiers = [[3, 20, 22, 8], [6, 14, 16, 6], [9, 9, 10, 5]];
      obj(g, (l) => {
        for (const [x, y, w, hgt] of tiers) l.rect(x, y, w, hgt + 0.5, 'p');
      });
      for (const [x0, y0, w] of tiers) {
        g.paint((px, py, x, y) => x > x0 && x < x0 + w - 1 && (y === y0 || (y === y0 + 1 && x % 3 !== 0) || (y === y0 + 2 && x % 3 === 1)), 'w', { on: 'p' });
        g.paint((px, py, x, y) => x >= x0 + w - 2 && y > y0 && y < y0 + 9, 'P', { on: 'p' });
      }
      g.paint((px, py, x, y) => y === 25 && x % 3 === 1, 'r', { on: 'pP' });
      g.paint((px, py, x, y) => y === 18 && x % 3 === 2, 'r', { on: 'pP' });
      g.paint((px, py, x, y) => y === 12 && x % 3 === 0, 'r', { on: 'pP' });
      obj(g, (l) => l.paint(heart(14, 4.6, 3.8), 'r'));
      g.ellipse(12.4, 3.6, 0.9, 0.7, 'w', { on: 'r' });
      background(g, (x, y) => ((x % 4 === 1 && y % 4 === 1) || (x % 4 === 3 && y % 4 === 3) ? 'w' : 'B'));
      for (const [x, y] of [[4, 4], [23, 6], [24, 14], [3, 13]]) {
        g.set(x, y, 'y'); g.set(x - 1, y, 'y'); g.set(x + 1, y, 'y'); g.set(x, y - 1, 'y'); g.set(x, y + 1, 'y');
      }
      return g;
    },
  },
  {
    id: 'loewe', title: 'Löwe', category: 'Tiere',
    palette: { k: '#4a2a14', m: '#b9531f', o: '#f08a2a', f: '#ffcf73', n: '#a04a3a', p: '#ff9db5', w: '#ffffff', B: '#c4e2fb' },
    build() {
      const g = new Grid(30, 28);
      const cx = 15, cy = 14.2;
      obj(g, (l) => {
        l.paint((px, py) => { const a = Math.atan2(py - cy, px - cx); return hyp(px - cx, py - cy) <= 12.4 + 1.1 * Math.cos(12 * a); }, 'm');
        l.paint((px, py) => { const a = Math.atan2(py - cy, px - cx); return hyp(px - cx, py - cy) <= 10.2 + 0.9 * Math.cos(12 * a + Math.PI); }, 'o');
      });
      obj(g, (l) => { l.circle(8.6, 7.4, 2.5, 'f'); l.circle(21.4, 7.4, 2.5, 'f'); });
      g.circle(8.6, 7.4, 1.3, 'p', { on: 'f' }); g.circle(21.4, 7.4, 1.3, 'p', { on: 'f' });
      obj(g, (l) => l.ellipse(cx, 15.2, 8.3, 7.6, 'f'));
      g.ellipse(13.2, 19, 2.6, 2.0, 'w', { on: 'f' });
      g.ellipse(16.8, 19, 2.6, 2.0, 'w', { on: 'f' });
      g.poly([[12.8, 15.8], [17.2, 15.8], [15, 18.4]], 'n');
      g.set(14, 19, 'k'); g.set(15, 19, 'k'); g.set(13, 21, 'k'); g.set(16, 21, 'k'); g.set(14, 20, 'k'); g.set(15, 20, 'k');
      g.stamp(10, 12, ['wk', 'kk']); g.stamp(18, 12, ['wk', 'kk']);
      g.set(9, 17, 'p'); g.set(10, 17, 'p'); g.set(19, 17, 'p'); g.set(20, 17, 'p');
      background(g, 'B');
      for (const [ex, ey, rx, ry] of [[3.4, 2.4, 3, 1.1], [26.4, 25, 3, 1.2]]) g.ellipse(ex, ey, rx, ry, 'w', { on: 'B' });
      return g;
    },
  },
  {
    id: 'schloss', title: 'Märchenschloss', category: 'Dinge',
    palette: { k: '#2a2440', s: '#d6cce8', S: '#a99fc4', r: '#e8433f', y: '#ffd23f', n: '#8b5a3c', g: '#5cb85a', G: '#3a9045', B: '#bfe3ff', w: '#ffffff' },
    build() {
      const g = new Grid(30, 30);
      obj(g, (l) => {
        l.rect(5, 16, 20, 11.5, 's');
        for (let x = 5; x < 25; x += 3) l.rect(x, 14, 2, 2.2, 's');
        l.rect(9.5, 9, 11, 10, 's');
        for (let x = 9.5; x < 20.5; x += 3) l.rect(x, 7, 2, 2.2, 's');
        l.rect(12, 5.5, 6, 6, 's');
        l.rect(2, 12, 6, 15.5, 's');
        l.rect(22, 12, 6, 15.5, 's');
      });
      obj(g, (l) => {
        l.poly([[0.8, 12.4], [9.2, 12.4], [5, 4.2]], 'r');
        l.poly([[20.8, 12.4], [29.2, 12.4], [25, 4.2]], 'r');
        l.poly([[10.8, 6.2], [19.2, 6.2], [15, -0.8]], 'r');
      });
      g.paint((px, py, x, y) => (y % 3 === 0 && (x + y) % 4 === 0) || x === 7 || x === 27 || x === 17 || x === 24, 'S', { on: 's' });
      g.line(5, 1, 5, 4, 'k'); g.line(25, 1, 25, 4, 'k');
      g.stamp(6, 1, ['yy', 'y.']); g.stamp(26, 1, ['yy', 'y.']);
      obj(g, (l) => { l.rect(12, 21, 6, 7, 'n'); l.circle(15, 21.5, 3, 'n'); });
      g.line(15, 19, 15, 27, 'k', { on: 'n' });
      for (const [x, y] of [[14, 9], [15, 9], [14, 10], [15, 10]]) g.set(x, y, 'y');
      for (const [x, y] of [[4, 16], [4, 17], [5, 16], [5, 17], [24, 16], [24, 17], [25, 16], [25, 17], [11, 13], [11, 14], [18, 13], [18, 14]]) g.set(x, y, 'k');
      for (const [x, y] of [[4, 21], [5, 21], [4, 22], [5, 22], [24, 21], [25, 21], [24, 22], [25, 22]]) g.set(x, y, 'y');
      background(g, (x, y) => (y >= 27 ? 'g' : 'B'));
      g.paint((px, py) => ((px - 15) / 18) ** 2 + ((py - 33) / 6.2) ** 2 <= 1, 'g', { on: 'B' });
      g.paint((px, py, x, y) => y >= 26 && (x * 7 + y * 3) % 11 === 0, 'G', { on: 'g' });
      for (const [ex, ey, rx, ry] of [[24, 1.6, 2.4, 1], [3, 21, 1.6, 0.8]]) g.ellipse(ex, ey, rx, ry, 'w', { on: 'B' });
      g.ellipse(10.5, 2, 2.6, 1, 'w', { on: 'B' });
      return g;
    },
  },
  {
    id: 'bergsee', title: 'Bergsee', category: 'Natur',
    palette: { B: '#bfe3ff', w: '#ffffff', y: '#ffd23f', m: '#9aa8cc', M: '#66739c', g: '#7cc96a', G: '#2f7f3a', n: '#8b5a3c', r: '#e8433f', b: '#3f8ef0' },
    build() {
      const g = new Grid(32, 28);
      background(g, 'B');
      g.circle(26.5, 4.5, 2.7, 'y');
      g.poly([[-2, 19], [8.5, 5.5], [19, 19]], 'M');
      g.paint((px, py) => py < 8.6 + ((Math.floor(px) % 3) - 1) * 0.6, 'w', { on: 'M' });
      g.poly([[7, 19], [19.5, 2.5], [34, 19]], (x) => (x + 0.5 < 19.5 ? 'm' : 'M'));
      g.paint((px, py) => py < 6.4 + ((Math.floor(px) % 3) - 1) * 0.7 + (px > 19.5 ? 0.6 : 0), 'w', { on: 'mM' });
      g.paint((px, py) => py > 16.6 + 1.1 * Math.sin(px * 0.45) && py < 21, 'g');
      for (const [tx, base, ht] of [[3, 20, 5], [6, 20, 6], [28, 20, 6], [25, 20, 4], [31, 20, 5]]) {
        g.poly([[tx - 2, base], [tx + 2, base], [tx, base - ht]], 'G');
      }
      g.rect(19, 15.5, 5, 3, 'n');
      g.poly([[18, 16], [25, 16], [21.5, 12.8]], 'r');
      g.set(20, 17, 'y'); g.set(22, 17, 'y');
      g.paint((px, py) => py >= 20, 'b');
      g.paint((px, py, x, y) => (y === 21 && x > 8 && x < 15) || (y === 23 && x > 16 && x < 25) || (y === 25 && x > 3 && x < 10) || (y === 26 && x > 20 && x < 29) || (y === 22 && x > 26), 'w', { on: 'b' });
      g.paint((px, py, x, y) => y === 20 && x % 2 === 0, 'm', { on: 'b' });
      for (const [x, y, c] of [[10, 19, 'r'], [13, 18, 'y'], [16, 19, 'r'], [27, 19, 'y'], [9, 18, 'y']]) g.set(x, y, c, { on: 'g' });
      for (const [ex, ey, rx, ry] of [[5, 2.4, 3.2, 1.1], [14, 1.2, 2.4, 0.9]]) g.ellipse(ex, ey, rx, ry, 'w', { on: 'B' });
      return g;
    },
  },
  {
    id: 'unterwasser', title: 'Unterwasserwelt', category: 'Tiere',
    palette: { b: '#6cc4f0', d: '#3a8fd8', S: '#f6deb0', g: '#5cc25a', G: '#2f8f4a', o: '#ff8a2a', w: '#ffffff', y: '#ffd23f', p: '#ff8fc0', k: '#1e2a4a', r: '#e8433f' },
    build() {
      const g = new Grid(32, 32);
      background(g, (x, y) => (y < 14 || (y < 18 && (x + y) % 2 === 0 && y < 16) ? 'b' : 'd'));
      g.paint((px, py) => py > 28.4 + 0.8 * Math.sin(px * 0.5), 'S');
      for (const [x0, top, ph, c] of [[3, 12, 0, 'g'], [28, 16, 1.5, 'G'], [9, 22, 3, 'G'], [25, 22, 0.7, 'g']]) {
        for (let y = top; y < 30; y++) {
          const x = x0 + Math.round(Math.sin(y * 0.55 + ph));
          g.set(x, y, c); g.set(x + 1, y, c);
        }
      }
      // grosser Fisch (orange, nach rechts)
      obj(g, (l) => {
        l.poly([[9.2, 11.5], [4.4, 7.8], [4.4, 15.2]], 'o');
        l.poly([[11, 8.4], [15, 5.6], [16, 8.6]], 'o');
        l.ellipse(14, 11.5, 6.2, 3.8, 'o');
      });
      g.paint((px, py, x) => x === 11 || x === 12 || x === 16, 'w', { on: 'o' });
      g.stamp(17, 10, ['wk', 'kk']);
      // gelber Fisch (nach links)
      obj(g, (l) => {
        l.poly([[24.6, 21], [28.4, 18.2], [28.4, 23.8]], 'y');
        l.ellipse(21.4, 21, 4.2, 2.8, 'y');
      });
      g.paint((px, py, x, y) => (x === 21 || x === 22) && y >= 19 && y <= 23, 'p', { on: 'y' });
      g.stamp(18, 20, ['k']);
      // kleiner rosa Fisch
      obj(g, (l) => {
        l.poly([[7.8, 24.5], [5.2, 22.8], [5.2, 26.2]], 'p');
        l.ellipse(10, 24.5, 2.6, 1.7, 'p');
      });
      g.set(11, 24, 'k');
      // Seestern
      g.stamp(17, 26, ['..r..', '..r..', 'rrrrr', '.rrr.', '.r.r.', 'r...r']);
      g.set(19, 28, 'y');
      for (const [x, y] of [[21, 8], [22, 6], [21, 4], [22, 2], [8, 18], [9, 16], [27, 12], [28, 10], [27, 8]]) g.set(x, y, 'w', { on: 'bd' });
      return g;
    },
  },
];

/** Reihenfolge = Level-Reihenfolge (Fläche aufsteigend, Themen abwechselnd). */
const ORDER = ['sonnenblume', 'herztorte', 'loewe', 'bergsee', 'schloss', 'unterwasser'];
export default ORDER.map((id) => list.find((p) => p.id === id));
