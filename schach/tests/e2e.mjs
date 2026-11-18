import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/schach/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.schach', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.ch');
await page.screenshot({ path: OUT + '01-board.png' });
await page.locator('.ch button[data-i="12"]').tap();
await page.locator('.ch button.dot, .ch button.cap').first().waitFor();
await page.locator('.ch button[data-i="28"]').tap();
await page.waitForFunction(() => {
  const s = window.__sp.state();
  return !window.__sp.busy() && s.turn === 1 && s.board[12] === 0 && s.board[28] === 1;
}, null, { timeout: 12000 });
await page.screenshot({ path: OUT + '02-moved.png' });

await page.waitForTimeout(650);
const mv = await page.evaluate(() => {
  const m = window.__sp.moves().find((x) => x.piece === 1 && !x.captured) || window.__sp.moves()[0];
  return { from: m.from, to: m.to };
});
await page.locator('.ch button[data-i="' + mv.from + '"]').evaluate((el) => el.click());
await page.locator('.ch button[data-i="' + mv.to + '"]').evaluate((el) => el.click());
await page.waitForFunction((from) => {
  const s = window.__sp.state();
  return !window.__sp.busy() && s.turn === 1 && s.board[from] === 0;
}, mv.from, { timeout: 12000 });

await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.schach.match'));
await page.reload();
await page.locator('.gm-primary').tap();
await page.waitForSelector('.bd-status');
assert.match(await page.locator('.bd-status').innerText(), /Your turn/);
assert.match(await page.locator('.bd-title b').innerText(), /Chess/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
await page.screenshot({ path: OUT + '03-en.png' });
assert.deepEqual(errors, []);
await browser.close();
console.log('schach e2e ok');
