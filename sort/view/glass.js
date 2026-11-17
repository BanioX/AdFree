// Farbfluss – Glas-Geometrie und Zeichen-Helfer (Canvas 2D).
//
// Lokales Koordinatensystem eines Glases: Ursprung oben in der Mitte (Oberkante Rand),
// y nach unten. Alle Masse in Einheiten der Glasbreite w (normiert, w = 1) und werden
// beim Zeichnen skaliert. Damit lassen sich Füllhöhe und Kippwinkel einmal pro
// Fassungsvermögen vorberechnen.

export const G = {
  rimH: 0.13,      // Höhe des Randes
  rimW: 1.12,      // Breite des Randes
  wall: 0.075,     // Glasdicke
  neck: 0.3,       // Luft über der vollen Füllung
  lh: 0.74,        // Höhe einer Schicht
};
G.iw = 1 - 2 * G.wall;

export function tubeHeight(cap) {
  return G.neck + cap * G.lh + G.wall;
}

/** Innenraum als Polygon (normiert). */
function cavityPolygon(cap, seg = 14) {
  const H = tubeHeight(cap);
  const yb = H - G.wall;
  const r = G.iw / 2;
  const pts = [[-r, 0], [-r, yb - r]];
  for (let i = 1; i < seg; i++) {
    const a = Math.PI - (i / seg) * Math.PI;
    pts.push([Math.cos(a) * r, yb - r + Math.sin(a) * r]);
  }
  pts.push([r, yb - r], [r, 0]);
  return pts;
}

function polyArea(p) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(a) / 2;
}

/** Fläche des Polygons unterhalb der Linie y = Y (also y >= Y). */
function areaBelow(p, Y) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const ina = a[1] >= Y, inb = b[1] >= Y;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (Y - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, Y]);
    }
  }
  return out.length >= 3 ? polyArea(out) : 0;
}

function rotate(p, th) {
  const c = Math.cos(th), s = Math.sin(th);
  return p.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

const geomCache = new Map();

/** Vorberechnete Geometrie für ein Fassungsvermögen (normiert auf w = 1). */
export function geom(cap) {
  let g = geomCache.get(cap);
  if (g) return g;
  const H = tubeHeight(cap);
  const yb = H - G.wall;
  const poly = cavityPolygon(cap);
  const upright = (V) => areaBelow(poly, yb - V * G.lh);
  const rotCache = new Map();
  const rotated = (th) => {
    const k = Math.round(th * 2000);
    let r = rotCache.get(k);
    if (!r) {
      r = rotate(poly, k / 2000);
      if (rotCache.size > 400) rotCache.clear();
      rotCache.set(k, r);
    }
    return r;
  };
  let minY = 0, maxY = 0;
  /** Höhe des Flüssigkeitsspiegels (y im um den Ursprung gedrehten System). */
  const levelY = (th, V) => {
    if (V <= 0) return Infinity;
    if (Math.abs(th) < 1e-4) return yb - V * G.lh;
    const p = rotated(th);
    const target = upright(V);
    minY = Infinity; maxY = -Infinity;
    for (const q of p) { if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1]; }
    let lo = minY, hi = maxY;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      if (areaBelow(p, mid) > target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  // Kippwinkel, bei dem die Flüssigkeit gerade die Ausgusskante erreicht
  const MAXT = 1.95;
  const lipY = (th) => (G.iw / 2) * Math.sin(th);
  const thetaFor = (V) => {
    if (V <= 0.001) return MAXT;
    let lo = 0, hi = MAXT;
    if (levelY(hi, V) > lipY(hi)) return MAXT;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (levelY(mid, V) > lipY(mid)) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const STEP = 0.05;
  const tab = [];
  for (let V = 0; V <= cap + 1e-9; V += STEP) tab.push(thetaFor(V));
  const theta = (V) => {
    const x = Math.max(0, Math.min(cap, V)) / STEP;
    const i = Math.floor(x);
    if (i >= tab.length - 1) return tab[tab.length - 1];
    return tab[i] + (tab[i + 1] - tab[i]) * (x - i);
  };
  g = { cap, H, yb, poly, levelY, theta, area: polyArea(poly) };
  geomCache.set(cap, g);
  return g;
}

// ---------- Pfade ----------

/** Innenraum-Pfad in Pixeln (w = Breite). */
export function cavityPath(ctx, w, cap) {
  const H = tubeHeight(cap) * w;
  const yb = H - G.wall * w;
  const r = (G.iw * w) / 2;
  ctx.beginPath();
  ctx.moveTo(-r, -1);
  ctx.lineTo(-r, yb - r);
  ctx.arc(0, yb - r, r, Math.PI, 0, true);
  ctx.lineTo(r, -1);
  ctx.closePath();
}

function outerPath(ctx, w, cap) {
  const H = tubeHeight(cap) * w;
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(-r, G.rimH * w * 0.6);
  ctx.lineTo(-r, H - r);
  ctx.arc(0, H - r, r, Math.PI, 0, true);
  ctx.lineTo(r, G.rimH * w * 0.6);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export { roundRect };

// ---------- Glas-Sprites (Rückseite und Vorderseite) ----------

const spriteCache = new Map();

/**
 * Liefert vorgerenderte Bilder für Glas-Rückseite und -Vorderseite.
 * { back, front, ox, oy, sw, sh } – zeichnen mit drawImage(img, ox, oy, sw, sh) im lokalen System.
 */
export function glassSprites(w, cap, dpr) {
  const key = `${w.toFixed(2)}|${cap}|${dpr}`;
  let s = spriteCache.get(key);
  if (s) return s;
  if (spriteCache.size > 24) spriteCache.clear();
  const H = tubeHeight(cap) * w;
  const pad = Math.ceil(w * 0.12) + 2;
  const sw = w * G.rimW + pad * 2;
  const sh = H + pad * 2;
  const ox = -sw / 2, oy = -pad;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(sw * dpr);
    c.height = Math.ceil(sh * dpr);
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    x.translate(-ox, -oy);
    return [c, x];
  };
  const iw = G.iw * w;

  // Rückseite: zartes Glas
  const [back, b] = mk();
  cavityPath(b, w, cap);
  const gb = b.createLinearGradient(-iw / 2, 0, iw / 2, 0);
  gb.addColorStop(0, 'rgba(196, 214, 228, 0.42)');
  gb.addColorStop(0.35, 'rgba(255, 255, 255, 0.55)');
  gb.addColorStop(0.7, 'rgba(255, 255, 255, 0.4)');
  gb.addColorStop(1, 'rgba(188, 206, 222, 0.48)');
  b.fillStyle = gb;
  b.fill();

  // Vorderseite: Kontur, Rand, Glanzlichter
  const [front, f] = mk();
  // Glaskörper (dünner Schleier über der Flüssigkeit an den Rändern)
  outerPath(f, w, cap);
  f.lineWidth = Math.max(1.2, w * 0.035);
  f.strokeStyle = 'rgba(92, 118, 140, 0.55)';
  f.lineJoin = 'round';
  f.stroke();
  // innere Kante
  f.save();
  f.translate(0, 0);
  const innerR = iw / 2;
  f.beginPath();
  f.moveTo(-innerR, G.rimH * w);
  f.lineTo(-innerR, H - G.wall * w - innerR);
  f.arc(0, H - G.wall * w - innerR, innerR, Math.PI, 0, true);
  f.lineTo(innerR, G.rimH * w);
  f.lineWidth = Math.max(0.8, w * 0.018);
  f.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  f.stroke();
  f.restore();
  // Glanzlicht links (lang, weich)
  const hx = -iw / 2 + w * 0.13;
  const hl = f.createLinearGradient(0, G.rimH * w + w * 0.15, 0, H - w * 0.55);
  hl.addColorStop(0, 'rgba(255,255,255,0.85)');
  hl.addColorStop(0.6, 'rgba(255,255,255,0.55)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  roundRect(f, hx - w * 0.055, G.rimH * w + w * 0.15, w * 0.11, H - w * 0.75 - G.rimH * w, w * 0.055);
  f.fillStyle = hl;
  f.fill();
  // kleiner Glanzpunkt
  f.beginPath();
  f.ellipse(hx, G.rimH * w + w * 0.02 + w * 0.06, w * 0.05, w * 0.04, 0, 0, Math.PI * 2);
  f.fillStyle = 'rgba(255,255,255,0.9)';
  f.fill();
  // Glanzlicht rechts (schmal)
  const rx = iw / 2 - w * 0.09;
  const hr = f.createLinearGradient(0, G.rimH * w + w * 0.4, 0, H - w * 0.6);
  hr.addColorStop(0, 'rgba(255,255,255,0)');
  hr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  hr.addColorStop(1, 'rgba(255,255,255,0)');
  roundRect(f, rx - w * 0.022, G.rimH * w + w * 0.4, w * 0.044, H - w * 1.0 - G.rimH * w, w * 0.022);
  f.fillStyle = hr;
  f.fill();
  // Bodenreflex
  f.beginPath();
  f.arc(0, H - w / 2, w / 2 - w * 0.12, Math.PI * 0.62, Math.PI * 0.9);
  f.lineWidth = w * 0.05;
  f.lineCap = 'round';
  f.strokeStyle = 'rgba(255,255,255,0.6)';
  f.stroke();
  // Rand (Lippe)
  const rw = w * G.rimW, rh = G.rimH * w;
  roundRect(f, -rw / 2, 0, rw, rh, rh / 2);
  const rg = f.createLinearGradient(0, 0, 0, rh);
  rg.addColorStop(0, 'rgba(255,255,255,0.95)');
  rg.addColorStop(1, 'rgba(214,228,238,0.9)');
  f.fillStyle = rg;
  f.fill();
  f.lineWidth = Math.max(1, w * 0.03);
  f.strokeStyle = 'rgba(92, 118, 140, 0.6)';
  f.stroke();

  s = { back, front, ox, oy, sw, sh };
  spriteCache.set(key, s);
  return s;
}

// ---------- Farben ----------

const shadeCache = new Map();
/** Hellere/dunklere Variante einer Hex-Farbe. k > 0 heller, k < 0 dunkler. */
export function shade(hex, k) {
  const key = hex + k;
  let v = shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  v = `rgb(${r | 0},${g | 0},${b | 0})`;
  shadeCache.set(key, v);
  return v;
}

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- Symbole (Farbsymbol-Hilfe) ----------

/** Zeichnet ein Symbol zentriert bei (0,0) mit Radius r. */
export function drawSymbol(ctx, name, r) {
  ctx.beginPath();
  switch (name) {
    case 'circle': ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); break;
    case 'square': roundRect(ctx, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44, r * 0.2); break;
    case 'triangle': ctx.moveTo(0, -r * 0.9); ctx.lineTo(r * 0.9, r * 0.7); ctx.lineTo(-r * 0.9, r * 0.7); ctx.closePath(); break;
    case 'diamond': ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0); ctx.closePath(); break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.42 : r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      break;
    case 'heart':
      ctx.moveTo(0, r * 0.85);
      ctx.bezierCurveTo(-r * 1.3, -r * 0.05, -r * 0.6, -r * 1.05, 0, -r * 0.35);
      ctx.bezierCurveTo(r * 0.6, -r * 1.05, r * 1.3, -r * 0.05, 0, r * 0.85);
      break;
    case 'drop':
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.5, -r * 0.35, r * 0.8, 0, r * 0.8, r * 0.3);
      ctx.arc(0, r * 0.3, r * 0.8, 0, Math.PI);
      ctx.bezierCurveTo(-r * 0.8, 0, -r * 0.5, -r * 0.35, 0, -r);
      break;
    case 'flower':
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        ctx.moveTo(Math.cos(a) * r * 0.5 + r * 0.42, Math.sin(a) * r * 0.5);
        ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.42, 0, Math.PI * 2);
      }
      break;
    case 'cross': {
      const t = r * 0.32;
      ctx.moveTo(-t, -r); ctx.lineTo(t, -r); ctx.lineTo(t, -t); ctx.lineTo(r, -t); ctx.lineTo(r, t);
      ctx.lineTo(t, t); ctx.lineTo(t, r); ctx.lineTo(-t, r); ctx.lineTo(-t, t); ctx.lineTo(-r, t);
      ctx.lineTo(-r, -t); ctx.lineTo(-t, -t); ctx.closePath();
      break;
    }
    case 'moon':
      ctx.arc(0, 0, r * 0.85, Math.PI * 0.3, Math.PI * 1.7, false);
      ctx.arc(r * 0.38, 0, r * 0.62, Math.PI * 1.55, Math.PI * 0.45, true);
      ctx.closePath();
      break;
    case 'ring':
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.moveTo(r * 0.45, 0);
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2, true);
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
      }
      ctx.closePath();
      break;
    case 'bolt':
      ctx.moveTo(r * 0.2, -r); ctx.lineTo(-r * 0.6, r * 0.12); ctx.lineTo(-r * 0.02, r * 0.12);
      ctx.lineTo(-r * 0.25, r); ctx.lineTo(r * 0.62, -r * 0.18); ctx.lineTo(r * 0.04, -r * 0.18); ctx.closePath();
      break;
    case 'leaf':
      ctx.moveTo(-r * 0.85, r * 0.85);
      ctx.bezierCurveTo(-r * 0.9, -r * 0.4, -r * 0.1, -r * 0.95, r * 0.9, -r * 0.9);
      ctx.bezierCurveTo(r * 0.95, r * 0.1, r * 0.4, r * 0.9, -r * 0.85, r * 0.85);
      break;
    case 'bars': {
      const bw = r * 0.4;
      for (let i = -1; i <= 1; i++) roundRectSub(ctx, i * r * 0.62 - bw / 2, -r * 0.85, bw, r * 1.7, bw / 2);
      break;
    }
    case 'sun':
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
        ctx.arc(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, r * 0.17, a + Math.PI, a + Math.PI + Math.PI * 2);
      }
      break;
    default: ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  }
}

function roundRectSub(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Korken ----------

/** Korken, Mitte oben bei (0, 0) = Oberkante Glasrand. w = Glasbreite. */
export function drawCork(ctx, w) {
  const cw = w * 0.86, ch = w * 0.5;
  const top = -ch * 0.52;
  // Körper (leicht konisch)
  ctx.beginPath();
  ctx.moveTo(-cw / 2, top + w * 0.06);
  ctx.quadraticCurveTo(-cw / 2, top, -cw / 2 + w * 0.08, top);
  ctx.lineTo(cw / 2 - w * 0.08, top);
  ctx.quadraticCurveTo(cw / 2, top, cw / 2, top + w * 0.06);
  ctx.lineTo(cw / 2 - w * 0.07, top + ch);
  ctx.lineTo(-cw / 2 + w * 0.07, top + ch);
  ctx.closePath();
  const g = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
  g.addColorStop(0, '#b77c48');
  g.addColorStop(0.35, '#e0ac74');
  g.addColorStop(0.7, '#d39a5f');
  g.addColorStop(1, '#a96d3c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.03);
  ctx.strokeStyle = 'rgba(110, 66, 30, 0.75)';
  ctx.stroke();
  // Poren
  ctx.fillStyle = 'rgba(120, 72, 34, 0.45)';
  const dots = [[-0.22, 0.25], [0.12, 0.18], [0.24, 0.36], [-0.05, 0.4], [-0.3, 0.42], [0.05, 0.08]];
  for (const [dx, dy] of dots) {
    ctx.beginPath();
    ctx.arc(dx * w, top + dy * w + w * 0.04, w * 0.028, 0, Math.PI * 2);
    ctx.fill();
  }
  // Glanz oben
  ctx.beginPath();
  ctx.ellipse(-cw * 0.12, top + w * 0.07, cw * 0.26, w * 0.035, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 236, 205, 0.7)';
  ctx.fill();
}

// ---------- Funkeln ----------

export function drawSparkle(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0);
  ctx.quadraticCurveTo(r * 0.12, r * 0.12, 0, r);
  ctx.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0);
  ctx.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
