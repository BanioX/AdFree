import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/zelte/';
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.zelte', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.pz button.field, .pz button.grass, .pz button.tent');
const cells = await page.evaluate(() => {
  const s = window.__sp.state();
  const out = [];
  for (let k = 0; k < s.n * s.n; k++) {
    if (s.trees.includes(k)) continue;
    const r = (k / s.n) | 0;
    const c = k % s.n;
    out.push(r * s.w + c);
    if (out.length === 2) break;
  }
  return out;
});
assert.equal(cells.length, 2);
await page.locator('.pz button[data-i="' + cells[0] + '"]').tap();
await page.waitForFunction((i) => {
  const s = window.__sp.state();
  const r = (i / s.w) | 0;
  const c = i % s.w;
  return s.mark[r * s.n + c] !== 0;
}, cells[0]);
await page.waitForTimeout(650);
await page.locator('.pz button[data-i="' + cells[1] + '"]').evaluate((el) => el.click());
await page.waitForFunction((i) => {
  const s = window.__sp.state();
  const r = (i / s.w) | 0;
  const c = i % s.w;
  return s.mark[r * s.n + c] !== 0;
}, cells[1]);
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.zelte.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Tents/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('zelte e2e ok');
