// Puzzle – Teile ausschneiden und zeichnen (Browser, Canvas 2D).
//
// Jedes Teil wird einmal vorgerendert: Bildausschnitt mit Path2D geclippt, Relief (Licht oben links,
// Schatten unten rechts), feiner Rand und weicher Schlagschatten. Beim Spielen werden nur noch diese
// fertigen Leinwände verschoben – das bleibt auch bei 108 Teilen flüssig.

import { makeCanvas } from './images.js';

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

/** Path2D eines Teils relativ zur linken oberen Ecke seiner Zelle (Welt-Einheiten). */
export function piecePath2D(geo, i) {
  if (!geo._p2d) geo._p2d = new Map();
  let p = geo._p2d.get(i);
  if (!p) { p = new Path2D(geo.piecePath(i)); geo._p2d.set(i, p); }
  return p;
}

export function cellOrigin(geo, i) {
  return [(i % geo.cols) * geo.pw, Math.floor(i / geo.cols) * geo.ph];
}

function bevel(ctx, path, m, strength = 1) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const d = 0.02 * m;
  // weiches Licht oben links
  ctx.save();
  ctx.translate(d, d);
  ctx.lineWidth = 0.075 * m;
  ctx.strokeStyle = `rgba(255, 250, 240, ${0.16 * strength})`;
  ctx.stroke(path);
  ctx.lineWidth = 0.035 * m;
  ctx.strokeStyle = `rgba(255, 250, 240, ${0.34 * strength})`;
  ctx.stroke(path);
  ctx.restore();
  // Schatten unten rechts
  ctx.save();
  ctx.translate(-d, -d);
  ctx.lineWidth = 0.075 * m;
  ctx.strokeStyle = `rgba(45, 25, 8, ${0.14 * strength})`;
  ctx.stroke(path);
  ctx.lineWidth = 0.035 * m;
  ctx.strokeStyle = `rgba(45, 25, 8, ${0.28 * strength})`;
  ctx.stroke(path);
  ctx.restore();
  // feine Kontur
  ctx.lineWidth = 0.012 * m;
  ctx.strokeStyle = `rgba(50, 30, 12, ${0.38 * strength})`;
  ctx.stroke(path);
}

/**
 * Schneidet alle Teile aus dem Bild `src` (Breite = geo.W × k Pixel).
 * Rückgabe: { k, pad, sprites[] } – sprite i deckt die Zelle plus `pad` Welt-Einheiten Rand ab.
 */
export async function cutPieces(geo, src, { onProgress, signal } = {}) {
  const k = src.width / geo.W;
  const pad = geo.margin + 0.07 * geo.m;
  const w = Math.ceil((geo.pw + 2 * pad) * k), hgt = Math.ceil((geo.ph + 2 * pad) * k);
  const sprites = [];
  let last = performance.now();
  for (let i = 0; i < geo.count; i++) {
    if (signal && signal.aborted) throw new Error('abgebrochen');
    sprites.push(cutOne(geo, src, i, k, pad, w, hgt));
    if (performance.now() - last > 24) {
      if (onProgress) onProgress((i + 1) / geo.count);
      await yieldFrame();
      last = performance.now();
    }
  }
  if (onProgress) onProgress(1);
  return { k, pad, sprites };
}

function cutOne(geo, src, i, k, pad, w, hgt) {
  const cv = makeCanvas(w, hgt);
  const ctx = cv.getContext('2d');
  const [ox, oy] = cellOrigin(geo, i);
  const path = piecePath2D(geo, i);
  const m = geo.m;
  ctx.scale(k, k);
  ctx.translate(pad, pad);
  // Schlagschatten (Werte in Geräte-Pixeln)
  ctx.save();
  ctx.shadowColor = 'rgba(52, 32, 14, 0.38)';
  ctx.shadowBlur = Math.max(2, 0.085 * m * k);
  ctx.shadowOffsetY = Math.max(1, 0.03 * m * k);
  ctx.fillStyle = '#8a7866';
  ctx.fill(path);
  ctx.restore();
  // Bild
  ctx.save();
  ctx.clip(path);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, -ox, -oy, geo.W, geo.H);
  bevel(ctx, path, m, 1);
  ctx.restore();
  return cv;
}

/** Malt ein eingerastetes Teil in die Brett-Ebene (gleiche Pixelgrösse wie das Bild). */
export function paintPlaced(layer, geo, src, i) {
  const ctx = layer.getContext('2d');
  const k = layer.width / geo.W;
  const [ox, oy] = cellOrigin(geo, i);
  const path = piecePath2D(geo, i);
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(ox, oy);
  ctx.clip(path);
  ctx.drawImage(src, -ox, -oy, geo.W, geo.H);
  bevel(ctx, path, geo.m, 0.45);
  ctx.restore();
}

/** Blasse, entsättigte Vorlage für das Brett. */
export function makeGhost(src, width = 420) {
  const cv = makeCanvas(width, (width * src.height) / src.width);
  const ctx = cv.getContext('2d');
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  try {
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    for (let p = 0; p < d.length; p += 4) {
      const l = 0.3 * d[p] + 0.59 * d[p + 1] + 0.11 * d[p + 2];
      d[p] = 0.55 * l + 0.45 * d[p];
      d[p + 1] = 0.55 * l + 0.45 * d[p + 1];
      d[p + 2] = 0.55 * l + 0.45 * d[p + 2];
    }
    ctx.putImageData(img, 0, 0);
  } catch { /* z.B. verunreinigte Leinwand – dann eben farbig */ }
  return cv;
}

/** Kleine Vorschau eines Teils für die Leiste (CSS-Grösse box × box). */
export function drawTrayPiece(canvas, geo, cut, i, r, box, dpr) {
  const px = Math.round(box * dpr);
  if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, px, px);
  const sp = cut.sprites[i];
  const sw = geo.pw + 2 * cut.pad, sh = geo.ph + 2 * cut.pad;
  const s = (px * 0.98) / Math.max(sw, sh);
  ctx.translate(px / 2, px / 2);
  ctx.rotate((r * Math.PI) / 2);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sp, (-sw * s) / 2, (-sh * s) / 2, sw * s, sh * s);
}
