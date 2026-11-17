import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/kalaha/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.addInitScript(() => localStorage.setItem('spielpause.tutorial.kalaha', 'true'));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE);
await page.waitForSelector('.gm-primary');
await page.screenshot({ path: OUT + '01-menu.png' });
await page.locator('.gm-primary').tap();
await page.waitForSelector('.ka-pit.mine');
await page.screenshot({ path: OUT + '02-board.png' });
const pit = page.locator('.ka-pit.mine').nth(2);
const box = await pit.boundingBox();
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForFunction(() => {
  const s = window.__sp && window.__sp.state();
  return s && !window.__sp.busy() && (s.turn === 1) && (s.extra || s.p[6] > 0 || s.hist.length);
}, null, { timeout: 8000 });
await page.screenshot({ path: OUT + '03-played.png' });
const fit = await page.evaluate(() => {
  const b = document.querySelector('.ka');
  const r = b.getBoundingClientRect();
  const t = document.querySelector('.bd-tools').getBoundingClientRect();
  const pits = [...document.querySelectorAll('.ka-pit,.ka-store')].map((el) => el.getBoundingClientRect());
  return {
    left: r.left, right: r.right, iw: innerWidth, scroll: b.scrollWidth <= b.clientWidth + 1,
    tools: t.bottom <= innerHeight + 1, above: r.bottom <= t.top + 2,
    pitsIn: pits.every((p) => p.left >= -1 && p.right <= innerWidth + 1),
  };
});
assert.equal(fit.pitsIn && fit.scroll && fit.above && fit.right <= fit.iw + 1 && fit.left >= -1, true, JSON.stringify(fit));
assert.deepEqual(errors, []);
await browser.close();
console.log('kalaha e2e ok');
