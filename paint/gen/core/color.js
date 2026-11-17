// Farb-Helfer (rein, ohne DOM): Hex <-> RGB <-> Lab, Abstände, Paletten sortieren.

export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const c = (v) => {
    const x = Math.max(0, Math.min(255, Math.round(v)));
    return (x < 16 ? '0' : '') + x.toString(16);
  };
  return '#' + c(r) + c(g) + c(b);
}

// sRGB (0..255) -> linear
const LIN = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function srgbToLinear(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return v * 255;
}

const XN = 0.95047, YN = 1.0, ZN = 1.08883;
const fLab = (t) => (t > 0.008856451679 ? Math.cbrt(t) : 7.787037037 * t + 16 / 116);
const fInv = (t) => (t > 0.206896552 ? t * t * t : (t - 16 / 116) / 7.787037037);

/** RGB (0..255, ganzzahlig oder nicht) -> [L, a, b] */
export function rgbToLab(r, g, b) {
  const R = Number.isInteger(r) && r >= 0 && r < 256 ? LIN[r] : srgbToLinear(r);
  const G = Number.isInteger(g) && g >= 0 && g < 256 ? LIN[g] : srgbToLinear(g);
  const B = Number.isInteger(b) && b >= 0 && b < 256 ? LIN[b] : srgbToLinear(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / XN;
  const y = (0.2126729 * R + 0.7151522 * G + 0.072175 * B) / YN;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / ZN;
  const fx = fLab(x), fy = fLab(y), fz = fLab(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = fInv(fx) * XN, y = fInv(fy) * YN, z = fInv(fz) * ZN;
  const R = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const G = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const B = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [linearToSrgb(Math.max(0, R)), linearToSrgb(Math.max(0, G)), linearToSrgb(Math.max(0, B))];
}

export function hexToLab(hex) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToLab(r, g, b);
}

export function labToHex(L, a, b) {
  const [r, g, bb] = labToRgb(L, a, b);
  return rgbToHex(r, g, bb);
}

export function deltaE(l1, l2) {
  const d0 = l1[0] - l2[0], d1 = l1[1] - l2[1], d2 = l1[2] - l2[2];
  return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2);
}

export function hexDelta(h1, h2) {
  return deltaE(hexToLab(h1), hexToLab(h2));
}

/** Mischt zwei Hex-Farben in Lab (t = 0 -> a, 1 -> b). */
export function mixHex(h1, h2, t) {
  const a = hexToLab(h1), b = hexToLab(h2);
  return labToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

/** Hellt (amt > 0) oder dunkelt (amt < 0) eine Farbe in Lab-L ab. */
export function shadeHex(hex, amt) {
  const l = hexToLab(hex);
  return labToHex(Math.max(0, Math.min(100, l[0] + amt)), l[1], l[2]);
}

/** Relative Helligkeit 0..100 (Lab L). */
export function lightness(hex) {
  return hexToLab(hex)[0];
}

/**
 * Sortiert eine Palette «angenehm»: helle Neutraltöne zuerst, dann die bunten Farben nach
 * Farbton-Familie (rot -> orange -> gelb -> grün -> blau -> violett -> rosa), innerhalb einer
 * Familie von hell nach dunkel, am Ende dunkle Neutraltöne.
 * Gibt die Reihenfolge als Index-Array zurück.
 */
export function pleasantOrder(hexes) {
  const items = hexes.map((hex, i) => {
    const [L, a, b] = hexToLab(hex);
    const C = Math.hypot(a, b);
    let hue = (Math.atan2(b, a) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    return { i, L, C, hue };
  });
  const lightNeutral = [], darkNeutral = [], chroma = [];
  for (const it of items) {
    if (it.C < 9) (it.L >= 55 ? lightNeutral : darkNeutral).push(it);
    else chroma.push(it);
  }
  lightNeutral.sort((p, q) => q.L - p.L);
  darkNeutral.sort((p, q) => q.L - p.L);
  // Farbton-Familien; Start bei Rot (~20°). Rosa/Magenta (> 330°) ans Ende.
  const fam = (h) => {
    const x = (h - 5 + 360) % 360; // 0 = rot
    if (x < 45) return 0;   // rot
    if (x < 75) return 1;   // orange
    if (x < 100) return 2;  // gelb
    if (x < 170) return 3;  // grün
    if (x < 220) return 4;  // türkis
    if (x < 290) return 5;  // blau
    if (x < 325) return 6;  // violett
    return 7;               // rosa/magenta
  };
  chroma.sort((p, q) => fam(p.hue) - fam(q.hue) || q.L - p.L);
  return [...lightNeutral, ...chroma, ...darkNeutral].map((it) => it.i);
}

/** Sortiert Hex-Farben nach Helligkeit (hell -> dunkel). Gibt Index-Array zurück. */
export function lightOrder(hexes) {
  return hexes.map((h, i) => [lightness(h), i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}
