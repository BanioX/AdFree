// Prüft und rendert die Bilder von Team B in Chromium (Playwright).
//
//   node paint/art/b/tools/check.mjs [id|name …] [--out <ordner>] [--no-png]
//
// Pro Bild: Id-Karte (jede Form in eigener Farbe, ohne Kantenglättung) in 1000 px,
// daraus sichtbare Fläche je Form, Abdeckung, Abstandstransformation (Zahlenposition).
// Fehler (Exit-Code 1): unbedeckte Pixel, Formen ohne sichtbare Fläche, ungültige
// Palettenindizes, unbenutzte Farben, mehr als 6 Mini-Bereiche (< 300 px),
// Bereichszahl ausserhalb 60–250, kaputte Metadaten.
// Ausgabe: <out>/<id>-farbig.png, <id>-vorlage.png, <id>-debug.png, kontaktbogen.png
// Es wird kein Server gebraucht: Dateien werden per page.route direkt von der Platte geliefert.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const ORIGIN = 'http://spielpause.test';
const INDEX = '/paint/art/b/index.js';

const args = process.argv.slice(2);
let outDir = join(here, 'out');
let png = true;
const filter = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') outDir = resolve(args[++i]);
  else if (args[i] === '--no-png') png = false;
  else filter.push(args[i]);
}

const LIMITS = {
  minRegions: 60,
  maxRegions: 250,
  tinyArea: 300, // px bei 1000 px Kantenlänge
  maxTiny: 6,
  sliverDist: 5, // grösster Innenabstand < 5 px → «Streifen»
  minColors: 8,
  maxColors: 18,
};
const CATEGORIES = ['Blumen', 'Tiere', 'Landschaften', 'Essen', 'Fantasie', 'Mandalas', 'Muster', 'Winter'];

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };

/* ------------------------------------------------------------------ */
/* Läuft im Browser                                                    */
/* ------------------------------------------------------------------ */
async function analyze({ index, indexUrl, render, L }) {
  const mod = await import(indexUrl);
  const entry = mod.pictures[index];
  const pz = await entry.load();
  const errors = [];
  const warnings = [];

  if (!pz || typeof pz !== 'object') return { errors: ['load() liefert kein Objekt'], warnings };
  if (pz.id !== entry.id) errors.push(`id im Bild («${pz.id}») ≠ id in index.js («${entry.id}»)`);
  if (!/^[a-z0-9-]+$/.test(pz.id || '')) errors.push(`ungültige id «${pz.id}»`);
  if (!pz.title) errors.push('title fehlt');
  if (/ß/.test(pz.title || '')) errors.push('title enthält «ß»');
  if (!(pz.width > 0 && pz.height > 0)) errors.push('width/height fehlen');
  if (!Array.isArray(pz.palette) || !pz.palette.length) errors.push('palette fehlt');
  if (pz.palette.length > 30) errors.push('mehr als 30 Farben');
  if (pz.palette.length < L.minColors || pz.palette.length > L.maxColors) warnings.push(`${pz.palette.length} Farben (empfohlen ${L.minColors}–${L.maxColors})`);
  for (const col of pz.palette) if (!/^#[0-9a-f]{6}$/i.test(col)) errors.push(`ungültige Farbe ${col}`);
  const n = pz.shapes.length;
  if (n < L.minRegions || n > L.maxRegions) errors.push(`${n} Bereiche (erlaubt ${L.minRegions}–${L.maxRegions})`);
  const used = new Set();
  pz.shapes.forEach((s, k) => {
    if (!Number.isInteger(s.c) || s.c < 0 || s.c >= pz.palette.length) errors.push(`Form ${k}: ungültiger Palettenindex ${s.c}`);
    else used.add(s.c);
    if (typeof s.d !== 'string' || !s.d.length) errors.push(`Form ${k}: d fehlt`);
    if (s.r && s.r !== 'evenodd' && s.r !== 'nonzero') errors.push(`Form ${k}: ungültige Füllregel ${s.r}`);
    try {
      new Path2D(s.d);
    } catch {
      errors.push(`Form ${k}: ungültige Pfaddaten`);
    }
  });
  pz.palette.forEach((col, i) => {
    if (!used.has(i)) errors.push(`Farbe ${i + 1} (${col}) wird nicht benutzt`);
  });

  const W = pz.width;
  const H = pz.height;
  const S = 1000 / Math.max(W, H);
  const w = Math.round(W * S);
  const h = Math.round(H * S);

  // --- Id-Karte ohne Kantenglättung ---
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
  let uncovered = 0;
  let unknown = 0;
  const area = new Float64Array(n);
  for (let p = 0; p < N; p++) {
    const a = px[p * 4 + 3];
    if (a === 0) {
      id[p] = -1;
      uncovered++;
      continue;
    }
    const v = px[p * 4] + (px[p * 4 + 1] << 8) - 1;
    if (a !== 255 || px[p * 4 + 2] !== 77 || v < 0 || v >= n) {
      id[p] = -2;
      unknown++;
      continue;
    }
    id[p] = v;
    area[v]++;
  }
  if (uncovered > 30) errors.push(`${uncovered} unbedeckte Pixel`);
  if (unknown > 30) warnings.push(`${unknown} Pixel mit unbekannter Id-Farbe`);

  // --- Abstandstransformation (Chamfer 3-4) ---
  const INF = 1e9;
  const dist = new Float32Array(N).fill(INF);
  const same = (p, q) => id[p] === id[q];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      let d = dist[p];
      const cand = (q, wt) => {
        const v = same(p, q) ? dist[q] + wt : wt;
        if (v < d) d = v;
      };
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) d = Math.min(d, 3);
      if (x > 0) cand(p - 1, 3);
      if (y > 0) {
        cand(p - w, 3);
        if (x > 0) cand(p - w - 1, 4);
        if (x < w - 1) cand(p - w + 1, 4);
      }
      dist[p] = d;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      let d = dist[p];
      const cand = (q, wt) => {
        const v = same(p, q) ? dist[q] + wt : wt;
        if (v < d) d = v;
      };
      if (x < w - 1) cand(p + 1, 3);
      if (y < h - 1) {
        cand(p + w, 3);
        if (x < w - 1) cand(p + w + 1, 4);
        if (x > 0) cand(p + w - 1, 4);
      }
      dist[p] = d;
    }
  }
  const maxD = new Float32Array(n);
  const lab = new Int32Array(n).fill(-1);
  for (let p = 0; p < N; p++) {
    const k = id[p];
    if (k >= 0 && dist[p] > maxD[k]) {
      maxD[k] = dist[p];
      lab[k] = p;
    }
  }
  for (let k = 0; k < n; k++) maxD[k] /= 3;

  // --- Nachbarschaft gleicher Farbe ---
  const pairKey = new Set();
  const sameEdge = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const a = id[p];
      if (a < 0) continue;
      for (const q of [x < w - 1 ? p + 1 : -1, y < h - 1 ? p + w : -1]) {
        if (q < 0) continue;
        const b = id[q];
        if (b < 0 || b === a) continue;
        if (pz.shapes[a].c === pz.shapes[b].c) {
          pairKey.add(a < b ? `${a}-${b}` : `${b}-${a}`);
          sameEdge[p] = 1;
          sameEdge[q] = 1;
        }
      }
    }
  }

  const zero = [];
  const tiny = [];
  const slivers = [];
  const regions = [];
  for (let k = 0; k < n; k++) {
    regions.push({ k, area: area[k], dist: +maxD[k].toFixed(1) });
    if (area[k] === 0) zero.push(k);
    else if (area[k] < L.tinyArea) tiny.push(k);
    else if (maxD[k] < L.sliverDist) slivers.push(k);
  }
  if (zero.length) errors.push(`Formen ohne sichtbare Fläche: ${zero.join(', ')}`);
  if (tiny.length > L.maxTiny) errors.push(`${tiny.length} Mini-Bereiche < ${L.tinyArea} px: ${tiny.map((k) => `${k}(${area[k]})`).join(', ')}`);
  else if (tiny.length) warnings.push(`${tiny.length} kleine Bereiche: ${tiny.map((k) => `${k}(${area[k]})`).join(', ')}`);
  if (slivers.length) warnings.push(`${slivers.length} schmale Bereiche (Innenabstand < ${L.sliverDist}px): ${slivers.map((k) => `${k}(${maxD[k].toFixed(1)})`).join(', ')}`);
  if (pairKey.size) warnings.push(`${pairKey.size} Nachbarpaare gleicher Farbe: ${[...pairKey].slice(0, 12).join(', ')}${pairKey.size > 12 ? ' …' : ''}`);

  const sorted = [...area].filter((a) => a > 0).sort((a, b) => a - b);
  const stats = {
    regions: n,
    colors: pz.palette.length,
    minArea: sorted[0] || 0,
    medianArea: sorted[Math.floor(sorted.length / 2)] || 0,
    tiny: tiny.length,
    slivers: slivers.length,
    sameColorPairs: pairKey.size,
    uncovered,
  };

  const out = { id: pz.id, title: pz.title, category: pz.category, size: [W, H], stats, errors, warnings };
  if (!render) return out;

  const paths = pz.shapes.map((s) => new Path2D(s.d));
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.lineJoin = 'round';
    g.lineCap = 'round';
    return [c, g];
  };

  // (a) fertiges Bild
  const [c1, g1] = mk();
  g1.fillStyle = pz.background || '#ffffff';
  g1.fillRect(0, 0, w, h);
  g1.scale(S, S);
  pz.shapes.forEach((s, k) => {
    g1.fillStyle = pz.palette[s.c];
    g1.strokeStyle = pz.palette[s.c];
    g1.lineWidth = 0.9 / S;
    g1.fill(paths[k], s.r || 'nonzero');
    g1.stroke(paths[k]);
  });
  for (const ln of pz.lines || []) {
    g1.strokeStyle = ln.color || '#2b2420';
    g1.lineWidth = ln.w || 2;
    g1.stroke(new Path2D(ln.d));
  }

  // (b) Malvorlage
  const drawTemplate = (g, debug) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.save();
    g.scale(S, S);
    pz.shapes.forEach((s, k) => {
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#5a524c';
      g.lineWidth = 1.5 / S;
      g.fill(paths[k], s.r || 'nonzero');
      g.stroke(paths[k]);
    });
    for (const ln of pz.lines || []) {
      g.strokeStyle = ln.color || '#2b2420';
      g.lineWidth = ln.w || 2;
      g.stroke(new Path2D(ln.d));
    }
    g.restore();
    // winzige Bereiche (Engine füllt sie vor) bzw. Debug-Markierungen
    const im = g.getImageData(0, 0, w, h);
    const d = im.data;
    const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const palRgb = pz.palette.map(hex);
    const tinySet = new Set(tiny);
    const sliverSet = new Set(slivers);
    for (let p = 0; p < N; p++) {
      const k = id[p];
      if (k < 0) {
        if (debug && k === -1) d.set([0, 255, 255], p * 4);
        continue;
      }
      if (d[p * 4] < 200) continue; // Linie bleibt
      if (maxD[k] < 2.5) d.set(palRgb[pz.shapes[k].c], p * 4);
      if (debug) {
        if (tinySet.has(k)) d.set([255, 60, 60], p * 4);
        else if (sliverSet.has(k)) d.set([255, 170, 40], p * 4);
        else if (sameEdge[p]) d.set([220, 0, 220], p * 4);
      }
    }
    g.putImageData(im, 0, 0);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let k = 0; k < n; k++) {
      if (lab[k] < 0 || maxD[k] < 2.5) continue;
      const x = lab[k] % w;
      const y = Math.floor(lab[k] / w);
      const fs = Math.max(7, Math.min(30, maxD[k] * 0.95));
      g.font = `600 ${fs}px system-ui, sans-serif`;
      g.fillStyle = '#7a716a';
      g.fillText(String(pz.shapes[k].c + 1), x, y + fs * 0.05);
      if (debug && (tinySet.has(k) || sliverSet.has(k))) {
        g.font = '600 11px system-ui, sans-serif';
        g.fillStyle = '#b00000';
        g.fillText(`#${k}`, x, y + fs * 0.6 + 6);
      }
    }
  };
  const [c2, g2] = mk();
  drawTemplate(g2, false);
  const [c3, g3] = mk();
  drawTemplate(g3, true);

  out.png = {
    farbig: c1.toDataURL('image/png'),
    vorlage: c2.toDataURL('image/png'),
    debug: c3.toDataURL('image/png'),
  };
  return out;
}

/* ------------------------------------------------------------------ */

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
await page.route(`${ORIGIN}/**`, async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/__check.html') {
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>check</title><body></body>' });
  }
  const file = join(repoRoot, decodeURIComponent(url.pathname));
  if (!file.startsWith(repoRoot) || !existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
  return route.fulfill({ body: readFileSync(file), contentType: MIME[extname(file)] || 'application/octet-stream' });
});
await page.goto(`${ORIGIN}/__check.html`);

const list = await page.evaluate(async (indexUrl) => {
  const m = await import(indexUrl);
  if (!Array.isArray(m.pictures)) throw new Error('index.js exportiert kein Array «pictures»');
  return m.pictures.map((p) => ({ id: p.id, title: p.title, category: p.category, hasLoad: typeof p.load === 'function' }));
}, INDEX);

let failed = false;
const globalErrors = [];
const ids = new Set();
for (const p of list) {
  if (ids.has(p.id)) globalErrors.push(`doppelte id ${p.id}`);
  ids.add(p.id);
  if (!/^b-/.test(p.id)) globalErrors.push(`id ${p.id} ohne Präfix «b-»`);
  if (!p.hasLoad) globalErrors.push(`${p.id}: load() fehlt`);
  if (!CATEGORIES.includes(p.category)) globalErrors.push(`${p.id}: unbekannte Kategorie ${p.category}`);
  if (/ß/.test(p.title)) globalErrors.push(`${p.id}: «ß» im Titel`);
}
if (globalErrors.length) {
  failed = true;
  console.log('index.js:\n  ✗ ' + globalErrors.join('\n  ✗ '));
}

if (png) mkdirSync(outDir, { recursive: true });
const sheet = [];
for (let i = 0; i < list.length; i++) {
  const p = list[i];
  if (filter.length && !filter.some((f) => p.id === f || p.id === `b-${f}`)) continue;
  const res = await page.evaluate(analyze, { index: i, indexUrl: INDEX, render: png, L: LIMITS });
  const s = res.stats || {};
  const ok = res.errors.length === 0;
  if (!ok) failed = true;
  console.log(
    `${ok ? '✓' : '✗'} ${p.id.padEnd(18)} ${String(s.regions).padStart(4)} Bereiche ${String(s.colors).padStart(3)} Farben` +
      `  min ${s.minArea}px  median ${s.medianArea}px  klein ${s.tiny}  schmal ${s.slivers}  gleichfarbig ${s.sameColorPairs}`,
  );
  for (const e of res.errors) console.log(`    ✗ ${e}`);
  for (const wn of res.warnings) console.log(`    · ${wn}`);
  if (png && res.png) {
    for (const [k, v] of Object.entries(res.png)) {
      writeFileSync(join(outDir, `${p.id}-${k}.png`), Buffer.from(v.split(',')[1], 'base64'));
    }
    sheet.push({ ...p, stats: s, farbig: res.png.farbig, vorlage: res.png.vorlage });
  }
}

if (png && sheet.length) {
  const cells = sheet
    .map(
      (p) => `<figure><div class="pair"><img src="${p.farbig}"><img src="${p.vorlage}"></div>
      <figcaption><b>${p.title}</b> · ${p.category} · ${p.stats.regions} Bereiche · ${p.stats.colors} Farben</figcaption></figure>`,
    )
    .join('');
  await page.setViewportSize({ width: 1240, height: 800 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:16px;background:#f4efe8;font:14px system-ui,sans-serif;color:#3a332e}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    figure{margin:0;background:#fff;border-radius:10px;padding:8px;box-shadow:0 1px 3px #0002}
    .pair{display:flex;gap:6px}.pair img{width:50%;height:auto;display:block;border-radius:4px}
    figcaption{margin-top:6px}</style><div class="grid">${cells}</div>`);
  await page.screenshot({ path: join(outDir, 'kontaktbogen.png'), fullPage: true });
}

await browser.close();
if (consoleErrors.length) {
  failed = true;
  console.log('Konsolenfehler:\n  ' + consoleErrors.join('\n  '));
}
if (png) console.log(`PNGs: ${outDir}`);
process.exit(failed ? 1 : 0);
