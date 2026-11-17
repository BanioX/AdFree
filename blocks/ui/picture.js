// Zeichnet die versteckten Bilder (Emoji- oder Pixelbilder aus data/pictures.js).

import { pictures } from '../data/pictures.js';
import { roundRect, lighten, darken } from './sprites.js';

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const cache = new Map();

export function pictureById(id) {
  return pictures.find((p) => p.id === id) || pictures[0];
}

/**
 * Bild als Canvas (Grösse in CSS-px). Mit `height` entsteht ein Rechteck: der Hintergrund füllt es
 * ganz, das Motiv sitzt vollständig und zentriert darin (z.B. wenn nur die untere Brett-Hälfte
 * verdeckt ist).
 */
export function renderPicture(pic, size, dpr = 2, height = size) {
  const pw = Math.max(8, Math.round(size * dpr));
  const ph = Math.max(8, Math.round(height * dpr));
  const key = `${pic.id}|${pw}x${ph}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = pw;
  c.height = ph;
  const ctx = c.getContext('2d');
  const s = Math.min(pw, ph);      // Seite des Motiv-Quadrats
  const big = Math.max(pw, ph);
  const bg = pic.bg || ['#fff6ea', '#ffd9b0'];
  const g = ctx.createLinearGradient(0, 0, pw, ph);
  g.addColorStop(0, bg[0]);
  g.addColorStop(1, bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, pw, ph);
  // weiches Licht
  const rg = ctx.createRadialGradient(pw * 0.3, ph * 0.25, 0, pw * 0.3, ph * 0.25, big * 0.7);
  rg.addColorStop(0, 'rgba(255,255,255,0.55)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, pw, ph);
  // Tupfen-Muster
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const step = s / 9;
  for (let y = 0; y * step <= ph + step; y++) {
    for (let x = 0; x * step <= pw + step; x++) {
      ctx.beginPath();
      ctx.arc(x * step + (y % 2 ? step / 2 : 0), y * step, s * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // flache Rechtecke: Motiv etwas grösser, damit es nicht verloren wirkt
  const wide = big / s >= 1.5;
  if (pic.rows && pic.palette) {
    const rows = pic.rows;
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const cell = (s * (wide ? 0.98 : 0.9)) / Math.max(w, h);
    const ox = (pw - cell * w) / 2;
    const oy = (ph - cell * h) / 2;
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
    ctx.font = `${Math.round(s * (wide ? 0.8 : 0.66))}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(60,30,10,0.22)';
    ctx.shadowBlur = s * 0.04;
    ctx.shadowOffsetY = s * 0.02;
    ctx.fillText(pic.emoji, pw / 2, ph / 2 + s * 0.04);
    ctx.restore();
  }
  cache.set(key, c);
  return c;
}

export function pictureThumbUrl(pic, size = 64) {
  return renderPicture(pic, size, 2).toDataURL();
}
