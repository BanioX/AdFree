// Adventskranz mit vier brennenden Kerzen, Schleife, Zapfen und Sternen.
import { Pic, rect, circle, ellipse, poly, smooth, drop, star, foldedStar, sprig, rng, roundPoly, polyline } from './lib.mjs';

export const meta = {
  id: 'b-adventskranz',
  title: 'Adventskranz',
  category: 'Winter',
  palette: {
    navy: '#1c2a4a',
    navy2: '#26395f',
    navy3: '#324a78',
    goldLight: '#ffe08a',
    gold: '#f2b441',
    amber: '#c98a3c',
    red: '#cc3340',
    redDark: '#8c1c2a',
    redLight: '#ec7275',
    green1: '#24563a',
    green2: '#3a7d4a',
    green3: '#62a65a',
    wood: '#a86f45',
    woodDark: '#74472a',
    cream: '#fff3d6',
  },
};

export default function build() {
  const p = new Pic(meta);
  const R = rng(7);

  // Hintergrund: Nacht mit warmem Lichtschein
  p.add(rect(-10, -10, 1020, 1020), 'navy');
  p.add(circle(500, 560, 480), 'navy2');
  p.add(circle(500, 590, 360), 'navy3');

  // Lichtpunkte (Bokeh) und Funkeln
  const bokeh = [
    [70, 420, 30, 'navy3'], [120, 560, 20, 'amber'], [930, 450, 34, 'navy3'], [880, 600, 18, 'amber'],
    [380, 300, 24, 'navy3'], [640, 330, 22, 'amber'], [60, 700, 24, 'navy3'], [950, 700, 26, 'amber'],
    [340, 60, 22, 'amber'], [660, 60, 26, 'navy3'],
  ];
  for (const [x, y, r, c] of bokeh) p.add(circle(x, y, r), c);
  const sparkles = [[110, 330, 22], [900, 340, 20], [420, 400, 18], [590, 250, 16], [170, 470, 16], [830, 520, 18], [960, 90, 18], [40, 90, 18]];
  for (const [x, y, r] of sparkles) p.add(star(x, y, r, r * 0.32, 4, -90, 1), 'cream');

  // Hängende Faltsterne
  const stars = [
    [190, 220, 105, 'goldLight', 'gold'],
    [500, 150, 82, 'goldLight', 'gold'],
    [815, 235, 100, 'goldLight', 'gold'],
  ];
  for (const [x, y, r, c1, c2] of stars) {
    p.line(polyline([[x, -10], [x, y - r + 4]]), 3, '#d9c08a');
    foldedStar(x, y, r, r * 0.45, 5, -90).forEach((f, i) => p.add(f, i % 2 ? c2 : c1));
  }

  // Tisch
  p.add(rect(-10, 700, 1020, 320), 'wood');
  p.add(ellipse(500, 822, 400, 142), 'woodDark');

  // Kranz: Grundring, Loch
  const CX = 500, CY = 790;
  p.add(ellipse(CX, CY, 382, 146), 'green1');
  p.add(ellipse(CX, CY - 4, 214, 64), 'woodDark');
  p.add(ellipse(CX, CY + 6, 206, 56), 'wood');

  const ringPt = (deg, rx = 300, ry = 106) => [CX + rx * Math.cos((deg * Math.PI) / 180), CY + ry * Math.sin((deg * Math.PI) / 180)];
  const greens = ['green2', 'green3', 'green1', 'green3', 'green2'];
  const sprigAt = (deg, k, len = 150, wid = 40, off = 0) => {
    const [x, y] = ringPt(deg + off * 0.0, 300 + off, 106 + off * 0.35);
    // Ausrichtung: tangential (gegen den Uhrzeigersinn), etwas nach aussen gekippt
    const a = (deg * Math.PI) / 180;
    const tx = -300 * Math.sin(a);
    const ty = 106 * Math.cos(a);
    const ang = (Math.atan2(ty, tx) * 180) / Math.PI + 90 + 12;
    const s = sprig(len, wid, 5).rotate(ang).translate(x, y);
    p.add(s, greens[k % greens.length]);
  };

  // Kerzen
  const candles = [
    { deg: 236, h: 300, w: 92 },
    { deg: 304, h: 270, w: 92 },
    { deg: 152, h: 240, w: 100 },
    { deg: 28, h: 210, w: 100 },
  ].map((c) => {
    const [x, y] = ringPt(c.deg);
    return { ...c, x, y, top: y - c.h };
  });
  const drawCandle = (c, flip) => {
    const { x, w, top } = c;
    const base = c.y + 30;
    const hw = w / 2;
    p.add(rect(x - hw, top, w, base - top), 'red');
    p.add(poly([[x + hw * 0.38, top], [x + hw, top], [x + hw, base], [x + hw * 0.38, base]]), 'redDark');
    // Oberseite mit Wachstropfen
    const dx = flip ? 0.25 : -0.3;
    p.add(
      smooth([
        [x - hw, top], [x - hw * 0.5, top - 13], [x + hw * 0.5, top - 13], [x + hw, top],
        [x + hw * 0.6, top + 12], [x + hw * (dx + 0.18), top + 14], [x + hw * (dx + 0.14), top + 60],
        [x + hw * dx, top + 66], [x + hw * (dx - 0.14), top + 58], [x + hw * (dx - 0.18), top + 14],
        [x - hw * 0.6, top + 12],
      ]),
      'redLight',
    );
    p.line(polyline([[x, top - 4], [x + 1, top - 20]]), 4, '#3a2418');
  };

  // Rückseite des Kranzes
  const backDegs = [];
  for (let d = 190; d <= 350; d += 16) backDegs.push(d);
  drawCandle(candles[0], false);
  drawCandle(candles[1], true);
  backDegs.forEach((d, i) => sprigAt(d, i));
  // Seiten + Vorderseite
  const sideDegs = [174, 6, 166, 14];
  sideDegs.forEach((d, i) => sprigAt(d, i + 1, 140, 38));
  drawCandle(candles[2], true);
  drawCandle(candles[3], false);
  const frontDegs = [];
  for (let d = 158; d >= 22; d -= 15) frontDegs.push(d);
  frontDegs.forEach((d, i) => sprigAt(d, i + 2, 150, 42, 6));

  // Tannenzapfen
  const cone = (x, y, ang) => {
    const body = ellipse(0, 0, 30, 52);
    p.add(body.rotate(ang).translate(x, y), 'woodDark');
    for (let i = 0; i < 3; i++) {
      const yy = -30 + i * 24;
      const sc = smooth([[-24 + i * 2, yy], [0, yy + 14], [24 - i * 2, yy], [0, yy + 6]]);
      p.add(sc.rotate(ang).translate(x, y), 'wood');
    }
  };
  cone(318, 868, 70);
  cone(690, 880, -72);

  // Beeren
  const berries = [
    [420, 900], [446, 918], [412, 930],
    [600, 912], [628, 896], [622, 930],
    [160, 778], [186, 800], [158, 812],
    [842, 784], [868, 768], [866, 804],
  ];
  for (const [x, y] of berries) p.add(circle(x, y, 15), 'red');

  // Goldkugeln
  for (const [x, y] of [[270, 760], [735, 770], [500, 700]]) {
    p.add(circle(x, y, 30), 'amber');
    p.add(circle(x - 4, y - 4, 25), 'gold');
  }

  // Schleife vorne
  const bx = 500, by = 925;
  p.add(smooth([[bx - 10, by + 8], [bx - 40, by + 60], [bx - 62, by + 98, 1], [bx - 40, by + 92], [bx - 26, by + 104, 1], [bx + 6, by + 12]]), 'redDark');
  p.add(smooth([[bx + 10, by + 8], [bx + 48, by + 58], [bx + 70, by + 94, 1], [bx + 46, by + 90], [bx + 30, by + 102, 1], [bx - 4, by + 12]]), 'redDark');
  p.add(smooth([[bx, by], [bx - 50, by - 46], [bx - 100, by - 40], [bx - 104, by + 6], [bx - 60, by + 26]]), 'red');
  p.add(smooth([[bx, by], [bx + 50, by - 46], [bx + 100, by - 40], [bx + 104, by + 6], [bx + 60, by + 26]]), 'red');
  p.add(smooth([[bx - 22, by - 6], [bx - 58, by - 24], [bx - 80, by - 16], [bx - 62, by + 4]]), 'redLight');
  p.add(smooth([[bx + 22, by - 6], [bx + 58, by - 24], [bx + 80, by - 16], [bx + 62, by + 4]]), 'redLight');
  p.add(roundPoly([[bx - 24, by - 22], [bx + 24, by - 22], [bx + 20, by + 24], [bx - 20, by + 24]], 10), 'redDark');

  // Flammen
  for (const c of candles) {
    p.add(drop(c.x, c.top - 34, 38, 66), 'gold');
    p.add(drop(c.x, c.top - 30, 20, 36), 'goldLight');
  }

  return p;
}
