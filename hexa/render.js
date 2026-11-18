// Wabenstapel – Zeichnen auf Canvas (Waben, Plättchen, Stapel). Ohne Spiellogik.

export const SQ3 = Math.sqrt(3);
export const KY = 0.8; // Neigung: Waben leicht gestaucht → Blick schräg von oben

// Farben der Plättchen: Deckfläche, Kante, Glanz
export const COLORS = [
  { top: '#f7c13c', side: '#cf8f12', hi: '#ffe7a3', name: 'Honig' },
  { top: '#f26b5e', side: '#c4473b', hi: '#ffc0b8', name: 'Koralle' },
  { top: '#4fc58d', side: '#2d9766', hi: '#bff0d6', name: 'Minze' },
  { top: '#4ea6ec', side: '#2a78bd', hi: '#c3e3ff', name: 'Himmel' },
  { top: '#a07fe3', side: '#7656bd', hi: '#e0d3ff', name: 'Lavendel' },
  { top: '#f584b8', side: '#c9578c', hi: '#ffd3e7', name: 'Rosa' },
  { top: '#a5714f', side: '#744b31', hi: '#e2c2a8', name: 'Schoko' },
];

export function hexPath(ctx, x, y, s, ky = KY) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 90);
    const px = x + s * Math.cos(a);
    const py = y + s * Math.sin(a) * ky;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/** Abgerundetes Sechseck (für Felder). */
export function roundHexPath(ctx, x, y, s, ky = KY, r = 0.18) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 90);
    pts.push([x + s * Math.cos(a), y + s * Math.sin(a) * ky]);
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const p = pts[i], n = pts[(i + 1) % 6], q = pts[(i + 5) % 6];
    const ax = p[0] + (q[0] - p[0]) * r, ay = p[1] + (q[1] - p[1]) * r;
    const bx = p[0] + (n[0] - p[0]) * r, by = p[1] + (n[1] - p[1]) * r;
    if (i) ctx.lineTo(ax, ay); else ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(p[0], p[1], bx, by);
  }
  ctx.closePath();
}

/** Ein Plättchen (Deckfläche bei y, Kante darunter). flip ∈ [-1, 1]: vertikale Skalierung beim Umdrehen. */
export function drawTile(ctx, x, y, s, th, color, { flip = 1, alpha = 1, scale = 1 } = {}) {
  const c = COLORS[color % COLORS.length];
  const ss = s * 0.92 * scale;
  const ky = KY * Math.max(0.05, Math.abs(flip));
  if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
  // Kante
  roundHexPath(ctx, x, y + th, ss, ky, 0.14);
  ctx.fillStyle = c.side;
  ctx.fill();
  // Deckfläche
  roundHexPath(ctx, x, y, ss, ky, 0.14);
  ctx.fillStyle = flip < 0 ? c.side : c.top;
  ctx.fill();
  if (Math.abs(flip) > 0.5) {
    // Glanzrand oben links
    ctx.save();
    roundHexPath(ctx, x, y, ss, ky, 0.14);
    ctx.clip();
    ctx.globalAlpha *= 0.55;
    roundHexPath(ctx, x - ss * 0.1, y - ss * 0.12 * ky, ss * 0.92, ky, 0.14);
    ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.strokeStyle = c.hi;
    ctx.stroke();
    ctx.restore();
  }
  if (alpha < 1) ctx.restore();
}

export function tileThickness(s) { return Math.max(3, s * 0.17); }

/** Abstand zwischen Plättchen in einem Stapel (hohe Stapel werden enger). */
export function layerGap(s, n) {
  const th = tileThickness(s);
  return n > 12 ? th * 12 / n : th;
}

/** Stapel (Farbliste unten→oben). Gibt die y-Position der obersten Deckfläche zurück. */
export function drawStack(ctx, x, y, s, st, { label = true, lift = 0, scale = 1, alpha = 1, shadow = true } = {}) {
  const n = st.length;
  if (!n) return y;
  const th = tileThickness(s) * scale;
  const gap = layerGap(s, n) * scale;
  const yb = y - lift;
  if (shadow) {
    ctx.save();
    ctx.globalAlpha = 0.18 * alpha;
    ctx.fillStyle = '#5a3a10';
    ctx.beginPath();
    ctx.ellipse(x, y + th * 1.3, s * 0.86 * scale, s * 0.86 * KY * 0.8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < n; i++) drawTile(ctx, x, yb - i * gap, s * scale, th, st[i], { alpha });
  const ty = yb - (n - 1) * gap;
  if (label && n >= 2) {
    let run = 0;
    for (let i = n - 1; i >= 0 && st[i] === st[n - 1]; i--) run++;
    drawCount(ctx, x, ty, s * scale, run, alpha);
  }
  return ty;
}

export function drawCount(ctx, x, y, s, n, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${Math.round(s * 0.5)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.strokeStyle = 'rgba(60, 35, 10, .45)';
  ctx.strokeText(String(n), x, y + 1);
  ctx.fillStyle = '#fff';
  ctx.fillText(String(n), x, y + 1);
  ctx.restore();
}

/** Leeres Feld / Stein / Ziel-Markierung. */
export function drawPad(ctx, x, y, s, kind = 'pad', t = 0) {
  if (kind === 'stone') {
    roundHexPath(ctx, x, y + s * 0.12, s * 0.9, KY, 0.2);
    ctx.fillStyle = '#9c9183';
    ctx.fill();
    roundHexPath(ctx, x, y, s * 0.9, KY, 0.2);
    ctx.fillStyle = '#c4baa9';
    ctx.fill();
    ctx.fillStyle = 'rgba(90, 75, 60, .25)';
    ctx.beginPath(); ctx.arc(x - s * 0.25, y - s * 0.1, s * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.2, y + s * 0.15, s * 0.08, 0, Math.PI * 2); ctx.fill();
    return;
  }
  roundHexPath(ctx, x, y, s * 0.94, KY, 0.2);
  ctx.fillStyle = kind === 'target' ? '#ffe39a' : '#f3e2bf';
  ctx.fill();
  ctx.save();
  roundHexPath(ctx, x, y, s * 0.94, KY, 0.2);
  ctx.clip();
  roundHexPath(ctx, x, y + s * 0.1, s * 0.94, KY, 0.2);
  ctx.lineWidth = s * 0.14;
  ctx.strokeStyle = kind === 'target' ? 'rgba(230, 168, 23, .55)' : 'rgba(170, 120, 50, .22)';
  ctx.stroke();
  ctx.restore();
  if (kind === 'target' || kind === 'hint') {
    const p = 0.5 + 0.5 * Math.sin(t / 220);
    roundHexPath(ctx, x, y, s * (0.98 + p * 0.06), KY, 0.2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = kind === 'hint' ? `rgba(230, 168, 23, ${0.5 + p * 0.5})` : '#e6a817';
    ctx.stroke();
  }
}
