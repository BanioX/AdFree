// Zeichnet die versteckten Bilder (Emoji- oder Pixelbilder aus data/pictures.js).

import { pictures } from '../data/pictures.js';
import { roundRect, lighten, darken } from './sprites.js';

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const cache = new Map();

export function pictureById(id) {
  return pictures.find((p) => p.id === id) || pictures[0];
}

/** Bild als Canvas (size in CSS-px). */
export function renderPicture(pic, size, dpr = 2) {
  const px = Math.max(8, Math.round(size * dpr));
  const key = `${pic.id}|${px}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const ctx = c.getContext('2d');
  const s = px;
  const bg = pic.bg || ['#fff6ea', '#ffd9b0'];
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, bg[0]);
  g.addColorStop(1, bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  // weiches Licht
  const rg = ctx.createRadialGradient(s * 0.3, s * 0.25, 0, s * 0.3, s * 0.25, s * 0.7);
  rg.addColorStop(0, 'rgba(255,255,255,0.55)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, s, s);
  // Tupfen-Muster
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const step = s / 9;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      ctx.beginPath();
      ctx.arc(x * step + (y % 2 ? step / 2 : 0), y * step, s * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (pic.rows && pic.palette) {
    const rows = pic.rows;
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const cell = (s * 0.9) / Math.max(w, h);
    const ox = (s - cell * w) / 2;
    const oy = (s - cell * h) / 2;
    for (let r = 0; r < h; r++) {
      for (let col = 0; col < w; col++) {
        const ch = rows[r][col];
        const color = pic.palette[ch];
        if (!color) continue;
        const x = ox + col * cell, y = oy + r * cell;
        roundRect(ctx, x + cell * 0.04, y + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.22);
        const pg = ctx.createLinearGradient(0, y, 0, y + cell);
        pg.addColorStop(0, lighten(color, 0.18));
        pg.addColorStop(1, darken(color, 0.06));
        ctx.fillStyle = pg;
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        roundRect(ctx, x + cell * 0.18, y + cell * 0.14, cell * 0.4, cell * 0.16, cell * 0.08);
        ctx.fill();
      }
    }
  } else if (pic.emoji) {
    ctx.save();
    ctx.font = `${Math.round(s * 0.66)}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(60,30,10,0.22)';
    ctx.shadowBlur = s * 0.04;
    ctx.shadowOffsetY = s * 0.02;
    ctx.fillText(pic.emoji, s / 2, s * 0.54);
    ctx.restore();
  }
  cache.set(key, c);
  return c;
}

export function pictureThumbUrl(pic, size = 64) {
  return renderPicture(pic, size, 2).toDataURL();
}
