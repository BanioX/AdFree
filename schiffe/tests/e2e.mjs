import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/schiffe/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.schiffe', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.sea.mine');
await page.locator('.sea.mine i').first().tap();
await page.waitForFunction(() => window.__sp.state().meShips.length === 1);
await page.screenshot({ path: OUT + '01-place.png' });
await page.getByRole('button', { name: 'Zufall' }).tap();
await page.waitForFunction(() => window.__sp.state().phase === 'fight' && !window.__sp.busy());
await page.screenshot({ path: OUT + '02-fight.png' });
const before = await page.evaluate(() => window.__sp.state().seen.reduce((n, v) => n + (v ? 1 : 0), 0));
await page.locator('.sea.foe i').first().tap();
await page.waitForFunction((n) => {
  const s = window.__sp.state();
  return !window.__sp.busy() && s.seen.reduce((a, v) => a + (v ? 1 : 0), 0) > n;
}, before, { timeout: 12000 });

await page.waitForTimeout(650);
const unknown = page.locator('.sea.foe i:not(.miss):not(.hit):not(.sunk)').first();
const marked = await page.evaluate(() => window.__sp.state().seen.reduce((n, v) => n + (v ? 1 : 0), 0));
await unknown.click();
await page.waitForFunction((n) => {
  const s = window.__sp.state();
  return !window.__sp.busy() && s.seen.reduce((a, v) => a + (v ? 1 : 0), 0) > n;
}, marked, { timeout: 12000 });

await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.schiffe.match'));
await page.reload();
await page.locator('.gm-primary').tap();
await page.waitForSelector('.bd-status');
const status = await page.locator('.bd-status').innerText();
assert.match(status, /Place the ship of 5/);
await page.screenshot({ path: OUT + '03-en.png' });
assert.deepEqual(errors, []);
await browser.close();
console.log('schiffe e2e ok');
