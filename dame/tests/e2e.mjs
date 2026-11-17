import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/dame/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.addInitScript(() => localStorage.setItem('spielpause.tutorial.dame', 'true'));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE);
await page.waitForSelector('.gm-primary');
await page.screenshot({ path: OUT + '01-menu.png' });
await page.locator('.gm-primary').tap();
await page.waitForSelector('.dm-sq.dark');
await page.screenshot({ path: OUT + '02-board.png' });
const tap = await page.evaluate(() => {
  const m = window.__sp.moves()[0];
  const box = (i) => {
    const r = document.querySelector(`[data-i="${i}"]`).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  return { from: box(m.from), to: box(m.to) };
});
await page.touchscreen.tap(tap.from.x, tap.from.y);
await page.touchscreen.tap(tap.to.x, tap.to.y);
await page.waitForFunction(() => window.__sp && !window.__sp.busy() && window.__sp.state().turn === 1 && window.__sp.state().hist.length >= 1, null, { timeout: 8000 });
await page.screenshot({ path: OUT + '03-played.png' });
const fit = await page.evaluate(() => {
  const b = document.querySelector('.dm').getBoundingClientRect();
  const squares = [...document.querySelectorAll('.dm-sq')].map((el) => el.getBoundingClientRect());
  const t = document.querySelector('.bd-tools').getBoundingClientRect();
  return {
    inside: b.left >= -1 && b.right <= innerWidth + 1 && squares.every((s) => s.left >= -1 && s.right <= innerWidth + 1),
    above: b.bottom <= t.top + 2,
    tools: t.bottom <= innerHeight + 1,
  };
});
assert.equal(fit.inside && fit.above && fit.tools, true, JSON.stringify(fit));
assert.deepEqual(errors, []);
await browser.close();
console.log('dame e2e ok');
