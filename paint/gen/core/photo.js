// Foto -> Malen-nach-Zahlen (rein, ohne DOM; läuft im Worker oder auf dem Hauptthread).
//
// 1. RGBA -> Lab, kantenerhaltend glätten (bilateral)
// 2. k-means in Lab (k-means++, deterministisch), Pixel zuordnen, Mehrheitsfilter
// 3. Flächen (4er-Zusammenhang), kleinste Flächen mit dem ähnlichsten Nachbarn verschmelzen,
//    schmale Streifen entfernen, gleichfarbige Nachbarn vereinigen
// 4. Palette aus den tatsächlichen Flächenfarben, leicht verschönert, ohne Beinahe-Doppel
// 5. Lückenlos vektorisieren (gemeinsame, geglättete Grenzketten)

import { makeRng, hashString } from '../../../shared/rng.js';
import { rgbToLab, labToHex, deltaE } from './color.js';
import { kmeans } from './kmeans.js';
import { buildRegions, mergeSmall, mergeThin, relabel, modeFilter } from './regions.js';
import { vectorize } from './vectorize.js';
import { finalizePuzzle } from './util.js';

export const DETAIL = {
  grob: { size: 200, maxCount: 225, minArea: 14, thin: 1.7, tol: 0.5 },
  mittel: { size: 300, maxCount: 450, minArea: 14, thin: 1.8, tol: 0.5 },
  fein: { size: 420, maxCount: 900, minArea: 14, thin: 1.9, tol: 0.5 },
};

export class AbortErr extends Error {
  constructor() { super('Abgebrochen'); this.name = 'AbortError'; }
}

/** Flächenmittelung (Box-Filter) auf maxSide (lange Seite). */
export function downscale(img, maxSide) {
  const { width: w, height: h, data } = img;
  const s = maxSide / Math.max(w, h);
  if (s >= 1) return img;
  const tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
  const out = new Uint8ClampedArray(tw * th * 4);
  const acc = new Float64Array(tw * th * 5);
  for (let y = 0; y < h; y++) {
    const ty = Math.min(th - 1, Math.floor((y * th) / h));
    for (let x = 0; x < w; x++) {
      const tx = Math.min(tw - 1, Math.floor((x * tw) / w));
      const k = (y * w + x) * 4, t = (ty * tw + tx) * 5;
      const a = data[k + 3] / 255;
      acc[t] += data[k] * a + 255 * (1 - a);
      acc[t + 1] += data[k + 1] * a + 255 * (1 - a);
      acc[t + 2] += data[k + 2] * a + 255 * (1 - a);
      acc[t + 4]++;
    }
  }
  for (let i = 0; i < tw * th; i++) {
    const n = acc[i * 5 + 4] || 1;
    out[i * 4] = acc[i * 5] / n; out[i * 4 + 1] = acc[i * 5 + 1] / n; out[i * 4 + 2] = acc[i * 5 + 2] / n; out[i * 4 + 3] = 255;
  }
  return { width: tw, height: th, data: out };
}

/** Bilateralfilter in Lab (Radius 2). */
async function bilateral(lab, w, h, sigmaS, sigmaR, tick) {
  const N = w * h;
  const out = new Float32Array(N * 3);
  const R = 2;
  const ws = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) ws.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / (2 * sigmaS * sigmaS))]);
  const LUTN = 4096, maxD2 = 9 * sigmaR * sigmaR;
  const lut = new Float32Array(LUTN + 1);
  for (let i = 0; i <= LUTN; i++) lut[i] = Math.exp(-((i / LUTN) * maxD2) / (2 * sigmaR * sigmaR));
  const f = LUTN / maxD2;
  for (let y = 0; y < h; y++) {
    if (tick && (y & 31) === 0) await tick();
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const L0 = lab[k * 3], A0 = lab[k * 3 + 1], B0 = lab[k * 3 + 2];
      let sL = 0, sA = 0, sB = 0, sw = 0;
      for (let i = 0; i < ws.length; i++) {
        const xx = x + ws[i][0], yy = y + ws[i][1];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = (yy * w + xx) * 3;
        const dL = lab[q] - L0, dA = lab[q + 1] - A0, dB = lab[q + 2] - B0;
        const d2 = dL * dL + dA * dA + dB * dB;
        if (d2 >= maxD2) continue;
        const wt = ws[i][2] * lut[(d2 * f) | 0];
        sL += lab[q] * wt; sA += lab[q + 1] * wt; sB += lab[q + 2] * wt; sw += wt;
      }
      out[k * 3] = sL / sw; out[k * 3 + 1] = sA / sw; out[k * 3 + 2] = sB / sw;
    }
  }
  return out;
}

function imageSeed(img) {
  const { data } = img;
  let s = '';
  const step = Math.max(4, Math.floor(data.length / 4 / 97) * 4);
  for (let i = 0; i < data.length; i += step) s += data[i] + ',' + data[i + 1] + ',' + data[i + 2] + ';';
  return hashString(img.width + 'x' + img.height + ':' + s);
}

/**
 * @param {{ width: number, height: number, data: Uint8ClampedArray }} img  RGBA
 * @param {{ colors?: number, detail?: string, onProgress?: (v:number)=>void, tick?: () => Promise<void>, signal?: AbortSignal }} opts
 */
export async function processImage(img, opts = {}) {
  const colors = Math.max(6, Math.min(30, Math.round(opts.colors || 16)));
  const D = DETAIL[opts.detail] || DETAIL.mittel;
  const onProgress = opts.onProgress || (() => {});
  const signal = opts.signal;
  let lastP = 0;
  const progress = (v) => { if (v > lastP) { lastP = v; onProgress(v); } };
  const check = () => { if (signal && signal.aborted) throw new AbortErr(); };
  const tick = async () => { check(); if (opts.tick) await opts.tick(); check(); };

  await tick();
  img = downscale(img, D.size);
  const { width: w, height: h, data } = img;
  const N = w * h;
  const seed = imageSeed(img);
  progress(0.04);

  // --- Lab ---
  const lab = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const a = data[k * 4 + 3] / 255;
    const r = data[k * 4] * a + 255 * (1 - a), g = data[k * 4 + 1] * a + 255 * (1 - a), b = data[k * 4 + 2] * a + 255 * (1 - a);
    const l = rgbToLab(Math.round(r), Math.round(g), Math.round(b));
    lab[k * 3] = l[0]; lab[k * 3 + 1] = l[1]; lab[k * 3 + 2] = l[2];
  }
  await tick();
  progress(0.08);

  // --- Glätten ---
  let sm = await bilateral(lab, w, h, 1.6, 9, tick);
  progress(0.17);
  sm = await bilateral(sm, w, h, 1.6, 7, tick);
  progress(0.26);

  // --- k-means ---
  const rng = makeRng(seed);
  const sampleN = Math.min(N, 16000);
  const sample = new Float32Array(sampleN * 3);
  for (let i = 0; i < sampleN; i++) {
    const k = sampleN === N ? i : Math.floor(((i + rng.next()) * N) / sampleN);
    sample[i * 3] = sm[k * 3]; sample[i * 3 + 1] = sm[k * 3 + 1]; sample[i * 3 + 2] = sm[k * 3 + 2];
  }
  await tick();
  const km = kmeans(sample, null, colors, rng, { iters: 18 });
  progress(0.36);
  // Beinahe gleiche Zentren zusammenlegen
  let centers = [];
  for (let c = 0; c < km.k; c++) centers.push([km.centers[c * 3], km.centers[c * 3 + 1], km.centers[c * 3 + 2]]);
  centers = dedupeCenters(centers, 3.5);
  const K = centers.length;
  const cls = new Int32Array(N);
  for (let k = 0; k < N; k++) {
    const x = sm[k * 3], y = sm[k * 3 + 1], z = sm[k * 3 + 2];
    let best = 0, bd = Infinity;
    for (let c = 0; c < K; c++) {
      const dx = x - centers[c][0], dy = y - centers[c][1], dz = z - centers[c][2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = c; }
    }
    cls[k] = best;
  }
  await tick();
  progress(0.42);
  const cls2 = modeFilter(cls, w, h, K, 2);
  await tick();
  progress(0.48);

  // --- Flächen ---
  const R = buildRegions(cls2, w, h);
  await tick();
  progress(0.55);
  const cost = (a, b) => deltaE(centers[R.cls[a]], centers[R.cls[b]]);
  // Erst grob (nur Mindestfläche), dann auf Zielanzahl
  mergeSmall(R, { minArea: D.minArea, cost });
  await tick();
  progress(0.6);
  mergeSmall(R, { minArea: D.minArea, maxCount: D.maxCount, cost });
  await tick();
  progress(0.66);
  for (let round = 0; round < 3; round++) {
    const ch = mergeThin(R, D.thin, cost);
    await tick();
    if (!ch) break;
  }
  mergeSmall(R, { minArea: D.minArea * 1.5, maxCount: D.maxCount, cost });
  const Lb = relabel(R);
  await tick();
  progress(0.74);

  // --- Palette aus den echten Flächenfarben ---
  const sum = new Float64Array(K * 4);
  for (let k = 0; k < N; k++) {
    const c = Lb.cls[Lb.labels[k]];
    sum[c * 4] += sm[k * 3]; sum[c * 4 + 1] += sm[k * 3 + 1]; sum[c * 4 + 2] += sm[k * 3 + 2]; sum[c * 4 + 3]++;
  }
  const palLab = [];
  for (let c = 0; c < K; c++) {
    const n = sum[c * 4 + 3];
    palLab.push(n ? [sum[c * 4] / n, sum[c * 4 + 1] / n, sum[c * 4 + 2] / n] : centers[c]);
  }
  const palette = beautify(palLab);

  // --- Vektorisieren ---
  const longSide = 1000;
  const sc = longSide / Math.max(w, h);
  const outW = Math.round(w * sc), outH = Math.round(h * sc);
  const V = vectorize(Lb.labels, w, h, Lb.F, { scale: sc, tol: D.tol, passes: 2 });
  await tick();
  progress(0.95);
  const shapes = [];
  // grosse Flächen zuerst
  const order = Array.from({ length: Lb.F }, (_, i) => i).sort((a, b) => Lb.area[b] - Lb.area[a]);
  for (const f of order) {
    if (!V.paths[f]) continue;
    const s = { d: V.paths[f], c: Lb.cls[f] };
    if (V.ringCount[f] > 1) s.r = 'evenodd';
    shapes.push(s);
  }
  const puzzle = finalizePuzzle({
    id: 'foto-' + (seed >>> 0).toString(36),
    title: 'Mein Foto',
    category: 'Meine Fotos',
    width: outW,
    height: outH,
    palette,
    shapes,
  });
  // Bildrand exakt auf die Ausgabegrösse (Rundung der kurzen Seite)
  progress(1);
  return puzzle;
}

function dedupeCenters(centers, minD) {
  const out = [];
  for (const c of centers) {
    if (out.some((o) => deltaE(o, c) < minD)) continue;
    out.push(c);
  }
  return out;
}

/** Palette verschönern: etwas mehr Sättigung/Kontrast, Beinahe-Doppel auseinanderschieben. */
function beautify(labs) {
  const out = labs.map(([L, a, b]) => {
    const C = Math.hypot(a, b);
    const boost = C < 6 ? 1 : 1.12;
    const L2 = 50 + (L - 50) * 1.04;
    return [Math.max(2, Math.min(99, L2)), a * boost, b * boost];
  });
  for (let it = 0; it < 4; it++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (deltaE(out[i], out[j]) < 6) {
          const s = out[i][0] >= out[j][0] ? 1 : -1;
          out[i][0] = Math.max(2, Math.min(99, out[i][0] + 2 * s));
          out[j][0] = Math.max(2, Math.min(99, out[j][0] - 2 * s));
        }
      }
    }
  }
  const hex = out.map(([L, a, b]) => labToHex(L, a, b));
  // exakt gleiche Hex-Werte vermeiden
  const seen = new Set();
  return hex.map((h, i) => {
    let v = h;
    let k = 1;
    while (seen.has(v)) v = labToHex(Math.min(99, out[i][0] + k++), out[i][1], out[i][2]);
    seen.add(v);
    return v;
  });
}
