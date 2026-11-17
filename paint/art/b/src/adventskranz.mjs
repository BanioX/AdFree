// Adventskranz mit vier brennenden Kerzen, Schleife, Zapfen und Faltsternen.
import { Pic, rect, circle, ellipse, poly, smooth, drop, star, foldedStar, sprig, polyline, roundPoly } from './lib.mjs';

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
    greenDeep: '#1b3f2c',
    green1: '#2d6a40',
    green2: '#46914f',
    green3: '#74b866',
    wood: '#a86f45',
    woodDark: '#74472a',
    cream: '#fff3d6',
  },
};

export default function build() {
  const p = new Pic(meta);

  // Hintergrund: Nacht mit warmem Lichtschein
  p.add(rect(-10, -10, 1020, 1020), 'navy');
  p.add(circle(500, 560, 480), 'navy2');
  p.add(circle(500, 600, 350), 'navy3');

  const bokeh = [
    [70, 430, 30, 'navy3'], [120, 600, 20, 'amber'], [930, 450, 34, 'navy3'], [890, 610, 18, 'amber'],
    [300, 330, 22, 'amber'], [690, 210, 20, 'amber'], [340, 60, 22, 'amber'], [660, 60, 26, 'navy3'],
    [780, 480, 20, 'navy2'], [230, 470, 18, 'navy2'],
  ];
  for (const [x, y, r, c] of bokeh) p.add(circle(x, y, r), c);
  const sparkles = [[100, 350, 22], [910, 340, 20], [500, 330, 18], [960, 90, 18], [40, 90, 18], [270, 460, 18], [722, 525, 18], [930, 560, 18], [70, 560, 18]];
  for (const [x, y, r] of sparkles) p.add(star(x, y, r + 4, (r + 4) * 0.4, 4, -90, 2), 'cream');

  // Hängende Faltsterne
  for (const [x, y, r] of [[180, 215, 100], [420, 135, 78], [820, 215, 98]]) {
    p.line(polyline([[x, -10], [x, y - r + 4]]), 3, '#d9c08a');
    foldedStar(x, y, r, r * 0.45, 5, -90).forEach((f, i) => p.add(f, i % 2 ? 'gold' : 'goldLight'));
  }

  // Tisch und Schatten
  p.add(rect(-10, 690, 1020, 330), 'wood');

  // Kranz in Draufsicht berechnen, dann perspektivisch stauchen
  const CX = 500, CY = 770, KY = 0.48, RC = 300;
  const proj = (path) => path.mapPts((u, v) => [CX + u, CY + v * KY]);
  const at = (deg, r = RC) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
  const yOf = (deg) => CY + RC * Math.sin((deg * Math.PI) / 180) * KY;

  p.add(proj(ellipse(0, 0, RC + 10, RC + 10)), 'greenDeep');
  p.add(proj(ellipse(0, -14, RC - 124, RC - 124)), 'woodDark');
  p.add(proj(ellipse(0, 10, RC - 130, RC - 130)), 'wood');

  const greens = ['green2', 'green3', 'green1'];
  let tuftNo = 0;
  const placed = [];
  const tuft = (u, v, dirDeg, len, wid) => {
    const path = proj(sprig(len, wid, 5, { round: 2 }).rotate(dirDeg + 90).translate(u, v));
    const r = (dirDeg * Math.PI) / 180;
    const pts = [0.1, 0.4, 0.7, 0.95].map((t) => [CX + u + Math.cos(r) * len * t, CY + (v + Math.sin(r) * len * t) * KY]);
    const close = (q) => q.pts.some((a) => pts.some((b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 62));
    const near = placed.filter(close).map((q) => q.c);
    const order = [0, 1, 2].map((i) => greens[(tuftNo + i) % 3]);
    let col = order.find((c) => !near.includes(c));
    if (!col) col = order.sort((a, b) => near.lastIndexOf(a) - near.lastIndexOf(b))[0];
    tuftNo++;
    placed.push({ pts, c: col });
    p.filler(path, col, greens, process.env.NOPRUNE ? null : {});
  };
  // Zweige im Fischgrätmuster entlang des Rings; dir = +1 (θ steigt) oder −1
  const walk = (from, to, step) => {
    const dir = Math.sign(to - from);
    for (let d = from; dir > 0 ? d <= to + 0.1 : d >= to - 0.1; d += step * dir) {
      const [u, v] = at(d);
      const tang = d + 90 * dir;
      const [ou, ov] = at(d, 1);
      tuft(u + ou * 36, v + ov * 36, tang - 32 * dir, 168, 52);
      tuft(u - ou * 28, v - ov * 28, tang + 22 * dir, 150, 46);
    }
  };
  const collar = (deg) => {
    const [u, v] = at(deg);
    for (const a of [165, 220, 275, 330, 25, 90]) {
      const diff = Math.abs(((a - (deg + 180)) % 360 + 540) % 360 - 180);
      if (diff < 70) continue; // nicht nach innen
      const r = (a * Math.PI) / 180;
      tuft(u + Math.cos(r) * 14, v + Math.sin(r) * 14, a, 120, 42);
    }
  };

  const candle = (deg, h, w) => {
    const [u] = at(deg);
    const x = CX + u;
    const base = yOf(deg) - 6;
    const top = base - h;
    const hw = w / 2;
    p.add(rect(x - hw, top, w, h), 'red');
    p.add(poly([[x + hw * 0.36, top], [x + hw, top], [x + hw, base], [x + hw * 0.36, base]]), 'redDark');
    const dx = -0.32;
    p.add(
      smooth([
        [x - hw, top], [x - hw * 0.5, top - 14], [x + hw * 0.5, top - 14], [x + hw, top],
        [x + hw * 0.6, top + 12], [x + hw * (dx + 0.2), top + 14], [x + hw * (dx + 0.16), top + 62],
        [x + hw * dx, top + 70], [x + hw * (dx - 0.16), top + 62], [x + hw * (dx - 0.2), top + 14],
        [x - hw * 0.6, top + 12],
      ]),
      'redLight',
    );
    p.line(polyline([[x, top - 6], [x + 1, top - 22]]), 4, '#3a2418');
    return { x, top };
  };

  const flames = [];
  walk(180, 360, 18);
  flames.push(candle(246, 300, 94));
  collar(246);
  flames.push(candle(294, 270, 94));
  collar(294);
  walk(180, 0, 18);
  flames.push(candle(154, 236, 100));
  collar(154);
  flames.push(candle(26, 206, 100));
  collar(26);

  // getrocknete Orangenscheiben
  const orange = (x, y, r, tilt) => {
    p.add(ellipse(x, y, r, r * 0.8, tilt), 'amber');
    for (let i = 0; i < 8; i++) {
      const a0 = 45 * i + 4;
      const a1 = 45 * (i + 1) - 4;
      const pts = [[Math.cos(((a0 + a1) / 2) * Math.PI / 180) * 5, Math.sin(((a0 + a1) / 2) * Math.PI / 180) * 5]];
      for (let t = 0; t <= 4; t++) {
        const a = ((a0 + ((a1 - a0) * t) / 4) * Math.PI) / 180;
        pts.push([Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76]);
      }
      const w = roundPoly(pts.map(([u, v]) => [u, v * 0.8]), 4).rotate(tilt).translate(x, y);
      p.add(w, i % 2 ? 'goldLight' : 'gold');
    }
  };
  orange(340, 900, 52, -10);
  orange(660, 900, 52, 10);

  // Beeren
  const berries = [
    [140, 790], [166, 806], [138, 820],
    [862, 790], [888, 774], [886, 808],
    [282, 652], [306, 636], [304, 668],
    [718, 652], [694, 636], [696, 668],
  ];
  berries.forEach(([x, y], i) => p.add(circle(x, y, 15), ['redDark', 'red', 'redLight'][i % 3]));

  // Goldkugeln
  for (const [x, y] of [[500, 640], [190, 880], [812, 884]]) {
    p.add(circle(x, y, 30), 'amber');
    p.add(circle(x - 4, y - 4, 25), 'gold');
  }

  // Schleife vorne
  const bx = 500, by = 905;
  p.add(smooth([[bx - 16, by + 8], [bx - 36, by + 44], [bx - 54, by + 76, 1], [bx - 34, by + 70], [bx - 22, by + 80, 1], [bx - 3, by + 12]]), 'redDark');
  p.add(smooth([[bx + 16, by + 8], [bx + 40, by + 42], [bx + 60, by + 72, 1], [bx + 40, by + 68], [bx + 28, by + 78, 1], [bx + 3, by + 12]]), 'redDark');
  p.add(smooth([[bx, by], [bx - 46, by - 46], [bx - 98, by - 42], [bx - 102, by + 6], [bx - 58, by + 26]]), 'red');
  p.add(smooth([[bx, by], [bx + 46, by - 46], [bx + 98, by - 42], [bx + 102, by + 6], [bx + 58, by + 26]]), 'red');
  p.add(smooth([[bx - 32, by - 8], [bx - 58, by - 26], [bx - 82, by - 18], [bx - 62, by + 4]]), 'redLight');
  p.add(smooth([[bx + 32, by - 8], [bx + 58, by - 26], [bx + 82, by - 18], [bx + 62, by + 4]]), 'redLight');
  p.add(roundPoly([[bx - 22, by - 22], [bx + 22, by - 22], [bx + 18, by + 22], [bx - 18, by + 22]], 10), 'redLight');

  // Flammen
  for (const f of flames) {
    p.add(drop(f.x, f.top - 36, 40, 70), 'gold');
    p.add(drop(f.x, f.top - 32, 21, 38), 'goldLight');
  }

  return p;
}
