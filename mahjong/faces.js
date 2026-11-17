// Zeichnet die Bilder auf den Steinen (Canvas 2D). Keine DOM-Abhängigkeit ausser dem ctx.
//
// drawFace(ctx, set, face, w, h): zeichnet Bild `face` (0..41) in das Rechteck (0,0,w,h).
// Klassische Bilder sind eigene Zeichnungen in einem 100 × 132 Raster.

import { tilesetById } from './data/tilesets.js';

const INK = '#1f3557';
const RED = '#c8372d';
const GREEN = '#2b8a4b';
const BLUE = '#2d63b5';
const GOLD = '#e0a21e';

export const BONUS_TINT = [
  { fill: '#ffe4ea', ring: '#e6738f' },   // Gruppe A (Blumen)
  { fill: '#fff1c9', ring: '#d9a21b' },   // Gruppe B (Jahreszeiten)
];

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif';

export function drawFace(ctx, setId, face, w, h) {
  const set = tilesetById(setId);
  const bonus = face >= 34 ? (face < 38 ? 0 : 1) : -1;
  if (bonus >= 0) drawBonusMark(ctx, bonus, w, h);
  if (set.kind === 'emoji') {
    const ch = face < 34 ? set.faces[face] : set.bonus[bonus][(face - 34) % 4];
    drawEmoji(ctx, ch, w, h, bonus >= 0 ? 0.7 : 0.8);
    return;
  }
  ctx.save();
  ctx.scale(w / 100, h / 132);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (face < 9) drawDots(ctx, face + 1);
  else if (face < 18) drawBamboo(ctx, face - 8);
  else if (face < 27) drawCharacter(ctx, face - 17);
  else if (face < 31) drawWind(ctx, face - 27);
  else if (face < 34) drawDragon(ctx, face - 31);
  else if (face < 38) drawFlower(ctx, face - 34);
  else drawSeason(ctx, face - 38);
  ctx.restore();
}

function drawBonusMark(ctx, g, w, h) {
  const t = BONUS_TINT[g];
  ctx.save();
  rr(ctx, -w * 0.02, -h * 0.02, w * 1.04, h * 1.04, w * 0.1);
  ctx.fillStyle = t.fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.045);
  ctx.strokeStyle = t.ring;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.restore();
}

function drawEmoji(ctx, ch, w, h, k) {
  const size = w * k;
  ctx.save();
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Emoji sitzen optisch etwas tief – leicht anheben
  ctx.fillText(ch, w / 2, h / 2 + size * 0.04);
  ctx.restore();
}

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

// ---------------------------------------------------------------- Kreise (Münzen)

function coin(ctx, x, y, r, color) {
  circle(ctx, x, y, r, color);
  circle(ctx, x, y, r * 0.76, '#fffaf0');
  circle(ctx, x, y, r * 0.58, color);
  // kleine Speichen
  ctx.save();
  ctx.strokeStyle = '#fffaf0';
  ctx.lineWidth = r * 0.12;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
    ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
    ctx.moveTo(x - Math.cos(a) * r * 0.2, y - Math.sin(a) * r * 0.2);
    ctx.lineTo(x - Math.cos(a) * r * 0.5, y - Math.sin(a) * r * 0.5);
    ctx.stroke();
  }
  ctx.restore();
  circle(ctx, x, y, r * 0.2, '#fffaf0');
  circle(ctx, x - r * 0.3, y - r * 0.32, r * 0.13, 'rgba(255,255,255,.55)');
}

function drawDots(ctx, n) {
  const B = BLUE, G = GREEN, R = RED;
  const P = {
    2: [[50, 38, 21, G], [50, 94, 21, B]],
    3: [[25, 30, 17, B], [50, 66, 17, R], [75, 102, 17, G]],
    4: [[29, 40, 18, B], [71, 40, 18, G], [29, 92, 18, G], [71, 92, 18, B]],
    5: [[27, 32, 16, B], [73, 32, 16, G], [50, 66, 16, R], [27, 100, 16, G], [73, 100, 16, B]],
    6: [[30, 28, 15, G], [70, 28, 15, G], [30, 68, 15, R], [70, 68, 15, R], [30, 104, 15, R], [70, 104, 15, R]],
    7: [[24, 20, 12, G], [50, 33, 12, G], [76, 46, 12, G], [32, 78, 13, R], [68, 78, 13, R], [32, 108, 13, R], [68, 108, 13, R]],
    8: [[30, 20, 13, B], [70, 20, 13, B], [30, 51, 13, B], [70, 51, 13, B], [30, 82, 13, B], [70, 82, 13, B], [30, 113, 13, B], [70, 113, 13, B]],
    9: [[21, 28, 13, B], [50, 28, 13, B], [79, 28, 13, B], [21, 66, 13, R], [50, 66, 13, R], [79, 66, 13, R], [21, 104, 13, G], [50, 104, 13, G], [79, 104, 13, G]],
  };
  if (n === 1) {
    // Grosse Schmuckmünze
    circle(ctx, 50, 66, 40, GREEN);
    circle(ctx, 50, 66, 34, '#fffaf0');
    ctx.save();
    ctx.fillStyle = BLUE;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(50 + Math.cos(a) * 29, 66 + Math.sin(a) * 29, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    circle(ctx, 50, 66, 22, RED);
    circle(ctx, 50, 66, 16, '#fffaf0');
    ctx.save();
    ctx.fillStyle = RED;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(50 + Math.cos(a) * 8, 66 + Math.sin(a) * 8, 6, 3.4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    circle(ctx, 50, 66, 4, GOLD);
    return;
  }
  for (const [x, y, r, c] of P[n]) coin(ctx, x, y, r, c);
}

// ---------------------------------------------------------------- Bambus

function stick(ctx, x, y, len, color, wid = 10, ang = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const dark = color === RED ? '#8f2019' : color === BLUE ? '#1d4585' : '#1b5e33';
  rr(ctx, -wid / 2, -len / 2, wid, len, wid / 2);
  ctx.fillStyle = color;
  ctx.fill();
  // Knoten
  ctx.fillStyle = dark;
  for (const f of [-0.5, 0, 0.5]) {
    const yy = f * (len - wid * 0.6);
    rr(ctx, -wid * 0.62, yy - wid * 0.16, wid * 1.24, wid * 0.32, wid * 0.16);
    ctx.fill();
  }
  // Glanzlinie
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = wid * 0.18;
  ctx.beginPath();
  ctx.moveTo(-wid * 0.18, -len / 2 + wid * 0.6);
  ctx.lineTo(-wid * 0.18, -wid * 0.35);
  ctx.moveTo(-wid * 0.18, wid * 0.35);
  ctx.lineTo(-wid * 0.18, len / 2 - wid * 0.6);
  ctx.stroke();
  ctx.restore();
}

function drawBamboo(ctx, n) {
  const G = GREEN, R = RED, B = BLUE;
  if (n === 1) {
    // Kleiner Vogel auf einem Zweig (eigene Zeichnung)
    ctx.save();
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(14, 112); ctx.quadraticCurveTo(50, 100, 88, 110);
    ctx.stroke();
    // Schwanzfedern
    const tail = [[-0.5, G], [-0.15, R], [0.2, B]];
    for (const [a, c] of tail) {
      ctx.save();
      ctx.translate(36, 80);
      ctx.rotate(Math.PI * 0.8 + a);
      ctx.beginPath();
      ctx.ellipse(22, 0, 22, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.restore();
    }
    // Körper
    ctx.beginPath();
    ctx.ellipse(54, 74, 24, 20, -0.35, 0, Math.PI * 2);
    ctx.fillStyle = G;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(58, 80, 14, 10, -0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#7fcf8e';
    ctx.fill();
    // Kopf
    circle(ctx, 70, 46, 14, G);
    circle(ctx, 74, 43, 3.6, '#fffaf0');
    circle(ctx, 75, 43, 2, INK);
    // Schnabel
    ctx.beginPath();
    ctx.moveTo(82, 44); ctx.lineTo(95, 49); ctx.lineTo(82, 52);
    ctx.closePath();
    ctx.fillStyle = GOLD;
    ctx.fill();
    // Haube
    ctx.beginPath();
    ctx.moveTo(62, 35); ctx.quadraticCurveTo(60, 18, 70, 22); ctx.quadraticCurveTo(70, 28, 68, 33);
    ctx.fillStyle = R;
    ctx.fill();
    // Beine
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(52, 92); ctx.lineTo(50, 104);
    ctx.moveTo(60, 92); ctx.lineTo(60, 104);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const L = 44, S = 32;
  const P = {
    2: [[50, 38, L, G], [50, 94, L, B]],
    3: [[50, 38, L, G], [30, 94, L, G], [70, 94, L, G]],
    4: [[30, 38, L, G], [70, 38, L, B], [30, 94, L, B], [70, 94, L, G]],
    5: [[24, 38, L, G], [76, 38, L, B], [50, 66, L, R], [24, 94, L, B], [76, 94, L, G]],
    6: [[24, 38, L, G], [50, 38, L, G], [76, 38, L, G], [24, 94, L, B], [50, 94, L, B], [76, 94, L, B]],
    7: [[50, 24, S, R], [24, 68, S, G], [50, 68, S, G], [76, 68, S, G], [24, 108, S, G], [50, 108, S, G], [76, 108, S, G]],
    8: [[20, 38, L, G, 0.32], [40, 38, L, G, -0.32], [60, 38, L, G, 0.32], [80, 38, L, G, -0.32],
      [20, 94, L, B, -0.32], [40, 94, L, B, 0.32], [60, 94, L, B, -0.32], [80, 94, L, B, 0.32]],
    9: [[24, 26, S, G], [50, 26, S, R], [76, 26, S, B], [24, 66, S, G], [50, 66, S, R], [76, 66, S, B], [24, 106, S, G], [50, 106, S, R], [76, 106, S, B]],
  };
  for (const [x, y, len, c, a] of P[n]) stick(ctx, x, y, len, c, n === 8 ? 9 : 11, a || 0);
}

// ---------------------------------------------------------------- Zeichen (Pinselstriche)

// Pinselstriche der Zahlen 1–9 in einem Feld 100 × 60 (Polylinien)
const NUMERALS = {
  1: [[[12, 32], [50, 29], [88, 31]]],
  2: [[[26, 16], [74, 15]], [[12, 46], [50, 44], [88, 46]]],
  3: [[[24, 10], [76, 9]], [[30, 30], [70, 29]], [[12, 52], [50, 50], [88, 52]]],
  4: [[[18, 8], [18, 54]], [[18, 8], [82, 8], [82, 54]], [[40, 10], [38, 26], [30, 36]], [[60, 10], [60, 32], [70, 34]], [[18, 52], [82, 52]]],
  5: [[[20, 8], [80, 8]], [[48, 8], [40, 50]], [[26, 28], [68, 28], [66, 50]], [[12, 52], [88, 52]]],
  6: [[[48, 2], [54, 12]], [[14, 22], [86, 22]], [[38, 32], [20, 54]], [[62, 32], [82, 52]]],
  7: [[[12, 28], [88, 20]], [[40, 4], [40, 44], [48, 52], [86, 52], [88, 42]]],
  8: [[[40, 8], [34, 34], [14, 54]], [[58, 8], [64, 34], [88, 54]]],
  9: [[[44, 4], [42, 30], [16, 56]], [[20, 22], [66, 20], [64, 50], [84, 54], [90, 44]]],
};

function strokes(ctx, list, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of list) {
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    for (let k = 1; k < line.length; k++) ctx.lineTo(line[k][0], line[k][1]);
    ctx.stroke();
  }
  ctx.restore();
}

// Rotes Schmuckzeichen für die Zeichen-Steine (frei gestaltet)
const ORNAMENT = [
  [[14, 6], [86, 6]], [[34, 0], [34, 13]], [[66, 0], [66, 13]],
  [[26, 18], [74, 18], [74, 36], [26, 36], [26, 18]], [[26, 27], [74, 27]], [[50, 18], [50, 36]],
  [[18, 44], [18, 60]], [[18, 42], [82, 42], [82, 58], [74, 60]], [[50, 36], [50, 56]], [[34, 56], [62, 46]],
];

function drawCharacter(ctx, n) {
  ctx.save();
  ctx.translate(4, 8);
  ctx.scale(0.92, 0.95);
  strokes(ctx, NUMERALS[n], INK, 9.5);
  ctx.restore();
  ctx.save();
  ctx.translate(8, 70);
  ctx.scale(0.66, 0.84);
  strokes(ctx, ORNAMENT, RED, 8);
  ctx.restore();
  cornerIndex(ctx, String(n));
}

function cornerIndex(ctx, txt) {
  ctx.save();
  ctx.font = '800 22px ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fffaf0';
  ctx.strokeText(txt, 88, 112);
  ctx.fillStyle = INK;
  ctx.fillText(txt, 88, 112);
  ctx.restore();
}

// ---------------------------------------------------------------- Winde

const WIND_LETTERS = ['O', 'S', 'W', 'N'];
const WIND_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

function drawWind(ctx, k) {
  // Kompassring mit roter Spitze in Windrichtung
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(50, 66, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (let q = 0; q < 4; q++) {
    const a = (q * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(50 + Math.cos(a) * 36, 66 + Math.sin(a) * 36);
    ctx.lineTo(50 + Math.cos(a) * 44, 66 + Math.sin(a) * 44);
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const a = WIND_ANGLE[k];
  ctx.translate(50, 66);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(48, 0);
  ctx.lineTo(32, -10);
  ctx.lineTo(36, 0);
  ctx.lineTo(32, 10);
  ctx.closePath();
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = '900 58px ui-rounded, "SF Pro Rounded", -apple-system, system-ui, "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(WIND_LETTERS[k], 50, 69);
  ctx.restore();
}

// ---------------------------------------------------------------- Drachen

function drawDragon(ctx, k) {
  if (k === 0) {
    // Roter Drache: kräftiges Zeichen
    strokes(ctx, [[[26, 42], [74, 42], [74, 86], [26, 86], [26, 42]], [[50, 16], [50, 116]]], RED, 11);
    ctx.save();
    ctx.globalAlpha = 0.25;
    strokes(ctx, [[[30, 46], [70, 46]]], '#fff', 3);
    ctx.restore();
  } else if (k === 1) {
    // Grüner Drache: Jade-Wirbel mit Flammen
    ctx.save();
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let t = 0; t <= 1.001; t += 0.02) {
      const a = t * Math.PI * 3.6;
      const r = 6 + t * 30;
      const x = 50 + Math.cos(a) * r, y = 72 + Math.sin(a) * r;
      if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = GREEN;
    for (const [x, s] of [[34, -1], [50, 0], [66, 1]]) {
      ctx.beginPath();
      ctx.moveTo(x - 7, 30);
      ctx.quadraticCurveTo(x + s * 4, 4, x + s * 3, 6);
      ctx.quadraticCurveTo(x + 9, 18, x + 7, 30);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    circle(ctx, 50, 72, 6, GOLD);
  } else {
    // Weisser Drache: blauer Doppelrahmen
    ctx.save();
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 7;
    rr(ctx, 16, 14, 68, 104, 8);
    ctx.stroke();
    ctx.lineWidth = 3;
    rr(ctx, 28, 26, 44, 80, 4);
    ctx.stroke();
    ctx.fillStyle = BLUE;
    for (const [x, y] of [[16, 14], [84, 14], [16, 118], [84, 118]]) circle(ctx, x, y, 6, BLUE);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Blumen

function petals(ctx, cx, cy, count, len, wid, color, rot = 0) {
  ctx.save();
  ctx.fillStyle = color;
  for (let k = 0; k < count; k++) {
    const a = rot + (k / count) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * len * 0.55, cy + Math.sin(a) * len * 0.55, len * 0.55, wid, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function leaf(ctx, x, y, len, wid, ang, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function stem(ctx, pts, color = '#4f8a3a', w = 4) {
  strokes(ctx, [pts], color, w);
}

function drawFlower(ctx, k) {
  if (k === 0) {
    // Pflaumenblüte
    stem(ctx, [[20, 120], [40, 96], [46, 70]], '#7a5230', 5);
    stem(ctx, [[40, 96], [70, 92], [82, 80]], '#7a5230', 4);
    petals(ctx, 50, 56, 5, 26, 11, '#f48fb1', -Math.PI / 2);
    circle(ctx, 50, 56, 9, '#ffd54f');
    circle(ctx, 80, 80, 8, '#f8bbd0');
  } else if (k === 1) {
    // Orchidee
    leaf(ctx, 50, 118, 46, 9, -1.9, '#4f8a3a');
    leaf(ctx, 50, 118, 46, 9, -1.2, '#5e9e47');
    petals(ctx, 50, 54, 3, 34, 12, '#9c6ad6', -Math.PI / 2);
    petals(ctx, 50, 54, 2, 22, 8, '#c39bf0', Math.PI * 0.25);
    circle(ctx, 50, 58, 8, '#ffe082');
    circle(ctx, 50, 60, 4, '#d84f6b');
  } else if (k === 2) {
    // Chrysantheme
    stem(ctx, [[50, 124], [50, 80]], '#4f8a3a', 5);
    leaf(ctx, 50, 104, 26, 8, -0.5, '#5e9e47');
    petals(ctx, 50, 54, 16, 30, 4.6, '#f39c12');
    petals(ctx, 50, 54, 12, 20, 4, '#f7c948', 0.2);
    circle(ctx, 50, 54, 8, '#d35400');
  } else {
    // Seerose
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(50, 104, 40, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5e9e47';
    ctx.fill();
    ctx.restore();
    ctx.save();
    for (const [a, c] of [[-2.5, '#f8bbd0'], [-0.64, '#f8bbd0'], [-2.0, '#f48fb1'], [-1.14, '#f48fb1'], [-1.57, '#ec6f98']]) {
      ctx.save();
      ctx.translate(50, 88);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(22, -14, 46, 0);
      ctx.quadraticCurveTo(22, 14, 0, 0);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    circle(ctx, 50, 80, 6, '#ffd54f');
  }
  bonusIndex(ctx, k + 1, BONUS_TINT[0].ring);
}

// ---------------------------------------------------------------- Jahreszeiten

function drawSeason(ctx, k) {
  if (k === 0) {
    // Frühling: Spross mit Knospe
    stem(ctx, [[50, 120], [50, 60]], '#4f8a3a', 6);
    leaf(ctx, 50, 92, 38, 13, -0.55, '#6abf4b');
    leaf(ctx, 50, 78, 34, 12, -2.6, '#58a83c');
    ctx.beginPath();
    ctx.ellipse(50, 44, 13, 19, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f48fb1';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(46, 40, 4, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fill();
  } else if (k === 1) {
    // Sommer: Sonne
    ctx.save();
    ctx.translate(50, 64);
    ctx.fillStyle = '#f5a623';
    for (let q = 0; q < 12; q++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(-6, -30); ctx.lineTo(0, -46); ctx.lineTo(6, -30);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    circle(ctx, 50, 64, 27, '#f7c948');
    circle(ctx, 50, 64, 20, '#ffd95a');
    circle(ctx, 42, 56, 6, 'rgba(255,255,255,.5)');
  } else if (k === 2) {
    // Herbst: Ahornblatt
    ctx.save();
    ctx.translate(50, 62);
    ctx.fillStyle = '#e8702a';
    ctx.beginPath();
    const pts = [[0, -44], [9, -22], [26, -30], [20, -10], [40, -8], [24, 6], [30, 20], [8, 14], [0, 30], [-8, 14], [-30, 20], [-24, 6], [-40, -8], [-20, -10], [-26, -30], [-9, -22]];
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a8461a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 54); ctx.lineTo(0, -30);
    ctx.moveTo(0, 0); ctx.lineTo(-22, -16);
    ctx.moveTo(0, 0); ctx.lineTo(22, -16);
    ctx.stroke();
    ctx.restore();
  } else {
    // Winter: Schneeflocke
    ctx.save();
    ctx.translate(50, 64);
    ctx.strokeStyle = '#3b8fd9';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (let q = 0; q < 6; q++) {
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -40);
      ctx.moveTo(0, -24); ctx.lineTo(-11, -34);
      ctx.moveTo(0, -24); ctx.lineTo(11, -34);
      ctx.stroke();
      ctx.rotate(Math.PI / 3);
    }
    ctx.restore();
    circle(ctx, 50, 64, 7, '#9fd3ff');
  }
  bonusIndex(ctx, k + 1, BONUS_TINT[1].ring);
}

function bonusIndex(ctx, n, color) {
  ctx.save();
  ctx.font = '800 20px ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(String(n), 88, 14);
  ctx.restore();
}
