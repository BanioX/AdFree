// Zeichnet glänzende, leicht durchscheinende Blasen (Canvas 2D) und legt sie als
// vorgerenderte Bildchen in einen Cache – pro Frame wird nur noch drawImage benutzt.

import { COLORS } from './data/colors.js';

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

// ---------- Farbhelfer ----------

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------- Symbole (für Farbschwäche) ----------

function symbolPath(ctx, name, s) {
  ctx.beginPath();
  switch (name) {
    case 'heart':
      ctx.moveTo(0, s * 0.85);
      ctx.bezierCurveTo(-s * 1.25, 0, -s * 0.9, -s * 0.95, 0, -s * 0.35);
      ctx.bezierCurveTo(s * 0.9, -s * 0.95, s * 1.25, 0, 0, s * 0.85);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const r = i % 2 ? s * 0.42 : s;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      break;
    case 'sun':
      ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const cx = Math.cos(a) * s * 0.82, cy = Math.sin(a) * s * 0.82;
        ctx.moveTo(cx + s * 0.14, cy);
        ctx.arc(cx, cy, s * 0.14, 0, Math.PI * 2);
      }
      break;
    case 'leaf':
      ctx.moveTo(-s * 0.85, s * 0.6);
      ctx.bezierCurveTo(-s * 0.9, -s * 0.5, s * 0.2, -s * 0.95, s * 0.9, -s * 0.8);
      ctx.bezierCurveTo(s * 0.85, s * 0.2, s * 0.1, s * 0.95, -s * 0.85, s * 0.6);
      break;
    case 'drop':
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.35, -s * 0.45, s * 0.75, -s * 0.05, s * 0.75, s * 0.3);
      ctx.arc(0, s * 0.3, s * 0.75, 0, Math.PI, false);
      ctx.bezierCurveTo(-s * 0.75, -s * 0.05, -s * 0.35, -s * 0.45, 0, -s);
      break;
    case 'moon':
      ctx.arc(0, 0, s * 0.85, Math.PI * 0.32, Math.PI * 1.68, false);
      ctx.arc(s * 0.42, -s * 0.05, s * 0.7, Math.PI * 1.45, Math.PI * 0.55, true);
      ctx.closePath();
      break;
    case 'flower':
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
        const cx = Math.cos(a) * s * 0.5, cy = Math.sin(a) * s * 0.5;
        ctx.moveTo(cx + s * 0.4, cy);
        ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2);
      }
      break;
    case 'diamond':
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.72, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.72, 0);
      ctx.closePath();
      break;
    default:
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
  }
}

// ---------- Blasen ----------

/** Glasblase mit Verlauf, Rand, Reflexion und Glanzpunkt. Ursprung = Mittelpunkt. */
export function paintBubble(ctx, R, base, { symbol = null, pet = null, alpha = 1 } = {}) {
  const light = mix(base, '#ffffff', 0.62);
  const mid = mix(base, '#ffffff', 0.12);
  const dark = mix(base, '#2a1238', 0.28);
  ctx.save();
  ctx.globalAlpha = alpha;

  // Körper
  const g = ctx.createRadialGradient(-R * 0.32, -R * 0.38, R * 0.05, 0, 0, R);
  g.addColorStop(0, light);
  g.addColorStop(0.42, mid);
  g.addColorStop(0.86, base);
  g.addColorStop(1, dark);
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.97, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.globalAlpha = alpha * (pet ? 0.62 : 0.95);
  ctx.fill();
  ctx.globalAlpha = alpha;

  if (pet) {
    // Tierchen im Inneren, dann ein heller Schleier darüber
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.9, 0, Math.PI * 2);
    ctx.clip();
    ctx.font = `${Math.round(R * 1.18)}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pet, 0, R * 0.1);
    ctx.restore();
    const veil = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R);
    veil.addColorStop(0, 'rgba(255,255,255,0)');
    veil.addColorStop(1, rgba(base, 0.55));
    ctx.fillStyle = veil;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.97, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lichtreflex unten rechts (Durchscheinen)
  const g2 = ctx.createRadialGradient(R * 0.28, R * 0.5, 0, R * 0.28, R * 0.5, R * 0.62);
  g2.addColorStop(0, 'rgba(255,255,255,0.42)');
  g2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.95, 0, Math.PI * 2);
  ctx.fill();

  // Symbol
  if (symbol && !pet) {
    ctx.save();
    ctx.translate(R * 0.04, R * 0.06);
    symbolPath(ctx, symbol, R * 0.36);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fill('evenodd');
    ctx.lineWidth = Math.max(1, R * 0.05);
    ctx.strokeStyle = 'rgba(70,30,60,0.16)';
    ctx.stroke();
    ctx.restore();
  }

  // Rand
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.95, 0, Math.PI * 2);
  ctx.lineWidth = R * 0.06;
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.985, 0, Math.PI * 2);
  ctx.lineWidth = R * 0.035;
  ctx.strokeStyle = 'rgba(60,25,60,0.22)';
  ctx.stroke();

  // Glanzlicht
  ctx.save();
  ctx.translate(-R * 0.36, -R * 0.44);
  ctx.rotate(-0.62);
  const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.36);
  hg.addColorStop(0, 'rgba(255,255,255,0.95)');
  hg.addColorStop(0.55, 'rgba(255,255,255,0.65)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.scale(1, 0.55);
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(R * 0.5, R * 0.36, R * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.restore();
}

/** Stein: matter, runder Kiesel. */
export function paintStone(ctx, R) {
  ctx.save();
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
  g.addColorStop(0, '#d9d3df');
  g.addColorStop(0.55, '#a59cb0');
  g.addColorStop(1, '#6f6680');
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.96, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  // Sprenkel
  const dots = [[-0.35, 0.2, 0.09], [0.3, -0.25, 0.07], [0.25, 0.35, 0.1], [-0.05, -0.5, 0.05], [0.55, 0.05, 0.05], [-0.5, -0.15, 0.06]];
  ctx.fillStyle = 'rgba(80,70,95,0.35)';
  for (const [x, y, r] of dots) { ctx.beginPath(); ctx.arc(x * R, y * R, r * R, 0, Math.PI * 2); ctx.fill(); }
  // Riss
  ctx.beginPath();
  ctx.moveTo(-R * 0.1, -R * 0.15);
  ctx.lineTo(R * 0.12, R * 0.05);
  ctx.lineTo(R * 0.02, R * 0.3);
  ctx.lineWidth = R * 0.06;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(70,60,85,0.4)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.96, 0, Math.PI * 2);
  ctx.lineWidth = R * 0.05;
  ctx.strokeStyle = 'rgba(60,50,75,0.35)';
  ctx.stroke();
  ctx.save();
  ctx.translate(-R * 0.36, -R * 0.42);
  ctx.rotate(-0.6);
  ctx.scale(1, 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Spezialkugeln */
export function paintSpecial(ctx, R, type) {
  ctx.save();
  if (type === 'rainbow') {
    const cols = ['#f0475e', '#ff9a2e', '#ffd23a', '#49c463', '#3d8ef0', '#9a62ee', '#f0475e'];
    let g;
    if (ctx.createConicGradient) {
      g = ctx.createConicGradient(-Math.PI / 2, 0, 0);
      cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    } else {
      g = ctx.createLinearGradient(-R, -R, R, R);
      cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    }
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.97, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    const w = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    w.addColorStop(0, 'rgba(255,255,255,0.85)');
    w.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    w.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = w;
    ctx.fill();
    symbolPath(ctx, 'star', R * 0.42);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (type === 'bomb') {
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R);
    g.addColorStop(0, '#7d86c8');
    g.addColorStop(0.5, '#3b3f72');
    g.addColorStop(1, '#1d1f3d');
    ctx.beginPath();
    ctx.arc(0, R * 0.08, R * 0.86, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    // Zündschnur
    ctx.beginPath();
    ctx.moveTo(R * 0.25, -R * 0.62);
    ctx.quadraticCurveTo(R * 0.45, -R * 0.95, R * 0.72, -R * 0.82);
    ctx.lineWidth = R * 0.12;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#c9a26b';
    ctx.stroke();
    ctx.fillStyle = '#4b4f86';
    ctx.fillRect(R * 0.08, -R * 0.78, R * 0.34, R * 0.26);
    ctx.save();
    ctx.translate(R * 0.76, -R * 0.84);
    symbolPath(ctx, 'star', R * 0.26);
    ctx.fillStyle = '#ffd23a';
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(-R * 0.32, -R * 0.2);
    ctx.rotate(-0.6);
    ctx.scale(1, 0.55);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.restore();
  } else if (type === 'fire') {
    const g = ctx.createRadialGradient(0, R * 0.15, R * 0.05, 0, 0, R);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(0.35, '#ffc23a');
    g.addColorStop(0.75, '#ff6a2a');
    g.addColorStop(1, '#d9302f');
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.97, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    // Flamme
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.62);
    ctx.bezierCurveTo(R * 0.5, -R * 0.15, R * 0.48, R * 0.5, 0, R * 0.58);
    ctx.bezierCurveTo(-R * 0.48, R * 0.5, -R * 0.5, 0, -R * 0.12, -R * 0.25);
    ctx.bezierCurveTo(-R * 0.08, -R * 0.05, R * 0.05, -R * 0.2, 0, -R * 0.62);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    ctx.save();
    ctx.translate(-R * 0.36, -R * 0.44);
    ctx.rotate(-0.62);
    ctx.scale(1, 0.55);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.985, 0, Math.PI * 2);
  ctx.lineWidth = R * 0.04;
  ctx.strokeStyle = 'rgba(60,25,60,0.2)';
  ctx.stroke();
  ctx.restore();
}

// ---------- Cache ----------

export class SpriteCache {
  constructor() {
    this.map = new Map();
    this.px = 0;
    this.symbols = true;
  }

  /** Radius in Gerätepixeln setzen (leert den Cache bei Änderung). */
  setSize(pxRadius, symbols = true) {
    const px = Math.max(4, Math.round(pxRadius));
    if (px !== this.px || symbols !== this.symbols) {
      this.map.clear();
      this.px = px;
      this.symbols = symbols;
    }
  }

  /**
   * Bild für einen Zellwert (Farbe/Stein + optional Tierchen-Emoji) oder einen Spezialtyp.
   * key: Zahl (Zellwert) oder 'rainbow' | 'bomb' | 'fire'
   */
  get(key, petEmoji = null) {
    const k = `${key}|${petEmoji || ''}`;
    let cv = this.map.get(k);
    if (cv) return cv;
    const R = this.px;
    const pad = Math.ceil(R * 0.25);
    const size = R * 2 + pad * 2;
    cv = makeCanvas(size, size);
    const ctx = cv.getContext('2d');
    ctx.translate(size / 2, size / 2);
    if (typeof key === 'string') paintSpecial(ctx, R, key);
    else if ((key & 15) === 9) paintStone(ctx, R);
    else {
      const col = COLORS[key & 15] || COLORS[1];
      paintBubble(ctx, R, col.base, { symbol: this.symbols ? col.symbol : null, pet: petEmoji });
    }
    cv.pad = pad;
    this.map.set(k, cv);
    return cv;
  }
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export { EMOJI_FONT };
