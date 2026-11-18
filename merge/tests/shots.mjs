// Screenshots für Startbildschirm, Tutorial und Coach-Mark (iPhone 13, DSF 1).
//   Server: python3 -m http.server 8141 --bind 127.0.0.1   (aus dem Repo-Wurzelverzeichnis)
//   Start:  BASE=http://127.0.0.1:8141/merge/ node merge/tests/shots.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8141/merge/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY || '';
const errors = [];
const browser = await chromium.launch();

async function ctxPage(opts = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, locale: opts.locale || 'de-CH', ...(opts.viewport ? { viewport: opts.viewport } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const want = (k) => !ONLY || ONLY.split(',').includes(k);

// Fortschritt für «Menü mit Fortschritt»
const progress = {
  v: 1, seenHelp: true, tab: 'levels', mode: 'klassisch', skin: 'fruechte',
  best: { klassisch: 18432, entspannt5: 5120 }, bestTile: { klassisch: 11, entspannt5: 9 }, played: { klassisch: 9, etappen: 14 },
  won: { klassisch: 2, etappen: 13 }, merges: 2400, moves: 5100, topE: 11,
  album: { fruechte: 11, zahlen: 11, tiere: 7 }, levelMax: 14,
  levelStars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 3, 6: 2, 7: 3, 8: 1, 9: 3, 10: 3, 11: 2, 12: 3, 13: 2 },
};

if (want('fresh')) {
  const { ctx, page } = await ctxPage();
  await page.goto(BASE);
  await page.waitForSelector('.tut-backdrop.show');
  const n = await page.locator('.tut-dots span').count();
  for (let i = 0; i < n; i++) {
    await page.waitForTimeout(i === 0 ? 1900 : 1500);
    await shot(page, `tut-${i + 1}`);
    await page.locator('.tut-next').click();
  }
  await page.waitForTimeout(500);
  await shot(page, 'menu-fresh');
  await page.locator('.gm-primary').click();
  await page.waitForSelector('.board .tile');
  await page.waitForTimeout(900);
  await shot(page, 'coach-first');
  await ctx.close();
}
if (want('progress')) {
  const { ctx, page } = await ctxPage();
  await page.goto(BASE);
  await page.evaluate((p) => { localStorage.setItem('spielpause.merge.progress', JSON.stringify(p)); localStorage.setItem('spielpause.tutorial.merge', 'true'); }, progress);
  await page.reload();
  await page.waitForTimeout(600);
  await shot(page, 'menu-progress');
  await page.evaluate(() => document.querySelector('.gm-scroll').scrollTo(0, 9999));
  await page.waitForTimeout(300);
  await shot(page, 'menu-progress-bottom');
  await ctx.close();
}
if (want('small')) {
  const { ctx, page } = await ctxPage({ viewport: { width: 375, height: 667 } });
  await page.goto(BASE);
  await page.evaluate((p) => { localStorage.setItem('spielpause.merge.progress', JSON.stringify(p)); localStorage.setItem('spielpause.tutorial.merge', 'true'); }, { ...progress, tab: 'free' });
  await page.reload();
  await page.waitForTimeout(600);
  await shot(page, 'menu-375x667');
  const b = await page.locator('.gm-primary').boundingBox();
  console.log('primary bottom at', Math.round(b.y + b.height), 'of 667');
  if (b.y + b.height > 667) errors.push('Hauptknopf auf 375x667 nicht sichtbar');
  await ctx.close();
}
if (want('level1')) {
  const { ctx, page } = await ctxPage();
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.setItem('spielpause.tutorial.merge', 'true'); localStorage.setItem('spielpause.merge.progress', JSON.stringify({ tab: 'levels', moves: 3 })); });
  await page.goto(BASE + '#etappe/1');
  await page.waitForSelector('.board .tile');
  await page.waitForTimeout(1100);
  await shot(page, 'coach-level1');
  await ctx.close();
}
if (want('en')) {
  const { ctx, page } = await ctxPage({ locale: 'en-US' });
  await page.goto(BASE);
  await page.waitForSelector('.tut-backdrop.show');
  await page.waitForTimeout(1900);
  await shot(page, 'en-tut-1');
  await page.locator('.tut-skip').click();
  await page.waitForTimeout(500);
  await shot(page, 'en-menu');
  await ctx.close();
}
await browser.close();
console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'ok, keine Konsolenfehler');
process.exit(errors.length ? 1 : 0);
