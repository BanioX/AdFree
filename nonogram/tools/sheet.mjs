// Kontaktbogen: rendert alle Bilder (oder ein Paket) als PNG zur Sichtkontrolle.
//
//   node nonogram/tools/sheet.mjs <ausgabe.png> [paket-id] [--px 10]

import { createRequire } from 'node:module';
import { packs } from '../data/index.js';
import { parsePuzzle } from '../core/puzzle.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'sheet.png';
const only = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const pxArg = process.argv.indexOf('--px');
const PX = pxArg > 0 ? Number(process.argv[pxArg + 1]) : 9;

const items = [];
for (const pack of packs) {
  if (only && pack.id !== only) continue;
  for (const def of pack.puzzles) {
    try {
      const p = parsePuzzle(def);
      items.push({ id: def.id, title: def.title, w: p.w, h: p.h, colors: p.colors, bg: def.bg || '#fffaf3' });
    } catch (e) {
      items.push({ id: def.id, title: 'FEHLER', w: 1, h: 1, colors: ['#f00'], bg: '#fff' });
    }
  }
}

const html = `<!doctype html><html><body style="margin:0;background:#eee;font:12px sans-serif">
<div id="g" style="display:flex;flex-wrap:wrap;gap:10px;padding:10px;width:1180px"></div>
<script>
const items = ${JSON.stringify(items)};
const PX = ${PX};
for (const it of items) {
  const d = document.createElement('div');
  d.style.cssText = 'background:#fff;padding:6px;border-radius:6px;text-align:center';
  const cv = document.createElement('canvas');
  cv.width = it.w * PX; cv.height = it.h * PX;
  const c = cv.getContext('2d');
  c.fillStyle = it.bg; c.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < it.colors.length; i++) {
    if (!it.colors[i]) continue;
    c.fillStyle = it.colors[i];
    c.fillRect((i % it.w) * PX, Math.floor(i / it.w) * PX, PX, PX);
  }
  d.append(cv);
  const t = document.createElement('div'); t.textContent = it.title + ' (' + it.id + ')'; d.append(t);
  document.getElementById('g').append(d);
}
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.setContent(html);
await page.locator('#g').screenshot({ path: out });
await browser.close();
console.log(`${items.length} Bilder → ${out}`);
