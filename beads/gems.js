// Perlenbild – glänzende Steine als vorgerenderte Sprites (Canvas).
//
//   gemSprite('#ff4f79', 120)  -> Canvas (Durchmesser 120 Gerätepixel, ohne Schatten)
//   shadowSprite(120)          -> weicher Schatten für denselben Durchmesser
//   drawGem(ctx, hex, x, y, d) -> zeichnet Schatten + Stein (CSS-Koordinaten, ctx skaliert)

import { parseHex, mixRgb, rgba } from './colors.js';

const gemCache = new Map();
const shadowCache = new Map();
const PAD = 2;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Stein-Sprite, Durchmesser D in Gerätepixeln (wird auf ganze Pixel gerundet). */
export function gemSprite(hex, D) {
  D = Math.max(4, Math.round(D));
  const key = hex + '|' + D;
  let c = gemCache.get(key);
  if (c) return c;
  if (gemCache.size > 600) gemCache.clear();
  c = makeCanvas(D + PAD * 2, D + PAD * 2);
  const g = c.getContext('2d');
  const cx = c.width / 2;
  const cy = c.height / 2;
  const r = D / 2;
  const base = parseHex(hex) || [128, 128, 128];
  const white = [255, 255, 255];
  const black = [20, 16, 30];
  const lum = (0.299 * base[0] + 0.587 * base[1] + 0.114 * base[2]) / 255;
  const light = mixRgb(base, white, lum > 0.8 ? 0.7 : 0.5);
  const mid = mixRgb(base, white, 0.12);
  const dark = mixRgb(base, black, lum > 0.8 ? 0.22 : 0.34);

  // Körper
  let grd = g.createRadialGradient(cx - 0.34 * r, cy - 0.4 * r, r * 0.04, cx - 0.08 * r, cy - 0.1 * r, r * 1.18);
  grd.addColorStop(0, rgba(light));
  grd.addColorStop(0.32, rgba(mid));
  grd.addColorStop(0.74, rgba(base));
  grd.addColorStop(1, rgba(dark));
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = grd;
  g.fill();

  // Lichtfang unten (Edelstein-Gefühl)
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  grd = g.createRadialGradient(cx + 0.18 * r, cy + 0.62 * r, 0, cx + 0.18 * r, cy + 0.62 * r, 0.62 * r);
  grd.addColorStop(0, rgba(mixRgb(base, white, 0.55), 0.55));
  grd.addColorStop(1, rgba(mixRgb(base, white, 0.55), 0));
  g.fillStyle = grd;
  g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  g.restore();

  // Rand
  const lw = Math.max(0.8, r * 0.07);
  g.beginPath();
  g.arc(cx, cy, r - lw / 2, 0, Math.PI * 2);
  g.lineWidth = lw;
  g.strokeStyle = rgba(dark, lum > 0.8 ? 0.55 : 0.4);
  g.stroke();

  // Glanzlicht
  g.save();
  g.translate(cx - 0.3 * r, cy - 0.4 * r);
  g.rotate(-0.55);
  g.scale(1, 0.6);
  grd = g.createRadialGradient(0, 0, 0, 0, 0, 0.44 * r);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, 0.44 * r, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // kleiner Funkel-Punkt + zweiter Reflex
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.arc(cx - 0.4 * r, cy - 0.48 * r, Math.max(0.6, 0.075 * r), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath();
  g.ellipse(cx + 0.42 * r, cy + 0.3 * r, 0.12 * r, 0.07 * r, -0.9, 0, Math.PI * 2);
  g.fill();

  gemCache.set(key, c);
  return c;
}

/** Weicher Schatten (unter dem Stein, leicht nach unten versetzt). */
export function shadowSprite(D) {
  D = Math.max(4, Math.round(D));
  let c = shadowCache.get(D);
  if (c) return c;
  const S = D * 1.5;
  c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const cx = c.width / 2;
  const cy = c.height / 2;
  const r = D / 2;
  const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.14);
  grd.addColorStop(0, 'rgba(60,40,30,0.30)');
  grd.addColorStop(0.62, 'rgba(60,40,30,0.18)');
  grd.addColorStop(1, 'rgba(60,40,30,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, c.width, c.height);
  shadowCache.set(D, c);
  return c;
}

/**
 * Zeichnet einen Stein. ctx ist auf CSS-Pixel skaliert (setTransform(dpr…)).
 * d = Durchmesser in CSS-Pixeln, dpr = Gerätepixel pro CSS-Pixel.
 */
export function drawGem(ctx, hex, x, y, d, dpr, { shadow = true, alpha = 1 } = {}) {
  if (d <= 0.5) return;
  const D = quantD(d * dpr);
  const spr = gemSprite(hex, D);
  const k = d / D;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (shadow) {
    const sh = shadowSprite(D);
    const sw = sh.width * k;
    ctx.drawImage(sh, x - sw / 2, y - sw / 2 + d * 0.09, sw, sw);
  }
  const w = spr.width * k;
  ctx.drawImage(spr, x - w / 2, y - w / 2, w, w);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/** Blasser «Geist» einer leeren Zelle (zeigt das Motiv an). Helle Farben werden
 *  leicht abgedunkelt, damit sie auf dem weissen Brett sichtbar bleiben. */
export function ghostColor(hex, mix = 0.58) {
  const rgb = parseHex(hex) || [200, 200, 200];
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  if (lum > 0.8) return rgba(mixRgb(rgb, [176, 160, 140], 0.42 - (1 - lum) * 0.6), 0.95);
  return rgba(mixRgb(rgb, [255, 255, 255], mix), 0.95);
}

/** Sprite-Grösse leicht runden, damit fliegende (skalierte) Steine den Cache nicht fluten. */
function quantD(D) {
  return D <= 30 ? Math.max(4, Math.round(D)) : Math.round(D / 3) * 3;
}

/**
 * Zeichnet ein ganzes Perlenbild in ein Canvas (Vorschau, Sammlung).
 * filled: Uint8Array (1 = gelegt) oder null (= alles gelegt).
 */
export function drawPicture(canvas, L, { filled = null, size = null, pad = 0.06, background = null, ghostMix = 0.58, ghostR = 0.24 } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cssW = size || canvas.clientWidth || 160;
  const cssH = size ? size * (L.H / L.W) : (canvas.clientHeight || cssW);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  if (size) { canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px'; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, cssW, cssH); }
  const p = Math.min(cssW, cssH) * pad;
  const cs = Math.min((cssW - 2 * p) / L.W, (cssH - 2 * p) / L.H);
  const ox = (cssW - cs * L.W) / 2;
  const oy = (cssH - cs * L.H) / 2;
  // erst Geister, dann Schatten, dann Steine (saubere Überlappung)
  for (let i = 0; i < L.cells.length; i++) {
    const k = L.cells[i];
    if (k < 0 || (filled === null || filled[i])) continue;
    const x = ox + (i % L.W + 0.5) * cs;
    const y = oy + (Math.floor(i / L.W) + 0.5) * cs;
    ctx.fillStyle = ghostColor(L.colors[k], ghostMix);
    ctx.beginPath();
    ctx.arc(x, y, cs * ghostR, 0, Math.PI * 2);
    ctx.fill();
  }
  const d = cs * 0.94;
  const sh = shadowSprite(d * dpr);
  const kk = d / Math.max(4, Math.round(d * dpr));
  for (let i = 0; i < L.cells.length; i++) {
    const k = L.cells[i];
    if (k < 0 || !(filled === null || filled[i])) continue;
    const x = ox + (i % L.W + 0.5) * cs;
    const y = oy + (Math.floor(i / L.W) + 0.5) * cs;
    const sw = sh.width * kk;
    ctx.drawImage(sh, x - sw / 2, y - sw / 2 + d * 0.09, sw, sw);
  }
  for (let i = 0; i < L.cells.length; i++) {
    const k = L.cells[i];
    if (k < 0 || !(filled === null || filled[i])) continue;
    const x = ox + (i % L.W + 0.5) * cs;
    const y = oy + (Math.floor(i / L.W) + 0.5) * cs;
    drawGem(ctx, L.colors[k], x, y, d, dpr, { shadow: false });
  }
  return canvas;
}
