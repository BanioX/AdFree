// Zeichnen von Farbenzauber-Bildern: Formen (Füllung + Naht + Umriss pro Form in Maler-Reihenfolge),
// Nummern, Vorschaubilder und Export.

export const PAPER = '#ffffff';
export const HIGHLIGHT = '#ddd6cc';

/** Umrissbreite (CSS-px) abhängig von der Bildschirmgrösse typischer Flächen. */
export function outlineWidthFor(M, s) {
  const px = (M.typSize || 100) * s;
  return Math.max(0.5, Math.min(1.05, px / 34));
}

/**
 * Weiche Schraffur für die Hervorhebung der gewählten Farbe (konstant in Bildschirm-Pixeln).
 * Liefert ein CanvasPattern, das mit setTransform an den Zoom angepasst wird.
 */
export function makeHatch(ctx, dpr) {
  const period = Math.max(4, Math.round(6 * dpr));
  const c = document.createElement('canvas');
  c.width = period;
  c.height = period;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e3da';
  g.fillRect(0, 0, period, period);
  g.strokeStyle = '#d3cabe';
  g.lineWidth = 1.6 * dpr;
  g.lineCap = 'square';
  g.beginPath();
  for (let k = -1; k <= 1; k++) {
    g.moveTo(k * period, period);
    g.lineTo(k * period + period, 0);
  }
  g.stroke();
  return ctx.createPattern(c, 'repeat');
}
export const FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Leichtes Modell nur mit Pfaden (für Vorschaubilder/Export, ohne Analyse). */
export function liteModel(pz) {
  const n = pz.shapes.length;
  const paths = new Array(n), rules = new Array(n);
  const col = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const s = pz.shapes[i];
    paths[i] = new Path2D(s.d || '');
    rules[i] = s.r === 'evenodd' ? 'evenodd' : 'nonzero';
    col[i] = s.c | 0;
  }
  const lines = (pz.lines || []).filter((l) => l && typeof l.d === 'string').map((l) => ({
    path: new Path2D(l.d), w: +l.w || 2, color: l.color || '#2b2420',
  }));
  return {
    id: pz.id, W: pz.width, H: pz.height, n, paths, rules, col,
    palette: pz.palette, bg: pz.background || PAPER, lines,
  };
}

/**
 * Formen zeichnen. ctx-Transformation = Einheit -> Gerätepixel (vom Aufrufer gesetzt).
 * o: { view:[x0,y0,x1,y1] in Einheiten (Culling), unit: Einheiten pro CSS-px,
 *      highlight: Farbindex|-1, outlineAlpha: 0..1, outlineWidth (CSS-px), seam: bool, bbox?: Float32Array }
 */
export function drawPicture(ctx, M, filled, o) {
  const bb = o.bbox || M.bbox;
  const v = o.view;
  const hl = o.highlight == null ? -1 : o.highlight;
  const oa = o.outlineAlpha == null ? 1 : o.outlineAlpha;
  const outline = oa > 0.003 ? `rgba(72,58,48,${(0.56 * oa).toFixed(3)})` : null;
  const ow = (o.outlineWidth || 1) * o.unit;
  const sw = 0.8 * o.unit;
  const seam = o.seam !== false;
  const pal = M.palette;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let i = 0, n = M.n; i < n; i++) {
    if (bb && v) {
      const b = i * 4;
      if (bb[b] > v[2] || bb[b + 2] < v[0] || bb[b + 1] > v[3] || bb[b + 3] < v[1]) continue;
    }
    const p = M.paths[i];
    if (!filled || filled[i]) {
      const c = pal[M.col[i]] || '#cccccc';
      ctx.fillStyle = c;
      ctx.fill(p, M.rules[i]);
      if (seam) {
        ctx.strokeStyle = c;
        ctx.lineWidth = sw;
        ctx.stroke(p);
      }
    } else if (M.col[i] === hl) {
      ctx.fillStyle = o.hlFill || HIGHLIGHT;
      ctx.fill(p, M.rules[i]);
    } else {
      ctx.fillStyle = PAPER;
      ctx.fill(p, M.rules[i]);
    }
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = ow;
      ctx.stroke(p);
    }
  }
  if (M.lines && M.lines.length) {
    for (const l of M.lines) {
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.w;
      ctx.stroke(l.path);
    }
  }
}

const fontCache = new Map();
export function fontStr(weight, px) {
  const q = Math.round(px * 2) / 2;
  const key = weight * 10000 + q;
  let f = fontCache.get(key);
  if (!f) {
    f = `${weight} ${q}px ${FONT}`;
    fontCache.set(key, f);
  }
  return f;
}

export const LABEL_MIN = 7;   // CSS-px: kleiner wird nicht gezeigt
export const LABEL_MAX = 22;  // CSS-px: grösser wird nicht

/**
 * Nummern in Gerätepixeln zeichnen (ctx ohne Transformation).
 * o: { s: Gerätepx pro Einheit, tx, ty: Gerätepx-Verschiebung, dpr, rect:[x0,y0,x1,y1], selected }
 */
export function drawLabels(ctx, M, filled, o) {
  const L = M.labels;
  if (!L || !L.length) return;
  const { s, tx, ty, dpr, rect } = o;
  const sel = o.selected;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const minD = LABEL_MIN * dpr, maxD = LABEL_MAX * dpr;
  let lastFont = '', lastFill = '';
  for (let k = 0; k < L.length; k += 4) {
    const i = L[k];
    if (filled[i]) continue;
    let fd = L[k + 3] * s;
    if (fd < minD) continue;
    if (fd > maxD) fd = maxD;
    const x = L[k + 1] * s + tx, y = L[k + 2] * s + ty;
    if (x + fd < rect[0] || x - fd > rect[2] || y + fd < rect[1] || y - fd > rect[3]) continue;
    const c = M.col[i];
    const isSel = c === sel;
    const f = fontStr(isSel ? 800 : 600, fd);
    if (f !== lastFont) { ctx.font = f; lastFont = f; }
    const a = Math.min(1, 0.45 + ((fd - minD) / (2 * dpr)) * 0.55);
    const fill = isSel ? `rgba(43,36,32,${a.toFixed(2)})` : `rgba(104,90,80,${(a * 0.9).toFixed(2)})`;
    if (fill !== lastFill) { ctx.fillStyle = fill; lastFill = fill; }
    ctx.fillText(M.num[c], x, y + fd * 0.04);
  }
}

/**
 * Vorschaubild rendern. filled: Uint8Array|null (null = nichts gefüllt), done: alles farbig ohne Umrisse.
 */
export function renderThumb(lite, filled, done, maxPx) {
  const sc = maxPx / Math.max(lite.W, lite.H);
  const cw = Math.max(1, Math.round(lite.W * sc)), ch = Math.max(1, Math.round(lite.H * sc));
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const ctx = cv.getContext('2d');
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  ctx.fillStyle = lite.bg || PAPER;
  ctx.fillRect(0, 0, lite.W, lite.H);
  const f = done ? null : filled || new Uint8Array(lite.n);
  drawPicture(ctx, lite, f, {
    unit: 1 / sc,
    outlineAlpha: done ? 0 : 0.62,
    outlineWidth: Math.max(0.9, maxPx / 420),
  });
  return cv;
}

/** Fertiges Bild als PNG-Leinwand (lange Seite = size). */
export function renderExport(lite, size = 2048) {
  return renderThumb(lite, null, true, size);
}

/** Relative Helligkeit (0..1) einer Hex-Farbe. */
export function luminance(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return 0.5;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const v = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
