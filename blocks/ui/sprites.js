// Zeichnet Steine, Edelsteine, verdeckte Felder und das Brett für die drei Stile
// ('jewel', 'soft', 'wood'). Alles wird einmal in kleine Offscreen-Canvas gezeichnet und zwischengespeichert.

import { gems as GEMS } from '../data/skins.js';

// ---------- Farben ----------

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
export const lighten = (c, t) => mix(c, '#ffffff', t);
export const darken = (c, t) => mix(c, '#000000', t);
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function sparkle(ctx, x, y, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}
export { sparkle as drawSparkle };

// ---------- Steine ----------

function drawJewel(ctx, s, col) {
  const pad = s * 0.045;
  const x = pad, y = pad, w = s - 2 * pad;
  const r = w * 0.15;
  const b = w * 0.17;
  ctx.save();
  roundRect(ctx, x, y, w, w, r);
  ctx.fillStyle = darken(col, 0.2);
  ctx.fill();
  ctx.clip();
  const poly = (pts, fill) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  poly([x, y, x + w, y, x + w - b, y + b, x + b, y + b], lighten(col, 0.5));
  poly([x, y, x + b, y + b, x + b, y + w - b, x, y + w], lighten(col, 0.22));
  poly([x + w, y, x + w, y + w, x + w - b, y + w - b, x + w - b, y + b], darken(col, 0.1));
  poly([x, y + w, x + w, y + w, x + w - b, y + w - b, x + b, y + w - b], darken(col, 0.3));
  const fx = x + b, fy = y + b, fw = w - 2 * b;
  const g = ctx.createLinearGradient(fx, fy, fx + fw, fy + fw);
  g.addColorStop(0, lighten(col, 0.16));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darken(col, 0.08));
  ctx.fillStyle = g;
  ctx.fillRect(fx, fy, fw, fw);
  // Glanz
  ctx.globalAlpha = 0.5;
  roundRect(ctx, fx + fw * 0.1, fy + fw * 0.1, fw * 0.5, fw * 0.2, fw * 0.1);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  sparkle(ctx, x + b * 0.85, y + b * 0.85, s * 0.085, '#ffffff', 0.9);
  ctx.save();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, w - 1, r);
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.strokeStyle = darken(col, 0.38);
  ctx.stroke();
  ctx.restore();
}

function drawSoft(ctx, s, col) {
  const pad = s * 0.05;
  const x = pad, y = pad, w = s - 2 * pad;
  const r = w * 0.27;
  const lip = s * 0.06;
  ctx.save();
  roundRect(ctx, x, y + lip * 0.4, w, w - lip * 0.4, r);
  ctx.fillStyle = darken(col, 0.16);
  ctx.fill();
  roundRect(ctx, x, y, w, w - lip, r);
  const g = ctx.createLinearGradient(0, y, 0, y + w);
  g.addColorStop(0, lighten(col, 0.28));
  g.addColorStop(1, col);
  ctx.fillStyle = g;
  ctx.fill();
  roundRect(ctx, x + w * 0.16, y + w * 0.1, w * 0.68, w * 0.24, w * 0.12);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.26, y + w * 0.5, w * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.restore();
}

function drawWood(ctx, s, col, seed) {
  const pad = s * 0.045;
  const x = pad, y = pad, w = s - 2 * pad;
  const r = w * 0.13;
  ctx.save();
  roundRect(ctx, x, y, w, w, r);
  const g = ctx.createLinearGradient(x, y, x + w, y + w);
  g.addColorStop(0, lighten(col, 0.16));
  g.addColorStop(1, darken(col, 0.1));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Maserung
  ctx.strokeStyle = rgba(darken(col, 0.35), 0.32);
  ctx.lineWidth = Math.max(1, s * 0.02);
  for (let k = 0; k < 6; k++) {
    const yy = y + w * (0.12 + k * 0.16) + Math.sin(seed * 1.7 + k) * w * 0.03;
    ctx.beginPath();
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const xx = x + w * t;
      const off = Math.sin(t * 5 + seed + k * 1.3) * w * 0.035;
      if (t === 0) ctx.moveTo(xx, yy + off); else ctx.lineTo(xx, yy + off);
    }
    ctx.stroke();
  }
  if (seed % 3 === 0) {
    ctx.beginPath();
    ctx.ellipse(x + w * 0.68, y + w * 0.62, w * 0.09, w * 0.05, 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(darken(col, 0.4), 0.35);
    ctx.stroke();
  }
  ctx.restore();
  // Kanten
  ctx.save();
  const e = s * 0.05;
  roundRect(ctx, x + e / 2, y + e / 2, w - e, w - e, r * 0.9);
  ctx.lineWidth = e;
  const eg = ctx.createLinearGradient(x, y, x + w, y + w);
  eg.addColorStop(0, rgba(lighten(col, 0.6), 0.75));
  eg.addColorStop(0.5, rgba(col, 0));
  eg.addColorStop(1, rgba(darken(col, 0.45), 0.7));
  ctx.strokeStyle = eg;
  ctx.stroke();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, w - 1, r);
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.strokeStyle = darken(col, 0.5);
  ctx.stroke();
  ctx.restore();
}

const cache = new Map();

/** Stein-Sprite: color = Index 0..7 oder 'gray'. size in CSS-px, dpr = Pixeldichte. */
export function blockSprite(skin, color, size, dpr) {
  const px = Math.max(4, Math.round(size * dpr));
  const key = `b|${skin.id}|${color}|${px}`;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(px, px);
  const ctx = c.getContext('2d');
  const col = color === 'gray' ? skin.gray : color === 'white' ? '#ffffff' : skin.colors[color];
  if (skin.style === 'soft') drawSoft(ctx, px, col);
  else if (skin.style === 'wood') drawWood(ctx, px, col, typeof color === 'number' ? color + 1 : 5);
  else drawJewel(ctx, px, col);
  cache.set(key, c);
  return c;
}

/** Edelstein (ohne Stein darunter). */
export function gemSprite(key, size, dpr) {
  const px = Math.max(4, Math.round(size * dpr));
  const ck = `g|${key}|${px}`;
  let c = cache.get(ck);
  if (c) return c;
  c = makeCanvas(px, px);
  const ctx = c.getContext('2d');
  const gm = GEMS[key] || GEMS.r;
  const s = px;
  const cx = s / 2;
  const gw = s * 0.7, gh = s * 0.6;
  const y0 = s / 2 - gh * 0.5;
  const yg = y0 + gh * 0.34;
  // weicher Schein
  const glow = ctx.createRadialGradient(cx, s / 2, 0, cx, s / 2, s * 0.5);
  glow.addColorStop(0, 'rgba(255,255,255,0.75)');
  glow.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);
  const L = cx - gw / 2, R = cx + gw / 2, TL = cx - gw * 0.28, TR = cx + gw * 0.28, tip = y0 + gh;
  const poly = (pts, fill) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  poly([TL, y0, TR, y0, R, yg, cx, tip, L, yg], gm.color);
  poly([TL, y0, TR, y0, cx + gw * 0.16, yg, cx - gw * 0.16, yg], gm.light);
  poly([L, yg, TL, y0, cx - gw * 0.16, yg], lighten(gm.color, 0.3));
  poly([R, yg, TR, y0, cx + gw * 0.16, yg], gm.color);
  poly([L, yg, cx - gw * 0.16, yg, cx, tip], lighten(gm.color, 0.12));
  poly([cx - gw * 0.16, yg, cx + gw * 0.16, yg, cx, tip], lighten(gm.color, 0.35));
  poly([cx + gw * 0.16, yg, R, yg, cx, tip], gm.dark);
  ctx.beginPath();
  ctx.moveTo(TL, y0); ctx.lineTo(TR, y0); ctx.lineTo(R, yg); ctx.lineTo(cx, tip); ctx.lineTo(L, yg); ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.strokeStyle = gm.dark;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(L, yg); ctx.lineTo(R, yg);
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.stroke();
  sparkle(ctx, TL + gw * 0.08, y0 + gh * 0.12, s * 0.1, '#ffffff', 0.95);
  cache.set(ck, c);
  return c;
}

/** Verdecktes Feld (Bild-Level). */
export function coverSprite(skin, size, dpr) {
  const px = Math.max(4, Math.round(size * dpr));
  const key = `c|${skin.id}|${px}`;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(px, px);
  const ctx = c.getContext('2d');
  const s = px;
  const pad = s * 0.05;
  const w = s - 2 * pad;
  const base = skin.board.cover;
  roundRect(ctx, pad, pad, w, w, w * 0.18);
  const g = ctx.createLinearGradient(0, pad, 0, pad + w);
  g.addColorStop(0, lighten(base, 0.14));
  g.addColorStop(1, base);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba(skin.board.coverMark, 0.35);
  ctx.lineWidth = Math.max(1, s * 0.05);
  for (let k = -2; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(pad + k * w * 0.36, pad + w);
    ctx.lineTo(pad + k * w * 0.36 + w, pad);
    ctx.stroke();
  }
  ctx.restore();
  sparkle(ctx, s * 0.5, s * 0.5, s * 0.16, skin.board.coverMark, 0.95);
  sparkle(ctx, s * 0.27, s * 0.28, s * 0.07, '#ffffff', 0.7);
  roundRect(ctx, pad + 0.5, pad + 0.5, w - 1, w - 1, w * 0.18);
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.stroke();
  cache.set(key, c);
  return c;
}

/** Leeres Feld (Vertiefung im Brett). */
function drawSlot(ctx, skin, x, y, cs) {
  const pad = cs * 0.05;
  const w = cs - 2 * pad;
  const r = w * (skin.style === 'soft' ? 0.24 : 0.16);
  roundRect(ctx, x + pad, y + pad, w, w, r);
  ctx.fillStyle = skin.board.cell;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Innen-Schatten oben, Licht unten
  const g = ctx.createLinearGradient(0, y + pad, 0, y + pad + w);
  const dark = skin.style === 'soft' ? 0.06 : 0.22;
  g.addColorStop(0, `rgba(0,0,0,${dark})`);
  g.addColorStop(0.22, 'rgba(0,0,0,0)');
  g.addColorStop(0.8, 'rgba(255,255,255,0)');
  g.addColorStop(1, `rgba(255,255,255,${skin.style === 'soft' ? 0.5 : 0.08})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, cs, cs);
  ctx.restore();
}

/**
 * Brett-Hintergrund mit leeren Feldern als Canvas (in Gerätepixeln).
 * Rückgabe-Canvas deckt die Fläche (n·cs + 2·pad)² ab.
 */
export function boardBase(skin, n, cs, pad, dpr) {
  const size = n * cs + 2 * pad;
  const px = Math.round(size * dpr);
  const key = `board|${skin.id}|${n}|${cs}|${pad}|${dpr}`;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(px, px);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  roundRect(ctx, 0, 0, size, size, pad * 2.2);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, skin.board.bg[0]);
  g.addColorStop(1, skin.board.bg[1]);
  ctx.fillStyle = g;
  ctx.fill();
  if (skin.style === 'wood') {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = rgba(skin.board.edge, 0.22);
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 26; k++) {
      const yy = (k / 26) * size;
      ctx.beginPath();
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const xx = size * t;
        const off = Math.sin(t * 7 + k * 0.9) * 3 + Math.sin(t * 19 + k) * 1.2;
        if (t === 0) ctx.moveTo(xx, yy + off); else ctx.lineTo(xx, yy + off);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  roundRect(ctx, 0.75, 0.75, size - 1.5, size - 1.5, pad * 2.2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(skin.board.edge, skin.style === 'soft' ? 0.9 : 0.6);
  ctx.stroke();
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) drawSlot(ctx, skin, pad + col * cs, pad + r * cs, cs);
  cache.set(key, c);
  return c;
}

/** Löscht den Zwischenspeicher (z.B. nach Grössenänderung). */
export function clearSpriteCache() { cache.clear(); }

/** Kleines Bild (Data-URL) eines Edelsteins, z.B. für die Ziel-Anzeige. */
export function gemIconUrl(key, size = 28) {
  const c = gemSprite(key, size, 2);
  return c.toDataURL();
}
