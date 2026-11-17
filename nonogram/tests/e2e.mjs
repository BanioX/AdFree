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

// 1) Erster Start: animiertes Tutorial (shared/tutorial.js) erscheint automatisch
step('Menü und Tutorial');
await page.goto(BASE);
await page.waitForSelector('.tut-backdrop.show', { timeout: 4000 });
assert.match(await page.textContent('.tut-title'), /Felder füllen/);
await page.waitForTimeout(1900);
await shot('01-help');
await page.click('.tut-next');
await page.waitForTimeout(150);
await page.click('.tut-next');
await page.waitForTimeout(2600);
await shot('01b-help-reveal');
await page.click('.tut-skip');
await page.waitForSelector('.tut-backdrop', { state: 'detached' });
assert.ok(await page.$('.gm .gm-primary'), 'gemeinsamer Startbildschirm (gameMenu)');
await shot('02-menu');

// 2) Erstes Bild (5×5) komplett lösen
step('Spielen → erstes Bild lösen');
await page.tap('.gm-primary');
await page.waitForFunction(() => window.__nono && location.hash.startsWith('#play/'));
await page.waitForTimeout(300);
const { w, h, mask } = await info();
assert.equal(w, 5);
assert.ok(await page.$('.coach'), 'Coach-Mark beim ersten Bild');
assert.ok(await page.evaluate(() => !!window.__nono.board.coach));
await shot('02b-coach');

// Long-Press setzt ein Kreuz auf ein leeres Feld
const emptyIdx = mask.indexOf(0);
const er = Math.floor(emptyIdx / w), ec = emptyIdx % w;
let p = await cellXY(er, ec);
await page.mouse.move(p.x, p.y);
await page.mouse.down();
await page.waitForTimeout(560);
await page.mouse.up();
assert.equal((await cells())[emptyIdx], 2, 'langes Drücken setzt ✕');
await page.waitForSelector('.coach', { state: 'detached' });
assert.ok(await page.evaluate(() => !window.__nono.board.coach), 'Coach-Mark verschwindet nach dem ersten Zug');

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
// Vom Menü aus geöffnet → Zurück führt ins Menü (nicht ins Paket)
await page.tap('.play-top .icon-btn >> nth=0');
await page.waitForFunction(() => !location.hash);
await page.waitForSelector('.pack[data-pack="mini"] .pack-count');
assert.equal((await page.textContent('.pack[data-pack="mini"] .pack-count')).trim(), '1/34');
// Aus dem Paket geöffnet → Zurück führt ins Paket, von dort ins Menü
await page.waitForTimeout(400);
await page.tap('.pack[data-pack="mini"]');
await page.waitForSelector('.tile.solved');
await page.waitForTimeout(400);
await page.tap('.tile >> nth=1');
await page.waitForFunction(() => window.__nono && location.hash === '#play/m-haus');
await page.waitForTimeout(400);
await page.tap('.play-top .icon-btn >> nth=0');
await page.waitForFunction(() => location.hash === '#pack/mini');
await page.waitForTimeout(400);
await page.tap('.topbar .icon-btn >> nth=0');
await page.waitForFunction(() => !location.hash);
await page.waitForSelector('.gm-primary');
const sum = await page.evaluate(() => localStorage.getItem('spielpause.summary.nonogram') || JSON.stringify(Object.keys(localStorage)));
step('Kachel-Status: ' + sum);

// 3) Tagesrätsel: ein paar Züge, Neuladen, Zustand muss bleiben
step('Tagesrätsel + Neuladen');
await page.waitForTimeout(400); // Doppeltipp-Schutz der Seite (320 ms) abwarten
await page.tap('.gm-daily');
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
await page.waitForSelector('.gm-daily');
assert.match(await page.textContent('.gm-daily'), /Weiter/);

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

// Prüfen: falsch gefüllte Felder bleiben markiert, bis man sie ändert; Meldung über der Werkzeugleiste
step('Prüfen markiert Fehler dauerhaft');
const fz = await info();
const cur20 = await cells();
const wrongIdx = fz.mask.findIndex((v, i) => !v && !cur20[i]);
await page.evaluate((i) => { window.__nono.board.centerOn(Math.floor(i / 20), i % 20); }, wrongIdx);
let wq = await cellXY(Math.floor(wrongIdx / 20), wrongIdx % 20);
await page.touchscreen.tap(wq.x, wq.y);
assert.equal((await cells())[wrongIdx], 1);
await page.waitForTimeout(450);
await page.tap('[data-tool="check"]');
await page.waitForTimeout(300);
const pos = await page.evaluate(() => ({
  toast: document.querySelector('.sp-toast').getBoundingClientRect().bottom,
  tools: document.querySelector('.toolbar').getBoundingClientRect().top,
  clues: window.__nono.board.vy + window.__nono.board.cv.getBoundingClientRect().top,
  toastTop: document.querySelector('.sp-toast').getBoundingClientRect().top,
}));
assert.ok(pos.toast <= pos.tools + 1 && pos.toastTop > pos.clues, 'Meldung liegt über der Werkzeugleiste, nicht über den Zahlen');
await shot('05b-check');
await page.waitForTimeout(2200);
assert.ok(await page.evaluate((i) => window.__nono.board.marks.has(i), wrongIdx), 'Markierung bleibt nach 2.5 s');
wq = await cellXY(Math.floor(wrongIdx / 20), wrongIdx % 20);
await page.touchscreen.tap(wq.x, wq.y);
assert.ok(await page.evaluate((i) => !window.__nono.board.marks.has(i), wrongIdx), 'Markierung weg nach Änderung');

// Zoom und Ausschnitt überstehen das Neuladen
step('Zoom nach Neuladen');
await page.waitForTimeout(450);
const zBefore = await page.evaluate(() => { const b = window.__nono.board; return { cs: b.cs, sx: b.sx, sy: b.sy }; });
await page.reload();
await page.waitForFunction(() => window.__nono && window.__nono.game.w === 20);
await page.waitForTimeout(300);
const zAfter = await page.evaluate(() => { const b = window.__nono.board; return { cs: b.cs, sx: b.sx, sy: b.sy }; });
assert.ok(Math.abs(zAfter.cs - zBefore.cs) < 0.6 && Math.abs(zAfter.sx - zBefore.sx) < 2, `Zoom bleibt (${zBefore.cs.toFixed(1)} → ${zAfter.cs.toFixed(1)})`);

// Rückgängig in den ersten Sekunden: kein veralteter Spielstand
step('Rückgängig löscht frischen Spielstand');
await page.evaluate(() => { location.hash = '#play/m-pilz'; });
await page.waitForFunction(() => window.__nono && location.hash === '#play/m-pilz');
await page.waitForTimeout(300);
const pz = await info();
const pi = pz.mask.indexOf(1);
const pq = await cellXY(Math.floor(pi / 5), pi % 5);
await page.touchscreen.tap(pq.x, pq.y);
await page.waitForTimeout(400);
assert.ok(await page.evaluate(() => localStorage.getItem('spielpause.nonogram.p.m-pilz')), 'gespeichert');
await page.tap('[data-tool="undo"]');
await page.waitForTimeout(400);
assert.equal(await page.evaluate(() => localStorage.getItem('spielpause.nonogram.p.m-pilz')), null, 'Stand gelöscht');

// Älteres Tagesrätsel nochmals lösen: Serie bleibt
step('Altes Tagesrätsel lässt die Serie in Ruhe');
const { today, past } = await page.evaluate(async () => {
  const S = await import('/shared/storage.js');
  const d = new Date(); d.setDate(d.getDate() - 7);
  return { today: S.todayKey(), past: S.todayKey(d) };
});
await page.evaluate((t) => localStorage.setItem('spielpause.dailyStreak.nonogram', JSON.stringify({ last: t, count: 5 })), today);
await page.evaluate((d) => { location.hash = '#play/daily-' + d; }, past);
await page.waitForFunction((d) => window.__nono && location.hash === '#play/daily-' + d, past);
await page.waitForTimeout(300);
const dm = await info();
const lastI = dm.mask.lastIndexOf(1);
await page.evaluate((li) => { const g = window.__nono.game; g.p.mask.forEach((v, i) => { if (v && i !== li) g.cells[i] = 1; }); window.__nono.board.invalidate(); }, lastI);
await page.evaluate((i) => { window.__nono.board.centerOn(Math.floor(i / window.__nono.game.w), i % window.__nono.game.w); }, lastI);
const lq = await cellXY(Math.floor(lastI / dm.w), lastI % dm.w);
await page.touchscreen.tap(lq.x, lq.y);
await page.waitForSelector('.sp-modal .win', { timeout: 8000 });
const streak = await page.evaluate(() => JSON.parse(localStorage.getItem('spielpause.dailyStreak.nonogram')));
assert.deepEqual(streak, { last: today, count: 5 }, 'Serie unverändert');
await page.click('.sp-modal .btn >> text=Zum Menü');
await page.waitForFunction(() => !location.hash);

// Angefangenes Perlenbild: Menü zeigt «Weiter»
step('Perlenbild «Weiter»');
const pid = await page.evaluate(async () => {
  const L = await import('/nonogram/core/library.js');
  const bp = await L.loadBeadsPack(() => import('/beads/art/index.js'));
  return bp.puzzles[0].id;
});
await page.evaluate((id) => { location.hash = '#play/' + id; }, pid);
await page.waitForFunction((id) => window.__nono && location.hash === '#play/' + id, pid);
await page.waitForTimeout(300);
const bm = await info();
const bi = bm.mask.indexOf(1);
await page.evaluate((i) => { window.__nono.board.centerOn(Math.floor(i / window.__nono.game.w), i % window.__nono.game.w); }, bi);
const bq = await cellXY(Math.floor(bi / bm.w), bi % bm.w);
await page.touchscreen.tap(bq.x, bq.y);
await page.waitForTimeout(400);
await page.goto(BASE);
await page.waitForFunction(() => /Weiter/.test(document.querySelector('.gm-primary')?.textContent || ''));
assert.match(await page.textContent('.gm-primary'), /Perlenbilder/);
await page.waitForSelector('.gm-art.custom canvas');
await shot('02c-menu-weiter');
await page.goto(BASE + '#stats');
await page.waitForSelector('.stat-grid');
assert.match(await page.textContent('.stats-body'), /Perlenbilder/, 'Perlen-Zeile auch nach direktem Neuladen');

// 5) Album, Statistik, Paket
step('Album / Statistik / Paket');
await page.evaluate(() => { location.hash = '#album'; });
await page.waitForSelector('.album-item');
await shot('07-album');
await page.evaluate(() => { location.hash = '#stats'; });
await page.waitForSelector('.stat-grid');
assert.equal((await page.textContent('.stat-grid .stat b')).trim(), '2');
await shot('08-stats');
await page.evaluate(() => { location.hash = '#pack/mini'; });
await page.waitForSelector('.tile.solved');
await shot('09-pack');

await browser.close();
if (errors.length) { console.error('Konsolenfehler:\n' + errors.join('\n')); process.exit(1); }
console.log('E2E ok – keine Konsolenfehler.');
