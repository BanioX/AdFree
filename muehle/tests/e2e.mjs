import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/muehle/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.addInitScript(() => localStorage.setItem('spielpause.tutorial.muehle', 'true'));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE);
await page.waitForSelector('.gm-primary');
await page.screenshot({ path: OUT + '01-menu.png' });
await page.locator('.gm-primary').tap();
await page.waitForSelector('.mu-pt');
await page.screenshot({ path: OUT + '02-board.png' });
await page.locator('.mu-pt').first().tap();
await page.waitForFunction(() => window.__sp && !window.__sp.busy() && window.__sp.state().cells.filter(Boolean).length >= 2, null, { timeout: 8000 });
await page.screenshot({ path: OUT + '03-played.png' });
await page.waitForTimeout(550);
const clickOnly = await page.evaluate(() => {
  const before = window.__sp.state().cells.filter(Boolean).length;
  const el = [...document.querySelectorAll('.mu-pt')].find((p) => !p.querySelector('.mu-pc'));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return window.__sp.state().cells.filter(Boolean).length > before;
});
assert.equal(clickOnly, true, 'Klick ohne pointerup setzt einen Stein');
const fit = await page.evaluate(() => {
  const b = document.querySelector('.mu').getBoundingClientRect();
  const pts = [...document.querySelectorAll('.mu-pt')].map((el) => el.getBoundingClientRect());
  const t = document.querySelector('.bd-tools').getBoundingClientRect();
  return {
    inside: b.left >= -1 && b.right <= innerWidth + 1 && pts.every((p) => p.left >= -1 && p.right <= innerWidth + 1),
    above: b.bottom <= t.top + 2,
    tools: t.bottom <= innerHeight + 1,
  };
});
assert.equal(fit.inside && fit.above && fit.tools, true, JSON.stringify(fit));
assert.deepEqual(errors, []);
await browser.close();
console.log('muehle e2e ok');
