#!/usr/bin/env node
// Prüfer + Vorschau für /paint/gen (Playwright, Chromium, iPhone 13).
//
//   node paint/gen/tests/check.mjs                      # alle Generatoren, Seeds 1-6
//   node paint/gen/tests/check.mjs --gen mandala --seeds 1-12
//   node paint/gen/tests/check.mjs --gen none --photos /pfad/zu/bildern --detail grob,mittel,fein
//   Optionen: --out DIR (Standard: paint/gen/tests/out), --port 8104, --no-png
//
// Prüft je Puzzle: Abdeckung (keine leeren Pixel), keine unsichtbaren Formen, Flächenzahl im
// Zielbereich, gültige Palettenindizes, jede Farbe benutzt, Determinismus; meldet zerstückelte
// und sehr kleine/schmale Flächen. Schreibt Vorschauen: farbig, Malbuch, Foto nebeneinander.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright ist global installiert (NODE_PATH); ESM-Importe sehen NODE_PATH nicht.
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes('--' + name);

const PORT = +opt('port', process.env.PORT || 8104);
const OUT = path.resolve(opt('out', path.join(HERE, 'out')));
const GENS = opt('gen', 'mandala,glas,polygon,muster').split(',').filter((g) => g && g !== 'none');
const seedArg = opt('seeds', '1-6');
const SEEDS = seedArg.includes('-')
  ? Array.from({ length: +seedArg.split('-')[1] - +seedArg.split('-')[0] + 1 }, (_, i) => +seedArg.split('-')[0] + i)
  : seedArg.split(',').map(Number);
const PHOTOS = opt('photos', null);
const DETAILS = opt('detail', 'grob,mittel,fein').split(',');
const COLORS = +opt('colors', 16);
const PNG = !flag('no-png');

const RANGES = {
  mandala: [120, 350],
  glas: [150, 350],
  polygon: [150, 400],
  muster: [100, 400],
};
const PHOTO_RANGES = { grob: [120, 250], mittel: [250, 500], fein: [500, 1000] };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file;
    if (p.startsWith('/__img/') && PHOTOS) file = path.join(PHOTOS, p.slice(7));
    else file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) && !(PHOTOS && file.startsWith(path.resolve(PHOTOS)))) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

function savePng(name, dataUrl) {
  if (!PNG) return;
  fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

const server = await serve();
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/paint/gen/tests/check.html`);
await page.waitForFunction(() => window.__check);

let failures = 0;
const summary = [];

for (const gid of GENS) {
  const rows = [];
  for (const seed of SEEDS) {
    const r = await page.evaluate(async ({ gid, seed, range }) => {
      const { generators } = await import('/paint/gen/index.js');
      const C = window.__check;
      const g = generators.find((x) => x.id === gid);
      if (!g) return { missing: true };
      const t0 = performance.now();
      const p = g.make(seed);
      const ms = performance.now() - t0;
      const same = JSON.stringify(g.make(seed)) === JSON.stringify(p);
      const st = C.analyze(p, { range });
      const col = C.renderColored(p, 1000);
      const cb = C.renderColoring(p, st.labels, 1000);
      window.__sheets = window.__sheets || {};
      (window.__sheets[gid] = window.__sheets[gid] || []).push({ col, cb, cap: `${p.title} · ${p.shapes.length} Fl. · ${p.palette.length} F.` });
      delete st.labels;
      return { ms, same, st, title: p.title, id: p.id, category: p.category, size: [p.width, p.height], colored: col.toDataURL(), coloring: cb.toDataURL(), pal: C.renderPalette(p, 1000).toDataURL() };
    }, { gid, seed, range: RANGES[gid] });
    if (r.missing) { console.log(`(${gid}: noch nicht vorhanden)`); break; }
    const { st } = r;
    if (!r.same) st.issues.push('nicht deterministisch');
    const ok = st.issues.length === 0;
    if (!ok) failures++;
    rows.push({ seed, ms: r.ms, shapes: st.shapes });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${gid} #${seed} «${r.title}» ${r.size.join('x')} ${st.shapes} Flächen, ${st.colors} Farben, ${st.kb} KB, ${r.ms.toFixed(0)} ms, min ${st.minArea} / med ${st.medArea} px²`);
    for (const i of st.issues) console.log('     ✗ ' + i);
    for (const w of st.warn) console.log('     · ' + w);
    savePng(`${gid}-${seed}-farbig.png`, r.colored);
    savePng(`${gid}-${seed}-malbuch.png`, r.coloring);
    savePng(`${gid}-${seed}-palette.png`, r.pal);
  }
  if (rows.length) {
    const sheets = await page.evaluate(({ gid }) => {
      const C = window.__check;
      const list = window.__sheets[gid] || [];
      const a = C.sheet(list.map((x) => x.col), { cols: 3, cell: 420, captions: list.map((x) => x.cap) });
      const b = C.sheet(list.map((x) => x.cb), { cols: 3, cell: 420, captions: list.map((x) => x.cap) });
      window.__sheets[gid] = [];
      return [a.toDataURL(), b.toDataURL()];
    }, { gid });
    savePng(`_${gid}-uebersicht-farbig.png`, sheets[0]);
    savePng(`_${gid}-uebersicht-malbuch.png`, sheets[1]);
    const avg = rows.reduce((s, x) => s + x.ms, 0) / rows.length;
    const counts = rows.map((x) => x.shapes);
    summary.push(`${gid}: Flächen ${Math.min(...counts)}–${Math.max(...counts)}, Ø ${avg.toFixed(0)} ms`);
  }
}

if (PHOTOS) {
  const files = fs.readdirSync(PHOTOS).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  for (const f of files) {
    for (const detail of DETAILS) {
      const r = await page.evaluate(async ({ url, detail, colors, range }) => {
        const { photoToPuzzle } = await import('/paint/gen/index.js');
        const C = window.__check;
        const blob = await (await fetch(url)).blob();
        const prog = [];
        const t0 = performance.now();
        const p = await photoToPuzzle(blob, { detail, colors, onProgress: (v) => prog.push(v) });
        const ms = performance.now() - t0;
        p.id = p.id || 'foto';
        const st = C.analyze(p, { range });
        if (p.shapes.length < range[0] || p.shapes.length > range[1]) {
          st.issues = st.issues.filter((x) => !x.startsWith('Flächenzahl'));
          st.warn.push(`Flächenzahl ${p.shapes.length} ausserhalb Ziel ${range[0]}–${range[1]}`);
          st.ok = st.issues.length === 0;
        }
        const col = C.renderColored(p, 1000);
        const cb = C.renderColoring(p, st.labels, 1000);
        const src = await C.loadImage(url);
        const sc = document.createElement('canvas');
        const s = 1000 / Math.max(src.naturalWidth, src.naturalHeight);
        sc.width = Math.round(src.naturalWidth * s); sc.height = Math.round(src.naturalHeight * s);
        sc.getContext('2d').drawImage(src, 0, 0, sc.width, sc.height);
        const side = C.sheet([sc, col, cb], { cols: 3, cell: 640, gap: 10 });
        delete st.labels;
        const progOk = prog.length > 2 && prog[prog.length - 1] === 1 && prog.every((v, i) => i === 0 || v >= prog[i - 1]);
        return { ms, st, side: side.toDataURL(), colored: col.toDataURL(), coloring: cb.toDataURL(), pal: C.renderPalette(p, 1000).toDataURL(), size: [p.width, p.height], progOk, progN: prog.length };
      }, { url: `/__img/${encodeURIComponent(f)}`, detail, colors: COLORS, range: PHOTO_RANGES[detail] });
      const { st } = r;
      if (!r.progOk) st.issues.push('Fortschritt nicht monoton / unvollständig');
      const ok = st.issues.length === 0;
      if (!ok) failures++;
      const base = f.replace(/\.[^.]+$/, '');
      console.log(`${ok ? 'OK  ' : 'FAIL'} Foto ${f} [${detail}] ${r.size.join('x')} ${st.shapes} Flächen, ${st.colors} Farben, ${st.kb} KB, ${r.ms.toFixed(0)} ms, min ${st.minArea} / med ${st.medArea} px², Fortschritt ${r.progN}x`);
      for (const i of st.issues) console.log('     ✗ ' + i);
      for (const w of st.warn) console.log('     · ' + w);
      savePng(`foto-${base}-${detail}-vergleich.png`, r.side);
      savePng(`foto-${base}-${detail}-malbuch.png`, r.coloring);
      savePng(`foto-${base}-${detail}-farbig.png`, r.colored);
      savePng(`foto-${base}-${detail}-palette.png`, r.pal);
      summary.push(`Foto ${f} [${detail}]: ${st.shapes} Flächen, ${r.ms.toFixed(0)} ms`);
    }
  }
}

await browser.close();
server.close();
console.log('\n' + summary.join('\n'));
if (errors.length) {
  console.log('\nKonsolenfehler:');
  for (const e of [...new Set(errors)]) console.log('  ' + e);
}
console.log(failures || errors.length ? `\n${failures} Fehler, ${errors.length} Konsolenmeldungen` : '\nAlles in Ordnung.');
process.exit(failures || errors.length ? 1 : 0);
