// Bild-Analyse für Farbenzauber (läuft im Worker mit OffscreenCanvas oder im Hauptthread).
//
// Pro Form: Begrenzungsrahmen, sichtbare Fläche, Nummern-Position (Pol der Unzugänglichkeit
// des SICHTBAREN Teils) + Radius, Zusatz-Nummern für abgetrennte sichtbare Teile und ob die
// Form so winzig ist, dass sie automatisch vorausgefüllt wird.
//
// Verfahren: ID-Karte rastern (jede Form in Maler-Reihenfolge mit eindeutiger RGB-Farbe;
// kantengeglättete Pixel, die keiner ID exakt entsprechen, gelten als Rand), dann eine
// Distanztransformation über die ganze Karte. Kleine Bereiche werden lokal in hoher
// Auflösung neu gerastert (Ziel weiss, alle später gezeichneten Formen schwarz).

import { pathBBox } from './path.js';
import { edt, INF, poleOfMask, pickCentral } from './edt.js';

export const ANALYSIS_VERSION = 7;

const K = 0x9e3779; // ungerade -> Bijektion im 24-bit-Raum
const KINV = (() => {
  let x = K;
  for (let k = 0; k < 5; k++) x = Math.imul(x, 2 - Math.imul(K, x));
  return x & 0xffffff;
})();

export function idColor(i) {
  const v = Math.imul(i + 1, K) & 0xffffff;
  return '#' + v.toString(16).padStart(6, '0');
}
export function decodeId(key) {
  return (Math.imul(key, KINV) & 0xffffff) - 1;
}

export const digitsOf = (c) => String(c + 1).length;
/** Schriftgrösse (in Bild-Einheiten) relativ zum Innenkreis-Radius. */
export const fontFactor = (digits) => (digits <= 1 ? 1.3 : digits === 2 ? 1.02 : 0.78);

/** Schwellen für automatisches Vorausfüllen (abhängig von der Bildgrösse). */
export function autoThresholds(maxDim) {
  return {
    area: (0.0035 * maxDim) ** 2, // sichtbare Fläche (Einheiten²), ~3.5 Einheiten im Quadrat bei 1000
    font: (1.3 * maxDim) / 1000, // kleinste Schrift (Einheiten), die bei 16x noch gut 7 px ergibt
  };
}

export function isAuto(area, lr, c, maxDim) {
  const t = autoThresholds(maxDim);
  return !(area >= t.area) || !(lr * fontFactor(digitsOf(c)) >= t.font);
}

const noop = () => {};

/**
 * @param {{width:number,height:number,shapes:{d:string,c:number,r?:string}[]}} pz
 * @param {{createCanvas:(w:number,h:number)=>any, onProgress?:(p:number)=>void, tick?:()=>any}} env
 */
export async function analyzePuzzle(pz, env) {
  const createCanvas = env.createCanvas;
  const progress = env.onProgress || noop;
  const tick = env.tick || noop;
  const W = +pz.width || 1000, H = +pz.height || 1000;
  const shapes = pz.shapes || [];
  const n = shapes.length;
  const maxDim = Math.max(W, H);

  // ---------- 1. Pfade + Begrenzungsrahmen ----------
  const bbox = new Float32Array(n * 4);
  const paths = new Array(n);
  const rules = new Array(n);
  const PADU = 0.75;
  for (let i = 0; i < n; i++) {
    const s = shapes[i];
    rules[i] = s.r === 'evenodd' ? 'evenodd' : 'nonzero';
    let bb = null;
    try { bb = pathBBox(s.d); } catch { bb = null; }
    if (!bb || !Number.isFinite(bb[0]) || !Number.isFinite(bb[3])) bb = [0, 0, W, H];
    bbox[i * 4] = bb[0] - PADU;
    bbox[i * 4 + 1] = bb[1] - PADU;
    bbox[i * 4 + 2] = bb[2] + PADU;
    bbox[i * 4 + 3] = bb[3] + PADU;
    paths[i] = new Path2D(s.d || '');
    if ((i & 255) === 255) await tick();
  }
  progress(0.04);

  // ---------- 2. Globale ID-Karte ----------
  const G = n > 900 ? 1600 : n > 300 ? 1320 : 1024;
  const gs = G / maxDim;
  const gw = Math.max(1, Math.ceil(W * gs)), gh = Math.max(1, Math.ceil(H * gs));
  const cv = createCanvas(gw, gh);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(gs, 0, 0, gs, 0, 0);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = idColor(i);
    ctx.fill(paths[i], rules[i]);
    if ((i & 511) === 511) await tick();
  }
  const img = ctx.getImageData(0, 0, gw, gh).data;
  cv.width = 1; cv.height = 1; // Speicher freigeben
  await tick();
  progress(0.12);

  const N = gw * gh;
  const lab = new Int32Array(N); // 0 = Rand/keine, sonst Index+1
  const pb = new Int32Array(n * 4); // Pixel-Rahmen je Form
  for (let i = 0; i < n; i++) { pb[i * 4] = 1e9; pb[i * 4 + 1] = 1e9; pb[i * 4 + 2] = -1; pb[i * 4 + 3] = -1; }
  const count = new Int32Array(n);
  const tol = 1.2 / gs;
  for (let y = 0, p = 0; y < gh; y++) {
    const uy = (y + 0.5) / gs;
    for (let x = 0; x < gw; x++, p++) {
      const q = p * 4;
      if (img[q + 3] !== 255) continue;
      const id = decodeId((img[q] << 16) | (img[q + 1] << 8) | img[q + 2]);
      if (id < 0 || id >= n) continue;
      const ux = (x + 0.5) / gs;
      const b = id * 4;
      if (ux < bbox[b] - tol || ux > bbox[b + 2] + tol || uy < bbox[b + 1] - tol || uy > bbox[b + 3] + tol) continue;
      lab[p] = id + 1;
      count[id]++;
      if (x < pb[b]) pb[b] = x;
      if (y < pb[b + 1]) pb[b + 1] = y;
      if (x > pb[b + 2]) pb[b + 2] = x;
      if (y > pb[b + 3]) pb[b + 3] = y;
    }
  }
  await tick();

  // Rand-Merkmale + Distanztransformation
  const dist = new Float32Array(N);
  for (let y = 0, p = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++, p++) {
      const L = lab[p];
      const feat = L === 0 || x === 0 || y === 0 || x === gw - 1 || y === gh - 1 ||
        lab[p - 1] !== L || lab[p + 1] !== L || lab[p - gw] !== L || lab[p + gw] !== L;
      dist[p] = feat ? 0 : INF;
    }
  }
  await tick();
  edt(dist, gw, gh);
  await tick();
  progress(0.3);

  // ---------- 3. Zusammenhangskomponenten je Form ----------
  const visited = new Uint8Array(N);
  const stack = new Int32Array(N);
  const order = new Int32Array(N);
  let on = 0;
  const comps = []; // [shape, d2, pixel, size]
  for (let p0 = 0; p0 < N; p0++) {
    const L = lab[p0];
    if (!L || visited[p0]) continue;
    let sp = 0;
    stack[sp++] = p0;
    visited[p0] = 1;
    const start = on;
    let best = -1, sx = 0, sy = 0;
    while (sp) {
      const p = stack[--sp];
      order[on++] = p;
      const dv = dist[p];
      if (dv > best) best = dv;
      const x = p % gw;
      sx += x; sy += (p - x) / gw;
      if (x > 0 && !visited[p - 1] && lab[p - 1] === L) { visited[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < gw - 1 && !visited[p + 1] && lab[p + 1] === L) { visited[p + 1] = 1; stack[sp++] = p + 1; }
      if (p >= gw && !visited[p - gw] && lab[p - gw] === L) { visited[p - gw] = 1; stack[sp++] = p - gw; }
      if (p + gw < N && !visited[p + gw] && lab[p + gw] === L) { visited[p + gw] = 1; stack[sp++] = p + gw; }
    }
    const size = on - start;
    const bp = pickCentral(dist, gw, gh, null, best, sx / size, sy / size, [start, on, order]);
    comps.push(L - 1, dist[bp], bp, size);
    if (comps.length % 4000 === 0) await tick();
  }
  progress(0.4);

  const lx = new Float32Array(n), ly = new Float32Array(n), lr = new Float32Array(n);
  const area = new Float32Array(n);
  const mainD = new Float32Array(n).fill(-1);
  const byShape = new Map(); // Index -> [[d2, pixel], ...]
  for (let k = 0; k < comps.length; k += 4) {
    const i = comps[k], d2 = comps[k + 1], px = comps[k + 2];
    let arr = byShape.get(i);
    if (!arr) { arr = []; byShape.set(i, arr); }
    arr.push([d2, px]);
  }
  const extras = [];
  for (let i = 0; i < n; i++) {
    area[i] = count[i] / (gs * gs);
    const arr = byShape.get(i);
    if (!arr) continue;
    arr.sort((a, b) => b[0] - a[0]);
    const [d2, px] = arr[0];
    mainD[i] = Math.sqrt(d2);
    lx[i] = ((px % gw) + 0.5) / gs;
    ly[i] = (Math.floor(px / gw) + 0.5) / gs;
    lr[i] = Math.max(0, Math.sqrt(d2) - 0.5) / gs;
    for (let k = 1; k < arr.length && k <= 12; k++) {
      const r = Math.sqrt(arr[k][0]);
      if (r < 5) break;
      extras.push(i, ((arr[k][1] % gw) + 0.5) / gs, (Math.floor(arr[k][1] / gw) + 0.5) / gs, (r - 0.5) / gs);
    }
  }

  // ---------- 4. Kleine Bereiche lokal fein rastern ----------
  const LC = 112, PAD = 3;
  const lc = createCanvas(LC, LC);
  const lctx = lc.getContext('2d', { willReadFrequently: true });
  const refine = [];
  for (let i = 0; i < n; i++) if (count[i] === 0 || mainD[i] < 8 || count[i] < 200) refine.push(i);
  const refined = new Uint8Array(n);
  const mask = new Uint8Array(LC * LC);
  let lastT = Date.now();
  for (let k = 0; k < refine.length; k++) {
    const i = refine[k];
    refined[i] = 1;
    const b = i * 4;
    let x0, y0, x1, y1;
    if (count[i] > 0) {
      x0 = Math.max(bbox[b], (pb[b] - 2) / gs);
      y0 = Math.max(bbox[b + 1], (pb[b + 1] - 2) / gs);
      x1 = Math.min(bbox[b + 2], (pb[b + 2] + 3) / gs);
      y1 = Math.min(bbox[b + 3], (pb[b + 3] + 3) / gs);
    } else {
      x0 = bbox[b]; y0 = bbox[b + 1]; x1 = bbox[b + 2]; y1 = bbox[b + 3];
    }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
    let res = null;
    let firstArea = -1;
    for (let pass = 0; pass < 4; pass++) {
      const rw = x1 - x0, rh = y1 - y0;
      if (!(rw > 1e-6 && rh > 1e-6)) break;
      const ls = (LC - 2 * PAD) / Math.max(rw, rh);
      const lw = Math.min(LC, Math.ceil(rw * ls) + 2 * PAD);
      const lh = Math.min(LC, Math.ceil(rh * ls) + 2 * PAD);
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.fillStyle = '#000';
      lctx.fillRect(0, 0, lw, lh);
      lctx.save();
      lctx.setTransform(ls, 0, 0, ls, PAD - x0 * ls, PAD - y0 * ls);
      lctx.beginPath();
      lctx.rect(x0, y0, rw, rh);
      lctx.clip();
      lctx.fillStyle = '#fff';
      lctx.fill(paths[i], rules[i]);
      lctx.fillStyle = '#000';
      for (let j = i + 1; j < n; j++) {
        const c = j * 4;
        if (bbox[c] > x1 || bbox[c + 2] < x0 || bbox[c + 1] > y1 || bbox[c + 3] < y0) continue;
        lctx.fill(paths[j], rules[j]);
      }
      lctx.restore();
      const data = lctx.getImageData(0, 0, lw, lh).data;
      let sum = 0;
      let vx0 = 1e9, vy0 = 1e9, vx1 = -1, vy1 = -1;
      for (let y = 0, p = 0; y < lh; y++) {
        for (let x = 0; x < lw; x++, p++) {
          const v = data[p * 4];
          sum += v;
          const inside = v >= 128 ? 1 : 0;
          mask[p] = inside;
          if (inside) {
            if (x < vx0) vx0 = x;
            if (x > vx1) vx1 = x;
            if (y < vy0) vy0 = y;
            if (y > vy1) vy1 = y;
          }
        }
      }
      if (firstArea < 0) firstArea = sum / 255 / (ls * ls);
      if (vx1 < 0) {
        // nichts deutlich sichtbar: bei sehr grobem Raster trotzdem genauer hinschauen
        if (pass === 0 && firstArea > 0 && Math.max(lw, lh) > 30) {
          let bx = -1, bv = 0;
          for (let p = 0; p < lw * lh; p++) if (data[p * 4] > bv) { bv = data[p * 4]; bx = p; }
          if (bx >= 0) {
            const cx = ((bx % lw) - PAD + 0.5) / ls + x0, cy = (Math.floor(bx / lw) - PAD + 0.5) / ls + y0;
            const hs = 6 / ls;
            x0 = Math.max(0, cx - hs); y0 = Math.max(0, cy - hs); x1 = Math.min(W, cx + hs); y1 = Math.min(H, cy + hs);
            continue;
          }
        }
        break;
      }
      const pole = poleOfMask(mask.subarray(0, lw * lh), lw, lh);
      if (pole) res = { x: (pole.x - PAD) / ls + x0, y: (pole.y - PAD) / ls + y0, r: pole.r / ls };
      if (pass === 3) break;
      const vw = vx1 - vx0 + 1, vh = vy1 - vy0 + 1;
      const big = Math.max(lw, lh) - 2 * PAD;
      if (Math.max(vw, vh) < big * 0.4) {
        // sichtbarer Teil ist viel kleiner als der Ausschnitt: genauer hinschauen
        const nx0 = (vx0 - PAD - 1.5) / ls + x0, ny0 = (vy0 - PAD - 1.5) / ls + y0;
        const nx1 = (vx1 - PAD + 2.5) / ls + x0, ny1 = (vy1 - PAD + 2.5) / ls + y0;
        x0 = Math.max(0, nx0); y0 = Math.max(0, ny0); x1 = Math.min(W, nx1); y1 = Math.min(H, ny1);
        continue;
      }
      if (pole && pole.r < 3.5 && big > 24) {
        // dünne Stelle: Auflösung reicht nicht – um den Pol herum vergrössern
        const hs = Math.max(1.5, (pole.r + 1) * 7) / ls;
        x0 = Math.max(0, res.x - hs); y0 = Math.max(0, res.y - hs);
        x1 = Math.min(W, res.x + hs); y1 = Math.min(H, res.y + hs);
        continue;
      }
      break;
    }
    area[i] = Math.max(0, firstArea);
    if (res) { lx[i] = res.x; ly[i] = res.y; lr[i] = res.r; } else lr[i] = 0;
    if (Date.now() - lastT > 12) {
      lastT = Date.now();
      progress(0.4 + 0.58 * (k / refine.length));
      await tick();
    }
  }
  lc.width = 1; lc.height = 1;

  // Zusatz-Nummern nur für nicht verfeinerte Formen behalten
  const ex = [];
  for (let k = 0; k < extras.length; k += 4) if (!refined[extras[k]]) ex.push(extras[k], extras[k + 1], extras[k + 2], extras[k + 3]);

  // ---------- 5. Automatisch vorausfüllen ----------
  const auto = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = shapes[i].c | 0;
    if (isAuto(area[i], lr[i], c, maxDim)) auto[i] = 1;
  }
  progress(1);
  return { n, W, H, bbox, area, lx, ly, lr, auto, extra: new Float32Array(ex) };
}
