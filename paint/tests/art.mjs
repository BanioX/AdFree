// Prüft ALLE Bilder der Bibliothek (/paint/art/a + /paint/art/b über /paint/art/index.js) im Browser:
// laden, bereinigen, Abdeckung (keine Löcher), gültige Pfade/Farben, Engine-Analyse (Nummern,
// automatisch vorausgefüllte Flächen) und Darstellung. Schreibt einen Kontaktabzug nach tests/out/.
//
//   node paint/tests/art.mjs            # alle Bilder
//   node paint/tests/art.mjs a-rose     # nur bestimmte ids (kommagetrennt)
//
// Nutzt Port 8101 (startet bei Bedarf einen statischen Server und beendet ihn am Schluss).

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const OUT = join(here, 'out');
mkdirSync(OUT, { recursive: true });
const PORT = 8101;
const BASE = `http://127.0.0.1:${PORT}`;
const only = (process.argv[2] || '').split(',').filter(Boolean);

async function ensureServer() {
  try { if ((await fetch(BASE + '/paint/')).ok) return null; } catch { /* aus */ }
  const p = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  for (let k = 0; k < 50; k++) {
    await new Promise((r) => setTimeout(r, 100));
    try { if ((await fetch(BASE + '/paint/')).ok) return p; } catch { /* warten */ }
  }
  throw new Error('Server startet nicht');
}

const server = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

let failures = 0;
try {
  await page.goto(BASE + '/paint/gen/tests/check.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__check, null, { timeout: 15000 });
  const res = await page.evaluate(async (only) => {
    const C = window.__check;
    const { pictures } = await import('/paint/art/index.js');
    const { sanitizePuzzle, buildModel } = await import('/paint/engine/model.js');
    const { analyzePuzzle } = await import('/paint/engine/analyze-core.js');
    const out = [];
    const tiles = [];
    const caps = [];
    for (const item of pictures) {
      if (only.length && !only.includes(item.id)) continue;
      const r = { id: item.id, title: item.title, category: item.category, problems: [], notes: [] };
      out.push(r);
      let raw;
      try { raw = await item.load(); } catch (e) { r.problems.push('lädt nicht: ' + e.message); continue; }
      try {
        const p = sanitizePuzzle(raw, item.id);
        if (p.shapes.length !== (raw.shapes || []).length) r.problems.push(`${raw.shapes.length - p.shapes.length} Formen verworfen (leer/ungültig)`);
        p.id = item.id;
        p.title = p.title || item.title;
        p.category = p.category || item.category;
        r.shapes = p.shapes.length;
        r.colors = p.palette.length;
        const chk = C.analyze(p, { size: 1000 });
        for (const s of chk.issues) {
          // verdeckte Formen füllt die Engine selbst aus -> nur Hinweis
          if (/ohne sichtbare Fläche/.test(s)) r.notes.push(s); else r.problems.push(s);
        }
        r.notes.push(...chk.warn);
        r.kb = chk.kb;
        const t0 = performance.now();
        const an = await analyzePuzzle(p, {
          createCanvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
        });
        r.analyzeMs = Math.round(performance.now() - t0);
        const M = buildModel(p, an);
        r.total = M.total;
        r.auto = an.auto.reduce((a, b) => a + b, 0);
        let missing = 0;
        for (let i = 0; i < M.n; i++) if (!an.auto[i] && M.mainLabel[i] < 0) missing++;
        if (missing) r.problems.push(`${missing} Flächen ohne Nummer`);
        if (M.total < 10) r.problems.push('weniger als 10 ausmalbare Flächen');
        if (r.auto > Math.max(3, M.n * 0.12)) r.problems.push(`${r.auto} von ${M.n} Formen zu klein (werden vorausgefüllt)`);
        const unusedColors = M.colorShapes.map((l, c) => (l.length ? -1 : c)).filter((c) => c >= 0);
        if (unusedColors.length) r.notes.push(`Farben nur in vorausgefüllten Formen: ${unusedColors.map((c) => c + 1).join(',')}`);
        const lab = [];
        for (let k = 0; k < M.labels.length; k += 4) lab[M.labels[k]] = lab[M.labels[k]] || [M.labels[k + 1], M.labels[k + 2], M.labels[k + 3] * 1.4];
        const lbl = p.shapes.map((_, i) => lab[i] || [0, 0, 0]);
        tiles.push(C.renderColored(p, 420), C.renderColoring(p, lbl, 420));
        caps.push(`${item.id} · ${M.total} Fl. · ${p.palette.length} F.`, `${item.title}`);
      } catch (e) {
        r.problems.push('Fehler: ' + (e && e.message));
      }
    }
    const sheet = tiles.length ? C.sheet(tiles, { cols: 4, cell: 420, captions: caps }).toDataURL('image/png') : null;
    return { out, sheet };
  }, only);

  const ids = new Set();
  for (const r of res.out) {
    if (ids.has(r.id)) r.problems.push('doppelte id');
    ids.add(r.id);
    if (!/^[a-z0-9-]+$/.test(r.id)) r.problems.push('ungültige id');
    const ok = r.problems.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${r.id.padEnd(22)} ${String(r.total ?? '-').padStart(4)} Fl. ${String(r.colors ?? '-').padStart(2)} F. auto ${r.auto ?? '-'}  ${r.analyzeMs ?? '-'} ms  ${r.kb ?? '-'} KB`);
    for (const p of r.problems) console.log('        ✗ ' + p);
    for (const n of r.notes.slice(0, 3)) console.log('        · ' + n);
  }
  if (res.sheet) {
    writeFileSync(join(OUT, 'art-kontaktabzug.png'), Buffer.from(res.sheet.split(',')[1], 'base64'));
  }
  if (!res.out.length) { console.log('FAIL  keine Bilder gefunden'); failures++; }
  if (errors.length) { console.log('FAIL  Konsolenfehler: ' + errors.slice(0, 3).join(' | ')); failures++; }
  console.log(`\n${res.out.length - failures} von ${res.out.length} Bildern in Ordnung. Kontaktabzug: ${join(OUT, 'art-kontaktabzug.png')}`);
} finally {
  await browser.close();
  if (server) server.kill();
}
process.exit(failures ? 1 : 0);
