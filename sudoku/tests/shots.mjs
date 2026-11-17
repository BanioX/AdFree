// Bilder für die Sichtprüfung von Startbildschirm, Tutorial, Coach-Mark, Lob und Sieg-Blatt.
//   python3 -m http.server 8137 --bind 127.0.0.1   (im Repo-Wurzelverzeichnis)
//   BASE=http://127.0.0.1:8137/ node sudoku/tests/shots.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8137/';
const OUT = process.env.SHOTS || fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const errors = [];
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') }).then(() => console.log('•', name));

function watch(page) {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
}
async function tap(page, sel, wait = 380) {
  const b = await page.locator(sel).first().boundingBox();
  assert.ok(b, sel);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(wait);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
watch(page);
await page.goto(BASE + 'sudoku/');

// Tutorial beim ersten Start – jeder Schritt mitten in der Animation
await page.waitForSelector('.tut-backdrop.show');
const waits = [1500, 2700, 2300, 2500];
for (let k = 0; k < 4; k++) {
  await page.waitForTimeout(waits[k]);
  await shot(page, `s-tut-${k + 1}`);
  await page.locator('.tut-next').tap();
  await page.waitForTimeout(350);
}
await page.waitForSelector('.tut-backdrop', { state: 'detached' });
await page.waitForTimeout(400);
await shot(page, 's-menu-fresh');
assert.match(await page.locator('.gm-primary-sub').textContent(), /Rätsel Nr\. 1 · extra sanft/);

// Erstes Rätsel: Coach-Mark
await tap(page, '.gm-primary');
await page.waitForSelector('.coach-ring');
await page.waitForTimeout(700);
await shot(page, 's-coach');

// Durchspielen; Lob-Text bei der ersten fertigen Einheit festhalten
const g = await page.evaluate(() => window.__sudoku.game());
assert.equal([...g.values].filter((c) => c === '0').length, 28, 'erstes Rätsel ist extra sanft');
let praised = false;
for (let i = 0; i < 81; i++) {
  if (g.values[i] !== '0') continue;
  await tap(page, `.cell[data-i="${i}"]`, 20);
  await tap(page, `.key[data-d="${g.solution[i]}"]`, 60);
  if (!praised && await page.locator('.praise').count()) {
    await page.waitForTimeout(160);
    await shot(page, 's-praise');
    praised = true;
  }
}
assert.ok(praised, 'Lob-Text erscheint');
await page.waitForSelector('.sp-modal .win-reward', { timeout: 8000 });
await page.waitForTimeout(1600);
await shot(page, 's-win');
assert.ok(await page.locator('.win-unlock').count(), '3 Sterne schalten «Koralle» frei');
await page.locator('.win-use').tap();
await page.waitForTimeout(300);
await page.locator('.sp-modal .btn', { hasText: 'Zum Menü' }).tap();
await page.waitForSelector('.screen.menu');

// Menü mit Fortschritt: laufendes Spiel, Sterne, Tagesrätsel-Serie
await page.evaluate(() => {
  localStorage.setItem('spielpause.sudoku.stars', '17');
  const s = JSON.parse(localStorage.getItem('spielpause.sudoku.seq') || '{}');
  s.leicht = 4; localStorage.setItem('spielpause.sudoku.seq', JSON.stringify(s));
});
await page.reload();
await page.waitForSelector('.screen.menu');
assert.match(await page.locator('.gm-primary-sub').textContent(), /Gold/);
await tap(page, '.gm-primary');
await page.waitForSelector('.screen.play.gold');
for (let k = 0, n = 0; k < 81 && n < 14; k++) {
  const gg = await page.evaluate(() => window.__sudoku.game());
  if (gg.values[k] !== '0') continue;
  await tap(page, `.cell[data-i="${k}"]`, 20);
  await tap(page, `.key[data-d="${gg.solution[k]}"]`, 40);
  n++;
}
await page.waitForTimeout(1800);
await shot(page, 's-gold');
await tap(page, '.play-top .icon-btn');
await page.waitForSelector('.screen.menu');
await page.waitForTimeout(500);
await shot(page, 's-menu-progress');
await page.evaluate(() => document.querySelector('.gm-scroll').scrollTo(0, 9999));
await page.waitForTimeout(300);
await shot(page, 's-menu-progress-bottom');

// Kleines iPhone: Hauptknopf ohne Scrollen sichtbar
await page.setViewportSize({ width: 375, height: 667 });
await page.evaluate(() => document.querySelector('.gm-scroll').scrollTo(0, 0));
await page.waitForTimeout(300);
const pb = await page.locator('.gm-primary').boundingBox();
assert.ok(pb.y + pb.height <= 667, 'Hauptknopf auf 375×667 sichtbar');
await shot(page, 's-menu-375x667');

await browser.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log('ok');
