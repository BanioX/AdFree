import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/futoshiki/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.futoshiki', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

async function fill(i, how) {
  const want = await page.evaluate((n) => window.__sp.state().solution[n], i);
  const cell = page.locator('.fu-grid button[data-i="' + i + '"]');
  const num = page.locator('.fu-nums button[data-n="' + want + '"]');
  if (how === 'click') {
    await cell.evaluate((el) => el.click());
    await num.evaluate((el) => el.click());
  } else {
    await cell.tap();
    await num.tap();
  }
}

await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.fu-grid');
await page.screenshot({ path: OUT + '01.png' });
const open = await page.evaluate(() => window.__sp.state().fixed.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0));
assert.ok(open.length >= 2);
await fill(open[0], 'tap');
await page.waitForFunction((i) => window.__sp.state().grid[i] === window.__sp.state().solution[i], open[0]);
await page.waitForTimeout(650);
await fill(open[1], 'click');
await page.waitForFunction((i) => window.__sp.state().grid[i] === window.__sp.state().solution[i], open[1]);
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.futoshiki.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Futoshiki/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('futoshiki e2e ok');
