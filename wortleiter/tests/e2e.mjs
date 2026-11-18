import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire('/tmp/pw/node_modules/playwright-core/index.js')('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/wortleiter/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('spielpause.tutorial.wortleiter', 'true');
  if (!localStorage.getItem('spielpause.lang')) localStorage.setItem('spielpause.lang', '"de"');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE);
await page.locator('.gm-primary').tap();
await page.waitForSelector('.wl-now');
await page.screenshot({ path: OUT + '01.png' });
let moved = false;
for (let i = 0; i < 4 && !moved; i++) {
  await page.locator('[data-slot="' + i + '"]').tap();
  if (await page.locator('.wl-opts [data-ch]').count()) {
    await page.locator('.wl-opts [data-ch]').first().tap();
    moved = true;
  }
}
assert.equal(moved, true);
await page.waitForFunction(() => window.__sp.state().chain.length === 2);
await page.waitForTimeout(650);
const before = await page.evaluate(() => window.__sp.state().chain.length);
let clicked = false;
for (let i = 0; i < 4; i++) {
  await page.locator('[data-slot="' + i + '"]').evaluate((el) => el.click());
  if (await page.locator('.wl-opts [data-ch]').count()) {
    await page.locator('.wl-opts [data-ch]').first().evaluate((el) => el.click());
    clicked = true;
    break;
  }
}
assert.equal(clicked, true);
await page.waitForFunction((n) => window.__sp.state().chain.length > n, before);
await page.evaluate(() => localStorage.setItem('spielpause.lang', '"en"'));
await page.goto(BASE);
await page.evaluate(() => localStorage.removeItem('spielpause.wortleiter.match'));
await page.reload();
await page.locator('.gm-primary').tap();
assert.match(await page.locator('.bd-title b').innerText(), /Word Ladder/);
const fit = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
assert.equal(fit, true);
assert.deepEqual(errors, []);
await browser.close();
console.log('wortleiter e2e ok');
