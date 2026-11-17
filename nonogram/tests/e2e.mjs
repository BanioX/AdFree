// Bilderrätsel – End-to-End-Test (Playwright, iPhone 13).
//   python3 -m http.server 8205 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   node nonogram/tests/e2e.mjs
// Screenshots landen in nonogram/tests/out/.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8205/nonogram/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
// Chromium-Intervention bei synthetischen CDP-Touch-Gesten (kein App-Fehler) ignorieren
page.on('console', (m) => { if (m.type() === 'error' && !/^Ignored attempt to cancel a touch/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: OUT + name + '.png' }); };
const step = (s) => console.log('·', s);

/** Bildschirmkoordinaten der Zelle (r, c). */
async function cellXY(r, c) {
  return page.evaluate(([r, c]) => {
    const p = window.__nono;
    const rect = p.board.cv.getBoundingClientRect();
    const pt = p.board.cellCenter(r, c);
    return { x: rect.left + pt.x, y: rect.top + pt.y };
  }, [r, c]);
}
const cells = () => page.evaluate(() => Array.from(window.__nono.game.cells));
const info = () => page.evaluate(() => ({ w: window.__nono.game.w, h: window.__nono.game.h, mask: Array.from(window.__nono.game.p.mask) }));

async function drag(a, b, steps = 8) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
  await page.mouse.up();
}

// 1) Erster Start: Anleitung erscheint automatisch
step('Menü und Anleitung');
await page.goto(BASE);
await page.waitForSelector('.sp-modal', { timeout: 4000 });
assert.match(await page.textContent('.sp-modal h2'), /So geht/);
await shot('01-help');
await page.click('.sp-modal .btn.primary');
await page.waitForSelector('.sp-modal-backdrop', { state: 'detached' });
await shot('02-menu');

// 2) Erstes Bild (5×5) komplett lösen
step('Spielen → erstes Bild lösen');
await page.tap('#play-btn');
await page.waitForFunction(() => window.__nono && location.hash.startsWith('#play/'));
await page.waitForTimeout(300);
const { w, h, mask } = await info();
assert.equal(w, 5);

// Long-Press setzt ein Kreuz auf ein leeres Feld
const emptyIdx = mask.indexOf(0);
const er = Math.floor(emptyIdx / w), ec = emptyIdx % w;
let p = await cellXY(er, ec);
await page.mouse.move(p.x, p.y);
await page.mouse.down();
await page.waitForTimeout(560);
await page.mouse.up();
assert.equal((await cells())[emptyIdx], 2, 'langes Drücken setzt ✕');

// Ein Tipp in ein falsches Feld und Rückgängig
p = await cellXY(er, ec);
await page.tap('[data-tool="undo"]');
assert.equal((await cells())[emptyIdx], 0, 'Rückgängig entfernt ✕');

// Ganze Zeilen per Ziehen füllen, sonst Felder antippen
for (let r = 0; r < h; r++) {
  const row = mask.slice(r * w, r * w + w);
  if (row.every((v) => v === 1)) {
    await drag(await cellXY(r, 0), await cellXY(r, w - 1));
    continue;
  }
  for (let c = 0; c < w; c++) {
    if (!row[c]) continue;
    const cur = await cells();
    if (cur[r * w + c] === 1) continue;
    const q = await cellXY(r, c);
    await page.touchscreen.tap(q.x, q.y);
  }
}
await page.waitForSelector('.sp-modal .win', { timeout: 8000 });
await page.waitForTimeout(500);
await shot('03-win');
const solvedCells = await cells();
assert.ok(mask.every((v, i) => (v === 1) === (solvedCells[i] === 1)), 'Lösung korrekt');
await page.click('.sp-modal .btn >> text=Bild ansehen');
await page.waitForSelector('.play.is-solved .solved-bar');
await shot('03b-picture');
await page.tap('.play-top .icon-btn >> nth=0');
await page.waitForFunction(() => location.hash === '#pack/mini');
await page.waitForSelector('.tile.solved');
await page.tap('.topbar .icon-btn >> nth=0');
await page.waitForFunction(() => !location.hash);
await page.waitForSelector('.pack[data-pack="mini"] .pack-count');
assert.equal((await page.textContent('.pack[data-pack="mini"] .pack-count')).trim(), '1/34');
const sum = await page.evaluate(() => localStorage.getItem('spielpause.summary.nonogram') || JSON.stringify(Object.keys(localStorage)));
step('Kachel-Status: ' + sum);

// 3) Tagesrätsel: ein paar Züge, Neuladen, Zustand muss bleiben
step('Tagesrätsel + Neuladen');
await page.waitForTimeout(400); // Doppeltipp-Schutz der Seite (320 ms) abwarten
await page.tap('#daily-card');
await page.waitForFunction(() => window.__nono && location.hash === '#daily');
await page.waitForTimeout(300);
const d = await info();
assert.ok(d.w >= 10);
const fillIdx = [];
for (let i = 0; i < d.mask.length && fillIdx.length < 4; i++) if (d.mask[i]) fillIdx.push(i);
for (const i of fillIdx) {
  const q = await cellXY(Math.floor(i / d.w), i % d.w);
  await page.touchscreen.tap(q.x, q.y);
}
await page.tap('[data-tool="hint"]');
await page.waitForTimeout(300);
const before = await cells();
await page.waitForTimeout(400);
step('neu laden');
await page.reload();
await page.waitForFunction(() => window.__nono && location.hash === '#daily');
await page.waitForTimeout(300);
assert.deepEqual(await cells(), before, 'Spielstand nach Neuladen identisch');
await shot('04-daily-reload');
// Zurück ins Menü: Tagesrätsel zeigt «Weiter»
step('zurück ins Menü');
await page.tap('.play-top .icon-btn >> nth=0');
await page.waitForFunction(() => !location.hash);
assert.match(await page.textContent('#daily-card'), /Weiter/);

// 4) Grosses Rätsel: Lupe vergrössert auf ≥ 28 px, Tippen funktioniert
step('20×20 mit Lupe');
await page.evaluate(() => { location.hash = '#play/r-fuchs'; });
await page.waitForFunction(() => window.__nono && window.__nono.game.w === 20);
await page.waitForTimeout(300);
const fitCs = await page.evaluate(() => window.__nono.board.cs);
await page.tap('[data-tool="zoom"]');
const zoomCs = await page.evaluate(() => window.__nono.board.cs);
step(`Zellgrösse ${fitCs.toFixed(1)} → ${zoomCs.toFixed(1)} px`);
assert.ok(zoomCs >= 28, 'Zoom ≥ 28 px');
const vis = await page.evaluate(() => { const b = window.__nono.board; return { r: Math.floor((b.sy + b.vh / 2) / b.cs), c: Math.floor((b.sx + b.vw / 2) / b.cs) }; });
const z = await cellXY(vis.r, vis.c);
await page.touchscreen.tap(z.x, z.y);
assert.equal((await cells())[vis.r * 20 + vis.c], 1, 'Zelle im Zoom gefüllt');
await shot('05-zoom');
// Ansicht verschieben (Mausrad) – Hinweise bleiben sichtbar
await page.mouse.move(z.x, z.y);
await page.evaluate(() => { const b = window.__nono.board; b.panBy(-200, -200); });
await page.waitForTimeout(100);
await shot('06-zoom-pan');

// Pinch-Zoom mit zwei Fingern (CDP-Touch) – darf keine Felder verändern
await page.tap('[data-tool="zoom"]');
assert.ok(Math.abs((await page.evaluate(() => window.__nono.board.cs)) - fitCs) < 0.5, 'Lupe zurück auf Übersicht');
const cellsBeforePinch = await cells();
const cdp = await ctx.newCDPSession(page);
const mid = await cellXY(10, 10);
const pts = (d) => [{ x: mid.x - d, y: mid.y, id: 1 }, { x: mid.x + d, y: mid.y, id: 2 }];
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(20) });
for (let d = 24; d <= 80; d += 8) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d) });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(100);
const pinchCs = await page.evaluate(() => window.__nono.board.cs);
step(`Pinch: ${fitCs.toFixed(1)} → ${pinchCs.toFixed(1)} px`);
assert.ok(pinchCs > fitCs * 1.4, 'Pinch zoomt');
assert.deepEqual(await cells(), cellsBeforePinch, 'Pinch verändert keine Felder');

// 5) Album, Statistik, Paket
step('Album / Statistik / Paket');
await page.evaluate(() => { location.hash = '#album'; });
await page.waitForSelector('.album-item');
await shot('07-album');
await page.evaluate(() => { location.hash = '#stats'; });
await page.waitForSelector('.stat-grid');
assert.equal((await page.textContent('.stat-grid .stat b')).trim(), '1');
await shot('08-stats');
await page.evaluate(() => { location.hash = '#pack/mini'; });
await page.waitForSelector('.tile.solved');
await shot('09-pack');

await browser.close();
if (errors.length) { console.error('Konsolenfehler:\n' + errors.join('\n')); process.exit(1); }
console.log('E2E ok – keine Konsolenfehler.');
