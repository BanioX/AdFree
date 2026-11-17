// Juwelen – vorgerenderte Sprites (Canvas). Sechs Juwelen, je eigene Form und Farbe,
// dazu Sonderjuwelen (Blitz waagrecht/senkrecht, Bombe, Regenbogen), Eichel und Steine.
// Alles wird einmal pro Zellgrösse in kleine Offscreen-Canvases gezeichnet und danach nur noch kopiert.

import { SP } from './engine.js';

/** Farben der Juwelen: [hell, mittel, dunkel, Kontur] – Index = Farbnummer. */
export const GEM_COLORS = [
  ['#ffb3c1', '#ff4d6d', '#c9184a', '#8a1036'], // 0 Herz (rot)
  ['#ffd8a8', '#ff922b', '#e8590c', '#9c3a06'], // 1 Bernstein (orange)
  ['#fff3bf', '#ffd43b', '#f59f00', '#a86a00'], // 2 Stern (gelb)
  ['#b2f2bb', '#40c057', '#2b8a3e', '#1b5e29'], // 3 Smaragd (grün)
  ['#bfe3ff', '#4dabf7', '#1c6fd1', '#123f86'], // 4 Saphir (blau)
  ['#e5dbff', '#9775fa', '#6741d9', '#3f2591'], // 5 Amethyst (violett)
];
export const gemMain = (c) => (c >= 0 ? GEM_COLORS[c][1] : '#ffffff');

function canvas(s) {
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  return c;
}

function roundPoly(ctx, pts, rad) {
  const n = pts.length;
  ctx.beginPath();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.arcTo(p[0], p[1], q[0], q[1], rad);
  }
  ctx.closePath();
}

const poly = (n, R, rot = -Math.PI / 2, sx = 1, sy = 1) =>
  Array.from({ length: n }, (_, k) => [Math.cos(rot + (k * 2 * Math.PI) / n) * R * sx, Math.sin(rot + (k * 2 * Math.PI) / n) * R * sy]);

/** Pfad der Juwelenform c (Mittelpunkt 0,0, Radius R). */
function shapePath(ctx, c, R) {
  switch (c) {
    case 0: { // Herz
      ctx.beginPath();
      ctx.moveTo(0, R * 0.92);
      ctx.bezierCurveTo(-R * 0.35, R * 0.62, -R * 1.02, R * 0.2, -R * 0.98, -R * 0.3);
      ctx.bezierCurveTo(-R * 0.95, -R * 0.82, -R * 0.3, -R * 1.02, 0, -R * 0.52);
      ctx.bezierCurveTo(R * 0.3, -R * 1.02, R * 0.95, -R * 0.82, R * 0.98, -R * 0.3);
      ctx.bezierCurveTo(R * 1.02, R * 0.2, R * 0.35, R * 0.62, 0, R * 0.92);
      ctx.closePath();
      break;
    }
    case 1: // Bernstein: rund
      ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, Math.PI * 2); ctx.closePath();
      break;
    case 2: { // Stern
      const pts = [];
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 ? R * 0.5 : R * 1.02;
        pts.push([Math.cos(a) * r, Math.sin(a) * r + R * 0.06]);
      }
      roundPoly(ctx, pts, R * 0.12);
      break;
    }
    case 3: // Smaragd: Achteck
      roundPoly(ctx, poly(8, R * 0.95, -Math.PI / 2 + Math.PI / 8), R * 0.14);
      break;
    case 4: // Saphir: Raute
      roundPoly(ctx, [[0, -R * 1.02], [R * 0.82, 0], [0, R * 1.02], [-R * 0.82, 0]], R * 0.16);
      break;
    default: // Amethyst: Dreieck (Spitze oben)
      roundPoly(ctx, [[0, -R * 0.98], [R * 1.0, R * 0.78], [-R * 1.0, R * 0.78]], R * 0.2);
      break;
  }
}

/** Zeichnet ein Juwel der Farbe c zentriert in ctx (Grösse s). */
function drawGem(ctx, c, s, scale = 1) {
  const [light, mid, dark, ink] = GEM_COLORS[c];
  const R = s * 0.4 * scale;
  ctx.save();
  ctx.translate(s / 2, s / 2);
  // weicher Schatten
  ctx.save();
  ctx.translate(0, s * 0.045);
  shapePath(ctx, c, R);
  ctx.fillStyle = 'rgba(60,30,20,.22)';
  ctx.filter = typeof ctx.filter === 'string' ? `blur(${Math.max(1, s * 0.025)}px)` : 'none';
  ctx.fill();
  ctx.restore();
  ctx.filter = 'none';
  // Körper
  shapePath(ctx, c, R);
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.1, 0, 0, R * 1.25);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.strokeStyle = ink;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // innere Facette
  ctx.save();
  shapePath(ctx, c, R);
  ctx.clip();
  ctx.scale(0.58, 0.58);
  ctx.translate(0, -R * 0.08);
  shapePath(ctx, c, R);
  const g2 = ctx.createLinearGradient(0, -R, 0, R);
  g2.addColorStop(0, 'rgba(255,255,255,.55)');
  g2.addColorStop(0.55, 'rgba(255,255,255,.08)');
  g2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g2;
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.stroke();
  ctx.restore();
  // Glanzlicht
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-R * 0.36, -R * 0.42, R * 0.24, R * 0.13, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(R * 0.3, R * 0.32, R * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function sparkle(ctx, x, y, r, col = '#fff') {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fillStyle = col;
  ctx.fill();
}

/** Blitz-Juwel: leuchtender Doppelpfeil quer über dem Juwel. */
function drawLine(ctx, c, s, dir) {
  drawGem(ctx, c, s, 0.92);
  const [, , , ink] = GEM_COLORS[c];
  ctx.save();
  ctx.translate(s / 2, s / 2);
  if (dir === 'v') ctx.rotate(Math.PI / 2);
  const L = s * 0.47, th = s * 0.085, head = s * 0.13;
  const arrow = () => {
    ctx.beginPath();
    ctx.moveTo(-L, 0);
    ctx.lineTo(-L + head, -head * 0.95);
    ctx.lineTo(-L + head, -th / 2);
    ctx.lineTo(L - head, -th / 2);
    ctx.lineTo(L - head, -head * 0.95);
    ctx.lineTo(L, 0);
    ctx.lineTo(L - head, head * 0.95);
    ctx.lineTo(L - head, th / 2);
    ctx.lineTo(-L + head, th / 2);
    ctx.lineTo(-L + head, head * 0.95);
    ctx.closePath();
  };
  ctx.shadowColor = 'rgba(255,255,255,.95)';
  ctx.shadowBlur = s * 0.08;
  arrow();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, s * 0.028);
  ctx.strokeStyle = ink;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Bombe: Juwel in einer schimmernden Seifenblase mit Funken. */
function drawBomb(ctx, c, s) {
  // Explosions-Stern: gezackter, dunkel umrandeter Strahlenkranz hinter dem Juwel + Funken-Plakette.
  const [light, mid, deep, dark] = GEM_COLORS[c];
  ctx.save();
  ctx.translate(s / 2, s / 2);
  const R = s * 0.49, r = s * 0.37, N = 10;
  const burst = () => {
    ctx.beginPath();
    for (let k = 0; k < N * 2; k++) {
      const a = (k / (N * 2)) * Math.PI * 2 - Math.PI / 2;
      const q = k % 2 ? r : R;
      ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q);
    }
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(0, s * 0.025);
  burst();
  ctx.fillStyle = 'rgba(60,30,20,.25)'; ctx.fill();
  ctx.restore();
  burst();
  const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, R);
  g.addColorStop(0, light);
  g.addColorStop(0.6, mid);
  g.addColorStop(1, deep);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, s * 0.045);
  ctx.strokeStyle = hexA(dark, 0.95);
  ctx.stroke();
  // dunkler Ring als Bühne für das Juwel
  ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
  ctx.fillStyle = hexA(dark, 0.8); ctx.fill();
  ctx.restore();
  drawGem(ctx, c, s, 0.7);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  // Funken-Plakette oben rechts
  const bx = s * 0.31, by = -s * 0.31, br = s * 0.12;
  ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fillStyle = '#3a2a2a'; ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeStyle = '#fff'; ctx.stroke();
  sparkle(ctx, bx, by, br * 0.85, '#ffd43b');
  ctx.restore();
}

/** Regenbogen-Kugel. */
function drawRainbow(ctx, s) {
  ctx.save();
  ctx.translate(s / 2, s / 2);
  const R = s * 0.41;
  ctx.save();
  ctx.translate(0, s * 0.04);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(60,30,20,.22)'; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.save(); ctx.clip();
  for (let k = 0; k < 12; k++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R + 2, (k * Math.PI) / 6, ((k + 1) * Math.PI) / 6 + 0.02);
    ctx.closePath();
    ctx.fillStyle = GEM_COLORS[k % 6][1];
    ctx.fill();
  }
  const sh = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R * 1.05);
  sh.addColorStop(0, 'rgba(255,255,255,.95)');
  sh.addColorStop(0.35, 'rgba(255,255,255,.25)');
  sh.addColorStop(1, 'rgba(40,20,60,.35)');
  ctx.fillStyle = sh;
  ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, s * 0.035); ctx.strokeStyle = '#3a2a4a'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-R * 0.35, -R * 0.42, R * 0.25, R * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
  sparkle(ctx, R * 0.42, R * 0.25, s * 0.07);
  ctx.restore();
}

/** Eichel (muss nach unten gebracht werden). */
function drawAcorn(ctx, s) {
  ctx.save();
  ctx.translate(s / 2, s / 2 + s * 0.04);
  const R = s * 0.38;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.strokeStyle = '#4a2c12';
  // Schatten
  ctx.beginPath(); ctx.ellipse(0, R * 1.05, R * 0.6, R * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(60,30,20,.18)'; ctx.fill();
  // Nuss
  ctx.beginPath();
  ctx.moveTo(-R * 0.72, -R * 0.15);
  ctx.bezierCurveTo(-R * 0.8, R * 0.55, -R * 0.25, R * 0.95, 0, R * 1.0);
  ctx.bezierCurveTo(R * 0.25, R * 0.95, R * 0.8, R * 0.55, R * 0.72, -R * 0.15);
  ctx.closePath();
  const g = ctx.createLinearGradient(-R, 0, R, 0);
  g.addColorStop(0, '#f0b36b'); g.addColorStop(0.5, '#d98a3d'); g.addColorStop(1, '#a8601f');
  ctx.fillStyle = g; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-R * 0.32, R * 0.3, R * 0.12, R * 0.32, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
  // Hut
  ctx.beginPath();
  ctx.moveTo(-R * 0.95, -R * 0.1);
  ctx.bezierCurveTo(-R * 1.0, -R * 0.75, R * 1.0, -R * 0.75, R * 0.95, -R * 0.1);
  ctx.quadraticCurveTo(0, R * 0.12, -R * 0.95, -R * 0.1);
  ctx.closePath();
  ctx.fillStyle = '#8a5a2b'; ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(60,30,10,.45)'; ctx.lineWidth = Math.max(1, s * 0.02);
  for (let k = -4; k <= 4; k++) {
    ctx.beginPath(); ctx.moveTo(k * R * 0.28 - R * 0.4, -R); ctx.lineTo(k * R * 0.28 + R * 0.4, R * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k * R * 0.28 + R * 0.4, -R); ctx.lineTo(k * R * 0.28 - R * 0.4, R * 0.2); ctx.stroke();
  }
  ctx.restore();
  // Stiel
  ctx.beginPath(); ctx.moveTo(0, -R * 0.55); ctx.quadraticCurveTo(R * 0.05, -R * 0.85, R * 0.25, -R * 0.95);
  ctx.lineWidth = s * 0.06; ctx.lineCap = 'round'; ctx.strokeStyle = '#4a2c12'; ctx.stroke();
  ctx.restore();
}

/** Stein: hp 1 = Kiesel, hp 2 = harter Granit mit Bändern. */
function drawStone(ctx, s, hp) {
  ctx.save();
  ctx.translate(s / 2, s / 2);
  const R = s * 0.44;
  const pts = [[-R, -R * 0.7], [-R * 0.55, -R], [R * 0.6, -R * 0.95], [R, -R * 0.55], [R * 0.95, R * 0.7], [R * 0.55, R], [-R * 0.6, R * 0.95], [-R * 0.98, R * 0.6]];
  roundPoly(ctx, pts, R * 0.3);
  const g = ctx.createLinearGradient(0, -R, 0, R);
  if (hp >= 2) { g.addColorStop(0, '#9c938a'); g.addColorStop(1, '#5b534c'); } else { g.addColorStop(0, '#d9d2c8'); g.addColorStop(1, '#a39a8e'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.04); ctx.strokeStyle = '#3e3630'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(-R * 0.35, -R * 0.55, R * 0.45, R * 0.18, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  for (const [x, y, r] of [[R * 0.4, R * 0.2, 0.12], [-R * 0.3, R * 0.45, 0.09], [R * 0.05, -R * 0.1, 0.07]]) {
    ctx.beginPath(); ctx.arc(x, y, R * r, 0, Math.PI * 2); ctx.fill();
  }
  if (hp >= 2) {
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.moveTo(-R, -R * 0.15); ctx.lineTo(R, R * 0.25); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,30,25,.35)'; ctx.lineWidth = s * 0.02;
    ctx.beginPath(); ctx.moveTo(-R, -R * 0.02); ctx.lineTo(R, R * 0.38); ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(60,45,35,.55)'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(R * 0.15, -R); ctx.lineTo(0, -R * 0.4); ctx.lineTo(R * 0.25, -R * 0.05); ctx.lineTo(R * 0.1, R * 0.3); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Sprite-Atlas für eine Pixelgrösse. get(piece) → Canvas. */
export function makeSprites(px) {
  const s = Math.max(16, Math.round(px));
  const cache = new Map();
  const make = (key, fn) => {
    let c = cache.get(key);
    if (!c) { c = canvas(s); fn(c.getContext('2d')); cache.set(key, c); }
    return c;
  };
  const api = {
    size: s,
    gem(c, sp = 0) {
      if (sp === SP.RAINBOW) return make('rb', (ctx) => drawRainbow(ctx, s));
      if (sp === SP.H || sp === SP.V) return make(`l${c}${sp}`, (ctx) => drawLine(ctx, c, s, sp === SP.H ? 'h' : 'v'));
      if (sp === SP.BOMB) return make(`b${c}`, (ctx) => drawBomb(ctx, c, s));
      return make(`g${c}`, (ctx) => drawGem(ctx, c, s));
    },
    acorn() { return make('acorn', (ctx) => drawAcorn(ctx, s)); },
    stone(hp) { return make(`st${hp}`, (ctx) => drawStone(ctx, s, hp)); },
    get(p) {
      if (!p) return null;
      if (p.t === 'i') return api.acorn();
      if (p.t === 's') return api.stone(p.hp);
      return api.gem(p.c, p.sp);
    },
  };
  return api;
}

/** Kleines Bild (Data-URL) eines Juwels – für Menü, Ziele, Tutorial. */
const urlCache = new Map();
export function spriteURL(kind, px = 64) {
  const key = kind + '@' + px;
  if (urlCache.has(key)) return urlCache.get(key);
  const atlas = makeSprites(px);
  let c;
  if (kind === 'acorn') c = atlas.acorn();
  else if (kind === 'stone') c = atlas.stone(1);
  else if (kind === 'rainbow') c = atlas.gem(-1, SP.RAINBOW);
  else if (kind.startsWith('h') || kind.startsWith('v') || kind.startsWith('b')) {
    const sp = { h: SP.H, v: SP.V, b: SP.BOMB }[kind[0]];
    c = atlas.gem(+kind.slice(1), sp);
  } else c = atlas.gem(+kind, 0);
  const url = c.toDataURL();
  urlCache.set(key, url);
  return url;
}

/** Eis-Symbol als Data-URL (für die Zielanzeige). */
export function iceURL(px = 64) {
  const key = 'ice@' + px;
  if (urlCache.has(key)) return urlCache.get(key);
  const c = canvas(px);
  const ctx = c.getContext('2d');
  drawIce(ctx, px * 0.08, px * 0.08, px * 0.84, 2);
  const url = c.toDataURL();
  urlCache.set(key, url);
  return url;
}

/** Zeichnet Eis (1 oder 2 Schichten) in ein Feld. */
export function drawIce(ctx, x, y, cs, layers) {
  const r = cs * 0.16, p = cs * 0.04;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + p, y + p, cs - 2 * p, cs - 2 * p, r);
  const g = ctx.createLinearGradient(x, y, x + cs, y + cs);
  if (layers >= 2) { g.addColorStop(0, 'rgba(150,215,245,.95)'); g.addColorStop(1, 'rgba(70,160,215,.95)'); }
  else { g.addColorStop(0, 'rgba(205,240,255,.9)'); g.addColorStop(1, 'rgba(140,205,240,.85)'); }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, cs * 0.035);
  ctx.strokeStyle = layers >= 2 ? 'rgba(40,120,180,.9)' : 'rgba(90,170,215,.85)';
  ctx.stroke();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = cs * 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + cs * 0.18, y + cs * 0.42); ctx.lineTo(x + cs * 0.42, y + cs * 0.18); ctx.stroke();
  ctx.lineWidth = cs * 0.035;
  ctx.beginPath(); ctx.moveTo(x + cs * 0.6, y + cs * 0.86); ctx.lineTo(x + cs * 0.86, y + cs * 0.6); ctx.stroke();
  if (layers >= 2) {
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = Math.max(1, cs * 0.025);
    ctx.beginPath();
    ctx.moveTo(x + cs * 0.12, y + cs * 0.7); ctx.lineTo(x + cs * 0.3, y + cs * 0.62); ctx.lineTo(x + cs * 0.38, y + cs * 0.8);
    ctx.moveTo(x + cs * 0.3, y + cs * 0.62); ctx.lineTo(x + cs * 0.34, y + cs * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}
