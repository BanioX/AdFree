// Farbenzauber – Art Team A: picture checker + preview renderer.
//
//   node paint/art/a/tools/check.mjs [id-or-name ...] [--out DIR] [--no-sheet] [--debug]
//
// Loads every picture through ../index.js (the real module contract), then in Chromium:
//  * rasterizes an id map (no anti-aliasing, painter's order) at 1 px per unit to measure each
//    shape's visible area, its inscribed radius (distance transform) and same-colour neighbours;
//  * FAILS on uncovered canvas, zero-area shapes, bad palette indices, unused/duplicate palette
//    colours, more than MAX_TINY shapes below TINY_PX, region count outside 60..250;
//  * renders the finished picture, the colouring-book view (white fills, thin outlines in painter's
//    order, numbers at the pole of inaccessibility) and contact sheets as PNGs.
//
// Exit code 1 if any picture fails.

import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const artDir = resolve(here, '..');

const MIN_REGIONS = 60, MAX_REGIONS = 250;
const TINY_PX = 300, MAX_TINY = 6;
const THIN_R = 4.5; // inscribed radius (px) below which a region is reported as a sliver
const SAME_ADJ_PX = 12; // shared boundary length (px) to report same-colour neighbours

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const req = createRequire(import.meta.url);
    try {
      return req('playwright');
    } catch {
      const root = execSync('npm root -g').toString().trim();
      return req(join(root, 'playwright'));
    }
  }
}

const args = process.argv.slice(2);
let outDir = join(here, 'out');
const filters = [];
let sheet = true, debug = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') outDir = resolve(args[++i]);
  else if (args[i] === '--no-sheet') sheet = false;
  else if (args[i] === '--debug') debug = true;
  else filters.push(args[i]);
}
mkdirSync(outDir, { recursive: true });

const { pictures } = await import(pathToFileURL(join(artDir, 'index.js')).href);
const ids = new Set();
const entries = [];
for (const p of pictures) {
  if (ids.has(p.id)) throw new Error(`duplicate id ${p.id}`);
  ids.add(p.id);
  const want = !filters.length || filters.some((f) => p.id === f || p.id.endsWith('-' + f) || p.id.includes(f));
  if (want) entries.push(p);
}

/* ------------------------------------------------------------ static checks (node) */

function staticCheck(meta, pz) {
  const errors = [], warnings = [];
  if (pz.id !== meta.id) errors.push(`id mismatch: index ${meta.id} vs module ${pz.id}`);
  if (!/^[a-z0-9-]+$/.test(pz.id)) errors.push(`bad id ${pz.id}`);
  if (pz.title !== meta.title) errors.push(`title mismatch`);
  if (/ß/.test(pz.title)) errors.push('title contains ß (Swiss orthography: ss)');
  if (!(pz.width > 0 && pz.height > 0)) errors.push('bad size');
  if (!Array.isArray(pz.palette) || !pz.palette.length || pz.palette.length > 30) errors.push('bad palette length');
  const seen = new Map();
  pz.palette.forEach((c, i) => {
    if (!/^#[0-9a-f]{6}$/i.test(c)) errors.push(`palette[${i}] not #rrggbb: ${c}`);
    const k = c.toLowerCase();
    if (seen.has(k)) errors.push(`palette colours ${seen.get(k) + 1} and ${i + 1} identical (${c})`);
    seen.set(k, i);
  });
  const used = new Set();
  pz.shapes.forEach((s, i) => {
    if (typeof s.d !== 'string' || !s.d.length) errors.push(`shape ${i}: empty d`);
    if (!Number.isInteger(s.c) || s.c < 0 || s.c >= pz.palette.length) errors.push(`shape ${i}: invalid palette index ${s.c}`);
    else used.add(s.c);
    if (s.r && s.r !== 'evenodd') errors.push(`shape ${i}: bad fill rule ${s.r}`);
  });
  pz.palette.forEach((c, i) => {
    if (!used.has(i)) errors.push(`palette colour ${i + 1} (${c}) unused`);
  });
  const n = pz.shapes.length;
  if (n < MIN_REGIONS || n > MAX_REGIONS) errors.push(`region count ${n} outside ${MIN_REGIONS}..${MAX_REGIONS}`);
  if (pz.palette.length < 6 || pz.palette.length > 20) warnings.push(`palette has ${pz.palette.length} colours`);
  return { errors, warnings };
}

/* ------------------------------------------------------------ in-page analysis */

const PAGE_JS = String.raw`
window.loadSvg = (svg) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = (e) => rej(new Error('svg load failed'));
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});

window.analyze = async (pz, opt) => {
  const W = pz.width, H = pz.height, N = W * H;
  const body = pz.shapes.map((s, i) => {
    const id = i + 1;
    return '<path d="' + s.d + '" fill="rgb(' + (id & 255) + ',' + ((id >> 8) & 255) + ',128)"' + (s.r ? ' fill-rule="evenodd"' : '') + '/>';
  }).join('');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges">'
    + '<rect width="' + W + '" height="' + H + '" fill="rgb(0,0,0)"/>' + body + '</svg>';
  const img = await loadSvg(svg);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingEnabled = false;
  cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, W, H).data;
  const ids = new Int32Array(N);
  let uncovered = 0, invalid = 0;
  for (let p = 0, q = 0; p < N; p++, q += 4) {
    const r = px[q], g = px[q + 1], b = px[q + 2];
    if (b === 128) ids[p] = r + g * 256;
    else if (r === 0 && g === 0 && b === 0) { ids[p] = 0; uncovered++; }
    else { ids[p] = -1; invalid++; }
  }
  const S = pz.shapes.length;
  // distance transform (chamfer), boundary = pixel touching another id or the canvas edge
  const INF = 1e9;
  const d = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, v = ids[p];
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || ids[p - 1] !== v || ids[p + 1] !== v || ids[p - W] !== v || ids[p + W] !== v) d[p] = 0.5;
    else d[p] = INF;
  }
  const D = 1.4142;
  for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x; let v = d[p];
    if (v === 0.5) continue;
    v = Math.min(v, d[p - 1] + 1, d[p - W] + 1, d[p - W - 1] + D, d[p - W + 1] + D);
    d[p] = v;
  }
  for (let y = H - 2; y >= 0; y--) for (let x = W - 2; x > 0; x--) {
    const p = y * W + x; let v = d[p];
    if (v === 0.5) continue;
    v = Math.min(v, d[p + 1] + 1, d[p + W] + 1, d[p + W + 1] + D, d[p + W - 1] + D);
    d[p] = v;
  }
  const area = new Int32Array(S + 1), best = new Float32Array(S + 1), bx = new Int32Array(S + 1), by = new Int32Array(S + 1);
  for (let p = 0; p < N; p++) {
    const v = ids[p];
    if (v <= 0) continue;
    area[v]++;
    if (d[p] > best[v]) { best[v] = d[p]; bx[v] = p % W; by[v] = (p / W) | 0; }
  }
  // same-colour neighbours
  const same = new Map();
  const col = (v) => pz.shapes[v - 1].c;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, v = ids[p];
    if (v <= 0) continue;
    if (x < W - 1) { const u = ids[p + 1]; if (u > 0 && u !== v && col(u) === col(v)) { const k = Math.min(u, v) * 65536 + Math.max(u, v); same.set(k, (same.get(k) || 0) + 1); } }
    if (y < H - 1) { const u = ids[p + W]; if (u > 0 && u !== v && col(u) === col(v)) { const k = Math.min(u, v) * 65536 + Math.max(u, v); same.set(k, (same.get(k) || 0) + 1); } }
  }
  // connected components per id (4-connectivity, union-find); count parts >= 40 px
  const parent = new Int32Array(N);
  for (let p = 0; p < N; p++) parent[p] = p;
  const find = (p) => { while (parent[p] !== p) { parent[p] = parent[parent[p]]; p = parent[p]; } return p; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, v = ids[p];
    if (v <= 0) continue;
    if (x < W - 1 && ids[p + 1] === v) { const a = find(p), b = find(p + 1); if (a !== b) parent[a] = b; }
    if (y < H - 1 && ids[p + W] === v) { const a = find(p), b = find(p + W); if (a !== b) parent[a] = b; }
  }
  const compSize = new Map();
  for (let p = 0; p < N; p++) if (ids[p] > 0) { const r = find(p); compSize.set(r, (compSize.get(r) || 0) + 1); }
  const parts = new Int32Array(S + 1);
  const partSizes = Array.from({ length: S + 1 }, () => []);
  for (const [root, n] of compSize) if (n >= 40) { parts[ids[root]]++; partSizes[ids[root]].push(n); }
  const regions = [];
  for (let v = 1; v <= S; v++) regions.push({ i: v - 1, c: pz.shapes[v - 1].c, area: area[v], r: +best[v].toFixed(1), x: bx[v], y: by[v], parts: parts[v], partSizes: partSizes[v].sort((a, b) => b - a) });
  const sameList = [...same.entries()].map(([k, n]) => ({ a: Math.floor(k / 65536) - 1, b: (k % 65536) - 1, n }));

  // ---------- renders
  const sc = opt.scale;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const paths = pz.shapes.map((s) => new Path2D(s.d));
  const lines = (pz.lines || []).map((l) => ({ p: new Path2D(l.d), w: l.w, color: l.color }));
  const drawLines = (g) => { for (const l of lines) { g.lineWidth = l.w; g.strokeStyle = l.color; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(l.p); } };

  const color = mk(W * sc, H * sc);
  { const g = color.getContext('2d'); g.scale(sc, sc); g.fillStyle = pz.background || '#fff'; g.fillRect(0, 0, W, H);
    pz.shapes.forEach((s, i) => { g.fillStyle = pz.palette[s.c]; g.fill(paths[i], s.r === 'evenodd' ? 'evenodd' : 'nonzero'); });
    drawLines(g); }

  const book = mk(W * sc, H * sc);
  { const g = book.getContext('2d'); g.scale(sc, sc); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.lineJoin = 'round'; g.strokeStyle = '#5b524c'; g.lineWidth = 1.6;
    pz.shapes.forEach((s, i) => { g.fillStyle = '#fff'; g.fill(paths[i], s.r === 'evenodd' ? 'evenodd' : 'nonzero'); g.stroke(paths[i]); });
    drawLines(g);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const r of regions) {
      if (!r.area) continue;
      const tiny = r.area < opt.tiny;
      const fs = Math.max(7, Math.min(40, r.r * 1.15));
      if (opt.debug && (tiny || r.r < opt.thin)) { g.fillStyle = tiny ? 'rgba(255,0,0,.55)' : 'rgba(255,140,0,.45)'; g.beginPath(); g.arc(r.x, r.y, Math.max(6, r.r), 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#7a6e66'; g.font = '600 ' + fs + 'px Helvetica, Arial, sans-serif';
      g.fillText(String(r.c + 1), r.x, r.y + fs * 0.04);
    }
    if (opt.debug) { g.strokeStyle = 'rgba(230,0,200,.9)'; g.lineWidth = 3;
      for (const s of sameList) if (s.n >= opt.sameAdj) { const A = regions[s.a], B = regions[s.b]; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); } }
  }
  // side-by-side pair at fixed height 800
  const ph = 800, pw = Math.round(W * ph / H);
  const pair = mk(pw * 2 + 12, ph + 60);
  { const g = pair.getContext('2d'); g.fillStyle = '#efe8df'; g.fillRect(0, 0, pair.width, pair.height);
    g.drawImage(color, 0, 60, pw, ph); g.drawImage(book, pw + 12, 60, pw, ph);
    // palette swatches
    const n = pz.palette.length, sw = Math.min(56, (pair.width - 20) / n);
    pz.palette.forEach((c, i) => { g.fillStyle = c; g.fillRect(10 + i * sw, 8, sw - 6, 44); g.fillStyle = '#333'; g.font = '600 16px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 10 + i * sw + (sw - 6) / 2, 30); });
  }
  return { uncovered, invalid, regions, same: sameList,
    color: color.toDataURL('image/png'), book: book.toDataURL('image/png'), pair: pair.toDataURL('image/png') };
};
`;

const pw = await loadPlaywright();
const browser = await pw.chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: PAGE_JS });

const toBuf = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
const results = [];
let failed = 0;

for (const meta of entries) {
  const pz = await meta.load();
  const { errors, warnings } = staticCheck(meta, pz);
  let res = null;
  if (!errors.some((e) => e.includes('invalid palette index') || e.includes('empty d'))) {
    res = await page.evaluate(([p, o]) => window.analyze(p, o), [pz, { scale: 1, tiny: TINY_PX, thin: THIN_R, sameAdj: SAME_ADJ_PX, debug }]);
    const total = pz.width * pz.height;
    if (res.uncovered > total * 0.0005) errors.push(`${res.uncovered} uncovered pixels`);
    if (res.invalid > 0) warnings.push(`${res.invalid} non-id pixels (anti-aliasing?)`);
    const zero = res.regions.filter((r) => r.area === 0);
    if (zero.length) errors.push(`zero visible area: shapes ${zero.map((r) => r.i).join(', ')}`);
    const tiny = res.regions.filter((r) => r.area > 0 && r.area < TINY_PX);
    if (tiny.length > MAX_TINY) errors.push(`${tiny.length} shapes below ${TINY_PX}px (max ${MAX_TINY})`);
    if (tiny.length) warnings.push(`tiny (<${TINY_PX}px): ${tiny.map((r) => `#${r.i}(c${r.c + 1},${r.area}px)`).join(' ')}`);
    const thin = res.regions.filter((r) => r.area >= TINY_PX && r.r < THIN_R);
    if (thin.length) warnings.push(`thin (r<${THIN_R}): ${thin.map((r) => `#${r.i}(c${r.c + 1},r${r.r},${r.area}px@${r.x},${r.y})`).join(' ')}`);
    const split = res.regions.filter((r) => r.parts > 1);
    if (split.length) warnings.push(`split into parts: ${split.map((r) => `#${r.i}(c${r.c + 1}: ${r.partSizes.join('+')}px)`).join(' ')}`);
    const same = res.same.filter((s) => s.n >= SAME_ADJ_PX);
    if (same.length) warnings.push(`same-colour neighbours: ${same.map((s) => `#${s.a}/#${s.b}(c${pz.shapes[s.a].c + 1},${s.n}px)`).join(' ')}`);
    writeFileSync(join(outDir, `${pz.id}.png`), toBuf(res.color));
    writeFileSync(join(outDir, `${pz.id}-num.png`), toBuf(res.book));
    writeFileSync(join(outDir, `${pz.id}-pair.png`), toBuf(res.pair));
  }
  const file = join(artDir, `${pz.id.replace(/^a-/, '')}.js`);
  let kb = null;
  try { kb = Math.round(statSync(file).size / 1024); } catch {}
  const areas = res ? res.regions.map((r) => r.area).filter((a) => a > 0).sort((a, b) => a - b) : [];
  const summary = {
    id: pz.id, title: pz.title, category: pz.category, regions: pz.shapes.length, colors: pz.palette.length,
    size: `${pz.width}x${pz.height}`, kb, minArea: areas[0], medianArea: areas[areas.length >> 1], errors, warnings,
  };
  results.push(summary);
  if (errors.length) failed++;
  const mark = errors.length ? 'FAIL' : 'ok  ';
  console.log(`${mark} ${pz.id.padEnd(18)} ${String(summary.regions).padStart(3)} regions ${String(summary.colors).padStart(2)} colours  ${summary.size}  ${kb ?? '?'}KB  min ${summary.minArea}px  median ${summary.medianArea}px`);
  for (const e of errors) console.log(`     ERROR ${e}`);
  for (const w of warnings) console.log(`     warn  ${w}`);
}

if (sheet && results.length > 1) {
  const cell = 300;
  const cols = Math.min(5, results.length);
  for (const kind of ['', '-num']) {
    const html = `<!doctype html><html><body style="margin:0;background:#efe8df;font:600 14px Arial">
      <div style="display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:14px;padding:14px">
      ${results.map((r) => `<div><img src="file://${join(outDir, r.id + kind + '.png')}" style="width:${cell}px;height:${cell}px;object-fit:contain;background:#fff;display:block">
        <div style="padding:4px 0">${r.title} · ${r.regions} · ${r.colors} Farben</div></div>`).join('')}
      </div></body></html>`;
    const sheetFile = join(outDir, `sheet${kind}.html`);
    writeFileSync(sheetFile, html);
    const sp = await browser.newPage({ viewport: { width: cols * (cell + 14) + 14, height: 400 } });
    await sp.goto(pathToFileURL(sheetFile).href);
    await sp.waitForLoadState('load');
    await sp.screenshot({ path: join(outDir, `sheet${kind}.png`), fullPage: true });
    await sp.close();
  }
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify(results, null, 2));
if (consoleErrors.length) {
  console.log('page errors:', consoleErrors);
  failed++;
}
await browser.close();
console.log(failed ? `\n${failed} picture(s) FAILED` : `\nall ${results.length} picture(s) ok`);
process.exit(failed ? 1 : 0);
