import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/farbklick/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.farbklick', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.fk-colors');
await page.screenshot({ path: OUT + '01.png' });
const color = await page.evaluate(() => window.__sp.best());
await page.locator('.fk-colors button[data-color="' + color + '"]').tap();
await page.waitForFunction(() => window.__sp.state().moves >= 1);
await page.waitForTimeout(650);
const other = await page.evaluate(() => {
  const s = window.__sp.state();
  for (let c = 0; c < s.colors; c++) if (c !== s.grid[0]) return c;
  return -1;
});
if (other >= 0) {
  await page.locator('.fk-colors button[data-color="' + other + '"]').evaluate((el) => el.click());
  await page.waitForFunction(() => window.__sp.state().moves >= 2);
}
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.farbklick.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Color Flood/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('farbklick e2e ok');
