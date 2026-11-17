// Märchenschloss auf dem Hügel mit Regenbogen, Fahnen, Wolken und Bäumen im Abendlicht.
import { Pic, Path, bumpy, rect, circle, smooth, poly, roundPoly, cloud, wavePts, band, archBand } from './lib.mjs';

export const meta = {
  id: 'b-schloss',
  title: 'Märchenschloss',
  category: 'Fantasie',
  palette: {
    sky1: '#c6b5ea',
    sky2: '#e4c0e4',
    sky3: '#f7d5cf',
    sky4: '#fdebd1',
    white: '#ffffff',
    wall1: '#f6eee8',
    wall2: '#dacde2',
    wall3: '#b7a6cc',
    roof1: '#7fa8e1',
    roof2: '#5a82c4',
    pink: '#f39cb9',
    pinkD: '#d86a95',
    win: '#ffd877',
    wood: '#a7704e',
    green1: '#aad47b',
    green2: '#77b45f',
    green3: '#4f8e53',
    path: '#f2daa9',
  },
};

/** Rechteck mit Rundbogen oben. */
function arch(x, y, w, h) {
  const r = w / 2;
  return new Path([
    ['M', x, y + h],
    ['L', x, y + r],
    ['A', r, r, 0, 0, 1, x + w, y + r],
    ['L', x + w, y + h],
    ['Z'],
  ]);
}

export default function build() {
  const p = new Pic(meta);

  p.tag('himmel');
  p.add(rect(-10, -10, 1020, 1020), 'sky1');
  p.add(band(wavePts(-10, 1010, 220, 12, 520, 0.6), 1010), 'sky2');
  p.add(band(wavePts(-10, 1010, 390, 12, 480, 2.4), 1010), 'sky3');
  p.add(band(wavePts(-10, 1010, 540, 10, 440, 4.2), 1010), 'sky4');
  p.tag('sterne');
  for (const [x, y, r] of [[90, 80, 30], [880, 90, 26], [190, 250, 22], [790, 250, 22], [640, 50, 22], [340, 40, 22]]) {
    p.add(poly([[x, y - r], [x + r * 0.3, y - r * 0.3], [x + r, y], [x + r * 0.3, y + r * 0.3], [x, y + r], [x - r * 0.3, y + r * 0.3], [x - r, y], [x - r * 0.3, y - r * 0.3]]), 'white');
  }

  // Regenbogen hinter dem Schloss
  p.tag('regenbogen');
  const rb = ['pink', 'win', 'green1', 'roof1', 'sky1'];
  rb.forEach((c, i) => p.add(archBand(500, 700, 440 - (i + 1) * 34, 400 - (i + 1) * 34, 440 - i * 34, 400 - i * 34), c));

  // Wolken an den Enden des Regenbogens
  p.tag('wolken');
  const cl = (x, y, w, c) => {
    const h = w * 0.34;
    p.add(cloud(x, x + w, y, [[x + w * 0.15, y - h * 0.5], [x + w * 0.36, y - h * 1.0], [x + w * 0.62, y - h * 0.95], [x + w * 0.84, y - h * 0.48]], 0.55, -0.1), c);
  };
  cl(-20, 700, 290, 'white');
  cl(730, 700, 290, 'white');

  // Hügel und Weg
  p.tag('huegel');
  p.add(band([[-10, 760], [200, 720], [500, 700], [800, 722], [1010, 770]], 1010), 'green1');
  p.add(smooth([[470, 770, 1], [530, 770, 1], [560, 860], [640, 940], [660, 1010, 1], [420, 1010, 1], [460, 930], [470, 850]]), 'path');
  p.add(band([[-10, 880], [200, 850], [440, 905]], 1010), 'green2');
  p.add(band([[640, 905], [820, 860], [1010, 880]], 1010), 'green2');

  // Bäume
  p.tag('baeume');
  const tree = (x, y, r) => {
    p.add(rect(x - 12, y - 10, 24, 80), 'wood');
    p.add(bumpy([[x - r, y], [x - r * 0.9, y - r * 0.9], [x, y - r * 1.4], [x + r * 0.9, y - r * 0.9], [x + r, y]], 0.42), 'green2');
    p.add(circle(x - r * 0.3, y - r * 0.6, r * 0.32), 'green1');
  };
  tree(110, 790, 70);
  tree(890, 790, 70);

  // Schloss: hintere Türme
  p.tag('schloss');
  for (const x of [370, 630]) {
    p.add(rect(x - 25, 240, 50, 330), 'wall2');
    p.add(poly([[x - 36, 246], [x, 130], [x + 36, 246]]), 'roof2');
  }
  // Mauer mit Zinnen
  const top = [];
  for (let x = 250; x < 750; x += 50) top.push([x, 512], [x + 30, 512], [x + 30, 540], [x + 50, 540]);
  p.add(poly([...top, [750, 512], [750, 780], [250, 780]]), 'wall1');
  p.add(rect(250, 742, 500, 38), 'wall2');
  // Bergfried
  p.add(rect(400, 290, 200, 300), 'wall1');
  p.add(rect(556, 290, 44, 300), 'wall2');
  p.add(poly([[378, 304], [500, 112], [500, 304]]), 'roof1');
  p.add(poly([[500, 112], [622, 304], [500, 304]]), 'roof2');
  p.add(bumpy([[384, 300], [432, 300], [480, 300], [528, 300], [576, 300], [616, 300], [616, 316], [384, 316]], [0.3, 0.3, 0.3, 0.3, 0.3, 0, 0, 0], {}), 'pink');
  p.add(rect(494, 56, 12, 60), 'wood');
  p.add(poly([[506, 58], [574, 76], [506, 96]]), 'pinkD');
  p.add(circle(500, 370, 38), 'pink');
  p.add(circle(500, 370, 22), 'win');
  p.add(arch(440, 430, 44, 70), 'win');
  p.add(arch(516, 430, 44, 70), 'win');
  // Seitentürme
  for (const [cx, s] of [[275, 1], [725, -1]]) {
    p.add(rect(cx - 55, 380, 110, 400), 'wall1');
    p.add(rect(cx + (s > 0 ? 20 : -55), 380, 35, 400), 'wall2');
    p.add(rect(cx - 55, 580, 110, 22), 'wall3');
    p.add(poly([[cx - 76, 392], [cx, 186], [cx, 392]]), s > 0 ? 'roof1' : 'roof2');
    p.add(poly([[cx, 186], [cx + 76, 392], [cx, 392]]), s > 0 ? 'roof2' : 'roof1');
    p.add(rect(cx - 6, 130, 12, 60), 'wood');
    p.add(poly([[cx + 6, 132], [cx + 64, 148], [cx + 6, 166]]), 'pink');
    p.add(arch(cx - 22, 450, 44, 74), 'win');
    p.add(arch(cx - 20, 640, 40, 62), 'win');
  }
  // Fenster in der Mauer, Tor
  p.add(arch(358, 610, 44, 64), 'win');
  p.add(arch(598, 610, 44, 64), 'win');
  p.add(arch(426, 622, 148, 158), 'wall3');
  p.add(arch(446, 642, 108, 138), 'wood');
  p.add(rect(446, 742, 108, 38), 'path');
  // Büsche vor der Mauer
  p.tag('buesche');
  for (const [x, w] of [[180, 130], [690, 130]]) {
    p.add(bumpy([[x, 790], [x + w * 0.2, 752], [x + w * 0.5, 742], [x + w * 0.8, 752], [x + w, 790]], 0.5), 'green3');
  }
  // Blumen auf der Wiese
  p.tag('blumen');
  for (const [x, y, c] of [[80, 930, 'pink'], [200, 970, 'pinkD'], [330, 930, 'pink'], [760, 950, 'pinkD'], [880, 920, 'pink'], [950, 985, 'pink'], [300, 830, 'white'], [700, 830, 'white']]) {
    const r = 26;
    const pts = Array.from({ length: 5 }, (_, i) => [x + r * 0.6 * Math.cos((i * 2 * Math.PI) / 5 - 1.57), y + r * 0.6 * Math.sin((i * 2 * Math.PI) / 5 - 1.57)]);
    p.add(bumpy(pts, 0.75), c);
    p.add(circle(x, y, 11.5), 'win');
  }
  return p;
}
