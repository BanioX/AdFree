// Stufe 3 (Level 19–30): grössere Bilder mit Hintergrund, 20–28 Perlen, 6–10 Farben.
import { Grid, sym, obj, background, rles } from '../raster.mjs';
const P = (rows, odd) => Grid.parse(sym(rows, odd));
const H = (specs, half, odd) => Grid.parse(sym(rles(specs, half), odd));

/** Herzform aus zwei Kreisen und einem Dreieck (Mittelpunkt cx/cy, Grösse s, Drehung rot). */
export function heart(cx, cy, s, rot = 0) {
  const c = Math.cos(rot), si = Math.sin(rot);
  return (px, py) => {
    const dx = (px - cx) / s, dy = (py - cy) / s;
    const X = dx * c + dy * si, Y = -dx * si + dy * c;
    if ((X - 0.5) ** 2 + (Y + 0.3) ** 2 <= 0.56 ** 2 || (X + 0.5) ** 2 + (Y + 0.3) ** 2 <= 0.56 ** 2) return true;
    return Y >= -0.3 && Y <= 1.05 && Math.abs(X) <= 1.04 * (1.05 - Y) / 1.35;
  };
}
/** Punkt der Herzspitze in Rasterkoordinaten. */
function heartTip(cx, cy, s, rot = 0) {
  const Y = 1.0;
  const dx = -Y * Math.sin(rot), dy = Y * Math.cos(rot);
  return [Math.round(cx + dx * s - 0.5), Math.round(cy + dy * s - 0.5)];
}

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
  },  {
    id: 'herzballons', title: 'Herzballons', category: 'Liebe',
    palette: { k: '#5a1a32', r: '#f2385a', R: '#c21f45', l: '#ffc2d2', p: '#ff8fc0', v: '#a678f0', w: '#ffffff', s: '#8a7a88', B: '#d8e8ff' },
    build() {
      const g = new Grid(22, 24);
      const knot = [11, 19];
      const balloons = [
        [5.6, 11.2, 3.6, 0.38, 'p'],
        [16.4, 11.2, 3.6, -0.38, 'v'],
        [11, 7.4, 5.0, 0, 'r'],
      ];
      for (const [cx, cy, s, rot] of balloons) {
        const [tx, ty] = heartTip(cx, cy, s, rot);
        g.line(tx, ty + 1, knot[0], knot[1], 's');
      }
      for (const [cx, cy, s, rot, c] of balloons) {
        obj(g, (l) => l.paint(heart(cx, cy, s, rot), c));
        const hx = cx - s * 0.45, hy = cy - s * 0.55;
        g.ellipse(hx, hy, s * 0.22, s * 0.16, c === 'r' ? 'l' : 'w', { on: c });
      }
      g.rimShade('r', { lo: 'R', region: 'rl', lx: -1, ly: -1 });
      g.stamp(9, 19, ['rr.rr', '.rkr.', '.s.s.', 's...s'], { not: '' });
      background(g, (x, y) => 'B');
      for (const [cx, cy, rx, ry] of [[3, 2.6, 2.6, 1.2], [19.5, 19.2, 2.8, 1.3], [3.5, 21, 2.5, 1.1], [19.5, 2, 2, 1]]) g.ellipse(cx, cy, rx, ry, 'w', { on: 'B' });
      return g;
    },
  },
  {
    id: 'kuerbis', title: 'Kürbis', category: 'Jahreszeiten',
    palette: { k: '#4a2a14', o: '#ff8a2a', O: '#d0582a', l: '#ffc27a', n: '#7a4a2e', g: '#5cb85a', G: '#2f7f3a', r: '#c9283e', B: '#fdeccd' },
    build() {
      const g = new Grid(26, 22);
      const lobes = [[5.2, 4.2, 6.0], [9.1, 4.6, 6.9], [13, 4.8, 7.3], [16.9, 4.6, 6.9], [20.8, 4.2, 6.0]];
      const cy = 14.1;
      const lobeAt = (px, py) => {
        let best = -1, bv = 1;
        lobes.forEach(([cx, rx, ry], i) => {
          const v = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
          if (v <= 1 && (best < 0 || v < bv - 0.02 || (Math.abs(v - bv) <= 0.02 && Math.abs(i - 2) < Math.abs(best - 2)))) { best = i; bv = v; }
        });
        return best;
      };
      // Stiel und Blatt
      obj(g, (l) => { l.poly([[12, 8], [12.4, 4.2], [14, 2.4], [15.2, 3.2], [14.2, 4.8], [14.2, 8]], 'n'); });
      obj(g, (l) => l.poly([[14.2, 5.6], [16.4, 2.6], [20, 1.6], [23.4, 2.8], [21.4, 5.4], [17.6, 6.6]], 'g'));
      g.line(15, 5, 21, 3, 'G', { on: 'g' });
      for (const [x, y] of [[11, 6], [10, 5], [9, 5], [8, 4], [8, 3], [9, 2], [10, 2], [10, 3]]) g.set(x, y, 'G', { on: '.' });
      const body = g.layer();
      body.paint((px, py) => lobeAt(px, py) >= 0, 'o');
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const i = lobeAt(x + 0.5, y + 0.5);
        if (i < 0) continue;
        const j = lobeAt(x + 1.5, y + 0.5);
        if (j >= 0 && j !== i) body.set(i < 2 ? x : x + 1, y, 'O');
        const [cx, rx, ry] = lobes[i];
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx < -0.25 && dx > -0.62 && dy < 0.15 && dy > -0.62) body.set(x, y, 'l');
      }
      body.outline('k');
      g.over(body);
      g.paint((px, py, x, y) => y >= 20, 'O', { on: 'o' });
      background(g, 'B');
      for (const [x, y, c] of [[2, 2, 'r'], [3, 2, 'r'], [3, 3, 'r'], [22, 1, 'n'], [23, 1, 'n'], [22, 2, 'n'], [1, 8, 'G'], [2, 9, 'G'], [24, 9, 'r'], [24, 10, 'r'], [25, 10, 'r'], [6, 0, 'n'], [7, 1, 'n']]) g.set(x, y, c, { on: 'B' });
      return g;
    },
  },
  {
    id: 'heissluftballon', title: 'Heissluftballon', category: 'Dinge',
    palette: { k: '#2a2440', r: '#ef3b4f', y: '#ffd23f', b: '#3f8ef0', n: '#a8683a', N: '#7a4626', w: '#ffffff', B: '#bfe3ff' },
    build() {
      const g = new Grid(22, 26);
      const cx = 11, cy = 10.2;
      const rxAt = (py) => (py <= cy ? 9.2 * Math.sqrt(Math.max(0, 1 - ((py - cy) / 8.6) ** 2)) : 9.2 - 5.6 * Math.min(1, (py - cy) / 9) ** 1.3);
      const inEnv = (px, py) => py >= cy - 8.6 && py <= 19.2 && Math.abs(px - cx) <= rxAt(py);
      obj(g, (l) => {
        l.paint(inEnv, (x, y) => {
          const u = Math.max(-1, Math.min(1, (x + 0.5 - cx) / Math.max(0.5, rxAt(y + 0.5))));
          const i = Math.min(6, Math.floor((Math.asin(u) / (Math.PI / 2) + 1) * 3.5));
          return i % 2 ? 'y' : 'r';
        });
        l.paint((px, py) => inEnv(px, py) && py > 14.2 && py < 16.4, 'b');
      });
      g.line(8, 19, 9, 21, 'k'); g.line(14, 19, 13, 21, 'k');
      obj(g, (l) => { l.rect(7.8, 21, 6.4, 4.2, 'n'); });
      g.paint((px, py, x, y) => (x + (y % 2)) % 2 === 0, 'N', { on: 'n' });
      g.line(8, 22, 13, 22, 'N', { on: 'nN' });
      background(g, 'B');
      for (const [ex, ey, rx, ry] of [[2.6, 3, 2.6, 1.1], [19.5, 15.5, 2.8, 1.2], [3.5, 20.5, 3, 1.2], [20, 2, 2, 0.9]]) g.ellipse(ex, ey, rx, ry, 'w', { on: 'B' });
      for (const [x, y] of [[17, 22], [18, 21], [19, 22], [1, 10], [2, 9], [3, 10]]) g.set(x, y, 'k', { on: 'B' });
      return g;
    },
  },
  {
    id: 'schildkroete', title: 'Schildkröte', category: 'Tiere',
    palette: { k: '#24402a', g: '#5cb85a', G: '#2f7f3a', y: '#f6c35a', s: '#c4e47a', p: '#ff9db5', w: '#ffffff', S: '#f6e2b3', B: '#cdf3f0' },
    build() {
      const g = new Grid(26, 22);
      const scx = 11.5, scy = 14.4, srx = 8.6, sry = 8.2;
      obj(g, (l) => {
        l.rect(4.4, 13, 3.4, 4.6, 's'); l.rect(14.6, 13, 3.4, 4.6, 's');
        l.poly([[2, 13.6], [4.6, 12.4], [4.6, 14.6]], 's');
      });
      obj(g, (l) => { l.rect(17.4, 9.6, 3.2, 3.2, 's'); l.circle(21.4, 9.3, 3.1, 's'); });
      obj(g, (l) => {
        l.paint((px, py) => py <= scy && ((px - scx) / srx) ** 2 + ((py - scy) / sry) ** 2 <= 1, 'g');
        l.rect(scx - srx - 0.6, scy - 1.6, 2 * srx + 1.2, 1.9, 'y');
      });
      g.paint((px, py) => {
        const dx = (px - scx) / srx, dy = (py - scy) / sry;
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        const ring = r > 0.48 && r < 0.62;
        const spoke = r >= 0.62 && [-2.5, -1.57, -0.64].some((t) => Math.abs(a - t) < 0.11 / r);
        return ring || spoke;
      }, 'G', { on: 'g' });
      g.ellipse(scx - 1.4, scy - 3.6, 1.4, 0.7, 'w', { on: 'g' });
      g.stamp(21, 7, ['wk', 'kk']); g.set(23, 10, 'p');
      g.set(20, 11, 'k'); g.set(21, 11, 'k');
      background(g, (x, y) => (y >= 18 ? 'S' : 'B'));
      for (const [x, y] of [[1, 17], [2, 16], [2, 17], [23, 17], [24, 16], [24, 17], [25, 17]]) g.set(x, y, 'G', { on: 'B' });
      for (const [cx, cy, rx, ry] of [[4, 3, 2.8, 1.1], [20.5, 2.2, 2.4, 1]]) g.ellipse(cx, cy, rx, ry, 'w', { on: 'B' });
      for (const [x, y] of [[3, 20], [4, 20], [19, 19], [11, 21], [12, 21]]) g.set(x, y, 'y', { on: 'S' });
      return g;
    },
  },
  {
    id: 'segelboot', title: 'Segelboot', category: 'Dinge',
    palette: { k: '#2a2a40', w: '#ffffff', c: '#e6d6b8', r: '#e8433f', n: '#8b5a3c', b: '#3f8ef0', d: '#2559b8', y: '#ffd23f', B: '#bfe3ff' },
    build() {
      const g = new Grid(28, 26);
      obj(g, (l) => {
        l.poly([[13.6, 3.4], [13.6, 16.6], [5.4, 16.6]], 'w');
        l.poly([[15.4, 5.4], [15.4, 16.6], [22.6, 16.6]], 'r');
      });
      g.paint((px, py) => py > 12.5, 'c', { on: 'w' });
      g.paint((px, py, x, y) => y === 12 || y === 13, 'w', { on: 'r' });
      g.line(14, 2, 14, 17, 'n');
      obj(g, (l) => l.poly([[14.5, 1.2], [18.6, 2.2], [14.5, 3.2]], 'r'));
      obj(g, (l) => l.poly([[4.6, 17.4], [23.8, 17.4], [21, 21.4], [7.4, 21.4]], 'r'));
      g.paint((px, py, x, y) => y === 19, 'w', { on: 'r' });
      background(g, (x, y) => (y >= 21 ? (y >= 23 ? 'd' : 'b') : 'B'));
      g.paint((px, py, x, y) => y >= 19 && y <= 20 && g.get(x, y) === 'B', 'b');
      g.paint((px, py, x, y) => (y === 19 && x % 5 < 2) || (y === 22 && (x + 2) % 6 < 2) || (y === 24 && (x + 4) % 7 < 2), 'w', { on: 'bd' });
      obj(g, (l) => l.circle(4.5, 4.5, 3, 'y'), null);
      for (const [cx, cy, rx, ry] of [[24, 4, 3, 1.1], [9, 1.4, 2.2, 0.9], [22, 11, 2.2, 0.9]]) g.ellipse(cx, cy, rx, ry, 'w', { on: 'B' });
      for (const [x, y] of [[19, 7], [20, 6], [21, 7], [8, 9], [9, 8], [10, 9]]) g.set(x, y, 'k', { on: 'B' });
      return g;
    },
  },
];
