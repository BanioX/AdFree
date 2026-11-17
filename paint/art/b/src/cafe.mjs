// Café-Stillleben von oben: Cappuccino mit Milchschaum-Herz, Gipfeli, Macarons, Gänseblümchen.
import { Pic, rect, circle, ellipse, bumpy, arcPts, heart, capsule, petal, poly, smooth } from './lib.mjs';

export const meta = {
  id: 'b-cafe',
  title: 'Kaffee und Gipfeli',
  category: 'Essen',
  palette: {
    cloth: '#bcd9e6',
    white: '#ffffff',
    cream: '#f5ead6',
    creamDark: '#dfcdae',
    coral: '#f08a78',
    coralDark: '#cf6252',
    coffee: '#6e4129',
    crema: '#c58b55',
    milk: '#f8ecd8',
    silver: '#b9c2cc',
    blue: '#7fb2cf',
    gold1: '#e9a748',
    gold2: '#c67a2c',
    gold3: '#f6cd84',
    pink: '#f4a7b9',
    pinkDark: '#de7c96',
    yellow: '#f6c945',
  },
};

export default function build() {
  const p = new Pic(meta);

  // Tischtuch mit Tupfen
  p.add(rect(-10, -10, 1020, 1020), 'cloth');
  const dots = [];
  for (let y = 40; y < 1000; y += 92) {
    const row = Math.round((y - 40) / 92);
    for (let x = row % 2 ? 76 : 30; x < 1000; x += 92) dots.push([x, y]);
  }
  for (const [x, y] of dots) p.filler(circle(x, y, 13), 'milk');

  // Spitzendeckchen
  const C = [420, 450];
  const dp = arcPts(C[0], C[1], 335, 335, 0, 360, 30).slice(0, 30);
  p.add(bumpy(dp, 0.32), 'white');
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    p.filler(circle(C[0] + Math.cos(a) * 292, C[1] + Math.sin(a) * 292, 14), 'cloth');
  }

  // Untertasse
  p.add(circle(C[0], C[1], 232), 'cream');
  p.add(circle(C[0], C[1], 178), 'creamDark');
  // Löffel auf dem Deckchen
  p.add(capsule([150, 395], [196, 228], 22), 'silver');
  p.add(ellipse(140, 440, 40, 27, -76), 'silver');
  // Tasse
  p.add(capsule([C[0] + 140, C[1] + 6], [C[0] + 200, C[1] + 12], 50), 'coralDark');
  p.add(circle(C[0], C[1], 152), 'coral');
  p.add(circle(C[0], C[1], 130), 'crema');
  p.add(circle(C[0], C[1], 112), 'coffee');
  p.add(heart(C[0], C[1] + 8, 156), 'milk');
  p.add(heart(C[0], C[1] + 2, 98), 'crema');
  p.add(heart(C[0], C[1] - 2, 48), 'milk');

  // Teller mit Gipfeli
  const T = [790, 235];
  p.add(circle(T[0], T[1], 188), 'blue');
  p.add(circle(T[0], T[1], 166), 'white');
  // Gipfeli: Sichel mit Teigwülsten (Spitzen zuerst, Mitte zuoberst)
  const SC = [T[0], T[1] + 62];
  const SR = 112;
  const A0 = -172, A1 = -8;
  const sp = (u) => {
    const a = ((A0 + (A1 - A0) * u) * Math.PI) / 180;
    return [Math.cos(a), Math.sin(a)];
  };
  const th = (u) => 10 + 50 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 1.1);
  const outer = (u) => { const [c, s2] = sp(u); return [SC[0] + c * (SR + th(u)), SC[1] + s2 * (SR + th(u))]; };
  const inner = (u) => { const [c, s2] = sp(u); return [SC[0] + c * (SR - th(u) * 0.75), SC[1] + s2 * (SR - th(u) * 0.75)]; };
  const mid = (u, k) => { const [c, s2] = sp(u); const r = SR + th(u) * 0.12 * k; return [SC[0] + c * r, SC[1] + s2 * r]; };
  const cuts = [0, 0.13, 0.28, 0.43, 0.57, 0.72, 0.87, 1];
  const band = (i) => {
    const a = cuts[i] - 0.025;
    const b = cuts[i + 1] + 0.025;
    const pts = [];
    for (let t = 0; t <= 4; t++) pts.push(outer(a + ((b - a) * t) / 4));
    const bul = 0.05;
    pts.push(mid(i === 6 ? 1.0 : b + bul, 1));
    for (let t = 4; t >= 0; t--) pts.push(inner(a + ((b - a) * t) / 4));
    pts.push(mid(i === 0 ? 0 : a - bul, 1));
    return smooth(pts).rotate(-12, T[0], T[1]);
  };
  const order = [0, 6, 1, 5, 2, 4, 3];
  for (const i of order) p.add(band(i), i % 2 ? 'gold2' : 'gold1');
  for (const i of [2, 3, 4]) {
    const u = (cuts[i] + cuts[i + 1]) / 2;
    const [c, s2] = sp(u);
    const r = SR + th(u) * 0.45;
    const ang = (Math.atan2(s2, c) * 180) / Math.PI;
    p.add(ellipse(SC[0] + c * r, SC[1] + s2 * r, 9, i === 3 ? 22 : 16, ang).rotate(-12, T[0], T[1]), 'gold3');
  }

  // Macarons
  const macaron = (x, y, r, a) => {
    p.add(bumpy(arcPts(x, y, r, r, a, a + 360, 16).slice(0, 16), 0.22), 'pinkDark');
    p.add(circle(x, y, r * 0.8), 'pink');
    p.add(ellipse(x - r * 0.28, y - r * 0.3, r * 0.26, r * 0.14, -35), 'white');
  };
  macaron(150, 800, 74, 0);
  macaron(300, 905, 62, 10);

  // Serviette mit Streifen (jeder Streifen ein eigener Bereich)
  const nap = (pts) => poly(pts).rotate(12, 830, 830);
  const bands = [700, 732, 772, 806, 846, 880, 920, 960];
  for (let i = 0; i < bands.length - 1; i++) {
    p.add(nap([[700, bands[i]], [960, bands[i]], [960, bands[i + 1]], [700, bands[i + 1]]]), i % 2 ? 'coral' : 'white');
  }

  // Kaffeebohnen
  const bean = (x, y, a) => {
    // Bohne: zwei Hälften, getrennt durch eine geschwungene Kerbe
    const half = smooth([[-27, 0, 1], [-20, -14], [0, -19], [20, -14], [27, 0, 1], [10, 3], [-10, -3]]);
    const other = smooth([[-27, 0, 1], [-10, -3], [10, 3], [27, 0, 1], [20, 14], [0, 19], [-20, 14]]);
    p.add(half.rotate(a).translate(x, y), 'coffee');
    p.add(other.rotate(a).translate(x, y), 'gold2');
  };
  bean(90, 600, 30);
  bean(60, 660, -20);
  bean(250, 80, -40);
  bean(560, 72, 15);
  bean(620, 860, -10);
  bean(960, 470, 80);
  bean(520, 780, 40);

  // Gänseblümchen
  const daisy = (x, y, r, rot) => {
    for (let i = 0; i < 10; i++) p.add(petal(r, r * 0.27, { pos: 0.6, tip: 0.6 }).rotate(rot + i * 36).translate(x, y), i % 2 ? 'white' : 'milk');
    p.add(circle(x, y, r * 0.32), 'yellow');
  };
  daisy(95, 130, 78, 0);
  daisy(935, 590, 58, 12);
  daisy(470, 910, 62, 5);

  return p;
}
