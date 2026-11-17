// Perlenbild – kleine Farb-Helfer (rein, ohne DOM).
// RGB-Werte sind Arrays [r, g, b] mit 0..255, OKLab-Werte [L, a, b].

/** '#abc' | '#aabbcc' -> [r, g, b] oder null */
export function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  let s = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function normalizeHex(hex) {
  const rgb = parseHex(hex);
  return rgb ? toHex(rgb) : null;
}

/** Mischt zwei Farben (Hex oder RGB) linear in sRGB. t=0 -> a, t=1 -> b */
export function mixRgb(a, b, t) {
  const A = Array.isArray(a) ? a : parseHex(a);
  const B = Array.isArray(b) ? b : parseHex(b);
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}

export function mixHex(a, b, t) { return toHex(mixRgb(a, b, t)); }

export function rgba(c, alpha = 1) {
  const r = Array.isArray(c) ? c : parseHex(c);
  return `rgba(${Math.round(r[0])},${Math.round(r[1])},${Math.round(r[2])},${alpha})`;
}

export function srgbToLinear(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c) {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, v * 255));
}

/** lineares RGB (0..1) -> OKLab */
export function linearToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

export function oklabToLinear(L, a, b) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

export function rgbToOklab(rgb) {
  return linearToOklab(srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2]));
}

export function oklabToRgb(lab) {
  const [r, g, b] = oklabToLinear(lab[0], lab[1], lab[2]);
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}

export function hexToOklab(hex) { return rgbToOklab(parseHex(hex)); }

export function labDist(a, b) {
  const d0 = a[0] - b[0], d1 = a[1] - b[1], d2 = a[2] - b[2];
  return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2);
}

/** relative Helligkeit 0..1 (für Kontrastentscheide) */
export function lightness(hex) {
  return hexToOklab(hex)[0];
}
