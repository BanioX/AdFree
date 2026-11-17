// Rasterisiert ein Puzzle im Browser als Id-Karte (ohne Kantenglättung) und liefert
// pro Form die sichtbare Fläche (px bei 1000 px Kantenlänge) und den grössten Innenabstand.
// Wird von src/build.mjs zum Ausdünnen von Füllformen (prune) benutzt.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let browser = null;
let page = null;

async function getPage() {
  if (page) return page;
  const { chromium } = require('playwright');
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
  return page;
}

export async function closeRaster() {
  if (browser) await browser.close();
  browser = null;
  page = null;
}

/**
 * Statistik pro Form: area[], dist[], adj [[a, b, kontakt]].
 * Mit patch = { small, fillerMax, filler: bool[] } zusätzlich patches: abgetrennte Stücke einer Form
 * (Konturpolygon in Bildkoordinaten, leicht vergrössert) samt der obersten Nachbarform, die sie übermalen soll.
 */
export async function regionStats(pz, patch = null) {
  const pg = await getPage();
  return pg.evaluate(async ({ pz, patch }) => {
    const W = pz.width;
    const H = pz.height;
    const S = 1000 / Math.max(W, H);
    const w = Math.round(W * S);
    const h = Math.round(H * S);
    const n = pz.shapes.length;
    const esc = (d) => d.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`;
    pz.shapes.forEach((s, k) => {
      const v = k + 1;
      svg += `<path d="${esc(s.d)}" fill="rgb(${v & 255},${(v >> 8) & 255},77)"${s.r === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>`;
    });
    svg += '</svg>';
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const px = cx.getImageData(0, 0, w, h).data;
    const N = w * h;
    const id = new Int32Array(N);
    const area = new Array(n).fill(0);
    for (let p = 0; p < N; p++) {
      const v = px[p * 4] + (px[p * 4 + 1] << 8) - 1;
      if (px[p * 4 + 3] !== 255 || px[p * 4 + 2] !== 77 || v < 0 || v >= n) {
        id[p] = -1;
        continue;
      }
      id[p] = v;
      area[v]++;
    }
    const dist = new Float32Array(N).fill(1e9);
    for (let pass = 0; pass < 2; pass++) {
      const fw = pass === 0;
      for (let yy = 0; yy < h; yy++) {
        const y = fw ? yy : h - 1 - yy;
        for (let xx = 0; xx < w; xx++) {
          const x = fw ? xx : w - 1 - xx;
          const p = y * w + x;
          let d = dist[p];
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) d = Math.min(d, 3);
          const nb = fw
            ? [[x > 0, p - 1, 3], [y > 0, p - w, 3], [y > 0 && x > 0, p - w - 1, 4], [y > 0 && x < w - 1, p - w + 1, 4]]
            : [[x < w - 1, p + 1, 3], [y < h - 1, p + w, 3], [y < h - 1 && x < w - 1, p + w + 1, 4], [y < h - 1 && x > 0, p + w - 1, 4]];
          for (const [ok, q, wt] of nb) {
            if (!ok) continue;
            const v = id[q] === id[p] ? dist[q] + wt : wt;
            if (v < d) d = v;
          }
          dist[p] = d;
        }
      }
    }
    const pairs = new Map();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const a = id[p];
        if (a < 0) continue;
        if (x < w - 1) {
          const b = id[p + 1];
          if (b >= 0 && b !== a) {
            const key = a < b ? a * 65536 + b : b * 65536 + a;
            pairs.set(key, (pairs.get(key) || 0) + 1);
          }
        }
        if (y < h - 1) {
          const b = id[p + w];
          if (b >= 0 && b !== a) {
            const key = a < b ? a * 65536 + b : b * 65536 + a;
            pairs.set(key, (pairs.get(key) || 0) + 1);
          }
        }
      }
    }
    const adj = [...pairs].filter(([, c]) => c >= 4).map(([k, c]) => [Math.floor(k / 65536), k % 65536, c]);
    const maxD = new Array(n).fill(0);
    for (let p = 0; p < N; p++) {
      const k = id[p];
      if (k >= 0 && dist[p] > maxD[k]) maxD[k] = dist[p];
    }
    const out = { area, dist: maxD.map((d) => d / 3), adj };
    if (!patch) return out;

    // --- zusammenhängende Stücke ---
    const comp = new Int32Array(N).fill(-1);
    const stack = new Int32Array(N);
    const comps = [];
    for (let s0 = 0; s0 < N; s0++) {
      const k = id[s0];
      if (k < 0 || comp[s0] >= 0) continue;
      const c = comps.length;
      let top = 0;
      stack[top++] = s0;
      comp[s0] = c;
      const pix = [];
      while (top) {
        const p = stack[--top];
        pix.push(p);
        const x = p % w;
        if (x > 0 && comp[p - 1] < 0 && id[p - 1] === k) { comp[p - 1] = c; stack[top++] = p - 1; }
        if (x < w - 1 && comp[p + 1] < 0 && id[p + 1] === k) { comp[p + 1] = c; stack[top++] = p + 1; }
        if (p >= w && comp[p - w] < 0 && id[p - w] === k) { comp[p - w] = c; stack[top++] = p - w; }
        if (p < N - w && comp[p + w] < 0 && id[p + w] === k) { comp[p + w] = c; stack[top++] = p + w; }
      }
      comps.push({ k, pix });
    }
    const byShape = Array.from({ length: n }, () => []);
    comps.forEach((c, i) => byShape[c.k].push(i));
    // Trennschnitte für Formen, die in mehrere grosse Stücke zerfallen
    const splits = [];
    const minSplit = patch.minSplit || 300;
    for (let k = 0; k < n; k++) {
      const big = byShape[k].map((i) => comps[i]).filter((c) => c.pix.length >= minSplit);
      if (big.length < 2) continue;
      const boxes = big.map((c) => {
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (const p of c.pix) {
          const x = p % w;
          const y = (p - x) / w;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
        return { x0, y0, x1, y1 };
      });
      for (const axis of [0, 1]) {
        const lo = axis ? 'y0' : 'x0';
        const hi = axis ? 'y1' : 'x1';
        const sorted = boxes.slice().sort((a, b) => a[lo] - b[lo]);
        const cuts = [];
        let ok = true;
        for (let i = 1; i < sorted.length; i++) {
          const prevHi = Math.max(...sorted.slice(0, i).map((b) => b[hi]));
          if (prevHi + 2 >= sorted[i][lo]) { ok = false; break; }
          cuts.push((prevHi + 1 + sorted[i][lo]) / 2 / S);
        }
        if (ok) { splits.push({ k, axis, cuts }); break; }
      }
    }
    out.splits = splits;

    const patches = [];
    for (let k = 0; k < n; k++) {
      if (byShape[k].length < 2) continue;
      const list = byShape[k].map((i) => comps[i]).sort((a, b) => b.pix.length - a.pix.length);
      const main = list[0].pix.length;
      for (const c of list.slice(1)) {
        const sz = c.pix.length;
        const ok = sz >= 15 && (sz < patch.small || (patch.filler[k] && sz < patch.fillerMax && sz < main * 0.6) || (sz < 1000 && sz < main * 0.03));
        if (!ok) continue;
        // Nachbarn des Stücks
        const nbc = new Map();
        const mask = new Uint8Array(N);
        for (const p of c.pix) mask[p] = 1;
        let x0 = w, y0 = h, x1 = 0, y1 = 0;
        for (const p of c.pix) {
          const x = p % w;
          const y = (p - x) / w;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
            if (q < 0) continue;
            const j = id[q];
            if (j >= 0 && j !== k) nbc.set(j, (nbc.get(j) || 0) + 1);
          }
        }
        // Ziel: darüberliegender Nachbar; bevorzugt gleiche Art (Füllform) und längste gemeinsame Kante
        const score = (j) => nbc.get(j) + (patch.filler[j] ? 100000 : 0);
        const cands = [...nbc.keys()].filter((j) => j > k && pz.shapes[j].r !== 'evenodd').sort((a, b) => score(b) - score(a));
        if (!cands.length) continue;
        if (!patch.filler[cands[0]] && sz >= patch.small) continue;
        // Maske um 2 px vergrössern (in einem lokalen Fenster)
        const R = 1;
        const bx0 = Math.max(0, x0 - R - 1), by0 = Math.max(0, y0 - R - 1);
        const bx1 = Math.min(w - 1, x1 + R + 1), by1 = Math.min(h - 1, y1 + R + 1);
        const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
        const dm = new Uint8Array(bw * bh);
        for (const p of c.pix) {
          const x = p % w;
          const y = (p - x) / w;
          for (let dy = -R; dy <= R; dy++) {
            for (let dx = -R; dx <= R; dx++) {
              const xx = x + dx - bx0, yy = y + dy - by0;
              if (xx >= 0 && yy >= 0 && xx < bw && yy < bh) dm[yy * bw + xx] = 1;
            }
          }
        }
        // Moore-Konturverfolgung
        let start = -1;
        for (let i = 0; i < dm.length; i++) if (dm[i]) { start = i; break; }
        const DX = [-1, -1, 0, 1, 1, 1, 0, -1];
        const DY = [0, -1, -1, -1, 0, 1, 1, 1];
        const at = (x, y) => x >= 0 && y >= 0 && x < bw && y < bh && dm[y * bw + x] === 1;
        let cx = start % bw, cy = (start - cx) / bw;
        const sx = cx, sy = cy;
        let dir = 0; // kommen von Westen
        const contour = [[cx, cy]];
        for (let guard = 0; guard < 200000; guard++) {
          let found = false;
          for (let t = 0; t < 8; t++) {
            const d = (dir + t) % 8;
            const nx = cx + DX[d], ny = cy + DY[d];
            if (at(nx, ny)) {
              cx = nx;
              cy = ny;
              dir = (d + 6) % 8; // zurück-Richtung + 1 im Uhrzeigersinn
              found = true;
              break;
            }
          }
          if (!found) break;
          if (cx === sx && cy === sy) break;
          contour.push([cx, cy]);
        }
        if (contour.length < 3) continue;
        // vereinfachen (Douglas-Peucker) und glätten (Chaikin)
        const rdp = (pts, eps) => {
          if (pts.length < 3) return pts;
          const [a, b] = [pts[0], pts[pts.length - 1]];
          let md = 0, mi = 0;
          for (let i = 1; i < pts.length - 1; i++) {
            const p = pts[i];
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L;
            if (d > md) { md = d; mi = i; }
          }
          if (md <= eps) return [a, b];
          return [...rdp(pts.slice(0, mi + 1), eps).slice(0, -1), ...rdp(pts.slice(mi), eps)];
        };
        const half = Math.floor(contour.length / 2);
        let poly = [...rdp(contour.slice(0, half + 1), 0.8).slice(0, -1), ...rdp([...contour.slice(half), contour[0]], 0.8).slice(0, -1)];
        for (let it = 0; it < 1; it++) {
          const q = [];
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
          }
          poly = q;
        }
        const pts = poly.map(([x, y]) => [(x + bx0 + 0.5) / S, (y + by0 + 0.5) / S]);
        patches.push({ k, size: sz, target: cands[0], pts });
      }
    }
    out.patches = patches;
    return out;
  }, { pz, patch });
}
