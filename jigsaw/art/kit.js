// Mal-Werkzeuge für die prozeduralen Bilder (ohne DOM – arbeitet nur mit einem Canvas-2D-Kontext).
// Alle Masse in logischen Einheiten: Bildbreite = 1000.

export const TAU = Math.PI * 2;

export function hex2rgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgb2hex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

/** Mischt zwei Hex-Farben (t = 0 → a, t = 1 → b). */
export function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export const lighten = (c, t) => mix(c, '#ffffff', t);
export const darken = (c, t) => mix(c, '#000000', t);

export function rgba(hex, a) {
  const [r, g, b] = hex2rgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** Farbe an Stelle t (0..1) entlang einer Liste gleichmässig verteilter Farben. */
export function ramp(colors, t) {
  if (colors.length === 1) return colors[0];
  const x = Math.max(0, Math.min(1, t)) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(x));
  return mix(colors[i], colors[i + 1], x - i);
}

/** Senkrechter Verlauf mit gleichmässig verteilten Farben. */
export function vgrad(ctx, y0, y1, colors) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  colors.forEach((c, i) => g.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), c));
  return g;
}

/** Leicht verschobene Farbe (für lebendige Pinselstriche). */
export function jitter(rng, hex, amt = 0.06) {
  const t = rng.range(-amt, amt);
  return t > 0 ? lighten(hex, t) : darken(hex, -t);
}

// ---------- Linien und Landschaftsformen ----------

/** Bergkamm per Mittelpunkt-Verschiebung. Gibt Punkte [x, y] von x=0 bis x=w zurück. */
export function ridge(rng, { w, base, amp, rough = 0.55, detail = 7, peaks = null }) {
  const n = 2 ** detail;
  const hts = new Array(n + 1).fill(0);
  hts[0] = rng.range(0, 0.6);
  hts[n] = rng.range(0, 0.6);
  let step = n, scale = 1;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < n; i += step) {
      hts[i] = (hts[i - half] + hts[i + half]) / 2 + rng.range(-1, 1) * scale;
    }
    scale *= rough;
    step = half;
  }
  if (peaks) {
    for (const [px, ph, pw] of peaks) {
      for (let i = 0; i <= n; i++) {
        const d = (i / n - px) / pw;
        hts[i] += ph * Math.exp(-d * d);
      }
    }
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of hts) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const span = hi - lo || 1;
  return hts.map((v, i) => [(i / n) * w, base - ((v - lo) / span) * amp]);
}

/** Sanfte Hügellinie aus Sinuswellen. */
export function hills(rng, { w, base, amp, waves = 3, n = 80 }) {
  const comps = [];
  for (let k = 0; k < waves; k++) {
    comps.push({ f: rng.range(0.6, 1.4) * (k + 1), p: rng.range(0, TAU), a: amp / (k + 1) * rng.range(0.6, 1) });
  }
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    let y = base;
    for (const c of comps) y -= c.a * Math.sin((x / w) * Math.PI * c.f + c.p);
    pts.push([x, y]);
  }
  return pts;
}

export function yAt(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] >= x) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
  }
  return pts[pts.length - 1][1];
}

/** Pfad: Linie entlang der Punkte, dann nach unten bis `bottom` schliessen. */
export function pathBelow(ctx, pts, bottom, smooth = false) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0] - 2, bottom);
  ctx.lineTo(pts[0][0] - 2, pts[0][1]);
  if (smooth) {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts[pts.length - 1][0] + 2, pts[pts.length - 1][1]);
  } else {
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[pts.length - 1][0] + 2, pts[pts.length - 1][1]);
  }
  ctx.lineTo(pts[pts.length - 1][0] + 2, bottom);
  ctx.closePath();
}

// ---------- Licht ----------

/** Weiches Leuchten (radialer Verlauf). */
export function glow(ctx, x, y, r, color, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.35, rgba(color, alpha * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function disc(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.05, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// ---------- Pinsel ----------

/** Waagrechte, malerische Striche über einen Bereich – Farbe aus `colorAt(y)`. */
export function brushStrokes(ctx, rng, { x0 = 0, x1 = 1000, y0, y1, count, colorAt, alpha = 0.22, len = [60, 220], thick = [3, 10], tilt = 0.03 }) {
  for (let i = 0; i < count; i++) {
    const y = rng.range(y0, y1);
    const x = rng.range(x0 - 40, x1 + 40);
    const rx = rng.range(len[0], len[1]) / 2;
    const ry = rng.range(thick[0], thick[1]) / 2;
    ctx.fillStyle = rgba(jitter(rng, colorAt(y), 0.07), alpha * rng.range(0.5, 1));
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rng.range(-tilt, tilt), 0, TAU);
    ctx.fill();
  }
}

/** Kurze Tupfer (für Laub, Blüten, Gras in der Ferne). */
export function dab(ctx, x, y, rx, ry, angle, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), angle, 0, TAU);
  ctx.fill();
}

/** Bauschige Wolke aus vielen weichen Tupfern (flache Unterseite, beleuchtete Oberseite). */
export function cloud(ctx, rng, { x, y, w, h, light, shade, alpha = 1 }) {
  const n = 7 + Math.floor(w / 55);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1 + rng.range(-0.08, 0.08);
    const top = (1 - u * u) * h;
    const r = h * rng.range(0.42, 0.62) * (1 - u * u * 0.5);
    blobs.push({ x: x + u * w * 0.5, y: y - rng.range(0.15, 0.7) * top, r });
  }
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 1.1);
    g.addColorStop(0, rgba(shade, 0.85 * alpha));
    g.addColorStop(0.7, rgba(shade, 0.55 * alpha));
    g.addColorStop(1, rgba(shade, 0));
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.r * 1.1, b.y - b.r * 1.1, b.r * 2.2, b.r * 2.2);
  }
  for (const b of blobs) {
    const lx = b.x - b.r * 0.12, ly = b.y - b.r * 0.22, lr = b.r * 0.92;
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    g.addColorStop(0, rgba(light, 0.95 * alpha));
    g.addColorStop(0.5, rgba(mix(light, shade, 0.2), 0.7 * alpha));
    g.addColorStop(1, rgba(mix(light, shade, 0.45), 0));
    ctx.fillStyle = g;
    ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
  }
}

/** Lange, flache Schleierwolke. */
export function streak(ctx, rng, { x, y, w, h, color, alpha = 0.5 }) {
  const n = 5 + rng.int(0, 4);
  for (let i = 0; i < n; i++) {
    const cx = x + rng.range(-w, w) * 0.35;
    const cy = y + rng.range(-h, h) * 0.6;
    const rx = w * rng.range(0.25, 0.5), ry = h * rng.range(0.35, 0.8);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0, rgba(color, alpha * rng.range(0.6, 1)));
    g.addColorStop(1, rgba(color, 0));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/** Tanne als Silhouette mit gezackten Ästen. */
export function pine(ctx, x, base, height, width, color) {
  const tiers = 5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, base - height);
  for (let i = 1; i <= tiers; i++) {
    const t = i / tiers;
    const y = base - height + height * 0.92 * t;
    const half = width * 0.5 * (0.25 + 0.75 * t);
    ctx.lineTo(x + half, y);
    if (i < tiers) ctx.lineTo(x + half * 0.45, y - height * 0.04);
  }
  ctx.lineTo(x + width * 0.06, base - height * 0.08);
  ctx.lineTo(x + width * 0.06, base);
  ctx.lineTo(x - width * 0.06, base);
  ctx.lineTo(x - width * 0.06, base - height * 0.08);
  for (let i = tiers; i >= 1; i--) {
    const t = i / tiers;
    const y = base - height + height * 0.92 * t;
    const half = width * 0.5 * (0.25 + 0.75 * t);
    if (i < tiers) ctx.lineTo(x - half * 0.45, y - height * 0.04);
    ctx.lineTo(x - half, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Laubbaum: Stamm + Krone aus Tupfern. */
export function leafTree(ctx, rng, x, base, height, crown, trunk, light) {
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(x - height * 0.035, base);
  ctx.lineTo(x - height * 0.015, base - height * 0.55);
  ctx.lineTo(x + height * 0.015, base - height * 0.55);
  ctx.lineTo(x + height * 0.035, base);
  ctx.fill();
  const cy = base - height * 0.68, r = height * 0.34;
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, TAU), d = Math.sqrt(rng.next()) * r * 0.75;
    const px = x + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.85;
    const shade = (py - cy) / r; // unten dunkler
    dab(ctx, px, py, r * rng.range(0.28, 0.42), r * rng.range(0.24, 0.36), rng.range(0, TAU),
      mix(light, crown, Math.max(0, Math.min(1, 0.45 + shade * 0.6))));
  }
}

/** Funkelnder Stern mit Strahlen. */
export function sparkleStar(ctx, x, y, r, color, alpha = 1) {
  glow(ctx, x, y, r * 4, color, 0.35 * alpha);
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2.6);
  ctx.quadraticCurveTo(x, y, x + r * 2.6, y);
  ctx.quadraticCurveTo(x, y, x, y + r * 2.6);
  ctx.quadraticCurveTo(x, y, x - r * 2.6, y);
  ctx.quadraticCurveTo(x, y, x, y - r * 2.6);
  ctx.fill();
}

// ---------- Oberfläche ----------

/** Papier-/Leinwandkorn über das ganze Bild. Braucht P.makeCanvas. */
export function grain(ctx, rng, P, alpha = 0.07) {
  if (!P.makeCanvas) return;
  const size = 96;
  const cv = P.makeCanvas(size, size);
  const c = cv.getContext('2d');
  const img = c.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (rng.next() - 0.5) * 160 + ((i % size) % 3 === 0 ? 10 : 0) + (Math.floor(i / size) % 3 === 0 ? 10 : 0);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const pat = ctx.createPattern(cv, 'repeat');
  if (!pat) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, P.w, P.h);
  ctx.restore();
}

/** Sanft abgedunkelte Ränder. */
export function vignette(ctx, P, strength = 0.18, color = '#2a1a10') {
  const r = Math.hypot(P.w, P.h) / 2;
  const g = ctx.createRadialGradient(P.w / 2, P.h * 0.45, r * 0.45, P.w / 2, P.h / 2, r * 1.05);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, P.w, P.h);
}

/** Wählt aus der Palette eine Akzentfarbe. */
export function accent(P, rng) {
  const a = P.pal.accents || ['#ffffff'];
  return a[Math.floor(rng.next() * a.length)];
}

/**
 * Malerische Licht- und Schattenstriche auf einer Bergschicht (geclippt auf die Form).
 * Hänge zur Sonne hin werden heller, abgewandte dunkler.
 */
export function shadeLayer(ctx, rng, pts, bottom, { color, light, sunX, count = 120, len = [30, 120], width = [2, 7], alpha = 0.28, depth = 1 }) {
  ctx.save();
  pathBelow(ctx, pts, bottom);
  ctx.clip();
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, pts[pts.length - 1][0]);
    const y0 = yAt(pts, x) + rng.range(-2, 18) * depth;
    const slope = (yAt(pts, x + 6) - yAt(pts, x - 6)) / 12;
    const lit = (slope < 0) === (sunX < x);
    const steep = Math.min(1, Math.abs(slope) * 1.6);
    const l = rng.range(len[0], len[1]) * depth;
    const dir = slope < 0 ? 1 : -1;
    ctx.strokeStyle = rgba(lit ? mix(color, light, 0.35 + 0.25 * steep) : darken(color, 0.12 + 0.12 * steep), alpha * rng.range(0.5, 1) * (0.4 + 0.6 * steep));
    ctx.lineWidth = rng.range(width[0], width[1]) * depth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.quadraticCurveTo(x + dir * l * 0.25, y0 + l * 0.5, x + dir * l * 0.3 * (0.5 + steep), y0 + l);
    ctx.stroke();
  }
  ctx.restore();
}

/** Nebelband (waagrecht, weich). */
export function mist(ctx, P, y, height, color, alpha = 0.5) {
  const g = ctx.createLinearGradient(0, y - height, 0, y + height);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, y - height, P.w, height * 2);
}

/** Himmel: Verlauf + malerische Striche. */
export function paintSky(ctx, P, y1, { strokes = 140, colors = P.pal.sky, alpha = 0.18 } = {}) {
  ctx.fillStyle = vgrad(ctx, 0, y1, colors);
  ctx.fillRect(0, 0, P.w, Math.max(y1, P.h));
  brushStrokes(ctx, P.rng, {
    y0: 0, y1, count: strokes, alpha,
    colorAt: (y) => ramp(colors, y / y1),
    len: [80, 300], thick: [4, 14],
  });
}

/** Einfache Blüte mit Blättern rundum. */
export function flower(ctx, rng, x, y, r, petal, center, petals = 5) {
  const rot = rng.range(0, TAU);
  for (let k = 0; k < petals; k++) {
    const a = rot + (k / petals) * TAU;
    const px = x + Math.cos(a) * r * 0.55, py = y + Math.sin(a) * r * 0.55 * 0.8;
    dab(ctx, px, py, r * 0.52, r * 0.34, a, k % 2 ? petal : lighten(petal, 0.12));
  }
  dab(ctx, x, y, r * 0.28, r * 0.24, 0, center);
  dab(ctx, x - r * 0.08, y - r * 0.08, r * 0.1, r * 0.08, 0, rgba('#ffffff', 0.45));
}

/**
 * Plastische Bergschicht: Grundfarbe, zur Sonne gewandte Flanken heller (verschobene Kopie),
 * optional Schneekappen mit Licht/Schatten. pts = Kammlinie.
 */
export function mountainLayer(ctx, rng, P, pts, { color, lit, shadow, haze, base, amp, sunX, shift = 60, snow = 0, snowLit = '#ffffff', snowShadow = '#c9d4ea' }) {
  const { w, h } = P;
  const dir = sunX < w / 2 ? 1 : -1; // Kopie von der Sonne weg verschieben
  const shifted = pts.map(([x, y]) => [x, y]);
  const n = pts.length - 1;
  const step = w / n;
  const off = Math.round(shift / step);
  for (let i = 0; i <= n; i++) {
    const j = Math.max(0, Math.min(n, i - dir * off));
    shifted[i] = [pts[i][0], pts[j][1] + shift * 0.35];
  }
  const fade = (c) => vgrad(ctx, base - amp, base + h * 0.1, [c, c, mix(c, haze, 0.7)]);
  // beleuchtet
  pathBelow(ctx, pts, h);
  ctx.fillStyle = fade(lit);
  ctx.fill();
  ctx.save();
  pathBelow(ctx, pts, h);
  ctx.clip();
  pathBelow(ctx, shifted, h);
  ctx.fillStyle = fade(color);
  ctx.fill();
  // Schnee
  if (snow > 0) {
    const thr = 1 - snow;
    const snowPts = [];
    ctx.beginPath();
    pts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    for (let i = n; i >= 0; i--) {
      const [x, y] = pts[i];
      const rel = (base - y) / amp;
      const d = Math.max(0, rel - thr) * amp * 0.75 * (0.55 + rng.next() * 0.9);
      snowPts.push([x, y + d]);
      ctx.lineTo(x, y + d);
    }
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = snowLit;
    ctx.fillRect(0, 0, w, h);
    pathBelow(ctx, shifted, h);
    ctx.fillStyle = snowShadow;
    ctx.fill();
    ctx.restore();
  }
  // feine Pinselstruktur entlang der Hänge
  for (let i = 0; i < 90; i++) {
    const x = rng.range(0, w);
    const y0 = yAt(pts, x) + rng.range(0, amp * 0.7);
    const slope = (yAt(pts, x + 15) - yAt(pts, x - 15)) / 30;
    const l = rng.range(12, 40);
    ctx.strokeStyle = rgba(rng.chance(0.5) ? shadow : lit, rng.range(0.08, 0.2));
    ctx.lineWidth = rng.range(2, 5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + (slope < 0 ? 1 : -1) * l * 0.6, y0 + l * Math.min(1, Math.abs(slope) + 0.3));
    ctx.stroke();
  }
  ctx.restore();
}
