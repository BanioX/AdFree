import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/schlange/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.schlange', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.sn');
await page.screenshot({ path: OUT + '01.png' });
async function point(dx, dy) {
  return page.evaluate(({ dx, dy }) => {
    const s = window.__sp.state();
    const el = document.querySelector('.sn');
    const r = el.getBoundingClientRect();
    const head = s.snake[0];
    return {
      x: r.x + ((head % s.w) + 0.5) / s.w * r.width + dx,
      y: r.y + (Math.floor(head / s.w) + 0.5) / s.h * r.height + dy,
    };
  }, { dx, dy });
}
const up = await point(0, -36);
await page.touchscreen.tap(up.x, up.y);
await page.waitForFunction(() => window.__sp.state().dir.r === -1);
await page.waitForTimeout(650);
const right = await point(40, 0);
await page.locator('.sn').evaluate((el, p) => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: p.x, clientY: p.y }));
}, right);
await page.waitForFunction(() => window.__sp.state().dir.c === 1);
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.schlange.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Snake/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('schlange e2e ok');
