// Adventskranz mit vier brennenden Kerzen, Schleife, Zapfen und Faltsternen.
import { Pic, rect, circle, ellipse, poly, smooth, drop, star, foldedStar, leaf, polyline, bumpy, roundPoly } from './lib.mjs';

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
    [800, 400, 22, 'navy2'], [230, 470, 18, 'navy2'],
  ];
  for (const [x, y, r, c] of bokeh) p.add(circle(x, y, r), c);
  const sparkles = [[110, 340, 22], [900, 330, 20], [400, 370, 18], [960, 90, 18], [40, 90, 18], [700, 470, 16], [330, 520, 16], [860, 540, 18]];
  for (const [x, y, r] of sparkles) p.add(star(x, y, r, r * 0.32, 4, -90, 1), 'cream');

  // Hängende Faltsterne
  for (const [x, y, r] of [[180, 215, 100], [420, 135, 78], [820, 215, 98]]) {
    p.line(polyline([[x, -10], [x, y - r + 4]]), 3, '#d9c08a');
    foldedStar(x, y, r, r * 0.45, 5, -90).forEach((f, i) => p.add(f, i % 2 ? 'gold' : 'goldLight'));
  }

  // Tisch und Schatten
  p.add(rect(-10, 690, 1020, 330), 'wood');
  p.add(ellipse(500, 790, 440, 190), 'woodDark');

  // Kranz in Draufsicht berechnen, dann perspektivisch stauchen
  const CX = 500, CY = 760, KY = 0.42, RC = 330;
  const proj = (path) => path.mapPts((u, v) => [CX + u, CY + v * KY]);
  const at = (deg, r = RC) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
  const yOf = (deg) => CY + RC * Math.sin((deg * Math.PI) / 180) * KY;

  p.add(proj(ellipse(0, 0, RC + 78, RC + 78)), 'greenDeep');
  p.add(proj(ellipse(0, -10, RC - 92, RC - 92)), 'woodDark');
  p.add(proj(ellipse(0, 12, RC - 98, RC - 98)), 'wood');

  const greens = ['green2', 'green3', 'green1'];
  let leafNo = 0;
  const leafAt = (u, v, dirDeg, len, wid) => {
    const path = leaf(len, wid).rotate(dirDeg + 90).translate(u, v);
    p.add(proj(path), greens[leafNo++ % 3]);
  };
  // Fischgrät-Blätter entlang des Rings; dir = +1 (θ steigt) oder −1
  const walk = (from, to, step) => {
    const dir = Math.sign(to - from);
    for (let d = from; dir > 0 ? d <= to : d >= to; d += step * dir) {
      const [u, v] = at(d);
      const tang = d + 90 * dir; // Laufrichtung
      const [ou, ov] = at(d, 1);
      leafAt(u + ou * 34, v + ov * 34, tang - 38 * dir, 132, 34);
      leafAt(u - ou * 30, v - ov * 30, tang + 38 * dir, 124, 32);
      leafAt(u, v, tang, 118, 30);
    }
  };
  const collar = (deg) => {
    const [u, v] = at(deg);
    for (const a of [200, 250, 290, 340]) {
      const [du, dv] = [Math.cos((a * Math.PI) / 180) * -1, Math.sin((a * Math.PI) / 180) * -1];
      leafAt(u + du * 30, v + dv * 30, a + 180, 112, 30);
    }
  };

  const candle = (deg, h, w) => {
    const [u] = at(deg);
    const x = CX + u;
    const base = yOf(deg) + 26;
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
  walk(180, 360, 13);
  flames.push(candle(284, 300, 96));
  collar(284);
  flames.push(candle(196, 268, 96));
  collar(196);
  walk(180, 0, 13);
  flames.push(candle(16, 238, 98));
  collar(16);
  flames.push(candle(106, 206, 100));
  collar(106);

  // Tannenzapfen (Schuppenreihen, Spitze zuerst)
  const cone = (u, v, ang) => {
    const rows = [
      [0, 22, 'woodDark'], [-20, 30, 'wood'], [-40, 34, 'woodDark'], [-60, 34, 'wood'], [-80, 28, 'woodDark'],
    ];
    rows.forEach(([y, hw, c], i) => {
      const n = i === 0 ? 1 : 3;
      const pts = [[-hw, y - 30], [hw, y - 30]];
      for (let k = 0; k <= n; k++) pts.push([hw - (2 * hw * k) / n, y]);
      const bul = pts.map((_, j) => (j >= 2 ? 0.5 : 0));
      bul[1] = 0;
      const shape = bumpy([pts[0], pts[1], ...pts.slice(2)], [0, 0, ...Array(n).fill(0.5), 0]);
      p.add(shape.rotate(ang).translate(u, v), c);
    });
  };
  cone(250, 850, -112);
  cone(812, 700, 100);

  // Beeren
  const berries = [
    [178, 800], [204, 818], [176, 830],
    [600, 640], [626, 626], [624, 660],
    [858, 820], [884, 804], [884, 840],
  ];
  for (const [x, y] of berries) p.add(circle(x, y, 15), 'red');

  // Goldkugeln
  for (const [x, y] of [[330, 680], [690, 885], [180, 700]]) {
    p.add(circle(x, y, 30), 'amber');
    p.add(circle(x - 4, y - 4, 25), 'gold');
  }

  // Schleife vorne rechts
  const bx = 560, by = 915;
  p.add(smooth([[bx - 8, by + 8], [bx - 30, by + 44], [bx - 48, by + 74, 1], [bx - 28, by + 68], [bx - 16, by + 78, 1], [bx + 6, by + 12]]), 'redDark');
  p.add(smooth([[bx + 8, by + 8], [bx + 36, by + 42], [bx + 56, by + 70, 1], [bx + 36, by + 66], [bx + 24, by + 76, 1], [bx - 4, by + 12]]), 'redDark');
  p.add(smooth([[bx, by], [bx - 44, by - 44], [bx - 94, by - 40], [bx - 98, by + 6], [bx - 56, by + 24]]), 'red');
  p.add(smooth([[bx, by], [bx + 44, by - 44], [bx + 94, by - 40], [bx + 98, by + 6], [bx + 56, by + 24]]), 'red');
  p.add(smooth([[bx - 22, by - 6], [bx - 54, by - 24], [bx - 76, by - 16], [bx - 58, by + 4]]), 'redLight');
  p.add(smooth([[bx + 22, by - 6], [bx + 54, by - 24], [bx + 76, by - 16], [bx + 58, by + 4]]), 'redLight');
  p.add(roundPoly([[bx - 22, by - 22], [bx + 22, by - 22], [bx + 18, by + 22], [bx - 18, by + 22]], 10), 'redDark');

  // Flammen
  for (const f of flames) {
    p.add(drop(f.x, f.top - 36, 40, 70), 'gold');
    p.add(drop(f.x, f.top - 32, 21, 38), 'goldLight');
  }

  return p;
}
