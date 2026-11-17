// Kleine Bilder im Spielstil für Startbildschirm, Album und Tutorial.
// Nutzt dieselben Zeichenfunktionen wie das Spielfeld (sprites.js), damit alles aus einem Guss ist.

import { SpriteCache } from './sprites.js';
import { WIDTH } from './core/hex.js';

const DPR = () => Math.min(window.devicePixelRatio || 1, 3);

// ---------- Blasen als Bild-URL (für DOM-Szenen) ----------

const urlCache = new Map();
const caches = new Map();

/**
 * Daten-URL einer Blase im Spielstil.
 * key: Farb-id (1–8), 9 = Stein oder 'bomb' | 'rainbow' | 'fire'; r: Radius in CSS-Pixeln.
 * Das Bild ist 1.25× so gross wie die Blase (Rand für Glanz) – als background-size: 125% verwenden.
 */
export function bubbleURL(key, r = 20, pet = null) {
  const R = Math.round(r * DPR());
  const k = `${key}|${R}|${pet || ''}`;
  let url = urlCache.get(k);
  if (url) return url;
  let sc = caches.get(R);
  if (!sc) { sc = new SpriteCache(); sc.setSize(R, true); caches.set(R, sc); }
  url = sc.get(key, pet).toDataURL();
  urlCache.set(k, url);
  return url;
}

/** Setzt eine Blase als Hintergrund eines Elements. */
export function paintEl(el, key, r = 20, pet = null) {
  el.style.backgroundImage = `url(${bubbleURL(key, r, pet)})`;
  el.dataset.k = String(key);
  return el;
}

// ---------- Live-Vorschau des Spielfelds (Titelbild im Startbildschirm) ----------

/**
 * Zeichnet ein Spielfeld klein auf eine Leinwand: Himmel, Wolkendecke, Blasen, Werfer.
 * src: { board, pets, current } (z.B. ein Game-Objekt) oder null (nur Himmel)
 */
export function drawPreview(canvas, src, sky, size = 124) {
  const dpr = DPR();
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = size, H = size;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, sky[0]); g.addColorStop(0.55, sky[1]); g.addColorStop(1, sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // weiche Lichtflecken
  const l1 = ctx.createRadialGradient(W * 0.15, H * 0.55, 0, W * 0.15, H * 0.55, W * 0.4);
  l1.addColorStop(0, 'rgba(255,255,255,.55)'); l1.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = l1; ctx.fillRect(0, 0, W, H);

  const cells = src && src.board ? src.board.occupied() : [];
  let maxY = 3;
  for (const o of cells) maxY = Math.max(maxY, o.y);
  // Massstab: ganze Breite (22 Einheiten) + Platz für den Werfer unten
  const s = Math.min((W - 8) / WIDTH, (H - 6) / (maxY + 2.4 + 5.2));
  const ox = (W - WIDTH * s) / 2;
  const oy = s * 1.7;
  const R = s * 1.02;
  const sc = new SpriteCache();
  sc.setSize(R * dpr, false);
  const draw = (v, x, y, scale = 1) => {
    const pet = v >> 4 && src.pets ? src.pets[(v >> 4) - 1] || '🐣' : null;
    const img = sc.get(typeof v === 'number' ? v & 15 : v, pet);
    const d = (img.width / dpr) * scale;
    ctx.drawImage(img, x - d / 2, y - d / 2, d, d);
  };
  for (const o of cells) draw(o.v, ox + o.x * s, oy + o.y * s);

  // Wolkendecke (überlappt die oberste Reihe leicht – wie im Spiel)
  ctx.fillStyle = 'rgba(255,255,255,.97)';
  ctx.fillRect(0, 0, W, oy - s * 0.5);
  for (let x = -s * 0.4; x < W + s * 2; x += s * 1.9) {
    ctx.beginPath();
    ctx.arc(x, oy - s * 0.45, s * 1.02, 0, Math.PI * 2);
    ctx.fill();
  }

  // Werfer
  if (src && src.current) {
    const cx = W / 2, cy = H - s * 2.4;
    const base = ctx.createRadialGradient(cx, cy + s * 1.1, 0, cx, cy + s * 1.1, s * 4);
    base.addColorStop(0, 'rgba(255,255,255,.95)'); base.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 1.1, s * 4, s * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, s * 1.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill();
    draw(src.current, cx, cy, 1.15);
    // gepunktete Zielhilfe
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx + i * s * 0.9, cy - s * 1.6 - i * s * 1.25, s * (0.32 - i * 0.03), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}
