import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/farbkugel/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.farbkugel', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.fk5-grid');
await page.screenshot({ path: OUT + '01.png' });
const pair = await page.evaluate(() => window.__sp.pair());
assert.ok(pair.from >= 0 && pair.to >= 0);
const stamp = await page.evaluate(() => ({ rng: window.__sp.state().rng, lines: window.__sp.state().lines }));
await page.locator('.fk5-grid button[data-i="' + pair.from + '"]').tap();
await page.locator('.fk5-grid button[data-i="' + pair.to + '"]').tap();
await page.waitForFunction((p) => {
  const s = window.__sp.state();
  return s.rng !== p.rng || s.lines !== p.lines;
}, stamp);
await page.waitForTimeout(650);
const over = await page.evaluate(() => window.__sp.state().lines >= window.__sp.state().need);
const again = over ? { from: -1, to: -1 } : await page.evaluate(() => window.__sp.pair());
if (again.from >= 0 && again.to >= 0) {
  await page.locator('.fk5-grid button[data-i="' + again.from + '"]').evaluate((el) => el.click());
  await page.locator('.fk5-grid button[data-i="' + again.to + '"]').evaluate((el) => el.click());
  await page.waitForFunction((from) => window.__sp.state().balls[from] < 0, again.from);
}
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.farbkugel.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Color Lines/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('farbkugel e2e ok');
