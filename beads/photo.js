// Perlenbild – eigenes Foto in ein Perlen-Muster verwandeln.
//
//   const img = await loadImage(file);
//   const sample = sampleImage(img, 24);           // Raster 24×24, Farben in OKLab
//   const pattern = quantize(sample, 8, 'seed');   // 8 Farben (k-means in OKLab)
//
// sampleImage braucht ein Canvas (Browser); quantize/buildPattern sind rein.

import { srgbToLinear, linearToOklab, oklabToRgb, toHex } from './colors.js';
import { makeRng, hashString } from '../shared/rng.js';

export const GRID_SIZES = [16, 24, 32];
export const MIN_COLORS = 4;
export const MAX_COLORS = 12;

/** Lädt eine Bilddatei (berücksichtigt die EXIF-Ausrichtung). */
export async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* Fallback */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

/**
 * Tastet das Bild quadratisch (mittiger Ausschnitt) auf N×N Zellen ab.
 * Rückgabe: { N, lab: Float32Array(N*N*3) }
 */
export function sampleImage(img, N) {
  const iw = img.width || img.naturalWidth;
  const ih = img.height || img.naturalHeight;
  const side = Math.min(iw, ih);
  const sx = (iw - side) / 2;
  const sy = (ih - side) / 2;
  const SUB = 4;
  const M = N * SUB;
  // zweistufig verkleinern, damit nichts flimmert
  let src = img;
  let sw = side;
  let sx0 = sx;
  let sy0 = sy;
  if (side > M * 4) {
    const mid = document.createElement('canvas');
    mid.width = mid.height = M * 4;
    const mc = mid.getContext('2d');
    mc.imageSmoothingEnabled = true;
    mc.imageSmoothingQuality = 'high';
    mc.drawImage(img, sx, sy, side, side, 0, 0, M * 4, M * 4);
    src = mid; sw = M * 4; sx0 = 0; sy0 = 0;
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = M;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, M, M);
  c.drawImage(src, sx0, sy0, sw, sw, 0, 0, M, M);
  const px = c.getImageData(0, 0, M, M).data;
  const lab = new Float32Array(N * N * 3);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SUB; dy++) {
        for (let dx = 0; dx < SUB; dx++) {
          const o = ((y * SUB + dy) * M + (x * SUB + dx)) * 4;
          r += srgbToLinear(px[o]);
          g += srgbToLinear(px[o + 1]);
          b += srgbToLinear(px[o + 2]);
        }
      }
      const n = SUB * SUB;
      const L = linearToOklab(r / n, g / n, b / n);
      lab.set(L, (y * N + x) * 3);
    }
  }
  return { N, lab };
}

/** k-means (k-means++ Start) in OKLab. Rückgabe: { centers, assign } */
export function kmeans(lab, count, k, seed = 'photo') {
  const rng = makeRng(hashString(String(seed)));
  k = Math.max(1, Math.min(k, count));
  const centers = [];
  const d2 = new Float64Array(count).fill(Infinity);
  // Helligkeit leicht stärker gewichten (wirkt natürlicher)
  const WL = 1.4;
  const dist = (i, c) => {
    const o = i * 3;
    const a = (lab[o] - c[0]) * WL, b = lab[o + 1] - c[1], e = lab[o + 2] - c[2];
    return a * a + b * b + e * e;
  };
  const first = Math.floor(rng.next() * count);
  centers.push([lab[first * 3], lab[first * 3 + 1], lab[first * 3 + 2]]);
  while (centers.length < k) {
    let sum = 0;
    for (let i = 0; i < count; i++) {
      d2[i] = Math.min(d2[i], dist(i, centers[centers.length - 1]));
      sum += d2[i];
    }
    if (sum <= 1e-12) break;
    let r = rng.next() * sum;
    let pick = count - 1;
    for (let i = 0; i < count; i++) { r -= d2[i]; if (r <= 0) { pick = i; break; } }
    centers.push([lab[pick * 3], lab[pick * 3 + 1], lab[pick * 3 + 2]]);
  }
  const assign = new Int16Array(count);
  for (let iter = 0; iter < 18; iter++) {
    let changed = 0;
    for (let i = 0; i < count; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist(i, centers[c]);
        if (d < bd) { bd = d; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; changed++; }
    }
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < count; i++) {
      const a = acc[assign[i]];
      a[0] += lab[i * 3]; a[1] += lab[i * 3 + 1]; a[2] += lab[i * 3 + 2]; a[3]++;
    }
    acc.forEach((a, c) => { if (a[3]) centers[c] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
    if (!changed && iter > 0) break;
  }
  return { centers, assign };
}

/** Entfernt einzelne «Ausreisser»-Perlen (keine gleiche Farbe ringsum). */
export function despeckle(assign, N) {
  const out = assign.slice();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const own = assign[i];
      const counts = new Map();
      let same = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
          const v = assign[yy * N + xx];
          if (v === own) same++;
          counts.set(v, (counts.get(v) || 0) + (dx && dy ? 1 : 2));
        }
      }
      if (same === 0) {
        let best = own, bc = -1;
        for (const [v, c] of counts) if (c > bc) { bc = c; best = v; }
        out[i] = best;
      }
    }
  }
  return out;
}

const CHARS = 'abcdefghijklmnopqrstuvwxyz';

/** Baut aus der Abtastung ein Muster mit `colors` Farben. */
export function quantize(sample, colors = 8, seed = 'photo', { chroma = 1.12 } = {}) {
  const { N, lab } = sample;
  const k = Math.max(MIN_COLORS, Math.min(MAX_COLORS, colors | 0));
  const { centers, assign } = kmeans(lab, N * N, k, seed + ':' + k);
  const clean = despeckle(assign, N);
  // genutzte Farben, dunkel -> hell sortiert
  const used = [...new Set(clean)].sort((a, b) => centers[a][0] - centers[b][0]);
  const charOf = new Map();
  const palette = {};
  used.forEach((c, i) => {
    const ch = CHARS[i];
    charOf.set(c, ch);
    const [L, a, b] = centers[c];
    palette[ch] = toHex(oklabToRgb([L, a * chroma, b * chroma]));
  });
  const rows = [];
  for (let y = 0; y < N; y++) {
    let r = '';
    for (let x = 0; x < N; x++) r += charOf.get(clean[y * N + x]);
    rows.push(r);
  }
  return { palette, rows };
}

/** Bequemer Komplett-Weg: Datei -> Muster */
export async function photoToPattern(file, { grid = 24, colors = 8, seed = 'photo' } = {}) {
  const img = await loadImage(file);
  const sample = sampleImage(img, grid);
  return quantize(sample, colors, seed);
}
